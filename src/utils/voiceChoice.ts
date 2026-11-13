/**
 * «صوت شاهين»: the visitor picks exactly the voice he likes — any male or female voice his device offers for the
 * conversation's language — and how high and how fast it speaks. Kept in this browser; used by the voice
 * conversation and by «اسمع الرد». Only the browser's own voices (free, nothing sent anywhere).
 */
import { pickShaheenVoice, speaksLanguage, type ShaheenVoiceCandidate } from './shaheenVoice';

export type VoiceGender = 'male' | 'female';

/** Male voices by name (Microsoft natural voices, Apple, Google and Android names). */
const MALE = /\b(?:shakir|hamed|hamdan|fahed|ali|ismael|bassel|taim|rami|omar|jamal|abdullah|moaz|laith|hedi|saleh|maged|majed|tarik|naayf|guy|davis|andrew|brian|christopher|eric|roger|ryan|thomas|henri|remy|alvaro|diego|giuseppe|conrad|killian|dmitry|ahmet|farid|yunxi|yunjian|yunyang|daniel|aaron|alex|fred|jorge|luca|reed|rocko|grandpa|arthur|oliver|george|male|man)\b/i;
/** Female voices by name. */
const FEMALE = /\b(?:salma|zariyah|fatima|laila|layla|amina|rana|sana|noura|iman|mouna|aysha|amal|amany|reem|maryam|mariam|hoda|hala|tarifa|lana|aria|jenny|emma|ava|michelle|sonia|libby|denise|elvira|isabella|elsa|katja|amala|svetlana|dariya|xiaoxiao|xiaoyi|xiaochen|emel|seda|dilara|samantha|karen|moira|tessa|victoria|zira|hazel|susan|linda|heera|amelie|alice|paulina|monica|anna|milena|yelda|tingting|meijia|sinji|kanya|google uk english female|female|woman)\b/i;

/** Is this voice a man's or a woman's voice (by its name)? Undefined when the name does not say. */
export function voiceGender(voice: Pick<ShaheenVoiceCandidate, 'name'>): VoiceGender | undefined {
  const name = voice.name || '';
  if (FEMALE.test(name)) return 'female';
  if (MALE.test(name)) return 'male';
  return undefined;
}

export interface VoiceOption<V extends ShaheenVoiceCandidate = ShaheenVoiceCandidate> {
  voice: V;
  name: string;
  /** A short label: the voice's own name without the vendor's long words. */
  label: string;
  lang: string;
  gender?: VoiceGender;
}

/** A readable short name («Microsoft Shakir Online (Natural) - Arabic (Egypt)» → «Shakir · ar-EG»). */
export function voiceLabel(voice: ShaheenVoiceCandidate): string {
  const name = (voice.name || '')
    .replace(/\b(?:microsoft|google|apple|online|natural|neural|enhanced|premium|desktop|compact)\b/gi, ' ')
    .replace(/[()]/g, ' ')
    .replace(/\s+-\s+.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `${name || voice.name} · ${voice.lang}`;
}

/** Every voice for the language (the exact accent first, then natural-sounding ones), with its gender when known. */
export function voiceOptions<V extends ShaheenVoiceCandidate>(voices: readonly V[], locale: string, language: string): VoiceOption<V>[] {
  const wanted = locale.toLowerCase().replace(/_/g, '-');
  const base = (language || wanted.split('-')[0] || '').toLowerCase();
  const rank = (voice: V) => {
    const lang = (voice.lang || '').toLowerCase().replace(/_/g, '-');
    return (lang === wanted ? 100 : 0) + (/natural|neural|online|premium|enhanced|google/i.test(voice.name) ? 10 : 0);
  };
  const seen = new Set<string>();
  return voices
    .filter((voice) => {
      const lang = (voice.lang || '').toLowerCase().replace(/_/g, '-');
      if (!speaksLanguage(lang, base) || seen.has(voice.name)) return false;
      seen.add(voice.name);
      return true;
    })
    .sort((a, b) => rank(b) - rank(a) || a.name.localeCompare(b.name))
    .map((voice) => {
      const gender = voiceGender(voice);
      return { voice, name: voice.name, label: voiceLabel(voice), lang: voice.lang, ...(gender ? { gender } : {}) };
    });
}

/** What the visitor chose: a voice by name (for one language), a gender to prefer, how high and how fast. */
export interface VoiceChoice {
  /** Chosen voice per language («ar», «en»…): the device may have it for one language and not another. */
  names: Record<string, string>;
  gender?: VoiceGender;
  /** 0.6–1.5 (1 = the voice as it is). */
  pitch: number;
  /** 0.7–1.3 (Shaheen's usual pace is 0.96). */
  rate: number;
  /** «يتأقلم مع مزاجك»: false = never nudged by the visitor's mood (on unless he turned it off). */
  mood?: boolean;
}
export const DEFAULT_VOICE_CHOICE: VoiceChoice = { names: {}, pitch: 1, rate: 0.96 };
const KEY = 'sham_voice_choice_v1';
const clamp = (value: unknown, lo: number, hi: number, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? Math.min(hi, Math.max(lo, value)) : fallback);

export function savedVoiceChoice(): VoiceChoice {
  try {
    const data = JSON.parse(globalThis.localStorage?.getItem(KEY) || 'null') as Partial<VoiceChoice> | null;
    if (!data || typeof data !== 'object') return { ...DEFAULT_VOICE_CHOICE };
    const names = data.names && typeof data.names === 'object' && !Array.isArray(data.names)
      ? Object.fromEntries(Object.entries(data.names).filter((pair): pair is [string, string] => typeof pair[1] === 'string' && pair[1].length < 200).slice(0, 20))
      : {};
    return {
      names,
      ...(data.gender === 'male' || data.gender === 'female' ? { gender: data.gender } : {}),
      pitch: clamp(data.pitch, 0.6, 1.5, 1),
      rate: clamp(data.rate, 0.7, 1.3, 0.96),
      ...(data.mood === false ? { mood: false } : {}),
    };
  } catch { return { ...DEFAULT_VOICE_CHOICE }; }
}
export function saveVoiceChoice(choice: VoiceChoice) {
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(choice)); } catch { /* Private mode. */ }
}

/**
 * The voice to speak with: the one he chose for this language when the device has it; else the most natural voice of
 * the gender he prefers; else Shaheen's usual pick.
 */
export function chosenVoice<V extends ShaheenVoiceCandidate>(voices: readonly V[], locale: string, language: string, choice: VoiceChoice = savedVoiceChoice()): V | undefined {
  const base = (language || locale.split('-')[0] || '').toLowerCase();
  const named = choice.names[base];
  if (named) {
    const exact = voices.find((voice) => voice.name === named);
    if (exact && speaksLanguage(exact.lang, base)) return exact;
  }
  if (choice.gender) {
    const same = voices.filter((voice) => voiceGender(voice) === choice.gender);
    const pick = pickShaheenVoice(same, locale, language);
    if (pick) return pick;
  }
  return pickShaheenVoice(voices, locale, language);
}
