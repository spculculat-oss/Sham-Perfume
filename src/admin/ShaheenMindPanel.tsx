import { useCallback, useEffect, useState } from 'react';
import { Brain, RefreshCw } from 'lucide-react';
import bundledGraph from '../data/live/shaheen-graph.json';
import bundledImmune from '../data/live/shaheen-immune.json';
import bundledEars from '../data/live/shaheen-ears.json';
import bundledStudy from '../data/live/shaheen-study.json';
import bundledExam from '../data/live/shaheen-exam.json';
import bundledReflex from '../data/live/shaheen-reflex.json';
import { T, adminLocale, getAdminLang } from './adminL10n';
import { isStale, mindSnapshot, type MindFiles } from '../utils/shaheenMind';

/**
 * «درجة عقل شاهين» — the owner's dashboard for the mind: one number for the graph, one for the IQ exam, one for
 * the immune health and the instant answers a visitor gets with no engine. Every number carries the file it came
 * from and the date it was measured (src/utils/shaheenMind.ts); a report that is missing is said out loud, never
 * shown as a zero, and a report older than the daily cycle is labelled as old.
 */
const REPO = 'https://github.com/spculculat-oss/Sham-Perfume';
const RAW = 'https://raw.githubusercontent.com/spculculat-oss/Sham-Perfume/main/';
const FILES = {
  graph: 'src/data/live/shaheen-graph.json',
  exam: 'src/data/live/shaheen-exam.json',
  immune: 'src/data/live/shaheen-immune.json',
  reflex: 'src/data/live/shaheen-reflex.json',
} as const;
type Key = keyof typeof FILES;
const BUNDLED: MindFiles = {
  graph: bundledGraph, immune: bundledImmune, ears: bundledEars,
  study: bundledStudy, exam: bundledExam, reflex: bundledReflex,
};
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(adminLocale(), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }) : '—');
const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v));

export default function ShaheenMindPanel() {
  const [files, setFiles] = useState<MindFiles>(BUNDLED);
  const [loading, setLoading] = useState(false);
  const [fresh, setFresh] = useState(false);
  const ar = getAdminLang() === 'ar';

  const load = useCallback(() => {
    setLoading(true);
    Promise.all((Object.keys(FILES) as Key[]).map((k) =>
      fetch(`${RAW}${FILES[k]}?t=${Date.now()}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: unknown) => [k, isObject(d) ? d : undefined] as const)
        .catch(() => [k, undefined] as const)))
      .then((rows) => {
        const next: MindFiles = { ...BUNDLED };
        let improved = false;
        for (const [k, d] of rows) {
          if (!d) continue;
          const old = (next as Record<string, unknown>)[k] as { updatedAt?: string } | undefined;
          if (!old || Date.parse(String(d.updatedAt || '')) >= Date.parse(String(old.updatedAt || ''))) {
            (next as Record<string, unknown>)[k] = d;
            improved = true;
          }
        }
        setFiles(next);
        setFresh(improved);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const snap = mindSnapshot(files);
  const tone = (value: number | null, of: number | null) => {
    if (value === null || !of) return 'border-stone-200 bg-stone-50 text-stone-600';
    const pct = (value / of) * 100;
    if (pct >= 85) return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    if (pct >= 60) return 'border-amber-200 bg-amber-50 text-amber-900';
    return 'border-red-200 bg-red-50 text-red-900';
  };
  const now = Date.now();

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-black text-stone-800">
          <Brain className="h-4 w-4 text-violet-700" aria-hidden />
          {T('درجة عقل شاهين')}
          <span className="text-[11px] font-normal text-stone-500">{ar ? snap.summaryAr : snap.summaryEn}</span>
        </h3>
        <button type="button" onClick={load} disabled={loading}
          className="flex items-center gap-1 rounded-lg border border-stone-300 px-2 py-1 text-[11px] font-bold text-stone-700 disabled:opacity-50">
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} aria-hidden />{T('تحديث')}
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {snap.numbers.map((n) => {
          const stale = isStale(n, now, snap.staleHours);
          return (
            <div key={n.id} className={`rounded-2xl border p-3 shadow-sm ${tone(n.value, n.of)}`}>
              <div className="flex items-baseline justify-between gap-1">
                <b className="text-xs">{ar ? n.labelAr : n.labelEn}</b>
                {stale && <span className="rounded-full bg-white/70 px-1.5 text-[10px] font-bold">{T('قديم')}</span>}
              </div>
              <p className="mt-1 text-2xl font-black tabular-nums">
                {n.value ?? '—'}
                {n.of && <span className="text-xs font-bold opacity-70"> / {n.of}</span>}
                {!n.of && n.value !== null && <span className="text-xs font-bold opacity-70"> {ar ? n.unitAr : ''}</span>}
              </p>
              <p className="mt-1 text-[11px] leading-snug opacity-90">{n.noteAr && ar ? n.noteAr : n.noteEn || n.noteAr}</p>
              <p className="mt-1.5 text-[10px] leading-snug opacity-70">
                <a className="font-bold underline" href={`${REPO}/blob/main/${n.src}`} target="_blank" rel="noreferrer">{n.src.split('/').pop()}</a>
                {' · '}{when(n.updatedAt)}
              </p>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-stone-500">
        {T('كل رقم هنا من تقرير منشور في الموقع بتاريخه — لو تقرير ناقص بيتقال «مش متاح»، مش صفر. الأرقام دي بتقيس وتوصي، ومابتغيّرش سعر ولا وعد.')}
        {fresh && <span className="ms-1 font-bold text-emerald-700">{T('· محدّث من آخر تشغيل')}</span>}
      </p>
    </section>
  );
}
