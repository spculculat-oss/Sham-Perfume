/**
 * «مجتمع شام» — accounts, the merchants' portal, the users' portal (recipes, learning, orders).
 * Social (posts, friends, notifications) lives in social.ts, the messenger in messenger.ts, the
 * administration in admin.ts. Every module receives the same context: the database and the vault.
 */
import { BUNDLED_FX, convert, isCountry, tidy, type FxTable } from '../../src/utils/pricing';
import type { Row, Sql } from './db';
import { hashPassword, newId, newToken, tokenHash, verifyPassword, type Vault } from './crypto';
import { checkCode, issueCode, type CodePurpose } from './codes';
import { isCommonPassword } from './passwords';
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';
import { codeMail, sendAuthEmail } from './notify';
import { newTotpSecret, otpauthUri, verifyTotp } from './totp';
import { metaWhatsAppReady, sendMetaWhatsAppCode } from './whatsapp';
import { cborDecode, coseToPublicKey, newChallenge, rpIdOf, verifyAssert, verifyCreate } from './webauthn';

export interface Ctx { sql: Sql; vault: Vault; fx?: () => Promise<FxTable>; now?: () => Date; env?: Record<string, string | undefined> }

/* ---------------------------------- security constants ----------------------------------
 * The numbers follow the study in SHAM_AUTH.md (Google / Apple / Meta, 2026-10-18).
 * - MAX_FAILED_LOGINS: per-account lockout after repeated wrong passwords (5 → 15 minutes).
 *   The router's per-IP limiter stays in front of it for spraying across accounts.
 * - PENDING_LOGIN_MS: how long a two-factor login may wait for the authenticator code.
 */
const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60_000;
const PENDING_LOGIN_MS = 5 * 60_000;
/** A real-looking scrypt hash so an unknown e-mail burns the same time as a wrong password. */
const DUMMY_HASH = 'scrypt$32768$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

/** Security events in the audit log (the administration's trail, actor = the member's id). */
const auditEvent = (ctx: Ctx, actor: string, action: string, target = '', detail = '') =>
  ctx.sql.query(`INSERT INTO audit (actor, action, target, detail) VALUES ($1,$2,$3,$4)`, [actor, action, target, clean(detail, 500)]).catch(() => {});

/** The environment for e-mail providers (tests pass an empty one, so no real e-mail can leak out). */
const envOf = (ctx: Ctx) => ctx.env ?? process.env;

/** Public capability only; never expose the Meta token, sender ID, template or Graph version. */
export function authPublicConfig(env: Record<string, string | undefined> = process.env) {
  return { whatsappOtp: metaWhatsAppReady(env) };
}

export class CommunityError extends Error {
  constructor(public status: number, public code: string, message = code) { super(message); }
}
export const fail = (status: number, code: string, message?: string): never => { throw new CommunityError(status, code, message); };

/* ------------------------------------------ validation ------------------------------------------ */

export const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]+/g, ' ').trim().slice(0, max) : '');
export function required(value: unknown, field: string, min: number, max: number): string {
  const text = clean(value, max);
  if (text.length < min) fail(400, 'INVALID_FIELD', field);
  return text;
}
export const isEmail = (v: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(v);
const IMAGE = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const AUDIO = /^data:audio\/(webm|ogg|mp4|mpeg|aac|wav)(;codecs=[\w.]+)?;base64,[A-Za-z0-9+/=]+$/;
const HTTPS_IMAGE = /^https:\/\/[^\s"'<>]{8,600}$/;
/** A picture sent by the browser (already resized there): a base64 data URL up to `maxKb`. */
export function image(value: unknown, maxKb = 450, allowUrl = false): string | null {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value);
  if (allowUrl && HTTPS_IMAGE.test(text)) return text;
  if (!IMAGE.test(text) || text.length > maxKb * 1370) fail(400, 'INVALID_IMAGE');
  return text;
}
export function audio(value: unknown, maxKb = 1200): string {
  const text = String(value || '');
  if (!AUDIO.test(text) || text.length > maxKb * 1370) fail(400, 'INVALID_AUDIO');
  return text;
}
const CRAFT = ['hobbyist', 'perfumer', 'master_lab'];
const LANG = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;

/* ------------------------------------------- shapes ------------------------------------------- */

export interface PublicUser {
  id: string; handle: string; name: string; avatar: string | null; bio: string; country: string;
  craftLevel: string; role: string; merchant?: { slug: string; storeName: string } | null; online: boolean; lastSeen: string;
}
const ONLINE_MS = 2 * 60_000;
export function publicUser(row: Row): PublicUser {
  const lastSeen = new Date(row.last_seen || row.created_at || Date.now());
  return {
    id: row.id, handle: row.handle, name: row.name, avatar: row.avatar || null, bio: row.bio || '', country: row.country || '',
    craftLevel: row.craft_level || 'hobbyist', role: row.role,
    merchant: row.m_slug && row.m_status === 'approved' ? { slug: row.m_slug, storeName: row.m_store } : null,
    online: Date.now() - lastSeen.getTime() < ONLINE_MS, lastSeen: lastSeen.toISOString(),
  };
}
/** SELECT list for a user + their approved store (alias u, merchants m). */
export const USER_COLUMNS = `u.id, u.handle, u.name, u.avatar, u.bio, u.country, u.craft_level, u.role, u.last_seen, u.created_at,
  m.slug AS m_slug, m.status AS m_status, m.store_name AS m_store`;
export const USER_FROM = `users u LEFT JOIN merchants m ON m.user_id = u.id`;

export interface SessionUser { id: string; handle: string; name: string; role: string; status: string; lang: string }

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

/* ------------------------------------------- accounts ------------------------------------------- */

const SESSION_DAYS = 30;

async function uniqueHandle(sql: Sql, wanted: string): Promise<string> {
  const base = (wanted.normalize('NFKD').toLowerCase().replace(/[^a-z0-9_]+/g, '').slice(0, 20)) || 'sham';
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 && base.length >= 3 ? base : `${base}${Math.floor(1000 + Math.random() * 90000)}`;
    const [taken] = await sql.query(`SELECT 1 FROM users WHERE handle = $1`, [candidate]);
    if (!taken) return candidate;
  }
  return `sham${Date.now().toString(36)}`;
}

async function startSession(ctx: Ctx, userId: string, agent: string, ip = '') {
  const [count] = await ctx.sql.query(`SELECT count(*)::int AS n FROM sessions WHERE user_id = $1`, [userId]);
  const { token, hash } = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await ctx.sql.query(`INSERT INTO sessions (hash, user_id, agent, ip, expires_at) VALUES ($1, $2, $3, $4, $5)`, [hash, userId, clean(agent, 200), clean(ip, 64), expires.toISOString()]);
  // A sign-in alert on a *new* device (Google/Meta «login alerts»): an in-app notification is the
  // primary channel; when the server has an e-mail provider, the member also gets an e-mail.
  if (count.n > 0) {
    const detail = `${clean(agent, 120) || 'جهاز جديد'}${ip ? ' · ' + clean(ip, 40) : ''}`;
    await ctx.sql.query(`INSERT INTO notifications (id, user_id, kind, actor_id, ref) VALUES ($1,$2,'security',NULL,$3)`, [newId('n'), userId, detail]).catch(() => {});
    try {
      const [u] = await ctx.sql.query(`SELECT email_enc FROM users WHERE id = $1`, [userId]);
      const alert = {
        subject: 'تسجيل دخول جديد — شام للعطور',
        html: `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e7e2d9;border-radius:16px"><p>تم تسجيل دخول لحسابك من جهاز جديد:</p><p style="font-family:monospace;direction:ltr;text-align:center;background:#faf6ee;border-radius:8px;padding:8px">${detail}</p><p>لو أنت مش اللي سجّل الدخول، غيّر كلمة السر فوراً من بوابتك ← الأمان.</p></div>`,
        text: `تم تسجيل دخول لحسابك من جهاز جديد: ${detail}. لو أنت مش اللي سجّل الدخول، غيّر كلمة السر فوراً.`,
      };
      const sent = await sendAuthEmail(ctx.vault.open(u.email_enc), alert, envOf(ctx));
      if (sent.delivered) console.info('[community] sign-in alert e-mail delivered');
    } catch { /* the in-app notification is the primary alert */ }
  }
  return { token, expiresAt: expires.toISOString() };
}

export interface RegisterInput {
  name?: unknown; email?: unknown; password?: unknown; handle?: unknown; country?: unknown; lang?: unknown; craftLevel?: unknown;
  /** Private data kept encrypted: phone, city, address. */
  phone?: unknown; city?: unknown;
  /** Optional: enable two-factor (TOTP) at registration. */
  enable2fa?: unknown;
}

export function passwordPolicy(password: unknown): string {
  const text = typeof password === 'string' ? password : '';
  if (text.length < 8 || text.length > 200 || !/[A-Za-z\u0600-\u06FF]/.test(text) || !/\d/.test(text)) fail(400, 'WEAK_PASSWORD');
  // Google, Apple and Meta all refuse common passwords (top breached list, bundled in passwords.ts).
  if (isCommonPassword(text)) fail(400, 'COMMON_PASSWORD');
  return text;
}

export async function register(ctx: Ctx, input: RegisterInput, agent = '', ip = '') {
  const name = required(input.name, 'name', 2, 60);
  const email = clean(input.email, 254).toLowerCase();
  if (!isEmail(email)) fail(400, 'INVALID_EMAIL');
  const password = passwordPolicy(input.password);
  const country = clean(input.country, 2).toUpperCase();
  const lang = clean(input.lang, 10);
  const craft = CRAFT.includes(String(input.craftLevel)) ? String(input.craftLevel) : 'hobbyist';
  const emailIdx = ctx.vault.index(email);
  const [exists] = await ctx.sql.query(`SELECT 1 FROM users WHERE email_idx = $1`, [emailIdx]);
  if (exists) fail(409, 'EMAIL_EXISTS');
  const id = newId('u');
  const handle = await uniqueHandle(ctx.sql, clean(input.handle, 30) || email.split('@')[0] || name);
  const privateData = { phone: clean(input.phone, 40), city: clean(input.city, 120) };
  await ctx.sql.query(
    `INSERT INTO users (id, handle, name, email_idx, email_enc, pass_hash, country, lang, craft_level, private_enc, totp_enabled, totp_last)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'0')`,
    [id, handle, name, emailIdx, ctx.vault.seal(email), await hashPassword(password), isCountry(country) ? country : '', LANG.test(lang) ? lang : 'ar', craft,
      privateData.phone || privateData.city ? ctx.vault.sealJson(privateData) : null,
      typeof input.enable2fa === 'boolean' && input.enable2fa],
  ).catch((error) => { if (/unique|duplicate/i.test(String(error?.message))) fail(409, 'EMAIL_EXISTS'); throw error; });
  auditEvent(ctx, id, 'register', '', `${name} <${email}>`);
  // Optional two-factor at sign-up: generate and seal a TOTP secret so the member can set up
  // their authenticator app. Returned once — never stored plain.
  let totpSecret: string | undefined;
  if (typeof input.enable2fa === 'boolean' && input.enable2fa) {
    totpSecret = newTotpSecret();
    await ctx.sql.query(`UPDATE users SET totp_secret_enc = $1 WHERE id = $2`, [ctx.vault.seal(totpSecret), id]);
    auditEvent(ctx, id, 'totp_setup_started');
  }
  // E-mail verification (Google/Meta verify the contact at sign-up). Soft: the account works, but
  // the portal shows «verify your e-mail» until the code is entered — and nothing is faked when the
  // server has no e-mail provider configured.
  try {
    const code = await issueCode(ctx, id, 'verify_email');
    const sent = await sendAuthEmail(email, codeMail('أكواد شام للعطور — تأكيد البريد', code, 15,
      'عشان نتأكد إن البريد ده حقيقي في حسابك الجديد، أدخل الكود ده في بوابتك ← الأمان:',
      'To verify your e-mail on your new Sham account, enter this code: My portal → Security.'), envOf(ctx));
    if (!sent.delivered) console.warn('[community] verification e-mail not delivered:', sent.error || sent.provider);
  } catch (error) { console.warn('[community] verification code failed:', error instanceof Error ? error.message : error); }
  return { ...(await startSession(ctx, id, agent, ip)), me: await me(ctx, id), ...(totpSecret ? { totpSecret } : {}) };
}

export interface LoginPending { pending: true; pendingToken: string; expiresIn: number; method?: 'totp' | 'phone'; phoneMethod?: 'sms' | 'whatsapp' }
export interface LoginSuccess { token: string; expiresAt: string; me: Awaited<ReturnType<typeof me>> }
export type LoginOutcome = LoginPending | LoginSuccess;

export async function login(ctx: Ctx, input: { email?: unknown; password?: unknown }, agent = '', ip = ''): Promise<LoginOutcome> {
  const email = clean(input.email, 254).toLowerCase();
  const password = typeof input.password === 'string' ? input.password.slice(0, 200) : '';
  const [row] = isEmail(email) ? await ctx.sql.query(
    `SELECT id, pass_hash, status, failed_logins, locked_until, totp_enabled, phone_2fa_enabled, phone_2fa_method FROM users WHERE email_idx = $1`, [ctx.vault.index(email)]) : [];
  if (row?.locked_until && new Date(row.locked_until).getTime() > Date.now()) fail(423, 'ACCOUNT_LOCKED');
  // Same answer and similar time for an unknown e-mail and a wrong password.
  const ok = await verifyPassword(password, row?.pass_hash || DUMMY_HASH);
  if (!row || !ok) {
    if (row) {
      const attempts = (Number(row.failed_logins) || 0) + 1;
      if (attempts >= MAX_FAILED_LOGINS) {
        await ctx.sql.query(`UPDATE users SET failed_logins = 0, locked_until = $1 WHERE id = $2`, [new Date(Date.now() + LOCK_MS).toISOString(), row.id]);
        auditEvent(ctx, row.id, 'account_locked');
      } else await ctx.sql.query(`UPDATE users SET failed_logins = $1 WHERE id = $2`, [attempts, row.id]);
      auditEvent(ctx, row.id, 'login_fail');
    }
    fail(401, 'INVALID_LOGIN');
  }
  if (row.status === 'suspended') fail(403, 'ACCOUNT_SUSPENDED');
  if (row.status === 'deleted') fail(401, 'INVALID_LOGIN');
  await ctx.sql.query(`UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1`, [row.id]);
  // Two-factor accounts (Google/Meta style): the password opens a short pending login; the
  // authenticator/app or phone code finishes it. Phone 2FA is optional but suggested — like Google prompt.
  if (row.totp_enabled || row.phone_2fa_enabled) {
    const { token, hash } = newToken();
    await ctx.sql.query(`INSERT INTO pending_logins (token_hash, user_id, agent, ip, expires_at) VALUES ($1,$2,$3,$4,$5)`,
      [hash, row.id, clean(agent, 200), clean(ip, 64), new Date(Date.now() + PENDING_LOGIN_MS).toISOString()]);
    // The client explicitly requests the second-factor code after showing the correct channel UI.
    auditEvent(ctx, row.id, 'login_2fa_started');
    return { pending: true, pendingToken: token, expiresIn: Math.round(PENDING_LOGIN_MS / 1000), method: row.phone_2fa_enabled ? 'phone' as const : 'totp' as const,
      ...(row.phone_2fa_enabled ? { phoneMethod: row.phone_2fa_method === 'whatsapp' ? 'whatsapp' as const : 'sms' as const } : {}) };
  }
  auditEvent(ctx, row.id, 'login_ok', '', `${clean(agent, 80)} ${ip}`.trim());
  return { ...(await startSession(ctx, row.id, agent, ip)), me: await me(ctx, row.id) };
}

/** Finish a two-factor login with the authenticator code (single-use pending token). */
export async function loginTwoFactor(ctx: Ctx, input: { pendingToken?: unknown; code?: unknown }): Promise<LoginSuccess> {
  const pendingToken = String(input.pendingToken || '');
  if (pendingToken.length < 32) fail(400, 'INVALID_FIELD', 'pendingToken');
  const [row] = await ctx.sql.query(
    `SELECT pl.user_id, pl.agent, pl.ip, u.totp_secret_enc, u.totp_last, u.status FROM pending_logins pl
     JOIN users u ON u.id = pl.user_id WHERE pl.token_hash = $1 AND pl.expires_at > now()`, [tokenHash(pendingToken)]);
  if (!row) fail(401, 'INVALID_LOGIN');
  if (row.status === 'suspended') fail(403, 'ACCOUNT_SUSPENDED');
  const check = verifyTotp(ctx.vault.open(row.totp_secret_enc), String(input.code || ''), row.totp_last);
  if (!check.ok) { auditEvent(ctx, row.user_id, 'login_2fa_fail'); fail(401, 'INVALID_LOGIN'); }
  await ctx.sql.query(`DELETE FROM pending_logins WHERE token_hash = $1`, [tokenHash(pendingToken)]);
  await ctx.sql.query(`UPDATE users SET totp_last = $1 WHERE id = $2`, [check.counter.toString(36), row.user_id]);
  auditEvent(ctx, row.user_id, 'login_ok', '', 'two-factor');
  return { ...(await startSession(ctx, row.user_id, row.agent, row.ip)), me: await me(ctx, row.user_id) };
}

/** The signed-in user for a bearer token, or undefined. Refreshes «last seen» at most once a minute. */
export async function authenticate(ctx: Ctx, token: string): Promise<SessionUser | undefined> {
  if (!token || token.length < 20 || token.length > 100) return undefined;
  const hash = tokenHash(token);
  const [row] = await ctx.sql.query(
    `SELECT u.id, u.handle, u.name, u.role, u.status, u.lang, u.last_seen, s.last_used_at AS s_used
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.hash = $1 AND s.expires_at > now()`, [hash]);
  if (!row || row.status !== 'active') return undefined;
  if (Date.now() - new Date(row.last_seen).getTime() > 60_000) await ctx.sql.query(`UPDATE users SET last_seen = now() WHERE id = $1`, [row.id]);
  if (Date.now() - new Date(row.s_used).getTime() > 60_000) await ctx.sql.query(`UPDATE sessions SET last_used_at = now() WHERE hash = $1`, [hash]);
  return { id: row.id, handle: row.handle, name: row.name, role: row.role, status: row.status, lang: row.lang };
}

export async function logout(ctx: Ctx, token: string, everywhere = false) {
  if (everywhere) {
    const [row] = await ctx.sql.query(`SELECT user_id FROM sessions WHERE hash = $1`, [tokenHash(token)]);
    if (row) await ctx.sql.query(`DELETE FROM sessions WHERE user_id = $1`, [row.user_id]);
  } else await ctx.sql.query(`DELETE FROM sessions WHERE hash = $1`, [tokenHash(token)]);
}

/** Everything the signed-in user may see about themself (their own private data decrypted). */
export async function me(ctx: Ctx, userId: string) {
  // Abandoned verification destinations are retained only until their one-time code expires.
  await ctx.sql.query(`UPDATE users SET phone_2fa_pending_phone_enc = NULL, phone_2fa_pending_method = '', phone_2fa_pending_expires_at = NULL
    WHERE id = $1 AND phone_2fa_pending_phone_enc IS NOT NULL AND (phone_2fa_pending_expires_at IS NULL OR phone_2fa_pending_expires_at <= now())`, [userId]);
  const [u] = await ctx.sql.query(`SELECT * FROM users WHERE id = $1`, [userId]);
  if (!u) fail(404, 'NOT_FOUND');
  const [m] = await ctx.sql.query(`SELECT slug, store_name, status, admin_note FROM merchants WHERE user_id = $1`, [userId]);
  const [counts] = await ctx.sql.query(
    `SELECT (SELECT count(*) FROM recipes WHERE user_id = $1)::int AS recipes,
            (SELECT count(*) FROM friendships WHERE (user_a = $1 OR user_b = $1) AND status = 'accepted')::int AS friends,
            (SELECT count(*) FROM orders WHERE buyer_id = $1)::int AS orders,
            (SELECT count(*) FROM posts WHERE author_id = $1 AND status = 'visible')::int AS posts`, [userId]);
  return {
    id: u.id, handle: u.handle, name: u.name, email: ctx.vault.open(u.email_enc), role: u.role, status: u.status,
    country: u.country, lang: u.lang, craftLevel: u.craft_level, bio: u.bio, avatar: u.avatar || null,
    private: ctx.vault.openJson(u.private_enc, { phone: '', city: '' }), createdAt: iso(u.created_at),
    emailVerified: iso(u.email_verified_at), totp: Boolean(u.totp_enabled), phone2fa: { enabled: Boolean((u as any).phone_2fa_enabled), method: (u as any).phone_2fa_method || '' },
    merchant: m ? { slug: m.slug, storeName: m.store_name, status: m.status, note: m.status === 'approved' ? '' : m.admin_note } : null,
    counts: counts || { recipes: 0, friends: 0, orders: 0, posts: 0 },
  };
}

/* ------------------------------------- security: e-mail & codes ------------------------------------- */

/** Enter the 6-digit code from the verification e-mail (sets `emailVerified`). */
export async function verifyEmail(ctx: Ctx, userId: string, code: unknown) {
  if (!(await checkCode(ctx, userId, 'verify_email', String(code || '')))) fail(400, 'CODE_INVALID');
  await ctx.sql.query(`UPDATE users SET email_verified_at = now() WHERE id = $1 AND email_verified_at IS NULL`, [userId]);
  auditEvent(ctx, userId, 'email_verified');
  return me(ctx, userId);
}

/** Resend the verification code (rate-limited; honest error when no e-mail provider is set). */
export async function resendVerification(ctx: Ctx, userId: string) {
  const [u] = await ctx.sql.query(`SELECT email_enc FROM users WHERE id = $1`, [userId]);
  if (!u) fail(404, 'NOT_FOUND');
  const code = await issueCode(ctx, userId, 'verify_email'); // CODE_LIMITED when the window is exhausted
  const sent = await sendAuthEmail(ctx.vault.open(u.email_enc), codeMail('أكواد شام للعطور — تأكيد البريد', code, 15,
    'طلبك إعادة إرسال كود تأكيد البريد. أدخله في بوابتك ← الأمان:', 'You asked to re-send your e-mail verification code.'), envOf(ctx));
  if (!sent.delivered) fail(503, 'EMAIL_UNAVAILABLE');
  return { ok: true };
}

/**
 * Forgot-password, step 1 (Google/Meta «send me a code»). Answers identically whether the e-mail
 * exists or not — an unknown address still burns a full scrypt round, so the two paths take the
 * same time. When no e-mail provider is configured the server answers honestly (503) for every
 * e-mail, so existence is not revealed through different status codes.
 */
export async function requestPasswordReset(ctx: Ctx, input: { email?: unknown }) {
  const env = envOf(ctx);
  const hasProvider = Boolean(env.RESEND_API_KEY?.trim() || env.SENDGRID_API_KEY?.trim() || (env as any).SHAM_WEBHOOK_URL?.trim() || env.GMAIL_APP_PASSWORD?.trim());
  const allowMock = env.SHAM_ALLOW_MOCK_EMAIL === '1';
  if (!hasProvider && !allowMock) fail(503, 'EMAIL_UNAVAILABLE');
  const email = clean(input.email, 254).toLowerCase();
  const [row] = isEmail(email) ? await ctx.sql.query(`SELECT id FROM users WHERE email_idx = $1 AND status = 'active'`, [ctx.vault.index(email)]) : [];
  await verifyPassword('timing-equalizer-1', DUMMY_HASH); // equalises both answers
  if (row) {
    try {
      const code = await issueCode(ctx, row.id, 'reset_password');
      if (!hasProvider && allowMock) {
        console.info(`[mock-email] reset code for ${email}: ${code}`);
        auditEvent(ctx, row.id, 'reset_requested_mock');
        return { ok: true, mockCode: code };
      }
      const sent = await sendAuthEmail(email, codeMail('أكواد شام للعطور — تغيير كلمة المرور', code, 10,
        'طلبك تغيير كلمة المرور. أدخل الكود ده والكلمة الجديدة في صفحة تسجيل الدخول:',
        'You asked to change your password. Enter this code and your new password on the sign-in page.'), env);
      if (!sent.delivered) fail(503, 'EMAIL_UNAVAILABLE');
      auditEvent(ctx, row.id, 'reset_requested');
    } catch (error) {
      if (error instanceof CommunityError && (error.code === 'CODE_LIMITED' || error.code === 'EMAIL_UNAVAILABLE')) throw error;
      console.warn('[community] reset e-mail failed:', error instanceof Error ? error.message : error);
      fail(503, 'EMAIL_UNAVAILABLE');
    }
  }
  return { ok: true };
}

/** Forgot-password, step 2: the code plus the new password. Signs every session out. */
export async function confirmPasswordReset(ctx: Ctx, input: { email?: unknown; code?: unknown; next?: unknown }) {
  const email = clean(input.email, 254).toLowerCase();
  const next = passwordPolicy(input.next);
  const [row] = isEmail(email) ? await ctx.sql.query(`SELECT id FROM users WHERE email_idx = $1 AND status = 'active'`, [ctx.vault.index(email)]) : [];
  if (!row || !(await checkCode(ctx, row.id, 'reset_password', String(input.code || '')))) fail(400, 'CODE_INVALID');
  await ctx.sql.query(`UPDATE users SET pass_hash = $1 WHERE id = $2`, [await hashPassword(next), row.id]);
  await ctx.sql.query(`DELETE FROM sessions WHERE user_id = $1`, [row.id]);
  await ctx.sql.query(`DELETE FROM pending_logins WHERE user_id = $1`, [row.id]);
  auditEvent(ctx, row.id, 'password_reset');
  return { ok: true };
}

export async function updateProfile(ctx: Ctx, userId: string, input: Record<string, unknown>) {
  const sets: string[] = []; const params: unknown[] = [];
  const set = (column: string, value: unknown) => { params.push(value); sets.push(`${column} = $${params.length}`); };
  if (input.name !== undefined) set('name', required(input.name, 'name', 2, 60));
  if (input.bio !== undefined) set('bio', clean(input.bio, 500));
  if (input.avatar !== undefined) set('avatar', image(input.avatar, 250));
  if (input.country !== undefined) { const c = clean(input.country, 2).toUpperCase(); set('country', isCountry(c) ? c : ''); }
  if (input.lang !== undefined && LANG.test(clean(input.lang, 10))) set('lang', clean(input.lang, 10));
  if (input.craftLevel !== undefined && CRAFT.includes(String(input.craftLevel))) set('craft_level', String(input.craftLevel));
  if (input.handle !== undefined) {
    const handle = clean(input.handle, 30).toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(handle)) fail(400, 'INVALID_HANDLE');
    const [taken] = await ctx.sql.query(`SELECT 1 FROM users WHERE handle = $1 AND id <> $2`, [handle, userId]);
    if (taken) fail(409, 'HANDLE_TAKEN');
    set('handle', handle);
  }
  if (input.private !== undefined) {
    const p = (input.private || {}) as Record<string, unknown>;
    set('private_enc', ctx.vault.sealJson({ phone: clean(p.phone, 40), city: clean(p.city, 120), address: clean(p.address, 300) }));
  }
  if (sets.length) { params.push(userId); await ctx.sql.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}`, params); }
  return me(ctx, userId);
}

export async function changePassword(ctx: Ctx, userId: string, input: { current?: unknown; next?: unknown }, currentToken = '') {
  const [u] = await ctx.sql.query(`SELECT pass_hash FROM users WHERE id = $1`, [userId]);
  if (!u || !(await verifyPassword(String(input.current || ''), u.pass_hash))) fail(401, 'WRONG_PASSWORD');
  await ctx.sql.query(`UPDATE users SET pass_hash = $1 WHERE id = $2`, [await hashPassword(passwordPolicy(input.next)), userId]);
  // A password change invalidates every other device (the old hash could not have produced the new
  // sessions' trust). The device the change came from stays signed in. Pending 2FA logins are also
  // revoked — the old password must not remain usable in a half-open login.
  const currentHash = currentToken ? tokenHash(currentToken) : '';
  await ctx.sql.query(`DELETE FROM sessions WHERE user_id = $1 AND ($2 = '' OR hash <> $2)`, [userId, currentHash]);
  await ctx.sql.query(`DELETE FROM pending_logins WHERE user_id = $1`, [userId]);
  auditEvent(ctx, userId, 'password_changed');
}

/** «احذف حسابي»: personal data is erased; posts and messages are removed with the account. */
export async function deleteAccount(ctx: Ctx, userId: string, password: unknown) {
  const [u] = await ctx.sql.query(`SELECT pass_hash FROM users WHERE id = $1`, [userId]);
  if (!u || !(await verifyPassword(String(password || ''), u.pass_hash))) fail(401, 'WRONG_PASSWORD');
  auditEvent(ctx, userId, 'account_deleted');
  await ctx.sql.query(`DELETE FROM users WHERE id = $1`, [userId]);
}

/* ------------------------------------- security: devices & 2FA ------------------------------------- */

/** The signed-in member's active sessions («Your devices» / «Where you're signed in»). */
export async function mySessions(ctx: Ctx, userId: string, currentToken = '') {
  const currentHash = tokenHash(currentToken);
  const rows = await ctx.sql.query(
    `SELECT hash, agent, ip, created_at, last_used_at FROM sessions WHERE user_id = $1 AND expires_at > now() ORDER BY created_at DESC LIMIT 20`, [userId]);
  return rows.map((r) => ({
    id: r.hash, agent: r.agent, ip: r.ip || '', createdAt: iso(r.created_at), lastUsedAt: iso(r.last_used_at), current: r.hash === currentHash,
  }));
}

/** Revoke one session by its id (the current one is refused — sign out instead). */
export async function revokeSession(ctx: Ctx, userId: string, sessionId: string, currentToken = '') {
  if (!sessionId || tokenHash(currentToken) === sessionId) fail(400, 'INVALID_FIELD', 'session');
  const removed = await ctx.sql.query(`DELETE FROM sessions WHERE hash = $1 AND user_id = $2 RETURNING hash`, [sessionId, userId]);
  if (!removed.length) fail(404, 'NOT_FOUND');
  auditEvent(ctx, userId, 'session_revoked', '', sessionId.slice(0, 10));
  return { ok: true };
}

/** Start two-factor: proves the password, returns the secret the authenticator app encodes. */
export async function totpSetup(ctx: Ctx, userId: string, password: unknown) {
  const [u] = await ctx.sql.query(`SELECT pass_hash, totp_enabled, handle FROM users WHERE id = $1`, [userId]);
  if (!u || !(await verifyPassword(String(password || ''), u.pass_hash))) fail(401, 'WRONG_PASSWORD');
  if (u.totp_enabled) fail(409, 'ALREADY_ENABLED');
  const secret = newTotpSecret();
  await ctx.sql.query(`UPDATE users SET totp_secret_enc = $1 WHERE id = $2`, [ctx.vault.seal(secret), userId]);
  auditEvent(ctx, userId, 'totp_setup_started');
  return { secret, uri: otpauthUri(u.handle, secret) };
}

/** Finish two-factor with a code from the app (wrong codes simply do not enable it). */
export async function totpConfirm(ctx: Ctx, userId: string, code: unknown) {
  const [u] = await ctx.sql.query(`SELECT totp_secret_enc, totp_last FROM users WHERE id = $1 AND totp_secret_enc IS NOT NULL AND totp_enabled = false`, [userId]);
  if (!u) fail(400, 'INVALID_FIELD', 'code');
  const check = verifyTotp(ctx.vault.open(u.totp_secret_enc), String(code || ''), u.totp_last);
  if (!check.ok) fail(400, 'CODE_INVALID');
  await ctx.sql.query(`UPDATE users SET totp_enabled = true, totp_last = $1 WHERE id = $2`, [check.counter.toString(36), userId]);
  auditEvent(ctx, userId, 'totp_enabled');
  return { ok: true };
}

/** Turn two-factor off: password plus a fresh code (an attacker with the password alone cannot). */
export async function totpDisable(ctx: Ctx, userId: string, password: unknown, code: unknown) {
  const [u] = await ctx.sql.query(`SELECT pass_hash, totp_secret_enc, totp_last, totp_enabled FROM users WHERE id = $1`, [userId]);
  if (!u?.totp_enabled) fail(404, 'NOT_FOUND');
  if (!(await verifyPassword(String(password || ''), u.pass_hash))) fail(401, 'WRONG_PASSWORD');
  const check = verifyTotp(ctx.vault.open(u.totp_secret_enc), String(code || ''), u.totp_last);
  if (!check.ok) fail(400, 'CODE_INVALID');
  await ctx.sql.query(`UPDATE users SET totp_enabled = false, totp_secret_enc = NULL, totp_last = '' WHERE id = $1`, [userId]);
  auditEvent(ctx, userId, 'totp_disabled');
  return { ok: true };
}

/* ------------------------------------- security: passkeys (WebAuthn) -------------------------------------
 * A passkey IS the second factor: the device signs with a private key that never leaves it (fingerprint,
 * face, or PIN), so a passkey sign-in does not also require the TOTP code. Google and Meta are moving
 * their accounts this way; Apple does it natively. */

const CHALLENGE_MS = 60_000;

async function freshChallenge(ctx: Ctx, userId: string, purpose: string): Promise<{ id: string; challenge: string }> {
  const id = newId('wc');
  const challenge = newChallenge();
  await ctx.sql.query(
    `INSERT INTO webauthn_challenges (id, user_id, purpose, challenge, expires_at) VALUES ($1,$2,$3,$4,$5)`,
    [id, userId, purpose, challenge, new Date(Date.now() + CHALLENGE_MS).toISOString()]);
  return { id, challenge };
}

/** Step 1 of «add a passkey to this device» — re-auth with the password, like adding a trusted device on Apple. */
export async function passkeyRegisterBegin(ctx: Ctx, userId: string, input: { name?: unknown; password?: unknown }) {
  const name = clean(input?.name, 60);
  const [u] = await ctx.sql.query(`SELECT handle, email_enc, pass_hash FROM users WHERE id = $1`, [userId]);
  if (!u) fail(404, 'NOT_FOUND');
  if (!u.pass_hash || !(await verifyPassword(String(input?.password || ''), u.pass_hash))) fail(401, 'WRONG_PASSWORD');
  const { id, challenge } = await freshChallenge(ctx, userId, 'register');
  const exclude = await ctx.sql.query(`SELECT cred_id FROM passkeys WHERE user_id = $1 LIMIT 25`, [userId]);
  return {
    id,
    challenge,
    rpId: rpIdOf(envOf(ctx)),
    rp: { name: 'شام للعطور (Sham Perfumes)' },
    user: { id: userId, name: ctx.vault.open(u.email_enc), displayName: u.handle },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    timeout: 60_000,
    attestation: 'none',
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    excludeCredentials: exclude.map((r) => ({ type: 'public-key', id: r.cred_id })),
    name,
  };
}

/** Step 2: verify the device's answer and store the public key. */
export async function passkeyRegisterFinish(ctx: Ctx, userId: string, input: { challengeId?: unknown; clientDataJSON?: unknown; attestationObject?: unknown; name?: unknown }) {
  const [ch] = await ctx.sql.query(
    `SELECT challenge FROM webauthn_challenges WHERE id = $1 AND user_id = $2 AND purpose = 'register' AND used_at IS NULL AND expires_at > now()`,
    [String(input.challengeId || ''), userId]);
  if (!ch) fail(400, 'CHALLENGE_INVALID');
  const clientData = Buffer.from(String(input.clientDataJSON || ''), 'base64url');
  const attestation = Buffer.from(String(input.attestationObject || ''), 'base64url');
  let out: ReturnType<typeof verifyCreate> | undefined;
  try { out = verifyCreate(clientData, attestation, ch.challenge, envOf(ctx)); }
  catch { fail(400, 'PASSKEY_INVALID'); }
  // fail() always throws — TypeScript just doesn't know it
  const verified = out!;
  await ctx.sql.query(`UPDATE webauthn_challenges SET used_at = now() WHERE id = $1`, [String(input.challengeId)]);
  const name = clean(input.name, 60) || 'جهاز جديد';
  await ctx.sql.query(
    `INSERT INTO passkeys (id, user_id, cred_id, name, pub_key, alg, sign_count, uv) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [newId('pk'), userId, verified.credId.toString('base64url'), name, verified.pubKeyRaw.toString('base64'), verified.alg, verified.signCount, verified.uv],
  ).catch((error) => { if (/unique|duplicate/i.test(String(error?.message))) fail(409, 'PASSKEY_EXISTS'); throw error; });
  auditEvent(ctx, userId, 'passkey_added', '', name);
  return myPasskeys(ctx, userId);
}

export async function myPasskeys(ctx: Ctx, userId: string) {
  const rows = await ctx.sql.query(`SELECT id, name, uv, created_at, last_used_at FROM passkeys WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [userId]);
  return rows.map((r) => ({ id: r.id, name: r.name, uv: Boolean(r.uv), createdAt: iso(r.created_at), lastUsedAt: iso(r.last_used_at) }));
}

export async function deletePasskey(ctx: Ctx, userId: string, passkeyId: string, password?: unknown) {
  if (password !== undefined) {
    const [u] = await ctx.sql.query(`SELECT pass_hash FROM users WHERE id = $1`, [userId]);
    if (!u || !(await verifyPassword(String(password || ''), u.pass_hash))) fail(401, 'WRONG_PASSWORD');
  }
  const removed = await ctx.sql.query(`DELETE FROM passkeys WHERE id = $1 AND user_id = $2 RETURNING id`, [passkeyId, userId]);
  if (!removed.length) fail(404, 'NOT_FOUND');
  auditEvent(ctx, userId, 'passkey_removed');
  return { ok: true };
}

/** Step 1 of «sign in with a passkey». Identical 404 for unknown e-mail / no passkey (no enumeration). */
export async function passkeyLoginBegin(ctx: Ctx, input: { email?: unknown }) {
  const email = clean(input.email, 254).toLowerCase();
  const [u] = isEmail(email) ? await ctx.sql.query(`SELECT id, status FROM users WHERE email_idx = $1`, [ctx.vault.index(email)]) : [];
  await verifyPassword('timing-equalizer-3', DUMMY_HASH);
  if (!u || u.status === 'deleted') fail(404, 'NOT_FOUND');
  const creds = await ctx.sql.query(`SELECT cred_id FROM passkeys WHERE user_id = $1 LIMIT 10`, [u.id]);
  if (!creds.length) fail(404, 'NOT_FOUND');
  const { id, challenge } = await freshChallenge(ctx, u.id, 'login');
  return {
    id,
    challenge,
    rpId: rpIdOf(envOf(ctx)),
    timeout: 60_000,
    userVerification: 'preferred',
    allowedCredentials: creds.map((r) => ({ type: 'public-key' as const, id: r.cred_id })),
  };
}

/** Step 2: verify the assertion, guard against cloned credentials, open the session. */
export async function passkeyLoginFinish(ctx: Ctx, input: { challengeId?: unknown; credentialId?: unknown; clientDataJSON?: unknown; authenticatorData?: unknown; signature?: unknown }, agent = '', ip = ''): Promise<LoginSuccess> {
  const [ch] = await ctx.sql.query(
    `SELECT challenge, user_id FROM webauthn_challenges WHERE id = $1 AND purpose = 'login' AND used_at IS NULL AND expires_at > now()`,
    [String(input.challengeId || '')]);
  if (!ch) fail(400, 'CHALLENGE_INVALID');
  const [pk] = await ctx.sql.query(
    `SELECT id, pub_key, sign_count FROM passkeys WHERE user_id = $1 AND cred_id = $2`,
    [ch.user_id, String(input.credentialId || '')]);
  if (!pk) fail(401, 'PASSKEY_INVALID');
  const clientData = Buffer.from(String(input.clientDataJSON || ''), 'base64url');
  const authData = Buffer.from(String(input.authenticatorData || ''), 'base64url');
  const signature = Buffer.from(String(input.signature || ''), 'base64url');
  let res: ReturnType<typeof verifyAssert> | undefined;
  try {
    res = verifyAssert(clientData, { authenticatorData: authData, signature }, ch.challenge, coseToPublicKey(cborDecode(Buffer.from(pk.pub_key, 'base64'))).key, envOf(ctx));
  } catch {
    fail(401, 'PASSKEY_INVALID');
  }
  const verified = res!;
  // A counter going backwards means the credential was cloned to another authenticator.
  if (Number(pk.sign_count) > 0 && verified.signCount < Number(pk.sign_count)) {
    auditEvent(ctx, ch.user_id, 'passkey_clone_suspect', '', String(pk.id));
    fail(401, 'PASSKEY_INVALID');
  }
  await ctx.sql.query(`UPDATE webauthn_challenges SET used_at = now() WHERE id = $1`, [String(input.challengeId)]);
  await ctx.sql.query(`UPDATE passkeys SET sign_count = $1, last_used_at = now() WHERE id = $2`, [verified.signCount, pk.id]);
  const [u] = await ctx.sql.query(`SELECT status FROM users WHERE id = $1`, [ch.user_id]);
  if (u?.status === 'suspended') fail(403, 'ACCOUNT_SUSPENDED');
  auditEvent(ctx, ch.user_id, 'login_ok', '', 'passkey');
  return { ...(await startSession(ctx, ch.user_id, agent || 'passkey', ip)), me: await me(ctx, ch.user_id) };
}

/* ------------------------------------ OAuth (Google/Facebook) -----------------------------------
 * The browser opens Google's or Facebook's own window. Sham accepts only a token that provider
 * issued and that this server can verify. A typed e-mail, a JSON blob, or an unsigned JWT is not a link.
 */

export interface OAuthProfile { email: string; name: string; picture: string; subject: string }

/** Public client ids only. A provider is offered only when this server can verify its token. */
export function oauthPublicConfig(env: Record<string, string | undefined>): { googleClientId: string | null; facebookAppId: string | null } {
  const google = env.GOOGLE_CLIENT_ID?.trim() || '';
  const facebook = env.FACEBOOK_APP_ID?.trim() && env.FACEBOOK_APP_SECRET?.trim() ? env.FACEBOOK_APP_ID.trim() : '';
  return { googleClientId: google || null, facebookAppId: facebook || null };
}

function mockOAuthProfile(token: string): OAuthProfile | null {
  // Rehearsal only. A real token has dots or no @; a typed address is never accepted outside this flag.
  if (token.split('.').length >= 3 || !isEmail(token)) return null;
  const email = token.toLowerCase();
  return { email, name: email.split('@')[0], picture: '', subject: `mock:${email}` };
}

async function verifyGoogleToken(idToken: string, env: Record<string, string | undefined>): Promise<OAuthProfile | null> {
  const cleanToken = clean(idToken, 4000);
  if (!cleanToken) return null;
  if (env.SHAM_ALLOW_MOCK_OAUTH === '1') return mockOAuthProfile(cleanToken);
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) return null;
  try {
    const kind = cleanToken.split('.').length === 3 ? 'id_token' : 'access_token';
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?${kind}=${encodeURIComponent(cleanToken)}`);
    if (!res.ok) return null;
    const data = await res.json() as { email?: string; name?: string; picture?: string; aud?: string; email_verified?: string | boolean; sub?: string };
    const verified = data.email_verified === true || data.email_verified === 'true';
    if (!verified || data.aud !== clientId || !data.email || !isEmail(data.email) || !data.sub) return null;
    return { email: data.email.toLowerCase(), name: clean(data.name || data.email.split('@')[0], 60) || data.email.split('@')[0], picture: data.picture || '', subject: data.sub };
  } catch { return null; }
}

async function verifyFacebookToken(accessToken: string, env: Record<string, string | undefined>): Promise<OAuthProfile | null> {
  const token = clean(accessToken, 4000);
  if (!token) return null;
  if (env.SHAM_ALLOW_MOCK_OAUTH === '1') return mockOAuthProfile(token);
  const appId = env.FACEBOOK_APP_ID?.trim();
  const secret = env.FACEBOOK_APP_SECRET?.trim();
  if (!appId || !secret) return null;
  try {
    const appToken = `${appId}|${secret}`;
    const debug = await fetch(`https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appToken)}`);
    if (!debug.ok) return null;
    const dbg = await debug.json() as { data?: { is_valid?: boolean; app_id?: string; user_id?: string } };
    if (!dbg.data?.is_valid || dbg.data.app_id !== appId || !dbg.data.user_id) return null;
    const meRes = await fetch(`https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${encodeURIComponent(token)}`);
    if (!meRes.ok) return null;
    const meData = await meRes.json() as { id?: string; email?: string; name?: string; picture?: { data?: { url?: string } } };
    if (!meData.email || !isEmail(meData.email) || meData.id !== dbg.data.user_id) return null;
    return { email: meData.email.toLowerCase(), name: clean(meData.name || meData.email.split('@')[0], 60) || meData.email.split('@')[0], picture: meData.picture?.data?.url || '', subject: dbg.data.user_id };
  } catch { return null; }
}

async function oauthFindOrCreate(ctx: Ctx, email: string, name: string, provider: 'google' | 'facebook', subject: string, avatar?: string): Promise<string> {
  const linked = clean(subject, 120);
  if (linked.length < 4 || linked === 'google' || linked === 'facebook') fail(401, 'OAUTH_INVALID');
  const col = provider === 'google' ? 'oauth_google_id' : 'oauth_facebook_id';
  let [row] = await ctx.sql.query(`SELECT id, status FROM users WHERE ${col} = $1`, [linked]);
  if (!row) {
    [row] = await ctx.sql.query(`SELECT id, status FROM users WHERE email_idx = $1`, [ctx.vault.index(email)]);
  }
  if (row) {
    if (row.status === 'suspended') fail(403, 'ACCOUNT_SUSPENDED');
    if (row.status === 'deleted') fail(401, 'INVALID_LOGIN');
    await ctx.sql.query(`UPDATE users SET ${col} = $1 WHERE id = $2`, [linked, row.id]);
    return row.id;
  }
  const id = newId('u');
  const handle = await uniqueHandle(ctx.sql, email.split('@')[0] || name);
  await ctx.sql.query(
    `INSERT INTO users (id, handle, name, email_idx, email_enc, pass_hash, country, lang, craft_level, avatar, email_verified_at, ${col})
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now(), $11)`,
    [id, handle, clean(name, 60) || email.split('@')[0], ctx.vault.index(email), ctx.vault.seal(email), await hashPassword(newToken().token), '', 'ar', 'hobbyist', avatar ? clean(avatar, 300) : null, linked],
  );
  auditEvent(ctx, id, 'oauth_register', provider);
  return id;
}

export async function loginWithGoogle(ctx: Ctx, input: { idToken?: unknown; accessToken?: unknown }, agent = '', ip = ''): Promise<LoginOutcome> {
  const env = envOf(ctx);
  if (!env.GOOGLE_CLIENT_ID?.trim() && env.SHAM_ALLOW_MOCK_OAUTH !== '1') fail(503, 'OAUTH_NOT_CONFIGURED');
  const token = String(input.idToken || input.accessToken || '');
  if (!clean(token, 4000)) fail(400, 'INVALID_FIELD', 'idToken');
  const info = await verifyGoogleToken(token, env);
  if (!info) fail(401, 'OAUTH_INVALID', 'google');
  const userId = await oauthFindOrCreate(ctx, info!.email, info!.name, 'google', info!.subject, info!.picture);
  const [u] = await ctx.sql.query(`SELECT totp_enabled, phone_2fa_enabled, phone_2fa_method, status FROM users WHERE id = $1`, [userId]);
  if (u?.status === 'suspended') fail(403, 'ACCOUNT_SUSPENDED');
  if (u?.totp_enabled || u?.phone_2fa_enabled) {
    const { token: pending, hash } = newToken();
    await ctx.sql.query(`INSERT INTO pending_logins (token_hash, user_id, agent, ip, expires_at) VALUES ($1,$2,$3,$4,$5)`, [hash, userId, clean(agent, 200), clean(ip, 64), new Date(Date.now() + PENDING_LOGIN_MS).toISOString()]);
    // The client requests the one-time code after it knows the configured factor channel.
    auditEvent(ctx, userId, 'login_2fa_started', 'oauth_google');
    return { pending: true, pendingToken: pending, expiresIn: Math.round(PENDING_LOGIN_MS / 1000), method: u?.phone_2fa_enabled ? 'phone' as const : 'totp' as const,
      ...(u?.phone_2fa_enabled ? { phoneMethod: u.phone_2fa_method === 'whatsapp' ? 'whatsapp' as const : 'sms' as const } : {}) };
  }
  auditEvent(ctx, userId, 'login_ok', '', 'oauth_google');
  return { ...(await startSession(ctx, userId, agent || 'oauth_google', ip)), me: await me(ctx, userId) };
}

export async function loginWithFacebook(ctx: Ctx, input: { accessToken?: unknown; idToken?: unknown }, agent = '', ip = ''): Promise<LoginOutcome> {
  const env = envOf(ctx);
  if (!(env.FACEBOOK_APP_ID?.trim() && env.FACEBOOK_APP_SECRET?.trim()) && env.SHAM_ALLOW_MOCK_OAUTH !== '1') fail(503, 'OAUTH_NOT_CONFIGURED');
  const token = String(input.accessToken || input.idToken || '');
  if (!clean(token, 4000)) fail(400, 'INVALID_FIELD', 'accessToken');
  const info = await verifyFacebookToken(token, env);
  if (!info) fail(401, 'OAUTH_INVALID', 'facebook');
  const userId = await oauthFindOrCreate(ctx, info!.email, info!.name, 'facebook', info!.subject, info!.picture);
  const [u] = await ctx.sql.query(`SELECT totp_enabled, phone_2fa_enabled, phone_2fa_method, status FROM users WHERE id = $1`, [userId]);
  if (u?.status === 'suspended') fail(403, 'ACCOUNT_SUSPENDED');
  if (u?.totp_enabled || u?.phone_2fa_enabled) {
    const { token: pending, hash } = newToken();
    await ctx.sql.query(`INSERT INTO pending_logins (token_hash, user_id, agent, ip, expires_at) VALUES ($1,$2,$3,$4,$5)`, [hash, userId, clean(agent, 200), clean(ip, 64), new Date(Date.now() + PENDING_LOGIN_MS).toISOString()]);
    // The client requests the one-time code after it knows the configured factor channel.
    auditEvent(ctx, userId, 'login_2fa_started', 'oauth_facebook');
    return { pending: true, pendingToken: pending, expiresIn: Math.round(PENDING_LOGIN_MS / 1000), method: u?.phone_2fa_enabled ? 'phone' as const : 'totp' as const,
      ...(u?.phone_2fa_enabled ? { phoneMethod: u.phone_2fa_method === 'whatsapp' ? 'whatsapp' as const : 'sms' as const } : {}) };
  }
  auditEvent(ctx, userId, 'login_ok', '', 'oauth_facebook');
  return { ...(await startSession(ctx, userId, agent || 'oauth_facebook', ip)), me: await me(ctx, userId) };
}

/* ---------------------------------- Phone 2FA (WhatsApp/SMS) ----------------------------------
 * Optional second factor; a phone is not active until its one-time code is confirmed.
 * WhatsApp uses Meta's approved template. SMS may use Twilio or a dedicated webhook.
 */

async function sendPhoneCode(phone: string, code: string, method: string, env: Record<string, string | undefined>): Promise<{ delivered: boolean }> {
  if (!/^\+[1-9]\d{7,14}$/.test(phone) || !/^\d{6}$/.test(code)) return { delivered: false };
  // Tests only: never print or persist a code, phone number, or provider response.
  if (env.NODE_ENV === 'test' && (env.SHAM_ALLOW_MOCK_SMS === '1' || env.SHAM_ALLOW_MOCK_OAUTH === '1')) return { delivered: true };

  if (method === 'whatsapp') {
    const result = await sendMetaWhatsAppCode(phone, code, env);
    return { delivered: result.accepted };
  }
  if (method !== 'sms') return { delivered: false };

  // Twilio SMS (not WhatsApp — channels are never silently substituted).
  if (env.TWILIO_ACCOUNT_SID?.trim() && env.TWILIO_AUTH_TOKEN?.trim() && env.TWILIO_FROM?.trim()) {
    try {
      const sid = env.TWILIO_ACCOUNT_SID.trim();
      const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
      const body = new URLSearchParams({ To: phone, From: env.TWILIO_FROM.trim(), Body: `Sham Perfume — verification code ${code} (valid for 10 minutes)` });
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${sid}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(), signal: AbortSignal.timeout(8_000),
      });
      return { delivered: res.ok };
    } catch { return { delivered: false }; }
  }

  // A dedicated security-code webhook only; never send OTPs to the general store notification hook.
  const webhook = env.SHAM_SMS_WEBHOOK_URL?.trim();
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone, code, method: 'sms', app: 'sham-perfume' }), signal: AbortSignal.timeout(8_000),
      });
      return { delivered: res.ok };
    } catch { return { delivered: false }; }
  }
  return { delivered: false };
}

async function sendPhoneCodeForUser(ctx: Ctx, userId: string): Promise<void> {
  const [u] = await ctx.sql.query(`SELECT phone_2fa_phone_enc, phone_2fa_method, country FROM users WHERE id = $1`, [userId]);
  if (!u?.phone_2fa_phone_enc) fail(400, 'PHONE_NOT_SET');
  const phone = normalizeStoredPhone(ctx.vault.open(u.phone_2fa_phone_enc), u.country);
  const method = u.phone_2fa_method || 'sms';
  if (method === 'whatsapp' && !metaWhatsAppReady(envOf(ctx))) fail(503, 'WHATSAPP_UNAVAILABLE');
  const code = await issueCode(ctx, userId, 'phone_2fa');
  const sent = await sendPhoneCode(phone, code, method, envOf(ctx));
  if (!sent.delivered) fail(503, method === 'whatsapp' ? 'WHATSAPP_UNAVAILABLE' : 'SMS_UNAVAILABLE');
}

function normalizeE164(value: unknown): string {
  let phone = clean(value, 40).replace(/[\s().-]/g, '');
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) fail(400, 'INVALID_PHONE');
  const parsed = parsePhoneNumberFromString(phone);
  if (!parsed) return fail(400, 'INVALID_PHONE');
  if (!parsed.isPossible() || !/^\+[1-9]\d{7,14}$/.test(parsed.number)) return fail(400, 'INVALID_PHONE');
  return parsed.number;
}

/**
 * Older verified phone factors predate strict E.164 input and may be stored as a country-code number
 * without '+', or as a local number. Canonicalize only for delivery; never guess a country unless the
 * account has a valid ISO region. This keeps previously verified factors usable without weakening new setup.
 */
function normalizeStoredPhone(value: string, country: unknown): string {
  const raw = value.trim().replace(/[\s().-]/g, '');
  if (!raw || !/^\+?\d+$/.test(raw)) fail(503, 'PHONE_FORMAT_UNSUPPORTED');
  const region = isCountry(country) ? country as CountryCode : undefined;
  const international = raw.startsWith('00') ? `+${raw.slice(2)}` : raw.startsWith('+') ? raw : `+${raw}`;
  const parsedInternational = parsePhoneNumberFromString(international);
  if (parsedInternational?.isPossible() && /^\+[1-9]\d{7,14}$/.test(parsedInternational.number)) return parsedInternational.number;
  if (region) {
    const parsedNational = parsePhoneNumberFromString(raw.replace(/\D/g, ''), region);
    if (parsedNational?.isPossible() && /^\+[1-9]\d{7,14}$/.test(parsedNational.number)) return parsedNational.number;
  }
  return fail(503, 'PHONE_FORMAT_UNSUPPORTED');
}

export async function setupPhone2fa(ctx: Ctx, userId: string, input: { phone?: unknown; method?: unknown; password?: unknown }) {
  const [u] = await ctx.sql.query(`SELECT pass_hash FROM users WHERE id = $1`, [userId]);
  if (!u || !(await verifyPassword(String(input.password || ''), u.pass_hash))) fail(401, 'WRONG_PASSWORD');
  const phone = normalizeE164(input.phone);
  const method = clean(input.method, 20).toLowerCase();
  if (!['sms', 'whatsapp'].includes(method)) fail(400, 'INVALID_METHOD');
  if (method === 'whatsapp' && !metaWhatsAppReady(envOf(ctx))) fail(503, 'WHATSAPP_UNAVAILABLE');

  // Issue first, so a rate-limit rejection never changes the pending destination under a live code.
  const code = await issueCode(ctx, userId, 'phone_2fa');
  // Keep the currently verified factor active while a replacement number is being checked.
  const pendingExpiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  await ctx.sql.query(`UPDATE users SET phone_2fa_pending_phone_enc = $1, phone_2fa_pending_method = $2, phone_2fa_pending_expires_at = $3 WHERE id = $4`, [ctx.vault.seal(phone), method, pendingExpiresAt, userId]);
  const sent = await sendPhoneCode(phone, code, method, envOf(ctx));
  if (!sent.delivered) {
    await ctx.sql.query(`UPDATE users SET phone_2fa_pending_phone_enc = NULL, phone_2fa_pending_method = '', phone_2fa_pending_expires_at = NULL WHERE id = $1`, [userId]).catch(() => {});
    fail(503, method === 'whatsapp' ? 'WHATSAPP_UNAVAILABLE' : 'SMS_UNAVAILABLE');
  }
  auditEvent(ctx, userId, 'phone_2fa_setup_started', method);
  return { ok: true, method, phone: phone.slice(0, 4) + '***' + phone.slice(-3) };
}

export async function confirmPhone2fa(ctx: Ctx, userId: string, code: unknown) {
  const [u] = await ctx.sql.query(`SELECT phone_2fa_pending_phone_enc, phone_2fa_pending_method, phone_2fa_pending_expires_at FROM users WHERE id = $1`, [userId]);
  if (!u?.phone_2fa_pending_phone_enc || !['sms', 'whatsapp'].includes(u.phone_2fa_pending_method || '')) fail(400, 'PHONE_SETUP_NOT_STARTED');
  if (!u.phone_2fa_pending_expires_at || new Date(u.phone_2fa_pending_expires_at).getTime() <= Date.now()) {
    await ctx.sql.query(`UPDATE users SET phone_2fa_pending_phone_enc = NULL, phone_2fa_pending_method = '', phone_2fa_pending_expires_at = NULL WHERE id = $1`, [userId]);
    fail(400, 'CODE_INVALID');
  }
  if (!(await checkCode(ctx, userId, 'phone_2fa', String(code || '')))) fail(400, 'CODE_INVALID');
  await ctx.sql.query(
    `UPDATE users SET phone_2fa_phone_enc = phone_2fa_pending_phone_enc, phone_2fa_method = phone_2fa_pending_method,
     phone_2fa_pending_phone_enc = NULL, phone_2fa_pending_method = '', phone_2fa_pending_expires_at = NULL, phone_2fa_enabled = true, phone_2fa_last = $1 WHERE id = $2`,
    [Date.now().toString(36), userId],
  );
  auditEvent(ctx, userId, 'phone_2fa_enabled');
  return { ok: true };
}

export async function cancelPhone2faSetup(ctx: Ctx, userId: string, password: unknown) {
  const [u] = await ctx.sql.query(`SELECT pass_hash FROM users WHERE id = $1`, [userId]);
  if (!u || !(await verifyPassword(String(password || ''), u.pass_hash))) fail(401, 'WRONG_PASSWORD');
  // Clear only the unverified replacement; an already active factor remains untouched.
  await ctx.sql.query(`UPDATE users SET phone_2fa_pending_phone_enc = NULL, phone_2fa_pending_method = '', phone_2fa_pending_expires_at = NULL WHERE id = $1`, [userId]);
  await ctx.sql.query(`UPDATE auth_codes SET used_at = now() WHERE user_id = $1 AND purpose = 'phone_2fa' AND used_at IS NULL`, [userId]);
  auditEvent(ctx, userId, 'phone_2fa_setup_cancelled');
  return { ok: true };
}

export async function disablePhone2fa(ctx: Ctx, userId: string, password: unknown, code?: unknown) {
  const [u] = await ctx.sql.query(`SELECT pass_hash, phone_2fa_enabled FROM users WHERE id = $1`, [userId]);
  if (!u?.phone_2fa_enabled) fail(404, 'NOT_FOUND');
  if (!(await verifyPassword(String(password || ''), u.pass_hash))) fail(401, 'WRONG_PASSWORD');
  // Require code if provided, otherwise just password (phone 2FA is second factor itself, password is enough to disable with re-auth)
  if (code && !(await checkCode(ctx, userId, 'phone_2fa', String(code)))) fail(400, 'CODE_INVALID');
  await ctx.sql.query(`UPDATE users SET phone_2fa_enabled = false, phone_2fa_phone_enc = NULL, phone_2fa_method = '', phone_2fa_last = '', phone_2fa_pending_phone_enc = NULL, phone_2fa_pending_method = '', phone_2fa_pending_expires_at = NULL WHERE id = $1`, [userId]);
  auditEvent(ctx, userId, 'phone_2fa_disabled');
  return { ok: true };
}

export async function requestPhoneLoginCode(ctx: Ctx, pendingToken: string) {
  if (!pendingToken || pendingToken.length < 32) fail(400, 'INVALID_FIELD', 'pendingToken');
  const [row] = await ctx.sql.query(`SELECT user_id FROM pending_logins WHERE token_hash = $1 AND expires_at > now()`, [tokenHash(pendingToken)]);
  if (!row) fail(401, 'INVALID_LOGIN');
  await sendPhoneCodeForUser(ctx, row.user_id);
  return { ok: true };
}

export async function verifyPhoneLoginCode(ctx: Ctx, input: { pendingToken?: unknown; code?: unknown }): Promise<LoginSuccess> {
  const pendingToken = String(input.pendingToken || '');
  if (pendingToken.length < 32) fail(400, 'INVALID_FIELD', 'pendingToken');
  const [row] = await ctx.sql.query(
    `SELECT pl.user_id, pl.agent, pl.ip, u.status FROM pending_logins pl JOIN users u ON u.id = pl.user_id WHERE pl.token_hash = $1 AND pl.expires_at > now()`,
    [tokenHash(pendingToken)]);
  if (!row) fail(401, 'INVALID_LOGIN');
  if (row.status === 'suspended') fail(403, 'ACCOUNT_SUSPENDED');
  if (!(await checkCode(ctx, row.user_id, 'phone_2fa', String(input.code || '')))) { auditEvent(ctx, row.user_id, 'login_2fa_fail'); fail(401, 'CODE_INVALID'); }
  await ctx.sql.query(`DELETE FROM pending_logins WHERE token_hash = $1`, [tokenHash(pendingToken)]);
  await ctx.sql.query(`UPDATE users SET phone_2fa_last = $1 WHERE id = $2`, [Date.now().toString(36), row.user_id]);
  auditEvent(ctx, row.user_id, 'login_ok', '', 'phone_2fa');
  return { ...(await startSession(ctx, row.user_id, row.agent, row.ip)), me: await me(ctx, row.user_id) };
}


/* ------------------------------------------ merchants ------------------------------------------ */

const CURRENCY = /^[A-Z]{3}$/;
const slugOf = (text: string) => text.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export interface MerchantInput {
  storeName?: unknown; about?: unknown; logo?: unknown; country?: unknown; currency?: unknown;
  /** Private (encrypted, admin only): legal name, registration number, tax id, phone, WhatsApp, address. */
  legal?: Record<string, unknown>;
  /** Private (encrypted, admin only): how the site pays the merchant. */
  payout?: Record<string, unknown>;
}
const legalOf = (l: Record<string, unknown> = {}) => ({
  legalName: clean(l.legalName, 160), registration: clean(l.registration, 80), taxId: clean(l.taxId, 80),
  phone: clean(l.phone, 40), whatsapp: clean(l.whatsapp, 40), address: clean(l.address, 300), website: clean(l.website, 300),
});
const payoutOf = (p: Record<string, unknown> = {}) => ({
  method: ['bank', 'wallet', 'instapay', 'other'].includes(String(p.method)) ? String(p.method) : 'bank',
  bankName: clean(p.bankName, 120), accountHolder: clean(p.accountHolder, 160), iban: clean(p.iban, 60), wallet: clean(p.wallet, 60), notes: clean(p.notes, 300),
});

/** «سجّل كتاجر»: the store is created «pending»; the administration reviews and approves it. */
export async function applyMerchant(ctx: Ctx, userId: string, input: MerchantInput) {
  const [existing] = await ctx.sql.query(`SELECT status FROM merchants WHERE user_id = $1`, [userId]);
  if (existing) fail(409, 'ALREADY_MERCHANT');
  const storeName = required(input.storeName, 'storeName', 2, 80);
  const legal = legalOf(input.legal);
  if (legal.phone.replace(/\D/g, '').length < 7) fail(400, 'INVALID_FIELD', 'phone');
  const currency = clean(input.currency, 3).toUpperCase();
  const country = clean(input.country, 2).toUpperCase();
  // Arabic names have no Latin letters: the store address then follows the owner's username («omar-store»).
  const latin = slugOf(storeName);
  const [owner] = await ctx.sql.query(`SELECT handle FROM users WHERE id = $1`, [userId]);
  let slug = latin.length >= 3 ? latin : `${slugOf(String(owner?.handle || '')) || 'sham'}-store`;
  for (let i = 0; i < 5; i++) {
    const [taken] = await ctx.sql.query(`SELECT 1 FROM merchants WHERE slug = $1`, [slug]);
    if (!taken) break;
    slug = `${slug.replace(/-\d{3,4}$/, '')}-${Math.floor(100 + Math.random() * 9000)}`;
  }
  await ctx.sql.tx(async (t) => {
    await t.query(
      `INSERT INTO merchants (user_id, slug, store_name, about, logo, country, currency, legal_enc, payout_enc) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [userId, slug, storeName, clean(input.about, 1500), image(input.logo, 200), isCountry(country) ? country : '', CURRENCY.test(currency) ? currency : 'EGP',
        ctx.vault.sealJson(legal), ctx.vault.sealJson(payoutOf(input.payout))]);
    await t.query(`UPDATE users SET role = 'merchant' WHERE id = $1`, [userId]);
  });
  return myMerchant(ctx, userId);
}

export async function myMerchant(ctx: Ctx, userId: string) {
  const [m] = await ctx.sql.query(`SELECT * FROM merchants WHERE user_id = $1`, [userId]);
  if (!m) fail(404, 'NOT_MERCHANT');
  const [stats] = await ctx.sql.query(
    `SELECT (SELECT count(*) FROM merchant_products WHERE merchant_id = $1)::int AS products,
            (SELECT count(*) FROM merchant_products WHERE merchant_id = $1 AND status = 'approved')::int AS published,
            (SELECT count(*) FROM merchant_products WHERE merchant_id = $1 AND status = 'pending')::int AS pending,
            (SELECT count(*) FROM orders WHERE merchant_id = $1 AND status NOT IN ('awaiting_payment','cancelled'))::int AS orders,
            (SELECT coalesce(sum(merchant_total), 0) FROM orders WHERE merchant_id = $1 AND status IN ('paid','processing','shipped','delivered'))::float AS earnings`, [userId]);
  return {
    slug: m.slug, storeName: m.store_name, about: m.about, logo: m.logo || null, country: m.country, currency: m.currency, status: m.status,
    note: m.admin_note, legal: ctx.vault.openJson(m.legal_enc, legalOf()), payout: ctx.vault.openJson(m.payout_enc, payoutOf()),
    createdAt: iso(m.created_at), reviewedAt: iso(m.reviewed_at), stats,
  };
}

export async function updateMerchant(ctx: Ctx, userId: string, input: MerchantInput) {
  const current = await myMerchant(ctx, userId);
  const storeName = input.storeName !== undefined ? required(input.storeName, 'storeName', 2, 80) : current.storeName;
  const currency = input.currency !== undefined && CURRENCY.test(clean(input.currency, 3).toUpperCase()) ? clean(input.currency, 3).toUpperCase() : current.currency;
  const country = input.country !== undefined ? clean(input.country, 2).toUpperCase() : current.country;
  await ctx.sql.query(
    `UPDATE merchants SET store_name = $1, about = $2, logo = $3, country = $4, currency = $5, legal_enc = $6, payout_enc = $7 WHERE user_id = $8`,
    [storeName, input.about !== undefined ? clean(input.about, 1500) : current.about, input.logo !== undefined ? image(input.logo, 200) : current.logo,
      isCountry(country) ? country : '', currency, ctx.vault.sealJson(input.legal ? legalOf(input.legal) : current.legal),
      ctx.vault.sealJson(input.payout ? payoutOf(input.payout) : current.payout), userId]);
  return myMerchant(ctx, userId);
}

/* ---------------------------------------- merchant products ---------------------------------------- */

const CATEGORIES = ['perfume', 'oil', 'incense', 'raw_material', 'alcohol', 'bottle', 'packaging', 'tool', 'other'];
export interface ProductInput {
  name?: unknown; description?: unknown; category?: unknown; images?: unknown; price?: unknown; currency?: unknown; stock?: unknown;
  /** Private between the merchant and the site: where the product is, supplier links, internal notes. */
  source?: { links?: unknown; notes?: unknown };
}

const sourceOf = (s: ProductInput['source'] = {}) => ({
  links: (Array.isArray(s.links) ? s.links : String(s.links || '').split(/\s+/)).map((l) => clean(l, 600)).filter((l) => /^https?:\/\//.test(l)).slice(0, 10),
  notes: clean(s.notes, 1000),
});
/** Public descriptions must not carry contact routes: links, phone numbers and e-mails are removed. */
export function stripContacts(text: string): string {
  return text
    .replace(/https?:\/\/\S+|www\.\S+|\b[\w.-]+\.(com|net|org|shop|store|me|io|eg|sa|ae|co)(\/\S*)?\b/gi, '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '')
    .replace(/(\+?\d[\d\s().-]{7,}\d)/g, '')
    .replace(/@[A-Za-z0-9_.]{3,}/g, '')
    .replace(/[ \t]{2,}/g, ' ').trim();
}

function productRow(ctx: Ctx, row: Row, owner: boolean) {
  return {
    id: row.id, name: row.name, description: row.description, category: row.category, images: row.images || [],
    price: row.price, currency: row.currency, stock: row.stock, status: row.status, reviewNote: row.review_note,
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
    ...(owner ? { source: ctx.vault.openJson(row.source_enc, sourceOf()) } : {}),
  };
}

function productFields(input: ProductInput, partial = false) {
  const out: Record<string, unknown> = {};
  if (!partial || input.name !== undefined) out.name = stripContacts(required(input.name, 'name', 2, 140));
  if (!partial || input.description !== undefined) out.description = stripContacts(clean(input.description, 4000));
  if (!partial || input.category !== undefined) out.category = CATEGORIES.includes(String(input.category)) ? String(input.category) : 'other';
  if (!partial || input.images !== undefined) {
    const list = Array.isArray(input.images) ? input.images.slice(0, 6) : [];
    out.images = JSON.stringify(list.map((i) => image(i, 400, true)).filter(Boolean));
  }
  if (!partial || input.price !== undefined) {
    const price = Number(input.price);
    if (!(price > 0 && price < 10_000_000)) fail(400, 'INVALID_FIELD', 'price');
    out.price = Math.round(price * 100) / 100;
  }
  if (!partial || input.currency !== undefined) {
    const currency = clean(input.currency, 3).toUpperCase();
    if (!CURRENCY.test(currency)) fail(400, 'INVALID_FIELD', 'currency');
    out.currency = currency;
  }
  if (!partial || input.stock !== undefined) {
    const stock = Number(input.stock ?? 0);
    if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) fail(400, 'INVALID_FIELD', 'stock');
    out.stock = stock;
  }
  return out;
}

async function approvedMerchant(ctx: Ctx, userId: string) {
  const [m] = await ctx.sql.query(`SELECT status, currency FROM merchants WHERE user_id = $1`, [userId]);
  if (!m) fail(403, 'NOT_MERCHANT');
  if (m.status === 'suspended' || m.status === 'rejected') fail(403, 'MERCHANT_SUSPENDED');
  return m;
}

/** A new product always waits for the administration's review before it is published. */
export async function createProduct(ctx: Ctx, userId: string, input: ProductInput) {
  await approvedMerchant(ctx, userId);
  const [{ n }] = await ctx.sql.query(`SELECT count(*)::int AS n FROM merchant_products WHERE merchant_id = $1`, [userId]);
  if (n >= 500) fail(400, 'PRODUCT_LIMIT');
  const f = productFields(input);
  const id = newId('mp');
  await ctx.sql.query(
    `INSERT INTO merchant_products (id, merchant_id, name, description, category, images, price, currency, stock, source_enc)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)`,
    [id, userId, f.name, f.description, f.category, f.images, f.price, f.currency, f.stock, ctx.vault.sealJson(sourceOf(input.source))]);
  const [row] = await ctx.sql.query(`SELECT * FROM merchant_products WHERE id = $1`, [id]);
  return productRow(ctx, row, true);
}

/** Editing what buyers see (name, description, pictures, price) sends the product back to review; stock does not. */
export async function updateProduct(ctx: Ctx, userId: string, productId: string, input: ProductInput & { paused?: unknown }) {
  await approvedMerchant(ctx, userId);
  const [row] = await ctx.sql.query(`SELECT * FROM merchant_products WHERE id = $1 AND merchant_id = $2`, [productId, userId]);
  if (!row) fail(404, 'NOT_FOUND');
  const f = productFields(input, true);
  const reviewed = ['name', 'description', 'images', 'price', 'currency', 'category'].some((k) => k in f);
  const sets: string[] = []; const params: unknown[] = [];
  for (const [key, value] of Object.entries(f)) { params.push(value); sets.push(`${key} = $${params.length}${key === 'images' ? '::jsonb' : ''}`); }
  if (input.source !== undefined) { params.push(ctx.vault.sealJson(sourceOf(input.source))); sets.push(`source_enc = $${params.length}`); }
  let status = row.status;
  if (reviewed && row.status !== 'pending') status = 'pending';
  if (input.paused === true && status === 'approved') status = 'paused';
  if (input.paused === false && row.status === 'paused' && !reviewed) status = 'approved';
  params.push(status); sets.push(`status = $${params.length}`);
  sets.push('updated_at = now()');
  params.push(productId);
  await ctx.sql.query(`UPDATE merchant_products SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  const [updated] = await ctx.sql.query(`SELECT * FROM merchant_products WHERE id = $1`, [productId]);
  return productRow(ctx, updated, true);
}

export async function deleteProduct(ctx: Ctx, userId: string, productId: string) {
  const rows = await ctx.sql.query(`DELETE FROM merchant_products WHERE id = $1 AND merchant_id = $2 RETURNING id`, [productId, userId]);
  if (!rows.length) fail(404, 'NOT_FOUND');
}

export async function myProducts(ctx: Ctx, userId: string) {
  const rows = await ctx.sql.query(`SELECT * FROM merchant_products WHERE merchant_id = $1 ORDER BY updated_at DESC`, [userId]);
  return rows.map((r) => productRow(ctx, r, true));
}

/** The site's selling price in EGP: the merchant's price converted, plus the site's 50 %. */
export const SITE_MARGIN = 0.5;
export function sellingPriceEgp(price: number, currency: string, fx: FxTable = BUNDLED_FX): number {
  return tidy(convert(price, currency, 'EGP', fx) * (1 + SITE_MARGIN));
}

const publicProduct = (row: Row, fx: FxTable) => ({
  sku: row.id, id: row.id, name: row.name, description: row.description, category: row.category, images: row.images || [],
  priceEgp: sellingPriceEgp(row.price, row.currency, fx), inStock: row.stock > 0,
  store: row.m_slug ? { slug: row.m_slug, name: row.m_store } : undefined,
});

/** «متاجر شام»: approved stores with their published products — never a source link or a contact. */
export async function storeDirectory(ctx: Ctx) {
  const rows = await ctx.sql.query(
    `SELECT m.slug, m.store_name, m.about, m.logo, m.country,
            (SELECT count(*) FROM merchant_products p WHERE p.merchant_id = m.user_id AND p.status = 'approved')::int AS products
     FROM merchants m JOIN users u ON u.id = m.user_id WHERE m.status = 'approved' AND u.status = 'active' ORDER BY products DESC, m.store_name`);
  return rows.map((r) => ({ slug: r.slug, name: r.store_name, about: stripContacts(r.about), logo: r.logo || null, country: r.country, products: r.products }));
}

export async function storePage(ctx: Ctx, slug: string) {
  const [m] = await ctx.sql.query(
    `SELECT m.*, u.handle FROM merchants m JOIN users u ON u.id = m.user_id WHERE m.slug = $1 AND m.status = 'approved' AND u.status = 'active'`, [clean(slug, 60)]);
  if (!m) fail(404, 'NOT_FOUND');
  const fx = await (ctx.fx?.() ?? Promise.resolve(BUNDLED_FX)).catch(() => BUNDLED_FX);
  const rows = await ctx.sql.query(`SELECT * FROM merchant_products WHERE merchant_id = $1 AND status = 'approved' ORDER BY updated_at DESC`, [m.user_id]);
  return {
    store: { slug: m.slug, name: m.store_name, about: stripContacts(m.about), logo: m.logo || null, country: m.country, since: iso(m.reviewed_at || m.created_at) },
    products: rows.map((r) => publicProduct({ ...r, m_slug: m.slug, m_store: m.store_name }, fx)),
  };
}

/** Published merchant products by sku, priced for the checkout (server-side, never trusted from the browser). */
/** The cart's merchant items as the public sees them (name, picture, price) — for the basket in «متجر شام». */
export async function storeItems(ctx: Ctx, skus: string[]) {
  return (await productsForCheckout(ctx, skus.slice(0, 50))).map((p) => ({
    sku: p.sku, id: p.id, name: p.name, description: p.description, category: p.category, images: p.images, priceEgp: p.priceEgp, inStock: p.inStock, store: p.store,
  }));
}

export async function productsForCheckout(ctx: Ctx, skus: string[]) {
  const ids = skus.filter((s) => /^mp_[A-Za-z0-9_-]{8,40}$/.test(s));
  if (!ids.length) return [];
  const fx = await (ctx.fx?.() ?? Promise.resolve(BUNDLED_FX)).catch(() => BUNDLED_FX);
  const rows = await ctx.sql.query(
    `SELECT p.*, m.slug AS m_slug, m.store_name AS m_store FROM merchant_products p JOIN merchants m ON m.user_id = p.merchant_id
     WHERE p.id = ANY($1) AND p.status = 'approved' AND m.status = 'approved'`, [ids]);
  return rows.map((r) => ({
    ...publicProduct(r, fx), merchantId: r.merchant_id, merchantPrice: r.price, merchantCurrency: r.currency, stock: r.stock,
    price: sellingPriceEgp(r.price, r.currency, fx), costEgp: convert(r.price, r.currency, 'EGP', fx),
  }));
}

/* --------------------------------------------- orders --------------------------------------------- */

export const orderNumber = () => `SO-${new Date().getUTCFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

/**
 * Records the merchant part of a checkout (one order per merchant) when the payment page is opened. The
 * buyer's address is encrypted; the merchant sees items and their own amount, the administration sees all.
 */
export async function recordCheckout(ctx: Ctx, input: {
  ref: string; buyerId?: string; country: string; items: { sku: string; qty: number }[];
  address: Record<string, unknown>; shippingUsd: number; total: number; currency: string;
  /** The site's own products («متجر شام»), recorded for signed-in buyers so they appear in «مشترياتي». */
  catalog?: { sku: string; qty: number; price: number; name: string; image?: string }[];
}) {
  const products = await productsForCheckout(ctx, input.items.map((i) => i.sku));
  const byMerchant = new Map<string, typeof products>();
  for (const p of products) byMerchant.set(p.merchantId, [...(byMerchant.get(p.merchantId) || []), p]);
  for (const [merchantId, list] of byMerchant) {
    const items = list.map((p) => {
      const qty = input.items.find((i) => i.sku === p.sku)!.qty;
      return { sku: p.sku, name: p.name, qty, merchantUnit: p.merchantPrice, unitEgp: p.price, costEgp: p.costEgp, image: p.images[0] && !String(p.images[0]).startsWith('data:') ? p.images[0] : undefined };
    });
    const merchantTotal = items.reduce((s, i) => s + i.merchantUnit * i.qty, 0);
    // The site's margin: what the buyer pays for the products minus what the merchant receives (both in EGP).
    const marginEgp = items.reduce((s, i) => s + (i.unitEgp - i.costEgp) * i.qty, 0);
    await ctx.sql.query(
      `INSERT INTO orders (id, number, buyer_id, merchant_id, items, merchant_total, merchant_currency, margin_egp, shipping_usd, total_charged, charge_currency, country, address_enc, payment_ref)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [newId('o'), orderNumber(), input.buyerId || null, merchantId, JSON.stringify(items), Math.round(merchantTotal * 100) / 100, list[0].merchantCurrency,
        Math.round(marginEgp * 100) / 100, input.shippingUsd, input.total, input.currency, input.country,
        ctx.vault.sealJson(input.address), input.ref]);
  }
  if (input.buyerId && input.catalog?.length) {
    const items = input.catalog.map((l) => ({ sku: l.sku, name: clean(l.name, 200), qty: l.qty, unitEgp: l.price, image: l.image && /^https:\/\//.test(l.image) ? l.image : undefined }));
    await ctx.sql.query(
      `INSERT INTO orders (id, number, buyer_id, merchant_id, items, merchant_total, merchant_currency, margin_egp, shipping_usd, total_charged, charge_currency, country, address_enc, payment_ref)
       VALUES ($1,$2,$3,NULL,$4::jsonb,0,'EGP',0,$5,$6,$7,$8,$9,$10)`,
      [newId('o'), orderNumber(), input.buyerId, JSON.stringify(items), input.shippingUsd, input.total, input.currency, input.country, ctx.vault.sealJson(input.address), input.ref]);
  }
  return byMerchant.size;
}

/** Kashier confirmed the payment (verified server-side): the merchants' orders become «paid», stock is reserved. */
export async function markPaid(ctx: Ctx, ref: string) {
  const rows = await ctx.sql.query(`UPDATE orders SET status = 'paid', updated_at = now() WHERE payment_ref = $1 AND status = 'awaiting_payment' RETURNING merchant_id, items`, [ref]);
  let merchantOrders = 0;
  for (const row of rows) {
    if (!row.merchant_id) continue; // the site's own products: shipped by the administration
    merchantOrders++;
    for (const item of row.items as { sku: string; qty: number }[]) {
      await ctx.sql.query(`UPDATE merchant_products SET stock = greatest(0, stock - $1) WHERE id = $2`, [item.qty, item.sku]);
    }
    await ctx.sql.query(`INSERT INTO notifications (id, user_id, kind, ref) VALUES ($1, $2, 'order_paid', $3)`, [newId('n'), row.merchant_id, ref]);
  }
  return merchantOrders;
}

export const SITE_STORE = 'متجر شام';

export interface OrderView {
  id: string; number: string; status: string; createdAt: string | null; updatedAt: string | null; country: string;
  items: { sku: string; name: string; qty: number; image?: string; unit?: number }[];
  amount?: number; total?: number; currency: string; store?: string;
}
const orderView = (row: Row, side: 'buyer' | 'merchant'): OrderView => ({
  id: row.id, number: row.number, status: row.status, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), country: row.country,
  items: (row.items as Row[]).map((i) => ({ sku: i.sku, name: i.name, qty: i.qty, image: i.image, ...(side === 'merchant' ? { unit: i.merchantUnit } : {}) })),
  ...(side === 'merchant' ? { amount: row.merchant_total, currency: row.merchant_currency } : { total: row.total_charged, currency: row.charge_currency, store: row.m_store }),
});

export async function myOrders(ctx: Ctx, userId: string) {
  const rows = await ctx.sql.query(
    `SELECT o.*, m.store_name AS m_store FROM orders o LEFT JOIN merchants m ON m.user_id = o.merchant_id WHERE o.buyer_id = $1 ORDER BY o.created_at DESC, o.id LIMIT 200`, [userId]);
  // One payment can cover several stores: its total is shown once, on the first of its orders.
  const seen = new Set<string>();
  return rows.map((r) => {
    const view = orderView(r, 'buyer');
    if (!r.merchant_id) view.store = SITE_STORE;
    if (r.payment_ref && seen.has(r.payment_ref)) view.total = undefined; else if (r.payment_ref) seen.add(r.payment_ref);
    return view;
  });
}

export async function merchantOrders(ctx: Ctx, userId: string) {
  const rows = await ctx.sql.query(`SELECT * FROM orders WHERE merchant_id = $1 AND status <> 'awaiting_payment' ORDER BY created_at DESC LIMIT 300`, [userId]);
  return rows.map((r) => orderView(r, 'merchant'));
}

/** The merchant may only report preparation; shipping and delivery are set by the administration. */
export async function merchantOrderReady(ctx: Ctx, userId: string, orderId: string) {
  const rows = await ctx.sql.query(`UPDATE orders SET status = 'processing', updated_at = now() WHERE id = $1 AND merchant_id = $2 AND status = 'paid' RETURNING id`, [orderId, userId]);
  if (!rows.length) fail(409, 'INVALID_STATE');
}

/* ------------------------------------------ recipes & learning ------------------------------------------ */

const VISIBILITY = ['private', 'friends', 'public'];

export async function saveRecipe(ctx: Ctx, userId: string, input: { id?: unknown; title?: unknown; data?: unknown; notes?: unknown; visibility?: unknown }) {
  const title = required(input.title, 'title', 1, 140);
  const data = input.data && typeof input.data === 'object' ? JSON.stringify(input.data) : '{}';
  if (data.length > 60_000) fail(400, 'RECIPE_TOO_LARGE');
  const visibility = VISIBILITY.includes(String(input.visibility)) ? String(input.visibility) : 'private';
  const id = typeof input.id === 'string' && /^r_[\w-]{8,40}$/.test(input.id) ? input.id : '';
  if (id) {
    const rows = await ctx.sql.query(
      `UPDATE recipes SET title = $1, data = $2::jsonb, notes = $3, visibility = $4, updated_at = now() WHERE id = $5 AND user_id = $6 RETURNING id`,
      [title, data, clean(input.notes, 3000), visibility, id, userId]);
    if (!rows.length) fail(404, 'NOT_FOUND');
    return getRecipe(ctx, userId, id);
  }
  const [{ n }] = await ctx.sql.query(`SELECT count(*)::int AS n FROM recipes WHERE user_id = $1`, [userId]);
  if (n >= 1000) fail(400, 'RECIPE_LIMIT');
  const newRecipe = newId('r');
  await ctx.sql.query(`INSERT INTO recipes (id, user_id, title, data, notes, visibility) VALUES ($1,$2,$3,$4::jsonb,$5,$6)`,
    [newRecipe, userId, title, data, clean(input.notes, 3000), visibility]);
  return getRecipe(ctx, userId, newRecipe);
}

const recipeView = (r: Row) => ({ id: r.id, title: r.title, data: r.data, notes: r.notes, visibility: r.visibility, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) });

export async function getRecipe(ctx: Ctx, viewerId: string | undefined, id: string) {
  const [r] = await ctx.sql.query(`SELECT * FROM recipes WHERE id = $1`, [id]);
  if (!r) fail(404, 'NOT_FOUND');
  if (r.user_id !== viewerId && r.visibility !== 'public') {
    const friends = viewerId ? await areFriends(ctx.sql, r.user_id, viewerId) : false;
    if (!(r.visibility === 'friends' && friends)) fail(404, 'NOT_FOUND');
  }
  return recipeView(r);
}

export async function myRecipes(ctx: Ctx, userId: string) {
  return (await ctx.sql.query(`SELECT * FROM recipes WHERE user_id = $1 ORDER BY updated_at DESC`, [userId])).map(recipeView);
}

export async function deleteRecipe(ctx: Ctx, userId: string, id: string) {
  const rows = await ctx.sql.query(`DELETE FROM recipes WHERE id = $1 AND user_id = $2 RETURNING id`, [id, userId]);
  if (!rows.length) fail(404, 'NOT_FOUND');
}

/** «رحلة التعلّم»: progress (0–100) per lesson / tool / material the user studied on the site. */
export async function saveLearning(ctx: Ctx, userId: string, input: { itemId?: unknown; kind?: unknown; title?: unknown; progress?: unknown }) {
  const itemId = required(input.itemId, 'itemId', 1, 80);
  const progress = Math.max(0, Math.min(100, Math.round(Number(input.progress) || 0)));
  const kind = ['lesson', 'tool', 'material', 'guide'].includes(String(input.kind)) ? String(input.kind) : 'lesson';
  await ctx.sql.query(
    `INSERT INTO learning (user_id, item_id, kind, title, progress) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, item_id) DO UPDATE SET progress = greatest(learning.progress, EXCLUDED.progress), title = EXCLUDED.title, updated_at = now()`,
    [userId, itemId, kind, clean(input.title, 140), progress]);
  return myLearning(ctx, userId);
}

export async function myLearning(ctx: Ctx, userId: string) {
  const rows = await ctx.sql.query(`SELECT * FROM learning WHERE user_id = $1 ORDER BY updated_at DESC`, [userId]);
  return rows.map((r) => ({ itemId: r.item_id, kind: r.kind, title: r.title, progress: r.progress, updatedAt: iso(r.updated_at) }));
}

/* ------------------------------------------- helpers ------------------------------------------- */

export async function areFriends(sql: Sql, a: string, b: string): Promise<boolean> {
  const [x, y] = a < b ? [a, b] : [b, a];
  const [row] = await sql.query(`SELECT 1 FROM friendships WHERE user_a = $1 AND user_b = $2 AND status = 'accepted'`, [x, y]);
  return Boolean(row);
}

export async function isBlocked(sql: Sql, a: string, b: string): Promise<boolean> {
  const [row] = await sql.query(`SELECT 1 FROM blocks WHERE (blocker = $1 AND blocked = $2) OR (blocker = $2 AND blocked = $1)`, [a, b]);
  return Boolean(row);
}

/** Everything the user stored, as one JSON document (data portability). */
export async function exportMyData(ctx: Ctx, userId: string) {
  const [account, recipes, learning, orders] = await Promise.all([me(ctx, userId), myRecipes(ctx, userId), myLearning(ctx, userId), myOrders(ctx, userId)]);
  const posts = await ctx.sql.query(`SELECT id, body, visibility, created_at FROM posts WHERE author_id = $1 ORDER BY created_at DESC`, [userId]);
  const mailboxes = await ctx.sql.query(
    `SELECT c.folder, m.kind, m.created_at, m.sent_at, m.subject_enc, m.body_enc FROM mail_copies c JOIN mail_messages m ON m.id = c.message_id WHERE c.user_id = $1 ORDER BY m.created_at DESC`,
    [userId]);
  const mail = mailboxes.map((m) => ({ folder: m.folder, kind: m.kind, createdAt: m.created_at, sentAt: m.sent_at, subject: ctx.vault.open(m.subject_enc), body: ctx.vault.open(m.body_enc) }));
  const merchant = account.merchant ? await myMerchant(ctx, userId).catch(() => null) : null;
  return { exportedAt: new Date().toISOString(), account, merchant, recipes, learning, orders, posts, mail };
}
