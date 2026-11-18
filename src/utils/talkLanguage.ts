/**
 * «شاهين يسمع ويرد باللغة اللي المستخدم اتكلم بيها» (the owner, 2026-11-16): the language of the conversation is the one
 * the visitor speaks or writes — not the page's. A visitor on the English page who speaks Arabic is heard in Arabic
 * and answered in Arabic (written and spoken), and the other way round; nothing is mixed.
 *
 * The browser's speech engine hears ONE language at a time and cannot tell which one is spoken, so:
 *   1. it starts in the most likely one (what he chose before on this device → what he typed in this chat → the page's
 *      language, or Arabic for a visitor plainly from an Arab country or with an Arabic device),
 *   2. a sentence that comes back written in another language switches the conversation to it,
 *   3. a sentence heard badly in the first turns (low sureness) when the other language is likely → he switches and
 *      asks once to hear it again, instead of answering words that were never said,
 *   4. and the visitor can switch it himself with one tap («العربي / English»).
 */
import type { SupportedLanguage } from '../types/i18n';
import { dialectForCountry } from './arabicDialect';

/** Languages written in the Arabic letters (their visitors are never "switched" to Arabic because of the letters). */
export const ARABIC_SCRIPT_LANGUAGES: ReadonlySet<string> = new Set(['ar', 'fa', 'ur', 'ps', 'sd', 'ug', 'ku', 'ckb']);
const EN_WORDS = /\b(?:the|and|is|are|was|of|to|you|your|i'm|me|my|with|for|this|that|it|in|on|what|which|how|do|does|can|have|want|need|please|perfume|smell|scent)\b/gi;
/** Letters only Persian, Urdu and their neighbours use (an Arabic sentence has none of them). */
const NOT_ARABIC_LETTERS = /[پچژگٹڈڑںےۀ]/;

/** What a sentence is written in, when it is plainly Arabic or plainly English (undefined = can't tell). */
export function writtenLanguage(text: string): 'ar' | 'en' | undefined {
  const plain = text.replace(/```[\s\S]*?```/g, ' ').replace(/https?:\/\/\S+/g, ' ');
  const letters = (plain.match(/\p{L}/gu) || []).length;
  if (letters < 2) return undefined;
  const arabic = (plain.match(/[\u0600-\u06FF]/g) || []).length;
  if (arabic / letters > 0.5) {
    if (NOT_ARABIC_LETTERS.test(plain)) return undefined;
    // Persian typed without its own letters still writes «ی» and «ک» where Arabic writes «ي» and «ك».
    const persianYa = (plain.match(/[یک]/g) || []).length;
    const arabicYa = (plain.match(/[يك]/g) || []).length;
    if (persianYa >= 2 && arabicYa === 0) return undefined;
    return 'ar';
  }
  const latin = (plain.match(/[A-Za-z]/g) || []).length;
  if (latin / letters < 0.9) return undefined;
  const words = plain.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length || 1;
  const english = (plain.match(EN_WORDS) || []).length;
  return english >= 2 || (words <= 3 && english >= 1) || english / words >= 0.25 ? 'en' : undefined;
}

/**
 * The language to answer a message in: his own when it is plainly another one than the page's (an Arabic question on
 * the English page → Arabic; an English question on the Arabic page → English); otherwise the page's language.
 */
export function replyLanguageFor(message: string, site: SupportedLanguage): SupportedLanguage {
  const written = writtenLanguage(message);
  if (written === 'ar' && !ARABIC_SCRIPT_LANGUAGES.has(site)) return 'ar';
  if (written === 'en' && site === 'ar') return 'en';
  // A plainly English sentence on another page (French, German…) is answered in English, like a person would.
  if (written === 'en' && site !== 'en' && !ARABIC_SCRIPT_LANGUAGES.has(site) && strongEnglish(message)) return 'en';
  return site;
}

/** Many common English words (a French or Italian sentence never has this many). */
function strongEnglish(text: string): boolean {
  const words = text.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length || 1;
  const english = (text.match(EN_WORDS) || []).length;
  return english >= 3 && english / words >= 0.3;
}

/** Does everything around this visitor say he probably speaks Arabic (his Arab country or an Arabic device)? */
export function arabicLikely(country?: string, deviceLanguages: readonly string[] = []): boolean {
  return Boolean(dialectForCountry(country)) || deviceLanguages.slice(0, 3).some((l) => /^ar\b/i.test(l));
}

export interface TalkSignals {
  /** The page's language. */
  site: SupportedLanguage;
  /** The language he used for his last voice conversation on this device (kept only after a sentence was understood). */
  saved?: SupportedLanguage;
  /** What he wrote in this chat, newest first. */
  typed?: readonly string[];
  country?: string;
  deviceLanguages?: readonly string[];
}

/** The language the microphone starts in. */
export function initialTalkLanguage({ site, saved, typed = [], country, deviceLanguages = [] }: TalkSignals): SupportedLanguage {
  // What he is writing in this very chat says it best.
  for (const text of typed.slice(0, 3)) {
    const written = writtenLanguage(text);
    if (written) return replyLanguageFor(text, site);
  }
  // His choice last time on this device (Arabic, English or the page's own language).
  if (saved && (saved === site || saved === 'ar' || saved === 'en')) return saved;
  // The English page, opened by a visitor from an Arab country with an Arabic device: he most likely speaks Arabic.
  if (site === 'en' && dialectForCountry(country) && deviceLanguages.slice(0, 2).some((l) => /^ar\b/i.test(l))) return 'ar';
  return site;
}

/** The other language worth trying when a sentence was heard badly (Arabic ↔ the page's language or English). */
export function otherTalkLanguage(current: SupportedLanguage, site: SupportedLanguage): SupportedLanguage {
  if (current !== 'ar') return 'ar';
  return site === 'ar' ? 'en' : site;
}

/**
 * After a sentence: should the conversation move to another language?
 * - the words came back plainly written in another language → that one;
 * - heard badly (sureness under 0.5, or nothing usable although he spoke) in his first sentences, and the other
 *   language is likely for him → the other one, and he is asked to say it again.
 */
export function languageAfterSentence({ heard, confidence, current, site, country, deviceLanguages = [], understood = 0 }: {
  heard: string; confidence?: number; current: SupportedLanguage; site: SupportedLanguage; country?: string;
  deviceLanguages?: readonly string[];
  /** How many of his sentences were understood in this conversation so far. */
  understood?: number;
}): { switchTo?: SupportedLanguage; askAgain: boolean } {
  const written = writtenLanguage(heard);
  if (written && written !== current && (written === 'ar' ? !ARABIC_SCRIPT_LANGUAGES.has(current) : current === 'ar')) {
    return { switchTo: written, askAgain: false };
  }
  if (understood >= 2) return { askAgain: false };
  const unsure = confidence !== undefined && confidence > 0 && confidence < 0.5;
  if (!unsure) return { askAgain: false };
  const other = otherTalkLanguage(current, site);
  const otherLikely = other === 'ar' ? arabicLikely(country, deviceLanguages) : site !== 'ar' || deviceLanguages.slice(0, 2).some((l) => l.toLowerCase().startsWith(other));
  return otherLikely ? { switchTo: other, askAgain: true } : { askAgain: false };
}

/** «معلش، ماسمعتكش كويس»: said in the NEW language after a switch. */
export function sayAgainLine(language: SupportedLanguage): string {
  if (language === 'ar') return 'معلش، ماسمعتكش كويس. قول تاني كده؟';
  if (language === 'fr') return 'Pardon, je vous ai mal entendu. Vous pouvez répéter ?';
  if (language === 'es') return 'Perdona, no te oí bien. ¿Puedes repetirlo?';
  if (language === 'de') return 'Entschuldigung, ich habe dich nicht gut verstanden. Noch einmal?';
  return 'Sorry, I didn’t catch that. Could you say it again?';
}

const TALK_KEY = 'sham_voice_talk_language_v1';
/** This browser's storage (none on the server). */
const store = () => (globalThis as { localStorage?: { getItem(key: string): string | null; setItem(key: string, value: string): void } }).localStorage;
export function savedTalkLanguage(): SupportedLanguage | undefined {
  try { const value = store()?.getItem(TALK_KEY); return value && /^[a-z]{2,3}$/.test(value) ? value as SupportedLanguage : undefined; } catch { return undefined; }
}
export function saveTalkLanguage(language: SupportedLanguage): void {
  try { store()?.setItem(TALK_KEY, language); } catch { /* private mode: only this conversation remembers */ }
}
