/**
 * «الآذان» — the ears: what the platform is actually asked, and what it still cannot answer.
 *
 * It reads the questions that really exist in the site's own files — Shaheen's memory (every question that was
 * answered and kept) and the school's pending list (questions that were asked and not answered) — and turns them
 * into a ranked picture per specialist:
 *   · أكثر اللي بيتسأل (so the mind keeps its strongest answers ready),
 *   · اللي اتسأل ومحدش رد عليه (so the school studies it),
 *   · واللي بيتكرر ومفيش له درس (so the tutor writes it).
 *
 * **No personal data:** only the question text is read; anything with a phone/email/card/ID shape is dropped before
 * it reaches the report, and the report never carries an id or a conversation.
 *
 * Pure: the entries are parameters (`tests/shaheenMindLoop.test.ts`).
 */
import { hasSensitiveNumber } from '../../src/utils/ownerAuthority';

export interface EarsEntry {
  question: string;
  /** How many times the same question (by meaning) was seen. */
  count: number;
  lang: 'ar' | 'en';
  /** `answered` = the mind has a kept answer; `pending` = it was asked and left unanswered. */
  state: 'answered' | 'pending';
}

export interface TopicDemand {
  specialistId: string;
  specialistNameAr: string;
  asked: number;
  pending: number;
  /** The three most asked questions in his field, newest question first. */
  top: string[];
}

export interface EarsReport {
  version: 1;
  agent: 'ears';
  updatedAt: string;
  total: number;
  answered: number;
  pending: number;
  /** Questions dropped for privacy — counted, never quoted. */
  dropped: number;
  bySpecialist: TopicDemand[];
  /** What the platform is asked about and has no written lesson for yet. */
  unmetAr: string[];
  summaryAr: string;
  planAr: string[];
}

const norm = (t: string) => String(t || '').toLowerCase()
  .replace(/[\u064B-\u0652\u0670]/g, '')
  .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

export function collectEars(input: {
  now: number;
  entries: EarsEntry[];
  /** `pick(question)` returns the specialist id the platform would route the question to. */
  pick: (question: string) => string;
  specialists: { id: string; nameAr: string }[];
  /** Questions that already have a written lesson (normalised), so «unmet» is honest. */
  lessonQuestions?: string[];
  limit?: number;
}): EarsReport {
  const limit = Math.max(10, Number(input.limit) || 200);
  const kept: EarsEntry[] = [];
  let dropped = 0;
  for (const e of input.entries) {
    const question = String(e.question || '').trim();
    if (!question || question.length < 8) continue;
    // بيانات شخصية: الرقم/الإيميل بيتشال قبل أي تقرير — وبيتعد بس.
    if (hasSensitiveNumber(question) || /@|(\+?\d[\d\s-]{8,})/.test(question)) { dropped += 1; continue; }
    kept.push({ ...e, question });
    if (kept.length >= limit) break;
  }

  const taught = new Set((input.lessonQuestions || []).map(norm));
  const buckets = new Map<string, TopicDemand>();
  for (const e of kept) {
    const id = input.pick(e.question) || 'specialist_business';
    const row = buckets.get(id) || {
      specialistId: id,
      specialistNameAr: input.specialists.find((s) => s.id === id)?.nameAr || id,
      asked: 0, pending: 0, top: [],
    };
    row.asked += 1;
    if (e.state === 'pending') row.pending += 1;
    if (row.top.length < 3 && !row.top.some((q) => norm(q) === norm(e.question))) row.top.push(e.question);
    buckets.set(id, row);
  }

  const bySpecialist = [...buckets.values()].sort((a, b) => b.asked - a.asked || a.specialistId.localeCompare(b.specialistId));
  const answered = kept.filter((e) => e.state === 'answered').length;
  const pending = kept.length - answered;

  // «مفيش له درس»: سؤال اتسأل فعلاً ونصّه مش موجود في أي سؤال درس.
  const unmetAr = kept
    .filter((e) => ![...taught].some((t) => t && t.length > 8 && (norm(e.question).includes(t) || t.includes(norm(e.question)))))
    .slice(0, 10)
    .map((e) => e.question);

  const top = bySpecialist[0];
  return {
    version: 1, agent: 'ears', updatedAt: new Date(input.now).toISOString(),
    total: kept.length, answered, pending, dropped, bySpecialist, unmetAr,
    summaryAr: `الآذان: ${kept.length} سؤال حقيقي اتقرا (${answered} اتجاوب و${pending} لسه) · ${dropped} اتشال للخصوصية · أعلى طلب عند ${top ? top.specialistNameAr : '—'}`,
    planAr: [
      ...(pending ? [`${pending} سؤال حقيقي محدش رد عليه — المعلم والمدرسة بياخدوهم أول حاجة.`] : []),
      ...(unmetAr.length ? [`${unmetAr.length} سؤال بيتكرر ومفيش له درس مكتوب — مثال: «${unmetAr[0].slice(0, 90)}».`] : []),
      ...(top ? [`أكتر طلب عند ${top.specialistNameAr} (${top.asked} سؤال) — إجاباته الجاهزة بتفضل محدّثة.`] : []),
    ],
  };
}

export const isEarsReport = (v: unknown): v is EarsReport => {
  const r = v as EarsReport | undefined;
  return Boolean(r && r.version === 1 && r.agent === 'ears' && typeof r.updatedAt === 'string'
    && Array.isArray(r.bySpecialist) && typeof r.total === 'number');
};
