import { useEffect, useState } from 'react';
import { Globe2, Loader2 } from 'lucide-react';
import { T, TP } from './adminL10n';
import { adminRequest } from './adminApi';
import { GATE_LIMITS, gateSummary, type GateStats } from '../utils/netGate';

/**
 * «بوابة الإنترنت» in the owner's suite: how much of today's allowance the robots used, and who asked most.
 * Counts only — the gate never keeps the questions or the pages (src/utils/netGate.ts).
 */
export default function NetGateCard() {
  const [stats, setStats] = useState<GateStats | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    adminRequest<GateStats>('/gate/status').then((s) => { if (alive) setStats(s); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);
  const summary = stats ? gateSummary(stats) : undefined;
  return (
    <div className="rounded-2xl border border-sky-900 bg-stone-900/70 p-4 text-xs text-stone-300" data-testid="net-gate-card">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-sky-200"><Globe2 className="h-4 w-4" />{T('بوابة الإنترنت')}</h3>
      <p className="mb-2 text-[11px] leading-relaxed text-stone-400">{T('الباب الوحيد بين الروبوتات والإنترنت: أي روبوت محتاج معلومة بيطلبها منها، وهي بتدوّر وتقرا المواقع العامة بس، وبتشيل أي بيانات حساسة قبل ما تخرج، وبتفتكر النتايج علشان الحصة المجانية ماتخلصش.')}</p>
      {!stats && !failed && <div className="flex items-center gap-2 text-stone-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />{T('بجيب أرقام النهارده…')}</div>}
      {failed && <p className="text-stone-500">{T('الأرقام مش متاحة دلوقتي (السيرفر مش واصل أو محتاج الكود السري).')}</p>}
      {stats && summary && (
        <>
          <div className="mb-2 flex flex-wrap gap-2">
            <span className="rounded-full border border-stone-700 px-2 py-0.5">{TP('بحث {n}', { n: stats.total.search })}</span>
            <span className="rounded-full border border-stone-700 px-2 py-0.5">{TP('قراءة صفحات {n}', { n: stats.total.read })}</span>
            <span className="rounded-full border border-stone-700 px-2 py-0.5">{TP('أسئلة كاملة {n}', { n: stats.total.ask })}</span>
            <span className="rounded-full border border-emerald-800 px-2 py-0.5 text-emerald-200">{TP('من الذاكرة {n}', { n: stats.total.cached })}</span>
            {stats.total.refused > 0 && <span className="rounded-full border border-amber-800 px-2 py-0.5 text-amber-200">{TP('اترفض {n}', { n: stats.total.refused })}</span>}
          </div>
          <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-stone-800"><div className="h-full bg-sky-500" style={{ width: `${summary.usedPercent}%` }} /></div>
          <p className="mb-2 text-[11px] text-stone-400">{TP('اتستخدم {p}% من حصة النهارده · لكل روبوت لحد {s} بحث و{r} صفحة في اليوم', { p: summary.usedPercent, s: GATE_LIMITS.perBot.search, r: GATE_LIMITS.perBot.read })}</p>
          {summary.top.length > 0
            ? <ul className="space-y-0.5">{summary.top.map((b) => <li key={b.id} className="flex justify-between gap-2"><span>{b.nameAr}</span><b className="tabular-nums" dir="ltr">{b.calls}</b></li>)}</ul>
            : <p className="text-stone-500">{T('محدش من الروبوتات استخدمها النهارده لسه.')}</p>}
        </>
      )}
    </div>
  );
}
