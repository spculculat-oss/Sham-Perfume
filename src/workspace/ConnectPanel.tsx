import React, { useState } from 'react';
import { ExternalLink, Loader2, Lock } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { errorKey, notionPage, notionSearch, ownerSignedIn, slackSend, type WsStatus } from './workspaceApi';
import { parseMarkdown } from './markdownDoc';
import { wsText, type WsKey } from './strings';

/**
 * «ربط الخدمات»: Google Drive and GitHub through the visitor's own accounts (download/upload and links — the site
 * never asks for his passwords); Notion and Slack for the owner only, through keys kept on the server.
 */
export function ConnectPanel({ lang, status, lastReply, onOpenFiles }: { lang: SupportedLanguage; status: WsStatus | null; lastReply: string; onOpenFiles: () => void }) {
  const w = (k: WsKey) => wsText(lang, k);
  const owner = ownerSignedIn();
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Array<{ title: string; url: string }>>([]);
  const act = async (id: string, fn: () => Promise<string | void>) => {
    setBusy(id); setNote('');
    try { const out = await fn(); setNote(out || w('sent')); } catch (e) { setNote(errorKey(e) === 'busy' ? w('not_configured') : w(errorKey(e))); } finally { setBusy(''); }
  };
  const card = (emoji: string, title: string, body: React.ReactNode) => (
    <article className="space-y-2 rounded-2xl border border-stone-200 bg-white p-4">
      <h3 className="flex items-center gap-2 font-black text-stone-900"><span className="text-xl" aria-hidden>{emoji}</span>{title}</h3>
      {body}
    </article>
  );
  const link = (href: string, label: string) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-2.5 py-1 text-[12px] font-bold text-stone-700 hover:border-amber-500"><ExternalLink className="h-3 w-3" />{label}</a>
  );
  const ownerGate = (enabled: boolean | undefined, body: React.ReactNode) => (!owner
    ? <p className="flex items-center gap-1 text-[12px] text-stone-500"><Lock className="h-3 w-3" />{w('owner_only')} — {w('owner_note')}</p>
    : !enabled ? <p className="text-[12px] text-stone-500">{w('not_configured')}</p> : body);

  return (
    <div className="space-y-3" data-testid="ws-connect">
      <p className="text-[12.5px] text-stone-600">{w('connect_intro')}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {card('🗂️', 'Google Drive', <>
          <p className="text-[12.5px] text-stone-600">{w('drive_desc')}</p>
          <div className="flex flex-wrap gap-2">{link('https://drive.google.com/drive/my-drive', `${w('open')} Drive`)}<button type="button" onClick={onOpenFiles} className="rounded-lg bg-amber-800 px-2.5 py-1 text-[12px] font-bold text-white cursor-pointer">{w('tab_files')}</button></div>
        </>)}
        {card('🐙', 'GitHub', <>
          <p className="text-[12.5px] text-stone-600">{w('github_desc')}</p>
          <div className="flex flex-wrap gap-2">{link('https://gist.github.com/', 'Gist')}{link('https://github.com/new', `${w('open')} GitHub`)}</div>
        </>)}
        {card('📝', `Notion · ${w('owner_only')}`, ownerGate(status?.notion, <div className="space-y-2">
          <button type="button" disabled={!lastReply || Boolean(busy)} onClick={() => { void act('notion', async () => { const r = await notionPage(parseMarkdown(lastReply, w('title')).title, lastReply); return r.url ? `${w('saved')} ${r.url}` : w('saved'); }); }} className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-2.5 py-1 text-[12px] font-bold text-white disabled:opacity-50 cursor-pointer">{busy === 'notion' && <Loader2 className="h-3 w-3 animate-spin" />}{w('notion_save')}</button>
          <div className="flex gap-1.5">
            <input value={q} onChange={(e) => setQ(e.target.value)} dir="auto" className="min-w-0 flex-1 rounded-lg border border-stone-300 px-2 py-1 text-[12px]" aria-label={w('notion_search')} />
            <button type="button" disabled={!q.trim() || Boolean(busy)} onClick={() => { void act('nsearch', async () => { const r = await notionSearch(q.trim()); setFound(r.results); return r.results.length ? ' ' : w('no_results'); }); }} className="rounded-lg border border-stone-300 px-2.5 py-1 text-[12px] font-bold disabled:opacity-50 cursor-pointer">{w('notion_search')}</button>
          </div>
          {found.length > 0 && <ul className="space-y-0.5 text-[12px]">{found.map((f, i) => <li key={i}><a href={f.url} target="_blank" rel="noopener noreferrer" className="text-amber-800 underline">{f.title}</a></li>)}</ul>}
        </div>))}
        {card('💬', `Slack · ${w('owner_only')}`, ownerGate(status?.slack, (
          <button type="button" disabled={!lastReply || Boolean(busy)} onClick={() => { void act('slack', async () => { await slackSend(lastReply); }); }} className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-2.5 py-1 text-[12px] font-bold text-white disabled:opacity-50 cursor-pointer">{busy === 'slack' && <Loader2 className="h-3 w-3 animate-spin" />}{w('slack_send')}</button>
        )))}
      </div>
      {note.trim() && <p className="break-all rounded-xl bg-stone-100 p-2.5 text-[12px] text-stone-700">{note}</p>}
    </div>
  );
}
