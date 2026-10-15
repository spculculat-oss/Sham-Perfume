import type { ChatMessage } from './chatStorage';

/**
 * Where the API lives. Empty = same origin (Node/Vercel). A static build (GitHub Pages) can point
 * at a deployed server with VITE_API_BASE_URL (https only); that server must allow the Pages
 * origin in SHAM_CORS_ORIGINS. Without it the static site disables the server features.
 */
function apiBase(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return '';
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:' && !/^(localhost|127\.0\.0\.1)$/.test(url.hostname)) return '';
    return url.origin + url.pathname.replace(/\/+$/, '');
  } catch { return ''; }
}
export const API_BASE = apiBase(import.meta.env?.VITE_API_BASE_URL);
export const isStaticHosting = import.meta.env?.MODE === 'pages' && !API_BASE;
/** Absolute URL for an API path (`/api/...`), honouring API_BASE. */
export const apiUrl = (path: `/api/${string}`) => `${API_BASE}${path}`;
export class ApiUnavailableError extends Error {
  constructor() { super('This static deployment has no API server.'); this.name = 'ApiUnavailableError'; }
}
export class ApiError extends Error {
  constructor(public status: number, public code?: string, public retryAfterMs?: number) { super(`API request failed (${status})`); }
}

const VISITOR_KEY = 'sham_visitor_id';
let sessionVisitor: string | undefined;
/**
 * Anonymous random id for this browser (no personal data). Lets the server tell apart visitors who
 * share one public IP — common on mobile networks — so they do not use up each other's message quota.
 */
export function visitorId(): string {
  const fresh = () => (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`).replace(/[^A-Za-z0-9_-]/g, '');
  try {
    const stored = localStorage.getItem(VISITOR_KEY);
    if (stored && /^[A-Za-z0-9_-]{8,64}$/.test(stored)) return stored;
    const id = fresh();
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return sessionVisitor ??= fresh(); // storage blocked: one id for this page view
  }
}
export interface ChatResponse {
  reply: string;
  engine?: ChatMessage['aiEngine'];
  perspectives?: ChatMessage['perspectives'];
}

/** Same-origin, bounded requests. Abort covers response-body parsing as well as headers. */
export async function requestApi<T>(endpoint: `/api/${string}`, options?: RequestInit, timeoutMs = 45000): Promise<T> {
  if (isStaticHosting) throw new ApiUnavailableError();
  const controller = new AbortController();
  const cancel = () => controller.abort(options?.signal?.reason);
  if (options?.signal?.aborted) cancel();
  options?.signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException('API request timed out', 'TimeoutError')), timeoutMs);
  try {
    const response = await fetch(apiUrl(endpoint), { ...options, signal: controller.signal });
    if (!response.ok) {
      let code: string | undefined;
      try { const data = await response.json(); if (typeof data?.code === 'string') code = data.code; } catch { /* Ignore provider/HTML bodies. */ }
      const retryAfter = Number(response.headers.get('retry-after'));
      throw new ApiError(response.status, code, Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(60, retryAfter) * 1000 : undefined);
    }
    if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
      throw new Error(`Expected JSON from ${endpoint}, but received a static page.`);
    }
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener('abort', cancel);
  }
}
