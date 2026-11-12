/** Admin client. The token lives in sessionStorage only (cleared when the tab closes). */
import { apiUrl } from '../utils/api';
export const ADMIN_TOKEN_KEY = 'sham_core_admin_token';

export class AdminApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function getToken() { try { return sessionStorage.getItem(ADMIN_TOKEN_KEY) || ''; } catch { return ''; } }
export function setToken(token: string) { try { if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token); else sessionStorage.removeItem(ADMIN_TOKEN_KEY); } catch { /* ignore */ } }

/**
 * The server compares the token exactly (`env.SHAM_ADMIN_TOKEN.trim()`), so a stray space or newline — an
 * Android keyboard's automatic trailing space, or a pasted line break — reads as a wrong password. It never
 * can be part of a valid token (the server trims its own value too), so the token is trimmed here once.
 */
export const cleanToken = (token: string | undefined | null) => String(token ?? '').trim();

export async function adminRequest<T>(path: string, init: RequestInit = {}, token = getToken()): Promise<T> {
  const response = await fetch(apiUrl(`/api/admin${path}`), {
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${cleanToken(token)}`, ...(init.headers || {}) },
    signal: init.signal || AbortSignal.timeout(45000),
  });
  const type = response.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new AdminApiError(response.status, data?.code || 'HTTP_ERROR', data?.error || `Request failed (${response.status})`);
  if (!data) throw new AdminApiError(502, 'NOT_JSON', 'The server returned a non-JSON response (is the API server running?)');
  return data as T;
}

export const send = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });
