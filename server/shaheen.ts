import { SUPPORTED_LANGUAGES } from '../src/types/i18n';
import type { SupportedLanguage } from '../src/types/i18n';

export const PROVIDERS = ['gemini', 'deepseek', 'openai', 'claude'] as const;
export type Provider = typeof PROVIDERS[number];
export interface ChatTurn { role: 'user' | 'assistant'; text: string }
export interface ChatRequest {
  message: string;
  model: Provider | 'auto';
  language: SupportedLanguage;
  conversationHistory: ChatTurn[];
}
export class ChatError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function validateChatRequest(body: unknown): ChatRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ChatError(400, 'INVALID_REQUEST', 'A JSON object is required');
  }
  const { message, model = 'auto', language = 'ar', conversationHistory = [] } = body as Record<string, unknown>;
  if (typeof message !== 'string' || !message.trim()) throw new ChatError(400, 'INVALID_MESSAGE', 'Message is required');
  if (message.length > 4000) throw new ChatError(400, 'MESSAGE_TOO_LONG', 'Message exceeds 4000 characters');
  if (model !== 'auto' && !PROVIDERS.includes(model as Provider)) throw new ChatError(400, 'INVALID_MODEL', 'Unknown AI provider');
  if (!SUPPORTED_LANGUAGES.some((lang) => lang.code === language)) throw new ChatError(400, 'INVALID_LANGUAGE', 'Unsupported language');
  if (!Array.isArray(conversationHistory) || conversationHistory.length > 24) {
    throw new ChatError(400, 'INVALID_HISTORY', 'History must contain at most 24 turns');
  }
  let size = 0;
  const history = conversationHistory.map((turn): ChatTurn => {
    if (!turn || (turn.role !== 'user' && turn.role !== 'assistant') || typeof turn.text !== 'string' ||
      !turn.text.trim() || turn.text.length > 4000) {
      throw new ChatError(400, 'INVALID_HISTORY', 'Invalid history turn');
    }
    size += turn.text.length;
    return { role: turn.role, text: turn.text.trim() };
  });
  if (size > 16000) throw new ChatError(400, 'INVALID_HISTORY', 'History exceeds 16000 characters');
  return { message: message.trim(), model: model as ChatRequest['model'], language: language as SupportedLanguage, conversationHistory: history };
}

const settings = {
  gemini: { key: 'GEMINI_API_KEY', model: 'GEMINI_MODEL', defaultModel: 'gemini-2.5-flash', name: 'Google Gemini', color: 'emerald' },
  deepseek: { key: 'DEEPSEEK_API_KEY', model: 'DEEPSEEK_MODEL', defaultModel: 'deepseek-chat', name: 'DeepSeek', color: 'blue' },
  openai: { key: 'OPENAI_API_KEY', model: 'OPENAI_MODEL', defaultModel: 'gpt-4o-mini', name: 'OpenAI', color: 'green' },
  claude: { key: 'ANTHROPIC_API_KEY', model: 'ANTHROPIC_MODEL', defaultModel: 'claude-sonnet-4-5', name: 'Anthropic Claude', color: 'purple' },
} as const;

type Environment = Record<string, string | undefined>;
const configured = (value: string | undefined) => Boolean(value?.trim() && !/^(MY_|YOUR_|<)/i.test(value.trim()));
export function getChatModels(env: Environment) {
  const models = PROVIDERS.map((id) => ({
    id, provider: id, name: settings[id].name,
    model: env[settings[id].model]?.trim() || settings[id].defaultModel,
    badge: settings[id].name, accentColor: settings[id].color,
    hasApiKey: configured(env[settings[id].key]),
  }));
  return [{ id: 'auto', provider: 'ensemble', name: 'شاهين — اختيار تلقائي', badge: 'شاهين',
    accentColor: 'amber', hasApiKey: models.some((model) => model.hasApiKey) }, ...models];
}

export function systemInstruction(language: SupportedLanguage): string {
  const languageName = SUPPORTED_LANGUAGES.find((lang) => lang.code === language)!.name;
  return `أنت شاهين، مساعد ذكاء اصطناعي متخصص في تصميم العطور لمنصة «صمم عطرك مع شام».
أجب باللغة المطلوبة: ${languageName} (${language}). اتبع سياق الحوار وأجب عن السؤال مباشرة. اسأل عند نقص البيانات ولا تفرض وصفة جاهزة.
كن واضحاً وودوداً. لا تدّع أنك إنسان أو طبيب أو أنك أجريت تجربة مخبرية أو استشرت محركات أخرى.
لا تختلق مصادر أو شهادات IFRA أو نسب أمان عامة لكل المواد. السلامة تعتمد على المادة والتركيز النهائي وفئة المنتج وشهادة المورد؛ لا تضمن الأمان أو الثبات بالساعات.
لا تصف علاجات أو جرعات للأطفال أو الحوامل أو مرضى الربو. وضّح أن تلك الأسئلة تحتاج مختصاً مؤهلاً. لا تنصح بابتلاع الزيوت أو بوضعها مركزة على الجلد.
في الحسابات فرّق بين النسب الحجمية والوزنية، ولا تحوّل مل إلى جرام دون كثافة معلومة. وضّح أن التركيبات المقترحة تجريبية وتحتاج مراجعة السلامة والتوافق واختباراً صغيراً.
إذا طلب المستخدم تركيبة عطر قابلة للنقل للحاسبة، وكانت البيانات كافية، اشرحها ثم أرفق JSON واحداً داخل سياج كود باسم sham-formula بالحقول التالية، دون تخمين بيانات ناقصة:
{"title":"اسم العطر","author":"شاهين — مقترح تجريبي","concentrationPercent":20,"concentrationType":"edp","bottleVolumeMl":50,"alcoholPercentage":96,"waterPercent":0,"fixativePercent":0,"macerationDays":30,"summary":"مقترح يحتاج مراجعة السلامة","pyramidNotes":[{"id":"note-1","nameAr":"اسم المادة المحددة","nameEn":"Exact material name","category":"top","percentageOfOil":100}]}
الأرقام أعلاه أمثلة للشكل فقط، وليست وصفة افتراضية. يجب أن تطابق القيم الشرح وطلب المستخدم، وأن تجمع نسب pyramidNotes إلى 100 من الزيت. التصنيفات top أو heart أو base. نسب التركيز والماء والمثبت من إجمالي المنتج ولا تتجاوز 100 معاً. لا ترفق JSON في التحيات أو الإجابات العامة أو الطبية، ولا تدّع أن الصيغة معتمدة للاستخدام على الجلد.`;
}

/** Only the provider that actually answered is credited. Auto is failover, not a fake panel. */
export async function executeChat(input: ChatRequest, options: {
  env?: Environment; fetch?: typeof fetch; signal?: AbortSignal; timeoutMs?: number; totalTimeoutMs?: number;
} = {}) {
  const env = options.env || process.env;
  const request = options.fetch || fetch;
  const available = PROVIDERS.filter((id) => configured(env[settings[id].key]));
  const candidates = input.model === 'auto' ? available : available.filter((id) => id === input.model);
  if (!candidates.length) throw new ChatError(503, 'PROVIDER_NOT_CONFIGURED', 'No API key configured for the requested provider');
  const total = AbortSignal.any([AbortSignal.timeout(options.totalTimeoutMs ?? 30000), ...(options.signal ? [options.signal] : [])]);
  let timedOut = false;
  for (const provider of candidates) {
    if (total.aborted) break;
    const config = settings[provider];
    const key = env[config.key]!.trim();
    const model = env[config.model]?.trim() || config.defaultModel;
    const signal = AbortSignal.any([total, AbortSignal.timeout(options.timeoutMs ?? 12000)]);
    const instruction = systemInstruction(input.language);
    const turns = [...input.conversationHistory, { role: 'user', text: input.message }];
    let url: string;
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let body: object;
    if (provider === 'gemini') {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      headers['x-goog-api-key'] = key;
      body = { systemInstruction: { parts: [{ text: instruction }] },
        contents: turns.map((turn) => ({ role: turn.role === 'assistant' ? 'model' : 'user', parts: [{ text: turn.text }] })),
        generationConfig: { temperature: 0.5, maxOutputTokens: 4096 } };
    } else if (provider === 'claude') {
      url = 'https://api.anthropic.com/v1/messages';
      headers = { ...headers, 'x-api-key': key, 'anthropic-version': '2023-06-01' };
      body = { model, system: instruction, max_tokens: 4096,
        messages: turns.map((turn) => ({ role: turn.role, content: turn.text })) };
    } else {
      url = provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://api.deepseek.com/chat/completions';
      headers.Authorization = `Bearer ${key}`;
      body = { model, temperature: 0.5, max_tokens: 4096,
        messages: [{ role: 'system', content: instruction }, ...turns.map((turn) => ({ role: turn.role, content: turn.text }))] };
    }
    try {
      const response = await request(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
      if (!response.ok) continue;
      const data = await response.json();
      const reply = provider === 'gemini'
        ? data.candidates?.[0]?.content?.parts?.filter((part: { thought?: boolean }) => !part.thought).map((part: { text?: string }) => part.text || '').join('')
        : provider === 'claude'
          ? data.content?.filter((part: { type: string }) => part.type === 'text').map((part: { text: string }) => part.text).join('\n')
          : data.choices?.[0]?.message?.content;
      if (signal.aborted) throw signal.reason;
      if (typeof reply !== 'string' || !reply.trim() || reply.length > 32000) continue;
      return { reply: reply.trim(), engine: { id: provider, provider, name: config.name,
        badge: config.name, model, accentColor: config.color } };
    } catch {
      timedOut ||= signal.aborted;
      // Never leak provider error bodies, credentials, or fabricated fallback answers.
    }
  }
  if (total.aborted || timedOut) throw new ChatError(504, 'PROVIDER_TIMEOUT', 'AI request timed out or was cancelled');
  throw new ChatError(503, 'PROVIDER_UNAVAILABLE', 'The configured AI providers did not return a valid answer');
}
