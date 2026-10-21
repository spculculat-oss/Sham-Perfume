/**
 * Checks «رمز خريطة التشغيل» in the browser against the salted hash the Pages build received (scripts/ci/ops-code-hash.mjs).
 * Spec: `v1:<iterations>:<salt base64url>:<hash base64url>` (PBKDF2-SHA256, 32 bytes).
 */
export interface OpsCodeSpec { iterations: number; salt: Uint8Array; hash: Uint8Array; raw: string }

const fromB64url = (s: string): Uint8Array => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

export function parseOpsCode(raw: unknown): OpsCodeSpec | undefined {
  if (typeof raw !== 'string') return undefined;
  const m = raw.trim().match(/^v1:(\d{5,7}):([A-Za-z0-9_-]{16,}):([A-Za-z0-9_-]{40,})$/);
  if (!m) return undefined;
  try {
    const hash = fromB64url(m[3]);
    return hash.length === 32 ? { iterations: Number(m[1]), salt: fromB64url(m[2]), hash, raw: raw.trim() } : undefined;
  } catch { return undefined; }
}

/** The map code of this build (undefined when the owner has not set SHAM_OPS_CODE). */
export const OPS_CODE = parseOpsCode(import.meta.env?.VITE_OPS_CODE);

export async function verifyOpsCode(code: string, spec: OpsCodeSpec | undefined = OPS_CODE): Promise<boolean> {
  const subtle = globalThis.crypto?.subtle;
  if (!spec || !subtle || !code.trim()) return false;
  const key = await subtle.importKey('raw', new TextEncoder().encode(code.trim().normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: spec.salt as BufferSource, iterations: spec.iterations }, key, 256));
  let diff = 0;
  for (let i = 0; i < 32; i++) diff |= bits[i] ^ spec.hash[i];
  return diff === 0;
}
