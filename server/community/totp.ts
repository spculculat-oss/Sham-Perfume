/**
 * «مجتمع شام» — TOTP two-factor (RFC 6238, SHA-1, 6 digits, 30-second steps).
 *
 * The same standard Google Authenticator and Meta's authentication apps generate, so a member who
 * enables it here can use any common authenticator app. The secret is stored encrypted with the
 * community vault; only its hash-verified codes ever reach the database. To stop replaying an already
 * accepted code, the account keeps the last accepted counter (`totp_last`).
 */
import { createHmac, randomBytes } from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** 20 random bytes → 32-character base32 (RFC 4648, no padding). */
export function newTotpSecret(): string {
  const bytes = randomBytes(20);
  let bits = 0, value = 0, out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits) out += B32[(value << (5 - bits)) & 31];
  return out.slice(0, 32);
}

function base32Decode(text: string): Buffer {
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of text.toUpperCase().replace(/=+$/, '')) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

/** The 6-digit code for a counter (counter = unixTime / 30). */
export function totpCode(secret: string, counter: number): string {
  try {
    const msg = Buffer.alloc(8); // big-endian 64-bit counter
    msg.writeUInt32BE(Math.floor(counter / 4294967296), 0);
    msg.writeUInt32BE(counter >>> 0, 4);
    const hmac = createHmac('sha1', base32Decode(secret)).update(msg).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const value = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
    return String(value % 10 ** 6).padStart(6, '0');
  } catch { return ''; }
}

export const totpCounter = (nowMs: number = Date.now()) => Math.floor(nowMs / 30_000);

/**
 * Verify a 6-digit code with a one-step window (59 seconds of tolerance). `last` is the base36 string
 * of the last accepted counter; counters at or below it are rejected (replay protection).
 */
export function verifyTotp(secret: string, code: string, last = ''): { ok: boolean; counter: number } {
  const digits = String(code || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(digits)) return { ok: false, counter: 0 };
  const lastCounter = Number.parseInt(last, 36) || 0;
  const now = totpCounter();
  for (let c = now - 1; c <= now + 1; c++) {
    if (c <= lastCounter) continue;
    if (totpCode(secret, c) === digits) return { ok: true, counter: c };
  }
  return { ok: false, counter: 0 };
}

/** `otpauth://totp/Sham%20Perfume:handle?secret=…&issuer=Sham%20Perfume` — what the app scans/enters. */
export function otpauthUri(handle: string, secret: string): string {
  return `otpauth://totp/Sham%20Perfume:${encodeURIComponent(handle)}?secret=${secret}&issuer=Sham%20Perfume&algorithm=SHA1&digits=6&period=30`;
}
