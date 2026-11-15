import { ask } from './workspaceApi';
import React, { useEffect, useRef, useState } from 'react';
import type { SupportedLanguage } from '../types/i18n';
import { LocalizedNumberInput } from '../components/LocalizedNumberInput';
import { storeNumber } from '../لغات/storeL10n';
import { buildTool, parseToolSpec, runTool, TOOL_EXAMPLES, TOOL_LIMITS, type ToolSpec, type ToolRun, toolFromReply, type ToolValue } from '../utils/shaheenToolBuilder';
import { PROGRAMMING_PATHS } from '../utils/shaheenProgramming';

const KEY = 'sham-block-tool-v1';
const defaults = (tool: ToolSpec) => Object.fromEntries(tool.inputs.map((i) => [i.id, i.type === 'list' ? JSON.stringify(i.default) : String(i.default)]));
export default function BlocksPanel({ lang, initialTool }: { lang: SupportedLanguage; initialTool?: ToolSpec }) {
  const ar = lang === 'ar'; const t = (a: string, e: string) => ar ? a : e;
  const [request, setRequest] = useState(''); const [source, setSource] = useState(() => JSON.stringify(initialTool || TOOL_EXAMPLES[0].tool, null, 2));
  const [tool, setTool] = useState<ToolSpec>(initialTool || TOOL_EXAMPLES[0].tool);
  const [inputs, setInputs] = useState(defaults(tool)); const [result, setResult] = useState<ToolRun | null>(null);
  const [notice, setNotice] = useState(''); const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null); const epoch = useRef(0);
  const controller = useRef<AbortController | null>(null); const [designing, setDesigning] = useState(false);
  useEffect(() => () => { epoch.current++; controller.current?.abort(); }, []);
  const cancelDesign = () => { epoch.current++; controller.current?.abort(); setDesigning(false); };
  const resetResult = () => { setResult(null); setError(''); setNotice(''); };
  const useTool = (next: ToolSpec) => { cancelDesign(); setTool(next); setSource(JSON.stringify(next, null, 2)); setInputs(defaults(next)); resetResult(); };
  const draft = async () => {
    cancelDesign(); resetResult(); const token = epoch.current; const abort = new AbortController(); controller.current = abort; setDesigning(true);
    try {
      const reply = await ask({ messages: [{ role: 'user', text: request }], language: lang, task: 'blocks' }, abort.signal);
      if (token !== epoch.current) return;
      const proposed = toolFromReply(reply.reply);
      if (!proposed || !runTool(proposed).ok) throw new Error('INVALID_TOOL_DEFINITION');
      useTool(proposed); setNotice(t('اتولّد تعريف واجتاز الفحص وتشغيل القيم الافتراضية فقط. راجع منطقه واختبر حالاتك؛ ده مش اعتماد عام ولا نشر.', 'A definition was drafted and passed validation and a default-input run only. Review its logic and test your cases; this is not certification or deployment.'));
    } catch { if (token === epoch.current) setError(t('تعذّر تصميم أداة صالحة: الخدمة قد تكون غير متاحة، أو التعريف غير آمن، أو الطلب خارج إمكانيات البلوكات. مفيش أداة ناجحة جديدة.', 'Could not draft a valid tool: the service may be unavailable, its definition invalid, or the task unsupported. No successful new tool was produced.')); }
    finally { if (token === epoch.current) setDesigning(false); }
  };
  const apply = () => {
    try { const next = parseToolSpec(source); useTool(next); setNotice(t('التعريف سليم بنيوياً؛ اختبر النتائج قبل الاعتماد عليه.', 'The definition is structurally valid; test its results before relying on it.')); }
    catch { setError(t('تعريف بلوكات غير صالح: راجع الأنواع والمراجع وحدود البرنامج.', 'Invalid blocks: check types, references and program limits.')); setResult(null); }
  };
  const dirty = source !== JSON.stringify(tool, null, 2);
  const run = () => {
    resetResult();
    if (dirty) { setError(t('طبّق تعريف البلوكات أولاً؛ لن نشغّل نسخة أقدم من اللي ظاهرة.', 'Apply the definition first; an older version will not be run.')); return; }
    try {
      const values = Object.fromEntries(tool.inputs.map((i) => [i.id, i.type === 'number' ? (inputs[i.id]?.trim() ? Number(inputs[i.id]) : NaN) : i.type === 'boolean' ? inputs[i.id] === 'true' : i.type === 'list' ? JSON.parse(inputs[i.id]) : inputs[i.id]]));
      setResult(runTool(tool, values));
    } catch { setError(t('مدخل غير صالح؛ القوائم تُكتب بصيغة JSON مثل [1,2,3].', 'Invalid input; lists use JSON such as [1,2,3].')); }
  };
  const save = () => {
    resetResult();
    try { if (dirty) throw new Error('UNAPPLIED'); localStorage.setItem(KEY, JSON.stringify(tool)); setNotice(t('اتحفظ تعريف الأداة على الجهاز ده فقط، مش في حسابك ولا على الموقع.', 'Tool definition saved on this device only, not to your account or the site.')); }
    catch { setError(t('تعذّر الحفظ؛ طبّق التعريف أولاً وتأكد إن تخزين المتصفح متاح.', 'Could not save; apply the definition and check browser storage.')); }
  };
  const display = (v: ToolValue): string => Array.isArray(v) ? `[${v.map(display).join(', ')}]` : typeof v === 'number' ? storeNumber(v, lang) : typeof v === 'boolean' ? (v ? t('نعم', 'true') : t('لا', 'false')) : v;
  const inputClass = 'w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm';
  const buttonClass = 'rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-bold disabled:opacity-40';
  return <section className="space-y-4" data-testid="ws-blocks">
    <h2 className="text-xl font-black">{t('مصنع أدوات شاهين بالبلوكات', 'Shaheen block tool workshop')}</h2>
    <p className="text-sm leading-relaxed text-stone-600">{t('شاهين يركّب الأمثلة المدعومة محلياً، وتقدر تعدّل تعريف JSON لبناء تركيبات جديدة من نفس البلوكات. ده مفسّر محدود، مش تشغيل لكل لغات البرمجة ولا بناء مضمون لأي أداة.', 'Shaheen assembles the supported examples locally. Edit JSON to compose new tools from the same blocks. This is a bounded interpreter, not execution of every programming language or a universal tool generator.')}</p>
    <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-950">{t('التشغيل بلا شبكة أو مفاتيح أو وصول لملفاتك، ومن غير تعديل الموقع أو نشره. حد القائمة ١٠٠ عنصر وميزانية التشغيل ٥٠٠٠ خطوة. الأرقام بلا وحدات تلقائية؛ راجع وحداتك بنفسك.', 'Execution has no network, keys or file access and cannot modify or deploy the site. Lists are capped at 100 items and runs at 5000 steps. Numbers have no automatic units; verify your units.')}</p>
    <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); resetResult(); const built = buildTool(request, ar); if (built.tool) useTool(built.tool); setNotice(built.reason); }}>
      <input aria-label={t('الأداة المطلوبة', 'Requested tool')} value={request} maxLength={2000} onChange={(event) => setRequest(event.target.value)} placeholder={t('مثلاً: ابني حاسبة خصم', 'For example: build a discount calculator')} className={`${inputClass} min-w-0 flex-1`} />
      <button type="submit" disabled={designing} className={buttonClass}>{t('ركّب الأداة', 'Assemble tool')}</button>
    </form>
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={buttonClass} disabled={designing || !request.trim()} onClick={() => void draft()}>{t('صمّم أداة جديدة بالوصف (يحتاج اتصال)', 'Draft a new tool from description (online)')}</button>
      {designing && <><p role="status" className="text-sm">{t('جارٍ تصميم تعريف محدود وفحصه…', 'Drafting and validating a bounded definition…')}</p><button type="button" className={buttonClass} onClick={cancelDesign}>{t('إلغاء التصميم', 'Cancel drafting')}</button></>}
    </div>
    <p className="text-xs text-stone-500">{t('التصميم الجديد يرسل الوصف فقط لخدمة شاهين المهيأة، لو متاحة وحصتها تسمح. التشغيل بعد كده محلي؛ القيم الافتراضية أمثلة وليست حقائق معتمدة.', 'Online drafting sends only your description to the configured Shaheen service, when available with quota. Execution remains local; defaults are examples, not certified facts.')}</p>
    <div className="flex flex-wrap gap-2">{TOOL_EXAMPLES.map((example) => <button key={example.id} type="button" className={buttonClass} onClick={() => { const next = parseToolSpec(JSON.stringify(example.tool)); next.title = ar ? example.ar : example.en; useTool(next); }} data-testid={`block-example-${example.id}`}>{ar ? example.ar : example.en}</button>)}</div>
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
        <h3 className="font-bold">{tool.title}</h3>
        <ol className="space-y-2" aria-label={t('ترتيب البلوكات', 'Block order')}>{tool.nodes.map((node, i) => <li key={node.id} className="rounded-xl border-s-4 border-amber-600 bg-amber-50 p-3">
          <span className="text-xs font-bold">{storeNumber(i + 1, lang)} · <code>{node.id}</code> · <code>{node.expr.kind}</code></span>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all text-xs" dir="ltr">{JSON.stringify(node.expr)}</pre>
        </li>)}</ol>
        {tool.inputs.map((input) => <label key={input.id} className="block space-y-1 text-sm">
          <span className="font-semibold">{input.label} <code className="text-xs text-stone-500">({input.type})</code></span>
          {input.type === 'boolean' ? <input type="checkbox" className="ms-3" checked={inputs[input.id] === 'true'} onChange={(event) => { setInputs({ ...inputs, [input.id]: String(event.target.checked) }); resetResult(); }} />
            : input.type === 'number' ? <LocalizedNumberInput lang={lang} value={Number(inputs[input.id])} onValue={(n) => { setInputs({ ...inputs, [input.id]: String(n) }); resetResult(); }} className={inputClass} ariaLabel={input.label} />
              : <input className={inputClass} value={inputs[input.id] || ''} maxLength={input.type === 'list' ? 16000 : TOOL_LIMITS.text} onChange={(event) => { setInputs({ ...inputs, [input.id]: event.target.value }); resetResult(); }} dir="auto" />}
        </label>)}
        <button type="button" onClick={run} disabled={dirty || designing} className="rounded-xl bg-amber-800 px-5 py-2 font-bold text-white disabled:opacity-40">{t('شغّل الأداة', 'Run tool')}</button>
        {dirty && <p role="status" className="text-xs text-amber-900">{t('التعريف اتغيّر؛ طبّقه قبل التشغيل أو الحفظ.', 'Definition changed; apply it before running or saving.')}</p>}
        {result?.ok && <div role="status" data-testid="block-results" className="space-y-1 rounded-xl bg-emerald-50 p-3 text-sm">{Object.entries(result.outputs).map(([id, output]) => <p key={id}><code>{id}</code>: <span>{display(output)}</span></p>)}<p className="text-xs">{t('خطوات نُفّذت:', 'Steps executed:')} {storeNumber(result.steps, lang)}</p></div>}
        {result && !result.ok && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm">{t('فشل التشغيل؛ لم تُنتج الأداة نتيجة ناجحة. راجع نوع المدخلات والقسمة على صفر وحدود التشغيل.', 'Run failed; no successful result was produced. Check input types, division by zero and execution limits.')} <code>{result.error}</code></p>}
      </div>
      <div className="space-y-3">
        <label className="block text-sm font-bold">{t('تعريف الأداة — قابل للتعديل والاستيراد', 'Tool definition — editable and importable')}
          <textarea aria-label={t('تعريف البلوكات JSON', 'Blocks JSON definition')} value={source} maxLength={TOOL_LIMITS.bytes} onChange={(event) => { cancelDesign(); setSource(event.target.value); resetResult(); }} rows={18} spellCheck={false} dir="ltr" className="mt-2 w-full rounded-xl border border-stone-300 bg-stone-900 p-3 font-mono text-xs text-stone-100" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass} onClick={apply}>{t('افحص وطبّق التعريف', 'Validate and apply')}</button>
          <button type="button" className={buttonClass} disabled={dirty || designing} onClick={save}>{t('احفظ على الجهاز', 'Save on device')}</button>
          <button type="button" className={buttonClass} onClick={() => { resetResult(); try { const saved = localStorage.getItem(KEY); if (!saved) throw new Error('EMPTY'); useTool(parseToolSpec(saved)); setNotice(t('تم استرجاع التعريف المحفوظ على الجهاز.', 'Restored the definition saved on this device.')); } catch { setError(t('مفيش تعريف محفوظ صالح أو التخزين غير متاح.', 'No valid saved definition, or storage is unavailable.')); } }}>{t('استرجع المحفوظ', 'Restore saved')}</button>
          <button type="button" className={buttonClass} onClick={() => file.current?.click()}>{t('استورد JSON', 'Import JSON')}</button>
          <button type="button" className={buttonClass} disabled={dirty || designing} onClick={() => { const url = URL.createObjectURL(new Blob([source], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'shaheen-tool.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>{t('نزّل JSON', 'Download JSON')}</button>
        </div>
        <input ref={file} hidden type="file" accept="application/json,.json" onChange={async (event) => {
          const selected = event.target.files?.[0]; event.target.value = ''; if (!selected) return;
          cancelDesign(); const token = ++epoch.current; resetResult();
          try { if (selected.size > TOOL_LIMITS.bytes) throw new Error('LARGE'); const raw = await selected.text(); if (token === epoch.current) useTool(parseToolSpec(raw)); }
          catch { if (token === epoch.current) setError(t('تعذّر استيراد تعريف JSON صالح ضمن حدود الحجم.', 'Could not import a valid JSON definition within the size limit.')); }
        }} />
      </div>
    </div>
    {notice && <p role="status" className="rounded-xl bg-sky-50 p-3 text-sm">{notice}</p>}
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    <details className="rounded-2xl border border-stone-200 bg-white p-4"><summary className="cursor-pointer font-bold">{t('كيف تركّب أداة جديدة؟', 'How to compose a new tool')}</summary>
      <p className="mt-3 text-sm">{t('عرّف inputs بالأنواع number وtext وboolean وlist، ثم nodes بأسماء فريدة. اربط input باسم المدخل وref باسم بلوك سابق. اختر op من القائمة، أو if بشرط منطقي، أو map بقائمة وbody يستخدم item. حدّد outputs بأسماء البلوكات النهائية، ثم افحص واختبر. النشر والربط بخدمة خارجية مش جزء من التشغيل المحلي.', 'Define typed inputs, then uniquely named nodes. Use input to read a field and ref to read an earlier node. Choose a listed op, an if with a boolean test, or map with a list and a body using item. Name final nodes in outputs, validate, then test. Deployment and external services are outside this local runtime.')}</p>
      <p className="mt-2 font-mono text-xs" dir="ltr">add, sub, mul, div, round, gt, eq, and, or, not, trim, upper, lower, length, split, join, sum, sort, unique</p>
      <p className="mt-2 text-xs">{t('كل العمليات الثنائية لها مدخلان؛ round وnot وtrim وupper وlower وlength وsum وsort وunique لها مدخل واحد. round يقرب لمنزلتين. length يعد وحدات UTF-16، مش بالضرورة عدد الحروف المرئية. البرنامج يتوقف عند أول خطأ ولا يعرض نتائج جزئية.', 'Binary operations take two arguments; round, not, trim, upper, lower, length, sum, sort and unique take one. round uses two decimal places. length counts UTF-16 units, not necessarily visible characters. The program stops at its first error without exposing partial results.')}</p>
    </details>
    <details className="rounded-2xl border border-stone-200 bg-white p-4"><summary className="cursor-pointer font-bold">{t('مسارات علوم البرمجة واللغات', 'Programming science and language paths')}</summary>
      <p className="my-3 text-xs text-stone-600">{t('دي إرشادات تعليمية للمسارات، مش دليل إتقان كل اللغات ولا تثبيت مفسراتها.', 'These are learning paths, not evidence of mastery or installed language runtimes.')}</p>
      <ul className="space-y-3 text-sm">{PROGRAMMING_PATHS.map((path) => <li key={path.id}><strong>{path.name}</strong> — {ar ? path.ar : path.en}</li>)}</ul>
    </details>
  </section>;
}
