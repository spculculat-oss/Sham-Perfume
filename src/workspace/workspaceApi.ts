import { wantsRealPhoto } from '../utils/realPhotos';
import type { ImageAspect, ImageStyleId } from '../utils/imageCraft';
/** «مساحة شاهين»: the browser side of /api/workspace (see server/workspace.ts). */
import { ApiError, ApiUnavailableError, isStaticHosting, requestApi, visitorId } from '../utils/api';
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
export function ask(body: { messages: WsMessage[]; language: SupportedLanguage; task?: 'chat' | 'plan' | 'summarize' | 'site' | 'storyboard'; context?: WsContextFile[]; search?: boolean }, signal?: AbortSignal) {
  return requestApi<{ reply: string; sources: WsSource[] }>('/api/workspace/ask', { ...json(body), signal }, 75_000);
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
export function errorKey(error: unknown): 'no_server' | 'busy' | 'rate_limited' | 'failed' {
  if (error instanceof ApiUnavailableError) return 'no_server';
  if (error instanceof ApiError) {
    if (error.status === 429) return 'rate_limited';
    if (error.status === 503 || error.status === 502 || error.status === 504) return 'busy';
    if (error.status === 404) return 'no_server';
  }
  return 'failed';
}
