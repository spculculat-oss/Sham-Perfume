/**
 * The admin code as the owner actually types it. The server's code is plain Latin (an HTTP header can carry
 * nothing else), so a code typed with the phone keyboard still in Arabic — «شسي» for "asd", «١٢٣» for "123" —
 * could never match, and the browser even refuses to send it. Same for invisible characters a phone slips in
 * when pasting (direction marks, zero-width spaces). This turns what he typed into what he meant:
 *   1. invisible characters out, Arabic-Indic / Persian digits → 0-9;
 *   2. if Arabic letters remain, read them as the keys he pressed on the standard Arabic keyboard (ش → a, ض → q…).
 * «لا» is one key (b) but also ل + ا (g then h), so both readings are offered. Nothing is stored or logged.
 */

const INVISIBLE = /[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;

const DIGITS: Record<string, string> = {};
'٠١٢٣٤٥٦٧٨٩'.split('').forEach((d, i) => { DIGITS[d] = String(i); });
'۰۱۲۳۴۵۶۷۸۹'.split('').forEach((d, i) => { DIGITS[d] = String(i); });

/** Standard Arabic (101) keyboard: the character a key gives in Arabic mode → the Latin character of the same key. */
const KEYS: Record<string, string> = {
  'ض': 'q', 'ص': 'w', 'ث': 'e', 'ق': 'r', 'ف': 't', 'غ': 'y', 'ع': 'u', 'ه': 'i', 'خ': 'o', 'ح': 'p', 'ج': '[', 'د': ']',
  'ش': 'a', 'س': 's', 'ي': 'd', 'ب': 'f', 'ل': 'g', 'ا': 'h', 'ت': 'j', 'ن': 'k', 'م': 'l', 'ك': ';', 'ط': "'",
  'ئ': 'z', 'ء': 'x', 'ؤ': 'c', 'ر': 'v', 'ى': 'n', 'ة': 'm', 'و': ',', 'ز': '.', 'ظ': '/', 'ذ': '`',
  // With Shift.
  'َ': 'Q', 'ً': 'W', 'ُ': 'E', 'ٌ': 'R', 'إ': 'Y', 'ِ': 'A', 'ٍ': 'S', 'أ': 'H', 'ـ': 'J', '،': 'K', '؛': 'P',
  'ْ': 'X', 'آ': 'N', '؟': '?', 'ّ': '~',
};
/** Keys that type two characters at once (Shift + T/G/B and plain B). */
const PAIRS: Record<string, string> = { 'لإ': 'T', 'لأ': 'G', 'لآ': 'B' };

/** Step 1: what can never be part of the code is removed; Arabic digits become 0-9. */
export function plainCode(raw: string | null | undefined): string {
  return String(raw ?? '').normalize('NFC').replace(INVISIBLE, '').replace(/[٠-٩۰-۹]/g, (d) => DIGITS[d] || d).trim();
}

const hasArabic = (s: string) => /[\u0600-\u06FF]/.test(s);

function fromKeys(s: string, la: 'b' | 'gh'): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const two = s.slice(i, i + 2);
    if (PAIRS[two]) { out += PAIRS[two]; i++; continue; }
    if (two === 'لا') { out += la; i++; continue; }
    out += KEYS[s[i]] ?? s[i];
  }
  return out;
}

/**
 * The codes worth trying, best first (at most 2). A code that still holds Arabic letters is never sent as is —
 * it cannot match and cannot even travel in a header — so no attempt is wasted on it.
 */
export function codeCandidates(raw: string | null | undefined): string[] {
  const plain = plainCode(raw);
  if (!plain) return [];
  if (!hasArabic(plain)) return [plain];
  const found: string[] = [];
  for (const la of ['b', 'gh'] as const) {
    const typed = fromKeys(plain, la);
    if (!hasArabic(typed) && !found.includes(typed)) found.push(typed);
  }
  return found;
}

/** True when the box holds Arabic letters (the keyboard is probably in Arabic) — shown as a hint. */
export const typedInArabic = (raw: string) => /[\u0621-\u064A]/.test(raw);
