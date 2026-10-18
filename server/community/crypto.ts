/**
 * «مجتمع شام» — the security layer.
 *
 *  - Passwords: scrypt (N=2^15, r=8, p=1) with a per-user salt; compared in constant time. Never stored,
 *    never logged, never returned.
 *  - Sessions: 256-bit random tokens; only their SHA-256 is stored, so a database leak cannot be replayed.
 *  - Private data (e-mail, phone, addresses, payout details, merchants' source links, every message):
 *    AES-256-GCM with a key that exists only on the server (`SHAM_DATA_KEY`, any long secret phrase). The
 *    database holds ciphertext; the administration reads it through the admin API, nobody else.
 *  - Look-ups on encrypted fields (log in by e-mail) use a keyed HMAC "blind index", not the plaintext.
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';

const scrypt = (password: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number; maxmem: number }) =>
  new Promise<Buffer>((done, fail) => scryptCb(password, salt, keylen, opts, (error, key) => (error ? fail(error) : done(key))));

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, 32, SCRYPT);
  return `scrypt$${SCRYPT.N}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const key = await scrypt(password.normalize('NFKC'), Buffer.from(salt, 'base64url'), expected.length, { ...SCRYPT, N: Number(n) || SCRYPT.N });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** A fresh session token (sent to the browser once) and the hash kept in the database. */
export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: tokenHash(token) };
}
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('base64url');

/** Short random ids: `u_…`, `p_…`, `m_…` (URL-safe, not guessable). */
export const newId = (prefix: string) => `${prefix}_${randomBytes(12).toString('base64url')}`;

export class Vault {
  private key: Buffer;
  private indexKey: Buffer;
  /** `secret`: SHAM_DATA_KEY — a long random phrase; the AES key is derived from it. */
  constructor(secret: string) {
    if (!secret || secret.trim().length < 24) throw new Error('SHAM_DATA_KEY must be at least 24 characters');
    const root = createHash('sha512').update(`sham-community-v1|${secret.trim()}`).digest();
    this.key = root.subarray(0, 32);
    this.indexKey = root.subarray(32, 64);
  }

  /** `v1.<iv>.<tag>.<ciphertext>` (base64url). Empty / missing values stay empty. */
  seal(plain: string | undefined | null): string | null {
    if (plain === undefined || plain === null || plain === '') return null;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
    return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${data.toString('base64url')}`;
  }

  open(sealed: string | undefined | null): string {
    if (!sealed) return '';
    const [version, iv, tag, data] = sealed.split('.');
    if (version !== 'v1' || !iv || !tag || data === undefined) return '';
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
    } catch {
      return ''; // tampered or written with another key
    }
  }

  sealJson(value: unknown): string | null { return value === undefined || value === null ? null : this.seal(JSON.stringify(value)); }
  openJson<T>(sealed: string | undefined | null, fallback: T): T {
    const text = this.open(sealed);
    if (!text) return fallback;
    try { return JSON.parse(text) as T; } catch { return fallback; }
  }

  /** Deterministic keyed index for exact look-ups (e-mail, phone) without storing them in clear. */
  index(value: string): string {
    return createHmac('sha256', this.indexKey).update(value.trim().toLowerCase()).digest('base64url');
  }
}
