export interface ModelPerspective {
  modelId: 'gemini' | 'deepseek' | 'openai' | 'claude';
  name: string;
  badge: string;
  provider: 'gemini' | 'deepseek' | 'openai' | 'claude';
  color: string;
  reply: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  aiEngine?: {
    id: string;
    name: string;
    badge: string;
    provider: 'gemini' | 'deepseek' | 'openai' | 'claude' | 'ensemble';
  };
  perspectives?: ModelPerspective[];
  activePerspectiveTab?: string;
}

export interface StoredChatSession {
  version: number;
  createdAt: number;
  expiresAt: number;
  lastUpdated: number;
  messages: ChatMessage[];
}

const CHAT_STORAGE_KEY = 'miyaar_perfumer_chat_session';
export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (1 month)

export const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: `مرحباً بك في معملي يا عاشق الشذى والطيوب! أنا الخبير شاهين، شيخ العطارين وكبير كيميائيي العطور.
أنا هنا بجانب ميزاني ومخابيري أقطر الزيوت الخام وأمزج التراكيب.
اسألني عن أي تركيبة عطرية، نسب المكونات بالجرام، حل مشكلات التعكر، أو أسرار التعتيق وسأجيبك بدقة المعمل.
كما يمكنك تحويل بيانات أي تركيبة مباشرة إلى «حاسبة التركيب» أو «تدوينها في الوصفات» بنقرة زر واحدة!

📌 ملاحظة: محادثتك محفوظة بالكامل محلياً في جهازك، وستُمسح تلقائياً بعد شهر (30 يوماً) من بدئها حفاظاً على الخصوصية.`,
  timestamp: 'الآن',
  aiEngine: {
    id: 'ensemble',
    name: 'خبير المعمل المتكامل',
    badge: '⚡ الخبير شاهين | Multi-AI Ensemble',
    provider: 'ensemble',
  },
};

/**
 * Loads stored chat from localStorage. If the session has passed 30 days (1 month),
 * it automatically clears the storage and initializes a fresh session.
 */
export function loadStoredChatSession(): {
  messages: ChatMessage[];
  expiresAt: number;
  daysRemaining: number;
  isExpiredPurged: boolean;
} {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (raw) {
      const session: StoredChatSession = JSON.parse(raw);
      const now = Date.now();

      // Check if session has expired (passed 30 days / 1 month)
      if (session.expiresAt && now > session.expiresAt) {
        localStorage.removeItem(CHAT_STORAGE_KEY);
        const newExpiresAt = now + THIRTY_DAYS_MS;
        return {
          messages: [
            {
              id: 'expired-notice-' + now,
              role: 'assistant',
              text: `مرحباً بك مجدداً يا صديقي! لقد مر شهر (30 يوماً) على محادثتك السابقة، وتم مسحها تلقائياً للحفاظ على خصوصيتك ومساحة التخزين. معمل الخبير شاهين مفتوح لك لبدء جلسة جديدة اليوم!`,
              timestamp: 'الآن',
            },
          ],
          expiresAt: newExpiresAt,
          daysRemaining: 30,
          isExpiredPurged: true,
        };
      }

      // Valid session
      if (Array.isArray(session.messages) && session.messages.length > 0) {
        const daysRemaining = Math.max(
          1,
          Math.ceil((session.expiresAt - now) / (24 * 60 * 60 * 1000))
        );
        return {
          messages: session.messages,
          expiresAt: session.expiresAt,
          daysRemaining,
          isExpiredPurged: false,
        };
      }
    }
  } catch (e) {
    console.error('Error loading chat storage session:', e);
  }

  // Brand new session
  const now = Date.now();
  const expiresAt = now + THIRTY_DAYS_MS;
  return {
    messages: [DEFAULT_WELCOME_MESSAGE],
    expiresAt,
    daysRemaining: 30,
    isExpiredPurged: false,
  };
}

/**
 * Persists chat messages to localStorage with a fixed 30-day expiration window.
 */
export function saveChatSession(messages: ChatMessage[]): void {
  try {
    const now = Date.now();
    let createdAt = now;
    let expiresAt = now + THIRTY_DAYS_MS;

    const existingRaw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (existingRaw) {
      try {
        const existing: StoredChatSession = JSON.parse(existingRaw);
        if (existing.createdAt && existing.expiresAt) {
          createdAt = existing.createdAt;
          expiresAt = existing.expiresAt;
        }
      } catch (err) {
        // ignore parse error, use new timestamps
      }
    }

    const session: StoredChatSession = {
      version: 1,
      createdAt,
      expiresAt,
      lastUpdated: now,
      messages,
    };

    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    console.error('Error saving chat storage session:', e);
  }
}

/**
 * Manually clears chat history.
 */
export function clearChatSession(): void {
  try {
    localStorage.removeItem(CHAT_STORAGE_KEY);
  } catch (e) {
    console.error('Error clearing chat session:', e);
  }
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
