/**
 * Intent router — a lightweight "mixture of experts" gate: every message is scored against
 * system intents and against each enabled service's keywords, enriched with semantic/dialect
 * expansion, multi-turn anaphora resolution, rich entity extraction, calibrated confidence,
 * and competing-service disambiguation. Deterministic, explainable and free to run.
 */
import { matchesKeyword, normalize, tokenize } from './text';
import { asksForPlatformOverview, matchPlatformFeature } from './platformGuide';
import type { ServiceDef } from './types';
import { clampConfidence, type DisambiguationPrompt, type RoutingDecision } from './confidence';

/** Re-exported so existing callers (and tests) keep importing the matcher from the router. */
export { matchesKeyword } from './text';

export type Intent =
  | 'greeting' | 'thanks' | 'list_services' | 'track_order' | 'browse_products'
  | 'service_request' | 'handoff' | 'calculate' | 'perfume_expert' | 'question'
  | 'platform_help' | 'memory_view' | 'forget' | 'identity';

export interface RouteResult {
  intent: Intent;
  serviceId?: string;
  confidence: number;
  scores: Record<string, number>;
  entities: {
    ref?: string;
    phone?: string;
    email?: string;
    volumeMl?: number;
    percent?: number;
    name?: string;
    notes?: string;
    concentrationType?: string;
    budget?: number;
  };
  /** Which platform feature the visitor asked about (see server/core/platformGuide.ts); absent = the whole map. */
  platformId?: string;
}

const has = (text: string, words: string[]) => words.some((w) => matchesKeyword(text, w));

const GREETING = ['السلام عليكم', 'سلام عليكم', 'مرحبا', 'اهلا', 'هاي', 'صباح الخير', 'مساء الخير', 'hello', 'hi ', 'hey', 'good morning', 'good evening'];
/** "Who are you / which AI is this?" — answered by Sham itself, never by a model that might name its vendor. */
const IDENTITY = new RegExp([
  ' (انت|انتي|حضرتك) (مين|ايه|بوت|روبوت|انسان|ذكاء|موديل|نموذج)',
  ' مين (انت|انتي|اللي (عملك|برمجك|صنعك|طورك)|عملك|برمجك|صنعك|طورك)',
  ' (بانهي|باي|بأي|ايه|اي|انهي) (ذكاء|موديل|نموذج|محرك|ai )',
  ' (انت|انتي|حضرتك) (شغال|مبني|معمول|مبرمج|متدرب) (على|علي|ب)',
  ' (chat ?gpt|gpt ?-?\\d|gemini|openai|claude|anthropic|deepseek|llama|qwen|bard|copilot) ',
  ' who (are you|made you|built you|created you|trained you)',
  ' (what|which) (ai|model|llm|engine) (are you|is this|do you)',
  ' are you (an? )?(ai|bot|robot|human|gpt|real person)',
].join('|'));

const THANKS = ['شكرا', 'متشكر', 'تسلم', 'جزاك الله', 'thanks', 'thank you', 'thx'];
const SERVICES_LIST = ['خدمات', 'خدماتكم', 'بتقدموا ايه', 'تقدمون', 'تعمل ايه', 'تقدر تعمل', 'services', 'what can you do', 'what do you offer'];
const TRACK = ['تتبع', 'حاله الطلب', 'حالة طلبي', 'طلبي فين', 'فين طلب', 'فين الطلب', 'وصل فين', 'رقم الطلب', 'موصلش', 'مجاش', 'ماوصل', 'لم يصل', 'الشحنه فين', 'الاوردر فين', 'track', 'order status', 'where is my order'];
const HANDOFF = ['موظف', 'شخص حقيقي', 'انسان', 'بشري', 'خدمه العملاء', 'اكلم حد', 'كلم حد', 'human', 'real person', 'agent', 'representative'];
const ORDER_VERBS = ['اطلب', 'طلب', 'احجز', 'حجز', 'اشتري', 'سجل', 'قدم', 'ابعت عرض', 'عرض سعر', 'عايز', 'عاوز', 'محتاج', 'اريد', 'ابغي', 'اسوي', 'نفسي في',
  'order', 'request', 'book', 'quote', 'apply', 'purchase', 'i want', 'i need', 'i would like', 'looking for'];
const FORGET = ['امسح بياناتي', 'احذف بياناتي', 'امسح ذاكرتك', 'انسي كل', 'انساني', 'امسح محادثاتي', 'احذف محادثاتي', 'delete my data', 'forget me', 'erase my data', 'delete my conversations'];
const MEMORY = ['ماذا تتذكر', 'بتفتكر ايه', 'فاكر ايه', 'تعرف ايه عني', 'تعرف عني', 'بتعرف عني', 'بتعرفه عني', 'تعرفه عني', 'بتعرفي عني',
  'ماذا تعرف عني', 'ايه اللي تعرفه عني', 'ايه اللي بتعرفه عني', 'بتعرف عني ايه', 'بياناتي', 'what do you remember', 'what do you know about me', 'my data'];
const BROWSE = ['منتجات', 'المنتجات', 'كتالوج', 'متوفر', 'متاح', 'سعر', 'اسعار', 'بكام', 'عندكم', 'products', 'catalog', 'price', 'available', 'in stock',
  // A budget or a shopping wish is a store search even without the word «سعر» («عايز عطر تحت 1000 جنيه»).
  'تحت', 'اقل من', 'بحدود', 'حدود', 'ميزانيه', 'رخيص', 'ارخص', 'هديه', 'under', 'budget', 'cheap', 'gift'];
/** A perfume word: the shopping cues above only mean «the store» when the visitor is asking about perfume. */
const PERFUME_WORD = ['عطر', 'عطور', 'برفان', 'perfume', 'fragrance', 'cologne', 'دهن عود'];
/** Prices of things that are not perfume (gold, currency, stocks…) must never be answered from the store. */
const NOT_PERFUME = ['الذهب', 'ذهب', 'فضه', 'فضة', 'دولار', 'يورو', 'بورصه', 'بورصة', 'عمله', 'عملات', 'اسهم', 'سهم', 'بيتكوين', 'كريبتو',
  'gold', 'silver', 'bitcoin', 'stock market', 'currency', 'exchange rate'];
const EXPERT = ['نوته', 'نوتات', 'تركيبه عطر', 'مكونات', 'فواحه', 'ثبات', 'فوحان', 'مسك', 'عنبر', 'عود', 'فانيليا', 'accord', 'notes', 'longevity', 'sillage', 'formula'];

const AR_B_START = '(?:^|\\s)(?:وال|بال|لل|ال|و)?';
const AR_B_END = '(?=$|\\s)';
const arWordRe = (alts: string) => new RegExp(`${AR_B_START}(?:${alts})${AR_B_END}`, 'iu');

const NOTE_LEXICON: Array<[RegExp, string]> = [
  [arWordRe('عود|دهن عود|oud|agarwood'), 'عود'],
  [arWordRe('مسك|musk'), 'مسك'],
  [arWordRe('عنبر|امبر|amber'), 'عنبر'],
  [arWordRe('ورد|rose'), 'ورد'],
  [arWordRe('فانيليا|فانيلا|vanilla'), 'فانيليا'],
  [arWordRe('برغموت|برجموت|bergamot'), 'برغموت'],
  [arWordRe('صندل|sandalwood'), 'صندل'],
  [arWordRe('ياسمين|jasmine'), 'ياسمين'],
  [arWordRe('باتشولي|patchouli'), 'باتشولي'],
  [arWordRe('زعفران|saffron'), 'زعفران'],
  [arWordRe('بخور|لبان|incense|frankincense'), 'بخور'],
  [arWordRe('جلد|ليذر|leather'), 'جلد'],
];

const DIALECT_EXPANSIONS: Array<[RegExp, string]> = [
  [arWordRe('عاوز|عايزه|عايزين|محتاجه|نفسي في'), 'عايز اريد'],
  [arWordRe('عندكوا|متاحه|موجود عندكم'), 'عندكم متاح'],
  [arWordRe('بكام ده|سعرها|اسعاركم|تكلفه|التكلفه'), 'سعر بكام'],
  [arWordRe('تركيبه خاصه|عطر باسمي|برفان مخصوص|تفصيل عطر'), 'تركيب عطر مخصص bespoke'],
  [arWordRe('عندي محل|كميات كبيره|كرتونه|تصنيع للغير|علامتي التجاريه'), 'جمله تصنيع b2b wholesale'],
  [arWordRe('هشتريه|هاخده|احجزهولي|اطلبهولي|اطلبه|اطلبها|عايز منه|عايز منها|take it|order that|buy it'), '__FOLLOWUP_ACTION__'],
];

export function extractEntities(message: string): RouteResult['entities'] {
  const latin = message
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  const norm = ` ${normalize(latin)} `;
  const entities: RouteResult['entities'] = {};
  // A reference always carries its separator («SH-123456» / «SH 123456») or starts with a digit («SH123456»):
  // `SH-?` used to read “shipping” as “SH-IPPING”.
  const ref = latin.toUpperCase().match(/\bSH(?:[-\s–—]|(?=\d))([A-Z0-9]{6})\b/);
  if (ref) entities.ref = `SH-${ref[1]}`;
  const email = latin.match(/[^\s@]+@[^\s@]+\.[^\s@]{2,}/);
  if (email) entities.email = email[0].toLowerCase();
  const phone = latin.match(/(?:\+|00)?\d[\d\s-]{6,16}\d/);
  if (phone && phone[0].replace(/\D/g, '').length >= 8) entities.phone = phone[0];
  const volume = latin.match(/(\d+(?:\.\d+)?)\s*(?:مل|ml|ملي|مللي)/i);
  if (volume) entities.volumeMl = Number(volume[1]);
  const percent = latin.match(/(\d+(?:\.\d+)?)\s*(?:%|٪|في المي[هة]|بالمي[هة]|percent)/i);
  if (percent) entities.percent = Number(percent[1]);
  const name = message.match(/(?:اسمي|انا اسمي|my name is)\s+([\p{L}]{2,20})/iu);
  if (name) entities.name = name[1];

  const foundNotes = NOTE_LEXICON.filter(([re]) => re.test(norm)).map(([, label]) => label);
  if (foundNotes.length) entities.notes = foundNotes.join(', ');

  if (arWordRe('edp|eau de parfum|او دي بارفان|او دو بارفان').test(norm)) entities.concentrationType = 'EDP';
  else if (arWordRe('edt|eau de toilette|تواليت|او دي تواليت').test(norm)) entities.concentrationType = 'EDT';
  else if (arWordRe('extrait|parfum|بارفيوم خام|اكسترايت').test(norm)) entities.concentrationType = 'Parfum';

  const budget = norm.match(/(?:ميزانيه|في حدود|تحت|بحد اقصي|budget(?:\s+of)?|under)\s*(\d{2,6})/iu);
  if (budget) entities.budget = Number(budget[1]);

  return entities;
}

function expandSemanticDialect(message: string): string {
  const norm = ` ${normalize(message)} `;
  const extras: string[] = [];
  for (const [pattern, replacement] of DIALECT_EXPANSIONS) {
    if (pattern.test(norm)) extras.push(replacement);
  }
  return extras.length ? `${message} ${extras.join(' ')}` : message;
}

export function route(message: string, services: ServiceDef[]): RouteResult {
  const expandedMessage = expandSemanticDialect(message);
  const text = ` ${normalize(expandedMessage)} `;
  const rawText = ` ${normalize(message)} `;
  const tokens = new Set(tokenize(expandedMessage));
  const rawTokens = new Set(tokenize(message));
  const entities = extractEntities(message);
  const scores: Record<string, number> = {};

  for (const service of services) {
    let score = 0;
    for (const keyword of service.keywords) {
      const k = normalize(keyword);
      if (!k) continue;
      if (k.includes(' ') ? text.includes(` ${k} `) || text.includes(k) : tokens.has(tokenize(k)[0] || k) || text.includes(` ${k} `)) score += k.includes(' ') ? 2 : 1;
    }
    if (score) scores[`service:${service.id}`] = score;
  }

  const wantsAction = has(text, ORDER_VERBS);
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const best = ranked[0];
  const second = ranked[1];
  const bestService = best ? services.find((s) => `service:${s.id}` === best[0]) : undefined;
  const marginBonus = best ? (second ? Math.min(0.1, (best[1] - second[1]) * 0.04) : 0.06) : 0;
  const result = (intent: Intent, confidence: number, serviceId?: string, platformId?: string): RouteResult =>
    ({ intent, confidence: clampConfidence(confidence), serviceId, scores, entities, ...(platformId ? { platformId } : {}) });

  if (has(rawText, FORGET) || has(text, FORGET)) return result('forget', 0.92);
  if (has(rawText, MEMORY) || has(text, MEMORY)) return result('memory_view', 0.88);
  if (entities.ref || has(text, TRACK)) return result('track_order', entities.ref && (entities.phone || entities.email) ? 0.97 : entities.ref ? 0.95 : 0.82);
  if (IDENTITY.test(rawText)) return result('identity', 0.92);
  if (has(rawText, HANDOFF) || has(text, HANDOFF)) return result('handoff', 0.9, services.find((s) => s.kind === 'support')?.id);
  if (entities.volumeMl && entities.percent) return result('calculate', 0.9, services.find((s) => s.kind === 'info')?.id);

  // A question about a part of the platform (a calculator, a library, the community, shipping…) gets a
  // direct answer plus an "open page" card. It runs before the store/browse hand-offs so that
  // «الشحن بكام؟» explains shipping instead of showing a product list, while a real purchase request
  // (which names no page) still becomes an order form below.
  const platform = matchPlatformFeature(message);
  const infoService = services.find((s) => s.kind === 'info')?.id;
  // «المتجر فيه إيه؟» / «أسعار المتجر» asks what is on sale, not how the page works — answer with real products.
  if (platform?.feature.id === 'store' && (has(text, BROWSE) || /(فيه ايه|ايه فيه|ايه اللي فيه|what is in|what do you (sell|have))/.test(text)) && !/ (ازاي|كيف|how (do|can|to)|where is) /.test(text)) {
    const storeService = services.find((s) => s.kind === 'store');
    if (storeService) return result('browse_products', 0.7, storeService.id);
  }
  if (platform) return result('platform_help', Math.min(0.9, 0.6 + platform.score * 0.05), infoService, platform.feature.id);
  if (asksForPlatformOverview(message)) return result('platform_help', 0.85, infoService);

  if (bestService) {
    // «كم سعر الذهب في البورصة» mentions a price but is not a perfume search: never quote the store.
    const browse = bestService.kind === 'store' && has(text, BROWSE) && !wantsAction && !has(text, NOT_PERFUME);
    if (browse) return result('browse_products', Math.min(0.9, 0.72 + marginBonus), bestService.id);
    if (bestService.kind !== 'info' && (wantsAction || best[1] >= 2)) {
      // A perfumery question can mention a service's own word («تركيبة شرقية») without asking to order:
      // the depth cue belongs to the formulation expert, not to a request form.
      if (!wantsAction && best[1] <= 2 && has(text, EXPERT)) return result('perfume_expert', 0.7, bestService.id);
      return result('service_request', Math.min(0.95, 0.55 + best[1] * 0.1 + marginBonus), bestService.id);
    }
  }
  // "ايه الخدمات اللي عندكم" asks for the menu, not for stock — check it before the generic availability cue.
  if (has(text, SERVICES_LIST)) return result('list_services', 0.84);
  if (has(text, BROWSE) && !has(text, NOT_PERFUME) && services.some((s) => s.kind === 'store') && (!bestService || best[1] <= 1)) return result('browse_products', 0.65, services.find((s) => s.kind === 'store')!.id);
  // «عايز عطر تحت 1000 جنيه»: a shopping wish about perfume with a budget/quality cue, and no service matched.
  if (!bestService && has(text, PERFUME_WORD) && has(text, BROWSE) && !has(text, NOT_PERFUME) && services.some((s) => s.kind === 'store')) {
    return result('browse_products', 0.65, services.find((s) => s.kind === 'store')!.id);
  }
  if (has(text, EXPERT) && !bestService) return result('perfume_expert', entities.notes ? 0.72 : 0.62);

  const short = rawTokens.size <= 3;
  if (entities.name && rawTokens.size <= 4) return result('greeting', 0.86);
  if (short && has(rawText, GREETING)) return result('greeting', 0.92);
  if (short && has(rawText, THANKS)) return result('thanks', 0.92);
  if (bestService) return result('question', 0.54 + marginBonus, bestService.id);
  return result('question', 0.48);
}

/**
 * Removes a self-introduction ("اسمي منى،" / "my name is Sara,") so it does not pollute knowledge
 * search and is not copied into admin-facing analytics such as knowledge gaps.
 */
/** Gold, currency, stocks: not perfume, so the store must never answer it (and the assistant says so). */
export function asksAboutNonPerfume(message: string): boolean {
  return has(` ${normalize(message)} `, NOT_PERFUME);
}

/** Does the visitor ask to *do* something (order/book/buy), not just *how* it works? */
export function wantsToOrder(message: string): boolean {
  return has(` ${normalize(message)} `, ORDER_VERBS);
}

export function stripIntro(message: string): string {
  return message.replace(/(?:^|\s)(?:(?:انا|أنا)\s+)?(?:اسمي|my name is)\s+[\p{L}]{2,20}\s*[،,.!؛:-]*\s*/iu, ' ').replace(/\s+/g, ' ').trim();
}

/** يبني سؤال توضيح محدد بالخدمات المتنافسة أو المتاحة عند وجود التباس حقيقي. */
export function buildDisambiguation(
  candidateServices: ServiceDef[],
  tiedServices = false,
): DisambiguationPrompt {
  const questionAr = tiedServices
    ? 'طلبك يناسب أكتر من خدمة عندنا. تحب نكمل في أي خدمة منهم؟'
    : 'تحب أساعدك في أي خدمة من خدمات شام؟ اختار الخدمة المناسبة علشان أجهزلك الاستمارة الصح:';
  const questionEn = tiedServices
    ? 'Your message matches more than one service. Which one would you like to proceed with?'
    : 'Which Sham service would you like to start with? Pick one so I prepare the right form:';
  const options = candidateServices
    .filter((s) => s.kind !== 'info')
    .slice(0, 4)
    .map((s) => ({ id: s.id, labelAr: s.nameAr, labelEn: s.nameEn }));
  return { questionAr, questionEn, options };
}

/**
 * التوجيه المعزز بالسياق: يدمج تاريخ المحادثة (حل الضمائر والإحالات مثل «عايز أطلبه»)،
 * ويكشف الالتباس الحقيقي بين خدمتين متعادلتي النقاط أو طلب إجراء عام بلا خدمة محددة.
 */
export function routeEnhanced(
  message: string,
  services: ServiceDef[],
  previousIntent?: string,
  previousServiceId?: string,
): RoutingDecision {
  const base = route(message, services);
  const platformField = base.platformId ? { platformId: base.platformId } : {};
  const expanded = expandSemanticDialect(message);
  const text = ` ${normalize(expanded)} `;
  const rawTokens = tokenize(message);
  const wantsAction = has(text, ORDER_VERBS) || expanded.includes('__FOLLOWUP_ACTION__');
  const anaphoric = expanded.includes('__FOLLOWUP_ACTION__')
    || arWordRe('ها|لها|ليه|منه|منها|ده|دي|نفسه|نفسها|it|that|this one').test(text);

  // 1) حل الإحالة من سياق المحادثة السابقة (مثل: بعد شرح خدمة أو منتج يقول الزائر «طيب عايز أطلبه»)
  if (!base.serviceId && previousServiceId && wantsAction && (anaphoric || rawTokens.length <= 4)) {
    const prevService = services.find((s) => s.id === previousServiceId && s.kind !== 'info');
    if (prevService) {
      return {
        ...platformField,
        intent: 'service_request',
        serviceId: prevService.id,
        confidence: 0.82,
        entities: base.entities,
        scores: { ...base.scores, [`context:${prevService.id}`]: 2 },
        ambiguous: false,
      };
    }
  }
  if (!base.entities.ref && base.intent === 'question' && previousIntent === 'track_order' && (base.entities.phone || base.entities.email)) {
    return {
      ...platformField,
      intent: 'track_order',
      serviceId: base.serviceId,
      confidence: 0.84,
      entities: base.entities,
      scores: base.scores,
      ambiguous: false,
    };
  }

  // 2) كشف التعادل المتنافس بين خدمتين مختلفتين تماماً (مثلاً المتجر القطاعي مقابل الجملة)
  const rankedServices = Object.entries(base.scores)
    .filter(([k]) => k.startsWith('service:'))
    .sort((a, b) => b[1] - a[1]);
  if (rankedServices.length >= 2 && rankedServices[0][1] === rankedServices[1][1] && wantsAction) {
    const topTwo = rankedServices
      .slice(0, 2)
      .map(([k]) => services.find((s) => `service:${s.id}` === k))
      .filter((s): s is ServiceDef => Boolean(s && s.kind !== 'info'));
    if (topTwo.length === 2 && topTwo[0].kind !== topTwo[1].kind) {
      return {
        ...base,
        confidence: 0.42,
        ambiguous: true,
        disambiguation: buildDisambiguation(topTwo, true),
      };
    }
  }

  // 3) طلب إجراء مبهم بالكامل دون تحديد أي خدمة أو موضوع (مثل «عايز أطلب» فقط في بداية محادثة جديدة)
  if (
    base.intent === 'question'
    && wantsAction
    && !base.serviceId
    && !previousServiceId
    && rawTokens.length <= 2
    && !message.includes('[redacted-card]')
  ) {
    return {
      ...base,
      confidence: 0.38,
      ambiguous: true,
      disambiguation: buildDisambiguation(services, false),
    };
  }

  return {
    ...base,
    ambiguous: false,
  };
}
