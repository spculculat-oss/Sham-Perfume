/**
 * «شاهين بيذاكر لنفسه» — Shaheen's own study plan, built from what really happened in his conversations.
 *
 * No AI platform, no network: he reads his knowledge gaps (questions he could not answer, answers visitors
 * rated down), sorts them into fields, scores how well he masters each field, and orders what to learn next.
 * For each question he also looks in his own library for the closest thing he already knows, as a starting
 * point for the lesson. Nothing enters his knowledge by itself: the owner approves every lesson
 * (PATCH /api/admin/gaps/:id), which is the rule for anything Shaheen learns.
 */
import type { Conversation, KnowledgeDoc, KnowledgeGap } from './types';

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

/* ───────────────────────── «الهيكل المعلوماتي»: what he knows, field by field ───────────────────────── */

export type ShelfStrength = 'strong' | 'fair' | 'weak' | 'empty';
export interface KnowledgeShelf {
  field: StudyField;
  /** Lessons and documents he holds in this field. */
  lessons: number;
  /** Their size in words — ten one-line notes are not ten lessons. */
  words: number;
  /** Open questions of this field that visitors are waiting on. */
  waiting: number;
  mastery: number | null;
  strength: ShelfStrength;
}
const wordsOf = (text: string) => (text.trim() ? text.trim().split(/\s+/u).length : 0);
/** A document's field: its title and tags say it best; the opening of its text is the fallback. */
export function docField(doc: Pick<KnowledgeDoc, 'title' | 'tags' | 'content'>): StudyField {
  const named = studyField(`${doc.title} ${doc.tags.join(' ')}`);
  return named !== 'general' ? named : studyField(doc.content.slice(0, 400));
}
export function shelfStrength(shelf: Pick<KnowledgeShelf, 'lessons' | 'words' | 'waiting' | 'mastery'>): ShelfStrength {
  if (!shelf.lessons) return 'empty';
  if (shelf.lessons < 3 || shelf.words < 300 || shelf.waiting >= 5 || (shelf.mastery !== null && shelf.mastery < 40)) return 'weak';
  if (shelf.lessons >= 8 && shelf.words >= 1500 && (shelf.mastery === null || shelf.mastery >= 70)) return 'strong';
  return 'fair';
}
/** Every field appears, even an empty one: an empty shelf is the first thing the owner should see. */
export function knowledgeMap(docs: readonly Pick<KnowledgeDoc, 'title' | 'tags' | 'content'>[], fields: readonly FieldScore[] = []): KnowledgeShelf[] {
  const shelves = new Map<StudyField, KnowledgeShelf>(STUDY_FIELDS.map((field) => {
    const score = fields.find((f) => f.field === field);
    return [field, { field, lessons: 0, words: 0, waiting: score?.waiting || 0, mastery: score?.mastery ?? null, strength: 'empty' as ShelfStrength }];
  }));
  for (const doc of docs) {
    const shelf = shelves.get(docField(doc))!;
    shelf.lessons += 1; shelf.words += wordsOf(doc.content);
  }
  const order: Record<ShelfStrength, number> = { empty: 0, weak: 1, fair: 2, strong: 3 };
  return [...shelves.values()].map((shelf) => ({ ...shelf, strength: shelfStrength(shelf) }))
    .sort((a, b) => order[a.strength] - order[b.strength] || b.waiting - a.waiting || a.field.localeCompare(b.field));
}

/* ───────────────────────── «تحليل الأداء»: what the conversations themselves say ───────────────────────── */

export interface ChatReport {
  conversations: number; last7: number;
  /** Visitor questions in all conversations, and the average per conversation. */
  questions: number; avgQuestions: number;
  /** Where visitors leave: after how many of their own questions the conversation ended. */
  leave: { afterOne: number; afterFew: number; afterMany: number };
  /** Share (0-100) of conversations that ended after a single question. */
  oneQuestionShare: number | null;
  /** Conversations that ended right after a question Shaheen could not answer. */
  leftUnanswered: number;
  ratings: { up: number; down: number; satisfaction: number | null };
  /** What people ask about, largest first. */
  byField: { field: StudyField; questions: number; share: number }[];
  /** Opening questions asked by more than one visitor. */
  topQuestions: { question: string; count: number }[];
}
const questionKey = (text: string) => plain(text).replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
export function chatReport(conversations: readonly Conversation[], gaps: readonly KnowledgeGap[] = [], { now = Date.now(), top = 8 }: { now?: number; top?: number } = {}): ChatReport {
  const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : null);
  const unanswered = new Map<string, number>();
  for (const gap of gaps) if (gap.source === 'no_answer' && gap.conversationId) unanswered.set(gap.conversationId, Date.parse(gap.lastAt) || 0);
  const leave = { afterOne: 0, afterFew: 0, afterMany: 0 };
  const fields = new Map<StudyField, number>();
  const openers = new Map<string, { question: string; count: number }>();
  let total = 0; let last7 = 0; let questions = 0; let leftUnanswered = 0; let up = 0; let down = 0;
  for (const conversation of conversations) {
    const asked = conversation.messages.filter((m) => m.role === 'user' && m.text.trim());
    if (!asked.length) continue; // opened and closed without a word: not a conversation
    total += 1;
    if (now - Date.parse(conversation.updatedAt || conversation.startedAt) <= 7 * DAY) last7 += 1;
    questions += asked.length;
    if (asked.length === 1) leave.afterOne += 1; else if (asked.length <= 3) leave.afterFew += 1; else leave.afterMany += 1;
    for (const m of asked) { const field = studyField(m.text); fields.set(field, (fields.get(field) || 0) + 1); }
    for (const m of conversation.messages) { if (m.feedback?.rating === 'up') up += 1; else if (m.feedback?.rating === 'down') down += 1; }
    const gapAt = unanswered.get(conversation.id);
    // He did not know, and the visitor never wrote again (a few seconds of slack for the clocks).
    if (gapAt !== undefined && (Date.parse(asked[asked.length - 1]!.at) || 0) <= gapAt + 5000) leftUnanswered += 1;
    const key = questionKey(asked[0]!.text);
    if (key.length >= 6) { const seen = openers.get(key); if (seen) seen.count += 1; else openers.set(key, { question: asked[0]!.text.trim().slice(0, 140), count: 1 }); }
  }
  return {
    conversations: total, last7, questions, avgQuestions: total ? Math.round((questions / total) * 10) / 10 : 0,
    leave, oneQuestionShare: pct(leave.afterOne, total), leftUnanswered,
    ratings: { up, down, satisfaction: pct(up, up + down) },
    byField: [...fields.entries()].map(([field, n]) => ({ field, questions: n, share: pct(n, questions) || 0 })).sort((a, b) => b.questions - a.questions || a.field.localeCompare(b.field)),
    topQuestions: [...openers.values()].filter((q) => q.count >= 2).sort((a, b) => b.count - a.count || a.question.localeCompare(b.question)).slice(0, Math.max(1, top)),
  };
}
