/**
 * «رمز خريطة التشغيل» — the Pages build cannot ask a server, so the management map checks its own code in the browser.
 * The owner stores the code once as the GitHub Actions secret SHAM_OPS_CODE (12+ characters; never in the repo). This
 * step turns it into a slow salted hash (PBKDF2-SHA256, 310 000 rounds, a fresh salt every build) and hands only that
 * to the build as VITE_OPS_CODE. The code itself is never printed, written or bundled. It is a separate code from
 * SHAM_ADMIN_TOKEN on purpose: the hash is public in the bundle, so it must never be the key of the server's admin API.
 */
import { appendFileSync } from 'node:fs';
import { pbkdf2Sync, randomBytes } from 'node:crypto';

export const ITERATIONS = 310_000;
export function opsCodeSpec(code, salt = randomBytes(16)) {
  const hash = pbkdf2Sync(code.normalize('NFC'), salt, ITERATIONS, 32, 'sha256');
  return `v1:${ITERATIONS}:${salt.toString('base64url')}:${hash.toString('base64url')}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const code = (process.env.SHAM_OPS_CODE || '').trim();
  if (code.length < 12) {
    console.log(`::notice title=Operations map code::${code ? 'SHAM_OPS_CODE is shorter than 12 characters — ignored' : 'SHAM_OPS_CODE is not set'}; the map opens only with the server admin code.`);
  } else if (process.env.GITHUB_ENV) {
    appendFileSync(process.env.GITHUB_ENV, `VITE_OPS_CODE=${opsCodeSpec(code)}\n`);
    console.log('Operations map code: hashed for this build.');
  }
}
