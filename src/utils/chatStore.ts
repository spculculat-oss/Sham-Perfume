import type { SupportedLanguage } from '../types/i18n';
import { removeMediaBlocks } from './mediaBlock';
import { findFormulaBlocks } from './aiFormulaExtractor';
import { greetingKind, greetingReply } from './shaheenGreeting';
import { ApiError, isStaticHosting, requestApi, visitorId, type ChatResponse } from './api';
import { CHAT_STORAGE_KEY, clearChatSession, DEFAULT_WELCOME_MESSAGE, isChatMessage,
  loadStoredChatSession, saveChatSession, type ChatMessage, type ShaheenProvider } from './chatStorage';

/** Visitor-facing response modes (engine ids are still accepted by the API but never shown). */
export type ShaheenModelChoice = 'auto' | 'fast' | 'deep' | 'council' | ShaheenProvider;
const TURN_LIMIT = 4000;

/**
 * Long answers (a full formula is often > 4000 chars) used to stop the history loop, so Shaheen lost
 * the whole conversation right after its most useful reply. Shorten them instead, keeping the
 * machine-readable formula block when there is one.
 */
export function compactTurn(text: string): string {
  if (text.length <= TURN_LIMIT) return text;
  // The visual-aid topics are disposable: drop them rather than leave a half-cut block behind.
  text = removeMediaBlocks(text).trimEnd();
  if (text.length <= TURN_LIMIT) return text;
  const spans = findFormulaBlocks(text);
  const span = spans.filter((s) => s.formula).pop() || spans.pop();
  const formula = span && text.slice(span.start, span.end);
  const tail = formula && formula.length <= 1800 ? `\n…\n${formula}` : '\n…';
  return text.slice(0, TURN_LIMIT - tail.length).trimEnd() + tail;
}

/** `busy`: the server asked to come back shortly (many visitors at once) and the store is retrying by itself. */
interface Snapshot { messages: ChatMessage[]; isLoading: boolean; busy?: boolean; daysRemaining: number; expiresAt: number }
/** Automatic retries when Shaheen answers "busy" (503 SHAHEEN_BUSY), honouring Retry-After. */
export const BUSY_RETRIES = 3;
const busyDelay = (error: ApiError, attempt: number) =>
  Math.min(30_000, (error.retryAfterMs ?? 4000 * 2 ** attempt)) * (0.8 + Math.random() * 0.4);
const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
});
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
export function createChatStore(request: typeof requestApi = requestApi, pause: typeof wait = wait) {
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
    // Another open tab of the site merely saving its own chat used to abort the question in flight here,
    // so the answer silently never came. While waiting, only a real clear (key removed) cancels it.
    if (controller && event.key === CHAT_STORAGE_KEY && typeof event.newValue === 'string') return;
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
      if (!text || text.length > 4000 || current.isLoading) return false;
      const timestamp = () => new Date().toLocaleTimeString(options.language, { hour: '2-digit', minute: '2-digit' });
      const id = (role: string) => `${role}-${Date.now()}-${++sequence}`;
      // A bare greeting is answered here: instant, identical on every site, and no AI quota spent on «هاي».
      const greeting = greetingKind(text);
      if (greeting) {
        publish({ ...current, messages: [...current.messages,
          { id: id('user'), role: 'user', text, timestamp: timestamp() },
          { id: id('bot'), role: 'assistant', text: greetingReply(greeting, options.language), timestamp: timestamp(),
            aiEngine: { id: 'auto', name: 'الخبير شاهين', badge: 'شاهين', provider: 'shaheen' } }] });
        return true;
      }
      if (isStaticHosting) return false;
      const token = ++generation;
      controller = new AbortController();
      publish({ ...current, isLoading: true,
        messages: [...current.messages, { id: id('user'), role: 'user', text, timestamp: timestamp() }] });
      const signal = controller.signal;
      try {
        // The anonymous visitor id travels in the body, not in a custom header: a custom header needs CORS approval,
        // and a server one deploy behind would then block every question from the GitHub Pages site.
        const body = JSON.stringify({ message: text, model: options.model, language: options.language,
          conversationHistory: chatHistory(current.messages), visitorId: visitorId() });
        let data: ChatResponse | undefined;
        for (let attempt = 0; ; attempt++) {
          try {
            data = await request<ChatResponse>('/api/chat', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, signal, body,
            }, 58_000); // the server may queue a question for up to ~50 s before answering
            break;
          } catch (error) {
            // Many visitors at once: wait in line instead of showing an error (the server says how long).
            if (!(error instanceof ApiError && error.code === 'SHAHEEN_BUSY') || attempt >= BUSY_RETRIES || generation !== token) throw error;
            if (!getSnapshot().busy) publish({ ...getSnapshot(), busy: true }, false);
            await pause(busyDelay(error, attempt), signal);
            if (generation !== token) return false;
          }
        }
        if (generation !== token) return false;
        const message: ChatMessage = { id: id('bot'), role: 'assistant', text: data?.reply, timestamp: timestamp(),
          aiEngine: data?.engine };
        if (!message.text?.trim() || !isChatMessage(message)) throw new Error('Invalid chat response');
        publish({ ...getSnapshot(), messages: [...getSnapshot().messages, message], isLoading: false, busy: false });
      } catch (error) {
        if (generation !== token) return false;
        publish({ ...getSnapshot(), isLoading: false, busy: false, messages: [...getSnapshot().messages, {
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
