/**
 * «مساحة شاهين»: Shaheen as a full general assistant — sleek conversational workspace with saved device-local chat
 * history, light & dark themes, optional full-screen focus, live streaming answers & sources, live visual information
 * display while speaking or chatting, Canvas live preview, code runner, documents, files, images, studio & automation.
 * Heavy tools (documents, Python, PDF reader, Studio, Blocks) load only when opened.
 */
import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { lazyWithReload } from '../utils/lazyRetry';
import {
  Blocks, Code2, FolderOpen, Image as ImageIcon, Link2, Loader2, Maximize2, MessageSquare,
  Minimize2, Moon, PanelLeft, PanelRight, Radio, Search, SquarePen, Sun, Trash2, Wand2, Workflow, X,
} from 'lucide-react';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../types/i18n';
import { formatLocalizedNumber } from '../لغات/numerals';
import { ChatPanel, loadChat, type ChatItem } from './ChatPanel';
import { SearchPanel } from './SearchPanel';
import { CodePanel, STARTERS, type EditorState } from './CodePanel';
import { FilesPanel } from './FilesPanel';
import { ImagesPanel } from './ImagesPanel';
import { AutomationPanel } from './AutomationPanel';
import { ConnectPanel } from './ConnectPanel';
import { LiveInfoPanel, type LiveDisplayState, type LivePanelTab } from './LiveInfoPanel';
import { ShaheenAvatar } from './ShaheenAvatar';
import { extractLiveInfo } from './liveInfo';
import {
  filterThreads, groupThreadsByRecency, loadActiveThreadId, loadLivePanelPref, loadThreads,
  loadWorkspaceTheme, newThreadId, removeThread, saveActiveThreadId, saveLivePanelPref,
  saveThreads, saveWorkspaceTheme, upsertThreadItems,
  type ChatThread, type ThreadGroupKey, type WorkspaceTheme,
} from './threads';
import { checkServer, serverReachable, type WsContextFile, type WsStatus } from './workspaceApi';
import type { CodeBlock, Runnable } from './codeBlocks';
import type { ToolSpec } from '../utils/shaheenToolBuilder';
import { wsText, type WsKey } from './strings';

/** «استوديو شاهين» and «بلوكات شاهين» load only when opened. */
const BlocksPanel = lazyWithReload(() => import('./BlocksPanel'));
const StudioPanel = lazyWithReload(() => import('../studio/StudioPanel'));

type Tab = 'chat' | 'blocks' | 'studio' | 'search' | 'code' | 'files' | 'images' | 'auto' | 'connect';
const TABS: Array<{ id: Tab; key: WsKey; icon: typeof MessageSquare }> = [
  { id: 'chat', key: 'tab_chat', icon: MessageSquare },
  { id: 'blocks', key: 'tab_blocks', icon: Blocks },
  { id: 'studio', key: 'tab_studio', icon: Wand2 },
  { id: 'search', key: 'tab_search', icon: Search },
  { id: 'code', key: 'tab_code', icon: Code2 },
  { id: 'files', key: 'tab_files', icon: FolderOpen },
  { id: 'images', key: 'tab_images', icon: ImageIcon },
  { id: 'auto', key: 'tab_auto', icon: Workflow },
  { id: 'connect', key: 'tab_connect', icon: Link2 },
];

const GROUP_LABEL: Record<ThreadGroupKey, WsKey> = {
  today: 'group_today',
  yesterday: 'group_yesterday',
  week: 'group_week',
  older: 'group_older',
};

const EMPTY_LIVE: LiveDisplayState = {
  text: '',
  sources: [],
  streaming: false,
  stage: '',
  spokenText: '',
  interimSpeech: '',
  voiceActive: false,
  focusedCode: null,
};

function initialChatState(): { threads: ChatThread[]; activeId: string; items: ChatItem[] } {
  const threads = loadThreads();
  const remembered = loadActiveThreadId();
  if (remembered) {
    const match = threads.find((t) => t.id === remembered);
    if (match) return { threads, activeId: match.id, items: match.items };
  }
  if (threads[0]) return { threads, activeId: threads[0].id, items: threads[0].items };
  const fallback = loadChat();
  const id = newThreadId();
  if (fallback.length) {
    const seeded = upsertThreadItems([], id, fallback);
    return { threads: seeded, activeId: id, items: fallback };
  }
  return { threads, activeId: id, items: [] };
}

export default function ShaheenWorkspace({ currentLang }: { currentLang: SupportedLanguage }) {
  const lang = currentLang;
  const w = (k: WsKey) => wsText(lang, k);
  const dir = SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.dir || 'ltr';

  const [init] = useState(initialChatState);
  const [threads, setThreads] = useState<ChatThread[]>(init.threads);
  const [activeThreadId, setActiveThreadId] = useState<string>(init.activeId);
  const [items, setItems] = useState<ChatItem[]>(init.items);
  const [chatQuery, setChatQuery] = useState('');

  const [tab, setTab] = useState<Tab>('chat');
  const [theme, setTheme] = useState<WorkspaceTheme>(loadWorkspaceTheme);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const [liveOpen, setLiveOpen] = useState<boolean>(loadLivePanelPref);
  const [liveTab, setLiveTab] = useState<LivePanelTab>('brief');
  const [liveState, setLiveState] = useState<LiveDisplayState>(EMPTY_LIVE);
  const [focusedCode, setFocusedCode] = useState<CodeBlock | null>(null);

  const [toolDraft, setToolDraft] = useState<ToolSpec | undefined>();
  const [status, setStatus] = useState<WsStatus | null>(null);
  const [offline, setOffline] = useState(!serverReachable());
  const [attachments, setAttachments] = useState<WsContextFile[]>([]);
  const [editor, setEditor] = useState<EditorState>({ lang: 'python', code: STARTERS.python });
  const [incomingImage, setIncomingImage] = useState<Blob | null>(null);

  // Sync finished messages into the multi-thread store.
  useEffect(() => {
    setThreads((prev) => {
      const next = upsertThreadItems(prev, activeThreadId, items);
      saveThreads(next);
      return next;
    });
  }, [items, activeThreadId]);

  useEffect(() => {
    const exists = threads.some((t) => t.id === activeThreadId);
    saveActiveThreadId(exists ? activeThreadId : null);
  }, [activeThreadId, threads]);

  useEffect(() => { saveWorkspaceTheme(theme); }, [theme]);
  useEffect(() => { saveLivePanelPref(liveOpen); }, [liveOpen]);

  // Step floating widgets aside while full-screen mode is active, and exit cleanly on Escape.
  useEffect(() => {
    if (!fullscreen || typeof document === 'undefined') return undefined;
    const prevFocus = document.body.dataset.shamFocus;
    const prevOverflow = document.body.style.overflow;
    document.body.dataset.shamFocus = 'messenger';
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (prevFocus) document.body.dataset.shamFocus = prevFocus;
      else delete document.body.dataset.shamFocus;
    };
  }, [fullscreen]);

  // Keep checking server health so the workspace never stays stuck on «not connected».
  useEffect(() => {
    if (!serverReachable()) return undefined;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let looking = false;
    const look = () => {
      if (looking || controller.signal.aborted) return;
      looking = true;
      clearTimeout(timer);
      checkServer(controller.signal).then((s) => { setStatus(s); setOffline(false); }, () => {
        if (controller.signal.aborted) return;
        setOffline(true);
        timer = setTimeout(look, 20_000);
      }).finally(() => { looking = false; });
    };
    const again = () => { if (document.visibilityState !== 'hidden') look(); };
    look();
    window.addEventListener('online', again);
    document.addEventListener('visibilitychange', again);
    return () => {
      controller.abort();
      clearTimeout(timer);
      window.removeEventListener('online', again);
      document.removeEventListener('visibilitychange', again);
    };
  }, []);

  const reached = useCallback(() => setOffline(false), []);

  const startNewChat = useCallback(() => {
    const id = newThreadId();
    setActiveThreadId(id);
    setItems([]);
    setAttachments([]);
    setFocusedCode(null);
    setLiveState(EMPTY_LIVE);
    setTab('chat');
    setMobileMenuOpen(false);
  }, []);

  const selectThread = useCallback((thread: ChatThread) => {
    setActiveThreadId(thread.id);
    setItems(thread.items);
    setAttachments([]);
    setFocusedCode(null);
    setTab('chat');
    setMobileMenuOpen(false);
  }, []);

  const deleteThread = useCallback((id: string) => {
    setThreads((prev) => {
      const next = removeThread(prev, id);
      saveThreads(next);
      if (id === activeThreadId) {
        if (next[0]) {
          setActiveThreadId(next[0].id);
          setItems(next[0].items);
        } else {
          setActiveThreadId(newThreadId());
          setItems([]);
        }
        setFocusedCode(null);
      }
      return next;
    });
  }, [activeThreadId]);

  const openEditor = useCallback((block: CodeBlock | { lang: Runnable; code: string }) => {
    const runnable = 'runnable' in block ? block.runnable : block.lang;
    setEditor({ lang: (runnable as Runnable) || 'python', code: block.code });
    setTab('code');
  }, []);

  const useInChat = useCallback((file: WsContextFile) => {
    setAttachments((prev) => [...prev.filter((f) => f.name !== file.name), file]);
    setTab('chat');
  }, []);

  const openLivePanel = useCallback((nextTab?: LivePanelTab, code?: CodeBlock) => {
    if (nextTab) setLiveTab(nextTab);
    setFocusedCode(code || null);
    setLiveOpen(true);
  }, []);

  const handleLiveChange = useCallback((next: LiveDisplayState) => {
    setLiveState(next);
    if (next.streaming) setFocusedCode(null);
  }, []);

  const mergedLive = useMemo<LiveDisplayState>(
    () => ({ ...liveState, focusedCode }),
    [liveState, focusedCode],
  );

  const liveSummary = useMemo(
    () => extractLiveInfo(liveState.text, liveState.sources, liveState.image),
    [liveState.text, liveState.sources, liveState.image],
  );

  const liveBadgeCount = liveSummary.sources.length + liveSummary.tables.length + liveSummary.codeBlocks.length + liveSummary.facts.length;
  const livePulsing = Boolean(liveState.streaming || liveState.spokenText || liveState.interimSpeech);

  const filteredThreads = useMemo(() => filterThreads(threads, chatQuery), [threads, chatQuery]);
  const groupedThreads = useMemo(() => groupThreadsByRecency(filteredThreads), [filteredThreads]);

  const lastReply = [...items].reverse().find((m) => m.role === 'assistant' && !m.error)?.text || '';
  const clearIncoming = useCallback(() => setIncomingImage(null), []);

  const toggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileMenuOpen((v) => !v);
    } else {
      setSidebarOpen((v) => !v);
    }
  };

  const sidebarContent = (
    <div className="flex h-full w-[260px] shrink-0 flex-col bg-[var(--ws-sidebar)] text-[var(--ws-ink)]">
      {/* Sidebar top controls */}
      <div className="flex h-12 shrink-0 items-center justify-between px-2.5">
        <button
          type="button"
          onClick={() => { setSidebarOpen(false); setMobileMenuOpen(false); }}
          title={w('toggle_sidebar')}
          aria-label={w('toggle_sidebar')}
          className="grid h-9 w-9 place-items-center rounded-xl text-[var(--ws-muted)] transition hover:bg-[var(--ws-hover)] hover:text-[var(--ws-ink)] cursor-pointer"
        >
          <PanelLeft className="h-4.5 w-4.5" />
        </button>
        <button
          type="button"
          onClick={startNewChat}
          title={w('new_chat')}
          aria-label={w('new_chat')}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[13px] font-medium text-[var(--ws-ink)] transition hover:bg-[var(--ws-hover)] cursor-pointer"
        >
          <SquarePen className="h-4 w-4" />
          <span>{w('new_chat')}</span>
        </button>
      </div>

      {/* Chat search input */}
      <div className="px-2.5 pb-2">
        <div className="flex items-center gap-2 rounded-xl border border-[var(--ws-border)] bg-[var(--ws-bg)] px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-[var(--ws-muted)]" aria-hidden="true" />
          <input
            type="text"
            value={chatQuery}
            onChange={(e) => setChatQuery(e.target.value)}
            dir="auto"
            placeholder={w('search_chats')}
            aria-label={w('search_chats')}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-[var(--ws-ink)] placeholder:text-[var(--ws-muted)] outline-none"
          />
          {chatQuery && (
            <button
              type="button"
              onClick={() => setChatQuery('')}
              aria-label={w('close')}
              className="text-[var(--ws-muted)] hover:text-[var(--ws-ink)] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Grouped conversation history */}
      <div className="flex-1 space-y-4 overflow-y-auto px-2 py-1.5">
        {groupedThreads.length === 0 ? (
          <p className="px-2.5 py-6 text-center text-[12px] leading-relaxed text-[var(--ws-muted)]">
            {chatQuery.trim() ? w('no_chat_match') : w('no_chats')}
          </p>
        ) : (
          groupedThreads.map(({ group, threads: list }) => (
            <div key={group} className="space-y-0.5">
              <p className="px-2.5 py-1 text-[11px] font-semibold text-[var(--ws-muted)]">{w(GROUP_LABEL[group])}</p>
              {list.map((thread) => {
                const selected = tab === 'chat' && thread.id === activeThreadId;
                return (
                  <div
                    key={thread.id}
                    className={`group flex items-center gap-1 rounded-xl pe-1 transition ${
                      selected ? 'bg-[var(--ws-hover)] text-[var(--ws-ink)]' : 'text-[var(--ws-ink-soft)] hover:bg-[var(--ws-hover)]/70 hover:text-[var(--ws-ink)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => selectThread(thread)}
                      dir="auto"
                      className="min-w-0 flex-1 truncate px-2.5 py-2 text-start text-[13px] font-normal cursor-pointer"
                    >
                      {thread.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteThread(thread.id)}
                      title={w('delete')}
                      aria-label={w('delete')}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[var(--ws-muted)] opacity-0 transition hover:bg-[var(--ws-bg)] hover:text-rose-500 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Bottom connection & appearance row */}
      <div className="flex shrink-0 items-center justify-between border-t border-[var(--ws-border)] px-3 py-2.5 text-[12px]">
        <span className="inline-flex min-w-0 items-center gap-2 truncate text-[var(--ws-muted)]">
          <span className={`h-2 w-2 shrink-0 rounded-full ${offline ? 'bg-amber-500' : 'bg-emerald-500'}`} aria-hidden="true" />
          <span className="truncate">{offline ? w('reconnecting') : w('status_online')}</span>
        </span>
        <button
          type="button"
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          title={w(theme === 'dark' ? 'theme_light' : 'theme_dark')}
          aria-label={w(theme === 'dark' ? 'theme_light' : 'theme_dark')}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--ws-muted)] transition hover:bg-[var(--ws-hover)] hover:text-[var(--ws-ink)] cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <section
      dir={dir}
      data-testid="shaheen-workspace"
      data-ws-theme={theme}
      className={
        fullscreen
          ? 'sham-ws fixed inset-0 z-50 flex overflow-hidden bg-[var(--ws-bg)] text-[var(--ws-ink)]'
          : 'sham-ws relative mx-auto flex min-h-0 w-full max-w-[92rem] flex-1 overflow-hidden rounded-3xl border border-[var(--ws-border)] bg-[var(--ws-bg)] text-[var(--ws-ink)] shadow-xs'
      }
    >
      {/* Desktop persistent sidebar */}
      {sidebarOpen && (
        <div className="hidden h-full shrink-0 border-e border-[var(--ws-border)] lg:block">
          {sidebarContent}
        </div>
      )}

      {/* Mobile slide-over history drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label={w('history')}>
          <div className="relative z-10 h-full border-e border-[var(--ws-border)] shadow-2xl">
            {sidebarContent}
          </div>
          <button
            type="button"
            aria-label={w('close')}
            onClick={() => setMobileMenuOpen(false)}
            className="flex-1 bg-black/40 backdrop-blur-[1px] cursor-pointer"
          />
        </div>
      )}

      {/* Main workspace column */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Clean top bar */}
        <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-[var(--ws-border)] bg-[var(--ws-bg)] px-2.5 sm:px-4">
          <button
            type="button"
            onClick={toggleSidebar}
            title={w('toggle_sidebar')}
            aria-label={w('toggle_sidebar')}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[var(--ws-muted)] transition hover:bg-[var(--ws-hover)] hover:text-[var(--ws-ink)] cursor-pointer ${sidebarOpen ? 'lg:hidden' : ''}`}
          >
            <PanelLeft className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            onClick={startNewChat}
            title={w('new_chat')}
            aria-label={w('new_chat')}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[var(--ws-muted)] transition hover:bg-[var(--ws-hover)] hover:text-[var(--ws-ink)] cursor-pointer ${sidebarOpen ? 'lg:hidden' : ''}`}
          >
            <SquarePen className="h-4 w-4" />
          </button>

          <div className="flex min-w-0 items-center gap-2 px-1">
            <ShaheenAvatar size="sm" active={liveState.streaming} speaking={Boolean(liveState.spokenText)} />
            <h1 className="truncate text-[15px] font-semibold text-[var(--ws-ink)]">{w('title')}</h1>
          </div>

          <span className="flex-1" />

          {/* Live Info / Canvas split-screen toggle */}
          {tab === 'chat' && (
            <button
              type="button"
              data-testid="ws-live-toggle"
              aria-pressed={liveOpen}
              title={w('live_panel_hint')}
              onClick={() => setLiveOpen((v) => !v)}
              className={`inline-flex h-8.5 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition cursor-pointer ${
                liveOpen
                  ? 'border-[var(--ws-cta-bg)] bg-[var(--ws-cta-bg)] text-[var(--ws-cta-ink)]'
                  : 'border-[var(--ws-border)] bg-[var(--ws-surface)] text-[var(--ws-ink-soft)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-ink)]'
              }`}
            >
              {livePulsing ? (
                <Radio className={`h-3.5 w-3.5 shrink-0 ${liveOpen ? 'text-emerald-400' : 'text-emerald-500'} motion-safe:animate-pulse`} />
              ) : (
                <PanelRight className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="hidden sm:inline">{w('live_panel')}</span>
              {liveBadgeCount > 0 && (
                <span className={`rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
                  liveOpen ? 'bg-white/20 text-current' : 'bg-[var(--ws-hover)] text-[var(--ws-ink)]'
                }`}>
                  {formatLocalizedNumber(lang, liveBadgeCount)}
                </span>
              )}
            </button>
          )}

          {/* Theme switch */}
          <button
            type="button"
            data-testid="ws-theme-toggle"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title={w(theme === 'dark' ? 'theme_light' : 'theme_dark')}
            aria-label={w(theme === 'dark' ? 'theme_light' : 'theme_dark')}
            className="grid h-8.5 w-8.5 shrink-0 place-items-center rounded-xl text-[var(--ws-muted)] transition hover:bg-[var(--ws-hover)] hover:text-[var(--ws-ink)] cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Full-screen toggle */}
          <button
            type="button"
            data-testid="ws-fullscreen-toggle"
            aria-pressed={fullscreen}
            onClick={() => setFullscreen((v) => !v)}
            title={w(fullscreen ? 'fullscreen_exit' : 'fullscreen_enter')}
            aria-label={w(fullscreen ? 'fullscreen_exit' : 'fullscreen_enter')}
            className="grid h-8.5 w-8.5 shrink-0 place-items-center rounded-xl text-[var(--ws-muted)] transition hover:bg-[var(--ws-hover)] hover:text-[var(--ws-ink)] cursor-pointer"
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </header>

        {/* Minimalist single-row workspace tools bar (always directly accessible on desktop & mobile) */}
        <nav
          className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--ws-border)] bg-[var(--ws-bg)] px-2.5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-4"
          role="tablist"
          aria-label={w('title')}
        >
          {TABS.map(({ id, key, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                data-testid={`ws-tab-${id}`}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition cursor-pointer ${
                  active
                    ? 'bg-[var(--ws-cta-bg)] text-[var(--ws-cta-ink)] shadow-2xs'
                    : 'text-[var(--ws-muted)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-ink)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{w(key)}</span>
              </button>
            );
          })}
        </nav>

        {/* Content body + optional split-screen Live Info / Canvas panel */}
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {tab === 'chat' ? (
              <ChatPanel
                lang={lang}
                items={items}
                setItems={setItems}
                attachments={attachments}
                setAttachments={setAttachments}
                onOpenEditor={openEditor}
                onOpenBlocks={(tool) => { setToolDraft(tool); setTab('blocks'); }}
                offline={offline}
                onReached={reached}
                onOpenLivePanel={openLivePanel}
                onLiveChange={handleLiveChange}
              />
            ) : (
              <div className="sham-ws-tool flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-6">
                <div className="mx-auto max-w-5xl">
                  {tab === 'studio' && (
                    <Suspense fallback={<p className="flex items-center gap-2 p-4 text-sm text-[var(--ws-muted)]"><Loader2 className="h-4 w-4 animate-spin" />…</p>}>
                      <StudioPanel lang={lang} ai={Boolean(status?.ai) && !offline} onOpenCode={(code) => openEditor({ lang: 'html', code })} />
                    </Suspense>
                  )}
                  {tab === 'search' && <SearchPanel lang={lang} onToChat={useInChat} />}
                  {tab === 'blocks' && (
                    <Suspense fallback={<p className="flex items-center gap-2 p-4 text-sm text-[var(--ws-muted)]"><Loader2 className="h-4 w-4 animate-spin" />…</p>}>
                      <BlocksPanel lang={lang} initialTool={toolDraft} />
                    </Suspense>
                  )}
                  {tab === 'code' && <CodePanel lang={lang} editor={editor} setEditor={setEditor} />}
                  {tab === 'files' && <FilesPanel lang={lang} onUseInChat={useInChat} onOpenCode={(l, code) => openEditor({ lang: l, code })} onEditImage={(b) => { setIncomingImage(b); setTab('images'); }} />}
                  {tab === 'images' && <ImagesPanel lang={lang} aiImages={status?.image === 'ai'} incoming={incomingImage} onIncomingUsed={clearIncoming} />}
                  {tab === 'auto' && <AutomationPanel lang={lang} />}
                  {tab === 'connect' && <ConnectPanel lang={lang} status={status} lastReply={lastReply} onOpenFiles={() => setTab('files')} />}
                </div>
              </div>
            )}
          </div>

          {/* Desktop side-by-side Live Info / Canvas panel */}
          {tab === 'chat' && liveOpen && (
            <>
              <div className="hidden h-full w-[370px] shrink-0 xl:block 2xl:w-[420px]">
                <LiveInfoPanel
                  lang={lang}
                  state={mergedLive}
                  tab={liveTab}
                  onTab={setLiveTab}
                  onClose={() => setLiveOpen(false)}
                  onOpenEditor={openEditor}
                />
              </div>
              {/* Tablet / mobile slide-over Live Info drawer */}
              <div className="fixed inset-0 z-50 flex justify-end xl:hidden" role="dialog" aria-modal="true" aria-label={w('live_panel')}>
                <button
                  type="button"
                  aria-label={w('close')}
                  onClick={() => setLiveOpen(false)}
                  className="flex-1 bg-black/40 backdrop-blur-[1px] cursor-pointer"
                />
                <div className="relative z-10 h-full w-[min(92vw,400px)] shadow-2xl">
                  <LiveInfoPanel
                    lang={lang}
                    state={mergedLive}
                    tab={liveTab}
                    onTab={setLiveTab}
                    onClose={() => setLiveOpen(false)}
                    onOpenEditor={openEditor}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
