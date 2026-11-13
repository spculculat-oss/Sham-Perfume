import type { SupportedLanguage } from '../types/i18n';
import { LOCALE_MAP } from './localize';
import { aiStore } from './aiPacks';
import { STORE_TEXT_BASE } from './storeL10nBase';
import { STORE_TEXT_WAVES } from './storeL10nExt';
import {
  STORE_BASE_LANGS,
  STORE_CORE_KEYS,
  type StoreTextKey,
} from './storeKeys';

/**
 * The single entry point the store uses for text.
 *
 * Resolution order per string: **the visitor's language → English → Arabic → the key**.
 * Arabic is reachable only through the third step, which is why a language without a
 * translation shows English rather than Arabic — «ما حدش يشوف عربي غير لو اختار عربي».
 *
 * Values arrive from two layers:
 *  - `storeL10nBase.ts` — the ten platform languages, arrays aligned to STORE_BASE_LANGS;
 *  - `storeL10nExt*.ts` — waves for the other ninety, arrays aligned to STORE_CORE_KEYS,
 *    plus whole sentences where a natural translation is certain.
 */

/** Placeholder values, e.g. `storeText(lang, 'sf_total', { total: '1,200' })`. */
export type StoreVars = Record<string, string | number>;

export type StoreTranslate = (key: StoreTextKey, vars?: StoreVars) => string;

const BASE_INDEX: ReadonlyMap<SupportedLanguage, number> = new Map(
  STORE_BASE_LANGS.map((lang, index) => [lang, index]),
);

/** language → key → string, assembled once from the base pack and every wave. */
function assemble(): Map<SupportedLanguage, Partial<Record<StoreTextKey, string>>> {
  const table = new Map<SupportedLanguage, Partial<Record<StoreTextKey, string>>>();
  const slot = (lang: SupportedLanguage) => {
    let entry = table.get(lang);
    if (!entry) {
      entry = {};
      table.set(lang, entry);
    }
    return entry;
  };
  // Base pack first: the ten platform languages carry every key.
  for (const lang of STORE_BASE_LANGS) {
    const index = BASE_INDEX.get(lang) as number;
    const entry = slot(lang);
    for (const key of Object.keys(STORE_TEXT_BASE) as StoreTextKey[]) {
      const value = STORE_TEXT_BASE[key][index];
      if (value) entry[key] = value;
    }
  }
  // Waves fill the remaining languages; a wave never overwrites a base string.
  for (const wave of STORE_TEXT_WAVES) {
    for (const [lang, values] of Object.entries(wave.packs)) {
      const entry = slot(lang as SupportedLanguage);
      STORE_CORE_KEYS.forEach((key, position) => {
        const value = values?.[position];
        if (value && !entry[key]) entry[key] = value;
      });
    }
    for (const [lang, strings] of Object.entries(wave.extra || {})) {
      const entry = slot(lang as SupportedLanguage);
      for (const [key, value] of Object.entries(strings || {})) {
        if (value && !entry[key as StoreTextKey]) entry[key as StoreTextKey] = value;
      }
    }
  }
  return table;
}

const STORE_TEXT = assemble();

/** Replace `{name}` placeholders; unknown placeholders survive untouched. */
export function fillStoreVars(text: string, vars?: StoreVars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match);
}

/** One string of the store, already substituted and already resolved. */
export function storeText(lang: SupportedLanguage, key: StoreTextKey, vars?: StoreVars): string {
  const own = STORE_TEXT.get(lang)?.[key];
  const english = STORE_TEXT.get('en')?.[key];
  // Hand-made text first (unless it is a copy of the English), then the language agent's translation.
  if (own && (lang === 'en' || own !== english)) return fillStoreVars(own, vars);
  const ai = aiStore(lang, key);
  if (ai) return fillStoreVars(ai, vars);
  if (own) return fillStoreVars(own, vars);
  if (english && lang !== 'en') return fillStoreVars(english, vars);
  const arabic = STORE_TEXT.get('ar')?.[key];
  if (arabic) return fillStoreVars(arabic, vars);
  return key;
}

/**
 * A translator bound to one language: `const t = makeStoreT(lang); t('sf_cart')`.
 * `extra` (strings written by the caller for this language) always wins.
 */
export function makeStoreT(lang: SupportedLanguage, extra?: Partial<Record<StoreTextKey, string>>): StoreTranslate {
  return (key, vars) => {
    const own = extra?.[key];
    if (own) return fillStoreVars(own, vars);
    return storeText(lang, key, vars);
  };
}

/** Every string of one language that is not an English fallback (used by tests/QA). */
export function storeLanguageCoverage(lang: SupportedLanguage): { key: StoreTextKey; text: string }[] {
  return (Object.keys(STORE_TEXT.get(lang) || {}) as StoreTextKey[])
    .map((key) => ({ key, text: STORE_TEXT.get(lang)?.[key] as string }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/** How many of the core keys a language carries itself (100 % for base languages). */
export function storeCoreCoverage(lang: SupportedLanguage): number {
  const entry = STORE_TEXT.get(lang) || {};
  return STORE_CORE_KEYS.filter((key) => Boolean(entry[key])).length;
}

/** The label of a product name/description pair for one language (English floor, Arabic only for Arabic). */
export function storeLocalized(pair: { ar?: string; en?: string } | undefined, lang: SupportedLanguage): string {
  if (!pair) return '';
  if (lang === 'ar') return pair.ar || pair.en || '';
  return pair.en || pair.ar || '';
}

/** «١٢٠٠ جنيه» / «1,200 EGP»: the visitor's own numerals, never a fixed one. */
export function storeNumber(value: number, lang: SupportedLanguage): string {
  try {
    return new Intl.NumberFormat(LOCALE_MAP[lang] || 'en-GB').format(value);
  } catch {
    return String(value);
  }
}

/** One advisor reason, resolved for the language it will be shown in. */
export interface StoreReason {
  key: StoreTextKey;
  vars?: StoreVars;
}

/**
 * Reason templates that carry a *profile value* (a family/gender/occasion code) instead of
 * free text: the value is localized too, so «طابع {value}» becomes «طابع عود» in Arabic and
 * «Oud character» in English.
 */
const REASON_LABEL: Partial<Record<StoreTextKey, (value: string, lang: SupportedLanguage) => string>> = {
  reason_family: storeFamilyLabel,
  reason_gender: storeGenderLabel,
  reason_occasion: storeOccasionLabel,
};

export function storeReasonText(lang: SupportedLanguage, reason: StoreReason): string {
  const vars: StoreVars = { ...reason.vars };
  const localize = REASON_LABEL[reason.key];
  if (localize && vars.value !== undefined) vars.value = localize(String(vars.value), lang);
  return storeText(lang, reason.key, vars);
}

/** «طابع عود · في حدود ميزانيتك (250 ج)» — the why-chips under a pick. */
export const storeReasonList = (lang: SupportedLanguage, reasons: readonly StoreReason[], separator = ' · '): string =>
  reasons.map((reason) => storeReasonText(lang, reason)).join(separator);

// ---------------------------------------------------------------------------
// Scent-profile labels: the store's own vocabulary (families, gender, season,
// occasion) resolved for any language instead of the old {ar,en} pairs.
// ---------------------------------------------------------------------------

export const STORE_FAMILY_KEYS: Readonly<Record<string, StoreTextKey>> = {
  oud: 'family_oud', oriental: 'family_oriental', amber: 'family_amber', woody: 'family_woody',
  floral: 'family_floral', fresh: 'family_fresh', citrus: 'family_citrus', aquatic: 'family_aquatic',
  fruity: 'family_fruity', gourmand: 'family_gourmand', musk: 'family_musk', spicy: 'family_spicy',
  leather: 'family_leather', powdery: 'family_powdery',
};

export const STORE_GENDER_KEYS: Readonly<Record<string, StoreTextKey>> = {
  men: 'gender_men', women: 'gender_women', unisex: 'gender_unisex',
};

export const STORE_SEASON_KEYS: Readonly<Record<string, StoreTextKey>> = {
  summer: 'season_summer', winter: 'season_winter', spring: 'season_spring', autumn: 'season_autumn', all: 'season_all',
};

export const STORE_OCCASION_KEYS: Readonly<Record<string, StoreTextKey>> = {
  daily: 'occasion_daily', evening: 'occasion_evening', work: 'occasion_work', special: 'occasion_special', gift: 'occasion_gift',
};

const STORE_LABEL_KINDS = {
  family: STORE_FAMILY_KEYS,
  gender: STORE_GENDER_KEYS,
  season: STORE_SEASON_KEYS,
  occasion: STORE_OCCASION_KEYS,
} as const;

export type StoreLabelKind = keyof typeof STORE_LABEL_KINDS;

/** «عود» / «Oud» / «Уд» — a profile label for one language; unknown values pass through. */
export function storeLabel(kind: StoreLabelKind, value: string, lang: SupportedLanguage): string {
  const key = STORE_LABEL_KINDS[kind][value];
  return key ? storeText(lang, key) : value;
}

export function storeFamilyLabel(value: string, lang: SupportedLanguage): string {
  return storeLabel('family', value, lang);
}

export function storeGenderLabel(value: string, lang: SupportedLanguage): string {
  return storeLabel('gender', value, lang);
}

export function storeSeasonLabel(value: string, lang: SupportedLanguage): string {
  return storeLabel('season', value, lang);
}

export function storeOccasionLabel(value: string, lang: SupportedLanguage): string {
  return storeLabel('occasion', value, lang);
}

/** «عود، زهري» — a sentence-like list of profile labels in one language. */
export function storeLabelList(kind: StoreLabelKind, values: readonly string[], lang: SupportedLanguage, separator = ', '): string {
  return values.map((value) => storeLabel(kind, value, lang)).join(separator);
}

/**
 * The ten base languages keep the `{ar,en}` shape the JSON-LD and the static product
 * pages read, extended with a `[lang]` accessor so any page can localize the label.
 */
export interface StoreLabelPair {
  ar: string;
  en: string;
  get?: (lang: SupportedLanguage) => string;
}

export function labelPair(kind: StoreLabelKind, value: string): { ar: string; en: string } {
  return { ar: storeLabel(kind, value, 'ar'), en: storeLabel(kind, value, 'en') };
}
