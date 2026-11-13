/**
 * «شاهين يتدارك أخطاء الكتابة» — every typed message is read again before Shaheen answers it:
 *   - Arabic typed with the English keyboard on («ugv uk fv» → «عطر عنبر») is converted;
 *   - a word with a missing, extra, doubled or swapped letter becomes the word meant («ياسمبن» → «ياسمين»), and the
 *     visitor sees it under his message: «✍️ فهمت سؤالك كده: «…»», so a wrong guess is visible;
 *   - when a perfume word could be meant but he is not sure («عمبل» — «عنبر»؟), he asks first: «قصدك «عنبر»؟» and waits
 *     for «أيوه» / «لا» (the question goes nowhere: nothing is sent to the server until the visitor answers).
 * Words he does not know and cannot place (names, brands, places) are left exactly as typed. Pure (no DOM, no Node).
 */
import type { SupportedLanguage } from '../types/i18n';
import type { Dialect } from './arabicDialect';
import { confirmAnswer, confirmQuestion, learnablePair } from './heardFix';
import { baseLexicon, keyboardFix, SCENT_WORDS, understandQuestion, withAffix, wordKey, type Lexicon } from './shaheenSpelling';

// ── Keys next to each other on the Arabic keyboard: a finger slipping one key over ───────────────────────────────
const ROWS = ['ضصثقفغعهخحجد', 'شسيبلاتنمكط', 'ئءؤرىةوزظ'];
const KEY_AT = new Map<string, [number, number]>();
ROWS.forEach((row, r) => [...row].forEach((letter, c) => KEY_AT.set(letter, [r, c])));
/** Two keys touching (same row side by side, or the row above/below — each row sits half a key to the right). */
export function keysTouch(a: string, b: string): boolean {
  const p = KEY_AT.get(a); const q = KEY_AT.get(b);
  if (!p || !q || a === b) return false;
  if (p[0] === q[0]) return Math.abs(p[1] - q[1]) === 1;
  const [upper, lower] = p[0] < q[0] ? [p, q] : [q, p];
  if (lower[0] - upper[0] !== 1) return false;
  return lower[1] === upper[1] || lower[1] === upper[1] - 1;
}

const LOOK_ALIKE = ['اأإآ', 'هة', 'يى', 'وؤ', 'زذظ', 'سصث', 'تط', 'دض', 'قك', 'غع', 'خح'];
const alike = (a: string, b: string) => LOOK_ALIKE.some((group) => group.includes(a) && group.includes(b));
/** How far a typed word is from a word: a neighbouring key or a look-alike letter 0.75, any other change 1. */
export function typedDistance(a: string, b: string, otherLetter = 1): number {
  const n = a.length; const m = b.length;
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const x = a[i - 1]!; const y = b[j - 1]!;
      const sub = x === y ? 0 : keysTouch(x, y) || alike(x, y) ? 0.75 : otherLetter;
      // A doubled letter («عنبرر») or a letter typed once instead of twice is a light slip.
      const del = x === a[i - 2] ? 0.5 : 1; const ins = y === b[j - 2] ? 0.5 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + del, d[i]![j - 1]! + ins, d[i - 1]![j - 1]! + sub);
      if (i > 1 && j > 1 && x === b[j - 2] && a[i - 2] === y) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  }
  return d[n]![m]!;
}

const SCENT_KEYS = new Set(SCENT_WORDS.map((word) => wordKey(word)));
const ARTICLE = /^(وال|بال|فال|كال|لل|ال)(?=\p{L}{2,})/u;
const DIALECT_VERB = /^و?(بي|بت|بن|هي|هت|هن)\p{L}{2,}$/u;
/**
 * How close a typed word must be to ask about it: a short word only by finger slips (a neighbouring key, a look-alike
 * letter, a doubled letter — «عمبل» → «عنبر»), since one random letter changed in a short word makes another word.
 */
function closeEnough(key: string, word: string): number | undefined {
  if (key.length <= 4) {
    const slips = typedDistance(key, word, 9);
    return slips <= (key.length <= 3 ? 0.75 : 1.5) ? slips : undefined;
  }
  const distance = typedDistance(key, word);
  return distance <= (key.length <= 6 ? 1.5 : 2) ? distance : undefined;
}
/** A word without its long vowels: «ثابت» and «ثبات» (or «زيوت» and «زيت») are one root in two forms, not a slip. */
export const skeleton = (key: string) => key.replace(/[اويىآأإ]/gu, '');

/** The perfume word a typed word that he does not know may be (only when one is clearly the closest). */
function maybeScent(lex: Lexicon, raw: string): string | undefined {
  const key = wordKey(raw);
  if (key.length < 3 || lex.words.has(key) || withAffix(lex, key) || DIALECT_VERB.test(key) || /[^\u0600-\u06FF]/u.test(key)) return undefined;
  let best: { word: string; distance: number; weight: number }[] = [];
  for (const word of SCENT_KEYS) {
    if (Math.abs(word.length - key.length) > 1 || word.length < 3 || skeleton(word) === skeleton(key)) continue;
    const distance = closeEnough(key, word);
    if (distance === undefined) continue;
    if (!best.length || distance < best[0]!.distance - 1e-9) best = [{ word, distance, weight: lex.words.get(word) || 0 }];
    else if (Math.abs(distance - best[0]!.distance) < 1e-9) best.push({ word, distance, weight: lex.words.get(word) || 0 });
  }
  if (!best.length) return undefined;
  // Just as close: the one starting with the same letter, then the commoner one; still a tie → he does not ask.
  const rank = (b: { word: string; weight: number }) => (b.word[0] === key[0] ? 1000 : 0) + b.weight;
  best.sort((x, y) => rank(y) - rank(x));
  if (best.length > 1 && rank(best[0]!) === rank(best[1]!)) return undefined;
  return best[0]!.word;
}

/** A question Shaheen asked about a typed word («قصدك «عنبر»؟») and is waiting on. */
export interface TypedPending {
  /** The message as typed, with only the sure corrections (sent when he says no). */
  original: string;
  /** The same with the asked word too (sent when he says yes). */
  corrected: string;
  from: string; to: string;
  /** What he typed (the «✍️ فهمت سؤالك كده» line shows when what is sent differs from it). */
  typed: string;
}
export type TypedPlan =
  | { action: 'ask'; say: string; pending: TypedPending }
  | { action: 'send'; text: string; changed: boolean; learn?: { from: string; to: string } };

const NO_WORDS = /^(لا|لأ|لاء|لاا|مش|كده|كدا|قصدي|قصدى|اقصد|أقصد|انا|أنا|no|nope|i|mean|meant|non)$/iu;

/**
 * What to do with a typed message: ask about one unsure perfume word first, or send it with the sure corrections.
 * `pending` = the «قصدك …؟» question he is answering now.
 */
export function planTypedTurn(typed: string, { pending, language, dialect, lexicon = baseLexicon(), learned = {} }: {
  pending?: TypedPending | null; language: SupportedLanguage; dialect?: Dialect; lexicon?: Lexicon;
  /** «شاهين بيتعلم منك»: his own slips he confirmed before (typed word key → the word meant), fixed at once. */
  learned?: Record<string, string>;
}): TypedPlan {
  const clean = typed.replace(/\s+/g, ' ').trim();
  if (pending) {
    const answer = confirmAnswer(clean);
    // «أيوه»: this slip is his — learned, so next time it is fixed without asking.
    if (answer === 'yes') return { action: 'send', text: pending.corrected, changed: true, learn: { from: pending.from, to: pending.to } };
    const sent = (text: string): TypedPlan => ({ action: 'send', text, changed: text !== pending.typed });
    if (answer === 'no') {
      // «لا، عنبر»: the word he meant, typed right after the no.
      const rest = clean.replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter((word) => word && !NO_WORDS.test(word));
      if (rest.length === 1 && rest[0] !== pending.from) {
        return sent(pending.original.replace(pending.from, rest[0]!));
      }
      return sent(pending.original);
    }
    // Neither yes nor no: a new message (the question is dropped).
  }
  // Long texts (a pasted formula, a list) and code are left alone.
  if (!clean || clean.length > 600 || /```|https?:\/\//.test(clean)) return { action: 'send', text: clean, changed: false };
  // His own slips he confirmed before: fixed first (no question this time).
  const ownFixed = Object.keys(learned).length ? clean.split(' ').map((part) => {
    const match = part.match(/^([^\p{L}]*)(\p{L}+)([^\p{L}]*)$/u);
    const meant = match && learned[wordKey(match[2]!)];
    return match && meant ? `${match[1]}${meant}${match[3]}` : part;
  }).join(' ') : clean;
  if (ownFixed !== clean) {
    const rest = planTypedTurn(ownFixed, { language, ...(dialect ? { dialect } : {}), lexicon });
    return rest.action === 'send' ? { ...rest, changed: rest.text !== clean } : { ...rest, pending: { ...rest.pending, typed: clean } };
  }
  const understood = understandQuestion(clean, lexicon);
  // A right word with «ب/و/ل…» before it or a pronoun after it («بريحة»، «عندكم») is not a typo: kept as typed.
  let text = (understood.keyboard ? keyboardFix(clean, lexicon) ?? understood.text : clean).replace(/\s+/g, ' ').trim();
  for (const fix of understood.fixes) {
    if (fix.how === 'letters' && withAffix(lexicon, wordKey(fix.from))) continue;
    text = text.replace(fix.from, fix.to);
  }
  // Only Arabic gets the «قصدك؟» question (his perfume words are written in Arabic).
  if (language === 'ar' || /[\u0600-\u06FF]/.test(text)) {
    const words = text.split(' ');
    for (let index = 0; index < words.length; index += 1) {
      const match = words[index]!.match(/^([^\p{L}]*)(\p{L}+)([^\p{L}]*)$/u);
      if (!match) continue;
      const word = match[2]!;
      const meant = maybeScent(lexicon, word);
      if (!meant) continue;
      const article = word.match(ARTICLE)?.[1] || '';
      const to = `${article}${meant}`;
      const corrected = words.map((part, i) => (i === index ? `${match[1]}${to}${match[3]}` : part)).join(' ');
      return { action: 'ask', say: confirmQuestion(language, dialect, meant), pending: { original: text, corrected, from: word, to, typed: clean } };
    }
  }
  return { action: 'send', text, changed: text !== clean };
}

const READ_AS: Record<string, (text: string) => string> = {
  ar: (t) => `✍️ فهمت سؤالك كده: «${t}»`, en: (t) => `✍️ I read your message as: “${t}”`, fr: (t) => `✍️ J’ai compris : « ${t} »`,
  es: (t) => `✍️ Entendí: «${t}»`, it: (t) => `✍️ Ho capito: «${t}»`, de: (t) => `✍️ Verstanden als: „${t}“`,
  ru: (t) => `✍️ Я понял так: «${t}»`, zh: (t) => `✍️ 我理解为：“${t}”`, tr: (t) => `✍️ Şöyle anladım: “${t}”`, fa: (t) => `✍️ این‌طور فهمیدم: «${t}»`,
};
/** «✍️ فهمت سؤالك كده: «…»» — shown under the visitor's typed message when Shaheen corrected it. */
export function typedNote(language: SupportedLanguage, text: string): string {
  return (READ_AS[language] || READ_AS.en!)(text);
}
const TYPED_KEY = 'sham_typed_fixes_v1';
/** The typing slips this visitor confirmed («قصدك «عنبر»؟» → «أيوه»), kept in this browser only. */
export function savedTypedFixes(): Record<string, string> {
  try {
    const data: unknown = JSON.parse(globalThis.localStorage?.getItem(TYPED_KEY) || '{}');
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    return Object.fromEntries(Object.entries(data as Record<string, unknown>).filter((pair): pair is [string, string] => typeof pair[1] === 'string').slice(-200));
  } catch { return {}; }
}
export function saveTypedFix(from: string, to: string) {
  const pair = learnablePair(from, to.replace(ARTICLE, ''));
  if (!pair) return;
  try { globalThis.localStorage?.setItem(TYPED_KEY, JSON.stringify({ ...savedTypedFixes(), [pair.from]: pair.to })); } catch { /* Private mode. */ }
}

/** The visitor's own words without the «🎧 …» / «✍️ …» line under them (that line is for him, not part of his message). */
export const withoutNote = (text: string) => text.replace(/\n\n(?:🎧|✍️) [^\n]*$/u, '');
/** What the visitor meant: the corrected message in the «✍️ …» line when there is one, else his words. */
export function meantText(text: string): string {
  const read = text.match(/\n\n✍️ [^«“„\n]*[«“„]\s?([^\n]*?)\s?[»”“]$/u);
  return read?.[1]?.trim() || withoutNote(text);
}
