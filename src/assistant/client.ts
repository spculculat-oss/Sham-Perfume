/** Browser client for Sham Core. Same-origin relative URLs only (works behind any host/proxy). */
import { ApiError, ApiUnavailableError, apiUrl, isStaticHosting, requestApi } from '../utils/api';
import type { SupportedLanguage } from '../types/i18n';

export interface FormField { name: string; labelAr: string; labelEn: string; type: 'text' | 'textarea' | 'number' | 'select' | 'email' | 'tel'; required?: boolean; options?: string[] }
export interface PublicService { id: string; kind: string; nameAr: string; nameEn: string; descriptionAr: string; descriptionEn: string; formFields: FormField[]; siteTab?: string }
export interface ProductCard { id: string; sku: string; nameAr: string; nameEn: string; price: number; currency: string; stock: number; unit: string; demo?: boolean }
export interface RequestView { ref: string; type: string; status: string; serviceId: string; total?: number; currency?: string; createdAt: string; updatedAt: string }
export interface ActionCard { type: 'request_form' | 'products' | 'order_status' | 'open_tab' | 'handoff' | 'privacy'; serviceId?: string; title?: string; fields?: FormField[]; products?: ProductCard[]; request?: RequestView; ref?: string; tab?: string; memory?: Record<string, string> }
export interface PublicStep { stage: string; label: string }
export interface Citation { id: string; title: string; kind: string }
export interface CouncilInfo { available: boolean; seats: number; auto: string[]; showDiscussion: boolean }
export interface CouncilView { outcome: 'synthesis' | 'single' | 'failed'; rounds: number; entries: { label: string; role: string; engine: string; opinion: string; reviews: string[]; chair: boolean }[] }
export interface AssistantConfig { assistantName: { ar: string; en: string }; welcome: { ar: string; en: string }; currency: string; modelEnhanced: boolean; council?: CouncilInfo; services: PublicService[] }
export interface ChatReply { conversationId: string; messageId: string; steps: PublicStep[]; suggestions: string[]; reply: string; engine: { id: string; name: string }; intent: string; actions: ActionCard[]; citations: Citation[]; status: 'open' | 'handoff' | 'closed'; council?: CouncilView; trace?: { stage: string; detail: string; ms?: number }[] }
export interface UiMessage {
  id?: string; role: 'user' | 'assistant'; text: string; at: string; engine?: string; actions?: ActionCard[]; citations?: Citation[];
  steps?: PublicStep[]; suggestions?: string[]; feedback?: { rating: 'up' | 'down' }; streaming?: boolean; stopped?: boolean; council?: CouncilView;
}
export type StreamEvent =
  | { type: 'step'; step: PublicStep } | { type: 'delta'; text: string } | { type: 'reset' }
  | { type: 'done'; output: ChatReply } | { type: 'error'; code: string; message: string };

const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

/**
 * Where the visitor is standing right now (`#store`, `#product=52`, `#community/merchant`). The assistant answers
 * for the page they are on — real prices on the store, the open product on a product page, the tool they see.
 */
export function currentPage(): { page?: string; productId?: string } {
  try {
    const hash = window.location.hash.replace(/^#/, '').split('?')[0].trim();
    if (!hash) return { page: 'home' };
    const product = hash.match(/^product=(\d+)$/);
    if (product) return { page: 'productDetail', productId: product[1] };
    return /^[a-zA-Z][a-zA-Z0-9_/-]{0,38}$/.test(hash) ? { page: hash } : { page: 'home' };
  } catch {
    return {};
  }
}

export const VISITOR_KEY = 'sham_core_visitor_id';
export const CONVERSATION_KEY = 'sham_core_conversation';

export function visitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing && /^[A-Za-z0-9_-]{8,80}$/.test(existing)) return existing;
    const id = `v-${crypto.randomUUID()}`;
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return `v-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}

export const assistantApi = {
  config: () => requestApi<AssistantConfig>('/api/assistant/config', undefined, 15000),
  chat: (message: string, language: SupportedLanguage, conversationId?: string, signal?: AbortSignal, rewind?: string, consult?: boolean) =>
    requestApi<ChatReply>('/api/assistant/chat', { ...json({ message, language, conversationId, visitorId: visitorId(), rewind: rewind || undefined, consult: consult || undefined, ...currentPage() }), signal }, consult ? 70000 : 40000),
  conversation: (id: string) =>
    requestApi<{ id: string; status: ChatReply['status']; messages: UiMessage[] }>(`/api/assistant/conversations/${encodeURIComponent(id)}?visitorId=${encodeURIComponent(visitorId())}`, undefined, 15000),
  submitRequest: (body: { serviceId: string; contact: { name: string; phone?: string; email?: string }; fields: Record<string, string>; items?: { productId: string; quantity: number }[]; conversationId?: string }) =>
    requestApi<{ request: RequestView }>('/api/assistant/requests', json({ ...body, visitorId: visitorId() }), 20000),
  feedback: (conversationId: string, messageId: string, rating: 'up' | 'down', reason?: string) =>
    requestApi<{ feedback: { rating: 'up' | 'down' } }>('/api/assistant/feedback', json({ conversationId, messageId, rating, reason, visitorId: visitorId() }), 15000),
  me: () => requestApi<{ memory: Record<string, string>; conversations: number }>(`/api/assistant/me?visitorId=${encodeURIComponent(visitorId())}`, undefined, 15000),
  forget: () => requestApi<{ deleted: { conversations: number } }>(`/api/assistant/me?visitorId=${encodeURIComponent(visitorId())}`, { method: 'DELETE' }, 20000),
  track: (ref: string, contact: string) => requestApi<{ request: RequestView }>('/api/assistant/track', json({ ref, contact }), 15000),
};

/**
 * Streams a reply over SSE (POST). Calls `onEvent` for live steps and tokens and resolves with
 * the final reply. Throws before the first event if streaming is unavailable, so callers can
 * fall back to the plain JSON endpoint.
 */
export async function streamChat(message: string, language: SupportedLanguage, conversationId: string | undefined, onEvent: (event: StreamEvent) => void, signal?: AbortSignal, rewind?: string, consult?: boolean): Promise<ChatReply> {
  if (isStaticHosting) throw new ApiUnavailableError();
  const response = await fetch(apiUrl('/api/assistant/chat/stream'), { ...json({ message, language, conversationId, visitorId: visitorId(), rewind: rewind || undefined, consult: consult || undefined, ...currentPage() }), signal });
  if (!response.ok) {
    let code: string | undefined;
    try { code = (await response.json())?.code; } catch { /* not JSON */ }
    throw new ApiError(response.status, code);
  }
  if (!response.body || !(response.headers.get('content-type') || '').includes('text/event-stream')) throw new Error('Streaming not supported by this server');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let final: ChatReply | undefined;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index: number;
    while ((index = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      const data = block.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('');
      if (!data) continue;
      const event = JSON.parse(data) as StreamEvent;
      if (event.type === 'error') throw new ApiError(500, event.code);
      if (event.type === 'done') final = event.output;
      onEvent(event);
    }
  }
  if (!final) throw new ApiError(502, 'STREAM_INCOMPLETE');
  return final;
}
