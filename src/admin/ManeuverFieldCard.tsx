import { T, TP, adminLocale } from './adminL10n';
import { useEffect, useMemo, useState } from 'react';
import { Crosshair } from 'lucide-react';
import bundledManeuver from '../data/live/shaheen-maneuver.json';
import { OWNER } from '../utils/ownerAuthority';
import { readManeuverReport, type ManeuverReport } from '../utils/maneuver';
import { fileField } from '../utils/stateSectors';
import { STATE_LIMITS, type FieldItem, type StateField } from '../utils/platformState';

/**
 * «تقارير مناورة التخصصات — تصنيف الدولة»: what the field maneuver found on the live site, grouped by the sector the
 * State filed it under, with the robot responsible, why, and what the State did (a task, watched, an idea in the list).
 * Until the State's next round files a newer report, the same rules classify it here and it is marked provisional.
 */
const REPO = `https://github.com/${OWNER.repo}`;
const RAW = `https://raw.githubusercontent.com/${OWNER.repo}/main/src/data/live/shaheen-maneuver.json`;
const card = 'rounded-2xl border border-stone-200 bg-white p-4 shadow-sm';
const when = (iso?: string) => (iso && Date.parse(iso) > 0 ? new Date(iso).toLocaleString(adminLocale(), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }) : '—');
const SEV: Record<FieldItem['severity'], string> = { high: '🔴', medium: '🟠', low: '🟡' };

export default function ManeuverFieldCard({ field }: { field?: StateField }) {
  const [report, setReport] = useState<ManeuverReport | undefined>(() => readManeuverReport(bundledManeuver));
  useEffect(() => {
    let alive = true;
    fetch(`${RAW}?t=${Date.now()}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : undefined)).then((d) => { const r = readManeuverReport(d); if (alive && r) setReport(r); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  // The State's own filing when it covers the newest report; otherwise the same rules, provisional.
  const provisional = Boolean(report && (!field || Date.parse(report.updatedAt) > Date.parse(field.maneuverAt)));
  const shown = useMemo(() => (provisional ? fileField(report, field, new Date().toISOString(), STATE_LIMITS.perRun.maneuver).field : field), [provisional, report, field]);
  const groups = useMemo(() => {
    const by = new Map<string, FieldItem[]>();
    for (const i of shown?.items ?? []) by.set(i.deptAr || i.dept, [...(by.get(i.deptAr || i.dept) || []), i]);
    return [...by.entries()].sort((a, b) => b[1].filter((i) => i.kind === 'error').length - a[1].filter((i) => i.kind === 'error').length);
  }, [shown]);
  const errors = (shown?.items ?? []).filter((i) => i.kind === 'error').length;
  const ideas = (shown?.items ?? []).length - errors;

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center gap-2">
        <Crosshair className="h-5 w-5 text-rose-700" />
        <h3 className="font-bold">{T('تقارير مناورة التخصصات — تصنيف الدولة')}</h3>
      </div>
      <p className="mt-1 text-xs text-stone-600">{T('كل 6 ساعات روبوت بيفتح كل أقسام الموقع الحي زي زائر على الموبايل ويتكلم مع شاهين، وكل قسم يفحصه متخصصه. الدولة بتحدد كل خطأ وفكرة تحت أنهي قطاع وأنهي روبوت، والخطير بيتحول لمهمة بعد تصويت الأعضاء.')}</p>
      {!report ? <p className="mt-2 text-sm text-stone-500">{T('المناورة لسه ماشتغلتش.')}</p> : (
        <>
          <p className="mt-2 text-sm">{TP('آخر مناورة: {at} — {p} قسم اتفتح على الموبايل و{d} محادثة تدريب: {e} خطأ و{i} فكرة تطوير.', { at: when(report.updatedAt), p: report.run.pages, d: report.run.drills + report.run.live, e: errors, i: ideas })}</p>
          {report.run.browserNoteAr && <p className="mt-1 text-xs text-amber-800">{report.run.browserNoteAr}</p>}
          {provisional && <p className="mt-1 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{T('تصنيف مبدئي بنفس قواعد الدولة — هتعتمده وتفتح المهام في جولتها الجاية (كل ساعة).')}</p>}
          {report.resolved.length > 0 && <p className="mt-1 text-xs text-emerald-700">{TP('اتحل من قبل: {n} مشكلة (آخرها: {t})', { n: report.resolved.length, t: report.resolved[0].titleAr })}</p>}
          <div className="mt-3 space-y-2">
            {groups.map(([dept, items]) => (
              <details key={dept} className="rounded-xl border border-stone-200 p-2" open={items.some((i) => i.kind === 'error' && i.severity === 'high')}>
                <summary className="cursor-pointer text-sm font-bold">{dept} <span className="text-xs font-normal text-stone-500">{TP('{e} خطأ · {i} فكرة', { e: items.filter((i) => i.kind === 'error').length, i: items.filter((i) => i.kind === 'idea').length })}</span></summary>
                <ul className="mt-2 space-y-2">
                  {items.map((i) => (
                    <li key={i.id} className="rounded-lg bg-stone-50 p-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{i.kind === 'error' ? SEV[i.severity] : '💡'}</span>
                        <span className="flex-1 font-bold text-stone-800">{i.titleAr}</span>
                        {i.issue ? <a className="font-bold text-sky-800 underline" href={`${REPO}/issues/${i.issue}`} target="_blank" rel="noreferrer">#{i.issue}</a> : null}
                      </div>
                      <div className="mt-1 text-stone-600">{TP('القسم: {s} · الروبوت المسؤول: {b}', { s: i.sectionAr, b: i.botAr || T('رئيس القسم نفسه') })}</div>
                      <div className="mt-0.5 text-stone-500">{i.reasonAr}</div>
                      <div className="mt-0.5 text-stone-700">
                        {i.action === 'task' ? (i.issue ? T('بقت مهمة لوكيل البرمجة') : i.refused ? T('الأعضاء مارضيوش يفتحوها مهمة — تحت المراقبة') : T('هتبقى مهمة في جولة الدولة الجاية')) : i.action === 'watch' ? T('تحت المراقبة — لو اتكررت 3 مرات تبقى مهمة') : T('في قايمة أفكار القطاع')}
                        {i.seen > 1 ? ` · ${TP('اتشافت {n} مرات ورا بعض', { n: i.seen })}` : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
