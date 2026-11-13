/**
 * «مخارج الألفاظ»: how people really say words, learned from talking with them.
 *
 * - Each dialect starts with its known sounds (Egyptian «ق» said «ء»، «ث» said «ت/س»؛ Gulf «ج» said «ي»؛ Sudanese «ق»
 *   said «غ»…) — the same knowledge a large AI model has about Arabic speech.
 * - Every word a visitor confirmed («قصدك «عنبر»؟» → «أيوه»), and every correction shared by three different visitors,
 *   is lined up letter by letter with what the engine heard: the letters that were swapped (and long vowels dropped
 *   or added) become cheaper to swap next time. So Shaheen gets better at hearing this visitor (his device keeps his
 *   own) and everyone (the shared corrections) — from text pairs only; no sound is recorded or sent.
 */
import type { Dialect } from './arabicDialect';

export interface SoundProfile {
  /** Letter pair («قا» sorted) → how often one was heard for the other. */
  swaps: Record<string, number>;
  /** How often a long vowel («ا و ي») was dropped or added by the engine. */
  vowels: number;
}
export const EMPTY_SOUNDS: SoundProfile = { swaps: {}, vowels: 0 };

const pair = (a: string, b: string) => (a < b ? `${a}${b}` : `${b}${a}`);
const LONG_VOWELS = 'اوي';

/** What each dialect is known to do to letters (counted as if seen twice: cheap from the first conversation). */
const DIALECT_SOUNDS: Partial<Record<Dialect, string[]>> = {
  egyptian: ['قا', 'قء', 'ثت', 'ثس', 'ذد', 'ذز', 'ظض', 'ظز'],
  levantine: ['قا', 'قء', 'ثت', 'ثس', 'ذد', 'ذز', 'ظض', 'ظز'],
  gulf: ['جي', 'كچ', 'قج', 'قگ', 'ضظ'],
  iraqi: ['قگ', 'قج', 'كچ', 'ضظ'],
  sudanese: ['قغ', 'ثت', 'ثس', 'ذد', 'ذز'],
  yemeni: ['قج', 'قگ', 'ضظ'],
  maghrebi: ['قگ', 'ثت', 'ذد', 'ظض'],
};

/** Line up what was heard with what was meant: the letters swapped, and how many long vowels were dropped/added. */
export function alignSounds(heard: string, meant: string): { swaps: string[]; vowels: number } {
  const n = heard.length; const m = meant.length;
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i += 1) for (let j = 1; j <= m; j += 1) {
    d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (heard[i - 1] === meant[j - 1] ? 0 : 1));
  }
  const swaps: string[] = []; let vowels = 0;
  let i = n; let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i]![j] === d[i - 1]![j - 1]! + (heard[i - 1] === meant[j - 1] ? 0 : 1)) {
      if (heard[i - 1] !== meant[j - 1]) swaps.push(pair(heard[i - 1]!, meant[j - 1]!));
      i -= 1; j -= 1;
    } else if (i > 0 && d[i]![j] === d[i - 1]![j]! + 1) {
      if (LONG_VOWELS.includes(heard[i - 1]!)) vowels += 1;
      i -= 1;
    } else {
      if (LONG_VOWELS.includes(meant[j - 1]!)) vowels += 1;
      j -= 1;
    }
  }
  return { swaps, vowels };
}

/** One confirmed pair (heard → meant word keys) learned into the profile. Pairs far apart teach nothing. */
export function learnSounds(profile: SoundProfile, heard: string, meant: string): SoundProfile {
  if (!heard || !meant || heard === meant) return profile;
  const { swaps, vowels } = alignSounds(heard, meant);
  if (swaps.length + vowels > 2 || swaps.length + vowels === 0) return profile;
  const next = { ...profile.swaps };
  for (const key of swaps) next[key] = Math.min(50, (next[key] || 0) + 1);
  return { swaps: next, vowels: Math.min(50, profile.vowels + vowels) };
}

/** The visitor's sounds: his dialect's known ones, then every pair (his own and the shared ones) learned on top. */
export function soundProfile(dialect: Dialect | undefined, pairs: Record<string, string> = {}): SoundProfile {
  let profile: SoundProfile = { swaps: {}, vowels: 0 };
  for (const key of DIALECT_SOUNDS[dialect || 'egyptian'] || []) profile.swaps[pair(key[0]!, key[1]!)] = 2;
  for (const [heard, meant] of Object.entries(pairs)) profile = learnSounds(profile, heard, meant);
  return profile;
}

/** The cost of hearing `a` for `b` (letters), after what was learned; undefined = no opinion (the usual cost). */
export function swapCost(profile: SoundProfile | undefined, a: string, b: string): number | undefined {
  const seen = profile?.swaps[pair(a, b)] || 0;
  if (seen >= 2) return 0.2;
  if (seen === 1) return 0.3;
  return undefined;
}
/** The cost of a long vowel dropped or added (speech engines often do; more so for some voices). */
export function vowelCost(profile: SoundProfile | undefined): number {
  return (profile?.vowels || 0) >= 2 ? 0.35 : 0.5;
}
