import { createResearchSpider } from '../src/utils/researchSpider';
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
import { liveStoreCatalog, newsContext, supervisorGuidance, trainedKnowledge } from './core/liveData';
import { SUPPORTED_LANGUAGES } from '../src/types/i18n';
import { localizeReply, needsTranslation, translationInstruction, TranslationCache, type TranslateFn } from './core/replyLanguage';
import type { SupportedLanguage } from '../src/types/i18n';
import { normalizeMediaBlocks } from '../src/utils/mediaBlock';
import { stripOpeningGreeting } from '../src/utils/shaheenText';
import { callEngine, engineStatuses, type EngineFailure, type ExternalSearchSource } from './core/engines';
import { EngineHealth, seedQuotaPauses } from './core/engineHealth';
import { RateLimiter, clientKey } from './core/rateLimit';
import { AnswerCache, GateBusyError, ProviderGate, VISITOR_ID, cacheKey, capacityConfig, normalizeQuestion, retryHintMs } from './core/capacity';
import type { ShaheenRuntime } from './core/maintenance';
import type { ShaheenMemory } from './core/memory';
import { isPersonal, isTimeBound, offlineNote } from '../src/utils/shaheenMemory';
import { libraryAnswer, unknownAnswer, type LibrarySources } from '../src/utils/shaheenLibrary';
import { designFor } from '../src/utils/shaheenDesigner';
import { cosmeticFor } from '../src/utils/cosmeticFormulator';
import { designStoreNote, productLink, storeAnswer, wantsStore, withContext, type Context } from '../src/utils/shaheenBrain';
import { saleMove, salesAnswer } from '../src/utils/shaheenSeller';
import { buyerHint, polishSale, readBuyer, salesPromptBlock } from '../src/utils/salesCraft';
import { polishRelations, readSituation, relationsAnswer, relationsPromptBlock, socialHint } from '../src/utils/shaheenRelations';
import { productAnswer } from '../src/utils/shaheenPitch';
import { agentLinkOn, type LinkSource } from '../src/utils/agentLink';
import { readStateOrders } from '../src/utils/platformState';
import { readControls } from '../src/utils/ownerAuthority';
import { mergeCatalog, type RawProduct, type StoreProduct } from '../src/utils/storeCatalog';
import productsData from '../src/data/products.json';
import bundledStateOrders from '../src/data/owner/state-orders.json';
import bundledControls from '../src/data/owner/controls.json';
import bundledQuota from '../src/data/live/ai-quota.json';
import { platformsMode, platformsOff } from './core/selfReliance';
import { buildLexicon, keyboardFix, understandQuestion, understoodNote, type Understanding } from '../src/utils/shaheenSpelling';
import { RESEARCH_USER_AGENT, research, researchAnswer, researchQueries, type Research } from '../src/utils/webResearch';
import { appendRequestedSources, asksForSources, hideUnrequestedSources, isSourcesFollowUp, requestedSourcesReply, safeChatSources, type ChatSource } from '../src/utils/chatSources';
import { questionIntents } from '../src/utils/shaheenTools';
import { agentLexicon, expertGapReason, referralAnswer, runAgent, scienceDesk, understand, type AgentResult } from '../src/utils/shaheenAgent';
import { RAW_MATERIALS_DATABASE } from '../src/data/rawMaterials';
import { quickAnswer } from '../src/utils/shaheenQuickApps';
import { hasSensitiveNumber, maskSensitive, offersCardDetails } from '../src/utils/ownerAuthority';
import { councilAvailable, runCouncil } from './core/council';
import { sendInVisitorMoney } from './core/replyMoney';
import type { Repository } from './core/repository';
import type { CouncilSettings, ModelEngineId, ShaheenSettings } from './core/types';
import { SHAHEEN_ENGINES, SHAHEEN_MODES, SHAHEEN_MODE_ORDER, SHAHEEN_SITE_SETTINGS, type ShaheenMode } from './config/shaheen';

export const PROVIDERS = SHAHEEN_ENGINES;
export type Provider = ModelEngineId;
export interface ChatTurn { role: 'user' | 'assistant'; text: string; sources?: ChatSource[] }
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
  let size = 0; let sourceCount = 0;
  const history = conversationHistory.map((turn): ChatTurn => {
    if (!turn || (turn.role !== 'user' && turn.role !== 'assistant') || typeof turn.text !== 'string' ||
      !turn.text.trim() || turn.text.length > 4000) {
      throw new ChatError(400, 'INVALID_HISTORY', 'Invalid history turn');
    }
    size += turn.text.length;
    let sources: ChatSource[] | undefined;
    if (turn.sources !== undefined) {
      const clean = safeChatSources(turn.sources);
      if (turn.role !== 'assistant' || !clean?.length || (sourceCount += clean.length) > 5) {
        throw new ChatError(400, 'INVALID_HISTORY', 'Invalid source metadata');
      }
      sources = clean;
    }
    // «صاحب الموقع» O-03: a card/ID number said earlier in the chat never reaches an engine.
    return { role: turn.role, text: maskSensitive(turn.text.trim()), ...(sources ? { sources } : {}) };
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
 * «تلقائي»: can an outside platform answer right now? One configured for Shaheen and not parked after failing
 * («صحة المحركات»). When none can, he answers on his own at once instead of waiting on engines known to be down.
 */
export function platformsReady(settings: ShaheenSettings, env: Environment, health?: EngineHealth): boolean {
  const configured = new Set(engineStatuses(env).filter((s) => s.configured && s.kind !== 'own').map((s) => s.id));
  return settings.engines.some((id) => configured.has(id) && !(health?.parkedUntil(id)));
}

/**
 * The only model list visitors get: Shaheen's modes and whether each can answer right now.
 * No engine ids, vendor names or model names.
 */
export function getPublicModes(env: Environment, settings: ShaheenSettings = SHAHEEN_SITE_SETTINGS, council?: CouncilSettings) {
  const statuses = engineStatuses(env);
  // «شاهين معتمد على نفسه» and «تلقائي»: his own brain answers in every mode (alone, or when the platforms stop),
  // but the council, which needs several models.
  const off = platformsOff(env);
  const ready = settings.enabled && (platformsMode(env) !== 'on' || settings.engines.some((id) => statuses.find((s) => s.id === id)?.configured));
  return SHAHEEN_MODES.map((id) => ({
    id, hasApiKey: id === 'council' ? Boolean(!off && ready && council && councilAvailable(council, env)) : ready,
  }));
}

const STYLE: Record<'fast' | 'deep', string> = {
  fast: 'وضع «رد سريع»: أجب مباشرة وبإيجاز (في حدود 120 كلمة) بالنقاط الأهم فقط، ما لم يطلب المستخدم تفاصيل صراحة.',
  deep: 'وضع «تحليل معمّق»: حلّل السؤال بعمق. اشرح المنطق، وقارن البدائل، واذكر المخاطر وحدود المعلومة، واعرض الحسابات خطوة بخطوة بأرقام واضحة في نص أو جدول Markdown (لا في سياج كود). إذا كانت الإجابة تركيبة قابلة للنقل للحاسبة فلا تنسَ سياج sham-formula في آخر الرد، واجعل التحليل مركّزاً حتى لا ينقطع الرد قبله.',
};

/** A buying conversation: a shopping wish, a sale move («هاخده»، «غالي»), or a reply about a store product just before. */
export function isShoppingTurn(message: string, history: ChatTurn[] = []): boolean {
  const last = [...history].reverse().find((t) => t.role === 'assistant')?.text || '';
  return questionIntents(message).includes('store') || Boolean(saleMove(message)) || /\/p\/[a-z0-9-]+\.html/.test(last);
}

/** For a genuine knowledge lookup, use the configured live-search engine first, then retain normal failover. */
export function researchEngineOrder(engines: readonly Provider[], shouldSearch: boolean): Provider[] {
  if (!shouldSearch) return [...engines];
  const search = engines.find((id) => id === 'perplexity');
  return search ? [search, ...engines.filter((id) => id !== search)] : [...engines];
}

/** «اقرأ الزبون»: how this visitor should be spoken to, from his own words in this conversation. */
export function shoppingBrief(message: string, history: ChatTurn[], language: SupportedLanguage): string {
  const said = [...history.filter((t) => t.role === 'user').map((t) => t.text), message];
  const lang = language === 'ar' || language === 'fa' || /[\u0600-\u06FF]/.test(message) ? 'ar' : 'en';
  return lang === 'ar' ? `قراءة الزائر من كلامه: ${buyerHint(readBuyer(said), 'ar')}` : `Reading of the visitor from his words: ${buyerHint(readBuyer(said), 'en')}`;
}

/** «شاهين ابن الناس»: how this visitor should be dealt with (anger, formality, age, region), when there is something to say. */
export function socialBrief(message: string, history: ChatTurn[], language: SupportedLanguage): string {
  const said = history.filter((t) => t.role === 'user').map((t) => t.text);
  const lang = language === 'ar' || language === 'fa' || /[\u0600-\u06FF]/.test(message) ? 'ar' : 'en';
  const hint = socialHint(readSituation(message, said), lang);
  return hint ? (lang === 'ar' ? `التعامل مع الزائر: ${hint}` : `Dealing with the visitor: ${hint}`) : '';
}

/** A complaint or an angry turn: the platform's reply is cleaned of what ruins a relationship (blame, denial, lectures …). */
export function isComplaintTurn(message: string): boolean {
  const r = readSituation(message);
  return r.anger >= 2 || ['late', 'damaged', 'wrong_item', 'scent_doubt', 'refund', 'angry'].includes(r.situation || '');
}

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
كن واضحاً وودوداً، واتعامل كخبير طبيعي في حوار متصل: افهم المقصود من الكلام والسياق، رد بالمصري البسيط لما تكون العربية هي اللغة، وادخل في الإجابة من غير مقدمات آلية أو تكرار السؤال. اسأل سؤال توضيح واحداً بس لما يلزم. حلل داخلياً، ولا تعرض سلسلة تفكيرك.
قبل الرد افحص صلة الإجابة بالسؤال ومدى دعمها بمراجع شاهين الموثقة أو بمصادر البحث المتاحة؛ قارن المعلومات، واستبعد الخارج عن الموضوع أو المتعارض أو غير المدعوم. لو الدليل مش كفاية، قول إنك مش متأكد بدل ما تعرضه كحقيقة مدققة.
ما تعرضش أسماء المصادر أو روابطها تلقائياً؛ أظهرها فقط لما المستخدم يطلبها صراحة، ولا تخترع مرجعاً أو رابطاً. عند طلب المصادر، اعرض الروابط التي وصلت فعلاً فقط ووضّح إن الرابط لا يعني اعتماداً من متخصص.
كن واضحاً وودوداً. استخدم Markdown بسيطاً عند الحاجة: عناوين قصيرة بـ ###، نقاط، **عريض**، وجداول صغيرة للنِّسب. لا تدّع أنك إنسان أو طبيب أو أنك أجريت تجربة مخبرية أو استشرت محركات أخرى.
لا تختلق مصادر أو شهادات IFRA أو نسب أمان عامة لكل المواد. السلامة تعتمد على المادة والتركيز النهائي وفئة المنتج وشهادة المورد؛ لا تضمن الأمان أو الثبات بالساعات.
لا تصف علاجات أو جرعات للأطفال أو الحوامل أو مرضى الربو. وضّح أن تلك الأسئلة تحتاج مختصاً مؤهلاً. لا تنصح بابتلاع الزيوت أو بوضعها مركزة على الجلد.
في الحسابات تأكد أن الزيت والكحول والماء والمثبت تجمع إلى حجم الزجاجة تماماً، وفرّق بين النسب الحجمية والوزنية، ولا تحوّل مل إلى جرام دون كثافة معلومة. وضّح أن التركيبات المقترحة تجريبية وتحتاج مراجعة السلامة والتوافق واختباراً صغيراً.
إذا طلب المستخدم تركيبة عطر قابلة للنقل للحاسبة، اشرحها ثم أرفق JSON واحداً داخل سياج كود باسم sham-formula بالحقول التالية، بقيم تطابق شرحك:
{"title":"اسم العطر","author":"شاهين — مقترح تجريبي","concentrationPercent":20,"concentrationType":"edp","bottleVolumeMl":50,"alcoholPercentage":96,"waterPercent":0,"fixativePercent":0,"macerationDays":30,"summary":"مقترح يحتاج مراجعة السلامة","pyramidNotes":[{"id":"note-1","nameAr":"اسم المادة المحددة","nameEn":"Exact material name","category":"top","percentageOfOil":100}]}
اكتب السياج باسم sham-formula حرفياً (وليس json)، وضع JSON في سطر مستقل بعد اسم السياج، وأغلقه بثلاث علامات \`\`\` في سطر مستقل، واكتب الأرقام بالأرقام الإنجليزية بدون علامة %. لا تكتب JSON التركيبة خارج هذا السياج ولا تذكر السياج في الشرح. إذا عرضت بدائل لتركيبات مختلفة فأرفق سياج sham-formula مستقلاً لكل بديل (ثلاثة على الأكثر) وبعنوان title مختلف.
الأرقام أعلاه أمثلة للشكل فقط، وليست وصفة افتراضية. يجب أن تطابق القيم الشرح وطلب المستخدم، وأن تجمع نسب pyramidNotes إلى 100 من الزيت. التصنيفات top أو heart أو base. نسب التركيز والماء والمثبت من إجمالي المنتج ولا تتجاوز 100 معاً. لا ترفق JSON في التحيات أو الإجابات العامة أو الطبية، ولا تدّع أن الصيغة معتمدة للاستخدام على الجلد.
عندما يكون السؤال عن عملية تخدمها أداة من أدوات الموقع وفيه أو في إجابتك أرقام محددة، أرفق في آخر الرد سياجاً واحداً باسم sham-tool يحتوي JSON فقط، مثل {"tools":[{"tool":"alcohol","alcoholFrom":96,"alcoholTo":70,"finalVolumeMl":1000},{"tool":"maceration","macerationDays":42}]}. الأدوات وحقولها: concentration (bottleVolumeMl، concentrationPercent، concentrationType، alcoholPercentage، waterPercent، fixativePercent) لحساب كميات الزيت والكحول، alcohol (alcoholFrom، alcoholTo، finalVolumeMl) لتخفيف الكحول، maceration (macerationDays) للتعتيق، costing للتكاليف والتسعير، pyramid للنوتات، raw_materials (search باسم المادة بالإنجليزية) لسؤال عن مادة خام، guide للمثبتات والثبات، store (search بطلب الزائر بكلماته) عندما يريد شراء عطر جاهز أو ترشيحاً أو هدية من «متجر شام» — وفي هذه الحالة لا تخترع منتجات أو أسعاراً للمتجر، بل صف ما يناسبه واترك الاختيار لأداة المتجر. افهم طبيعة السؤال أولاً واختر الأدوات التي تخدمه فقط (أداة إلى ثلاث)، واكتب القيم المذكورة في الحوار أو في توصيتك فقط دون تخمين، ولا تذكر السياج في الشرح، ولا ترفقه في التحيات أو الأسئلة الطبية.
أسلوب «التاجر الأمين» عندما يريد الزائر الشراء: افهم احتياجه بسؤال أو سؤالين فقط (لمين، لإمتى، الطابع، الميزانية)، ثم ركّز على اختيار واحد أساسي وبديل واحد على الأكثر حتى لا تشتّته، وابدأ بالفائدة التي تهمه (يناسب إيه، ثباته، قيمته مقابل السعر) لا بالمواصفات، واختم بخطوة واحدة واضحة (افتح صفحة المنتج واضغط «شراء مباشر»). إذا قال «غالي» فلا تجادله: اعرض الأوفر بصدق (حجم أصغر من نفس العطر أو عطر قريب بسعر أقل). إذا تردد فاعرض الحقائق وسياسة الإرجاع الفعلية للمنتج المختوم واسأله سؤالاً واحداً يحسم. وبعد أن يقرر الشراء اقترح ما يكمّله (حجم سفر، عطر للموسم الآخر، مسك للطبقات) كاقتراح اختياري. ممنوع تماماً: الخصومات المختلقة، والندرة الكاذبة («فاضل قطعتين»)، والعد التنازلي، و«الناس كلها بتشتريه» بدون تقييمات حقيقية، والضغط على الزائر.
${salesPromptBlock('ar')}
${relationsPromptBlock('ar')}
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
/** «تلقائي»: how long one platform, and the whole chain, may take before his own brain answers. */
export const AUTO_ENGINE_MS = 32_000;
export const AUTO_TOTAL_MS = 44_000;

/** «مترجم ردود شاهين»: the most a translation may take, and the whole answer's limit (Vercel stops at 60 s). */
const TRANSLATE_MS = 15_000;
/** How close a saved question must be to answer a new wording of it while the platforms work (1 = the same words). */
export const NEAR_SAME = 0.9;
const CHAT_BUDGET_MS = 55_000;
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
  /** «تلقائي»: Shaheen answers himself when the platforms refuse, so a «too many requests» is not waited out. */
  selfBacked?: boolean;
}

/** Only the provider that actually answered is credited. Auto is failover, not a fake panel. */
/** One answer: the reply, the visitor-facing mode and (server/admin side only) the engine that wrote it. */
export interface ChatAnswer {
  reply: string; mode: ChatRequest['model']; sources?: ChatSource[];
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
  const shopping = isShoppingTurn(input.message, input.conversationHistory);
  const shouldSearch = (requested === 'auto' || requested === 'fast' || requested === 'deep')
    && !shopping && Boolean(researchQueries(input.message, input.language));
  let wanted = requested === 'auto' ? available
    : style ? SHAHEEN_MODE_ORDER[style].filter((id) => available.includes(id))
      : available.filter((id) => id === requested);
  // A suitable knowledge question gets the live-search engine first; every configured model (including self-hosted)
  // remains in the chain as failover. Explicit provider choices are never reordered.
  if (shouldSearch) wanted = researchEngineOrder(wanted, true);
  // The engines that work go first; a parked one waits at the end (still a last resort) until its time is up.
  const health = options.health;
  const candidates = health ? health.order(wanted) : wanted;
  if (!candidates.length) throw new ChatError(503, 'PROVIDER_NOT_CONFIGURED', 'No API key configured for the requested provider');
  // Vercel functions stop at 60 s: keep the whole failover chain inside that.
  const total = AbortSignal.any([AbortSignal.timeout(options.totalTimeoutMs ?? 50000), ...(options.signal ? [options.signal] : [])]);
  // Questions about news get the real headlines Shaheen collected (every 12 h) instead of invented ones.
  // «علم البيع»: a buying conversation tells the engine how this visitor should be spoken to (his style, motive…).
  const instruction = systemInstruction(input.language, settings.instructions, style) + await newsContext(input.message, input.language, env).catch(() => '')
    + await supervisorGuidance('shaheen_chat', env).catch(() => '') + (shopping ? `\n${shoppingBrief(input.message, input.conversationHistory, input.language)}` : '');
  // «شاهين ابن الناس»: an upset, formal, older or foreign visitor is spoken to accordingly; a complaint is cleaned.
  const social = socialBrief(input.message, input.conversationHistory, input.language);
  const complaint = isComplaintTurn(input.message);
  const fullInstruction = social ? `${instruction}\n${social}` : instruction;
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
    let sources: ExternalSearchSource[] = [];
    try {
      const reply = await callEngine(provider, fullInstruction, turns, {
        env, fetch: options.fetch, signal, temperature: settings.temperature, model,
        maxTokens: useLite ? Math.min(maxTokens, 1536) : maxTokens, maxChars: 32000,
        onSources: (found) => { sources = found; },
        onFailure: (failure, httpStatus, detail) => { refusal = { failure, status: httpStatus, detail }; },
      });
      if (signal.aborted) throw signal.reason;
      if (typeof reply === 'string' && reply.trim()) {
        if (provider === 'perplexity' && (shouldSearch || asksForSources(input.message)) && !sources.length) {
          health?.fail(provider, 'empty');
          return { outcome: 'next' }; // No source links: don't present a live-search answer as checked.
        }
        health?.ok(provider);
        const polished = complaint ? polishRelations(reply.trim()) : shopping ? polishSale(reply.trim()) : reply.trim();
        const citationCleaned = hideUnrequestedSources(polished);
        const answer = asksForSources(input.message) ? appendRequestedSources(citationCleaned, sources, input.language)
          : provider === 'perplexity' ? citationCleaned : polished;
        return { outcome: 'ok', value: { reply: answer, mode: requested, ...(sources.length ? { sources } : {}), engine: { id: provider, provider, name: ENGINE_INFO[provider].name,
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
    if (refusal && (refusal.status === 429 || refusal.failure === 'rate_limited')) {
      // «تلقائي»: the provider still cools down, but the visitor does not wait for it — Shaheen answers himself.
      if (options.selfBacked) { options.gate?.limited(provider, retryHintMs(refusal.detail)); return { outcome: 'next' }; }
      return { outcome: 'limited', retryMs: retryHintMs(refusal.detail) };
    }
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
export function publicChatResult(result: { reply: string; mode?: string; sources?: readonly ChatSource[] }, question = '') {
  const mode = (SHAHEEN_MODES as readonly string[]).includes(result.mode || '') ? result.mode! : 'auto';
  // The model sometimes labels the visual-aid block ```json or leaves it open: send one canonical block.
  // A real question gets the answer straight away, not «أهلاً بك.» first. Source links stay metadata until requested.
  const sources = result.sources ? safeChatSources(result.sources) : undefined;
  const normalized = normalizeMediaBlocks(result.reply);
  const visible = asksForSources(question) ? normalized : hideUnrequestedSources(normalized);
  return { reply: stripOpeningGreeting(visible, question), mode, ...(sources?.length ? { sources } : {}), engine: { id: mode, provider: 'shaheen', name: 'الخبير شاهين', badge: 'شاهين', accentColor: 'amber' } };
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
export function createShaheenRouter(options: { repo: Repository; env?: Environment; fetch?: typeof fetch; runtime?: ShaheenRuntime; memory?: ShaheenMemory;
  /** «مكتبة شاهين»: what he knows without any AI (tests inject it; default: lessons, materials encyclopaedia, memory). */
  library?: () => Promise<LibrarySources>;
  /** «باحث شاهين»: looks a new question up in open sources (tests inject it; default: Wikipedia's public API). */
  research?: (question: string, lang: string) => Promise<Research | undefined>;
  /** «متجر شام» as Shaheen's linked brain reads it (tests inject it; default: the products + Shaheen's enrichment). */
  catalog?: () => Promise<StoreProduct[]>;
  /** «الربط المباشر» (S-10): on unless the State paused it (tests inject the switch; default: the bundled orders). */
  agentLink?: boolean }) {
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
  // A key the bots found out of credit or invalid stays parked on every new server instance (until it changes).
  seedQuotaPauses(health, bundledQuota, env);
  // «الربط المباشر بين وكيل شاهين وشاهين» (S-10): under the State's eye — its orders can pause it, the owner's too.
  const linkFlag = env.SHAM_AGENT_LINK?.trim().toLowerCase();
  const linkOn = options.agentLink ?? (linkFlag === 'off' || linkFlag === '0' ? false
    : agentLinkOn(readStateOrders(bundledStateOrders), readControls(bundledControls)));
  // «مترجم ردود شاهين»: his own replies (Arabic/English) translated by whichever platform can, checked and cached.
  const translations = new TranslationCache();
  const translateReply: TranslateFn = async (text, lang, signal) => {
    if (platformsOff(env)) return undefined;
    const { shaheen } = await settings();
    const configured = new Set(engineStatuses(env).filter((e) => e.configured && e.kind !== 'own').map((e) => e.id));
    for (const provider of health.order(shaheen.engines.filter((id) => configured.has(id)))) {
      if (signal.aborted || health.parkedUntil(provider)) continue;
      const model = provider === 'gemini' ? liteModel(env) : shaheen.models[provider] || undefined;
      const out = await callEngine(provider, translationInstruction(lang), [{ role: 'user', text }], {
        env, fetch: options.fetch, signal, temperature: 0.1, model, maxTokens: Math.min(4096, Math.ceil(text.length / 1.5) + 256), maxChars: 24000,
      }).catch(() => undefined);
      if (out?.trim()) return out;
    }
    return undefined;
  };
  // The store as his brain reads it: loaded once per instance, refreshed every 10 minutes.
  let storeCache: { at: number; list: Promise<StoreProduct[]> } | undefined;
  const products = options.catalog || (() => {
    if (!storeCache || Date.now() - storeCache.at > 10 * 60_000) {
      const list = liveStoreCatalog(env, options.fetch).catch(() => undefined)
        .then((file) => mergeCatalog(((productsData as { products?: RawProduct[] }).products || []), file));
      storeCache = { at: Date.now(), list };
      list.catch(() => { storeCache = undefined; });
    }
    return storeCache.list;
  });
  const link = productLink(env.SHAM_SITE_URL?.trim() || undefined);
  // «ذاكرة شاهين»: repeated questions without any AI call, and answers when no engine is reachable.
  const memory = options.memory;
  runtime?.attach({ gate, answers: answers as AnswerCache<unknown> });
  const library = options.library || (async (): Promise<LibrarySources> => ({
    lessons: await trainedKnowledge(env, options.fetch).catch(() => []),
    materials: RAW_MATERIALS_DATABASE,
    memory: memory ? await memory.all().catch(() => undefined) : undefined,
  }));
  // On where the site is really served (and with an injected fetch in tests); never a real web call from a test.
  const researchFlag = env.SHAM_WEB_RESEARCH?.trim().toLowerCase();
  const researchOn = researchFlag !== '0' && researchFlag !== 'off'
    && (researchFlag === 'on' || researchFlag === '1' || Boolean(env.VERCEL) || env.NODE_ENV === 'production' || Boolean(options.fetch));
  const spider = createResearchSpider((options.fetch || fetch) as never, { userAgent: RESEARCH_USER_AGENT, timeoutMs: 8000 });
  const research = options.research || (!researchOn
    ? async () => undefined
    : spider.search);
  /** A question no engine answered goes on the study list of «مدرسة شاهين» (admin-only knowledge gaps). */
  const noteForStudy = async (question: string) => {
    if (isPersonal(question) || isTimeBound(question)) return false;
    return Boolean(await options.repo.recordGap({ question, source: 'no_answer', reason: SHAHEEN_OFFLINE_GAP }).catch(() => undefined));
  };
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
    // «مترجم ردود شاهين»: every reply in the visitor's language (his country's or the one he picked on the site).
    const target = typeof req.body?.language === 'string' && SUPPORTED_LANGUAGES.some((l) => l.code === req.body.language) ? req.body.language as SupportedLanguage : undefined;
    // «دولة الدخول قبل الرد»: the reply leaves in the currency of the country the visitor is entering from — checked on
    // the translated text (installed first, so it runs last) and on the text the translator gets (installed again below).
    sendInVisitorMoney(req, res, target || 'ar');
    if (target && target !== 'ar') {
      const send = res.json.bind(res);
      const asked = typeof req.body?.message === 'string' ? req.body.message : '';
      res.json = ((body: unknown) => {
        const reply = (body as { reply?: unknown } | null)?.reply;
        if (typeof reply !== 'string' || !needsTranslation(reply, target, asked)) return send(body);
        void localizeReply(reply, target, asked, translateReply, translations, Math.min(TRANSLATE_MS, CHAT_BUDGET_MS - (Date.now() - started)))
          .catch(() => ({ reply, translated: false, changed: false }))
          .then((out) => { if (!res.destroyed && !res.headersSent) send(out.changed ? { ...(body as object), reply: out.reply, ...(out.translated ? { translated: target } : {}) } : body); });
        return res;
      }) as typeof res.json;
      sendInVisitorMoney(req, res, target);
    }
    const controller = new AbortController();
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    let chatInput: { input: ChatRequest; mode: string; useMemory: boolean; agent?: AgentResult; recorded?: boolean; opening: boolean; ownTried: boolean } | undefined;
    // «تلقائي»: the platforms while they work, his own brain the moment they don't (selfBacked: no error page for a visitor).
    const switchMode = platformsMode(env);
    const selfBacked = switchMode !== 'on';
    /**
     * His own answer: «مصمم شاهين الذاتي» for a design request, then «وكيل شاهين» (understand → plan → the school's
     * experts, the library, the memory, open sources → check). `after` = the platforms just failed on «تلقائي».
     */
    /**
     * `storeOnly` = «الربط المباشر» while the platforms work: the owner's rule is that Shaheen relies on them (and learns
     * from them) while they work, so only what no platform can know — «متجر شام» itself: its real products, prices and
     * notes, read with the conversation before — is answered by his own brain first. Everything else goes to them.
     */
    const ownAnswer = async (input: ChatRequest, mode: string, useMemory: boolean, opening: boolean, after?: string, storeOnly = false): Promise<{ done: boolean; agent?: AgentResult; recorded: boolean }> => {
      const { shaheen } = await settings();
      if (!shaheen.enabled) return { done: false, recorded: false };
      // Answered: a normal 200 (on «تلقائي» the platform outage that led here stays visible to the maintenance agent).
      const mark = () => runtime?.record(after ? { ms: Date.now() - started, status: 200, code: `${after}+SELF` } : { ms: Date.now() - started, status: 200 });
      const send = (reply: string, by: LinkSource, extra: Record<string, unknown>) => {
        if (!res.destroyed) res.json({ ...publicChatResult({ reply, mode }, input.message), ...extra, ...(linkOn ? { link: by } : {}) });
        mark();
      };
      const history = input.conversationHistory;
      const last = history[history.length - 1];
      const previous = last?.role === 'assistant' && last.text.includes('sham-formula') ? [...history].reverse().find((t) => t.role === 'user')?.text : undefined;
      // «مصمم تركيبات التجميل»: a cream, serum, balm … formula with its phases, method and safety warnings (no platform).
      const cosmetic = storeOnly ? undefined : cosmeticFor(input.message, input.language);
      if (cosmetic) {
        send(cosmetic.reply, 'designer', { designer: true, cosmetic: true });
        return { done: true, recorded: false };
      }
      const design = storeOnly ? undefined : designFor(input.message, input.language, previous);
      if (design) {
        // The linked brain: the ready perfumes of the store that share the formula's notes.
        const store = linkOn && design.design ? designStoreNote(await products().catch(() => []), design.design, design.lang, link) : '';
        send(design.reply + store, 'designer', { designer: true });
        return { done: true, recorded: false };
      }
      // «الربط المباشر»: the question read with the conversation before it, and a shopping wish answered from the store.
      const ctx: Context = linkOn ? withContext(input.message, history) : { text: input.message, followUp: false };
      // «شاهين ابن الناس»: a complaint, an angry visitor, wholesale, corporate gifts, a discount request, thanks, a
      // condolence or gift etiquette — answered with the store's real channels (sociology, public relations, commerce).
      const relation = linkOn ? relationsAnswer(ctx, input.language) : undefined;
      if (relation) {
        send(relation.reply, 'agent', { relations: { situation: relation.situation, anger: relation.reading.anger } });
        return { done: true, recorded: false };
      }
      // «شاهين التاجر المحنك»: «هاخده» closes the sale (and offers what completes it), «غالي» and «مش متأكد» are answered.
      const sale = linkOn ? salesAnswer(await products().catch(() => []), ctx, input.language, link) : undefined;
      if (sale) {
        send(sale.reply, 'store', { memory: 'store', store: { picks: sale.picks.map((p) => p.sku), matched: true, followUp: ctx.followUp, sale: true } });
        return { done: true, recorded: false };
      }
      // A perfume named from the store, or a wish for one: answered from the catalogue (live prices, no platform needed).
      const named = linkOn ? productAnswer(await products().catch(() => []), ctx, input.language, link) : undefined;
      if (linkOn && (named || wantsStore(ctx.text))) {
        const answer = named || storeAnswer(await products().catch(() => []), ctx, input.language, link);
        if (answer) {
          send(answer.reply, 'store', { memory: 'store', store: { picks: answer.picks.map((p) => p.sku), matched: answer.matched, followUp: ctx.followUp } });
          return { done: true, recorded: false };
        }
      }
      if (storeOnly) return { done: false, recorded: false };
      let agent: AgentResult | undefined;
      let recorded = false;
      const asked = ctx.followUp ? ctx.text : input.message;
      const shopping = questionIntents(asked).includes('store');
      if (useMemory && !shopping && (opening || ctx.followUp || understand(asked, input.language).subjects.length >= 2)) {
        const sources = await library().catch((): LibrarySources => ({ lessons: [], materials: [] }));
        agent = await runAgent(asked, input.language, {
          sources, lexicon: agentLexicon(sources), research: (q, lang) => research(q, lang),
        });
        if (agent.refer && !isPersonal(asked) && !isTimeBound(asked)) {
          recorded = Boolean(await options.repo.recordGap({ question: agent.understanding.asked, source: 'no_answer', reason: expertGapReason(agent.expert.field) }).catch(() => undefined));
        }
        if (agent.answer && !res.destroyed) {
          const cited = agent.sources ? safeChatSources(agent.sources) : undefined;
          send(agent.answer, ctx.followUp ? 'context' : 'agent', { memory: 'agent', agent: { field: agent.expert.field, confidence: agent.confidence, sources: agent.used },
            ...(cited?.length ? { sources: cited } : {}) });
          return { done: true, agent, recorded };
        }
      }
      return { done: false, agent, recorded };
    };
    res.on('close', cancel);
    try {
      const checked = validateChatRequest(req.body);
      // «فهم شاهين للغلطات»: Arabic typed with the English keyboard on («.ivm hgg,js») is read as the Arabic meant.
      const typed = keyboardFix(checked.message);
      const input = typed ? { ...checked, message: typed } : checked;
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
      // With the platforms closed — or, on «تلقائي», none of them able to answer right now — his memory and library
      // ARE the answer, so the probes test them too.
      const own = switchMode === 'off' || (switchMode === 'auto' && !platformsReady(shaheen, env, health));
      const useMemory = Boolean(shaheen.enabled && (own || (memory && req.body?.memory !== false)));
      const mode = shaheen.allowVisitorChoice ? input.model : 'auto';
      if (isSourcesFollowUp(input.message)) {
        const previousAnswer = [...input.conversationHistory].reverse().find((turn) => turn.role === 'assistant');
        let sources = previousAnswer?.sources;
        if (!sources?.length) {
          const previousQuestion = [...input.conversationHistory].reverse().find((turn) => turn.role === 'user')?.text;
          if (previousQuestion && researchQueries(previousQuestion, input.language)) {
            const found = await research(previousQuestion, input.language).catch(() => undefined);
            sources = found?.sources;
          }
        }
        const reply = requestedSourcesReply(sources || [], input.language);
        if (!res.destroyed) res.json({ ...publicChatResult({ reply, mode, sources: sources || [] }, input.message), memory: 'sources' });
        runtime?.record({ ms: Date.now() - started, status: 200 });
        return;
      }
      // «تطبيقات شاهين السريعة»: the same instant apps as the browser (for clients that did not run them).
      // A card/ID/IBAN number is answered here and never forwarded or kept, whatever the settings.
      const quick = hasSensitiveNumber(input.message) || offersCardDetails(input.message) || (shaheen.enabled && req.body?.memory !== false) ? quickAnswer(input.message, input.language) : undefined;
      if (quick) {
        if (!res.destroyed) res.json({ ...publicChatResult({ reply: quick.reply, mode }, input.message), quick: quick.app });
        runtime?.record({ ms: Date.now() - started, status: 200 });
        return;
      }
      // «الربط المباشر» (S-10), platforms open: a question about the store is answered from the store itself (real
      // products, prices, notes — what no platform knows); the rest goes to the platforms and what they say is learned.
      // The supervisor's probes (memory:false) keep testing the platforms themselves.
      if (linkOn && !own && shaheen.enabled && req.body?.memory !== false && mode !== 'council') {
        const mine = await ownAnswer(input, mode, true, opening, undefined, true);
        if (mine.done) return;
      }
      // With the platforms closed, «وكيل شاهين» (src/utils/shaheenAgent.ts) answers instead of the old-answer shortcut:
      // his memory is one source among the school's experts, not the answer by default.
      if (useMemory && memory && opening && !own) {
        // The usual answers first: the same question, or one worded almost the same («العطر بيثبت ازاي؟» after «ازاي
        // العطر يثبت؟») — the platforms are kept for questions that are really new.
        const hit = await memory.recall(input.message, input.language, mode).catch(() => undefined)
          || (mode === 'auto' && !isTimeBound(input.message) ? await memory.recallSimilar(input.message, input.language, NEAR_SAME).catch(() => undefined) : undefined);
        if (hit) {
          if (!res.destroyed) res.json({ ...publicChatResult({ reply: hit.entry.answer, mode }, input.message), memory: hit.exact ? 'exact' : 'similar' });
          runtime?.record({ ms: Date.now() - started, status: 200 });
          return;
        }
      }
      // «مصمم شاهين الذاتي» and «وكيل شاهين»: his own answer — when the platforms are closed, or on «تلقائي» when none works.
      let agent: AgentResult | undefined;
      let recorded = false;
      if (own) {
        const mine = await ownAnswer(input, mode, useMemory, opening);
        if (mine.done) return;
        ({ agent, recorded } = mine);
      }
      chatInput = { input, mode, useMemory, agent: agent?.understanding.outOfScope ? undefined : agent, recorded, opening, ownTried: own };
      // «تلقائي» with every platform down: no visitor waits on engines known to be down — straight to his memory and library.
      if (own && switchMode === 'auto') throw new ChatError(503, 'PROVIDER_UNAVAILABLE', 'No AI platform can answer right now');
      // «تلقائي»: the platforms get the time they need to answer (a working one used to be cut at 15 s, so Shaheen
      // answered alone while it was still thinking), and his own brain still has its seconds before Vercel's 60 s.
      const auto = switchMode === 'auto';
      const run = (signal?: AbortSignal) => executeChat(input, { env, fetch: options.fetch, signal, settings: shaheen, council, gate, owner: visitor, health, selfBacked: auto,
        ...(auto ? { timeoutMs: AUTO_ENGINE_MS, totalTimeoutMs: AUTO_TOTAL_MS } : {}) });
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
      // Other provider answers are kept for the day the packages run out — but live-search results are not
      // automatically promoted into memory or the school: their linked sources are still unreviewed.
      // Follow-ups are kept under the question as Shaheen understood it («طب وللصيف؟» → the whole question).
      if (memory && mode !== 'council' && result.reply && result.engine.provider !== 'perplexity') {
        const asked = opening ? input.message : learnedQuestion(input.message, input.conversationHistory);
        if (asked) await memory.learn({ question: asked, lang: input.language, mode, answer: publicChatResult(result, input.message).reply }).catch(() => undefined);
      }
    } catch (error) {
      if (res.destroyed) return;
      // «تلقائي»: the platforms were expected to answer and did not (a key, a balance, a limit, an outage) — Shaheen
      // answers on his own right away, exactly as when they are closed; the engine health parks the failing ones.
      if (error instanceof ChatError && OFFLINE_CODES.has(error.code) && chatInput && switchMode === 'auto' && !chatInput.ownTried) {
        chatInput.ownTried = true;
        chatInput.useMemory = true;
        const mine = await ownAnswer(chatInput.input, chatInput.mode, true, chatInput.opening, error.code);
        if (mine.done || res.destroyed) return;
        chatInput.agent = mine.agent?.understanding.outOfScope ? undefined : mine.agent;
        chatInput.recorded = mine.recorded;
      }
      // No engine answered: what he saved before (the platforms' answers, the harvest, the school) and his library come
      // FIRST — the agent's «I don't know yet» used to cut in front of them, so the day the packages ran out he
      // could answer nothing.
      if (error instanceof ChatError && OFFLINE_CODES.has(error.code) && chatInput?.useMemory) {
        const { input, mode } = chatInput;
        // «المكتب السريع»: a science question is answered from his index (a lesson the team reviewed) in a fraction
        // of a millisecond, before his memory is walked and his library is searched. When the owner closed the
        // platforms on purpose, the agent above has already consulted the same curriculum with its full weighing.
        if (!selfBacked || !chatInput.ownTried) {
          const desk = scienceDesk(input.message, input.language);
          if (desk) {
            if (!res.destroyed) res.json({ ...publicChatResult({ reply: desk.answer, mode }, input.message), memory: 'science' });
            runtime?.record({ ms: Date.now() - started, status: error.status, code: `${error.code}+SCIENCE` });
            return;
          }
        }
        let hit = await memory?.recallSimilar(input.message, input.language).catch(() => undefined);
        // «فهم شاهين للغلطات»: nothing close as typed — the question as he understands it (a mistyped word read as
        // the word meant, from everything he knows), shown with the answer so a wrong guess is visible.
        let sources: LibrarySources | undefined;
        let understood: Understanding | undefined;
        if (!hit) {
          sources = await library().catch(() => ({ lessons: [], materials: [] }));
          understood = understandQuestion(input.message, buildLexicon(sources));
          if (understood.changed) hit = await memory?.recallSimilar(understood.text, input.language).catch(() => undefined);
        }
        const asked = understood?.changed ? understood.text : input.message;
        const note = understood ? understoodNote(input.language, understood) : '';
        if (hit && !res.destroyed) {
          if (!hit.exact && !chatInput.recorded) await noteForStudy(input.message);
          res.json({ ...publicChatResult({ reply: note + hit.entry.answer + offlineNote(input.language, hit.exact), mode }, input.message), memory: hit.exact ? 'exact' : 'similar' });
          // Still an engine outage for the maintenance agent, even though the visitor got an answer (not when the
          // owner closed the platforms on purpose: then this is how Shaheen works).
          runtime?.record(switchMode === 'off' ? { ms: Date.now() - started, status: 200 } : { ms: Date.now() - started, status: error.status, code: `${error.code}+MEMORY` });
          return;
        }
        // Nothing close in memory: «مكتبة شاهين» builds an answer from what he knows (not for shopping questions —
        // the browser answers those with the store's own picks).
        if (!questionIntents(input.message).includes('store')) {
          // Already on the field expert's study list (the agent put it there): not moved to the general one.
          const recorded = chatInput.recorded || await noteForStudy(input.message);
          const found = libraryAnswer(sources || await library().catch(() => ({ lessons: [], materials: [] })), asked, input.language, { recorded });
          if (found && !res.destroyed) {
            res.json({ ...publicChatResult({ reply: note + found.answer, mode }, input.message), memory: 'library' });
            runtime?.record(switchMode === 'off' ? { ms: Date.now() - started, status: 200 } : { ms: Date.now() - started, status: error.status, code: `${error.code}+LIBRARY` });
            return;
          }
          // Not in his library either: «باحث شاهين» looks it up in open sources and answers from what he read (the
          // agent already did, when it ran).
          const found2 = chatInput.agent ? undefined : await research(asked, input.language).catch(() => undefined);
          if (found2 && !res.destroyed) {
            res.json({ ...publicChatResult({ reply: note + researchAnswer(found2, { recorded }), mode }, input.message),
              ...(safeChatSources(found2.sources)?.length ? { sources: safeChatSources(found2.sources) } : {}), memory: 'research' });
            runtime?.record(switchMode === 'off' ? { ms: Date.now() - started, status: 200 } : { ms: Date.now() - started, status: error.status, code: `${error.code}+RESEARCH` });
            return;
          }
          // «وكيل شاهين» consulted everything and found nothing solid: an honest answer, and the field's expert studies it.
          if (chatInput.agent && selfBacked && !res.destroyed) {
            const { agent, recorded: sent } = chatInput;
            res.json({ ...publicChatResult({ reply: note + agent.understanding.note + referralAnswer(input.language, agent.expert, Boolean(sent || recorded)), mode }, input.message), memory: 'unknown', agent: { field: agent.expert.field, confidence: 'low', sources: [] } });
            runtime?.record({ ms: Date.now() - started, status: 200 });
            return;
          }
          // «شاهين معتمد على نفسه»: nothing anywhere — an honest «I don't know yet» instead of «unavailable».
          if (selfBacked && !res.destroyed) {
            res.json({ ...publicChatResult({ reply: note + unknownAnswer(input.language, recorded), mode }, input.message), memory: 'unknown' });
            runtime?.record({ ms: Date.now() - started, status: 200 });
            return;
          }
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

/** The reason on the knowledge gaps «مدرسة شاهين» studies (questions asked while no engine answered). */
export const SHAHEEN_OFFLINE_GAP = 'shaheen_offline';

/**
 * The question a platform answer inside a conversation is kept under: a follow-up as he understood it with what came
 * before; a new question as asked. Undefined when it can't stand alone («and the second one?» with nothing to carry).
 */
export function learnedQuestion(message: string, history: { role: 'user' | 'assistant'; text: string }[]): string | undefined {
  const ctx = withContext(message, history);
  if (!ctx.followUp) return message;
  return ctx.text && ctx.text !== message ? ctx.text : undefined;
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
