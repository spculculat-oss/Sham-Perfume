/**
 * «صوت شاهين البشري» in the browser — the owner's request (2026-11-14): every reply said in a professional human
 * voice (a man's or a woman's), unlimited sentences, not only the few recorded lines in public/voice-clips/.
 *
 * Order, for every line Shaheen says:
 *   1. a recorded clip only when the whole line is one (src/utils/humanVoiceClips.ts) — never mixed into a longer
 *      reply, where a different voice for one sentence sounded like a cut (the owner, 2026-11-14: «الصوت بيقطع»);
 *   2. the human voice from our server (POST /api/voice/speak, server/voiceSpeak.ts), sentence group by sentence
 *      group, the next one fetched as soon as the current one is ready, so there are no gaps;
 *   3. nothing when neither can play: the reply stays written in the chat (the device's voices were removed).
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
  constructor(public status: number, public code: string, public retryMs = 0) { super(`voice ${status} ${code}`); }
}
/** How long the server's answer asks us to leave the voice alone (0 = just try again). */
export function restFor(error: { status: number; code: string; retryMs?: number }): number {
  if (error.status === 429) return 20_000;
  if (error.code === 'voice_busy') return error.retryMs ? Math.min(60 * 60_000, error.retryMs) : OFF_MS;
  if (error.code === 'voice_off') return OFF_MS;
  return 0;
}
/** «Free again in a few seconds» (a per-minute limit): worth waiting for instead of cutting the reply. */
export const SHORT_WAIT_MS = 25_000;

/**
 * The playing reply: call it to stop. `pause()` / `resume()` hold it exactly where it is (the sentence is not
 * lost — «القطع المناسب»: he stops to listen while it is decided whether the visitor is talking to him), and
 * `duck(true)` lowers it while a voice nearby is being judged.
 */
export interface HumanSpeechHandle {
  (): void;
  pause(): void;
  resume(): void;
  duck(on: boolean): void;
  readonly paused: boolean;
}

/** Plays the reply in the human voice. */
export function playHumanSpeech(chunks: readonly string[], options: HumanSpeechOptions): HumanSpeechHandle {
  const findClip = options.clipFor || (() => undefined);
  // One request for a whole reply when it fits (the free voice allows only a few requests): fewer requests, and no
  // seam between parts in the middle of what he says.
  const plain = speechGroups(chunks, 480, 480);
  // A recorded line only when it is the whole thing (one voice through a reply).
  const clipFor = plain.length === 1 && findClip(plain[0]!) ? findClip : () => undefined;
  const groups = plain;
  const server = humanVoiceAvailable();
  let done = false;
  let index = 0;
  let held = false;
  let ducked = false;
  let waiting: (() => void) | null = null; // a group ready to start while he is held
  let systemPauses = 0;
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
        const retry = Number(response.headers.get('retry-after'));
        throw new VoiceRefusal(response.status, await response.json().then((body: { code?: unknown }) => String(body?.code || '')).catch(() => ''), Number.isFinite(retry) && retry > 0 ? retry * 1000 : 0);
      }
      const url = URL.createObjectURL(await response.blob());
      urls.push(url);
      return url;
    });
    // Only «busy» / «off» / «too many» rests the voice; a one-off failure (a network hiccup, one engine glitch) is
    // asked once more — before 2026-11-14 any failure silenced him for ten minutes.
    // «الصوت بيقطع»: the engine's per-minute limit used to end the reply in the middle; a wait of a few seconds is
    // now waited (the next part comes a little later) instead of cutting him off.
    job = ask().catch((error: unknown) => {
      if (controller.signal.aborted) throw error;
      const refusal = error instanceof VoiceRefusal ? error : undefined;
      if (refusal?.code === 'voice_busy' && refusal.retryMs > 0 && refusal.retryMs <= SHORT_WAIT_MS) {
        return new Promise<void>((resolve) => { setTimeout(resolve, refusal.retryMs + 300); }).then(ask);
      }
      const rest = refusal ? restFor(refusal) : 0;
      if (rest) { restHumanVoice(rest); throw error; }
      return new Promise<void>((resolve) => { setTimeout(resolve, 600); }).then(ask);
    });
    job.catch(() => undefined);
    jobs.set(i, job);
    return job;
  };
  const cleanup = () => {
    clearTimeout(timer);
    waiting = null;
    controller.abort();
    if (audio) {
      audio.onplaying = null; audio.onended = null; audio.onerror = null; audio.onloadedmetadata = null; audio.onpause = null;
      try { audio.pause(); } catch { /* Already stopped. */ }
      try { audio.volume = 1; } catch { /* Fixed volume (iPhone). */ }
    }
    setTimeout(() => urls.splice(0).forEach((url) => { try { URL.revokeObjectURL(url); } catch { /* Gone. */ } }), 0);
  };
  const fail = () => { if (done) return; done = true; const rest = groups.slice(index); cleanup(); options.onError(rest); };
  const finish = () => { if (done) return; done = true; cleanup(); options.onEnd(); };
  /** A stall guard: what is left of this group at its pace, plus a margin. */
  const guard = () => {
    if (!audio) return;
    clearTimeout(timer);
    const left = Number.isFinite(audio.duration) ? Math.max(0, audio.duration - (audio.currentTime || 0)) : 60;
    timer = setTimeout(fail, (left / Math.max(0.5, audio.playbackRate || 1)) * 1000 + 6000);
  };

  const playGroup = (i: number) => {
    if (done) return;
    if (i >= groups.length) { finish(); return; }
    index = i;
    fetchGroup(i).then((url) => {
      if (done || !audio) return;
      // The next group is asked for now, while this one plays, so it is ready when this one ends.
      if (i + 1 < groups.length) void fetchGroup(i + 1);
      const start = () => {
        waiting = null;
        if (done) return;
        clearTimeout(timer);
        systemPauses = 0;
        audio.onplaying = () => { if (!done) options.onChunk?.(groups[i]!, i, groups); };
        audio.onloadedmetadata = () => { if (!held) guard(); };
        audio.onended = () => { clearTimeout(timer); playGroup(i + 1); };
        audio.onerror = () => fail();
        // A phone may pause the sound by itself (the microphone opening, a notification): it is started again.
        audio.onpause = () => {
          if (done || held || audio.ended || systemPauses >= 3) return;
          systemPauses += 1;
          setTimeout(() => { if (!done && !held && audio.paused && !audio.ended) void audio.play().catch(() => undefined); }, 200);
        };
        audio.src = url;
        // His chosen pace, kept natural (a human voice sped up or slowed much sounds wrong).
        audio.playbackRate = Math.min(1.15, Math.max(0.9, options.rate || 1));
        try { audio.volume = ducked ? 0.3 : 1; } catch { /* Fixed volume (iPhone). */ }
        timer = setTimeout(fail, 8000);
        void audio.play().catch(() => fail());
      };
      if (held) waiting = start; else start();
    }, () => fail());
  };

  const stop = (() => { if (done) return; done = true; cleanup(); }) as HumanSpeechHandle;
  Object.defineProperty(stop, 'paused', { get: () => held });
  stop.pause = () => {
    if (done || held) return;
    held = true;
    clearTimeout(timer);
    try { audio?.pause(); } catch { /* Nothing playing. */ }
  };
  stop.resume = () => {
    if (done || !held) return;
    held = false;
    if (waiting) { waiting(); return; }
    if (audio && audio.src && audio.paused && !audio.ended) { guard(); void audio.play().catch(() => fail()); }
  };
  stop.duck = (on: boolean) => {
    ducked = on;
    if (!done && audio) { try { audio.volume = on ? 0.3 : 1; } catch { /* Fixed volume (iPhone). */ } }
  };

  if (!audio || !groups.length) {
    setTimeout(() => (groups.length ? fail() : finish()), 0);
    const idle = (() => { done = true; }) as HumanSpeechHandle;
    Object.defineProperty(idle, 'paused', { get: () => false });
    idle.pause = () => undefined; idle.resume = () => undefined; idle.duck = () => undefined;
    return idle;
  }
  playGroup(0);
  return stop;
}
