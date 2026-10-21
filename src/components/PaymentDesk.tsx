import React, { useMemo, useState } from 'react';
import { Lock, ShieldCheck, Trash2 } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { countryPay } from '../bank/worldPay';
import { CardLiveMeter } from './CardLiveMeter';
import { deletePaymentMethod, getSavedPaymentMethods, setDefaultPaymentMethod, type PaymentProvider, type SavedPaymentMethod } from '../utils/customerPaymentVault';
import {
  cardBrand,
  cardEntryBlocked,
  inspectCardEntry,
  inspectCvc,
  inspectExpiry,
  inspectWalletEntry,
  walletEntryBlocked,
  walletLiveCopy,
  formatCardNumber,
  formatExpiry,
  registerCard,
  registerWallet,
  tokenizeCard,
  type CardBrand,
} from '../utils/paymentElement';

const BRAND_LABEL: Record<CardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'Amex',
  mada: 'mada',
  meeza: 'Meeza',
};

const PROVIDER: Record<string, PaymentProvider> = {
  instapay: 'instapay',
  fawry_voda: 'vodafone_cash',
  vodafone_cash: 'vodafone_cash',
  orange_cash: 'orange_cash',
  we_pay: 'we_pay',
  etisalat_cash: 'etisalat_cash',
  stc_pay: 'stc_pay',
  stcpay: 'stc_pay',
  tabby: 'tabby',
  tamara: 'tamara',
  valu: 'valu',
  apple_pay: 'apple_pay',
  google_pay: 'google_pay',
  apple_google: 'apple_pay',
};

function providerFor(id: string): PaymentProvider {
  return PROVIDER[id] || 'local';
}

function kindOf(id: string): 'express' | 'phone' | 'handle' | 'link' {
  if (id === 'apple_google' || id === 'apple_pay' || id === 'google_pay') return 'express';
  if (id.includes('instapay')) return 'handle';
  if (id.includes('cash') || id.includes('fawry') || id.includes('wallet') || id.includes('stc') || id.includes('pay')) return 'phone';
  return 'link';
}

/**
 * The customer payment desk. The field layout follows Stripe Checkout
 * (grouped number, MM/YY, security code, name, postal, save consent) and
 * Adyen Drop-in (card or wallet, express buttons with no card number).
 * A name is saved only after sign-in, and only as brand + last 4 + expiry.
 */
export function PaymentDesk({
  lang,
  country,
  customerId,
  customerName,
  onRequireAuth,
  onChange,
}: {
  lang: SupportedLanguage;
  country: string;
  customerId?: string;
  customerName?: string;
  onRequireAuth?: () => void;
  onChange?: (methods: SavedPaymentMethod[]) => void;
}) {
  const ar = lang === 'ar';
  const t = (a: string, e: string) => (ar ? a : e);
  const [methods, setMethods] = useState(() => (customerId ? getSavedPaymentMethods(customerId) : []));
  const [pane, setPane] = useState<'card' | 'wallet'>('card');
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState(customerName || '');
  const [postal, setPostal] = useState('');
  const [consent, setConsent] = useState(false);
  const [walletId, setWalletId] = useState('');
  const [walletValue, setWalletValue] = useState('');
  const [error, setError] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const digits = number.replace(/\D/g, '');
  const live = inspectCardEntry(number, expiry);
  const brand = live.brand || (digits.length >= 2 ? cardBrand(digits) : undefined);
  const cardBlocked = cardEntryBlocked(number, expiry);
  const expiryState = inspectExpiry(expiry);
  const cvcState = inspectCvc(cvc, brand);
  const ring = (state: string) => state === 'invalid' || state === 'expired' || state === 'dummy' ? 'border-red-400' : state === 'ok' || state === 'format_ok' ? 'border-sky-600' : 'border-stone-200';
  const row = useMemo(() => countryPay(country), [country]);
  const wallets = (row?.methods || []).filter((method) => method.kind !== 'card' && method.id !== 'visa' && method.id !== 'mastercard' && method.id !== 'amex');
  const selectedWallet = wallets.find((method) => method.id === walletId) || wallets[0];
  const walletKind = selectedWallet ? kindOf(selectedWallet.id) : 'phone';
  const walletMode = walletKind === 'handle' ? 'handle' : walletKind === 'express' ? 'express' : 'phone';
  const walletLive = inspectWalletEntry(walletValue, walletMode);
  const walletBlocked = selectedWallet ? walletEntryBlocked(walletValue, walletMode) : false;

  const refresh = (next: SavedPaymentMethod[]) => {
    setMethods(next);
    onChange?.(next);
  };

  const forgetCard = () => {
    setNumber('');
    setCvc('');
  };

  const saveCard = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSavedNote('');
    if (!customerId) {
      onRequireAuth?.();
      return;
    }
    try {
      const token = tokenizeCard({ number, expiry, cvc, name, postal });
      registerCard(customerId, token, consent);
      forgetCard();
      refresh(getSavedPaymentMethods(customerId));
      setSavedNote(t('تم حفظ البطاقة كرمز: النوع وآخر ٤ أرقام وتاريخ الانتهاء فقط.', 'Card saved as a token: brand, last 4 digits and expiry only.'));
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      const text: Record<string, [string, string]> = {
        INVALID_NUMBER: ['رقم البطاقة غير مقبول. راجع الأرقام.', 'That card number is not accepted. Check the digits.'],
        TEST_NUMBER: ['وهمية. رقم تجريبي، ولن يُحفظ كبطاقة عميل.', 'Dummy. A test number is not saved as a customer card.'],
        INVALID_EXPIRY: ['تاريخ الانتهاء غير صالح.', 'The expiry date is not valid.'],
        INVALID_CVC: ['رمز الأمان غير مكتمل.', 'The security code is incomplete.'],
        INVALID_NAME: ['اكتب الاسم كما هو على البطاقة.', 'Enter the name as it appears on the card.'],
        INVALID_POSTAL: ['الرمز البريدي غير صالح.', 'The postal code is not valid.'],
        CONSENT_REQUIRED: ['وافق على حفظ البطاقة لعملياتك القادمة.', 'Agree to save the card for your next payments.'],
        LOGIN_REQUIRED: ['سجّل الدخول أولاً.', 'Sign in first.'],
        TEST_WALLET: ['وهمية. لن تُحفظ كمحفظة عميل.', 'Dummy. This is not saved as a customer wallet.'],
      };
      const pair = text[code] || ['تعذّر حفظ البطاقة. الرقم ورمز الأمان لم يُحفظا.', 'The card could not be saved. The number and security code were not stored.'];
      setError(t(pair[0], pair[1]));
    }
  };

  const saveWallet = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSavedNote('');
    if (!customerId) {
      onRequireAuth?.();
      return;
    }
    if (!selectedWallet) {
      setError(t('لا توجد محفظة معتمدة لهذا البلد.', 'No wallet is listed for this country.'));
      return;
    }
    const mode = kindOf(selectedWallet.id);
    try {
      registerWallet(customerId, {
        provider: selectedWallet.id === 'apple_google' ? 'apple_pay' : providerFor(selectedWallet.id),
        title: selectedWallet.nameAr,
        titleEn: selectedWallet.nameEn,
        type: mode === 'handle' ? 'instapay' : mode === 'express' ? 'express' : mode === 'link' ? 'bnpl' : 'wallet',
        holderName: name || customerName || 'Customer',
        phone: mode === 'phone' ? walletValue : undefined,
        handle: mode === 'handle' ? walletValue : undefined,
        consent,
      });
      if (selectedWallet.id === 'apple_google') {
        registerWallet(customerId, {
          provider: 'google_pay',
          title: 'جوجل باي',
          titleEn: 'Google Pay',
          type: 'express',
          holderName: name || customerName || 'Customer',
          consent,
        });
      }
      setWalletValue('');
      refresh(getSavedPaymentMethods(customerId));
      setSavedNote(t('تم ربط المحفظة بالحساب. الرقم الكامل لا يُحفظ.', 'The wallet is linked to the account. The full number is not stored.'));
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      setError(code === 'CONSENT_REQUIRED'
        ? t('وافق على حفظ المحفظة لعملياتك القادمة.', 'Agree to save the wallet for your next payments.')
        : code === 'TEST_WALLET'
          ? t('وهمية. لن تُحفظ كمحفظة عميل.', 'Dummy. This is not saved as a customer wallet.')
          : t('بيانات المحفظة غير مكتملة.', 'The wallet details are incomplete.'));
    }
  };

  if (!customerId) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5 space-y-3" data-testid="payment-login-wall">
        <p className="flex items-center gap-2 text-sm font-bold text-stone-900"><Lock className="h-4 w-4" />{t('الدفع يتطلب تسجيل الدخول', 'Payment requires sign-in')}</p>
        <p className="text-xs leading-5 text-stone-600">{t('مثل Stripe وAdyen: لا تُسجَّل بطاقة أو محفظة، ولا يبدأ دفع، إلا من حساب داخل.', 'As with Stripe and Adyen: a card or wallet is saved, and a payment starts, only from a signed-in account.')}</p>
        <button type="button" onClick={onRequireAuth} className="w-full rounded-xl bg-stone-900 py-2.5 text-sm font-bold text-white" data-testid="payment-sign-in">{t('تسجيل الدخول', 'Sign in')}</button>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="payment-desk">
      <p className="flex items-start gap-2 text-[11px] leading-5 text-stone-500">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
        <span>{t('الحقول بنفس ترتيب Stripe Checkout. الرقم ورمز الأمان يُفحصان هنا ثم يُمسحان. شام يحفظ النوع وآخر ٤ أرقام وتاريخ الانتهاء فقط، وهذا ما يعرضه Adyen وStripe للتاجر.', 'Fields follow Stripe Checkout. The number and security code are checked here, then discarded. Sham stores only the brand, last 4 digits and expiry — the same display Stripe and Adyen give a merchant.')}</span>
      </p>

      <div className="space-y-2" data-testid="saved-payment-methods">
        <p className="text-xs font-bold text-stone-800">{t('الوسائل المحفوظة', 'Saved methods')}</p>
        {methods.length === 0 ? <p className="text-xs text-stone-500">{t('لا توجد وسيلة محفوظة على هذا الحساب.', 'No method is saved on this account.')}</p> : methods.map((method) => (
          <div key={method.id} className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-stone-900">{ar ? method.title : method.titleEn} <span className="font-mono">{method.identifier}</span></p>
              <p className="text-[11px] text-stone-500">{method.expiry || method.holderName}{method.isDefault ? ` · ${t('افتراضية', 'Default')}` : ''}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!method.isDefault && <button type="button" className="rounded-lg px-2 py-1 text-[11px] font-bold text-amber-900" onClick={() => { setDefaultPaymentMethod(method.id, customerId); refresh(getSavedPaymentMethods(customerId)); }}>{t('افتراضي', 'Default')}</button>}
              <button type="button" aria-label={t('حذف', 'Remove')} className="rounded-lg p-1.5 text-stone-500 hover:text-red-700" onClick={() => { deletePaymentMethod(method.id, customerId); refresh(getSavedPaymentMethods(customerId)); }}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 rounded-xl bg-stone-100 p-1 text-xs font-bold">
        <button type="button" className={`rounded-lg py-2 ${pane === 'card' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`} onClick={() => setPane('card')}>{t('بطاقة', 'Card')}</button>
        <button type="button" className={`rounded-lg py-2 ${pane === 'wallet' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`} onClick={() => setPane('wallet')}>{t('محفظة', 'Wallet')}</button>
      </div>

      {pane === 'card' ? (
        <form onSubmit={saveCard} className="space-y-3" data-testid="card-element">
          <label className="block space-y-1 text-xs font-semibold text-stone-700">
            <span>{t('الاسم على البطاقة', 'Name on card')}</span>
            <input required autoComplete="cc-name" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm" data-testid="card-name" />
          </label>
          <label className="block space-y-1 text-xs font-semibold text-stone-700">
            <span>{t('رقم البطاقة', 'Card number')}</span>
            <span className={`flex items-center rounded-xl border bg-white focus-within:border-stone-900 ${ring(live.verdict)}`}>
              <input required inputMode="numeric" autoComplete="cc-number" placeholder="1234 1234 1234 1234" value={number} onChange={(e) => setNumber(formatCardNumber(e.target.value))} className="w-full bg-transparent px-3 py-2.5 font-mono text-sm outline-none" data-testid="card-number" aria-describedby="desk-card-live" />
              <span className="pe-3 text-[11px] font-bold text-stone-500" data-testid="card-brand">{brand ? BRAND_LABEL[brand] : ''}</span>
            </span>
            <CardLiveMeter id="desk-card-live" number={number} expiry={expiry} lang={lang} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1 text-xs font-semibold text-stone-700">
              <span>{t('الانتهاء', 'Expiry')}</span>
              <input required inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))} className={`w-full rounded-xl border px-3 py-2.5 font-mono text-sm ${ring(expiryState)}`} data-testid="card-expiry" />
            </label>
            <label className="block space-y-1 text-xs font-semibold text-stone-700">
              <span>{t('رمز الأمان', 'Security code')}</span>
              <input required inputMode="numeric" autoComplete="cc-csc" placeholder={brand === 'amex' ? '1234' : '123'} value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))} className={`w-full rounded-xl border px-3 py-2.5 font-mono text-sm ${ring(cvcState)}`} data-testid="card-cvc" />
            </label>
          </div>
          <label className="block space-y-1 text-xs font-semibold text-stone-700">
            <span>{t('الرمز البريدي', 'Postal code')}</span>
            <input autoComplete="postal-code" value={postal} onChange={(e) => setPostal(e.target.value)} className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm" data-testid="card-postal" />
          </label>
          <label className="flex items-start gap-2 text-[11px] leading-5 text-stone-600">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" data-testid="card-consent" />
            <span>{t('احفظ هذه البطاقة لعملياتي القادمة على هذا الحساب. لا يُحفظ الرقم الكامل ولا رمز الأمان.', 'Save this card for my next payments on this account. The full number and security code are not stored.')}</span>
          </label>
          {error && <p className="text-xs text-red-700" role="alert">{error}</p>}
          {savedNote && <p className="text-xs text-emerald-800" role="status">{savedNote}</p>}
          <button type="submit" disabled={cardBlocked} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 py-2.5 text-sm font-bold text-white disabled:bg-stone-400" data-testid="save-card"><Lock className="h-4 w-4" />{t('حفظ البطاقة', 'Save card')}</button>
        </form>
      ) : (
        <form onSubmit={saveWallet} className="space-y-3" data-testid="wallet-element">
          {wallets.length === 0 ? <p className="text-xs text-stone-500">{t('لا توجد محفظة معتمدة لهذا البلد.', 'No wallet is listed for this country.')}</p> : (
            <fieldset className="space-y-2">
              <legend className="text-xs font-bold text-stone-800">{t('محافظ بلدك', 'Wallets in your country')}</legend>
              {wallets.map((method) => (
                <label key={method.id} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm">
                  <input type="radio" name="wallet" checked={(selectedWallet?.id || '') === method.id} onChange={() => { setWalletId(method.id); setWalletValue(''); }} />
                  <span>{ar ? method.nameAr : method.nameEn}</span>
                </label>
              ))}
            </fieldset>
          )}
          {selectedWallet && kindOf(selectedWallet.id) === 'express' && (
            <div className="grid grid-cols-2 gap-2">
              <button type="submit" className="rounded-xl bg-black py-2.5 text-xs font-bold text-white" data-testid="apple-pay-button">{t('متابعة مع Apple Pay', 'Continue with Apple Pay')}</button>
              <button type="submit" className="rounded-xl border border-stone-300 bg-white py-2.5 text-xs font-bold text-stone-900" data-testid="google-pay-button">{t('متابعة مع Google Pay', 'Continue with Google Pay')}</button>
            </div>
          )}
          {selectedWallet && kindOf(selectedWallet.id) === 'phone' && (
            <label className="block space-y-1 text-xs font-semibold text-stone-700">
              <span>{t('رقم المحفظة', 'Wallet number')}</span>
              <input required inputMode="tel" autoComplete="tel" value={walletValue} onChange={(e) => setWalletValue(e.target.value)} className={`w-full rounded-xl border px-3 py-2.5 text-sm ${ring(walletLive.verdict)}`} data-testid="wallet-phone" />
              <span className={`text-[11px] ${walletBlocked ? 'text-red-700' : 'text-sky-800'}`} role="status" data-testid="wallet-live-check" data-verdict={walletLive.verdict}>{walletLiveCopy(walletLive.verdict, lang)}</span>
            </label>
          )}
          {selectedWallet && kindOf(selectedWallet.id) === 'handle' && (
            <label className="block space-y-1 text-xs font-semibold text-stone-700">
              <span>{t('عنوان إنستا باي', 'InstaPay address')}</span>
              <input required autoComplete="username" placeholder="name@instapay" value={walletValue} onChange={(e) => setWalletValue(e.target.value)} className={`w-full rounded-xl border px-3 py-2.5 text-sm ${ring(walletLive.verdict)}`} data-testid="wallet-handle" />
              <span className={`text-[11px] ${walletBlocked ? 'text-red-700' : 'text-sky-800'}`} role="status" data-testid="wallet-live-check" data-verdict={walletLive.verdict}>{walletLiveCopy(walletLive.verdict, lang)}</span>
            </label>
          )}
          <label className="flex items-start gap-2 text-[11px] leading-5 text-stone-600">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" data-testid="wallet-consent" />
            <span>{t('اربط هذه المحفظة بحسابي. يُحفظ آخر ٤ أرقام أو اسم مستعار مختصر، لا الرقم الكامل.', 'Link this wallet to my account. Only the last 4 digits or a shortened alias are stored, not the full number.')}</span>
          </label>
          {error && <p className="text-xs text-red-700" role="alert">{error}</p>}
          {savedNote && <p className="text-xs text-emerald-800" role="status">{savedNote}</p>}
          {selectedWallet && kindOf(selectedWallet.id) !== 'express' && (
            <button type="submit" disabled={walletBlocked} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 py-2.5 text-sm font-bold text-white disabled:bg-stone-400" data-testid="save-wallet"><Lock className="h-4 w-4" />{t('حفظ المحفظة', 'Save wallet')}</button>
          )}
        </form>
      )}
    </div>
  );
}
