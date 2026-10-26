import type { LText } from '../لغات/localize';
import {
  EAST_ASIAN_BOOKS, EAST_ASIAN_LANGUAGES, EAST_ASIAN_LANGUAGE_TARGETS, EAST_ASIAN_REGIONS,
} from './eastAsianCatalog';

export const BOOK_CATEGORIES = {
  chemistry: { ar: 'الكيمياء', en: 'Chemistry' },
  technology: { ar: 'التصنيع والتكنولوجيا', en: 'Manufacturing & technology' },
  cosmetics: { ar: 'مستحضرات التجميل والثبات', en: 'Cosmetics & stability' },
  aromatherapy: { ar: 'العلاج العطري وسلامة الزيوت', en: 'Aromatherapy & essential oil safety' },
  criticism: { ar: 'النقد والتقييم', en: 'Criticism & reviews' },
  reference: { ar: 'المعاجم والمراجع', en: 'Dictionaries & reference' },
  history: { ar: 'التاريخ', en: 'History' },
  mathematics: { ar: 'الرياضيات', en: 'Mathematics' },
  physics: { ar: 'الفيزياء', en: 'Physics' },
  biology: { ar: 'الأحياء', en: 'Biology' },
  engineering: { ar: 'الهندسة', en: 'Engineering' },
  agriculture: { ar: 'الزراعة', en: 'Agriculture' },
  medicine_history: { ar: 'تاريخ الطب', en: 'History of medicine' },
  education: { ar: 'التربية والتعليم', en: 'Education' },
  language: { ar: 'اللغة والمعاجم', en: 'Languages & dictionaries' },
  literature: { ar: 'الأدب', en: 'Literature' },
  philosophy: { ar: 'الفلسفة والفكر', en: 'Philosophy & thought' },
  law: { ar: 'القانون', en: 'Law' },
  geography: { ar: 'الجغرافيا', en: 'Geography' },
  astronomy: { ar: 'الفلك', en: 'Astronomy' },
  computer_science: { ar: 'علوم الحاسوب', en: 'Computer science' },
  psychology: { ar: 'علم النفس', en: 'Psychology' },
  management: { ar: 'الإدارة', en: 'Management' },
  commerce: { ar: 'الاقتصاد والتجارة', en: 'Economics & commerce' },
  science_reference: { ar: 'مراجع العلوم', en: 'Science reference' },
} satisfies Record<string, LText>;
export type BookCategory = keyof typeof BOOK_CATEGORIES;
export type BookAccess = 'metadata-only' | 'licensed-full-text';
export type BookMetadataStatus = 'pending-edition-verification' | 'verified';
export type BookSchoolApproval = 'pending-review' | 'approved';
export type BookWorkKind = 'complete-book' | 'complete-reference-work';

export interface LibraryBook {
  id: string;
  /** Original or standard catalogue title; may be in the source language's script. */
  title: string;
  titleEnglish?: string;
  titleVariants?: readonly string[];
  transliteration?: string;
  authors: string;
  authorsNative?: string;
  publisher?: string;
  category: BookCategory;
  summary: LText;
  /** ISO 639/BCP-47 tag for the work, not proof that a particular edition is present. */
  language: string;
  originArea?: keyof typeof EAST_ASIAN_REGIONS;
  /** Existing records and new records all describe whole books, not posts or excerpts. */
  workKind: BookWorkKind;
  /** The complete text is not in this repository; licensed full text requires separate review. */
  access: BookAccess;
  metadataStatus: BookMetadataStatus;
  /** Only approved, edition-verified and lawfully accessible books may enter school learning. */
  schoolApproval: BookSchoolApproval;
  /** Curriculum track identifiers; these are bibliographic links, not learned content. */
  trackIds: readonly string[];
}

export const BOOK_LANGUAGES: Record<string, LText> = {
  en: { ar: 'الإنجليزية', en: 'English' },
  ...EAST_ASIAN_LANGUAGES,
};
export { EAST_ASIAN_BOOKS, EAST_ASIAN_LANGUAGES, EAST_ASIAN_LANGUAGE_TARGETS, EAST_ASIAN_REGIONS };

export const EAST_ASIAN_CATALOG_SCOPE = {
  kind: 'curated-starter-catalog' as const,
  exhaustive: false,
  note: 'A first, non-exhaustive bibliography. A zero-count language means its book records still need authoritative catalog research; it does not mean the language has no books.',
  noteAr: 'فهرس تأسيسي أولي غير شامل. اللغة ذات العدد صفر تحتاج بحثاً في فهارس موثوقة؛ لا يعني ذلك عدم وجود كتب بها.',
};

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

const CATEGORY_TRACKS: Record<BookCategory, readonly string[]> = {
  chemistry: ['chemistry'], technology: ['engineering', 'technical'], cosmetics: ['chemistry'],
  aromatherapy: ['medicine', 'biology'], criticism: ['literature'], reference: ['media_info'],
  history: ['history'], mathematics: ['math'], physics: ['physics'], biology: ['biology'],
  engineering: ['engineering'], agriculture: ['biology', 'earth_space'], medicine_history: ['medicine', 'history'],
  education: ['education'], language: ['literature', 'education', 'media_info'], literature: ['literature'],
  philosophy: ['religion', 'social'], law: ['law'], geography: ['geography'], astronomy: ['earth_space'],
  computer_science: ['it_sciences'], psychology: ['psychology'], management: ['management'],
  commerce: ['commerce'], science_reference: ['academic'],
};
const existingBooks: LibraryBook[] = seeds.map(([id, title, authors, publisher, category, ar, en]) => ({
  id: `SHAM-LIB-${id}`, title, authors, publisher, category, summary: { ar, en }, language: 'en',
  workKind: ['006', '012'].includes(id) ? 'complete-reference-work' : 'complete-book',
  metadataStatus: 'pending-edition-verification', access: 'metadata-only', schoolApproval: 'pending-review',
  trackIds: CATEGORY_TRACKS[category],
}));

/** Bibliographic index only; no full copyrighted books or excerpts are packaged here. */
export const LIBRARY_BOOKS: readonly LibraryBook[] = [...existingBooks, ...EAST_ASIAN_BOOKS];

export interface LibrarySearchFilters {
  language?: string;
  trackId?: string;
}
const normalize = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim();
/** Local librarian search; returns catalogue records only, never book text or approved scientific claims. */
export function searchBooks(
  query: string,
  category: BookCategory | 'all' = 'all',
  filters: LibrarySearchFilters = {},
): LibraryBook[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return LIBRARY_BOOKS.filter(b => {
    if (category !== 'all' && b.category !== category) return false;
    if (filters.language && b.language !== filters.language) return false;
    if (filters.trackId && !b.trackIds.includes(filters.trackId)) return false;
    const languageName = BOOK_LANGUAGES[b.language];
    const haystack = normalize([
      b.id, b.title, b.titleEnglish || '', ...(b.titleVariants || []), b.transliteration || '',
      b.authors, b.authorsNative || '', b.publisher || '', b.summary.ar, b.summary.en,
      BOOK_CATEGORIES[b.category].ar, BOOK_CATEGORIES[b.category].en,
      languageName?.ar || b.language, languageName?.en || b.language,
      b.originArea ? `${EAST_ASIAN_REGIONS[b.originArea].ar} ${EAST_ASIAN_REGIONS[b.originArea].en}` : '',
      ...b.trackIds,
    ].join(' '));
    return terms.every(t => haystack.includes(t));
  });
}

/** Bibliography candidates can be browsed by curriculum track, but are not automatically lesson content. */
export function booksForTrack(trackId: string): LibraryBook[] {
  return LIBRARY_BOOKS.filter(book => book.trackIds.includes(trackId));
}
/** Strict school gate: verified edition + approved use + lawful full text + whole-book record. */
export function approvedBooksForTrack(trackId: string): LibraryBook[] {
  return booksForTrack(trackId).filter(book =>
    book.metadataStatus === 'verified' && book.schoolApproval === 'approved' &&
    book.access === 'licensed-full-text' &&
    (book.workKind === 'complete-book' || book.workKind === 'complete-reference-work'));
}

export const EAST_ASIAN_LANGUAGE_COVERAGE = EAST_ASIAN_LANGUAGE_TARGETS.map(code => {
  const bookCount = EAST_ASIAN_BOOKS.filter(book => book.language === code).length;
  return {
    code,
    language: EAST_ASIAN_LANGUAGES[code],
    bookCount,
    state: bookCount ? 'records-pending-verification' as const : 'needs-source-research' as const,
  };
});

export function exportLibraryArchive(): string {
  return JSON.stringify({
    schemaVersion: 2,
    supervisor: 'shaheen',
    robot: 'librarian',
    rights: 'Catalogue metadata only; no full book text or licensed electronic files supplied.',
    scope: EAST_ASIAN_CATALOG_SCOPE,
    eastAsianLanguageCoverage: EAST_ASIAN_LANGUAGE_COVERAGE,
    books: LIBRARY_BOOKS,
  }, null, 2);
}
