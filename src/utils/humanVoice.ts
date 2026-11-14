/**
 * «صوت شاهين البشري» in the browser — the owner's request (2026-11-14): every reply said in a professional human
 * voice (a man's or a woman's), unlimited sentences, not only the few recorded lines in public/voice-clips/.
 *
 * Order, for every line Shaheen says:
 *   1. a recorded clip when the whole line is one (src/utils/humanVoiceClips.ts — the owner's chosen voices);
 *   2. the human voice from our server (POST /api/voice/speak, server/voiceSpeak.ts), sentence group by sentence
 *      group, the next one fetched while the current one plays, so there are no gaps;
 *   3. the visitor's device voice — whenever the server is busy, its free quota is used up, or audio cannot play.
 *      The rest of the reply continues there; Shaheen never goes silent.
 *
 * «بيتعلم النطق من الناس»: the pronunciations visitors taught (src/utils/sayWords.ts) are applied to every line first.
 */
import { apiUrl, isStaticHosting } from './api';
import type { SupportedLanguage } from '../types/i18n';
import type { Dialect } from './arabicDialect';
import type { VoiceGender } from './voiceChoice';
import { applySayWords, cleanSayPair, mergeSayWords, sayKey, type SayPair, type SayWords } from './sayWords';

const OWN_KEY = 'sham_voice_say_v1';
const OFF_MS = 10 * 60_000;
let offUntil = 0;
let shared: SayWords = {};
let sharedLoad: Promise<void> | undefined;

/** The pronunciations this visitor taught (kept on his device). */
export function savedSayWords(): SayWords {
  try {
    const data = JSON.parse(window.localStorage.getItem(OWN_KEY) || '{}') as unknown;
    return data && typeof data === 'object' && !Array.isArray(data) ? mergeSayWords({}, data as SayWords) : {};
  } catch { return {}; }
}
/** Keeps a taught pronunciation here and tells the server (text only, no visitor id). */
export function saveSayWord(pair: SayPair): void {
  const clean = cleanSayPair(pair.from, pair.to);
  if (!clean) return;
  try {
    const own = savedSayWords();
    own[sayKey(clean.from)] = clean.to;
    const keep = Object.entries(own).slice(-300);
    window.localStorage.setItem(OWN_KEY, JSON.stringify(Object.fromEntries(keep)));
  } catch { /* Private mode: used for this conversation only. */ }
  shared = { ...shared, [sayKey(clean.from)]: clean.to };
  if (isStaticHosting || typeof fetch === 'undefined') return;
  void fetch(apiUrl('/api/voice/say-words'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clean), keepalive: true,
  }).catch(() => undefined);
}
/** What everyone taught (loaded once, in the background). */
export function loadSharedSayWords(): Promise<void> {
  if (isStaticHosting || typeof fetch === 'undefined') return Promise.resolve();
  sharedLoad ??= fetch(apiUrl('/api/voice/say-words'), { signal: AbortSignal.timeout(8000) })
    .then((r) => (r.ok ? r.json() : undefined))
    .then((data: { words?: SayWords } | undefined) => { if (data?.words && typeof data.words === 'object') shared = { ...data.words, ...shared }; })
    .catch(() => { sharedLoad = undefined; });
  return sharedLoad;
}
/** The line as Shaheen should say it: everyone's taught words, his own taught words winning. */
export const sayItRight = (text: string): string => applySayWords(text, mergeSayWords(shared, typeof window === 'undefined' ? {} : savedSayWords()));

/** Can the human voice be tried now? (not on a site without our server, not right after it said «busy»). */
export const humanVoiceAvailable = (now = Date.now()): boolean =>
  !isStaticHosting && typeof window !== 'undefined' && typeof Audio !== 'undefined' && typeof fetch !== 'undefined' && now >= offUntil;
/** The server said busy / quota used up: the reply stays written for a while (no waiting on every reply). */
export const restHumanVoice = (ms = OFF_MS, now = Date.now()) => { offUntil = Math.max(offUntil, now + ms); };

/**
 * Sentences joined into groups: a short first one (he starts talking sooner), then longer ones (fewer requests,
 * smoother breathing between ideas). A sentence with a recorded clip (`isClip`) is always a group of its own.
 */
export function speechGroups(chunks: readonly string[], first = 180, rest = 480, isClip: (sentence: string) => boolean = () => false): string[] {
  const out: string[] = [];
  let open = false; // the last group can still take more sentences
  for (const raw of chunks) {
    for (const sentence of raw.replace(/\s+/g, ' ').trim().split(/(?<=[.!?؟؛…])\s+/u)) {
      const chunk = sentence.trim();
      if (!chunk) continue;
      if (isClip(chunk)) { out.push(chunk); open = false; continue; }
      const last = out[out.length - 1];
      const limit = out.length === 1 ? first : rest;
      if (open && last !== undefined && last.length + 1 + chunk.length <= limit) out[out.length - 1] = `${last} ${chunk}`;
      else { out.push(chunk); open = true; }
    }
  }
  return out;
}

// A tiny silent WAV: played inside the visitor's tap so phones allow the voice to play later in the conversation.
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
let player: HTMLAudioElement | undefined;
const sharedPlayer = () => (player ??= new Audio());
/** Call from a tap (the voice button, «اسمع الرد»): unlocks audio on phones. */
export function unlockHumanVoice(): void {
  // He asked for the voice himself: an earlier «busy» rest gives way to one fresh try.
  offUntil = 0;
  if (typeof Audio === 'undefined') return;
  try {
    const audio = sharedPlayer();
    if (audio.src && !audio.paused) return;
    audio.src = SILENT;
    void audio.play().catch(() => undefined);
  } catch { /* Audio blocked: the reply stays written. */ }
}

export interface HumanSpeechOptions {
  language: SupportedLanguage; dialect?: Dialect; gender: VoiceGender; mood?: 'calm' | 'quick' | 'warm'; rate?: number;
  /** A group starts playing (index into the groups returned by speechGroups). */
  onChunk?: (chunk: string, index: number, groups: string[]) => void;
  onEnd: () => void;
  /** It stopped before the end (the server could not say a sentence): the groups not yet said. */
  onError: (rest: string[]) => void;
  /** The site's recorded clip for a sentence, if there is one (played without asking the server). */
  clipFor?: (sentence: string) => string | undefined;
}

class VoiceRefusal extends Error {
  constructor(public status: number, public code: string) { super(`voice ${status} ${code}`); }
}
/** How long the server's answer asks us to leave the voice alone (0 = just try again). */
export function restFor(error: { status: number; code: string }): number {
  if (error.status === 429) return 20_000;
  if (error.code === 'voice_busy' || error.code === 'voice_off') return OFF_MS;
  return 0;
}

/** Plays the reply in the human voice. Returns a stop function. */
export function playHumanSpeech(chunks: readonly string[], options: HumanSpeechOptions): () => void {
  const clipFor = options.clipFor || (() => undefined);
  const groups = speechGroups(chunks, 180, 480, (sentence) => Boolean(clipFor(sentence)));
  const server = humanVoiceAvailable();
  let done = false;
  let index = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  const urls: string[] = [];
  const jobs = new Map<number, Promise<string>>();
  const audio = typeof Audio === 'undefined' ? undefined : sharedPlayer();

  const fetchGroup = (i: number): Promise<string> => {
    let job = jobs.get(i);
    if (job) return job;
    const clip = clipFor(groups[i]!);
    if (clip) { job = Promise.resolve(clip); jobs.set(i, job); return job; }
    if (!server) { job = Promise.reject(new Error('no voice server')); job.catch(() => undefined); jobs.set(i, job); return job; }
    const ask = () => fetch(apiUrl('/api/voice/speak'), {
      method: 'POST', signal: AbortSignal.any ? AbortSignal.any([controller.signal, AbortSignal.timeout(i === 0 ? 15_000 : 25_000)]) : controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: groups[i], language: options.language, dialect: options.dialect, gender: options.gender, mood: options.mood }),
    }).then(async (response) => {
      if (!response.ok || !(response.headers.get('content-type') || '').includes('audio')) {
        throw new VoiceRefusal(response.status, await response.json().then((body: { code?: unknown }) => String(body?.code || '')).catch(() => ''));
      }
      const url = URL.createObjectURL(await response.blob());
      urls.push(url);
      return url;
    });
    // Only «busy» / «off» / «too many» rests the voice; a one-off failure (a network hiccup, one engine glitch) is
    // asked once more — before 2026-11-14 any failure silenced him for ten minutes.
    job = ask().catch((error: unknown) => {
      if (controller.signal.aborted) throw error;
      const rest = error instanceof VoiceRefusal ? restFor(error) : 0;
      if (rest) { restHumanVoice(rest); throw error; }
      return new Promise<void>((resolve) => { setTimeout(resolve, 600); }).then(ask);
    });
    job.catch(() => undefined);
    jobs.set(i, job);
    return job;
  };
  const cleanup = () => {
    clearTimeout(timer);
    controller.abort();
    if (audio) { audio.onplaying = null; audio.onended = null; audio.onerror = null; audio.onloadedmetadata = null; try { audio.pause(); } catch { /* Already stopped. */ } }
    setTimeout(() => urls.splice(0).forEach((url) => { try { URL.revokeObjectURL(url); } catch { /* Gone. */ } }), 0);
  };
  const fail = () => { if (done) return; done = true; const rest = groups.slice(index); cleanup(); options.onError(rest); };
  const finish = () => { if (done) return; done = true; cleanup(); options.onEnd(); };

  const playGroup = (i: number) => {
    if (done) return;
    if (i >= groups.length) { finish(); return; }
    index = i;
    fetchGroup(i).then((url) => {
      if (done || !audio) return;
      clearTimeout(timer);
      audio.onplaying = () => {
        if (done) return;
        if (i + 1 < groups.length) void fetchGroup(i + 1);
        options.onChunk?.(groups[i]!, i, groups);
      };
      audio.onloadedmetadata = () => {
        const seconds = Number.isFinite(audio.duration) ? audio.duration : 60;
        clearTimeout(timer);
        timer = setTimeout(fail, (seconds / Math.max(0.5, audio.playbackRate || 1)) * 1000 + 6000);
      };
      audio.onended = () => { clearTimeout(timer); playGroup(i + 1); };
      audio.onerror = () => fail();
      audio.src = url;
      // His chosen pace, kept natural (a human voice sped up or slowed much sounds wrong).
      audio.playbackRate = Math.min(1.15, Math.max(0.9, options.rate || 1));
      timer = setTimeout(fail, 8000);
      void audio.play().catch(() => fail());
    }, () => fail());
  };

  if (!audio || !groups.length) {
    setTimeout(() => (groups.length ? fail() : finish()), 0);
    return () => { done = true; };
  }
  playGroup(0);
  return () => { if (done) return; done = true; cleanup(); };
}
