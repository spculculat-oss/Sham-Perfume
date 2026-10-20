import React from 'react';
import { CreditCard, X } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../لغات/localizedContent';
import { countryOptions, useStoreCountry } from '../utils/storeCheckout';
import { PaymentDesk } from './PaymentDesk';

interface Props {
  currentLang?: SupportedLanguage;
  customerId?: string;
  customerName?: string;
  onClose: () => void;
  onRequireAuth?: () => void;
}

/** Signed-in card and wallet desk. No charge is marked paid from this window. */
export const PaymentEnvironmentModal: React.FC<Props> = ({ currentLang = 'ar', customerId, customerName, onClose, onRequireAuth }) => {
  const ar = currentLang === 'ar';
  const [country, setCountry] = useStoreCountry();
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="payment-info-title" dir={isRTL(currentLang) ? 'rtl' : 'ltr'} className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} data-testid="payment-environment">
        <header className="flex items-center justify-between gap-3">
          <h2 id="payment-info-title" className="flex items-center gap-2 text-lg font-bold"><CreditCard className="h-5 w-5" />{ar ? 'بطاقاتي ومحافظي' : 'My cards and wallets'}</h2>
          <button type="button" onClick={onClose} aria-label={ar ? 'إغلاق' : 'Close'} className="rounded-full p-2 hover:bg-stone-100"><X className="h-5 w-5" /></button>
        </header>
        <label className="block space-y-1 text-sm">
          <span>{ar ? 'بلد الشحن' : 'Shipping country'}</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)} className="w-full rounded-xl border p-2" data-testid="payment-country">
            {countryOptions(currentLang).map((c) => <option value={c.code} key={c.code}>{c.name}</option>)}
          </select>
        </label>
        <PaymentDesk lang={currentLang} country={country} customerId={customerId} customerName={customerName} onRequireAuth={onRequireAuth} />
      </section>
    </div>
  );
};
