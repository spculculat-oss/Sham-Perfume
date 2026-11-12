/**
 * «اسمع الرد»: the speaker button under a reply. It used to hand the whole written reply to the browser in one go —
 * symbols, lists and digits read literally, in the device's default voice, and cut off by Chrome after ~15 seconds.
 * Now the reply is said the way Shaheen talks (src/utils/spokenReply.ts), in the visitor's dialect and accent, with
 * the most natural voice the device has, sentence by sentence.
 */
import type { SupportedLanguage } from '../types/i18n';
import { dialectLocale, type Dialect } from './arabicDialect';
import { pickShaheenVoice, shaheenSpeechLocale, splitShaheenSpeech } from './shaheenVoice';
import { spokenReply } from './spokenReply';
import { currentStoreCountry } from './storeCheckout';

/** Reads the reply aloud; returns a function that stops it. `onEnd` runs once (finished, failed or stopped). */
export function readAloud(text: string, { language, dialect, onEnd }: { language: SupportedLanguage; dialect?: Dialect; onEnd?: () => void }): () => void {
  let done = false;
  const end = () => { if (!done) { done = true; onEnd?.(); } };
  if (typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) { end(); return () => undefined; }
  const synth = window.speechSynthesis;
  const chunks = splitShaheenSpeech(spokenReply(text, { language, dialect, words: Infinity }).say);
  if (!chunks.length) { end(); return () => undefined; }
  const locale = language === 'ar' && dialect ? dialectLocale(dialect, currentStoreCountry()) : shaheenSpeechLocale(language);
  let voices: SpeechSynthesisVoice[] = [];
  try { voices = synth.getVoices(); } catch { /* No voice list yet: the engine picks one for the locale. */ }
  const voice = pickShaheenVoice(voices, locale, language);
  let index = 0;
  const next = () => {
    if (done) return;
    if (index >= chunks.length) { end(); return; }
    try {
      const utterance = new window.SpeechSynthesisUtterance(chunks[index]!);
      utterance.lang = locale;
      utterance.rate = 0.97;
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
