/**
 * «الجامعة العالمية الإلكترونية داخل دولة المنصة» — 5 كليات: الأكاديمية (البحث والدراسة)،
 * المهنية (الحرف والمهن)، التقنية (التقنيات التطبيقية)، التجريبية (المختبرات)،
 * وكلية أذكى أدوات الـAgents. كل سؤال يجد درسه بالضبط (العنوان = السؤال).
 */
import type { AcademyPair } from './curriculum';
import { ACADEMIC_PAIRS } from './curriculumUniversityAcademy';
import { AGENT_PAIRS, EXPERIMENTAL_PAIRS, TECHNICAL_PAIRS } from './curriculumUniversityTech';

export const UNIVERSITY_PAIRS: AcademyPair[] = [
  ...ACADEMIC_PAIRS, ...TECHNICAL_PAIRS, ...EXPERIMENTAL_PAIRS, ...AGENT_PAIRS,
];
