import React, { useEffect, useRef, useState } from 'react';
import type Book from 'epubjs/types/book';
import type Rendition from 'epubjs/types/rendition';
import type { SupportedLanguage } from '../types/i18n';
import { makeT } from '../لغات/localize';

const TEXT = {
  close: { ar: 'إغلاق القارئ', en: 'Close reader' },
  attached: { ar: 'نسخة متاحة للقراءة المباشرة. هذا دليل تمهيدي أصلي قصير، وليس نسخة من المراجع العلمية أو اعتماداً لمحتواها.', en: 'Available for immediate reading. This is a short original introductory guide, not a copy or scientific endorsement of the reference books.' },
  missing: { ar: 'لا يوجد ملف EPUB مرفق لهذا المرجع. اختر نسختك المسموح لك بقراءتها؛ فتح الملف لا يرفعه للموقع ولا يحوله لنسخة منشورة.', en: 'No EPUB is attached to this reference. Choose a copy you are entitled to read; opening a file does not upload or publish it.' },
  choose: { ar: 'فتح ملف EPUB من جهازك', en: 'Open an EPUB from your device' },
  loading: { ar: 'جارٍ فتح الكتاب…', en: 'Opening book…' },
  error: { ar: 'تعذر فتح الملف. اختر EPUB صالحاً غير محمي بتشفير DRM، بحجم لا يزيد عن ٢٠ ميجابايت.', en: 'Unable to open this file. Choose a valid, DRM-free EPUB no larger than 20 MB.' },
  prev: { ar: 'الصفحة السابقة', en: 'Previous page' },
  next: { ar: 'الصفحة التالية', en: 'Next page' },
  toc: { ar: 'فهرس المحتويات', en: 'Table of contents' },
};
export const MAX_EPUB_BYTES = 20 * 1024 * 1024;
export function validEpubFile(file: Pick<File, 'name' | 'size'>): boolean {
  return /\.epub$/i.test(file.name) && file.size > 0 && file.size <= MAX_EPUB_BYTES;
}
export function EpubReader({ book, sourceUrl, currentLang, onClose }: { book: { title: string }; sourceUrl?: string; currentLang: SupportedLanguage; onClose: () => void }) {
  const L = makeT(currentLang, TEXT);
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const rendition = useRef<Rendition | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'empty' | 'loading' | 'ready' | 'error'>('empty');
  const [toc, setToc] = useState<Array<{ id: string; label: string; href: string }>>([]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.showModal();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);

  useEffect(() => {
    if (!file && !sourceUrl) return;
    const controller = new AbortController();
    let cancelled = false;
    let instance: Book | undefined;
    let timer: ReturnType<typeof setTimeout>;
    setStatus('loading'); setToc([]);
    const fail = () => { if (!cancelled) setStatus('error'); };
    timer = setTimeout(fail, 30000);
    void (async () => {
      try {
        const load = async () => {
          if (file) return file.arrayBuffer();
          const response = await fetch(sourceUrl!, { signal: controller.signal, credentials: 'same-origin' });
          if (!response.ok) throw new Error('EPUB unavailable');
          const data = await response.arrayBuffer();
          if (data.byteLength > MAX_EPUB_BYTES || data.byteLength === 0) throw new Error('EPUB size invalid');
          return data;
        };
        const [{ default: ePub }, data] = await Promise.all([import('epubjs'), load()]);
        if (cancelled || !viewport.current) return;
        instance = ePub({ replacements: 'blobUrl' });
        // Apply restrictions before chapter markup enters its sandboxed iframe.
        instance.spine.hooks.content.register((doc: Document) => {
          doc.querySelectorAll('script, iframe, frame, object, embed, form, base, meta[http-equiv]').forEach(node => node.remove());
          const policy = doc.createElement('meta');
          policy.setAttribute('http-equiv', 'Content-Security-Policy');
          policy.setAttribute('content', "default-src 'none'; img-src blob: data:; style-src 'unsafe-inline' blob: data:; font-src blob: data:; media-src blob: data:; script-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'");
          doc.querySelector('head')?.prepend(policy);
        });
        // ZIP parsing errors can reject both the open call and the opened promise.
        void instance.opened.catch(fail);
        await instance.open(data, 'binary');
        if (cancelled) return;
        const view = instance.renderTo(viewport.current, { width: '100%', height: '100%', spread: 'none', allowScriptedContent: false });
        rendition.current = view;
        view.on('displayError', fail);
        const navigation = await instance.loaded.navigation;
        if (cancelled) return;
        setToc(navigation.toc.flatMap(function flatten(item): Array<{ id: string; label: string; href: string }> {
          return [{ id: item.id, label: item.label, href: item.href }, ...(item.subitems || []).flatMap(flatten)];
        }));
        await view.display();
        if (!cancelled) { clearTimeout(timer); setStatus('ready'); }
      } catch { fail(); }
    })();
    return () => {
      cancelled = true; controller.abort(); clearTimeout(timer); rendition.current = null;
      try { instance?.destroy(); } catch { /* A partially parsed file may not have a spine. */ }
      viewport.current?.replaceChildren();
    };
  }, [file, sourceUrl]);
  function navigate(action: 'prev' | 'next' | string) {
    const view = rendition.current;
    if (!view) return;
    const result = action === 'prev' ? view.prev() : action === 'next' ? view.next() : view.display(action);
    void Promise.resolve(result).catch(() => setStatus('error'));
  }
  return <dialog ref={dialog} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-labelledby="epub-title"
    className="m-auto w-[96vw] max-w-6xl h-[92dvh] max-h-[92dvh] rounded-2xl border border-stone-600 bg-stone-950 text-stone-100 p-0 backdrop:bg-black/80">
    <div className="flex h-full flex-col gap-3 p-4">
      <header className="flex items-start justify-between gap-3"><h2 id="epub-title" dir="auto" className="font-bold">{book.title}</h2>
        <button autoFocus onClick={onClose} className="shrink-0 rounded border border-stone-500 p-2">{L('close')}</button></header>
      <p className="text-sm text-stone-300">{L(sourceUrl && !file ? 'attached' : 'missing')}</p>
      <label className="text-sm">{L('choose')}<input type="file" accept=".epub,application/epub+zip" className="block max-w-full mt-2" onChange={e => {
        const selected = e.target.files?.[0]; e.target.value = '';
        if (!selected) return;
        setFile(null); setToc([]);
        if (!validEpubFile(selected)) { setStatus('error'); return; }
        setFile(selected);
      }} /></label>
      {status === 'loading' && <p role="status">{L('loading')}</p>}
      {status === 'error' && <p role="alert" className="text-amber-300">{L('error')}</p>}
      <nav aria-label={L('toc')} className="flex flex-wrap gap-2">
        <button disabled={status !== 'ready'} onClick={() => navigate('prev')} className="rounded border p-2 disabled:opacity-40">{L('prev')}</button>
        <button disabled={status !== 'ready'} onClick={() => navigate('next')} className="rounded border p-2 disabled:opacity-40">{L('next')}</button>
        <select aria-label={L('toc')} disabled={status !== 'ready'} value="" onChange={e => navigate(e.target.value)} className="min-w-0 max-w-full flex-1 rounded border bg-stone-900 p-2">
          <option value="" disabled>{L('toc')}</option>{toc.map((item, i) => <option key={`${item.id}-${i}`} value={item.href}>{item.label}</option>)}
        </select>
      </nav>
      <div ref={viewport} dir="ltr" className="min-h-0 flex-1 rounded bg-white overflow-hidden" style={{ visibility: status === 'ready' || status === 'loading' ? 'visible' : 'hidden' }} />
    </div>
  </dialog>;
}
