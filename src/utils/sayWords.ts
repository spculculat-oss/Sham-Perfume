/**
 * «شاهين بيتعلم النطق من الناس» — the owner's request (2026-11-14): the human voice must be flexible and learn how
 * words are said from the people who talk to it. No visitor's audio is ever recorded or sent anywhere (his own rule):
 * Shaheen learns from what the visitor SAYS to correct him, as text:
 *
 *   «لا، اسمها شانيل مش تشانيل»   «كركدجيان بتتنطق كوركجان»   «Kurkdjian is pronounced kur-jan»
 *
 * The pair (written → said) is used at once on this device, and sent (no visitor id) to the server, which shares it
 * with every visitor only after several people taught the same thing (server/voiceSpeak.ts). Before any line is
 * spoken — by the human voice or the device's — the learned pairs are applied (applySayWords).
 *
 * Shared by the browser and the server: no DOM here.
 */
import type { SupportedLanguage } from '../types/i18n';
import type { Dialect } from './arabicDialect';
import { heardDistance } from './heardFix';

/** written word(s) → how to say them (in the letters the voice reads best). */
export type SayWords = Record<string, string>;
export interface SayPair { from: string; to: string }

const WORDS = 4;
const fold = (text: string) => text.normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[«»"“”„'‘’]/g, '').replace(/\s+/g, ' ').trim();
/** The key a pair is stored under: lower case, no short vowels or quotes. */
export const sayKey = (text: string) => fold(text).toLocaleLowerCase();

const LATIN = /\p{Script=Latin}/u;
/** Letter edit distance (for words of up to 40 letters). */
function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length]!;
}
/**
 * A pronunciation, not a different word: written in Latin and said in another script (a guide to how a name sounds),
 * or close in spelling («تشانيل» → «شانيل»). «مسك مش عود» is a different perfume, never «how مسك is said».
 */
function soundsAlike(a: string, b: string): boolean {
  if (LATIN.test(a) !== LATIN.test(b)) return true;
  const x = sayKey(a).replace(/[\s'-]/g, ''); const y = sayKey(b).replace(/[\s'-]/g, '');
  return distance(x, y) <= Math.max(2, Math.round(Math.max(x.length, y.length) * 0.45));
}

/** A pair worth keeping: 1–4 real words each (letters, hyphens, apostrophes), no digits or links, not the same. */
export function cleanSayPair(from: unknown, to: unknown): SayPair | undefined {
  if (typeof from !== 'string' || typeof to !== 'string') return undefined;
  const a = fold(from).replace(/^[\s،,:.!?؟-]+|[\s،,:.!?؟-]+$/gu, '');
  const b = fold(to).replace(/^[\s،,:.!?؟]+|[\s،,:.!?؟]+$/gu, '');
  const ok = (s: string) => s.length >= 2 && s.length <= 40 && s.split(' ').length <= WORDS && /^[\p{L}\p{M}' -]+$/u.test(s) && /\p{L}/u.test(s);
  if (!ok(a) || !ok(b) || sayKey(a) === sayKey(b) || !soundsAlike(a, b)) return undefined;
  return { from: a, to: b };
}

const W = String.raw`([\p{L}\p{M}'-]+(?: [\p{L}\p{M}'-]+){0,3})`;
const NO = String.raw`(?:لا|لأ|لاء|no|non|nein|нет|hayır|نه)?[\s،,.!]*`;
const AR_SAID = 'بتتنطق|بيتنطق|تتنطق|يتنطق|بتتقري|بتتقرا|بتتقال|بيتقال|نطقها|نطقه|نطقها كده|بتتقرأ';
const AR_SAY = 'اسمها|اسمه|قولها|قوله|انطقها|انطقه|نطقها|نطقه|بتتنطق|بيتنطق';
/** The ways people correct a pronunciation, in every site language: [pattern, which group is written, which is said]. */
const TEACH: readonly [RegExp, 1 | 2, 1 | 2][] = [
  // «اسمها شانيل مش تشانيل» / «قولها شانيل مش تشانيل»
  [new RegExp(`^${NO}(?:${AR_SAY})\\s+${W}\\s+(?:مش|وليس|ليس|مو|موش|ماشي)\\s+${W}$`, 'iu'), 2, 1],
  // «مش تشانيل، اسمها شانيل»
  [new RegExp(`^${NO}(?:مش|ليس|مو|موش)\\s+${W}[\\s،,]+(?:${AR_SAY}|هي|هو)\\s+${W}$`, 'iu'), 1, 2],
  // «كركدجيان بتتنطق كوركجان»
  [new RegExp(`^${W}\\s+(?:${AR_SAID})\\s+${W}$`, 'iu'), 1, 2],
  // «انطق كركدجيان كده: كوركجان»
  [new RegExp(`^(?:انطق|قول)\\s+${W}\\s+(?:كده|كدا|كدة|كذا|هيك)[\\s:،,]+${W}$`, 'iu'), 1, 2],
  // English
  [new RegExp(`^${NO}${W}\\s+is\\s+(?:pronounced|said)(?:\\s+like)?\\s+${W}$`, 'iu'), 1, 2],
  [new RegExp(`^(?:say|pronounce)\\s+${W}\\s+(?:as|like)\\s+${W}$`, 'iu'), 1, 2],
  [new RegExp(`^${NO}not\\s+${W}[\\s,]+(?:it's|it is|say)\\s+${W}$`, 'iu'), 1, 2],
  // French / Spanish / Italian
  [new RegExp(`^${NO}${W}\\s+(?:se prononce|se pronuncia|si pronuncia)\\s+${W}$`, 'iu'), 1, 2],
  // German
  [new RegExp(`^${NO}${W}\\s+(?:spricht man|wird)\\s+${W}\\s+(?:aus|ausgesprochen)$`, 'iu'), 1, 2],
  // Russian
  [new RegExp(`^${NO}${W}\\s+(?:произносится|читается)\\s+${W}$`, 'iu'), 1, 2],
  // Turkish
  [new RegExp(`^${NO}${W}\\s+${W}\\s+(?:diye okunur|diye telaffuz edilir|olarak okunur)$`, 'iu'), 1, 2],
  // Persian
  [new RegExp(`^${NO}${W}\\s+(?:تلفظش|تلفظ میشه|خونده میشه|خوانده می‌شود)\\s+${W}$`, 'iu'), 1, 2],
];
const ZH = /^(.{1,20}?)(?:读作|念作|读成|念成)(.{1,20})$/u;

/** A visitor teaching how a word is said, or undefined (anything else he says is left alone). */
export function teachingPair(said: string): SayPair | undefined {
  const text = fold(said).replace(/[.!?؟。]+$/u, '').trim();
  if (!text || text.length > 120) return undefined;
  const zh = ZH.exec(text);
  if (zh) return cleanSayPair(zh[1], zh[2]);
  for (const [pattern, from, to] of TEACH) {
    const m = pattern.exec(text);
    if (m) return cleanSayPair(m[from], m[to]);
  }
  return undefined;
}

/**
 * The word he meant in what Shaheen just said: the visitor repeats the word the way he HEARD it («كركجيان»), which is
 * rarely exactly how it is written in the reply («كركدجيان»). The closest same-length phrase of the reply is taken
 * (sound-alike letters cost less); if nothing in the reply is close, the pair is kept as he said it.
 */
export function anchorPair(pair: SayPair, lastReply: string): SayPair {
  const reply = fold(lastReply).replace(/[^\p{L}\p{M}' -]+/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!reply) return pair;
  const words = reply.split(' ');
  const size = pair.from.split(' ').length;
  const target = sayKey(pair.from);
  let best: { text: string; cost: number } | undefined;
  for (let i = 0; i + size <= words.length; i += 1) {
    const text = words.slice(i, i + size).join(' ');
    const key = sayKey(text);
    if (key === target) return pair;
    if (LATIN.test(key) !== LATIN.test(target)) continue;
    const cost = heardDistance(target, key);
    if (!best || cost < best.cost) best = { text, cost };
  }
  if (!best || best.cost > Math.max(1.5, target.length * 0.35)) return pair;
  return cleanSayPair(best.text, pair.to) || pair;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The line with every learned word said the taught way (whole words only, the longest first). */
export function applySayWords(text: string, words: SayWords): string {
  const pairs = Object.entries(words).map(([from, to]) => cleanSayPair(from, to)).filter((p): p is SayPair => Boolean(p));
  if (!text || !pairs.length) return text;
  pairs.sort((a, b) => b.from.length - a.from.length);
  const by = new Map(pairs.map((p) => [sayKey(p.from), p.to]));
  const pattern = new RegExp(`(?<![\\p{L}\\p{M}])(?:${pairs.map((p) => escape(p.from).replace(/ /g, '\\s+')).join('|')})(?![\\p{L}\\p{M}])`, 'giu');
  return text.replace(pattern, (hit) => by.get(sayKey(hit)) ?? hit);
}

/** Two lists together: the visitor's own pairs win over the shared ones. */
export const mergeSayWords = (shared: SayWords, own: SayWords): SayWords => {
  const out: SayWords = {};
  for (const [from, to] of [...Object.entries(shared), ...Object.entries(own)]) {
    const pair = cleanSayPair(from, to);
    if (pair) out[sayKey(pair.from)] = pair.to;
  }
  return out;
};

type Lines = Partial<Record<Dialect | SupportedLanguage, (word: string) => string>>;
const LEARNED: Lines = {
  egyptian: (w) => `تمام، اتعلمتها. من هنا ورايح هقولها «${w}».`,
  gulf: (w) => `تمام، تعلمتها. من الحين بقولها «${w}».`,
  levantine: (w) => `تمام، تعلمتها. من هلق رح قولها «${w}».`,
  iraqi: (w) => `تمام، تعلمتها. من هسه راح أكولها «${w}».`,
  maghrebi: (w) => `واخا، تعلمتها. من دابا غادي نقولها «${w}».`,
  sudanese: (w) => `تمام، اتعلمتها. من هسي حأقولها «${w}».`,
  yemeni: (w) => `تمام، تعلمتها. من الآن بقولها «${w}».`,
  msa: (w) => `حسنًا، تعلمتها. من الآن سأنطقها «${w}».`,
  en: (w) => `Got it — from now on I’ll say “${w}”.`,
  fr: (w) => `Compris, désormais je dirai « ${w} ».`,
  es: (w) => `Entendido, a partir de ahora diré «${w}».`,
  it: (w) => `Capito, d’ora in poi dirò «${w}».`,
  de: (w) => `Verstanden, ab jetzt sage ich „${w}“.`,
  ru: (w) => `Понял, теперь буду говорить «${w}».`,
  zh: (w) => `明白了，以后我就读作“${w}”。`,
  tr: (w) => `Anladım, bundan sonra “${w}” diyeceğim.`,
  fa: (w) => `باشه، یاد گرفتم. از این به بعد می‌گویم «${w}».`,
};
/** «تمام، اتعلمتها…» — Shaheen saying back the word the way he was just taught. */
export function learnedLine(language: SupportedLanguage, dialect: Dialect | undefined, word: string): string {
  const line = (language === 'ar' ? LEARNED[dialect || 'egyptian'] || LEARNED.egyptian : LEARNED[language]) || LEARNED.en!;
  return line(word);
}
