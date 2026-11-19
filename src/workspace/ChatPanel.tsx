import { blockBuilderReply, toolFromReply, type ToolSpec } from '../utils/shaheenToolBuilder';
import { realPhotoReply } from '../utils/realPhotos';
import { extractMediaRequest, stripMediaBlock } from '../utils/shaheenMedia';
import { ShaheenMedia } from '../components/ShaheenMedia';
import { MotionCard } from './MotionCard';
import { wantsMotion, fitForUpload } from './motion';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, Brain, Check, Code2, Copy, Download, FileText, Globe,
  Image as ImageIcon, Loader2, PanelRightOpen, Paperclip, Pencil, RotateCcw,
  Save, Square, Table2, Upload, Volume2, VolumeX, X,
} from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { ShaheenMarkdown } from '../components/ShaheenMarkdown';
import { readAloud } from '../utils/readAloud';
import {
  askStream, errorKey, serverReachable, imageErrorKey, isGeneratedImageData,
  type WsContextFile, type WsSource,
} from './workspaceApi';
import { imageRequest, segments, stripImageRequest, type CodeBlock } from './codeBlocks';
import { parseImageRequest } from '../utils/imageCraft';
import { drawOrPaint } from './paint';
import { CodeCard } from './CodeCard';
import { ExportMenu } from './ExportMenu';
import { MAX_FILE_BYTES, saveFile } from './fileStore';
import { isPictureFile, pickAttachment, readPictureText, readScannedPages } from '../utils/attachmentPick';
import { fileText } from './fileText';
import { safeFileName } from './officeWriters';
import { parseMarkdown } from './markdownDoc';
import { wsText, type WsKey } from './strings';
import { pickArEn } from '../لغات/localize';
import { useSmoothText } from '../hooks/useSmoothText';
import { useShaheenVoiceMode, type ShaheenVoiceMessage } from '../hooks/useShaheenVoiceMode';
import { ShaheenVoiceModeButton } from '../components/ShaheenVoiceModeButton';
import { ShaheenVoiceStage } from '../components/ShaheenVoiceStage';
import { askMessages } from '../utils/heardFix';
import { ShaheenAvatar } from './ShaheenAvatar';
import {
  LiveStageIndicator, SourcePills, VoiceLiveInfoBoard,
  type LiveDisplayState, type LivePanelTab,
} from './LiveInfoPanel';
import { extractLiveInfo } from './liveInfo';

/**
 * «صوت شاهين في المساحة»: the same voice conversation as the site chat sees the workspace chat as finished turns
 * (a reply still being written is not spoken yet; it is read once it is whole). Items without an id get their place.
 */
export function voiceTurns(items: readonly ChatItem[]): ShaheenVoiceMessage[] {
  return items.flatMap((item, index) => (item.streaming ? [] : [{ id: item.id || `ws-${item.role}-${index}`, role: item.role, text: stripImageRequest(item.text) }]));
}

export interface ChatItem {
  role: 'user' | 'assistant';
  text: string;
  sources?: WsSource[];
  image?: string;
  files?: string[];
  error?: boolean;
  regenerateImage?: boolean;
  painted?: 'whole' | 'partial';
  imageNote?: ReturnType<typeof imageErrorKey>;
  /** The reply is still being written (never saved in this state). */
  streaming?: boolean;
  id?: string;
}

const STORE_KEY = 'sham_workspace_chat_v1';
export function loadChat(): ChatItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    return Array.isArray(raw)
      ? raw.filter((item: ChatItem) => !item.streaming).slice(-60).map((item: ChatItem) => (item.image && !isGeneratedImageData(item.image) ? { ...item, image: undefined, regenerateImage: true } : item))
      : [];
  } catch { return []; }
}
function storeChat(items: ChatItem[]) {
  // Big generated images (data URLs) stay for this visit only.
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(items.filter((m) => !m.streaming).slice(-60).map((m) => (m.image && m.image.length > 150_000 ? { ...m, image: undefined } : m))));
  } catch { /* full or blocked */ }
}

/** One reply's text. Streams at a steady natural pace with a live caret, inline citations, and spoken-sentence glow. */
function LiveReply({ text, streaming, lang, sources, spokenText, onOpenEditor, onOpenCanvas, onAskFix, onGrow }: {
  text: string;
  streaming: boolean;
  lang: SupportedLanguage;
  sources?: readonly WsSource[];
  spokenText?: string;
  onOpenEditor: (block: CodeBlock) => void;
  onOpenCanvas?: (block: CodeBlock) => void;
  onAskFix: (block: CodeBlock, error: string) => void;
  onGrow: () => void;
}) {
  const shown = useSmoothText(text, streaming, { polish: true });
  const writing = streaming || shown.length < text.length;
  useEffect(() => { if (writing) onGrow(); }, [shown.length, writing, onGrow]);
  const clean = stripMediaBlock(stripImageRequest(shown));
  const parts = segments(clean);
  if (!clean.trim()) return null;
  return (
    <div className="min-w-0 space-y-2">
      {parts.map((s, j) => (s.kind === 'text'
        ? <ShaheenMarkdown key={j} text={s.text} variant="workspace" sources={sources} spokenText={spokenText} />
        : <CodeCard key={j} block={s.block} lang={lang} index={j + 1} onOpenEditor={onOpenEditor} onOpenCanvas={onOpenCanvas} onAskFix={onAskFix} />))}
      {writing && <span data-testid="ws-writing" className="sham-ws-caret" aria-hidden="true" />}
    </div>
  );
}

export function ChatPanel({
  lang, items, setItems, attachments, setAttachments, onOpenEditor, onOpenBlocks,
  offline, onReached, onOpenLivePanel, onLiveChange,
}: {
  lang: SupportedLanguage;
  items: ChatItem[];
  setItems: React.Dispatch<React.SetStateAction<ChatItem[]>>;
  attachments: WsContextFile[];
  setAttachments: React.Dispatch<React.SetStateAction<WsContextFile[]>>;
  onOpenEditor: (block: CodeBlock) => void;
  onOpenBlocks?: (tool: ToolSpec) => void;
  offline: boolean;
  onReached?: () => void;
  onOpenLivePanel?: (tab?: LivePanelTab, code?: CodeBlock, itemIndex?: number) => void;
  onLiveChange?: (state: LiveDisplayState) => void;
}) {
  const w = (k: WsKey) => wsText(lang, k);
  const [input, setInput] = useState('');
  const [web, setWeb] = useState(false);
  // «فكّر بعمق»: a private plan first and a check before sending (server/workspace.ts → src/utils/thinkingCraft.ts).
  const [deep, setDeep] = useState(() => { try { return localStorage.getItem('sham_workspace_deep_v1') === '1'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('sham_workspace_deep_v1', deep ? '1' : '0'); } catch { /* blocked */ } }, [deep]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<'thinking' | 'searching_web' | 'writing' | 'deep_thinking' | 'reviewing' | 'drawing'>('thinking');
  const [flash, setFlash] = useState<{ i: number; text: string } | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [exportOpenIdx, setExportOpenIdx] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [listenChunk, setListenChunk] = useState('');
  const [dragging, setDragging] = useState(false);
  const [showJumpDown, setShowJumpDown] = useState(false);
  const [inspectedIdx, setInspectedIdx] = useState<number | null>(null);
  const stopSpeech = useRef<(() => void) | null>(null);
  const abort = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { storeChat(items); }, [items]);
  useEffect(() => () => { abort.current?.abort(); stopSpeech.current?.(); }, []);

  // Auto-size composer textarea cleanly up to 200px.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(200, Math.max(44, el.scrollHeight))}px`;
  }, [input]);

  const scrollToEnd = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const box = scrollRef.current;
    if (box) {
      box.scrollTo({ top: box.scrollHeight, behavior });
      setShowJumpDown(false);
      return;
    }
    endRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  useEffect(() => {
    if (items.length) scrollToEnd('smooth');
  }, [items.length, busy, scrollToEnd]);

  // While a reply streams, gently keep the newest line visible if the visitor has not scrolled up to read earlier lines.
  const follow = useCallback(() => {
    const box = scrollRef.current;
    if (!box) return;
    const distance = box.scrollHeight - box.scrollTop - box.clientHeight;
    if (distance < 180) box.scrollTo({ top: box.scrollHeight, behavior: 'auto' });
  }, []);

  const handleScroll = useCallback(() => {
    const box = scrollRef.current;
    if (!box) return;
    const distance = box.scrollHeight - box.scrollTop - box.clientHeight;
    setShowJumpDown(distance > 220);
  }, []);

  const say = (i: number, text: string) => { setFlash({ i, text }); setTimeout(() => setFlash(null), 1800); };
  const copyText = (i: number, text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx((cur) => (cur === i ? null : cur)), 1800);
    }, () => undefined);
  };

  // The voice conversation (src/hooks/useShaheenVoiceMode.ts): what he says goes through `send` like typed text.
  const voiceSendRef = useRef<(text: string) => Promise<boolean>>(async () => false);
  const voiceMessages = useMemo(() => voiceTurns(items), [items]);
  const voice = useShaheenVoiceMode({
    language: lang,
    messages: voiceMessages,
    isLoading: busy,
    disabled: !serverReachable(),
    onSend: (text) => voiceSendRef.current(text),
    onAsk: (heard, question) => setItems((list) => [...list, ...askMessages(heard, question, lang).map((m) => ({ id: m.id, role: m.role, text: m.text }))]),
  });
  useEffect(() => {
    if (voice.active) {
      stopSpeech.current?.();
      setSpeaking(null);
      setListenChunk('');
    }
  }, [voice.active]);

  // Find the active assistant reply for live display (streaming → spoken → visitor-inspected → latest).
  const lastAssistantIdx = useMemo(() => {
    for (let k = items.length - 1; k >= 0; k -= 1) {
      if (items[k]?.role === 'assistant' && !items[k]?.error) return k;
    }
    return -1;
  }, [items]);

  // Reset inspection focus when a new turn starts so live streaming always takes center stage.
  useEffect(() => { if (busy) setInspectedIdx(null); }, [busy]);

  const activeLiveIdx = speaking !== null && items[speaking]?.role === 'assistant'
    ? speaking
    : inspectedIdx !== null && items[inspectedIdx]?.role === 'assistant'
      ? inspectedIdx
      : lastAssistantIdx;

  const activeSpoken = voice.active && voice.speaking
    ? voice.spokenText
    : speaking !== null
      ? listenChunk
      : '';

  const liveState = useMemo<LiveDisplayState>(() => {
    const target = activeLiveIdx >= 0 ? items[activeLiveIdx] : undefined;
    return {
      text: target?.text || '',
      sources: target?.sources || [],
      image: target?.image,
      streaming: Boolean(target?.streaming) || busy,
      stage: busy ? wsText(lang, stage) : '',
      spokenText: activeSpoken,
      interimSpeech: voice.active ? voice.interim : '',
      voiceActive: voice.active,
    };
  }, [activeLiveIdx, items, busy, lang, stage, activeSpoken, voice.active, voice.interim]);

  useEffect(() => { onLiveChange?.(liveState); }, [liveState, onLiveChange]);

  const send = async (raw = input, fromVoice = false, opts?: { forceWeb?: boolean; baseItems?: ChatItem[] }): Promise<boolean> => {
    const text = raw.trim();
    if (!text || busy) return false;
    // Typed while the voice conversation is on: the reply is spoken too.
    const voiceTurn = !fromVoice && voice.beginOutgoingTurn();
    try { await ask(text, opts); } catch { if (voiceTurn) voice.finishOutgoingTurn(false); return false; }
    if (voiceTurn) voice.finishOutgoingTurn(true);
    return true;
  };
  voiceSendRef.current = (text) => send(text, true);

  const ask = async (text: string, opts?: { forceWeb?: boolean; baseItems?: ChatItem[] }) => {
    const useWeb = opts?.forceWeb ?? web;
    const history = opts?.baseItems ?? items;
    const files = opts?.baseItems ? [] : attachments;
    const next: ChatItem[] = [...history, { role: 'user', text, ...(files.length ? { files: files.map((f) => f.name) } : {}) }];
    setItems(next);
    if (!opts?.baseItems) {
      setInput('');
      setAttachments([]);
    }
    setExportOpenIdx(null);
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const blocksReply = !files.length && !useWeb ? blockBuilderReply(text, lang) : undefined;
      if (blocksReply) { setItems((prev) => [...prev, { role: 'assistant', text: blocksReply }]); return; }
      const photoReply = realPhotoReply(text, history, lang);
      if (photoReply) { setItems((prev) => [...prev, { role: 'assistant', text: photoReply }]); return; }
      // An explicit motion request about an existing image is local, with no extra AI quota.
      const previousImage = [...history].reverse().find((item) => item.image)?.image;
      if (previousImage && wantsMotion(text) && /(?:الصورة|الصوره)(?:\s+(?:دي|دى|ده|هذه|ديّه))?|\b(?:this|that|the|my)\s+(?:image|photo|picture)\b/i.test(text)) {
        setItems((prev) => [...prev, { role: 'assistant', text: w('motion_ready'), image: previousImage }]);
        return;
      }
      const messages = next.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text })).slice(-24);
      // Written live: both sources and words appear on screen the instant each event arrives.
      const draftId = `draft-${Date.now()}`;
      let draft = '';
      let draftSources: WsSource[] | undefined;
      const showDraft = () => setItems((prev) => {
        const item: ChatItem = { role: 'assistant', text: draft, streaming: true, id: draftId, ...(draftSources?.length ? { sources: draftSources } : {}) };
        return prev.some((m) => m.id === draftId) ? prev.map((m) => (m.id === draftId ? item : m)) : [...prev, item];
      });
      const dropDraft = () => setItems((prev) => prev.filter((m) => m.id !== draftId));
      setStage(useWeb ? 'searching_web' : deep ? 'deep_thinking' : 'thinking');
      let out: Awaited<ReturnType<typeof askStream>>;
      try {
        out = await askStream({ messages, language: lang, context: files, ...(useWeb ? { search: true } : {}), ...(deep ? { deep: true } : {}) }, (event) => {
          if (controller.signal.aborted) return;
          if (event.type === 'stage') setStage(event.stage === 'searching' ? 'searching_web' : event.stage === 'thinking' ? 'deep_thinking' : event.stage === 'reviewing' ? 'reviewing' : 'writing');
          else if (event.type === 'sources') { draftSources = event.sources; if (event.sources.length) showDraft(); }
          else if (event.type === 'delta') { draft += event.text; showDraft(); }
          else if (event.type === 'reset') { draft = ''; dropDraft(); setStage('thinking'); }
        }, controller.signal);
      } catch (error) {
        // Stopped by the visitor: what was written so far stays as the reply.
        if (controller.signal.aborted && draft.trim()) {
          setItems((prev) => prev.map((m) => (m.id === draftId ? { role: 'assistant', text: draft.trim(), ...(draftSources?.length ? { sources: draftSources } : {}) } : m)));
          return;
        }
        dropDraft();
        throw error;
      }
      if (controller.signal.aborted) { dropDraft(); return; }
      onReached?.();
      // Only generate when the assistant supplies an explicit image request; do not override refusals.
      const wanted = imageRequest(out.reply);
      // The finished reply takes the draft's place (same message, so words already on screen never jump).
      const reply: ChatItem = { role: 'assistant', text: out.reply, id: draftId, ...(out.sources.length ? { sources: out.sources } : {}) };
      setItems((prev) => (prev.some((m) => m.id === draftId) ? prev.map((m) => (m.id === draftId ? reply : m)) : [...prev, reply]));
      if (wanted) {
        setStage('drawing');
        try {
          // «EDIT: …» changes the picture Shaheen just drew; without one still on screen it is drawn afresh.
          const asked = parseImageRequest(wanted);
          const img = await drawOrPaint(asked.prompt, asked.mode === 'edit' && isGeneratedImageData(previousImage) ? await fitForUpload(previousImage) : undefined, controller.signal);
          if (controller.signal.aborted) return;
          setItems((prev) => prev.map((m) => (m.id === draftId ? { ...m, image: img.src, ...(img.painted ? { painted: img.painted } : {}) } : m)));
        } catch (error) {
          // The reason sits beside the reply, never inside its text.
          if (!controller.signal.aborted) setItems((prev) => prev.map((m) => (m.id === draftId ? { ...m, imageNote: imageErrorKey(error) } : m)));
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) setItems((prev) => [...prev, { role: 'assistant', text: w(errorKey(error)), error: true }]);
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  const regenerateLast = () => {
    if (busy) return;
    let lastUserIdx = -1;
    for (let k = items.length - 1; k >= 0; k -= 1) {
      if (items[k]?.role === 'user') { lastUserIdx = k; break; }
    }
    if (lastUserIdx < 0) return;
    const question = items[lastUserIdx]?.text || '';
    const base = items.slice(0, lastUserIdx);
    void send(question, false, { baseItems: base });
  };

  const editUserMessage = (idx: number) => {
    if (busy) return;
    const msg = items[idx];
    if (!msg || msg.role !== 'user') return;
    setInput(msg.text);
    setItems(items.slice(0, idx));
    setTimeout(() => inputRef.current?.focus(), 20);
  };

  const attach = async (list: FileList | null) => {
    if (!list) return;
    for (const file of Array.from(list).slice(0, 6)) {
      if (file.size > MAX_FILE_BYTES) { setItems((p) => [...p, { role: 'assistant', text: `${file.name}: ${w('too_big')}`, error: true }]); continue; }
      void saveFile(file.name, file, file.type).catch(() => undefined);
      let text = await fileText(file, file.name).catch(() => '');
      // «استقبال الملفات»: a photo or a scanned PDF has no text inside — its words are read like Shaheen's chat reads pictures.
      if (text.replace(/\s+/g, '').length < 20 && (isPictureFile(file) || /\.pdf$/i.test(file.name))) {
        const read = await pickAttachment(file).then(async (picked) => {
          if (picked.kind === 'image') { const r = await readPictureText(picked.dataUrl, lang); return r ? [r.text, r.description].filter(Boolean).join('\n\n') : ''; }
          if (picked.text) return picked.text;
          return picked.scans?.length ? (await readScannedPages(picked.scans, lang))?.text || '' : '';
        }).catch(() => '');
        if (read.trim()) text = read;
      }
      if (!text.trim()) { setItems((p) => [...p, { role: 'assistant', text: `${file.name}: ${w('no_text')}`, error: true }]); continue; }
      setAttachments((prev) => [...prev.filter((f) => f.name !== file.name), { name: file.name, text }]);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const listen = (i: number, text: string) => {
    stopSpeech.current?.();
    if (speaking === i) {
      setSpeaking(null);
      setListenChunk('');
      return;
    }
    setSpeaking(i);
    setListenChunk('');
    stopSpeech.current = readAloud(stripImageRequest(text), {
      language: lang,
      onChunk: (chunk) => setListenChunk(chunk),
      onEnd: () => {
        setSpeaking((s) => (s === i ? null : s));
        setListenChunk('');
      },
    });
  };

  const askFix = (block: CodeBlock, error: string) => {
    void send(`${pickArEn(lang, 'الكود ده طلّع الخطأ ده، صلّحه:', 'This code fails with the error below — please fix it:')}\n\`\`\`${block.lang}\n${block.code}\n\`\`\`\n\`\`\`\n${error.slice(0, 2000)}\n\`\`\``);
  };

  const starters: Array<{ label: WsKey; prompt: WsKey; Icon: typeof FileText; tone: string; useWeb?: boolean }> = [
    { label: 'starter_write_label', prompt: 'starter_write_prompt', Icon: FileText, tone: 'text-emerald-500' },
    { label: 'starter_code_label', prompt: 'starter_code_prompt', Icon: Code2, tone: 'text-sky-500' },
    { label: 'starter_search_label', prompt: 'starter_search_prompt', Icon: Globe, tone: 'text-blue-500', useWeb: true },
    { label: 'starter_explain_label', prompt: 'starter_explain_prompt', Icon: Table2, tone: 'text-amber-500' },
    { label: 'starter_image_label', prompt: 'starter_image_prompt', Icon: ImageIcon, tone: 'text-rose-500' },
  ];

  const isEmpty = items.length === 0 && !busy;
  const hasStreamingText = items.some((m) => m.streaming && stripImageRequest(m.text).trim().length > 0);

  const composer = (
    <div className="mx-auto w-full max-w-3xl space-y-2">
      {offline && (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-[12.5px] font-medium text-[var(--ws-ink)]" data-testid="workspace-offline">
          {w(serverReachable() ? 'reconnecting' : 'no_server')}
        </p>
      )}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {attachments.map((f) => (
            <span key={f.name} className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--ws-border)] bg-[var(--ws-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--ws-ink)]">
              <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--ws-muted)]" />
              <span className="max-w-[12rem] truncate">{f.name}</span>
              <button
                type="button"
                aria-label={w('delete')}
                onClick={() => setAttachments((p) => p.filter((x) => x.name !== f.name))}
                className="rounded-full p-0.5 text-[var(--ws-muted)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-ink)] cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="rounded-3xl border border-[var(--ws-composer-border)] bg-[var(--ws-composer)] px-3.5 pt-2.5 pb-2 shadow-[var(--ws-shadow)] transition focus-within:border-[var(--ws-border-strong)]">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={1}
          dir="auto"
          placeholder={w('placeholder')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          className="block max-h-[200px] min-h-[44px] w-full resize-none bg-transparent px-1 py-1.5 text-[15px] leading-relaxed text-[var(--ws-ink)] placeholder:text-[var(--ws-muted)] outline-none"
          data-testid="ws-input"
        />
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { void attach(e.target.files); }} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title={w('attach')}
            aria-label={w('attach')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ws-border)] text-[var(--ws-ink-soft)] transition hover:bg-[var(--ws-hover)] hover:text-[var(--ws-ink)] cursor-pointer"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setWeb((v) => !v)}
            aria-pressed={web}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition cursor-pointer ${
              web
                ? 'border-sky-500/50 bg-sky-500/12 text-sky-600'
                : 'border-[var(--ws-border)] text-[var(--ws-ink-soft)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-ink)]'
            }`}
          >
            <Globe className="h-3.5 w-3.5 shrink-0" />
            <span>{w('web_toggle')}</span>
          </button>
          <button
            type="button"
            onClick={() => setDeep((v) => !v)}
            aria-pressed={deep}
            title={w('deep_hint')}
            data-testid="ws-deep"
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition cursor-pointer ${
              deep
                ? 'border-violet-500/50 bg-violet-500/12 text-violet-600'
                : 'border-[var(--ws-border)] text-[var(--ws-ink-soft)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-ink)]'
            }`}
          >
            <Brain className="h-3.5 w-3.5 shrink-0" />
            <span>{w('deep_toggle')}</span>
          </button>
          <span className="flex-1" />
          <div className="relative" data-testid="ws-voice"><ShaheenVoiceModeButton language={lang} voice={voice} disabled={!serverReachable()} /></div>
          {busy ? (
            <button
              type="button"
              onClick={() => abort.current?.abort()}
              title={w('stop')}
              aria-label={w('stop')}
              className="grid h-9 w-9 place-items-center rounded-full bg-[var(--ws-cta-bg)] text-[var(--ws-cta-ink)] transition hover:opacity-85 cursor-pointer"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { void send(); }}
              disabled={!input.trim()}
              title={w('send')}
              aria-label={w('send')}
              data-testid="ws-send"
              className="grid h-9 w-9 place-items-center rounded-full bg-[var(--ws-cta-bg)] text-[var(--ws-cta-ink)] transition hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ArrowUp className="h-4.5 w-4.5 stroke-[2.4]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const actionBtn = 'inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-[var(--ws-muted)] transition hover:bg-[var(--ws-hover)] hover:text-[var(--ws-ink)] cursor-pointer';

  return (
    <div
      className="relative flex h-full min-h-[34rem] flex-col"
      data-testid="ws-chat"
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); void attach(e.dataTransfer.files); }}
    >
      {/* Drag-and-drop file overlay */}
      {dragging && (
        <div className="pointer-events-none absolute inset-3 z-40 grid place-items-center rounded-3xl border-2 border-dashed border-emerald-500 bg-[var(--ws-bg)]/90 backdrop-blur-xs">
          <div className="flex flex-col items-center gap-2 text-center">
            <Upload className="h-8 w-8 text-emerald-500" />
            <p className="text-sm font-semibold text-[var(--ws-ink)]">{w('drop_files')}</p>
          </div>
        </div>
      )}

      {/* Live voice conversation stage + live visual information board */}
      {voice.active && (
        <div className="sticky top-0 z-30 mx-auto w-full max-w-3xl space-y-2.5 px-3 pt-3 sm:px-6">
          <div className="overflow-hidden rounded-2xl shadow-lg" data-testid="ws-voice-stage"><ShaheenVoiceStage language={lang} voice={voice} /></div>
          <VoiceLiveInfoBoard
            lang={lang}
            state={liveState}
            onOpenFullPanel={onOpenLivePanel ? (tab) => onOpenLivePanel(tab) : undefined}
          />
        </div>
      )}

      {isEmpty ? (
        <>
          {/* Welcome content can move; the message composer stays docked in the same place. */}
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-3 py-6 sm:px-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <ShaheenAvatar size="lg" active={voice.active} speaking={voice.speaking} />
              <h2 className="text-2xl font-semibold text-[var(--ws-ink)] sm:text-[28px]">{w('hero_greeting')}</h2>
            </div>
            <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2">
              {starters.map(({ label, prompt, Icon, tone, useWeb }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    if (useWeb) setWeb(true);
                    void send(w(prompt), false, useWeb ? { forceWeb: true } : undefined);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--ws-border)] bg-[var(--ws-elevated)] px-3.5 py-2 text-[13px] font-medium text-[var(--ws-ink-soft)] shadow-2xs transition hover:border-[var(--ws-border-strong)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-ink)] cursor-pointer"
                >
                  <Icon className={`h-4 w-4 shrink-0 ${tone}`} aria-hidden="true" />
                  <span>{w(label)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="shrink-0 bg-gradient-to-t from-[var(--ws-bg)] via-[var(--ws-bg)] to-transparent px-3 pt-1 pb-3 sm:px-6">
            {composer}
            <p className="mt-2 text-center text-[11px] text-[var(--ws-muted)]">{w('composer_note')}</p>
          </div>
        </>
      ) : (
        <>
          {/* Conversation scroll stream */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="min-h-0 flex-1 overflow-y-auto px-3 pt-5 pb-6 sm:px-6"
          >
            <div className="mx-auto max-w-3xl space-y-6">
              {items.map((m, i) => {
                if (m.role === 'user') {
                  return (
                    <div key={m.id || i} className="group flex flex-col items-end gap-1">
                      <div className="max-w-[88%] rounded-3xl bg-[var(--ws-user-bg)] px-4 py-2.5 text-[15px] leading-relaxed text-[var(--ws-user-ink)] sm:max-w-[78%]">
                        {m.files?.length ? (
                          <div className="mb-1.5 flex flex-wrap gap-1">
                            {m.files.map((fname) => (
                              <span key={fname} className="inline-flex items-center gap-1 rounded-lg bg-[var(--ws-bg)]/70 px-2 py-0.5 text-[11.5px] font-medium text-[var(--ws-muted)]">
                                <FileText className="h-3 w-3" />
                                {fname}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <p className="whitespace-pre-wrap break-words" dir="auto">{m.text}</p>
                      </div>
                      <div className="flex items-center gap-0.5 px-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                        <button
                          type="button"
                          onClick={() => copyText(i, m.text)}
                          title={w('copy')}
                          aria-label={w('copy')}
                          className="grid h-7 w-7 place-items-center rounded-lg text-[var(--ws-muted)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-ink)] cursor-pointer"
                        >
                          {copiedIdx === i ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                        {!busy && (
                          <button
                            type="button"
                            onClick={() => editUserMessage(i)}
                            title={w('edit_msg')}
                            aria-label={w('edit_msg')}
                            className="grid h-7 w-7 place-items-center rounded-lg text-[var(--ws-muted)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-ink)] cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                const isSpokenMsg = (speaking === i) || (voice.active && voice.speaking && i === lastAssistantIdx);
                const msgSpokenChunk = isSpokenMsg ? activeSpoken : undefined;
                const isLastAssistant = i === lastAssistantIdx;
                const info = !m.error ? extractLiveInfo(m.text, m.sources, m.image) : null;
                const htmlBlock = info?.codeBlocks.find((b) => b.runnable === 'html');

                return (
                  <article key={m.id || i} className="flex items-start gap-3 sm:gap-4">
                    <div className="pt-0.5">
                      <ShaheenAvatar size="md" active={Boolean(m.streaming)} speaking={isSpokenMsg} />
                    </div>
                    <div dir="auto" className="min-w-0 flex-1 space-y-2.5">
                      {m.error ? (
                        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[14px] leading-relaxed text-[var(--ws-ink)]">
                          {m.text}
                        </div>
                      ) : (
                        <>
                          {/* Live source pills appear immediately (even before streaming finishes) */}
                          {m.sources?.length ? (
                            <SourcePills
                              sources={m.sources}
                              lang={lang}
                              onOpenAll={onOpenLivePanel ? () => { setInspectedIdx(i); onOpenLivePanel('sources', undefined, i); } : undefined}
                            />
                          ) : null}

                          {/* Streamed message body with workspace typography, tables, code cards & spoken glow */}
                          <LiveReply
                            text={m.text}
                            streaming={Boolean(m.streaming)}
                            lang={lang}
                            sources={m.sources}
                            spokenText={msgSpokenChunk}
                            onOpenEditor={onOpenEditor}
                            onOpenCanvas={onOpenLivePanel ? (block) => { setInspectedIdx(i); onOpenLivePanel('canvas', block, i); } : undefined}
                            onAskFix={askFix}
                            onGrow={follow}
                          />

                          {/* Live stage shimmer when sources arrived and Shaheen is composing the text */}
                          {m.streaming && !stripImageRequest(m.text).trim() && busy && (
                            <LiveStageIndicator stage={w(stage)} sourceCount={m.sources?.length || 0} lang={lang} />
                          )}

                          {/* Interactive block tool hand-off */}
                          {onOpenBlocks && !m.streaming && toolFromReply(m.text) && (
                            <button
                              type="button"
                              onClick={() => onOpenBlocks(toolFromReply(m.text)!)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--ws-cta-bg)] px-3.5 py-2 text-[13px] font-semibold text-[var(--ws-cta-ink)] transition hover:opacity-90 cursor-pointer"
                            >
                              {pickArEn(lang, 'افتح في البلوكات', 'Open in blocks')}
                            </button>
                          )}

                          {/* Drawing progress & real media / generated image */}
                          {imageRequest(m.text) && !m.image && busy && i === items.length - 1 && (
                            <div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-surface)] px-3.5 py-2.5 text-[13px] text-[var(--ws-muted)]">
                              <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                              <span className="sham-ws-shimmer font-medium">{w('drawing')}</span>
                            </div>
                          )}
                          {extractMediaRequest(m.text) && <ShaheenMedia request={extractMediaRequest(m.text)!} lang={lang} />}
                          {m.imageNote && !m.image && (
                            <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-[var(--ws-ink)]">
                              {w(m.imageNote)}
                            </p>
                          )}
                          {m.painted && m.image && <p role="status" className="text-xs text-[var(--ws-muted)]">{w(m.painted === 'partial' ? 'painter_partial' : 'painter_note')}</p>}
                          {m.regenerateImage && <p role="status" className="text-xs text-[var(--ws-muted)]">{w('image_regenerate')}</p>}
                          {m.image && <MotionCard src={m.image} lang={lang} />}

                          {/* Clean minimalist action bar */}
                          {!m.streaming && (
                            <div className="space-y-2 pt-1">
                              <div className="flex flex-wrap items-center gap-0.5">
                                <button type="button" onClick={() => copyText(i, m.text)} title={w('copy')} aria-label={w('copy')} className={actionBtn}>
                                  {copiedIdx === i ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => listen(i, m.text)}
                                  aria-pressed={speaking === i}
                                  title={speaking === i ? w('stop') : w('listen')}
                                  aria-label={speaking === i ? w('stop') : w('listen')}
                                  className={`${actionBtn} ${speaking === i ? 'bg-emerald-500/12 text-emerald-600' : ''}`}
                                >
                                  {speaking === i ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                                  {speaking === i && <span>{w('live_speaking_now')}</span>}
                                </button>
                                {isLastAssistant && !busy && (
                                  <button type="button" onClick={regenerateLast} title={w('regenerate')} aria-label={w('regenerate')} className={actionBtn}>
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => { void saveFile(safeFileName(parseMarkdown(m.text, w('title')).title, 'md'), m.text).then(() => say(i, w('saved')), () => say(i, w('failed'))); }}
                                  title={w('save_file')}
                                  aria-label={w('save_file')}
                                  className={actionBtn}
                                >
                                  <Save className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setExportOpenIdx((cur) => (cur === i ? null : i))}
                                  aria-expanded={exportOpenIdx === i}
                                  title={w('export_as')}
                                  aria-label={w('export_as')}
                                  className={`${actionBtn} ${exportOpenIdx === i ? 'bg-[var(--ws-hover)] text-[var(--ws-ink)]' : ''}`}
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </button>
                                {onOpenLivePanel && info?.hasStructuredInfo && (
                                  <button
                                    type="button"
                                    onClick={() => { setInspectedIdx(i); onOpenLivePanel(htmlBlock ? 'canvas' : 'brief', htmlBlock, i); }}
                                    className={`${actionBtn} text-[var(--ws-ink-soft)]`}
                                  >
                                    <PanelRightOpen className="h-3.5 w-3.5" />
                                    <span className="text-[11.5px]">{htmlBlock ? w('live_tab_canvas') : w('live_panel')}</span>
                                  </button>
                                )}
                                {flash?.i === i && <span className="ms-1 text-[11.5px] font-semibold text-emerald-500">{flash.text}</span>}
                              </div>
                              {exportOpenIdx === i && (
                                <div className="sham-ws-card-in pt-0.5">
                                  <ExportMenu markdown={stripImageRequest(m.text)} lang={lang} compact />
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </article>
                );
              })}

              {/* Initial live stage row before the first streaming chunk or source arrives */}
              {busy && !items.some((m) => m.streaming) && (
                <div className="flex items-center gap-3 sm:gap-4">
                  <ShaheenAvatar size="md" active />
                  <LiveStageIndicator stage={w(stage)} lang={lang} />
                </div>
              )}

              {/* Reviewing pass note while a draft already has words */}
              {busy && stage === 'reviewing' && hasStreamingText && (
                <p role="status" className="ps-12 text-[12px] font-medium">
                  <span className="sham-ws-shimmer">{w('reviewing')}</span>
                </p>
              )}

              <div ref={endRef} />
            </div>
          </div>

          {/* Floating scroll-to-bottom button */}
          {showJumpDown && (
            <div className="pointer-events-none relative z-20 -mt-11 mb-2 flex justify-center">
              <button
                type="button"
                onClick={() => scrollToEnd('smooth')}
                title={w('scroll_bottom')}
                aria-label={w('scroll_bottom')}
                className="pointer-events-auto grid h-8 w-8 place-items-center rounded-full border border-[var(--ws-border)] bg-[var(--ws-elevated)] text-[var(--ws-ink)] shadow-md transition hover:bg-[var(--ws-hover)] cursor-pointer"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Bottom floating composer dock */}
          <div className="shrink-0 bg-gradient-to-t from-[var(--ws-bg)] via-[var(--ws-bg)] to-transparent px-3 pt-1 pb-3 sm:px-6">
            {composer}
            <p className="mt-2 text-center text-[11px] text-[var(--ws-muted)]">{w('composer_note')}</p>
          </div>
        </>
      )}
    </div>
  );
}
