import { T, TP, adminLocale, getAdminLang } from './adminL10n';
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Landmark, RefreshCw, Undo2 } from 'lucide-react';
import bundledControls from '../data/owner/controls.json';
import bundledReport from '../data/live/platform-state.json';
import bundledOrders from '../data/owner/state-orders.json';
import { BOTS } from '../utils/shaheenOrg';
import { OWNER, readControls, type OwnerControls } from '../utils/ownerAuthority';
import { STATE, STATE_CONSTITUTION, STATE_MEMBERS, STATE_OUTCOMES, readStateOrders, readStateReport, stateActive, type StateOrders, type StateRecord, type StateReport } from '../utils/platformState';
import { revertDraft } from '../utils/ownerDesk';
import { sendDeskRequest } from './deskRequest';
import ManeuverFieldCard from './ManeuverFieldCard';

/**
 * «دولة المنصة» in the owner's suite: whether it holds the approvals right now, its members and constitution, what it
 * sees of the robots, and its decisions — each one with «رجّع» (a request from the owner's own account to his desk:
 * the owner is above the State). Nothing here changes the State by itself: the switch is on his desk.
 */
const REPO = `https://github.com/${OWNER.repo}`;
const DESK = `${REPO}/actions/workflows/owner-control.yml`;
const RAW = `https://raw.githubusercontent.com/${OWNER.repo}/main/src/data`;
const card = 'rounded-2xl border border-stone-200 bg-white p-4 shadow-sm';
const when = (iso?: string) => (iso && Date.parse(iso) > 0 ? new Date(iso).toLocaleString(adminLocale(), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }) : '—');
const MARK: Record<StateRecord['outcome'], string> = { merged: '✅', approved: '✅', refused: '❌', failed: '⚠️' };

export default function PlatformStatePanel() {
  const [controls, setControls] = useState<OwnerControls>(() => readControls(bundledControls));
  const [report, setReport] = useState<StateReport>(() => readStateReport(bundledReport));
  const [orders, setOrders] = useState<StateOrders>(() => readStateOrders(bundledOrders));
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch(`${RAW}/owner/controls.json?t=${Date.now()}`, { cache: 'no-store' }); if (r.ok) setControls(readControls(await r.json())); } catch { /* bundled copy */ }
    try { const r = await fetch(`${RAW}/live/platform-state.json?t=${Date.now()}`, { cache: 'no-store' }); if (r.ok) setReport(readStateReport(await r.json())); } catch { /* bundled copy */ }
    try { const r = await fetch(`${RAW}/owner/state-orders.json?t=${Date.now()}`, { cache: 'no-store' }); if (r.ok) setOrders(readStateOrders(await r.json())); } catch { /* bundled copy */ }
    setLoading(false);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const active = stateActive(controls);
  const undo = async (d: StateRecord) => {
    if (!window.confirm(TP('هرجّع كل اللي غيّره الطلب #{n}، بعد ما الفحوص تعدّي. متأكد؟', { n: d.number }))) return;
    try { setNote(await sendDeskRequest(revertDraft({ number: d.number, title: d.title })) || T('اتفتح طلب الرجوع على GitHub — اضغط (Submit new issue = إنشاء الطلب).')); }
    catch { setNote(T('مقدرتش أجهز الطلب على الجهاز ده — جرب من متصفح تاني.')); }
  };
  return (
    <div className="space-y-4" dir={getAdminLang() === 'ar' ? 'rtl' : 'ltr'}>
      <div className={`${card} ${active ? 'border-sky-300 bg-sky-50' : 'border-stone-300 bg-stone-50'}`}>
        <div className="flex flex-wrap items-center gap-3">
          <Landmark className="h-6 w-6 text-sky-700" />
          <h2 className="text-lg font-black text-stone-900">{getAdminLang() === 'ar' ? STATE.nameAr : STATE.nameEn}</h2>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${active ? 'bg-sky-600 text-white' : 'bg-stone-300 text-stone-800'}`}>{active ? T('ماسكة الموافقات') : T('واقفة')}</span>
          <button type="button" onClick={() => void refresh()} className="ms-auto inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold" disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{T('تحديث')}
          </button>
        </div>
        <p className="mt-2 text-sm text-stone-700">
          {active ? T('أعلى سلطة بعدك: كل العاملين في المنصة وأولهم شاهين خاضعين لقوانينها وبياخدوا منها كل الموافقات. أعضاؤها بيصوّتوا كل ساعة، واللي يتوافق عليه بيعدّي كل الفحوص وينزل، واللي يترفض بتقفله بنفسها — مابترجعلكش في أي إجراء.')
            : controls.frozen ? T('واقفة مع كل الروبوتات (فرامل الطوارئ شغالة).') : T('إنت ماسك الموافقات بنفسك دلوقتي، فالدولة مش بتقرر حاجة.')}
        </p>
        <p className="mt-2 text-xs text-stone-600">{T('إنت فوقها في أي وقت: ترجّع أي قرار ليها، أو ترجّع روبوت هي وقفته من مكتبك، أو تسحب منها الموافقات (approve_all = كل حاجة بموافقتي، state_rule = الدولة توافق).')}</p>
        <p className="mt-1 text-xs text-stone-600">{T('مابتشوفش بياناتك الشخصية ولا مفاتيحك ولا غرفتك الخاصة، ومابتلمسش مفاتيح التحكم بتاعتك.')}</p>
        <a href={DESK} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-sm font-bold text-white">
          <ExternalLink className="h-4 w-4" />{T('افتح مكتب صاحب الموقع (لإعطاء أمر)')}
        </a>
      </div>

      <div className={card}>
        <h3 className="font-bold">{T('قرارات الدولة')}</h3>
        <p className="mt-1 text-xs text-stone-500">{TP('آخر تحديث: {at}', { at: when(report.updatedAt) })}</p>
        {note && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{note}</p>}
        {report.decisions.length === 0 ? <p className="mt-2 text-sm text-stone-500">{T('لسه مفيش قرارات.')}</p> : (
          <ul className="mt-2 space-y-2">
            {report.decisions.map((d) => (
              <li key={`${d.number}-${d.at}`} className="rounded-xl border border-stone-200 p-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{MARK[d.outcome]}</span>
                  <a className="font-bold text-sky-800 underline" href={d.url || `${REPO}/issues/${d.number}`} target="_blank" rel="noreferrer">#{d.number}</a>
                  <span className="flex-1">{d.title}</span>
                  <span className="text-xs text-stone-500">{when(d.at)}</span>
                </div>
                <div className="mt-1 text-xs text-stone-600">{d.kind === 'pull' ? T('تعديل من روبوت') : T('مهمة من المجلس')} · {getAdminLang() === 'ar' ? STATE_OUTCOMES[d.outcome] : d.outcome} · {TP('{a} موافقة، {r} رفض، {v} فيتو', { a: d.tally.approve, r: d.tally.refuse, v: d.tally.veto })}</div>
                <div className="mt-1 text-xs text-stone-700">{d.summaryAr}</div>
                {d.outcome === 'merged' && (
                  <button type="button" onClick={() => void undo(d)} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-red-300 px-2 py-1 text-xs font-bold text-red-700">
                    <Undo2 className="h-3.5 w-3.5" />{T('رجّع')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ManeuverFieldCard field={report.field} />

      <div className={card}>
        <h3 className="font-bold">{T('الأعضاء (كل واحد بيصوّت لوحده في نطاقه)')}</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {STATE_MEMBERS.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2">
              <span className="font-bold">{m.nameAr}</span>
              {m.veto && <span className="rounded bg-red-100 px-1.5 text-[11px] font-bold text-red-700">{T('فيتو')}</span>}
              <span className="text-xs text-stone-500">{m.scopeAr}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-stone-500">{T('القرار بالتوافق: لازم 3 موافقات على الأقل ومن غير أي اعتراض، ولو عضو واحد رفض الدولة بتقفل الموضوع.')}</p>
      </div>

      <div className={card}>
        <h3 className="font-bold">{T('رقابة الدولة على الروبوتات')}</h3>
        <p className="mt-1 text-sm">{typeof report.supervision.health === 'number' ? TP('صحة الأدوات {h}%', { h: report.supervision.health }) : T('لسه مفيش قياس.')}</p>
        {report.supervision.problems.length > 0 && <ul className="mt-1 list-disc ps-5 text-xs text-stone-600">{report.supervision.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
      </div>

      <div className={card}>
        <h3 className="font-bold">{T('أوامر الدولة')}</h3>
        <p className="mt-1 text-sm">{orders.paused.length ? TP('واقف بأمرها: {list}', { list: orders.paused.map((id) => BOTS.find((b) => b.id === id)?.nameAr ?? id).join('، ') }) : T('مفيش روبوت واقف بأمرها.')}</p>
        {orders.log.length > 0 && <ul className="mt-2 space-y-1 text-xs text-stone-700">{orders.log.slice(0, 12).map((e) => <li key={`${e.at}-${e.action}-${e.target}`}><span className="text-stone-500">{when(e.at)}</span> — {e.noteAr}</li>)}</ul>}
      </div>

      <div className={card}>
        <h3 className="font-bold">{T('قوانين المنصة')}</h3>
        {orders.laws.length ? <ul className="mt-2 space-y-1 text-sm">{orders.laws.map((l) => <li key={l.id}><b>{l.id}</b> — {l.textAr}</li>)}</ul> : <p className="mt-1 text-sm text-stone-500">{T('لسه مفيش قوانين مضافة — ضيفها من غرفة الدولة.')}</p>}
      </div>

      <details className={card}>
        <summary className="cursor-pointer font-bold">{T('دستور الدولة')}</summary>
        <ul className="mt-2 space-y-1 text-sm">{STATE_CONSTITUTION.map((r) => <li key={r.id}><b>{r.id}</b> — {r.textAr}</li>)}</ul>
      </details>
    </div>
  );
}
