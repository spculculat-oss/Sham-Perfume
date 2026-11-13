import React, { lazy, Suspense, useState } from 'react';
import { epubAssetUrl } from './epubAssets';
import { makeT } from '../لغات/localize';
import type { SupportedLanguage } from '../types/i18n';
import conversion from '../../content/library/brilliance-conversion.json';
const EpubReader = lazy(() => import('./EpubReader').then(m => ({ default: m.EpubReader })));
const FILE = 'books/brilliance-science-perfumes.epub';
const TEXT = {
  shelf: { ar: 'كتاب المؤلف — متاح كاملاً', en: 'Author’s book — available in full' },
  author: { ar: 'تأليف مصطفى خليفة', en: 'By Mustafa Khalifa' },
  format: { ar: 'النسخة الإنجليزية • ٣٥٩ صفحة • EPUB ثابت الصفحات • نحو ٥٥ ميجابايت', en: 'English edition • 359 pages • fixed-layout EPUB • about 55 MB' },
  notice: { ar: 'منشور بإذن المؤلف بناءً على طلبه. حافظ التحويل على صفحات PDF وصورها وجداولها دون إعادة صياغة. النسخة مصوّرة وليست نصاً مرناً؛ تصغير الخط أو تكبيره والبحث النصي قد لا يتاحان كنسخ EPUB النصية. التحويل ليس اعتماداً علمياً أو طبياً للمحتوى.', en: 'Published at the author’s request and with their permission. The visual conversion preserves the PDF pages, artwork and tables without rewriting. This image-based edition does not offer the font resizing or text search of a reflowable EPUB. Conversion is not scientific or medical endorsement.' },
  read: { ar: 'اقرأ كتاب مصطفى خليفة', en: 'Read Mustafa Khalifa’s book' },
  download: { ar: 'تنزيل الكتاب EPUB', en: 'Download book EPUB' },
  wait: { ar: 'الملف كبير؛ انتظر اكتمال التحميل. يمكنك أيضاً تنزيله وفتحه بقارئ EPUB يدعم الصفحات الثابتة والتكبير.', en: 'This is a large file; allow time to load. You may also download it for an EPUB reader with fixed-layout and zoom support.' },
  loading: { ar: 'جارٍ تحميل القارئ…', en: 'Loading reader…' },
};
export function AuthorBook({ currentLang }: { currentLang: SupportedLanguage }) {
  const L = makeT(currentLang, TEXT);
  const [open, setOpen] = useState(false);
  const url = epubAssetUrl(FILE, import.meta.env.BASE_URL);
  return <section aria-labelledby="author-book-title" className="rounded-xl border border-amber-400/50 p-5 space-y-3">
    <p className="text-sm text-amber-200">{L('shelf')}</p>
    <h3 id="author-book-title" lang="en" dir="ltr" className="text-xl font-bold">{conversion.title}</h3>
    <p>{L('author')}</p><p className="text-sm text-amber-200">{L('format')}</p>
    <p className="text-sm text-stone-300">{L('notice')}</p>
    <div className="flex flex-wrap gap-3">
      <button onClick={() => setOpen(true)} className="rounded-lg bg-amber-800 px-4 py-3">{L('read')}</button>
      <a href={url} download="the-brilliance-in-the-science-of-perfumes.epub" className="rounded-lg border border-amber-500 px-4 py-3">{L('download')}</a>
    </div>
    <p className="text-sm text-stone-400">{L('wait')}</p>
    {open && <Suspense fallback={<p role="status">{L('loading')}</p>}><EpubReader book={conversion} sourceUrl={url} sourceDescription={`${L('format')}. ${L('wait')}`} currentLang={currentLang} onClose={() => setOpen(false)} /></Suspense>}
  </section>;
}
