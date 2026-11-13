import { useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, Siren, Undo2, XCircle } from 'lucide-react';
import { T } from './adminL10n';
import { sendDeskRequest } from './deskRequest';
import { changesListUrl } from '../utils/ownerFiles';
import { orderDraft, orderText, type DeskOrder } from '../utils/ownerDesk';
import type { ChangeDecision } from '../utils/ownerRoom';

/**
 * An order Shaheen prepared for the robots («شاهين الوكيل المسؤول»): nothing happens until the owner presses «وافق»,
 * which opens the request on GitHub from his own account; his desk carries it out and answers there.
 */
export default function OrderCard({ order, summary, decision, onDecide, onReturn }: {
  order: DeskOrder; summary: string; decision?: ChangeDecision; onDecide: (d: ChangeDecision) => void; onReturn: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const text = orderText(order);
  const approve = async () => {
    setBusy(true); setNote('');
    try {
      setNote(await sendDeskRequest(orderDraft(order, summary)));
      onDecide('sent');
    } catch { setNote(T('مقدرتش أجهز الطلب على الجهاز ده — جرب من متصفح تاني.')); }
    finally { setBusy(false); }
  };
  return (
    <div className="mt-3 rounded-xl border border-sky-800/70 bg-stone-950/80 p-3 text-xs text-stone-200">
      <div className="mb-2 flex items-center gap-2"><Siren className="h-4 w-4 text-sky-300" /><b className="text-sky-100">{T('أمر جهّزه شاهين')}</b></div>
      <p className="mb-2 text-sm font-bold text-stone-100">{text}</p>
      {decision === 'sent' ? (
        <div className="space-y-1 rounded-lg border border-emerald-800 bg-emerald-950/60 p-2 text-emerald-100">
          <div className="flex items-center gap-1 font-bold"><CheckCircle2 className="h-4 w-4" />{T('وافقت — اتبعت لمكتبك على GitHub')}</div>
          <p>{T('في صفحة GitHub اللي اتفتحت اضغط (Submit new issue = إنشاء الطلب)، والمكتب هينفذ الأمر ويرد عليك هناك خلال دقايق.')}</p>
          <a className="inline-flex items-center gap-1 text-emerald-300 underline" href={changesListUrl()} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" />{T('تابع طلباتك')}</a>
        </div>
      ) : decision === 'rejected' ? (
        <div className="flex items-center gap-1 text-stone-400"><XCircle className="h-4 w-4" />{T('رفضت الأمر ده — مفيش حاجة اتغيرت.')}</div>
      ) : decision === 'returned' ? (
        <div className="flex items-center gap-1 text-stone-400"><Undo2 className="h-4 w-4" />{T('رجّعته لشاهين بملاحظتك.')}</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void approve()} className="inline-flex items-center gap-1 rounded-lg bg-sky-500 px-3 py-1.5 font-bold text-stone-950 disabled:opacity-40">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{T('وافق ونفّذ')}
          </button>
          <button type="button" onClick={() => onDecide('rejected')} className="inline-flex items-center gap-1 rounded-lg border border-stone-700 px-3 py-1.5 text-stone-300"><XCircle className="h-3.5 w-3.5" />{T('ارفض')}</button>
          <button type="button" onClick={onReturn} className="inline-flex items-center gap-1 rounded-lg border border-stone-700 px-3 py-1.5 text-stone-300"><Undo2 className="h-3.5 w-3.5" />{T('رجّعه بملاحظة')}</button>
        </div>
      )}
      {note && <p className="mt-2 text-[11px] text-amber-200">{note}</p>}
    </div>
  );
}
