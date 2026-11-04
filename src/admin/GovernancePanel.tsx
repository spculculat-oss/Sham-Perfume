import { useState } from 'react';
import { Download, Landmark, ShieldCheck } from 'lucide-react';
import { adminRequest, send } from './adminApi';
import { T, TP } from './adminL10n';
import { OPERATING_RULES, POLICY_PRINCIPLE, POLICY_VERSION, RESPONSE_TARGETS, RISK_LANES } from '../utils/platformPolicies';
import { CHARTER, INSTITUTIONS, STATUS, emptyPlan, existingDepartments, nextStatuses, overdue, type GovernanceTask, type InstitutionId } from '../utils/platformGovernance';

const card = 'rounded-2xl border border-stone-700 bg-stone-900 p-4';
const field = 'mt-1 w-full rounded-xl border border-stone-600 bg-stone-950 p-2 text-stone-100';
const action = 'rounded-xl border border-amber-700 px-3 py-2 text-sm text-amber-200 disabled:opacity-40';
const blank = () => ({ title: '', institution: 'operations' as InstitutionId, responsible: '', due: '', acceptance: '', resources: '' });

/** Owner-only server-backed workspace. The key and fetched data never persist in browser storage. */
export default function GovernancePanel() {
  const [tab, setTab] = useState<'overview' | 'charter' | 'structure' | 'tasks' | 'log' | 'policies'>('overview');
  const [plan, setPlan] = useState(emptyPlan);
  const [form, setForm] = useState(blank);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [ownerKey, setOwnerKey] = useState('');
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  type Saved = { revision: number; plan: typeof plan };
  async function load() {
    setBusy(true); setError('');
    try {
      const saved = await adminRequest<Saved>('/governance', { headers: { 'X-Sham-Owner': ownerKey } });
      setPlan(saved.plan); setRevision(saved.revision); setConnected(true);
    } catch (e) { setConnected(false); setPlan(emptyPlan()); setError(e instanceof Error ? e.message : T('تعذر فتح سجل الحوكمة.')); }
    finally { setBusy(false); }
  }
  async function command(body: Record<string, unknown>): Promise<boolean> {
    if (busy) return false;
    setBusy(true); setError('');
    try {
      const saved = await adminRequest<Saved>('/governance/commands', { ...send('POST', { ...body, revision }), headers: { 'Content-Type': 'application/json', 'X-Sham-Owner': ownerKey } });
      setPlan(saved.plan); setRevision(saved.revision); return true;
    } catch (e) { setError(e instanceof Error ? e.message : T('تعذر حفظ التغيير.')); return false; }
    finally { setBusy(false); }
  }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  const count = (n: number) => TP('{n}', { n });
  function exportPlan() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...plan, revision, charterVersion: 'draft-1', exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'sham-governance-plan.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function move(task: GovernanceTask, status: GovernanceTask['status']) {
    void command({ action: 'transition', id: task.id, status, evidence: notes[task.id] ?? task.evidence });
  }
  if (!connected) return <section className={`${card} mx-auto max-w-lg space-y-4`}>
    <h2 className="text-xl font-bold text-amber-200">{T('الحوكمة الخلفية — دخول المالك فقط')}</h2>
    <p className="text-sm text-stone-300">{T('دخول الإدارة وحده لا يفتح السجل. أدخل مفتاح الحوكمة الخاص الذي أعددته على الخادم. يُحفظ في ذاكرة القسم فقط ويُنسى عند مغادرته. لا تشاركه في المحادثة.')}</p>
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void load(); }}>
      <label>{T('مفتاح الحوكمة الخاص')}<input type="password" autoComplete="off" className={field} required value={ownerKey} onChange={(e) => setOwnerKey(e.target.value)} /></label>
      <button disabled={busy || !ownerKey} className={action}>{busy ? T('جارٍ التحقق…') : T('فتح السجل الخاص')}</button>
    </form>
    {error && <p role="alert" className="text-red-200">{error}</p>}
    <p className="text-xs text-stone-400">{T('الخدمة تتوقف بأمان إن لم يُجهّز مفتاح المالك وتخزين مركزي خاص. لا حفظ مؤقت ولا رجوع صامت للتخزين المحلي.')}</p>
  </section>;
  return <section className="space-y-4" aria-label={T('دولة المنصة')}>
    <header className="rounded-3xl border border-amber-800 bg-gradient-to-bl from-amber-950 to-stone-900 p-5">
      <div className="flex flex-wrap items-center gap-3"><Landmark className="text-amber-300" /><h2 className="text-xl font-black text-amber-100">{T('دولة المنصة — التأسيس')}</h2><span className="rounded-full border border-amber-600 px-3 py-1 text-xs">{T('مسودة تنظيمية')}</span></div>
      <p className="mt-3 text-sm text-stone-300">{T('رؤية واحدة، مسؤوليات واضحة، ومحاسبة عادلة. نبني على أدوات شاهين الحالية ولا نستبدلها.')}</p>
    </header>
    <p className="rounded-xl border border-sky-900 bg-sky-950/40 p-3 text-sm text-sky-100">{T('السجل محفوظ على الخادم الخاص وبصلاحية المالك فقط. لا يُنشر في ملفات الموقع أو تقارير الزوار. هذه المرحلة تسجل التكليفات ولا ترسلها للروبوتات بعد، ولا تفرض عقوبات تلقائية. لا تكتب أسراراً أو بيانات قضايا شخصية.')}</p>
    <div className="flex flex-wrap items-center gap-3 text-xs text-stone-400"><span>{TP('نسخة السجل: {n}', { n: revision })}</span><button type="button" disabled={busy} className={action} onClick={() => void load()}>{T('تحديث من الخادم')}</button><button type="button" disabled={busy} className={action} onClick={() => { setOwnerKey(''); setConnected(false); setPlan(emptyPlan()); setForm(blank()); setNotes({}); setError(''); }}>{T('قفل سجل الحوكمة')}</button></div>
    <nav aria-label={T('أقسام الحوكمة')} className="flex flex-wrap gap-2">{([['overview', 'غرفة القيادة'], ['charter', 'الميثاق'], ['policies', 'قوانين الإنتاج الذكية'], ['structure', 'الهيكل المؤسسي'], ['tasks', 'المهام والقرارات'], ['log', 'سجل التخطيط']] as const).map(([id, label]) => <button type="button" key={id} onClick={() => setTab(id)} aria-pressed={tab === id} className={`${action} ${tab === id ? 'bg-amber-900/60' : ''}`}>{T(label)}</button>)}<button type="button" onClick={exportPlan} className={`${action} inline-flex items-center gap-2`}><Download className="h-4 w-4" />{T('تصدير الخطة')}</button></nav>
    {error && <p role="alert" className="rounded-xl bg-red-950 p-3 text-red-200">{error}</p>}
    {tab === 'overview' && <>
      <div className="grid gap-3 sm:grid-cols-3">{[
        ['المهام المحفوظة على الخادم', plan.tasks.length], ['بانتظار المراجعة', plan.tasks.filter((t) => t.status === 'review').length], ['تحتاج متابعة موعدها', plan.tasks.filter((t) => overdue(t, today)).length],
      ].map(([label, value]) => <div key={label} className={card}><p className="text-sm text-stone-400">{T(String(label))}</p><p className="mt-2 text-3xl font-black text-amber-200">{count(Number(value))}</p></div>)}</div>
      <div className={card}><h3 className="font-bold">{T('خطة البناء')}</h3><ol className="mt-3 list-decimal space-y-3 ps-5 text-sm text-stone-300"><li>{T('الآن: ميثاق وهيكل وسجل مهام خاص محفوظ مركزياً، مع حماية مستقلة للمالك.')}</li><li>{T('التالي: هويات للعاملين والوكلاء، وصلاحيات مفصّلة وربط التكليفات بالتنفيذ.')}</li><li>{T('بعدها: ربط القرارات بصندوق الموافقات والمهام الفعلية والتنبيهات.')}</li><li>{T('لاحقاً: الشكاوى والاستئناف والأكاديمية والدفاع الرقمي بعد مراجعة مختصين.')}</li></ol></div>
      <p className="flex items-center gap-2 text-sm text-emerald-200"><ShieldCheck className="h-5 w-5" />{T('تجاوز الموعد يحتاج تفسيراً ومراجعة، وليس عقوبة تلقائية.')}</p>
    </>}
    {tab === 'charter' && <div className={card}><h3 className="font-bold text-amber-200">{T('ميثاق الحوكمة — مسودة تحتاج اعتماد المالك')}</h3><ol className="mt-4 list-decimal space-y-4 ps-5 text-sm">{CHARTER.map((rule) => <li key={rule}>{T(rule)}</li>)}</ol></div>}
    {tab === 'policies' && <div className="space-y-4">
      <div className={card}><h3 className="font-bold text-amber-200">{T('لائحة الإنتاج الذكية — مقترحة للاعتماد')}</h3><p className="mt-2">{T(POLICY_PRINCIPLE)}</p><p className="mt-2 text-xs text-stone-400">{POLICY_VERSION}</p><p className="mt-3 text-sm text-sky-200">{T('هذه قواعد مقترحة وليست تفويض تنفيذ. لا تغيّر إعدادات المالك أو الصلاحيات الحالية. مهَل الرد أهداف داخل ساعات العمل بعد تعيين مسؤول وبديل، وليست ضمان خدمة مفعّلاً.')}</p></div>
      <h3 className="font-bold">{T('ثلاثة مسارات حسب المخاطرة')}</h3>
      <div className="grid gap-3 lg:grid-cols-3">{RISK_LANES.map((lane) => <article key={lane.id} className={card}><h4 className="font-bold text-amber-200">{T(lane.name)}</h4><p className="mt-2 text-sm">{T(lane.examples)}</p><p className="mt-3 text-sm text-sky-200">{T(lane.condition)}</p><p className="mt-2 text-xs text-stone-400">{T(lane.review)}</p></article>)}</div>
      <div className="grid gap-3 md:grid-cols-2">{OPERATING_RULES.map((rule) => <article className={card} key={rule.id}><h4 className="font-bold text-amber-200">{T(rule.title)}</h4><p className="mt-2 text-sm leading-relaxed">{T(rule.rule)}</p><p className="mt-3 text-xs text-stone-400">{T('نقيس الفاعلية بـ:')} {T(rule.measure)}</p></article>)}</div>
      <div className={card}><h3 className="font-bold">{T('أهداف الرد والتصعيد — مقترحة')}</h3><dl className="mt-3 space-y-3">{RESPONSE_TARGETS.map((item) => <div key={item.kind}><dt className="text-sm font-bold text-amber-100">{T(item.kind)}</dt><dd className="mt-1 text-sm text-stone-300">{T(item.target)}</dd></div>)}</dl><p className="mt-4 text-sm text-sky-200">{T('تجاوز المهلة يصعّد الطلب ولا يحوّله لموافقة، ويمكن استكمال الأجزاء المستقلة المصرح بها.')}</p></div>
    </div>}
    {tab === 'structure' && <><div className={card}>{T('المالك ← مجلس الاستراتيجية ← الحكومة التنفيذية. الرقابة والعدالة لهما مسار مراجعة مستقل. الربط أدناه مرجعي بالأقسام الحالية وليس تعيينات أو صلاحيات جديدة.')}</div><div className="grid gap-3 md:grid-cols-2">{INSTITUTIONS.map((unit) => <article key={unit.id} className={card}><h3 className="font-bold text-amber-200">{T(unit.name)}</h3><p className="mt-2 text-sm">{T(unit.mission)}</p><p className="mt-3 text-xs text-stone-400">{T('أقسام حالية ذات صلة:')} {existingDepartments(unit.id).map((d) => T(d.nameAr)).join(' · ') || T('يحتاج تحديد فريق ومختصين')}</p><span className="mt-2 inline-block text-xs text-sky-300">{T('هيكل مقترح — غير مفعّل')}</span></article>)}</div></>}
    {tab === 'tasks' && <>
      <form className={`${card} grid gap-3 sm:grid-cols-2`} onSubmit={(e) => {
        e.preventDefault();
        void command({ action: 'create', task: form }).then((saved) => { if (saved) setForm(blank()); });
      }}>
        <h3 className="font-bold sm:col-span-2">{T('تسجيل مسودة تكليف')}</h3>
        <label>{T('عنوان المهمة')}<input className={field} required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label>{T('الجهة المسؤولة')}<select className={field} value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value as InstitutionId })}>{INSTITUTIONS.map((i) => <option key={i.id} value={i.id}>{T(i.name)}</option>)}</select></label>
        <label>{T('المسؤول المقترح')}<input className={field} required maxLength={120} value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} /></label>
        <label>{T('الموعد النهائي')}<input type="date" className={field} required value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></label>
        <label>{T('معيار قبول النتيجة')}<textarea className={field} required maxLength={1000} value={form.acceptance} onChange={(e) => setForm({ ...form, acceptance: e.target.value })} /></label>
        <label>{T('الموارد والاعتماديات')}<textarea className={field} required maxLength={1000} value={form.resources} onChange={(e) => setForm({ ...form, resources: e.target.value })} /></label>
        <button disabled={busy} className={`${action} sm:col-span-2`}>{T('إضافة مسودة — دون إرسال أو تنفيذ')}</button>
      </form>
      {!plan.tasks.length && <p className={card}>{T('لا توجد مهام بعد. أضف أول تكليف بمعيار قبول واضح.')}</p>}
      {plan.tasks.map((task) => <article key={task.id} className={`${card} space-y-3`}><div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{task.title}</h3><span className="text-amber-300">{T(STATUS[task.status])}</span></div><p className="text-sm text-stone-300">{task.responsible} · {T(INSTITUTIONS.find((i) => i.id === task.institution)!.name)} · <time dateTime={task.due}>{task.due}</time></p><p className="text-sm">{T('معيار القبول:')} {task.acceptance}</p><p className="text-sm">{T('الموارد:')} {task.resources}</p>{overdue(task, today) && <p className="text-sm text-orange-300">{T('تجاوز الموعد — راجع العوائق قبل تقييم الأداء.')}</p>}
        {task.status !== 'done' ? <><label className="block text-sm">{T('دليل الإنجاز أو سبب التعطّل وخطوة المعالجة')}<textarea className={field} maxLength={2000} value={notes[task.id] ?? task.evidence} onChange={(e) => setNotes({ ...notes, [task.id]: e.target.value })} /></label><div className="flex flex-wrap gap-2">{nextStatuses(task.status).map((status) => <button type="button" key={status} disabled={busy} className={action} onClick={() => move(task, status)}>{T(STATUS[status])}</button>)}</div></> : <p className="text-sm text-emerald-200">{T('دليل الإنجاز:')} {task.evidence}</p>}
      </article>)}
    </>}
    {tab === 'log' && <div className={card}><p className="mb-3 text-sm text-stone-400">{T('سجل تغييرات خادمي بإصدارات متتابعة لا تعدّلها الواجهة. تغيير الحالة لا يثبت تنفيذ العمل فعلياً. جميع الأحداث هنا من صلاحية المالك، ولم تُفعّل هويات فردية بعد.')}</p>{!plan.events.length && <p>{T('لا توجد أحداث مسجلة بعد.')}</p>}<ol className="space-y-3">{plan.events.map((event, i) => <li key={i} className="border-b border-stone-700 pb-2 text-sm"><time className="text-xs text-stone-400">{event.at}</time><p>{plan.tasks.find((t) => t.id === event.taskId)?.title} — {T(event.text)}</p></li>)}</ol></div>}
  </section>;
}
