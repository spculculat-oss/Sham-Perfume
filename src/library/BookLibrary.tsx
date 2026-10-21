import { AuthorBook } from './AuthorBook';
import { OriginalBooklets } from './OriginalBooklets';
import readingGuideText from '../../content/library/reading-guide.json';
import { READING_GUIDE, epubAssetUrl } from './epubAssets';
import { EditorialPlans } from './EditorialPlans';
import React, { lazy, Suspense, useMemo, useState } from 'react';
import type { SupportedLanguage } from '../types/i18n';
import { loc, makeT } from '../لغات/localize';
import { BOOK_CATEGORIES, searchBooks, exportLibraryArchive, type BookCategory, type LibraryBook } from './catalog';

const EpubReader = lazy(() => import('./EpubReader').then(m => ({ default: m.EpubReader })));

const TEXT = {
  guide: { ar: 'اقرأ الآن: دليل القراءة والتوثيق · EPUB', en: 'Read now: original Arabic library guide · EPUB' },
  guideNote: { ar: 'دليل أصلي تمهيدي قصير بالعربية، مولّد بمساعدة الذكاء الاصطناعي. ليس من الكتب المرجعية الستة عشر ولا بديلاً عنها.', en: 'A short original Arabic introduction, created with AI assistance. Not one of the sixteen reference books or a substitute for them.' },
  open: { ar: 'تفاصيل المرجع · ملف الكتاب غير مرفق', en: 'Reference details · no ebook attached' },
  loadingReader: { ar: 'جارٍ تحميل القارئ…', en: 'Loading reader…' },
  title: { ar: 'مكتبة كتب العطور الإلكترونية', en: 'Perfume book library' },
  supervision: { ar: 'أمين المكتبة — مساعد محلي للأرشفة والتصنيف تحت إشراف شاهين، ضمن قسم المحتوى. موضع مبدئي لحين توجيه شاهين.', en: 'Librarian — local archive and classification assistant under Shaheen, in Content. Provisional placement pending Shaheen’s direction.' },
  rights: { ar: 'الكتيّبات الأصلية في قسم القراءة متاحة بنصوصها الكاملة. أما المراجع الستة عشر فهي فهرسة فقط دون ملفات كتب مرفقة. بيانات الطبعات والناشرين تحتاج مراجعة؛ لا ندّعي توفر ترجمات. الواجهة تستخدم لغة الموقع مع الرجوع للإنجليزية عند غياب الترجمة.', en: 'The original reading booklets are available in full. The sixteen reference books remain catalogue entries without attached full texts. Editions and publishers require verification; translated editions are not claimed. The interface follows the site language with English fallback where translations are missing.' },
  safety: { ar: 'مراجع العلاج العطري للتثقيف وليست وصفات طبية أو بديلاً للعلاج. الطبيعي ليس آمناً دائماً: الزيوت قد تسبب حساسية أو سمية وتداخلات دوائية. لا تتناولها أو تستخدمها مركزة؛ استشر مختصاً خصوصاً للأطفال والحمل والأمراض المزمنة.', en: 'Aromatherapy references are educational, not prescriptions or substitutes for medical treatment. Natural does not always mean safe: essential oils may cause allergy, toxicity or drug interactions. Do not ingest or use them undiluted; consult a qualified professional, especially for children, pregnancy or chronic illness.' },
  search: { ar: 'ابحث بالعنوان أو المؤلف أو الموضوع أو رقم الأرشيف', en: 'Search title, author, subject or archive ID' },
  category: { ar: 'التصنيف', en: 'Category' },
  all: { ar: 'كل التصنيفات', en: 'All categories' },
  download: { ar: 'تصدير الفهرس المؤرشف (JSON)', en: 'Export catalogue archive (JSON)' },
  pending: { ar: 'فهرسة فقط • الأصل بالإنجليزية • الطبعة قيد التحقق', en: 'Metadata only • English original • Edition pending verification' },
  source: { ar: 'البحث عن سجل الكتاب في WorldCat', en: 'Find bibliographic record on WorldCat' },
  empty: { ar: 'لا توجد كتب مطابقة. جرّب اسم المؤلف أو موضوعاً آخر.', en: 'No matching books. Try an author or another subject.' },
};
export function BookLibrary({ currentLang }: { currentLang: SupportedLanguage }) {
  const L = makeT(currentLang, TEXT);
  const [showGuide, setShowGuide] = useState(false);
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<BookCategory | 'all'>('all');
  const books = useMemo(() => searchBooks(query, category), [query, category]);
  function download() {
    const url = URL.createObjectURL(new Blob([exportLibraryArchive()], { type: 'application/json;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'sham-book-catalogue.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section id="perfume-book-library" aria-labelledby="book-library-title" className="my-8 rounded-2xl border border-amber-500/30 bg-stone-950 p-5 text-stone-100 space-y-5">
    <h2 id="book-library-title" className="text-2xl font-bold text-amber-300">{L('title')}</h2>
    <p>{L('supervision')}</p><p className="text-sm text-stone-300">{L('rights')}</p>
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
      <button onClick={download} className="rounded-lg border border-amber-500 p-3 text-amber-200">{L('download')}</button>
    </div>
    {!books.length && <p role="status">{L('empty')}</p>}
    <div className="grid gap-4 md:grid-cols-2">{books.map(book => <article key={book.id} className="rounded-xl border border-stone-700 p-4 space-y-2">
      <span className="text-xs text-amber-300">{loc(currentLang, BOOK_CATEGORIES[book.category])}</span>
      <h3 lang="en" dir="ltr" className="font-bold text-lg"><button onClick={() => setSelectedBook(book)} className="text-start underline decoration-amber-500/40">{book.title}</button></h3>
      <p lang="en" dir="ltr">{book.authors}</p>{book.publisher && <p lang="en" dir="ltr" className="text-sm">{book.publisher}</p>}
      <p>{loc(currentLang, book.summary)}</p><p className="text-xs text-stone-400">{L('pending')}</p>
      <button onClick={() => setSelectedBook(book)} className="block rounded-lg border border-amber-500 px-3 py-2 text-amber-200">{L('open')}</button>
      <code dir="ltr" className="block text-xs">{book.id}</code>
      <a href={`https://search.worldcat.org/search?q=${encodeURIComponent(book.title + ' ' + book.authors)}`} target="_blank" rel="noopener noreferrer" className="inline-block text-amber-300 underline">{L('source')}</a>
    </article>)}</div>
    {showGuide && <Suspense fallback={<p role="status">{L('loadingReader')}</p>}><EpubReader book={READING_GUIDE} fallbackText={readingGuideText} sourceUrl={epubAssetUrl(READING_GUIDE.file, import.meta.env.BASE_URL)} currentLang={currentLang} onClose={() => setShowGuide(false)} /></Suspense>}
    {selectedBook && <Suspense fallback={<p role="status">{L('loadingReader')}</p>}><EpubReader key={selectedBook.id} book={selectedBook} currentLang={currentLang} onClose={() => setSelectedBook(null)} /></Suspense>}
  </section>;
}
