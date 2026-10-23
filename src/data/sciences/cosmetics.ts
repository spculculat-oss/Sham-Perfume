import type { ScienceLesson } from './types';
import { COSMETIC_LESSONS } from '../../لغات/cosmeticsL10n';

/**
 * «علم مستحضرات التجميل»: skin and its barrier, moisturisers, emulsions, preservatives, pH, INCI labels, actives,
 * sun protection, hair, skin types, essential oils, and the law. The same lessons the Cosmetics page shows in every
 * language (src/لغات/cosmeticsL10n.ts); the school studies their Arabic.
 */
export const COSMETICS_LESSONS: ScienceLesson[] = COSMETIC_LESSONS.map((l) => ({
  id: l.id, track: 'cosmetics', titleAr: l.title.ar, questionAr: l.question.ar, answerAr: l.answer.ar, keywords: l.keywords,
}));
