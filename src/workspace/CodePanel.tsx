import React, { useMemo, useState } from 'react';
import { Copy, ExternalLink, Eye, Loader2, Play, Save } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { previewDocument, fileNameFor, type Runnable } from './codeBlocks';
import { runJavaScript, runPython, type RunResult } from './runners';
import { PreviewFrame, RunOutput } from './CodeCard';
import { saveFile } from './fileStore';
import { wsText, type WsKey } from './strings';

export interface EditorState { lang: Runnable; code: string }
export const STARTERS: Record<Runnable, string> = {
  python: 'import math\n\nfor n in range(1, 6):\n    print(n, n ** 2, round(math.sqrt(n), 3))\n',
  javascript: 'const items = [3, 1, 4, 1, 5, 9];\nconsole.log("sorted:", [...items].sort((a, b) => a - b));\nconsole.log("sum:", items.reduce((a, b) => a + b, 0));\n',
  html: '<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n<meta charset="utf-8">\n<style>\n  body { font-family: system-ui, Tahoma, sans-serif; display: grid; place-items: center; min-height: 90vh; background: linear-gradient(135deg,#fef3c7,#fff); }\n  button { font-size: 18px; padding: 10px 22px; border-radius: 12px; border: 0; background: #92400e; color: #fff; cursor: pointer; }\n</style>\n</head>\n<body>\n  <div>\n    <h1>أهلاً من شاهين</h1>\n    <button onclick="this.textContent = \'اتضغط ✓\'">اضغط هنا</button>\n  </div>\n</body>\n</html>\n',
};

/** «كود ومعاينة»: write or paste code, run Python / JavaScript in the browser, or see a page live. */
export function CodePanel({ lang, editor, setEditor }: { lang: SupportedLanguage; editor: EditorState; setEditor: (s: EditorState) => void }) {
  const w = (k: WsKey) => wsText(lang, k);
  const [running, setRunning] = useState<'' | 'loading' | 'running'>('');
  const [result, setResult] = useState<RunResult | null>(null);
  const [shown, setShown] = useState('');
  const [flash, setFlash] = useState('');
  const say = (text: string) => { setFlash(text); setTimeout(() => setFlash(''), 1800); };
  const rtl = lang === 'ar' || lang === 'fa';
  const page = useMemo(() => (editor.lang === 'html' ? previewDocument({ lang: 'html', code: shown || editor.code }, rtl) : ''), [editor.lang, shown, editor.code, rtl]);

  const run = async () => {
    if (editor.lang === 'html') { setShown(editor.code); return; }
    setResult(null);
    setRunning(editor.lang === 'python' ? 'loading' : 'running');
    const out = await (editor.lang === 'python' ? runPython : runJavaScript)(editor.code, { onStage: (s) => setRunning(s) });
    setResult(out);
    setRunning('');
  };
  const openTab = () => {
    const url = URL.createObjectURL(new Blob([previewDocument({ lang: 'html', code: editor.code }, rtl)], { type: 'text/html' }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div className="space-y-3" data-testid="ws-code-panel">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[12px] font-bold text-stone-600" htmlFor="ws-code-lang">{w('lang')}</label>
        <select id="ws-code-lang" value={editor.lang} onChange={(e) => { const l = e.target.value as Runnable; setEditor({ lang: l, code: editor.code.trim() && editor.code !== STARTERS[editor.lang] ? editor.code : STARTERS[l] }); setResult(null); setShown(''); }}
          className="rounded-lg border border-stone-300 px-2 py-1 text-sm">
          <option value="python">Python</option>
          <option value="javascript">JavaScript</option>
          <option value="html">HTML / CSS / JS ({w('preview')})</option>
        </select>
        <span className="flex-1" />
        <button type="button" onClick={() => { void run(); }} disabled={Boolean(running)} className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-3.5 py-1.5 text-[12px] font-black text-white disabled:opacity-60 cursor-pointer">
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : editor.lang === 'html' ? <Eye className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{editor.lang === 'html' ? w('preview') : w('run')}
        </button>
        {editor.lang === 'html' && <button type="button" onClick={openTab} className="inline-flex items-center gap-1 rounded-xl border border-stone-300 px-3 py-1.5 text-[12px] font-bold text-stone-700 cursor-pointer"><ExternalLink className="h-3.5 w-3.5" />{w('open_tab')}</button>}
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(editor.code).then(() => say(w('copied')), () => undefined); }} className="inline-flex items-center gap-1 rounded-xl border border-stone-300 px-3 py-1.5 text-[12px] font-bold text-stone-700 cursor-pointer"><Copy className="h-3.5 w-3.5" />{w('copy')}</button>
        <button type="button" onClick={() => { void saveFile(fileNameFor({ lang: editor.lang }), editor.code).then(() => say(w('saved')), () => say(w('failed'))); }} className="inline-flex items-center gap-1 rounded-xl border border-stone-300 px-3 py-1.5 text-[12px] font-bold text-stone-700 cursor-pointer"><Save className="h-3.5 w-3.5" />{w('save_file')}</button>
        {flash && <span className="text-[11px] font-bold text-emerald-700">{flash}</span>}
      </div>
      <textarea value={editor.code} onChange={(e) => setEditor({ ...editor, code: e.target.value })} spellCheck={false} dir="ltr" rows={16}
        onKeyDown={(e) => {
          if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); const el = e.currentTarget; const s = el.selectionStart; const v = el.value; setEditor({ ...editor, code: `${v.slice(0, s)}    ${v.slice(el.selectionEnd)}` }); requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 4; }); }
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void run(); }
        }}
        className="w-full rounded-xl border border-stone-300 bg-stone-950 p-3 font-mono text-[12.5px] leading-relaxed text-stone-100 outline-none focus:border-amber-500" data-testid="ws-editor" />
      <p className="text-[11px] text-stone-500">{w('sandbox_note')}</p>
      {running === 'loading' && <p className="text-[12px] text-stone-500"><Loader2 className="inline h-3 w-3 animate-spin" /> {w('loading_python')}</p>}
      {editor.lang === 'html' && shown && <PreviewFrame html={page} title={w('preview')} height={480} />}
      {result && editor.lang !== 'html' && (<div><h3 className="mb-1 text-[12px] font-bold text-stone-600">{w('output')}</h3><RunOutput result={result} lang={lang} /></div>)}
    </div>
  );
}
