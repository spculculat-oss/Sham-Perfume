/**
 * «صوت الزائر» — voluntary, anonymous suggestions and local topic analysis.
 *
 * Suggestions are stored only after an explicit submit + confirmation. We keep no visitor/account id, IP, user-agent,
 * name or contact field. Email addresses, long numbers and order references are redacted before storage; secrets are
 * refused. Topics are simple local keyword tags (not a psychological or emotion profile), and every change remains
 * for an administrator to review. Nothing is sent to an AI platform or used to change prices/offers automatically.
 */
import { carriesSecret, scrubText } from './visitorInsights';

export const VISITOR_SUGGESTION_RETENTION_DAYS = 180;
export const VISITOR_SUGGESTION_MAX_CHARS = 1200;

export const SUGGESTION_KINDS = ['idea', 'problem', 'praise'] as const;
export type SuggestionKind = typeof SUGGESTION_KINDS[number];

export const SUGGESTION_TOPICS = [
  'recommendations', 'catalog', 'navigation', 'pricing', 'delivery', 'support', 'language', 'other',
] as const;
export type SuggestionTopic = typeof SUGGESTION_TOPICS[number];

export const SUGGESTION_STATUSES = ['new', 'reviewed', 'planned', 'declined'] as const;
export type SuggestionStatus = typeof SUGGESTION_STATUSES[number];

export interface VisitorSuggestionInput {
  text: string;
  kind: SuggestionKind;
  language?: string;
}

/** Intentionally contains no visitor id, account id, address, contact details, or IP. */
export interface VisitorSuggestion extends VisitorSuggestionInput {
  id: string;
  topics: SuggestionTopic[];
  status: SuggestionStatus;
  createdAt: string;
  updatedAt: string;
}

export type VisitorSuggestionRead =
  | { ok: true; input: VisitorSuggestionInput; redacted: boolean }
  | { ok: false; reason: 'invalid' | 'secret' | 'personal' };

const LANGUAGE = /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/;
const ORDER_REF = /\bSH-[A-Z0-9-]{3,}\b/gi;
const PERSONAL_DETAIL = /\b(?:my name(?: is)?|my address(?: is)?|my phone(?: number)?(?: is)?|my e-?mail(?: is)?|contact me (?:at|on)|call me at)\b|(?:اسمي|عنواني|رقم(?: هاتفي| تليفوني| موبايلي)|بريدي(?: الإلكتروني)?|إيميلي|ايميلي|تليفوني|هاتفي|موبايلي)(?:\s*(?:هو|هي|[:：-]))?/i;
const normalize = (text: string) => text.toLowerCase()
  .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ة/g, 'ه')
  .replace(/ى/g, 'ي');

interface TopicRule { topic: Exclude<SuggestionTopic, 'other'>; patterns: RegExp[] }
const TOPIC_RULES: TopicRule[] = [
  { topic: 'recommendations', patterns: [/ترشيح|ترشيحات|اقتراح|مقترح|يعرض|اعرض|يناسب|ذوق|recommend|suggest|show me|similar/i] },
  { topic: 'catalog', patterns: [/منتج|منتجات|عطر|عطور|خامه|خامة|متجر|مخزون|product|perfume|fragrance|catalog|stock/i] },
  { topic: 'navigation', patterns: [/بحث|ابحث|تصفح|فلتر|واجهة|صفحه|صفحة|زر|صعب|بطئ|بطيء|search|browse|filter|page|button|navigation|usability/i] },
  { topic: 'pricing', patterns: [/سعر|اسعار|أسعار|غالي|ارخص|أرخص|ميزانيه|ميزانية|خصم|price|cost|expensive|cheaper|discount|budget/i] },
  { topic: 'delivery', patterns: [/شحن|توصيل|تسليم|جمارك|دفع|shipping|delivery|customs|payment|checkout/i] },
  { topic: 'support', patterns: [/دعم|مساعده|مساعدة|خدمه|خدمة|شكوى|موظف|تواصل|support|help|complaint|agent|contact/i] },
  { topic: 'language', patterns: [/لغه|لغة|ترجمه|ترجمة|عربي|انجليزي|arabic|english|language|translation|translate/i] },
];

/**
 * Validate one voluntary submission. A visitor must affirm the short notice in the form; no consent banner or
 * analytics profile is needed. Identifiers are never accepted by this schema.
 */
export function readVisitorSuggestion(raw: unknown): VisitorSuggestionRead {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'invalid' };
  const body = raw as Record<string, unknown>;
  if (body.agree !== true || typeof body.text !== 'string' || !SUGGESTION_KINDS.includes(body.kind as SuggestionKind)) {
    return { ok: false, reason: 'invalid' };
  }
  const original = body.text.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (original.length < 8 || original.length > VISITOR_SUGGESTION_MAX_CHARS) return { ok: false, reason: 'invalid' };
  if (carriesSecret(original)) return { ok: false, reason: 'secret' };
  if (PERSONAL_DETAIL.test(original)) return { ok: false, reason: 'personal' };
  const cleaned = scrubText(original, VISITOR_SUGGESTION_MAX_CHARS);
  if (!cleaned) return { ok: false, reason: 'invalid' };
  const text = cleaned.replace(ORDER_REF, '[رقم طلب]').trim();
  if (text.length < 8) return { ok: false, reason: 'invalid' };
  const language = typeof body.language === 'string' && LANGUAGE.test(body.language) ? body.language : undefined;
  return { ok: true, input: { text, kind: body.kind as SuggestionKind, ...(language ? { language } : {}) }, redacted: text !== original };
}

/** Local, explainable keyword tags — never labels the visitor or infers an emotional state. */
export function analyzeSuggestionTopics(text: string): SuggestionTopic[] {
  const normalized = normalize(text);
  const topics = TOPIC_RULES.filter((rule) => rule.patterns.some((pattern) => pattern.test(normalized))).map((rule) => rule.topic);
  return topics.length ? topics : ['other'];
}

export const SUGGESTION_KIND_TEXT: Record<SuggestionKind, { ar: string; en: string }> = {
  idea: { ar: 'اقتراح', en: 'Idea' },
  problem: { ar: 'مشكلة أو ملاحظة', en: 'Problem or note' },
  praise: { ar: 'شكر أو تقييم', en: 'Thanks or praise' },
};

export const SUGGESTION_TOPIC_TEXT: Record<SuggestionTopic, { ar: string; en: string }> = {
  recommendations: { ar: 'الترشيحات', en: 'Recommendations' },
  catalog: { ar: 'المتجر والمنتجات', en: 'Store and products' },
  navigation: { ar: 'التصفح والبحث', en: 'Navigation and search' },
  pricing: { ar: 'الأسعار', en: 'Pricing' },
  delivery: { ar: 'الشحن والدفع', en: 'Delivery and payment' },
  support: { ar: 'الدعم والتواصل', en: 'Support and contact' },
  language: { ar: 'اللغة والترجمة', en: 'Language and translation' },
  other: { ar: 'أخرى', en: 'Other' },
};

export const SUGGESTION_STATUS_TEXT: Record<SuggestionStatus, { ar: string; en: string }> = {
  new: { ar: 'جديد', en: 'New' },
  reviewed: { ar: 'تمت مراجعته', en: 'Reviewed' },
  planned: { ar: 'مخطط له', en: 'Planned' },
  declined: { ar: 'غير معتمد', en: 'Not approved' },
};

export interface VisitorSuggestionSummary {
  total: number;
  new: number;
  kinds: Record<SuggestionKind, number>;
  topics: Record<SuggestionTopic, number>;
}

export function summarizeVisitorSuggestions(items: VisitorSuggestion[]): VisitorSuggestionSummary {
  const kinds: Record<SuggestionKind, number> = { idea: 0, problem: 0, praise: 0 };
  const topics: Record<SuggestionTopic, number> = {
    recommendations: 0, catalog: 0, navigation: 0, pricing: 0, delivery: 0, support: 0, language: 0, other: 0,
  };
  for (const item of items) {
    kinds[item.kind] += 1;
    for (const topic of new Set(item.topics)) topics[topic] += 1;
  }
  return { total: items.length, new: items.filter((item) => item.status === 'new').length, kinds, topics };
}

export function suggestionExpired(item: VisitorSuggestion, now: Date): boolean {
  const created = Date.parse(item.createdAt);
  return !Number.isFinite(created) || now.getTime() - created >= VISITOR_SUGGESTION_RETENTION_DAYS * 86_400_000;
}

export const isSuggestionStatus = (value: unknown): value is SuggestionStatus =>
  typeof value === 'string' && SUGGESTION_STATUSES.includes(value as SuggestionStatus);
