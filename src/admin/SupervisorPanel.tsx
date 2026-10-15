import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import bundled from '../data/live/ai-supervisor.json';
import { AI_TOOLS } from '../utils/aiTools';
import type { SupervisorFile, ToolReport } from '../../scripts/shaheen-supervisor/checks';

/**
 * «مشرف الذكاء الاصطناعي» — what «الخبير شاهين» found when he reviewed every AI tool on the site (every 12 hours,
 * scripts/shaheen-supervisor). Public data from the repository, so it shows on GitHub Pages and Vercel alike.
 */
const LIVE_URL = 'https://raw.githubusercontent.com/spculculat-oss/Sham-Perfume/main/src/data/live/ai-supervisor.json';
const RUNS_URL = 'https://github.com/spculculat-oss/Sham-Perfume/actions/workflows/shaheen-news.yml';
const card = 'rounded-2xl border border-stone-200 bg-white p-4 shadow-sm';
const btn = 'inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50';
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }) : '—');
const STATUS: Record<ToolReport['status'], { label: string; cls: string }> = {
  ok: { label: 'ممتاز', cls: 'bg-emerald-100 text-emerald-800' },
  warn: { label: 'يحتاج تحسين', cls: 'bg-amber-100 text-amber-800' },
  fail: { label: 'مشكلة', cls: 'bg-red-100 text-red-800' },
  skipped: { label: 'لم يُفحص هذه المرة', cls: 'bg-stone-100 text-stone-600' },
};
const EVENT: Record<ToolReport['lastEvent'], string> = {
  updated: '✍️ كتب شاهين توجيهات جديدة في هذه المراجعة',
  rolled_back: '↩️ تراجع شاهين عن آخر توجيهات لأن الأداء قلّ بعدها',
  kept: '📌 التوجيهات الحالية مستمرة',
  none: '',
};

export default function SupervisorPanel() {
  const [data, setData] = useState<SupervisorFile>(bundled as SupervisorFile);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string>('');
  const load = useCallback(() => {
    setLoading(true);
    fetch(`${LIVE_URL}?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : undefined))
      .then((d: SupervisorFile | undefined) => { if (d?.tools && Date.parse(d.updatedAt) >= Date.parse(bundled.updatedAt)) setData(d); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const reviewed = Object.keys(data.tools).length > 0;
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold">مشرف الذكاء الاصطناعي — الخبير شاهين</h1>
          <p className="text-xs text-stone-500 mt-1">كل 12 ساعة يجرّب شاهين كل أداة ذكاء اصطناعي في الموقع بأسئلة حقيقية، يقيّم ردودها، ويكتب لها توجيهات تحسّن أداءها — ويتراجع عنها لو الأداء قلّ.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className={`${btn} bg-white border border-stone-300`}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />تحديث</button>
      </div>

      <div className={`${card} mb-4 flex flex-wrap items-center gap-4`}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-8 h-8 text-amber-600" />
          <div>
            <p className="text-2xl font-bold">{data.overall ?? '—'}<span className="text-sm text-stone-500">/10</span></p>
            <p className="text-[11px] text-stone-500">متوسط جودة الأدوات</p>
          </div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <p className="text-sm">{data.summaryAr}</p>
          <p className="text-[11px] text-stone-500 mt-1">آخر مراجعة: {reviewed ? when(data.updatedAt) : '—'} · المراجعة القادمة: {when(data.nextReviewAt)} · <a href={RUNS_URL} target="_blank" rel="noreferrer" className="text-amber-700 underline">سجل التشغيل</a></p>
        </div>
      </div>

      {!reviewed && <p className={`${card} text-sm text-stone-600`}>لسه شاهين ما عملش أول مراجعة — بتشتغل تلقائياً بعد نشرة الأخبار القادمة.</p>}

      <div className="grid gap-3">
        {AI_TOOLS.map((tool) => {
          const r = data.tools[tool.id];
          const isOpen = open === tool.id;
          const trend = r?.history.slice(-8) || [];
          return (
            <div key={tool.id} className={card} data-testid={`supervisor-${tool.id}`}>
              <button type="button" className="w-full flex flex-wrap items-center gap-3 text-start" onClick={() => setOpen(isOpen ? '' : tool.id)} aria-expanded={isOpen}>
                <span className="text-lg font-bold w-12 text-center">{r?.score ?? '—'}</span>
                <span className="flex-1 min-w-[160px]">
                  <span className="block font-semibold text-sm">{tool.nameAr}</span>
                  <span className="block text-[11px] text-stone-500">{tool.descriptionAr}</span>
                </span>
                {r ? <span className={`text-[11px] rounded-full px-2 py-0.5 ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                  : <span className="text-[11px] rounded-full px-2 py-0.5 bg-stone-100 text-stone-600">{tool.id === 'admin_agent' ? 'يحتاج SHAM_ADMIN_TOKEN' : 'لم يُفحص بعد'}</span>}
                {trend.length > 1 && <span className="flex items-end gap-0.5 h-6" title="آخر التقييمات">{trend.map((h) => <span key={h.at} className="w-1.5 bg-amber-400 rounded-sm" style={{ height: `${Math.max(8, h.score * 10)}%` }} />)}</span>}
              </button>
              {isOpen && r && (
                <div className="mt-3 space-y-3 text-xs border-t border-stone-100 pt-3">
                  <p className="text-stone-500">فُحص: {when(r.checkedAt)} · الفحص الآلي {r.autoScore ?? '—'}/10 · {r.judged ? 'قيّمه شاهين' : 'فحص آلي فقط'}{EVENT[r.lastEvent] ? ` · ${EVENT[r.lastEvent]}` : ''}</p>
                  {r.strengths.length > 0 && <div><p className="font-bold mb-1">نقاط القوة</p><ul className="list-disc ps-5 space-y-0.5">{r.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>}
                  {r.issues.length > 0 && <div><p className="font-bold mb-1 text-red-700">الملاحظات</p><ul className="list-disc ps-5 space-y-0.5">{r.issues.map((s) => <li key={s}>{s}</li>)}</ul></div>}
                  {tool.acceptsGuidance ? (
                    <div className="rounded-xl bg-amber-50 p-3">
                      <p className="font-bold mb-1">توجيهات شاهين الحالية للأداة</p>
                      {r.guidance ? <><pre className="whitespace-pre-wrap font-sans">{r.guidance.text}</pre><p className="text-[10px] text-stone-500 mt-1">من {when(r.guidance.since)} · التقييم وقتها {r.guidance.baseline}/10</p></> : <p className="text-stone-500">لا توجد — الأداة شغالة كويس بتعليماتها الأصلية.</p>}
                    </div>
                  ) : <p className="text-stone-500">هذه الأداة لا تعتمد على تعليمات نصية، فشاهين يراقبها وينبّه لمشاكلها فقط.</p>}
                  <div>
                    <p className="font-bold mb-1">عينات من الفحص</p>
                    <ul className="space-y-2">
                      {r.samples.map((s) => (
                        <li key={s.question} className="rounded-xl bg-stone-50 p-2">
                          <p className="font-semibold">{s.ok ? '✓' : '✗'} {s.question} <span className="text-stone-400 font-normal">({(s.ms / 1000).toFixed(1)}ث)</span></p>
                          {s.excerpt && <p className="text-stone-600 mt-1 whitespace-pre-wrap">{s.excerpt}…</p>}
                          {s.findings.length > 0 && <p className="text-red-700 mt-1">{s.findings.join(' · ')}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
