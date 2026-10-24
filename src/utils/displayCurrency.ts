/**
 * «العملة اللي الزائر شايفها»: which currency the prices are shown in (store pages, cart, and Shaheen's replies).
 *
 *   1. The country the visitor picked himself in the store → that country's currency (unless he picked a language
 *      after that — the newest choice wins).
 *   2. A site language that is not a language of his country (an Egyptian visitor who switched to French) → the
 *      currency of that language's home (French → EUR, Turkish → TRY, Japanese → JPY …). Arabic and English are
 *      spoken everywhere, so they never change the currency.
 *   3. Otherwise → the currency of the country the visit comes from (EG → EGP, SA → SAR …).
 * Shipping always follows the real destination country; only the money the prices are written in changes.
 * Pure (no React, no storage): the caller passes the visitor's choices.
 */
import type { SupportedLanguage } from '../types/i18n';
import { WORLD_COUNTRIES } from '../data/worldCountries';
import { BUNDLED_FX, currencyFor, isCountry, type FxTable } from './pricing';

/** Languages spoken everywhere: choosing them says nothing about the visitor's money. */
const NEUTRAL = new Set<string>(['ar', 'en']);

/** The home country of a language when the countries catalogue has none (or the first one is not the natural home). */
const LANGUAGE_HOME_OVERRIDES: Record<string, string> = {
  yo: 'NG', ig: 'NG', af: 'ZA', jv: 'ID', sd: 'PK', bo: 'CN', om: 'ET',
  ta: 'IN', te: 'IN', mr: 'IN', gu: 'IN', pa: 'IN', kn: 'IN', ml: 'IN', or: 'IN', as: 'IN',
  ca: 'ES', eu: 'ES', gl: 'ES', cy: 'GB', gd: 'GB', co: 'FR', oc: 'FR',
};

/** Other languages a country speaks besides its main one (a Québécois in French keeps his dollars). */
const ALSO_SPOKEN: Record<string, string[]> = {
  CA: ['fr'], CH: ['de', 'fr', 'it'], BE: ['nl', 'fr', 'de'], LU: ['fr', 'de', 'lb'], ES: ['ca', 'eu', 'gl'],
  GB: ['cy', 'gd'], FR: ['co', 'oc'], IN: ['hi', 'ta', 'te', 'mr', 'gu', 'pa', 'kn', 'ml', 'or', 'as', 'bn', 'ur'],
  MA: ['fr'], DZ: ['fr'], TN: ['fr'], LB: ['fr'], MR: ['fr'], DJ: ['fr'], KM: ['fr'], SG: ['ms', 'zh', 'ta'],
  MY: ['zh', 'ta'], PK: ['sd'], ZA: ['af', 'zu'], NG: ['ha', 'yo', 'ig'], ET: ['om', 'ti'], ER: ['ti', 'ar'],
  IL: ['ar'], CY: ['el', 'tr'], IE: ['ga'], MT: ['mt'], FI: ['sv'], US: ['es'], PH: ['tl'], KE: ['sw'], TZ: ['sw'],
  UG: ['sw'], CN: ['bo'], HK: ['zh'], TW: ['zh'], MO: ['zh', 'pt'], AT: ['de'], LI: ['de'], MC: ['fr'], SM: ['it'],
  VA: ['it'], AO: ['pt'], MZ: ['pt'], PT: ['pt'], BR: ['pt'], MX: ['es'], AR: ['es'], CO: ['es'], CL: ['es'],
  PE: ['es'], VE: ['es'], EC: ['es'], BO: ['es'], PY: ['es'], UY: ['es'], CU: ['es'], DO: ['es'], GT: ['es'],
  HN: ['es'], SV: ['es'], NI: ['es'], CR: ['es'], PA: ['es'], PR: ['es'], GQ: ['es', 'fr'], SN: ['fr'], CI: ['fr'],
  CM: ['fr'], ML: ['fr'], NE: ['fr'], BF: ['fr'], TD: ['fr', 'ar'], CD: ['fr'], CG: ['fr'], GA: ['fr'], BJ: ['fr'],
  TG: ['fr'], GN: ['fr'], MG: ['fr'], HT: ['fr'], RW: ['fr'], BI: ['fr'], SC: ['fr'], VU: ['fr'], NC: ['fr'],
  PF: ['fr'], AF: ['fa'], TJ: ['fa', 'ru'], KZ: ['ru'], KG: ['ru'], BY: ['ru'], UA: ['ru'], SO: ['ar'], SD: ['ar'],
  IR: ['fa'], NZ: ['mi'], BA: ['hr', 'sr'], ME: ['sr'], XK: ['sq'], MK: ['sq'], AZ: ['tr'], BG: ['tr'], AW: ['nl'],
  SR: ['nl'], CW: ['nl'], LK: ['ta'], NP: ['hi'], BD: ['bn'], ID: ['jv'], TL: ['pt'], CV: ['pt'], GW: ['pt'], ST: ['pt'],
};

const PRIMARY: Record<string, string> = Object.fromEntries(WORLD_COUNTRIES.map((c) => [c.code, c.primaryLanguage]));
const LANGUAGE_HOME: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const c of WORLD_COUNTRIES) if (!out[c.primaryLanguage] && isCountry(c.code)) out[c.primaryLanguage] = c.code;
  return { ...out, ...LANGUAGE_HOME_OVERRIDES };
})();

/** Is this language one of the country's own languages? */
export function spokenIn(country: string, lang: string): boolean {
  const code = country.toUpperCase();
  return PRIMARY[code] === lang || Boolean(ALSO_SPOKEN[code]?.includes(lang));
}

/** The home country of a language (French → FR), or undefined for Arabic / English / unknown. */
export function languageHome(lang: string): string | undefined {
  return NEUTRAL.has(lang) ? undefined : LANGUAGE_HOME[lang];
}

export interface CurrencyChoices {
  /** The visitor picked the store country himself, and when (ms). */
  countryPickedAt?: number;
  /** The visitor picked the site language himself, and when (ms). Without a time a manual pick counts as old. */
  languagePickedAt?: number;
  languagePicked?: boolean;
}

/** The currency prices are shown in, for this country, this site language and the visitor's own choices. */
export function displayCurrency(country: string, lang: SupportedLanguage, choices: CurrencyChoices = {}, fx: FxTable = BUNDLED_FX): string {
  const own = currencyFor(country, fx);
  const countryPicked = choices.countryPickedAt !== undefined;
  const languageNewer = (choices.languagePickedAt ?? (choices.languagePicked ? 0 : -1)) > (choices.countryPickedAt ?? -1);
  if (countryPicked && !languageNewer) return own;
  if (spokenIn(country, lang)) return own;
  const home = languageHome(lang);
  return home ? currencyFor(home, fx) : own;
}
