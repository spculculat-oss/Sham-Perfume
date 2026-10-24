import React, { useEffect, useState } from 'react';
import { Landmark, Send, Wallet, ArrowLeftRight, CreditCard } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { major } from '../finance/money';
import { getSavedPaymentMethods } from '../utils/customerPaymentVault';
import {
  ACCOUNT_CURRENCIES,
  RECEIVING_RAILS,
  balanceAfterRequests,
  listAccountRequests,
  listWithdrawalBanks,
  recordedBalance,
  requestAccountAction,
  saveWithdrawalBank,
  type AccountRequest,
  type ReceivingRail,
  type RecordedBalance,
  type WithdrawalBank,
} from '../bank/shamAccount';

type Pane = 'home' | 'receive' | 'activity' | 'withdraw' | 'pay' | 'card';

/**
 * Owner and signed-in account home. Same rooms as a multi-currency receiving
 * account: balances, receiving rails, activity, withdraw, pay, card.
 * Every action stays requested. No bank number is invented and no money moves.
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
  const [pane, setPane] = useState<Pane>('home');
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [banks, setBanks] = useState<WithdrawalBank[]>([]);
  const [currency, setCurrency] = useState('USD');
  const [amount, setAmount] = useState('');
  const [nickname, setNickname] = useState('');
  const [country, setCountry] = useState('');
  const [last4, setLast4] = useState('');
  const [bankId, setBankId] = useState('');
  const [target, setTarget] = useState('');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const cards = getSavedPaymentMethods(customerId).filter((method) => method.type === 'card');

  const reload = () => {
    setRequests(listAccountRequests(customerId));
    setBanks(listWithdrawalBanks(customerId));
  };
  useEffect(() => {
    reload();
    const sync = () => reload();
    window.addEventListener('sham-account-updated', sync);
    return () => window.removeEventListener('sham-account-updated', sync);
  }, [customerId]);

  const money = (minor: number, code: string) => {
    try { return new Intl.NumberFormat(ar ? 'ar-EG' : 'en', { style: 'currency', currency: code }).format(major(minor, code)); }
    catch { return `${minor} ${code}`; }
  };
  const kindName = (kind: AccountRequest['kind']) => ({
    withdraw: t('سحب إلى بنك', 'Withdraw to bank'),
    convert: t('تحويل بين الأرصدة', 'Move between balances'),
    pay: t('دفع لحساب شام', 'Pay a Sham account'),
    card: t('طلب بطاقة', 'Card request'),
    receiving: t('طلب تفاصيل استقبال', 'Receiving-details request'),
  }[kind]);

  const act = (work: () => void, done: string) => {
    setError('');
    try { work(); setNotice(done); reload(); }
    catch (err) {
      const code = err instanceof Error ? err.message : '';
      const text: Record<string, [string, string]> = {
        INVALID_AMOUNT: ['اكتب مبلغاً صالحاً.', 'Enter a valid amount.'],
        INVALID_CURRENCY: ['هذه العملة ليست من أرصدة الحساب.', 'That currency is not an account balance.'],
        INVALID_LABEL: ['الاسم قصير أو غير مقبول.', 'The name is too short or not accepted.'],
        INVALID_LAST4: ['اكتب آخر ٤ أرقام فقط.', 'Enter only the last 4 digits.'],
        SECRET: ['لا تكتب رقم حساب كاملاً أو رمزاً سرياً.', 'Do not enter a full account number or a secret.'],
        LOGIN_REQUIRED: ['سجّل الدخول أولاً.', 'Sign in first.'],
      };
      const pair = text[code] || ['لم يُحفظ الطلب.', 'The request was not saved.'];
      setError(t(pair[0], pair[1]));
    }
  };

  const panes: [Pane, string, string][] = [
    ['home', 'الرئيسية', 'Home'],
    ['receive', 'استلام', 'Get paid'],
    ['activity', 'الحركة', 'Transactions'],
    ['withdraw', 'سحب', 'Withdraw'],
    ['pay', 'دفع', 'Pay'],
    ['card', 'البطاقة', 'Card'],
  ];

  return (
    <div className="rounded-3xl border border-stone-200 bg-white text-stone-900 shadow-sm" data-testid="sham-account-desk">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 p-4 sm:p-5">
        <div>
          <p className="text-[11px] font-bold text-amber-800">{t('حساب متعدد العملات', 'Multi-currency account')}</p>
          <h2 className="mt-1 flex items-center gap-2 text-xl font-black"><Landmark className="h-5 w-5" />{t('بنك شام', 'Sham Bank')}</h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-stone-500">{t('نفس غرف حساب الاستقبال العالمي: أرصدة، تفاصيل استقبال، حركة، سحب، دفع، وبطاقة. بنك شام ليس Payoneer، ولا يخترع رقم حساب، ولا ينقل مالاً.', 'The same rooms as a global receiving account: balances, receiving details, activity, withdraw, pay, and a card. Sham Bank is not Payoneer, invents no account number, and moves no money.')}</p>
        </div>
        {onClose && <button type="button" onClick={onClose} className="text-xs font-bold text-stone-500 underline">{t('إغلاق', 'Close')}</button>}
      </header>
      <div className="flex gap-1 overflow-x-auto border-b border-stone-100 px-3 py-2" role="tablist">
        {panes.map(([id, a, e]) => (
          <button key={id} type="button" role="tab" aria-selected={pane === id} onClick={() => { setPane(id); setError(''); setNotice(''); }} className={`rounded-xl px-3 py-1.5 text-xs font-bold ${pane === id ? 'bg-stone-900 text-white' : 'text-stone-600'}`}>{t(a, e)}</button>
        ))}
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-900">{notice}</p>}

        {pane === 'home' && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid="sham-balances">
            {ACCOUNT_CURRENCIES.map((code) => {
              const minor = balanceAfterRequests(recordedBalance(recorded, code), requests);
              return (
                <button key={code} type="button" onClick={() => { setCurrency(code); setPane('withdraw'); }} className="rounded-2xl border border-stone-200 p-3 text-start hover:border-stone-900">
                  <p className="text-[11px] font-bold text-stone-500">{code}</p>
                  <p className="mt-2 font-mono text-lg font-black" dir="ltr">{money(minor, code)}</p>
                  <p className="mt-1 text-[10px] text-stone-500">{t('رصيد مسجّل. الطلبات لا تخصمه.', 'Recorded balance. Requests do not reduce it.')}</p>
                </button>
              );
            })}
          </div>
        )}

        {pane === 'receive' && (
          <div className="space-y-2" data-testid="sham-receiving-accounts">
            <p className="text-xs text-stone-500">{t('تفاصيل الاستقبال تُعرض فقط بعد إصدارها من بنك شريك. لا يظهر هنا رقم حساب أو آيبان.', 'Receiving details appear only after a partner bank issues them. No account number or IBAN is shown here.')}</p>
            {RECEIVING_RAILS.map((rail) => <RailRow key={rail.id} rail={rail} ar={ar} onAsk={() => act(() => requestAccountAction(customerId, { kind: 'receiving', currency: rail.currency, detail: rail.networkEn }), t('طُلب إصدار التفاصيل. لم يُنشأ رقم حساب.', 'Issuance was requested. No account number was created.'))} />)}
          </div>
        )}

        {pane === 'activity' && (
          <Activity rows={requests} empty={t('لا توجد حركة بعد. الطلبات تظهر هنا بحالة «مطلوب» فقط.', 'No activity yet. Requests appear here as requested only.')} kindName={kindName} requested={t('مطلوب', 'Requested')} />
        )}

        {pane === 'withdraw' && (
          <form className="grid gap-2 sm:grid-cols-2" data-testid="sham-withdraw" onSubmit={(e) => { e.preventDefault(); const bank = banks.find((row) => row.id === bankId); act(() => requestAccountAction(customerId, { kind: 'withdraw', currency, amountLabel: amount, detail: bank ? bank.nickname : t('بدون بنك محفوظ', 'No saved bank') }), t('طُلب السحب. لم يُرسل المال.', 'Withdrawal requested. No money was sent.')); }}>
            <select aria-label={t('العملة', 'Currency')} value={currency} onChange={(e) => setCurrency(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">{ACCOUNT_CURRENCIES.map((code) => <option key={code}>{code}</option>)}</select>
            <input inputMode="decimal" placeholder={t('المبلغ', 'Amount')} value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" data-testid="sham-withdraw-amount" />
            <select aria-label={t('بنك السحب', 'Withdrawal bank')} value={bankId} onChange={(e) => setBankId(e.target.value)} className="rounded-xl border px-3 py-2 text-sm sm:col-span-2">
              <option value="">{t('بدون بنك محفوظ بعد', 'No saved bank yet')}</option>
              {banks.filter((bank) => bank.currency === currency).map((bank) => <option key={bank.id} value={bank.id}>{bank.nickname} · •••• {bank.last4}</option>)}
            </select>
            <button type="submit" className="rounded-xl bg-stone-900 py-2 text-sm font-bold text-white sm:col-span-2">{t('سجّل طلب السحب', 'Record the withdrawal request')}</button>
            <div className="grid gap-2 sm:col-span-2 sm:grid-cols-4">
              <input placeholder={t('اسم البنك', 'Bank nickname')} value={nickname} onChange={(e) => setNickname(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" />
              <input placeholder={t('البلد', 'Country')} value={country} onChange={(e) => setCountry(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" />
              <input inputMode="numeric" placeholder={t('آخر ٤', 'Last 4')} value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} className="rounded-xl border px-3 py-2 text-sm" data-testid="sham-bank-last4" />
              <button type="button" className="rounded-xl border py-2 text-xs font-bold" onClick={() => act(() => { saveWithdrawalBank(customerId, { nickname, currency, country, last4 }); setNickname(''); setLast4(''); }, t('حُفظ الاسم وآخر ٤ أرقام فقط.', 'Saved the nickname and last 4 only.'))}>{t('احفظ بنك السحب', 'Save withdrawal bank')}</button>
            </div>
          </form>
        )}

        {pane === 'pay' && (
          <form className="grid gap-2 sm:grid-cols-2" data-testid="sham-pay" onSubmit={(e) => { e.preventDefault(); act(() => requestAccountAction(customerId, { kind: 'pay', currency, amountLabel: amount, detail: target }), t('طُلب الدفع. لم يُحوَّل المبلغ.', 'Payment requested. The amount was not transferred.')); }}>
            <input placeholder={t('اسم حساب شام', 'Sham account name')} value={target} onChange={(e) => setTarget(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" />
            <input inputMode="decimal" placeholder={t('المبلغ', 'Amount')} value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" />
            <select aria-label={t('من رصيد', 'From balance')} value={currency} onChange={(e) => setCurrency(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">{ACCOUNT_CURRENCIES.map((code) => <option key={code}>{code}</option>)}</select>
            <button type="submit" className="inline-flex items-center justify-center gap-1 rounded-xl bg-stone-900 py-2 text-sm font-bold text-white"><Send className="h-4 w-4" />{t('سجّل طلب الدفع', 'Record the pay request')}</button>
          </form>
        )}

        {pane === 'card' && (
          <div className="space-y-2" data-testid="sham-card-slot">
            <p className="text-xs text-stone-500">{t('بطاقة السحب تُربط لاحقاً برصيد عملة. لا يُكتب رقم البطاقة هنا.', 'A spending card is linked to a currency balance later. The card number is not typed here.')}</p>
            {cards.length === 0 ? <p className="text-xs text-stone-500">{t('لا توجد بطاقة محفوظة على الحساب.', 'No card is saved on the account.')}</p> : cards.map((card) => (
              <p key={card.id} className="rounded-xl border px-3 py-2 text-sm"><CreditCard className="me-1 inline h-4 w-4" />{ar ? card.title : card.titleEn} <span className="font-mono">{card.identifier}</span> {card.expiry || ''}</p>
            ))}
            <button type="button" className="rounded-xl bg-stone-900 px-3 py-2 text-sm font-bold text-white" onClick={() => act(() => requestAccountAction(customerId, { kind: 'card', currency, detail: t('ربط بطاقة بالرصيد', 'Link a card to the balance') }), t('طُلبت البطاقة. لم تُصدر ولم يُحفظ رقم.', 'The card was requested. None was issued and no number was stored.'))}>{t('اطلب ربط بطاقة بالرصيد', 'Request a card linked to the balance')}</button>
            <form className="grid gap-2 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); act(() => requestAccountAction(customerId, { kind: 'convert', currency, amountLabel: amount, detail: toCurrency }), t('طُلب التحويل بين الأرصدة. لم يُنفَّذ.', 'A balance move was requested. It was not executed.')); }}>
              <select aria-label={t('من', 'From')} value={currency} onChange={(e) => setCurrency(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">{ACCOUNT_CURRENCIES.map((code) => <option key={code}>{code}</option>)}</select>
              <select aria-label={t('إلى', 'To')} value={toCurrency} onChange={(e) => setToCurrency(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">{ACCOUNT_CURRENCIES.map((code) => <option key={code}>{code}</option>)}</select>
              <input inputMode="decimal" placeholder={t('المبلغ', 'Amount')} value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" />
              <button type="submit" className="inline-flex items-center justify-center gap-1 rounded-xl border py-2 text-sm font-bold sm:col-span-3"><ArrowLeftRight className="h-4 w-4" />{t('سجّل طلب التحويل بين الأرصدة', 'Record a balance-move request')}</button>
            </form>
          </div>
        )}

        {pane === 'home' && <Activity rows={requests.slice(0, 3)} empty={t('ابدأ من استلام أو سحب. كل عملية تبقى مطلوبة.', 'Start from Get paid or Withdraw. Every action stays requested.')} kindName={kindName} requested={t('مطلوب', 'Requested')} />}
        <p className="flex items-start gap-2 text-[10px] leading-4 text-stone-500"><Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t('الرصيد المعروض هو ما سُجّل في الدفتر فقط. طلب السحب أو الدفع أو البطاقة لا يغيّره ولا يُعلَّم منفَّذاً.', 'The balance shown is only what the ledger recorded. A withdraw, pay, or card request does not change it and is not marked done.')}</p>
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

function Activity({ rows, empty, kindName, requested }: { rows: AccountRequest[]; empty: string; kindName: (kind: AccountRequest['kind']) => string; requested: string }) {
  if (!rows.length) return <p className="text-xs text-stone-500" data-testid="sham-activity-empty">{empty}</p>;
  return (
    <ul className="space-y-1" data-testid="sham-activity">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2 text-xs">
          <span>{kindName(row.kind)} · {row.detail}</span>
          <span className="font-mono" dir="ltr">{row.amountLabel} {row.currency}</span>
          <span className="rounded-lg bg-amber-50 px-2 py-0.5 font-bold text-amber-900">{requested}</span>
        </li>
      ))}
    </ul>
  );
}
