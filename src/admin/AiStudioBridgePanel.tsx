import { T, adminLocale } from './adminL10n';
import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, CircleAlert, Clock, ExternalLink, GitMerge, RefreshCw, XCircle } from 'lucide-react';
import bundled from '../data/live/aistudio-bridge.json';
import type { BridgeFile, BridgeRun, BridgeStatus } from '../../scripts/aistudio/bridge';

/**
 * «بوابة جوجل استوديو» inside «بيئة التحديثات»: Google AI Studio pushes to its own repository, and the bridge
 * (.github/workflows/aistudio-bridge.yml → src/data/live/aistudio-bridge.json) filters, checks and publishes.
 * Public data from the repository, so it shows on GitHub Pages and Vercel alike.
 */
const SITE = 'https://github.com/spculculat-oss/Sham-Perfume';
const LIVE_URL = 'https://raw.githubusercontent.com/spculculat-oss/Sham-Perfume/main/src/data/live/aistudio-bridge.json';
const RUNS_URL = `${SITE}/actions/workflows/aistudio-bridge.yml`;
const card = 'rounded-2xl border border-stone-200 bg-white p-4 shadow-sm';
const when = (iso?: string) => (iso && Date.parse(iso) > 0 ? new Date(iso).toLocaleString(adminLocale(), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }) : '—');

const STATUS: Record<BridgeStatus, { label: () => string; cls: string; icon: React.ReactNode }> = {
  waiting_repo: { label: () => T('مستني مستودع جوجل استوديو'), cls: 'bg-stone-100 text-stone-700', icon: <Clock className="h-3.5 w-3.5" /> },
  idle: { label: () => T('شغالة — مفيش جديد'), cls: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  published: { label: () => T('آخر تحديث اتنشر'), cls: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  review: { label: () => T('تحديث مستني موافقة'), cls: 'bg-amber-100 text-amber-800', icon: <CircleAlert className="h-3.5 w-3.5" /> },
  failed: { label: () => T('آخر تحديث كسر فحص'), cls: 'bg-red-100 text-red-800', icon: <XCircle className="h-3.5 w-3.5" /> },
};
const RESULT: Record<BridgeRun['result'], { label: () => string; cls: string }> = {
  published: { label: () => T('اتنشر'), cls: 'bg-emerald-100 text-emerald-800' },
  review: { label: () => T('مستني موافقة'), cls: 'bg-amber-100 text-amber-800' },
  failed: { label: () => T('ما اتنشرش'), cls: 'bg-red-100 text-red-800' },
  nothing: { label: () => T('مفيش جديد'), cls: 'bg-stone-100 text-stone-600' },
  rehearsal: { label: () => T('تجربة'), cls: 'bg-stone-100 text-stone-600' },
};
const HOW: Record<BridgeRun['files'][number]['how'], () => string> = {
  new: () => T('جديد'),
  studio: () => T('نسخة الاستوديو'),
  merged: () => T('اتدمج مع شغل أحدث'),
  delete: () => T('مسح'),
};

export default function AiStudioBridgePanel() {
  const [data, setData] = useState<BridgeFile>(bundled as BridgeFile);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState('');
  const load = useCallback(() => {
    setLoading(true);
    fetch(`${LIVE_URL}?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : undefined))
      .then((d: BridgeFile | undefined) => { if (d?.runs && Date.parse(d.updatedAt) >= Date.parse(bundled.updatedAt)) setData(d); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const s = STATUS[data.status] || STATUS.waiting_repo;
  const studioUrl = `https://github.com/${data.repo}`;

  return (
    <div className={card}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-bold"><GitMerge className="h-4 w-4 text-blue-600" />{T('بوابة جوجل استوديو — فلترة ونشر تلقائي')}</h2>
        <div className="flex items-center gap-2">
          <a href={RUNS_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-stone-500 hover:underline">{T('سجل التشغيل')}<ExternalLink className="h-3 w-3" /></a>
          <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-xs hover:bg-stone-50 disabled:opacity-50 cursor-pointer">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{T('تحديث')}
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-stone-600">
        {T('جوجل استوديو بيرفع على مستودعه الخاص، والبوابة كل نص ساعة بتاخد التعديلات، تشيل اللي مش مسموح (بيانات الروبوتات، ملفات النشر، المستندات القانونية، المفاتيح)، تفحص الموقع، وتنشر السليم لوحدها. تعديلات السيرفر والإعدادات والمسح بتستنى موافقتك.')}
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ${s.cls}`}>{s.icon}{s.label()}</span>
        <span className="text-stone-500">{T('مستودع الاستوديو')}: <a className="font-mono hover:underline" dir="ltr" href={studioUrl} target="_blank" rel="noreferrer">{data.repo}</a></span>
        <span className="text-stone-500">· {when(data.updatedAt)}</span>
      </div>

      {data.status === 'waiting_repo' && (
        <p className="mb-3 rounded-xl bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-900">
          {T('الخطوة الوحيدة: في جوجل استوديو افتح التطبيق، ومن زرار المزامنة مع GitHub اختار «إنشاء مستودع جديد» (Create new repository) بالاسم ده، ويكون عام (Public):')} <span className="font-mono" dir="ltr">{data.repo.split('/').pop()}</span>
        </p>
      )}

      {!data.runs.length ? (
        <p className="rounded-xl bg-stone-50 px-3 py-4 text-center text-sm text-stone-500">{T('أول تحديث من جوجل استوديو هيظهر هنا مع اللي اتنشر واللي اتساب وليه.')}</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {data.runs.map((r) => {
            const key = `${r.studioSha}-${r.result}`;
            return <RunRow key={key} r={r} open={open === key} toggle={() => setOpen(open === key ? '' : key)} />;
          })}
        </ul>
      )}
    </div>
  );
}

function RunRow({ r, open, toggle }: { r: BridgeRun; open: boolean; toggle: () => void }) {
  const res = RESULT[r.result];
  return (
    <li className="py-2">
      <button type="button" onClick={toggle} className="flex w-full items-start gap-2 text-start cursor-pointer">
        <span className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${res.cls}`}>{res.label()}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-stone-900" dir="auto">{r.commits[0]?.subject || r.studioSha.slice(0, 7)}</span>
          <span className="block text-[11px] text-stone-500">{when(r.at)} · <span className="font-mono">{r.studioSha.slice(0, 7)}</span> · {r.files.length} {T('ملف')} · {r.skipped.length} {T('اتساب')}</span>
        </span>
        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-stone-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 rounded-xl bg-stone-50 p-3 text-xs">
          {r.files.map((f) => (
            <p key={f.path} className="text-stone-700">• <span className="font-mono" dir="ltr">{f.path}</span> — {HOW[f.how]()}{f.cls === 'review' ? ` · ${T('بعد الموافقة')}` : ''}</p>
          ))}
          {r.skipped.length > 0 && <p className="pt-1 font-bold text-stone-600">{T('اتساب ومش هيدخل الموقع')}:</p>}
          {r.skipped.map((f) => <p key={f.path} className="text-amber-800">• <span className="font-mono" dir="ltr">{f.path}</span> — <span dir="auto">{f.reason}</span></p>)}
          <div className="flex flex-wrap gap-3 pt-1">
            {r.branch && <a href={`${SITE}/compare/main...${encodeURIComponent(r.branch)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-stone-500 hover:underline">{T('الفرع')} <span className="font-mono" dir="ltr">{r.branch}</span><ExternalLink className="h-3 w-3" /></a>}
            {r.issue && <a href={`${SITE}/issues/${r.issue}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-stone-500 hover:underline">{T('المهمة')} #{r.issue}<ExternalLink className="h-3 w-3" /></a>}
            {r.mainSha && <a href={`${SITE}/commit/${r.mainSha}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-stone-500 hover:underline">{T('عرض التغييرات على GitHub')}<ExternalLink className="h-3 w-3" /></a>}
          </div>
        </div>
      )}
    </li>
  );
}
