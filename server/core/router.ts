/**
 * Intent router — a lightweight "mixture of experts" gate: every message is scored against
 * system intents and against each enabled service's keywords, and the best expert handles it.
 * Deterministic, explainable (scores go to the admin trace) and free to run.
 */
import { normalize, tokenize } from './text';
import type { ServiceDef } from './types';

export type Intent =
  | 'greeting' | 'thanks' | 'list_services' | 'track_order' | 'browse_products'
  | 'service_request' | 'handoff' | 'calculate' | 'perfume_expert' | 'question'
  | 'memory_view' | 'forget';

export interface RouteResult {
  intent: Intent;
  serviceId?: string;
  confidence: number;
  scores: Record<string, number>;
  entities: { ref?: string; phone?: string; email?: string; volumeMl?: number; percent?: number; name?: string };
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
const THANKS = ['شكرا', 'متشكر', 'تسلم', 'جزاك الله', 'thanks', 'thank you', 'thx'];
const SERVICES_LIST = ['خدمات', 'خدماتكم', 'بتقدموا ايه', 'تقدمون', 'تعمل ايه', 'تقدر تعمل', 'services', 'what can you do', 'what do you offer'];
const TRACK = ['تتبع', 'حاله الطلب', 'حالة طلبي', 'طلبي فين', 'فين طلب', 'فين الطلب', 'وصل فين', 'رقم الطلب', 'موصلش', 'مجاش', 'ماوصل', 'لم يصل', 'track', 'order status', 'where is my order'];
const HANDOFF = ['موظف', 'شخص حقيقي', 'انسان', 'بشري', 'خدمه العملاء', 'اكلم حد', 'كلم حد', 'human', 'real person', 'agent', 'representative'];
const ORDER_VERBS = ['اطلب', 'طلب', 'احجز', 'حجز', 'اشتري', 'سجل', 'قدم', 'ابعت عرض', 'عرض سعر', 'عايز', 'عاوز', 'محتاج', 'اريد', 'ابغي', 'اسوي',
  'order', 'request', 'book', 'quote', 'apply', 'purchase', 'i want', 'i need', 'i would like', 'looking for'];
const FORGET = ['امسح بياناتي', 'احذف بياناتي', 'امسح ذاكرتك', 'انسي كل', 'انساني', 'امسح محادثاتي', 'احذف محادثاتي', 'delete my data', 'forget me', 'erase my data', 'delete my conversations'];
const MEMORY = ['ماذا تتذكر', 'بتفتكر ايه', 'فاكر ايه', 'تعرف ايه عني', 'تعرف عني', 'ماذا تعرف عني', 'ايه اللي تعرفه عني', 'بياناتي', 'what do you remember', 'what do you know about me', 'my data'];
const BROWSE = ['منتجات', 'المنتجات', 'كتالوج', 'متوفر', 'متاح', 'سعر', 'اسعار', 'بكام', 'عندكم', 'products', 'catalog', 'price', 'available', 'in stock'];
const EXPERT = ['نوته', 'نوتات', 'تركيبه عطر', 'مكونات', 'فواحه', 'ثبات', 'فوحان', 'مسك', 'عنبر', 'عود', 'فانيليا', 'accord', 'notes', 'longevity', 'sillage', 'formula'];

export function extractEntities(message: string): RouteResult['entities'] {
  const latin = message.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const entities: RouteResult['entities'] = {};
  const ref = latin.toUpperCase().match(/\bSH-?([A-Z0-9]{6})\b/);
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
  const result = (intent: Intent, confidence: number, serviceId?: string): RouteResult => ({ intent, confidence, serviceId, scores, entities });

  if (has(text, FORGET)) return result('forget', 0.9);
  if (has(text, MEMORY)) return result('memory_view', 0.85);
  if (entities.ref || has(text, TRACK)) return result('track_order', entities.ref ? 0.95 : 0.8);
  if (has(text, HANDOFF)) return result('handoff', 0.9, services.find((s) => s.kind === 'support')?.id);
  if (entities.volumeMl && entities.percent) return result('calculate', 0.85, services.find((s) => s.kind === 'info')?.id);

  if (bestService) {
    const browse = bestService.kind === 'store' && has(text, BROWSE) && !wantsAction;
    if (browse) return result('browse_products', 0.75, bestService.id);
    if (bestService.kind !== 'info' && (wantsAction || best[1] >= 2)) return result('service_request', Math.min(0.95, 0.55 + best[1] * 0.1), bestService.id);
  }
  // "ايه الخدمات اللي عندكم" asks for the menu, not for stock — check it before the generic availability cue.
  if (has(text, SERVICES_LIST)) return result('list_services', 0.8);
  if (has(text, BROWSE) && services.some((s) => s.kind === 'store')) return result('browse_products', 0.6, services.find((s) => s.kind === 'store')!.id);
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
