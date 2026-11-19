import React, { useState } from 'react';
import { Check, Copy, Eye, Loader2, PanelRightOpen, Play, Save, SquarePen } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { fileNameFor, previewDocument, type CodeBlock } from './codeBlocks';
import { runJavaScript, runPython, type RunResult } from './runners';
import { saveFile } from './fileStore';
import { wsText } from './strings';

/** A sandboxed live page: scripts run, but with no access to the site, its storage or the visitor's account. */
export function PreviewFrame({ html, title, height = 360 }: { html: string; title: string; height?: number }) {
  return (
    <iframe title={title} srcDoc={html} sandbox="allow-scripts allow-forms allow-modals allow-popups"
      referrerPolicy="no-referrer" className="w-full rounded-xl border border-neutral-800 bg-white" style={{ height }} />
  );
}

export function RunOutput({ result, lang }: { result: RunResult; lang: SupportedLanguage }) {
  return (
    <div className="space-y-2">
      {(result.output || result.error || result.timedOut) && (
        <pre dir="ltr" className={`max-h-72 overflow-auto whitespace-pre-wrap rounded-xl p-3 text-[12.5px] font-mono ${result.error || result.timedOut ? 'bg-rose-950/90 text-rose-100 border border-rose-800/60' : 'bg-black/80 text-emerald-200 border border-neutral-800'}`}>
          {result.output}{result.error ? `${result.output ? '\n' : ''}${result.error}` : ''}{result.timedOut ? `\n${wsText(lang, 'timeout')}` : ''}
        </pre>
      )}
      {result.images.map((src, i) => <img key={i} src={src} alt="" className="max-w-full rounded-xl border border-neutral-700 bg-white" />)}
      <p className="text-[10.5px] text-neutral-400" dir="ltr">{(result.ms / 1000).toFixed(1)} s</p>
    </div>
  );
}

/** A clean dark-chrome code block in a reply: copy, save, run (Python / JS), preview live, or open in Canvas. */
export function CodeCard({ block, lang, index, onOpenEditor, onAskFix, onOpenCanvas }: {
  block: CodeBlock; lang: SupportedLanguage; index: number;
  onOpenEditor?: (block: CodeBlock) => void;
  onAskFix?: (block: CodeBlock, error: string) => void;
  onOpenCanvas?: (block: CodeBlock) => void;
}) {
  const w = (k: Parameters<typeof wsText>[1]) => wsText(lang, k);
  const [running, setRunning] = useState<'' | 'loading' | 'running'>('');
  const [result, setResult] = useState<RunResult | null>(null);
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [flash, setFlash] = useState('');
  const say = (text: string) => { setFlash(text); setTimeout(() => setFlash(''), 1800); };
  const copy = () => {
    void navigator.clipboard?.writeText(block.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }, () => undefined);
  };
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
  const btn = 'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-neutral-300 hover:bg-white/10 hover:text-white transition cursor-pointer';

  return (
    <div className="my-3 overflow-hidden rounded-2xl border border-neutral-800 bg-[#0d0d0d] text-neutral-100 shadow-sm" data-testid="ws-code">
      <div className="flex flex-wrap items-center gap-1 border-b border-neutral-800 bg-[#1e1e1e] px-3 py-1.5">
        <span className="font-mono text-[11.5px] font-medium text-neutral-400" dir="ltr">{block.lang || 'code'}</span>
        <span className="flex-1" />
        {flash && <span className="me-1 text-[11px] font-semibold text-emerald-400">{flash}</span>}
        {block.runnable && (
          <button type="button" onClick={() => { void run(); }} disabled={Boolean(running)}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600/90 px-2.5 py-1 text-[11.5px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 transition cursor-pointer">
            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : block.runnable === 'html' ? <Eye className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {block.runnable === 'html' ? w('preview') : w('run')}
          </button>
        )}
        {onOpenCanvas && block.runnable === 'html' && (
          <button type="button" onClick={() => onOpenCanvas(block)} className={btn} title={w('open_canvas')}>
            <PanelRightOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{w('live_tab_canvas')}</span>
          </button>
        )}
        {onOpenEditor && (
          <button type="button" onClick={() => onOpenEditor(block)} className={btn}>
            <SquarePen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{w('open_editor')}</span>
          </button>
        )}
        <button type="button" onClick={copy} className={btn}>
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? w('copied') : w('copy')}</span>
        </button>
        <button type="button" onClick={() => { void saveFile(fileNameFor(block, index), block.code).then(() => say(w('saved')), () => say(w('failed'))); }} className={btn} title={w('save_file')} aria-label={w('save_file')}>
          <Save className="h-3.5 w-3.5" />
        </button>
      </div>
      <pre dir="ltr" className="max-h-96 overflow-auto p-4 text-[13px] leading-relaxed font-mono text-neutral-100"><code>{block.code}</code></pre>
      {running === 'loading' && <p className="border-t border-neutral-800 px-3.5 py-2 text-[11.5px] text-neutral-400">{w('loading_python')}</p>}
      {preview && block.runnable === 'html' && (
        <div className="border-t border-neutral-800 bg-[#151515] p-2.5">
          <PreviewFrame html={previewDocument(block, rtl)} title={w('preview')} />
        </div>
      )}
      {result && (
        <div className="space-y-2 border-t border-neutral-800 bg-[#151515] p-3">
          <RunOutput result={result} lang={lang} />
          {(result.error || result.timedOut) && onAskFix && (
            <button type="button" onClick={() => onAskFix(block, result.error || w('timeout'))} className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11.5px] font-semibold text-amber-200 hover:bg-amber-500/20 cursor-pointer">{w('ask_fix')}</button>
          )}
        </div>
      )}
    </div>
  );
}
