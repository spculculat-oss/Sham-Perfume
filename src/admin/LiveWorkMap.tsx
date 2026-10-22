import { ExternalLink, Radio } from 'lucide-react';
import { T, TP, adminLocale, getAdminLang } from './adminL10n';
import type { useOpsLive } from './useOpsLive';
import { BOTS, DEPARTMENTS, botOf, type BotId } from '../utils/shaheenOrg';
import { shortName } from '../utils/opsMap';
import { activityFeed, dutyShort, stepAr, type BotLive, type FeedKind, type LiveState, type currentStep } from '../utils/opsLive';

/**
 * «خريطة عمل لحظية» (the owner's request, 2026-10-22): every robot as a tile in its department, coloured by what it is
 * doing this minute — 🟢 working (with its current step in plain words, how far it got and since when), 🔵 in the queue,
 * ⚪ asleep until its next turn (with the time), 🔴 its last run failed, ⏸️ paused on purpose (by the owner, by «دولة
 * المنصة», or the emergency brake) — and a log of who started and who finished lately. It reads the same live layer as
 * the operations map (one poll for both: useOpsLive in ShaheenOpsMapPanel), so it costs no extra reads.
 * Management only: it renders inside the ops map, which sits behind the admin code / the owner's suite.
 */
type Step = ReturnType<typeof currentStep>;
const ar = () => getAdminLang() === 'ar';
const name = (id: BotId) => { const b = botOf(id); return b ? (ar() ? b.nameAr : b.nameEn) : id; };
const short = (id: BotId) => { const b = botOf(id); return b ? (ar() ? shortName(b.nameAr) : b.nameEn.split(/\s+[(—]/)[0]) : id; };
const clock = (iso?: string) => (iso && Date.parse(iso) > 0 ? new Date(iso).toLocaleTimeString(adminLocale(), { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Cairo' }) : '—');
const dayClock = (iso?: string) => (iso && Date.parse(iso) > 0 ? new Date(iso).toLocaleString(adminLocale(), { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Cairo' }) : '—');
const mins = (iso: string | undefined, now: number) => (iso && Date.parse(iso) > 0 ? Math.max(0, Math.round((now - Date.parse(iso)) / 60_000)) : undefined);
const since = (iso: string | undefined, now: number) => {
  const m = mins(iso, now);
  if (m === undefined) return '—';
  if (m < 1) return T('من أقل من دقيقة');
  return m < 60 ? TP('من {n} دقيقة', { n: m }) : TP('من {n} ساعة', { n: Math.round(m / 60) });
};
/** The step in plain words: Arabic from the step's name when known, else the name itself. */
const stepText = (s?: string) => (s ? (ar() ? stepAr(s) || s : s) : undefined);

export const TILE: Record<LiveState, { emoji: string; label: () => string; tile: string; dot: string }> = {
  running: { emoji: '🟢', label: () => T('شغالة دلوقتي'), tile: 'border-emerald-400 bg-emerald-50', dot: 'animate-pulse bg-emerald-500' },
  queued: { emoji: '🔵', label: () => T('في الطابور'), tile: 'border-sky-300 bg-sky-50', dot: 'animate-pulse bg-sky-500' },
  stopped: { emoji: '🔴', label: () => T('آخر تشغيل فشل'), tile: 'border-red-300 bg-red-50', dot: 'bg-red-500' },
  paused: { emoji: '⏸️', label: () => T('موقوفة بأمر'), tile: 'border-amber-300 bg-amber-50', dot: 'bg-amber-500' },
  waiting: { emoji: '⚪', label: () => T('نايمة لحد دورها'), tile: 'border-stone-200 bg-white', dot: 'bg-stone-300' },
  unknown: { emoji: '⚪', label: () => T('لسه ماشتغلتش'), tile: 'border-dashed border-stone-200 bg-white', dot: 'bg-stone-200' },
  ondemand: { emoji: '🔘', label: () => T('بتشتغل عند الطلب'), tile: 'border-stone-200 bg-stone-50', dot: 'bg-stone-300' },
};
const LEGEND: LiveState[] = ['running', 'queued', 'stopped', 'paused', 'waiting', 'ondemand'];
const FEED: Record<FeedKind, { emoji: string; verb: () => string; tone: string }> = {
  running: { emoji: '🟢', verb: () => T('بدأت شغل'), tone: 'text-emerald-300' },
  queued: { emoji: '🔵', verb: () => T('دخلت الطابور'), tone: 'text-sky-300' },
  success: { emoji: '✅', verb: () => T('خلّصت شغلها بنجاح'), tone: 'text-stone-200' },
  failed: { emoji: '🔴', verb: () => T('فشلت'), tone: 'text-red-300' },
  cancelled: { emoji: '⏹️', verb: () => T('اتلغى تشغيلها'), tone: 'text-stone-400' },
};
const PAUSED_BY = { owner: () => T('بأمر صاحب الموقع'), state: () => T('بأمر دولة المنصة'), frozen: () => T('فرامل الطوارئ') };

/** One tile's second line: what it is doing now, when it wakes, or why it stopped. */
function statusLine(l: BotLive, st: Step | undefined, now: number): string {
  switch (l.state) {
    case 'running': return stepText(st?.step) || T('شغالة — بتجهّز الخطوة الجاية');
    case 'queued': return T('مستنية مكان تبدأ فيه — حالاً');
    case 'waiting': return l.next ? TP('صاحية تاني {time}', { time: dayClock(l.next) }) : T('مستنية دورها');
    case 'paused': return l.pausedBy ? PAUSED_BY[l.pausedBy]() : T('موقوفة بأمر');
    case 'stopped': return ar() ? l.noteAr.replace(/^\S+: /, '') : TP('آخر تشغيل فشل {ago}', { ago: since(l.since, now) });
    case 'ondemand': return ar() ? l.noteAr : T('بتشتغل عند الطلب');
    default: return l.next ? TP('أول دور ليها {time}', { time: dayClock(l.next) }) : T('لسه ماشتغلتش');
  }
}

export default function LiveWorkMap({ live, gh, stepOf, now, onPick }: {
  live: BotLive[]; gh: ReturnType<typeof useOpsLive>; stepOf: (l: BotLive) => Step; now: number; onPick: (id: BotId) => void;
}) {
  const of = (id: BotId) => live.find((l) => l.id === id);
  const count = (s: LiveState) => live.filter((l) => l.state === s || (s === 'waiting' && l.state === 'unknown')).length;
  const working = live.filter((l) => l.state === 'running' || l.state === 'queued');
  // One card per run: robots sharing a workflow work together.
  const runs = [...new Map(working.map((l) => [l.run?.id ?? l.id, l])).values()];
  const feed = activityFeed(gh.runs, 12);
  const every = Math.round(gh.everyMs / 1000);

  return (
    <div className="mt-3 rounded-2xl border border-stone-300 bg-stone-950 p-3 text-stone-100" data-testid="live-work-map">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="flex items-center gap-2 text-base"><Radio className="h-5 w-5 animate-pulse text-emerald-400" />{T('خريطة العمل اللحظية')}</b>
        <span className="text-sm text-stone-400">
          {gh.limitedUntil ? TP('التحديث واقف مؤقتاً لحد {time} (حد القراءة من جيت هب)', { time: clock(new Date(gh.limitedUntil).toISOString()) })
            : gh.error ? T('تعذّر الوصول لسجل التشغيل — بيحاول تاني لوحده')
            : gh.at ? TP('بتتحدّث لوحدها كل {n} ثانية — آخر تحديث {time}', { n: every, time: clock(new Date(gh.at).toISOString()) })
            : T('بتحمّل الحالة اللحظية…')}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 text-sm">
        {LEGEND.map((s) => <span key={s} className="rounded-full bg-stone-800 px-2 py-0.5">{TILE[s].emoji} {TILE[s].label()} <b className="text-amber-200">{count(s)}</b></span>)}
      </div>

      {/* Who is working this minute, and on what. */}
      <div className="mt-3">
        <b className="text-sm text-emerald-300">{T('بتشتغل دلوقتي وبتعمل إيه')}</b>
        {!runs.length ? <p className="mt-1 text-sm text-stone-400">{T('مفيش روبوت شغال اللحظة دي — الكل نايم لحد دوره')}</p> : (
          <ul className="mt-1 grid gap-2 md:grid-cols-2">
            {runs.map((l) => {
              const st = stepOf(l);
              const together = working.filter((x) => (x.run ? x.run.id === l.run?.id : x.id === l.id));
              const pct = st && st.total ? Math.round(((st.done + (l.state === 'running' ? 0.5 : 0)) / st.total) * 100) : 0;
              return (
                <li key={l.run?.id ?? l.id} className="rounded-xl border border-emerald-700 bg-stone-900 p-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span>
                      {TILE[l.state].emoji}{' '}
                      {together.map((x, i) => <span key={x.id}>{i > 0 && ' + '}<button type="button" className="font-bold text-white hover:underline" onClick={() => onPick(x.id)}>{name(x.id)}</button></span>)}
                    </span>
                    {l.run && <a href={l.run.url} target="_blank" rel="noreferrer" className="shrink-0 text-stone-400 hover:text-white" title={T('افتح التشغيل على جيت هب')}><ExternalLink className="h-5 w-5" /></a>}
                  </div>
                  <p className="mt-1 text-base font-bold text-emerald-300">{l.state === 'queued' ? T('في الطابور — هتبدأ حالاً') : stepText(st?.step) || T('بتجهّز الخطوة الجاية')}</p>
                  {st && st.total > 0 && (
                    <div className="mt-1">
                      <div className="h-1.5 overflow-hidden rounded-full bg-stone-700"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} /></div>
                      <span className="text-stone-400">{TP('الخطوة {done} من {total}', { done: Math.min(st.done + 1, st.total), total: st.total })}</span>
                    </div>
                  )}
                  <p className="mt-1 text-stone-400">{TP('بدأت الساعة {time} ({ago})', { time: clock(l.since), ago: since(l.since, now) })}</p>
                  {botOf(together[0].id) && <p className="mt-0.5 text-stone-500">{TP('شغلتها: {duty}', { duty: ar() ? dutyShort(botOf(together[0].id)!) : name(together[0].id) })}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Every robot in its department. */}
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {DEPARTMENTS.map((d) => {
          const bots = BOTS.filter((b) => b.dept === d.id);
          if (!bots.length) return null;
          return (
            <div key={d.id} className="rounded-xl bg-stone-900 p-2">
              <b className="text-sm text-amber-200">{ar() ? d.nameAr : d.nameEn}</b>
              <ul className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {bots.map((b) => {
                  const l = of(b.id);
                  if (!l) return null;
                  const st = l.state === 'running' ? stepOf(l) : undefined;
                  return (
                    <li key={b.id}>
                      <button type="button" onClick={() => onPick(b.id)} title={`${name(b.id)} — ${TILE[l.state].label()}${ar() ? ` — ${dutyShort(b)}` : ''}`}
                        className={`w-full rounded-lg border px-2 py-1.5 text-start text-stone-900 hover:shadow ${TILE[l.state].tile}`}>
                        <span className="flex items-center gap-1 text-sm font-bold"><span className={`inline-block h-2 w-2 shrink-0 rounded-full ${TILE[l.state].dot}`} /><span className="truncate">{short(b.id)}</span></span>
                        <span className="mt-0.5 block truncate text-[13px] text-stone-600">{TILE[l.state].emoji} {statusLine(l, st, now)}</span>
                        {l.state === 'running' && <span className="block text-[13px] text-emerald-700">{since(l.since, now)}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Who finished, who started. */}
      <div className="mt-3 rounded-xl bg-stone-900 p-2">
        <b className="text-sm text-amber-200">{T('سجل النشاط الأخير')}</b>
        {!feed.length ? <p className="mt-1 text-sm text-stone-400">{gh.at ? T('مفيش نشاط مسجّل لسه') : T('بيحمّل السجل…')}</p> : (
          <ul className="mt-1 divide-y divide-stone-800 text-sm">
            {feed.map((f) => (
              <li key={`${f.id}-${f.kind}`} className="flex items-center justify-between gap-2 py-1">
                <span className="min-w-0 truncate text-stone-200">
                  <span className="text-stone-500">{clock(f.at)}</span>{' '}{FEED[f.kind].emoji}{' '}
                  {f.bots.length ? f.bots.map((id, i) => <span key={id}>{i > 0 && ' + '}<button type="button" className="font-bold hover:underline" onClick={() => onPick(id)}>{short(id)}</button></span>) : <b>{f.workflow.replace(/\.ya?ml$/, '')}</b>}
                  {' '}<span className={FEED[f.kind].tone}>{FEED[f.kind].verb()}</span>
                </span>
                <a href={f.url} target="_blank" rel="noreferrer" className="shrink-0 text-stone-500 hover:text-white">{since(f.at, now)}</a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
