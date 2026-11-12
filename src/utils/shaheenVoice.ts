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
export function bargeIn(heard: string, reply: string): { barge: boolean; said: string } {
  const words = heard.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const normalizedWords = words.map((word) => normalizeArabic(word)).filter(Boolean);
  if (!normalizedWords.length) return { barge: false, said: '' };
  const own = new Set(normalizeArabic(prepareShaheenSpeech(reply)).split(' ').filter(Boolean));
  const novel = words.filter((word) => { const normal = normalizeArabic(word); return normal.length > 1 && !own.has(normal); });
  const heardNormal = normalizeArabic(heard);
  const stop = [...STOP_WORDS].some((word) => (` ${heardNormal} `).includes(` ${word} `) && !word.split(' ').every((part) => own.has(part)));
  const ratio = novel.length / normalizedWords.length;
  const barge = stop || (novel.length >= 2 && ratio >= 0.5);
  return { barge, said: barge ? (ratio >= 0.7 ? words.join(' ') : novel.join(' ')) : '' };
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
  return `${head} ${rest}`;
}
