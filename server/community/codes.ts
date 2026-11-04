/**
 * «مجتمع شام» — one-time 6-digit codes for e-mail verification and password reset.
 *
 * The pattern Google, Apple and Meta use: a short numeric code to the account's e-mail, single-use,
 * short-lived, rate-limited. Here the extra strictness:
 *  - the code is kept only as `sha256(salt + code)` — a database leak cannot be replayed;
 *  - max 5 issues per 15 minutes per account+purpose — e-mail bombing and brute force stop;
 *  - a new code voids the account's previous ones of the same purpose;
 *  - 10–15 minutes of validity, then dead;
 *  - the request side answers identically whether the e-mail exists or not (no account enumeration).
 */
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { newId } from './crypto';
import { CommunityError, type Ctx } from './service';

export type CodePurpose = 'verify_email' | 'reset_password' | 'phone_2fa';

const LIFE_MS: Record<CodePurpose, number> = { verify_email: 15 * 60_000, reset_password: 10 * 60_000, phone_2fa: 10 * 60_000 };
const MAX_ISSUES = 5; // per rolling window
const WINDOW_MS = 15 * 60_000;

const codeHash = (salt: string, code: string) => createHash('sha256').update(`${salt}|${code}`).digest('base64url');

/**
 * Issue a code for the account and return the plain code — the caller sends it by e-mail and never
 * stores it. Fails with CODE_LIMITED when the rolling window is exhausted.
 */
export async function issueCode(ctx: Ctx, userId: string, purpose: CodePurpose): Promise<string> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const [count] = await ctx.sql.query(
    `SELECT count(*)::int AS n FROM auth_codes WHERE user_id = $1 AND purpose = $2 AND created_at > $3`, [userId, purpose, since]);
  if (count.n >= MAX_ISSUES) throw new CommunityError(429, 'CODE_LIMITED', 'Too many codes, please wait a few minutes');
  // A new code voids the account's previous unused ones of the same purpose (single live code).
  await ctx.sql.query(`UPDATE auth_codes SET used_at = now() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`, [userId, purpose]);
  const code = String(randomInt(100_000, 1_000_000));
  const salt = randomBytes(8).toString('base64url');
  const expires = new Date(Date.now() + LIFE_MS[purpose]).toISOString();
  await ctx.sql.query(
    `INSERT INTO auth_codes (id, user_id, purpose, code_salt, code_hash, expires_at) VALUES ($1,$2,$3,$4,$5,$6)`,
    [newId('c'), userId, purpose, salt, codeHash(salt, code), expires],
  );
  return code;
}

/** Check a submitted code; on success the code is consumed (single use). */
export async function checkCode(ctx: Ctx, userId: string, purpose: CodePurpose, code: string): Promise<boolean> {
  const digits = String(code || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(digits)) return false;
  const rows = await ctx.sql.query(
    `SELECT id, code_salt, code_hash FROM auth_codes WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 3`,
    [userId, purpose]);
  for (const row of rows) {
    if (codeHash(String(row.code_salt), digits) === String(row.code_hash)) {
      await ctx.sql.query(`UPDATE auth_codes SET used_at = now() WHERE id = $1`, [row.id]);
      return true;
    }
  }
  return false;
}
