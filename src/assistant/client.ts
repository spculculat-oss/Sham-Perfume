/** Browser client for Sham Core. Same-origin relative URLs only (works behind any host/proxy). */
import { requestApi } from '../utils/api';
import type { SupportedLanguage } from '../types/i18n';

export interface FormField { name: string; labelAr: string; labelEn: string; type: 'text' | 'textarea' | 'number' | 'select' | 'email' | 'tel'; required?: boolean; options?: string[] }
export interface PublicService { id: string; kind: string; nameAr: string; nameEn: string; descriptionAr: string; descriptionEn: string; formFields: FormField[]; siteTab?: string }
export interface ProductCard { id: string; sku: string; nameAr: string; nameEn: string; price: number; currency: string; stock: number; unit: string; demo?: boolean }
export interface RequestView { ref: string; type: string; status: string; serviceId: string; total?: number; currency?: string; createdAt: string; updatedAt: string }
export interface ActionCard { type: 'request_form' | 'products' | 'order_status' | 'open_tab' | 'handoff'; serviceId?: string; title?: string; fields?: FormField[]; products?: ProductCard[]; request?: RequestView; ref?: string; tab?: string }
export interface Citation { id: string; title: string; kind: string }
export interface AssistantConfig { assistantName: { ar: string; en: string }; welcome: { ar: string; en: string }; currency: string; modelEnhanced: boolean; services: PublicService[] }
export interface ChatReply { conversationId: string; reply: string; engine: { id: string; name: string }; intent: string; actions: ActionCard[]; citations: Citation[]; status: 'open' | 'handoff' | 'closed'; trace?: { stage: string; detail: string; ms?: number }[] }
export interface UiMessage { role: 'user' | 'assistant'; text: string; at: string; engine?: string; actions?: ActionCard[]; citations?: Citation[] }

const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

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
  chat: (message: string, language: SupportedLanguage, conversationId?: string, signal?: AbortSignal) =>
    requestApi<ChatReply>('/api/assistant/chat', { ...json({ message, language, conversationId, visitorId: visitorId() }), signal }, 40000),
  conversation: (id: string) =>
    requestApi<{ id: string; status: ChatReply['status']; messages: UiMessage[] }>(`/api/assistant/conversations/${encodeURIComponent(id)}?visitorId=${encodeURIComponent(visitorId())}`, undefined, 15000),
  submitRequest: (body: { serviceId: string; contact: { name: string; phone?: string; email?: string }; fields: Record<string, string>; items?: { productId: string; quantity: number }[]; conversationId?: string }) =>
    requestApi<{ request: RequestView }>('/api/assistant/requests', json({ ...body, visitorId: visitorId() }), 20000),
  track: (ref: string, contact: string) => requestApi<{ request: RequestView }>('/api/assistant/track', json({ ref, contact }), 15000),
};
