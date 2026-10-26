import { AuthorBook } from './AuthorBook';
import { OriginalBooklets } from './OriginalBooklets';
import readingGuideText from '../../content/library/reading-guide.json';
import { READING_GUIDE, epubAssetUrl } from './epubAssets';
import { EditorialPlans } from './EditorialPlans';
import React, { lazy, Suspense, useMemo, useState } from 'react';
import type { SupportedLanguage } from '../types/i18n';
import { loc, makeT } from '../لغات/localize';
import {
  BOOK_CATEGORIES, BOOK_LANGUAGES, EAST_ASIAN_LANGUAGE_COVERAGE, EAST_ASIAN_REGIONS, LIBRARY_BOOKS, searchBooks, exportLibraryArchive,
  type BookCategory, type LibraryBook,
} from './catalog';

const EpubReader = lazy(() => import('./EpubReader').then(m => ({ default: m.EpubReader })));

const TEXT = {
  guide: { ar: 'اقرأ الآن: دليل القراءة والتوثيق · EPUB', en: 'Read now: original Arabic library guide · EPUB' },
  guideNote: { ar: 'دليل أصلي تمهيدي قصير بالعربية، مولّد بمساعدة الذكاء الاصطناعي. مش بديل عن المراجع الأكاديمية.', en: 'A short original Arabic introduction, created with AI assistance. It is not a substitute for academic references.' },
  open: { ar: 'تفاصيل المرجع · ملف الكتاب غير مرفق', en: 'Reference details · no ebook attached' },
  loadingReader: { ar: 'جارٍ تحميل القارئ…', en: 'Loading reader…' },
  title: { ar: 'مكتبة شاهين الأكاديمية متعددة اللغات', en: 'Shaheen multilingual academic library' },
  supervision: { ar: 'أمين المكتبة — فهرسة وتصنيف محليان تحت إشراف شاهين. فهرس شرق آسيا بداية منظمة، مش حصر كامل لكل الكتب.', en: 'Librarian — local cataloguing and classification under Shaheen. The East Asia collection is a structured starting catalogue, not an exhaustive list.' },
  rights: { ar: 'الكتب هنا فهرسة ببليوغرافية فقط؛ مفيش نصوص كاملة مرفوعة. كل كتاب لازم تتراجع طبعته ومصدره وحقوقه قبل اعتماده أو دخوله في تعليم المدرسة. الكتب الطبية والتاريخية مش إرشاد علاجي حديث.', en: 'These are bibliographic records only; no full book texts are uploaded. Each edition, source, and right must be reviewed before approval or school use. Historical medical works are not current treatment guidance.' },
  eastAsiaCoverage: { ar: 'لغات شرق آسيا: عدد السجلات في الفهرس الحالي وحالتها', en: 'East Asian languages: current catalogue-record count and status' },
  coveragePending: { ar: 'سجلات تحتاج مطابقة الطبعة', en: 'records need edition matching' },
  coverageMissing: { ar: 'لسه محتاجة بحث في فهارس موثوقة', en: 'need authoritative catalogue research' },
  notApproved: { ar: 'غير معتمد للتدريس أو الإجابة — فهرسة أولية فقط', en: 'Not approved for teaching or answers — preliminary catalogue record only' },
  language: { ar: 'لغة الكتاب', en: 'Book language' },
  allLanguages: { ar: 'كل اللغات', en: 'All languages' },
  pending: { ar: 'كتاب كامل في الفهرس • النص الكامل غير مرفق • الطبعة قيد التحقق', en: 'Complete work catalogued • full text not attached • edition pending verification' },
  licensedText: { ar: 'النص الكامل مرخص ومتاح للمراجعة؛ الاعتماد الدراسي منفصل', en: 'Licensed full text available for review; school approval is separate' },
  approved: { ar: 'معتمد بعد مراجعة الطبعة والحقوق والمحتوى', en: 'Approved after edition, rights, and content review' },
  notExhaustive: { ar: 'الفهرس تأسيسي وغير شامل؛ العدد صفر يعني إننا لسه ما تحققناش من سجلات بهاللغة، مش إن مفيش كتب.', en: 'This is a starter catalogue, not an exhaustive collection; zero means records are not yet verified, not that books do not exist.' },
  safety: { ar: 'مراجع العلاج العطري للتثقيف وليست وصفات طبية أو بديلاً للعلاج. الطبيعي ليس آمناً دائماً: الزيوت قد تسبب حساسية أو سمية وتداخلات دوائية. لا تتناولها أو تستخدمها مركزة؛ استشر مختصاً خصوصاً للأطفال والحمل والأمراض المزمنة.', en: 'Aromatherapy references are educational, not prescriptions or substitutes for medical treatment. Natural does not always mean safe: essential oils may cause allergy, toxicity or drug interactions. Do not ingest or use them undiluted; consult a qualified professional, especially for children, pregnancy or chronic illness.' },
  search: { ar: 'ابحث بالعنوان الأصلي أو ترجمته أو المؤلف أو المجال أو رقم الأرشيف', en: 'Search original title, translation, author, field or archive ID' },
  category: { ar: 'التصنيف', en: 'Category' },
  all: { ar: 'كل التصنيفات', en: 'All categories' },
  download: { ar: 'تصدير الفهرس المؤرشف (JSON)', en: 'Export catalogue archive (JSON)' },
  source: { ar: 'البحث عن سجل الكتاب في WorldCat', en: 'Find bibliographic record on WorldCat' },
  empty: { ar: 'لا توجد كتب مطابقة. جرّب اسم المؤلف أو موضوعاً آخر.', en: 'No matching books. Try an author or another subject.' },
};
const isSchoolApproved = (book: LibraryBook) => book.metadataStatus === 'verified' && book.schoolApproval === 'approved' && book.access === 'licensed-full-text';
const TRACK_NAMES: Record<string, { ar: string; en: string }> = {
  math: { ar: 'الرياضيات', en: 'Mathematics' }, history: { ar: 'التاريخ', en: 'History' },
  engineering: { ar: 'الهندسة', en: 'Engineering' }, technical: { ar: 'التقنيات التطبيقية', en: 'Applied technology' },
  biology: { ar: 'الأحياء', en: 'Biology' }, earth_space: { ar: 'الأرض والبيئة', en: 'Earth & environment' },
  medicine: { ar: 'الطب', en: 'Medicine' }, literature: { ar: 'الأدب', en: 'Literature' },
  education: { ar: 'التعليم', en: 'Education' }, media_info: { ar: 'الإعلام والمعلومات', en: 'Media & information' },
  social: { ar: 'العلوم الاجتماعية', en: 'Social sciences' }, religion: { ar: 'الفلسفة والدين', en: 'Philosophy & religion' },
  management: { ar: 'الإدارة', en: 'Management' }, physics: { ar: 'الفيزياء', en: 'Physics' },
  chemistry: { ar: 'الكيمياء', en: 'Chemistry' }, it_sciences: { ar: 'تكنولوجيا المعلومات', en: 'IT sciences' },
  software: { ar: 'هندسة البرمجيات', en: 'Software engineering' }, security: { ar: 'الأمن السيبراني', en: 'Security' },
  academic: { ar: 'الدراسة الأكاديمية', en: 'Academic study' }, geography: { ar: 'الجغرافيا', en: 'Geography' },
  commerce: { ar: 'التجارة والاقتصاد', en: 'Commerce & economics' }, psychology: { ar: 'علم النفس', en: 'Psychology' },
  law: { ar: 'القانون', en: 'Law' }, vocational: { ar: 'المهارات المهنية', en: 'Vocational skills' },
  arts: { ar: 'الفنون', en: 'Arts' },
};
export function BookLibrary({ currentLang }: { currentLang: SupportedLanguage }) {
  const L = makeT(currentLang, TEXT);
  const [showGuide, setShowGuide] = useState(false);
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<BookCategory | 'all'>('all');
  const [language, setLanguage] = useState('all');
  const languageCodes = useMemo(() => [...new Set(LIBRARY_BOOKS.map(book => book.language))].sort(), []);
  const books = useMemo(() => searchBooks(query, category, { language: language === 'all' ? undefined : language }), [query, category, language]);
  function download() {
    const url = URL.createObjectURL(new Blob([exportLibraryArchive()], { type: 'application/json;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'sham-book-catalogue.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section id="perfume-book-library" aria-labelledby="book-library-title" className="my-8 rounded-2xl border border-amber-500/30 bg-stone-950 p-5 text-stone-100 space-y-5">
    <h2 id="book-library-title" className="text-2xl font-bold text-amber-300">{L('title')}</h2>
    <p>{L('supervision')}</p><p className="text-sm text-stone-300">{L('rights')}</p>
    <section aria-label={L('eastAsiaCoverage')} className="rounded-xl border border-sky-500/30 p-4 space-y-3">
      <h3 className="font-semibold text-sky-200">{L('eastAsiaCoverage')}</h3>
      <p className="text-sm text-stone-300">{L('notExhaustive')}</p>
      <div className="flex flex-wrap gap-2">{EAST_ASIAN_LANGUAGE_COVERAGE.map(item => <span key={item.code} className="rounded-lg border border-stone-700 px-2 py-1 text-xs">
        {loc(currentLang, item.language)} · {item.bookCount ? `${item.bookCount} ${L('coveragePending')}` : L('coverageMissing')}
      </span>)}</div>
    </section>
    <aside className="rounded-lg border border-amber-500/40 p-3 text-sm text-amber-100">{L('safety')}</aside>
    <div className="rounded-xl border border-emerald-500/40 p-4 space-y-2">
      <button onClick={() => setShowGuide(true)} className="rounded-lg bg-emerald-800 px-4 py-3 font-bold">{L('guide')}</button>
      <p className="text-sm text-stone-300">{L('guideNote')}</p>
    </div>
    <AuthorBook currentLang={currentLang} />
    <OriginalBooklets currentLang={currentLang} />
    <EditorialPlans currentLang={currentLang} />
    <div className="flex flex-wrap gap-3">
      <input type="search" aria-label={L('search')} placeholder={L('search')} value={query} onChange={e => setQuery(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-900 p-3" />
      <select aria-label={L('category')} value={category} onChange={e => setCategory(e.target.value as BookCategory | 'all')} className="max-w-full rounded-lg border border-stone-600 bg-stone-900 p-3">
        <option value="all">{L('all')}</option>{Object.entries(BOOK_CATEGORIES).map(([id, label]) => <option key={id} value={id}>{loc(currentLang, label)}</option>)}
      </select>
      <select aria-label={L('language')} value={language} onChange={e => setLanguage(e.target.value)} className="max-w-full rounded-lg border border-stone-600 bg-stone-900 p-3">
        <option value="all">{L('allLanguages')}</option>{languageCodes.map(code => <option key={code} value={code}>{loc(currentLang, BOOK_LANGUAGES[code])} ({code})</option>)}
      </select>
      <button onClick={download} className="rounded-lg border border-amber-500 p-3 text-amber-200">{L('download')}</button>
    </div>
    {!books.length && <p role="status">{L('empty')}</p>}
    <div className="grid gap-4 md:grid-cols-2">{books.map(book => <article key={book.id} className="rounded-xl border border-stone-700 p-4 space-y-2">
      <div className="flex flex-wrap gap-2 text-xs text-amber-300">
        <span>{loc(currentLang, BOOK_CATEGORIES[book.category])}</span>
        {BOOK_LANGUAGES[book.language] && <span>· {loc(currentLang, BOOK_LANGUAGES[book.language])}</span>}
        {book.originArea && <span>· {loc(currentLang, EAST_ASIAN_REGIONS[book.originArea])}</span>}
      </div>
      <h3 lang={book.language} dir="auto" className="font-bold text-lg"><button onClick={() => setSelectedBook(book)} className="text-start underline decoration-amber-500/40">{book.title}</button></h3>
      {book.titleEnglish && <p lang="en" dir="ltr" className="text-sm text-stone-300">{book.titleEnglish}</p>}
      {book.transliteration && <p lang="en" dir="ltr" className="text-xs text-stone-400">{book.transliteration}</p>}
      {book.authorsNative && <p lang={book.language} dir="auto">{book.authorsNative}</p>}
      <p lang="en" dir="ltr">{book.authors}</p>{book.publisher && <p lang="en" dir="ltr" className="text-sm">{book.publisher}</p>}
      <div className="flex flex-wrap gap-1">{book.trackIds.map(trackId => <span key={trackId} className="rounded bg-stone-800 px-2 py-1 text-xs text-stone-300">{TRACK_NAMES[trackId] ? loc(currentLang, TRACK_NAMES[trackId]) : trackId}</span>)}</div>
      <p>{loc(currentLang, book.summary)}</p>
      <p className="text-xs text-stone-400">{book.access === 'licensed-full-text' ? L('licensedText') : L('pending')}</p>
      <p className="text-xs text-amber-200">{isSchoolApproved(book) ? L('approved') : L('notApproved')}</p>
      <button onClick={() => setSelectedBook(book)} className="block rounded-lg border border-amber-500 px-3 py-2 text-amber-200">{L('open')}</button>
      <code dir="ltr" className="block text-xs">{book.id}</code>
      <a href={`https://search.worldcat.org/search?q=${encodeURIComponent([book.title, book.titleEnglish, book.transliteration, book.authors, book.authorsNative].filter(Boolean).join(' '))}`} target="_blank" rel="noopener noreferrer" className="inline-block text-amber-300 underline">{L('source')}</a>
    </article>)}</div>
    {showGuide && <Suspense fallback={<p role="status">{L('loadingReader')}</p>}><EpubReader book={READING_GUIDE} fallbackText={readingGuideText} sourceUrl={epubAssetUrl(READING_GUIDE.file, import.meta.env.BASE_URL)} currentLang={currentLang} onClose={() => setShowGuide(false)} /></Suspense>}
    {selectedBook && <Suspense fallback={<p role="status">{L('loadingReader')}</p>}><EpubReader key={selectedBook.id} book={selectedBook} currentLang={currentLang} onClose={() => setSelectedBook(null)} /></Suspense>}
  </section>;
}
