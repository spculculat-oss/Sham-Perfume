import { SupportedLanguage } from '../types/i18n';
import { aiText } from './aiPacks';

/**
 * A localized text value. `ar` and `en` are mandatory baselines;
 * every other supported language is optional and degrades gracefully:
 *   - fa falls back to ar (RTL sibling)
 *   - any missing language falls back to en
 * The optional part is derived from SupportedLanguage, so newly enabled
 * languages are automatically accepted here without editing this type.
 */
export type LText = {
  ar: string;
  en: string;
} & Partial<Record<SupportedLanguage, string>>;

/** Map each supported platform language to its canonical BCP-47 locale. */
export const LOCALE_MAP: Record<SupportedLanguage, string> = {
  ar: 'ar-EG',
  en: 'en-GB',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
  de: 'de-DE',
  ru: 'ru-RU',
  zh: 'zh-CN',
  tr: 'tr-TR',
  fa: 'fa-IR',
  // Extended languages — batch 1 (LTR)
  hi: 'hi-IN',
  pt: 'pt-BR',
  id: 'id-ID',
  ja: 'ja-JP',
  ko: 'ko-KR',
  vi: 'vi-VN',
  th: 'th-TH',
  pl: 'pl-PL',
  nl: 'nl-NL',
  uk: 'uk-UA',
  el: 'el-GR',
  ms: 'ms-MY',
  bn: 'bn-BD',
  cs: 'cs-CZ',
  ro: 'ro-RO',
  // Extended languages — batch 2 (RTL)
  he: 'he-IL',
  ur: 'ur-PK',
  ps: 'ps-AF',
  // Extended languages — batch 3 (LTR)
  sv: 'sv-SE',
  da: 'da-DK',
  fi: 'fi-FI',
  no: 'nb-NO',
  hu: 'hu-HU',
  sk: 'sk-SK',
  sl: 'sl-SI',
  hr: 'hr-HR',
  sr: 'sr-Latn-RS',
  bg: 'bg-BG',
  lt: 'lt-LT',
  lv: 'lv-LV',
  et: 'et-EE',
  ka: 'ka-GE',
  hy: 'hy-AM',
  // Extended languages — batch 4 (Africa, SE Asia, Oceania)
  tl: 'tl-PH',
  sw: 'sw-KE',
  am: 'am-ET',
  ha: 'ha-NG',
  yo: 'yo-NG',
  zu: 'zu-ZA',
  af: 'af-ZA',
  so: 'so-SO',
  jv: 'jv-ID',
  mi: 'mi-NZ',
  ne: 'ne-NP',
  si: 'si-LK',
  my: 'my-MM',
  km: 'km-KH',
  lo: 'lo-LA',
  // Extended languages — batch 5 (Indian subcontinent, Central Asia)
  ta: 'ta-IN',
  te: 'te-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  pa: 'pa-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  or: 'or-IN',
  kk: 'kk-KZ',
  uz: 'uz-UZ',
  az: 'az-AZ',
  mn: 'mn-MN',
  ky: 'ky-KG',
  tg: 'tg-TJ',
  tk: 'tk-TM',
  is: 'is-IS',
  sq: 'sq-AL',
  mk: 'mk-MK',
  bs: 'bs-BA',
  be: 'be-BY',
  ca: 'ca-ES',
  eu: 'eu-ES',
  gl: 'gl-ES',
  mt: 'mt-MT',
  ga: 'ga-IE',
  cy: 'cy-GB',
  lb: 'lb-LU',
  gd: 'gd-GB',
  co: 'it-IT', // Corsican has no CLDR date data; fall back to Italian (closest relative)
  sd: 'sd-PK',
  as: 'as-IN',
  oc: 'oc-FR',
  bo: 'bo-CN',
  dz: 'dz-BT',
  mg: 'mg-MG',
  sn: 'sn-ZW',
  rw: 'rw-RW',
  st: 'st-ZA',
  ln: 'ln-CD',
  ti: 'ti-ER',
  om: 'om-ET',
  ig: 'ig-NG',
};

/**
 * Resolve the best translation for `lang` out of an LText record.
 * Fallback chain: exact language -> fa?ar -> en -> ar -> ''.
 */
export function loc(lang: SupportedLanguage, text: LText | undefined | null): string {
  if (!text) return '';
  const direct = text[lang];
  if (typeof direct === 'string' && direct.length > 0) return direct;
  // The language agent's translation of the English text (src/لغات/aiPacks.ts), before any fallback.
  const ai = aiText(lang, text.en);
  if (ai) return ai;
  if (lang === 'fa') {
    if (typeof text.ar === 'string' && text.ar.length > 0) return text.ar;
  }
  if (typeof text.en === 'string' && text.en.length > 0) return text.en;
  return text.ar || '';
}

/**
 * Build a translation function bound to a dictionary of LText values.
 * Usage inside a component:
 *   const L = makeT(currentLang, STRINGS);
 *   L('my_key')
 */
export function makeT<S extends Record<string, LText>>(
  lang: SupportedLanguage,
  dict: S
): (key: keyof S & string) => string {
  return (key: keyof S & string): string => loc(lang, dict[key]);
}

/** Resolve an ar/en pair from legacy data records (falls back like loc). */
export function pickArEn(
  lang: SupportedLanguage,
  ar: string | undefined,
  en: string | undefined
): string {
  return loc(lang, { ar: ar || '', en: en || ar || '' });
}

/** Replace {placeholders} in a localized template string. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

/** Format a date in the visitor's language locale. */
export function localeDate(
  lang: SupportedLanguage,
  date: Date,
  options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
): string {
  try {
    return new Intl.DateTimeFormat(LOCALE_MAP[lang], options).format(date);
  } catch (e) {
    return date.toISOString().split('T')[0];
  }
}
