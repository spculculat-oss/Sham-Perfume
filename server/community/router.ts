/**
 * «مجتمع شام» HTTP API.
 *
 *   /api/community/*        members (Bearer session token): accounts, portals, social, messenger
 *   /api/community/stores*  public store pages (published products only, no source links, no contacts)
 *   /api/admin/community/*  the administration (Bearer SHAM_ADMIN_TOKEN): everything, decrypted, audited
 *
 * Needs one server setting — a PostgreSQL database (Vercel → Storage → Neon → Connect adds DATABASE_URL).
 * SHAM_DATA_KEY is optional: without it the server creates its own data key in the database; set it later to
 * wrap that key (see loadDataKey). Without a database the API answers 503 COMMUNITY_NOT_CONFIGURED and the site
 * keeps its local accounts.
 */
import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { RateLimiter, clientKey } from '../core/rateLimit';
import type { FxTable } from '../../src/utils/pricing';
import { Vault } from './crypto';
import { DataKeyError, connectPglite, connectPostgres, databaseErrorKind, databaseHints, findDatabase, loadDataKey, migrate, type KeyMode, type Sql } from './db';
import * as svc from './service';
import * as social from './social';
import * as hub from './hub';
import * as chat from './messenger';
import * as mail from './mail';
import * as admin from './admin';

type Env = Record<string, string | undefined>;
type Handler = (req: express.Request, res: express.Response) => Promise<unknown>;

export interface CommunityOptions {
  env?: Env;
  /** Tests / local dev: an already-connected database. */
  sql?: Sql;
  fx?: () => Promise<FxTable>;
}

export interface Community {
  /** The context when the database and key are configured (connects and migrates once). */
  ready(): Promise<svc.Ctx | undefined>;
  status(): Promise<{
    enabled: boolean; reason?: 'database' | 'key' | 'error'; store?: string; keyMode?: KeyMode;
    /** The setting the database came from (name only), or — when none — the database-looking setting names found. */
    databaseVar?: string; found?: string[]; errorKind?: ReturnType<typeof databaseErrorKind>; vercelEnv?: string;
  }>;
  /** The signed-in member of a request (for the checkout), if any. */
  userFrom(req: express.Request): Promise<svc.SessionUser | undefined>;
}

export function createCommunity(options: CommunityOptions = {}): Community {
  const env = options.env || process.env;
  let ctx: Promise<svc.Ctx | undefined> | undefined;
  let reason: 'database' | 'key' | 'error' | undefined;
  let keyMode: KeyMode | undefined;
  let databaseVar: string | undefined;
  let errorKind: ReturnType<typeof databaseErrorKind> | undefined;
  const ready = () => (ctx ||= (async () => {
    const key = env.SHAM_DATA_KEY?.trim() || '';
    let sql = options.sql;
    if (!sql) {
      const db = findDatabase(env);
      databaseVar = db.name;
      if (db.url) sql = await connectPostgres(db.url);
      else if (!env.VERCEL && !env.SHAM_SERVERLESS && env.SHAM_COMMUNITY_DEV_DB) sql = await connectPglite(env.SHAM_COMMUNITY_DEV_DB === 'memory' ? undefined : env.SHAM_COMMUNITY_DEV_DB);
    }
    if (!sql) { reason = 'database'; return undefined; }
    await migrate(sql);
    errorKind = undefined;
    try {
      const { secret, mode } = await loadDataKey(sql, key, (s) => new Vault(s));
      keyMode = mode;
      return { sql, vault: new Vault(secret), fx: options.fx, env };
    } catch (error) {
      if (!(error instanceof DataKeyError)) throw error;
      console.error('[community]', error.message);
      reason = 'key'; // fixed by setting the right SHAM_DATA_KEY (a redeploy restarts the server)
      return undefined;
    }
  })().catch((error) => {
    console.error('[community] database unavailable:', error instanceof Error ? error.message : error);
    reason = 'error'; errorKind = databaseErrorKind(error); ctx = undefined; // retry on the next request
    return undefined;
  }));
  return {
    ready,
    async status() {
      const s = await statusOf();
      return Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)) as typeof s; // no empty fields
    },
    async userFrom(req) {
      const c = await ready();
      return c ? svc.authenticate(c, bearer(req)) : undefined;
    },
  };
  async function statusOf(): ReturnType<Community['status']> {
    const c = await ready();
    if (c) return { enabled: true, store: c.sql.kind, keyMode, databaseVar };
    const vercelEnv = env.VERCEL_ENV || undefined;
    if (reason === 'database') return { enabled: false, reason, found: databaseHints(env), vercelEnv };
    if (reason === 'error') return { enabled: false, reason, databaseVar, errorKind, vercelEnv };
    return { enabled: false, reason, databaseVar, vercelEnv };
  }
}

const bearer = (req: express.Request) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();

function sendError(res: express.Response, error: unknown) {
  if (res.headersSent) return;
  if (error instanceof svc.CommunityError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  console.error('[community]', error);
  res.status(500).json({ error: 'Something went wrong, please try again', code: 'FAILED' });
}

export function createCommunityRouter(community: Community, options: { env?: Env } = {}) {
  const env = options.env || process.env;
  const router = express.Router();
  const authLimiter = new RateLimiter(Number(env.SHAM_AUTH_RATE_PER_MIN) || 10, 60_000);
  const memberLimiter = new RateLimiter(Number(env.SHAM_COMMUNITY_RATE_PER_MIN) || 300, 60_000);
  const publicLimiter = new RateLimiter(120, 60_000);

  // Large bodies only here (pictures, voice notes); the rest of the API keeps its 128 kB limit.
  router.use(['/community', '/admin/community'], express.json({ limit: '3mb' }));
  router.use(['/community', '/admin/community'], (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  const notConfigured = async (res: express.Response) => {
    const s = await community.status();
    res.status(503).json({ error: 'The community is not configured on this server yet', code: 'COMMUNITY_NOT_CONFIGURED', reason: s.reason });
  };

  /** Public route (no account): stores and status. */
  const open = (handler: (ctx: svc.Ctx, req: express.Request, res: express.Response) => Promise<unknown>): Handler => async (req, res) => {
    if (!publicLimiter.allow(clientKey(req))) { res.status(429).json({ error: 'Too many requests', code: 'RATE_LIMITED' }); return; }
    try {
      const ctx = await community.ready();
      if (!ctx) { await notConfigured(res); return; }
      const out = await handler(ctx, req, res);
      if (!res.headersSent) res.json(out ?? { ok: true });
    } catch (error) { sendError(res, error); }
  };

  /** Member route: a valid session is required. */
  const member = (handler: (ctx: svc.Ctx, user: svc.SessionUser, req: express.Request, res: express.Response) => Promise<unknown>): Handler => async (req, res) => {
    try {
      const ctx = await community.ready();
      if (!ctx) { await notConfigured(res); return; }
      const user = await svc.authenticate(ctx, bearer(req));
      if (!user) { res.status(401).json({ error: 'Please sign in', code: 'UNAUTHENTICATED' }); return; }
      if (!memberLimiter.allow(user.id)) { res.status(429).json({ error: 'Too many requests', code: 'RATE_LIMITED' }); return; }
      const out = await handler(ctx, user, req, res);
      if (!res.headersSent) res.json(out ?? { ok: true });
    } catch (error) { sendError(res, error); }
  };

  const adminToken = env.SHAM_ADMIN_TOKEN?.trim() || '';
  /** Administration route: the server's admin token (same as the dashboard). */
  const boss = (handler: (ctx: svc.Ctx, req: express.Request, res: express.Response) => Promise<unknown>): Handler => async (req, res) => {
    if (adminToken.length < 12) { res.status(503).json({ error: 'Admin is disabled. Set SHAM_ADMIN_TOKEN on the server.', code: 'ADMIN_NOT_CONFIGURED' }); return; }
    const given = Buffer.from(bearer(req)); const expected = Buffer.from(adminToken);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) { res.status(401).json({ error: 'Invalid admin token', code: 'UNAUTHORIZED' }); return; }
    try {
      const ctx = await community.ready();
      if (!ctx) { await notConfigured(res); return; }
      const out = await handler(ctx, req, res);
      if (!res.headersSent) res.json(out ?? { ok: true });
    } catch (error) { sendError(res, error); }
  };

  const p = (req: express.Request, name: string) => String(req.params[name] || '');
  const agent = (req: express.Request) => String(req.headers['user-agent'] || '').slice(0, 200);
  /** Client IP for the device record: the first X-Forwarded-For hop (set by the host) else the socket. */
  const ip = (req: express.Request) => (String(req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket.remoteAddress || '').trim().replace(/^::ffff:/, '').slice(0, 64);

  /* ------------------------------------------ status & accounts ------------------------------------------ */
  router.get('/community/status', async (_req, res) => { res.json(await community.status()); });

  const limitedAuth = (handler: Handler): Handler => async (req, res) => {
    if (!authLimiter.allow(clientKey(req))) { res.status(429).json({ error: 'Too many attempts, please wait a minute', code: 'RATE_LIMITED' }); return; }
    return handler(req, res);
  };
  router.post('/community/auth/register', limitedAuth(open(async (ctx, req) => {
    const out = await svc.register(ctx, req.body || {}, agent(req), ip(req));
    // The platform's first official letter: every new member finds a welcome mail in «بريد شام».
    try { await mail.welcomeMail(ctx, out.me.id, out.me.name, out.me.lang); }
    catch (error) { console.warn('[community] welcome mail:', error instanceof Error ? error.message : error); }
    return out;
  })));
  router.post('/community/auth/login', limitedAuth(open((ctx, req) => svc.login(ctx, req.body || {}, agent(req), ip(req)))));
  /** Two-factor finish: the password opened a pending login, the authenticator code closes it. */
  router.post('/community/auth/login/2fa', limitedAuth(open((ctx, req) => svc.loginTwoFactor(ctx, req.body || {}))));
  router.post('/community/auth/logout', member(async (ctx, _u, req) => { await svc.logout(ctx, bearer(req), req.body?.everywhere === true); }));

  /* E-mail verification & forgot-password (codes; the request side never reveals existence). */
  router.post('/community/auth/verify-email', member(async (ctx, u, req) => svc.verifyEmail(ctx, u.id, req.body?.code)));
  router.post('/community/auth/resend-verification', member(async (ctx, u) => svc.resendVerification(ctx, u.id)));
  router.post('/community/auth/password-reset/request', limitedAuth(open((ctx, req) => svc.requestPasswordReset(ctx, req.body || {}))));
  router.post('/community/auth/password-reset/confirm', limitedAuth(open((ctx, req) => svc.confirmPasswordReset(ctx, req.body || {}))));

  router.get('/community/me', member((ctx, u) => svc.me(ctx, u.id)));
  router.patch('/community/me', member((ctx, u, req) => svc.updateProfile(ctx, u.id, req.body || {})));
  router.post('/community/me/password', member(async (ctx, u, req) => { await svc.changePassword(ctx, u.id, req.body || {}, bearer(req)); }));
  router.delete('/community/me', member(async (ctx, u, req) => { await svc.deleteAccount(ctx, u.id, req.body?.password); }));
  router.get('/community/me/export', member((ctx, u) => svc.exportMyData(ctx, u.id)));

  /* Devices & two-factor (the Security Checkup building blocks). */
  router.get('/community/me/sessions', member((ctx, u, req) => svc.mySessions(ctx, u.id, bearer(req))));
  router.delete('/community/me/sessions/:id', member(async (ctx, u, req) => { await svc.revokeSession(ctx, u.id, p(req, 'id'), bearer(req)); }));

  /* Passkeys (WebAuthn): the device's fingerprint/face/PIN is the second factor itself. */
  router.post('/community/me/passkeys/begin', member(async (ctx, u, req) => svc.passkeyRegisterBegin(ctx, u.id, req.body || {})));
  router.post('/community/me/passkeys/finish', member(async (ctx, u, req) => svc.passkeyRegisterFinish(ctx, u.id, req.body || {})));
  router.get('/community/me/passkeys', member((ctx, u) => svc.myPasskeys(ctx, u.id)));
  router.delete('/community/me/passkeys/:id', member(async (ctx, u, req) => { await svc.deletePasskey(ctx, u.id, p(req, 'id'), req.body?.password); }));
  router.post('/community/me/passkeys/:id/delete', member(async (ctx, u, req) => { await svc.deletePasskey(ctx, u.id, p(req, 'id'), req.body?.password); }));
  router.post('/community/auth/passkey/begin', limitedAuth(open((ctx, req) => svc.passkeyLoginBegin(ctx, req.body || {}))));
  router.post('/community/auth/passkey/finish', limitedAuth(open((ctx, req) => svc.passkeyLoginFinish(ctx, req.body || {}, agent(req), ip(req)))));
  router.post('/community/me/2fa/setup', member(async (ctx, u, req) => svc.totpSetup(ctx, u.id, req.body?.password)));
  router.post('/community/me/2fa/confirm', member(async (ctx, u, req) => svc.totpConfirm(ctx, u.id, req.body?.code)));
  router.post('/community/me/2fa/disable', member(async (ctx, u, req) => svc.totpDisable(ctx, u.id, req.body?.password, req.body?.code)));
  /* Phone 2FA (WhatsApp/SMS) — optional, suggested (Google prompt style) */
  router.post('/community/me/2fa/phone/setup', member(async (ctx, u, req) => svc.setupPhone2fa(ctx, u.id, req.body || {})));
  router.post('/community/me/2fa/phone/confirm', member(async (ctx, u, req) => svc.confirmPhone2fa(ctx, u.id, req.body?.code)));
  router.post('/community/me/2fa/phone/disable', member(async (ctx, u, req) => svc.disablePhone2fa(ctx, u.id, req.body?.password, req.body?.code)));
  router.post('/community/auth/login/phone/request', limitedAuth(open((ctx, req) => svc.requestPhoneLoginCode(ctx, String(req.body?.pendingToken || '')))));
  router.post('/community/auth/login/phone/verify', limitedAuth(open((ctx, req) => svc.verifyPhoneLoginCode(ctx, req.body || {}))));
  /* OAuth (Google/Facebook) — start with the account you already have */
  router.post('/community/auth/google', limitedAuth(open((ctx, req) => svc.loginWithGoogle(ctx, req.body || {}, agent(req), ip(req)))));
  router.post('/community/auth/facebook', limitedAuth(open((ctx, req) => svc.loginWithFacebook(ctx, req.body || {}, agent(req), ip(req)))));

  /* ---------------------------------------------- user portal ---------------------------------------------- */
  router.get('/community/me/recipes', member((ctx, u) => svc.myRecipes(ctx, u.id)));
  router.post('/community/me/recipes', member((ctx, u, req) => svc.saveRecipe(ctx, u.id, req.body || {})));
  router.delete('/community/me/recipes/:id', member(async (ctx, u, req) => { await svc.deleteRecipe(ctx, u.id, p(req, 'id')); }));
  router.get('/community/recipes/:id', member((ctx, u, req) => svc.getRecipe(ctx, u.id, p(req, 'id'))));
  router.get('/community/me/learning', member((ctx, u) => svc.myLearning(ctx, u.id)));
  router.post('/community/me/learning', member((ctx, u, req) => svc.saveLearning(ctx, u.id, req.body || {})));
  router.get('/community/me/orders', member((ctx, u) => svc.myOrders(ctx, u.id)));

  /* -------------------------------------------- merchants' portal -------------------------------------------- */
  router.post('/community/merchant/apply', member((ctx, u, req) => svc.applyMerchant(ctx, u.id, req.body || {})));
  router.get('/community/merchant', member((ctx, u) => svc.myMerchant(ctx, u.id)));
  router.patch('/community/merchant', member((ctx, u, req) => svc.updateMerchant(ctx, u.id, req.body || {})));
  router.get('/community/merchant/products', member((ctx, u) => svc.myProducts(ctx, u.id)));
  router.post('/community/merchant/products', member((ctx, u, req) => svc.createProduct(ctx, u.id, req.body || {})));
  router.patch('/community/merchant/products/:id', member((ctx, u, req) => svc.updateProduct(ctx, u.id, p(req, 'id'), req.body || {})));
  router.delete('/community/merchant/products/:id', member(async (ctx, u, req) => { await svc.deleteProduct(ctx, u.id, p(req, 'id')); }));
  router.get('/community/merchant/orders', member((ctx, u) => svc.merchantOrders(ctx, u.id)));
  router.post('/community/merchant/orders/:id/ready', member(async (ctx, u, req) => { await svc.merchantOrderReady(ctx, u.id, p(req, 'id')); }));

  router.get('/community/stores', open((ctx) => svc.storeDirectory(ctx)));
  router.get('/community/stores/items', open((ctx, req) => svc.storeItems(ctx, String(req.query.skus || '').split(',').filter(Boolean))));
  router.get('/community/stores/:slug', open((ctx, req) => svc.storePage(ctx, p(req, 'slug'))));

  /* ------------------------------------------------- social ------------------------------------------------- */
  router.get('/community/feed', member((ctx, u, req) => social.feed(ctx, u.id, { before: req.query.before, scope: req.query.scope })));
  router.post('/community/posts', member((ctx, u, req) => social.createPost(ctx, u.id, req.body || {})));
  router.get('/community/posts/:id', member((ctx, u, req) => social.getPost(ctx, u.id, p(req, 'id'))));
  router.patch('/community/posts/:id', member((ctx, u, req) => social.editPost(ctx, u.id, p(req, 'id'), req.body || {})));
  router.delete('/community/posts/:id', member(async (ctx, u, req) => { await social.deletePost(ctx, u.id, p(req, 'id')); }));
  router.post('/community/posts/:id/react', member((ctx, u, req) => social.react(ctx, u.id, p(req, 'id'), req.body?.kind ?? null)));
  router.get('/community/posts/:id/comments', member((ctx, u, req) => social.comments(ctx, u.id, p(req, 'id'))));
  router.post('/community/posts/:id/comments', member((ctx, u, req) => social.addComment(ctx, u.id, p(req, 'id'), req.body?.body)));
  router.delete('/community/comments/:id', member(async (ctx, u, req) => { await social.deleteComment(ctx, u.id, p(req, 'id')); }));

  // «مجتمع شام» على طريقة فيسبوك: stories, the discussion salon (see hub.ts)
  router.get('/community/stories', member((ctx, u) => hub.stories(ctx, u.id)));
  router.post('/community/stories', member((ctx, u, req) => hub.createStory(ctx, u.id, req.body || {})));
  router.delete('/community/stories/:id', member(async (ctx, u, req) => { await hub.deleteStory(ctx, u.id, p(req, 'id')); }));
  router.post('/community/stories/:id/seen', member(async (ctx, u, req) => { await hub.seeStory(ctx, u.id, p(req, 'id')); }));
  router.get('/community/stories/:id/viewers', member((ctx, u, req) => hub.storyViewers(ctx, u.id, p(req, 'id'))));
  router.get('/community/discussions', member((ctx, u, req) => hub.threads(ctx, u.id, { category: req.query.category, q: req.query.q, sort: req.query.sort, limit: req.query.limit })));
  router.post('/community/discussions', member((ctx, u, req) => hub.createThread(ctx, u.id, req.body || {})));
  router.get('/community/discussions/:id', member((ctx, u, req) => hub.thread(ctx, u.id, p(req, 'id'))));
  router.delete('/community/discussions/:id', member(async (ctx, u, req) => { await hub.deleteThread(ctx, u.id, p(req, 'id')); }));
  router.post('/community/discussions/:id/replies', member((ctx, u, req) => hub.replyThread(ctx, u.id, p(req, 'id'), req.body?.body)));
  router.post('/community/discussions/:id/vote', member((ctx, u, req) => hub.voteThread(ctx, u.id, p(req, 'id'), req.body?.on)));
  router.post('/community/discussions/:id/solve', member((ctx, u, req) => hub.solveThread(ctx, u.id, p(req, 'id'), req.body?.replyId ?? null)));
  router.delete('/community/discussion-replies/:id', member(async (ctx, u, req) => { await hub.deleteReply(ctx, u.id, p(req, 'id')); }));
  // Product reviews: everyone reads (the signed-in visitor also sees «mine» / «helpful»), members write.
  router.get('/community/reviews/:sku', open(async (ctx, req) => hub.reviews(ctx, (await svc.authenticate(ctx, bearer(req)))?.id || null, p(req, 'sku'))));
  router.post('/community/reviews/:sku', member((ctx, u, req) => hub.saveReview(ctx, u.id, p(req, 'sku'), req.body || {})));
  router.delete('/community/review/:id', member(async (ctx, u, req) => { await hub.deleteReview(ctx, u.id, p(req, 'id')); }));
  router.post('/community/review/:id/helpful', member((ctx, u, req) => hub.helpfulReview(ctx, u.id, p(req, 'id'), req.body?.on)));

  router.get('/community/people', member((ctx, u, req) => social.searchPeople(ctx, u.id, req.query.q)));
  router.get('/community/people/suggestions', member((ctx, u) => social.suggestions(ctx, u.id)));
  router.get('/community/profile/:handle', member((ctx, u, req) => social.profile(ctx, u.id, p(req, 'handle'))));
  router.get('/community/friends', member((ctx, u) => social.friends(ctx, u.id)));
  router.post('/community/friends/:id', member(async (ctx, u, req) => ({ relation: await social.requestFriend(ctx, u.id, p(req, 'id')) })));
  router.delete('/community/friends/:id', member(async (ctx, u, req) => ({ relation: await social.removeFriend(ctx, u.id, p(req, 'id')) })));
  router.get('/community/blocks', member((ctx, u) => social.blockedList(ctx, u.id)));
  router.post('/community/blocks/:id', member(async (ctx, u, req) => { await social.block(ctx, u.id, p(req, 'id')); }));
  router.delete('/community/blocks/:id', member(async (ctx, u, req) => { await social.unblock(ctx, u.id, p(req, 'id')); }));
  router.post('/community/reports', member(async (ctx, u, req) => { await social.report(ctx, u.id, req.body || {}); }));
  router.get('/community/notifications', member((ctx, u) => social.notifications(ctx, u.id)));
  router.post('/community/notifications/read', member(async (ctx, u) => { await social.readNotifications(ctx, u.id); }));

  /* ------------------------------------------------ messenger ------------------------------------------------ */
  router.get('/community/pulse', member((ctx, u) => chat.pulse(ctx, u.id)));
  router.get('/community/chats', member((ctx, u) => chat.conversations(ctx, u.id)));
  router.post('/community/chats/direct', member(async (ctx, u, req) => ({ id: await chat.openDirect(ctx, u.id, String(req.body?.userId || '')) })));
  router.post('/community/chats/group', member(async (ctx, u, req) => ({ id: await chat.createGroup(ctx, u.id, req.body || {}) })));
  router.patch('/community/chats/:id', member(async (ctx, u, req) => { await chat.updateGroup(ctx, u.id, p(req, 'id'), req.body || {}); }));
  router.get('/community/chats/:id/messages', member((ctx, u, req) => chat.messages(ctx, u.id, p(req, 'id'), { before: req.query.before, since: req.query.since })));
  router.post('/community/chats/:id/messages', member((ctx, u, req) => chat.send(ctx, u.id, p(req, 'id'), req.body || {})));
  router.post('/community/chats/:id/read', member(async (ctx, u, req) => { await chat.markRead(ctx, u.id, p(req, 'id')); }));
  router.post('/community/chats/:id/typing', member(async (ctx, u, req) => { await chat.typing(ctx, u.id, p(req, 'id')); }));
  router.patch('/community/messages/:id', member(async (ctx, u, req) => { await chat.editMessage(ctx, u.id, p(req, 'id'), req.body?.text); }));
  router.delete('/community/messages/:id', member(async (ctx, u, req) => { await chat.deleteMessage(ctx, u.id, p(req, 'id')); }));
  router.post('/community/messages/:id/react', member(async (ctx, u, req) => { await chat.reactMessage(ctx, u.id, p(req, 'id'), req.body?.emoji ?? null); }));

  /* ------------------------------------- «بريد شام»: outside → in ------------------------------------- */
  /* The mail provider's inbound hook (Resend Inbound, a Cloudflare Email Worker, any JSON/form forwarder)
     posts real e-mails here. Protected by SHAM_MAIL_INBOUND_TOKEN (query ?token= or X-Sham-Mail-Token). */
  router.post('/community/mail/inbound', express.urlencoded({ extended: true, limit: '1mb' }), open(async (ctx, req, res) => {
    const expected = env.SHAM_MAIL_INBOUND_TOKEN?.trim() || '';
    if (expected.length < 12) { res.status(503).json({ error: 'Inbound mail is not configured. Set SHAM_MAIL_INBOUND_TOKEN on the server.', code: 'INBOUND_NOT_CONFIGURED' }); return; }
    const given = Buffer.from(String(req.query.token || req.headers['x-sham-mail-token'] || ''));
    if (given.length !== expected.length || !timingSafeEqual(given, Buffer.from(expected))) {
      res.status(401).json({ error: 'Invalid inbound token', code: 'UNAUTHORIZED' });
      return;
    }
    return mail.inbound(ctx, mail.normalizeInbound(req.body || {}));
  }));

  /* ------------------------------------------------ «بريد شام» ------------------------------------------------ */
  router.get('/community/mail/counts', member((ctx, u) => mail.counts(ctx, u.id)));
  router.get('/community/mail', member((ctx, u, req) => mail.list(ctx, u.id, { folder: req.query.folder, before: req.query.before, q: req.query.q })));
  router.post('/community/mail', member((ctx, u, req) => mail.send(ctx, u.id, req.body || {})));
  router.post('/community/mail/drafts', member((ctx, u, req) => mail.saveDraft(ctx, u.id, req.body || {})));
  router.patch('/community/mail/drafts/:id', member((ctx, u, req) => mail.saveDraft(ctx, u.id, req.body || {}, p(req, 'id'))));
  router.post('/community/mail/drafts/:id/send', member((ctx, u, req) => mail.sendDraft(ctx, u.id, p(req, 'id'), req.body || {})));
  router.post('/community/mail/trash/empty', member((ctx, u) => mail.emptyTrash(ctx, u.id)));
  router.post('/community/mail/read-all', member((ctx, u) => mail.markAllRead(ctx, u.id)));
  router.get('/community/mail/:id', member((ctx, u, req) => mail.view(ctx, u.id, p(req, 'id'))));
  router.patch('/community/mail/:id', member((ctx, u, req) => mail.update(ctx, u.id, p(req, 'id'), req.body || {})));
  router.delete('/community/mail/:id', member((ctx, u, req) => mail.remove(ctx, u.id, p(req, 'id'))));

  /* ---------------------------------------------- administration ---------------------------------------------- */
  const A = '/admin/community';
  router.get(`${A}/overview`, boss(async (ctx) => ({ ...(await admin.overview(ctx)), store: ctx.sql.kind })));
  router.get(`${A}/users`, boss((ctx, req) => admin.users(ctx, req.query)));
  router.get(`${A}/users/:id`, boss((ctx, req) => admin.userFile(ctx, p(req, 'id'))));
  router.post(`${A}/users/:id/status`, boss(async (ctx, req) => { await admin.setUserStatus(ctx, p(req, 'id'), req.body?.status, String(req.body?.note || '')); }));
  router.post(`${A}/users/:id/signout`, boss(async (ctx, req) => { await admin.signOutEverywhere(ctx, p(req, 'id')); }));
  router.delete(`${A}/users/:id`, boss(async (ctx, req) => { await admin.deleteUser(ctx, p(req, 'id'), String(req.body?.note || '')); }));
  router.get(`${A}/merchants`, boss((ctx, req) => admin.merchants(ctx, req.query.status)));
  router.post(`${A}/merchants/:id/review`, boss(async (ctx, req) => { await admin.reviewMerchant(ctx, p(req, 'id'), req.body || {}); }));
  router.get(`${A}/products`, boss((ctx, req) => admin.products(ctx, req.query.status)));
  router.post(`${A}/products/:id/review`, boss(async (ctx, req) => { await admin.reviewProduct(ctx, p(req, 'id'), req.body || {}); }));
  router.get(`${A}/orders`, boss((ctx, req) => admin.orders(ctx, req.query.status)));
  router.post(`${A}/orders/:id/status`, boss(async (ctx, req) => { await admin.setOrderStatus(ctx, p(req, 'id'), req.body?.status, String(req.body?.note || '')); }));
  router.get(`${A}/posts`, boss((ctx, req) => admin.posts(ctx, req.query)));
  router.post(`${A}/posts/:id/moderate`, boss(async (ctx, req) => { await admin.moderate(ctx, 'post', p(req, 'id'), req.body?.status, String(req.body?.note || '')); }));
  router.post(`${A}/comments/:id/moderate`, boss(async (ctx, req) => { await admin.moderate(ctx, 'comment', p(req, 'id'), req.body?.status, String(req.body?.note || '')); }));
  router.post(`${A}/content/:kind/:id/moderate`, boss(async (ctx, req) => {
    const kind = p(req, 'kind');
    if (!admin.isModeratedKind(kind)) throw new svc.CommunityError(400, 'INVALID_FIELD', 'kind');
    await admin.moderate(ctx, kind, p(req, 'id'), req.body?.status, String(req.body?.note || ''));
  }));
  router.get(`${A}/reports`, boss((ctx, req) => admin.reports(ctx, req.query.status)));
  router.post(`${A}/reports/:id`, boss(async (ctx, req) => { await admin.resolveReport(ctx, p(req, 'id'), req.body || {}); }));
  router.post(`${A}/conversations/:id/read`, boss((ctx, req) => admin.readConversation(ctx, p(req, 'id'), req.body?.reason)));
  router.post(`${A}/mail/:userId`, boss((ctx, req) => mail.adminMail(ctx, p(req, 'userId'), req.body || {})));
  router.get(`${A}/audit`, boss((ctx) => admin.auditLog(ctx)));

  return router;
}
