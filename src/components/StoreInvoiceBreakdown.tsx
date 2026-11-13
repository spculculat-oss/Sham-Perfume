import React from 'react';
import { Receipt, Info } from 'lucide-react';
import { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../لغات/localizedContent';

/** Import VAT by destination (%). The line is named in the visitor's language — never «VAT» inside an Arabic bill. */
const VAT_RATES: Record<string, number> = { EG: 14, SA: 15, AE: 5, BH: 10, OM: 5, GB: 20, DE: 19, FR: 20, IT: 22 };
const countryName = (code: string, lang: SupportedLanguage) => {
  try { return new Intl.DisplayNames([lang], { type: 'region' }).of(code) || code; } catch { return code; }
};

/** Customer-facing amounts only; internal costs and margins are not invoice line items. */
export const StoreInvoiceBreakdown: React.FC<{
  subtotal: number;
  shipping: number;
  country: string;
  currency: string;
  money: (n: number) => string;
  lang?: SupportedLanguage;
}> = ({ subtotal, shipping, country, money, lang = 'ar' }) => {
  const rtl = isRTL(lang);
  const code = country.toUpperCase();
  const vatRate = VAT_RATES[code] || 0;
  const vatName = lang === 'ar' ? `ضريبة القيمة المضافة — ${countryName(code, lang)} ${vatRate}%` : `VAT — ${countryName(code, lang)} ${vatRate}%`;
  const vatAmount = Math.round(subtotal * (vatRate / 100) * 100) / 100;
  const totalWithVat = Math.round((subtotal + vatAmount + shipping) * 100) / 100;
  const preVatTotal = subtotal + shipping;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3 space-y-2 text-xs" dir={rtl ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-2 font-bold text-stone-900">
        <Receipt className="w-3.5 h-3.5 text-amber-700" />
        <span>{lang === 'ar' ? 'تفصيل الفاتورة (تقديري)' : 'Invoice Breakdown (estimate)'}</span>
      </div>
      <div className="space-y-1 text-stone-600">
        <div className="flex justify-between">
          <span>{lang === 'ar' ? 'المنتجات' : 'Items'}</span>
          <span className="font-mono">{money(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>{lang === 'ar' ? 'الشحن' : 'Shipping'}</span>
          <span className="font-mono">{money(shipping)}</span>
        </div>
        {vatRate > 0 && (
          <div className="flex justify-between text-amber-700">
            <span>{vatName}</span>
            <span className="font-mono">{money(vatAmount)}</span>
          </div>
        )}
        {vatRate === 0 && (
          <div className="flex justify-between text-stone-500 text-[11px]">
            <span>{lang === 'ar' ? 'الضريبة عند الاستيراد (تقدر عند الجمارك)' : 'VAT/customs at import (estimated at customs)'}</span>
            <span>—</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-stone-900 border-t border-stone-200 pt-2">
          <span>{lang === 'ar' ? 'الإجمالي مع الضريبة المتوقعة (تقديري)' : 'Est. Total'}</span>
          <span className="font-mono text-amber-900">{money(totalWithVat)}</span>
        </div>
      </div>
      <div className="flex gap-1.5 text-[10px] text-stone-500 leading-relaxed bg-amber-50 rounded-lg p-2 border border-amber-100">
        <Info className="w-3 h-3 shrink-0 mt-0.5 text-amber-700" />
        <span>
          {lang === 'ar'
            ? 'هذا تقدير استرشادي وليس فاتورة ضريبية أو مبلغاً محصّلاً. قد تُستحق ضرائب أو جمارك منفصلة حسب الطلب والبلد. مبلغ الدفع الفعلي يظهر في صفحة البوابة؛ الفاتورة الرسمية عند وجوبها مسؤولية التاجر.'
            : 'This is an indicative estimate, not a tax invoice or a collected amount. Separate taxes or duties may apply to the order and country. The gateway shows the actual charge; the merchant is responsible for any required official invoice.'}
        </span>
      </div>
    </div>
  );
};

export default StoreInvoiceBreakdown;
