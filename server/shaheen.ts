/**
 * «الخبير شاهين» — the perfume-design chat (floating window + the lab page).
 *
 * It shares the engine layer of Sham Core (server/core/engines.ts), so every engine the admin can
 * configure there (Gemini, DeepSeek, OpenAI, Claude, a self-hosted open model, OpenRouter) works
 * here too, and its settings come from server/config/shaheen.ts + the admin dashboard.
 * Attribution is honest: only the engine that actually answered is credited; "auto" is failover,
 * not a fake panel, and there are no canned answers pretending to be AI.
 */
import express from 'express';
import { SUPPORTED_LANGUAGES } from '../src/types/i18n';
import type { SupportedLanguage } from '../src/types/i18n';
import { callEngine, engineStatuses, type EngineFailure } from './core/engines';
import { RateLimiter, clientKey } from './core/rateLimit';
import type { Repository } from './core/repository';
import type { ModelEngineId, ShaheenSettings } from './core/types';
import { SHAHEEN_ENGINES, SHAHEEN_SITE_SETTINGS } from './config/shaheen';

export const PROVIDERS = SHAHEEN_ENGINES;
export type Provider = ModelEngineId;
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
type Environment = Record<string, string | undefined>;

export const ENGINE_INFO: Record<ModelEngineId, { name: string; color: string }> = {
  gemini: { name: 'Google Gemini', color: 'emerald' },
  deepseek: { name: 'DeepSeek', color: 'blue' },
  openai: { name: 'OpenAI', color: 'green' },
  claude: { name: 'Anthropic Claude', color: 'purple' },
  self_hosted: { name: 'Sham Open Model', color: 'stone' },
  openrouter: { name: 'OpenRouter', color: 'sky' },
};

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

/** What visitors see: "auto" + the engines the admin allowed, with their real configuration state. */
export function getChatModels(env: Environment, settings: ShaheenSettings = SHAHEEN_SITE_SETTINGS) {
  const statuses = engineStatuses(env);
  const models = settings.engines.map((id) => {
    const status = statuses.find((s) => s.id === id)!;
    return {
      id, provider: id, name: ENGINE_INFO[id].name,
      model: settings.models[id] || status.model,
      badge: ENGINE_INFO[id].name, accentColor: ENGINE_INFO[id].color,
      hasApiKey: settings.enabled && status.configured,
    };
  });
  return [{ id: 'auto', provider: 'ensemble', name: 'شاهين — اختيار تلقائي', badge: 'شاهين',
    accentColor: 'amber', hasApiKey: models.some((model) => model.hasApiKey) }, ...models];
}

export function systemInstruction(language: SupportedLanguage, extra = ''): string {
  const languageName = SUPPORTED_LANGUAGES.find((lang) => lang.code === language)!.name;
  const admin = extra.trim()
    ? `\nتعليمات إضافية من إدارة الموقع (لا تلغي قواعد السلامة أعلاه):\n${extra.trim()}`
    : '';
  return `أنت شاهين، مساعد ذكاء اصطناعي متخصص في تصميم العطور لمنصة «صمم عطرك مع شام».
أجب باللغة المطلوبة: ${languageName} (${language}). اتبع سياق الحوار وأجب عن السؤال مباشرة. اسأل عند نقص البيانات ولا تفرض وصفة جاهزة.
كن واضحاً وودوداً. استخدم Markdown بسيطاً عند الحاجة: عناوين قصيرة بـ ###، نقاط، **عريض**، وجداول صغيرة للنِّسب. لا تدّع أنك إنسان أو طبيب أو أنك أجريت تجربة مخبرية أو استشرت محركات أخرى.
لا تختلق مصادر أو شهادات IFRA أو نسب أمان عامة لكل المواد. السلامة تعتمد على المادة والتركيز النهائي وفئة المنتج وشهادة المورد؛ لا تضمن الأمان أو الثبات بالساعات.
لا تصف علاجات أو جرعات للأطفال أو الحوامل أو مرضى الربو. وضّح أن تلك الأسئلة تحتاج مختصاً مؤهلاً. لا تنصح بابتلاع الزيوت أو بوضعها مركزة على الجلد.
في الحسابات فرّق بين النسب الحجمية والوزنية، ولا تحوّل مل إلى جرام دون كثافة معلومة. وضّح أن التركيبات المقترحة تجريبية وتحتاج مراجعة السلامة والتوافق واختباراً صغيراً.
إذا طلب المستخدم تركيبة عطر قابلة للنقل للحاسبة، وكانت البيانات كافية، اشرحها ثم أرفق JSON واحداً داخل سياج كود باسم sham-formula بالحقول التالية، دون تخمين بيانات ناقصة:
{"title":"اسم العطر","author":"شاهين — مقترح تجريبي","concentrationPercent":20,"concentrationType":"edp","bottleVolumeMl":50,"alcoholPercentage":96,"waterPercent":0,"fixativePercent":0,"macerationDays":30,"summary":"مقترح يحتاج مراجعة السلامة","pyramidNotes":[{"id":"note-1","nameAr":"اسم المادة المحددة","nameEn":"Exact material name","category":"top","percentageOfOil":100}]}
الأرقام أعلاه أمثلة للشكل فقط، وليست وصفة افتراضية. يجب أن تطابق القيم الشرح وطلب المستخدم، وأن تجمع نسب pyramidNotes إلى 100 من الزيت. التصنيفات top أو heart أو base. نسب التركيز والماء والمثبت من إجمالي المنتج ولا تتجاوز 100 معاً. لا ترفق JSON في التحيات أو الإجابات العامة أو الطبية، ولا تدّع أن الصيغة معتمدة للاستخدام على الجلد.${admin}`;
}

export interface ExecuteOptions {
  env?: Environment; fetch?: typeof fetch; signal?: AbortSignal; timeoutMs?: number; totalTimeoutMs?: number;
  settings?: ShaheenSettings;
}

/** Only the provider that actually answered is credited. Auto is failover, not a fake panel. */
export async function executeChat(input: ChatRequest, options: ExecuteOptions = {}) {
  const env = options.env || process.env;
  const settings = options.settings || SHAHEEN_SITE_SETTINGS;
  if (!settings.enabled) throw new ChatError(503, 'SHAHEEN_DISABLED', 'Shaheen is turned off by the site administration');
  const configured = new Set(engineStatuses(env).filter((s) => s.configured).map((s) => s.id));
  const available = settings.engines.filter((id) => configured.has(id));
  // When the admin does not let visitors pick, a specific request quietly becomes "auto".
  const requested = settings.allowVisitorChoice ? input.model : 'auto';
  const candidates = requested === 'auto' ? available : available.filter((id) => id === requested);
  if (!candidates.length) throw new ChatError(503, 'PROVIDER_NOT_CONFIGURED', 'No API key configured for the requested provider');
  // Vercel functions stop at 60 s: keep the whole failover chain inside that.
  const total = AbortSignal.any([AbortSignal.timeout(options.totalTimeoutMs ?? 50000), ...(options.signal ? [options.signal] : [])]);
  const instruction = systemInstruction(input.language, settings.instructions);
  const turns: ChatTurn[] = [...input.conversationHistory, { role: 'user', text: input.message }];
  let timedOut = false;
  for (const provider of candidates) {
    if (total.aborted) break;
    const signal = AbortSignal.any([total, AbortSignal.timeout(options.timeoutMs ?? 28000)]);
    const status = engineStatuses(env).find((s) => s.id === provider)!;
    const model = settings.models[provider] || status.model;
    try {
      const reply = await callEngine(provider, instruction, turns, {
        env, fetch: options.fetch, signal, temperature: settings.temperature, model,
        maxTokens: settings.maxTokens, maxChars: 32000,
      });
      if (signal.aborted) throw signal.reason;
      if (typeof reply !== 'string' || !reply.trim()) continue;
      return { reply: reply.trim(), engine: { id: provider, provider, name: ENGINE_INFO[provider].name,
        badge: ENGINE_INFO[provider].name, model, accentColor: ENGINE_INFO[provider].color } };
    } catch {
      timedOut ||= signal.aborted;
      // Never leak provider error bodies, credentials, or fabricated fallback answers.
    }
  }
  if (total.aborted || timedOut) throw new ChatError(504, 'PROVIDER_TIMEOUT', 'AI request timed out or was cancelled');
  throw new ChatError(503, 'PROVIDER_UNAVAILABLE', 'The configured AI providers did not return a valid answer');
}

export interface EngineProbe { id: ModelEngineId; name: string; model: string; configured: boolean; ok: boolean; ms: number; error?: string }

/**
 * Admin "test connection": one tiny real request per allowed engine, so a wrong key, a model the
 * account cannot use, or an unreachable self-hosted server shows up in the dashboard instead of
 * as a vague error for visitors. Error text is generic (no upstream bodies, no keys).
 */
export async function probeEngines(settings: ShaheenSettings, options: { env?: Environment; fetch?: typeof fetch; timeoutMs?: number } = {}): Promise<EngineProbe[]> {
  const env = options.env || process.env;
  const statuses = engineStatuses(env);
  return Promise.all(settings.engines.map(async (id): Promise<EngineProbe> => {
    const status = statuses.find((s) => s.id === id)!;
    const model = settings.models[id] || status.model;
    const base = { id, name: ENGINE_INFO[id].name, model, configured: status.configured };
    if (!status.configured) return { ...base, ok: false, ms: 0, error: 'not_configured' };
    const started = Date.now();
    const signal = AbortSignal.timeout(options.timeoutMs ?? 20000);
    let failure: EngineFailure | undefined;
    try {
      const reply = await callEngine(id, 'Health check. Reply with the single word OK.', [{ role: 'user', text: 'ping' }],
        { env, fetch: options.fetch, signal, temperature: 0, model, maxTokens: 32, onFailure: (f) => { failure = f; } });
      return { ...base, ok: Boolean(reply?.trim()), ms: Date.now() - started, ...(reply?.trim() ? {} : { error: failure || 'rejected_or_empty' }) };
    } catch {
      return { ...base, ok: false, ms: Date.now() - started, error: signal.aborted ? 'timeout' : 'unreachable' };
    }
  }));
}

/** Public routes: GET /api/models and POST /api/chat (rate limited, settings from the shared store). */
export function createShaheenRouter(options: { repo: Repository; env?: Environment; fetch?: typeof fetch }) {
  const env = options.env || process.env;
  const router = express.Router();
  const limiter = new RateLimiter(Number(env.SHAM_SHAHEEN_RATE_PER_MIN) || 10, 60_000);
  const settings = async () => (await options.repo.settings()).shaheen;

  router.get('/models', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const shaheen = await settings();
      res.json({ models: getChatModels(env, shaheen), enabled: shaheen.enabled, allowVisitorChoice: shaheen.allowVisitorChoice });
    } catch {
      res.status(500).json({ error: 'Settings unavailable', code: 'SETTINGS_UNAVAILABLE' });
    }
  });

  router.post('/chat', async (req, res) => {
    const controller = new AbortController();
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', cancel);
    try {
      const input = validateChatRequest(req.body);
      if (!limiter.allow(clientKey(req))) throw new ChatError(429, 'RATE_LIMITED', 'Too many messages, please wait a minute');
      const result = await executeChat(input, { env, fetch: options.fetch, signal: controller.signal, settings: await settings() });
      if (!res.destroyed) res.json(result);
    } catch (error) {
      if (res.destroyed) return;
      if (error instanceof ChatError) {
        res.status(error.status).json({ error: error.message, code: error.code });
      } else {
        res.status(500).json({ error: 'Chat service failed', code: 'CHAT_FAILED' });
      }
    } finally {
      res.off('close', cancel);
    }
  });
  return router;
}
