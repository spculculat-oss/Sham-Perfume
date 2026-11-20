/**
 * «أدوات الاستوديو الصوتية» — the audio features that came from Google AI Studio, rebuilt on our own server rules
 * instead of copying the studio's `server/aiTools.ts` (which this repository does not have):
 *
 *   POST /api/ai/transcribe  { audio: dataURL|base64, mimeType? }        →  { transcription }
 *   POST /api/music          { prompt, duration?, scentName?, scentNotes? } →  { audioBase64, mimeType, lyrics }
 *   POST /api/ai/tts         { text, language?, gender?, mood? }         →  { audioBase64, mimeType }
 *
 * Rules kept from this repository: the key already on the server (GEMINI_API_KEY) and no other, a per-visitor rate
 * limit, a daily free-tier budget that answers 503 instead of spending money (like server/voiceSpeak.ts), and the
 * visitors never see a vendor's name. Nothing is stored or logged: the clip and its text only pass through.
 */
import express from 'express';
import { RateLimiter, clientKey } from './core/rateLimit';
import { audioFromReply, SpeechError, VoiceBudget, cleanSpeechRequest, synthesize, voiceEnabled, ModelRest } from './voiceSpeak';
import type { SupportedLanguage } from '../src/types/i18n';

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;

const API = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Models tried in turn for a recording: whoever answers first wins (each has its own free quota). */
export const TRANSCRIBE_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest'] as const;
/** Music is a paid preview: when the key refuses it the page says so instead of retrying forever. */
export const MUSIC_MODELS = { clip: 'lyria-3-clip-preview', full: 'lyria-3-pro-preview' } as const;
export const MUSIC_DAILY_LIMIT = 20;
const TRANSCRIBE_INSTRUCTION =
  'Transcribe this audio recording verbatim in its original spoken language (Arabic, English, French, etc.). ' +
  'Output only the exact transcribed text, without introductions, translations or formatting tags.';

/** The biggest recording accepted (a few minutes of speech): 6 MB of base64 ≈ 4.5 MB of audio. */
export const MAX_AUDIO_BASE64 = 6 * 1024 * 1024;

/** `data:audio/webm;base64,xxx` or bare base64 → the bytes and their type, or nothing when it is not audio. */
export function readAudio(raw: unknown, mimeType: unknown): { data: string; mimeType: string } | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  let data = raw.trim();
  let mime = typeof mimeType === 'string' && mimeType.trim() ? mimeType.trim() : '';
  const match = /^data:([^;,]+)?(;base64)?,/.exec(data);
  if (match) {
    if (!mime && match[1]) mime = match[1];
    data = data.slice(match[0].length);
  }
  if (!mime) mime = 'audio/webm';
  if (!/^audio\/[a-z0-9.+-]+$/i.test(mime)) return undefined;
  if (!/^[A-Za-z0-9+/=\s]+$/.test(data)) return undefined;
  data = data.replace(/\s+/g, '');
  if (data.length < 32 || data.length > MAX_AUDIO_BASE64) return undefined;
  return { data, mimeType: mime };
}

/** The transcription in the engine's reply (the parts that are text, never the «thought» ones). */
export function transcriptionFromReply(data: unknown): string {
  const parts = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> })?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.filter((p) => !p.thought).map((p) => p.text || '').join('').trim();
}

/** A music prompt with the fragrance it belongs to (the studio's own enrichment, kept short). */
export function musicPrompt(prompt: unknown, scentName?: unknown, scentNotes?: unknown): string {
  const base = typeof prompt === 'string' ? prompt.replace(/\s+/g, ' ').trim().slice(0, 400) : '';
  if (!base) return '';
  const name = typeof scentName === 'string' ? scentName.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
  const notes = typeof scentNotes === 'string' ? scentNotes.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
  if (!name && !notes) return base;
  return `A rich, atmospheric instrumental piece inspired by the luxury fragrance "${name || 'Signature Scent'}". ` +
    `Olfactory notes: ${notes || 'Oud, Amber, Damask Rose'}. Mood and style: ${base}`;
}

/** The audio in a music reply, as base64 + its type, and any words the model wrote. */
export function musicFromReply(data: unknown): { audioBase64: string; mimeType: string; lyrics: string } | undefined {
  const parts = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean; inlineData?: { data?: unknown; mimeType?: unknown } }> } }> })?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return undefined;
  let audio = '';
  let mimeType = 'audio/wav';
  let lyrics = '';
  for (const part of parts) {
    const inline = part?.inlineData;
    if (inline && typeof inline.data === 'string' && inline.data) {
      if (!audio && typeof inline.mimeType === 'string' && inline.mimeType) mimeType = inline.mimeType;
      audio += inline.data;
    }
    if (!lyrics && !part?.thought && typeof part?.text === 'string' && part.text.trim()) lyrics = part.text.trim().slice(0, 2000);
  }
  return audio ? { audioBase64: audio, mimeType, lyrics } : undefined;
}

/** The studio's own cleanup before speaking: no markdown read aloud as symbols. */
export function ttsText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`#>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2400);
}

export function createStudioVoiceRouter(deps: { env?: Env; fetch?: Fetch } = {}) {
  const env = deps.env || process.env;
  const request = deps.fetch || fetch;
  const router = express.Router();
  const transcribeLimiter = new RateLimiter(20, 10 * 60_000);
  const musicLimiter = new RateLimiter(6, 60 * 60_000);
  const musicBudget = new VoiceBudget(MUSIC_DAILY_LIMIT);
  const rest = new ModelRest();
  const speakLimiter = new RateLimiter(30, 60_000);
  const speakBudget = new VoiceBudget(300);
  const speakRest = new ModelRest();

  const key = () => env.GEMINI_API_KEY?.trim();
  const off = (flag: string) => (env[flag] || '').trim().toLowerCase() === 'off';

  /* ------------------------------------------------- transcription ------------------------------------------------- */

  router.post('/transcribe', async (req, res) => {
    const audio = readAudio(req.body?.audio, req.body?.mimeType);
    if (!audio) { res.status(400).json({ code: 'INVALID_AUDIO' }); return; }
    if (off('SHAM_TRANSCRIBE') || !key()) { res.status(503).json({ code: 'TRANSCRIBE_OFF' }); return; }
    if (!transcribeLimiter.allow(clientKey(req))) { res.status(429).setHeader('Retry-After', '120').json({ code: 'rate_limited' }); return; }
    let refused = false;
    for (const model of TRANSCRIBE_MODELS) {
      try {
        const response = await request(`${API}/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          signal: AbortSignal.timeout(30_000),
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key()! },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{ text: TRANSCRIBE_INSTRUCTION }, { inlineData: { mimeType: audio.mimeType, data: audio.data } }],
            }],
            generationConfig: { temperature: 0 },
          }),
        });
        if (response.status === 401 || response.status === 403) { res.status(503).json({ code: 'TRANSCRIBE_OFF' }); return; }
        if (!response.ok) continue; // quota (429), a retired model (404), a busy one (503): the next model
        const data = await response.json().catch(() => undefined);
        const text = transcriptionFromReply(data);
        if (text) { res.setHeader('Cache-Control', 'no-store'); res.json({ transcription: text }); return; }
        refused = true;
      } catch { /* a stuck model is not a spent budget: the next one tries */ }
    }
    res.status(refused ? 422 : 502).json({ code: refused ? 'NO_SPEECH' : 'TRANSCRIBE_FAILED' });
  });

  /* ---------------------------------------------------- music ---------------------------------------------------- */

  router.post('/music', async (req, res) => {
    const prompt = musicPrompt(req.body?.prompt, req.body?.scentName, req.body?.scentNotes);
    if (!prompt) { res.status(400).json({ code: 'INVALID_PROMPT' }); return; }
    if (off('SHAM_MUSIC') || !key()) { res.status(503).json({ code: 'MUSIC_OFF' }); return; }
    if (!musicLimiter.allow(clientKey(req))) { res.status(429).setHeader('Retry-After', '600').json({ code: 'rate_limited' }); return; }
    if (!musicBudget.take()) { res.status(503).json({ code: 'MUSIC_BUSY' }); return; }
    const model = req.body?.duration === 'full' ? MUSIC_MODELS.full : MUSIC_MODELS.clip;
    try {
      const response = await request(`${API}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        signal: AbortSignal.timeout(60_000),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key()! },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['AUDIO'] },
        }),
      });
      if (response.status === 402 || response.status === 403) { res.status(402).json({ code: 'PAID_KEY_REQUIRED' }); return; }
      if (response.status === 429) { res.status(503).json({ code: 'MUSIC_BUSY' }); return; }
      if (!response.ok) { res.status(502).json({ code: 'MUSIC_FAILED' }); return; }
      const music = musicFromReply(await response.json().catch(() => undefined));
      if (!music) { res.status(402).json({ code: 'PAID_KEY_REQUIRED' }); return; }
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ...music, duration: req.body?.duration === 'full' ? 'full_track' : '30s_clip' });
    } catch (error) {
      if ((error as Error)?.name === 'AssertionError') throw error;
      res.status(502).json({ code: 'MUSIC_FAILED' });
    }
  });

  /* ----------------------------------------------------- speech ---------------------------------------------------- */

  router.post('/tts', async (req, res) => {
    const text = ttsText(req.body?.text);
    if (!text) { res.status(400).json({ code: 'INVALID_TEXT' }); return; }
    const language = (typeof req.body?.language === 'string' ? req.body.language : 'ar') as SupportedLanguage;
    // The same voice engine as /api/voice/speak (server/voiceSpeak.ts), so the site says one voice, not two.
    const speech = cleanSpeechRequest({ text, language, gender: req.body?.gender, mood: req.body?.mood });
    if (!speech) { res.status(400).json({ code: 'INVALID_TEXT' }); return; }
    if (!voiceEnabled(env) || off('SHAM_VOICE_ENGINE')) { res.status(503).json({ code: 'voice_off' }); return; }
    if (!speakLimiter.allow(clientKey(req))) { res.status(429).setHeader('Retry-After', '20').json({ code: 'rate_limited' }); return; }
    try {
      const wav = await synthesize(env, speech, speakBudget, request, speakRest);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ audioBase64: wav.toString('base64'), mimeType: 'audio/wav' });
    } catch (error) {
      const e = error instanceof SpeechError ? error : new SpeechError(503, 'voice_failed');
      if (e.retryMs > 0) res.setHeader('Retry-After', String(Math.ceil(e.retryMs / 1000)));
      res.status(e.status).json({ code: e.code });
    }
  });

  /** The status the studio buttons read before offering a microphone (never a vendor's name). */
  router.get('/voice/status', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      transcribe: Boolean(key()) && !off('SHAM_TRANSCRIBE'),
      music: Boolean(key()) && !off('SHAM_MUSIC') && musicBudget.available(),
      speech: voiceEnabled(env) && speakBudget.available(),
    });
  });

  return router;
}

/** Audio bytes in a studio reply, for the modules that ask for the WAV itself (kept for symmetry with voiceSpeak). */
export const studioAudio = audioFromReply;
