/**
 * «علوم الأرض عند شاهين» — the science track of his school.
 *
 * The lessons live in src/data/sciences/ (written by the team, reviewed, safe by construction). Shaheen studies
 * them himself, with no AI service: every lesson becomes a ready answer in his memory under the question and
 * two usual wordings, so the site can answer it when no engine is reachable — in the visitor's browser too.
 * The track has its own exam and its own report (src/data/live/shaheen-sciences.json); it never changes the
 * perfume reliance score, which measures a different job.
 */
import { SCIENCE_LESSONS, SCIENCE_POLICY_AR, SCIENCE_TRACKS, type ScienceLesson, type ScienceTrackId } from '../../src/data/sciences';
import { normalizeQuestion, recallSimilar, remember, type MemoryFile } from '../../src/utils/shaheenMemory';
import type { BankQuestion, TrainingDoc } from './school';

export interface SciencesTrackReport {
  id: ScienceTrackId;
  titleAr: string;
  titleEn: string;
  covered: number;
  total: number;
  score: number;
}

export interface SciencesFile {
  version: 1;
  updatedAt: string;
  policyAr: string;
  learned: number;
  total: number;
  score: number;
  tracks: SciencesTrackReport[];
  lastLearned: { q: string; at: string }[];
}

export const isSciencesFile = (data: unknown): data is SciencesFile => {
  const d = data as SciencesFile | undefined;
  return Boolean(d && d.version === 1 && typeof d.updatedAt === 'string' && Array.isArray(d.tracks) && Array.isArray(d.lastLearned));
};

/** The lessons as training documents: the same shape his library uses, so the local teacher can read them too. */
export const scienceDocs = (): TrainingDoc[] =>
  SCIENCE_LESSONS.map((lesson) => ({ id: lesson.id, title: lesson.titleAr, content: lesson.answerAr, tags: ['science', lesson.track] }));

/** The questions of the track, asked the way a visitor asks them. */
export const scienceQuestions = (): BankQuestion[] =>
  SCIENCE_LESSONS.map((lesson) => ({ q: lesson.questionAr, lang: 'ar' as const, topic: `science:${lesson.track}`, origin: 'curriculum' as const }));

/** Other wordings of the same question, so a visitor reaching the topic from a different angle still finds it. */
export function scienceParaphrases(lesson: ScienceLesson): string[] {
  const title = lesson.titleAr.replace(/[؟?.!]+$/, '');
  const candidates = [`اشرحلي ${title}`, `معلومات عن ${title}`, `يعني ايه ${title}`];
  const own = normalizeQuestion(lesson.questionAr);
  return [...new Set(candidates)]
    .filter((q) => q.length >= 6 && q.length <= 200 && normalizeQuestion(q) !== own);
}

/** Already covered by himself? (exact question, or a close wording he kept before) */
export const scienceCovered = (memory: MemoryFile, lesson: ScienceLesson): boolean =>
  Boolean(recallSimilar(memory, lesson.questionAr, 'ar'));

/**
 * Studies the lessons he does not know yet, from the authored answer only — no AI call, no network.
 * `max` bounds a single run so a large curriculum never floods his memory in one go; the next run continues.
 */
export function learnSciences(memory: MemoryFile, now = new Date(), max = SCIENCE_LESSONS.length): { learned: number; questions: string[] } {
  const learned: string[] = [];
  for (const lesson of SCIENCE_LESSONS) {
    if (learned.length >= max) break;
    if (scienceCovered(memory, lesson)) continue;
    let kept = 0;
    for (const q of [lesson.questionAr, ...scienceParaphrases(lesson)]) {
      if (remember(memory, { question: q, lang: 'ar', mode: 'auto', answer: lesson.answerAr, source: 'study' }, now)) kept++;
    }
    if (kept) learned.push(lesson.questionAr);
  }
  return { learned: learned.length, questions: learned };
}

/** The track's own report: what he can answer by himself, per track, without touching the perfume score. */
export function scienceReport(memory: MemoryFile, nowIso: string, lastLearned: { q: string; at: string }[] = []): SciencesFile {
  const tracks: SciencesTrackReport[] = SCIENCE_TRACKS.map((track) => {
    const covered = track.lessons.filter((lesson) => scienceCovered(memory, lesson)).length;
    return {
      id: track.id, titleAr: track.titleAr, titleEn: track.titleEn,
      covered, total: track.lessons.length,
      score: track.lessons.length ? Math.round((covered / track.lessons.length) * 100) : 0,
    };
  });
  const total = tracks.reduce((sum, t) => sum + t.total, 0);
  const learned = tracks.reduce((sum, t) => sum + t.covered, 0);
  return {
    version: 1, updatedAt: nowIso, policyAr: SCIENCE_POLICY_AR,
    learned, total, score: total ? Math.round((learned / total) * 100) : 0,
    tracks, lastLearned: lastLearned.slice(0, 20),
  };
}
