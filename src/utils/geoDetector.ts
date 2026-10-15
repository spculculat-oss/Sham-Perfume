import { SupportedLanguage } from '../types/i18n';
import { WORLD_COUNTRIES, WorldCountryData, findCountryByCode } from '../data/worldCountries';

export interface GeoDetectionResult {
  detectedCountry: WorldCountryData;
  detectedLanguage: SupportedLanguage;
  detectionSource: 'stored' | 'ip' | 'timezone' | 'locale' | 'default';
}

export const USER_COUNTRY_STORAGE_KEY = 'sham_perfume_user_country_code';
export const USER_AUTO_DETECTED_FLAG_KEY = 'sham_perfume_geo_autodetected_once';
export const USER_LANGUAGE_MANUAL_OVERRIDE_KEY = 'sham_perfume_user_override_lang';

/**
 * Maps standard IANA timezones to ISO country codes
 */
const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  // Arab World
  'Asia/Riyadh': 'SA',
  'Asia/Dubai': 'AE',
  'Africa/Cairo': 'EG',
  'Asia/Kuwait': 'KW',
  'Asia/Qatar': 'QA',
  'Asia/Bahrain': 'BH',
  'Asia/Muscat': 'OM',
  'Asia/Damascus': 'SY',
  'Asia/Beirut': 'LB',
  'Asia/Amman': 'JO',
  'Asia/Baghdad': 'IQ',
  'Africa/Casablanca': 'MA',
  'Africa/Algiers': 'DZ',
  'Africa/Tunis': 'TN',
  'Africa/Tripoli': 'LY',
  'Africa/Khartoum': 'SD',
  'Asia/Aden': 'YE',
  'Asia/Gaza': 'PS',
  'Asia/Hebron': 'PS',
  'Asia/Jerusalem': 'PS',

  // Europe
  'Europe/Paris': 'FR',
  'Europe/Rome': 'IT',
  'Europe/Berlin': 'DE',
  'Europe/Madrid': 'ES',
  'Europe/London': 'GB',
  'Europe/Zurich': 'CH',
  'Europe/Istanbul': 'TR',
  'Europe/Moscow': 'RU',

  // Americas
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Los_Angeles': 'US',
  'America/Denver': 'US',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/Sao_Paulo': 'BR',
  'America/Mexico_City': 'MX',

  // Asia
  'Asia/Tokyo': 'JP',
  'Asia/Shanghai': 'CN',
  'Asia/Seoul': 'KR',
  'Asia/Kolkata': 'IN',
  'Asia/Tehran': 'IR',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  // Extended language batch 1
  'Asia/Jakarta': 'ID',
  'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Bangkok': 'TH',
  'Asia/Kuala_Lumpur': 'MY',
  'Asia/Dhaka': 'BD',
  'Europe/Warsaw': 'PL',
  'Europe/Amsterdam': 'NL',
  'Europe/Kyiv': 'UA',
  'Europe/Kiev': 'UA',
  'Europe/Athens': 'GR',
  'Europe/Prague': 'CZ',
  'Europe/Bucharest': 'RO',
  'Europe/Lisbon': 'PT',
  // Extended language batch 2 (RTL)
  'Asia/Karachi': 'PK',
  'Asia/Kabul': 'AF',
  // Extended language batch 3 (Nordic, Balkans, Baltics, Caucasus)
  'Europe/Stockholm': 'SE',
  'Europe/Copenhagen': 'DK',
  'Europe/Helsinki': 'FI',
  'Europe/Oslo': 'NO',
  'Europe/Budapest': 'HU',
  'Europe/Bratislava': 'SK',
  'Europe/Ljubljana': 'SI',
  'Europe/Zagreb': 'HR',
  'Europe/Belgrade': 'RS',
  'Europe/Sofia': 'BG',
  'Europe/Vilnius': 'LT',
  'Europe/Riga': 'LV',
  'Europe/Tallinn': 'EE',
  'Asia/Tbilisi': 'GE',
  'Asia/Yerevan': 'AM',
  // Extended language batch 4 (Africa, SE Asia, Oceania)
  'Asia/Manila': 'PH',
  'Africa/Nairobi': 'KE',
  'Africa/Addis_Ababa': 'ET',
  'Africa/Lagos': 'NG',
  'Africa/Johannesburg': 'ZA',
  'Pacific/Auckland': 'NZ',
  'Africa/Mogadishu': 'SO',
  'Asia/Kathmandu': 'NP',
  'Asia/Colombo': 'LK',
  'Asia/Yangon': 'MM',
  'Asia/Phnom_Penh': 'KH',
  'Asia/Vientiane': 'LA',
  // Extended language batch 5 (India, Central Asia)
  'Asia/Almaty': 'KZ',
  'Asia/Tashkent': 'UZ',
  'Asia/Baku': 'AZ',
  'Asia/Ulaanbaatar': 'MN',
  'Asia/Ulan_Bator': 'MN',
  'Asia/Bishkek': 'KG',
  'Asia/Dushanbe': 'TJ',
  'Asia/Ashgabat': 'TM',
  // Extended language batch 6 (Europe)
  'Atlantic/Reykjavik': 'IS',
  'Europe/Tirane': 'AL',
  'Europe/Skopje': 'MK',
  'Europe/Sarajevo': 'BA',
  'Europe/Minsk': 'BY',
  'Europe/Malta': 'MT',
  'Europe/Dublin': 'IE',
  'Europe/Luxembourg': 'LU',
  // Extended language batch 7 (final: Asia, Africa)
  'Asia/Thimphu': 'BT',
  'Indian/Antananarivo': 'MG',
  'Africa/Harare': 'ZW',
  'Africa/Kigali': 'RW',
  'Africa/Maseru': 'LS',
  'Africa/Kinshasa': 'CD',
  'Africa/Lubumbashi': 'CD',
  'Africa/Asmara': 'ER',
};

/**
 * Maps browser language tags (e.g., 'fr-FR', 'ar-EG') to country code if timezone is generic
 */
function getCountryFromBrowserLocale(): string | null {
  try {
    const langs = navigator.languages || [navigator.language];
    for (const lang of langs) {
      if (!lang) continue;
      const parts = lang.split('-');
      if (parts.length > 1 && parts[1]) {
        const potentialCode = parts[1].toUpperCase();
        if (findCountryByCode(potentialCode)) {
          return potentialCode;
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

/**
 * Detect country code from TimeZone
 */
function getCountryFromTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_TO_COUNTRY[tz]) {
      return TIMEZONE_TO_COUNTRY[tz];
    }
    // Partial matches
    if (tz.includes('Riyadh')) return 'SA';
    if (tz.includes('Dubai')) return 'AE';
    if (tz.includes('Cairo')) return 'EG';
    if (tz.includes('Kuwait')) return 'KW';
    if (tz.includes('Qatar')) return 'QA';
    if (tz.includes('Damascus')) return 'SY';
    if (tz.includes('Beirut')) return 'LB';
    if (tz.includes('Amman')) return 'JO';
    if (tz.includes('Baghdad')) return 'IQ';
    if (tz.includes('Casablanca')) return 'MA';
    if (tz.includes('Algiers')) return 'DZ';
    if (tz.includes('Tunis')) return 'TN';
    if (tz.includes('Paris')) return 'FR';
    if (tz.includes('Rome')) return 'IT';
    if (tz.includes('Berlin')) return 'DE';
    if (tz.includes('Madrid')) return 'ES';
    if (tz.includes('London')) return 'GB';
    if (tz.includes('Istanbul')) return 'TR';
    if (tz.includes('Tehran')) return 'IR';
    if (tz.includes('Moscow')) return 'RU';
    if (tz.includes('Shanghai') || tz.includes('Beijing')) return 'CN';
    if (tz.includes('Tokyo')) return 'JP';
    if (tz.includes('New_York') || tz.includes('Los_Angeles')) return 'US';
  } catch (e) {
    // ignore
  }
  return null;
}

/**
 * Detect the user's country and initial language based on the country where the site was opened.
 */
export function detectUserCountryAndLanguage(): GeoDetectionResult {
  // 1. Check if user already has a saved country in localStorage
  try {
    const savedCode = localStorage.getItem(USER_COUNTRY_STORAGE_KEY);
    if (savedCode) {
      const match = findCountryByCode(savedCode);
      if (match) {
        return {
          detectedCountry: match,
          detectedLanguage: match.primaryLanguage,
          detectionSource: 'stored',
        };
      }
    }
  } catch (e) {
    // ignore
  }

  // 2. Detect from TimeZone
  const tzCountryCode = getCountryFromTimezone();
  if (tzCountryCode) {
    const match = findCountryByCode(tzCountryCode);
    if (match) {
      return {
        detectedCountry: match,
        detectedLanguage: match.primaryLanguage,
        detectionSource: 'timezone',
      };
    }
  }

  // 3. Detect from Navigator Locale
  const localeCountryCode = getCountryFromBrowserLocale();
  if (localeCountryCode) {
    const match = findCountryByCode(localeCountryCode);
    if (match) {
      return {
        detectedCountry: match,
        detectedLanguage: match.primaryLanguage,
        detectionSource: 'locale',
      };
    }
  }

  // 4. Fallback: Check primary language from browser
  try {
    const primaryLang = (navigator.language || 'ar').split('-')[0].toLowerCase();
    if (primaryLang === 'ar') {
      return {
        detectedCountry: findCountryByCode('SA')!,
        detectedLanguage: 'ar',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'fr') {
      return {
        detectedCountry: findCountryByCode('FR')!,
        detectedLanguage: 'fr',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'es') {
      return {
        detectedCountry: findCountryByCode('ES')!,
        detectedLanguage: 'es',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'it') {
      return {
        detectedCountry: findCountryByCode('IT')!,
        detectedLanguage: 'it',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'de') {
      return {
        detectedCountry: findCountryByCode('DE')!,
        detectedLanguage: 'de',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'ru') {
      return {
        detectedCountry: findCountryByCode('RU')!,
        detectedLanguage: 'ru',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'zh') {
      return {
        detectedCountry: findCountryByCode('CN')!,
        detectedLanguage: 'zh',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'tr') {
      return {
        detectedCountry: findCountryByCode('TR')!,
        detectedLanguage: 'tr',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'fa') {
      return {
        detectedCountry: findCountryByCode('IR')!,
        detectedLanguage: 'fa',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'hi') {
      return {
        detectedCountry: findCountryByCode('IN')!,
        detectedLanguage: 'hi',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'pt') {
      return {
        detectedCountry: findCountryByCode('BR')!,
        detectedLanguage: 'pt',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'id') {
      return {
        detectedCountry: findCountryByCode('ID')!,
        detectedLanguage: 'id',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'ja') {
      return {
        detectedCountry: findCountryByCode('JP')!,
        detectedLanguage: 'ja',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'ko') {
      return {
        detectedCountry: findCountryByCode('KR')!,
        detectedLanguage: 'ko',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'vi') {
      return {
        detectedCountry: findCountryByCode('VN')!,
        detectedLanguage: 'vi',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'th') {
      return {
        detectedCountry: findCountryByCode('TH')!,
        detectedLanguage: 'th',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'pl') {
      return {
        detectedCountry: findCountryByCode('PL')!,
        detectedLanguage: 'pl',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'nl') {
      return {
        detectedCountry: findCountryByCode('NL')!,
        detectedLanguage: 'nl',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'uk') {
      return {
        detectedCountry: findCountryByCode('UA')!,
        detectedLanguage: 'uk',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'el') {
      return {
        detectedCountry: findCountryByCode('GR')!,
        detectedLanguage: 'el',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'ms') {
      return {
        detectedCountry: findCountryByCode('MY')!,
        detectedLanguage: 'ms',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'bn') {
      return {
        detectedCountry: findCountryByCode('BD')!,
        detectedLanguage: 'bn',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'cs') {
      return {
        detectedCountry: findCountryByCode('CZ')!,
        detectedLanguage: 'cs',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'ro') {
      return {
        detectedCountry: findCountryByCode('RO')!,
        detectedLanguage: 'ro',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'he') {
      return {
        detectedCountry: findCountryByCode('IL')!,
        detectedLanguage: 'he',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'ur') {
      return {
        detectedCountry: findCountryByCode('PK')!,
        detectedLanguage: 'ur',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'ps') {
      return {
        detectedCountry: findCountryByCode('AF')!,
        detectedLanguage: 'ps',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'sv') {
      return {
        detectedCountry: findCountryByCode('SE')!,
        detectedLanguage: 'sv',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'da') {
      return {
        detectedCountry: findCountryByCode('DK')!,
        detectedLanguage: 'da',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'fi') {
      return {
        detectedCountry: findCountryByCode('FI')!,
        detectedLanguage: 'fi',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'no' || primaryLang === 'nb' || primaryLang === 'nn') {
      return {
        detectedCountry: findCountryByCode('NO')!,
        detectedLanguage: 'no',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'hu') {
      return {
        detectedCountry: findCountryByCode('HU')!,
        detectedLanguage: 'hu',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'sk') {
      return {
        detectedCountry: findCountryByCode('SK')!,
        detectedLanguage: 'sk',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'sl') {
      return {
        detectedCountry: findCountryByCode('SI')!,
        detectedLanguage: 'sl',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'hr') {
      return {
        detectedCountry: findCountryByCode('HR')!,
        detectedLanguage: 'hr',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'sr') {
      return {
        detectedCountry: findCountryByCode('RS')!,
        detectedLanguage: 'sr',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'bg') {
      return {
        detectedCountry: findCountryByCode('BG')!,
        detectedLanguage: 'bg',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'lt') {
      return {
        detectedCountry: findCountryByCode('LT')!,
        detectedLanguage: 'lt',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'lv') {
      return {
        detectedCountry: findCountryByCode('LV')!,
        detectedLanguage: 'lv',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'et') {
      return {
        detectedCountry: findCountryByCode('EE')!,
        detectedLanguage: 'et',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'ka') {
      return {
        detectedCountry: findCountryByCode('GE')!,
        detectedLanguage: 'ka',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'hy') {
      return {
        detectedCountry: findCountryByCode('AM')!,
        detectedLanguage: 'hy',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'tl' || primaryLang === 'fil') {
      return {
        detectedCountry: findCountryByCode('PH')!,
        detectedLanguage: 'tl',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'sw') {
      return {
        detectedCountry: findCountryByCode('KE')!,
        detectedLanguage: 'sw',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'am') {
      return {
        detectedCountry: findCountryByCode('ET')!,
        detectedLanguage: 'am',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'ha') {
      return {
        detectedCountry: findCountryByCode('NG')!,
        detectedLanguage: 'ha',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'yo') {
      return {
        detectedCountry: findCountryByCode('NG')!,
        detectedLanguage: 'yo',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'zu') {
      return {
        detectedCountry: findCountryByCode('ZA')!,
        detectedLanguage: 'zu',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'af') {
      return {
        detectedCountry: findCountryByCode('ZA')!,
        detectedLanguage: 'af',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'so') {
      return {
        detectedCountry: findCountryByCode('SO')!,
        detectedLanguage: 'so',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'jv') {
      return {
        detectedCountry: findCountryByCode('ID')!,
        detectedLanguage: 'jv',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'mi') {
      return {
        detectedCountry: findCountryByCode('NZ')!,
        detectedLanguage: 'mi',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'ne') {
      return {
        detectedCountry: findCountryByCode('NP')!,
        detectedLanguage: 'ne',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'si') {
      return {
        detectedCountry: findCountryByCode('LK')!,
        detectedLanguage: 'si',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'my') {
      return {
        detectedCountry: findCountryByCode('MM')!,
        detectedLanguage: 'my',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'km') {
      return {
        detectedCountry: findCountryByCode('KH')!,
        detectedLanguage: 'km',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'lo') {
      return {
        detectedCountry: findCountryByCode('LA')!,
        detectedLanguage: 'lo',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'ta') {
      return {
        detectedCountry: findCountryByCode('IN')!,
        detectedLanguage: 'ta',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'te') {
      return {
        detectedCountry: findCountryByCode('IN')!,
        detectedLanguage: 'te',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'mr') {
      return {
        detectedCountry: findCountryByCode('IN')!,
        detectedLanguage: 'mr',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'gu') {
      return {
        detectedCountry: findCountryByCode('IN')!,
        detectedLanguage: 'gu',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'pa') {
      return {
        detectedCountry: findCountryByCode('IN')!,
        detectedLanguage: 'pa',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'kn') {
      return {
        detectedCountry: findCountryByCode('IN')!,
        detectedLanguage: 'kn',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'ml') {
      return {
        detectedCountry: findCountryByCode('IN')!,
        detectedLanguage: 'ml',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'or') {
      return {
        detectedCountry: findCountryByCode('IN')!,
        detectedLanguage: 'or',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'kk') {
      return {
        detectedCountry: findCountryByCode('KZ')!,
        detectedLanguage: 'kk',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'uz') {
      return {
        detectedCountry: findCountryByCode('UZ')!,
        detectedLanguage: 'uz',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'az') {
      return {
        detectedCountry: findCountryByCode('AZ')!,
        detectedLanguage: 'az',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'mn') {
      return {
        detectedCountry: findCountryByCode('MN')!,
        detectedLanguage: 'mn',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'ky') {
      return {
        detectedCountry: findCountryByCode('KG')!,
        detectedLanguage: 'ky',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'tg') {
      return {
        detectedCountry: findCountryByCode('TJ')!,
        detectedLanguage: 'tg',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'tk') {
      return {
        detectedCountry: findCountryByCode('TM')!,
        detectedLanguage: 'tk',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'is') {
      return {
        detectedCountry: findCountryByCode('IS')!,
        detectedLanguage: 'is',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'sq') {
      return {
        detectedCountry: findCountryByCode('AL')!,
        detectedLanguage: 'sq',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'mk') {
      return {
        detectedCountry: findCountryByCode('MK')!,
        detectedLanguage: 'mk',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'bs') {
      return {
        detectedCountry: findCountryByCode('BA')!,
        detectedLanguage: 'bs',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'be') {
      return {
        detectedCountry: findCountryByCode('BY')!,
        detectedLanguage: 'be',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'ca') {
      return {
        detectedCountry: findCountryByCode('ES')!,
        detectedLanguage: 'ca',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'eu') {
      return {
        detectedCountry: findCountryByCode('ES')!,
        detectedLanguage: 'eu',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'gl') {
      return {
        detectedCountry: findCountryByCode('ES')!,
        detectedLanguage: 'gl',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'mt') {
      return {
        detectedCountry: findCountryByCode('MT')!,
        detectedLanguage: 'mt',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'ga') {
      return {
        detectedCountry: findCountryByCode('IE')!,
        detectedLanguage: 'ga',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'cy') {
      return {
        detectedCountry: findCountryByCode('GB')!,
        detectedLanguage: 'cy',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'lb') {
      return {
        detectedCountry: findCountryByCode('LU')!,
        detectedLanguage: 'lb',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'gd') {
      return {
        detectedCountry: findCountryByCode('GB')!,
        detectedLanguage: 'gd',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'co') {
      return {
        detectedCountry: findCountryByCode('FR')!,
        detectedLanguage: 'co',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'sd') {
      return {
        detectedCountry: findCountryByCode('PK')!,
        detectedLanguage: 'sd',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'as') {
      return {
        detectedCountry: findCountryByCode('IN')!,
        detectedLanguage: 'as',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'oc') {
      return {
        detectedCountry: findCountryByCode('FR')!,
        detectedLanguage: 'oc',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'bo') {
      return {
        detectedCountry: findCountryByCode('CN')!,
        detectedLanguage: 'bo',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'dz') {
      return {
        detectedCountry: findCountryByCode('BT')!,
        detectedLanguage: 'dz',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'mg') {
      return {
        detectedCountry: findCountryByCode('MG')!,
        detectedLanguage: 'mg',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'sn') {
      return {
        detectedCountry: findCountryByCode('ZW')!,
        detectedLanguage: 'sn',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'rw') {
      return {
        detectedCountry: findCountryByCode('RW')!,
        detectedLanguage: 'rw',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'st') {
      return {
        detectedCountry: findCountryByCode('LS')!,
        detectedLanguage: 'st',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'ln') {
      return {
        detectedCountry: findCountryByCode('CD')!,
        detectedLanguage: 'ln',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'ti') {
      return {
        detectedCountry: findCountryByCode('ER')!,
        detectedLanguage: 'ti',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'om') {
      return {
        detectedCountry: findCountryByCode('ET')!,
        detectedLanguage: 'om',
        detectionSource: 'default',
      };
    } else if (primaryLang === 'ig') {
      return {
        detectedCountry: findCountryByCode('NG')!,
        detectedLanguage: 'ig',
        detectionSource: 'default',
      };
    }
  } catch (e) {
    // ignore
  }

  // Default to Saudi Arabia / Arabic
  const defaultCountry = findCountryByCode('SA') || WORLD_COUNTRIES[0];
  return {
    detectedCountry: defaultCountry,
    detectedLanguage: 'ar',
    detectionSource: 'default',
  };
}

/**
 * Save user chosen country code
 */
export function saveUserCountryCode(code: string): void {
  try {
    localStorage.setItem(USER_COUNTRY_STORAGE_KEY, code.toUpperCase());
    localStorage.setItem(USER_AUTO_DETECTED_FLAG_KEY, 'true');
  } catch (e) {
    console.error('Failed to save country code', e);
  }
}

/**
 * Asynchronously detects user country using IP-based lookup with fallback to timezone and browser language.
 * Honors manual client language override if previously set.
 */
export async function detectUserLocationAsync(): Promise<GeoDetectionResult> {
  // 1. If user previously manually chose their language, respect their choice
  try {
    const hasManualOverride = localStorage.getItem(USER_LANGUAGE_MANUAL_OVERRIDE_KEY);
    const savedCode = localStorage.getItem(USER_COUNTRY_STORAGE_KEY);
    if (hasManualOverride && savedCode) {
      const match = findCountryByCode(savedCode);
      if (match) {
        return {
          detectedCountry: match,
          detectedLanguage: match.primaryLanguage,
          detectionSource: 'stored',
        };
      }
    }
  } catch (e) {
    // ignore
  }

  // 2. Try online IP-based country detection (fast timeout of 1200ms)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const res = await fetch('https://api.country.is/', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data && data.country) {
        const match = findCountryByCode(data.country);
        if (match) {
          saveUserCountryCode(match.code);
          return {
            detectedCountry: match,
            detectedLanguage: match.primaryLanguage,
            detectionSource: 'ip',
          };
        }
      }
    }
  } catch (e) {
    // Network error or timeout, proceed to local detection
  }

  // 3. Fallback to synchronous Timezone and Locale detection
  return detectUserCountryAndLanguage();
}

/**
 * Force re-detects the user's location and language, clearing any manual overrides.
 */
export async function forceRedetectLocation(): Promise<GeoDetectionResult> {
  try {
    localStorage.removeItem(USER_LANGUAGE_MANUAL_OVERRIDE_KEY);
  } catch (e) {
    // ignore
  }
  return detectUserLocationAsync();
}
