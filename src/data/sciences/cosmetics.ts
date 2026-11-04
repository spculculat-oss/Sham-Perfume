import type { ScienceLesson } from './types';
import { COSMETIC_LESSONS } from '../../لغات/cosmeticsL10n';
import { COSMETICS_MANUFACTURING_LESSONS } from './cosmeticsManufacturing';
import { COSMETICS_PRODUCT_LESSONS } from './cosmeticsProducts';
import { COSMETICS_HISTORY_LESSONS } from './cosmeticsHistory';

/**
 * «علم مستحضرات التجميل»: skin and its barrier, moisturisers, emulsions, preservatives, pH, INCI labels, actives,
 * sun protection, hair, skin types, essential oils, and the law. The same lessons the Cosmetics page shows in every
 * language (src/لغات/cosmeticsL10n.ts); the school studies their Arabic.
 *
 * Then «موسوعة تصنيع مستحضرات التجميل» (2026-11-04, the owner: «دخّل لعقل شاهين جميع أقسام مستحضرات التجميل من
 * تصنيع لخامات لخطوات تصنيع … القديمة والجديدة»): the map of the whole industry, the factory and its law, every family
 * of raw materials, the making of every product family step by step, and the history from ancient Egypt to biotech.
 */
export const COSMETICS_PAGE_LESSONS: ScienceLesson[] = COSMETIC_LESSONS.map((l) => ({
  id: l.id, track: 'cosmetics', titleAr: l.title.ar, questionAr: l.question.ar, answerAr: l.answer.ar, keywords: l.keywords,
}));

export const COSMETICS_ENCYCLOPEDIA_LESSONS: ScienceLesson[] = [
  ...COSMETICS_MANUFACTURING_LESSONS,
  ...COSMETICS_PRODUCT_LESSONS,
  ...COSMETICS_HISTORY_LESSONS,
];

export const COSMETICS_LESSONS: ScienceLesson[] = [...COSMETICS_PAGE_LESSONS, ...COSMETICS_ENCYCLOPEDIA_LESSONS];
