import { realPhotoReply } from '../utils/realPhotos';
import { extractMediaRequest, stripMediaBlock } from '../utils/shaheenMedia';
import { ShaheenMedia } from '../components/ShaheenMedia';
import { MotionCard } from './MotionCard';
import { wantsMotion } from './motion';
import React, { useEffect, useRef, useState } from 'react';
import { Copy, Globe, Loader2, Paperclip, Plus, Save, Send, Square, Volume2, X } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { ShaheenMarkdown } from '../components/ShaheenMarkdown';
import { readAloud } from '../utils/readAloud';
import { ask, errorKey, makeImage, isGeneratedImageData, type WsContextFile, type WsSource } from './workspaceApi';
import { imageRequest, segments, stripImageRequest, type CodeBlock } from './codeBlocks';
import { CodeCard } from './CodeCard';
import { ExportMenu } from './ExportMenu';
import { MAX_FILE_BYTES, saveFile } from './fileStore';
import { fileText } from './fileText';
import { safeFileName } from './officeWriters';
import { parseMarkdown } from './markdownDoc';
import { wsText, type WsKey } from './strings';
import { pickArEn } from '../لغات/localize';

export interface ChatItem { role: 'user' | 'assistant'; text: string; sources?: WsSource[]; image?: string; files?: string[]; error?: boolean; regenerateImage?: boolean }
const STORE_KEY = 'sham_workspace_chat_v1';
export function loadChat(): ChatItem[] {
  try { const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); return Array.isArray(raw) ? raw.slice(-60).map((item: ChatItem) => item.image && !isGeneratedImageData(item.image) ? { ...item, image: undefined, regenerateImage: true } : item) : []; } catch { return []; }
}
function storeChat(items: ChatItem[]) {
  // Big generated images (data URLs) stay for this visit only.
  try { localStorage.setItem(STORE_KEY, JSON.stringify(items.slice(-60).map((m) => (m.image && m.image.length > 150_000 ? { ...m, image: undefined } : m)))); } catch { /* full or blocked */ }
}

export function ChatPanel({ lang, items, setItems, attachments, setAttachments, onOpenEditor, offline }: {
  lang: SupportedLanguage; items: ChatItem[]; setItems: React.Dispatch<React.SetStateAction<ChatItem[]>>;
  attachments: WsContextFile[]; setAttachments: React.Dispatch<React.SetStateAction<WsContextFile[]>>;
  onOpenEditor: (block: CodeBlock) => void; offline: boolean;
}) {
  const w = (k: WsKey) => wsText(lang, k);
  const [input, setInput] = useState('');
  const [web, setWeb] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ i: number; text: string } | null>(null);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const stopSpeech = useRef<(() => void) | null>(null);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { storeChat(items); }, [items]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [items.length, busy]);
  useEffect(() => () => { abort.current?.abort(); stopSpeech.current?.(); }, []);

  const say = (i: number, text: string) => { setFlash({ i, text }); setTimeout(() => setFlash(null), 1800); };

  const send = async (raw = input) => {
    const text = raw.trim();
    if (!text || busy) return;
    const files = attachments;
    const next: ChatItem[] = [...items, { role: 'user', text, ...(files.length ? { files: files.map((f) => f.name) } : {}) }];
    setItems(next);
    setInput('');
    setAttachments([]);
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const photoReply = realPhotoReply(text, items, lang);
      if (photoReply) { setItems((prev) => [...prev, { role: 'assistant', text: photoReply }]); return; }
      // An explicit motion request about an existing image is local, with no extra AI quota.
      const previousImage = [...items].reverse().find((item) => item.image)?.image;
      if (previousImage && wantsMotion(text) && /(?:الصورة|الصوره)(?:\s+(?:دي|دى|ده|هذه|ديّه))?|\b(?:this|that|the|my)\s+(?:image|photo|picture)\b/i.test(text)) {
        setItems((prev) => [...prev, { role: 'assistant', text: w('motion_ready'), image: previousImage }]);
        return;
      }
      const messages = next.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text })).slice(-24);
      const out = await ask({ messages, language: lang, context: files, search: web }, controller.signal);
      if (controller.signal.aborted) return;
      // Only generate when the assistant supplies an explicit image request; do not override refusals.
      const wanted = imageRequest(out.reply);
      const reply: ChatItem = { role: 'assistant', text: out.reply, ...(out.sources.length ? { sources: out.sources } : {}) };
      setItems((prev) => [...prev, reply]);
      if (wanted) {
        try {
          const img = await makeImage(wanted, undefined, controller.signal);
          if (controller.signal.aborted) return;
          setItems((prev) => prev.map((m) => (m === reply ? { ...m, image: img.src } : m)));
        } catch { if (!controller.signal.aborted) setItems((prev) => prev.map((m) => m === reply ? { ...m, text: `${m.text}\n\n${w('image_failed')}` } : m)); }
      }
    } catch (error) {
      if (!controller.signal.aborted) setItems((prev) => [...prev, { role: 'assistant', text: w(errorKey(error)), error: true }]);
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  const attach = async (list: FileList | null) => {
    if (!list) return;
    for (const file of Array.from(list).slice(0, 6)) {
      if (file.size > MAX_FILE_BYTES) { setItems((p) => [...p, { role: 'assistant', text: `${file.name}: ${w('too_big')}`, error: true }]); continue; }
      void saveFile(file.name, file, file.type).catch(() => undefined);
      const text = await fileText(file, file.name);
      if (!text.trim()) { setItems((p) => [...p, { role: 'assistant', text: `${file.name}: ${w('no_text')}`, error: true }]); continue; }
      setAttachments((prev) => [...prev.filter((f) => f.name !== file.name), { name: file.name, text }]);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const listen = (i: number, text: string) => {
    stopSpeech.current?.();
    if (speaking === i) { setSpeaking(null); return; }
    setSpeaking(i);
    stopSpeech.current = readAloud(stripImageRequest(text), { language: lang, onEnd: () => setSpeaking((s) => (s === i ? null : s)) });
  };

  const askFix = (block: CodeBlock, error: string) => {
    void send(`${pickArEn(lang, 'الكود ده طلّع الخطأ ده، صلّحه:', 'This code fails with the error below — please fix it:')}\n\`\`\`${block.lang}\n${block.code}\n\`\`\`\n\`\`\`\n${error.slice(0, 2000)}\n\`\`\``);
  };

  return (
    <div className="flex flex-col gap-3" data-testid="ws-chat">
      <div className="space-y-3 min-h-[260px]">
        {!items.length && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 text-sm leading-relaxed text-stone-700">{w('welcome')}</div>
        )}
        {items.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[95%] sm:max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${m.role === 'user' ? 'bg-stone-900 text-white' : m.error ? 'bg-rose-50 text-rose-900 border border-rose-100' : 'bg-white border border-stone-200 text-stone-800'}`}>
              {m.role === 'user' ? (
                <>
                  {m.files?.length ? <p className="mb-1 text-[11px] text-stone-300">📎 {m.files.join('، ')}</p> : null}
                  <p className="whitespace-pre-wrap" dir="auto">{m.text}</p>
                </>
              ) : (
                <div dir="auto" className="space-y-1">
                  {segments(stripMediaBlock(stripImageRequest(m.text))).map((s, j) => (s.kind === 'text'
                    ? <ShaheenMarkdown key={j} text={s.text} />
                    : <CodeCard key={j} block={s.block} lang={lang} index={j + 1} onOpenEditor={onOpenEditor} onAskFix={askFix} />))}
                  {imageRequest(m.text) && !m.image && busy && i === items.length - 1 && <p className="text-[12px] text-stone-500"><Loader2 className="inline h-3 w-3 animate-spin" /> {w('drawing')}</p>}
                  {extractMediaRequest(m.text) && <ShaheenMedia request={extractMediaRequest(m.text)!} lang={lang} />}
                  {m.regenerateImage && <p role="status" className="text-xs text-stone-600">{w('image_regenerate')}</p>}
                  {m.image && <MotionCard src={m.image} lang={lang} />}
                  {m.sources?.length ? (
                    <details className="mt-2 text-[12px]">
                      <summary className="cursor-pointer font-bold text-stone-600">{w('sources')} ({m.sources.length})</summary>
                      <ol className="mt-1 list-decimal ps-5 space-y-0.5">
                        {m.sources.map((s, k) => <li key={k}><a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-amber-800 underline break-all">{s.title || s.url}</a></li>)}
                      </ol>
                    </details>
                  ) : null}
                  {!m.error && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-stone-100 pt-2">
                      <button type="button" onClick={() => { void navigator.clipboard?.writeText(m.text).then(() => say(i, w('copied')), () => undefined); }} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-bold text-stone-700 cursor-pointer"><Copy className="h-3 w-3" />{w('copy')}</button>
                      <button type="button" onClick={() => listen(i, m.text)} aria-pressed={speaking === i} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-bold text-stone-700 cursor-pointer"><Volume2 className="h-3 w-3" />{speaking === i ? w('stop') : w('listen')}</button>
                      <button type="button" onClick={() => { void saveFile(safeFileName(parseMarkdown(m.text, w('title')).title, 'md'), m.text).then(() => say(i, w('saved')), () => say(i, w('failed'))); }} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-bold text-stone-700 cursor-pointer"><Save className="h-3 w-3" />{w('save_file')}</button>
                      {flash?.i === i && <span className="text-[11px] font-bold text-emerald-700">{flash.text}</span>}
                      <div className="basis-full" />
                      <ExportMenu markdown={stripImageRequest(m.text)} lang={lang} compact />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <p className="text-end text-[12px] text-stone-500"><Loader2 className="inline h-3.5 w-3.5 animate-spin" /> {w('thinking')}</p>}
        <div ref={endRef} />
      </div>

      {offline && <p className="rounded-xl bg-amber-50 p-3 text-[12px] text-amber-900">{w('no_server')}</p>}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map((f) => (
            <span key={f.name} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-900">
              📎 {f.name}
              <button type="button" aria-label={w('delete')} onClick={() => setAttachments((p) => p.filter((x) => x.name !== f.name))} className="cursor-pointer"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="rounded-2xl border border-stone-300 bg-white p-2 shadow-xs focus-within:border-amber-500">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={3} dir="auto" placeholder={w('placeholder')}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
          className="w-full resize-y bg-transparent p-1.5 text-sm outline-none" data-testid="ws-input" />
        <div className="flex flex-wrap items-center gap-1.5">
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { void attach(e.target.files); }} />
          <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 rounded-xl border border-stone-200 px-2.5 py-1.5 text-[12px] font-bold text-stone-700 cursor-pointer"><Paperclip className="h-3.5 w-3.5" />{w('attach')}</button>
          <button type="button" onClick={() => setWeb((v) => !v)} aria-pressed={web} className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[12px] font-bold cursor-pointer ${web ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-stone-200 text-stone-700'}`}><Globe className="h-3.5 w-3.5" />{w('web_toggle')}</button>
          <button type="button" onClick={() => { abort.current?.abort(); setItems([]); setAttachments([]); }} className="inline-flex items-center gap-1 rounded-xl border border-stone-200 px-2.5 py-1.5 text-[12px] font-bold text-stone-700 cursor-pointer"><Plus className="h-3.5 w-3.5" />{w('new_chat')}</button>
          <span className="flex-1" />
          {busy
            ? <button type="button" onClick={() => abort.current?.abort()} className="inline-flex items-center gap-1 rounded-xl bg-rose-700 px-3.5 py-1.5 text-[12px] font-black text-white cursor-pointer"><Square className="h-3.5 w-3.5" />{w('stop')}</button>
            : <button type="button" onClick={() => { void send(); }} disabled={!input.trim()} data-testid="ws-send" className="inline-flex items-center gap-1 rounded-xl bg-amber-800 px-3.5 py-1.5 text-[12px] font-black text-white hover:bg-amber-900 disabled:opacity-50 cursor-pointer"><Send className="h-3.5 w-3.5" />{w('send')}</button>}
        </div>
      </div>
    </div>
  );
}
