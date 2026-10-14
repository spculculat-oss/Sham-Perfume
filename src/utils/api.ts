import type { ChatMessage } from './chatStorage';

/** GitHub Pages has no Node process to serve /api routes. */
export const isStaticHosting = import.meta.env?.MODE === 'pages';

export class ApiUnavailableError extends Error {
  constructor() {
    super('This static deployment has no API server.');
    this.name = 'ApiUnavailableError';
  }
}

export interface ChatResponse {
  reply: string;
  engine?: ChatMessage['aiEngine'];
  perspectives?: ChatMessage['perspectives'];
}

/** Keep browser requests same-origin; never put provider keys in the Vite bundle. */
export async function requestApi<T>(
  endpoint: `/api/${string}`,
  options?: RequestInit,
): Promise<T> {
  if (isStaticHosting) throw new ApiUnavailableError();

  const response = await fetch(endpoint, options);
  if (!response.ok) {
    throw new Error(`API request failed (${response.status}): ${endpoint}`);
  }
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new Error(`Expected JSON from ${endpoint}, but received a static page.`);
  }

  return response.json() as Promise<T>;
}
