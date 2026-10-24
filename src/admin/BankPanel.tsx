import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, BadgeCheck, Banknote, Bot, Building2, CalendarClock, FileSearch, Landmark, Loader2, PieChart, Plus, ScrollText, Send, Wallet } from 'lucide-react';
import { adminRequest, send } from './adminApi';
import { adminLocale, getAdminLang } from './adminL10n';
import { LocalizedNumberInput } from '../components/LocalizedNumberInput';
import { major } from '../finance/money';
import type { BankDashboard } from '../../server/finance/bank';
import type { CollectionAccount } from '../../server/finance/types';
import { ShamAccountDesk } from '../components/ShamAccountDesk';

/**
 * «بنك شام» — the owner's money desk: the internal Sham account (posted transfers between Sham
 * account numbers), direct collection (InstaPay, bank transfer, wallets, cash on delivery),
 * bank-statement matching, bills we owe, monthly budgets, profitability, cash forecast, audit trail and
 * «شاهين المحاسب». Internal Sham transfers move the Sham book. External collection is still confirmed
 * by the owner; the desk never sends money to a bank outside Sham.
 */
const f = (ar: string, en: string) => (adminLocale().startsWith('ar') ? ar : en);
const card = 'rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-sm';
const field = 'w-full rounded-xl border border-stone-300 p-2.5 text-sm bg-white';
const button = 'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-40';
const money = (value: number | null | undefined, currency = 'EGP') => {
  if (value == null) return '—';
  try { return new Intl.NumberFormat(adminLocale(), { style: 'currency', currency }).format(major(value, currency)); } catch { return `${value} ${currency}`; }
};
const when = (value?: string) => (value ? new Date(value).toLocaleString(adminLocale(), { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Cairo' }) : '—');
const kindName = (k: string) => ({ instapay: f('إنستاباي', 'InstaPay'), bank_transfer: f('تحويل بنكي', 'Bank transfer'), wallet: f('محفظة موبايل', 'Mobile wallet'), cod: f('الدفع عند الاستلام', 'Cash on delivery') }[k] || k);
const stateName = (s: string) => ({ awaiting_payment: f('في انتظار التحويل', 'Awaiting transfer'), claimed: f('العميل بلّغ — راجع حسابك', 'Buyer reported — check your account'), paid: f('مدفوع ومؤكد', 'Paid & confirmed'), rejected: f('مرفوض', 'Rejected'), expired: f('انتهى الحجز', 'Expired') }[s] || s);
const stateTone = (s: string) => ({ claimed: 'bg-amber-100 text-amber-900', awaiting_payment: 'bg-sky-50 text-sky-800', paid: 'bg-emerald-100 text-emerald-800', rejected: 'bg-red-50 text-red-700', expired: 'bg-stone-100 text-stone-500' }[s] || 'bg-stone-100');
const riskName = (r: string) => ({ AMOUNT_MISMATCH: f('المبلغ مختلف', 'Amount differs'), DUPLICATE_REFERENCE: f('رقم عملية مكرر', 'Duplicate reference'), PAID_BEFORE_ORDER: f('التحويل قبل الطلب', 'Paid before order'), MANY_OPEN_ORDERS: f('طلبات مفتوحة كثيرة لنفس العميل', 'Many open orders, same buyer'), HIGH_AMOUNT: f('مبلغ أعلى من المعتاد', 'Unusually high amount') }[r] || r);
const categoryName = (c: string) => ({ ai: f('الذكاء الاصطناعي', 'AI'), marketing: f('التسويق', 'Marketing'), shipping: f('الشحن', 'Shipping'), salaries: f('المرتبات', 'Salaries'), rent: f('الإيجار', 'Rent'), software: f('البرامج والاستضافة', 'Software & hosting'), fees: f('رسوم وعمولات', 'Fees'), other: f('أخرى', 'Other') }[c] || c);
const SECTIONS = ['account', 'desk', 'collect', 'reconcile', 'payables', 'budgets', 'insights', 'audit'] as const;
type Section = typeof SECTIONS[number];
const emptyAccount = { kind: 'instapay', label: '', instructions: '', currencies: 'EGP', countries: 'EG', holdHours: '72', active: true };

export default function BankPanel() {
  const [section, setSection] = useState<Section>('account');
  const [data, setData] = useState<BankDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [account, setAccount] = useState<typeof emptyAccount & { id?: string }>(emptyAccount);
  const [statement, setStatement] = useState({ text: '', currency: 'EGP' });
  const [matches, setMatches] = useState<{ lines: number; unmatchedLines: number; matches: { ref: string; row: number; date: string; amount: number; confidence: string; description: string }[] } | null>(null);
  const [bill, setBill] = useState({ party: '', category: 'other', currency: 'EGP', amount: '', dueDate: new Date().toISOString().slice(0, 10), note: '' });
  const billKey = useRef(crypto.randomUUID());
  const [budget, setBudget] = useState({ category: 'ai', currency: 'EGP', amount: '' });

  useEffect(() => {
    const controller = new AbortController(); setLoading(true);
    adminRequest<BankDashboard>('/finance/bank', { signal: controller.signal })
      .then((d) => { if (!controller.signal.aborted) { setData(d); setError(''); } })
      .catch((e) => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  const act = async (work: () => Promise<unknown>, done = f('تم الحفظ.', 'Saved.')) => {
    if (busy) return; setBusy(true); setError(''); setNotice('');
    try { await work(); setRevision((n) => n + 1); setNotice(done); } catch (e) { setError(e instanceof Error ? e.message : f('تعذّر التنفيذ', 'Failed')); } finally { setBusy(false); }
  };
  const confirmPayment = (ref: string, risk: string[]) => {
    const mismatch = risk.includes('AMOUNT_MISMATCH');
    const ok = window.confirm(mismatch
      ? f(`تحذير: المبلغ المُبلَّغ لطلب ${ref} مختلف عن قيمة الطلب. هل استلمت المبلغ كاملاً فعلاً في حسابك؟`, `Warning: the reported amount for ${ref} differs from the order total. Did the full amount really arrive?`)
      : f(`هل شفت المبلغ في حسابك (أو استلمته نقداً) لطلب ${ref}؟ التأكيد يسجّل التحصيل ويبدأ تجهيز الطلب.`, `Did you see the money in your account (or receive the cash) for ${ref}? Confirming posts the collection and releases the order.`));
    if (ok) void act(() => adminRequest(`/finance/bank/direct/${ref}/confirm`, send('POST', { seen: true, acceptMismatch: mismatch })), f('تم تأكيد الدفع وتسجيله في الدفتر.', 'Payment confirmed and posted.'));
  };
  const rejectPayment = (ref: string) => {
    const reason = window.prompt(f('سبب الرفض (بدون بيانات شخصية):', 'Reason (no personal data):'));
    if (reason) void act(() => adminRequest(`/finance/bank/direct/${ref}/reject`, send('POST', { reason })));
  };
  const editAccount = (a: CollectionAccount) => setAccount({ id: a.id, kind: a.kind, label: a.label, instructions: a.instructions, currencies: a.currencies.join(','), countries: a.countries.join(','), holdHours: String(a.holdHours), active: a.active });
  const saveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const holdHours = Number(account.holdHours);
    if (!Number.isInteger(holdHours) || holdHours < 1 || holdHours > 720) {
      setError(f('مدة الحجز يجب أن تكون بين 1 و720 ساعة.', 'Hold time must be between 1 and 720 hours.'));
      return;
    }
    const body = { kind: account.kind, label: account.label, instructions: account.instructions, active: account.active, holdHours,
      currencies: account.currencies.toUpperCase().split(/[,،\s]+/).filter(Boolean), countries: account.countries.toUpperCase().split(/[,،\s]+/).filter(Boolean) };
    void act(async () => { await adminRequest(account.id ? `/finance/bank/accounts/${account.id}` : '/finance/bank/accounts', send(account.id ? 'PUT' : 'POST', body)); setAccount(emptyAccount); });
  };
  const ask = (e: React.FormEvent) => {
    e.preventDefault(); if (!question.trim()) return;
    void act(async () => { const r = await adminRequest<{ answer: string }>('/finance/bank/ask', send('POST', { question })); setAnswer(r.answer); }, '');
  };
  const runMatch = () => act(async () => {
    setMatches(await adminRequest(`/finance/bank/statement?currency=${encodeURIComponent(statement.currency)}`, { method: 'POST', body: statement.text, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
  }, f('تمت المطابقة. راجع النتائج ثم أكّد كل طلب بنفسك.', 'Matched. Review, then confirm each order yourself.'));

  const tabs: Record<Section, [string, React.ReactNode]> = {
    account: [f('الحساب', 'Account'), <Landmark key="i" className="w-4 h-4" />],
    desk: [f('المكتب', 'Desk'), <Banknote key="i" className="w-4 h-4" />],
    collect: [f('التحصيل المباشر', 'Direct collection'), <Wallet key="i" className="w-4 h-4" />],
    reconcile: [f('مطابقة كشف الحساب', 'Statement matching'), <FileSearch key="i" className="w-4 h-4" />],
    payables: [f('المستحقات علينا', 'Bills we owe'), <CalendarClock key="i" className="w-4 h-4" />],
    budgets: [f('الميزانيات', 'Budgets'), <PieChart key="i" className="w-4 h-4" />],
    insights: [f('الأرباح والتحليلات', 'Profit insights'), <Building2 key="i" className="w-4 h-4" />],
    audit: [f('سجل التدقيق', 'Audit trail'), <ScrollText key="i" className="w-4 h-4" />],
  };
  const waiting = data?.direct.filter((d) => d.state === 'claimed') || [];

  return <div className="space-y-4" data-testid="bank-panel">
    <div className="flex flex-wrap gap-2" role="tablist" aria-label={f('أقسام بنك شام', 'Sham Bank sections')}>
      {SECTIONS.map((id) => <button key={id} type="button" role="tab" aria-selected={section === id} onClick={() => setSection(id)} className={`${button} ${section === id ? 'bg-emerald-800 text-white' : 'bg-white border border-stone-200 text-stone-600'}`}>{tabs[id][1]}{tabs[id][0]}{id === 'collect' && waiting.length ? ` (${waiting.length})` : ''}</button>)}
    </div>
    {error && <p role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm">{error}</p>}
    {notice && <p role="status" className="bg-emerald-50 text-emerald-800 rounded-xl p-3 text-sm">{notice}</p>}
    {loading && !data && <p role="status" className="text-sm flex items-center gap-2 text-stone-500"><Loader2 className="w-4 h-4 animate-spin" />{f('جاري فتح البنك…', 'Opening the bank…')}</p>}
    {data && !data.persistent && <p className="rounded-xl bg-red-50 border border-red-200 text-red-800 p-3 text-sm flex gap-2"><AlertTriangle className="w-5 h-5 shrink-0" />{f('البنك شغّال على ذاكرة مؤقتة، فوسائل الدفع المباشر مخفية عن العملاء حتى لا يضيع أي طلب. الحل: أضف قاعدة البيانات المجانية من فيرسال (Storage ← Neon) ثم أعد النشر.', 'The bank runs on temporary memory, so direct payment is hidden from buyers to avoid losing orders. Fix: add the free database in Vercel (Storage → Neon), then redeploy.')}</p>}
    {data && <>
      {section === 'account' && <ShamAccountDesk lang={adminLocale().startsWith('ar') ? 'ar' : 'en'} customerId="owner" recorded={data.balances.map((row) => ({ currency: row.currency, minor: row.collectedMinor }))} />}
      {section === 'desk' && <>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className={card}><p className="text-xs text-stone-500">{f('تحويلات تنتظر تأكيدك', 'Transfers awaiting you')}</p><p className="text-2xl font-bold mt-2">{data.waitingConfirmation}</p></div>
          <div className={card}><p className="text-xs text-stone-500">{f('طلبات محجوزة تنتظر الدفع', 'Reserved, awaiting payment')}</p><p className="text-2xl font-bold mt-2">{data.awaitingTransfer}</p></div>
          {(data.month.length ? data.month : [{ currency: 'EGP', collectedMinor: 0, recordedResultMinor: 0 }]).slice(0, 1).map((c) => <React.Fragment key={c.currency}>
            <div className={card}><p className="text-xs text-stone-500">{f('تحصيل الشهر', 'Collected this month')}</p><p className="text-xl font-bold mt-2" dir="ltr">{money(c.collectedMinor, c.currency)}</p></div>
            <div className={card}><p className="text-xs text-stone-500">{f('ناتج القيود هذا الشهر', 'Recorded result this month')}</p><p className="text-xl font-bold mt-2" dir="ltr">{money(c.recordedResultMinor, c.currency)}</p></div>
          </React.Fragment>)}
        </div>
        {data.estimateEGP && <p className="text-xs text-stone-500">{f('إجمالي تقديري بالجنيه لكل العملات (أسعار صرف يومية، للتوجيه فقط):', 'Estimated total in EGP across currencies (daily rates, orientation only):')} <b dir="ltr">{money(data.estimateEGP.minor, 'EGP')}</b></p>}
        <div className="grid lg:grid-cols-2 gap-3">
          <div className={`${card} space-y-2`}><h3 className="font-bold text-sm flex items-center gap-2"><Wallet className="w-4 h-4" />{f('الحسابات وما وصلها', 'Accounts & what they received')}</h3>
            {!data.balances.length && <p className="text-xs text-stone-500">{f('لم تضف حساب تحصيل بعد. ابدأ من «التحصيل المباشر».', 'No collection account yet. Start in «Direct collection».')}</p>}
            {data.balances.map((b) => <p key={`${b.accountId}${b.currency}`} className="text-sm flex justify-between gap-2"><span>{b.label} · <span className="text-stone-500">{kindName(b.kind)}</span></span><span dir="ltr">{money(b.collectedMinor, b.currency)} ({b.payments})</span></p>)}
            <p className="text-[11px] text-stone-500">{f('المبالغ = تحصيلات أكّدتها أنت، وليست رصيد البنك الفعلي.', 'Amounts = collections you confirmed, not the actual bank balance.')}</p>
          </div>
          <div className={`${card} space-y-2`}><h3 className="font-bold text-sm flex items-center gap-2"><CalendarClock className="w-4 h-4" />{f('السيولة المتوقعة — ٣٠ يوماً', 'Cash forecast — 30 days')}</h3>
            {!data.forecast.length && <p className="text-xs text-stone-500">{f('لا توجد قيود كافية للتقدير بعد.', 'Not enough entries to estimate yet.')}</p>}
            {data.forecast.map((fc) => <div key={fc.currency} className="text-sm space-y-1"><p className="flex justify-between"><span>{f('صافي متوقع', 'Projected net')}</span><b dir="ltr">{money(fc.projectedNetMinor, fc.currency)}</b></p><p className="flex justify-between"><span>{f('مستحقات خلال الفترة', 'Bills due in period')}</span><span dir="ltr">−{money(fc.payablesDueMinor, fc.currency)}</span></p><p className="flex justify-between"><span>{f('بعد السداد', 'After bills')}</span><b dir="ltr" className={fc.projectedAfterPayablesMinor < 0 ? 'text-red-700' : 'text-emerald-700'}>{money(fc.projectedAfterPayablesMinor, fc.currency)}</b></p><p className="text-[11px] text-stone-500">{f(`تقدير من متوسط آخر ${fc.basisDays} يوم${fc.confidence === 'low' ? ' — بيانات قليلة' : ''}.`, `Average of the last ${fc.basisDays} days${fc.confidence === 'low' ? ' — little data' : ''}.`)}</p></div>)}
          </div>
        </div>
        <form onSubmit={ask} className={`${card} space-y-3`}>
          <h3 className="font-bold text-sm flex items-center gap-2"><Bot className="w-4 h-4 text-amber-700" />{f('اسأل شاهين المحاسب', 'Ask Shaheen the accountant')}</h3>
          <div className="flex gap-2"><input className={field} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={f('مثلاً: كسبنا كام الشهر ده؟ · أكتر منتج بيتباع؟ · علينا كام للموردين؟', 'e.g. How much profit this month? · Best seller? · What do we owe?')} maxLength={300} /><button className={`${button} bg-stone-900 text-white`} disabled={busy}><Send className="w-4 h-4" /></button></div>
          {answer && <p className="text-sm whitespace-pre-wrap bg-amber-50 rounded-xl p-3" role="status">{answer}</p>}
          <p className="text-[11px] text-stone-500">{f('الإجابات من أرقام الدفتر الحقيقية فقط، بدون تخمين.', 'Answers come only from the real ledger figures — no guessing.')}</p>
        </form>
      </>}

      {section === 'collect' && <>
        <div className="space-y-3">
          {!data.direct.length && <p className={`${card} text-sm text-stone-500`}>{f('لا توجد طلبات دفع مباشر بعد.', 'No direct-payment orders yet.')}</p>}
          {data.direct.map((d) => <article key={d.ref} className={`${card} space-y-2`}>
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-mono text-sm font-bold">{d.ref}</p><span className={`text-xs rounded-lg px-2 py-1 ${stateTone(d.state)}`}>{stateName(d.state)}</span></div>
            <p className="text-sm">{kindName(d.kind)} · <b dir="ltr">{money(d.totalMinor, d.currency)}</b> · {d.country} · {when(d.createdAt)}</p>
            {d.claim && <p className="text-xs text-stone-600">{f('المحوِّل:', 'Payer:')} <b>{d.claim.payerName}</b> · {f('رقم العملية:', 'Ref:')} <b dir="ltr">{d.claim.transferRef}</b> · {f('المبلغ:', 'Amount:')} <b dir="ltr">{money(d.claim.amountMinor, d.currency)}</b> · {when(d.claim.paidAt)}</p>}
            {d.risk.length > 0 && <p className="flex flex-wrap gap-1">{d.risk.map((r) => <span key={r} className="text-[11px] bg-red-50 text-red-700 rounded-lg px-2 py-0.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{riskName(r)}</span>)}</p>}
            {d.decision && <p className="text-xs text-stone-500">{d.decision}</p>}
            {['awaiting_payment', 'claimed', 'expired'].includes(d.state) && <div className="flex flex-wrap gap-2">
              <button className={`${button} bg-emerald-700 text-white`} disabled={busy} onClick={() => confirmPayment(d.ref, d.risk)}><BadgeCheck className="w-4 h-4" />{d.kind === 'cod' ? f('تم التحصيل عند الاستلام', 'Cash collected') : f('وصل المبلغ — أكّد', 'Money arrived — confirm')}</button>
              <button className={`${button} border border-red-200 text-red-700`} disabled={busy} onClick={() => rejectPayment(d.ref)}>{f('رفض', 'Reject')}</button>
            </div>}
          </article>)}
        </div>
        <div className={`${card} space-y-3`}>
          <h3 className="font-bold text-sm">{f('حسابات التحصيل', 'Collection accounts')}</h3>
          {data.accounts.map((a) => <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2 text-sm"><span>{a.label} · <span className="text-stone-500">{kindName(a.kind)} · {a.currencies.join(',')} · {a.countries.join(',')}</span> {a.active ? '' : <span className="text-red-700">({f('متوقف', 'off')})</span>}</span><button className="text-xs underline" onClick={() => editAccount(a)}>{f('تعديل', 'Edit')}</button></div>)}
          <form onSubmit={saveAccount} className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs space-y-1"><span>{f('النوع', 'Type')}</span><select className={field} value={account.kind} onChange={(e) => setAccount({ ...account, kind: e.target.value, holdHours: e.target.value === 'cod' ? '720' : account.holdHours })}>{data.kinds.map((k) => <option key={k} value={k}>{kindName(k)}</option>)}</select></label>
            <label className="text-xs space-y-1"><span>{f('الاسم الظاهر للعميل', 'Name shown to buyers')}</span><input className={field} required minLength={2} maxLength={60} value={account.label} onChange={(e) => setAccount({ ...account, label: e.target.value })} placeholder={kindName(account.kind)} /></label>
            <label className="text-xs space-y-1 sm:col-span-2"><span>{f('تعليمات الدفع للعميل (عنوان إنستاباي، رقم المحفظة، أو بيانات الحساب البنكي/IBAN)', 'Payment instructions (InstaPay address, wallet number or bank account/IBAN)')}</span><textarea className={field} rows={3} maxLength={500} required={account.kind !== 'cod'} value={account.instructions} onChange={(e) => setAccount({ ...account, instructions: e.target.value })} /></label>
            <label className="text-xs space-y-1"><span>{f('العملات (مثل EGP)', 'Currencies (e.g. EGP)')}</span><input className={field} dir="ltr" value={account.currencies} onChange={(e) => setAccount({ ...account, currencies: e.target.value })} /></label>
            <label className="text-xs space-y-1"><span>{f('الدول (مثل EG,SA)', 'Countries (e.g. EG,SA)')}</span><input className={field} dir="ltr" value={account.countries} onChange={(e) => setAccount({ ...account, countries: e.target.value })} /></label>
            <label className="text-xs space-y-1"><span>{f('مدة حجز الطلب بالساعات', 'Hold time (hours)')}</span><LocalizedNumberInput lang={getAdminLang()} className={field} dir="ltr" value={Number(account.holdHours) || 0} integer min={1} max={720} ariaLabel={f('مدة الحجز بالساعات', 'Hold time in hours')} onValue={(value) => setAccount({ ...account, holdHours: Number.isFinite(value) ? String(Math.trunc(value)) : '' })} /></label>
            <label className="text-xs flex items-center gap-2 pt-5"><input type="checkbox" checked={account.active} onChange={(e) => setAccount({ ...account, active: e.target.checked })} />{f('ظاهر للعملاء', 'Visible to buyers')}</label>
            <p className="text-[11px] text-amber-800 sm:col-span-2">{f('اكتب فقط ما يحتاجه العميل ليدفع لك. ممنوع كلمات السر أو أرقام البطاقات أو رموز التحقق — النظام يرفضها.', 'Only what a buyer needs to pay you. Passwords, card numbers and codes are refused.')}</p>
            <div className="flex gap-2 sm:col-span-2"><button className={`${button} bg-stone-900 text-white`} disabled={busy}><Plus className="w-4 h-4" />{account.id ? f('حفظ التعديل', 'Save changes') : f('إضافة الحساب', 'Add account')}</button>{account.id && <button type="button" className={`${button} border`} onClick={() => setAccount(emptyAccount)}>{f('إلغاء', 'Cancel')}</button>}</div>
          </form>
        </div>
      </>}

      {section === 'reconcile' && <div className={`${card} space-y-3`}>
        <h3 className="font-bold text-sm">{f('طابق كشف حساب البنك أو إنستاباي', 'Match a bank or InstaPay statement')}</h3>
        <p className="text-xs text-stone-600">{f('صدّر الكشف من تطبيق البنك بصيغة CSV والصقه هنا. شاهين يطابق كل مبلغ وارد مع الطلبات المنتظرة (بالمبلغ ورقم الطلب أو رقم العملية). الكشف لا يُحفظ، والتأكيد النهائي لك.', 'Export the statement as CSV from your bank app and paste it here. Shaheen pairs incoming amounts with waiting orders (amount + order or transfer number). Nothing is stored; you confirm.')}</p>
        <textarea className={`${field} font-mono text-xs`} rows={8} dir="ltr" value={statement.text} onChange={(e) => setStatement({ ...statement, text: e.target.value })} placeholder={'date,description,credit\n2026-10-20,InstaPay SP-XXXX,1500'} />
        <div className="flex gap-2 items-center"><input className={`${field} !w-28`} dir="ltr" value={statement.currency} onChange={(e) => setStatement({ ...statement, currency: e.target.value.toUpperCase() })} aria-label={f('العملة', 'Currency')} /><button className={`${button} bg-stone-900 text-white`} disabled={busy || !statement.text.trim()} onClick={() => void runMatch()}><FileSearch className="w-4 h-4" />{f('طابق الآن', 'Match now')}</button></div>
        {matches && <div className="space-y-2"><p className="text-xs text-stone-500">{f(`قرأنا ${matches.lines} سطراً · ${matches.matches.length} مطابقة · ${matches.unmatchedLines} مبلغ وارد بلا طلب`, `${matches.lines} lines · ${matches.matches.length} matches · ${matches.unmatchedLines} incoming without an order`)}</p>
          {matches.matches.map((m) => { const d = data.direct.find((x) => x.ref === m.ref); return <div key={m.ref} className="border rounded-xl p-3 text-sm flex flex-wrap justify-between gap-2 items-center"><span><b className="font-mono">{m.ref}</b> ← {f('سطر', 'row')} {m.row} · <span dir="ltr">{m.amount}</span> · {m.date || '—'} · <span className={m.confidence === 'strong' ? 'text-emerald-700' : 'text-amber-700'}>{m.confidence === 'strong' ? f('مطابقة قوية', 'Strong') : f('بالمبلغ فقط — راجع', 'Amount only — check')}</span><br /><span className="text-xs text-stone-500">{m.description}</span></span>{d && d.state !== 'paid' && <button className={`${button} bg-emerald-700 text-white`} disabled={busy} onClick={() => confirmPayment(m.ref, d.risk)}>{f('أكّد', 'Confirm')}</button>}</div>; })}
        </div>}
      </div>}

      {section === 'payables' && <>
        <div className="grid sm:grid-cols-3 gap-3">{data.ageing.map((a) => <React.Fragment key={a.currency}>
          <div className={card}><p className="text-xs text-stone-500">{f('متأخر', 'Overdue')}</p><p className="text-lg font-bold text-red-700 mt-2" dir="ltr">{money(a.overdueMinor, a.currency)}</p></div>
          <div className={card}><p className="text-xs text-stone-500">{f('خلال ٧ أيام', 'Within 7 days')}</p><p className="text-lg font-bold mt-2" dir="ltr">{money(a.dueWeekMinor, a.currency)}</p></div>
          <div className={card}><p className="text-xs text-stone-500">{f('خلال ٣٠ يوماً', 'Within 30 days')}</p><p className="text-lg font-bold mt-2" dir="ltr">{money(a.dueMonthMinor, a.currency)}</p></div>
        </React.Fragment>)}</div>
        <form className={`${card} grid sm:grid-cols-3 gap-3`} onSubmit={(e) => { e.preventDefault(); void act(async () => { await adminRequest('/finance/bank/payables', send('POST', { ...bill, idempotencyKey: billKey.current })); billKey.current = crypto.randomUUID(); setBill({ ...bill, party: '', amount: '', note: '' }); }); }}>
          <h3 className="font-bold text-sm sm:col-span-3">{f('فاتورة مستحقة جديدة', 'New bill')}</h3>
          <input className={field} required minLength={2} maxLength={80} placeholder={f('الجهة (مورد، شركة شحن…)', 'Party (supplier, courier…)')} value={bill.party} onChange={(e) => setBill({ ...bill, party: e.target.value })} />
          <select className={field} value={bill.category} onChange={(e) => setBill({ ...bill, category: e.target.value })}>{data.categories.map((c) => <option key={c} value={c}>{categoryName(c)}</option>)}</select>
          <input className={field} type="date" required value={bill.dueDate} onChange={(e) => setBill({ ...bill, dueDate: e.target.value })} />
          <input className={field} required inputMode="decimal" dir="ltr" placeholder={f('المبلغ', 'Amount')} value={bill.amount} onChange={(e) => setBill({ ...bill, amount: e.target.value })} />
          <input className={field} dir="ltr" value={bill.currency} onChange={(e) => setBill({ ...bill, currency: e.target.value.toUpperCase() })} aria-label={f('العملة', 'Currency')} />
          <input className={field} maxLength={240} placeholder={f('ملاحظة (اختياري)', 'Note (optional)')} value={bill.note} onChange={(e) => setBill({ ...bill, note: e.target.value })} />
          <button className={`${button} bg-stone-900 text-white sm:col-span-3`} disabled={busy}><Plus className="w-4 h-4" />{f('إضافة', 'Add')}</button>
        </form>
        <div className={`${card} overflow-x-auto`}><table className="w-full text-xs"><thead><tr className="text-stone-500 border-b">{[f('الجهة', 'Party'), f('البند', 'Category'), f('المبلغ', 'Amount'), f('الاستحقاق', 'Due'), f('الحالة', 'Status'), ''].map((h, i) => <th key={i} className="p-2 text-start">{h}</th>)}</tr></thead><tbody>
          {data.payables.map((p) => <tr key={p.id} className="border-b border-stone-100"><td className="p-2">{p.party}</td><td className="p-2">{categoryName(p.category)}</td><td className="p-2" dir="ltr">{money(p.amountMinor, p.currency)}</td><td className={`p-2 ${p.status === 'open' && Date.parse(`${p.dueDate}T23:59:59Z`) < Date.now() ? 'text-red-700 font-bold' : ''}`}>{p.dueDate}</td><td className="p-2">{p.status === 'open' ? f('مفتوحة', 'Open') : p.status === 'paid' ? f('مسددة', 'Paid') : f('ملغاة', 'Cancelled')}</td>
            <td className="p-2 whitespace-nowrap">{p.status === 'open' && <><button className="text-emerald-700 underline me-3" disabled={busy} onClick={() => { if (window.confirm(f('سجّل إنك سددت الفاتورة دي من حسابك؟ (النظام لا يحوّل أموالاً)', 'Record that you paid this bill from your account? (No money is moved)'))) void act(() => adminRequest(`/finance/bank/payables/${p.id}/pay`, send('POST', {}))); }}>{f('سددت', 'Paid')}</button><button className="text-red-700 underline" disabled={busy} onClick={() => void act(() => adminRequest(`/finance/bank/payables/${p.id}/cancel`, send('POST', {})))}>{f('إلغاء', 'Cancel')}</button></>}</td></tr>)}
        </tbody></table>{!data.payables.length && <p className="text-xs text-stone-500 p-2">{f('لا توجد فواتير.', 'No bills.')}</p>}</div>
      </>}

      {section === 'budgets' && <>
        <form className={`${card} grid sm:grid-cols-4 gap-3 items-end`} onSubmit={(e) => { e.preventDefault(); void act(async () => { await adminRequest('/finance/bank/budgets', send('PUT', budget)); setBudget({ ...budget, amount: '' }); }); }}>
          <label className="text-xs space-y-1"><span>{f('البند', 'Category')}</span><select className={field} value={budget.category} onChange={(e) => setBudget({ ...budget, category: e.target.value })}>{data.categories.map((c) => <option key={c} value={c}>{categoryName(c)}</option>)}</select></label>
          <label className="text-xs space-y-1"><span>{f('الميزانية الشهرية', 'Monthly budget')}</span><input className={field} required inputMode="decimal" dir="ltr" value={budget.amount} onChange={(e) => setBudget({ ...budget, amount: e.target.value })} placeholder="0 = off" /></label>
          <label className="text-xs space-y-1"><span>{f('العملة', 'Currency')}</span><input className={field} dir="ltr" value={budget.currency} onChange={(e) => setBudget({ ...budget, currency: e.target.value.toUpperCase() })} /></label>
          <button className={`${button} bg-stone-900 text-white`} disabled={busy}>{f('حفظ', 'Save')}</button>
        </form>
        <div className={`${card} space-y-3`}>
          {!data.budgets.length && <p className="text-xs text-stone-500">{f('حدد ميزانية لكل بند، وشاهين ينبّهك عند ٨٠٪ وعند التجاوز.', 'Set a budget per category; Shaheen warns at 80 % and when exceeded.')}</p>}
          {data.budgets.map((b) => <div key={`${b.category}${b.currency}`} className="space-y-1"><p className="text-sm flex justify-between"><span>{categoryName(b.category)}</span><span dir="ltr">{money(b.spentMinor, b.currency)}{b.monthlyMinor !== null ? ` / ${money(b.monthlyMinor, b.currency)}` : ''}</span></p>
            <div className="h-2 rounded-full bg-stone-100 overflow-hidden"><div className={`h-full ${b.state === 'over' ? 'bg-red-600' : b.state === 'warning' ? 'bg-amber-500' : b.state === 'ok' ? 'bg-emerald-600' : 'bg-stone-400'}`} style={{ width: `${Math.min(100, b.percent ?? 100)}%` }} /></div>
            <p className="text-[11px] text-stone-500">{b.state === 'unbudgeted' ? f('صرف بدون ميزانية', 'Spending without a budget') : `${b.percent}%`}</p></div>)}
          <p className="text-[11px] text-stone-500">{f('سجّل المصروفات من «السجل والتكاليف» أو بسداد فاتورة مستحقة؛ البند يحدد الميزانية.', 'Record expenses in «Ledger & costs» or by paying a bill; the category maps to the budget.')}</p>
        </div>
      </>}

      {section === 'insights' && <div className="grid lg:grid-cols-2 gap-3">
        <div className={`${card} overflow-x-auto`}><h3 className="font-bold text-sm mb-2">{f('المنتجات الأكثر مبيعاً', 'Best-selling products')}</h3><table className="w-full text-xs"><thead><tr className="text-stone-500 border-b">{[f('المنتج', 'Product'), f('الوحدات', 'Units'), f('الإيراد', 'Revenue'), f('هامش تقديري', 'Est. margin')].map((h) => <th key={h} className="p-2 text-start">{h}</th>)}</tr></thead><tbody>
          {data.products.map((p) => <tr key={`${p.sku}${p.currency}`} className="border-b border-stone-100"><td className="p-2 font-mono">{p.sku}</td><td className="p-2">{p.units}</td><td className="p-2" dir="ltr">{money(p.revenueMinor, p.currency)}</td><td className="p-2" dir="ltr">{p.costComplete ? money(p.estimatedMarginMinor, p.currency) : <span className="text-amber-700">{f('تكاليف ناقصة', 'Costs missing')}</span>}</td></tr>)}
        </tbody></table>{!data.products.length && <p className="text-xs text-stone-500 p-2">{f('لا مبيعات مؤكدة بعد.', 'No confirmed sales yet.')}</p>}</div>
        <div className={`${card} overflow-x-auto`}><h3 className="font-bold text-sm mb-2">{f('الأرباح حسب الدولة', 'Results by country')}</h3><table className="w-full text-xs"><thead><tr className="text-stone-500 border-b">{[f('الدولة', 'Country'), f('طلبات', 'Orders'), f('تحصيل', 'Collected'), f('الناتج', 'Result')].map((h) => <th key={h} className="p-2 text-start">{h}</th>)}</tr></thead><tbody>
          {data.countries.map((c) => <tr key={`${c.country}${c.currency}`} className="border-b border-stone-100"><td className="p-2">{c.country}</td><td className="p-2">{c.paidOrders}</td><td className="p-2" dir="ltr">{money(c.collectedMinor, c.currency)}</td><td className="p-2" dir="ltr">{money(c.resultMinor, c.currency)}{c.costComplete ? '' : ' *'}</td></tr>)}
        </tbody></table><p className="text-[11px] text-stone-500 mt-2">{f('* تكاليف بعض الطلبات لم تُسجّل بعد، فالناتج مؤشر مبدئي.', '* Some order costs are not recorded yet; preliminary result.')}</p></div>
      </div>}

      {section === 'audit' && <div className={`${card} overflow-x-auto`}><p className="text-xs text-stone-500 mb-2">{f('كل إجراء في البنك يُسجّل هنا بالوقت (آخر ٥٠).', 'Every bank action is logged here with its time (latest 50).')}</p><table className="w-full text-xs"><tbody>
        {data.audit.map((a) => <tr key={a.id} className="border-b border-stone-100"><td className="p-2 whitespace-nowrap">{when(a.at)}</td><td className="p-2 font-mono">{a.action}</td><td className="p-2 font-mono">{a.target}</td><td className="p-2 text-stone-500">{a.detail}</td></tr>)}
      </tbody></table>{!data.audit.length && <p className="text-xs text-stone-500">{f('لا توجد إجراءات بعد.', 'No actions yet.')}</p>}</div>}
    </>}
  </div>;
}
