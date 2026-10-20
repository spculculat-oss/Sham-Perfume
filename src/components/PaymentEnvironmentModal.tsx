import React, { useState } from 'react';
import { CreditCard, ShieldCheck, Trash2, X } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../لغات/localizedContent';
import { getSavedPaymentMethods, deletePaymentMethod, type SavedPaymentMethod } from '../utils/customerPaymentVault';
import { ProductPayMethods } from '../bank/ProductPayMethods';
import { countryOptions, usePayments, useStoreCountry } from '../utils/storeCheckout';
interface Props {
  currentLang?: SupportedLanguage; customerId?: string; customerName?: string; onClose: () => void;
  onSelectMethod?: (method: SavedPaymentMethod) => void; selectableMode?: boolean;
}
/** No card fields, fabricated approval, invented authorizations, or local 'payment success' history. */
export const PaymentEnvironmentModal: React.FC<Props> = ({ currentLang = 'ar', customerId, onClose }) => {
  const ar = currentLang === 'ar';
  const [country, setCountry] = useStoreCountry();
  const payments = usePayments(country);
  const [aliases, setAliases] = useState(() => getSavedPaymentMethods(customerId));
  return <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="payment-info-title" dir={isRTL(currentLang) ? 'rtl' : 'ltr'} className="max-w-lg w-full rounded-3xl bg-white p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
      <header className="flex items-center justify-between gap-3"><h2 id="payment-info-title" className="font-bold text-lg flex items-center gap-2"><CreditCard className="w-5 h-5" />{ar ? 'الدفع في متجر شام' : 'Payments at Sham'}</h2><button onClick={onClose} aria-label={ar ? 'إغلاق' : 'Close'} className="p-2 rounded-full hover:bg-stone-100"><X className="w-5 h-5" /></button></header>
      <p className="text-sm text-stone-600">{ar ? 'المتاح فعلياً يحدده بلدك والعملة وعقد حساب التاجر. ظهور اسم وسيلة دفع لا يعني أنها مفعّلة.' : 'Availability depends on your country, currency and the merchant account agreement. A method name alone does not mean it is enabled.'}</p>
      <label className="block space-y-2 text-sm"><span>{ar ? 'بلد الشحن' : 'Shipping country'}</span><select value={country} onChange={(e) => setCountry(e.target.value)} className="border rounded-xl p-2 w-full">{countryOptions(currentLang).map((c) => <option value={c.code} key={c.code}>{c.name}</option>)}</select></label>
      <div className="rounded-xl bg-stone-50 border border-stone-200 p-4 space-y-2" role="status">
        <ProductPayMethods lang={currentLang} country={country} heading={ar ? 'وسائل الدفع المتاحة في بلدك' : 'Payment methods available in your country'} />
        {payments === null ? <p className="text-xs text-stone-500">{ar ? 'جاري فحص التحصيل الحي…' : 'Checking whether a live charge is open…'}</p> : !payments.enabled ? <p className="text-[11px] leading-5 text-stone-600">{ar ? 'الاسم ليس خصماً. التحصيل الحي يفتح بعد عقد البوابة فقط، والطلب لا يُحسب مدفوعاً قبل ذلك.' : 'A listed name is not a charge. A live charge opens only after a gateway contract, and the order is not paid before that.'}</p> : <>
          {payments.mode === 'test' && <p className="text-sky-800 font-bold">{ar ? 'وضع تجريبي — ليس تحصيلاً حقيقياً' : 'Test mode — not a real payment'}</p>}
          {payments.methods.map((m) => <p key={m.id} className="text-sm">{m.id === 'card' ? ar ? 'بطاقة بنكية' : 'Bank card' : ar ? 'محفظة مصرية' : 'Egyptian mobile wallet'}</p>)}
        </>}
      </div>
      <p className="flex gap-2 text-sm text-emerald-900 bg-emerald-50 p-3 rounded-xl"><ShieldCheck className="w-5 h-5 shrink-0" />{ar ? 'أدخل بيانات الدفع داخل صفحة البوابة فقط. لا نطلب هنا رقم بطاقة أو CVV أو كلمة مرور أو كود تحقق.' : 'Enter payment details only on the hosted gateway page. We never ask here for card numbers, CVVs, passwords or one-time codes.'}</p>
      {aliases.length > 0 && <div className="space-y-2"><h3 className="text-sm font-bold">{ar ? 'تفضيلات قديمة على هذا الجهاز — غير موثقة' : 'Legacy preferences on this device — unverified'}</h3><p className="text-xs text-stone-500">{ar ? 'ليست رموزاً بنكية أو حسابات معتمدة ولا تُستخدم للدفع. السجل القديم في المتصفح ليس إثبات تحصيل.' : 'These are not bank tokens or approved accounts and cannot pay. Old browser history is not proof of payment.'}</p>{aliases.map((m) => <div key={m.id} className="flex justify-between items-center border rounded-xl p-2 text-xs"><span>{m.provider}</span><button aria-label={ar ? 'حذف التفضيل' : 'Delete preference'} onClick={() => { deletePaymentMethod(m.id, customerId); setAliases(getSavedPaymentMethods(customerId)); }} className="p-2 text-red-700"><Trash2 className="w-4 h-4" /></button></div>)}</div>}
      <button className="w-full p-3 rounded-xl bg-stone-900 text-white text-sm font-bold" onClick={onClose}>{ar ? 'العودة' : 'Back'}</button>
    </section>
  </div>;
};
