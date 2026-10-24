import React, { useEffect, useState } from 'react';
import { AlertTriangle, Banknote, BookOpen, Briefcase, CalendarClock, CheckCircle2, Loader2, MessageCircleQuestion, Plus, Sparkles, Target, Trash2, TrendingUp } from 'lucide-react';
import { adminRequest, send } from './adminApi';
import { adminLocale } from './adminL10n';
import { major } from '../finance/money';
import { DEAL_SOURCES, DEAL_STAGES, SOURCE_LABEL, STAGE_LABEL, STAGE_PROBABILITY, type DealStage } from '../sales/pipeline';
import { MODULE_LABEL, SALES_LESSONS, lessonById } from '../sales/playbook';
import { SALES_PITFALLS, SALES_PRINCIPLES } from '../utils/salesCraft';
import type { SalesDashboard } from '../../server/sales/service';

/**
 * «إدارة المبيعات» — the sales desk inside «بنك شام»: the real cockpit (confirmed collections only), the
 * opportunity pipeline (labels, not contacts), the monthly target and its pace, the daily rhythm, the
 * curriculum built from the platform handbook and the selling craft, and «مدير المبيعات» answering from the
 * same figures. Numbers in the private admin panel may include amounts; the robot's public report is counts only.
 */
const f = (ar: string, en: string) => (adminLocale().startsWith('ar') ? ar : en);
const card = 'rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-sm';
const field = 'w-full rounded-xl border border-stone-300 p-2.5 text-sm bg-white';
const button = 'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-40';
const money = (minor: number, currency: string) => {
  try { return new Intl.NumberFormat(adminLocale(), { style: 'currency', currency, maximumFractionDigits: 2 }).format(major(minor, currency)); }
  catch { return `${minor} ${currency}`; }
};
const num = (n: number) => new Intl.NumberFormat(adminLocale()).format(n);
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(adminLocale(), { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Cairo' }) : '—');
const paceName = (p: string) => ({ ahead: f('سابق الإيقاع', 'Ahead'), on: f('على الإيقاع', 'On pace'), behind: f('متأخر عن الإيقاع', 'Behind pace'), unset: f('من غير هدف', 'No target') }[p] || p);
const priorityName = (p: string) => ({ now: f('دلوقتي', 'Now'), today: f('النهارده', 'Today'), week: f('الأسبوع ده', 'This week') }[p] || p);
const priorityTone = (p: string) => ({ now: 'bg-red-100 text-red-800', today: 'bg-amber-100 text-amber-900', week: 'bg-sky-50 text-sky-800' }[p] || 'bg-stone-100');
const SECTIONS = ['cockpit', 'pipeline', 'targets', 'rhythm', 'study', 'advisor'] as const;
type Section = typeof SECTIONS[number];
const emptyDeal = {
  id: '', title: '', accountLabel: '', currency: 'EGP', value: '', stage: 'lead' as DealStage, source: 'store',
  nextActionAt: new Date().toISOString().slice(0, 10), nextActionAr: '', notes: '',
};

export default function SalesPanel({ onOpenBank }: { onOpenBank?: () => void }) {
  const [section, setSection] = useState<Section>('cockpit');
  const [data, setData] = useState<SalesDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [deal, setDeal] = useState(emptyDeal);
  const [target, setTarget] = useState({ currency: 'EGP', amount: '' });
  const [answer, setAnswer] = useState<{ question: string; text: string } | null>(null);
  const [question, setQuestion] = useState('');
  const [quiz, setQuiz] = useState<{ lessonId: string; choice: number } | null>(null);
  const [quizResult, setQuizResult] = useState<string>('');

  useEffect(() => {
    const controller = new AbortController(); setLoading(true);
    adminRequest<SalesDashboard>('/finance/sales', { signal: controller.signal })
      .then((d) => { if (!controller.signal.aborted) { setData(d); setError(''); } })
      .catch((e) => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);

  const act = async (work: () => Promise<unknown>, done = f('تم الحفظ.', 'Saved.')) => {
    if (busy) return; setBusy(true); setError(''); setNotice('');
    try { await work(); setRevision((n) => n + 1); setNotice(done); }
    catch (e) { setError(e instanceof Error ? e.message : f('تعذّر التنفيذ', 'Failed')); }
    finally { setBusy(false); }
  };

  const today = data ? lessonById(data.study.todayId) || SALES_LESSONS[0] : SALES_LESSONS[0];
  const progress = data?.study.progress;
  const actions = data?.rhythm || [];

  const saveDeal = (e: React.FormEvent) => {
    e.preventDefault();
    const body = { title: deal.title, accountLabel: deal.accountLabel, currency: deal.currency, value: deal.value, stage: deal.stage, source: deal.source,
      nextActionAt: deal.nextActionAt, nextActionAr: deal.nextActionAr, notes: deal.notes };
    void act(async () => {
      if (deal.id) await adminRequest(`/finance/sales/deals/${deal.id}`, send('PUT', body));
      else await adminRequest('/finance/sales/deals', send('POST', body));
      setDeal(emptyDeal);
    }, deal.id ? f('تم تعديل الفرصة.', 'Opportunity updated.') : f('تمت إضافة الفرصة.', 'Opportunity added.'));
  };
  const move = (id: string, stage: DealStage) => {
    const lostReason = stage === 'lost' ? window.prompt(f('سبب الخسارة بصراحة (ده اللي بيعلّمك):', 'The honest lost reason (this is what teaches you):')) : undefined;
    if (stage === 'lost' && !lostReason) return;
    const body = { stage, ...(lostReason ? { lostReason } : {}) };
    void act(() => adminRequest(`/finance/sales/deals/${id}/move`, send('POST', body)), f('اتنقلت المرحلة.', 'Stage moved.'));
  };
  const remove = (id: string) => {
    if (!window.confirm(f('تحذف الفرصة من المكتب؟ السجل بيسجّل الحذف.', 'Delete this opportunity? The audit log records it.'))) return;
    void act(() => adminRequest(`/finance/sales/deals/${id}`, { method: 'DELETE' }), f('اتحذفت.', 'Deleted.'));
  };
  const saveTarget = (e: React.FormEvent) => {
    e.preventDefault();
    void act(() => adminRequest('/finance/sales/targets', send('PUT', { ...target, month: new Date().toISOString().slice(0, 7) })), f('تم حفظ الهدف.', 'Target saved.'));
  };
  const ask = (text: string) => {
    if (!text.trim()) return;
    void act(async () => {
      const r = await adminRequest<{ answer: string; topic: string }>('/finance/sales/ask', send('POST', { question: text }));
      setAnswer({ question: text, text: r.answer });
    }, '');
  };
  const submitQuiz = () => {
    if (!quiz) return;
    void act(async () => {
      const r = await adminRequest<{ correct: boolean }>('/finance/sales/study', send('POST', quiz));
      setQuizResult(r.correct ? f('إجابة صحيحة — الدرس اتحفظ.', 'Correct — lesson logged.') : f('إجابة غلط — راجع شرح الدرس وجاوب تاني.', 'Wrong — read the lesson again and retry.'));
      setQuiz(null);
    }, '');
  };

  const tabs: Record<Section, [string, React.ReactNode]> = {
    cockpit: [f('لوحة المبيعات', 'Sales cockpit'), <TrendingUp key="i" className="w-4 h-4" />],
    pipeline: [f('خط الأنابيب', 'Pipeline'), <Briefcase key="i" className="w-4 h-4" />],
    targets: [f('الأهداف', 'Targets'), <Target key="i" className="w-4 h-4" />],
    rhythm: [f('إيقاع اليوم', 'Daily rhythm'), <CalendarClock key="i" className="w-4 h-4" />],
    study: [f('المنهج والتدريب', 'Curriculum'), <BookOpen key="i" className="w-4 h-4" />],
    advisor: [f('اسأل مدير المبيعات', 'Ask sales'), <MessageCircleQuestion key="i" className="w-4 h-4" />],
  };

  return <div className="space-y-4" data-testid="sales-panel">
    <div className="rounded-2xl bg-gradient-to-l from-emerald-950 to-stone-900 text-white p-5 sm:p-6">
      <p className="text-[11px] font-bold tracking-wide text-emerald-300">{f('بنك شام · قسم إدارة المبيعات · تحت إدارة الخبير شاهين', 'Sham Bank · Sales desk · Under Shaheen')}</p>
      <h3 className="text-xl font-bold mt-1 flex items-center gap-2"><TrendingUp className="w-6 h-6" />{f('إدارة المبيعات', 'Sales management')}</h3>
      <p className="text-sm text-stone-300 mt-2 max-w-2xl">{f('فرص بمراحلها وقيمتها الموزونة، هدف الشهر وإيقاعه من التحصيل المؤكد في بنك شام، إيقاع يومي بالأولوية، ومنهج يومي من كتيب المنصة وعلم البيع. أرقام حقيقية فقط، وبيانات التواصل مكانها حساب العميل وطلبه.', 'Opportunities by stage and weighted value, the monthly target paced on confirmed Sham Bank collections, a prioritised daily rhythm, and a daily curriculum from the platform handbook and the selling craft. Real figures only; customer contacts stay in their account and order.')}</p>
      <div className="flex flex-wrap gap-3 mt-4 text-xs text-stone-300">
        <span>{f('الإصدار:', 'Edition:')} {data?.edition || '—'}</span>
        <span>{data?.storage.persistent ? f('تخزين دائم', 'Durable storage') : f('تخزين مؤقت', 'Temporary storage')}</span>
        <span>{f('آخر قراءة:', 'Last read:')} {when(data?.at)}</span>
      </div>
    </div>

    {error && <p role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm">{error}</p>}
    {notice && <p role="status" className="bg-emerald-50 text-emerald-800 rounded-xl p-3 text-sm">{notice}</p>}

    <div className="flex flex-wrap gap-2" role="tablist" aria-label={f('أقسام إدارة المبيعات', 'Sales sections')}>
      {SECTIONS.map((id) => <button key={id} type="button" role="tab" aria-selected={section === id} onClick={() => setSection(id)}
        className={`${button} ${section === id ? 'bg-emerald-800 text-white' : 'bg-white border border-stone-200 text-stone-600'}`}>{tabs[id][1]}{tabs[id][0]}{id === 'rhythm' && actions.length ? ` (${actions.length})` : ''}</button>)}
    </div>

    {loading && !data && <p role="status" className="text-sm flex items-center gap-2 text-stone-500"><Loader2 className="w-4 h-4 animate-spin" />{f('جاري قراءة مكتب المبيعات…', 'Reading the sales desk…')}</p>}

    {data && <>
      {section === 'cockpit' && <>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className={card}><p className="text-xs text-stone-500">{f('صحة المبيعات', 'Sales health')}</p><p className="text-3xl font-bold mt-2" dir="ltr">{data.health.score}<span className="text-base text-stone-400">/100</span></p><p className="text-xs mt-2 text-stone-600">{data.health.labelAr}</p></div>
          <div className={card}><p className="text-xs text-stone-500">{f('الفرص المفتوحة', 'Open opportunities')}</p><p className="text-3xl font-bold mt-2">{num(data.pipeline.openCount)}</p><p className="text-xs mt-2 text-stone-600">{f('متأخرة:', 'Overdue:')} {num(data.pipeline.overdueCount)} · {f('من غير خطوة:', 'No next step:')} {num(data.pipeline.withoutNextStep)}</p></div>
          <div className={card}><p className="text-xs text-stone-500">{f('تحويلات مستنية تأكيدك', 'Transfers awaiting you')}</p><p className="text-3xl font-bold mt-2 text-amber-700">{num(data.live.waitingConfirmation)}</p><button type="button" className="text-xs text-emerald-800 underline mt-2" onClick={onOpenBank}>{f('افتح التحصيل في بنك شام', 'Open direct collection')}</button></div>
          <div className={card}><p className="text-xs text-stone-500">{f('نسبة الكسب', 'Win rate')}</p><p className="text-3xl font-bold mt-2" dir="ltr">{data.pipeline.winRate === null ? '—' : `${data.pipeline.winRate}%`}</p><p className="text-xs mt-2 text-stone-600">{f('كسب', 'Won')} {num(data.pipeline.wonCount)} · {f('خسارة', 'Lost')} {num(data.pipeline.lostCount)}</p></div>
        </div>

        <div className="grid lg:grid-cols-2 gap-3">
          <div className={`${card} space-y-3`}>
            <h4 className="font-bold text-sm flex items-center gap-2"><Target className="w-4 h-4 text-emerald-700" />{f('الهدف الشهري', 'Monthly target')}</h4>
            {!data.targetsPace.some((t) => t.targetMinor > 0) && <p className="text-xs text-stone-500">{f('مفيش هدف محدد للشهر ده — افتح «الأهداف» وحدّد رقم.', 'No target this month — open Targets and set a number.')}</p>}
            {data.targetsPace.filter((t) => t.targetMinor > 0).map((t) => <div key={t.currency} className="space-y-1">
              <p className="text-sm flex justify-between"><span>{t.currency} · {paceName(t.pace)}</span><span dir="ltr">{money(t.collectedMinor, t.currency)} / {money(t.targetMinor, t.currency)}</span></p>
              <div className="h-2 rounded-full bg-stone-100 overflow-hidden"><div className={`h-full ${t.pace === 'ahead' ? 'bg-emerald-600' : t.pace === 'on' ? 'bg-sky-600' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, t.percent ?? 0)}%` }} /></div>
              <p className="text-[11px] text-stone-500">{f(`متبقي ${num(t.daysLeft)} يوم · محتاج ${money(t.neededPerDayMinor ?? 0, t.currency)} في اليوم · التوقع ${t.projectionMinor === null ? 'لسه مش كفاية بيانات' : money(t.projectionMinor, t.currency)} (تقدير مش وعد)`,
                `${num(t.daysLeft)} days left · ${money(t.neededPerDayMinor ?? 0, t.currency)} a day needed · projection ${t.projectionMinor === null ? 'not enough data yet' : money(t.projectionMinor, t.currency)} (an estimate, not a promise)`)}</p>
            </div>)}
          </div>
          <div className={`${card} space-y-2`}>
            <h4 className="font-bold text-sm">{f('التحصيل المؤكد', 'Confirmed collections')}</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {data.live.today.map((r) => <p key={`t${r.currency}`} className="rounded-xl bg-stone-50 p-3"><span className="block text-stone-500 mb-1">{f('النهارده', 'Today')} · {r.currency}</span><b dir="ltr">{money(r.collectedMinor, r.currency)}</b><span className="block text-stone-500 mt-1">{num(r.paidOrders)} {f('طلب مدفوع', 'paid orders')}</span></p>)}
              {data.live.month.map((r) => <p key={`m${r.currency}`} className="rounded-xl bg-stone-50 p-3"><span className="block text-stone-500 mb-1">{f('الشهر ده', 'This month')} · {r.currency}</span><b dir="ltr">{money(r.collectedMinor, r.currency)}</b><span className="block text-stone-500 mt-1">{num(r.paidOrders)} {f('طلب مدفوع', 'paid orders')}</span></p>)}
              {!data.live.today.length && <p className="text-stone-500">{f('مفيش تحصيل مؤكد النهارده. الحجز مش إيراد لحد ما الفلوس تتحصل وتتأكد.', 'No confirmed collections today. A reservation is not revenue until the money is collected and confirmed.')}</p>}
            </div>
            <h4 className="font-bold text-sm pt-2">{f('الأكثر مبيعاً', 'Best sellers')}</h4>
            <div className="flex flex-wrap gap-2 text-xs">{data.live.bestSellers.length ? data.live.bestSellers.map((p) => <span key={p.sku} className="rounded-full bg-emerald-50 text-emerald-900 px-3 py-1 font-mono">{p.sku} · {num(p.units)}</span>) : <span className="text-stone-500">{f('مفيش مبيعات مؤكدة بعد.', 'No confirmed sales yet.')}</span>}</div>
          </div>
        </div>

        <div className={`${card}`}>
          <h4 className="font-bold text-sm mb-2">{f('أول ٣ خطوات النهارده', 'First three steps today')}</h4>
          {actions.slice(0, 3).map((task) => <div key={task.id} className="border-t border-stone-100 py-2 first:border-0"><p className="text-sm font-semibold flex items-center gap-2"><span className={`text-[10px] px-2 py-0.5 rounded-full ${priorityTone(task.priority)}`}>{priorityName(task.priority)}</span>{task.titleAr}</p><p className="text-xs text-stone-500">{task.whyAr}</p></div>)}
          {!actions.length && <p className="text-xs text-stone-500">{f('مفيش خطوات من أرقام حقيقية دلوقتي.', 'No steps from real figures right now.')}</p>}
        </div>
      </>}

      {section === 'pipeline' && <>
        <form className={`${card} grid sm:grid-cols-3 gap-3`} onSubmit={saveDeal}>
          <h4 className="font-bold text-sm sm:col-span-3 flex items-center gap-2"><Plus className="w-4 h-4" />{deal.id ? f('تعديل فرصة', 'Edit opportunity') : f('فرصة جديدة', 'New opportunity')}</h4>
          <label className="text-xs space-y-1"><span>{f('اسم الفرصة', 'Opportunity name')}</span><input className={field} required minLength={2} maxLength={80} value={deal.title} onChange={(e) => setDeal({ ...deal, title: e.target.value })} placeholder={f('طقم هدايا — فرع المعادي', 'Gift set — Maadi branch')} /></label>
          <label className="text-xs space-y-1"><span>{f('وصف العميل (من غير بيانات تواصل)', 'Customer label (no contact details)')}</span><input className={field} required minLength={2} maxLength={60} value={deal.accountLabel} onChange={(e) => setDeal({ ...deal, accountLabel: e.target.value })} placeholder={f('عميل جملة — الإسكندرية', 'Wholesale — Alexandria')} /></label>
          <label className="text-xs space-y-1"><span>{f('القيمة', 'Value')}</span><input className={field} required inputMode="decimal" dir="ltr" value={deal.value} onChange={(e) => setDeal({ ...deal, value: e.target.value })} /></label>
          <label className="text-xs space-y-1"><span>{f('العملة', 'Currency')}</span><input className={field} dir="ltr" value={deal.currency} onChange={(e) => setDeal({ ...deal, currency: e.target.value.toUpperCase() })} /></label>
          <label className="text-xs space-y-1"><span>{f('المرحلة', 'Stage')}</span><select className={field} value={deal.stage} onChange={(e) => setDeal({ ...deal, stage: e.target.value as DealStage })}>{DEAL_STAGES.map((s) => <option key={s} value={s}>{f(STAGE_LABEL[s].ar, STAGE_LABEL[s].en)} · {STAGE_PROBABILITY[s]}%</option>)}</select></label>
          <label className="text-xs space-y-1"><span>{f('المصدر', 'Source')}</span><select className={field} value={deal.source} onChange={(e) => setDeal({ ...deal, source: e.target.value })}>{DEAL_SOURCES.map((s) => <option key={s} value={s}>{f(SOURCE_LABEL[s].ar, SOURCE_LABEL[s].en)}</option>)}</select></label>
          <label className="text-xs space-y-1"><span>{f('الخطوة الجاية بتاريخ', 'Next step on')}</span><input className={field} type="date" value={deal.nextActionAt} onChange={(e) => setDeal({ ...deal, nextActionAt: e.target.value })} /></label>
          <label className="text-xs space-y-1 sm:col-span-2"><span>{f('الخطوة الجاية إيه', 'The next step')}</span><input className={field} maxLength={120} value={deal.nextActionAr} onChange={(e) => setDeal({ ...deal, nextActionAr: e.target.value })} placeholder={f('أبعت عرض السعر وأتابع بعد يومين', 'Send the quote and follow up in two days')} /></label>
          <label className="text-xs space-y-1 sm:col-span-3"><span>{f('ملاحظات (من غير بيانات تواصل)', 'Notes (no contact details)')}</span><textarea className={field} rows={2} maxLength={300} value={deal.notes} onChange={(e) => setDeal({ ...deal, notes: e.target.value })} /></label>
          <div className="flex gap-2 sm:col-span-3"><button className={`${button} bg-stone-900 text-white`} disabled={busy}>{deal.id ? f('حفظ التعديل', 'Save changes') : f('إضافة الفرصة', 'Add opportunity')}</button>{deal.id && <button type="button" className={`${button} border`} onClick={() => setDeal(emptyDeal)}>{f('إلغاء', 'Cancel')}</button>}</div>
          <p className="text-[11px] text-amber-800 sm:col-span-3">{f('ممنوع تكتب تليفون أو إيميل أو عنوان في المكتب — النظام بيرفضهم. بيانات التواصل مكانها حساب العميل وطلبه.', 'Never write a phone, e-mail or address here — the system refuses them. Contacts stay in the customer’s account and order.')}</p>
        </form>

        <div className="grid lg:grid-cols-2 gap-3">
          {data.pipeline.byCurrency.map((row) => <div key={row.currency} className={card}>
            <p className="text-sm font-bold">{row.currency} · {f('الموزون بالمرحلة', 'Stage-weighted')} <b dir="ltr">{money(row.weightedMinor, row.currency)}</b></p>
            <p className="text-xs text-stone-500 mt-1">{f('مفتوح', 'Open')} <span dir="ltr">{money(row.openMinor, row.currency)}</span> · {num(row.openCount)} {f('فرصة', 'deals')} · {f('كسب', 'won')} {num(row.wonCount)} · {f('متوسط الكسب', 'avg won')} <span dir="ltr">{row.avgWonMinor === null ? '—' : money(row.avgWonMinor, row.currency)}</span></p>
          </div>)}
        </div>

        <div className={`${card} overflow-x-auto`}>
          <table className="w-full text-xs"><thead><tr className="text-stone-500 border-b">{[f('الفرصة', 'Opportunity'), f('العميل', 'Customer'), f('القيمة', 'Value'), f('المرحلة', 'Stage'), f('الجاية', 'Next'), ''].map((h, i) => <th key={i} className="p-2 text-start">{h}</th>)}</tr></thead><tbody>
            {data.deals.map((d) => <tr key={d.id} className="border-b border-stone-100 align-top">
              <td className="p-2"><b>{d.title}</b>{d.notes && <span className="block text-stone-500">{d.notes}</span>}</td>
              <td className="p-2">{d.accountLabel}<span className="block text-[10px] text-stone-400">{SOURCE_LABEL[d.source] ? f(SOURCE_LABEL[d.source].ar, SOURCE_LABEL[d.source].en) : d.source}</span></td>
              <td className="p-2" dir="ltr">{money(d.valueMinor, d.currency)}<span className="block text-[10px] text-stone-400">{d.probability}%</span></td>
              <td className="p-2">{f(STAGE_LABEL[d.stage].ar, STAGE_LABEL[d.stage].en)}{d.lostReason ? <span className="block text-red-700">{d.lostReason}</span> : null}{d.closedAt ? <span className="block text-[10px] text-stone-400">{when(d.closedAt)}</span> : null}</td>
              <td className="p-2">{d.nextActionAt || '—'}{d.nextActionAr && <span className="block text-stone-500">{d.nextActionAr}</span>}</td>
              <td className="p-2 whitespace-nowrap">
                <select className={`${field} !w-auto !p-1 text-[11px]`} aria-label={f('نقل المرحلة', 'Move stage')} value="" onChange={(e) => { const stage = e.target.value as DealStage; if (stage) move(d.id, stage); }}>
                  <option value="">{f('نقل…', 'Move…')}</option>
                  {DEAL_STAGES.filter((s) => s !== d.stage).map((s) => <option key={s} value={s}>{f(STAGE_LABEL[s].ar, STAGE_LABEL[s].en)}</option>)}
                </select>
                <button type="button" className="text-stone-500 underline text-[11px] mx-1" onClick={() => setDeal({ id: d.id, title: d.title, accountLabel: d.accountLabel, currency: d.currency, value: String(major(d.valueMinor, d.currency)), stage: d.stage, source: d.source, nextActionAt: d.nextActionAt, nextActionAr: d.nextActionAr, notes: d.notes })}>{f('تعديل', 'Edit')}</button>
                <button type="button" className="text-red-700" onClick={() => remove(d.id)} aria-label={f('حذف الفرصة', 'Delete opportunity')}><Trash2 className="w-3.5 h-3.5 inline" /></button>
              </td>
            </tr>)}
          </tbody></table>
          {!data.deals.length && <p className="text-xs text-stone-500 p-2">{f('مفيش فرص مسجلة. سجّل أول ٣ فرص حقيقية، ولكل واحدة خطوة جاية بتاريخ.', 'No opportunities yet. Add the first three real ones, each with a dated next step.')}</p>}
        </div>
      </>}

      {section === 'targets' && <>
        <form className={`${card} grid sm:grid-cols-3 gap-3 items-end`} onSubmit={saveTarget}>
          <label className="text-xs space-y-1"><span>{f('العملة', 'Currency')}</span><input className={field} dir="ltr" value={target.currency} onChange={(e) => setTarget({ ...target, currency: e.target.value.toUpperCase() })} /></label>
          <label className="text-xs space-y-1"><span>{f('هدف الشهر', 'Monthly target')}</span><input className={field} required inputMode="decimal" dir="ltr" value={target.amount} onChange={(e) => setTarget({ ...target, amount: e.target.value })} placeholder="0 = off" /></label>
          <button className={`${button} bg-stone-900 text-white`} disabled={busy}>{f('حفظ الهدف', 'Save target')}</button>
          <p className="text-[11px] text-stone-500 sm:col-span-3">{f('الهدف قرارك؛ التحصيل من دفتر بنك شام المؤكد بس. التوقع تقدير حسابي من الأيام اللي عدت — مش وعد.', 'The target is your decision; collections come from the confirmed Sham Bank ledger only. The projection is arithmetic on elapsed days — not a promise.')}</p>
        </form>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {data.targetsPace.map((t) => <div key={`${t.currency}`} className={card}>
            <p className="text-sm font-bold flex justify-between"><span>{t.currency}</span><span className="text-xs font-normal text-stone-500">{paceName(t.pace)}</span></p>
            <p className="text-2xl font-bold mt-2" dir="ltr">{t.targetMinor ? money(t.collectedMinor, t.currency) : '—'}</p>
            <p className="text-xs text-stone-500">{t.targetMinor ? `${f('من', 'of')} ${money(t.targetMinor, t.currency)} · ${t.percent}%` : f('حدّد هدف.', 'Set a target.')}</p>
            {t.targetMinor > 0 && <><div className="h-2 rounded-full bg-stone-100 overflow-hidden mt-2"><div className={`h-full ${t.pace === 'ahead' ? 'bg-emerald-600' : t.pace === 'on' ? 'bg-sky-600' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, t.percent ?? 0)}%` }} /></div>
              <p className="text-[11px] text-stone-500 mt-2">{f(`فاضل ${money(t.gapMinor, t.currency)} · ${num(t.daysLeft)} يوم · ${money(t.neededPerDayMinor ?? 0, t.currency)}/يوم`, `Remaining ${money(t.gapMinor, t.currency)} · ${num(t.daysLeft)} days · ${money(t.neededPerDayMinor ?? 0, t.currency)}/day`)}</p></>}
          </div>)}
        </div>
        <div className={`${card} text-xs text-stone-600`}>
          <p className="font-bold text-sm text-stone-900 mb-2">{f('أسباب مؤشر الصحة', 'Health drivers')}</p>
          <ul className="space-y-1 list-disc ps-4">{data.health.driversAr.map((d) => <li key={d}>{d}</li>)}</ul>
        </div>
      </>}

      {section === 'rhythm' && <div className="space-y-2">
        {actions.map((task) => <div key={task.id} className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold flex items-center gap-2"><span className={`text-[10px] px-2 py-0.5 rounded-full ${priorityTone(task.priority)}`}>{priorityName(task.priority)}</span>{task.titleAr}</p>
            <span className="text-[11px] text-stone-500">{task.link === 'bank' ? f('بنك شام', 'Sham Bank') : task.link === 'pipeline' ? f('خط الأنابيب', 'Pipeline') : task.link === 'targets' ? f('الأهداف', 'Targets') : task.link === 'store' ? f('المتجر', 'Store') : task.link === 'study' ? f('المنهج', 'Curriculum') : f('التحليلات', 'Insights')}</span>
          </div>
          <p className="text-xs text-stone-600 mt-1">{task.whyAr}</p>
          <div className="flex gap-2 mt-2">
            {task.link === 'bank' && <button type="button" className="text-xs text-emerald-800 underline" onClick={onOpenBank}>{f('افتح بنك شام', 'Open Sham Bank')}</button>}
            {(task.link === 'pipeline' || task.link === 'targets' || task.link === 'study') && <button type="button" className="text-xs text-emerald-800 underline" onClick={() => setSection(task.link as Section)}>{f('روح للقسم', 'Go there')}</button>}
          </div>
        </div>)}
        {!actions.length && <p className={card}>{f('مفيش مهام من أرقام حقيقية دلوقتي.', 'No tasks from real figures right now.')}</p>}
      </div>}

      {section === 'study' && <>
        <div className={`${card} space-y-3`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-bold text-sm flex items-center gap-2"><BookOpen className="w-4 h-4 text-emerald-700" />{f('درس النهارده', 'Today’s lesson')} — {f(MODULE_LABEL[today.module].ar, MODULE_LABEL[today.module].en)}</h4>
            <span className="text-[11px] text-stone-500">{f('الكتيب:', 'Handbook:')} {today.handbook.join('، ')}</span>
          </div>
          <p className="font-semibold">{today.titleAr}</p>
          <p className="text-sm text-stone-700">{today.ideaAr}</p>
          <p className="text-xs rounded-xl bg-stone-50 p-3"><b>{f('تمرين:', 'Drill:')}</b> {today.drillAr}</p>
          <p className="text-sm font-semibold">{today.quiz.qAr}</p>
          <div className="space-y-2">{today.quiz.optionsAr.map((option, i) => <label key={option} className={`flex items-center gap-2 rounded-xl border p-2 text-sm cursor-pointer ${quiz?.choice === i ? 'border-emerald-600 bg-emerald-50' : 'border-stone-200'}`}>
            <input type="radio" name="sales-quiz" checked={quiz?.choice === i} onChange={() => setQuiz({ lessonId: today.id, choice: i })} />{option}
          </label>)}</div>
          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" className={`${button} bg-emerald-700 text-white`} disabled={!quiz || busy} onClick={submitQuiz}>{f('تسليم الإجابة', 'Submit answer')}</button>
            {quizResult && <span className="text-xs text-stone-700">{quizResult}</span>}
          </div>
          <p className="text-[11px] text-stone-500">{f(`دراسة: ${num(progress?.studied || 0)} إجابة · ${progress?.percent ?? 0}% صحيحة · ${num(progress?.streakDays || 0)} يوم متصل`, `Studied: ${num(progress?.studied || 0)} answers · ${progress?.percent ?? 0}% correct · ${num(progress?.streakDays || 0)}-day streak`)}</p>
        </div>
        <div className="grid lg:grid-cols-2 gap-3">
          <div className={`${card} space-y-2`}>
            <h4 className="font-bold text-sm">{f('خطة الأسبوع', 'This week’s plan')}</h4>
            {data.study.plan.map((l, i) => <p key={l.id} className="text-xs flex justify-between border-b border-stone-100 pb-1"><span>{i === 0 ? f('النهارده', 'Today') : `${f('يوم', 'Day')} ${i + 1}`} — {l.titleAr}</span><span className="text-stone-400">{f(MODULE_LABEL[l.module].ar, MODULE_LABEL[l.module].en)}</span></p>)}
            <p className="text-[11px] text-stone-500">{f('المنهج مبني على كتيب المنصة (كل درس مكتوب مصدره) و«علم البيع».', 'The curriculum is built on the platform handbook (every lesson names its source) and the selling craft.')}</p>
          </div>
          <div className={`${card} space-y-2`}>
            <h4 className="font-bold text-sm">{f('مبادئ بتتبيع', 'Principles that sell')}</h4>
            {SALES_PRINCIPLES.slice(0, 5).map((p) => <p key={p.id} className="text-xs"><b>{p.id}</b> — {p.ar}</p>)}
            <details className="text-xs"><summary className="cursor-pointer font-semibold">{f(`الفخاخ اللي بتقتل البيع (${SALES_PITFALLS.length})`, `Pitfalls that kill a sale (${SALES_PITFALLS.length})`)}</summary><ul className="list-disc ps-4 mt-2 space-y-1">{SALES_PITFALLS.map((p) => <li key={p.id}>{p.ar}</li>)}</ul></details>
          </div>
        </div>
      </>}

      {section === 'advisor' && <>
        <div className={`${card} space-y-3`}>
          <h4 className="font-bold text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-700" />{f('مدير المبيعات جاوب من أرقام المكتب', 'The sales manager answers from the desk’s figures')}</h4>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(question); }}>
            <input className={field} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} placeholder={f('مثال: إحنا واقفين فين من الهدف؟', 'e.g. Where are we against the target?')} />
            <button className={`${button} bg-stone-900 text-white`} disabled={busy || !question.trim()}>{f('اسأل', 'Ask')}</button>
          </form>
          <div className="flex flex-wrap gap-2">{[
            f('أعمل إيه النهارده؟', 'What should I do today?'), f('إحنا واقفين فين من الهدف؟', 'Where are we against the target?'),
            f('خط الأنابيب عامل إيه؟', 'How is the pipeline?'), f('مستني إيه في البنك؟', 'What is waiting in the bank?'),
            f('إيه الأكثر مبيعاً؟', 'What sells best?'), f('أذاكر إيه النهارده؟', 'What should I study today?'),
          ].map((q) => <button key={q} type="button" className="text-xs rounded-full border border-stone-200 px-3 py-1.5 hover:bg-stone-50" onClick={() => { setQuestion(q); ask(q); }}>{q}</button>)}</div>
        </div>
        {answer && <div className={card}>
          <p className="text-xs text-stone-500 mb-2">{f('السؤال:', 'Question:')} {answer.question}</p>
          <p className="text-sm whitespace-pre-wrap">{answer.text}</p>
          <p className="text-[11px] text-stone-400 mt-2">{f('الرد من أرقام المكتب الحقيقية بس — مفيش تخمين. المبالغ في السجل الخاص، والتقرير العام أعداد بس.', 'The answer uses real desk figures only — no guessing. Amounts stay in the private ledger; the public report is counts only.')}</p>
        </div>}
        <div className={`${card} text-xs text-stone-600`}>
          <p className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-700" />{f('الخصومات والشراكات والتغيير الكبير: قرار صاحب الموقع. المكتب يقترح ولا يوعد، والتأكيد النهائي للدفع في بنك شام بعد رؤية الفلوس.', 'Discounts, partnerships and big changes are the owner’s decision. The desk proposes and never promises; final payment confirmation happens in Sham Bank after seeing the money.')}</p>
          <p className="flex items-center gap-2 mt-2"><Banknote className="w-4 h-4 text-emerald-700" />{f('الفرص بأسماء مختصرة بس — بيانات التواصل مكانها حساب العميل وطلبه.', 'Opportunities carry short labels only — contact details stay in the customer’s account and order.')}</p>
          <p className="flex items-center gap-2 mt-2"><CheckCircle2 className="w-4 h-4 text-emerald-700" />{f('كل إجراء في المكتب بيروح لسجل التدقيق في بنك شام.', 'Every desk action goes to Sham Bank’s audit log.')}</p>
        </div>
      </>}
    </>}
  </div>;
}
