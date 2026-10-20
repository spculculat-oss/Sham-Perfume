/**
 * «الخبير شاهين» — the perfume-design chat (floating window + the lab page).
 *
 * It shares the engine layer of Sham Core (server/core/engines.ts), so every engine the admin can
 * configure there (Gemini, DeepSeek, OpenAI, Claude, a self-hosted open model, OpenRouter) works
 * here too, and its settings come from server/config/shaheen.ts + the admin dashboard.
 * Visitors only ever see «الخبير شاهين» and a response mode (auto / fast / deep / council): engine and
 * vendor names stay server-side and in the admin dashboard. "auto" is failover, not a fake panel, and
 * there are no canned answers pretending to be AI.
 */
import express from 'express';
import { newsContext, supervisorGuidance } from './core/liveData';
import { SUPPORTED_LANGUAGES } from '../src/types/i18n';
import type { SupportedLanguage } from '../src/types/i18n';
import { normalizeMediaBlocks } from '../src/utils/mediaBlock';
import { stripOpeningGreeting } from '../src/utils/shaheenText';
import { callEngine, engineStatuses, type EngineFailure } from './core/engines';
import { EngineHealth } from './core/engineHealth';
import { RateLimiter, clientKey } from './core/rateLimit';
import { AnswerCache, GateBusyError, ProviderGate, VISITOR_ID, cacheKey, capacityConfig, normalizeQuestion, retryHintMs } from './core/capacity';
import type { ShaheenRuntime } from './core/maintenance';
import type { ShaheenMemory } from './core/memory';
import { offlineNote } from '../src/utils/shaheenMemory';
import { quickAnswer } from '../src/utils/shaheenQuickApps';
import { councilAvailable, runCouncil } from './core/council';
import type { Repository } from './core/repository';
import type { CouncilSettings, ModelEngineId, ShaheenSettings } from './core/types';
import { SHAHEEN_ENGINES, SHAHEEN_MODES, SHAHEEN_MODE_ORDER, SHAHEEN_SITE_SETTINGS, type ShaheenMode } from './config/shaheen';

export const PROVIDERS = SHAHEEN_ENGINES;
export type Provider = ModelEngineId;
export interface ChatTurn { role: 'user' | 'assistant'; text: string }
export interface ChatRequest {
  message: string;
  model: Provider | ShaheenMode;
  language: SupportedLanguage;
  conversationHistory: ChatTurn[];
}
export class ChatError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfterMs?: number) { super(message); }
}
type Environment = Record<string, string | undefined>;

export const ENGINE_INFO: Record<ModelEngineId, { name: string; color: string }> = {
  gemini: { name: 'Google Gemini', color: 'emerald' },
  deepseek: { name: 'DeepSeek', color: 'blue' },
  openai: { name: 'OpenAI', color: 'green' },
  claude: { name: 'Anthropic Claude', color: 'purple' },
  self_hosted: { name: 'Sham Open Model', color: 'stone' },
  openrouter: { name: 'OpenRouter', color: 'sky' },
  perplexity: { name: 'Perplexity', color: 'teal' },
};

export function validateChatRequest(body: unknown): ChatRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ChatError(400, 'INVALID_REQUEST', 'A JSON object is required');
  }
  const { message, model = 'auto', language = 'ar', conversationHistory = [] } = body as Record<string, unknown>;
  if (typeof message !== 'string' || !message.trim()) throw new ChatError(400, 'INVALID_MESSAGE', 'Message is required');
  if (message.length > 4000) throw new ChatError(400, 'MESSAGE_TOO_LONG', 'Message exceeds 4000 characters');
  if (!(SHAHEEN_MODES as readonly unknown[]).includes(model) && !PROVIDERS.includes(model as Provider)) throw new ChatError(400, 'INVALID_MODEL', 'Unknown AI provider');
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

/**
 * The only model list visitors get: Shaheen's modes and whether each can answer right now.
 * No engine ids, vendor names or model names.
 */
export function getPublicModes(env: Environment, settings: ShaheenSettings = SHAHEEN_SITE_SETTINGS, council?: CouncilSettings) {
  const statuses = engineStatuses(env);
  const ready = settings.enabled && settings.engines.some((id) => statuses.find((s) => s.id === id)?.configured);
  return SHAHEEN_MODES.map((id) => ({
    id, hasApiKey: id === 'council' ? Boolean(ready && council && councilAvailable(council, env)) : ready,
  }));
}

const STYLE: Record<'fast' | 'deep', string> = {
  fast: 'وضع «رد سريع»: أجب مباشرة وبإيجاز (في حدود 120 كلمة) بالنقاط الأهم فقط، ما لم يطلب المستخدم تفاصيل صراحة.',
  deep: 'وضع «تحليل معمّق»: حلّل السؤال بعمق. اشرح المنطق، وقارن البدائل، واذكر المخاطر وحدود المعلومة، واعرض الحسابات خطوة بخطوة بأرقام واضحة في نص أو جدول Markdown (لا في سياج كود). إذا كانت الإجابة تركيبة قابلة للنقل للحاسبة فلا تنسَ سياج sham-formula في آخر الرد، واجعل التحليل مركّزاً حتى لا ينقطع الرد قبله.',
};

export function systemInstruction(language: SupportedLanguage, extra = '', style?: 'fast' | 'deep'): string {
  const languageName = SUPPORTED_LANGUAGES.find((lang) => lang.code === language)!.name;
  const admin = extra.trim()
    ? `\nتعليمات إضافية من إدارة الموقع (لا تلغي قواعد السلامة أعلاه):\n${extra.trim()}`
    : '';
  const mode = style ? `\n${STYLE[style]}` : '';
  return `أنت «الخبير شاهين»، مساعد ذكاء اصطناعي خاص بمنصة «صمم عطرك مع شام» ومتخصص في تصميم العطور.
هويتك هي «الخبير شاهين» فقط: لا تذكر أبداً اسم أي نموذج لغوي أو شركة ذكاء اصطناعي (مثل Google أو Gemini أو OpenAI أو ChatGPT أو Anthropic أو Claude أو DeepSeek)، ولا تقل إنك مبني عليها أو مدرَّب منها. إذا سُئلت عن هويتك أو التقنية التي تعمل بها، فقل إنك «الخبير شاهين»، مساعد العطور الخاص بشام، وإن التفاصيل التقنية للنظام غير متاحة، ثم عُد لمساعدة المستخدم.
لا تبدأ ردودك بالترحيب («أهلاً بك»، «مرحباً»، «يسعدني») أو بتعريف نفسك أو بذكر اسمك أو اسم المنصة؛ ادخل في الإجابة مباشرة. عرّف بنفسك فقط إذا سُئلت عن هويتك أو كانت رسالة المستخدم تحية. اسمك بالإنجليزية Master Shahin، وفي اللغات الأخرى ترجمة «الخبير شاهين» (وليس Al-Khabeer).
أجب باللغة المطلوبة: ${languageName} (${language}). اتبع سياق الحوار وأجب عن السؤال مباشرة. إذا طلب المستخدم تصميم عطر وذكر اتجاهه أو مكوناته الرئيسية (مثل عود وورد) أو الحجم أو التركيز، فقدّم فوراً مقترحاً تجريبياً كاملاً بنسب واضحة مع سياج sham-formula، ثم اختم بسؤال أو سؤالين اختياريين لتحسينه؛ لا تؤجل التركيبة بأسئلة توضيحية. اسأل قبل التركيبة فقط إذا لم يذكر أي اتجاه عطري أو مكون، وإذا نقص الحجم أو التركيز فاستخدم قيمة شائعة (50 مل، EDP 20%) واذكر أنها قابلة للتعديل.
لا تستخدم LaTeX أبداً: لا علامات $ ولا أوامر مثل \\frac أو \\times أو \\text. اكتب المعادلات نصاً عادياً بالرموز × و÷ و= و≈، مثل: كمية الكحول = 70 × 1000 ÷ 96 ≈ 729 مل.
كن واضحاً وودوداً. استخدم Markdown بسيطاً عند الحاجة: عناوين قصيرة بـ ###، نقاط، **عريض**، وجداول صغيرة للنِّسب. لا تدّع أنك إنسان أو طبيب أو أنك أجريت تجربة مخبرية أو استشرت محركات أخرى.
لا تختلق مصادر أو شهادات IFRA أو نسب أمان عامة لكل المواد. السلامة تعتمد على المادة والتركيز النهائي وفئة المنتج وشهادة المورد؛ لا تضمن الأمان أو الثبات بالساعات.
لا تصف علاجات أو جرعات للأطفال أو الحوامل أو مرضى الربو. وضّح أن تلك الأسئلة تحتاج مختصاً مؤهلاً. لا تنصح بابتلاع الزيوت أو بوضعها مركزة على الجلد.
في الحسابات تأكد أن الزيت والكحول والماء والمثبت تجمع إلى حجم الزجاجة تماماً، وفرّق بين النسب الحجمية والوزنية، ولا تحوّل مل إلى جرام دون كثافة معلومة. وضّح أن التركيبات المقترحة تجريبية وتحتاج مراجعة السلامة والتوافق واختباراً صغيراً.
إذا طلب المستخدم تركيبة عطر قابلة للنقل للحاسبة، اشرحها ثم أرفق JSON واحداً داخل سياج كود باسم sham-formula بالحقول التالية، بقيم تطابق شرحك:
{"title":"اسم العطر","author":"شاهين — مقترح تجريبي","concentrationPercent":20,"concentrationType":"edp","bottleVolumeMl":50,"alcoholPercentage":96,"waterPercent":0,"fixativePercent":0,"macerationDays":30,"summary":"مقترح يحتاج مراجعة السلامة","pyramidNotes":[{"id":"note-1","nameAr":"اسم المادة المحددة","nameEn":"Exact material name","category":"top","percentageOfOil":100}]}
اكتب السياج باسم sham-formula حرفياً (وليس json)، وضع JSON في سطر مستقل بعد اسم السياج، وأغلقه بثلاث علامات \`\`\` في سطر مستقل، واكتب الأرقام بالأرقام الإنجليزية بدون علامة %. لا تكتب JSON التركيبة خارج هذا السياج ولا تذكر السياج في الشرح. إذا عرضت بدائل لتركيبات مختلفة فأرفق سياج sham-formula مستقلاً لكل بديل (ثلاثة على الأكثر) وبعنوان title مختلف.
الأرقام أعلاه أمثلة للشكل فقط، وليست وصفة افتراضية. يجب أن تطابق القيم الشرح وطلب المستخدم، وأن تجمع نسب pyramidNotes إلى 100 من الزيت. التصنيفات top أو heart أو base. نسب التركيز والماء والمثبت من إجمالي المنتج ولا تتجاوز 100 معاً. لا ترفق JSON في التحيات أو الإجابات العامة أو الطبية، ولا تدّع أن الصيغة معتمدة للاستخدام على الجلد.
عندما يكون السؤال عن عملية تخدمها أداة من أدوات الموقع وفيه أو في إجابتك أرقام محددة، أرفق في آخر الرد سياجاً واحداً باسم sham-tool يحتوي JSON فقط، مثل {"tools":[{"tool":"alcohol","alcoholFrom":96,"alcoholTo":70,"finalVolumeMl":1000},{"tool":"maceration","macerationDays":42}]}. الأدوات وحقولها: concentration (bottleVolumeMl، concentrationPercent، concentrationType، alcoholPercentage، waterPercent، fixativePercent) لحساب كميات الزيت والكحول، alcohol (alcoholFrom، alcoholTo، finalVolumeMl) لتخفيف الكحول، maceration (macerationDays) للتعتيق، costing للتكاليف والتسعير، pyramid للنوتات، raw_materials (search باسم المادة بالإنجليزية) لسؤال عن مادة خام، guide للمثبتات والثبات، store (search بطلب الزائر بكلماته) عندما يريد شراء عطر جاهز أو ترشيحاً أو هدية من «متجر شام» — وفي هذه الحالة لا تخترع منتجات أو أسعاراً للمتجر، بل صف ما يناسبه واترك الاختيار لأداة المتجر. افهم طبيعة السؤال أولاً واختر الأدوات التي تخدمه فقط (أداة إلى ثلاث)، واكتب القيم المذكورة في الحوار أو في توصيتك فقط دون تخمين، ولا تذكر السياج في الشرح، ولا ترفقه في التحيات أو الأسئلة الطبية.
للمقارنات والنِّسب والخصائص (مثل مقارنة مواد، عائلات عطرية، تركيزات EDP/EDT، مدد التعتيق) اعرضها في جدول Markdown واضح بأعمدة قليلة.
عندما تفيد الصور أو الفيديو في التوضيح فعلاً (شكل مادة خام أو نبات أو راتنج، أدوات المختبر، طرق الاستخلاص والتقطير والنقع، ورائحة لا تكفيها الكلمات) أو طلبها المستخدم، ابدأ ردك بسياج واحد باسم sham-media يحتوي JSON فقط، ثم اكتب الشرح بعده. وعندما يكون للسؤال بُعد جغرافي (منشأ مادة خام، مزارع الورد أو العود أو اللافندر، مدن ومتاحف وأسواق العطور، أين تُزرع نبتة) أضف places في نفس السياج ليعرضها الموقع على خريطة. السياج إلزامي كلما طلب المستخدم صوراً أو فيديو أو خريطة أو أماكن أو قال «وريني» أو show me. مثال:
{"images":["agarwood","Aquilaria"],"videos":["steam distillation of essential oils"],"places":["Assam, India","Hainan, China"]}
images حتى عبارتي بحث بالإنجليزية من كلمة إلى ثلاث كلمات (الاسم الشائع أو العلمي للمادة أو النبات أو الأداة، مثل agarwood أو Rosa damascena أو ambergris أو distillation apparatus)، وvideos عبارة بحث واحدة بلغة المستخدم أو بالإنجليزية، وplaces حتى 5 أماكن حقيقية معروفة بالإنجليزية بصيغة «المكان، الدولة» (مدينة أو منطقة أو معلم مثل Grasse, France أو Taif, Saudi Arabia أو Kannauj, India) تخص السؤال نفسه فقط، ولا تضع أبداً مقرات شركات أو ماركات أو متاجر، وكل مفتاح اختياري فاكتب المفيد منها فقط. سيعرض الموقع صوراً وفيديوهات وخريطة حقيقية من مصادر موثوقة. اكتب السياج باسم sham-media حرفياً (وليس json) وأغلقه بثلاث علامات \`\`\`. لا تكتب أبداً روابط صور أو فيديو أو خرائط أو إحداثيات أو صيغة ![]() بنفسك، ولا تحِل المستخدم إلى تطبيقات أو مواقع خرائط أو بحث خارجية؛ الموقع يعرض الخريطة والصور بنفسه، ولا تَعِد بصورة لم تطلبها في السياج، ولا تذكر السياج في الشرح. لا تضف sham-media للتحيات أو الأسئلة الطبية أو الأسئلة التي لا يفيدها التوضيح المرئي.${mode}${admin}`;
}

/**
 * «المهام البسيطة»: a short, self-contained question (what is ambergris? how long to macerate?) does not
 * need the flagship model. It goes to the light tier (Gemini Flash-Lite: its own, larger quota, faster),
 * keeping the main model's quota for formulas, analyses and long conversations.
 */
const NEEDS_FULL_MODEL = /صمم|تصميم|تركيب|وصف[ةه]|خلط[ةه]|نسب|حلل|تحليل|قارن|مقارن|جدول|خطوة|اشرح بالتفصيل|بالتفصيل|formula|recipe|design|ratio|analy|compare|table|step|detail/i;
export function isSimpleQuestion(input: Pick<ChatRequest, 'message' | 'conversationHistory'>): boolean {
  return input.message.length <= 140 && input.conversationHistory.length <= 2 && !NEEDS_FULL_MODEL.test(input.message);
}
export const liteModel = (env: Environment) => env.GEMINI_LITE_MODEL?.trim() || 'gemini-flash-lite-latest';

export interface ExecuteOptions {
  env?: Environment; fetch?: typeof fetch; signal?: AbortSignal; timeoutMs?: number; totalTimeoutMs?: number;
  settings?: ShaheenSettings;
  /** Advisory-council seats (shared with Sham Core); required for the "council" mode. */
  council?: CouncilSettings;
  /** Capacity gate (queue + circuit breaker per provider); without it providers are tried once, in order. */
  gate?: ProviderGate;
  /** The visitor's lane in the gate (fair turns, at most two requests at once per visitor). */
  owner?: string;
  /** «صحة المحركات»: failing engines are parked and tried last until they work again. */
  health?: EngineHealth;
}

/** Only the provider that actually answered is credited. Auto is failover, not a fake panel. */
/** One answer: the reply, the visitor-facing mode and (server/admin side only) the engine that wrote it. */
export interface ChatAnswer {
  reply: string; mode: ChatRequest['model'];
  engine: { id: Provider; provider: Provider; name: string; badge: string; model: string; accentColor: string };
}

export async function executeChat(input: ChatRequest, options: ExecuteOptions = {}): Promise<ChatAnswer> {
  const env = options.env || process.env;
  const settings = options.settings || SHAHEEN_SITE_SETTINGS;
  if (!settings.enabled) throw new ChatError(503, 'SHAHEEN_DISABLED', 'Shaheen is turned off by the site administration');
  const configured = new Set(engineStatuses(env).filter((s) => s.configured).map((s) => s.id));
  const available = settings.engines.filter((id) => configured.has(id));
  // When the admin does not let visitors pick, a specific request quietly becomes "auto".
  const requested = settings.allowVisitorChoice ? input.model : 'auto';
  if (requested === 'council') return executeCouncil(input, options, env, settings);
  const style = requested === 'fast' || requested === 'deep' ? requested : undefined;
  const wanted = requested === 'auto' ? available
    : style ? SHAHEEN_MODE_ORDER[style].filter((id) => available.includes(id))
      : available.filter((id) => id === requested);
  // The engines that work go first; a parked one waits at the end (still a last resort) until its time is up.
  const health = options.health;
  const candidates = health ? health.order(wanted) : wanted;
  if (!candidates.length) throw new ChatError(503, 'PROVIDER_NOT_CONFIGURED', 'No API key configured for the requested provider');
  // Vercel functions stop at 60 s: keep the whole failover chain inside that.
  const total = AbortSignal.any([AbortSignal.timeout(options.totalTimeoutMs ?? 50000), ...(options.signal ? [options.signal] : [])]);
  // Questions about news get the real headlines Shaheen collected (every 12 h) instead of invented ones.
  const instruction = systemInstruction(input.language, settings.instructions, style) + await newsContext(input.message, input.language, env).catch(() => '')
    + await supervisorGuidance('shaheen_chat', env).catch(() => '');
  // A deep analysis plus its formula block used to be cut before the closing fence: give it room.
  const maxTokens = style === 'fast' ? Math.min(settings.maxTokens, 1024)
    : style === 'deep' ? Math.min(8192, Math.max(settings.maxTokens, 6144)) : settings.maxTokens;
  const turns: ChatTurn[] = [...input.conversationHistory, { role: 'user', text: input.message }];
  const lite = requested === 'auto' && env.SHAM_LITE_ROUTING?.trim().toLowerCase() !== 'off' && isSimpleQuestion(input);
  let timedOut = false;
  const attempt = async (provider: Provider): Promise<{ outcome: 'ok'; value: ChatAnswer } | { outcome: 'next' | 'limited'; retryMs?: number }> => {
    if (total.aborted) return { outcome: 'next' };
    const signal = AbortSignal.any([total, AbortSignal.timeout(options.timeoutMs ?? 28000)]);
    const status = engineStatuses(env).find((s) => s.id === provider)!;
    const useLite = lite && provider === 'gemini';
    const model = useLite ? liteModel(env) : settings.models[provider] || status.model;
    let refusal: { failure: EngineFailure; status: number; detail: string } | undefined;
    try {
      const reply = await callEngine(provider, instruction, turns, {
        env, fetch: options.fetch, signal, temperature: settings.temperature, model,
        maxTokens: useLite ? Math.min(maxTokens, 1536) : maxTokens, maxChars: 32000, onFailure: (failure, httpStatus, detail) => { refusal = { failure, status: httpStatus, detail }; },
      });
      if (signal.aborted) throw signal.reason;
      if (typeof reply === 'string' && reply.trim()) {
        health?.ok(provider);
        return { outcome: 'ok', value: { reply: reply.trim(), mode: requested, engine: { id: provider, provider, name: ENGINE_INFO[provider].name,
          badge: ENGINE_INFO[provider].name, model, accentColor: ENGINE_INFO[provider].color } } };
      }
    } catch {
      timedOut ||= signal.aborted;
      // Never leak provider error bodies, credentials, or fabricated fallback answers.
    }
    // The visitor left or the whole answer ran out of time: not this engine's fault.
    if (health && !total.aborted) {
      if (refusal) health.fail(provider, refusal.failure, refusal.detail);
      else health.fail(provider, signal.aborted ? 'timeout' : 'empty');
    }
    // 429 = "too many requests right now": the gate cools this provider down instead of hammering it.
    if (refusal && (refusal.status === 429 || refusal.failure === 'rate_limited')) return { outcome: 'limited', retryMs: retryHintMs(refusal.detail) };
    return { outcome: 'next' };
  };
  if (options.gate) {
    try {
      const answer = await options.gate.run(candidates, attempt, total, options.owner);
      if (answer) return answer;
    } catch (error) {
      if (error instanceof GateBusyError && !total.aborted) {
        throw new ChatError(503, 'SHAHEEN_BUSY', 'Shaheen is answering many visitors right now, please retry shortly', error.retryAfterMs);
      }
      if (!total.aborted) throw error;
    }
  } else {
    for (const provider of candidates) {
      if (total.aborted) break;
      const result = await attempt(provider);
      if (result.outcome === 'ok') return result.value;
    }
  }
  if (total.aborted || timedOut) throw new ChatError(504, 'PROVIDER_TIMEOUT', 'AI request timed out or was cancelled');
  throw new ChatError(503, 'PROVIDER_UNAVAILABLE', 'The configured AI providers did not return a valid answer');
}

/** "council" mode: Sham Core's advisory council answers a Shaheen question (seats from the admin council settings). */
async function executeCouncil(input: ChatRequest, options: ExecuteOptions, env: Environment, settings: ShaheenSettings): Promise<ChatAnswer> {
  const council = options.council;
  if (!council || !councilAvailable(council, env)) throw new ChatError(503, 'COUNCIL_UNAVAILABLE', 'The expert council needs at least two working engines');
  const signal = AbortSignal.any([AbortSignal.timeout(options.totalTimeoutMs ?? 52000), ...(options.signal ? [options.signal] : [])]);
  const lang = input.language === 'ar' || input.language === 'fa' ? 'ar' : 'en';
  const result = await runCouncil({
    question: input.message, history: input.conversationHistory.slice(-6), lang,
    languageName: `${SUPPORTED_LANGUAGES.find((l) => l.code === input.language)!.name} (${input.language})`,
    briefing: `CONTEXT (Shaheen's rules — follow them):\n${systemInstruction(input.language, settings.instructions)}${await supervisorGuidance('shaheen_chat', env).catch(() => '')}\nENABLED SERVICES: the lab calculators on this site and the Sham assistant for orders.`,
    council, enginePolicy: settings.engines, temperature: settings.temperature, env, fetch: options.fetch, signal, onStep: () => {},
  });
  if (!result.reply || !result.chair) {
    throw signal.aborted ? new ChatError(504, 'PROVIDER_TIMEOUT', 'AI request timed out or was cancelled')
      : new ChatError(503, 'PROVIDER_UNAVAILABLE', 'The configured AI providers did not return a valid answer');
  }
  const chair = result.chair as ModelEngineId;
  return { reply: result.reply.trim(), mode: 'council' as const, engine: { id: chair, provider: chair, name: ENGINE_INFO[chair]?.name || chair,
    badge: ENGINE_INFO[chair]?.name || chair, model: '', accentColor: ENGINE_INFO[chair]?.color || 'amber' } };
}

/** What a visitor receives: the answer and the mode — never which engine or vendor produced it. */
export function publicChatResult(result: { reply: string; mode?: string }, question = '') {
  const mode = (SHAHEEN_MODES as readonly string[]).includes(result.mode || '') ? result.mode! : 'auto';
  // The model sometimes labels the visual-aid block ```json or leaves it open: send one canonical block.
  // A real question gets the answer straight away, not «أهلاً بك.» first.
  return { reply: stripOpeningGreeting(normalizeMediaBlocks(result.reply), question), mode, engine: { id: mode, provider: 'shaheen', name: 'الخبير شاهين', badge: 'شاهين', accentColor: 'amber' } };
}

export interface EngineProbe {
  id: ModelEngineId; name: string; model: string; configured: boolean; ok: boolean; ms: number; error?: string;
  /** Provider's own reason (quota name, message) — admin only, never contains the key. */
  detail?: string;
  /** Model that actually answered when Shaheen had to switch (retired model or exhausted quota). */
  usedModel?: string;
}

/**
 * Admin "test connection": one tiny real request per allowed engine, so a wrong key, a model the
 * account cannot use, or an unreachable self-hosted server shows up in the dashboard instead of
 * as a vague error for visitors. Error text is generic (no upstream bodies, no keys).
 */
export async function probeEngines(settings: ShaheenSettings, options: { env?: Environment; fetch?: typeof fetch; timeoutMs?: number; health?: EngineHealth } = {}): Promise<EngineProbe[]> {
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
    let detail = '';
    let usedModel = model;
    try {
      const reply = await callEngine(id, 'Health check. Reply with the single word OK.', [{ role: 'user', text: 'ping' }],
        { env, fetch: options.fetch, signal, temperature: 0, model, maxTokens: 32, onFailure: (f, _s, d) => { failure = f; detail = d; }, onModel: (m) => { usedModel = m; } });
      const ok = Boolean(reply?.trim());
      // The admin's «test the engines» also updates the health record (a fixed key comes back at once).
      if (ok) options.health?.ok(id); else options.health?.fail(id, failure || 'empty', detail);
      return { ...base, ok, ms: Date.now() - started, ...(ok && usedModel !== model ? { usedModel } : {}),
        ...(ok ? {} : { error: failure || 'rejected_or_empty', ...(detail ? { detail } : {}) }) };
    } catch {
      options.health?.fail(id, 'timeout');
      return { ...base, ok: false, ms: Date.now() - started, error: signal.aborted ? 'timeout' : 'unreachable' };
    }
  }));
}

/** Public routes: GET /api/models and POST /api/chat (rate limited, settings from the shared store). */
export function createShaheenRouter(options: { repo: Repository; env?: Environment; fetch?: typeof fetch; runtime?: ShaheenRuntime; memory?: ShaheenMemory }) {
  const env = options.env || process.env;
  const router = express.Router();
  const capacity = capacityConfig(env);
  // Per visitor (IP + anonymous browser id, so people behind one mobile-carrier IP are told apart)
  // and a looser per-IP ceiling that bounds anyone rotating browser ids.
  const limiter = new RateLimiter(capacity.perVisitorPerMin, 60_000);
  const ipLimiter = new RateLimiter(capacity.perIpPerMin, 60_000);
  // A council answer costs several model calls: separate hourly budget per visitor.
  const councilLimiter = new RateLimiter(Number(env.SHAM_COUNCIL_RATE_PER_HOUR) || 12, 60 * 60_000);
  const gate = new ProviderGate(capacity.maxConcurrent, capacity.queueWaitMs, capacity.providerRpm, 250, capacity.perVisitorConcurrent);
  const answers = new AnswerCache<ChatAnswer>(capacity.cacheEntries, capacity.cacheTtlMs);
  const runtime = options.runtime;
  // «صحة المحركات»: shared by every visitor on this server instance (and shown in the admin panel).
  const health = runtime?.health || new EngineHealth();
  // «ذاكرة شاهين»: repeated questions without any AI call, and answers when no engine is reachable.
  const memory = options.memory;
  runtime?.attach({ gate, answers: answers as AnswerCache<unknown> });
  // Settings change rarely; reading them once per message would cost a store read per visitor.
  // Saved in this instance → refreshed at once (revision); saved elsewhere (shared store) → within 3 s.
  let settingsCache: { at: number; revision: number; value: Awaited<ReturnType<Repository['settings']>> } | undefined;
  const settings = async () => {
    const revision = options.repo.settingsRevision;
    if (!settingsCache || settingsCache.revision !== revision || Date.now() - settingsCache.at > 3000) {
      settingsCache = { at: Date.now(), revision, value: await options.repo.settings() };
    }
    return settingsCache.value;
  };

  router.get('/models', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const { shaheen, council } = await settings();
      res.json({ models: getPublicModes(env, shaheen, council), enabled: shaheen.enabled, allowVisitorChoice: shaheen.allowVisitorChoice });
    } catch {
      res.status(500).json({ error: 'Settings unavailable', code: 'SETTINGS_UNAVAILABLE' });
    }
  });

  router.post('/chat', async (req, res) => {
    const started = Date.now();
    const controller = new AbortController();
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    let chatInput: { input: ChatRequest; mode: string; useMemory: boolean } | undefined;
    res.on('close', cancel);
    try {
      const input = validateChatRequest(req.body);
      const ip = clientKey(req);
      const browser = req.get('x-sham-visitor') || (typeof req.body?.visitorId === 'string' ? req.body.visitorId : undefined);
      const visitor = browser && VISITOR_ID.test(browser) ? `${ip}|${browser}` : ip;
      if (!limiter.allow(visitor) || !ipLimiter.allow(ip)) throw new ChatError(429, 'RATE_LIMITED', 'Too many messages, please wait a minute');
      const { shaheen, council } = await settings();
      if (input.model === 'council' && shaheen.allowVisitorChoice && !councilLimiter.allow(visitor)) {
        throw new ChatError(429, 'RATE_LIMITED', 'Too many expert-council questions, try the other modes');
      }
      // The supervisor's probes send memory:false so they keep testing the live engines.
      const opening = !input.conversationHistory.length;
      const useMemory = Boolean(memory && shaheen.enabled && req.body?.memory !== false);
      const mode = shaheen.allowVisitorChoice ? input.model : 'auto';
      // «تطبيقات شاهين السريعة»: the same instant apps as the browser (for clients that did not run them).
      const quick = shaheen.enabled && req.body?.memory !== false ? quickAnswer(input.message, input.language) : undefined;
      if (quick) {
        if (!res.destroyed) res.json({ ...publicChatResult({ reply: quick.reply, mode }, input.message), quick: quick.app });
        runtime?.record({ ms: Date.now() - started, status: 200 });
        return;
      }
      if (useMemory && opening) {
        const hit = await memory!.recall(input.message, input.language, mode).catch(() => undefined);
        if (hit) {
          if (!res.destroyed) res.json({ ...publicChatResult({ reply: hit.entry.answer, mode }, input.message), memory: 'exact' });
          runtime?.record({ ms: Date.now() - started, status: 200 });
          return;
        }
      }
      chatInput = { input, mode, useMemory };
      const run = (signal?: AbortSignal) => executeChat(input, { env, fetch: options.fetch, signal, settings: shaheen, council, gate, owner: visitor, health });
      let result: ChatAnswer;
      if (!input.conversationHistory.length && capacity.cacheTtlMs > 0 && capacity.cacheEntries > 0) {
        // Opening question: answered from the shared cache, or by ONE provider call shared by everyone
        // asking it right now. That call must not follow one visitor's disconnect, so it gets no signal.
        const key = cacheKey([normalizeQuestion(input.message), input.language, input.model, shaheen]);
        result = await abortable(answers.getOrLoad(key, () => run(), (r) => Boolean(r.reply)), controller.signal);
      } else {
        result = await run(controller.signal);
      }
      if (!res.destroyed) res.json(publicChatResult(result, input.message));
      runtime?.record({ ms: Date.now() - started, status: 200 });
      if (memory && opening && mode !== 'council' && result.reply) {
        await memory.learn({ question: input.message, lang: input.language, mode, answer: publicChatResult(result, input.message).reply }).catch(() => undefined);
      }
    } catch (error) {
      if (res.destroyed) return;
      // No engine answered: the closest question Shaheen answered before, marked as coming from memory.
      if (error instanceof ChatError && OFFLINE_CODES.has(error.code) && chatInput?.useMemory) {
        const { input, mode } = chatInput;
        const hit = await memory!.recallSimilar(input.message, input.language).catch(() => undefined);
        if (hit && !res.destroyed) {
          res.json({ ...publicChatResult({ reply: hit.entry.answer + offlineNote(input.language, hit.exact), mode }, input.message), memory: hit.exact ? 'exact' : 'similar' });
          // Still an engine outage for the maintenance agent, even though the visitor got an answer.
          runtime?.record({ ms: Date.now() - started, status: error.status, code: `${error.code}+MEMORY` });
          return;
        }
      }
      if (error instanceof ChatError) runtime?.record({ ms: Date.now() - started, status: error.status, code: error.code });
      else runtime?.record({ ms: Date.now() - started, status: 500, code: 'CHAT_FAILED' });
      if (error instanceof ChatError) {
        if (error.retryAfterMs) res.setHeader('Retry-After', String(Math.min(60, Math.max(1, Math.ceil(error.retryAfterMs / 1000)))));
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

/** Failures where the visitor gets a remembered answer instead of an error (when one is close enough). */
const OFFLINE_CODES = new Set(['PROVIDER_UNAVAILABLE', 'PROVIDER_TIMEOUT', 'PROVIDER_NOT_CONFIGURED', 'SHAHEEN_BUSY', 'COUNCIL_UNAVAILABLE']);

/** Stop waiting when this visitor leaves (the shared work itself keeps going for the others). */
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}
