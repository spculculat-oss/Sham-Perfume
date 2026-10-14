import type { ChatMessage } from './chatStorage';

export const isStaticHosting = import.meta.env?.MODE === 'pages';
export class ApiUnavailableError extends Error {
  constructor() { super('This static deployment has no API server.'); this.name = 'ApiUnavailableError'; }
}
export class ApiError extends Error {
  constructor(public status: number, public code?: string) { super(`API request failed (${status})`); }
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
    const response = await fetch(endpoint, { ...options, signal: controller.signal });
    if (!response.ok) {
      let code: string | undefined;
      try { const data = await response.json(); if (typeof data?.code === 'string') code = data.code; } catch { /* Ignore provider/HTML bodies. */ }
      throw new ApiError(response.status, code);
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
