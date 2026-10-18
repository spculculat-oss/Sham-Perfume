import React from 'react';
import { Receipt, Info } from 'lucide-react';
import { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../لغات/localizedContent';

const VAT_RATES: Record<string, { rate: number; name: string }> = {
  EG: { rate: 14, name: 'VAT مصر 14%' },
  SA: { rate: 15, name: 'VAT السعودية 15%' },
  AE: { rate: 5, name: 'VAT الإمارات 5%' },
  BH: { rate: 10, name: 'VAT البحرين 10%' },
  OM: { rate: 5, name: 'VAT عمان 5%' },
  GB: { rate: 20, name: 'VAT UK 20%' },
  DE: { rate: 19, name: 'VAT DE 19%' },
  FR: { rate: 20, name: 'VAT FR 20%' },
  IT: { rate: 22, name: 'VAT IT 22%' },
  US: { rate: 0, name: 'Sales tax varies by state' },
};

export const StoreInvoiceBreakdown: React.FC<{
  subtotal: number;
  shipping: number;
  country: string;
  currency: string;
  money: (n: number) => string;
  lang?: SupportedLanguage;
}> = ({ subtotal, shipping, country, money, lang = 'ar' }) => {
  const rtl = isRTL(lang);
  const vat = VAT_RATES[country.toUpperCase()];
  const vatRate = vat?.rate || 0;
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
            <span>{vat.name}</span>
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
          <span>{lang === 'ar' ? 'الإجمالي التقريبي' : 'Est. Total'}</span>
          <span className="font-mono text-amber-900">{money(totalWithVat)}</span>
        </div>
      </div>
      <div className="flex gap-1.5 text-[10px] text-stone-500 leading-relaxed bg-amber-50 rounded-lg p-2 border border-amber-100">
        <Info className="w-3 h-3 shrink-0 mt-0.5 text-amber-700" />
        <span>
          {lang === 'ar'
            ? `الأسعار لا تشمل ضريبة بلدك/الجمارك إلا ما هو موضح. الفاتورة الضريبية الرسمية تُصدر إلكترونيًا (${country === 'EG' ? 'EDA مصر' : country === 'SA' ? 'ZATCA السعودية' : 'حسب بلدك'}). هامش المنصة مضمّن في سعر المنتج.`
            : `Prices exclude your country's VAT/customs except as shown. Official e-invoice issued per your country. Platform margin included in product price.`}
        </span>
      </div>
      <div className="text-[10px] text-stone-400">
        {lang === 'ar' ? 'هامش المنصة 25-50% مضمّن — الشفافية مطلوبة (EU UCPD). الجمارك تقديرية عند الدفع.' : 'Platform margin 25-50% included — transparency (EU UCPD). Customs duties are estimates at checkout.'}
      </div>
    </div>
  );
};

export default StoreInvoiceBreakdown;
