/**
 * «استوديو شاهين — المحرك الاحترافي للفيديو»: real moving footage (characters move, water flows, the camera flies)
 * from a paid video model, made ready in code and OFF until the owner turns it on:
 *   SHAM_VIDEO_ENGINE        'owner' (only the signed-in owner) | 'everyone' | anything else = off   (default off)
 *   SHAM_VIDEO_MODEL         default 'gemini-omni-1.2-flash' (the successor of Veo in the same API)
 *   SHAM_VIDEO_DAILY_LIMIT   clips a day for the whole site on this server instance (default 10) — it costs money
 *   GEMINI_API_KEY           the key already used for chat and images
 * Flow (the model takes minutes, longer than one web request may live):
 *   POST start  → the job starts in the background; the visitor gets a signed job id (no one can read other jobs)
 *   GET status  → in_progress | completed | failed
 *   GET file    → the finished MP4, streamed in pieces
 * Visitors never see the vendor's name: errors and statuses are ours.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

type Env = Record<string, string | undefined>;
export type VideoAccess = 'off' | 'owner' | 'everyone';
export type VideoAspect = '16:9' | '9:16';
const API = 'https://generativelanguage.googleapis.com/v1beta/interactions';

/** `message` is what the visitor sees (ours, no vendor names); `detail` is the engine's own words, for the server log only. */
export class VideoError extends Error {
  constructor(public status: number, public code: string, message: string, public detail = '') { super(message); }
}

export function videoAccess(env: Env): VideoAccess {
  if (!env.GEMINI_API_KEY?.trim()) return 'off';
  const mode = env.SHAM_VIDEO_ENGINE?.trim().toLowerCase();
  return mode === 'owner' || mode === 'everyone' ? mode : 'off';
}
export const videoModel = (env: Env) => env.SHAM_VIDEO_MODEL?.trim() || 'gemini-omni-1.2-flash';
export const dailyLimit = (env: Env) => { const n = Number(env.SHAM_VIDEO_DAILY_LIMIT); return Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), 500) : 10; };

/** The site's own budget: clips started today (UTC), on this server instance. */
export class DailyBudget {
  private day = '';
  private used = 0;
  constructor(private now: () => Date = () => new Date()) {}
  take(limit: number): boolean {
    const today = this.now().toISOString().slice(0, 10);
    if (today !== this.day) { this.day = today; this.used = 0; }
    if (this.used >= limit) return false;
    this.used += 1;
    return true;
  }
  give() { if (this.used > 0) this.used -= 1; }
  left(limit: number) { const today = this.now().toISOString().slice(0, 10); return today === this.day ? Math.max(0, limit - this.used) : limit; }
}

// ── Signed jobs: «id.signature», so a visitor can only follow the jobs this server started ─────────────────
const secretOf = (env: Env) => createHmac('sha256', 'sham-video-job').update(`${env.GEMINI_API_KEY || ''}|${env.SHAM_ADMIN_TOKEN || ''}`).digest();
export function signJob(id: string, env: Env): string {
  return `${id}.${createHmac('sha256', secretOf(env)).update(id).digest('base64url').slice(0, 32)}`;
}
export function readJob(job: unknown, env: Env): string | undefined {
  if (typeof job !== 'string' || job.length > 300) return undefined;
  const at = job.lastIndexOf('.');
  const id = job.slice(0, at);
  if (at < 1 || !/^[\w-]{1,240}$/.test(id)) return undefined;
  const a = Buffer.from(job);
  const b = Buffer.from(signJob(id, env));
  return a.length === b.length && timingSafeEqual(a, b) ? id : undefined;
}

// ── The request ─────────────────────────────────────────────────────────────────────────────────────────────
export interface VideoRequest { prompt: string; image?: string; aspect: VideoAspect; seconds: number }
export function cleanVideoRequest(body: unknown): VideoRequest {
  const r = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const prompt = typeof r.prompt === 'string' ? r.prompt.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 2000) : '';
  if (prompt.length < 3) throw new VideoError(400, 'BAD_REQUEST', 'Describe the scene');
  const seconds = Math.min(10, Math.max(3, Math.round(Number(r.seconds) || 6)));
  const aspect: VideoAspect = r.aspect === '9:16' ? '9:16' : '16:9';
  const image = typeof r.image === 'string' && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(r.image) && r.image.length < 3_500_000 ? r.image : undefined;
  return { prompt, aspect, seconds, ...(image ? { image } : {}) };
}
/** The body sent to the model: a directed shot (camera, motion, light) and, when given, the scene's picture to animate. */
export function interactionBody(req: VideoRequest, model: string, background: boolean): Record<string, unknown> {
  const text = `${req.prompt}\nCinematic, smooth natural motion, consistent characters, no text or watermarks on screen.${req.image ? ' Animate this picture: keep its characters, style and composition, and bring the scene to life.' : ''}`;
  const inline = req.image?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  return {
    model,
    input: inline ? [{ type: 'image', data: inline[2], mime_type: inline[1] }, { type: 'text', text }] : text,
    response_format: { type: 'video', aspect_ratio: req.aspect, duration: `${req.seconds}s`, resolution: '720p' },
    ...(background ? { background: true } : {}),
  };
}

interface Interaction { id?: string; status?: string; steps?: Array<{ type?: string; content?: Array<{ type?: string; mime_type?: string; data?: string; uri?: string }> }>; error?: { message?: string } }
/** The video inside an interaction (base64 data, or a file address to download with the key). */
export function videoOf(data: Interaction): { mime: string; data?: string; uri?: string } | undefined {
  for (const step of [...(data.steps || [])].reverse()) {
    for (const c of step.content || []) {
      if (c.type === 'video' && (c.data || c.uri)) return { mime: c.mime_type || 'video/mp4', ...(c.data ? { data: c.data } : {}), ...(c.uri ? { uri: c.uri } : {}) };
    }
  }
  return undefined;
}
export type JobStatus = 'in_progress' | 'completed' | 'failed';
const statusOf = (data: Interaction): JobStatus => (data.status === 'completed' ? (videoOf(data) ? 'completed' : 'failed') : data.status === 'failed' || data.status === 'cancelled' ? 'failed' : 'in_progress');

async function call(url: string, init: RequestInit, env: Env, request: typeof fetch, timeout: number): Promise<Interaction> {
  const response = await request(url, { ...init, signal: AbortSignal.timeout(timeout), headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY!.trim(), ...(init.headers || {}) } });
  const text = await response.text();
  let data: Interaction = {};
  try { data = text ? JSON.parse(text) as Interaction : {}; } catch { /* not JSON */ }
  if (!response.ok) {
    const detail = (data.error?.message || text.slice(0, 300) || `answered ${response.status}`).slice(0, 300);
    if (response.status === 429) throw new VideoError(429, 'VIDEO_BUSY', 'The video engine is busy, try again later', detail);
    if (response.status === 400 && /safety|policy|blocked|prohibited|person|people/i.test(detail)) throw new VideoError(422, 'VIDEO_REFUSED', 'This scene can’t be made; change the description', detail);
    if (response.status === 400) throw new VideoError(400, 'VIDEO_BAD_REQUEST', 'The video request was not accepted', detail);
    throw new VideoError(502, 'VIDEO_FAILED', 'The video engine could not make this clip', detail);
  }
  return data;
}

/** Starts a clip in the background (falls back to waiting for it when background runs aren't offered). */
export async function startVideo(req: VideoRequest, { env, fetch: request = fetch }: { env: Env; fetch?: typeof fetch }): Promise<{ id: string; status: JobStatus }> {
  const model = videoModel(env);
  let data: Interaction;
  try {
    data = await call(API, { method: 'POST', body: JSON.stringify(interactionBody(req, model, true)) }, env, request, 60_000);
  } catch (error) {
    if (!(error instanceof VideoError) || error.code !== 'VIDEO_BAD_REQUEST' || !/background|store/i.test(error.detail)) throw error;
    data = await call(API, { method: 'POST', body: JSON.stringify(interactionBody(req, model, false)) }, env, request, 280_000);
  }
  if (!data.id || !/^[\w-]{1,240}$/.test(data.id)) throw new VideoError(502, 'VIDEO_FAILED', 'The video engine could not make this clip', 'no interaction id');
  return { id: data.id, status: statusOf(data) };
}
export async function videoStatus(id: string, { env, fetch: request = fetch }: { env: Env; fetch?: typeof fetch }): Promise<{ status: JobStatus; data: Interaction }> {
  const data = await call(`${API}/${encodeURIComponent(id)}`, { method: 'GET' }, env, request, 60_000);
  return { status: statusOf(data), data };
}
/** The finished clip as bytes. */
export async function videoBytes(data: Interaction, { env, fetch: request = fetch }: { env: Env; fetch?: typeof fetch }): Promise<{ mime: string; bytes: Buffer }> {
  const video = videoOf(data);
  if (!video) throw new VideoError(404, 'VIDEO_NOT_READY', 'Not ready');
  if (video.data) return { mime: video.mime, bytes: Buffer.from(video.data, 'base64') };
  const failed = (detail: string) => new VideoError(502, 'VIDEO_FAILED', 'The video engine could not make this clip', detail);
  let uri: URL;
  try { uri = new URL(video.uri!); } catch { throw failed('bad file address'); }
  const allowed = (u: URL) => u.protocol === 'https:' && u.hostname === 'generativelanguage.googleapis.com';
  if (!allowed(uri)) throw failed('unexpected file address');
  const get = (u: URL) => request(u.href, { headers: { 'x-goog-api-key': env.GEMINI_API_KEY!.trim() }, signal: AbortSignal.timeout(90_000), redirect: 'follow' });
  let response = await get(uri);
  if (!response.ok) throw failed(`file answered ${response.status}`);
  if ((response.headers.get('content-type') || '').includes('application/json')) {
    // A file record rather than the file: wait until it is ready, then download its bytes.
    const file = await response.json().catch(() => ({})) as { state?: string; downloadUri?: string; file?: { state?: string; downloadUri?: string } };
    const record = file.file || file;
    if (record.state && record.state !== 'ACTIVE') throw new VideoError(409, 'VIDEO_NOT_READY', 'Not ready');
    let next: URL;
    try { next = new URL(record.downloadUri || `${uri.origin}${uri.pathname.replace(/:download$/, '')}:download?alt=media`); } catch { throw failed('bad download address'); }
    if (!allowed(next)) throw failed('unexpected download address');
    response = await get(next);
    if (!response.ok) throw failed(`download answered ${response.status}`);
  }
  return { mime: video.mime, bytes: Buffer.from(await response.arrayBuffer()) };
}
