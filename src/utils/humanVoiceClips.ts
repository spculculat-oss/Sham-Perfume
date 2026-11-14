/**
 * «أصوات بشرية محفوظة على الموقع» — the owner's request (2026-11-14): the short lines Shaheen says most often in
 * voice chat are recorded once in professional human voices (a man and a woman, Egyptian Arabic, chosen by the
 * owner) and stored with the site in public/voice-clips/. No paid voice service is called at run time: the browser
 * plays a small mp3 (~10 KB). Every other line is said in the human voice from our server (src/utils/humanVoice.ts),
 * and the visitor's device voice only when that server cannot.
 *
 * A clip plays only when the WHOLE line is exactly a recorded one (punctuation and spaces aside), so the words heard
 * are always the words written in the chat.
 */
import type { VoiceGender } from './voiceChoice';

/** Recorded lines (Egyptian Arabic) → file name in public/voice-clips/<male|female>/. */
export const HUMAN_CLIPS = {
  'ask-done': 'خلصت ولا لسه؟',
  patience: 'اصبر عليا شوية، براجع البيانات.',
  lookup: 'ثواني أدخل أشوفلك البيانات.',
  repeat: 'معلش ماسمعتكش كويس، ممكن تعيد تاني؟',
} as const;
export type HumanClipId = keyof typeof HUMAN_CLIPS;
export const CLIP_GENDERS: readonly VoiceGender[] = ['male', 'female'];

/** Letters only: punctuation, spaces, tatweel and short vowels never decide a match. */
const fold = (text: string) => text.normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
const BY_TEXT = new Map<string, HumanClipId>(Object.entries(HUMAN_CLIPS).map(([id, line]) => [fold(line), id as HumanClipId]));

/** The recorded clip for this exact line, if there is one. */
export const humanClipId = (text: string): HumanClipId | undefined => (text ? BY_TEXT.get(fold(text)) : undefined);

/** Where the clip lives on the site (GitHub Pages serves the site under /Sham-Perfume/). */
export function humanClipUrl(id: HumanClipId, gender: VoiceGender = 'male', base = import.meta.env?.BASE_URL || '/'): string {
  return `${base.endsWith('/') ? base : `${base}/`}voice-clips/${gender === 'female' ? 'female' : 'male'}/${id}.mp3`;
}

/** Which recorded voice fits: the visitor's chosen gender, else the voice he picked, else Shaheen's own (a man's). */
export const clipGender = (...hints: (VoiceGender | undefined)[]): VoiceGender => hints.find((g) => g === 'male' || g === 'female') || 'male';

/**
 * Plays one clip. Returns a stop function. Never hangs: a clip that cannot start or end in time reports an error, and
 * the caller falls back to the device voice.
 */
export function playHumanClip(url: string, options: { rate?: number; onStart?: () => void; onEnd: () => void; onError: () => void }): () => void {
  let done = false;
  let audio: HTMLAudioElement | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    clearTimeout(timer);
    if (audio) { audio.onplaying = null; audio.onended = null; audio.onerror = null; try { audio.pause(); } catch { /* Already stopped. */ } audio = undefined; }
  };
  const finish = (failed: boolean) => { if (done) return; done = true; stop(); if (failed) options.onError(); else options.onEnd(); };
  try {
    if (typeof Audio === 'undefined') throw new Error('No audio');
    audio = new Audio(url);
    audio.preload = 'auto';
    // His chosen pace, kept natural (a human voice sped up or slowed much sounds wrong).
    audio.playbackRate = Math.min(1.15, Math.max(0.9, options.rate || 1));
    audio.onplaying = () => { clearTimeout(timer); timer = setTimeout(() => finish(false), 12_000); options.onStart?.(); };
    audio.onended = () => finish(false);
    audio.onerror = () => finish(true);
    timer = setTimeout(() => finish(true), 5_000);
    void audio.play().catch(() => finish(true));
  } catch { setTimeout(() => finish(true), 0); }
  return () => { done = true; stop(); };
}
