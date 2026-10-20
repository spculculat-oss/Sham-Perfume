import React from 'react';
import { CreditCard } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { pickArEn } from '../لغات/localize';
import { countryPay, type PayMethod } from './worldPay';

const SKIP = new Set(['local_gap', 'restricted']);
const GLOBAL = new Set(['visa', 'mastercard', 'amex', 'apple_google']);

function rank(method: PayMethod) {
  if (method.weight === 'required') return 0;
  if (!GLOBAL.has(method.id)) return 1;
  return 2;
}

function label(method: PayMethod, lang: SupportedLanguage) {
  const raw = pickArEn(lang, method.nameAr, method.nameEn);
  if (lang === 'ar') return raw;
  const latin = raw.replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g, ' ').replace(/\s*\/\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return latin || method.id;
}

/** Payment methods tied to one product, or to every product in the current country. Names only — not a charge. */
export function ProductPayMethods({
  lang,
  country,
  compact = false,
  productName,
  productKey,
  heading,
}: {
  lang: SupportedLanguage;
  country: string;
  compact?: boolean;
  productName?: string;
  productKey?: string;
  heading?: string;
}) {
  const t = (ar: string, en: string) => pickArEn(lang, ar, en);
  const row = countryPay(country);
  const methods = (row?.methods || []).filter((method) => !SKIP.has(method.id)).sort((a, b) => rank(a) - rank(b) || a.nameEn.localeCompare(b.nameEn));
  const shown = compact ? methods.slice(0, 4) : methods;
  const extra = compact ? Math.max(0, methods.length - shown.length) : 0;
  const place = row ? t(row.nameAr, row.nameEn) : country;
  const title = heading
    || (productName
      ? t(`وسائل دفع «${productName}»`, `Payment methods for “${productName}”`)
      : t(`وسائل دفع هذا المنتج · ${place}`, `Payment methods for this product · ${place}`));

  return (
    <div
      className={compact ? 'rounded-xl border border-amber-300 bg-amber-50 px-2 py-1.5 space-y-1' : 'rounded-2xl border border-amber-300 bg-amber-50 p-3 space-y-2'}
      data-testid="product-pay-methods"
      data-pay-country={country}
      data-pay-for={productKey || undefined}
      data-pay-methods={methods.map((method) => method.id).join(' ')}
    >
      <p className={`flex items-start gap-1.5 font-bold text-stone-900 ${compact ? 'text-[11px] leading-4' : 'text-sm'}`}>
        <CreditCard className={compact ? 'mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-800' : 'mt-0.5 h-4 w-4 shrink-0 text-amber-800'} />
        <span>{title}</span>
      </p>
      {methods.length === 0 ? (
        <p className="text-[11px] text-stone-600">{t('لا توجد وسيلة معتمدة لهذا المسار.', 'No method is adoptable on this corridor.')}</p>
      ) : (
        <ul className="flex flex-wrap gap-1">
          {shown.map((method) => (
            <li key={method.id} className={`rounded-full border px-2 py-0.5 font-semibold ${method.weight === 'required' ? 'border-amber-500 bg-white text-amber-950' : 'border-stone-300 bg-white text-stone-800'} ${compact ? 'text-[11px]' : 'text-xs'}`}>
              {label(method, lang)}
            </li>
          ))}
          {extra > 0 && <li className="rounded-full bg-stone-900 px-2 py-0.5 text-[11px] font-semibold text-white">+{extra}</li>}
        </ul>
      )}
      {!compact && (
        <p className="text-[11px] leading-5 text-stone-600">{t('الأسماء مربوطة بالمنتج حسب دولة العميل. الدليل مش زر خصم، والبيانات بتتكتب عند البوابة بعد العقد فقط.', 'These names are tied to the product by the customer’s country. The directory is not a charge button. Details are entered on the gateway only after a contract.')}</p>
      )}
    </div>
  );
}
