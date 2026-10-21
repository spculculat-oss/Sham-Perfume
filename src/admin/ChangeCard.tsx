import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, FileCode2, Loader2, ShieldAlert, Wrench, XCircle } from 'lucide-react';
import { T, TP } from './adminL10n';
import { repoFile } from './repoFiles';
import bundledControls from '../data/owner/controls.json';
import { readControls } from '../utils/ownerAuthority';
import {
  CHANGE_LIMITS, changeIssue, changesListUrl, changeVerdict, encodeChange, newIssueUrl, planChange,
  type ChangePlan, type FileEdit,
} from '../utils/ownerFiles';
import type { ChangeDecision } from '../utils/ownerRoom';

/**
 * The card under a reply in which Shaheen proposed a change: what changes, whether it is small and safe, and the
 * owner's two buttons. «وافق» opens the request on GitHub from his own account; his desk does the rest.
 */
export default function ChangeCard({ edits, summary, decision, onDecide }: {
  edits: FileEdit[]; summary: string; decision?: ChangeDecision; onDecide: (d: ChangeDecision) => void;
}) {
  const [plan, setPlan] = useState<ChangePlan | null>(null);
  const [open, setOpen] = useState(false);
  const [agree, setAgree] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const paths = [...new Set(edits.map((e) => e.path))];
    void Promise.all(paths.map(async (p) => [p, await repoFile(p)] as const)).then((pairs) => {
      if (!alive) return;
      const files = new Map(pairs);
      setPlan(planChange(edits, (p) => files.get(p)));
    });
    return () => { alive = false; };
  }, [edits]);

  if (!plan) return <div className="mt-2 flex items-center gap-2 text-xs text-stone-400"><Loader2 className="h-3.5 w-3.5 animate-spin" />{T('بجهز كارت التعديل…')}</div>;
  const verdict = changeVerdict(readControls(bundledControls), plan);
  const blocked = plan.problems.length > 0 || !plan.files.length;

  const approve = async () => {
    setBusy(true); setNote('');
    try {
      const encoded = await encodeChange({ v: 1, summary, edits });
      const issue = changeIssue(summary, plan, verdict, encoded);
      let url = newIssueUrl(issue.title, issue.body);
      if (url.length > CHANGE_LIMITS.urlChars) {
        // Too long for a link: the request goes through the clipboard, and the page says where to paste it.
        await navigator.clipboard.writeText(issue.body);
        url = newIssueUrl(issue.title, T('امسح السطر ده والصق التعديل هنا (Ctrl+V)، وبعدين اضغط (Submit new issue = إنشاء الطلب).'));
        setNote(T('التعديل كبير على اللينك، فنسخته لك. في صفحة GitHub امسح السطر اللي مكتوب والصق مكانه (Ctrl+V).'));
      }
      window.open(url, '_blank', 'noopener');
      onDecide('sent');
    } catch { setNote(T('مقدرتش أجهز الطلب على الجهاز ده — جرب من متصفح تاني.')); }
    finally { setBusy(false); }
  };

  return (
    <div className="mt-3 rounded-xl border border-amber-800/70 bg-stone-950/80 p-3 text-xs text-stone-200">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Wrench className="h-4 w-4 text-amber-400" />
        <b className="text-amber-100">{T('اقتراح تعديل من شاهين')}</b>
        {!blocked && (verdict.auto
          ? <span className="rounded-full border border-emerald-800 bg-emerald-950 px-2 py-0.5 text-[11px] text-emerald-200">✅ {T('صغير وآمن')}</span>
          : <span className="rounded-full border border-amber-700 bg-amber-950 px-2 py-0.5 text-[11px] text-amber-200">🔑 {T('كبير أو حساس')}</span>)}
      </div>
      <ul className="mb-2 space-y-1">
        {plan.files.map((f) => (
          <li key={f.path} className="flex items-center gap-1"><FileCode2 className="h-3.5 w-3.5 text-stone-500" /><code dir="ltr" className="text-stone-100">{f.path}</code>
            <span className="text-stone-500">· {f.before === undefined ? T('ملف جديد') : TP('{n} سطر', { n: f.lines })}</span></li>
        ))}
      </ul>
      {!blocked && <p className="mb-2 text-stone-400">{verdict.reasonAr}</p>}
      {plan.problems.length > 0 && (
        <div className="mb-2 rounded-lg border border-red-900 bg-red-950/60 p-2 text-red-200">
          <div className="mb-1 flex items-center gap-1 font-bold"><ShieldAlert className="h-3.5 w-3.5" />{T('التعديل ده مايتنفذش:')}</div>
          <ul className="list-disc ps-4">{plan.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
          <p className="mt-1 text-red-300/80">{T('قول لشاهين المشكلة وهو يظبط الاقتراح.')}</p>
        </div>
      )}
      <button type="button" className="mb-2 text-[11px] text-amber-300 underline" onClick={() => setOpen(!open)}>{open ? T('اخفي التفاصيل') : T('وريني التعديل بالظبط')}</button>
      {open && (
        <div className="mb-2 max-h-80 space-y-2 overflow-auto" dir="ltr">
          {edits.map((e, i) => (
            <div key={i} className="rounded-lg border border-stone-800">
              <div className="border-b border-stone-800 px-2 py-1 text-[11px] text-stone-400">{e.path}</div>
              {e.search && <pre className="whitespace-pre-wrap bg-red-950/40 px-2 py-1 text-[11px] text-red-200">{e.search.split('\n').map((l) => `- ${l}`).join('\n')}</pre>}
              <pre className="whitespace-pre-wrap bg-emerald-950/40 px-2 py-1 text-[11px] text-emerald-200">{e.replace.split('\n').map((l) => `+ ${l}`).join('\n')}</pre>
            </div>
          ))}
        </div>
      )}

      {decision === 'sent' ? (
        <div className="space-y-1 rounded-lg border border-emerald-800 bg-emerald-950/60 p-2 text-emerald-100">
          <div className="flex items-center gap-1 font-bold"><CheckCircle2 className="h-4 w-4" />{T('وافقت — اتبعت لمكتبك على GitHub')}</div>
          <p>{T('في صفحة GitHub اللي اتفتحت اضغط (Submit new issue = إنشاء الطلب). المكتب هيشغل كل الفحوص، ولو عدّت هينشر التعديل ويرد عليك هناك خلال حوالي 10 دقايق.')}</p>
          <a className="inline-flex items-center gap-1 text-emerald-300 underline" href={changesListUrl()} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" />{T('تابع طلبات التعديل')}</a>
        </div>
      ) : decision === 'rejected' ? (
        <div className="flex items-center gap-1 text-stone-400"><XCircle className="h-4 w-4" />{T('رفضت التعديل ده — مفيش حاجة اتغيرت.')}</div>
      ) : !blocked && (
        <div className="space-y-2">
          {!verdict.auto && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-800 bg-amber-950/50 p-2 text-amber-100">
              <input type="checkbox" className="mt-0.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>{T('ده تعديل كبير أو بيلمس حاجة حساسة. قريت اللي هيتغير وموافق عليه.')}</span>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || (!verdict.auto && !agree)} onClick={() => void approve()}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 font-bold text-stone-950 disabled:opacity-40">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{T('وافق وابعت للتنفيذ')}
            </button>
            <button type="button" onClick={() => onDecide('rejected')} className="inline-flex items-center gap-1 rounded-lg border border-stone-700 px-3 py-1.5 text-stone-300"><XCircle className="h-3.5 w-3.5" />{T('ارفض')}</button>
          </div>
          <p className="text-[11px] text-stone-500">{T('الموافقة بتفتح صفحة على GitHub من حسابك. الطلب ده بيبان على GitHub، وفيه التعديل بس من غير أي كلام من الغرفة.')}</p>
        </div>
      )}
      {note && <p className="mt-2 text-[11px] text-amber-200">{note}</p>}
    </div>
  );
}
