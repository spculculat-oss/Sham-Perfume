/**
 * «روبوت التعداد وإحصاء الزيارات — دولة المنصة» (bot id: `census`)
 *
 * Pure, browser-safe module shared by:
 *   - the live server endpoint (`server/census.ts` — `/api/census/visit`, `/api/census/public`, `/api/admin/census`),
 *   - the State's census robot (`scripts/state/census.mts`, `.github/workflows/platform-census.yml`),
 *   - the «خانة التعداد» & Interactive World Country Heatmap (`src/admin/PlatformCensusPanel.tsx`, `src/admin/WorldVisitHeatmap.tsx`),
 *   - «غرفة دولة المنصة» (`src/utils/stateRoom.ts`).
 *
 * Honesty & privacy rules (State constitution & legal compliance):
 *   - Only real visits are counted; zero is reported honestly as zero — never fake or demo traffic.
 *   - City/governorate entry points use `0.01°` (~1 km) city-level coordinates; raw IP addresses,
 *     names, emails, or personal identifiers never enter the report or the public statement.
 */
import { WORLD_COUNTRIES, findCountryByCode } from '../data/worldCountries';
import {
  resolveVisitorEntryLocation,
  type GeoPrecision,
} from '../data/worldEntryGazetteer';
import { isCountry } from './pricing';

/** Official creation timestamp of the Sham Perfume platform repository (`spculculat-oss/Sham-Perfume`). */
export const SITE_CREATED_AT = '2026-10-12T05:24:11.000Z';

export const CENSUS_BOT = {
  id: 'census' as const,
  nameAr: 'روبوت التعداد وإحصاء الزيارات — دولة المنصة',
  nameEn: 'Census & Visit Counter Robot — Platform State',
  shortAr: 'خانة التعداد — دولة المنصة',
  shortEn: 'State Census & Visit Ledger',
  reportFile: 'platform-census.json',
  workflowFile: 'platform-census.yml',
} as const;

export type WorldRegionId = 'arab' | 'europe' | 'asia' | 'africa' | 'americas' | 'oceania';
export type CensusDevice = 'mobile' | 'desktop' | 'tablet';
export type HeatLevel = 'none' | 'low' | 'warm' | 'hot' | 'blazing';
export type DayPartId = 'dawn' | 'morning' | 'afternoon' | 'evening';

export const DAY_PARTS: Record<
  DayPartId,
  {
    id: DayPartId;
    ar: string;
    en: string;
    rangeAr: string;
    rangeEn: string;
    hours: readonly number[];
    color: string;
  }
> = {
  dawn: {
    id: 'dawn',
    ar: 'الفجر والصباح الباكر',
    en: 'Dawn & Early Morning',
    rangeAr: '12 ص – 6 ص',
    rangeEn: '00:00 – 05:59',
    hours: [0, 1, 2, 3, 4, 5],
    color: '#38bdf8',
  },
  morning: {
    id: 'morning',
    ar: 'الصباح والظهيرة',
    en: 'Morning & Forenoon',
    rangeAr: '6 ص – 12 م',
    rangeEn: '06:00 – 11:59',
    hours: [6, 7, 8, 9, 10, 11],
    color: '#fbbf24',
  },
  afternoon: {
    id: 'afternoon',
    ar: 'بعد الظهر والعصر',
    en: 'Afternoon',
    rangeAr: '12 م – 6 م',
    rangeEn: '12:00 – 17:59',
    hours: [12, 13, 14, 15, 16, 17],
    color: '#f97316',
  },
  evening: {
    id: 'evening',
    ar: 'المساء والليل',
    en: 'Evening & Night',
    rangeAr: '6 م – 12 ص',
    rangeEn: '18:00 – 23:59',
    hours: [18, 19, 20, 21, 22, 23],
    color: '#a855f7',
  },
};

export const WORLD_REGIONS: Record<WorldRegionId, { ar: string; en: string; view: { x: number; y: number; zoom: number } }> = {
  arab: { ar: 'العالم العربي والشرق الأوسط', en: 'Arab World & Middle East', view: { x: 580, y: 175, zoom: 2.8 } },
  europe: { ar: 'أوروبا', en: 'Europe', view: { x: 535, y: 105, zoom: 2.9 } },
  asia: { ar: 'آسيا', en: 'Asia', view: { x: 745, y: 170, zoom: 2.0 } },
  africa: { ar: 'أفريقيا', en: 'Africa', view: { x: 545, y: 265, zoom: 2.1 } },
  americas: { ar: 'الأمريكتان', en: 'The Americas', view: { x: 245, y: 215, zoom: 1.7 } },
  oceania: { ar: 'أوقيانوسيا', en: 'Oceania', view: { x: 855, y: 335, zoom: 2.4 } },
};

export const CENSUS_SECTIONS: Record<string, { ar: string; en: string }> = {
  home: { ar: 'الصفحة الرئيسية', en: 'Home hub' },
  store: { ar: 'متجر شام', en: 'Sham store' },
  product: { ar: 'صفحات المنتجات', en: 'Product pages' },
  concentration: { ar: 'حاسبة التركيز', en: 'Concentration calculator' },
  pyramid: { ar: 'الهرم العطري', en: 'Fragrance pyramid' },
  cost: { ar: 'حاسبة التكلفة', en: 'Cost calculator' },
  dilution: { ar: 'حاسبة التخفيف', en: 'Dilution calculator' },
  cosmetics: { ar: 'معمل التجميل', en: 'Cosmetics lab' },
  raw_materials: { ar: 'موسوعة الخامات', en: 'Raw materials' },
  library: { ar: 'المكتبة الرقمية', en: 'Digital library' },
  news: { ar: 'مرصد العطور والأخبار', en: 'Perfume news observatory' },
  community: { ar: 'مجتمع شام', en: 'Sham community' },
  guide: { ar: 'الدليل العلمي', en: 'Scientific guide' },
  legal: { ar: 'المركز القانوني', en: 'Legal center' },
  other: { ar: 'أقسام أخرى', en: 'Other sections' },
};

const SECTION_ALIASES: Record<string, string> = {
  '': 'home', home: 'home', landing: 'home', hub: 'home',
  store: 'store', shop: 'store', market: 'store', cart: 'store', checkout: 'store',
  product: 'product', productdetail: 'product',
  concentration: 'concentration', formula: 'concentration', lab: 'concentration',
  pyramid: 'pyramid', molecules: 'pyramid',
  cost: 'cost', pricing: 'cost',
  dilution: 'dilution', alcohol: 'dilution',
  cosmetics: 'cosmetics', skincare: 'cosmetics',
  raw_materials: 'raw_materials', materials: 'raw_materials', ingredients: 'raw_materials',
  library: 'library', books: 'library', reader: 'library',
  news: 'news', observatory: 'news',
  community: 'community', social: 'community', stores: 'community',
  guide: 'guide', criteria: 'guide', world_perfumes: 'guide',
  legal: 'legal', privacy: 'legal', terms: 'legal',
};

/** Normalizes any hash/tab name into a clean, safe section key (never leaks URL queries or user inputs). */
export function sanitizeCensusSection(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return 'home';
  const cleaned = raw.trim().replace(/^#\/?/, '').split(/[=?&/]/)[0]?.toLowerCase() || '';
  if (cleaned === 'admin' || cleaned === 'owner' || cleaned === 'ops') return undefined;
  if (raw.includes('product=') || cleaned.startsWith('product')) return 'product';
  return SECTION_ALIASES[cleaned] || (cleaned in CENSUS_SECTIONS ? cleaned : 'other');
}

/** Geographic centroids `[lat, lon]` for ISO-2 countries & territories across the globe. */
export const COUNTRY_COORDS: Record<string, [number, number]> = {
  // Arab World & Middle East
  EG: [26.8, 30.8], SA: [23.9, 45.1], AE: [23.4, 53.8], KW: [29.3, 47.5], QA: [25.3, 51.2],
  BH: [26.0, 50.55], OM: [21.5, 55.9], SY: [34.8, 39.0], LB: [33.85, 35.86], JO: [30.6, 36.2],
  IQ: [33.2, 43.7], PS: [31.9, 35.2], YE: [15.55, 48.5], LY: [26.3, 17.2], TN: [33.9, 9.5],
  DZ: [28.0, 1.66], MA: [31.8, -7.1], SD: [12.86, 30.2], MR: [21.0, -10.9], SO: [5.15, 46.2],
  DJ: [11.8, 42.6], KM: [-11.65, 43.3],
  // Europe
  FR: [46.2, 2.2], DE: [51.16, 10.45], GB: [55.38, -3.4], IT: [41.87, 12.57], ES: [40.46, -3.75],
  PT: [39.4, -8.2], NL: [52.13, 5.29], BE: [50.5, 4.47], LU: [49.8, 6.13], CH: [46.8, 8.23],
  AT: [47.5, 14.55], IE: [53.4, -8.2], PL: [51.9, 19.15], CZ: [49.8, 15.47], SK: [48.67, 19.7],
  HU: [47.16, 19.5], RO: [45.94, 24.97], BG: [42.73, 25.49], GR: [39.07, 21.82], CY: [35.13, 33.43],
  MT: [35.94, 14.38], TR: [38.96, 35.24], RU: [61.5, 95.0], UA: [48.38, 31.17], BY: [53.7, 27.95],
  MD: [47.4, 28.37], SE: [60.13, 18.64], NO: [60.47, 8.47], FI: [61.92, 25.75], DK: [56.26, 9.5],
  IS: [64.96, -19.02], EE: [58.6, 25.0], LV: [56.88, 24.6], LT: [55.17, 23.88], HR: [45.1, 15.2],
  SI: [46.15, 14.99], BA: [43.9, 17.68], RS: [44.0, 21.0], ME: [42.7, 19.37], MK: [41.6, 21.75],
  AL: [41.15, 20.17], XK: [42.6, 20.9], GE: [42.3, 43.36], AM: [40.07, 45.04], AZ: [40.14, 47.58],
  // Asia
  CN: [35.86, 104.2], JP: [36.2, 138.25], KR: [35.9, 127.77], KP: [40.34, 127.5], TW: [23.7, 121.0],
  HK: [22.32, 114.17], MO: [22.2, 113.54], MN: [46.86, 103.85], IN: [20.59, 78.96], PK: [30.38, 69.35],
  BD: [23.68, 90.36], LK: [7.87, 80.77], NP: [28.39, 84.12], BT: [27.5, 90.43], MV: [3.2, 73.22],
  AF: [33.94, 67.7], IR: [32.43, 53.69], IL: [31.05, 34.85], KZ: [48.0, 66.9], UZ: [41.38, 64.59],
  TM: [38.97, 59.56], KG: [41.2, 74.77], TJ: [38.86, 71.28], ID: [-0.79, 113.92], MY: [4.2, 101.98],
  SG: [1.35, 103.82], TH: [15.87, 100.99], VN: [14.06, 108.28], PH: [12.88, 121.77], MM: [21.9, 95.96],
  KH: [12.57, 104.99], LA: [19.86, 102.5], BN: [4.54, 114.73], TL: [-8.87, 125.73],
  // Africa
  NG: [9.08, 8.68], ZA: [-30.56, 22.94], KE: [-0.02, 37.9], ET: [9.15, 40.49], GH: [7.95, -1.02],
  TZ: [-6.37, 34.89], UG: [1.37, 32.29], SN: [14.5, -14.45], CI: [7.54, -5.55], CM: [7.37, 12.35],
  CD: [-4.04, 21.76], CG: [-0.23, 15.83], AO: [-11.2, 17.87], MZ: [-18.67, 35.53], MG: [-18.77, 46.87],
  ZM: [-13.13, 27.85], ZW: [-19.02, 29.15], RW: [-1.94, 29.87], BI: [-3.37, 29.92], ER: [15.18, 39.78],
  SS: [6.88, 31.3], TD: [15.45, 18.73], NE: [17.6, 8.08], ML: [17.57, -4.0], BF: [12.24, -1.56],
  GN: [9.95, -9.7], SL: [8.46, -11.78], LR: [6.43, -9.43], TG: [8.62, 0.82], BJ: [9.31, 2.32],
  GA: [-0.8, 11.6], GQ: [1.65, 10.27], CF: [6.61, 20.94], NA: [-22.96, 18.49], BW: [-22.33, 24.68],
  LS: [-29.61, 28.23], SZ: [-26.52, 31.47], MW: [-13.25, 34.3], MU: [-20.35, 57.55], GM: [13.44, -15.31],
  // Americas
  US: [37.09, -95.71], CA: [56.13, -106.35], MX: [23.63, -102.55], BR: [-14.24, -51.93],
  AR: [-38.42, -63.62], CL: [-35.68, -71.54], CO: [4.57, -74.3], PE: [-9.19, -75.02],
  VE: [6.42, -66.59], EC: [-1.83, -78.18], BO: [-16.29, -63.59], PY: [-23.44, -58.44],
  UY: [-32.52, -55.77], GY: [4.86, -58.93], SR: [3.92, -56.03], GT: [15.78, -90.23],
  HN: [15.2, -86.24], SV: [13.79, -88.9], NI: [12.87, -85.21], CR: [9.75, -83.75],
  PA: [8.54, -80.78], CU: [21.52, -77.78], DO: [18.74, -70.16], HT: [18.97, -72.29],
  JM: [18.11, -77.3], TT: [10.69, -61.22], PR: [18.22, -66.59], BS: [25.03, -77.4],
  // Oceania
  AU: [-25.27, 133.78], NZ: [-40.9, 174.89], PG: [-6.31, 143.96], FJ: [-17.71, 178.07],
};

const ARAB_CODES = new Set(['EG', 'SA', 'AE', 'KW', 'QA', 'BH', 'OM', 'SY', 'LB', 'JO', 'IQ', 'PS', 'YE', 'LY', 'TN', 'DZ', 'MA', 'SD', 'MR', 'SO', 'DJ', 'KM']);
const EUROPE_CODES = new Set(['FR', 'DE', 'GB', 'IT', 'ES', 'PT', 'NL', 'BE', 'LU', 'CH', 'AT', 'IE', 'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'GR', 'CY', 'MT', 'TR', 'RU', 'UA', 'BY', 'MD', 'SE', 'NO', 'FI', 'DK', 'IS', 'EE', 'LV', 'LT', 'HR', 'SI', 'BA', 'RS', 'ME', 'MK', 'AL', 'XK', 'GE', 'AM', 'AZ']);
const AMERICAS_CODES = new Set(['US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'EC', 'BO', 'PY', 'UY', 'GY', 'SR', 'GT', 'HN', 'SV', 'NI', 'CR', 'PA', 'CU', 'DO', 'HT', 'JM', 'TT', 'PR', 'BS']);
const OCEANIA_CODES = new Set(['AU', 'NZ', 'PG', 'FJ']);
const AFRICA_CODES = new Set(['NG', 'ZA', 'KE', 'ET', 'GH', 'TZ', 'UG', 'SN', 'CI', 'CM', 'CD', 'CG', 'AO', 'MZ', 'MG', 'ZM', 'ZW', 'RW', 'BI', 'ER', 'SS', 'TD', 'NE', 'ML', 'BF', 'GN', 'SL', 'LR', 'TG', 'BJ', 'GA', 'GQ', 'CF', 'NA', 'BW', 'LS', 'SZ', 'MW', 'MU', 'GM']);

export function regionOfCountry(code: string): WorldRegionId {
  const upper = (code || '').toUpperCase();
  const known = findCountryByCode(upper);
  if (known?.regionCategory) return known.regionCategory;
  if (ARAB_CODES.has(upper)) return 'arab';
  if (EUROPE_CODES.has(upper)) return 'europe';
  if (AMERICAS_CODES.has(upper)) return 'americas';
  if (OCEANIA_CODES.has(upper)) return 'oceania';
  if (AFRICA_CODES.has(upper)) return 'africa';
  return 'asia';
}

export function flagOfCountry(code: string): string {
  const upper = (code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper) || upper === 'UN') return '🌐';
  const known = findCountryByCode(upper);
  if (known?.flag) return known.flag;
  return String.fromCodePoint(...[...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

const displayName = (code: string, lang: 'ar' | 'en'): string => {
  const upper = (code || '').toUpperCase();
  if (upper === 'UN' || !/^[A-Z]{2}$/.test(upper)) return lang === 'ar' ? 'غير محدد الموقع' : 'Unspecified location';
  const known = findCountryByCode(upper);
  if (known) {
    const raw = lang === 'ar' ? known.nameAr : known.nameEn;
    return raw.split(' (')[0]?.trim() || raw;
  }
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(upper) || upper;
  } catch {
    return upper;
  }
};

export const countryNameAr = (code: string) => displayName(code, 'ar');
export const countryNameEn = (code: string) => displayName(code, 'en');

/** Projects `[lat, lon]` onto an equirectangular SVG canvas (`width` × `height`). */
export function projectWorldPoint(lat: number, lon: number, width = 1000, height = 500): { x: number; y: number } {
  const clampedLat = Math.max(-62, Math.min(78, lat));
  const normalizedLon = ((lon + 180) % 360 + 360) % 360 - 180;
  const x = ((normalizedLon + 180) / 360) * width;
  const y = ((78 - clampedLat) / 140) * height;
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

/** Cairo YYYY-MM-DD date string. */
export function cairoDay(isoOrDate: string | Date = new Date()): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const valid = Number.isFinite(d.getTime()) ? d : new Date();
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(valid);
}

/** Cairo YYYY-MM month string. */
export function cairoMonth(isoOrDate: string | Date = new Date()): string {
  return cairoDay(isoOrDate).slice(0, 7);
}

/** Cairo hour of day (0..23). */
export function cairoHour(isoOrDate: string | Date = new Date()): number {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const valid = Number.isFinite(d.getTime()) ? d : new Date();
  const h = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', hour12: false }).format(valid),
  );
  return Number.isInteger(h) && h >= 0 && h < 24 ? h : 0;
}

export function dayPartOfHour(hour: number): DayPartId {
  if (hour < 6) return 'dawn';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

// ── Stored & Published Census Data ───────────────────────────────────────────────────────────────────────────
export interface CensusCountryRecord {
  code: string;
  visits: number;
  uniqueVisitors: number;
  todayVisits: number;
  todayDate?: string;
  lastVisitAt: string;
  sections?: Record<string, number>;
  languages?: Record<string, number>;
}

/** Exact city/governorate/region entry point inside a country (`0.01°` city-level precision). */
export interface CensusPlaceRecord {
  id: string;
  country: string;
  cityAr: string;
  cityEn: string;
  regionAr?: string;
  regionEn?: string;
  lat: number;
  lon: number;
  precision: GeoPrecision;
  visits: number;
  uniqueVisitors: number;
  todayVisits: number;
  todayDate?: string;
  lastVisitAt: string;
  sections?: Record<string, number>;
}

/** Rolling entry feed item showing exact entry place & time without personal identifiers. */
export interface CensusRecentEntry {
  at: string;
  country: string;
  placeId: string;
  cityAr: string;
  cityEn: string;
  regionAr?: string;
  lat: number;
  lon: number;
  precision: GeoPrecision;
  section: string;
  device: CensusDevice;
  lang: string;
}

export interface CensusDayRecord {
  date: string;
  visits: number;
  uniqueVisitors: number;
  byCountry?: Record<string, number>;
  hours?: number[];
}

export interface CensusMonthRecord {
  month: string; // YYYY-MM
  visits: number;
  uniqueVisitors: number;
}

export interface CensusLiveNow {
  asOf: string;
  /** Visitors active on the site within the last 2 minutes. */
  activeVisitors: number;
  /** Visits entered in the last 5 minutes. */
  last5mVisits: number;
  /** Visits entered in the last 60 minutes. */
  last60mVisits: number;
  activeCountries: Array<{ code: string; count: number }>;
  activePlaces: Array<{ placeId: string; country: string; cityAr: string; cityEn: string; lat: number; lon: number; count: number }>;
}

export interface CensusTotals {
  /** Counter 1: All-time cumulative visits since site creation. */
  visits: number;
  uniqueVisitors: number;
  /** Counter 4: Daily visits (today in Cairo time). */
  todayVisits: number;
  todayUnique: number;
  /** Counter 3: Weekly visits (rolling 7 days). */
  last7DaysVisits: number;
  last7DaysUnique: number;
  /** Counter 2: Monthly visits (current calendar month + rolling 30 days). */
  thisMonthVisits: number;
  thisMonthUnique: number;
  last30DaysVisits: number;
  countriesCount: number;
  placesCount: number;
  regionsCount: number;
}

export interface CensusReport {
  version: 1;
  updatedAt: string;
  startedAt: string;
  siteCreatedAt: string;
  totals: CensusTotals;
  byCountry: CensusCountryRecord[];
  byPlace: CensusPlaceRecord[];
  recentEntries: CensusRecentEntry[];
  byRegion: Record<WorldRegionId, { visits: number; uniqueVisitors: number; countries: number }>;
  byDay: CensusDayRecord[];
  byMonth: CensusMonthRecord[];
  /** Counter 5: 24-hour distribution for today (Cairo 00..23) + cumulative all-time 24-hour curve. */
  todayHoursDate?: string;
  todayByHour: number[];
  allTimeByHour: number[];
  bySection: Record<string, number>;
  byDevice: Record<CensusDevice, number>;
  byLanguage: Record<string, number>;
}

const emptyRegions = (): CensusReport['byRegion'] => ({
  arab: { visits: 0, uniqueVisitors: 0, countries: 0 },
  europe: { visits: 0, uniqueVisitors: 0, countries: 0 },
  asia: { visits: 0, uniqueVisitors: 0, countries: 0 },
  africa: { visits: 0, uniqueVisitors: 0, countries: 0 },
  americas: { visits: 0, uniqueVisitors: 0, countries: 0 },
  oceania: { visits: 0, uniqueVisitors: 0, countries: 0 },
});

const zeroHours = (): number[] => Array.from({ length: 24 }, () => 0);

export function emptyLiveNow(nowIso = new Date().toISOString()): CensusLiveNow {
  return {
    asOf: nowIso,
    activeVisitors: 0,
    last5mVisits: 0,
    last60mVisits: 0,
    activeCountries: [],
    activePlaces: [],
  };
}

export function emptyCensusReport(nowIso = new Date(0).toISOString()): CensusReport {
  return {
    version: 1,
    updatedAt: nowIso,
    startedAt: SITE_CREATED_AT,
    siteCreatedAt: SITE_CREATED_AT,
    totals: {
      visits: 0,
      uniqueVisitors: 0,
      todayVisits: 0,
      todayUnique: 0,
      last7DaysVisits: 0,
      last7DaysUnique: 0,
      thisMonthVisits: 0,
      thisMonthUnique: 0,
      last30DaysVisits: 0,
      countriesCount: 0,
      placesCount: 0,
      regionsCount: 0,
    },
    byCountry: [],
    byPlace: [],
    recentEntries: [],
    byRegion: emptyRegions(),
    byDay: [],
    byMonth: [],
    todayByHour: zeroHours(),
    allTimeByHour: zeroHours(),
    bySection: {},
    byDevice: { mobile: 0, desktop: 0, tablet: 0 },
    byLanguage: {},
  };
}

const nonNegInt = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const cleanHours = (raw: unknown): number[] => {
  const out = zeroHours();
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < 24; i++) out[i] = nonNegInt(raw[i]);
  return out;
};
const cleanCountMap = (raw: unknown, maxKeys = 40): Record<string, number> => {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const count = nonNegInt(v);
    const key = String(k).trim().slice(0, 32);
    if (key && count > 0) out[key] = count;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]).slice(0, maxKeys));
};

const validCountryOrUn = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string') return undefined;
  const code = raw.trim().toUpperCase();
  if (code === 'UN') return 'UN';
  return isCountry(code) || Boolean(COUNTRY_COORDS[code]) || Boolean(findCountryByCode(code)) ? code : undefined;
};

const validPrecision = (raw: unknown): GeoPrecision =>
  raw === 'edge-coords' || raw === 'edge-city' || raw === 'timezone' ? raw : 'country';

/** Recomputes derived totals, monthly/weekly/daily/day-part counters, and region summaries so numbers never drift. */
export function normalizeCensusReport(input: CensusReport, referenceNow = new Date()): CensusReport {
  const today = cairoDay(referenceNow);
  const currentMonth = cairoMonth(referenceNow);
  const cutoff7 = cairoDay(new Date(referenceNow.getTime() - 6 * 86_400_000));
  const cutoff30 = cairoDay(new Date(referenceNow.getTime() - 29 * 86_400_000));

  const byDay = [...input.byDay]
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && (d.visits > 0 || d.uniqueVisitors > 0))
    .map((d) => ({
      ...d,
      ...(d.hours ? { hours: cleanHours(d.hours) } : {}),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-90);

  const byCountry = [...input.byCountry]
    .filter((c) => c.visits > 0)
    .map((c) => ({
      ...c,
      uniqueVisitors: Math.min(c.visits, Math.max(c.uniqueVisitors > 0 ? c.uniqueVisitors : 1, 0)),
      todayVisits: c.todayDate === today ? Math.min(c.visits, nonNegInt(c.todayVisits)) : 0,
      todayDate: c.todayDate === today ? today : undefined,
    }))
    .sort((a, b) => b.visits - a.visits || a.code.localeCompare(b.code));

  const byPlace = [...(input.byPlace || [])]
    .filter((p) => p.visits > 0 && Boolean(p.id))
    .map((p) => ({
      ...p,
      uniqueVisitors: Math.min(p.visits, Math.max(p.uniqueVisitors > 0 ? p.uniqueVisitors : 1, 0)),
      todayVisits: p.todayDate === today ? Math.min(p.visits, nonNegInt(p.todayVisits)) : 0,
      todayDate: p.todayDate === today ? today : undefined,
    }))
    .sort((a, b) => b.visits - a.visits || a.id.localeCompare(b.id))
    .slice(0, 300);

  const recentEntries = [...(input.recentEntries || [])]
    .filter((e) => Boolean(e && e.at && e.country))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 50);

  // Monthly rollups from explicit `byMonth` + `byDay`
  const monthMap = new Map<string, CensusMonthRecord>();
  for (const m of input.byMonth || []) {
    if (/^\d{4}-\d{2}$/.test(m.month) && m.visits > 0) {
      monthMap.set(m.month, {
        month: m.month,
        visits: nonNegInt(m.visits),
        uniqueVisitors: Math.min(nonNegInt(m.visits), nonNegInt(m.uniqueVisitors) || 1),
      });
    }
  }
  const dayByMonth = new Map<string, { visits: number; unique: number }>();
  for (const d of byDay) {
    const ym = d.date.slice(0, 7);
    const cur = dayByMonth.get(ym) || { visits: 0, unique: 0 };
    cur.visits += d.visits;
    cur.unique += d.uniqueVisitors;
    dayByMonth.set(ym, cur);
  }
  for (const [ym, agg] of dayByMonth.entries()) {
    const prevM = monthMap.get(ym);
    monthMap.set(ym, {
      month: ym,
      visits: Math.max(prevM?.visits ?? 0, agg.visits),
      uniqueVisitors: Math.max(prevM?.uniqueVisitors ?? 0, agg.unique),
    });
  }
  const byMonth = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-24);

  const regions = emptyRegions();
  for (const c of byCountry) {
    if (c.code === 'UN') continue;
    const reg = regionOfCountry(c.code);
    regions[reg].visits += c.visits;
    regions[reg].uniqueVisitors += c.uniqueVisitors;
    regions[reg].countries += 1;
  }

  const countryVisitsSum = byCountry.reduce((s, c) => s + c.visits, 0);
  const countryUniqueSum = byCountry.reduce((s, c) => s + c.uniqueVisitors, 0);
  const visits = Math.max(input.totals.visits, countryVisitsSum);
  const uniqueVisitors = Math.min(visits, Math.max(input.totals.uniqueVisitors, countryUniqueSum));
  const todayRow = byDay.find((d) => d.date === today);
  const todayFromCountries = byCountry.reduce((s, c) => s + c.todayVisits, 0);
  const todayVisits = Math.max(todayRow?.visits ?? 0, todayFromCountries);
  const todayUnique = Math.min(todayVisits, Math.max(todayRow?.uniqueVisitors ?? 0, todayVisits > 0 ? 1 : 0));

  const weekRows = byDay.filter((d) => d.date >= cutoff7);
  const last7DaysVisits = Math.max(weekRows.reduce((s, d) => s + d.visits, 0), todayVisits);
  const last7DaysUnique = Math.min(
    last7DaysVisits,
    Math.max(weekRows.reduce((s, d) => s + d.uniqueVisitors, 0), todayUnique),
  );

  const last30DaysVisits = Math.max(
    byDay.filter((d) => d.date >= cutoff30).reduce((s, d) => s + d.visits, 0),
    last7DaysVisits,
    todayVisits,
  );
  const curMonthRow = byMonth.find((m) => m.month === currentMonth);
  const thisMonthVisits = Math.max(curMonthRow?.visits ?? 0, todayVisits);
  const thisMonthUnique = Math.min(thisMonthVisits, Math.max(curMonthRow?.uniqueVisitors ?? 0, todayUnique));

  const todayByHour =
    input.todayHoursDate === today
      ? cleanHours(input.todayByHour)
      : todayRow?.hours
      ? cleanHours(todayRow.hours)
      : zeroHours();
  const allTimeByHour = cleanHours(input.allTimeByHour);

  const realCountries = byCountry.filter((c) => c.code !== 'UN');
  const realPlaces = byPlace.filter((p) => p.country !== 'UN');
  const activeRegions = Object.values(regions).filter((r) => r.visits > 0).length;

  return {
    version: 1,
    updatedAt: input.updatedAt,
    startedAt: Date.parse(input.startedAt) > 0 ? input.startedAt : SITE_CREATED_AT,
    siteCreatedAt: Date.parse(input.siteCreatedAt) > 0 ? input.siteCreatedAt : SITE_CREATED_AT,
    totals: {
      visits,
      uniqueVisitors,
      todayVisits,
      todayUnique,
      last7DaysVisits,
      last7DaysUnique,
      thisMonthVisits,
      thisMonthUnique,
      last30DaysVisits,
      countriesCount: realCountries.length,
      placesCount: realPlaces.length,
      regionsCount: activeRegions,
    },
    byCountry,
    byPlace,
    recentEntries,
    byRegion: regions,
    byDay,
    byMonth,
    ...(todayVisits > 0 || todayByHour.some((v) => v > 0) ? { todayHoursDate: today } : {}),
    todayByHour,
    allTimeByHour,
    bySection: cleanCountMap(input.bySection, 25),
    byDevice: {
      mobile: nonNegInt(input.byDevice.mobile),
      desktop: nonNegInt(input.byDevice.desktop),
      tablet: nonNegInt(input.byDevice.tablet),
    },
    byLanguage: cleanCountMap(input.byLanguage, 30),
  };
}

/** Defensive reader for JSON stored on disk, in DB, or fetched over HTTP. */
export function readCensusReport(raw: unknown, referenceNow = new Date()): CensusReport {
  if (!raw || typeof raw !== 'object') return emptyCensusReport(new Date(0).toISOString());
  const d = raw as Record<string, unknown>;
  const updatedAt = typeof d.updatedAt === 'string' && Date.parse(d.updatedAt) >= 0 ? d.updatedAt : new Date(0).toISOString();
  const startedAt = typeof d.startedAt === 'string' && Date.parse(d.startedAt) > 0 ? d.startedAt : SITE_CREATED_AT;
  const siteCreatedAt = typeof d.siteCreatedAt === 'string' && Date.parse(d.siteCreatedAt) > 0 ? d.siteCreatedAt : SITE_CREATED_AT;
  const totalsRaw = (d.totals && typeof d.totals === 'object' ? d.totals : {}) as Record<string, unknown>;
  const devRaw = (d.byDevice && typeof d.byDevice === 'object' ? d.byDevice : {}) as Record<string, unknown>;

  const countryMap = new Map<string, CensusCountryRecord>();
  if (Array.isArray(d.byCountry)) {
    for (const item of d.byCountry) {
      if (!item || typeof item !== 'object') continue;
      const c = item as Record<string, unknown>;
      const code = validCountryOrUn(c.code);
      const visits = nonNegInt(c.visits);
      if (!code || visits <= 0) continue;
      countryMap.set(code, {
        code,
        visits,
        uniqueVisitors: nonNegInt(c.uniqueVisitors) || 1,
        todayVisits: nonNegInt(c.todayVisits),
        ...(typeof c.todayDate === 'string' ? { todayDate: c.todayDate.slice(0, 10) } : {}),
        lastVisitAt: typeof c.lastVisitAt === 'string' && Date.parse(c.lastVisitAt) > 0 ? c.lastVisitAt : updatedAt,
        ...(c.sections ? { sections: cleanCountMap(c.sections, 15) } : {}),
        ...(c.languages ? { languages: cleanCountMap(c.languages, 10) } : {}),
      });
    }
  }

  const placeMap = new Map<string, CensusPlaceRecord>();
  if (Array.isArray(d.byPlace)) {
    for (const item of d.byPlace) {
      if (!item || typeof item !== 'object') continue;
      const p = item as Record<string, unknown>;
      const country = validCountryOrUn(p.country);
      const id = typeof p.id === 'string' ? p.id.trim().slice(0, 64) : '';
      const visits = nonNegInt(p.visits);
      const lat = Number(p.lat);
      const lon = Number(p.lon);
      if (!country || !id || visits <= 0 || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      placeMap.set(id, {
        id,
        country,
        cityAr: typeof p.cityAr === 'string' && p.cityAr.trim() ? p.cityAr.trim().slice(0, 64) : countryNameAr(country),
        cityEn: typeof p.cityEn === 'string' && p.cityEn.trim() ? p.cityEn.trim().slice(0, 64) : countryNameEn(country),
        ...(typeof p.regionAr === 'string' && p.regionAr.trim() ? { regionAr: p.regionAr.trim().slice(0, 64) } : {}),
        ...(typeof p.regionEn === 'string' && p.regionEn.trim() ? { regionEn: p.regionEn.trim().slice(0, 64) } : {}),
        lat: Math.round(lat * 100) / 100,
        lon: Math.round(lon * 100) / 100,
        precision: validPrecision(p.precision),
        visits,
        uniqueVisitors: nonNegInt(p.uniqueVisitors) || 1,
        todayVisits: nonNegInt(p.todayVisits),
        ...(typeof p.todayDate === 'string' ? { todayDate: p.todayDate.slice(0, 10) } : {}),
        lastVisitAt: typeof p.lastVisitAt === 'string' && Date.parse(p.lastVisitAt) > 0 ? p.lastVisitAt : updatedAt,
        ...(p.sections ? { sections: cleanCountMap(p.sections, 12) } : {}),
      });
    }
  }

  const recentEntries: CensusRecentEntry[] = [];
  if (Array.isArray(d.recentEntries)) {
    for (const item of d.recentEntries.slice(0, 50)) {
      if (!item || typeof item !== 'object') continue;
      const e = item as Record<string, unknown>;
      const country = validCountryOrUn(e.country);
      const at = typeof e.at === 'string' && Date.parse(e.at) > 0 ? e.at : '';
      const lat = Number(e.lat);
      const lon = Number(e.lon);
      if (!country || !at || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      recentEntries.push({
        at,
        country,
        placeId: typeof e.placeId === 'string' && e.placeId ? e.placeId.slice(0, 64) : `${country}:center`,
        cityAr: typeof e.cityAr === 'string' && e.cityAr ? e.cityAr.slice(0, 64) : countryNameAr(country),
        cityEn: typeof e.cityEn === 'string' && e.cityEn ? e.cityEn.slice(0, 64) : countryNameEn(country),
        ...(typeof e.regionAr === 'string' && e.regionAr ? { regionAr: e.regionAr.slice(0, 64) } : {}),
        lat: Math.round(lat * 100) / 100,
        lon: Math.round(lon * 100) / 100,
        precision: validPrecision(e.precision),
        section: sanitizeCensusSection(e.section) || 'home',
        device: e.device === 'mobile' || e.device === 'tablet' ? e.device : 'desktop',
        lang: typeof e.lang === 'string' && e.lang ? e.lang.slice(0, 8) : 'ar',
      });
    }
  }

  const dayMap = new Map<string, CensusDayRecord>();
  if (Array.isArray(d.byDay)) {
    for (const item of d.byDay) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const date = typeof row.date === 'string' ? row.date.slice(0, 10) : '';
      const visits = nonNegInt(row.visits);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || visits <= 0) continue;
      dayMap.set(date, {
        date,
        visits,
        uniqueVisitors: Math.min(visits, nonNegInt(row.uniqueVisitors) || 1),
        ...(row.byCountry ? { byCountry: cleanCountMap(row.byCountry, 50) } : {}),
        ...(Array.isArray(row.hours) ? { hours: cleanHours(row.hours) } : {}),
      });
    }
  }

  const byMonth: CensusMonthRecord[] = [];
  if (Array.isArray(d.byMonth)) {
    for (const item of d.byMonth) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const month = typeof row.month === 'string' ? row.month.slice(0, 7) : '';
      const visits = nonNegInt(row.visits);
      if (!/^\d{4}-\d{2}$/.test(month) || visits <= 0) continue;
      byMonth.push({ month, visits, uniqueVisitors: Math.min(visits, nonNegInt(row.uniqueVisitors) || 1) });
    }
  }

  const draft: CensusReport = {
    version: 1,
    updatedAt,
    startedAt,
    siteCreatedAt,
    totals: {
      visits: nonNegInt(totalsRaw.visits),
      uniqueVisitors: nonNegInt(totalsRaw.uniqueVisitors),
      todayVisits: nonNegInt(totalsRaw.todayVisits),
      todayUnique: nonNegInt(totalsRaw.todayUnique),
      last7DaysVisits: nonNegInt(totalsRaw.last7DaysVisits),
      last7DaysUnique: nonNegInt(totalsRaw.last7DaysUnique),
      thisMonthVisits: nonNegInt(totalsRaw.thisMonthVisits),
      thisMonthUnique: nonNegInt(totalsRaw.thisMonthUnique),
      last30DaysVisits: nonNegInt(totalsRaw.last30DaysVisits),
      countriesCount: 0,
      placesCount: 0,
      regionsCount: 0,
    },
    byCountry: [...countryMap.values()],
    byPlace: [...placeMap.values()],
    recentEntries,
    byRegion: emptyRegions(),
    byDay: [...dayMap.values()],
    byMonth,
    ...(typeof d.todayHoursDate === 'string' ? { todayHoursDate: d.todayHoursDate.slice(0, 10) } : {}),
    todayByHour: cleanHours(d.todayByHour),
    allTimeByHour: cleanHours(d.allTimeByHour),
    bySection: cleanCountMap(d.bySection, 25),
    byDevice: {
      mobile: nonNegInt(devRaw.mobile),
      desktop: nonNegInt(devRaw.desktop),
      tablet: nonNegInt(devRaw.tablet),
    },
    byLanguage: cleanCountMap(d.byLanguage, 30),
  };
  return normalizeCensusReport(draft, referenceNow);
}

export interface VisitInputEvent {
  country?: string;
  city?: string;
  region?: string;
  lat?: number | string;
  lon?: number | string;
  timezone?: string;
  section?: string;
  device?: CensusDevice;
  lang?: string;
  isUniqueToday?: boolean;
  isUniqueEver?: boolean;
  isUniquePlace?: boolean;
  at?: Date;
}

/** Records one real visit (including exact city/governorate entry point & Cairo hour) into a `CensusReport`. */
export function recordCensusVisit(prev: CensusReport, event: VisitInputEvent): CensusReport {
  const now = event.at || new Date();
  const nowIso = now.toISOString();
  const today = cairoDay(now);
  const currentMonth = cairoMonth(now);
  const hour = cairoHour(now);
  const section = sanitizeCensusSection(event.section);
  if (!section) return prev; // admin/owner/ops routes never count as visitor traffic

  const initialCode = validCountryOrUn(event.country);
  const resolvedPlace = resolveVisitorEntryLocation({
    country: initialCode,
    cityHeader: event.city,
    regionHeader: event.region,
    latHeader: event.lat,
    lonHeader: event.lon,
    timezone: event.timezone,
    fallbackCoords: initialCode ? COUNTRY_COORDS[initialCode] : undefined,
    countryNameAr: initialCode ? countryNameAr(initialCode) : undefined,
    countryNameEn: initialCode ? countryNameEn(initialCode) : undefined,
  });

  const code = validCountryOrUn(resolvedPlace.country) || initialCode || 'UN';
  const device: CensusDevice = event.device === 'mobile' || event.device === 'tablet' ? event.device : 'desktop';
  const lang = typeof event.lang === 'string' && /^[a-z]{2,3}(?:-[a-z0-9]{2,4})?$/i.test(event.lang.trim())
    ? event.lang.trim().toLowerCase().split('-')[0]!
    : 'ar';
  const uniqueToday = event.isUniqueToday !== false;
  const uniqueEver = event.isUniqueEver ?? uniqueToday;
  const uniquePlace = event.isUniquePlace ?? uniqueToday;

  const startedAt = Date.parse(prev.startedAt) > 0 ? prev.startedAt : SITE_CREATED_AT;

  // Update Country Ledger
  const countries = new Map(prev.byCountry.map((c) => [c.code, { ...c, sections: { ...(c.sections || {}) }, languages: { ...(c.languages || {}) } }]));
  const existingCountry = countries.get(code);
  if (existingCountry) {
    const sameDay = existingCountry.todayDate === today;
    existingCountry.visits += 1;
    if (uniqueEver) existingCountry.uniqueVisitors += 1;
    existingCountry.todayVisits = (sameDay ? existingCountry.todayVisits : 0) + 1;
    existingCountry.todayDate = today;
    existingCountry.lastVisitAt = nowIso;
    existingCountry.sections![section] = (existingCountry.sections![section] || 0) + 1;
    existingCountry.languages![lang] = (existingCountry.languages![lang] || 0) + 1;
  } else {
    countries.set(code, {
      code,
      visits: 1,
      uniqueVisitors: 1,
      todayVisits: 1,
      todayDate: today,
      lastVisitAt: nowIso,
      sections: { [section]: 1 },
      languages: { [lang]: 1 },
    });
  }

  // Update Exact Entry Place Ledger inside Country
  const places = new Map((prev.byPlace || []).map((p) => [p.id, { ...p, sections: { ...(p.sections || {}) } }]));
  if (code !== 'UN') {
    const existingPlace = places.get(resolvedPlace.placeId);
    if (existingPlace) {
      const sameDay = existingPlace.todayDate === today;
      existingPlace.visits += 1;
      if (uniquePlace) existingPlace.uniqueVisitors += 1;
      existingPlace.todayVisits = (sameDay ? existingPlace.todayVisits : 0) + 1;
      existingPlace.todayDate = today;
      existingPlace.lastVisitAt = nowIso;
      if (resolvedPlace.precision === 'edge-coords') {
        existingPlace.lat = resolvedPlace.lat;
        existingPlace.lon = resolvedPlace.lon;
        existingPlace.precision = 'edge-coords';
      }
      existingPlace.sections![section] = (existingPlace.sections![section] || 0) + 1;
    } else {
      places.set(resolvedPlace.placeId, {
        id: resolvedPlace.placeId,
        country: code,
        cityAr: resolvedPlace.cityAr,
        cityEn: resolvedPlace.cityEn,
        ...(resolvedPlace.regionAr ? { regionAr: resolvedPlace.regionAr } : {}),
        ...(resolvedPlace.regionEn ? { regionEn: resolvedPlace.regionEn } : {}),
        lat: resolvedPlace.lat,
        lon: resolvedPlace.lon,
        precision: resolvedPlace.precision,
        visits: 1,
        uniqueVisitors: 1,
        todayVisits: 1,
        todayDate: today,
        lastVisitAt: nowIso,
        sections: { [section]: 1 },
      });
    }
  }

  // Append to Rolling Recent Entries Log
  const nextRecent: CensusRecentEntry[] =
    code !== 'UN'
      ? [
          {
            at: nowIso,
            country: code,
            placeId: resolvedPlace.placeId,
            cityAr: resolvedPlace.cityAr,
            cityEn: resolvedPlace.cityEn,
            ...(resolvedPlace.regionAr ? { regionAr: resolvedPlace.regionAr } : {}),
            lat: resolvedPlace.lat,
            lon: resolvedPlace.lon,
            precision: resolvedPlace.precision,
            section,
            device,
            lang,
          },
          ...(prev.recentEntries || []),
        ].slice(0, 50)
      : prev.recentEntries || [];

  // Update Daily & Hourly Ledgers
  const days = new Map(
    prev.byDay.map((d) => [d.date, { ...d, byCountry: { ...(d.byCountry || {}) }, hours: cleanHours(d.hours) }]),
  );
  const existingDay = days.get(today);
  if (existingDay) {
    existingDay.visits += 1;
    if (uniqueToday) existingDay.uniqueVisitors += 1;
    existingDay.byCountry![code] = (existingDay.byCountry![code] || 0) + 1;
    existingDay.hours![hour] = (existingDay.hours![hour] || 0) + 1;
  } else {
    const hrs = zeroHours();
    hrs[hour] = 1;
    days.set(today, { date: today, visits: 1, uniqueVisitors: 1, byCountry: { [code]: 1 }, hours: hrs });
  }

  // Update Monthly Ledger
  const months = new Map((prev.byMonth || []).map((m) => [m.month, { ...m }]));
  const existingMonth = months.get(currentMonth);
  if (existingMonth) {
    existingMonth.visits += 1;
    if (uniqueToday) existingMonth.uniqueVisitors += 1;
  } else {
    months.set(currentMonth, { month: currentMonth, visits: 1, uniqueVisitors: 1 });
  }

  const todayByHour = prev.todayHoursDate === today ? [...cleanHours(prev.todayByHour)] : zeroHours();
  todayByHour[hour] = (todayByHour[hour] || 0) + 1;

  const allTimeByHour = [...cleanHours(prev.allTimeByHour)];
  allTimeByHour[hour] = (allTimeByHour[hour] || 0) + 1;

  const bySection = { ...prev.bySection, [section]: (prev.bySection[section] || 0) + 1 };
  const byDevice = { ...prev.byDevice, [device]: (prev.byDevice[device] || 0) + 1 };
  const byLanguage = { ...prev.byLanguage, [lang]: (prev.byLanguage[lang] || 0) + 1 };

  return normalizeCensusReport({
    version: 1,
    updatedAt: nowIso,
    startedAt,
    siteCreatedAt: prev.siteCreatedAt || SITE_CREATED_AT,
    totals: {
      ...prev.totals,
      visits: prev.totals.visits + 1,
      uniqueVisitors: prev.totals.uniqueVisitors + (uniqueEver ? 1 : 0),
    },
    byCountry: [...countries.values()],
    byPlace: [...places.values()],
    recentEntries: nextRecent,
    byRegion: emptyRegions(),
    byDay: [...days.values()],
    byMonth: [...months.values()],
    todayHoursDate: today,
    todayByHour,
    allTimeByHour,
    bySection,
    byDevice,
    byLanguage,
  }, now);
}

/**
 * Monotonic merge of two census snapshots (e.g. GitHub's committed ledger + live API memory/DB).
 */
export function mergeCensusReports(a: CensusReport, b: CensusReport, referenceNow = new Date()): CensusReport {
  if (a.totals.visits === 0) return normalizeCensusReport(b, referenceNow);
  if (b.totals.visits === 0) return normalizeCensusReport(a, referenceNow);

  const today = cairoDay(referenceNow);
  const updatedAt = Date.parse(b.updatedAt) >= Date.parse(a.updatedAt) ? b.updatedAt : a.updatedAt;
  const validStarts = [a.startedAt, b.startedAt].filter((s) => Date.parse(s) > 0);
  const startedAt = validStarts.sort()[0] || SITE_CREATED_AT;

  const mergeMaxMap = (m1: Record<string, number> = {}, m2: Record<string, number> = {}) => {
    const out: Record<string, number> = { ...m1 };
    for (const [k, v] of Object.entries(m2)) out[k] = Math.max(out[k] || 0, v);
    return out;
  };
  const mergeMaxHours = (h1?: number[], h2?: number[]) => {
    const a1 = cleanHours(h1);
    const a2 = cleanHours(h2);
    return a1.map((v, i) => Math.max(v, a2[i] || 0));
  };

  const countryCodes = new Set([...a.byCountry.map((c) => c.code), ...b.byCountry.map((c) => c.code)]);
  const byCountry: CensusCountryRecord[] = [];
  for (const code of countryCodes) {
    const ca = a.byCountry.find((x) => x.code === code);
    const cb = b.byCountry.find((x) => x.code === code);
    if (!ca) { byCountry.push(cb!); continue; }
    if (!cb) { byCountry.push(ca); continue; }
    const todayA = ca.todayDate === today ? ca.todayVisits : 0;
    const todayB = cb.todayDate === today ? cb.todayVisits : 0;
    byCountry.push({
      code,
      visits: Math.max(ca.visits, cb.visits),
      uniqueVisitors: Math.max(ca.uniqueVisitors, cb.uniqueVisitors),
      todayVisits: Math.max(todayA, todayB),
      ...(Math.max(todayA, todayB) > 0 ? { todayDate: today } : {}),
      lastVisitAt: Date.parse(cb.lastVisitAt) >= Date.parse(ca.lastVisitAt) ? cb.lastVisitAt : ca.lastVisitAt,
      sections: mergeMaxMap(ca.sections, cb.sections),
      languages: mergeMaxMap(ca.languages, cb.languages),
    });
  }

  const placeIds = new Set([...(a.byPlace || []).map((p) => p.id), ...(b.byPlace || []).map((p) => p.id)]);
  const byPlace: CensusPlaceRecord[] = [];
  for (const id of placeIds) {
    const pa = (a.byPlace || []).find((x) => x.id === id);
    const pb = (b.byPlace || []).find((x) => x.id === id);
    if (!pa) { byPlace.push(pb!); continue; }
    if (!pb) { byPlace.push(pa); continue; }
    const todayA = pa.todayDate === today ? pa.todayVisits : 0;
    const todayB = pb.todayDate === today ? pb.todayVisits : 0;
    const newer = Date.parse(pb.lastVisitAt) >= Date.parse(pa.lastVisitAt) ? pb : pa;
    byPlace.push({
      ...newer,
      visits: Math.max(pa.visits, pb.visits),
      uniqueVisitors: Math.max(pa.uniqueVisitors, pb.uniqueVisitors),
      todayVisits: Math.max(todayA, todayB),
      ...(Math.max(todayA, todayB) > 0 ? { todayDate: today } : {}),
      sections: mergeMaxMap(pa.sections, pb.sections),
    });
  }

  // Deduplicate recentEntries by `${at}|${placeId}|${section}`
  const seenRecent = new Set<string>();
  const recentEntries: CensusRecentEntry[] = [];
  for (const e of [...(b.recentEntries || []), ...(a.recentEntries || [])]) {
    const key = `${e.at}|${e.placeId}|${e.section}`;
    if (seenRecent.has(key)) continue;
    seenRecent.add(key);
    recentEntries.push(e);
  }

  const dates = new Set([...a.byDay.map((d) => d.date), ...b.byDay.map((d) => d.date)]);
  const byDay: CensusDayRecord[] = [];
  for (const date of dates) {
    const da = a.byDay.find((x) => x.date === date);
    const db = b.byDay.find((x) => x.date === date);
    if (!da) { byDay.push(db!); continue; }
    if (!db) { byDay.push(da); continue; }
    byDay.push({
      date,
      visits: Math.max(da.visits, db.visits),
      uniqueVisitors: Math.max(da.uniqueVisitors, db.uniqueVisitors),
      byCountry: mergeMaxMap(da.byCountry, db.byCountry),
      hours: mergeMaxHours(da.hours, db.hours),
    });
  }

  const months = new Set([...(a.byMonth || []).map((m) => m.month), ...(b.byMonth || []).map((m) => m.month)]);
  const byMonth: CensusMonthRecord[] = [];
  for (const ym of months) {
    const ma = (a.byMonth || []).find((x) => x.month === ym);
    const mb = (b.byMonth || []).find((x) => x.month === ym);
    if (!ma) { byMonth.push(mb!); continue; }
    if (!mb) { byMonth.push(ma); continue; }
    byMonth.push({
      month: ym,
      visits: Math.max(ma.visits, mb.visits),
      uniqueVisitors: Math.max(ma.uniqueVisitors, mb.uniqueVisitors),
    });
  }

  const todayHoursA = a.todayHoursDate === today ? a.todayByHour : zeroHours();
  const todayHoursB = b.todayHoursDate === today ? b.todayByHour : zeroHours();

  return normalizeCensusReport({
    version: 1,
    updatedAt,
    startedAt,
    siteCreatedAt: SITE_CREATED_AT,
    totals: {
      ...a.totals,
      visits: Math.max(a.totals.visits, b.totals.visits),
      uniqueVisitors: Math.max(a.totals.uniqueVisitors, b.totals.uniqueVisitors),
    },
    byCountry,
    byPlace,
    recentEntries,
    byRegion: emptyRegions(),
    byDay,
    byMonth,
    todayHoursDate: today,
    todayByHour: mergeMaxHours(todayHoursA, todayHoursB),
    allTimeByHour: mergeMaxHours(a.allTimeByHour, b.allTimeByHour),
    bySection: mergeMaxMap(a.bySection, b.bySection),
    byDevice: {
      mobile: Math.max(a.byDevice.mobile, b.byDevice.mobile),
      desktop: Math.max(a.byDevice.desktop, b.byDevice.desktop),
      tablet: Math.max(a.byDevice.tablet, b.byDevice.tablet),
    },
    byLanguage: mergeMaxMap(a.byLanguage, b.byLanguage),
  }, referenceNow);
}

// ── Day-Part Breakdown («عداد تقسيم اليوم») ─────────────────────────────────────────────────────────────────
export interface DayPartStat {
  id: DayPartId;
  ar: string;
  en: string;
  rangeAr: string;
  rangeEn: string;
  color: string;
  visits: number;
  sharePercent: number;
}

export function dayPartBreakdown(report: CensusReport, scope: 'today' | 'all' = 'today'): {
  hours: number[];
  total: number;
  peakHour: number | null;
  parts: DayPartStat[];
} {
  const hours = cleanHours(scope === 'today' ? report.todayByHour : report.allTimeByHour);
  const total = hours.reduce((s, n) => s + n, 0);
  let peakHour: number | null = null;
  let maxH = 0;
  for (let h = 0; h < 24; h++) {
    if (hours[h] > maxH) {
      maxH = hours[h];
      peakHour = h;
    }
  }
  const parts: DayPartStat[] = (['dawn', 'morning', 'afternoon', 'evening'] as const).map((id) => {
    const meta = DAY_PARTS[id];
    const visits = meta.hours.reduce((s, h) => s + (hours[h] || 0), 0);
    const sharePercent = total > 0 ? Math.round((visits / total) * 1000) / 10 : 0;
    return {
      id,
      ar: meta.ar,
      en: meta.en,
      rangeAr: meta.rangeAr,
      rangeEn: meta.rangeEn,
      color: meta.color,
      visits,
      sharePercent,
    };
  });
  return { hours, total, peakHour, parts };
}

// ── Per-Country Thermal Choropleth Palette («فصل كل دولة بلون حراري معين») ───────────────────────────────────
/**
 * 8 neighbor-disjoint base thermal colors (used so bordering countries never merge visually),
 * plus blazing active thermal colors scaled by real visit intensity.
 */
export const NEIGHBOR_THERMAL_SLOTS_DARK: readonly { fill: string; stroke: string }[] = [
  { fill: '#0e4f70', stroke: '#38bdf8' }, // Deep Ocean Cyan
  { fill: '#14532d', stroke: '#34d399' }, // Emerald Forest
  { fill: '#3b2e7e', stroke: '#a78bfa' }, // Indigo Violet
  { fill: '#6b3410', stroke: '#fb923c' }, // Warm Terracotta Amber
  { fill: '#115e59', stroke: '#2dd4bf' }, // Tropical Teal
  { fill: '#5b2146', stroke: '#f472b6' }, // Royal Plum Rose
  { fill: '#4d5c14', stroke: '#a3e635' }, // Olive Chartreuse
  { fill: '#1e3a8a', stroke: '#60a5fa' }, // Cobalt Sapphire
];

export const NEIGHBOR_THERMAL_SLOTS_LIGHT: readonly { fill: string; stroke: string }[] = [
  { fill: '#bae6fd', stroke: '#0284c7' },
  { fill: '#bbf7d0', stroke: '#16a34a' },
  { fill: '#ddd6fe', stroke: '#7c3aed' },
  { fill: '#fed7aa', stroke: '#ea580c' },
  { fill: '#99f6e4', stroke: '#0d9488' },
  { fill: '#fbcfe8', stroke: '#db2777' },
  { fill: '#d9f99d', stroke: '#65a30d' },
  { fill: '#bfdbfe', stroke: '#2563eb' },
];

const ACTIVE_THERMAL_STOPS = [
  { at: 0.15, fill: '#06b6d4', stroke: '#a5f3fc' }, // Cool Cyan
  { at: 0.32, fill: '#10b981', stroke: '#a7f3d0' }, // Warm Emerald
  { at: 0.48, fill: '#84cc16', stroke: '#ecfccb' }, // Lime Solar
  { at: 0.64, fill: '#eab308', stroke: '#fef08a' }, // Gold Heat
  { at: 0.80, fill: '#f97316', stroke: '#fed7aa' }, // Blazing Orange
  { at: 1.00, fill: '#ef4444', stroke: '#fecaca' }, // Peak Crimson
];

/** Computes the exact polygon fill & border color for a country on the colored world map. */
export function countryPolygonStyle(params: {
  slot: number;
  intensity: number;
  visits: number;
  separateAllCountries?: boolean;
  theme?: 'dark' | 'light';
}): { fill: string; stroke: string; fillOpacity: number } {
  const { slot, intensity, visits, separateAllCountries = true, theme = 'dark' } = params;
  const idx = ((slot % 8) + 8) % 8;

  if (visits > 0 && intensity > 0) {
    // Slightly offset intensity by slot (±0.04) so two bordering active countries with equal visits remain distinct!
    const nudged = Math.min(1, Math.max(0.15, intensity + ((idx % 3) - 1) * 0.035));
    const stop = ACTIVE_THERMAL_STOPS.find((s) => nudged <= s.at) || ACTIVE_THERMAL_STOPS[ACTIVE_THERMAL_STOPS.length - 1]!;
    return {
      fill: stop.fill,
      stroke: stop.stroke,
      fillOpacity: 0.92,
    };
  }

  if (!separateAllCountries) {
    return theme === 'dark'
      ? { fill: '#132a46', stroke: '#294d78', fillOpacity: 0.8 }
      : { fill: '#e2e8f0', stroke: '#94a3b8', fillOpacity: 0.8 };
  }

  const base = theme === 'dark' ? NEIGHBOR_THERMAL_SLOTS_DARK[idx]! : NEIGHBOR_THERMAL_SLOTS_LIGHT[idx]!;
  return {
    fill: base.fill,
    stroke: base.stroke,
    fillOpacity: theme === 'dark' ? 0.72 : 0.78,
  };
}

// ── Thermal Heatmap Classification & Enriched Country / Place Views ──────────────────────────────────────────
export const HEAT_COLORS: Record<HeatLevel, { fill: string; glow: string; ring: string; ar: string; en: string }> = {
  none: { fill: '#334155', glow: 'transparent', ring: '#475569', ar: 'بدون زيارات بعد', en: 'No visits yet' },
  low: { fill: '#06b6d4', glow: '#22d3ee', ring: '#67e8f9', ar: 'نشاط هادئ', en: 'Low activity' },
  warm: { fill: '#10b981', glow: '#34d399', ring: '#6ee7b7', ar: 'نشاط متوسط', en: 'Moderate activity' },
  hot: { fill: '#f59e0b', glow: '#fbbf24', ring: '#fde68a', ar: 'نشاط مرتفع', en: 'High activity' },
  blazing: { fill: '#ef4444', glow: '#f97316', ring: '#fca5a5', ar: 'ذروة الزيارات', en: 'Peak hotspot' },
};

export function heatIntensity(visits: number, maxVisits: number): { intensity: number; level: HeatLevel } {
  if (visits <= 0 || maxVisits <= 0) return { intensity: 0, level: 'none' };
  const intensity = maxVisits === 1 ? 0.65 : Math.min(1, Math.max(0.15, Math.log1p(visits) / Math.log1p(maxVisits)));
  const level: HeatLevel = intensity >= 0.82 ? 'blazing' : intensity >= 0.58 ? 'hot' : intensity >= 0.34 ? 'warm' : 'low';
  return { intensity: Math.round(intensity * 1000) / 1000, level };
}

export interface EnrichedPlaceStat {
  rank: number;
  id: string;
  country: string;
  flag: string;
  countryAr: string;
  countryEn: string;
  cityAr: string;
  cityEn: string;
  regionAr?: string;
  regionEn?: string;
  lat: number;
  lon: number;
  x: number;
  y: number;
  precision: GeoPrecision;
  visits: number;
  uniqueVisitors: number;
  todayVisits: number;
  countrySharePercent: number;
  globalSharePercent: number;
  intensity: number;
  heatLevel: HeatLevel;
  topSectionAr: string;
  topSectionEn: string;
  lastVisitAt: string;
}

export interface EnrichedCountryStat {
  rank: number;
  code: string;
  flag: string;
  nameAr: string;
  nameEn: string;
  region: WorldRegionId;
  regionAr: string;
  regionEn: string;
  lat: number;
  lon: number;
  x: number;
  y: number;
  visits: number;
  uniqueVisitors: number;
  todayVisits: number;
  sharePercent: number;
  intensity: number;
  heatLevel: HeatLevel;
  placesCount: number;
  topPlaceAr?: string;
  topPlaceEn?: string;
  topSection: string;
  topSectionAr: string;
  topSectionEn: string;
  topLang: string;
  lastVisitAt: string;
}

const topKey = (m?: Record<string, number>, fallback = 'home'): string => {
  if (!m) return fallback;
  const top = Object.entries(m).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : fallback;
};

/** Enriches exact city/governorate entry places inside countries for pinpoint map markers & tables. */
export function enrichPlaces(
  report: CensusReport,
  options?: { country?: string | null; mode?: 'total' | 'today' },
): EnrichedPlaceStat[] {
  const mode = options?.mode || 'total';
  const countryFilter = options?.country ? options.country.toUpperCase() : null;
  const countryVisitsMap = new Map(report.byCountry.map((c) => [c.code, mode === 'today' ? c.todayVisits : c.visits]));
  const totalGlobal = mode === 'today' ? report.totals.todayVisits : report.totals.visits;

  const filtered = (report.byPlace || []).filter((p) => {
    if (p.country === 'UN') return false;
    if (countryFilter && p.country !== countryFilter) return false;
    return mode === 'today' ? p.todayVisits > 0 : p.visits > 0;
  });

  const maxMetric = Math.max(0, ...filtered.map((p) => (mode === 'today' ? p.todayVisits : p.visits)));
  const sorted = [...filtered].sort(
    (a, b) => (mode === 'today' ? b.todayVisits - a.todayVisits : b.visits - a.visits) || a.id.localeCompare(b.id),
  );

  return sorted.map((p, idx) => {
    const { x, y } = projectWorldPoint(p.lat, p.lon);
    const metric = mode === 'today' ? p.todayVisits : p.visits;
    const countryTotal = countryVisitsMap.get(p.country) || metric;
    const { intensity, level } = heatIntensity(metric, maxMetric);
    const secKey = topKey(p.sections, 'home');
    const secMeta = CENSUS_SECTIONS[secKey] || CENSUS_SECTIONS.other;
    return {
      rank: idx + 1,
      id: p.id,
      country: p.country,
      flag: flagOfCountry(p.country),
      countryAr: countryNameAr(p.country),
      countryEn: countryNameEn(p.country),
      cityAr: p.cityAr,
      cityEn: p.cityEn,
      ...(p.regionAr ? { regionAr: p.regionAr } : {}),
      ...(p.regionEn ? { regionEn: p.regionEn } : {}),
      lat: p.lat,
      lon: p.lon,
      x,
      y,
      precision: p.precision,
      visits: p.visits,
      uniqueVisitors: p.uniqueVisitors,
      todayVisits: p.todayVisits,
      countrySharePercent: countryTotal > 0 ? Math.round((metric / countryTotal) * 1000) / 10 : 0,
      globalSharePercent: totalGlobal > 0 ? Math.round((metric / totalGlobal) * 1000) / 10 : 0,
      intensity,
      heatLevel: level,
      topSectionAr: secMeta.ar,
      topSectionEn: secMeta.en,
      lastVisitAt: p.lastVisitAt,
    };
  });
}

/** Enriches recorded countries with coordinates, flags, shares, entry places count, and thermal intensity. */
export function enrichCountries(report: CensusReport, mode: 'total' | 'today' = 'total'): EnrichedCountryStat[] {
  const totalMetric = mode === 'today' ? report.totals.todayVisits : report.totals.visits;
  const active = report.byCountry.filter((c) => c.code !== 'UN' && (mode === 'today' ? c.todayVisits > 0 : c.visits > 0));
  const maxMetric = Math.max(0, ...active.map((c) => (mode === 'today' ? c.todayVisits : c.visits)));
  const sorted = [...active].sort((a, b) => (mode === 'today' ? b.todayVisits - a.todayVisits : b.visits - a.visits) || a.code.localeCompare(b.code));

  const placesByCountry = new Map<string, CensusPlaceRecord[]>();
  for (const p of report.byPlace || []) {
    const arr = placesByCountry.get(p.country) || [];
    arr.push(p);
    placesByCountry.set(p.country, arr);
  }

  return sorted.map((c, idx) => {
    const coords = COUNTRY_COORDS[c.code] || [20, 30];
    const { x, y } = projectWorldPoint(coords[0], coords[1]);
    const reg = regionOfCountry(c.code);
    const metric = mode === 'today' ? c.todayVisits : c.visits;
    const { intensity, level } = heatIntensity(metric, maxMetric);
    const secKey = topKey(c.sections, 'home');
    const secMeta = CENSUS_SECTIONS[secKey] || CENSUS_SECTIONS.other;
    const sharePercent = totalMetric > 0 ? Math.round((metric / totalMetric) * 1000) / 10 : 0;
    const countryPlaces = (placesByCountry.get(c.code) || []).sort((a, b) => b.visits - a.visits);
    const topPlace = countryPlaces[0];
    return {
      rank: idx + 1,
      code: c.code,
      flag: flagOfCountry(c.code),
      nameAr: countryNameAr(c.code),
      nameEn: countryNameEn(c.code),
      region: reg,
      regionAr: WORLD_REGIONS[reg].ar,
      regionEn: WORLD_REGIONS[reg].en,
      lat: coords[0],
      lon: coords[1],
      x,
      y,
      visits: c.visits,
      uniqueVisitors: c.uniqueVisitors,
      todayVisits: c.todayVisits,
      sharePercent,
      intensity,
      heatLevel: level,
      placesCount: countryPlaces.length,
      ...(topPlace ? { topPlaceAr: topPlace.cityAr, topPlaceEn: topPlace.cityEn } : {}),
      topSection: secKey,
      topSectionAr: secMeta.ar,
      topSectionEn: secMeta.en,
      topLang: topKey(c.languages, 'ar'),
      lastVisitAt: c.lastVisitAt,
    };
  });
}

/** Full world atlas points (active + zero-visit countries) so the owner can inspect every country on Earth. */
export function worldAtlasPoints(report: CensusReport, mode: 'total' | 'today' = 'total'): EnrichedCountryStat[] {
  const active = enrichCountries(report, mode);
  const byCode = new Map(active.map((c) => [c.code, c]));
  const allCodes = new Set([...Object.keys(COUNTRY_COORDS), ...WORLD_COUNTRIES.map((c) => c.code)]);
  const rest: EnrichedCountryStat[] = [];
  for (const code of allCodes) {
    if (byCode.has(code)) continue;
    const coords = COUNTRY_COORDS[code];
    if (!coords) continue;
    const { x, y } = projectWorldPoint(coords[0], coords[1]);
    const reg = regionOfCountry(code);
    const stored = report.byCountry.find((c) => c.code === code);
    rest.push({
      rank: 0,
      code,
      flag: flagOfCountry(code),
      nameAr: countryNameAr(code),
      nameEn: countryNameEn(code),
      region: reg,
      regionAr: WORLD_REGIONS[reg].ar,
      regionEn: WORLD_REGIONS[reg].en,
      lat: coords[0],
      lon: coords[1],
      x,
      y,
      visits: stored?.visits ?? 0,
      uniqueVisitors: stored?.uniqueVisitors ?? 0,
      todayVisits: stored?.todayVisits ?? 0,
      sharePercent: 0,
      intensity: 0,
      heatLevel: 'none',
      placesCount: 0,
      topSection: 'home',
      topSectionAr: CENSUS_SECTIONS.home.ar,
      topSectionEn: CENSUS_SECTIONS.home.en,
      topLang: 'ar',
      lastVisitAt: stored?.lastVisitAt ?? '',
    });
  }
  return [...active, ...rest];
}

// ── Public Statement & Executive Report («التقرير والكشف العلني لصاحب المنصة») ────────────────────────────────
export interface PublicStatement {
  issuedByAr: string;
  issuedByEn: string;
  editionCode: string;
  issuedAt: string;
  headlineAr: string;
  headlineEn: string;
  executiveReportAr: string[];
  executiveReportEn: string[];
  privacyGuaranteeAr: string;
  privacyGuaranteeEn: string;
  ledger: EnrichedCountryStat[];
  placesLedger: EnrichedPlaceStat[];
  unspecifiedVisits: number;
}

export function buildPublicStatement(report: CensusReport, referenceNow = new Date()): PublicStatement {
  const norm = normalizeCensusReport(report, referenceNow);
  const ledger = enrichCountries(norm, 'total');
  const placesLedger = enrichPlaces(norm, { mode: 'total' });
  const unspecifiedVisits = norm.byCountry.find((c) => c.code === 'UN')?.visits ?? 0;
  const issuedAt = Date.parse(norm.updatedAt) > 0 ? norm.updatedAt : referenceNow.toISOString();
  const dayStamp = cairoDay(issuedAt).replace(/-/g, '');
  const editionCode = `STATE-CENSUS-${dayStamp}-${norm.totals.visits}`;

  const topCountriesAr = ledger.slice(0, 5).map((c) => `${c.flag} ${c.nameAr} (${c.visits} زيارة — ${c.sharePercent}%)`).join('، ');
  const topCountriesEn = ledger.slice(0, 5).map((c) => `${c.flag} ${c.nameEn} (${c.visits} visits — ${c.sharePercent}%)`).join(', ');

  const topPlacesAr = placesLedger.slice(0, 5).map((p) => `${p.flag} ${p.cityAr}، ${p.countryAr} (${p.visits})`).join('، ');
  const topPlacesEn = placesLedger.slice(0, 5).map((p) => `${p.flag} ${p.cityEn}, ${p.countryEn} (${p.visits})`).join(', ');

  const topSections = Object.entries(norm.bySection).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const topSectionsAr = topSections.map(([k, v]) => `${(CENSUS_SECTIONS[k] || CENSUS_SECTIONS.other).ar} (${v})`).join('، ');
  const topSectionsEn = topSections.map(([k, v]) => `${(CENSUS_SECTIONS[k] || CENSUS_SECTIONS.other).en} (${v})`).join(', ');

  const yesterday = cairoDay(new Date(referenceNow.getTime() - 86_400_000));
  const yesterdayVisits = norm.byDay.find((d) => d.date === yesterday)?.visits ?? 0;

  const hasVisits = norm.totals.visits > 0;
  const headlineAr = hasVisits
    ? `كشف علني معتمد: ${norm.totals.visits} زيارة منذ إنشاء الموقع (${norm.totals.uniqueVisitors} زائر فريد) من ${norm.totals.placesCount} مدينة/منطقة في ${norm.totals.countriesCount} دولة`
    : 'كشف علني معتمد: التعداد مفعّل وجاهز — لم تُسجّل زيارات بعد (0 زيارة بدون أي أرقام وهمية)';
  const headlineEn = hasVisits
    ? `Certified Open Statement: ${norm.totals.visits} visits since site creation (${norm.totals.uniqueVisitors} unique visitors) across ${norm.totals.placesCount} cities/areas in ${norm.totals.countriesCount} countries`
    : 'Certified Open Statement: Census active and ready — 0 visits recorded so far (strictly real data only)';

  const executiveReportAr = hasVisits
    ? [
        `منذ إنشاء الموقع (${cairoDay(norm.siteCreatedAt)}): ${norm.totals.visits} زيارة من ${norm.totals.uniqueVisitors} زائر فريد.`,
        `العدادات الزمنية (توقيت القاهرة): هذا الشهر ${norm.totals.thisMonthVisits} زيارة · الأسبوعي (7 أيام) ${norm.totals.last7DaysVisits} زيارة · اليومي ${norm.totals.todayVisits} زيارة مقابل ${yesterdayVisits} بالأمس.`,
        `الانتشار الجغرافي ونقاط الدخول: ${norm.totals.countriesCount} دولة و${norm.totals.placesCount} نقطة دخول محددة داخل الدول.${topCountriesAr ? ` الدول الأعلى: ${topCountriesAr}.` : ''}${topPlacesAr ? ` أبرز نقاط الدخول: ${topPlacesAr}.` : ''}`,
        topSectionsAr ? `أكثر أقسام المنصة إقبالاً: ${topSectionsAr}.` : 'لم تُسجّل تفاصيل أقسام بعد.',
        `توزيع الأجهزة: موبايل ${norm.byDevice.mobile} · كمبيوتر ${norm.byDevice.desktop} · تابلت ${norm.byDevice.tablet}.`,
      ]
    : [
        `روبوت التعداد في دولة المنصة شغّال منذ إنشاء الموقع (${cairoDay(norm.siteCreatedAt)}) ويحصي كل زيارة حقيقية ونقطة دخولها داخل الدولة فور حدوثها.`,
        'الرصيد الحالي 0 زيارة — عملاً بدستور دولة المنصة، لا يتم اختلاق أو تزييف أي رقم أو دولة أو مدينة قبل دخول زوار فعليين.',
        'بمجرد دخول أي زائر لأي قسم في الموقع، تظهر دولته ومدينته/محافظته بالضبط وعدده فوراً في الكشف العلني وعلى خريطة الدول الحرارية.',
      ];

  const executiveReportEn = hasVisits
    ? [
        `Since site creation (${cairoDay(norm.siteCreatedAt)}): ${norm.totals.visits} visits from ${norm.totals.uniqueVisitors} unique visitors.`,
        `Period counters (Cairo time): Monthly ${norm.totals.thisMonthVisits} · Weekly (7d) ${norm.totals.last7DaysVisits} · Daily ${norm.totals.todayVisits} vs ${yesterdayVisits} yesterday.`,
        `Global & sub-national reach: ${norm.totals.countriesCount} countries and ${norm.totals.placesCount} entry cities/regions.${topCountriesEn ? ` Leading countries: ${topCountriesEn}.` : ''}${topPlacesEn ? ` Top entry cities: ${topPlacesEn}.` : ''}`,
        topSectionsEn ? `Most visited sections: ${topSectionsEn}.` : 'No section breakdown recorded yet.',
        `Devices: Mobile ${norm.byDevice.mobile} · Desktop ${norm.byDevice.desktop} · Tablet ${norm.byDevice.tablet}.`,
      ]
    : [
        `The Platform State Census Robot has been active since site creation (${cairoDay(norm.siteCreatedAt)}) and counts real visits and city-level entry points as they arrive.`,
        'Current count is 0 visits — per State rules, numbers, countries, and cities are never fabricated.',
        'As soon as visitors browse the platform, their exact entry cities and countries light up on the colored world heatmap and open ledger.',
      ];

  return {
    issuedByAr: CENSUS_BOT.nameAr,
    issuedByEn: CENSUS_BOT.nameEn,
    editionCode,
    issuedAt,
    headlineAr,
    headlineEn,
    executiveReportAr,
    executiveReportEn,
    privacyGuaranteeAr: 'كشف إحصائي علني مُجمَّع ونزيه — يوضح المدن والمناطق الجغرافية على مستوى المدينة فقط دون حفظ عناوين IP أو الأسماء أو أي بيانات شخصية للزوار أو أسرار صاحب المنصة.',
    privacyGuaranteeEn: 'Aggregated, verifiable open census ledger — city-level geographic precision only, strictly free of IP addresses, personal visitor data, or owner secrets.',
    ledger,
    placesLedger,
    unspecifiedVisits,
  };
}

/** Formats the certified public statement as plain text for one-click copying or GitHub summaries. */
export function plainTextStatement(report: CensusReport, lang: 'ar' | 'en' = 'ar', referenceNow = new Date()): string {
  const st = buildPublicStatement(report, referenceNow);
  if (lang === 'en') {
    const lines = [
      `🏛️ ${st.issuedByEn}`,
      `Statement ID: ${st.editionCode} | Updated: ${st.issuedAt}`,
      st.headlineEn,
      '',
      '— Executive Report —',
      ...st.executiveReportEn.map((p) => `• ${p}`),
      '',
      '— Global Country Ledger —',
      ...(st.ledger.length
        ? st.ledger.map((c) => `${c.rank}. ${c.flag} ${c.nameEn} (${c.code}) — ${c.visits} visits (${c.uniqueVisitors} unique, today: ${c.todayVisits}, share: ${c.sharePercent}%, cities: ${c.placesCount})`)
        : ['(No country visits recorded yet)']),
      '',
      '— Exact Entry Cities & Regions Inside Countries —',
      ...(st.placesLedger.length
        ? st.placesLedger.slice(0, 30).map((p) => `${p.rank}. ${p.flag} ${p.cityEn}, ${p.countryEn} [${p.lat.toFixed(2)}°, ${p.lon.toFixed(2)}°] — ${p.visits} visits (${p.countrySharePercent}% of country)`)
        : ['(No city-level entry points recorded yet)']),
      ...(st.unspecifiedVisits > 0 ? [`• 🌐 Unspecified country: ${st.unspecifiedVisits} visits`] : []),
      '',
      st.privacyGuaranteeEn,
    ];
    return lines.join('\n');
  }
  const lines = [
    `🏛️ ${st.issuedByAr}`,
    `رقم الكشف العلني: ${st.editionCode} | آخر تحديث: ${st.issuedAt}`,
    st.headlineAr,
    '',
    '— التقرير التنفيذي لصاحب المنصة —',
    ...st.executiveReportAr.map((p) => `• ${p}`),
    '',
    '— جدول الكشف العلني لدول العالم —',
    ...(st.ledger.length
      ? st.ledger.map((c) => `${c.rank}. ${c.flag} ${c.nameAr} (${c.code}) — ${c.visits} زيارة (${c.uniqueVisitors} زائر فريد، اليوم: ${c.todayVisits}، النسبة: ${c.sharePercent}%، مناطق الدخول: ${c.placesCount})`)
      : ['(لم تُسجّل زيارات دولية بعد)']),
    '',
    '— كشف أماكن الدخول داخل كل دولة (المدن والمحافظات والإحداثيات) —',
    ...(st.placesLedger.length
      ? st.placesLedger.slice(0, 30).map((p) => `${p.rank}. ${p.flag} ${p.cityAr}${p.regionAr ? ` (${p.regionAr})` : ''} — ${p.countryAr} [${p.lat.toFixed(2)}°, ${p.lon.toFixed(2)}°]: ${p.visits} زيارة (${p.countrySharePercent}% من زيارات الدولة)`)
      : ['(لم تُسجّل نقاط دخول تفصيلية داخل الدول بعد)']),
    ...(st.unspecifiedVisits > 0 ? [`• 🌐 غير محدد الموقع: ${st.unspecifiedVisits} زيارة`] : []),
    '',
    st.privacyGuaranteeAr,
  ];
  return lines.join('\n');
}

/** Exports the country & city ledger as UTF-8 CSV (with BOM so Excel opens Arabic cleanly). */
export function csvStatement(report: CensusReport, referenceNow = new Date()): string {
  const st = buildPublicStatement(report, referenceNow);
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const header = ['Rank', 'Code', 'Country (AR)', 'Country (EN)', 'Region (AR)', 'Visits', 'Unique Visitors', 'Today Visits', 'Share %', 'Entry Cities Count', 'Top City (AR)', 'Top Section', 'Top Language', 'Last Visit At'];
  const rows = st.ledger.map((c) => [
    c.rank, c.code, c.nameAr, c.nameEn, c.regionAr, c.visits, c.uniqueVisitors, c.todayVisits, c.sharePercent, c.placesCount, c.topPlaceAr || '—', c.topSectionAr, c.topLang, c.lastVisitAt,
  ].map(esc).join(','));
  return `\uFEFF${[header.map(esc).join(','), ...rows].join('\n')}\n`;
}
