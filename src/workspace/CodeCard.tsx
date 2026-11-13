import React, { useState } from 'react';
import { Copy, Eye, Loader2, Play, Save, SquarePen } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { fileNameFor, previewDocument, type CodeBlock } from './codeBlocks';
import { runJavaScript, runPython, type RunResult } from './runners';
import { saveFile } from './fileStore';
import { wsText } from './strings';

/** A sandboxed live page: scripts run, but with no access to the site, its storage or the visitor's account. */
export function PreviewFrame({ html, title, height = 360 }: { html: string; title: string; height?: number }) {
  return (
    <iframe title={title} srcDoc={html} sandbox="allow-scripts allow-forms allow-modals allow-popups"
      referrerPolicy="no-referrer" className="w-full rounded-xl border border-stone-200 bg-white" style={{ height }} />
  );
}

export function RunOutput({ result, lang }: { result: RunResult; lang: SupportedLanguage }) {
  return (
    <div className="space-y-2">
      {(result.output || result.error || result.timedOut) && (
        <pre dir="ltr" className={`max-h-72 overflow-auto whitespace-pre-wrap rounded-xl p-3 text-[12px] font-mono ${result.error || result.timedOut ? 'bg-rose-50 text-rose-900' : 'bg-stone-900 text-emerald-100'}`}>
          {result.output}{result.error ? `${result.output ? '\n' : ''}${result.error}` : ''}{result.timedOut ? `\n${wsText(lang, 'timeout')}` : ''}
        </pre>
      )}
      {result.images.map((src, i) => <img key={i} src={src} alt="" className="max-w-full rounded-xl border border-stone-200 bg-white" />)}
      <p className="text-[10px] text-stone-400" dir="ltr">{(result.ms / 1000).toFixed(1)} s</p>
    </div>
  );
}

/** A code block in a reply: copy, save, run (Python / JavaScript) or preview (a web page) right under it. */
export function CodeCard({ block, lang, index, onOpenEditor, onAskFix }: {
  block: CodeBlock; lang: SupportedLanguage; index: number;
  onOpenEditor?: (block: CodeBlock) => void; onAskFix?: (block: CodeBlock, error: string) => void;
}) {
  const w = (k: Parameters<typeof wsText>[1]) => wsText(lang, k);
  const [running, setRunning] = useState<'' | 'loading' | 'running'>('');
  const [result, setResult] = useState<RunResult | null>(null);
  const [preview, setPreview] = useState(false);
  const [flash, setFlash] = useState('');
  const say = (text: string) => { setFlash(text); setTimeout(() => setFlash(''), 1800); };
  const run = async () => {
    if (block.runnable === 'html') { setPreview((v) => !v); return; }
    setResult(null);
    setRunning(block.runnable === 'python' ? 'loading' : 'running');
    const runner = block.runnable === 'python' ? runPython : runJavaScript;
    const out = await runner(block.code, { onStage: (s) => setRunning(s) });
    setResult(out);
    setRunning('');
  };
  const rtl = lang === 'ar' || lang === 'fa';
  return (
    <div className="my-2 overflow-hidden rounded-xl border border-stone-200 bg-stone-50" data-testid="ws-code">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-stone-200 bg-white px-2 py-1.5">
        <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-stone-600" dir="ltr">{block.lang}</span>
        <span className="flex-1" />
        {block.runnable && (
          <button type="button" onClick={run} disabled={Boolean(running)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-800 disabled:opacity-60 cursor-pointer">
            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : block.runnable === 'html' ? <Eye className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {block.runnable === 'html' ? w('preview') : w('run')}
          </button>
        )}
        {onOpenEditor && <button type="button" onClick={() => onOpenEditor(block)} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-bold text-stone-700 hover:border-amber-400 cursor-pointer"><SquarePen className="h-3 w-3" />{w('open_editor')}</button>}
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(block.code).then(() => say(w('copied')), () => undefined); }} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-bold text-stone-700 hover:border-amber-400 cursor-pointer"><Copy className="h-3 w-3" />{w('copy')}</button>
        <button type="button" onClick={() => { void saveFile(fileNameFor(block, index), block.code).then(() => say(w('saved')), () => say(w('failed'))); }} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-bold text-stone-700 hover:border-amber-400 cursor-pointer"><Save className="h-3 w-3" />{w('save_file')}</button>
        {flash && <span className="text-[11px] font-bold text-emerald-700">{flash}</span>}
      </div>
      <pre dir="ltr" className="max-h-80 overflow-auto p-3 text-[12px] leading-relaxed font-mono text-stone-800"><code>{block.code}</code></pre>
      {running === 'loading' && <p className="px-3 pb-2 text-[11px] text-stone-500">{w('loading_python')}</p>}
      {preview && block.runnable === 'html' && <div className="p-2"><PreviewFrame html={previewDocument(block, rtl)} title={w('preview')} /></div>}
      {result && (
        <div className="space-y-2 p-2">
          <RunOutput result={result} lang={lang} />
          {(result.error || result.timedOut) && onAskFix && (
            <button type="button" onClick={() => onAskFix(block, result.error || w('timeout'))} className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-900 cursor-pointer">{w('ask_fix')}</button>
          )}
        </div>
      )}
    </div>
  );
}
