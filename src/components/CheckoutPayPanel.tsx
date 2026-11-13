import React, { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { getSavedPaymentMethods, type SavedPaymentMethod } from '../utils/customerPaymentVault';
import {
  cardBrand,
  cardEntryBlocked,
  formatCardNumber,
  formatExpiry,
  inspectCardEntry,
  inspectCvc,
  inspectExpiry,
  inspectWalletEntry,
  savedCardExpired,
  walletEntryBlocked,
  walletLiveCopy,
  listInstrumentPulls,
  registerCard,
  registerWallet,
  renewCardExpiry,
  requestInstrumentPull,
  tokenizeCard,
  type CardBrand,
  type InstrumentPull,
} from '../utils/paymentElement';
import { countryPay } from '../bank/worldPay';
import { CardLiveMeter } from './CardLiveMeter';
import type { PaymentProvider } from '../utils/customerPaymentVault';

const BRAND_LABEL: Record<CardBrand, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', mada: 'mada', meeza: 'Meeza' };
const PROVIDER: Record<string, PaymentProvider> = {
  instapay: 'instapay', fawry_voda: 'vodafone_cash', stc_pay: 'stc_pay', stcpay: 'stc_pay',
  tabby: 'tabby', tamara: 'tamara', valu: 'valu', apple_pay: 'apple_pay', google_pay: 'google_pay', apple_google: 'apple_pay',
};

/**
 * Live checkout fields: save a card or wallet on the signed-in account, reuse it,
 * renew its expiry, or request a wallet pull. The store e-mail is not this panel.
 */
export function CheckoutPayPanel({
  lang,
  country,
  customerId,
  customerName,
  amountLabel,
  onStoreEmail,
}: {
  lang: SupportedLanguage;
  country: string;
  customerId: string;
  customerName?: string;
  amountLabel: string;
  onStoreEmail: () => void;
}) {
  const ar = lang === 'ar';
  const t = (a: string, e: string) => (ar ? a : e);
  const [methods, setMethods] = useState<SavedPaymentMethod[]>(() => getSavedPaymentMethods(customerId));
  const [pulls, setPulls] = useState<InstrumentPull[]>(() => listInstrumentPulls(customerId));
  const [selected, setSelected] = useState('');
  const [renewId, setRenewId] = useState('');
  const [renewExpiry, setRenewExpiry] = useState('');
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState(customerName || '');
  const [consent, setConsent] = useState(true);
  const [walletValue, setWalletValue] = useState('');
  const [walletId, setWalletId] = useState('');
  const [useCvc, setUseCvc] = useState('');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<InstrumentPull | null>(null);
  const digits = number.replace(/\D/g, '');
  const live = inspectCardEntry(number, expiry);
  const brand = live.brand || (digits.length >= 2 ? cardBrand(digits) : undefined);
  const cardBlocked = cardEntryBlocked(number, expiry);
  const expiryState = inspectExpiry(expiry);
  const cvcState = inspectCvc(cvc, brand);
  const wallets = (countryPay(country)?.methods || []).filter((method) => method.kind !== 'card' && !['visa', 'mastercard', 'amex'].includes(method.id));
  const wallet = wallets.find((method) => method.id === walletId) || wallets[0];
  const walletKind = !wallet ? 'phone' : wallet.id.includes('instapay') ? 'handle' : wallet.id === 'apple_google' ? 'express' : 'phone';
  const walletLive = inspectWalletEntry(walletValue, walletKind);
  const walletBlocked = wallet ? walletEntryBlocked(walletValue, walletKind) : false;
  const selectedSaved = methods.find((method) => method.id === selected);
  const selectedExpired = Boolean(selectedSaved && selectedSaved.type === 'card' && savedCardExpired(selectedSaved.expiry));
  const ring = (state: string) => state === 'invalid' || state === 'expired' || state === 'dummy' ? 'border-red-400' : state === 'ok' || state === 'format_ok' ? 'border-sky-600' : 'border-stone-200';

  const reload = () => {
    const next = getSavedPaymentMethods(customerId);
    setMethods(next);
    setPulls(listInstrumentPulls(customerId));
    setSelected((current) => current || next.find((method) => method.isDefault)?.id || next[0]?.id || '');
  };
  useEffect(() => {
    reload();
    const sync = () => reload();
    window.addEventListener('sham-payment-methods-updated', sync);
    return () => window.removeEventListener('sham-payment-methods-updated', sync);
  }, [customerId]);

  const useSaved = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const method = methods.find((row) => row.id === selected);
    if (!method) { setError(t('اختر وسيلة محفوظة أو سجّل واحدة.', 'Choose a saved method or register one.')); return; }
    if (method.type === 'card' && savedCardExpired(method.expiry)) {
      setError(t('هذه البطاقة غير مفعّلة. جدّد التاريخ أولاً.', 'This card is not active. Renew the expiry first.'));
      return;
    }
    if (method.type === 'card' && useCvc.replace(/\D/g, '').length < 3) {
      setError(t('اكتب رمز الأمان لهذه العملية. لا يُحفظ.', 'Enter the security code for this payment. It is not saved.'));
      return;
    }
    try {
      const pull = requestInstrumentPull(customerId, method.id, amountLabel);
      setUseCvc('');
      setReceipt(pull);
      reload();
    } catch {
      setError(t('تعذّر تسجيل استخدام الوسيلة.', 'The saved method could not be used.'));
    }
  };

  const saveCard = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      const token = tokenizeCard({ number, expiry, cvc, name });
      const saved = registerCard(customerId, token, consent);
      setNumber('');
      setCvc('');
      const pull = requestInstrumentPull(customerId, saved.id, amountLabel);
      setReceipt(pull);
      reload();
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      const text: Record<string, [string, string]> = {
        INVALID_NUMBER: ['رقم البطاقة غير مقبول.', 'That card number is not accepted.'],
        TEST_NUMBER: ['وهمية. رقم تجريبي، ولن يُحفظ كبطاقة عميل.', 'Dummy. A test number is not saved as a customer card.'],
        INVALID_EXPIRY: ['تاريخ الانتهاء غير صالح.', 'The expiry date is not valid.'],
        INVALID_CVC: ['رمز الأمان غير مكتمل.', 'The security code is incomplete.'],
        INVALID_NAME: ['اكتب الاسم كما هو على البطاقة.', 'Enter the name on the card.'],
        CONSENT_REQUIRED: ['وافق على حفظ البطاقة في حسابك.', 'Agree to save the card on your account.'],
      };
      const pair = text[code] || ['لم تُحفظ البطاقة.', 'The card was not saved.'];
      setError(t(pair[0], pair[1]));
    }
  };

  const saveWalletAndPull = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!wallet) { setError(t('لا توجد محفظة لهذا البلد.', 'No wallet is listed for this country.')); return; }
    const phone = wallet.id.includes('instapay') || wallet.id === 'apple_google' ? undefined : walletValue;
    const handle = wallet.id.includes('instapay') ? walletValue : undefined;
    try {
      const saved = registerWallet(customerId, {
        provider: PROVIDER[wallet.id] || 'local',
        title: wallet.nameAr,
        titleEn: wallet.nameEn,
        type: wallet.id.includes('instapay') ? 'instapay' : wallet.id === 'apple_google' ? 'express' : 'wallet',
        holderName: name || customerName || 'Customer',
        phone,
        handle,
        consent,
      });
      setWalletValue('');
      const pull = requestInstrumentPull(customerId, saved.id, amountLabel);
      setReceipt(pull);
      reload();
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      setError(code === 'TEST_WALLET'
        ? t('وهمية. لن تُحفظ كمحفظة عميل.', 'Dummy. This is not saved as a customer wallet.')
        : t('بيانات المحفظة غير مكتملة. آخر ٤ أرقام فقط هي التي تُحفظ.', 'The wallet details are incomplete. Only the last 4 digits are stored.'));
    }
  };

  const renew = (id: string) => {
    setError('');
    try {
      renewCardExpiry(customerId, id, renewExpiry);
      setRenewId('');
      setRenewExpiry('');
      reload();
    } catch {
      setError(t('تاريخ التجديد غير صالح.', 'The renewal date is not valid.'));
    }
  };

  return (
    <div className="space-y-3" data-testid="checkout-pay-panel">
      <p className="text-xs font-bold text-stone-900">{t('الدفع من حسابك', 'Pay from your account')} · {amountLabel}</p>
      <form onSubmit={useSaved} className="space-y-2 rounded-xl border border-stone-200 bg-white p-3" data-testid="saved-checkout-methods">
        <p className="text-[11px] font-bold text-stone-700">{t('الوسائل المحفوظة على حسابك', 'Methods saved on your account')}</p>
        {methods.length === 0 ? <p className="text-[11px] text-stone-500">{t('لا توجد وسيلة محفوظة بعد. سجّل بطاقة أو محفظة بالأسفل.', 'Nothing is saved yet. Register a card or wallet below.')}</p> : methods.map((method) => (
          <div key={method.id} className="rounded-lg border border-stone-100 px-2 py-1.5">
            <label className="flex items-center gap-2 text-xs">
              <input type="radio" name="saved-method" checked={selected === method.id} onChange={() => setSelected(method.id)} />
              <span className="font-bold">{ar ? method.title : method.titleEn}</span>
              <span className="font-mono">{method.identifier}</span>
              {method.expiry && <span className="text-stone-500">{method.expiry}</span>}
              {method.type === 'card' && savedCardExpired(method.expiry) && <span className="font-bold text-red-700">{t('غير مفعّلة', 'Not active')}</span>}
            </label>
            {method.type === 'card' && (
              <button type="button" className="mt-1 text-[11px] font-bold text-amber-900" onClick={() => setRenewId(method.id)} data-testid={`renew-${method.id}`}>{t('تجديد التاريخ', 'Renew expiry')}</button>
            )}
            {renewId === method.id && (
              <div className="mt-1 flex gap-1">
                <input inputMode="numeric" placeholder="MM/YY" value={renewExpiry} onChange={(e) => setRenewExpiry(formatExpiry(e.target.value))} className="w-24 rounded-lg border px-2 py-1 font-mono text-xs" data-testid="renew-expiry" />
                <button type="button" className="rounded-lg bg-stone-900 px-2 py-1 text-[11px] font-bold text-white" onClick={() => renew(method.id)}>{t('حفظ التجديد', 'Save renewal')}</button>
              </div>
            )}
          </div>
        ))}
        {methods.some((method) => method.id === selected && method.type === 'card') && (
          <label className="block space-y-1 text-[11px] font-semibold text-stone-700">
            <span>{t('رمز الأمان لهذه العملية فقط', 'Security code for this payment only')}</span>
            <input required inputMode="numeric" autoComplete="cc-csc" value={useCvc} onChange={(e) => setUseCvc(e.target.value.replace(/\D/g, '').slice(0, 4))} className="w-full rounded-lg border px-2 py-1.5 font-mono text-sm" data-testid="reuse-cvc" />
          </label>
        )}
        <button type="submit" disabled={selectedExpired} className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-emerald-700 py-2.5 text-sm font-bold text-white disabled:bg-stone-400" data-testid="use-saved-method"><Lock className="h-3.5 w-3.5" />{t('استخدم الوسيلة المحفوظة', 'Use the saved method')}</button>
        <p className="text-[10px] leading-4 text-stone-500">{t('الاستخدام يُسجَّل طلباً. لا يُخصم المبلغ من البطاقة أو المحفظة.', 'Use is recorded as a request. The card or wallet is not charged.')}</p>
      </form>

      <form onSubmit={saveCard} className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/40 p-3" data-testid="checkout-card-fields">
        <p className="text-[11px] font-bold text-stone-800">{t('بطاقة جديدة — خانات فعّالة', 'New card — live fields')}</p>
        <input required autoComplete="cc-name" placeholder={t('الاسم على البطاقة', 'Name on card')} value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border bg-white px-2 py-1.5 text-xs" data-testid="checkout-card-name" />
        <span className={`flex items-center rounded-lg border bg-white ${ring(live.verdict)}`}>
          <input required inputMode="numeric" autoComplete="cc-number" placeholder="1234 1234 1234 1234" value={number} onChange={(e) => setNumber(formatCardNumber(e.target.value))} className="w-full bg-transparent px-2 py-1.5 font-mono text-xs outline-none" data-testid="checkout-card-number" aria-describedby="checkout-card-live" />
          <span className="pe-2 text-[10px] font-bold text-stone-500">{brand ? BRAND_LABEL[brand] : ''}</span>
        </span>
        <CardLiveMeter id="checkout-card-live" number={number} expiry={expiry} lang={lang} />
        <div className="grid grid-cols-2 gap-2">
          <input required inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))} className={`rounded-lg border bg-white px-2 py-1.5 font-mono text-xs ${ring(expiryState)}`} data-testid="checkout-card-expiry" />
          <input required inputMode="numeric" autoComplete="cc-csc" placeholder={t('رمز الأمان', 'Security code')} value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))} className={`rounded-lg border bg-white px-2 py-1.5 font-mono text-xs ${ring(cvcState)}`} data-testid="checkout-card-cvc" />
        </div>
        {expiryState === 'expired' && <p className="text-[11px] text-red-700" role="status">{t('غير مفعّلة. تاريخ الانتهاء انتهى.', 'Not active. The expiry date has passed.')}</p>}
        {expiryState === 'invalid' && <p className="text-[11px] text-red-700" role="status">{t('تاريخ الانتهاء غير صالح.', 'The expiry date is not valid.')}</p>}
        <label className="flex items-start gap-2 text-[11px] text-stone-600">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="checkout-card-consent" />
          <span>{t('احفظ البطاقة في سجل حسابي للشراء القادم. الرقم ورمز الأمان لا يُحفظان.', 'Save the card on my account for the next purchase. The number and security code are not stored.')}</span>
        </label>
        <button type="submit" disabled={cardBlocked} className="w-full rounded-xl bg-stone-900 py-2 text-xs font-bold text-white disabled:bg-stone-400" data-testid="checkout-save-card">{t('احفظ البطاقة واستخدمها', 'Save the card and use it')}</button>
      </form>

      <form onSubmit={saveWalletAndPull} className="space-y-2 rounded-xl border border-stone-200 bg-white p-3" data-testid="checkout-wallet-pull">
        <p className="text-[11px] font-bold text-stone-800">{t('سحب من محفظة إلكترونية', 'Pull from an electronic wallet')}</p>
        {wallets.length === 0 ? <p className="text-[11px] text-stone-500">{t('لا توجد محفظة لهذا البلد.', 'No wallet is listed for this country.')}</p> : (
          <select value={wallet?.id || ''} onChange={(e) => setWalletId(e.target.value)} className="w-full rounded-lg border px-2 py-1.5 text-xs" data-testid="checkout-wallet-select">
            {wallets.map((method) => <option key={method.id} value={method.id}>{ar ? method.nameAr : method.nameEn}</option>)}
          </select>
        )}
        {wallet && wallet.id !== 'apple_google' && (
          <>
            <input required value={walletValue} onChange={(e) => setWalletValue(e.target.value)} placeholder={wallet.id.includes('instapay') ? 'name@instapay' : t('رقم المحفظة', 'Wallet number')} className={`w-full rounded-lg border px-2 py-1.5 text-xs ${ring(walletLive.verdict)}`} data-testid="checkout-wallet-value" />
            <p className={`text-[11px] ${walletBlocked ? 'text-red-700' : 'text-sky-800'}`} role="status" data-testid="wallet-live-check" data-verdict={walletLive.verdict}>{walletLiveCopy(walletLive.verdict, lang)}</p>
          </>
        )}
        <button type="submit" disabled={walletBlocked} className="w-full rounded-xl bg-stone-900 py-2 text-xs font-bold text-white disabled:bg-stone-400" data-testid="checkout-wallet-pull-submit">{t('اطلب السحب من المحفظة', 'Request the wallet pull')} · {amountLabel}</button>
        <p className="text-[10px] leading-4 text-stone-500">{t('الطلب يُسجَّل على حسابك بانتظار تأكيد المحفظة. لا يُحسب المبلغ مسحوباً قبل ذلك.', 'The request is saved on your account until the wallet confirms it. The amount is not treated as pulled before that.')}</p>
      </form>

      {error && <p className="text-xs text-red-700" role="alert">{error}</p>}
      {receipt && (
        <p className="rounded-lg bg-emerald-50 px-2 py-1.5 text-xs text-emerald-900" role="status" data-testid="instrument-pull-receipt">
          {t('تم تسجيل الطلب', 'Request recorded')} {receipt.orderRef} · {receipt.display} · {receipt.amountLabel}. {t('لم يُخصم بعد.', 'Not collected yet.')}
        </p>
      )}
      {pulls.length > 0 && (
        <ul className="space-y-1 text-[10px] text-stone-500" data-testid="instrument-pull-history">
          {pulls.slice(0, 3).map((pull) => <li key={pull.id}>{pull.orderRef} · {pull.display} · {pull.amountLabel}</li>)}
        </ul>
      )}
      <button type="button" onClick={onStoreEmail} className="w-full py-1.5 text-[11px] text-stone-500 underline" data-testid="store-email-last">{t('إذا تعذر الخصم: أرسل الطلب للمتجر', 'If the pull cannot be made: send the order to the store')}</button>
    </div>
  );
}
