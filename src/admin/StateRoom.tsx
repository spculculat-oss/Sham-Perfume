import { T, TP, adminLocale, getAdminLang } from './adminL10n';
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, ExternalLink, Landmark, Lock, RefreshCw, Send, Trash2 } from 'lucide-react';
import bundledControls from '../data/owner/controls.json';
import bundledOrders from '../data/owner/state-orders.json';
import bundledReport from '../data/live/platform-state.json';
import bundledPrecheck from '../data/live/shaheen-precheck.json';
import { OWNER, OWNER_APPROVAL_LABEL, readControls } from '../utils/ownerAuthority';
import { TASK_APPROVAL_LABEL } from '../utils/ownerDesk';
import { isSealedRoom, openData, sealData } from '../utils/ownerRoom';
import { STATE, readStateOrders, readStateReport, stateActive } from '../utils/platformState';
import {
  STATE_ORDER_ACTIONS, STATE_ROOM_KEY, STATE_ROOM_STARTERS, STATE_ROOM_LIMITS, readStateRoom, stateOrderPlanUrl, stateOrderUrl, stateReply,
  type StateReplyResult, type StateRoomContext, type StateRoomData, type StateRoomMessage,
} from '../utils/stateRoom';

/**
 * «غرفة دولة المنصة» — the owner's private chat with the Platform State. The State answers from its own rules and the
 * platform's latest reports (no outside AI platform, so it answers even when every engine is off). An order it accepts
 * shows «نفّذ»: a request from the owner's own GitHub account, which the State's robot carries out within a minute.
 * The conversation stays on this device only, sealed with the admin code (nothing is sent to any server).
 */
const RAW = `https://raw.githubusercontent.com/${OWNER.repo}/main/src/data`;
const API = `https://api.github.com/repos/${OWNER.repo}/issues?state=open&per_page=50&labels=`;
const card = 'rounded-2xl border border-stone-200 bg-white p-4 shadow-sm';
const when = (iso: string) => new Date(iso).toLocaleString(adminLocale(), { timeStyle: 'short', dateStyle: 'short', timeZone: 'Africa/Cairo' });
const id = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const bundledContext = (): StateRoomContext => ({
  controls: readControls(bundledControls), orders: readStateOrders(bundledOrders), report: readStateReport(bundledReport),
  precheck: bundledPrecheck as StateRoomContext['precheck'],
});

/** The State's words: lines, «**bold**» and list dashes — nothing else is interpreted. */
function Words({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => {
        const parts: ReactNode[] = line.split(/(\*\*[^*]+\*\*)/g).map((p, j) => (p.startsWith('**') && p.endsWith('**') ? <b key={j}>{p.slice(2, -2)}</b> : <Fragment key={j}>{p}</Fragment>));
        return line.trim() ? <div key={i} className={line.startsWith('- ') ? 'ps-3' : ''}>{parts}</div> : <div key={i} className="h-2" />;
      })}
    </>
  );
}

export default function StateRoom({ code }: { code: string }) {
  const [room, setRoom] = useState<StateRoomData>({ version: 1, messages: [] });
  const [ctx, setCtx] = useState<StateRoomContext>(bundledContext);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [locked, setLocked] = useState(false);
  const opened = useRef(false);
  const end = useRef<HTMLDivElement>(null);

  // Open the sealed conversation (only with the admin code; with the map code it lives in this tab only).
  useEffect(() => {
    void (async () => {
      const stored = (() => { try { return JSON.parse(localStorage.getItem(STATE_ROOM_KEY) || 'null'); } catch { return null; } })();
      if (code && isSealedRoom(stored)) {
        const value = await openData(code, stored);
        if (value === undefined) setLocked(true); else setRoom(readStateRoom(value));
      }
      opened.current = true;
    })();
  }, [code]);
  useEffect(() => {
    if (!opened.current || !code || locked) return;
    void sealData(code, room).then((sealed) => localStorage.setItem(STATE_ROOM_KEY, JSON.stringify(sealed))).catch(() => undefined);
  }, [room, code, locked]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [room.messages.length]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const get = async (path: string) => { try { const r = await fetch(`${RAW}/${path}?t=${Date.now()}`, { cache: 'no-store' }); return r.ok ? await r.json() : undefined; } catch { return undefined; } };
    const count = async (labels: string, pulls: boolean) => {
      try { const r = await fetch(`${API}${encodeURIComponent(labels)}`, { headers: { Accept: 'application/vnd.github+json' } }); return r.ok ? ((await r.json()) as { pull_request?: unknown }[]).filter((i) => Boolean(i.pull_request) === pulls).length : undefined; } catch { return undefined; }
    };
    const [controls, orders, report, precheck, pulls, tasks] = await Promise.all([get('owner/controls.json'), get('owner/state-orders.json'), get('live/platform-state.json'), get('live/shaheen-precheck.json'), count(OWNER_APPROVAL_LABEL, true), count(`shaheen-task,${TASK_APPROVAL_LABEL}`, false)]);
    setCtx((c) => ({
      controls: controls ? readControls(controls) : c.controls,
      orders: orders ? readStateOrders(orders) : c.orders,
      report: report ? readStateReport(report) : c.report,
      precheck: (precheck as StateRoomContext['precheck']) || c.precheck,
      ...(pulls !== undefined && tasks !== undefined ? { pending: { pulls, tasks } } : c.pending ? { pending: c.pending } : {}),
    }));
    setLoading(false);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const say = async () => {
    const words = text.trim().slice(0, STATE_ROOM_LIMITS.chars);
    if (!words || thinking) return;
    setText('');
    const at = new Date().toISOString();
    const history = room.messages;
    let answer: StateReplyResult = stateReply(words, ctx, history);
    if (code && (!answer.comprehension?.understood || answer.comprehension.intent === 'clarify')) {
      setThinking(true);
      try {
        const res = await fetch('/api/admin/state-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${code}` },
          body: JSON.stringify({ message: words, context: ctx, history: history.slice(-8), preferAi: true }),
        });
        if (res.ok) {
          const remote = (await res.json()) as StateReplyResult;
          if (remote && typeof remote.text === 'string' && remote.text.trim()) answer = remote;
        }
      } catch { /* Offline or static Pages bundle: local cognitive reply already ready */ }
      setThinking(false);
    }
    const mine: StateRoomMessage = { id: id(), by: 'owner', text: words, at };
    const theirs: StateRoomMessage = {
      id: id(),
      by: 'state',
      text: answer.text,
      at,
      ...(answer.order ? { order: answer.order } : {}),
      ...(answer.orders?.length ? { orders: answer.orders } : {}),
    };
    setRoom((r) => ({ version: 1, messages: [...r.messages, mine, theirs].slice(-STATE_ROOM_LIMITS.messages) }));
  };
  const send = (m: StateRoomMessage) => {
    if (!m.order && !m.orders?.length) return;
    const url = m.orders && m.orders.length > 1 ? stateOrderPlanUrl(m.orders) : stateOrderUrl(m.order || m.orders![0]);
    window.open(url, '_blank', 'noopener');
    setRoom((r) => ({ version: 1, messages: r.messages.map((x) => (x.id === m.id ? { ...x, sent: true } : x)) }));
  };
  const clear = () => {
    if (!window.confirm(T('هتمسح كلام الغرفة من الجهاز ده. متأكد؟'))) return;
    setRoom({ version: 1, messages: [] }); setLocked(false); localStorage.removeItem(STATE_ROOM_KEY);
  };

  const active = stateActive(ctx.controls);
  return (
    <div className="space-y-4" dir={getAdminLang() === 'ar' ? 'rtl' : 'ltr'}>
      <div className={`${card} border-sky-300 bg-sky-50`}>
        <div className="flex flex-wrap items-center gap-3">
          <Landmark className="h-6 w-6 text-sky-700" />
          <h2 className="text-lg font-black text-stone-900">{T('غرفة دولة المنصة')}</h2>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${active ? 'bg-sky-600 text-white' : 'bg-stone-300 text-stone-800'}`}>{active ? T('ماسكة كل الموافقات') : T('واقفة')}</span>
          <button type="button" onClick={() => void refresh()} className="ms-auto inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold" disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{T('تحديث')}
          </button>
        </div>
        <p className="mt-2 text-sm text-stone-700">{T('ناقش الدولة في الأوامر والمستجدات وقوانين المنصة. الدولة بتشوف كل أمر الأول: لو صح من وجهة نظرها بتجهزه وبتنفذه بنفسها، ولو لأ بتقولك ليه.')}</p>
        <p className="mt-1 flex items-center gap-1 text-[11px] text-stone-500"><Lock className="h-3 w-3" />{code ? T('الكلام متشفر على الجهاز ده بالكود السري، ومش بيتبعت لأي سيرفر.') : T('داخل بكود الخريطة: الكلام هيفضل في الصفحة دي بس ومش هيتحفظ.')}</p>
      </div>

      {locked && <div className={`${card} border-amber-300 bg-amber-50 text-sm`}>{T('فيه كلام قديم متشفر بكود تاني. ادخل بالكود اللي كان شغال، أو امسح الغرفة وابدأ من جديد.')}</div>}

      <div className={`${card} min-h-[18rem]`}>
        {room.messages.length === 0 && (
          <div className="text-sm text-stone-500">
            <p>{T('ابدأ بسؤال، مثلاً:')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STATE_ROOM_STARTERS.map((q) => (
                <button key={q} type="button" onClick={() => setText(q)} className="rounded-full border border-sky-300 px-3 py-1 text-xs text-sky-800">{q}</button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-3">
          {room.messages.map((m) => (
            <div key={m.id} className={`max-w-[92%] rounded-2xl p-3 text-sm ${m.by === 'owner' ? 'ms-auto bg-amber-100 text-stone-900' : 'bg-sky-50 text-stone-800'}`}>
              <div className="mb-1 flex items-center gap-2 text-[11px] text-stone-500">
                {m.by === 'owner' ? T('إنت') : (getAdminLang() === 'ar' ? STATE.nameAr : STATE.nameEn)}<span>· {when(m.at)}</span>
              </div>
              <Words text={m.text} />
              {m.order && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-sky-300 bg-white p-2">
                  <span className="text-xs font-bold text-sky-900">🏛️ {m.orders && m.orders.length > 1 ? TP('خطة تنفيذ ({n} أوامر)', { n: m.orders.length }) : STATE_ORDER_ACTIONS[m.order.action]}</span>
                  {m.sent ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />{T('اتبعت — الدولة هتنفذه خلال دقيقة وترد على الطلب')}</span>
                  ) : (
                    <button type="button" onClick={() => send(m)} className="inline-flex items-center gap-1 rounded-lg bg-sky-700 px-3 py-1 text-xs font-bold text-white">
                      <ExternalLink className="h-3.5 w-3.5" />{T('نفّذ')}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {thinking && <div className="text-xs text-sky-700">{T('الوكيل يفهم الأمر…')}</div>}
          <div ref={end} />
        </div>
      </div>
      <p className="text-[11px] text-stone-500">{T('«نفّذ» بيفتح صفحة على GitHub من حسابك علشان GitHub يتأكد إن الأمر منك — اضغط فيها «Submit new issue» (إنشاء الطلب)، والدولة بتكمل لوحدها.')}</p>

      <div className="flex gap-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void say(); } }}
          rows={2} maxLength={STATE_ROOM_LIMITS.chars} placeholder={T('اكتب للدولة بأسلوبك العادي… (أمر واحد أو عدة أوامر معاً: وقف الأخبار وشغّل الدورية، أو اعمل مهمة: …)')}
          className="flex-1 resize-none rounded-xl border border-stone-300 bg-white p-2 text-sm text-stone-900" />
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => void say()} disabled={thinking} className="inline-flex items-center gap-1 rounded-xl bg-stone-900 px-4 py-2 text-sm font-bold text-white"><Send className="h-4 w-4" />{T('ابعت')}</button>
          <button type="button" onClick={clear} className="inline-flex items-center gap-1 rounded-xl border border-stone-300 px-2 py-1 text-xs text-stone-600"><Trash2 className="h-3.5 w-3.5" />{T('امسح')}</button>
        </div>
      </div>
    </div>
  );
}
