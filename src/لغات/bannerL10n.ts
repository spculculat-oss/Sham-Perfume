import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../types/i18n';
import { BANNER_KEYS, type BannerRow, type BannerTextKey } from './bannerKeys';
import { BANNER_PACKS_1 } from './bannerL10nData1';
import { BANNER_PACKS_2 } from './bannerL10nData2';
import { BANNER_PACKS_3 } from './bannerL10nData3';
import { BANNER_PACKS_4 } from './bannerL10nData4';
import { BANNER_PACKS_5 } from './bannerL10nData5';

/**
 * Resolver for the products-promo banner. The rule matches the rest of the
 * platform: visitor language → English → Arabic → the raw key, so no
 * visitor ever reads Arabic banner copy unless Arabic is their language.
 * All supported languages carry a full row, so the fallbacks are seatbelts.
 */
export const BANNER_PACKS: Partial<Record<SupportedLanguage, BannerRow>> = {
  ...BANNER_PACKS_1,
  ...BANNER_PACKS_2,
  ...BANNER_PACKS_3,
  ...BANNER_PACKS_4,
  ...BANNER_PACKS_5,
};

const KEY_INDEX = new Map<BannerTextKey, number>(BANNER_KEYS.map((key, i) => [key, i]));

export function bannerText(lang: SupportedLanguage, key: BannerTextKey): string {
  const i = KEY_INDEX.get(key);
  if (i === undefined) return key;
  return BANNER_PACKS[lang]?.[i] || BANNER_PACKS.en?.[i] || BANNER_PACKS.ar?.[i] || key;
}

export function makeBannerT(lang: SupportedLanguage): (key: BannerTextKey) => string {
  return (key) => bannerText(lang, key);
}

/** Languages that carry a full banner row, in platform order. */
export function bannerLanguages(): SupportedLanguage[] {
  return SUPPORTED_LANGUAGES.map((l) => l.code).filter((code) => BANNER_PACKS[code]);
}
