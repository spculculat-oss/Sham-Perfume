/**
 * «اسمع الرد»: the speaker button under a reply. It used to hand the whole written reply to the browser in one go —
 * symbols, lists and digits read literally, in the device's default voice, and cut off by Chrome after ~15 seconds.
 * Now the reply is said the way Shaheen talks (src/utils/spokenReply.ts), in the visitor's dialect and accent, with
 * the most natural voice the device has, sentence by sentence.
 */
import type { SupportedLanguage } from '../types/i18n';
import { resolveDialect, savedDialectChoice, type Dialect } from './arabicDialect';
import { deviceLacksVoice, speechLocaleFor, splitShaheenSpeech } from './shaheenVoice';
import { chosenVoice, savedVoiceChoice } from './voiceChoice';
import { spokenReply } from './spokenReply';
import { currentStoreCountry } from './storeCheckout';

/** Reads the reply aloud; returns a function that stops it. `onEnd` runs once (finished, failed or stopped). */
export function readAloud(text: string, { language, dialect, onEnd, onNoVoice }: {
  language: SupportedLanguage; dialect?: Dialect; onEnd?: () => void;
  /** The device has no voice for this language: nothing is read (an English voice reading Hindi is gibberish). */
  onNoVoice?: () => void;
}): () => void {
  let done = false;
  const end = () => { if (!done) { done = true; onEnd?.(); } };
  if (typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) { end(); return () => undefined; }
  const synth = window.speechSynthesis;
  // «بلغة بلده ولهجتها»: his country's accent (fr-CA, es-MX), or for Arabic his dialect (else his Arab country's).
  const country = currentStoreCountry();
  const spokenDialect = language === 'ar' ? dialect || resolveDialect({ choice: savedDialectChoice(), texts: [], country }) : undefined;
  const locale = speechLocaleFor(language, country, spokenDialect);
  const chunks = splitShaheenSpeech(spokenReply(text, { language, dialect: spokenDialect, words: Infinity, locale }).say);
  if (!chunks.length) { end(); return () => undefined; }
  let voices: SpeechSynthesisVoice[] = [];
  try { voices = synth.getVoices(); } catch { /* No voice list yet: the engine picks one for the locale. */ }
  if (deviceLacksVoice(voices, language)) { onNoVoice?.(); end(); return () => undefined; }
  // «صوت شاهين»: the voice, pitch and pace the visitor chose (or Shaheen's usual voice).
  const choice = savedVoiceChoice();
  const voice = chosenVoice(voices, locale, language, choice);
  let index = 0;
  const next = () => {
    if (done) return;
    if (index >= chunks.length) { end(); return; }
    try {
      const utterance = new window.SpeechSynthesisUtterance(chunks[index]!);
      utterance.lang = locale;
      utterance.rate = choice.rate;
      utterance.pitch = choice.pitch;
      if (voice) utterance.voice = voice;
      utterance.onend = () => { index += 1; next(); };
      utterance.onerror = () => end();
      synth.speak(utterance);
    } catch { end(); }
  };
  try { synth.cancel(); } catch { /* Nothing queued. */ }
  next();
  return () => { end(); try { synth.cancel(); } catch { /* Already quiet. */ } };
}
