/**
 * «شاهين بيذاكر لنفسه» — Shaheen's own study plan, built from what really happened in his conversations.
 *
 * No AI platform, no network: he reads his knowledge gaps (questions he could not answer, answers visitors
 * rated down), sorts them into fields, scores how well he masters each field, and orders what to learn next.
 * For each question he also looks in his own library for the closest thing he already knows, as a starting
 * point for the lesson. Nothing enters his knowledge by itself: the owner approves every lesson
 * (PATCH /api/admin/gaps/:id), which is the rule for anything Shaheen learns.
 */
import type { KnowledgeGap } from './types';

export const STUDY_FIELDS = ['perfume', 'store', 'media', 'design', 'marketing', 'code', 'writing', 'science', 'health', 'religion', 'general'] as const;
export type StudyField = (typeof STUDY_FIELDS)[number];

const plain = (text: string) => text.normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase();

/** First match wins, so the order runs from the most specific field to the most general. */
const FIELD_WORDS: [StudyField, RegExp][] = [
  ['store', /طلب|اوردر|شحن|توصيل|دفع|فاتوره|استرجاع|استبدال|خصم|كوبون|مخزون|متوفر|\border\b|shipping|delivery|refund|payment|coupon|in stock/],
  ['perfume', /عطر|عطور|برفان|عود|مسك|عنبر|نوت[ةه]|تركيب[ةه]|فوحان|ثبات|تركيز|زيت عطري|مثبت|بخور|perfume|fragrance|scent|\boud\b|musk|amber|cologne|\bedp\b|\bedt\b|sillage|accord/],
  ['media', /فيديو|مونتاج|اخراج|تصوير|كاميرا|لقط[ةه]|مشهد|سيناريو|ريلز|بودكاست|صوت|موسيقي|video|montage|directing|filming|camera|storyboard|reel|podcast|audio/],
  ['design', /تصميم|جرافيك|لوجو|شعار|بانر|الوان|خط |خطوط|هويه بصريه|فوتوشوب|رسم|صوره|design|graphic|logo|banner|typography|palette|photoshop|illustrat|branding/],
  ['marketing', /تسويق|اعلان|حمله|مبيعات|عملاء|زباين|سوشيال|متابعين|ترويج|براند|marketing|\bads?\b|campaign|sales|customers|followers|\bseo\b|brand/],
  ['code', /كود|برمج|موقع|تطبيق|بايثون|جافا|قاعده بيانات|سيرفر|\bapi\b|html|css|javascript|python|\bsql\b|\bcode\b|program|website|\bapp\b|server|database/],
  ['writing', /اكتب|صياغه|ترجم|لخص|مقال|ايميل|رساله|قصه|شعر|نحو|لغه|write|translate|summar|essay|email|story|poem|grammar/],
  ['health', /صحه|مرض|علاج|دواء|حساسيه|بشره|طبيب|دكتور|حمل|health|disease|treatment|medicine|allerg|skin|doctor/],
  ['religion', /دين|اسلام|قران|حديث|صلاه|صوم|زكاه|حلال|حرام|فتوي|religion|islam|quran|prayer|fasting|halal/],
  ['science', /علم|فيزياء|كيمياء|احياء|رياضيات|معادله|فضاء|ذره|طاقه|تاريخ|جغرافيا|science|physics|chemistry|biology|math|equation|space|history|geography/],
];
export function studyField(question: string): StudyField {
  const q = plain(question);
  return FIELD_WORDS.find(([, words]) => words.test(q))?.[0] || 'general';
}

export interface StudyHint { docId: string; title: string; excerpt: string; score: number }
export interface StudyItem {
  id: string; question: string; field: StudyField; count: number; source: KnowledgeGap['source'];
  /** Higher = learn sooner: how often it was asked, whether a visitor was let down, and how recent it is. */
  priority: number; lastAt: string;
  /** The closest thing already in Shaheen's own library — a starting point, not an answer. */
  hint?: StudyHint;
}
export interface FieldScore {
  field: StudyField; open: number; resolved: number; ignored: number;
  /** How many times visitors asked the questions still open in this field. */
  waiting: number;
  /** Share of this field's real questions that Shaheen has learned (null until there is something to measure). */
  mastery: number | null;
}
export interface SelfStudy {
  generatedAt: string;
  totals: { open: number; resolved: number; ignored: number; mastery: number | null };
  /** New questions he could not answer: the last seven days against the seven before. */
  trend: { last7: number; prev7: number; direction: 'better' | 'worse' | 'same' };
  fields: FieldScore[];
  /** The field to study first (most visitors waiting), or null when nothing is open. */
  focus: StudyField | null;
  plan: StudyItem[];
}

const DAY = 86_400_000;
export function studyPriority(gap: Pick<KnowledgeGap, 'count' | 'source' | 'lastAt'>, now: number): number {
  const age = Math.max(0, now - Date.parse(gap.lastAt || '') || 0);
  const fresh = age <= 7 * DAY ? 2 : age <= 30 * DAY ? 1.3 : 1;
  return Math.round(Math.max(1, gap.count) * (gap.source === 'negative_feedback' ? 2 : 1) * fresh * 10) / 10;
}

export function buildSelfStudy(gaps: readonly KnowledgeGap[], { now = Date.now(), limit = 12, hint }: {
  now?: number; limit?: number; hint?: (question: string) => StudyHint | undefined;
} = {}): SelfStudy {
  const share = (resolved: number, open: number) => (resolved + open ? Math.round((resolved / (resolved + open)) * 100) : null);
  const fields = new Map<StudyField, FieldScore>();
  const totals = { open: 0, resolved: 0, ignored: 0 };
  let last7 = 0; let prev7 = 0;
  for (const gap of gaps) {
    const field = studyField(gap.question);
    const row = fields.get(field) || { field, open: 0, resolved: 0, ignored: 0, waiting: 0, mastery: null };
    row[gap.status] += 1; totals[gap.status] += 1;
    if (gap.status === 'open') row.waiting += Math.max(1, gap.count);
    fields.set(field, row);
    const born = now - Date.parse(gap.firstAt || gap.lastAt || '');
    if (born >= 0 && born <= 7 * DAY) last7 += 1; else if (born > 7 * DAY && born <= 14 * DAY) prev7 += 1;
  }
  const scored = [...fields.values()].map((f) => ({ ...f, mastery: share(f.resolved, f.open) }))
    .sort((a, b) => b.waiting - a.waiting || b.open - a.open || a.field.localeCompare(b.field));
  const plan = gaps.filter((g) => g.status === 'open' && g.question.trim())
    .map((g): StudyItem => ({ id: g.id, question: g.question, field: studyField(g.question), count: g.count, source: g.source, priority: studyPriority(g, now), lastAt: g.lastAt }))
    .sort((a, b) => b.priority - a.priority || b.lastAt.localeCompare(a.lastAt) || a.id.localeCompare(b.id))
    .slice(0, Math.max(1, limit))
    .map((item) => { const found = hint?.(item.question); return found ? { ...item, hint: found } : item; });
  return {
    generatedAt: new Date(now).toISOString(),
    totals: { ...totals, mastery: share(totals.resolved, totals.open) },
    trend: { last7, prev7, direction: last7 < prev7 ? 'better' : last7 > prev7 ? 'worse' : 'same' },
    fields: scored,
    focus: scored.find((f) => f.open > 0)?.field || null,
    plan,
  };
}

/** A hint is only worth showing when the library really talks about the question. */
export const HINT_MIN_SCORE = 2;
export function hintFrom(results: readonly { doc: { id: string; title: string; text: string; kind: string }; score: number }[]): StudyHint | undefined {
  const best = results.find((r) => r.doc.kind === 'knowledge' && r.score >= HINT_MIN_SCORE);
  if (!best) return undefined;
  const text = best.doc.text.replace(/\s+/g, ' ').trim();
  return { docId: best.doc.id, title: best.doc.title, excerpt: text.length > 320 ? `${text.slice(0, 320).replace(/\s+\S*$/, '')}…` : text, score: Math.round(best.score * 10) / 10 };
}
