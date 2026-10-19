/**
 * «مسؤول التعاقدات» HTTP routes (mounted at /api). Uses the community's database and server key.
 *
 * Store side (the token from the letter is the only key):
 *   GET  /api/contracts/s/:token            the signing page (HTML, not indexed)
 *   GET  /api/contracts/sign/:token         the agreement text + status
 *   POST /api/contracts/sign/:token/code    a 6-digit code to the store's official e-mail
 *   POST /api/contracts/sign/:token         sign {name, title, agree, sha256, code}
 *   POST /api/contracts/sign/:token/decline
 * Team side (Bearer SHAM_ADMIN_TOKEN): /api/admin/contracts/* — settings, stores, letters, approval (C-10),
 * the signature certificate, the approved-stores list the importer reads, and reply drafting.
 */
import express from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Community } from '../community/router';
import { RateLimiter, clientKey } from '../core/rateLimit';
import * as c from './service';
import { draftReply } from './assistant';
import { signingPage } from './page';
import { LEGAL_DECISION_ID, POLICY_VERSION, missingSender } from './policy';

type Env = Record<string, string | undefined>;
type Handler = (req: express.Request, res: express.Response) => Promise<void>;

const bearer = (req: express.Request) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
const emailProvider = (env: Env) => (env.RESEND_API_KEY?.trim() ? 'resend' : env.SENDGRID_API_KEY?.trim() ? 'sendgrid' : env.SHAM_WEBHOOK_URL?.trim() ? 'webhook' : '');

function sendError(res: express.Response, error: unknown) {
  if (res.headersSent) return;
  if (error instanceof c.ContractError) { res.status(error.status).json({ error: error.message, code: error.code }); return; }
  console.error('[contracts]', error);
  res.status(500).json({ error: 'Something went wrong, please try again', code: 'FAILED' });
}

export function createContractsRouter(community: Community, options: { env?: Env; fetch?: typeof fetch } = {}) {
  const env = options.env || process.env;
  const router = express.Router();
  const limiter = new RateLimiter(60, 60_000);
  const migrated = new WeakMap<object, Promise<void>>();

  const context = async (): Promise<c.ContractsCtx | undefined> => {
    const ctx = await community.ready();
    if (!ctx) return undefined;
    if (!migrated.has(ctx.sql)) migrated.set(ctx.sql, c.migrateContracts(ctx.sql).catch((e) => { migrated.delete(ctx.sql); throw e; }));
    await migrated.get(ctx.sql);
    return { sql: ctx.sql, vault: ctx.vault, env, fetch: options.fetch };
  };
  const notReady = (res: express.Response) => res.status(503).json({ error: 'The database is not configured on this server yet', code: 'CONTRACTS_NOT_CONFIGURED' });
  const base = (req: express.Request) => (env.SHAM_PUBLIC_API_URL?.trim() || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  const p = (req: express.Request, name: string) => String(req.params[name] || '');
  const ip = (req: express.Request) => (String(req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket.remoteAddress || '').trim().replace(/^::ffff:/, '').slice(0, 64);
  const body = (req: express.Request) => (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, any>;

  /** Store route: rate-limited, never cached, never indexed, no referrer. */
  const store = (handler: (ctx: c.ContractsCtx, req: express.Request, res: express.Response) => Promise<unknown>): Handler => async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex, nofollow'); res.setHeader('Referrer-Policy', 'no-referrer');
    if (!limiter.allow(`sign:${clientKey(req)}`)) { res.status(429).json({ error: 'Too many requests, please wait a minute', code: 'RATE_LIMITED' }); return; }
    try {
      const ctx = await context();
      if (!ctx) { notReady(res); return; }
      const out = await handler(ctx, req, res);
      if (!res.headersSent) res.json(out ?? { ok: true });
    } catch (error) { sendError(res, error); }
  };

  const adminToken = env.SHAM_ADMIN_TOKEN?.trim() || '';
  const authorised = (req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'no-store');
    if (adminToken.length < 12) { res.status(503).json({ error: 'Admin is disabled. Set SHAM_ADMIN_TOKEN on the server.', code: 'ADMIN_NOT_CONFIGURED' }); return false; }
    const given = Buffer.from(bearer(req)); const expected = Buffer.from(adminToken);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) { res.status(401).json({ error: 'Invalid admin token', code: 'UNAUTHORIZED' }); return false; }
    return true;
  };
  const boss = (handler: (ctx: c.ContractsCtx, req: express.Request, res: express.Response) => Promise<unknown>): Handler => async (req, res) => {
    if (!authorised(req, res)) return;
    try {
      const ctx = await context();
      if (!ctx) { notReady(res); return; }
      const out = await handler(ctx, req, res);
      if (!res.headersSent) res.json(out ?? { ok: true });
    } catch (error) { sendError(res, error); }
  };

  /* ------------------------------------ store side ------------------------------------ */
  router.get('/contracts/s/:token', (_req, res) => {
    const nonce = randomBytes(16).toString('base64');
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex, nofollow'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`);
    res.type('html').send(signingPage(nonce));
  });
  router.get('/contracts/sign/:token', store((ctx, req) => c.publicView(ctx, p(req, 'token'))));
  router.post('/contracts/sign/:token/code', store((ctx, req) => c.sendCode(ctx, p(req, 'token'))));
  router.post('/contracts/sign/:token/decline', store(async (ctx, req) => { await c.decline(ctx, p(req, 'token'), String(body(req).reason || '')); return { ok: true }; }));
  router.post('/contracts/sign/:token', store((ctx, req) => {
    const b = body(req);
    return c.sign(ctx, p(req, 'token'), { name: String(b.name || ''), title: String(b.title || ''), agree: b.agree === true, sha256: String(b.sha256 || ''), code: String(b.code || ''), ip: ip(req), agent: String(req.headers['user-agent'] || '') });
  }));

  /* ------------------------------------ team side ------------------------------------ */
  router.get('/admin/contracts/status', async (req, res) => {
    if (!authorised(req, res)) return;
    try {
      const ctx = await context().catch(() => undefined);
      const sender = ctx ? await c.getSender(ctx) : undefined;
      res.json({
        ready: Boolean(ctx), decision: LEGAL_DECISION_ID, policyVersion: POLICY_VERSION, emailProvider: emailProvider(env),
        senderMissing: sender ? missingSender(sender) : [], counts: ctx ? await c.counts(ctx) : {},
      });
    } catch (error) { sendError(res, error); }
  });
  router.get('/admin/contracts/settings', boss((ctx) => c.getSender(ctx).then((sender) => ({ sender, missing: missingSender(sender) }))));
  router.put('/admin/contracts/settings', boss((ctx, req) => c.setSender(ctx, body(req).sender || body(req)).then((sender) => ({ sender, missing: missingSender(sender) }))));
  router.get('/admin/contracts/approved', boss(async (ctx) => ({ stores: await c.approvedStores(ctx) })));
  router.post('/admin/contracts/reply', boss(async (ctx, req) => {
    const b = body(req);
    const sender = await c.getSender(ctx);
    const missing = missingSender(sender);
    if (missing.length) throw new c.ContractError(400, 'SENDER_MISSING', `Fill the sender settings first: ${missing.join(', ')}`);
    const contract = b.id ? await c.getContract(ctx, String(b.id), base(req)) : undefined;
    if (!String(b.message || '').trim()) throw new c.ContractError(400, 'MESSAGE_REQUIRED', 'Paste the store\'s message');
    return draftReply({ message: String(b.message), sender, contactName: contract?.contactName, lang: contract?.lang }, { env, fetch: options.fetch });
  }));
  router.get('/admin/contracts', boss(async (ctx, req) => ({ contracts: await c.listContracts(ctx, base(req)) })));
  router.post('/admin/contracts', boss((ctx, req) => {
    const b = body(req);
    return c.createContract(ctx, { storeName: String(b.storeName || ''), domain: String(b.domain || ''), contactEmail: String(b.contactEmail || ''), contactName: String(b.contactName || ''), lang: b.lang === 'en' ? 'en' : 'ar' }, base(req));
  }));
  router.get('/admin/contracts/:id/letters', boss((ctx, req) => c.lettersOf(ctx, p(req, 'id'), base(req))));
  router.get('/admin/contracts/:id/certificate', boss((ctx, req) => c.certificate(ctx, p(req, 'id'), base(req))));
  const actions: Record<string, (ctx: c.ContractsCtx, id: string, note: string) => Promise<unknown>> = {
    sent: (ctx, id) => c.markSent(ctx, id),
    reminded: (ctx, id) => c.markReminded(ctx, id),
    'opt-out': (ctx, id, note) => c.markOptedOut(ctx, id, note),
    'confirm-reply': (ctx, id, note) => c.confirmEmailReply(ctx, id, note),
    approve: (ctx, id, note) => c.approve(ctx, id, note),
    revoke: (ctx, id, note) => c.revoke(ctx, id, note),
  };
  router.post('/admin/contracts/:id/:action', boss(async (ctx, req) => {
    const run = actions[p(req, 'action')];
    if (!run) throw new c.ContractError(404, 'NOT_FOUND', 'Unknown action');
    await run(ctx, p(req, 'id'), String(body(req).note || ''));
    return { contract: await c.getContract(ctx, p(req, 'id'), base(req)) };
  }));

  return router;
}
