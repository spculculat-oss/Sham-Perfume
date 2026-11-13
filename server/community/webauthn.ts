/**
 * «مجتمع شام» — passkeys (WebAuthn), without any external library.
 *
 * The direction Google and Meta are moving their accounts (and Apple already does it on its own
 * devices): a credential the device itself signs with — fingerprint, face, or device PIN. The
 * private key never leaves the device; the server keeps only the public key (raw COSE bytes) and
 * verifies every answer with `node:crypto`.
 *
 * Supported: attestation formats `none` (self-attestation, the modern default) and `fido.u2f`
 * (legacy U2F tokens); public keys ES256 (P-256) and RS256; one-time 60-second challenges; the
 * origin is checked against an allow-list (the site is on GitHub Pages, the API on Vercel — the
 * browser's origin is what WebAuthn trusts, not the API's host).
 */
import { createHash, createPublicKey, createVerify, randomBytes, type KeyObject } from 'node:crypto';

const sha256 = (data: Buffer): Buffer => createHash('sha256').update(data).digest();

type Env = Record<string, string | undefined>;

/* --------------------------------------------- CBOR (minimal) ---------------------------------------------
 * Only the shapes COSE keys and attestation objects use: unsigned/negative integers, byte strings,
 * text strings and maps. Anything else is refused. */

type CoseValue = number | string | Buffer;
export type CoseMap = Record<string, CoseValue>;
type Decoded = CoseValue | CoseMap;

export function cborDecode(buf: Buffer): CoseMap {
  let pos = 0;
  const read = (n: number): Buffer => {
    if (pos + n > buf.length) throw new Error('cbor: truncated');
    const out = buf.subarray(pos, pos + n); pos += n; return out;
  };
  const head = (info: number): number => {
    if (info < 24) return info;
    if (info === 24) return read(1)[0];
    if (info === 25) return read(2).readUInt16BE(0);
    if (info === 26) return read(4).readUInt32BE(0);
    throw new Error('cbor: unsupported length');
  };
  const decode = (): Decoded => {
    const initial = read(1)[0];
    const major = initial >> 5; const info = initial & 0x1f;
    if (major === 0) return head(info);
    if (major === 1) return -1 - head(info);
    if (major === 2) return read(head(info));
    if (major === 3) return read(head(info)).toString('utf8');
    if (major === 5) {
      const n = head(info);
      if (n > 64) throw new Error('cbor: map too large');
      const map: CoseMap = {};
      for (let i = 0; i < n; i++) {
        const key = decode();
        const value = decode() as CoseValue;
        const k = typeof key === 'number' ? String(key) : (typeof key === 'string' ? key : String(key));
        map[k] = value;
      }
      return map;
    }
    throw new Error('cbor: unsupported type');
  };
  const value = decode();
  if (typeof value !== 'object' || value === null || Buffer.isBuffer(value)) throw new Error('cbor: expected map');
  return value as CoseMap;
}

/* --------------------------------------------- COSE public keys --------------------------------------------- */

/** COSE key (decoded map) → node:crypto public key + algorithm (-7 ES256, -257 RS256). */
export function coseToPublicKey(cose: CoseMap): { key: KeyObject; alg: number } {
  const kty = Number(cose['1']);
  const alg = Number(cose['-1'] ?? -7);
  if (kty === 2) {
    const x = cose['3']; const y = cose['4'];
    if (!Buffer.isBuffer(x) || !Buffer.isBuffer(y)) throw new Error('cose: bad EC key');
    return { key: createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: x.toString('base64url'), y: y.toString('base64url') }, format: 'jwk' }), alg: alg || -7 };
  }
  if (kty === 3) {
    const n = cose['-2']; const e = cose['-3'];
    if (!Buffer.isBuffer(n) || !Buffer.isBuffer(e)) throw new Error('cose: bad RSA key');
    return { key: createPublicKey({ key: { kty: 'RSA', n: n.toString('base64url'), e: e.toString('base64url') }, format: 'jwk' }), alg: alg || -257 };
  }
  throw new Error('cose: unsupported key type');
}

/* --------------------------------------------- origin & rp id --------------------------------------------- */

/**
 * The origins a challenge may answer from. Production: the GitHub Pages site (+ anything the
 * administration adds through SHAM_WEBAUTHN_ORIGINS, comma-separated). Local dev & previews add
 * localhost and the sandbox host.
 */
export function originAllowed(origin: string, env: Env): boolean {
  const o = String(origin || '').trim().toLowerCase();
  if (!o) return false;
  const list = new Set<string>([
    'https://spculculat-oss.github.io',
    ...String(env.SHAM_WEBAUTHN_ORIGINS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  ]);
  if (list.has(o)) return true;
  if (!env.VERCEL && !env.SHAM_SERVERLESS) {
    if (o === 'http://localhost:3000' || o === 'http://127.0.0.1:3000' || o === 'http://localhost:5173') return true;
    if (o.endsWith('.e2b.app')) return true; // live preview sandbox
  }
  return false;
}

export const rpIdOf = (env: Env) => String(env.SHAM_WEBAUTHN_RPID || '').trim() || 'spculculat-oss.github.io';

/* --------------------------------------------- authenticator data --------------------------------------------- */

const FLAG_UP = 0x01; // user presence
const FLAG_UV = 0x08; // user verified (biometric / PIN)
const FLAG_AT = 0x04; // attested credential data follows (create only)

export function parseAuthData(buf: Buffer): { flags: number; signCount: number; credId: Buffer | null; pubKey: CoseMap | null } {
  if (buf.length < 37) throw new Error('authData: too short');
  const flags = buf[32];
  const signCount = buf.readUInt32BE(33);
  if (!(flags & FLAG_AT)) return { flags, signCount, credId: null, pubKey: null };
  const credIdLen = buf.readUInt16BE(53);
  if (55 + credIdLen > buf.length) throw new Error('authData: truncated credential');
  const credId = buf.subarray(55, 55 + credIdLen);
  const pubKey = cborDecode(buf.subarray(55 + credIdLen));
  return { flags, signCount, credId, pubKey };
}

/* --------------------------------------------- verification --------------------------------------------- */

function checkClientData(clientDataJson: Buffer, type: string, challenge: string, env: Env): void {
  let clientData: { type?: unknown; challenge?: unknown; origin?: unknown; crossOrigin?: unknown };
  try { clientData = JSON.parse(clientDataJson.toString('utf8')); } catch { throw new Error('clientData: bad json'); }
  if (clientData.type !== type) throw new Error('clientData: wrong type');
  if (clientData.challenge !== challenge) throw new Error('clientData: wrong challenge');
  if (!originAllowed(String(clientData.origin || ''), env)) throw new Error('clientData: origin not allowed');
  if (clientData.crossOrigin === true) throw new Error('clientData: cross-origin');
}

/** Verify a `webauthn.create` answer; returns the credential to store. */
export function verifyCreate(
  clientDataJson: Buffer,
  attestationObject: Buffer,
  challenge: string,
  env: Env,
): { credId: Buffer; pubKeyRaw: Buffer; alg: number; signCount: number; uv: boolean } {
  checkClientData(clientDataJson, 'webauthn.create', challenge, env);
  const obj = cborDecode(attestationObject);
  const fmt = String(obj['fmt'] || '');
  const authData = obj['authData'];
  if (!Buffer.isBuffer(authData)) throw new Error('attestation: bad authData');
  const { flags, signCount, credId, pubKey } = parseAuthData(authData);
  if (!(flags & FLAG_UP)) throw new Error('attestation: no user presence');
  if (!credId || !pubKey) throw new Error('attestation: no credential');
  const cose = pubKey;
  const { key, alg } = coseToPublicKey(cose);
  if (fmt === 'none') {
    // Self-attestation: the public key is the credential — the structure check above is enough.
  } else if (fmt === 'fido.u2f') {
    const sig = (obj['attStmt'] as unknown as CoseMap | undefined)?.['sig'];
    if (!Buffer.isBuffer(sig)) throw new Error('u2f: missing signature');
    const x = cose['3']; const y = cose['4'];
    if (!Buffer.isBuffer(x) || !Buffer.isBuffer(y)) throw new Error('u2f: bad key');
    const data = Buffer.concat([Buffer.from([0]), authData.subarray(0, 32), sha256(clientDataJson), credId, x, y]);
    const v = createVerify('sha256'); v.update(data);
    if (!v.verify(key, sig)) throw new Error('u2f: signature mismatch');
  } else {
    throw new Error('attestation: unsupported format');
  }
  return { credId, pubKeyRaw: pubKeyRawOf(authData, credId), alg, signCount, uv: Boolean(flags & FLAG_UV) };
}

/** The raw COSE bytes inside the authenticator data (what the server stores). */
function pubKeyRawOf(authData: Buffer, credId: Buffer): Buffer {
  const start = 55 + credId.length; // rpIdHash(32) flags(1) signCount(4) aaguid(16) credIdLen(2) credId(n)
  if (start >= authData.length) throw new Error('authData: truncated public key');
  return Buffer.from(authData.subarray(start));
}

/** Verify a `webauthn.get` answer against a stored public key. */
export function verifyAssert(
  clientDataJson: Buffer,
  response: { authenticatorData: Buffer; signature: Buffer },
  challenge: string,
  pubKey: KeyObject,
  env: Env,
): { signCount: number; uv: boolean } {
  checkClientData(clientDataJson, 'webauthn.get', challenge, env);
  const ad = response.authenticatorData;
  if (ad.length < 37) throw new Error('assert: bad authData');
  const flags = ad[32];
  if (!(flags & FLAG_UP)) throw new Error('assert: no user presence');
  const v = createVerify('sha256');
  v.update(Buffer.concat([ad, sha256(clientDataJson)]));
  if (!v.verify(pubKey, response.signature)) throw new Error('assert: signature mismatch');
  return { signCount: ad.readUInt32BE(33), uv: Boolean(flags & FLAG_UV) };
}

/** A fresh one-time challenge (60 seconds). */
export const newChallenge = () => randomBytes(32).toString('base64url');
