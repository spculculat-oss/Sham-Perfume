/**
 * Checks the Kashier secrets (KASHIER_MERCHANT_ID, KASHIER_API_KEY, KASHIER_SECRET_KEY, KASHIER_MODE) with
 * the site's own payment code: it opens one 1 EGP payment session that nobody pays (it simply expires).
 * Results are annotations only — key values are never printed. Adds `kashier` to SHAM_VERIFY_FILE so
 * scripts/sync-vercel-env.mjs never copies keys that failed here to the live server.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createSession, kashierConfig, KashierError } from '../server/core/kashier';

const env = process.env;
const gh = Boolean(env.GITHUB_ACTIONS);
const note = (level: 'notice' | 'warning' | 'error', title: string, msg: string) => console.log(gh ? `::${level} title=${title}::${msg}` : `[${level}] ${title}: ${msg}`);
const record = (code: string) => {
  const file = env.SHAM_VERIFY_FILE;
  if (!file) return;
  let data: Record<string, string> = {};
  try { if (existsSync(file)) data = JSON.parse(readFileSync(file, 'utf8')); } catch { data = {}; }
  writeFileSync(file, JSON.stringify({ ...data, kashier: code }));
};
const summary = (line: string) => { if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${line}\n`); };

const present = ['KASHIER_MERCHANT_ID', 'KASHIER_API_KEY', 'KASHIER_SECRET_KEY'].filter((k) => env[k]?.trim());
if (!present.length) { note('notice', 'Kashier', 'not configured yet — the store keeps the «مساعد شام» order flow'); process.exit(0); }
const missing = ['KASHIER_MERCHANT_ID', 'KASHIER_API_KEY', 'KASHIER_SECRET_KEY'].filter((k) => !env[k]?.trim());
if (missing.length) { note('warning', 'Kashier', `missing secret(s): ${missing.join(', ')}`); record('missing'); process.exit(0); }

// Shape hints, without revealing anything: the usual mix-ups are a password or the wrong key in a slot.
const mid = env.KASHIER_MERCHANT_ID!.trim();
const secret = env.KASHIER_SECRET_KEY!.trim();
const apiKey = env.KASHIER_API_KEY!.trim();
if (!/^MID-\d+-\d+$/i.test(mid)) note('warning', 'Kashier KASHIER_MERCHANT_ID', 'should look like MID-12345-123 (shown under your name in the Kashier dashboard)');
if (!secret.includes('$')) note('warning', 'Kashier KASHIER_SECRET_KEY', `does not look like a Kashier Secret Key (expected two parts joined by $, length ${secret.length}). If you saved your login password here, delete it and change the password.`);
if (apiKey === secret) note('warning', 'Kashier keys', 'KASHIER_API_KEY and KASHIER_SECRET_KEY are the same value — they are two different keys');
const mode = env.KASHIER_MODE?.trim().toLowerCase() || 'test';
if (!['test', 'live'].includes(mode)) note('warning', 'Kashier KASHIER_MODE', 'must be test or live (using test)');

const cfg = kashierConfig(env);
if (!cfg) { note('error', 'Kashier', 'the secrets are not usable (check KASHIER_MERCHANT_ID)'); record('invalid_key'); process.exit(0); }

async function attempt(m: 'test' | 'live') {
  return createSession({ ...cfg!, mode: m }, {
    order: `VERIFY-${Date.now()}`, amount: 1, currency: 'EGP', display: 'en', expireMinutes: 15,
    merchantRedirect: 'https://spculculat-oss.github.io/Sham-Perfume/', description: 'Sham Store key check (not a real order)',
    customer: { email: 'verify@sham-perfume.invalid', reference: 'key-check' }, metaData: { purpose: 'key-check' },
  });
}

try {
  const session = await attempt(cfg.mode);
  note('notice', `Kashier ${cfg.mode}`, `ok — keys work, a ${cfg.mode} payment page opened (${new URL(session.sessionUrl).host}); MID ${mid}`);
  summary(`- Kashier (${cfg.mode}): ✅ keys work`);
  record('ok');
} catch (error) {
  const e = error instanceof KashierError ? error : new KashierError('FAILED', 0);
  let hint = '';
  if (e.status === 401 || e.status === 403 || e.code === 'INVALID_KEYS') {
    // Keys are mode-scoped: tell the owner if they belong to the other mode.
    const other = cfg.mode === 'test' ? 'live' : 'test';
    try { await attempt(other); hint = ` — these keys are ${other.toUpperCase()} keys: set KASHIER_MODE=${other} or copy the ${cfg.mode} keys`; } catch { hint = ' — check that the Payment API Key and the Secret Key were copied from Kashier → Integrate now (same mode as KASHIER_MODE)'; }
  }
  note('error', `Kashier ${cfg.mode}`, `failed: ${e.code} (HTTP ${e.status})${hint}`);
  summary(`- Kashier (${cfg.mode}): ❌ ${e.code} (HTTP ${e.status})${hint}`);
  record(e.status === 0 ? 'unreachable' : 'invalid_key');
}
