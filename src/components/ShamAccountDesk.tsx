import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Check, Copy, CreditCard, Download, Landmark, RefreshCw, Send, Wallet } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { major } from '../finance/money';
import { getSavedPaymentMethods } from '../utils/customerPaymentVault';
import {
  ACCOUNT_CURRENCIES,
  RECEIVING_RAILS,
  listAccountRequests,
  listBeneficiaries,
  listWithdrawalBanks,
  requestAccountAction,
  saveBeneficiary,
  saveWithdrawalBank,
  type AccountRequest,
  type ReceivingRail,
  type RecordedBalance,
  type ShamBeneficiary,
  type WithdrawalBank,
} from '../bank/shamAccount';
import { PLATFORM_HOLDER, formatShamAccount, parseShamAccount, shamAccountNumber, statementLines, type ActivityRow } from '../bank/shamLedger';
import { bookErrorCode, newBookKey, openShamSession, previewConvert, type DeskAccount, type ShamSession } from '../bank/shamDeskApi';

type Pane = 'home' | 'receive' | 'pay' | 'activity' | 'withdraw' | 'convert' | 'card';

/**
 * Signed-in Sham account. Internal transfers post and move the available balance.
 * The account number is Sham's own ledger reference, not a bank IBAN.
 * An external withdrawal is held, never marked sent.
 */
export function ShamAccountDesk({
  lang,
  customerId,
  recorded = [],
  onClose,
}: {
  lang: SupportedLanguage;
  customerId: string;
  recorded?: RecordedBalance[];
  onClose?: () => void;
}) {
  const ar = lang === 'ar';
  const t = (a: string, e: string) => (ar ? a : e);
  const recordedRef = useRef(recorded);
  recordedRef.current = recorded;
  const sessionRef = useRef<ShamSession | null>(null);
  const [pane, setPane] = useState<Pane>('home');
  const [view, setView] = useState<DeskAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [amount, setAmount] = useState('');
  const [target, setTarget] = useState('');
  const [detail, setDetail] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [nickname, setNickname] = useState('');
  const [country, setCountry] = useState('');
  const [last4, setLast4] = useState('');
  const [bankId, setBankId] = useState('');
  const [banks, setBanks] = useState<WithdrawalBank[]>([]);
  const [payees, setPayees] = useState<ShamBeneficiary[]>([]);
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [review, setReview] = useState<{ kind: 'send' | 'hold' | 'convert'; key: string; text: string } | null>(null);
  const cards = getSavedPaymentMethods(customerId).filter((method) => method.type === 'card');
  const houseNumber = shamAccountNumber(PLATFORM_HOLDER);

  const explain = (code: string) => {
    const text: Record<string, [string, string]> = {
      INVALID_AMOUNT: ['اكتب مبلغاً صالحاً.', 'Enter a valid amount.'],
      INVALID_CURRENCY: ['هذه العملة ليست من أرصدة الحساب.', 'That currency is not an account balance.'],
      INVALID_ACCOUNT: ['رقم حساب شام غير صالح.', 'That is not a valid Sham account number.'],
      UNKNOWN_ACCOUNT: ['لا يوجد حساب بهذا الرقم. يجب أن يفتح صاحبه بنك شام أولاً.', 'No Sham account uses that number. The holder has to open Sham Bank first.'],
      SAME_ACCOUNT: ['لا يمكن الإرسال إلى نفس الحساب.', 'You cannot send to the same account.'],
      INSUFFICIENT_FUNDS: ['الرصيد المتاح لا يكفي.', 'Available balance is not enough.'],
      INVALID_LABEL: ['الاسم قصير أو غير مقبول.', 'The name is too short or not accepted.'],
      INVALID_LAST4: ['اكتب آخر ٤ أرقام فقط.', 'Enter only the last 4 digits.'],
      SECRET: ['لا تكتب رقم حساب خارجي أو رمزاً سرياً.', 'Do not enter an external account number or a secret.'],
      LOGIN_REQUIRED: ['سجّل الدخول أولاً.', 'Sign in first.'],
      RATE_MISSING: ['لا يوجد سعر دفتر لهذه العملة.', 'No book rate for that currency.'],
      AMOUNT_TOO_SMALL: ['المبلغ أصغر من أن يُحوَّل.', 'That amount is too small to convert.'],
      SAME_CURRENCY: ['اختر عملتين مختلفتين.', 'Choose two different currencies.'],
      HOLD_NOT_FOUND: ['لا يوجد حجز مفتوح.', 'That hold is not open.'],
      BUSY: ['الحساب مشغول. أعد المحاولة.', 'The account is busy. Try again.'],
      CONFLICT: ['تعارض في الدفتر. أعد المحاولة بنفس المفتاح.', 'The books conflicted. Retry with the same key.'],
      BOOK_FAILED: ['تعذّر تحديث الدفتر.', 'The books could not be updated.'],
    };
    const pair = text[code] || text.BOOK_FAILED;
    return t(pair[0], pair[1]);
  };

  const reloadLists = () => {
    setBanks(listWithdrawalBanks(customerId));
    setPayees(listBeneficiaries(customerId));
    setRequests(listAccountRequests(customerId));
  };
  const apply = (next: DeskAccount) => { setView(next); sessionRef.current = sessionRef.current ? { ...sessionRef.current, view: next } : sessionRef.current; };

  useEffect(() => {
    let live = true;
    setLoading(true);
    openShamSession({ customerId, recorded: recordedRef.current }).then((session) => {
      if (!live) return;
      sessionRef.current = session;
      setView(session.view);
      setError('');
    }).catch((err) => { if (live) setError(explain(bookErrorCode(err))); }).finally(() => { if (live) setLoading(false); });
    reloadLists();
    const onFocus = () => { void sessionRef.current?.reload().then((next) => { if (live) setView(next); }).catch(() => undefined); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('sham-account-updated', reloadLists);
    return () => { live = false; window.removeEventListener('focus', onFocus); window.removeEventListener('sham-account-updated', reloadLists); };
  }, [customerId]);

  const money = (minor: number, code: string) => {
    try { return new Intl.NumberFormat(ar ? 'ar-EG' : 'en', { style: 'currency', currency: code }).format(major(minor, code)); }
    catch { return `${minor} ${code}`; }
  };
  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await work(); } catch (err) { setError(explain(bookErrorCode(err))); } finally { setBusy(false); }
  };
  const copyNumber = async () => {
    if (!view) return;
    const text = formatShamAccount(view.accountNumber);
    try { await navigator.clipboard.writeText(text); } catch {
      const el = document.createElement('textarea');
      el.value = text; document.body.appendChild(el); el.select(); document.execCommand('copy'); el.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  const refresh = () => run(async () => {
    const session = sessionRef.current;
    if (!session) return;
    apply(await session.reload());
  });

  const panes: [Pane, string, string][] = [
    ['home', 'الرئيسية', 'Home'],
    ['receive', 'استلام', 'Receive'],
    ['pay', 'إرسال', 'Send'],
    ['activity', 'الحركة', 'Activity'],
    ['withdraw', 'سحب', 'Withdraw'],
    ['convert', 'تحويل عملة', 'Convert'],
    ['card', 'البطاقة', 'Card'],
  ];
  const kindName = (kind: ActivityRow['kind'] | AccountRequest['kind']) => ({
    import: t('تحصيل مؤكد', 'Confirmed collection'),
    transfer: t('تحويل داخلي', 'Internal transfer'),
    hold: t('حجز سحب', 'Withdrawal hold'),
    release: t('فك حجز', 'Hold released'),
    convert: t('تحويل عملة', 'Conversion'),
    withdraw: t('سحب إلى بنك', 'Withdraw to bank'),
    pay: t('دفع لحساب شام', 'Pay a Sham account'),
    card: t('طلب بطاقة', 'Card request'),
    receiving: t('طلب تفاصيل استقبال', 'Receiving-details request'),
  }[kind]);
  const statusName = (status: string) => ({
    posted: t('مُرحّل', 'Posted'),
    held: t('محجوز', 'Held'),
    released: t('أُلغي الحجز', 'Released'),
    requested: t('مطلوب', 'Requested'),
  }[status] || status);
  const quote = (() => { try { return amount && pane === 'convert' ? previewConvert(amount, currency, toCurrency) : null; } catch { return null; } })();
  const held = view?.activity.filter((row) => row.kind === 'hold' && row.status === 'held') || [];

  return (
    <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white text-stone-900 shadow-sm" data-testid="sham-account-desk">
      <header className="bg-stone-950 px-4 py-5 text-white sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-wide text-amber-200">{t('بنك شام · دفتر داخلي', 'Sham Bank · internal books')}</p>
            <h2 className="mt-1 flex items-center gap-2 text-2xl font-black"><Landmark className="h-5 w-5" />{t('حساب شام', 'Sham account')}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={refresh} className="rounded-xl border border-white/15 p-2 text-stone-200" aria-label={t('تحديث', 'Refresh')}><RefreshCw className="h-4 w-4" /></button>
            {onClose && <button type="button" onClick={onClose} className="text-xs font-bold text-stone-300 underline">{t('إغلاق', 'Close')}</button>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] text-stone-400">{t('رقم حساب شام', 'Sham account number')}</p>
            <p className="mt-1 font-mono text-xl font-black tracking-wide" dir="ltr" data-testid="sham-account-number">{view ? formatShamAccount(view.accountNumber) : '—'}</p>
          </div>
          <button type="button" onClick={() => void copyNumber()} disabled={!view} className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-bold text-stone-950 disabled:opacity-40">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? t('تم النسخ', 'Copied') : t('نسخ الرقم', 'Copy number')}
          </button>
        </div>
        <p className="mt-2 max-w-2xl text-[11px] leading-5 text-stone-400">{t('هذا رقم دفتر داخل شام، وليس آيبان بنك. لا يستقبل تحويلاً من خارج المنصة. الإرسال الداخلي يُخصم ويُرحّل. السحب الخارجي يُحجز ولا يُرسل.', 'This is an internal Sham ledger number, not a bank IBAN. It cannot receive money from outside the platform. An internal send is deducted and posted. An external withdrawal is held and is not sent.')}</p>
      </header>
      <div className="flex gap-1 overflow-x-auto border-b border-stone-100 px-3 py-2" role="tablist">
        {panes.map(([id, a, e]) => (
          <button key={id} type="button" role="tab" aria-selected={pane === id} onClick={() => { setPane(id); setError(''); setNotice(''); setReview(null); }} className={`rounded-xl px-3 py-1.5 text-xs font-bold ${pane === id ? 'bg-stone-900 text-white' : 'text-stone-600'}`}>{t(a, e)}</button>
        ))}
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        {view?.book === 'browser' && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950" data-testid="sham-book-mode">{t('دفتر هذا المتصفح. التحويل يصل فقط إلى حساب فُتح هنا. دفتر الخادم غير متصل، ولا يخرج مال إلى بنك خارجي.', 'This browser’s books. A transfer reaches only an account opened here. The server books are not connected, and no money leaves to an outside bank.')}</p>}
        {view?.book === 'server' && <p className="rounded-xl bg-stone-50 px-3 py-2 text-xs leading-5 text-stone-600" data-testid="sham-book-mode">{view.persistent ? t('دفتر شام على الخادم. التحويل الداخلي يُخصم من المرسل ويُضاف للمستلم.', 'Sham’s server books. An internal transfer is deducted from the sender and added to the recipient.') : t('دفتر الخادم على ذاكرة مؤقتة. التحويل يعمل الآن وقد يضيع عند إعادة التشغيل.', 'The server books are in temporary memory. A transfer works now and may be lost on restart.')}</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900">{notice}</p>}
        {loading && !view && <p className="text-sm text-stone-500">{t('جاري فتح الدفتر…', 'Opening the books…')}</p>}

        {pane === 'home' && view && (
          <>
            <div className="flex gap-3 overflow-x-auto pb-1" data-testid="sham-balances">
              {[...view.balances].sort((a, b) => Number((b.availableMinor + b.heldMinor) > 0) - Number((a.availableMinor + a.heldMinor) > 0)).map((row) => (
                <button key={row.currency} type="button" onClick={() => { setCurrency(row.currency); setPane('pay'); }} className="min-w-[168px] rounded-2xl border border-stone-200 p-3 text-start hover:border-stone-900">
                  <p className="text-[11px] font-bold text-stone-500">{row.currency}</p>
                  <p className="mt-2 font-mono text-lg font-black" dir="ltr" data-testid={`sham-available-${row.currency}`}>{money(row.availableMinor, row.currency)}</p>
                  <p className="mt-1 text-[10px] text-stone-500">{row.heldMinor ? t(`متاح · محجوز ${money(row.heldMinor, row.currency)}`, `Available · held ${money(row.heldMinor, row.currency)}`) : t('متاح للتحويل الداخلي', 'Available for an internal transfer')}</p>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([
                ['pay', t('إرسال داخلي', 'Send inside Sham')],
                ['receive', t('رقم الاستلام', 'Receive number')],
                ['withdraw', t('حجز سحب', 'Hold a withdrawal')],
                ['convert', t('تحويل عملة', 'Convert')],
              ] as [Pane, string][]).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setPane(id)} className="rounded-2xl border border-stone-200 px-3 py-3 text-xs font-bold hover:border-stone-900">{label}</button>
              ))}
            </div>
          </>
        )}

        {pane === 'receive' && (
          <div className="space-y-2" data-testid="sham-receiving-accounts">
            <div className="rounded-2xl border border-stone-900 p-3">
              <p className="text-sm font-bold">{t('استلام داخل شام', 'Receive inside Sham')}</p>
              <p className="mt-1 font-mono text-sm" dir="ltr">{view ? formatShamAccount(view.accountNumber) : '—'}</p>
              <p className="mt-1 text-xs text-stone-500">{t('أعطِ هذا الرقم لمن سيحوّل إليك من حساب شام. ليس رقم استقبال خارجي.', 'Give this number to someone sending from a Sham account. It is not an external receiving number.')}</p>
            </div>
            <p className="text-xs text-stone-500">{t('مسارات البنوك الخارجية لم تُصدر. لا يظهر آيبان ولا رقم حساب بنك.', 'External bank rails are not issued. No IBAN and no outside account number is shown.')}</p>
            {RECEIVING_RAILS.map((rail) => <RailRow key={rail.id} rail={rail} ar={ar} onAsk={() => run(async () => { requestAccountAction(customerId, { kind: 'receiving', currency: rail.currency, detail: rail.networkEn }); reloadLists(); setNotice(t('طُلب إصدار التفاصيل. لم يُنشأ رقم خارجي.', 'Issuance was requested. No external number was created.')); })} />)}
          </div>
        )}

        {pane === 'pay' && (
          <form className="grid gap-2 sm:grid-cols-2" data-testid="sham-pay" onSubmit={(e) => { e.preventDefault(); void run(async () => {
            const number = parseShamAccount(target);
            const session = sessionRef.current;
            if (!session) return;
            if (!(await session.resolve(number))) throw new Error('UNKNOWN_ACCOUNT');
            setReview({ kind: 'send', key: newBookKey(), text: t(`سيُخصم ${amount} ${currency} من المتاح ويُرحّل إلى ${formatShamAccount(number)}. المال يبقى داخل شام.`, `${amount} ${currency} will be deducted from available balance and posted to ${formatShamAccount(number)}. The money stays inside Sham.`) });
          }); }}>
            <label className="text-xs sm:col-span-2">{t('رقم حساب شام', 'Sham account number')}<input value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 font-mono text-sm" dir="ltr" placeholder="SHAM 0000 0000 0000 0" data-testid="sham-pay-account" /></label>
            <label className="text-xs">{t('المبلغ', 'Amount')}<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" data-testid="sham-pay-amount" /></label>
            <label className="text-xs">{t('من رصيد', 'From balance')}<select aria-label={t('من رصيد', 'From balance')} value={currency} onChange={(e) => setCurrency(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm">{ACCOUNT_CURRENCIES.map((code) => <option key={code}>{code}</option>)}</select></label>
            <label className="text-xs sm:col-span-2">{t('ملاحظة', 'Note')}<input value={detail} onChange={(e) => setDetail(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" maxLength={40} /></label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="button" className="rounded-xl border px-3 py-2 text-xs font-bold" onClick={() => setTarget(formatShamAccount(houseNumber))}>{t('حساب المنصة', 'Platform account')}</button>
              {payees.map((payee) => <button key={payee.id} type="button" className="rounded-xl border px-3 py-2 text-xs font-bold" onClick={() => setTarget(formatShamAccount(payee.accountNumber))}>{payee.nickname}</button>)}
            </div>
            <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-1 rounded-xl bg-stone-900 py-2 text-sm font-bold text-white sm:col-span-2"><Send className="h-4 w-4" />{t('مراجعة الإرسال', 'Review send')}</button>
            <div className="grid gap-2 sm:col-span-2 sm:grid-cols-[1fr_1fr_auto]">
              <input placeholder={t('اسم المستفيد', 'Beneficiary name')} value={payeeName} onChange={(e) => setPayeeName(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" />
              <p className="self-center text-[11px] text-stone-500">{t('يُحفظ الاسم ورقم شام فقط.', 'Only the name and Sham number are saved.')}</p>
              <button type="button" className="rounded-xl border px-3 py-2 text-xs font-bold" onClick={() => run(async () => {
                const number = parseShamAccount(target);
                if (sessionRef.current && !(await sessionRef.current.resolve(number))) throw new Error('UNKNOWN_ACCOUNT');
                saveBeneficiary(customerId, { nickname: payeeName, accountNumber: number });
                setPayeeName(''); reloadLists(); setNotice(t('حُفظ المستفيد.', 'Beneficiary saved.'));
              })}>{t('احفظ المستفيد', 'Save beneficiary')}</button>
            </div>
          </form>
        )}

        {pane === 'activity' && (
          <div className="space-y-2">
            <button type="button" className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold" disabled={!view} onClick={() => { if (!view) return; const blob = new Blob([statementLines(view).join('\n')], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `sham-${view.accountNumber}.txt`; a.click(); URL.revokeObjectURL(url); }}><Download className="h-3.5 w-3.5" />{t('بيان نصي', 'Text statement')}</button>
            <Activity rows={view?.activity || []} requests={requests} empty={t('لا توجد حركة بعد.', 'No activity yet.')} kindName={kindName} statusName={statusName} money={money} />
          </div>
        )}

        {pane === 'withdraw' && (
          <form className="grid gap-2 sm:grid-cols-2" data-testid="sham-withdraw" onSubmit={(e) => { e.preventDefault(); const bank = banks.find((row) => row.id === bankId); void run(async () => {
            setReview({ kind: 'hold', key: newBookKey(), text: t(`سيُحجز ${amount} ${currency} من المتاح لصالح ${bank ? bank.nickname : t('سحب بدون بنك محفوظ', 'a withdrawal with no saved bank')}. لن يُرسل إلى بنك خارجي.`, `${amount} ${currency} will be held from available balance for ${bank ? bank.nickname : 'a withdrawal with no saved bank'}. It will not be sent to an outside bank.`) });
          }); }}>
            <select aria-label={t('العملة', 'Currency')} value={currency} onChange={(e) => setCurrency(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">{ACCOUNT_CURRENCIES.map((code) => <option key={code}>{code}</option>)}</select>
            <input inputMode="decimal" placeholder={t('المبلغ', 'Amount')} value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" data-testid="sham-withdraw-amount" />
            <select aria-label={t('بنك السحب', 'Withdrawal bank')} value={bankId} onChange={(e) => setBankId(e.target.value)} className="rounded-xl border px-3 py-2 text-sm sm:col-span-2">
              <option value="">{t('بدون بنك محفوظ بعد', 'No saved bank yet')}</option>
              {banks.filter((bank) => bank.currency === currency).map((bank) => <option key={bank.id} value={bank.id}>{bank.nickname} · •••• {bank.last4}</option>)}
            </select>
            <button type="submit" disabled={busy} className="rounded-xl bg-stone-900 py-2 text-sm font-bold text-white sm:col-span-2">{t('مراجعة الحجز', 'Review the hold')}</button>
            <div className="grid gap-2 sm:col-span-2 sm:grid-cols-4">
              <input placeholder={t('اسم البنك', 'Bank nickname')} value={nickname} onChange={(e) => setNickname(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" />
              <input placeholder={t('البلد', 'Country')} value={country} onChange={(e) => setCountry(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" />
              <input inputMode="numeric" placeholder={t('آخر ٤', 'Last 4')} value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} className="rounded-xl border px-3 py-2 text-sm" data-testid="sham-bank-last4" />
              <button type="button" className="rounded-xl border py-2 text-xs font-bold" onClick={() => run(async () => { saveWithdrawalBank(customerId, { nickname, currency, country, last4 }); setNickname(''); setLast4(''); reloadLists(); setNotice(t('حُفظ الاسم وآخر ٤ أرقام فقط.', 'Saved the nickname and last 4 only.')); })}>{t('احفظ بنك السحب', 'Save withdrawal bank')}</button>
            </div>
            {held.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs sm:col-span-2">
                <span>{t('محجوز', 'Held')} · {row.detail} · <span dir="ltr">{money(row.amountMinor, row.currency)}</span></span>
                <button type="button" className="font-bold underline" disabled={busy} onClick={() => run(async () => { const session = sessionRef.current; if (!session) return; apply(await session.release(row.id)); setNotice(t('أُلغي الحجز وعاد المبلغ إلى المتاح. لم يُرسل شيء.', 'The hold was released and the amount is available again. Nothing was sent.')); })}>{t('فك الحجز', 'Release')}</button>
              </div>
            ))}
          </form>
        )}

        {pane === 'convert' && (
          <form className="grid gap-2 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); void run(async () => {
            const next = previewConvert(amount, currency, toCurrency);
            setReview({ kind: 'convert', key: newBookKey(), text: t(`سيُخصم ${amount} ${currency} ويُضاف المقابل بسعر الدفتر (${next.rateLabel}). ليس تنفيذ سوق ولا رسماً.`, `${amount} ${currency} will be deducted and the other side added at the book rate (${next.rateLabel}). Not a market trade and not a fee.`) });
          }); }}>
            <select aria-label={t('من', 'From')} value={currency} onChange={(e) => setCurrency(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">{ACCOUNT_CURRENCIES.map((code) => <option key={code}>{code}</option>)}</select>
            <select aria-label={t('إلى', 'To')} value={toCurrency} onChange={(e) => setToCurrency(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">{ACCOUNT_CURRENCIES.map((code) => <option key={code}>{code}</option>)}</select>
            <input inputMode="decimal" placeholder={t('المبلغ', 'Amount')} value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" />
            {quote && <p className="text-xs text-stone-500 sm:col-span-3" dir="ltr">{quote.rateLabel} → {money(quote.creditMinor, toCurrency)}</p>}
            <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-1 rounded-xl bg-stone-900 py-2 text-sm font-bold text-white sm:col-span-3"><ArrowLeftRight className="h-4 w-4" />{t('مراجعة التحويل', 'Review conversion')}</button>
          </form>
        )}

        {pane === 'card' && (
          <div className="space-y-2" data-testid="sham-card-slot">
            <p className="text-xs text-stone-500">{t('طلب البطاقة لا يخصم رصيداً ولا يحفظ رقماً ولا يقول إن البطاقة مفعّلة.', 'A card request does not deduct a balance, store a number, or say the card is active.')}</p>
            {cards.length === 0 ? <p className="text-xs text-stone-500">{t('لا توجد بطاقة محفوظة على الحساب.', 'No card is saved on the account.')}</p> : cards.map((card) => (
              <p key={card.id} className="rounded-xl border px-3 py-2 text-sm"><CreditCard className="me-1 inline h-4 w-4" />{ar ? card.title : card.titleEn} <span className="font-mono">{card.identifier}</span> {card.expiry || ''}</p>
            ))}
            <button type="button" className="rounded-xl bg-stone-900 px-3 py-2 text-sm font-bold text-white" onClick={() => run(async () => { requestAccountAction(customerId, { kind: 'card', currency, detail: t('طلب بطاقة', 'Card request') }); reloadLists(); setNotice(t('طُلبت البطاقة. لم تُصدر ولم يُحفظ رقم.', 'The card was requested. None was issued and no number was stored.')); })}>{t('اطلب ربط بطاقة بالرصيد', 'Request a card linked to the balance')}</button>
          </div>
        )}

        {review && (
          <div className="rounded-2xl border border-stone-900 p-3" data-testid="sham-send-review">
            <p className="text-sm font-bold">{t('تأكيد داخل شام', 'Confirm inside Sham')}</p>
            <p className="mt-1 text-xs leading-5">{review.text}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={busy} data-testid="sham-send-confirm" className="rounded-xl bg-stone-900 px-3 py-2 text-sm font-bold text-white" onClick={() => run(async () => {
                const session = sessionRef.current;
                if (!session) return;
                const key = review.key;
                const next = review.kind === 'send'
                  ? await session.transfer({ toAccountNumber: parseShamAccount(target), currency, amount, detail, idempotencyKey: key })
                  : review.kind === 'hold'
                    ? await session.hold({ currency, amount, detail: banks.find((row) => row.id === bankId)?.nickname || detail || 'withdrawal hold', idempotencyKey: key })
                    : await session.convert({ from: currency, to: toCurrency, amount, idempotencyKey: key });
                apply(next);
                setReview(null);
                setAmount('');
                setNotice(review.kind === 'hold' ? t('حُجز المبلغ من المتاح. لم يُرسل إلى خارج شام.', 'The amount was held from available balance. It was not sent outside Sham.') : t('رُحّل القيد وتغيّر الرصيد المتاح.', 'The entry was posted and the available balance changed.'));
              })}>{t('تأكيد', 'Confirm')}</button>
              <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => setReview(null)}>{t('رجوع', 'Back')}</button>
            </div>
          </div>
        )}

        {pane === 'home' && <Activity rows={(view?.activity || []).slice(0, 3)} requests={[]} empty={t('ابدأ بالإرسال أو بانتظار تحويل على رقم حسابك.', 'Start by sending, or wait for a transfer to your account number.')} kindName={kindName} statusName={statusName} money={money} />}
        <p className="flex items-start gap-2 text-[10px] leading-4 text-stone-500"><Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0" />{customerId.toLowerCase() === 'owner' ? t('رصيد المنصة يُفتح من التحصيل الذي أكّدته، ثم يُرسل داخل شام. ليس مالاً جديداً ولا تحويلاً خارجياً.', 'The platform balance is opened from collections you confirmed, then sent inside Sham. It is not new money and not an external transfer.') : t('رصيدك صفر حتى يصلك تحويل داخلي. لا تُخصم عملية إلا بمبلغ موجود في المتاح.', 'Your balance stays at zero until an internal transfer arrives. Nothing is deducted unless the available balance covers it.')}</p>
      </div>
    </div>
  );
}

function RailRow({ rail, ar, onAsk }: { rail: ReceivingRail; ar: boolean; onAsk: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-stone-200 px-3 py-2">
      <div>
        <p className="text-sm font-bold">{rail.currency} · {ar ? rail.countryAr : rail.countryEn}</p>
        <p className="text-[11px] text-stone-500">{ar ? rail.networkAr : rail.networkEn}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-stone-100 px-2 py-1 text-[10px] font-bold text-stone-600">{ar ? 'لم تُصدر' : 'Not issued'}</span>
        <button type="button" onClick={onAsk} className="rounded-lg bg-stone-900 px-2 py-1 text-[11px] font-bold text-white">{ar ? 'اطلب الإصدار' : 'Request issuance'}</button>
      </div>
    </div>
  );
}

function Activity({ rows, requests, empty, kindName, statusName, money }: {
  rows: ActivityRow[];
  requests: AccountRequest[];
  empty: string;
  kindName: (kind: ActivityRow['kind'] | AccountRequest['kind']) => string;
  statusName: (status: string) => string;
  money: (minor: number, code: string) => string;
}) {
  if (!rows.length && !requests.length) return <p className="text-xs text-stone-500" data-testid="sham-activity-empty">{empty}</p>;
  return (
    <ul className="space-y-1" data-testid="sham-activity">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2 text-xs">
          <span>{kindName(row.kind)} · {row.detail}</span>
          <span className="font-mono" dir="ltr">{row.direction === 'debit' ? '−' : '+'}{money(row.amountMinor, row.currency)}</span>
          <span className={`rounded-lg px-2 py-0.5 font-bold ${row.status === 'posted' ? 'bg-emerald-50 text-emerald-900' : row.status === 'held' ? 'bg-amber-50 text-amber-900' : 'bg-stone-100 text-stone-600'}`}>{statusName(row.status)}</span>
        </li>
      ))}
      {requests.map((row) => (
        <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2 text-xs">
          <span>{kindName(row.kind)} · {row.detail}</span>
          <span className="font-mono" dir="ltr">{row.amountLabel} {row.currency}</span>
          <span className="rounded-lg bg-amber-50 px-2 py-0.5 font-bold text-amber-900">{statusName('requested')}</span>
        </li>
      ))}
    </ul>
  );
}
