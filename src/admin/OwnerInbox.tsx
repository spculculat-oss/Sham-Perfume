import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, GitPullRequest, History, ListTodo, Loader2, MessagesSquare, RefreshCw, RotateCcw, Undo2, XCircle } from 'lucide-react';
import { T, TP, adminLocale } from './adminL10n';
import { sendDeskRequest } from './deskRequest';
import bundledControls from '../data/owner/controls.json';
import { OWNER, readControls } from '../utils/ownerAuthority';
import { stateActive } from '../utils/platformState';
import { parseChanges } from '../utils/ownerFiles';
import { decideDraft, deskLog, inboxFrom, inboxUrls, logUrl, parseOrders, revertDraft, type Decision, type GhIssue, type InboxItem, type LogItem } from '../utils/ownerDesk';
import { isSealedRoom, openRoom, ROOM_STORAGE_KEY } from '../utils/ownerRoom';

/**
 * «صندوق الموافقات» — everything Shaheen and the robots prepared that waits for the owner, his answers, and the log of
 * every request with «رجّع». Read from the public repository (no key); every answer is a request he opens on GitHub.
 */
const card = 'rounded-2xl border border-stone-800 bg-stone-900/70 p-4';
const SENT_KEY = 'sham_owner_inbox_sent';
const day = (iso: string) => (Date.parse(iso) > 0 ? new Date(iso).toLocaleDateString(adminLocale(), { dateStyle: 'medium', timeZone: 'Africa/Cairo' }) : '');
const readSent = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(SENT_KEY) || '{}') as Record<string, string>; } catch { return {}; } };

async function getIssues(url: string): Promise<GhIssue[]> {
  const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
  if (!res.ok) throw new Error(String(res.status));
  return await res.json() as GhIssue[];
}

/** Proposals in the private room the owner has not answered yet (the room opens with his code, on this device). */
async function roomWaiting(code: string): Promise<number> {
  try {
    const sealed = JSON.parse(localStorage.getItem(ROOM_STORAGE_KEY) || 'null');
    const room = code && isSealedRoom(sealed) ? await openRoom(code, sealed) : undefined;
    if (!room) return 0;
    let n = 0;
    for (const m of room.messages) {
      if (m.by !== 'shaheen') continue;
      if (parseChanges(m.text).length && !room.decisions?.[m.id]) n++;
      parseOrders(m.text).forEach((_o, i) => { if (!room.decisions?.[`${m.id}:order:${i}`]) n++; });
    }
    return n;
  } catch { return 0; }
}

export default function OwnerInbox({ code, onRoom }: { code: string; onRoom?: () => void }) {
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [log, setLog] = useState<LogItem[]>([]);
  const [waiting, setWaiting] = useState(0);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<Record<string, string>>(readSent);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [a, b] = await Promise.all(inboxUrls().map(getIssues));
      setItems(inboxFrom([...a!, ...b!]));
      setLog(deskLog(await getIssues(logUrl()), OWNER.github));
    } catch { setError(T('مش قادر أوصل لـ GitHub دلوقتي (أو اتعمل طلبات كتير في الساعة دي). جرب تاني بعد شوية.')); setItems((x) => x || []); }
    finally { setLoading(false); }
    setWaiting(await roomWaiting(code));
  }, [code]);
  useEffect(() => { void load(); }, [load]);

  const mark = (key: string, value: string) => {
    const next = { ...readSent(), [key]: value };
    try { localStorage.setItem(SENT_KEY, JSON.stringify(next)); } catch { /* full */ }
    setSent(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-stone-400">{T('شاهين بيجهّز كل حاجة، ومفيش حاجة بتتنفذ غير لما توافق هنا. كل موافقة بتفتح صفحة على GitHub من حسابك — اضغط فيها (Submit new issue = إنشاء الطلب).')}</p>
        <button type="button" onClick={() => void load()} disabled={loading} className="ms-auto inline-flex items-center gap-1 rounded-lg border border-stone-700 px-2 py-1 text-xs text-stone-300 disabled:opacity-40">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{T('حدّث')}
        </button>
      </div>
      {stateActive(readControls(bundledControls)) && (
        <p className="rounded-xl border border-sky-800 bg-sky-950/50 p-2 text-xs text-sky-100">{T('🏛️ دولة المنصة ماسكة كل الموافقات وبتقرر فيها بنفسها كل ساعة، ومابترجعلكش. اللي هنا للاطلاع — ولو حبيت ترد على حاجة قبلها، ردك هو اللي يمشي.')}</p>
      )}
      {error && <p role="alert" className="rounded-xl bg-red-950 p-2 text-xs text-red-200">{error}</p>}

      {waiting > 0 && (
        <div className={`${card} flex flex-wrap items-center gap-3 border-amber-800`}>
          <MessagesSquare className="h-5 w-5 text-amber-400" />
          <div className="text-sm text-amber-100">{TP('شاهين جهّزلك {n} اقتراح في الغرفة مستني رأيك', { n: waiting })}</div>
          {onRoom && <button type="button" onClick={onRoom} className="ms-auto rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-stone-950">{T('افتح الغرفة')}</button>}
        </div>
      )}

      <section className={card}>
        <h2 className="mb-3 flex items-center gap-2 font-bold text-amber-100"><CheckCircle2 className="h-4 w-4 text-amber-400" />{T('مستني موافقتك')}</h2>
        {items === null ? <div className="flex items-center gap-2 text-xs text-stone-400"><Loader2 className="h-3.5 w-3.5 animate-spin" />{T('بجيب اللي مستني رأيك…')}</div>
          : !items.length ? <p className="text-xs text-stone-400">{T('مفيش حاجة مستنية موافقتك دلوقتي ✅')}</p>
            : <div className="space-y-3">{items.map((it) => <InboxCard key={it.number} item={it} sent={sent[String(it.number)]} onSent={(d) => mark(String(it.number), d)} />)}</div>}
      </section>

      <section className={card}>
        <h2 className="mb-1 flex items-center gap-2 font-bold text-stone-100"><History className="h-4 w-4 text-stone-400" />{T('سجل طلباتك')}</h2>
        <p className="mb-3 text-[11px] text-stone-500">{T('كل حاجة وافقت عليها أو رفضتها. لو حاجة اتنفذت ومش عاجباك اضغط «رجّع».')}</p>
        {!log.length ? <p className="text-xs text-stone-400">{T('لسه مفيش طلبات.')}</p> : (
          <ul className="divide-y divide-stone-800 text-xs">
            {log.slice(0, 25).map((l) => (
              <li key={l.number} className="flex flex-wrap items-center gap-2 py-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${l.state === 'done' ? 'bg-emerald-950 text-emerald-200' : l.state === 'refused' ? 'bg-red-950 text-red-200' : 'bg-amber-950 text-amber-200'}`}>
                  {l.state === 'done' ? T('اتنفذ') : l.state === 'refused' ? T('ماتنفذش') : T('بيتنفذ')}
                </span>
                <a href={l.url} target="_blank" rel="noreferrer" className="text-stone-200 hover:underline">#{l.number} {l.title}</a>
                <span className="text-stone-500">{day(l.at)}</span>
                {l.state === 'done' && l.undoable && (sent[`revert:${l.number}`]
                  ? <span className="ms-auto text-emerald-300">{T('طلب الرجوع اتبعت')}</span>
                  : <button type="button" className="ms-auto inline-flex items-center gap-1 rounded-lg border border-stone-700 px-2 py-0.5 text-stone-300 hover:border-red-700 hover:text-red-200"
                    onClick={async () => {
                      if (!window.confirm(TP('هرجّع كل اللي غيّره الطلب #{n}، بعد ما الفحوص تعدّي. متأكد؟', { n: l.number }))) return;
                      await sendDeskRequest(revertDraft(l));
                      mark(`revert:${l.number}`, 'sent');
                    }}><RotateCcw className="h-3 w-3" />{T('رجّع')}</button>)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function InboxCard({ item, sent, onSent }: { item: InboxItem; sent?: string; onSent: (d: Decision) => void }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const decide = async (decision: Decision) => {
    if (decision === 'return' && !note.trim()) { setNoteOpen(true); return; }
    setBusy(true); setMsg('');
    try {
      setMsg(await sendDeskRequest(decideDraft(item, decision, note)));
      onSent(decision);
    } catch { setMsg(T('مقدرتش أجهز الطلب على الجهاز ده — جرب من متصفح تاني.')); }
    finally { setBusy(false); }
  };
  return (
    <div className="rounded-xl border border-stone-800 bg-stone-950/70 p-3 text-xs">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        {item.kind === 'pull' ? <GitPullRequest className="h-4 w-4 text-violet-300" /> : <ListTodo className="h-4 w-4 text-sky-300" />}
        <span className="rounded-full border border-stone-700 px-2 py-0.5 text-[10px] text-stone-300">{item.kind === 'pull' ? T('تعديل جاهز من روبوت') : T('مهمة من المجلس')}</span>
        {item.stateRefused && <span className="rounded-full border border-red-700 bg-red-950/50 px-2 py-0.5 text-[10px] text-red-200">{T('رفضته دولة المنصة — القرار ليك')}</span>}
        <b className="text-sm text-stone-100">{item.title}</b>
      </div>
      {item.summary && <p className="mb-2 text-stone-400">{item.summary}</p>}
      <a href={item.url} target="_blank" rel="noreferrer" className="mb-2 inline-flex items-center gap-1 text-amber-300 underline"><ExternalLink className="h-3 w-3" />{T('وريني التفاصيل')}</a>
      {sent ? (
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/60 p-2 text-emerald-100">
          {sent === 'approve' ? T('✅ وافقت — المكتب هيشغل كل الفحوص وينفذ، ويرد عليك على GitHub.') : sent === 'reject' ? T('❌ رفضت — هيتقفل من غير ما يتنفذ.') : T('↩️ رجعته لشاهين بملاحظتك.')}
          <span className="block text-[11px] text-emerald-300/80">{T('لو صفحة GitHub اتقفلت قبل ما تضغط (Submit new issue)، الطلب مااتبعتش — افتح الكارت ده تاني بعد التحديث.')}</span>
        </div>
      ) : (
        <>
          {noteOpen && <textarea className="mb-2 w-full rounded-lg border border-stone-700 bg-stone-950 px-2 py-1 text-stone-100" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
            maxLength={1000} placeholder={T('ملاحظتك لشاهين…')} aria-label={T('ملاحظتك لشاهين…')} />}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void decide('approve')} className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 font-bold text-stone-950 disabled:opacity-40">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{T('وافق')}
            </button>
            <button type="button" disabled={busy} onClick={() => void decide('reject')} className="inline-flex items-center gap-1 rounded-lg border border-stone-700 px-3 py-1.5 text-stone-300"><XCircle className="h-3.5 w-3.5" />{T('ارفض')}</button>
            <button type="button" disabled={busy || (noteOpen && !note.trim())} onClick={() => void decide('return')} className="inline-flex items-center gap-1 rounded-lg border border-stone-700 px-3 py-1.5 text-stone-300 disabled:opacity-40">
              <Undo2 className="h-3.5 w-3.5" />{noteOpen ? T('ابعت الملاحظة') : T('رجّعه بملاحظة')}
            </button>
          </div>
        </>
      )}
      {msg && <p className="mt-2 text-[11px] text-amber-200">{msg}</p>}
    </div>
  );
}
