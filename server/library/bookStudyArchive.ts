/** Internal study planning only. Never import into a visitor bundle or RAG index.
 * This repository may be public: metadata here is not confidential storage.
 * Licensed texts/excerpts belong in access-controlled storage, not Git/public/.
 */
import { LIBRARY_BOOKS } from '../../src/library/catalog';

const REFERENCES: Array<{ suffix: string; url: string; editionNote?: string }> = [
  { suffix: '001', url: 'https://onlinelibrary.wiley.com/doi/book/10.1002/9781444305517' },
  { suffix: '002', url: 'https://books.rsc.org/books/edited-volume/475/Chemistry-of-Fragrances', editionNote: 'Charles S. Sell محرر؛ يجب تحديد الطبعة ونوع الوصول.' },
  { suffix: '003', url: 'https://link.springer.com/book/10.1007/978-94-011-3826-0', editionNote: 'وجدت نسخة لدى Springer؛ بيانات ناشر السجل العام لا تعتمد دون مطابقة الطبعة.' },
  { suffix: '004', url: 'https://www.routledge.com/Handbook-of-Cosmetic-Science-and-Technology/Dreher-Jungman-Sakamoto-Maibach/p/book/9780367469979', editionNote: 'الرابط لطبعة خامسة بمحررين مختلفين؛ ليس إثباتاً لمحتوى طبعة Barel المطلوبة.' },
  { suffix: '005', url: 'https://nlb.overdrive.com/media/204008', editionNote: 'وصول مكتبي بشروط؛ لا إذن إعادة نشر أو إدخال النص في تدريب آلي.' },
  { suffix: '006', url: 'https://link.springer.com/book/10.1007/978-94-011-2296-2' },
  { suffix: '007', url: 'https://www.wiley.com/en-us/Scent+and+Chemistry:+The+Molecular+World+of+Odors,+2nd+Edition-p-9783527348558', editionNote: 'الطبعة الثانية تضم Fanny Grau ضمن المؤلفين؛ لا تخلطها بالطبعة السابقة.' },
  { suffix: '008', url: 'https://books.google.com/books/about/The_Essence_of_Perfume.html?id=EDbXAAAAMAAJ', editionNote: 'سجل ببليوغرافي؛ لم تثبت إتاحة نص كامل أو EPUB رسمي.' },
  { suffix: '009', url: 'https://www.routledge.com/Cosmetic-Formulation-Principles-and-Practice/Benson-Roberts-Leite-Silva-Walters/p/book/9781032093079', editionNote: 'المحررون بصفحة الناشر Benson وRoberts وLeite-Silva وWalters؛ نسبة Ian C. Evans في الطلب غير معتمدة.' },
  { suffix: '010', url: 'https://www.chemical-publishing.com/harryscosmeticology_p/9780820601793.htm', editionNote: 'الرابط للطبعة التاسعة بتحرير Meyer R. Rosen؛ يلزم تحديد الطبعة المقصودة قبل الدراسة.' },
  { suffix: '011', url: 'https://www.routledge.com/Surfactants-in-Cosmetics/Rieger-Rhein/p/book/9780824798055' },
  { suffix: '012', url: 'https://www.cengage.com/c/skin-care-and-cosmetic-ingredients-dictionary-4e-michalun-dinardo/9781285060798/', editionNote: 'الرابط للطبعة الرابعة باسم M. Varinia Michalun وJoseph C. DiNardo، لا يطابق تلقائياً طبعة Natalia Michalun.' },
  { suffix: '013', url: 'https://www.us.elsevierhealth.com/aromatherapy-for-health-professionals-revised-reprint-9780702084027.html', editionNote: 'النسخة المنقحة للطبعة الخامسة تذكر Penny Price أيضاً.' },
  { suffix: '014', url: 'https://newworldlibrary.com/product/the-complete-book-of-essential-oils-and-aromatherapy-revised-and-expanded' },
  { suffix: '015', url: 'https://shop.elsevier.com/books/clinical-aromatherapy/buckle/978-0-7020-5440-2' },
  { suffix: '016', url: 'https://shop.elsevier.com/books/essential-oil-safety/tisserand/978-0-443-06241-4' },
];

export const BOOK_STUDY_ARCHIVE = {
  schemaVersion: 1,
  owner: 'shaheen',
  custodian: 'librarian',
  purpose: 'internal-study-planning',
  publicDisplay: false,
  approvedForAnswering: false,
  policy: {
    readStatus: 'Bibliographic research only; full texts have not been obtained or read.',
    rights: 'Internal use is not an automatic copyright or license exemption. Legal review must cover the intended processing and storage.',
    learning: 'Do not add bibliographic descriptions, unchecked claims or excerpts to visitor memory, RAG or model training as verified scientific knowledge.',
    storage: 'No copyrighted full text in this repository or static site. Keep licensed material in access-controlled storage.',
  },
  books: LIBRARY_BOOKS.map(book => {
    const reference = REFERENCES.find(r => book.id === `SHAM-LIB-${r.suffix}`);
    const discoveryQuery = [book.title, book.titleEnglish, book.transliteration, book.authors, book.authorsNative].filter(Boolean).join(' ');
    return {
      id: book.id, title: book.title, titleEnglish: book.titleEnglish, language: book.language,
      originArea: book.originArea, trackIds: book.trackIds, workKind: book.workKind,
      suppliedAttribution: book.authors, topic: book.category, schoolApproval: book.schoolApproval,
      discovery: {
        url: reference?.url || `https://search.worldcat.org/search?q=${encodeURIComponent(discoveryQuery)}`,
        source: reference ? 'prior-bibliographic-web-search' : 'WorldCat discovery query; not an identified bibliographic record',
        editionNote: reference?.editionNote || 'سجل اكتشاف أولي فقط؛ يجب مطابقة عنوان الكتاب والطبعة والجهة الناشرة من فهرس موثوق.',
        fullTextAccessVerified: false,
      },
      studyStatus: 'awaiting-lawful-source' as const,
      rightsReview: 'pending' as const,
      reviewedSections: [] as Array<{ edition: string; locator: string; evidenceRef: string }>,
      claimAssessments: [] as Array<{ claim: string; sourceLocator: string; modernEvidence: string[]; conclusion: string; reviewer: string }>,
      modernScienceReview: 'not-started' as const,
      nextSteps: ['تحديد الطبعة', 'اعتماد وسيلة الوصول والاستخدام القانوني', 'قراءة وتوثيق الصفحات الفعلية', 'مقارنة الادعاءات بالأدلة الحديثة لدى مختص', 'اعتماد ملاحظات مستقلة محدودة للاستخدام المقصود'],
    };
  }),
};

export function bookStudyBriefing(): string[] {
  return [
    `أرشيف دراسة داخلي لشاهين: ${BOOK_STUDY_ARCHIVE.books.length} مرجعاً مسجلاً، دون نصوص كاملة أو دراسة منجزة. لا تستخدم بيانات الفهرسة كمعرفة علمية متحققة.`,
    'توجيه صاحب الموقع: ملاحظات الدراسة لدعم بيئة شاهين فقط ولا تعرض في المكتبة العامة. المطلوب تنسيق المدير القانوني وأمين المكتبة ومدرسة شاهين لتوفير مصادر قانونية ومراجعة علمية موثقة قبل إدخال أي معرفة في الإجابات أو التدريب.',
  ];
}
