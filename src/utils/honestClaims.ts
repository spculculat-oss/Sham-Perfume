/**
 * «مراجع الصفحات» — removes promotional claims nobody can back up from product texts (Shaheen council task #170):
 * how long a perfume lasts (it depends on the skin and the weather), «the best», «irresistible», «100% original»,
 * and the supplier's own shop slogans («Buy … online in UAE now»). The scent itself — notes, family, character —
 * is kept. Pure functions, used when the store shows a product (storeCatalog.mergeProduct) and by the store
 * trainer to send a product back to Shaheen for an honest rewrite. Tested in tests/honestClaims.test.ts.
 */

// ---------- Arabic: the claim phrase goes, the sentence stays ----------
const AR_DROP: RegExp[] = [
  // «… يدوم طويلاً / طوال اليوم / بأناقة» · «ليدوم طويلاً طوال اليوم»
  /\s*(?:لي|لت|ي|ت)دوم(?:\s+(?:طويلاً|طويلا|طوال\s+اليوم|بأناقة|لساعات(?:\s+طويلة)?))*(?=[\s.،!؟]|$)/gu,
  // «وثباتاً رائعاً» · «والثبات الطويل» · «لثبات طويل ومميز» · «ثباتاً طويلاً و»
  /\s*و?(?:ب|ل)?(?:ال)?ثبات(?:اً|ا)?\s+(?:ال)?(?:طويل(?:اً|ا)?|رائع(?:اً|ا)?|عال(?:ٍ|ي)?|قوي(?:اً|ا)?|ممتاز(?:اً|ا)?|عميق)(?:\s+و?مميز)?/gu,
  // «فائق الثبات» · «وفائق الثبات»
  /\s*و?فائق\s+الثبات/gu,
  // «بالقوة والثبات والأناقة» → «بالقوة والأناقة»
  /\s+والثبات(?=[\s.،]|$)/gu,
  // «طوال اليوم» / «لساعات طويلة» as a promise
  /\s*(?:طوال\s+اليوم|لساعات\s+طويلة|طوال\s+ساعات\s+[^\s.،]+(?:\s+و[^\s.،]+)?)(?!\s+وال)(?=[\s.،!؟]|$)/gu,
  /\s*(?:في\s+)?مزيج\s+لا\s+يقاوم/gu,
  /\s*لا\s+(?:يقاوم|يُقاوم|تقاوم|تُقاوم)/gu,
  /\s*(?:ال)?أصلي\s*100\s*[%٪]/gu,
  /\s*(?:وأناقة|و?جاذبية)\s+لا\s+تُنسى/gu,
];
const AR_SOFTEN: [RegExp, string][] = [
  [/(?:ال)?أكثر\s+مبيعاً?/gu, 'رائج'],
  [/من\s+أفضل\s+/gu, 'من '],
  [/(^|[\s(])أفضل\s+/gu, '$1'],
  [/(?:ال)?مثالياً/gu, 'مناسباً'],
  [/المثالية/gu, 'المناسبة'],
  [/المثالي/gu, 'المناسب'],
  [/مثالية/gu, 'مناسبة'],
  [/مثالي/gu, 'مناسب'],
  // «ليعطيك إحساساً.» — what was left once «يدوم طوال اليوم» went.
  [/\s*(?:ليعطيك|ليمنحك|يعطيك|يمنحك|تمنحك)\s+(?:إحساساً|شعوراً)(?=\s*[.،!؟]|$)/gu, ''],
];

// ---------- English (the supplier's text) ----------
// A shop slogan goes as a whole sentence; a claim inside a scent description loses only its words.
const EN_DROP_SENTENCE = /^\s*(?:shop|buy|order|try)\b|\b(?:the\s+best|best\s+(?:perfumes?|fragrances?|scents?|perfume\s+oils?)|top\s+\d+|number\s+one|#\s?1\b|guarantee[ds]?|100\s*%\s*(?:original|authentic|genuine)|(?:buy|shop|order)\b[^.?!\n]*\b(?:online|now|today))/i;
type Swap = [RegExp, string | ((match: string, ...groups: string[]) => string)];
/** «Perfect for» at the start of a sentence stays capitalised. */
const keepCase = (to: string) => (m: string, ...g: string[]) => {
  const out = to.replace(/\$(\d)/g, (_, n: string) => g[Number(n) - 1] || '');
  return /^[A-Z]/.test(m.trim()) ? out.charAt(0).toUpperCase() + out.slice(1) : out;
};
const EN_SOFTEN: Swap[] = [
  [/\s+in\s+(?:the\s+)?(?:UAE|Dubai|Malaysia)\b/gi, ''],
  [/,?\s+(?:with|for|and)\s+(?:a\s+|its\s+)?long[- ]?lasting\s+(?:depth|wear|trail|performance|finish|sillage|projection|impression|presence|appeal)\b/gi, ''],
  [/,?\s*(?:that|which)?\s*(?:lasts?|lingers?|stays?|endures?)\s+(?:\w+ly\s+)?(?:all\s+day(?:\s+long)?|for\s+hours|up\s+to\s+\d+\s*hours?|\d+\s*\+?\s*hours?|from\s+day\s+(?:to|into)\s+night)/gi, ''],
  [/\s+and\s+long[- ]?lasting\s+/gi, ' and '],
  [/\blong[- ]?lasting\s+and\s+/gi, ''],
  [/\s*[—–-]\s*long[- ]?lasting\b/gi, ''],
  [/\blong[- ]?lasting\s+/gi, ''],
  [/\bbest[- ]?sell(?:er|ing)\s*/gi, ''],
  [/\birresistibl([ey])\b/gi, (m: string, e: string) => keepCase(e === 'y' ? 'invitingly' : 'inviting')(m)],
  [/\bthe\s+perfect\s+/gi, keepCase('a fitting ')],
  [/\ba\s+perfect\s+/gi, keepCase('a fitting ')],
  [/\bperfect(?:ly)?\s+(for|to)\b/gi, keepCase('suited $1')],
  [/\bperfect\s+choice\b/gi, keepCase('fitting choice')],
];

const tidy = (s: string) => s
  .replace(/\s+([،,.!؟?])/g, '$1')
  .replace(/([،,])\s*([.!؟?])/g, '$2')
  .replace(/(^|[.!؟?]\s*)[،,]\s*/g, '$1')
  .replace(/\s+و(?=[.،!؟]|$)/gu, '')
  .replace(/(يمنحك|تمنحك|يمنح العطر|تمنح العطر|يضفي|تضفي)\s+و/gu, '$1 ')
  .replace(/[ \t]{2,}/g, ' ')
  .trim();

/** Sentences, keeping the line breaks of the supplier's text (notes lists, Q/A lines). */
const sentences = (line: string) => line.match(/[^.!?؟]+(?:[.!?؟]+|$)/g) || [];

/** The same text without unsupported promotional claims (`''` when nothing but claims was left). */
export function stripClaims(text: string | undefined, lang: 'ar' | 'en' | string): string {
  const source = String(text || '');
  if (!source.trim()) return '';
  if (lang === 'ar' || /[\u0600-\u06FF]/.test(source) && !/[A-Za-z]{4,}/.test(source)) {
    let out = source;
    for (const re of AR_DROP) out = out.replace(re, '');
    for (const [re, to] of AR_SOFTEN) out = out.replace(re, to);
    // A sentence left with no words worth reading («يمنحك.») goes.
    return tidy(sentences(out).filter((s) => s.replace(/[^\p{L}]/gu, '').length > 8).join(' '));
  }
  const lines = source.split('\n').map((line) => {
    const kept = sentences(line).filter((s) => !EN_DROP_SENTENCE.test(s));
    let out = kept.join('').trim();
    for (const [re, to] of EN_SOFTEN) out = typeof to === 'string' ? out.replace(re, to) : out.replace(re, to);
    return tidy(out);
  });
  return lines.filter(Boolean).join('\n').trim();
}

/** Does the text still carry a claim the store must not make? (the store trainer sends it back to Shaheen). */
export function hasClaims(text: string | undefined, lang: 'ar' | 'en' | string): boolean {
  const source = String(text || '').trim();
  return Boolean(source) && stripClaims(source, lang) !== tidy(source);
}

/**
 * The supplier's description as a reader can follow it: sections the shop glued together
 * («LemonHeart Notes:», «…wear?A: Yes») get their own line again. Nothing is added or removed.
 */
export const tidySupplierText = (text: string) => String(text || '')
  .replace(/([a-z0-9)\]])((?:Top|Heart|Middle|Base)\s+Notes?\s*:)/g, '$1\n$2')
  .replace(/([?.!])\s*([QA]:\s)/g, '$1\n$2')
  .replace(/\n{3,}/g, '\n\n');
