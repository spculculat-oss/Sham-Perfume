/**
 * «المؤرشف» — curator: maintains the knowledge cards, each one a verified answer with its source and date.
 *
 * It reads the study plan, the exam misses, the reflex answers and the senses reports, and turns every
 * verified answer into a knowledge card: what we know, where it comes from, when it was checked, and whether
 * it is still fresh. A card whose source is older than its date becomes "needs review" — never presented as
 * certain when it may have changed.
 *
 * Output: src/data/live/curate.json
 */
import { readFileSync } from 'node:fs';

export interface KnowledgeCard {
  id: string;
  topic: string;
  answerAr: string;
  source: string;
  checkedAt: string;
  refreshAfterDays: number;
  stale: boolean;
  confidence: 'high' | 'medium' | 'low';
  usedBy: string[];
}

export interface CurateReport {
  version: 1;
  agent: 'curator';
  updatedAt: string;
  score: number;
  counts: { cards: number; fresh: number; needsReview: number; lowConfidence: number };
  cards: KnowledgeCard[];
  summaryAr: string;
  planAr: string[];
}

const DAY = 86_400_000;

export interface CurateInput {
  now: number;
  studyTargets: { labelAr: string; whyAr: string; priority: number; source?: string | null }[];
  examMisses: { question: string; expected: string[]; whyAr: string; source: string }[];
  reflexEntries: { question: string; answerAr: string; source: string; updatedAt?: string | null }[];
  senses: { shippingZoneFallback: number; customsVatMissing: number; fxStale: boolean };
}

const card = (id: string, topic: string, answerAr: string, source: string, checkedAt: string,
  refreshAfterDays: number, confidence: 'high' | 'medium' | 'low', usedBy: string[]): KnowledgeCard => ({
  id, topic, answerAr, source, checkedAt,
  refreshAfterDays, stale: ageDays(checkedAt, refreshAfterDays),
  confidence, usedBy,
});

function ageDays(at: string | null | undefined, refreshAfterDays: number): boolean {
  if (!at) return true;
  const t = Date.parse(at);
  return !Number.isFinite(t) || (Date.now() - t) / DAY > refreshAfterDays;
}

/** Pull a short verified answer from an exam miss's expected answers. */
function bestAnswer(expected: string[]): string {
  return expected.length ? expected[0].slice(0, 200) : 'الإجابة موثّقة في ملفات الموقع.';
}

export function buildCurate(input: CurateInput): CurateReport {
  const { now } = input;
  const cards: KnowledgeCard[] = [];

  // From study targets: each weak link becomes a card once it has a documented source.
  for (const t of input.studyTargets) {
    if (t.source) {
      cards.push(card(`study-${t.labelAr.slice(0, 20)}`, t.labelAr, t.whyAr, t.source, new Date(now).toISOString(),
        30, 'medium', ['المعلم', 'الممتحن']));
    }
  }

  // From exam misses: each miss with a source becomes a card.
  for (const m of input.examMisses) {
    cards.push(card(`exam-${m.question.slice(0, 20)}`, m.question, bestAnswer(m.expected), m.source, new Date(now).toISOString(),
        14, 'high', ['الممتحن', 'المعلم', 'الآذان']));
  }

  // From reflex entries: each instant answer becomes a card.
  for (const r of input.reflexEntries) {
    cards.push(card(`reflex-${r.question.slice(0, 20)}`, r.question, r.answerAr, r.source, r.updatedAt || new Date(now).toISOString(),
        7, 'high', ['الانعكاس', 'الشات']));
  }

  // Sense-derived cards for gaps that must stay "not available".
  if (input.senses.shippingZoneFallback) {
    cards.push(card('sense-shipping-zone', 'الشحن التقديري (منطقة)',
      'السعر تقدير من جدول المناطق pending شركة منشورة — بيتأكد قبل الدفع.',
      'src/data/shipping.json', new Date(now).toISOString(), 7, 'medium', ['الانعكاس', 'التجارة الدولية']));
  }
  if (input.senses.customsVatMissing) {
    cards.push(card('sense-customs-vat', 'الضريبة الجمركية',
      'النسبة من غير مصدر مؤكد — لا تُعرض للزائر ولا في أي وعد.',
      'src/data/customs.json', new Date(now).toISOString(), 30, 'low', ['التجارة الدولية', 'المعلم']));
  }
  if (input.senses.fxStale) {
    cards.push(card('sense-fx', 'سعر الصرف',
      'جدول أسعار الصرف قديم — الأسعار المعروضة والمخصومة قد تكون قديمة.',
      'src/data/live/fx-rates.json', new Date(now).toISOString(), 1, 'low', ['حسّاسات الموقع', 'المحاسب']));
  }

  const fresh = cards.filter((c) => !c.stale).length;
  const needsReview = cards.filter((c) => c.stale).length;
  const lowConfidence = cards.filter((c) => c.confidence === 'low').length;
  const score = Math.max(0, Math.min(100, 100 - needsReview * 4 - lowConfidence * 3));

  return {
    version: 1, agent: 'curator', updatedAt: new Date(now).toISOString(),
    score, counts: { cards: cards.length, fresh, needsReview, lowConfidence }, cards,
    summaryAr: `المؤرشف: ${cards.length} بطاقة معرفة،${fresh} طازجة${needsReview ? `، ${needsReview} تحتاج مراجعة` : ''}${lowConfidence ? `، ${lowConfidence} ثقة منخفضة` : ''} · النتيجة ${score}/100`,
    planAr: [
      ...cards.filter((c) => c.stale).slice(0, 6).map((c) => `بطاقة "${c.topic}" تاريخها قديم — راجع المصدر ${c.source}`),
      ...cards.filter((c) => c.confidence === 'low').slice(0, 4).map((c) => `بطاقة "${c.topic}" ثقة منخفضة — ${c.answerAr}`),
      ...(needsReview || lowConfidence ? [] : ['كل بطاقات المعرفة محدثة بمصدرها وتاريخها.']),
    ],
  };
}

export const isCurateReport = (v: unknown): v is CurateReport => {
  const r = v as CurateReport | undefined;
  return Boolean(r && r.version === 1 && r.agent === 'curator' && typeof r.score === 'number' && Array.isArray(r.cards));
};
