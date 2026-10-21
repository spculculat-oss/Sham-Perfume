import { T, TP, adminLocale, getAdminLang } from './adminL10n';
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Crown, ExternalLink, GitPullRequest, PauseCircle, PlayCircle, RefreshCw, ShieldAlert } from 'lucide-react';
import bundledControls from '../data/owner/controls.json';
import { BOTS, type Bot } from '../utils/shaheenOrg';
import { OWNER, OWNER_APPROVAL_LABEL, OWNER_RULES, SMALL_CHANGE, readControls, stoppedByOwner, type OwnerControls } from '../utils/ownerAuthority';

/**
 * «مركز تحكم صاحب الموقع» — what the owner's switches say right now (src/data/owner/controls.json, bundled and
 * latest from GitHub), which robots are paused, the changes waiting for his click, and the button that opens his
 * desk (owner-control.yml: GitHub only lets the repository owner's account run it). Nothing here changes the
 * switches by itself: a web page cannot prove who is pressing, GitHub can.
 */
const REPO = `https://github.com/${OWNER.repo}`;
const DESK = `${REPO}/actions/workflows/owner-control.yml`;
const RAW = `https://raw.githubusercontent.com/${OWNER.repo}/main/src/data/owner/controls.json`;
const PENDING = `https://api.github.com/repos/${OWNER.repo}/issues?state=open&per_page=20&labels=${encodeURIComponent(OWNER_APPROVAL_LABEL)}`;
const card = 'rounded-2xl border border-stone-200 bg-white p-4 shadow-sm';
const when = (iso?: string) => (iso && Date.parse(iso) > 0 ? new Date(iso).toLocaleString(adminLocale(), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }) : '—');
const name = (b?: Bot) => (b ? (getAdminLang() === 'ar' ? b.nameAr : b.nameEn) : '');

interface PendingChange { number: number; title: string; html_url: string; created_at: string; pull_request?: unknown }

/** Robots grouped by the workflow they run in (they stop and start together). */
const GROUPS = (() => {
  const map = new Map<string, Bot[]>();
  for (const b of BOTS) if (b.workflow && b.workflow !== 'pages.yml' && b.workflow !== 'owner-control.yml') map.set(b.workflow, [...(map.get(b.workflow) || []), b]);
  return [...map.entries()];
})();

export default function OwnerControlPanel() {
  const [controls, setControls] = useState<OwnerControls>(() => readControls(bundledControls));
  const [pending, setPending] = useState<PendingChange[] | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${RAW}?t=${Date.now()}`, { cache: 'no-store' });
      if (r.ok) setControls(readControls(await r.json()));
    } catch { /* keep the bundled copy */ }
    try {
      const r = await fetch(PENDING, { headers: { Accept: 'application/vnd.github+json' } });
      if (r.ok) setPending(((await r.json()) as PendingChange[]).filter((x) => x.pull_request));
    } catch { /* offline: the list stays unknown */ }
    setLoading(false);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const pausedCount = BOTS.filter((b) => b.workflow && stoppedByOwner(controls, b.id)).length;
  return (
    <div className="space-y-4" dir={getAdminLang() === 'ar' ? 'rtl' : 'ltr'}>
      <div className={`${card} border-amber-300 bg-amber-50`}>
        <div className="flex flex-wrap items-center gap-3">
          <Crown className="h-6 w-6 text-amber-700" />
          <h2 className="text-lg font-black text-stone-900">{T('مركز تحكم صاحب الموقع')}</h2>
          <button type="button" onClick={() => void refresh()} className="ms-auto inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold" disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{T('تحديث')}
          </button>
        </div>
        <p className="mt-2 text-sm text-stone-700">{T('إنت الوحيد اللي معاك الصلاحيات المطلقة. أوامرك فوق شاهين وكل الروبوتات، والموقع بيعرفك بحسابك على GitHub والكود السري بس — مش بالاسم ولا بأي رقم.')}</p>
        <a href={DESK} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-sm font-bold text-white">
          <ExternalLink className="h-4 w-4" />{T('افتح مكتب صاحب الموقع (لإعطاء أمر)')}
        </a>
        <ol className="mt-3 list-decimal space-y-1 ps-5 text-xs text-stone-600">
          <li>{T('هتفتح صفحة المكتب على GitHub وإنت داخل بحسابك.')}</li>
          <li>{T('اضغط «Run workflow» (تشغيل) واختار الأمر، ولو الأمر وقف أو رجوع اختار الروبوت.')}</li>
          <li>{T('اضغط الزرار الأخضر. خلال دقيقة الأمر بيتسجل وكل الروبوتات بتمشي عليه.')}</li>
        </ol>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={card}>
          <div className="text-xs text-stone-500">{T('فرامل الطوارئ')}</div>
          <div className={`mt-1 flex items-center gap-2 font-black ${controls.frozen ? 'text-red-700' : 'text-emerald-700'}`}>
            {controls.frozen ? <ShieldAlert className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            {controls.frozen ? T('شغالة: كل الروبوتات واقفة') : T('مش شغالة: الروبوتات بتشتغل')}
          </div>
          <div className="mt-1 text-[11px] text-stone-500">{T('الموقع نفسه بيفضل شغال للزوار في الحالتين.')}</div>
        </div>
        <div className={card}>
          <div className="text-xs text-stone-500">{T('التطوير الذاتي')}</div>
          <div className="mt-1 font-black text-stone-900">{controls.selfDevelopment === 'safe_auto' ? T('الصغير الآمن تلقائي، والباقي بموافقتك') : T('كل تغيير بيستنى موافقتك')}</div>
          <div className="mt-1 text-[11px] text-stone-500">{TP('صغير = لحد {files} ملفات و{lines} سطر ومن غير ملفات حساسة (الأسعار، الدفع، القانوني، الأمان).', { files: SMALL_CHANGE.files, lines: SMALL_CHANGE.lines })}</div>
        </div>
        <div className={card}>
          <div className="text-xs text-stone-500">{T('روبوتات موقوفة بأمرك')}</div>
          <div className="mt-1 text-2xl font-black text-stone-900">{pausedCount}</div>
          <div className="mt-1 text-[11px] text-stone-500">{TP('آخر أمر: {at}', { at: when(controls.log[0]?.at) })}</div>
        </div>
      </div>

      <div className={card}>
        <h3 className="flex items-center gap-2 font-bold"><GitPullRequest className="h-4 w-4 text-amber-700" />{T('تغييرات مستنية موافقتك')}</h3>
        {pending === null && <p className="mt-2 text-sm text-stone-500">{T('مش قادر أجيب القائمة دلوقتي — افتحها من GitHub.')} <a className="text-amber-700 underline" href={`${REPO}/pulls?q=${encodeURIComponent(`is:open label:"${OWNER_APPROVAL_LABEL}"`)}`} target="_blank" rel="noreferrer">{T('القائمة على GitHub')}</a></p>}
        {pending?.length === 0 && <p className="mt-2 text-sm text-emerald-700">{T('مفيش حاجة مستنياك.')}</p>}
        {pending && pending.length > 0 && (
          <ul className="mt-2 space-y-2">
            {pending.map((p) => (
              <li key={p.number} className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 p-2 text-sm">
                <span className="font-bold">#{p.number}</span><span className="flex-1">{p.title}</span><span className="text-xs text-stone-500">{when(p.created_at)}</span>
                <a className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-stone-950" href={p.html_url} target="_blank" rel="noreferrer">{T('راجع ووافق أو ارفض')}</a>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-stone-500">{T('الموافقة = زرار «Merge» (دمج) في صفحة التغيير، والرفض = «Close» (قفل).')}</p>
      </div>

      <div className={card}>
        <h3 className="font-bold">{T('الروبوتات ومفاتيحها')}</h3>
        <p className="mt-1 text-xs text-stone-500">{T('الروبوتات اللي بتشتغل في نفس التشغيل بتقف وترجع مع بعض.')}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {GROUPS.map(([wf, bots]) => {
            const stopped = bots.some((b) => stoppedByOwner(controls, b.id));
            return (
              <div key={wf} className={`rounded-xl border p-2 text-sm ${stopped ? 'border-red-300 bg-red-50' : 'border-stone-200'}`}>
                <div className="flex items-center gap-2 font-bold">
                  {stopped ? <PauseCircle className="h-4 w-4 text-red-600" /> : <PlayCircle className="h-4 w-4 text-emerald-600" />}
                  {stopped ? T('موقوف بأمرك') : T('شغال')}
                </div>
                <ul className="mt-1 space-y-0.5 text-xs text-stone-700">
                  {bots.map((b) => <li key={b.id}>{name(b)} <code className="text-[10px] text-stone-400">{b.id}</code></li>)}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <div className={card}>
        <h3 className="font-bold">{T('سجل أوامرك')}</h3>
        {controls.log.length === 0 ? <p className="mt-2 text-sm text-stone-500">{T('لسه مفيش أوامر.')}</p> : (
          <ul className="mt-2 space-y-1 text-sm">
            {controls.log.map((x) => <li key={`${x.at}-${x.action}`} className="flex gap-2"><span className="text-xs text-stone-500">{when(x.at)}</span><span className="font-bold">{x.action}</span>{x.target && <span>{name(BOTS.find((b) => b.id === x.target))}</span>}</li>)}
          </ul>
        )}
      </div>

      <details className={card}>
        <summary className="cursor-pointer font-bold">{T('قواعد صاحب الموقع (ملزمة لكل الروبوتات)')}</summary>
        <ul className="mt-2 space-y-1 text-sm text-stone-700" dir="rtl">
          {OWNER_RULES.map((r) => <li key={r.id}><span className="font-bold">{r.id}</span> {r.textAr}</li>)}
        </ul>
      </details>
    </div>
  );
}
