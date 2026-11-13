import { T, TP, reactiveMap, adminLocale } from './adminL10n';
import React, { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, CircleAlert, ExternalLink, Globe2, Loader2, Play, RefreshCw, Search, Send, ShieldCheck } from 'lucide-react';
import { adminRequest, send } from './adminApi';
import type { SeoState } from '../seo/agentState';

/**
 * «منارة شاهين» — the SEO/media agent's console. Everything on this screen comes from
 * GET /api/admin/seo (state saved by the last cycle), and a run is fire-and-forget:
 * POST /api/admin/seo/run returns 202 and the panel polls until the cycle finishes.
 */
interface SeoSnapshot {
  state: SeoState;
  siteUrl: string;
  busy: boolean;
  sitemapUrls: number;
  engines: { id: string; model: string; configured: boolean }[];
  storage: { kind: string; persistent: boolean; error?: string };
}
const card = 'rounded-2xl border border-stone-200 bg-white p-4 shadow-sm';
const btn = 'inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50';
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(adminLocale(), { dateStyle: 'short', timeStyle: 'short' }) : '—');
const LEVEL: Record<string, string> = reactiveMap(() => ({ trainee: T('تدريب'), guided: T('توجيه'), autonomous: T('اعتماد على النفس') }));
const SEVERITY: Record<string, string> = reactiveMap(() => ({ critical: T('حرجة'), major: T('كبيرة'), minor: T('صغيرة') }));
const ENGINE_STATUS: Record<string, string> = reactiveMap(() => ({ submitted: T('أُرسل'), ready: T('جاهز'), owner: T('يحتاج إعداداً') }));

export default function SeoPanel() {
  const [data, setData] = useState<SeoSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [running, setRunning] = useState(false);
  const [withSubmit, setWithSubmit] = useState(true);

  const load = useCallback((quiet = false) => {
    if (!quiet) setLoading(true);
    adminRequest<SeoSnapshot>('/seo')
      .then((snapshot) => { setData(snapshot); setError(''); return snapshot; })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      adminRequest<SeoSnapshot>('/seo').then((snapshot) => {
        setData(snapshot);
        if (!snapshot.busy) { setRunning(false); setNotice(T('انتهت الدورة. راجع النتائج أدناه.')); }
      }).catch((e: Error) => { setError(e.message); setRunning(false); });
    }, 8000);
    return () => clearInterval(timer);
  }, [running]);

  const run = () => {
    setError(''); setNotice('');
    adminRequest<{ accepted: boolean }>('/seo/run', send('POST', { submit: withSubmit }))
      .then(() => { setRunning(true); setNotice(T('تم بدء الدورة. ستتحدث النتائج تلقائياً.')); load(true); })
      .catch((e: Error) => setError(e.message));
  };

  const base = import.meta.env.BASE_URL || '/';
  const state = data?.state;
  const pending = state?.applied.filter((change) => !change.reverted).length || 0;
  const studied = state?.curriculum.studied.length || 0;
  const score = state?.audit.score ?? 0;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Search className="w-5 h-5 text-amber-600" />{T('منارة شاهين — المندوب الإعلامي')}</h1>
          <p className="text-xs text-stone-500 mt-1 max-w-3xl">{T('وكيل الظهور في محركات البحث: يفحص الموقع، يدرس المنهج، يطبّق التحسينات المفحوصة، يرسل الصفحات للمحركات، ويكتب تقرير المندوب — تحت تقييم الخبير شاهين.')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-xs text-stone-600">
            <input type="checkbox" checked={withSubmit} onChange={(event) => setWithSubmit(event.target.checked)} className="accent-amber-600" />
            {T('إرسال الروابط للفهارس مع الدورة')}
          </label>
          <button type="button" onClick={() => load()} disabled={loading} className={`${btn} bg-white border border-stone-300`}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />{T('تحديث')}</button>
          <button type="button" onClick={run} disabled={running || Boolean(data?.busy)} className={`${btn} bg-amber-600 text-white hover:bg-amber-700`}>
            {running || data?.busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running || data?.busy ? T('الدورة تعمل الآن…') : T('تشغيل دورة الآن')}
          </button>
        </div>
      </div>

      {error && <p className={`${card} mb-3 text-sm text-red-700 flex items-center gap-2`}><CircleAlert className="w-4 h-4" />{error}</p>}
      {notice && <p className={`${card} mb-3 text-sm text-emerald-700 flex items-center gap-2`}><CheckCircle2 className="w-4 h-4" />{notice}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-3">
        <div className={card}>
          <p className="text-[11px] text-stone-500 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" />{T('التقييم')}</p>
          <p className="text-2xl font-bold mt-1">{score}<span className="text-sm text-stone-400">/100</span></p>
          <p className="text-[11px] text-stone-500">{TP('آخر دورة: {when}', { when: when(state?.audit.at) })}</p>
        </div>
        <div className={card}>
          <p className="text-[11px] text-stone-500">{T('المرحلة')}</p>
          <p className="text-lg font-bold mt-1">{state ? LEVEL[state.trust.level] || state.trust.level : '—'}</p>
          <p className="text-[11px] text-stone-500">{TP('{cycles} دورة · {pages} صفحة مفهرسة', { cycles: state?.trust.cycles ?? 0, pages: data?.sitemapUrls ?? 0 })}</p>
        </div>
        <div className={card}>
          <p className="text-[11px] text-stone-500">{T('الدروس')}</p>
          <p className="text-2xl font-bold mt-1">{studied}<span className="text-sm text-stone-400">/24</span></p>
          <p className="text-[11px] text-stone-500">{state?.curriculum.completedAt ? T('أتمّ المنهج ويعيد تطبيقه') : T('منهجية SEO خطوة بخطوة')}</p>
        </div>
        <div className={card}>
          <p className="text-[11px] text-stone-500">{T('تغييرات منشورة')}</p>
          <p className="text-2xl font-bold mt-1">{pending}</p>
          <p className="text-[11px] text-stone-500">{state?.trust.level === 'trainee' ? T('التدريب يفحص ويقترح فقط') : T('تغييرات فحصها قبل النشر')}</p>
        </div>
      </div>

      <div className={`${card} mb-3 flex flex-wrap items-center gap-3 text-xs text-stone-600`}>
        <Activity className="w-4 h-4 text-amber-600" />
        <span>{TP('الموقع: {site}', { site: data?.siteUrl || '—' })}</span>
        <span>{TP('الدورة القادمة: {when}', { when: when(state?.nextRunAt) })}</span>
        <span>{TP('التخزين: {kind}', { kind: data?.storage.kind || '—' })}</span>
        <a className="text-amber-700 underline inline-flex items-center gap-1" href={`${base}sitemap.xml`} target="_blank" rel="noreferrer">{T('خريطة الموقع')}<ExternalLink className="w-3 h-3" /></a>
        <a className="text-amber-700 underline inline-flex items-center gap-1" href={`${base}llms.txt`} target="_blank" rel="noreferrer">{T('ملف llms.txt')}<ExternalLink className="w-3 h-3" /></a>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className={card}>
          <h2 className="font-bold mb-2">{T('ملاحظات الفحص')}</h2>
          {(state?.audit.findings || []).length === 0 && <p className="text-sm text-stone-500">{T('لا ملاحظات — النتيجة كاملة.')}</p>}
          <ul className="grid gap-2">
            {(state?.audit.findings || []).slice(0, 6).map((finding) => (
              <li key={finding.id} className="rounded-xl border border-stone-200 p-3">
                <p className="text-sm font-semibold flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px]">{SEVERITY[finding.severity] || finding.severity}</span>
                  <span>{finding.title}</span>
                </p>
                <p className="text-[11px] text-stone-500 mt-1">{finding.page} · {finding.fix}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className={card}>
          <h2 className="font-bold mb-2">{T('المحركات والفهارس')}</h2>
          <ul className="grid gap-1.5">
            {(state?.searchEngines || []).map((engine) => (
              <li key={engine.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-100 px-2 py-1.5 text-sm">
                <span className="font-semibold">{engine.nameAr}</span>
                <span className="text-[11px] text-stone-500">{engine.detail || ''}</span>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800">{ENGINE_STATUS[engine.status] || engine.status}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={card}>
          <h2 className="font-bold mb-2">{T('الخطوات القادمة')}</h2>
          {(state?.nextActions || []).length === 0 && <p className="text-sm text-stone-500">{T('لا توجد عناصر بعد.')}</p>}
          <ol className="grid gap-1.5 list-decimal ps-5 text-sm">
            {(state?.nextActions || []).slice(0, 6).map((action, index) => (
              <li key={`${action.textAr}-${index}`}>{action.textAr}</li>
            ))}
          </ol>
        </section>

        <section className={card}>
          <h2 className="font-bold mb-2">{T('آخر عمليات الإرسال')}</h2>
          {(state?.submissions || []).length === 0 && <p className="text-sm text-stone-500">{T('لم يُرسل شيء بعد.')}</p>}
          <ul className="grid gap-1.5">
            {(state?.submissions || []).slice(-5).reverse().map((submission, index) => (
              <li key={`${submission.at}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-100 px-2 py-1.5 text-xs">
                <span className="font-semibold">{submission.engine}</span>
                <span className="text-stone-500">{TP('{urls} رابطاً · {when}', { urls: submission.urls, when: when(submission.at) })}</span>
                <span className={submission.ok ? 'text-emerald-700' : 'text-amber-700'}>{submission.ok ? T('تم') : T('لم يتم')}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={card}>
          <h2 className="font-bold mb-2 flex items-center gap-2"><Globe2 className="w-4 h-4 text-emerald-600" />{T('قنوات الظهور بلا حساب')}</h2>
          <ul className="grid gap-1.5 text-sm">
            <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-100 px-2 py-1.5">
              <span>{T('خريطة الموقع + الخلاصة في robots.txt')}</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-800">{T('جاهزة')}</span>
            </li>
            <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-100 px-2 py-1.5">
              <span>{T('إشعار تغيّر الخلاصة (WebSub)')}</span>
              <span className="text-[11px] text-stone-500">
                {state?.discovery.webSub
                  ? `${when(state.discovery.webSub.at)} · ${state.discovery.webSub.ok ? T('تم') : T('لم يتم')}`
                  : T('ينتظر أول تغيير في الخلاصة')}
              </span>
            </li>
            <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-100 px-2 py-1.5">
              <span>{T('فحص وصول الزاحف')}</span>
              <span className="text-[11px] text-stone-500">
                {state?.discovery.crawl
                  ? `${state.discovery.crawl.ok}/${state.discovery.crawl.checked} · ${when(state.discovery.crawl.at)}`
                  : T('لم يُفحص بعد')}
              </span>
            </li>
            <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-100 px-2 py-1.5">
              <span>{T('أداء الصفحة (Lighthouse عام)')}</span>
              <span className="text-[11px] text-stone-500">
                {state?.discovery.pageSpeed?.ok
                  ? `${state.discovery.pageSpeed.scores.performance ?? '—'}/100 · ${when(state.discovery.pageSpeed.at)}`
                  : state?.discovery.pageSpeed?.detail || T('لم يُقس بعد')}
              </span>
            </li>
          </ul>
          <p className="text-[11px] text-stone-500 mt-2">{T('كل هذه القنوات تعمل دون حساب أو بطاقة؛ لوحة المالك اختيارية ولا تُشترط للاكتشاف.')}</p>
        </section>

        <section className={card}>
          <h2 className="font-bold mb-2">{T('تقرير المندوب الإعلامي')}</h2>
          {state?.mediaReport ? (
            <div className="text-sm">
              <p className="font-semibold">{state.mediaReport.headline}</p>
              {state.mediaReport.paragraphs.slice(0, 2).map((paragraph, index) => <p key={index} className="text-stone-600 mt-1">{paragraph}</p>)}
              <p className="text-[11px] text-stone-400 mt-2">{TP('المصدر: {source} · {when}', { source: state.mediaReport.source, when: when(state.mediaReport.at) })}</p>
            </div>
          ) : <p className="text-sm text-stone-500">{T('يُكتب بعد أول دورة كاملة.')}</p>}
        </section>

        <section className={card}>
          <h2 className="font-bold mb-2">{T('تقييم الخبير شاهين')}</h2>
          {state?.coach ? (
            <div className="text-sm">
              <p className="text-lg font-bold">{state.coach.score ?? '—'}<span className="text-xs text-stone-400">/10</span></p>
              {state.coach.guidance && <p className="text-stone-600 mt-1">{state.coach.guidance}</p>}
              <p className="text-[11px] text-stone-400 mt-2">{TP('{when} · الاعتماد على النفس: {ready}', { when: when(state.coach.at), ready: state.coach.readyForAutonomy ? T('نعم') : T('ليس بعد') })}</p>
            </div>
          ) : <p className="text-sm text-stone-500">{T('لم يقيّم بعد.')}</p>}
        </section>
      </div>

      <section className={`${card} mt-3`}>
        <h2 className="font-bold mb-2">{T('سجل الدروس')}</h2>
        {(state?.curriculum.notes || []).length === 0 && <p className="text-sm text-stone-500">{T('لا توجد دروس مسجّلة بعد.')}</p>}
        <ul className="grid gap-2">
          {(state?.curriculum.notes || []).slice(-4).reverse().map((lesson) => (
            <li key={`${lesson.id}-${lesson.at}`} className="rounded-xl border border-stone-100 p-3 text-sm">
              <p className="font-semibold">{lesson.titleAr} <span className="text-[10px] text-stone-400">{when(lesson.at)}</span></p>
              <p className="text-stone-600 mt-1">{lesson.takeaway}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-[11px] text-stone-400 mt-3 flex items-center gap-1"><Send className="w-3 h-3" />{T('الاكتشاف يعمل بلا أي حساب: خريطة وخلاصة في robots.txt، وإشعار WebSub، وIndexNow للمحركات التي تقبله. البحث في لوحة المالك اختياري.')}</p>
    </>
  );
}
