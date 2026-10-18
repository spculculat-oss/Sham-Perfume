import { T, adminLocale } from './adminL10n';
import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, CircleAlert, ExternalLink, RefreshCw, Sparkles, XCircle } from 'lucide-react';
import bundled from '../data/live/aistudio-intake.json';
import type { CheckState, CommitReview, IntakeFile, Level, Verdict } from '../../scripts/aistudio/review';

/**
 * «تحديثات AI Studio» inside «بيئة التحديثات»: every change made in Google AI Studio, reviewed automatically
 * after the site's pipeline (.github/workflows/aistudio-intake.yml → src/data/live/aistudio-intake.json).
 * Public data from the repository, so it shows on GitHub Pages and Vercel alike.
 */
const LIVE_URL = 'https://raw.githubusercontent.com/spculculat-oss/Sham-Perfume/main/src/data/live/aistudio-intake.json';
const RUNS_URL = 'https://github.com/spculculat-oss/Sham-Perfume/actions/workflows/aistudio-intake.yml';
const COMMIT_URL = 'https://github.com/spculculat-oss/Sham-Perfume/commit/';
const card = 'rounded-2xl border border-stone-200 bg-white p-4 shadow-sm';
const when = (iso?: string) => (iso && Date.parse(iso) > 0 ? new Date(iso).toLocaleString(adminLocale(), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }) : '—');

const VERDICT: Record<Verdict, { label: () => string; cls: string; icon: React.ReactNode }> = {
  received: { label: () => T('اتستلم'), cls: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  attention: { label: () => T('محتاج مراجعة'), cls: 'bg-amber-100 text-amber-800', icon: <CircleAlert className="h-3.5 w-3.5" /> },
  broken: { label: () => T('كسر الموقع'), cls: 'bg-red-100 text-red-800', icon: <XCircle className="h-3.5 w-3.5" /> },
};
const LEVEL: Record<Level, string> = { high: 'text-red-700', medium: 'text-amber-700', low: 'text-stone-600', info: 'text-emerald-700' };
const CHECK: Record<CheckState, { mark: string; cls: string }> = {
  success: { mark: '✓', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  failure: { mark: '✗', cls: 'bg-red-50 text-red-800 border-red-200' },
  pending: { mark: '…', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  skipped: { mark: '—', cls: 'bg-stone-50 text-stone-500 border-stone-200' },
};

export default function AiStudioIntakePanel() {
  const [data, setData] = useState<IntakeFile>(bundled as IntakeFile);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState('');
  const load = useCallback(() => {
    setLoading(true);
    fetch(`${LIVE_URL}?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : undefined))
      .then((d: IntakeFile | undefined) => { if (d?.commits && Date.parse(d.updatedAt) >= Date.parse(bundled.updatedAt)) setData(d); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const counts = data.commits.reduce((m, c) => ({ ...m, [c.verdict]: (m[c.verdict] || 0) + 1 }), {} as Record<Verdict, number>);
  const checks: [string, CheckState][] = [[T('فحص الأنواع'), data.checks.lint], [T('الاختبارات'), data.checks.test], [T('البناء'), data.checks.build], [T('النشر على الموقع'), data.checks.pages]];

  return (
    <div className={card}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-bold"><Sparkles className="h-4 w-4 text-amber-600" />{T('تحديثات AI Studio — مراجعة تلقائية')}</h2>
        <div className="flex items-center gap-2">
          <a href={RUNS_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-stone-500 hover:underline">{T('سجل التشغيل')}<ExternalLink className="h-3 w-3" /></a>
          <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-xs hover:bg-stone-50 disabled:opacity-50 cursor-pointer">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{T('تحديث')}
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-stone-600">
        {T('كل تعديل بتعمله في Google AI Studio بيوصل هنا لوحده بعد ما الموقع يتبني: بنتأكد إنه ما رجّعش نسخة قديمة من ملف، وما مسحش ملفات أساسية، ومفيهوش مفاتيح أو أرقام بطاقات، وإن الموقع اتبنى ونزل.')}
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-stone-500">{T('آخر نسخة')} {data.head ? <a className="font-mono hover:underline" href={COMMIT_URL + data.head} target="_blank" rel="noreferrer">{data.head.slice(0, 7)}</a> : '—'} · {when(data.checks.at)}</span>
        {checks.map(([label, state]) => <span key={label} className={`rounded-full border px-2 py-0.5 font-semibold ${CHECK[state].cls}`}>{CHECK[state].mark} {label}</span>)}
      </div>

      {!data.commits.length ? (
        <p className="rounded-xl bg-stone-50 px-3 py-4 text-center text-sm text-stone-500">{T('أول مراجعة هتظهر هنا بعد أول تحديث من AI Studio (وبتراجع كمان تحديثات آخر 14 يوم).')}</p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
            {(Object.keys(VERDICT) as Verdict[]).filter((v) => counts[v]).map((v) => <span key={v} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ${VERDICT[v].cls}`}>{VERDICT[v].icon}{counts[v]} {VERDICT[v].label()}</span>)}
          </div>
          <ul className="divide-y divide-stone-100">
            {data.commits.map((c) => <CommitRow key={c.sha} c={c} open={open === c.sha} toggle={() => setOpen(open === c.sha ? '' : c.sha)} />)}
          </ul>
        </>
      )}
    </div>
  );
}

function CommitRow({ c, open, toggle }: { c: CommitReview; open: boolean; toggle: () => void }) {
  const v = VERDICT[c.verdict];
  const notes = c.flags.filter((f) => f.level !== 'info').length;
  return (
    <li className="py-2">
      <button type="button" onClick={toggle} className="flex w-full items-start gap-2 text-start cursor-pointer">
        <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${v.cls}`}>{v.icon}{v.label()}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-stone-900" dir="auto">{c.title}</span>
          <span className="block text-[11px] text-stone-500">{when(c.date)} · <span className="font-mono">{c.sha.slice(0, 7)}</span> · {c.files} {T('ملف')} (<span className="text-emerald-700">+{c.additions}</span> <span className="text-red-700">−{c.deletions}</span>){notes ? ` · ${notes} ${T('ملاحظة')}` : ''}</span>
        </span>
        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-stone-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 rounded-xl bg-stone-50 p-3 text-xs">
          {c.summary && <p className="text-stone-700" dir="auto">{c.summary}</p>}
          {c.added.length > 0 && <p className="text-stone-600"><b>{T('ملفات جديدة')}:</b> <span className="font-mono" dir="ltr">{c.added.join(', ')}</span></p>}
          {c.deleted.length > 0 && <p className="text-red-700"><b>{T('ملفات اتمسحت')}:</b> <span className="font-mono" dir="ltr">{c.deleted.join(', ')}</span></p>}
          {c.flags.length ? c.flags.map((f, i) => (
            <p key={i} className={LEVEL[f.level]}>• {f.file && <span className="font-mono" dir="ltr">{f.file}: </span>}{f.text}</p>
          )) : <p className="text-emerald-700">• {T('مفيش أي ملاحظات — التحديث سليم')}</p>}
          <a href={COMMIT_URL + c.sha} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-stone-500 hover:underline">{T('عرض التغييرات على GitHub')}<ExternalLink className="h-3 w-3" /></a>
        </div>
      )}
    </li>
  );
}
