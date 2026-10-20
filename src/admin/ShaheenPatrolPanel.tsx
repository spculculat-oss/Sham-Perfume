import { T, TP, adminLocale, getAdminLang, listSep } from './adminL10n';
import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, ExternalLink, RefreshCw, ShieldAlert, Siren, Users } from 'lucide-react';
import { botOf } from '../utils/shaheenOrg';
import { SHIFTS } from '../../scripts/shaheen-patrol/shifts';
import type { ItemStatus, Level, PatrolFile } from '../../scripts/shaheen-patrol/patrol';

/**
 * «الدورية بالتناوب» — three shifts rotate hourly; each role's reports/supervisor scores and assigned probes are reviewed every 3 hours.
 * Advisory roles without a workflow are not invoked automatically. Safe fixes may run, unresolved issues go to Shaheen,
 * shared problems get a task force, and every completed workflow is reviewed by an expert of the same scope.
 * Data: src/data/live/shaheen-patrol.json on main (written by .github/workflows/shaheen-patrol.yml).
 */
const REPO = 'https://github.com/spculculat-oss/Sham-Perfume';
const RAW = 'https://raw.githubusercontent.com/spculculat-oss/Sham-Perfume/main/src/data/live/shaheen-patrol.json';
const card = 'rounded-2xl border border-stone-200 bg-white p-4 shadow-sm';
const ar = () => getAdminLang() === 'ar';
const when = (iso?: string) => (iso && Date.parse(iso) > 0 ? new Date(iso).toLocaleString(adminLocale(), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }) : '—');
const botName = (id: string) => { const b = botOf(id); return b ? (ar() ? b.nameAr : b.nameEn) : id; };
const isPatrol = (d: unknown): d is PatrolFile => Boolean(d && typeof d === 'object' && (d as PatrolFile).version === 1 && Array.isArray((d as PatrolFile).open));

const DOT: Record<Level, string> = { ok: 'bg-emerald-500', warn: 'bg-amber-400', fail: 'bg-red-500', skip: 'bg-stone-300' };
const STATUS: Record<ItemStatus, { label: () => string; cls: string }> = {
  fixing: { label: () => T('بيتصلح آلياً'), cls: 'bg-emerald-100 text-emerald-800' },
  waiting_fix: { label: () => T('مستني نتيجة الإصلاح'), cls: 'bg-sky-100 text-sky-800' },
  shaheen: { label: () => T('عند شاهين'), cls: 'bg-amber-100 text-amber-900' },
  waiting_shaheen: { label: () => T('مستني شاهين'), cls: 'bg-orange-100 text-orange-900' },
  task: { label: () => T('مهمة تطوير'), cls: 'bg-violet-100 text-violet-800' },
  owner: { label: () => T('محتاج قرارك'), cls: 'bg-red-100 text-red-800' },
  watch: { label: () => T('تحت المتابعة'), cls: 'bg-stone-100 text-stone-700' },
};

export default function ShaheenPatrolPanel() {
  const [data, setData] = useState<PatrolFile | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(() => {
    setLoading(true);
    fetch(`${RAW}?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: unknown) => { if (isPatrol(d)) setData(d); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className={card} dir={ar() ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-black text-stone-900"><Siren className="h-5 w-5 text-amber-700" />{T('الدورية بالتناوب')}</h3>
        <div className="flex gap-2">
          <a className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-bold text-stone-700" href={`${REPO}/actions/workflows/shaheen-patrol.yml`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />{T('سجل التشغيل')}</a>
          <button type="button" onClick={load} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-bold text-stone-700"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{T('تحديث')}</button>
        </div>
      </div>
      <p className="mt-1 text-xs text-stone-500">{T('تلات ورديات بالتناوب، وردية كل ساعة: الدورية تراجع تقارير وحالة كل دور حسب ورديته، وتجري الاختبارات العملية المحددة لنطاقه كل 3 ساعات من غير ضغط على الموقع. الأدوار الاستشارية اللي مالهاش سير عمل تُراقَب من تقاريرها وتقييم مشرف شاهين ولا تُشغَّل تلقائياً. الإصلاحات الآمنة تتعمل، والباقي يروح لشاهين أو لفريق عمل، وكل تشغيل مكتمل يراجعه خبير من نفس النطاق.')}</p>
      <ul className="mt-2 grid gap-1.5 text-[11px] md:grid-cols-3">
        {SHIFTS.map((x) => (
          <li key={x.index} className={`rounded-lg border px-2 py-1.5 ${data?.shift?.index === x.index ? 'border-amber-400 bg-amber-50' : 'border-stone-100'}`}>
            <b className="block text-stone-800">{ar() ? x.nameAr : x.nameEn}{data?.shift?.index === x.index ? <span className="ms-1 rounded-full bg-amber-200 px-1.5 text-[10px] text-amber-900">{T('آخر وردية')}</span> : null}</b>
            <span className="block text-stone-500">{x.bots.map(botName).join(listSep())}</span>
            {data?.shift?.next[x.index] && <span className="block text-stone-600">{T('الدور الجاي')}: {when(data.shift.next[x.index])}</span>}
          </li>
        ))}
      </ul>

      {!data ? (
        <p className="mt-3 rounded-xl bg-stone-50 p-3 text-xs text-stone-500">{T('لسه مفيش دورية اتسجلت — أول وردية بتشتغل في الساعة الجاية (الدقيقة 52).')}</p>
      ) : (
        <div className="mt-3 space-y-3 text-xs">
          <div className="rounded-xl bg-stone-50 p-3">
            <p className="font-bold text-stone-800">{TP('آخر وردية: {when} · صحة الأدوات {health}%', { when: when(data.updatedAt), health: data.health })}</p>
            {ar() && <p className="mt-1 text-stone-600">{data.summaryAr}</p>}
            <p className={`mt-1 ${data.engine.ready ? 'text-emerald-700' : 'text-orange-800'}`}>{data.engine.ready ? T('محرك ذكاء اصطناعي جاهز لشاهين') : T('مفيش محرك ذكاء اصطناعي شغال — شاهين بيرد من خبرته المسجلة، والمشاكل اللي محتاجة تشخيص مستنياه (مفيش إصلاح وهمي).')}</p>
          </div>

          <div>
            <b className="text-stone-700">{T('الاختبارات العملية')}</b>
            <ul className="mt-1 grid gap-1 md:grid-cols-2">
              {data.probes.map((p) => (
                <li key={p.id} className="flex items-start gap-2 rounded-lg border border-stone-100 px-2 py-1.5">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${DOT[p.level]}`} />
                  <span><b className="text-stone-800">{ar() ? p.nameAr : p.nameEn || p.id}</b>{p.deep ? <span className="ms-1 rounded-full bg-sky-100 px-1.5 text-[10px] font-bold text-sky-800">{T('فحص خبير')}</span> : null}
                    <span className="block text-stone-500">{ar() ? p.noteAr : TP('{checked} اختبار، {failed} فيه مشكلة', { checked: p.checked, failed: p.failed })}{p.at ? ` · ${when(p.at)}` : ''}</span></span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <b className="flex items-center gap-1 text-stone-700"><ShieldAlert className="h-4 w-4 text-red-700" />{TP('المشاكل المفتوحة ({count})', { count: data.open.length })}</b>
            {data.open.length ? (
              <ul className="mt-1 space-y-1.5">
                {data.open.map((i) => (
                  <li key={i.key} className={`rounded-lg border px-2.5 py-2 ${i.level === 'fail' ? 'border-red-200 bg-red-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full px-1.5 text-[10px] font-bold ${STATUS[i.status].cls}`}>{STATUS[i.status].label()}</span>
                      <b className="text-stone-800">{botName(i.bot)}</b>
                      {i.issue ? <a className="font-bold text-violet-800 underline" href={`${REPO}/issues/${i.issue}`} target="_blank" rel="noreferrer">#{i.issue}</a> : null}
                    </div>
                    <p className="mt-1 text-stone-700">{i.textAr}</p>
                    <p className="mt-0.5 text-stone-500">← {i.nextAr}</p>
                    {i.shaheen && <p className="mt-0.5 text-amber-900">{i.shaheen.by === 'ai' ? T('تشخيص شاهين') : T('شاهين (من خبرته المسجلة)')}: {i.shaheen.diagnosisAr}</p>}
                    {i.team && <p className="mt-0.5 flex flex-wrap items-center gap-1 text-sky-900"><Users className="h-3.5 w-3.5" />{T('فريق العمل')}: {i.team.map((p) => `${botName(p.bot)} (${p.roleAr})`).join('، ')}</p>}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-1 text-emerald-700">{T('مفيش مشاكل مفتوحة — كل الأدوات عدّت الفحص')}</p>}
          </div>

          <div>
            <b className="flex items-center gap-1 text-stone-700"><BadgeCheck className="h-4 w-4 text-emerald-700" />{T('مراجعات خبراء الفحص')}</b>
            {data.reviews.length ? (
              <ul className="mt-1 space-y-1">
                {data.reviews.slice(0, 10).map((r) => (
                  <li key={`${r.bot}-${r.runAt}`} className="rounded-lg bg-stone-50 px-2.5 py-1.5">
                    <b className="text-stone-800">{ar() ? r.reviewerAr : r.reviewerEn}</b> ← {botName(r.bot)} · {when(r.runAt)} ·{' '}
                    <span className={r.verdict === 'approved' ? 'font-bold text-emerald-700' : 'font-bold text-red-700'}>{r.verdict === 'approved' ? T('اتقبل') : T('اترفض')}</span>
                    {r.defects.length > 0 && ar() && <span className="block text-red-700">{r.defects.join(' · ')}</span>}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-1 text-stone-500">{T('مفيش شغل خلص من آخر وردية')}</p>}
          </div>

          {data.resolved.length > 0 && (
            <div>
              <b className="text-stone-700">{T('اتصلحت مؤخراً')}</b>
              <ul className="mt-1 list-disc space-y-0.5 ps-5 text-stone-600">
                {data.resolved.slice(0, 6).map((r) => <li key={`${r.key}-${r.resolvedAt}`}>{r.textAr} — <span className="text-emerald-700">{r.howAr}</span> ({when(r.resolvedAt)})</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
