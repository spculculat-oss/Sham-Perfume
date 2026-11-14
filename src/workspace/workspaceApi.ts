import { wantsRealPhoto } from '../utils/realPhotos';
import type { ImageAspect, ImageStyleId } from '../utils/imageCraft';
/** «مساحة شاهين»: the browser side of /api/workspace (see server/workspace.ts). */
import { ApiError, ApiUnavailableError, apiUrl, isStaticHosting, requestApi, visitorId } from '../utils/api';
import { getToken } from '../admin/adminApi';
import type { SupportedLanguage } from '../types/i18n';

export interface WsMessage { role: 'user' | 'assistant'; text: string }
export interface WsSource { title: string; url: string; snippet: string }
export interface WsContextFile { name: string; text: string }
/** `video`: who may use the professional video engine (off until the owner turns it on); `videoLeft`: clips left today. */
export interface WsStatus { ai: boolean; search: 'web' | 'encyclopedia'; image: 'ai' | 'off'; notion: boolean; slack: boolean; video?: 'off' | 'owner' | 'everyone'; videoLeft?: number }

const json = (body: unknown, extra: Record<string, string> = {}): RequestInit => ({
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Sham-Visitor': visitorId(), ...extra }, body: JSON.stringify(body),
});
export const serverReachable = () => !isStaticHosting;

export function workspaceStatus(signal?: AbortSignal) {
  return requestApi<WsStatus>('/api/workspace/status', { signal }, 10_000);
}
export function ask(body: { messages: WsMessage[]; language: SupportedLanguage; task?: 'chat' | 'plan' | 'summarize' | 'site' | 'storyboard' | 'graphic' | 'block' | 'bot'; context?: WsContextFile[]; search?: boolean }, signal?: AbortSignal) {
  return requestApi<{ reply: string; sources: WsSource[] }>('/api/workspace/ask', { ...json(body), signal }, 75_000);
}
export type AskStreamEvent =
  | { type: 'stage'; stage: 'searching' | 'writing' }
  | { type: 'sources'; sources: WsSource[] }
  | { type: 'delta'; text: string }
  | { type: 'reset' };
/** Splits a server-sent stream into its JSON events; `rest` is the unfinished tail to carry to the next piece. */
export function sseEvents(buffer: string): { events: unknown[]; rest: string } {
  const events: unknown[] = [];
  let rest = buffer.replace(/\r\n/g, '\n');
  let index: number;
  while ((index = rest.indexOf('\n\n')) >= 0) {
    const data = rest.slice(0, index).split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('');
    rest = rest.slice(index + 2);
    if (!data) continue;
    try { events.push(JSON.parse(data)); } catch { /* a damaged line is skipped, the final reply still arrives whole */ }
  }
  return { events, rest };
}
/**
 * The same turn as `ask`, written live. Falls back to the plain request when the server cannot stream
 * (an older deployment, a proxy that buffers), as long as nothing was shown yet.
 */
export async function askStream(body: Parameters<typeof ask>[0], onEvent: (event: AskStreamEvent) => void, signal?: AbortSignal, request: typeof fetch = fetch): Promise<{ reply: string; sources: WsSource[] }> {
  if (isStaticHosting) throw new ApiUnavailableError();
  let started = false;
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal?.addEventListener('abort', stop);
  // No sign of life for 50 seconds (the server sends a quiet line every 12) means the line is dead.
  let idle: ReturnType<typeof setTimeout> | undefined;
  const alive = () => { clearTimeout(idle); idle = setTimeout(stop, 50_000); };
  try {
    alive();
    const response = await request(apiUrl('/api/workspace/ask/stream'), { ...json(body), signal: controller.signal });
    if (response.status === 429) throw new ApiError(429, 'RATE_LIMITED');
    if (!response.ok || !response.body || !(response.headers.get('content-type') || '').includes('text/event-stream')) throw new Error('NO_STREAM');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      alive();
      const parsed = sseEvents(buffer + decoder.decode(value, { stream: true }));
      buffer = parsed.rest;
      for (const raw of parsed.events) {
        const event = raw as { type?: string; output?: { reply: string; sources: WsSource[] }; status?: number; code?: string };
        started = true;
        if (event.type === 'done' && event.output) return event.output;
        if (event.type === 'error') throw new ApiError(event.status || 500, event.code);
        if (event.type === 'stage' || event.type === 'sources' || event.type === 'delta' || event.type === 'reset') onEvent(event as AskStreamEvent);
      }
    }
    throw new ApiError(502, 'STREAM_INCOMPLETE');
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof ApiError && error.code !== 'STREAM_INCOMPLETE') throw error;
    if (started) { onEvent({ type: 'reset' }); }
    return ask(body, signal);
  } finally {
    clearTimeout(idle);
    signal?.removeEventListener('abort', stop);
  }
}
export function search(q: string, language: SupportedLanguage, signal?: AbortSignal) {
  return requestApi<{ answer?: string; results: WsSource[]; kind: 'web' | 'encyclopedia' }>('/api/workspace/search', { ...json({ q, language }), signal }, 40_000);
}
export function readUrl(url: string, signal?: AbortSignal) {
  return requestApi<{ url: string; title: string; text: string; kind: 'html' | 'pdf' | 'text'; truncated: boolean }>('/api/workspace/read', { ...json({ url }), signal }, 40_000);
}

export const isGeneratedImageData = (src: unknown): src is string => typeof src === 'string' && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(src);

/** Only the configured server image engine. Never switch silently to a branded third-party URL. */
export async function makeImage(prompt: string, image?: string, signal?: AbortSignal, look: { style?: ImageStyleId; aspect?: ImageAspect } = {}): Promise<{ src: string; engine: 'ai' }> {
  if (wantsRealPhoto(prompt)) throw new Error('REAL_PHOTO_REQUIRES_SEARCH');
  signal?.throwIfAborted();
  if (isStaticHosting) throw new ApiUnavailableError();
  const out = await requestApi<{ image: string }>('/api/workspace/image', { ...json({ prompt, ...(image ? { image } : {}), ...(look.style && look.style !== 'auto' ? { style: look.style } : {}), ...(look.aspect ? { aspect: look.aspect } : {}) }), signal }, 90_000);
  if (!isGeneratedImageData(out.image)) throw new Error('INVALID_IMAGE_RESULT');
  return { src: out.image, engine: 'ai' };
}

/** Owner-only: Notion and Slack through the server (the admin sign-in token proves it is the owner). */
export const ownerSignedIn = () => Boolean(getToken());
function owner<T>(path: `/api/workspace/owner/${string}`, body: unknown) {
  return requestApi<T>(path, json(body, { Authorization: `Bearer ${getToken()}` }), 30_000);
}
export const notionSearch = (q: string) => owner<{ results: Array<{ title: string; url: string }> }>('/api/workspace/owner/notion/search', { q });
export const notionPage = (title: string, text: string) => owner<{ url?: string }>('/api/workspace/owner/notion/page', { title, text });
export const slackSend = (text: string) => owner<{ ok: boolean }>('/api/workspace/owner/slack/send', { text });

/** The visitor-facing words for an error (never a vendor name or a stack). */
/** The honest sentence for an image that did not come: which of the workspace words says why. */
export function imageErrorKey(error: unknown): 'image_unavailable' | 'image_quota' | 'image_refused' | 'rate_limited' | 'image_failed' {
  if (error instanceof ApiUnavailableError) return 'image_unavailable';
  if (error instanceof ApiError) {
    if (error.code === 'NO_IMAGE_ENGINE' || error.status === 404) return 'image_unavailable';
    if (error.code === 'IMAGE_QUOTA') return 'image_quota';
    if (error.code === 'IMAGE_REFUSED') return 'image_refused';
    if (error.status === 429) return 'rate_limited';
  }
  return 'image_failed';
}
export function errorKey(error: unknown): 'no_server' | 'busy' | 'rate_limited' | 'failed' | 'ai_quota' | 'ai_slow' | 'ai_off' {
  if (error instanceof ApiUnavailableError) return 'no_server';
  if (error instanceof ApiError) {
    if (error.status === 429) return 'rate_limited';
    // The real reason, when the server knows it: a used-up quota, a slow answer, or no platform connected at all.
    if (error.code === 'ENGINES_QUOTA') return 'ai_quota';
    if (error.code === 'ENGINES_TIMEOUT') return 'ai_slow';
    if (error.code === 'NO_ENGINE' || error.code === 'ENGINES_MISCONFIGURED') return 'ai_off';
    if (error.status === 503 || error.status === 502 || error.status === 504) return 'busy';
    if (error.status === 404) return 'no_server';
  }
  return 'failed';
}
