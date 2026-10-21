import type { LText } from '../لغات/localize';
import type { PublicationReview } from '../legal/publicationReview';

export interface OriginalBookPlan {
  id: string;
  title: LText;
  chapters: LText[];
  review: PublicationReview;
}
const pendingReview = (): PublicationReview => ({ manuscriptVersion: '', sources: [], claims: [], approvals: [] });
/** Plans only: no book text, scientific assessment or legal sign-off has been produced. */
export const ORIGINAL_BOOK_PLANS: OriginalBookPlan[] = [
  { id: 'SHAM-ORIGINAL-001', title: { ar: 'كيمياء العطور: من الجزيء إلى التركيبة', en: 'Fragrance chemistry: from molecule to formulation' }, chapters: [
    { ar: 'بنية الجزيئات والإدراك الشمي وحدود التنبؤ بالرائحة', en: 'Molecular structure, smell perception and prediction limits' },
    { ar: 'التطاير والذوبان والأكسدة والثبات', en: 'Volatility, solubility, oxidation and stability' },
    { ar: 'تصميم التجارب وقراءة نتائج اختبار التركيبات', en: 'Experimental design and interpreting formulation tests' },
  ], review: pendingReview() },
  { id: 'SHAM-ORIGINAL-002', title: { ar: 'العطور في مستحضرات التجميل: الثبات والسلامة', en: 'Fragrance in cosmetics: stability and safety' }, chapters: [
    { ar: 'المستحلبات والمواد الخافضة للتوتر السطحي', en: 'Emulsions and surfactants' },
    { ar: 'التوافق مع العبوة والحفظ الميكروبي واختبارات الثبات', en: 'Packaging compatibility, preservation and stability testing' },
    { ar: 'التعرض والتحسس وتقييم السلامة ومتطلبات السوق', en: 'Exposure, sensitization, safety assessment and market requirements' },
  ], review: pendingReview() },
  { id: 'SHAM-ORIGINAL-003', title: { ar: 'الزيوت العطرية بين الدليل العلمي والادعاءات الشائعة', en: 'Essential oils: evidence and common claims' }, chapters: [
    { ar: 'هوية الزيوت وتركيبها وتفاوت الجودة', en: 'Oil identity, composition and quality variation' },
    { ar: 'الفرق بين التجارب المعملية والدراسات البشرية', en: 'Laboratory experiments versus human studies' },
    { ar: 'السمية والتداخلات والفئات الحساسة وحدود الاستخدام', en: 'Toxicity, interactions, vulnerable groups and limits of use' },
  ], review: pendingReview() },
];
