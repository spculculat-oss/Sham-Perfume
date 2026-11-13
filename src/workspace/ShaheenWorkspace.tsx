/**
 * «مساحة شاهين»: Shaheen as a general assistant — open to any subject, not only perfume. Chat with context and
 * files, web search and page/PDF summaries, code that runs with a live preview, the visitor's own files, images
 * drawn and edited, Word/Excel/PowerPoint/PDF documents, read-aloud, multi-step tasks, and links to the services
 * he uses. The heavy parts (documents, Python, the PDF reader) load only when he uses them.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Code2, FolderOpen, Image as ImageIcon, Link2, MessageSquare, Search, Workflow } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../types/i18n';
import { ChatPanel, loadChat, type ChatItem } from './ChatPanel';
import { SearchPanel } from './SearchPanel';
import { CodePanel, STARTERS, type EditorState } from './CodePanel';
import { FilesPanel } from './FilesPanel';
import { ImagesPanel } from './ImagesPanel';
import { AutomationPanel } from './AutomationPanel';
import { ConnectPanel } from './ConnectPanel';
import { serverReachable, workspaceStatus, type WsContextFile, type WsStatus } from './workspaceApi';
import type { CodeBlock, Runnable } from './codeBlocks';
import { wsText, type WsKey } from './strings';

type Tab = 'chat' | 'search' | 'code' | 'files' | 'images' | 'auto' | 'connect';
const TABS: Array<{ id: Tab; key: WsKey; icon: typeof MessageSquare }> = [
  { id: 'chat', key: 'tab_chat', icon: MessageSquare },
  { id: 'search', key: 'tab_search', icon: Search },
  { id: 'code', key: 'tab_code', icon: Code2 },
  { id: 'files', key: 'tab_files', icon: FolderOpen },
  { id: 'images', key: 'tab_images', icon: ImageIcon },
  { id: 'auto', key: 'tab_auto', icon: Workflow },
  { id: 'connect', key: 'tab_connect', icon: Link2 },
];

export default function ShaheenWorkspace({ currentLang }: { currentLang: SupportedLanguage }) {
  const lang = currentLang;
  const w = (k: WsKey) => wsText(lang, k);
  const dir = SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.dir || 'ltr';
  const [tab, setTab] = useState<Tab>('chat');
  const [status, setStatus] = useState<WsStatus | null>(null);
  const [offline, setOffline] = useState(!serverReachable());
  const [items, setItems] = useState<ChatItem[]>(loadChat);
  const [attachments, setAttachments] = useState<WsContextFile[]>([]);
  const [editor, setEditor] = useState<EditorState>({ lang: 'python', code: STARTERS.python });
  const [incomingImage, setIncomingImage] = useState<Blob | null>(null);

  useEffect(() => {
    if (!serverReachable()) return;
    const controller = new AbortController();
    workspaceStatus(controller.signal).then((s) => { setStatus(s); setOffline(false); }, () => { if (!controller.signal.aborted) setOffline(true); });
    return () => controller.abort();
  }, []);

  const openEditor = useCallback((block: CodeBlock | { lang: Runnable; code: string }) => {
    const runnable = 'runnable' in block ? block.runnable : block.lang;
    setEditor({ lang: (runnable as Runnable) || 'python', code: block.code });
    setTab('code');
  }, []);
  const useInChat = useCallback((file: WsContextFile) => {
    setAttachments((prev) => [...prev.filter((f) => f.name !== file.name), file]);
    setTab('chat');
  }, []);
  const lastReply = [...items].reverse().find((m) => m.role === 'assistant' && !m.error)?.text || '';
  const clearIncoming = useCallback(() => setIncomingImage(null), []);

  return (
    <section dir={dir} className="mx-auto max-w-5xl space-y-4" data-testid="shaheen-workspace">
      <header className="rounded-3xl border border-amber-200 bg-gradient-to-br from-stone-900 via-stone-800 to-amber-900 p-5 sm:p-6 text-white shadow-sm">
        <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-black"><span aria-hidden>🦅</span>{w('title')}</h1>
        <p className="mt-1.5 text-sm text-amber-100/90 leading-relaxed">{w('subtitle')}</p>
      </header>
      <nav className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label={w('title')}>
        {TABS.map(({ id, key, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} data-testid={`ws-tab-${id}`}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-black cursor-pointer ${tab === id ? 'bg-amber-800 text-white shadow-xs' : 'border border-stone-200 bg-white text-stone-700 hover:border-amber-400'}`}>
            <Icon className="h-4 w-4" />{w(key)}
          </button>
        ))}
      </nav>
      <div className="rounded-3xl border border-stone-200 bg-stone-50/60 p-3 sm:p-5">
        {tab === 'chat' && <ChatPanel lang={lang} items={items} setItems={setItems} attachments={attachments} setAttachments={setAttachments} onOpenEditor={openEditor} offline={offline} />}
        {tab === 'search' && <SearchPanel lang={lang} onToChat={useInChat} />}
        {tab === 'code' && <CodePanel lang={lang} editor={editor} setEditor={setEditor} />}
        {tab === 'files' && <FilesPanel lang={lang} onUseInChat={useInChat} onOpenCode={(l, code) => openEditor({ lang: l, code })} onEditImage={(b) => { setIncomingImage(b); setTab('images'); }} />}
        {tab === 'images' && <ImagesPanel lang={lang} aiImages={status?.image === 'ai'} incoming={incomingImage} onIncomingUsed={clearIncoming} />}
        {tab === 'auto' && <AutomationPanel lang={lang} />}
        {tab === 'connect' && <ConnectPanel lang={lang} status={status} lastReply={lastReply} onOpenFiles={() => setTab('files')} />}
      </div>
    </section>
  );
}
