import type { SupportedLanguage } from '../types/i18n';
import { isStaticHosting, requestApi, type ChatResponse } from './api';
import { CHAT_STORAGE_KEY, clearChatSession, DEFAULT_WELCOME_MESSAGE, isChatMessage,
  loadStoredChatSession, saveChatSession, type ChatMessage, type ShaheenProvider } from './chatStorage';

export type ShaheenModelChoice = 'auto' | ShaheenProvider;
const TURN_LIMIT = 4000;

/**
 * Long answers (a full formula is often > 4000 chars) used to stop the history loop, so Shaheen lost
 * the whole conversation right after its most useful reply. Shorten them instead, keeping the
 * machine-readable formula block when there is one.
 */
export function compactTurn(text: string): string {
  if (text.length <= TURN_LIMIT) return text;
  const formula = text.match(/```sham-formula\s*\n[\s\S]*?```/)?.[0];
  const tail = formula && formula.length <= 1800 ? `\n…\n${formula}` : '\n…';
  return text.slice(0, TURN_LIMIT - tail.length).trimEnd() + tail;
}

interface Snapshot { messages: ChatMessage[]; isLoading: boolean; daysRemaining: number; expiresAt: number }
interface SendOptions {
  text: string; model: ShaheenModelChoice; language: SupportedLanguage;
  errorText: (error: unknown) => string;
}

export function chatHistory(messages: ChatMessage[]) {
  const history: { role: 'user' | 'assistant'; text: string }[] = [];
  let size = 0;
  for (const message of [...messages].reverse()) {
    if (message.id === 'welcome' || message.kind === 'error' || message.id.startsWith('bot-err-') ||
      message.id.startsWith('err-') || message.id.startsWith('expired-notice-')) continue;
    const text = compactTurn(message.text.trim());
    if (!text || size + text.length > 16000 || history.length === 24) break;
    history.unshift({ role: message.role, text });
    size += text.length;
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
  const store = {
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
    /** Re-asks the question behind a trailing error bubble (removes both, then sends again). */
    async retry(options: Omit<SendOptions, 'text'>) {
      const current = getSnapshot();
      const last = current.messages[current.messages.length - 1];
      if (current.isLoading || !last || last.kind !== 'error') return false;
      const userIndex = current.messages.length - 2;
      const question = current.messages[userIndex];
      if (!question || question.role !== 'user') return false;
      publish({ ...current, messages: current.messages.slice(0, userIndex) });
      return store.send({ ...options, text: question.text });
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
  return store;
}
export const shaheenChatStore = createChatStore();
