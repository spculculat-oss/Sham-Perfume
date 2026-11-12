/** Browser speech helpers for Shaheen's optional voice-conversation mode. */
import type { SupportedLanguage } from '../types/i18n';
import { LOCALE_MAP } from '../لغات/localize';
import { removeMediaBlocks } from './mediaBlock';
import { removeFormulaBlocks } from './aiFormulaExtractor';
import { removeToolBlocks } from './shaheenTools';
import { plainMath } from './shaheenText';
import { normalizeArabic } from './arabicDialect';

/** Use the site's locale map, with Egyptian Arabic as the Arabic default. */
export function shaheenSpeechLocale(language: SupportedLanguage): string {
  return LOCALE_MAP[language] || (language === 'ar' ? 'ar-EG' : language);
}

/** Remove machine-oriented Markdown before speaking; keep readable labels and prose. */
export function prepareShaheenSpeech(text: string): string {
  const displayText = plainMath(removeToolBlocks(removeFormulaBlocks(removeMediaBlocks(text))));
  return displayText
    .replace(/^[ \t]*```[^\n]*\n[\s\S]*?(?:^[ \t]*```[ \t]*$|$)/gm, ' ')
    .replace(/^[ \t]*~~~[^\n]*\n[\s\S]*?(?:^[ \t]*~~~[ \t]*$|$)/gm, ' ')
    .replace(/^[ \t]*(```|~~~)[\w-]*[ \t]*\n(?:[ \t]*\n)*[ \t]*\1[ \t]*$/gm, ' ')
    .replace(/\n[ \t]*(```|~~~)[\w-]*[ \t]*$/, '')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\u2045([^\u2046]*)\u2046/g, '$1')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)+\|?\s*$/gm, ' ')
    .replace(/^\s*\|([^\n]+)\|\s*$/gm, (_line, cells: string) => cells.replace(/\s*\|\s*/g, '، '))
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/gm, '')
    .replace(/[\\*_~`>#|]+/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split long replies into sentence/word-safe chunks so browser speech engines do not truncate them. */
export function splitShaheenSpeech(text: string, maxChars = 220): string[] {
  const clean = prepareShaheenSpeech(text);
  if (!clean) return [];
  const limit = Math.max(20, Math.floor(maxChars));
  const sentences = clean.split(/(?<=[.!?؟؛。])\s+/u).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  const flush = () => {
    if (current) chunks.push(current);
    current = '';
  };
  const appendWord = (word: string) => {
    if (!word) return;
    if (word.length > limit) {
      flush();
      for (let offset = 0; offset < word.length; offset += limit) chunks.push(word.slice(offset, offset + limit));
      return;
    }
    if (!current) current = word;
    else if (current.length + 1 + word.length <= limit) current += ` ${word}`;
    else { flush(); current = word; }
  };
  for (const sentence of sentences) {
    if (sentence.length <= limit) {
      if (!current) current = sentence;
      else if (current.length + 1 + sentence.length <= limit) current += ` ${sentence}`;
      else { flush(); current = sentence; }
      continue;
    }
    flush();
    for (const word of sentence.split(/\s+/)) appendWord(word);
    flush();
  }
  flush();
  return chunks;
}

/** The little a speech engine exposes about one of its voices (a subset of SpeechSynthesisVoice). */
export interface ShaheenVoiceCandidate {
  readonly name: string;
  readonly lang: string;
  readonly localService?: boolean;
  readonly default?: boolean;
}

/** Engines name their best, most human-sounding voices with these words. */
const NATURAL_VOICE = /natural|neural|online|premium|enhanced|wavenet|studio|google|siri/i;
/** Male voices by name (Microsoft natural voices, Apple and Google): Shaheen sounds like himself when one exists. */
const MALE_VOICE = /\b(?:shakir|hamed|hamdan|fahed|ali|ismael|bassel|taim|rami|omar|jamal|abdullah|moaz|laith|hedi|saleh|maged|majed|tarik|naayf|guy|davis|andrew|brian|christopher|eric|roger|ryan|thomas|henri|remy|alvaro|diego|giuseppe|conrad|killian|dmitry|ahmet|farid|yunxi|yunjian|daniel|aaron|male)\b/i;
/** Novelty and low-quality voices that should never read Shaheen's replies. */
const NOVELTY_VOICE = /compact|espeak|whisper|zarvox|trinoids|bells|bubbles|bad news|good news|boing|cellos|organ|jester|superstar|wobble|albert|fred|junior|ralph|kathy/i;

/**
 * Choose the most natural voice the visitor's own device offers for the reply language: the exact locale
 * (ar-EG) beats the same language in another region (ar-SA), and voices named as natural/neural/online beat
 * the robotic defaults. Returns undefined when the device has no voice for that language, so the engine
 * falls back to its own choice for the `lang` set on the utterance.
 */
export function pickShaheenVoice<V extends ShaheenVoiceCandidate>(voices: readonly V[], locale: string, language: string): V | undefined {
  const wanted = locale.toLowerCase().replace(/_/g, '-');
  const base = (language || wanted.split('-')[0]).toLowerCase();
  let best: V | undefined;
  let bestScore = -Infinity;
  for (const voice of voices) {
    const lang = (voice.lang || '').toLowerCase().replace(/_/g, '-');
    if (!lang) continue;
    let score: number;
    if (lang === wanted) score = 100;
    else if (lang === base || lang.startsWith(`${base}-`)) score = 60;
    else continue;
    if (NATURAL_VOICE.test(voice.name)) score += 25;
    // «الخبير شاهين» is a man: among equally good voices, a male one.
    if (MALE_VOICE.test(voice.name)) score += 6;
    if (NOVELTY_VOICE.test(voice.name)) score -= 50;
    if (voice.default) score += 3;
    if (voice.localService === false) score += 2;
    if (score > bestScore) { best = voice; bestScore = score; }
  }
  return best;
}

/** Words that mean «stop, let me talk» in the site's main languages (normalized spelling). */
const STOP_WORDS = new Set([
  'استني', 'استنا', 'لحظه', 'ثانيه', 'ثواني', 'وقف', 'اسكت', 'بس بس', 'لا لا', 'خلاص', 'دقيقه', 'اصبر', 'شوي شوي',
  'stop', 'wait', 'hold', 'sorry', 'hang', 'pardon', 'attends', 'arrête', 'espera', 'para', 'aspetta', 'warte', 'stopp',
  'стоп', 'подожди', 'dur', 'bekle', 'صبر', 'وایسا',
]);

/**
 * «المقاطعة بالصوت»: while Shaheen speaks the microphone keeps listening, and also hears Shaheen himself through
 * the speakers. What it heard is a real interruption only when it is not his own words: at least two words he is
 * not saying (and most of what was heard), or a clear «stop/wait». `said` = the visitor's own words to keep.
 */
export function bargeIn(heard: string, reply: string, { near, eager = false }: {
  /** What he is saying around this moment (his words a few seconds back and ahead): only these can echo back now. */
  near?: string;
  /** The microphone already noticed someone starting to talk: one clear word of the visitor is enough. */
  eager?: boolean;
} = {}): { barge: boolean; said: string } {
  const words = heard.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const normalizedWords = words.map((word) => normalizeArabic(word)).filter(Boolean);
  if (!normalizedWords.length) return { barge: false, said: '' };
  const own = new Set(normalizeArabic(prepareShaheenSpeech(reply)).split(' ').filter(Boolean));
  const ownNow = near ? new Set(normalizeArabic(prepareShaheenSpeech(near)).split(' ').filter(Boolean)) : own;
  // A word of his own, or the engine's slightly wrong reading of one («لمسه» for «لمسة», «عوض» for «عود»).
  const echoes = (normal: string, words: Set<string>) => words.has(normal) || (normal.length >= 4 && [...words].some((word) => Math.abs(word.length - normal.length) <= 1 && wordsDiffer(word, normal) <= 1));
  const novel = words.filter((word) => { const normal = normalizeArabic(word); return normal.length > 1 && !echoes(normal, ownNow); });
  const heardNormal = normalizeArabic(heard);
  const stop = [...STOP_WORDS].some((word) => (` ${heardNormal} `).includes(` ${word} `) && !word.split(' ').every((part) => ownNow.has(part)));
  const ratio = novel.length / normalizedWords.length;
  const clearWord = novel.some((word) => normalizeArabic(word).length >= 3);
  const barge = stop || (novel.length >= 2 && ratio >= 0.5) || (eager && clearWord && ratio >= 0.5);
  if (!barge) return { barge, said: '' };
  // His words to keep: never one Shaheen said anywhere in this reply (that is his echo, and it would change the topic).
  const mine = words.filter((word) => { const normal = normalizeArabic(word); return normal.length > 0 && !echoes(normal, own); });
  return { barge, said: mine.length / normalizedWords.length >= 0.7 ? words.join(' ') : mine.join(' ') };
}

/** Plain edit distance between two short words (for «is this just his own word, misheard?»). */
function wordsDiffer(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) row[j] = Math.min(previous[j]! + 1, row[j - 1]! + 1, previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = row;
  }
  return previous[b.length]!;
}

/**
 * The words Shaheen is saying around this moment: `span` words before where he is in the reply and `span` after
 * (what the microphone can hear of him right now; the rest of the reply cannot be an echo).
 */
export function speechWindow(reply: string, spokenSoFar: string, span = 14): string {
  const words = reply.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const at = spokenSoFar.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
  return words.slice(Math.max(0, at - span), at + span).join(' ');
}

/** The interrupting words and the rest of the sentence heard right after, without saying any word twice. */
export function mergeHeard(prefix: string, heard: string): string {
  const head = prefix.replace(/\s+/g, ' ').trim();
  const rest = heard.replace(/\s+/g, ' ').trim();
  if (!head) return rest;
  if (!rest) return head;
  const normalHead = normalizeArabic(head);
  const normalRest = normalizeArabic(rest);
  if (normalRest.startsWith(normalHead) || normalRest.includes(normalHead)) return rest;
  if (normalHead.includes(normalRest)) return head;
  // «بكام الزجاجة» + «الزجاجة الصغيرة»: the two listeners overlap — the words are said once, and the full listener's
  // reading (the newer, clearer one) wins for the shared part.
  const headWords = head.split(' ');
  const restKeys = rest.split(' ').map((word) => normalizeArabic(word));
  for (let take = Math.min(headWords.length, restKeys.length); take > 0; take -= 1) {
    const tail = headWords.slice(-take).map((word) => normalizeArabic(word));
    if (tail.every((key, i) => key === restKeys[i])) return [...headWords.slice(0, -take), rest].join(' ');
  }
  return `${head} ${rest}`;
}
