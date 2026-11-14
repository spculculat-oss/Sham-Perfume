/**
 * «اسمع الرد»: the speaker button under a reply. The reply is said the way Shaheen talks (src/utils/spokenReply.ts),
 * in the visitor's dialect, sentence by sentence.
 *
 * «صوت شاهين البشري» (the owner's decision, 2026-11-14): only the human voices speak — the sentences recorded on the
 * site in the man's or woman's voice he chose, and every other sentence in the human voice from our server
 * (src/utils/humanVoice.ts), with the pronunciations visitors taught. The device's robotic voices are gone: when the
 * human voice cannot play, the written reply stays and the visitor is told (onNoVoice).
 */
import type { SupportedLanguage } from '../types/i18n';
import { resolveDialect, savedDialectChoice, type Dialect } from './arabicDialect';
import { speechLocaleFor, splitShaheenSpeech } from './shaheenVoice';
import { savedVoiceChoice } from './voiceChoice';
import { spokenReply } from './spokenReply';
import { currentStoreCountry } from './storeCheckout';
import { clipFinder, clipGender } from './humanVoiceClips';
import { loadSharedSayWords, playHumanSpeech, sayItRight, unlockHumanVoice } from './humanVoice';

/** Reads the reply aloud; returns a function that stops it. `onEnd` runs once (finished, failed or stopped). */
export function readAloud(text: string, { language, dialect, onEnd, onNoVoice }: {
  language: SupportedLanguage; dialect?: Dialect; onEnd?: () => void;
  /** The human voice could not play (server busy or unreachable, audio blocked). The written reply remains. */
  onNoVoice?: () => void;
}): () => void {
  let done = false;
  const end = (failed = false) => {
    if (done) return;
    done = true;
    if (failed) onNoVoice?.();
    onEnd?.();
  };
  if (typeof window === 'undefined') { end(true); return () => undefined; }
  // «بلغة بلده ولهجتها»: his country's accent, or for Arabic his dialect (else his Arab country's).
  const country = currentStoreCountry();
  const spokenDialect = language === 'ar' ? dialect || resolveDialect({ choice: savedDialectChoice(), texts: [], country }) : undefined;
  const locale = speechLocaleFor(language, country, spokenDialect);
  const chunks = splitShaheenSpeech(sayItRight(spokenReply(text, { language, dialect: spokenDialect, words: Infinity, locale }).say));
  if (!chunks.length) { end(); return () => undefined; }
  // Inside the tap: phones then allow the voice to play once it arrives.
  unlockHumanVoice();
  void loadSharedSayWords();
  const choice = savedVoiceChoice();
  const gender = clipGender(choice.gender);
  const stop = playHumanSpeech(chunks, {
    language, ...(spokenDialect ? { dialect: spokenDialect } : {}), gender, rate: choice.rate / 0.96, clipFor: clipFinder(gender),
    onEnd: () => end(), onError: () => end(true),
  });
  return () => { stop(); end(); };
}
