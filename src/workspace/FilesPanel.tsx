import React, { useEffect, useRef, useState } from 'react';
import { Download, Eye, FileCode, ImageIcon, MessageSquare, Trash2, Upload, X } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { ShaheenMarkdown } from '../components/ShaheenMarkdown';
import { deleteFile, getFile, humanSize, listFiles, MAX_FILE_BYTES, onFilesChanged, saveFile, type WsFileMeta } from './fileStore';
import { fileText, isTextLike } from './fileText';
import { downloadBlob } from './officeWriters';
import { PreviewFrame } from './CodeCard';
import { runnableOf, type Runnable } from './codeBlocks';
import type { WsContextFile } from './workspaceApi';
import { wsText, type WsKey } from './strings';

type Shown = { meta: WsFileMeta; url?: string; text?: string; html?: string };

/** «ملفاتي»: upload, preview, download and delete; send a file's text to the chat, a code file to the editor. */
export function FilesPanel({ lang, onUseInChat, onOpenCode, onEditImage }: {
  lang: SupportedLanguage; onUseInChat: (file: WsContextFile) => void; onOpenCode: (lang: Runnable, code: string) => void; onEditImage: (blob: Blob) => void;
}) {
  const w = (k: WsKey) => wsText(lang, k);
  const [files, setFiles] = useState<WsFileMeta[]>([]);
  const [shown, setShown] = useState<Shown | null>(null);
  const [note, setNote] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () => { void listFiles().then((list) => { if (alive) setFiles(list); }); };
    refresh();
    const off = onFilesChanged(refresh);
    return () => { alive = false; off(); };
  }, []);
  useEffect(() => () => { if (shown?.url) URL.revokeObjectURL(shown.url); }, [shown]);

  const upload = async (list: FileList | null) => {
    if (!list) return;
    setNote('');
    for (const f of Array.from(list)) {
      if (f.size > MAX_FILE_BYTES) { setNote(`${f.name}: ${w('too_big')}`); continue; }
      await saveFile(f.name, f, f.type).catch(() => setNote(w('failed')));
    }
    if (input.current) input.current.value = '';
  };
  const show = async (meta: WsFileMeta) => {
    const file = await getFile(meta.id);
    if (!file) return;
    if (meta.type.startsWith('image/') || meta.type === 'application/pdf' || meta.type.startsWith('audio/') || meta.type.startsWith('video/')) { setShown({ meta, url: URL.createObjectURL(file.blob) }); return; }
    if (meta.type === 'text/html' || /\.html?$/i.test(meta.name)) { setShown({ meta, html: await file.blob.text() }); return; }
    const text = await fileText(file.blob, meta.name);
    setShown({ meta, text: text || w('no_text') });
  };
  const use = async (meta: WsFileMeta) => {
    const file = await getFile(meta.id);
    if (!file) return;
    const text = await fileText(file.blob, meta.name);
    if (!text.trim()) { setNote(`${meta.name}: ${w('no_text')}`); return; }
    onUseInChat({ name: meta.name, text });
  };
  const download = async (meta: WsFileMeta) => { const file = await getFile(meta.id); if (file) downloadBlob(file.blob, meta.name); };
  const codeLang = (name: string) => runnableOf(name.split('.').pop() || '');

  return (
    <div className="space-y-3" data-testid="ws-files">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={input} type="file" multiple className="hidden" onChange={(e) => { void upload(e.target.files); }} />
        <button type="button" onClick={() => input.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-800 px-4 py-2 text-sm font-black text-white cursor-pointer"><Upload className="h-4 w-4" />{w('upload')}</button>
        <p className="text-[11px] text-stone-500 flex-1 min-w-[200px]">{w('files_note')}</p>
      </div>
      {note && <p className="rounded-xl bg-rose-50 p-2.5 text-[12px] text-rose-900">{note}</p>}
      {!files.length && <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">{w('empty_files')}</p>}
      <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
        {files.map((f) => {
          const code = codeLang(f.name);
          return (
            <li key={f.id} className="flex flex-wrap items-center gap-2 p-2.5">
              <span className="text-lg" aria-hidden>{f.type.startsWith('image/') ? '🖼️' : f.type === 'application/pdf' ? '📕' : /sheet|xlsx|csv/.test(f.type + f.name) ? '📊' : /presentation|pptx/.test(f.type + f.name) ? '📽️' : /word|docx/.test(f.type + f.name) ? '📘' : code ? '💻' : '📄'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-stone-800" dir="auto">{f.name}</p>
                <p className="text-[10.5px] text-stone-400" dir="ltr">{humanSize(f.size)} · {new Date(f.created).toLocaleString(lang === 'ar' ? 'ar-EG-u-nu-latn' : undefined)}</p>
              </div>
              <button type="button" title={w('preview')} aria-label={w('preview')} onClick={() => { void show(f); }} className="rounded-lg border border-stone-200 p-1.5 text-stone-700 cursor-pointer"><Eye className="h-3.5 w-3.5" /></button>
              {(isTextLike(f.name, f.type) || /\.(pdf|docx|pptx|xlsx)$/i.test(f.name)) && <button type="button" title={w('use_in_chat')} aria-label={w('use_in_chat')} onClick={() => { void use(f); }} className="rounded-lg border border-stone-200 p-1.5 text-stone-700 cursor-pointer"><MessageSquare className="h-3.5 w-3.5" /></button>}
              {code && <button type="button" title={w('open_editor')} aria-label={w('open_editor')} onClick={() => { void getFile(f.id).then(async (x) => { if (x) onOpenCode(code, await x.blob.text()); }); }} className="rounded-lg border border-stone-200 p-1.5 text-stone-700 cursor-pointer"><FileCode className="h-3.5 w-3.5" /></button>}
              {f.type.startsWith('image/') && <button type="button" title={w('tab_images')} aria-label={w('tab_images')} onClick={() => { void getFile(f.id).then((x) => { if (x) onEditImage(x.blob); }); }} className="rounded-lg border border-stone-200 p-1.5 text-stone-700 cursor-pointer"><ImageIcon className="h-3.5 w-3.5" /></button>}
              <button type="button" title={w('download')} aria-label={w('download')} onClick={() => { void download(f); }} className="rounded-lg border border-stone-200 p-1.5 text-stone-700 cursor-pointer"><Download className="h-3.5 w-3.5" /></button>
              <button type="button" title={w('delete')} aria-label={w('delete')} onClick={() => { if (shown?.meta.id === f.id) setShown(null); void deleteFile(f.id); }} className="rounded-lg border border-rose-200 p-1.5 text-rose-700 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          );
        })}
      </ul>
      {shown && (
        <div className="rounded-2xl border border-stone-300 bg-white p-3 space-y-2">
          <div className="flex items-center gap-2">
            <p className="flex-1 truncate font-bold text-stone-800" dir="auto">{shown.meta.name}</p>
            <button type="button" onClick={() => setShown(null)} aria-label={w('close')} className="rounded-lg border border-stone-200 p-1 cursor-pointer"><X className="h-4 w-4" /></button>
          </div>
          {shown.url && shown.meta.type.startsWith('image/') && <img src={shown.url} alt={shown.meta.name} className="max-h-[70vh] max-w-full rounded-xl" />}
          {shown.url && shown.meta.type === 'application/pdf' && <iframe title={shown.meta.name} src={shown.url} className="h-[70vh] w-full rounded-xl border border-stone-200" />}
          {shown.url && shown.meta.type.startsWith('audio/') && <audio controls src={shown.url} className="w-full" />}
          {shown.url && shown.meta.type.startsWith('video/') && <video controls src={shown.url} className="max-h-[70vh] w-full rounded-xl" />}
          {shown.html !== undefined && <PreviewFrame html={shown.html} title={shown.meta.name} height={480} />}
          {shown.text !== undefined && (/\.(md|markdown)$/i.test(shown.meta.name)
            ? <div className="max-h-[70vh] overflow-auto text-[13.5px]"><ShaheenMarkdown text={shown.text} /></div>
            : <pre dir="auto" className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-xl bg-stone-50 p-3 text-[12.5px]">{shown.text}</pre>)}
        </div>
      )}
    </div>
  );
}
