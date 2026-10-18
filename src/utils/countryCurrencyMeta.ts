import { BUNDLED_FX, currencyFor, guessCountry, isCountry, priceIn, COUNTRY_CODES } from './pricing';
import type { SupportedLanguage } from '../types/i18n';
import { LOCALE_MAP } from '../لغات/localize';

export interface CountryMeta {
  code: string;
  flag: string;
  nameAr: string;
  nameEn: string;
  countryName: string;
  currency: string;
  symbolAr: string;
  symbolEn: string;
}

export const TOP_COUNTRIES: Record<string, Omit<CountryMeta, 'code' | 'countryName'>> = {
  EG: { flag: '🇪🇬', nameAr: 'مصر', nameEn: 'Egypt', currency: 'EGP', symbolAr: 'ج.م', symbolEn: 'EGP' },
  SA: { flag: '🇸🇦', nameAr: 'المملكة العربية السعودية', nameEn: 'Saudi Arabia', currency: 'SAR', symbolAr: 'ر.س', symbolEn: 'SAR' },
  AE: { flag: '🇦🇪', nameAr: 'الإمارات العربية المتحدة', nameEn: 'United Arab Emirates', currency: 'AED', symbolAr: 'د.إ', symbolEn: 'AED' },
  KW: { flag: '🇰🇼', nameAr: 'الكويت', nameEn: 'Kuwait', currency: 'KWD', symbolAr: 'د.ك', symbolEn: 'KWD' },
  QA: { flag: '🇶🇦', nameAr: 'قطر', nameEn: 'Qatar', currency: 'QAR', symbolAr: 'ر.ق', symbolEn: 'QAR' },
  BH: { flag: '🇧🇭', nameAr: 'البحرين', nameEn: 'Bahrain', currency: 'BHD', symbolAr: 'د.ب', symbolEn: 'BHD' },
  OM: { flag: '🇴🇲', nameAr: 'سلطنة عُمان', nameEn: 'Oman', currency: 'OMR', symbolAr: 'ر.ع', symbolEn: 'OMR' },
  JO: { flag: '🇯🇴', nameAr: 'الأردن', nameEn: 'Jordan', currency: 'JOD', symbolAr: 'د.أ', symbolEn: 'JOD' },
  IQ: { flag: '🇮🇶', nameAr: 'العراق', nameEn: 'Iraq', currency: 'IQD', symbolAr: 'د.ع', symbolEn: 'IQD' },
  LB: { flag: '🇱🇧', nameAr: 'لبنان', nameEn: 'Lebanon', currency: 'USD', symbolAr: '$', symbolEn: 'USD' },
  SY: { flag: '🇸🇾', nameAr: 'سوريا', nameEn: 'Syria', currency: 'USD', symbolAr: '$', symbolEn: 'USD' },
  PS: { flag: '🇵🇸', nameAr: 'فلسطين', nameEn: 'Palestine', currency: 'USD', symbolAr: '$', symbolEn: 'USD' },
  LY: { flag: '🇱🇾', nameAr: 'ليبيا', nameEn: 'Libya', currency: 'LYD', symbolAr: 'د.ل', symbolEn: 'LYD' },
  TN: { flag: '🇹🇳', nameAr: 'تونس', nameEn: 'Tunisia', currency: 'TND', symbolAr: 'د.ت', symbolEn: 'TND' },
  DZ: { flag: '🇩🇿', nameAr: 'الجزائر', nameEn: 'Algeria', currency: 'DZD', symbolAr: 'د.ج', symbolEn: 'DZD' },
  MA: { flag: '🇲🇦', nameAr: 'المغرب', nameEn: 'Morocco', currency: 'MAD', symbolAr: 'د.م', symbolEn: 'MAD' },
  SD: { flag: '🇸🇩', nameAr: 'السودان', nameEn: 'Sudan', currency: 'SDG', symbolAr: 'ج.س', symbolEn: 'SDG' },
  YE: { flag: '🇾🇪', nameAr: 'اليمن', nameEn: 'Yemen', currency: 'YER', symbolAr: 'ر.ي', symbolEn: 'YER' },
  TR: { flag: '🇹🇷', nameAr: 'تركيا', nameEn: 'Turkey', currency: 'TRY', symbolAr: '₺', symbolEn: 'TRY' },
  US: { flag: '🇺🇸', nameAr: 'الولايات المتحدة', nameEn: 'United States', currency: 'USD', symbolAr: '$', symbolEn: 'USD' },
  GB: { flag: '🇬🇧', nameAr: 'المملكة المتحدة', nameEn: 'United Kingdom', currency: 'GBP', symbolAr: '£', symbolEn: 'GBP' },
  DE: { flag: '🇩🇪', nameAr: 'ألمانيا', nameEn: 'Germany', currency: 'EUR', symbolAr: '€', symbolEn: 'EUR' },
  FR: { flag: '🇫🇷', nameAr: 'فرنسا', nameEn: 'France', currency: 'EUR', symbolAr: '€', symbolEn: 'EUR' },
  IT: { flag: '🇮🇹', nameAr: 'إيطاليا', nameEn: 'Italy', currency: 'EUR', symbolAr: '€', symbolEn: 'EUR' },
  ES: { flag: '🇪🇸', nameAr: 'إسبانيا', nameEn: 'Spain', currency: 'EUR', symbolAr: '€', symbolEn: 'EUR' },
  CA: { flag: '🇨🇦', nameAr: 'كندا', nameEn: 'Canada', currency: 'CAD', symbolAr: 'CAD$', symbolEn: 'CAD' },
  AU: { flag: '🇦🇺', nameAr: 'أستراليا', nameEn: 'Australia', currency: 'AUD', symbolAr: 'AUD$', symbolEn: 'AUD' },
  MY: { flag: '🇲🇾', nameAr: 'ماليزيا', nameEn: 'Malaysia', currency: 'MYR', symbolAr: 'RM', symbolEn: 'MYR' },
};

export const POPULAR_COUNTRY_CODES = [
  'EG', 'SA', 'AE', 'KW', 'QA', 'BH', 'OM', 'JO', 'IQ', 'LY', 'DZ', 'MA', 'US', 'GB', 'DE', 'FR', 'TR'
];

/**
 * Returns flag emoji for a 2-letter ISO country code.
 */
export function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const code = countryCode.toUpperCase();
  if (TOP_COUNTRIES[code]) return TOP_COUNTRIES[code].flag;
  const codePoints = [...code].map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

/**
 * Resolves full CountryMeta for any ISO code with fallback.
 */
export function getCountryMeta(countryCode: string, lang: SupportedLanguage = 'ar'): CountryMeta {
  const code = (countryCode || 'EG').toUpperCase();
  const known = TOP_COUNTRIES[code];
  const currency = known?.currency || currencyFor(code, BUNDLED_FX);

  let nameAr = known?.nameAr;
  let nameEn = known?.nameEn;

  if (!nameAr || !nameEn) {
    try {
      const arNames = new Intl.DisplayNames(['ar'], { type: 'region' });
      const enNames = new Intl.DisplayNames(['en'], { type: 'region' });
      nameAr = arNames.of(code) || code;
      nameEn = enNames.of(code) || code;
    } catch {
      nameAr = nameAr || code;
      nameEn = nameEn || code;
    }
  }

  const symbolAr = known?.symbolAr || currency;
  const symbolEn = known?.symbolEn || currency;

  return {
    code,
    flag: getCountryFlag(code),
    nameAr,
    nameEn,
    countryName: lang === 'ar' ? nameAr : nameEn,
    currency,
    symbolAr,
    symbolEn,
  };
}

/**
 * Converts a base catalog price in EGP to the country's local currency and formats it
 * according to the visitor's language and currency conventions.
 */
export function formatProductPriceInCountry(
  egpPrice: number,
  countryCode: string,
  lang: SupportedLanguage = 'ar'
): {
  amount: number;
  currency: string;
  formatted: string;
  symbol: string;
  countryName: string;
  flag: string;
} {
  const meta = getCountryMeta(countryCode, lang);
  const localAmount = priceIn(egpPrice, meta.currency, BUNDLED_FX);
  const locale = LOCALE_MAP[lang] || (lang === 'ar' ? 'ar-EG' : 'en-US');

  const isWhole = Math.round(localAmount * 100) % 100 === 0;
  const maxFraction = isWhole ? 0 : 2;

  let numStr = '';
  try {
    numStr = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: maxFraction,
    }).format(localAmount);
  } catch {
    numStr = localAmount.toLocaleString('en-US');
  }

  const symbol = lang === 'ar' ? meta.symbolAr : meta.symbolEn;
  const formatted = lang === 'ar' ? `${numStr} ${symbol}` : `${symbol} ${numStr}`;
  const countryName = lang === 'ar' ? meta.nameAr : meta.nameEn;

  return {
    amount: localAmount,
    currency: meta.currency,
    formatted,
    symbol,
    countryName,
    flag: meta.flag,
  };
}
