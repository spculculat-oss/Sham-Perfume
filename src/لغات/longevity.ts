import type { SupportedLanguage } from '../types/i18n';
import { makeStoreT, storeNumber } from './storeL10n';

/** The catalogue stores longevity in English («Lasting (6-8 hours)», «Moderate»): show it in the visitor's language. */
export function localLongevity(value: string, lang: SupportedLanguage): string {
  const t = makeStoreT(lang);
  const range = value.match(/(\d+)\s*[-–]\s*(\d+)\s*h/i);
  if (/^\s*lasting/i.test(value) && range) {
    let hours = `${storeNumber(Number(range[1]), lang)}–${storeNumber(Number(range[2]), lang)}`;
    try {
      const fmt = new Intl.NumberFormat(lang, { style: 'unit', unit: 'hour', unitDisplay: 'long' }) as Intl.NumberFormat & { formatRange?: (a: number, b: number) => string };
      if (fmt.formatRange) hours = fmt.formatRange(Number(range[1]), Number(range[2])).replace(/\d+/g, (n) => storeNumber(Number(n), lang)); // the store's own digits
    } catch { /* unknown locale: plain digits */ }
    return `${t('rv_lon_long')} · ${hours}`;
  }
  if (/^\s*moderate\s*$/i.test(value)) return t('rv_lon_moderate');
  return value;
}
