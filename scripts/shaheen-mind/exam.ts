/**
 * «الممتحن» — the examiner: marks the mind on questions whose answers are already written down.
 *
 * It grades **no style and no eloquence**: a question is correct when the answer carries the recorded fact (the
 * number, the carrier's name, the rule) *and* comes from a real source — not from a gap («محتاج مذاكرة»). So the
 * score measures the mind, not the model.
 *
 * The output has one number the merchant can watch move: **درجة الذكاء (IQ)** = correct ÷ asked, per specialist and
 * overall, with the misses named so the tutor writes the next plan from them.
 *
 * Pure: the questions, the attempts and the specialists are parameters (`tests/shaheenMindLoop.test.ts`).
 */
import type { PracticeQuestion } from './tutor';

export interface ExamAttempt {
  id: string;
  /** The answer the agent actually gave. */
  answer: string;
  /** The source it declared («knowledge», «academy», «gap»…). */
  source: string;
  /** Whether it reached a tool or a lesson at all (a gap is a miss by definition). */
  answered: boolean;
}

export interface SpecialistScore {
  id: string;
  nameAr: string;
  asked: number;
  correct: number;
  percent: number;
  /** The first question it missed, in plain Arabic — the next study target. */
  missedAr: string | null;
}

export interface ExamReport {
  version: 1;
  agent: 'examiner';
  updatedAt: string;
  /** 0–100: the share of recorded facts the mind can answer for, offline, with a source. */
  iq: number;
  asked: number;
  correct: number;
  fromGap: number;
  bySpecialist: SpecialistScore[];
  misses: { id: string; question: string; expected: string[]; got: string; source: string; whyAr: string }[];
  summaryAr: string;
  planAr: string[];
}

const norm = (t: string) => String(t || '').toLowerCase()
  .replace(/[\u064B-\u0652\u0670]/g, '')
  .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
  .replace(/\s+/g, ' ')
  .trim();

/** Correct when every expected token is present (a number, a name, a rule) and the answer is not a gap. */
export function gradeQuestion(question: PracticeQuestion, attempt: ExamAttempt): { ok: boolean; whyAr: string } {
  if (!attempt.answered || attempt.source === 'gap') {
    return { ok: false, whyAr: 'مفيش إجابة من مصدر — السؤال اتسجل فجوة' };
  }
  const answer = norm(attempt.answer);
  const missing = question.expected.filter((want) => {
    const w = norm(want);
    if (!w) return true;
    // Numbers are compared as numbers so «1876» and «1,876» and «1876.4» all match.
    const asNumber = Number(w);
    if (Number.isFinite(asNumber) && w.match(/^\d+(\.\d+)?$/)) {
      const decimals = Math.abs(asNumber) < 10 ? 1 : 0;
      return !new RegExp(`(^|[^\\d.])${asNumber.toFixed(decimals).replace('.', '\\.')}`).test(answer);
    }
    return !answer.includes(w);
  });
  if (missing.length) return { ok: false, whyAr: `الإجابة مش فيها: ${missing.join('، ')}` };
  return { ok: true, whyAr: 'الإجابة فيها الرقم/الاسم الموثّق' };
}

export function scoreExam(input: {
  now: number;
  questions: PracticeQuestion[];
  attempts: ExamAttempt[];
  specialists: { id: string; nameAr: string }[];
}): ExamReport {
  const byId = new Map(input.attempts.map((a) => [a.id, a]));
  const misses: ExamReport['misses'] = [];
  const perSpecialist = new Map<string, { asked: number; correct: number; missed: string | null }>();

  for (const q of input.questions) {
    const attempt = byId.get(q.id) || { id: q.id, answer: '', source: 'gap', answered: false };
    const verdict = gradeQuestion(q, attempt);
    const row = perSpecialist.get(q.specialistId) || { asked: 0, correct: 0, missed: null };
    row.asked += 1;
    if (verdict.ok) row.correct += 1;
    else {
      row.missed = row.missed || q.question;
      misses.push({ id: q.id, question: q.question, expected: q.expected, got: String(attempt.answer || '').slice(0, 300), source: attempt.source, whyAr: verdict.whyAr });
    }
    perSpecialist.set(q.specialistId, row);
  }

  const asked = input.questions.length;
  const correct = asked - misses.length;
  const fromGap = input.attempts.filter((a) => a.source === 'gap').length;
  const bySpecialist: SpecialistScore[] = [...perSpecialist.entries()]
    .map(([id, r]) => ({
      id, nameAr: input.specialists.find((s) => s.id === id)?.nameAr || id,
      asked: r.asked, correct: r.correct,
      percent: r.asked ? Math.round((r.correct / r.asked) * 100) : 0,
      missedAr: r.missed,
    }))
    .sort((a, b) => b.asked - a.asked || a.id.localeCompare(b.id));

  const iq = asked ? Math.round((correct / asked) * 100) : 0;
  const weakest = [...bySpecialist].sort((a, b) => a.percent - b.percent)[0];
  const planAr = [
    ...(misses.length
      ? [`${asked - misses.length} سؤال من ${asked} اتجاوب بمصدره صح، و${misses.length} ناقص — أهمه: «${misses[0].question}» (${misses[0].whyAr}).`]
      : [`${asked} سؤال من ${asked}: العقل جاوب على كل حاجة موثّقة بمصدرها.`]),
    ...(weakest && misses.length ? [`أضعف متخصص في الامتحان: ${weakest.nameAr} (${weakest.percent}%) — المعلم بياخد اللي فاته.`] : []),
    ...(fromGap ? [`${fromGap} سؤال ردّه كان «محتاج مذاكرة» — دي أول حاجة تذاكر.`] : []),
  ];

  return {
    version: 1, agent: 'examiner', updatedAt: new Date(input.now).toISOString(),
    iq, asked, correct, fromGap, bySpecialist, misses, summaryAr: `الممتحن: درجة الذكاء ${iq}/100 (${correct}/${asked} بإجابة موثّقة، ومنها ${fromGap} فجوة)`,
    planAr,
  };
}

export const isExamReport = (v: unknown): v is ExamReport => {
  const r = v as ExamReport | undefined;
  return Boolean(r && r.version === 1 && r.agent === 'examiner' && typeof r.updatedAt === 'string'
    && typeof r.iq === 'number' && Array.isArray(r.misses) && Array.isArray(r.bySpecialist));
};
