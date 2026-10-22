/**
 * Intent router — a lightweight "mixture of experts" gate: every message is scored against
 * system intents and against each enabled service's keywords, enriched with semantic/dialect
 * expansion, multi-turn anaphora resolution, rich entity extraction, calibrated confidence,
 * and competing-service disambiguation. Deterministic, explainable and free to run.
 */
import { normalize, tokenize } from './text';
import type { ServiceDef } from './types';
import { clampConfidence, type DisambiguationPrompt, type RoutingDecision } from './confidence';

export type Intent =
  | 'greeting' | 'thanks' | 'list_services' | 'track_order' | 'browse_products'
  | 'service_request' | 'handoff' | 'calculate' | 'perfume_expert' | 'question'
  | 'memory_view' | 'forget' | 'identity';

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
}

/**
 * Whole-word keyword match that tolerates real inflections only (text is normalised + space-padded):
 * - prefixes: ال، و، وال، بال، لل  ("الموظف" ⇒ موظف)
 * - suffixes: plural/verb endings + pronouns, incl. Egyptian dative ("موظفين"، "طلباتي"، "اطلبلي"، "طلبت")
 * but NOT arbitrary continuations: "بشري" no longer matches "بشريط", "طلب" does not match "مطلوب".
 * A keyword written with a trailing space ("hi ") must match exactly.
 */
const PREFIXES = ['', 'ال', 'و', 'وال', 'بال', 'لل'];
const AR_SUFFIX = /^(?:ين|ون|ات|ان|وا|و|ت|تي|تم|تو|يه)?(?:ي|ك|ه|ها|هم|هن|كم|كن|نا|لي|لك|لنا|لكم|له|لها)?$/;
const EN_SUFFIX = /^(?:s|es|ed|ing|d)?$/;
export function matchesKeyword(text: string, word: string): boolean {
  const exact = word.endsWith(' ');
  const key = normalize(word);
  if (!key) return false;
  const latin = /^[a-z0-9 ]+$/.test(key);
  for (const prefix of latin ? [''] : PREFIXES) {
    const needle = ` ${prefix}${key}`;
    for (let i = text.indexOf(needle); i >= 0; i = text.indexOf(needle, i + 1)) {
      const rest = (text.slice(i + needle.length).match(/^\S*/) || [''])[0];
      if (exact ? rest === '' : (latin ? EN_SUFFIX : AR_SUFFIX).test(rest)) return true;
    }
  }
  return false;
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
const MEMORY = ['ماذا تتذكر', 'بتفتكر ايه', 'فاكر ايه', 'تعرف ايه عني', 'تعرف عني', 'ماذا تعرف عني', 'ايه اللي تعرفه عني', 'بياناتي', 'what do you remember', 'what do you know about me', 'my data'];
const BROWSE = ['منتجات', 'المنتجات', 'كتالوج', 'متوفر', 'متاح', 'سعر', 'اسعار', 'بكام', 'عندكم', 'products', 'catalog', 'price', 'available', 'in stock'];
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
  const ref = latin.toUpperCase().match(/\bSH[\s–—-]?([A-Z0-9]{6})\b/);
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
  const result = (intent: Intent, confidence: number, serviceId?: string): RouteResult =>
    ({ intent, confidence: clampConfidence(confidence), serviceId, scores, entities });

  if (has(rawText, FORGET) || has(text, FORGET)) return result('forget', 0.92);
  if (has(rawText, MEMORY) || has(text, MEMORY)) return result('memory_view', 0.88);
  if (entities.ref || has(text, TRACK)) return result('track_order', entities.ref && (entities.phone || entities.email) ? 0.97 : entities.ref ? 0.95 : 0.82);
  if (IDENTITY.test(rawText)) return result('identity', 0.92);
  if (has(rawText, HANDOFF) || has(text, HANDOFF)) return result('handoff', 0.9, services.find((s) => s.kind === 'support')?.id);
  if (entities.volumeMl && entities.percent) return result('calculate', 0.9, services.find((s) => s.kind === 'info')?.id);

  if (bestService) {
    const browse = bestService.kind === 'store' && has(text, BROWSE) && !wantsAction;
    if (browse) return result('browse_products', Math.min(0.9, 0.72 + marginBonus), bestService.id);
    if (bestService.kind !== 'info' && (wantsAction || best[1] >= 2)) {
      return result('service_request', Math.min(0.95, 0.55 + best[1] * 0.1 + marginBonus), bestService.id);
    }
  }
  // "ايه الخدمات اللي عندكم" asks for the menu, not for stock — check it before the generic availability cue.
  if (has(text, SERVICES_LIST)) return result('list_services', 0.84);
  if (has(text, BROWSE) && services.some((s) => s.kind === 'store')) return result('browse_products', 0.65, services.find((s) => s.kind === 'store')!.id);
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
