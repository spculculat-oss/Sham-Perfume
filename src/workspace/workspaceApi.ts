/** «مساحة شاهين»: the browser side of /api/workspace (see server/workspace.ts). */
import { ApiError, ApiUnavailableError, isStaticHosting, requestApi, visitorId } from '../utils/api';
import { getToken } from '../admin/adminApi';
import type { SupportedLanguage } from '../types/i18n';

export interface WsMessage { role: 'user' | 'assistant'; text: string }
export interface WsSource { title: string; url: string; snippet: string }
export interface WsContextFile { name: string; text: string }
export interface WsStatus { ai: boolean; search: 'web' | 'encyclopedia'; image: 'ai' | 'open'; notion: boolean; slack: boolean }

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

/** The open image generator (no key, no account): used when the server has no image engine or is unreachable. */
export const openImageUrl = (prompt: string, seed = Math.floor(Math.random() * 1e6)) =>
  `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 700))}?width=1024&height=1024&nologo=true&seed=${seed}`;

/** A data: URL from the server's image engine, or the open generator's URL. `image` (data URL) asks for an edit. */
export async function makeImage(prompt: string, image?: string, signal?: AbortSignal): Promise<{ src: string; engine: 'ai' | 'open' }> {
  if (!isStaticHosting) {
    try {
      const out = await requestApi<{ image: string }>('/api/workspace/image', { ...json({ prompt, ...(image ? { image } : {}) }), signal }, 90_000);
      if (out.image?.startsWith('data:image/')) return { src: out.image, engine: 'ai' };
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) throw error;
      if (image) throw error; // an edit needs the server engine
    }
  }
  if (image) throw new ApiUnavailableError();
  return { src: openImageUrl(prompt), engine: 'open' };
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
