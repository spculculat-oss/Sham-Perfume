import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckSquare, Crown, Download, FolderOpen, Loader2, Lock, NotebookPen, Paperclip, Send, Square, Trash2, Upload, X } from 'lucide-react';
import { T, TP, adminLocale } from './adminL10n';
import { AdminApiError, adminRequest, send } from './adminApi';
import { ShaheenMarkdown } from '../components/ShaheenMarkdown';
import { hasSensitiveNumber, maskSensitive } from '../utils/ownerAuthority';
import ChangeCard from './ChangeCard';
import OrderCard from './OrderCard';
import { displayOrders, parseOrders } from '../utils/ownerDesk';
import { repoFiles, repoTree } from './repoFiles';
import { FILE_LIMITS, changeSummary, displayReply, fileIndex, isReadablePath, mentionedFiles, parseChanges, readRequests } from '../utils/ownerFiles';
import {
  emptyRoom, isSealedRoom, openRoom, roomHistory, ROOM_LIMITS, ROOM_STORAGE_KEY, sealRoom, secretaryNotes,
  type ChangeDecision, type RoomData, type RoomMessage, type RoomSpeaker, type SealedRoom,
} from '../utils/ownerRoom';

/**
 * «غرفة شاهين الخاصة» — the owner, Shaheen and the secretary, nobody else. The room lives sealed in this browser
 * (AES-GCM, key from the admin code); the server answers and forgets. See src/utils/ownerRoom.ts.
 */
const card = 'rounded-2xl border border-stone-800 bg-stone-900/70 p-4';
const uid = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const now = () => new Date().toISOString();
const time = (iso: string) => (Date.parse(iso) > 0 ? new Date(iso).toLocaleString(adminLocale(), { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Cairo' }) : '');

const WHO: Record<RoomSpeaker, { name: () => string; icon: string; bubble: string }> = {
  owner: { name: () => T('أنت'), icon: '👑', bubble: 'bg-amber-500 text-stone-950 ms-auto' },
  shaheen: { name: () => T('شاهين'), icon: '🦅', bubble: 'bg-stone-800 text-stone-100 border border-stone-700' },
  secretary: { name: () => T('السكرتير'), icon: '📒', bubble: 'bg-emerald-950 text-emerald-50 border border-emerald-800' },
};

/** A reply from Shaheen or the secretary: the text, and a card for every change or order Shaheen prepared. */
function ReplyBody({ m, decisions, onDecide, onReturn }: {
  m: RoomMessage; decisions?: Record<string, ChangeDecision>; onDecide: (key: string, d: ChangeDecision) => void; onReturn: (key: string) => void;
}) {
  const edits = useMemo(() => (m.by === 'shaheen' ? parseChanges(m.text) : []), [m.by, m.text]);
  const orders = useMemo(() => (m.by === 'shaheen' ? parseOrders(m.text) : []), [m.by, m.text]);
  const summary = useMemo(() => changeSummary(m.text), [m.text]);
  return (
    <>
      <ShaheenMarkdown text={m.by === 'shaheen' ? displayOrders(displayReply(m.text)) : m.text} />
      {edits.length > 0 && <ChangeCard edits={edits} summary={summary} decision={decisions?.[m.id]} onDecide={(d) => onDecide(m.id, d)} onReturn={() => onReturn(m.id)} />}
      {orders.map((o, i) => {
        const key = `${m.id}:order:${i}`;
        return <OrderCard key={key} order={o} summary={summary} decision={decisions?.[key]} onDecide={(d) => onDecide(key, d)} onReturn={() => onReturn(key)} />;
      })}
    </>
  );
}

function readSealed(): SealedRoom | undefined {
  try { const raw = localStorage.getItem(ROOM_STORAGE_KEY); const x = raw ? JSON.parse(raw) : undefined; return isSealedRoom(x) ? x : undefined; } catch { return undefined; }
}

export default function OwnerRoom({ code }: { code: string }) {
  const [room, setRoom] = useState<RoomData | null>(null);
  const [locked, setLocked] = useState<SealedRoom | null>(null);
  const [oldCode, setOldCode] = useState('');
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'' | 'shaheen' | 'secretary'>('');
  const [reading, setReading] = useState<string[]>([]);
  const [tree, setTree] = useState<string[]>([]);
  const [attached, setAttached] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [pick, setPick] = useState('');
  const [error, setError] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);

  // Open the room sealed in this browser with the owner's code.
  useEffect(() => {
    let alive = true;
    const sealed = readSealed();
    if (!sealed) { setRoom(emptyRoom()); return; }
    void openRoom(code, sealed).then((r) => { if (!alive) return; if (r) setRoom(r); else setLocked(sealed); });
    return () => { alive = false; };
  }, [code]);

  // Every change is sealed again (fresh salt and IV) and kept only here.
  const save = useCallback(async (next: RoomData) => {
    setRoom(next);
    try { localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(await sealRoom(code, next))); }
    catch { setError(T('مش قادر أحفظ الغرفة على الجهاز ده (المساحة أو وضع التصفح الخاص).')); }
  }, [code]);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [room?.messages.length, busy]);
  // The list of the site's files, so Shaheen knows what exists and can ask for any of them.
  useEffect(() => { let alive = true; void repoTree().then((t) => { if (alive) setTree(t); }); return () => { alive = false; }; }, []);

  const ask = async (to: 'shaheen' | 'secretary', base: RoomData, files: string[] = []) => {
    setBusy(to); setError('');
    try {
      type Answer = { reply: string; by: 'shaheen' | 'secretary'; offline?: boolean };
      const index = to === 'shaheen' && tree.length ? fileIndex(tree) : undefined;
      const history = roomHistory(base.messages);
      let shown = to === 'shaheen' ? await repoFiles(files) : [];
      let answer = await adminRequest<Answer>('/owner-room', send('POST', { to, history, ...(index ? { index } : {}), ...(shown.length ? { files: shown } : {}) }));
      // «شاهين يشوف كل الملفات»: when he asks for files, the room fetches them and asks him again (twice at most).
      for (let round = 0; to === 'shaheen' && !answer.offline && round < FILE_LIMITS.reads; round++) {
        const wanted = readRequests(answer.reply).filter((p) => isReadablePath(p) && (!tree.length || tree.includes(p)));
        if (!wanted.length) break;
        setReading(wanted);
        shown = [...shown.filter((f) => !wanted.includes(f.path)), ...(await repoFiles(wanted))].slice(-FILE_LIMITS.files);
        const missing = wanted.filter((p) => !shown.some((f) => f.path === p));
        const followUp = [`📂 دي الملفات اللي طلبتها: ${shown.map((f) => f.path).join('، ') || 'مفيش'}.`,
          missing.length ? `مقدرتش أجيب: ${missing.join('، ')} (مش موجودة أو مش ملف نص).` : '', 'كمل ردك عليّا من غير ما تطلب نفس الملفات تاني.'].filter(Boolean).join(' ');
        answer = await adminRequest<Answer>('/owner-room', send('POST', {
          to, ...(index ? { index } : {}), ...(shown.length ? { files: shown } : {}),
          history: [...history, { by: 'shaheen', text: answer.reply.slice(0, ROOM_LIMITS.chars) }, { by: 'owner', text: followUp }].slice(-ROOM_LIMITS.history),
        }));
      }
      const msg: RoomMessage = { id: uid(), by: answer.by, text: answer.reply, at: now(), ...(answer.offline ? { offline: true } : {}) };
      await save({ ...base, messages: [...base.messages, msg].slice(-ROOM_LIMITS.messages) });
    } catch (e) {
      setError(e instanceof AdminApiError && e.status === 401 ? T('الكود السري اتغير أو الجلسة خلصت — اقفل الجناح وادخل تاني.')
        : e instanceof AdminApiError && e.status === 429 ? T('رسايل كتير ورا بعض — استنى دقيقة.')
          : T('مش قادر أوصل لشاهين دلوقتي. رسالتك محفوظة في الغرفة، جرب تاني بعد شوية.'));
    } finally { setBusy(''); setReading([]); }
  };

  const submit = async () => {
    const raw = text.trim();
    if (!raw || !room || busy) return;
    if (raw.length > ROOM_LIMITS.chars) { setError(TP('الرسالة طويلة — {n} حرف بالكتير.', { n: ROOM_LIMITS.chars })); return; }
    const sensitive = hasSensitiveNumber(raw);
    const msg: RoomMessage = { id: uid(), by: 'owner', text: sensitive ? maskSensitive(raw) : raw, at: now() };
    const next = { ...room, messages: [...room.messages, msg].slice(-ROOM_LIMITS.messages) };
    setText('');
    await save(next);
    if (sensitive) setError(T('🔒 خبّيت رقم شكله رقم بطاقة أو حساب من رسالتك. ماتكتبش أرقام زي دي حتى هنا.'));
    const files = [...new Set([...attached, ...mentionedFiles(raw, tree)])].slice(0, FILE_LIMITS.files);
    setAttached([]);
    await ask('shaheen', next, files);
  };

  const notes = useMemo(() => secretaryNotes(room?.messages || []), [room?.messages]);
  const decide = (key: string, d: ChangeDecision) => { if (room) void save({ ...room, decisions: { ...room.decisions, [key]: d } }); };
  // «رجّعه بملاحظة»: the proposal is set aside and the owner writes his note to Shaheen right away.
  const returnWithNote = (key: string) => {
    decide(key, 'returned');
    setText((t) => t || T('ملاحظتي على اقتراحك: '));
    setTimeout(() => input.current?.focus(), 0);
  };
  const matches = useMemo(() => {
    const q = pick.trim().toLowerCase();
    return q.length < 2 ? [] : tree.filter((p) => isReadablePath(p) && p.toLowerCase().includes(q) && !attached.includes(p)).slice(0, 8);
  }, [pick, tree, attached]);

  const exportRoom = () => {
    const sealed = readSealed();
    if (!sealed) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(sealed)], { type: 'application/json' }));
    a.download = `sham-owner-room-${new Date().toISOString().slice(0, 10)}.sealed.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importRoom = async (f?: File) => {
    if (!f) return;
    try {
      const sealed = JSON.parse(await f.text());
      const opened = isSealedRoom(sealed) ? await openRoom(code, sealed) : undefined;
      if (!opened) { setError(T('الملف ده مش متشفر بالكود الحالي، أو مش ملف غرفة.')); return; }
      await save(opened);
    } catch { setError(T('الملف ده مش ملف غرفة.')); }
  };

  if (locked) {
    return (
      <div className={`${card} max-w-lg space-y-3`}>
        <h3 className="flex items-center gap-2 font-bold text-amber-200"><Lock className="h-4 w-4" />{T('الغرفة متشفرة بكود قديم')}</h3>
        <p className="text-sm text-stone-300">{T('السجل اللي على الجهاز ده اتقفل بالكود السري القديم. اكتب الكود القديم مرة واحدة علشان أفتحه وأقفله بالكود الجديد، أو ابدأ غرفة جديدة.')}</p>
        <input type="password" dir="ltr" className="w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100" value={oldCode} onChange={(e) => setOldCode(e.target.value)} aria-label={T('الكود القديم')} placeholder={T('الكود القديم')} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-stone-950" onClick={async () => { const r = await openRoom(oldCode, locked); if (r) { setLocked(null); setOldCode(''); await save(r); } else setError(T('الكود ده كمان مش بيفتحها.')); }}>{T('افتح وانقل للكود الجديد')}</button>
          <button type="button" className="rounded-xl border border-red-800 px-4 py-2 text-sm text-red-300" onClick={async () => { if (window.confirm(T('السجل القديم هيتمسح نهائي. متأكد؟'))) { setLocked(null); await save(emptyRoom()); } }}>{T('ابدأ غرفة جديدة')}</button>
        </div>
        {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
      </div>
    );
  }
  if (!room) return <div className="flex items-center gap-2 text-stone-400"><Loader2 className="h-4 w-4 animate-spin" />{T('بفتح الغرفة…')}</div>;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <section className={`${card} flex min-h-[70vh] flex-col`}>
        <header className="flex flex-wrap items-center gap-2 border-b border-stone-800 pb-3">
          <Crown className="h-5 w-5 text-amber-400" />
          <h2 className="font-black text-amber-100">{T('غرفة شاهين الخاصة')}</h2>
          <span className="ms-auto inline-flex items-center gap-1 rounded-full border border-emerald-800 bg-emerald-950 px-2 py-0.5 text-[11px] text-emerald-200"><Lock className="h-3 w-3" />{T('متشفرة على جهازك')}</span>
          <p className="w-full text-[11px] text-stone-400">{T('اللي هنا: إنت 👑 وشاهين 🦅 والسكرتير 📒 بس. الكلام بيتحفظ متشفر على الجهاز ده بكودك السري، والخادم بيرد ومابيحفظش حاجة.')}</p>
          <p className="w-full text-[11px] text-amber-200/80">{T('🦅 شاهين الوكيل المسؤول عن الموقع: بيشوف كل الملفات ويجهّز التعديلات والأوامر، ومفيش حاجة بتتنفذ غير لما توافق عليها.')}</p>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto py-3" aria-live="polite">
          {!room.messages.length && <p className="mt-10 text-center text-sm text-stone-400">{T('اكتب لشاهين أي حاجة: سؤال عن الموقع، قرار، أو مهمة عايزها تتعمل.')}<br />{T('مثلاً: «شوف الفوتر وقولي فيه إيه» أو «غيّر جملة الترحيب في الصفحة الرئيسية».')}</p>}
          {room.messages.map((m) => (
            <div key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${WHO[m.by].bubble}`}>
              <div className="mb-1 flex items-center gap-1 text-[11px] opacity-70"><span>{WHO[m.by].icon}</span><b>{WHO[m.by].name()}</b><span>· {time(m.at)}</span>{m.offline && <span>· {T('من غير محركات')}</span>}</div>
              {m.by === 'owner' ? <p className="whitespace-pre-wrap">{m.text}</p> : <ReplyBody m={m} decisions={room.decisions} onDecide={decide} onReturn={returnWithNote} />}
            </div>
          ))}
          {busy && <div className="flex items-center gap-2 text-xs text-stone-400"><Loader2 className="h-3.5 w-3.5 animate-spin" />{reading.length ? <span>{T('📂 شاهين بيقرا:')} <code dir="ltr">{reading.join('، ')}</code></span> : busy === 'shaheen' ? T('شاهين بيكتب…') : T('السكرتير بيلخص…')}</div>}
          <div ref={end} />
        </div>
        {error && <p role="alert" className="mb-2 rounded-xl bg-red-950 p-2 text-xs text-red-200">{error}</p>}
        {(attached.length > 0 || picking) && (
          <div className="mb-2 space-y-2 rounded-xl border border-stone-800 bg-stone-950/60 p-2 text-xs">
            {attached.length > 0 && <div className="flex flex-wrap gap-1">{attached.map((p) => (
              <span key={p} className="inline-flex items-center gap-1 rounded-full border border-amber-800 bg-amber-950/60 px-2 py-0.5 text-amber-100"><Paperclip className="h-3 w-3" /><code dir="ltr">{p}</code>
                <button type="button" aria-label={T('شيل')} onClick={() => setAttached(attached.filter((x) => x !== p))}><X className="h-3 w-3" /></button></span>
            ))}</div>}
            {picking && (
              <div>
                <input autoFocus dir="ltr" className="w-full rounded-lg border border-stone-700 bg-stone-950 px-2 py-1 text-stone-100" value={pick} onChange={(e) => setPick(e.target.value)}
                  placeholder={T('اكتب جزء من اسم الملف… مثلاً Footer')} aria-label={T('دور على ملف')} />
                {!tree.length && <p className="mt-1 text-stone-500">{T('قايمة الملفات مش متاحة دلوقتي — شاهين يقدر يطلب الملف بالاسم.')}</p>}
                <ul className="mt-1 space-y-0.5">{matches.map((p) => (
                  <li key={p}><button type="button" dir="ltr" className="w-full rounded px-1 text-start text-stone-300 hover:bg-white/5" disabled={attached.length >= FILE_LIMITS.files}
                    onClick={() => { setAttached([...attached, p]); setPick(''); if (attached.length + 1 >= FILE_LIMITS.files) setPicking(false); }}>{p}</button></li>
                ))}</ul>
              </div>
            )}
          </div>
        )}
        <form className="flex items-end gap-2 border-t border-stone-800 pt-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <button type="button" onClick={() => setPicking(!picking)} title={T('وري شاهين ملف')} aria-label={T('وري شاهين ملف')}
            className={`rounded-xl border p-3 ${picking ? 'border-amber-600 text-amber-300' : 'border-stone-700 text-stone-400'}`}><FolderOpen className="h-4 w-4" /></button>
          <textarea ref={input} className="min-h-[48px] flex-1 resize-y rounded-xl border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100" rows={2} value={text} maxLength={ROOM_LIMITS.chars}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); } }}
            placeholder={T('اكتب لشاهين…')} aria-label={T('اكتب لشاهين…')} />
          <button disabled={!text.trim() || Boolean(busy)} className="rounded-xl bg-amber-500 p-3 text-stone-950 disabled:opacity-40" aria-label={T('ابعت')}><Send className="h-4 w-4" /></button>
        </form>
      </section>

      <aside className="space-y-4">
        <div className={card}>
          <h3 className="mb-2 flex items-center gap-2 font-bold text-emerald-200"><NotebookPen className="h-4 w-4" />{T('مفكرة السكرتير')}</h3>
          <button type="button" disabled={Boolean(busy) || !room.messages.length} onClick={() => void ask('secretary', room)} className="mb-3 w-full rounded-xl border border-emerald-700 bg-emerald-900/60 px-3 py-2 text-xs font-bold text-emerald-100 disabled:opacity-40">{T('📒 السكرتير يلخص الغرفة')}</button>
          {notes.decisions.length > 0 && <><div className="text-[11px] font-bold text-stone-400">{T('قراراتك')}</div><ul className="mb-2 list-disc space-y-1 ps-4 text-xs text-stone-200">{notes.decisions.map((d, i) => <li key={i}>{d}</li>)}</ul></>}
          {notes.orders.length > 0 && <><div className="text-[11px] font-bold text-stone-400">{T('طلباتك')}</div><ul className="mb-2 list-disc space-y-1 ps-4 text-xs text-stone-200">{notes.orders.map((d, i) => <li key={i}>{d}</li>)}</ul></>}
          <div className="text-[11px] font-bold text-stone-400">{T('مهام المفكرة')}</div>
          <ul className="mb-2 space-y-1 text-xs">
            {room.notes.map((n) => (
              <li key={n.id} className="flex items-start gap-2">
                <button type="button" aria-label={T('تم')} onClick={() => void save({ ...room, notes: room.notes.map((x) => (x.id === n.id ? { ...x, done: !x.done } : x)) })}>{n.done ? <CheckSquare className="h-4 w-4 text-emerald-400" /> : <Square className="h-4 w-4 text-stone-500" />}</button>
                <span className={n.done ? 'text-stone-500 line-through' : 'text-stone-200'}>{n.text}</span>
                <button type="button" className="ms-auto text-stone-600 hover:text-red-400" aria-label={T('مسح')} onClick={() => void save({ ...room, notes: room.notes.filter((x) => x.id !== n.id) })}><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
          <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); const t = maskSensitive(note.trim()); if (t) { setNote(''); void save({ ...room, notes: [...room.notes, { id: uid(), text: t.slice(0, 300), at: now() }] }); } }}>
            <input className="flex-1 rounded-lg border border-stone-700 bg-stone-950 px-2 py-1 text-xs text-stone-100" value={note} onChange={(e) => setNote(e.target.value)} placeholder={T('مهمة جديدة…')} aria-label={T('مهمة جديدة…')} />
            <button className="rounded-lg bg-emerald-700 px-2 text-xs font-bold text-white">+</button>
          </form>
        </div>
        <div className={`${card} space-y-2 text-xs`}>
          <h3 className="font-bold text-stone-200">{T('نسخة احتياطية متشفرة')}</h3>
          <p className="text-stone-400">{T('الغرفة محفوظة على الجهاز ده بس. علشان تنقلها لجهاز تاني نزّل نسخة متشفرة وارفعها هناك بنفس الكود.')}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportRoom} className="inline-flex items-center gap-1 rounded-lg border border-stone-700 px-2 py-1 text-stone-200"><Download className="h-3.5 w-3.5" />{T('نزّل نسخة')}</button>
            <button type="button" onClick={() => file.current?.click()} className="inline-flex items-center gap-1 rounded-lg border border-stone-700 px-2 py-1 text-stone-200"><Upload className="h-3.5 w-3.5" />{T('ارفع نسخة')}</button>
            <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void importRoom(e.target.files?.[0]); e.target.value = ''; }} />
            <button type="button" onClick={async () => { if (window.confirm(T('كل كلام الغرفة والمفكرة هيتمسح نهائي من الجهاز ده. متأكد؟'))) await save(emptyRoom()); }} className="inline-flex items-center gap-1 rounded-lg border border-red-900 px-2 py-1 text-red-300"><Trash2 className="h-3.5 w-3.5" />{T('امسح الغرفة')}</button>
          </div>
        </div>
      </aside>
    </div>
  );
}

