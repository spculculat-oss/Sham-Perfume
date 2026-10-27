import { trackInsight } from './insightsTracker';
import type { SupportedLanguage } from '../types/i18n';
import { budgetsToHome } from './chatPrices';
import { chatMoney, currentDisplayCurrency, followEntryCountry } from './storeCheckout';
import { removeMediaBlocks } from './mediaBlock';
import { findFormulaBlocks } from './aiFormulaExtractor';
import { greetingKind, greetingReply } from './shaheenGreeting';
import { quickAnswer } from './shaheenQuickApps';
import { maskSensitive } from './ownerAuthority';
import { browserMemory, type OfflineAnswer, type OfflineMemory } from './browserMemory';
import { isSourcesFollowUp, requestedSourcesReply } from './chatSources';
import { offlineNote } from './shaheenMemory';
import { keyboardFix, understoodNote } from './shaheenSpelling';
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

/**
 * When the server cannot answer (no connection, server down, every engine busy or out of quota) Shaheen
 * answers from memory instead of an error. Not for a question the server refused (bad request, rate
 * limit…) or when the administration turned Shaheen off.
 */
export function canAnswerFromMemory(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true; // network failure, timeout, a non-JSON page
  if (error.code === 'SHAHEEN_DISABLED') return false;
  return error.status >= 500 || error.status === 408 || error.code === 'SHAHEEN_BUSY';
}

export function chatHistory(messages: ChatMessage[]) {
  const history: { role: 'user' | 'assistant'; text: string; sources?: ChatMessage['sources'] }[] = [];
  let size = 0; let latestAssistantSeen = false;
  for (const message of [...messages].reverse()) {
    if (message.id === 'welcome' || message.kind === 'error' || message.id.startsWith('bot-err-') ||
      message.id.startsWith('err-') || message.id.startsWith('expired-notice-')) continue;
    const text = compactTurn(message.text.trim());
    if (!text || size + text.length > 16000 || history.length === 24) break;
    const sources = message.role === 'assistant' && !latestAssistantSeen ? message.sources : undefined;
    if (message.role === 'assistant') latestAssistantSeen = true;
    history.unshift({ role: message.role, text, ...(sources?.length ? { sources } : {}) });
    size += text.length;
  }
  return history;
}

/**
 * «ترشيح المتجر»: a shopping question («عايز عطر هدية بـ 500») that no engine could answer still gets the store's own
 * picks — real product pages — clearly labelled as an automatic pick, never as the expert's opinion. Formula and ratio
 * questions are left to the expert (a product list is not an answer to «اعمل لي تركيبة»).
 */
export type CatalogFallback = (text: string, lang: SupportedLanguage, history?: { role: 'user' | 'assistant'; text: string }[]) => Promise<string | undefined>;
const SHOPPING = /(?:عايز|عاوز|محتاج|بدور|أدور|ادور|ابحث|أبحث|رشح|رشّح|اقترح|انصحني|نصيحة)[^\n]{0,24}(?:عطر|ريحة|رائحة|برفان|بارفان|برفيوم)|هدية|هديه|بكام|سعر|اشتري|أشتري|شراء|المتجر|\b(?:buy|recommend|suggest|gift|price|shop|looking for)\b/i;
const NOT_SHOPPING = /نسب|تركيب|اعمل|أعمل|اصنع|خلطة|خلطه|معادلة|تخفيف|formula|ratio|blend|make my own|dilut/i;
export const isShoppingQuestion = (text: string) => SHOPPING.test(text) && !NOT_SHOPPING.test(text);

interface CatalogPick { product: { name: { ar: string; en: string }; slug: string; inStock: boolean }; why: string }
/** The fallback message: up to three in-stock picks with links, and an honest line saying what it is. */
export function catalogReply(picks: CatalogPick[], lang: SupportedLanguage, link: (slug: string) => string | undefined): string | undefined {
  const shown = picks.filter((p) => p.product.inStock).slice(0, 3);
  if (!shown.length) return undefined;
  const ar = lang === 'ar';
  const lines = shown.map(({ product, why }) => {
    const name = (ar ? product.name.ar : product.name.en) || product.name.en || product.name.ar;
    const url = link(product.slug);
    return `- ${url ? `[${name.replace(/[[\]]/g, '')}](${url})` : `**${name}**`}${why ? ` — ${why}` : ''}`;
  });
  return ar
    ? `دي ترشيحات من منتجات المتجر على حسب كلامك:\n\n${lines.join('\n')}\n\n_ترشيح من فلتر المتجر على حسب كلامك — راجع تفاصيل كل منتج قبل ما تختار._`
    : `Here are picks from the store's products based on your words:\n\n${lines.join('\n')}\n\n_Picked by the store filter from your words — check each product's details before choosing._`;
}

/** A product page as a full https link from wherever the chat runs (none on a plain-http dev page). */
const pageLink = (productPageUrl: (slug: string) => string) => (slug: string) => {
  const base = typeof location !== 'undefined' ? location.href : '';
  try { const url = new URL(productPageUrl(slug), base || undefined).href; return url.startsWith('https://') ? url : undefined; } catch { return undefined; }
};

/**
 * Default: «عقل شاهين الموصول» on the static catalogue the store page uses (loaded only when needed) — real products
 * with their price, notes and why they fit, read with the conversation before; the plain filter list if that fails.
 */
export const storeCatalogFallback: CatalogFallback = async (text, lang, history = []) => {
  const { loadStoreCatalog, localSuggestion, productPageUrl } = await import('./liveStore');
  const products = await loadStoreCatalog();
  const link = pageLink(productPageUrl);
  const brain = await import('./shaheenBrain').catch(() => undefined);
  const ctx = brain?.withContext(text, history);
  const seller = ctx ? await import('./shaheenSeller').catch(() => undefined) : undefined;
  const pitch = ctx ? await import('./shaheenPitch').catch(() => undefined) : undefined;
  const linked = ctx && (seller?.salesAnswer(products, ctx, lang, link) || pitch?.productAnswer(products, ctx, lang, link) || brain?.storeAnswer(products, ctx, lang, link))?.reply;
  return linked ?? catalogReply(localSuggestion(products, text, lang).picks, lang, link);
};

/** Under a formula he designed in the browser: the store's ready perfumes that share its notes. */
const designWithStore = async (text: string, lang: SupportedLanguage, previous?: string): Promise<string | undefined> => {
  // A cosmetic formula (cream, serum, balm …) first: the perfume designer steps aside for it.
  const cosmetic = await import('./cosmeticFormulator').then((m) => m.cosmeticFor(text, lang)).catch(() => undefined);
  if (cosmetic) return cosmetic.reply;
  const d = await import('./shaheenDesigner').then((m) => m.designFor(text, lang, previous)).catch(() => undefined);
  if (!d?.design) return d?.reply;
  try {
    const [{ loadStoreCatalog, productPageUrl }, brain] = await Promise.all([import('./liveStore'), import('./shaheenBrain')]);
    return d.reply + brain.designStoreNote(await loadStoreCatalog(), d.design, d.lang, pageLink(productPageUrl));
  } catch { return d.reply; }
};

/** One synchronous owner for both chat surfaces: no effect-driven rebroadcast loops. */
export function createChatStore(request: typeof requestApi = requestApi, pause: typeof wait = wait, memory: OfflineMemory = browserMemory,
  catalog: CatalogFallback = storeCatalogFallback) {
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
      const typedText = options.text.trim();
      if (!typedText || typedText.length > 4000 || current.isLoading) return false;
      // «فهم شاهين للغلطات»: Arabic typed with the English keyboard on («.ivm hgg,js») becomes the Arabic meant
      // («زهرة اللوتس») — shown as the visitor's message, so he sees what Shaheen read.
      const text = keyboardFix(typedText) ?? typedText;
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
      if (isSourcesFollowUp(text)) {
        const previousAnswer = [...current.messages].reverse().find((message) => message.role === 'assistant');
        const sources = previousAnswer?.sources || [];
        if (sources.length || isStaticHosting) {
          publish({ ...current, messages: [...current.messages,
            { id: id('user'), role: 'user', text, timestamp: timestamp() },
            { id: id('bot'), role: 'assistant', text: requestedSourcesReply(sources, options.language), timestamp: timestamp(), ...(sources.length ? { sources } : {}),
              aiEngine: { id: 'auto', name: 'الخبير شاهين', badge: 'شاهين', provider: 'shaheen' } }] });
          return true;
        }
      }
      // «تطبيقات شاهين السريعة»: a simple, complete task (alcohol dilution, oil amounts, oz↔ml, thanks…) is
      // calculated right here — instant, no queue, no AI quota — so the engines stay free for real questions.
      const quick = quickAnswer(text, options.language);
      if (quick) {
        publish({ ...current, messages: [...current.messages,
          // A card/ID number is not even kept in this browser's chat history (it would travel with the next turn).
          { id: id('user'), role: 'user', text: quick.app === 'privacy' ? maskSensitive(text) : text, timestamp: timestamp() },
          { id: id('bot'), role: 'assistant', text: quick.reply, timestamp: timestamp(),
            aiEngine: { id: 'auto', name: 'الخبير شاهين', badge: 'شاهين', provider: 'shaheen' } }] });
        return true;
      }
      if (isStaticHosting) return false;
      const token = ++generation;
      controller = new AbortController();
      publish({ ...current, isLoading: true,
        messages: [...current.messages, { id: id('user'), role: 'user', text, timestamp: timestamp() }] });
      const signal = controller.signal;
      const history = chatHistory(current.messages);
      // «شاهين بعملة بلدك»: the visitor's own money («moins de 30 €») reaches the brain in the store's pounds.
      const brainText = budgetsToHome(text, currentDisplayCurrency(options.language), options.language);
      trackInsight('chat', { text }); // «خزنة فهم الزوار» (with consent; secrets, e-mails and numbers never kept)
      // «دولة الدخول قبل الرد»: the page's country and currency travel too; the server checks where he is entering
      // from and writes the reply's prices in that country's currency (and tells us which country it was).
      const money = chatMoney(options.language);
      try {
        // The anonymous visitor id travels in the body, not in a custom header: a custom header needs CORS approval,
        // and a server one deploy behind would then block every question from the GitHub Pages site.
        const body = JSON.stringify({ message: brainText, model: options.model, language: options.language,
          conversationHistory: history, visitorId: visitorId(), ...money });
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
        followEntryCountry(data?.country);
        const message: ChatMessage = { id: id('bot'), role: 'assistant', text: data?.reply, timestamp: timestamp(),
          aiEngine: data?.engine, ...(data?.sources?.length ? { sources: data.sources } : {}) };
        if (!message.text?.trim() || !isChatMessage(message)) throw new Error('Invalid chat response');
        publish({ ...getSnapshot(), messages: [...getSnapshot().messages, message], isLoading: false, busy: false });
        // «ذاكرة شاهين»: this browser keeps its opening questions for the day the server cannot be reached.
        if (!history.length && options.model !== 'council') memory.learn({ question: text, lang: options.language, mode: options.model, answer: message.text });
      } catch (firstError) {
        let error: unknown = firstError;
        if (generation !== token) return false;
        // The chosen mode could not answer (its engines are down or out of quota) but the server is there:
        // Shaheen answers the same question in his fast mode before falling back to memory or an error.
        // (Not after a gateway timeout: the server already used its time, a second wait helps no one.)
        if (canAnswerFromMemory(error) && error instanceof ApiError && error.status !== 504 && options.model !== 'fast') {
          try {
            const fast = await request<ChatResponse>('/api/chat', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
              body: JSON.stringify({ message: brainText, model: 'fast', language: options.language, conversationHistory: history, visitorId: visitorId(), ...money }),
            }, 30_000);
            if (generation !== token) return false;
            followEntryCountry(fast?.country);
            const message: ChatMessage = { id: id('bot'), role: 'assistant', text: fast?.reply, timestamp: timestamp(), aiEngine: fast?.engine,
              ...(fast?.sources?.length ? { sources: fast.sources } : {}) };
            if (message.text?.trim() && isChatMessage(message)) {
              publish({ ...getSnapshot(), messages: [...getSnapshot().messages, message], isLoading: false, busy: false });
              if (!history.length) memory.learn({ question: text, lang: options.language, mode: 'fast', answer: message.text });
              return true;
            }
          } catch (fastError) { error = fastError instanceof ApiError ? error : fastError; }
          if (generation !== token) return false;
        }
        // «مصمم شاهين الذاتي»: a design request is answered by his own formula designer, right here in the browser.
        if (canAnswerFromMemory(error)) {
          const last = current.messages[current.messages.length - 1];
          const previous = last?.role === 'assistant' && last.text?.includes('sham-formula')
            ? [...current.messages].reverse().find((m) => m.role === 'user')?.text : undefined;
          const design = await designWithStore(text, options.language, previous);
          if (generation !== token) return false;
          if (design) {
            publish({ ...getSnapshot(), isLoading: false, busy: false, messages: [...getSnapshot().messages, {
              id: id('bot'), role: 'assistant', text: design, timestamp: timestamp(),
              aiEngine: { id: 'auto', name: 'الخبير شاهين', badge: 'شاهين', provider: 'shaheen' },
            }] });
            return true;
          }
        }
        // «شاهين ابن الناس»: a complaint, an angry visitor, wholesale, corporate gifts, a discount request, thanks, a
        // condolence or gift etiquette — answered with the store's real channels, in the browser too.
        if (canAnswerFromMemory(error)) {
          const [relations, mind] = await Promise.all([import('./shaheenRelations').catch(() => undefined), import('./shaheenBrain').catch(() => undefined)]);
          const relation = relations && mind ? relations.relationsAnswer(mind.withContext(brainText, history), options.language) : undefined;
          if (generation !== token) return false;
          if (relation) {
            publish({ ...getSnapshot(), isLoading: false, busy: false, messages: [...getSnapshot().messages, {
              id: id('bot'), role: 'assistant', text: relation.reply, timestamp: timestamp(),
              aiEngine: { id: 'auto', name: 'الخبير شاهين', badge: 'شاهين', provider: 'shaheen' },
            }] });
            return true;
          }
        }
        // «الربط المباشر»: the question read with the conversation before it («طب وللشتا؟»), and a wish for a perfume
        // answered from the store itself before anything else (an old answer from memory knows no product or price).
        const brain = canAnswerFromMemory(error) ? await import('./shaheenBrain').catch(() => undefined) : undefined;
        if (generation !== token) return false;
        const ctx = brain?.withContext(brainText, history);
        // «هاخده / غالي / مش متأكد» right after a reply with store products is the seller's turn.
        const sellerTurn = Boolean(brain && (ctx?.lastReply || ctx?.shownReply) && /\/p\/[a-z0-9-]+\.html/.test(`${ctx?.lastReply || ''}\n${ctx?.shownReply || ''}`) && (await import('./shaheenSeller').catch(() => undefined))?.saleMove(text));
        if (generation !== token) return false;
        const shopping = isShoppingQuestion(text) || sellerTurn || Boolean(ctx && brain?.wantsStore(ctx.text));
        if (canAnswerFromMemory(error) && shopping) {
          const picks = await catalog(brainText, options.language, history).catch(() => undefined);
          if (generation !== token) return false;
          if (picks) {
            publish({ ...getSnapshot(), isLoading: false, busy: false, messages: [...getSnapshot().messages, {
              id: id('bot'), role: 'assistant', text: picks, timestamp: timestamp(),
              aiEngine: { id: 'auto', name: 'الخبير شاهين', badge: 'شاهين', provider: 'shaheen' },
            }] });
            return true;
          }
        }
        const followed = ctx?.followUp ? ctx.text : text;
        // «المكتب السريع»: a science question is answered from his index — the curriculum travels with the page, so no
        // lesson file or memory file is downloaded and the answer is on screen in a fraction of a millisecond.
        if (canAnswerFromMemory(error) && memory.science && !shopping) {
          const researched = await memory.science(followed, options.language).catch(() => undefined);
          if (generation !== token) return false;
          if (researched) {
            publish({ ...getSnapshot(), isLoading: false, busy: false, messages: [...getSnapshot().messages, {
              id: id('bot'), role: 'assistant', text: researched, timestamp: timestamp(),
              aiEngine: { id: 'auto', name: 'الخبير شاهين', badge: 'شاهين', provider: 'shaheen' },
            }] });
            return true;
          }
        }
        // «وكيل شاهين»: no server — he still works the question out (the school's experts, his library, his memory, open
        // sources) instead of repeating the closest old answer. Shopping questions get the store's picks below.
        if (canAnswerFromMemory(error) && memory.agent && !shopping) {
          const worked = await memory.agent(followed, options.language).catch(() => undefined);
          if (generation !== token) return false;
          if (worked) {
            const answer = typeof worked === 'string' ? worked : worked.answer;
            const sources = typeof worked === 'string' ? undefined : worked.sources;
            publish({ ...getSnapshot(), isLoading: false, busy: false, messages: [...getSnapshot().messages, {
              id: id('bot'), role: 'assistant', text: answer, timestamp: timestamp(), ...(sources?.length ? { sources } : {}),
              aiEngine: { id: 'auto', name: 'الخبير شاهين', badge: 'شاهين', provider: 'shaheen' },
            }] });
            return true;
          }
        }
        let remembered = canAnswerFromMemory(error) ? await memory.recall(text, options.language).catch(() => undefined) : undefined;
        if (generation !== token) return false;
        // «فهم شاهين للغلطات»: nothing close as typed — the question as he understands it (a mistyped word read as the
        // word meant), with what he understood shown above the answer.
        let asked = text; let note = '';
        if (!remembered && canAnswerFromMemory(error) && memory.understand) {
          const understood = await memory.understand(text, options.language).catch(() => undefined);
          if (generation !== token) return false;
          if (understood?.changed) {
            asked = understood.text; note = understoodNote(options.language, understood);
            remembered = await memory.recall(asked, options.language).catch(() => undefined);
            if (generation !== token) return false;
          }
        }
        if (remembered) {
          publish({ ...getSnapshot(), isLoading: false, busy: false, messages: [...getSnapshot().messages, {
            id: id('bot'), role: 'assistant', text: note + remembered.answer + offlineNote(options.language, remembered.exact), timestamp: timestamp(),
            aiEngine: { id: 'auto', name: 'الخبير شاهين', badge: 'شاهين', provider: 'shaheen' },
          }] });
          return true;
        }
        // «مكتبة شاهين»: no server and nothing close in memory — what he knows from his lessons and encyclopaedia.
        const offline = !shopping && canAnswerFromMemory(error);
        let known = offline && memory.library ? await memory.library(asked, options.language).catch(() => undefined) : undefined;
        let knownSources: ChatMessage['sources'];
        if (generation !== token) return false;
        // «باحث شاهين»: not in his library either — he looks it up in open sources and answers naturally.
        if (!known && offline && memory.research) {
          const found = await memory.research(asked, options.language).catch(() => undefined);
          if (typeof found === 'string') known = found;
          else if (found) { known = found.answer; knownSources = found.sources; }
        }
        if (generation !== token) return false;
        if (known) {
          publish({ ...getSnapshot(), isLoading: false, busy: false, messages: [...getSnapshot().messages, {
            id: id('bot'), role: 'assistant', text: note + known, timestamp: timestamp(), ...(knownSources?.length ? { sources: knownSources } : {}),
            aiEngine: { id: 'auto', name: 'الخبير شاهين', badge: 'شاهين', provider: 'shaheen' },
          }] });
          return true;
        }
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
