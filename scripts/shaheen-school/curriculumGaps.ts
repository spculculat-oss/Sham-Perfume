/**
 * «تكملة المناهج الناقصة» — the missing lessons of the school curriculum: every bank question that
 * had no library lesson (the original perfume curriculum + the experts' science syllabus) now has
 * exactly one lesson of its own. The school teaches them by exam → selfLesson → memory, without any AI.
 */
import type { AcademyLesson, AcademyPair } from './curriculum';
import { PERFUME_GAPS } from './curriculumGapsPerfume';
import { DESIGN_GAPS } from './curriculumGapsDesign';
import { HEALTH_GAPS } from './curriculumGapsHealth';
import { NATURE_GAPS } from './curriculumGapsNature';
import { SCIENCE_GAPS } from './curriculumGapsScience';
import { MIND_GAPS } from './curriculumGapsMind';

const GAP_PAIRS: AcademyPair[] = [
  ...PERFUME_GAPS, ...DESIGN_GAPS, ...HEALTH_GAPS, ...NATURE_GAPS, ...SCIENCE_GAPS, ...MIND_GAPS,
  // Each lesson's title IS its question: that is the only wording guaranteed to be found by
  // topicMatch at 1.0 (the matcher sees the question's own words — no rephrasing drift).
].map((p) => ({ lesson: { ...p.lesson, title: p.question.q.replace(/؟+$/, '') }, question: p.question }));

export function gapPairs(): AcademyPair[] {
  return GAP_PAIRS;
}

export function gapLessons(): AcademyLesson[] {
  return GAP_PAIRS.map((p) => p.lesson);
}

export function gapQuestions(): AcademyPair['question'][] {
  return GAP_PAIRS.map((p) => p.question);
}
