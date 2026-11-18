import { validAgentReport, type AgentReport } from '../types/agent';
import { safeChatSources, type ChatSource } from './chatSources';

export type ShaheenProvider = 'gemini' | 'deepseek' | 'openai' | 'claude' | 'self_hosted' | 'openrouter' | 'perplexity';

export interface ModelPerspective {
  modelId: ShaheenProvider;
  name: string;
  badge: string;
  provider: ShaheenProvider;
  color: string;
  reply: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  kind?: 'error';
  toolReport?: AgentReport;
  aiEngine?: {
    id: string;
    name: string;
    badge: string;
    /** 'shaheen' for current replies (visitors never get engine names); older saved chats may hold an engine id. */
    provider: ShaheenProvider | 'ensemble' | 'shaheen';
    model?: string;
  };
  perspectives?: ModelPerspective[];
  /** Kept out of the visible reply; sent back only so sources can be shown if the visitor asks. */
  sources?: ChatSource[];
  activePerspectiveTab?: string;
  /** «شاهين يقرا الصور»: a picture he attached — only a tiny thumbnail and what was read from it are kept. */
  image?: ChatImage;
  /** «استقبال الملفات»: a document he attached — its name and the text read from it (the file itself is not kept). */
  file?: ChatFile;
}
export interface ChatFile { name: string; text?: string; pages?: number; source?: 'text' | 'ai' | 'device' }
export function validChatFile(value: unknown): value is ChatFile {
  if (!value || typeof value !== 'object') return false;
  const f = value as ChatFile;
  return typeof f.name === 'string' && f.name.length > 0 && f.name.length <= 120 &&
    (f.text === undefined || (typeof f.text === 'string' && f.text.length <= 8000)) &&
    (f.pages === undefined || (Number.isInteger(f.pages) && f.pages > 0 && f.pages < 100_000)) &&
    (f.source === undefined || f.source === 'text' || f.source === 'ai' || f.source === 'device');
}
export interface ChatImage { thumb: string; name?: string; text?: string; description?: string; source?: 'ai' | 'device' }
const THUMB = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
export function validChatImage(value: unknown): value is ChatImage {
  if (!value || typeof value !== 'object') return false;
  const i = value as ChatImage;
  return typeof i.thumb === 'string' && i.thumb.length <= 60_000 && THUMB.test(i.thumb) &&
    (i.name === undefined || (typeof i.name === 'string' && i.name.length <= 120)) &&
    (i.text === undefined || (typeof i.text === 'string' && i.text.length <= 8000)) &&
    (i.description === undefined || (typeof i.description === 'string' && i.description.length <= 2000)) &&
    (i.source === undefined || i.source === 'ai' || i.source === 'device');
}

export interface StoredChatSession {
  version: number;
  createdAt: number;
  expiresAt: number;
  lastUpdated: number;
  messages: ChatMessage[];
}

export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (1 month)

export const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: `مرحباً! أنا شاهين، مساعدك الرقمي لتصميم العطور وفهم الحسابات والمكونات.
اذكر الحجم والتركيز والمكونات المتاحة وهدفك، وسأساعدك خطوة بخطوة. المقترحات تجريبية وليست اعتماداً للسلامة أو نصيحة طبية.
محادثتك محفوظة محلياً في هذا المتصفح لمدة 30 يوماً. تشغيل الذكاء الاصطناعي يحتاج خادماً ومفتاح خدمة صالحاً.`,
  timestamp: 'الآن',
  aiEngine: {
    id: 'ensemble',
    name: 'الخبير شاهين',
    badge: '👑 الخبير شاهين | شبكة الذكاء الاصطناعي المعملية',
    provider: 'ensemble',
  },
};

export const CHAT_STORAGE_KEY = 'miyaar_perfumer_chat_session';
const PROVIDERS = ['gemini', 'deepseek', 'openai', 'claude', 'self_hosted', 'openrouter', 'perplexity', 'ensemble', 'shaheen'];

export function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as ChatMessage;
  return typeof message.id === 'string' && message.id.length > 0 &&
    (message.role === 'user' || message.role === 'assistant') &&
    typeof message.text === 'string' && message.text.trim().length > 0 && message.text.length <= 32000 &&
    typeof message.timestamp === 'string' &&
    (message.toolReport === undefined || validAgentReport(message.toolReport)) &&
    (message.kind === undefined || message.kind === 'error') &&
    (message.aiEngine === undefined || Boolean(message.aiEngine &&
      typeof message.aiEngine.id === 'string' && typeof message.aiEngine.name === 'string' &&
      typeof message.aiEngine.badge === 'string' && PROVIDERS.includes(message.aiEngine.provider))) &&
    (message.activePerspectiveTab === undefined || typeof message.activePerspectiveTab === 'string') &&
    (message.sources === undefined || safeChatSources(message.sources) !== undefined) &&
    (message.image === undefined || (message.role === 'user' && validChatImage(message.image))) &&
    (message.file === undefined || (message.role === 'user' && validChatFile(message.file))) &&
    (message.perspectives === undefined || (Array.isArray(message.perspectives) && message.perspectives.every((p) =>
      p && PROVIDERS.includes(p.provider) && PROVIDERS.includes(p.modelId) &&
      typeof p.name === 'string' && typeof p.badge === 'string' && typeof p.color === 'string' &&
      typeof p.reply === 'string'
    )));
}

function validDates(session: StoredChatSession, now: number): boolean {
  return session?.version === 1 && Number.isFinite(session.createdAt) && Number.isFinite(session.expiresAt) &&
    session.createdAt <= now && session.expiresAt > session.createdAt &&
    session.expiresAt - session.createdAt <= THIRTY_DAYS_MS;
}

/** Reject corrupt records and enforce a fixed, non-sliding 30-day window. */
export function loadStoredChatSession() {
  const now = Date.now();
  let expired = false;
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (raw) {
      const session: StoredChatSession = JSON.parse(raw);
      expired = validDates(session, now) && session.expiresAt <= now;
      if (validDates(session, now) && !expired && Array.isArray(session.messages)) {
        const seen = new Set<string>();
        const messages = session.messages.filter(isChatMessage).filter((message) => {
          if (seen.has(message.id)) return false;
          seen.add(message.id);
          return true;
        }).slice(-200);
        if (messages.length) return { messages, expiresAt: session.expiresAt,
          daysRemaining: Math.ceil((session.expiresAt - now) / 86400000), isExpiredPurged: false };
      }
      localStorage.removeItem(CHAT_STORAGE_KEY);
    }
  } catch {
    // Storage denial/corruption must not prevent chatting in memory.
  }
  return { messages: [DEFAULT_WELCOME_MESSAGE], expiresAt: now + THIRTY_DAYS_MS,
    daysRemaining: 30, isExpiredPurged: expired };
}

export function saveChatSession(messages: ChatMessage[]): void {
  try {
    const now = Date.now();
    let createdAt = now;
    let expiresAt = now + THIRTY_DAYS_MS;
    try {
      const existing = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || 'null');
      if (validDates(existing, now) && existing.expiresAt > now) {
        createdAt = existing.createdAt;
        expiresAt = existing.expiresAt;
      }
    } catch { /* Replace malformed storage. */ }
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ version: 1, createdAt, expiresAt,
      lastUpdated: now, messages: messages.filter(isChatMessage).slice(-200) } satisfies StoredChatSession));
  } catch { /* The live chat remains usable if storage is unavailable. */ }
}

/**
 * Manually clears chat history.
 */
export function clearChatSession(): void {
  try {
    localStorage.removeItem(CHAT_STORAGE_KEY);
  } catch { /* Clearing in-memory state must still work if storage is blocked. */ }
}

/**
 * Exports and triggers a download of the entire chat conversation as a text file.
 */
export function exportChatTranscriptToFile(messages: ChatMessage[], daysRemaining: number): void {
  const dateStr = new Date().toISOString().split('T')[0];
  const header = `═══════════════════════════════════════════════════════════════════
سجل محادثة الخبير شاهين · شيخ العطارين (منصة صمم عطرك مع شام)
تاريخ التصدير: ${dateStr}
صلاحية الحفظ في المتصفح: تنتهي بعد ${daysRemaining} يوماً (سياسة الحفظ لمدة شهر)
═══════════════════════════════════════════════════════════════════\n\n`;

  const body = messages
    .map((m) => {
      const sender = m.role === 'user' ? 'السائل / صانع العطور' : 'الخبير شاهين (شيخ العطارين)';
      return `[${sender} - ${m.timestamp}]:\n${m.text}\n`;
    })
    .join('\n' + '─'.repeat(55) + '\n\n');

  const fullContent = header + body;
  const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `سجل_محادثة_الخبير_شاهين_${dateStr}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
