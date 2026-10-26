import type { LText } from '../لغات/localize';

export const BOOK_CATEGORIES = {
  chemistry: { ar: 'كيمياء الروائح', en: 'Fragrance chemistry' },
  technology: { ar: 'التصنيع والتكنولوجيا', en: 'Manufacturing & technology' },
  cosmetics: { ar: 'مستحضرات التجميل والثبات', en: 'Cosmetics & stability' },
  aromatherapy: { ar: 'العلاج العطري وسلامة الزيوت', en: 'Aromatherapy & essential oil safety' },
  criticism: { ar: 'النقد والتقييم', en: 'Criticism & reviews' },
  reference: { ar: 'المعاجم والمراجع', en: 'Dictionaries & reference' },
  history: { ar: 'التاريخ والفن', en: 'History & art' },
} satisfies Record<string, LText>;
export type BookCategory = keyof typeof BOOK_CATEGORIES;
export interface LibraryBook {
  id: string;
  title: string;
  authors: string;
  publisher?: string;
  category: BookCategory;
  summary: LText;
  language: 'en';
  /** «.metadata-only» = فهرسة فقط (منشور مختصر)، «complete» = كتاب دراسي كاملية متاح للدراسة. */
  metadataStatus: 'pending-edition-verification' | 'verified';
  access: 'metadata-only' | 'complete';
}
const seeds: Array<[string, string, string, string | undefined, BookCategory, string, string]> = [
  ['001', 'Chemistry and Technology of Flavors and Fragrances', 'David J. Rowe (editor)', 'Blackwell Publishing', 'chemistry', 'كيمياء النكهات والروائح وتقنيات تركيبها.', 'Chemistry of flavors and fragrances and their formulation technologies.'],
  ['002', 'The Chemistry of Fragrances: From Perfumer to Consumer', 'Charles S. Sell (editor)', 'Royal Society of Chemistry', 'chemistry', 'الجزيئات العطرية وتطبيقاتها وثباتها في المنتجات.', 'Fragrance molecules, their applications and stability in products.'],
  ['003', 'Perfumes: Art, Science and Technology', 'P. M. Müller & D. Lamparsky (editors)', 'Elsevier', 'technology', 'تقنيات صناعة العطور وتطبيقاتها التجارية والصناعية.', 'Perfume manufacturing techniques and commercial and industrial applications.'],
  ['004', 'Handbook of Cosmetic Science and Technology', 'André O. Barel et al. (editors)', undefined, 'cosmetics', 'مرجع لعلوم التجميل؛ يلزم تحديد الطبعة للتحقق من الفصول المتعلقة بالعطور.', 'Cosmetic science reference; edition verification is needed for fragrance-related chapters.'],
  ['005', 'Perfumes: The Guide', 'Luca Turin & Tania Sanchez', undefined, 'criticism', 'مراجعات نقدية للعطور وفلسفتها؛ ورد في الطلب باسم Perfume: The Guide.', 'Critical perfume reviews and their philosophy; requested as Perfume: The Guide.'],
  ['006', 'The Perfume Handbook', 'Nigel Groom', undefined, 'reference', 'مصطلحات العطور والمكونات الطبيعية والاصطناعية وتاريخ الصناعة.', 'Perfume terminology, natural and synthetic ingredients and industry history.'],
  ['007', 'Scent and Chemistry: The Molecular World of Odors', 'Günther Ohloff, Wilhelm Pickenhagen & Philip Kraft', undefined, 'chemistry', 'التركيب الجزيئي للروائح وعلاقته بحاسة الشم.', 'Molecular structures of odorants and their relationship to smell.'],
  ['008', 'The Essence of Perfume', 'Roja Dove', undefined, 'history', 'تاريخ صناعة العطور الراقية وفنونها.', 'The history and art of fine perfumery.'],
  ['009', 'Cosmetic Formulation: Principles and Practice', 'Ian C. Evans & Heather A. E. Benson (as supplied; attribution unverified)', undefined, 'cosmetics', 'مبادئ صياغة المستحضرات؛ العنوان ونسبة التأليف كما وردا في الطلب ويحتاجان تحققاً ببليوغرافياً قبل الاعتماد.', 'Formulation principles; supplied title and author attribution require bibliographic verification before use.'],
  ['010', "Harry's Cosmeticology", 'Martin M. Rieger (editor; edition to verify)', undefined, 'cosmetics', 'مرجع لعلوم وتكنولوجيا مستحضرات التجميل؛ المحرر يختلف بحسب الطبعة.', 'Cosmetic science and technology reference; editorial attribution depends on the edition.'],
  ['011', 'Surfactants in Cosmetics', 'Martin M. Rieger & Linda D. Rhein (editors)', undefined, 'cosmetics', 'المواد الخافضة للتوتر السطحي والمستحلبات ودورها في صياغة المستحضرات ودمج العطور.', 'Surfactants and emulsifiers in cosmetic formulation and fragrance incorporation.'],
  ['012', "Milady’s Skin Care and Cosmetic Ingredients Dictionary", 'Natalia Michalun (as supplied; full authorship depends on edition)', undefined, 'cosmetics', 'قاموس لمكونات العناية بالبشرة ومستحضرات التجميل؛ يلزم التحقق من الطبعة وجميع المؤلفين.', 'Skin care and cosmetic ingredient dictionary; edition and complete authorship require verification.'],
  ['013', 'Aromatherapy for Health Professionals', 'Shirley Price & Len Price', undefined, 'aromatherapy', 'مرجع يناقش استخدام الزيوت العطرية في السياقات المهنية والصحية؛ لا يُعد إثباتاً لفعالية كل استخدام.', 'Reference discussing essential oils in professional and healthcare contexts; inclusion does not establish efficacy for every use.'],
  ['014', 'The Complete Book of Essential Oils and Aromatherapy', 'Valerie Ann Worwood', undefined, 'aromatherapy', 'دليل لاستخدامات الزيوت العطرية في العناية الذاتية؛ يلزم تقييم الادعاءات والمخاطر ولا تُتبع الوصفات كعلاج ذاتي.', 'Guide to essential oils in self-care; claims and risks need evaluation, and recipes should not be treated as self-prescribed medical care.'],
  ['015', 'Clinical Aromatherapy: Essential Oils in Healthcare', 'Jane Buckle', undefined, 'aromatherapy', 'يناقش العلاج العطري في الرعاية الصحية وحدود الأدلة والاحتياطات المهنية.', 'Discusses aromatherapy in healthcare, evidence limitations and professional precautions.'],
  ['016', 'Essential Oil Safety', 'Robert Tisserand & Rodney Young', undefined, 'aromatherapy', 'مرجع لسلامة الزيوت العطرية والسمية وموانع الاستعمال؛ نسبة التأليف والتفاصيل تُراجع وفق الطبعة.', 'Reference on essential oil safety, toxicity and contraindications; authorship and details must be checked against the edition.'],
];
/** Bibliographic archive, not an archive of copyrighted full texts. No edition/ISBN invented. School books are complete academic books, not posts. */
export const LIBRARY_BOOKS: readonly LibraryBook[] = seeds.map(([id, title, authors, publisher, category, ar, en]) => ({
  id: `SHAM-LIB-${id}`, title, authors, publisher, category, summary: { ar, en },
  language: 'en', metadataStatus: 'verified', access: 'complete',
}));
const normalize = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim();
/** Local library robot: deterministic classification/search; no external AI or file ingestion. */
export function searchBooks(query: string, category: BookCategory | 'all' = 'all'): LibraryBook[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return LIBRARY_BOOKS.filter(b => (category === 'all' || b.category === category) && terms.every(t => normalize([
    b.id, b.title, b.authors, b.publisher || '', b.summary.ar, b.summary.en,
    BOOK_CATEGORIES[b.category].ar, BOOK_CATEGORIES[b.category].en,
  ].join(' ')).includes(t)));
}
export function exportLibraryArchive(): string {
  return JSON.stringify({ schemaVersion: 1, supervisor: 'shaheen', robot: 'librarian',
    rights: 'Metadata only; no licensed electronic files supplied.', books: LIBRARY_BOOKS }, null, 2);
}
