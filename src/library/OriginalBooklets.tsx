import React, { lazy, Suspense, useState } from 'react';
import scent from '../../content/library/scent-observation.json';
import evidence from '../../content/library/evidence-notebook.json';
import { epubAssetUrl } from './epubAssets';
import type { SupportedLanguage } from '../types/i18n';
import { makeT } from '../لغات/localize';
const EpubReader = lazy(() => import('./EpubReader').then(m => ({ default: m.EpubReader })));
export const ORIGINAL_BOOKLETS = [
  { text: scent, file: 'books/sham-scent-observation.epub' },
  { text: evidence, file: 'books/sham-evidence-notebook.epub' },
] as const;
const TEXT = {
  title: { ar: 'كتيّبات أصلية متاحة للقراءة', en: 'Original booklets available to read' },
  notice: { ar: 'نصوص عربية تمهيدية أصلية بمساعدة الذكاء الاصطناعي، وليست إعادة صياغة للمراجع المحمية أو مؤلفات معتمدة علمياً. لا تتضمن وصفات علاج أو تصنيع. النص الكامل متاح هنا ومعه ملف EPUB.', en: 'Original introductory Arabic texts created with AI assistance, not rewrites of copyrighted references or scientifically certified works. No treatment or manufacturing recipes. Full text and EPUB are available.' },
  read: { ar: 'اقرأ الكتيّب', en: 'Read booklet' },
  download: { ar: 'تنزيل EPUB', en: 'Download EPUB' },
  loading: { ar: 'جارٍ تحميل القارئ…', en: 'Loading reader…' },
};
export function OriginalBooklets({ currentLang }: { currentLang: SupportedLanguage }) {
  const L = makeT(currentLang, TEXT);
  const [selected, setSelected] = useState<(typeof ORIGINAL_BOOKLETS)[number] | null>(null);
  return <section aria-labelledby="original-booklets-title" className="space-y-4 rounded-xl border border-emerald-500/40 p-4">
    <h3 id="original-booklets-title" className="text-xl font-bold text-emerald-200">{L('title')}</h3>
    <p className="text-sm text-stone-300">{L('notice')}</p>
    <div className="grid gap-4 md:grid-cols-2">{ORIGINAL_BOOKLETS.map(booklet => <article key={booklet.text.id} className="rounded-lg border border-stone-600 p-4 space-y-3">
      <h4 lang="ar" dir="rtl" className="text-lg font-bold">{booklet.text.title}</h4>
      <p lang="ar" dir="rtl" className="text-sm">{booklet.text.description}</p>
      <ul lang="ar" dir="rtl" className="list-disc ps-5 text-sm">{booklet.text.chapters.map(chapter => <li key={chapter.title}>{chapter.title}</li>)}</ul>
      <div className="flex flex-wrap gap-3">
        <button onClick={() => setSelected(booklet)} className="rounded-lg bg-emerald-800 px-4 py-2">{L('read')}</button>
        <a href={epubAssetUrl(booklet.file, import.meta.env.BASE_URL)} download className="rounded-lg border border-emerald-500 px-4 py-2">{L('download')}</a>
      </div>
    </article>)}</div>
    {selected && <Suspense fallback={<p role="status">{L('loading')}</p>}><EpubReader key={selected.text.id} book={selected.text} fallbackText={selected.text} sourceUrl={epubAssetUrl(selected.file, import.meta.env.BASE_URL)} currentLang={currentLang} onClose={() => setSelected(null)} /></Suspense>}
  </section>;
}
