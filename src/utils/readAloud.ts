import { resolveLocalVoice } from './localVoiceCatalog';
import { playLocalVoice } from './localVoicePlayer';
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
  /** No suitable voice, synthesis/playback failure, or stalled engine. Written replies remain available. */
  onNoVoice?: () => void;
}): () => void {
  let done = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let current: SpeechSynthesisUtterance | undefined;
  const synth = typeof window === 'undefined' ? undefined : window.speechSynthesis;
  const end = (failed = false, cancelNative = false) => {
    if (done) return;
    done = true; clearTimeout(timer); current = undefined;
    // Cancel before onEnd: that callback can synchronously start a new reader.
    if (cancelNative) { try { synth?.cancel(); } catch { /* Already quiet. */ } }
    if (failed) onNoVoice?.();
    onEnd?.();
  };
  const choice = savedVoiceChoice();
  const local = resolveLocalVoice(choice.names[language], language);
  if (typeof window === 'undefined' || (!local && (!window.speechSynthesis || !window.SpeechSynthesisUtterance))) { end(true); return () => undefined; }
  // «بلغة بلده ولهجتها»: his country's accent (fr-CA, es-MX), or for Arabic his dialect (else his Arab country's).
  const country = currentStoreCountry();
  const spokenDialect = language === 'ar' ? dialect || resolveDialect({ choice: savedDialectChoice(), texts: [], country }) : undefined;
  const locale = speechLocaleFor(language, country, spokenDialect);
  const chunks = splitShaheenSpeech(spokenReply(text, { language, dialect: spokenDialect, words: Infinity, locale }).say);
  if (!chunks.length) { end(); return () => undefined; }
  if (local) {
    try { synth?.cancel(); } catch { /* No queue. */ }
    const stop = playLocalVoice(chunks, { name: local.name, language, rate: choice.rate, pitch: choice.pitch,
      onEnd: () => end(), onError: () => end(true) });
    return () => { stop(); end(); };
  }
  let voices: SpeechSynthesisVoice[] = [];
  try { voices = synth!.getVoices(); } catch { /* No voice list yet: the engine picks one for the locale. */ }
  if (deviceLacksVoice(voices, language)) { end(true); return () => undefined; }
  // «صوت شاهين»: the voice, pitch and pace the visitor chose (or Shaheen's usual voice).
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
      current = utterance;
      utterance.onend = () => { if (done || current !== utterance) return; clearTimeout(timer); current = undefined; index += 1; next(); };
      utterance.onerror = () => { if (current === utterance) end(true); };
      timer = setTimeout(() => { if (current === utterance) end(true, true); }, Math.max(20000, chunks[index]!.length * 180));
      synth!.speak(current);
    } catch { end(true, true); }
  };
  try { synth!.cancel(); } catch { /* Nothing queued. */ }
  next();
  return () => end(false, true);
}
