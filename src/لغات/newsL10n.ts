import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../types/i18n';
import { NEWS_KEYS, type NewsRow, type NewsTextKey } from './newsKeys';
import { NEWS_PACKS_1 } from './newsL10nData1';
import { NEWS_PACKS_2 } from './newsL10nData2';
import { NEWS_PACKS_3 } from './newsL10nData3';
import { NEWS_PACKS_4 } from './newsL10nData4';
import { NEWS_PACKS_5 } from './newsL10nData5';

/**
 * Resolver for the news page (WorldPerfumeNews + ShaheenLiveNews). The rule
 * matches the rest of the platform: visitor language → English → Arabic →
 * the raw key, so no visitor ever reads Arabic news chrome unless Arabic is
 * their language. All supported languages carry a full row, so the fallbacks
 * are seatbelts. Article BODIES stay data pairs ({ar, en} — the English
 * floor), resolved by `getLocalizedNewsArticle` / `storeLocalized`.
 */
export const NEWS_PACKS: Partial<Record<SupportedLanguage, NewsRow>> = {
  ...NEWS_PACKS_1,
  ...NEWS_PACKS_2,
  ...NEWS_PACKS_3,
  ...NEWS_PACKS_4,
  ...NEWS_PACKS_5,
};

const KEY_INDEX = new Map<NewsTextKey, number>(NEWS_KEYS.map((key, i) => [key, i]));

/** One news-page string for a language (templates keep their `{placeholders}`). */
export function newsText(lang: SupportedLanguage, key: NewsTextKey): string {
  const i = KEY_INDEX.get(key);
  if (i === undefined) return key;
  return NEWS_PACKS[lang]?.[i] || NEWS_PACKS.en?.[i] || NEWS_PACKS.ar?.[i] || key;
}

/** Bound resolver for a component render (drop-in for the old local `makeT(currentLang, S)`). */
export function makeNewsT(lang: SupportedLanguage): (key: NewsTextKey) => string {
  return (key) => newsText(lang, key);
}

/** Languages that carry a full news row, in platform order. */
export function newsLanguages(): SupportedLanguage[] {
  return SUPPORTED_LANGUAGES.map((l) => l.code).filter((code) => NEWS_PACKS[code]);
}
