import React, { useState } from 'react';
import { FileSearch, Loader2, MessageSquare, Search } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { ShaheenMarkdown } from '../components/ShaheenMarkdown';
import { ask, errorKey, readUrl, search, type WsContextFile, type WsSource } from './workspaceApi';
import { ExportMenu } from './ExportMenu';
import { wsText, type WsKey } from './strings';

/** «بحث وتلخيص»: a web search with its sources, and any public page or PDF read and summarised. */
export function SearchPanel({ lang, onToChat }: { lang: SupportedLanguage; onToChat: (file: WsContextFile, question: string) => void }) {
  const w = (k: WsKey) => wsText(lang, k);
  const [q, setQ] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<'' | 'search' | 'read'>('');
  const [found, setFound] = useState<{ answer?: string; results: WsSource[]; kind: 'web' | 'encyclopedia' } | null>(null);
  const [page, setPage] = useState<{ title: string; url: string; text: string; summary: string } | null>(null);
  const [error, setError] = useState('');

  const doSearch = async () => {
    if (!q.trim() || busy) return;
    setBusy('search'); setError(''); setFound(null);
    try { setFound(await search(q.trim(), lang)); } catch (e) { setError(w(errorKey(e))); } finally { setBusy(''); }
  };
  const doRead = async (target = url) => {
    const link = target.trim();
    if (!link || busy) return;
    setBusy('read'); setError(''); setPage(null);
    try {
      const got = await readUrl(link);
      const out = await ask({ messages: [{ role: 'user', text: lang === 'ar' ? 'لخّص المحتوى ده.' : 'Summarise this content.' }], language: lang, task: 'summarize', context: [{ name: got.title || got.url, text: got.text }] });
      setPage({ title: got.title || got.url, url: got.url, text: got.text, summary: out.reply });
    } catch (e) {
      const key = errorKey(e);
      setError(key === 'failed' || key === 'busy' ? `${w('read_failed')}` : w(key));
    } finally { setBusy(''); }
  };

  return (
    <div className="space-y-5" data-testid="ws-search">
      <section className="space-y-2">
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void doSearch(); }} dir="auto" placeholder={w('search_ph')}
            className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500" />
          <button type="button" onClick={() => { void doSearch(); }} disabled={!q.trim() || Boolean(busy)} className="inline-flex items-center gap-1 rounded-xl bg-amber-800 px-4 py-2 text-sm font-black text-white disabled:opacity-50 cursor-pointer">
            {busy === 'search' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{w('search_btn')}
          </button>
        </div>
        {found && (
          <div className="space-y-2">
            {found.kind === 'encyclopedia' && <p className="text-[11px] text-stone-500">{w('encyclopedia_note')}</p>}
            {found.answer && <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3 text-[13px]"><ShaheenMarkdown text={found.answer} /></div>}
            {!found.results.length && !found.answer && <p className="text-sm text-stone-500">{w('no_results')}</p>}
            <ol className="space-y-2">
              {found.results.map((r, i) => (
                <li key={i} className="rounded-xl border border-stone-200 bg-white p-3">
                  <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="font-bold text-amber-900 underline">[{i + 1}] {r.title || r.url}</a>
                  <p className="mt-0.5 break-all text-[11px] text-stone-400" dir="ltr">{r.url}</p>
                  {r.snippet && <p className="mt-1 text-[12.5px] text-stone-700" dir="auto">{r.snippet}</p>}
                  <button type="button" onClick={() => { setUrl(r.url); void doRead(r.url); }} className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-bold text-stone-700 cursor-pointer"><FileSearch className="h-3 w-3" />{w('read_btn')}</button>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <section className="space-y-2 border-t border-stone-200 pt-4">
        <div className="flex gap-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void doRead(); }} dir="ltr" inputMode="url" placeholder={w('url_ph')}
            className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500" />
          <button type="button" onClick={() => { void doRead(); }} disabled={!url.trim() || Boolean(busy)} className="inline-flex items-center gap-1 rounded-xl bg-stone-900 px-4 py-2 text-sm font-black text-white disabled:opacity-50 cursor-pointer">
            {busy === 'read' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}{w('read_btn')}
          </button>
        </div>
        {page && (
          <div className="space-y-2 rounded-2xl border border-stone-200 bg-white p-4">
            <a href={page.url} target="_blank" rel="noopener noreferrer nofollow" className="font-black text-stone-900 underline" dir="auto">{page.title}</a>
            <h3 className="text-sm font-bold text-amber-900">{w('summary')}</h3>
            <div className="text-[13.5px]"><ShaheenMarkdown text={page.summary} /></div>
            <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 pt-2">
              <button type="button" onClick={() => onToChat({ name: page.title.slice(0, 100), text: page.text }, '')} className="inline-flex items-center gap-1 rounded-lg bg-amber-800 px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer"><MessageSquare className="h-3 w-3" />{w('to_chat')}</button>
              <ExportMenu markdown={`# ${page.title}\n\n${page.summary}\n\n${page.url}`} lang={lang} compact />
            </div>
          </div>
        )}
      </section>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-[12.5px] text-rose-900">{error}</p>}
    </div>
  );
}
