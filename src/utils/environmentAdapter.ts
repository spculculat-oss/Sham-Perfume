import { WorldCountryData, WORLD_COUNTRIES, findCountryByCode } from '../data/worldCountries';
import { findCurrencyByCode } from '../data/worldCurrencies';
import { ConcentrationType } from '../types/perfume';
import { USER_COUNTRY_STORAGE_KEY } from './geoDetector';
import { BUNDLED_FX, currencyFor, isCountry } from './pricing';

export const USER_ENVIRONMENT_STORAGE_KEY = 'sham_perfume_user_environment_profile';

export interface UserEnvironmentProfile {
  countryCode: string;
  countryNameAr: string;
  countryNameEn: string;
  countryFlag: string;
  currencyCode: string;
  currencySymbolAr: string;
  currencySymbolEn: string;
  regionId: string;
  climateType: 'hot_arid' | 'mediterranean' | 'cold_temperate' | 'tropical_humid' | 'continental';
  climateLabelAr: string;
  climateLabelEn: string;
  recommendedConcentrationPercent: number;
  recommendedConcentrationType: ConcentrationType;
  recommendedFixativePercent: number;
  climateAdviceAr: string;
  climateAdviceEn: string;
  traditionalNotes?: Array<{
    nameAr: string;
    nameEn: string;
    category: 'top' | 'heart' | 'base';
    percentageOfOil: number;
    description?: string;
  }>;
}

export function createEnvironmentProfileFromCountry(country: WorldCountryData): UserEnvironmentProfile {
  const currency = findCurrencyByCode(country.currencyCode);
  return {
    countryCode: country.code,
    countryNameAr: country.nameAr,
    countryNameEn: country.nameEn,
    countryFlag: country.flag,
    currencyCode: currency.code,
    currencySymbolAr: currency.symbolAr,
    currencySymbolEn: currency.symbolEn,
    regionId: country.regionCategory,
    climateType: country.climateType,
    climateLabelAr: country.climateLabelAr,
    climateLabelEn: country.climateLabelEn,
    recommendedConcentrationPercent: country.recommendedConcentrationPercent,
    recommendedConcentrationType: country.recommendedConcentrationType,
    recommendedFixativePercent: country.recommendedFixativePercent,
    climateAdviceAr: country.climateAdviceAr,
    climateAdviceEn: country.climateAdviceEn,
  };
}

/** Region-name lookups for countries the lab list does not describe (Intl may be missing). */
function regionName(code: string, locale: string): string {
  try { return new Intl.DisplayNames([locale], { type: 'region' }).of(code) || code; } catch { return code; }
}
const flagOf = (code: string) => String.fromCodePoint(...[...code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));

/**
 * One country for the whole site (#169): the lab's environment follows the store's country, and its money
 * is the store's currency (`currencyFor`), so the header, the calculators and the cart never disagree.
 * A country the lab list does not know keeps the previous climate advice but takes the new name, flag and currency.
 */
export function alignEnvironmentToCountry(profile: UserEnvironmentProfile, countryCode: string): UserEnvironmentProfile {
  const code = (countryCode || '').toUpperCase();
  if (!isCountry(code) || profile.countryCode === code) return profile;
  const known = findCountryByCode(code);
  const base: UserEnvironmentProfile = known
    ? createEnvironmentProfileFromCountry(known)
    : { ...profile, countryCode: code, countryNameAr: regionName(code, 'ar'), countryNameEn: regionName(code, 'en'), countryFlag: flagOf(code) };
  const shop = currencyFor(code, BUNDLED_FX);
  if (base.currencyCode === shop) return base;
  const currency = findCurrencyByCode(shop);
  return { ...base, currencyCode: currency.code, currencySymbolAr: currency.symbolAr, currencySymbolEn: currency.symbolEn };
}

export const REGIONAL_ENVIRONMENTS: Record<string, UserEnvironmentProfile> = {
  gulf: createEnvironmentProfileFromCountry(WORLD_COUNTRIES.find(c => c.code === 'SA') || WORLD_COUNTRIES[0]),
  egypt: createEnvironmentProfileFromCountry(WORLD_COUNTRIES.find(c => c.code === 'EG') || WORLD_COUNTRIES[0]),
  levant: createEnvironmentProfileFromCountry(WORLD_COUNTRIES.find(c => c.code === 'SY') || WORLD_COUNTRIES[0]),
  north_africa: createEnvironmentProfileFromCountry(WORLD_COUNTRIES.find(c => c.code === 'MA') || WORLD_COUNTRIES[0]),
  europe: createEnvironmentProfileFromCountry(WORLD_COUNTRIES.find(c => c.code === 'FR') || WORLD_COUNTRIES[0]),
  americas: createEnvironmentProfileFromCountry(WORLD_COUNTRIES.find(c => c.code === 'US') || WORLD_COUNTRIES[0]),
  asia: createEnvironmentProfileFromCountry(WORLD_COUNTRIES.find(c => c.code === 'JP') || WORLD_COUNTRIES[0]),
};

export function getInitialUserEnvironment(): UserEnvironmentProfile {
  try {
    const saved = localStorage.getItem(USER_ENVIRONMENT_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.countryCode) {
        return parsed;
      }
    }
    const countryCode = localStorage.getItem(USER_COUNTRY_STORAGE_KEY);
    if (countryCode) {
      const country = findCountryByCode(countryCode);
      if (country) {
        return createEnvironmentProfileFromCountry(country);
      }
    }
  } catch (e) {}

  // No saved choice: start from Egypt and let App align it with the visitor's store country.
  return createEnvironmentProfileFromCountry(findCountryByCode('EG') || WORLD_COUNTRIES[0]);
}

export function saveUserEnvironment(profile: UserEnvironmentProfile): void {
  try {
    localStorage.setItem(USER_ENVIRONMENT_STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {}
}

export function updateProfileCurrency(
  profile: UserEnvironmentProfile,
  newCurrencyCode: string
): UserEnvironmentProfile {
  const cur = findCurrencyByCode(newCurrencyCode);
  const updated: UserEnvironmentProfile = {
    ...profile,
    currencyCode: cur.code,
    currencySymbolAr: cur.symbolAr,
    currencySymbolEn: cur.symbolEn,
  };
  saveUserEnvironment(updated);
  return updated;
}
