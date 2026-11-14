/**
 * The admin code as saved in Vercel (SHAM_ADMIN_TOKEN), read the way the owner meant it. Pasting it into the
 * Environment Variables box often brings extras that silently turned every sign-in into «wrong code»:
 * surrounding quotes ("abc…" or 'abc…'), the whole line (SHAM_ADMIN_TOKEN=abc…), or an invisible direction mark
 * from a phone. None of these can be part of a real code, so they are dropped here. The value is never logged.
 */
const INVISIBLE = /[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;

export function adminSecret(env: { SHAM_ADMIN_TOKEN?: string }): string {
  let v = String(env.SHAM_ADMIN_TOKEN ?? '').replace(INVISIBLE, '').trim();
  v = v.replace(/^(?:export\s+)?SHAM_ADMIN_TOKEN\s*=\s*/, '').trim();
  const q = v[0];
  if (v.length >= 2 && (q === '"' || q === "'" || q === '`') && v[v.length - 1] === q) v = v.slice(1, -1).trim();
  return v;
}
