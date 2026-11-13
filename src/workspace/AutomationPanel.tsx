import React, { useRef, useState } from 'react';
import { CheckCircle2, Circle, Loader2, Play, Workflow, XCircle } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { ShaheenMarkdown } from '../components/ShaheenMarkdown';
import { ask, errorKey, makeImage, readUrl, search } from './workspaceApi';
import { parsePlan, runPlan, type Plan, type StepState, type StepTool } from './automation';
import { runPython } from './runners';
import { saveFile } from './fileStore';
import { parseMarkdown } from './markdownDoc';
import { printHtml, writeOffice } from './officeWriters';
import { ExportMenu } from './ExportMenu';
import { wsText, type WsKey } from './strings';

const TOOL_KEY: Record<StepTool, WsKey> = { search: 'tool_search', read: 'tool_read', ask: 'tool_ask', image: 'tool_image', python: 'tool_python', document: 'tool_document', save: 'tool_save' };

/** «مهام تلقائية»: describe a whole task; Shaheen plans the steps, the workspace runs them one by one. */
export function AutomationPanel({ lang }: { lang: SupportedLanguage }) {
  const w = (k: WsKey) => wsText(lang, k);
  const [task, setTask] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [states, setStates] = useState<StepState[]>([]);
  const [images, setImages] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<'' | 'plan' | 'run'>('');
  const [final, setFinal] = useState('');
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);

  const makePlan = async () => {
    if (!task.trim() || busy) return;
    setBusy('plan'); setError(''); setPlan(null); setStates([]); setFinal(''); setImages({});
    try {
      const out = await ask({ messages: [{ role: 'user', text: task.trim() }], language: lang, task: 'plan' });
      const p = parsePlan(out.reply);
      if (!p) setError(w('plan_failed')); else { setPlan(p); setStates(p.steps.map(() => ({ status: 'waiting' }))); }
    } catch (e) { setError(w(errorKey(e))); } finally { setBusy(''); }
  };

  const run = async () => {
    if (!plan || busy) return;
    setBusy('run'); setError(''); setFinal(''); setImages({});
    const controller = new AbortController();
    abort.current = controller;
    let index = -1;
    const { results, states: done } = await runPlan(plan, {
      search: async (q) => { const r = await search(q, lang, controller.signal); return [r.answer || '', ...r.results.map((x, i) => `[${i + 1}] ${x.title} — ${x.url}\n${x.snippet}`)].filter(Boolean).join('\n\n'); },
      read: async (url) => { const r = await readUrl(url, controller.signal); return `${r.title}\n${r.url}\n\n${r.text.slice(0, 20_000)}`; },
      ask: async (prompt, earlier) => {
        const context = /\{\{\s*\d+\s*\}\}/.test(plan.steps[index]?.input || '') ? [] : earlier.map((text, i) => ({ name: `${w('step')} ${i + 1}`, text: text.slice(0, 12_000) })).filter((c) => c.text.trim());
        const out = await ask({ messages: [{ role: 'user', text: `${task.trim()}\n\n---\n\n${prompt}` }], language: lang, context }, controller.signal);
        return out.reply;
      },
      image: async (prompt) => { const out = await makeImage(prompt, undefined, controller.signal); setImages((m) => ({ ...m, [index]: out.src })); return out.src; },
      python: async (code) => { const r = await runPython(code); if (r.error || r.timedOut) throw new Error(r.error || w('timeout')); return r.output; },
      document: async (kind, content) => {
        const model = parseMarkdown(content, w('title'));
        const file = kind === 'pdf' ? { blob: new Blob([printHtml(model)], { type: 'text/html' }), name: `${model.title.slice(0, 50)}.html` } : await writeOffice(kind, model, content);
        await saveFile(file.name, file.blob);
        return `${file.name} ✓`;
      },
      save: async (name, content) => { await saveFile(name, content); return `${name} ✓`; },
    }, { signal: controller.signal, onStep: (i, s) => { index = i; setStates((prev) => prev.map((x, j) => (j === i ? s : x))); } });
    setStates(done);
    // The answer for the visitor: the last «ask» result that worked (or the last result at all).
    const lastAsk = plan.steps.map((s, i) => ({ s, r: results[i] })).reverse().find((x) => x.s.tool === 'ask' && x.r);
    setFinal(lastAsk?.r || results.filter(Boolean).pop() || '');
    setBusy('');
    abort.current = null;
  };

  return (
    <div className="space-y-3" data-testid="ws-automation">
      <p className="text-[12.5px] text-stone-600">{w('auto_intro')}</p>
      <textarea value={task} onChange={(e) => setTask(e.target.value)} rows={3} dir="auto" placeholder={w('auto_ph')} className="w-full rounded-xl border border-stone-300 p-3 text-sm outline-none focus:border-amber-500" />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { void makePlan(); }} disabled={!task.trim() || Boolean(busy)} className="inline-flex items-center gap-1 rounded-xl bg-amber-800 px-4 py-2 text-sm font-black text-white disabled:opacity-50 cursor-pointer">
          {busy === 'plan' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Workflow className="h-4 w-4" />}{w('plan')}
        </button>
        {plan && (busy === 'run'
          ? <button type="button" onClick={() => abort.current?.abort()} className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-black text-white cursor-pointer">{w('stop')}</button>
          : <button type="button" onClick={() => { void run(); }} disabled={Boolean(busy)} className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50 cursor-pointer"><Play className="h-4 w-4" />{w('run_all')}</button>)}
      </div>
      {plan && (
        <ol className="space-y-2">
          {plan.goal && <p className="text-[13px] font-bold text-stone-800" dir="auto">🎯 {plan.goal}</p>}
          {plan.steps.map((s, i) => {
            const st = states[i] || { status: 'waiting' };
            return (
              <li key={i} className={`rounded-xl border p-2.5 ${st.status === 'failed' ? 'border-rose-200 bg-rose-50/50' : st.status === 'done' ? 'border-emerald-200 bg-emerald-50/40' : 'border-stone-200 bg-white'}`}>
                <div className="flex items-start gap-2">
                  {st.status === 'running' ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-amber-700" /> : st.status === 'done' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /> : st.status === 'failed' ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-stone-300" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-black text-stone-700">{w('step')} {i + 1} · {w(TOOL_KEY[s.tool])}</p>
                    <p className="line-clamp-3 whitespace-pre-wrap text-[12px] text-stone-600" dir="auto">{s.input}</p>
                    {images[i] && <img src={images[i]} alt="" className="mt-2 max-h-64 rounded-lg border border-stone-200" />}
                    {st.status === 'done' && st.result && s.tool !== 'image' && (
                      <details className="mt-1"><summary className="cursor-pointer text-[11px] font-bold text-stone-500">{w('output')}</summary><pre dir="auto" className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-stone-50 p-2 text-[11.5px]">{st.result.slice(0, 6000)}</pre></details>
                    )}
                    {st.status === 'failed' && <p className="mt-1 text-[11px] text-rose-800">{w('failed')}</p>}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {final && (
        <div className="space-y-2 rounded-2xl border border-amber-200 bg-white p-4">
          <p className="text-[12px] font-black text-emerald-700">{w('done')}</p>
          <div className="text-[13.5px]"><ShaheenMarkdown text={final} /></div>
          <ExportMenu markdown={final} lang={lang} alsoSave />
        </div>
      )}
      {error && <p className="rounded-xl bg-rose-50 p-3 text-[12.5px] text-rose-900">{error}</p>}
    </div>
  );
}
