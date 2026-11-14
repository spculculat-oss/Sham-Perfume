/**
 * «صوت شاهين البشري» — the owner's request (2026-11-14): Shaheen's replies said in a professional human voice
 * (a man's or a woman's, Egyptian Arabic for Arabic visitors), not the device's robotic voice.
 *
 *   GET  /api/voice/status                                           →  { human: boolean }
 *   POST /api/voice/speak  { text, language, dialect?, gender, mood? }  →  audio/wav (24 kHz mono)
 *   GET  /api/voice/say-words                                        →  { words: { written: said } }
 *   POST /api/voice/say-words  { from, to }                           →  { ok }   (src/utils/sayWords.ts)
 *
 * «صوت مرن»: the same voice, its delivery following the conversation — calmer and gentler for someone upset,
 * brisker for someone in a hurry (the mood src/utils/voiceChoice.ts already reads from his words).
 *
 * The owner's rule (2026-10-22): use the AI platforms while they work, otherwise rely on ourselves. So the speech
 * engine's free tier is used through the key already on the server (GEMINI_API_KEY); when it is busy or its daily
 * quota is used up, this answers 503 and the chat shows the words (the owner removed the device voices on
 * 2026-11-14) — never a paid fallback. Visitors never see a vendor's name.
 *
 * Environment (Vercel):
 *   SHAM_VOICE_ENGINE        'off' turns it off (default: on whenever GEMINI_API_KEY exists)
 *   SHAM_VOICE_MODEL         default gemini-3.8-flash-lite-tts (made for conversational voice agents); two others back it up
 *   SHAM_VOICE_DAILY_LIMIT   default 400 speech requests a day per server instance (max 5000)
 *   SHAM_VOICE_MALE / SHAM_VOICE_FEMALE   prebuilt voice names (default Achird «friendly» / Sulafat «warm»)
 */
import express from 'express';
import { createHash } from 'node:crypto';
import { RateLimiter, clientKey } from './core/rateLimit';
import type { ShaheenMemory } from './core/memory';
import { cleanSayPair, sayKey } from '../src/utils/sayWords';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../src/types/i18n';

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;
export type SpeechGender = 'male' | 'female';
export type SpeechMood = 'calm' | 'quick' | 'warm';
const MOOD_STYLE: Record<SpeechMood, string> = {
  calm: 'calm, gentle and reassuring, a little slower', quick: 'brisk and to the point, slightly faster', warm: 'warm and friendly',
};

// 2026-11-14 live probe: the Interactions endpoint answered 400 «invalid argument» to every TTS model while
// `models/<m>:generateContent` returned audio for all of them on the same key — so speech goes through generateContent.
const API = 'https://generativelanguage.googleapis.com/v1beta/models';
/** When the chosen model is busy or refuses, the next one says the line (each has its own free quota). */
const BACKUP_MODELS = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts', 'gemini-2.5-flash-preview-tts'];
export const voiceModels = (env: Env) => [...new Set([voiceModel(env), ...BACKUP_MODELS])].slice(0, 3);
const LANGS = new Set<string>(SUPPORTED_LANGUAGES.map((l) => l.code));
export const MAX_SPEECH_CHARS = 500;
const DIALECT_STYLE: Record<string, string> = {
  egyptian: 'Egyptian Arabic accent', gulf: 'Gulf Arabic accent', levantine: 'Levantine Arabic accent', iraqi: 'Iraqi Arabic accent',
  maghrebi: 'Moroccan Arabic accent', sudanese: 'Sudanese Arabic accent', yemeni: 'Yemeni Arabic accent', msa: 'clear Modern Standard Arabic',
};

export const voiceEnabled = (env: Env) => Boolean(env.GEMINI_API_KEY?.trim()) && (env.SHAM_VOICE_ENGINE || '').trim().toLowerCase() !== 'off';
export const voiceModel = (env: Env) => (env.SHAM_VOICE_MODEL || '').trim() || 'gemini-3.8-flash-lite-tts';
export const dailyVoiceLimit = (env: Env) => { const n = Math.floor(Number(env.SHAM_VOICE_DAILY_LIMIT)); return n > 0 ? Math.min(5000, n) : 400; };
const voiceName = (env: Env, gender: SpeechGender) => (gender === 'female' ? env.SHAM_VOICE_FEMALE : env.SHAM_VOICE_MALE)?.trim() || (gender === 'female' ? 'Sulafat' : 'Achird');

/** One short, constant delivery note per accent (the engine's own advice: no long persona on every turn). */
export function speechStyle(language: SupportedLanguage, dialect?: string, mood: SpeechMood = 'warm'): string {
  const delivery = `${MOOD_STYLE[mood] || MOOD_STYLE.warm}, natural conversational pace`;
  return language === 'ar' ? `${DIALECT_STYLE[dialect || 'egyptian'] || DIALECT_STYLE.egyptian}, ${delivery}` : delivery;
}

/** The visitor-facing text as a plain transcript: angle brackets would be read as vocal tags, so they go. */
export function speechText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[<>]/g, ' ').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_SPEECH_CHARS);
}

export interface SpeechRequest { text: string; language: SupportedLanguage; dialect?: string; gender: SpeechGender; mood?: SpeechMood }
export function cleanSpeechRequest(body: unknown): SpeechRequest | undefined {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const text = speechText(b.text);
  if (!text || !/\p{L}/u.test(text)) return undefined;
  const language = typeof b.language === 'string' && LANGS.has(b.language) ? b.language as SupportedLanguage : 'ar';
  const dialect = typeof b.dialect === 'string' && DIALECT_STYLE[b.dialect] ? b.dialect : undefined;
  const mood = b.mood === 'calm' || b.mood === 'quick' ? b.mood : undefined;
  return { text, language, ...(dialect ? { dialect } : {}), gender: b.gender === 'female' ? 'female' : 'male', ...(mood ? { mood } : {}) };
}

/** The engine's documented single-speaker form: a short delivery note, a colon, then the exact words. */
export function speechPrompt(req: SpeechRequest): string {
  return `Say this in a ${speechStyle(req.language, req.dialect, req.mood)}: ${req.text}`;
}

export function speechBody(env: Env, req: SpeechRequest) {
  return {
    contents: [{ role: 'user', parts: [{ text: speechPrompt(req) }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName(env, req.gender) } } },
    },
  };
}

/** Raw 16-bit mono PCM («audio/L16; rate=24000») wrapped in a WAV header so every browser can play it. */
export function pcmToWav(pcm: Buffer, rate = 24000): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** The audio in the engine's reply (`candidates[].content.parts[].inlineData`, or the older `steps[].content[]`), as WAV bytes. */
export function audioFromReply(data: unknown): Buffer | undefined {
  const blocks: Array<{ mime: string; data: string }> = [];
  const candidates = (data as { candidates?: unknown[] })?.candidates;
  if (Array.isArray(candidates)) {
    for (const c of candidates) {
      const parts = (c as { content?: { parts?: unknown[] } })?.content?.parts;
      if (!Array.isArray(parts)) continue;
      for (const part of parts) {
        const inline = (part as { inlineData?: { mimeType?: unknown; data?: unknown } })?.inlineData;
        if (inline && typeof inline.data === 'string' && inline.data) blocks.push({ mime: String(inline.mimeType || ''), data: inline.data });
      }
    }
  }
  const steps = (data as { steps?: unknown[] })?.steps;
  if (Array.isArray(steps)) {
    for (const step of steps) {
      const content = (step as { content?: unknown[] })?.content;
      if (!Array.isArray(content)) continue;
      for (const c of content) {
        const item = c as { type?: string; data?: unknown; mime_type?: unknown };
        if (item?.type === 'audio' && typeof item.data === 'string' && item.data) blocks.push({ mime: String(item.mime_type || 'audio/wav'), data: item.data });
      }
    }
  }
  const pcmParts: Buffer[] = [];
  let rate = 24000;
  for (const block of blocks) {
    const bytes = Buffer.from(block.data, 'base64');
    if (bytes.length > 44 && bytes.toString('ascii', 0, 4) === 'RIFF') return bytes;
    if (/l16|pcm/i.test(block.mime)) {
      const m = /rate=(\d{4,6})/i.exec(block.mime);
      if (m) rate = Number(m[1]);
      pcmParts.push(bytes);
    }
  }
  const pcm = Buffer.concat(pcmParts);
  return pcm.length > 0 ? pcmToWav(pcm, rate) : undefined;
}

export class SpeechError extends Error {
  constructor(public status: number, public code: 'voice_off' | 'voice_busy' | 'voice_failed') { super(code); }
}

/** Per-instance day budget (resets with the UTC date) and a pause after the engine says «quota». */
export class VoiceBudget {
  private day = '';
  private used = 0;
  pausedUntil = 0;
  constructor(private limit: number) {}
  take(now = Date.now()): boolean {
    const day = new Date(now).toISOString().slice(0, 10);
    if (day !== this.day) { this.day = day; this.used = 0; }
    if (now < this.pausedUntil || this.used >= this.limit) return false;
    this.used += 1;
    return true;
  }
  pause(ms: number, now = Date.now()) { this.pausedUntil = Math.max(this.pausedUntil, now + ms); }
  available(now = Date.now()) { return now >= this.pausedUntil && (new Date(now).toISOString().slice(0, 10) !== this.day || this.used < this.limit); }
}

/** A small memory of recent lines («خلصت ولا لسه؟» said a hundred times costs one request). */
class AudioCache {
  private map = new Map<string, Buffer>();
  private bytes = 0;
  constructor(private maxBytes = 24 * 1024 * 1024) {}
  get(key: string) { const v = this.map.get(key); if (v) { this.map.delete(key); this.map.set(key, v); } return v; }
  set(key: string, value: Buffer) {
    if (value.length > this.maxBytes / 4) return;
    if (this.map.has(key)) return;
    this.map.set(key, value); this.bytes += value.length;
    for (const [k, v] of this.map) { if (this.bytes <= this.maxBytes) break; this.map.delete(k); this.bytes -= v.length; }
  }
}

export async function synthesize(env: Env, req: SpeechRequest, budget: VoiceBudget, fetcher: Fetch = fetch): Promise<Buffer> {
  if (!voiceEnabled(env)) throw new SpeechError(503, 'voice_off');
  if (!budget.take()) throw new SpeechError(503, 'voice_busy');
  const body = JSON.stringify(speechBody(env, req));
  let busy = 0;
  const models = voiceModels(env);
  for (const model of models) {
    let response: Response;
    try {
      response = await fetcher(`${API}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', signal: AbortSignal.timeout(20_000),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY!.trim() },
        body,
      });
    } catch { continue; }
    if (response.status === 401 || response.status === 403) { budget.pause(6 * 3600_000); throw new SpeechError(503, 'voice_off'); }
    if (response.status === 429) { busy += 1; continue; }
    if (!response.ok) continue;
    const audio = audioFromReply(await response.json().catch(() => undefined));
    if (audio) return audio;
  }
  if (busy === models.length) { budget.pause(30 * 60_000); throw new SpeechError(503, 'voice_busy'); }
  throw new SpeechError(503, 'voice_failed');
}

export function createVoiceRouter(deps: { env?: Env; fetch?: Fetch; memory?: ShaheenMemory } = {}) {
  const env = deps.env || process.env;
  const router = express.Router();
  const limiter = new RateLimiter(40, 60_000);
  const budget = new VoiceBudget(dailyVoiceLimit(env));
  const cache = new AudioCache();
  const pending = new Map<string, Promise<Buffer>>();

  router.get('/status', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ human: voiceEnabled(env) && budget.available() });
  });

  // «شاهين بيتعلم النطق من الناس»: what visitors taught often enough (text only, no visitor data).
  const teachLimiter = new RateLimiter(10, 60 * 60_000);
  const taught = new Set<string>();
  router.get('/say-words', async (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.json({ words: deps.memory ? await deps.memory.sayWords().catch(() => ({})) : {} });
  });
  router.post('/say-words', async (req, res) => {
    const pair = cleanSayPair(req.body?.from, req.body?.to);
    if (!pair) { res.status(400).json({ code: 'bad_request' }); return; }
    const who = clientKey(req);
    if (!teachLimiter.allow(who)) { res.status(429).setHeader('Retry-After', '600').json({ code: 'rate_limited' }); return; }
    // One visitor teaching the same thing many times counts once (only distinct people make it shared).
    const once = createHash('sha256').update(`${who}|${sayKey(pair.from)}|${sayKey(pair.to)}`).digest('base64url');
    if (taught.size > 20_000) taught.clear();
    if (!taught.has(once)) { taught.add(once); await deps.memory?.learnSayWord(pair.from, pair.to).catch(() => false); }
    res.json({ ok: true });
  });

  router.post('/speak', async (req, res) => {
    // The body is checked before the visitor's quota is touched (a bad request costs him nothing).
    const speech = cleanSpeechRequest(req.body);
    if (!speech) { res.status(400).json({ code: 'bad_request' }); return; }
    if (!limiter.allow(clientKey(req))) { res.status(429).setHeader('Retry-After', '20').json({ code: 'rate_limited' }); return; }
    const key = createHash('sha256').update(JSON.stringify([voiceModel(env), voiceName(env, speech.gender), speechStyle(speech.language, speech.dialect, speech.mood), speech.text])).digest('hex');
    try {
      let audio = cache.get(key);
      if (!audio) {
        let job = pending.get(key);
        if (!job) { job = synthesize(env, speech, budget, deps.fetch); pending.set(key, job); }
        try { audio = await job; } finally { pending.delete(key); }
        cache.set(key, audio);
      }
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(audio);
    } catch (error) {
      const e = error instanceof SpeechError ? error : new SpeechError(503, 'voice_failed');
      res.status(e.status).json({ code: e.code });
    }
  });
  return router;
}
