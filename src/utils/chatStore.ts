import type { SupportedLanguage } from '../types/i18n';
import { isStaticHosting, requestApi, type ChatResponse } from './api';
import { CHAT_STORAGE_KEY, clearChatSession, DEFAULT_WELCOME_MESSAGE, isChatMessage,
  loadStoredChatSession, saveChatSession, type ChatMessage } from './chatStorage';

interface Snapshot { messages: ChatMessage[]; isLoading: boolean; daysRemaining: number; expiresAt: number }
interface SendOptions {
  text: string; model: 'auto' | 'gemini' | 'deepseek' | 'openai' | 'claude'; language: SupportedLanguage;
  errorText: (error: unknown) => string;
}

export function chatHistory(messages: ChatMessage[]) {
  const history: { role: 'user' | 'assistant'; text: string }[] = [];
  let size = 0;
  for (const message of [...messages].reverse()) {
    if (message.id === 'welcome' || message.kind === 'error' || message.id.startsWith('bot-err-') ||
      message.id.startsWith('err-') || message.id.startsWith('expired-notice-')) continue;
    if (message.text.length > 4000 || size + message.text.length > 16000 || history.length === 24) break;
    history.unshift({ role: message.role, text: message.text });
    size += message.text.length;
  }
  return history;
}

/** One synchronous owner for both chat surfaces: no effect-driven rebroadcast loops. */
export function createChatStore(request: typeof requestApi = requestApi) {
  let snapshot: Snapshot | undefined;
  let controller: AbortController | undefined;
  let generation = 0;
  let sequence = 0;
  const listeners = new Set<() => void>();
  const getSnapshot = (): Snapshot => snapshot ??= { ...loadStoredChatSession(), isLoading: false };
  const publish = (next: Snapshot, persist = true) => {
    next = { ...next, messages: next.messages.slice(-200) };
    snapshot = next;
    if (persist) saveChatSession(next.messages);
    listeners.forEach((listener) => listener());
  };
  const syncStorage = (event: StorageEvent) => {
    // A full localStorage wipe also clears the conversation.
    if (event.key !== CHAT_STORAGE_KEY && event.key !== null) return;
    controller?.abort(); generation++;
    publish({ ...loadStoredChatSession(), isLoading: false }, false);
  };
  const expire = () => {
    const current = getSnapshot();
    if (current.expiresAt <= Date.now()) {
      controller?.abort(); generation++;
      clearChatSession();
      publish({ ...loadStoredChatSession(), isLoading: false }, false);
    } else {
      const daysRemaining = Math.ceil((current.expiresAt - Date.now()) / 86400000);
      if (daysRemaining !== current.daysRemaining) publish({ ...current, daysRemaining }, false);
    }
  };
  let timer: ReturnType<typeof setInterval> | undefined;
  return {
    getSnapshot,
    subscribe(listener: () => void) {
      expire();
      listeners.add(listener);
      if (listeners.size === 1) {
        if (typeof window !== 'undefined') window.addEventListener('storage', syncStorage);
        timer = setInterval(expire, 60000);
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          if (typeof window !== 'undefined') window.removeEventListener('storage', syncStorage);
          clearInterval(timer);
        }
      };
    },
    setMessages(update: ChatMessage[] | ((messages: ChatMessage[]) => ChatMessage[])) {
      const current = getSnapshot();
      const messages = typeof update === 'function' ? update(current.messages) : update;
      if (messages !== current.messages) publish({ ...current, messages });
    },
    clear() {
      controller?.abort(); generation++;
      clearChatSession();
      publish({ ...loadStoredChatSession(), messages: [DEFAULT_WELCOME_MESSAGE], isLoading: false });
    },
    async send(options: SendOptions) {
      expire();
      const current = getSnapshot();
      const text = options.text.trim();
      if (!text || text.length > 4000 || current.isLoading || isStaticHosting) return false;
      const token = ++generation;
      controller = new AbortController();
      const timestamp = () => new Date().toLocaleTimeString(options.language, { hour: '2-digit', minute: '2-digit' });
      const id = (role: string) => `${role}-${Date.now()}-${++sequence}`;
      publish({ ...current, isLoading: true,
        messages: [...current.messages, { id: id('user'), role: 'user', text, timestamp: timestamp() }] });
      try {
        const data = await request<ChatResponse>('/api/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ message: text, model: options.model, language: options.language,
            conversationHistory: chatHistory(current.messages) }),
        });
        if (generation !== token) return false;
        const message: ChatMessage = { id: id('bot'), role: 'assistant', text: data?.reply, timestamp: timestamp(),
          aiEngine: data?.engine, perspectives: data?.perspectives, activePerspectiveTab: 'consensus' };
        if (!message.text?.trim() || !isChatMessage(message)) throw new Error('Invalid chat response');
        publish({ ...getSnapshot(), messages: [...getSnapshot().messages, message], isLoading: false });
      } catch (error) {
        if (generation !== token) return false;
        publish({ ...getSnapshot(), isLoading: false, messages: [...getSnapshot().messages, {
          id: id('bot-err'), role: 'assistant', kind: 'error', text: options.errorText(error), timestamp: timestamp(),
        }] });
      } finally {
        if (generation === token) controller = undefined;
      }
      return true;
    },
  };
}
export const shaheenChatStore = createChatStore();
