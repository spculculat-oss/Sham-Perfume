/**
 * Intent router — a lightweight "mixture of experts" gate: every message is scored against
 * system intents and against each enabled service's keywords, and the best expert handles it.
 * Deterministic, explainable (scores go to the admin trace) and free to run.
 */
import { matchesKeyword, normalize, tokenize } from './text';
import { asksForPlatformOverview, matchPlatformFeature } from './platformGuide';
import type { ServiceDef } from './types';

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
  entities: { ref?: string; phone?: string; email?: string; volumeMl?: number; percent?: number; name?: string };
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
const TRACK = ['تتبع', 'حاله الطلب', 'حالة طلبي', 'طلبي فين', 'فين طلب', 'فين الطلب', 'وصل فين', 'رقم الطلب', 'موصلش', 'مجاش', 'ماوصل', 'لم يصل', 'track', 'order status', 'where is my order'];
const HANDOFF = ['موظف', 'شخص حقيقي', 'انسان', 'بشري', 'خدمه العملاء', 'اكلم حد', 'كلم حد', 'human', 'real person', 'agent', 'representative'];
const ORDER_VERBS = ['اطلب', 'طلب', 'احجز', 'حجز', 'اشتري', 'سجل', 'قدم', 'ابعت عرض', 'عرض سعر', 'عايز', 'عاوز', 'محتاج', 'اريد', 'ابغي', 'اسوي',
  'order', 'request', 'book', 'quote', 'apply', 'purchase', 'i want', 'i need', 'i would like', 'looking for'];
const FORGET = ['امسح بياناتي', 'احذف بياناتي', 'امسح ذاكرتك', 'انسي كل', 'انساني', 'امسح محادثاتي', 'احذف محادثاتي', 'delete my data', 'forget me', 'erase my data', 'delete my conversations'];
const MEMORY = ['ماذا تتذكر', 'بتفتكر ايه', 'فاكر ايه', 'تعرف ايه عني', 'تعرف عني', 'بتعرف عني', 'بتعرفه عني', 'تعرفه عني', 'بتعرفي عني',
  'ماذا تعرف عني', 'ايه اللي تعرفه عني', 'ايه اللي بتعرفه عني', 'بتعرف عني ايه', 'بياناتي', 'what do you remember', 'what do you know about me', 'my data'];
const BROWSE = ['منتجات', 'المنتجات', 'كتالوج', 'متوفر', 'متاح', 'سعر', 'اسعار', 'بكام', 'عندكم', 'products', 'catalog', 'price', 'available', 'in stock'];
/** Prices of things that are not perfume (gold, currency, stocks…) must never be answered from the store. */
const NOT_PERFUME = ['الذهب', 'ذهب', 'فضه', 'فضة', 'دولار', 'يورو', 'بورصه', 'بورصة', 'عمله', 'عملات', 'اسهم', 'سهم', 'بيتكوين', 'كريبتو',
  'gold', 'silver', 'bitcoin', 'stock market', 'currency', 'exchange rate'];
const EXPERT = ['نوته', 'نوتات', 'تركيبه عطر', 'مكونات', 'فواحه', 'ثبات', 'فوحان', 'مسك', 'عنبر', 'عود', 'فانيليا', 'accord', 'notes', 'longevity', 'sillage', 'formula'];

export function extractEntities(message: string): RouteResult['entities'] {
  const latin = message.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const entities: RouteResult['entities'] = {};
  // A reference always carries its separator: `SH-?` used to read “shipping” as “SH-IPPING”.
  const ref = latin.toUpperCase().match(/\bSH[-\s]([A-Z0-9]{6})\b/);
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
  return entities;
}

export function route(message: string, services: ServiceDef[]): RouteResult {
  const text = ` ${normalize(message)} `;
  const tokens = new Set(tokenize(message));
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
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const bestService = best ? services.find((s) => `service:${s.id}` === best[0]) : undefined;
  const result = (intent: Intent, confidence: number, serviceId?: string, platformId?: string): RouteResult =>
    ({ intent, confidence, serviceId, scores, entities, ...(platformId ? { platformId } : {}) });

  if (has(text, FORGET)) return result('forget', 0.9);
  if (has(text, MEMORY)) return result('memory_view', 0.85);
  if (entities.ref || has(text, TRACK)) return result('track_order', entities.ref ? 0.95 : 0.8);
  if (IDENTITY.test(text)) return result('identity', 0.9);
  if (has(text, HANDOFF)) return result('handoff', 0.9, services.find((s) => s.kind === 'support')?.id);
  if (entities.volumeMl && entities.percent) return result('calculate', 0.85, services.find((s) => s.kind === 'info')?.id);

  // A question about a part of the platform (a calculator, a library, the community, shipping…) gets a
  // direct answer plus an "open page" card. It runs before the store/browse hand-offs so that
  // «الشحن بكام؟» explains shipping instead of showing a product list, while a real purchase request
  // (which names no page) still becomes an order form below.
  const platform = matchPlatformFeature(message);
  const infoService = services.find((s) => s.kind === 'info')?.id;
  if (platform) return result('platform_help', Math.min(0.9, 0.6 + platform.score * 0.05), infoService, platform.feature.id);
  if (asksForPlatformOverview(message)) return result('platform_help', 0.85, infoService);

  if (bestService) {
    // «كم سعر الذهب في البورصة» mentions a price but is not a perfume search: never quote the store.
    const browse = bestService.kind === 'store' && has(text, BROWSE) && !wantsAction && !has(text, NOT_PERFUME);
    if (browse) return result('browse_products', 0.75, bestService.id);
    if (bestService.kind !== 'info' && (wantsAction || best[1] >= 2)) {
      // A perfumery question can mention a service's own word («تركيبة شرقية») without asking to order:
      // the depth cue belongs to the formulation expert, not to a request form.
      if (!wantsAction && best[1] <= 2 && has(text, EXPERT)) return result('perfume_expert', 0.7, bestService.id);
      return result('service_request', Math.min(0.95, 0.55 + best[1] * 0.1), bestService.id);
    }
  }
  // "ايه الخدمات اللي عندكم" asks for the menu, not for stock — check it before the generic availability cue.
  if (has(text, SERVICES_LIST)) return result('list_services', 0.8);
  if (has(text, BROWSE) && !has(text, NOT_PERFUME) && services.some((s) => s.kind === 'store')) return result('browse_products', 0.6, services.find((s) => s.kind === 'store')!.id);
  if (has(text, EXPERT) && !bestService) return result('perfume_expert', 0.6);

  const short = tokens.size <= 3;
  if (entities.name && tokens.size <= 4) return result('greeting', 0.85);
  if (short && has(text, GREETING)) return result('greeting', 0.9);
  if (short && has(text, THANKS)) return result('thanks', 0.9);
  if (bestService) return result('question', 0.5, bestService.id);
  return result('question', 0.3);
}

/**
 * Removes a self-introduction ("اسمي منى،" / "my name is Sara,") so it does not pollute knowledge
 * search and is not copied into admin-facing analytics such as knowledge gaps.
 */
export function stripIntro(message: string): string {
  return message.replace(/(?:^|\s)(?:(?:انا|أنا)\s+)?(?:اسمي|my name is)\s+[\p{L}]{2,20}\s*[،,.!؛:-]*\s*/iu, ' ').replace(/\s+/g, ' ').trim();
}
