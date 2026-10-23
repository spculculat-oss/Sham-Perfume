/**
 * «روبوت التعداد وإحصاء الزيارات — دولة المنصة» (bot id: `census`)
 *
 * Pure, browser-safe module shared by:
 *   - the live server endpoint (`server/census.ts` — `/api/census/visit`, `/api/census/public`, `/api/admin/census`),
 *   - the State's census robot (`scripts/state/census.mts`, `.github/workflows/platform-census.yml`),
 *   - the «خانة التعداد» & Interactive World Heatmap inside «دولة المنصة» (`src/admin/PlatformCensusPanel.tsx`, `src/admin/WorldVisitHeatmap.tsx`),
 *   - «غرفة دولة المنصة» (`src/utils/stateRoom.ts`).
 *
 * Honesty & privacy rules (State constitution & legal compliance):
 *   - Only real visits are counted; zero is reported honestly as zero — never fake or demo traffic.
 *   - No IP addresses, names, emails, or personal identifiers ever enter the report or the public statement.
 */
import { WORLD_COUNTRIES, findCountryByCode } from '../data/worldCountries';
import { isCountry } from './pricing';

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

export const WORLD_REGIONS: Record<WorldRegionId, { ar: string; en: string; view: { x: number; y: number; zoom: number } }> = {
  arab: { ar: 'العالم العربي والشرق الأوسط', en: 'Arab World & Middle East', view: { x: 580, y: 175, zoom: 2.6 } },
  europe: { ar: 'أوروبا', en: 'Europe', view: { x: 535, y: 105, zoom: 2.8 } },
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
  // Latitude span [-62..78] = 140 degrees, giving balanced visual framing without giant Antarctica dead space.
  const y = ((78 - clampedLat) / 140) * height;
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

/** Cairo YYYY-MM-DD date string. */
export function cairoDay(isoOrDate: string | Date = new Date()): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const valid = Number.isFinite(d.getTime()) ? d : new Date();
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(valid);
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

export interface CensusDayRecord {
  date: string;
  visits: number;
  uniqueVisitors: number;
  byCountry?: Record<string, number>;
}

export interface CensusTotals {
  visits: number;
  uniqueVisitors: number;
  todayVisits: number;
  todayUnique: number;
  last7DaysVisits: number;
  last30DaysVisits: number;
  countriesCount: number;
  regionsCount: number;
}

export interface CensusReport {
  version: 1;
  updatedAt: string;
  startedAt: string;
  totals: CensusTotals;
  byCountry: CensusCountryRecord[];
  byRegion: Record<WorldRegionId, { visits: number; uniqueVisitors: number; countries: number }>;
  byDay: CensusDayRecord[];
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

export function emptyCensusReport(nowIso = new Date(0).toISOString()): CensusReport {
  return {
    version: 1,
    updatedAt: nowIso,
    startedAt: nowIso,
    totals: {
      visits: 0,
      uniqueVisitors: 0,
      todayVisits: 0,
      todayUnique: 0,
      last7DaysVisits: 0,
      last30DaysVisits: 0,
      countriesCount: 0,
      regionsCount: 0,
    },
    byCountry: [],
    byRegion: emptyRegions(),
    byDay: [],
    bySection: {},
    byDevice: { mobile: 0, desktop: 0, tablet: 0 },
    byLanguage: {},
  };
}

const nonNegInt = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
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

/** Recomputes derived totals and region summaries from `byCountry` and `byDay` so numbers never drift. */
export function normalizeCensusReport(input: CensusReport, referenceNow = new Date()): CensusReport {
  const today = cairoDay(referenceNow);
  const cutoff7 = cairoDay(new Date(referenceNow.getTime() - 6 * 86_400_000));
  const cutoff30 = cairoDay(new Date(referenceNow.getTime() - 29 * 86_400_000));

  const byDay = [...input.byDay]
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && (d.visits > 0 || d.uniqueVisitors > 0))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-60);

  const byCountry = [...input.byCountry]
    .filter((c) => c.visits > 0)
    .map((c) => ({
      ...c,
      uniqueVisitors: Math.min(c.visits, Math.max(c.uniqueVisitors > 0 ? c.uniqueVisitors : 1, 0)),
      todayVisits: c.todayDate === today ? Math.min(c.visits, nonNegInt(c.todayVisits)) : 0,
      todayDate: c.todayDate === today ? today : undefined,
    }))
    .sort((a, b) => b.visits - a.visits || a.code.localeCompare(b.code));

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
  const last7DaysVisits = byDay.filter((d) => d.date >= cutoff7).reduce((s, d) => s + d.visits, 0);
  const last30DaysVisits = byDay.filter((d) => d.date >= cutoff30).reduce((s, d) => s + d.visits, 0);
  const realCountries = byCountry.filter((c) => c.code !== 'UN');
  const activeRegions = Object.values(regions).filter((r) => r.visits > 0).length;

  return {
    version: 1,
    updatedAt: input.updatedAt,
    startedAt: input.startedAt,
    totals: {
      visits,
      uniqueVisitors,
      todayVisits,
      todayUnique,
      last7DaysVisits: Math.max(last7DaysVisits, todayVisits),
      last30DaysVisits: Math.max(last30DaysVisits, last7DaysVisits, todayVisits),
      countriesCount: realCountries.length,
      regionsCount: activeRegions,
    },
    byCountry,
    byRegion: regions,
    byDay,
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
  const startedAt = typeof d.startedAt === 'string' && Date.parse(d.startedAt) >= 0 ? d.startedAt : updatedAt;
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
      });
    }
  }

  const draft: CensusReport = {
    version: 1,
    updatedAt,
    startedAt,
    totals: {
      visits: nonNegInt(totalsRaw.visits),
      uniqueVisitors: nonNegInt(totalsRaw.uniqueVisitors),
      todayVisits: nonNegInt(totalsRaw.todayVisits),
      todayUnique: nonNegInt(totalsRaw.todayUnique),
      last7DaysVisits: nonNegInt(totalsRaw.last7DaysVisits),
      last30DaysVisits: nonNegInt(totalsRaw.last30DaysVisits),
      countriesCount: 0,
      regionsCount: 0,
    },
    byCountry: [...countryMap.values()],
    byRegion: emptyRegions(),
    byDay: [...dayMap.values()],
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
  section?: string;
  device?: CensusDevice;
  lang?: string;
  isUniqueToday?: boolean;
  isUniqueEver?: boolean;
  at?: Date;
}

/** Records one real visit into a `CensusReport` snapshot (pure, immutable). */
export function recordCensusVisit(prev: CensusReport, event: VisitInputEvent): CensusReport {
  const now = event.at || new Date();
  const nowIso = now.toISOString();
  const today = cairoDay(now);
  const section = sanitizeCensusSection(event.section);
  if (!section) return prev; // admin/owner/ops routes never count as visitor traffic

  const code = validCountryOrUn(event.country) || 'UN';
  const device: CensusDevice = event.device === 'mobile' || event.device === 'tablet' ? event.device : 'desktop';
  const lang = typeof event.lang === 'string' && /^[a-z]{2,3}(?:-[a-z0-9]{2,4})?$/i.test(event.lang.trim())
    ? event.lang.trim().toLowerCase().split('-')[0]!
    : 'ar';
  const uniqueToday = event.isUniqueToday !== false;
  const uniqueEver = event.isUniqueEver ?? uniqueToday;

  const startedAt = prev.totals.visits === 0 || Date.parse(prev.startedAt) <= 0 ? nowIso : prev.startedAt;

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

  const days = new Map(prev.byDay.map((d) => [d.date, { ...d, byCountry: { ...(d.byCountry || {}) } }]));
  const existingDay = days.get(today);
  if (existingDay) {
    existingDay.visits += 1;
    if (uniqueToday) existingDay.uniqueVisitors += 1;
    existingDay.byCountry![code] = (existingDay.byCountry![code] || 0) + 1;
  } else {
    days.set(today, { date: today, visits: 1, uniqueVisitors: 1, byCountry: { [code]: 1 } });
  }

  const bySection = { ...prev.bySection, [section]: (prev.bySection[section] || 0) + 1 };
  const byDevice = { ...prev.byDevice, [device]: (prev.byDevice[device] || 0) + 1 };
  const byLanguage = { ...prev.byLanguage, [lang]: (prev.byLanguage[lang] || 0) + 1 };

  return normalizeCensusReport({
    version: 1,
    updatedAt: nowIso,
    startedAt,
    totals: {
      ...prev.totals,
      visits: prev.totals.visits + 1,
      uniqueVisitors: prev.totals.uniqueVisitors + (uniqueEver ? 1 : 0),
    },
    byCountry: [...countries.values()],
    byRegion: emptyRegions(),
    byDay: [...days.values()],
    bySection,
    byDevice,
    byLanguage,
  }, now);
}

/**
 * Monotonic merge of two census snapshots (e.g. GitHub's committed ledger + live API memory/DB).
 * Takes per-country and per-day maxima so a cold serverless restart never erases previously published counts,
 * while live visits recorded since the last robot run appear immediately.
 */
export function mergeCensusReports(a: CensusReport, b: CensusReport, referenceNow = new Date()): CensusReport {
  if (a.totals.visits === 0) return normalizeCensusReport(b, referenceNow);
  if (b.totals.visits === 0) return normalizeCensusReport(a, referenceNow);

  const today = cairoDay(referenceNow);
  const updatedAt = Date.parse(b.updatedAt) >= Date.parse(a.updatedAt) ? b.updatedAt : a.updatedAt;
  const validStarts = [a.startedAt, b.startedAt].filter((s) => Date.parse(s) > 0);
  const startedAt = validStarts.sort()[0] || updatedAt;

  const mergeMaxMap = (m1: Record<string, number> = {}, m2: Record<string, number> = {}) => {
    const out: Record<string, number> = { ...m1 };
    for (const [k, v] of Object.entries(m2)) out[k] = Math.max(out[k] || 0, v);
    return out;
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
    });
  }

  return normalizeCensusReport({
    version: 1,
    updatedAt,
    startedAt,
    totals: {
      ...a.totals,
      visits: Math.max(a.totals.visits, b.totals.visits),
      uniqueVisitors: Math.max(a.totals.uniqueVisitors, b.totals.uniqueVisitors),
    },
    byCountry,
    byRegion: emptyRegions(),
    byDay,
    bySection: mergeMaxMap(a.bySection, b.bySection),
    byDevice: {
      mobile: Math.max(a.byDevice.mobile, b.byDevice.mobile),
      desktop: Math.max(a.byDevice.desktop, b.byDevice.desktop),
      tablet: Math.max(a.byDevice.tablet, b.byDevice.tablet),
    },
    byLanguage: mergeMaxMap(a.byLanguage, b.byLanguage),
  }, referenceNow);
}

// ── Thermal Heatmap Classification & Enriched Country View ───────────────────────────────────────────────────
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

/** Enriches recorded countries with coordinates, flags, shares, and thermal heatmap intensity. */
export function enrichCountries(report: CensusReport, mode: 'total' | 'today' = 'total'): EnrichedCountryStat[] {
  const totalMetric = mode === 'today' ? report.totals.todayVisits : report.totals.visits;
  const active = report.byCountry.filter((c) => c.code !== 'UN' && (mode === 'today' ? c.todayVisits > 0 : c.visits > 0));
  const maxMetric = Math.max(0, ...active.map((c) => (mode === 'today' ? c.todayVisits : c.visits)));
  const sorted = [...active].sort((a, b) => (mode === 'today' ? b.todayVisits - a.todayVisits : b.visits - a.visits) || a.code.localeCompare(b.code));

  return sorted.map((c, idx) => {
    const coords = COUNTRY_COORDS[c.code] || [20, 30];
    const { x, y } = projectWorldPoint(coords[0], coords[1]);
    const reg = regionOfCountry(c.code);
    const metric = mode === 'today' ? c.todayVisits : c.visits;
    const { intensity, level } = heatIntensity(metric, maxMetric);
    const secKey = topKey(c.sections, 'home');
    const secMeta = CENSUS_SECTIONS[secKey] || CENSUS_SECTIONS.other;
    const sharePercent = totalMetric > 0 ? Math.round((metric / totalMetric) * 1000) / 10 : 0;
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
  unspecifiedVisits: number;
}

export function buildPublicStatement(report: CensusReport, referenceNow = new Date()): PublicStatement {
  const norm = normalizeCensusReport(report, referenceNow);
  const ledger = enrichCountries(norm, 'total');
  const unspecifiedVisits = norm.byCountry.find((c) => c.code === 'UN')?.visits ?? 0;
  const issuedAt = Date.parse(norm.updatedAt) > 0 ? norm.updatedAt : referenceNow.toISOString();
  const dayStamp = cairoDay(issuedAt).replace(/-/g, '');
  const editionCode = `STATE-CENSUS-${dayStamp}-${norm.totals.visits}`;

  const topCountriesAr = ledger.slice(0, 5).map((c) => `${c.flag} ${c.nameAr} (${c.visits} زيارة — ${c.sharePercent}%)`).join('، ');
  const topCountriesEn = ledger.slice(0, 5).map((c) => `${c.flag} ${c.nameEn} (${c.visits} visits — ${c.sharePercent}%)`).join(', ');

  const topSections = Object.entries(norm.bySection).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const topSectionsAr = topSections.map(([k, v]) => `${(CENSUS_SECTIONS[k] || CENSUS_SECTIONS.other).ar} (${v})`).join('، ');
  const topSectionsEn = topSections.map(([k, v]) => `${(CENSUS_SECTIONS[k] || CENSUS_SECTIONS.other).en} (${v})`).join(', ');

  const yesterday = cairoDay(new Date(referenceNow.getTime() - 86_400_000));
  const yesterdayVisits = norm.byDay.find((d) => d.date === yesterday)?.visits ?? 0;

  const hasVisits = norm.totals.visits > 0;
  const headlineAr = hasVisits
    ? `كشف علني معتمد: ${norm.totals.visits} زيارة إجمالية (${norm.totals.uniqueVisitors} زائر فريد) من ${norm.totals.countriesCount} دولة حول العالم`
    : 'كشف علني معتمد: التعداد مفعّل وجاهز — لم تُسجّل زيارات بعد (0 زيارة بدون أي أرقام وهمية)';
  const headlineEn = hasVisits
    ? `Certified Open Statement: ${norm.totals.visits} total visits (${norm.totals.uniqueVisitors} unique visitors) across ${norm.totals.countriesCount} countries`
    : 'Certified Open Statement: Census active and ready — 0 visits recorded so far (strictly real data only)';

  const executiveReportAr = hasVisits
    ? [
        `إجمالي الزيارات المرصودة رسمياً في المنصة: ${norm.totals.visits} زيارة من ${norm.totals.uniqueVisitors} زائر فريد منذ بدء التعداد.`,
        `حركة اليوم (بتوقيت القاهرة): ${norm.totals.todayVisits} زيارة (${norm.totals.todayUnique} زائر فريد) مقابل ${yesterdayVisits} زيارة بالأمس، و${norm.totals.last7DaysVisits} زيارة خلال آخر 7 أيام.`,
        `الانتشار الجغرافي حول العالم: وصلت المنصة إلى ${norm.totals.countriesCount} دولة في ${norm.totals.regionsCount} أقاليم قارية.${topCountriesAr ? ` في الصدارة: ${topCountriesAr}.` : ''}`,
        topSectionsAr ? `أكثر أقسام المنصة إقبالاً: ${topSectionsAr}.` : 'لم تُسجّل تفاصيل أقسام بعد.',
        `توزيع الأجهزة: موبايل ${norm.byDevice.mobile} · كمبيوتر ${norm.byDevice.desktop} · تابلت ${norm.byDevice.tablet}.`,
      ]
    : [
        'روبوت التعداد في دولة المنصة شغّال ويحصي كل زيارة حقيقية فور حدوثها.',
        'الرصيد الحالي 0 زيارة — عملاً بدستور دولة المنصة، لا يتم اختلاق أو تزييف أي رقم أو دولة قبل دخول زوار فعليين.',
        'بمجرد دخول أي زائر لأي قسم في الموقع، يظهر موقعه الجغرافي وعدده فوراً في الكشف العلني وعلى خريطة العالم الحرارية.',
      ];

  const executiveReportEn = hasVisits
    ? [
        `Total verified platform visits: ${norm.totals.visits} visits from ${norm.totals.uniqueVisitors} unique visitors.`,
        `Today's traffic (Cairo time): ${norm.totals.todayVisits} visits (${norm.totals.todayUnique} unique) vs ${yesterdayVisits} yesterday, and ${norm.totals.last7DaysVisits} in the last 7 days.`,
        `Global reach: ${norm.totals.countriesCount} countries across ${norm.totals.regionsCount} world regions.${topCountriesEn ? ` Leading countries: ${topCountriesEn}.` : ''}`,
        topSectionsEn ? `Most visited sections: ${topSectionsEn}.` : 'No section breakdown recorded yet.',
        `Devices: Mobile ${norm.byDevice.mobile} · Desktop ${norm.byDevice.desktop} · Tablet ${norm.byDevice.tablet}.`,
      ]
    : [
        'The Platform State Census Robot is active and counting real visits as they arrive.',
        'Current count is 0 visits — per State rules, numbers and countries are never fabricated.',
        'As soon as visitors browse the platform, their countries and counts light up on the world heatmap and open ledger.',
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
    privacyGuaranteeAr: 'كشف إحصائي علني مُجمَّع ونزيه — خالٍ تماماً من عناوين IP أو الأسماء أو أي بيانات شخصية للزوار أو أسرار صاحب المنصة.',
    privacyGuaranteeEn: 'Aggregated, verifiable open census ledger — strictly free of IP addresses, personal visitor data, or owner secrets.',
    ledger,
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
        ? st.ledger.map((c) => `${c.rank}. ${c.flag} ${c.nameEn} (${c.code}) — ${c.visits} visits (${c.uniqueVisitors} unique, today: ${c.todayVisits}, share: ${c.sharePercent}%)`)
        : ['(No country visits recorded yet)']),
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
      ? st.ledger.map((c) => `${c.rank}. ${c.flag} ${c.nameAr} (${c.code}) — ${c.visits} زيارة (${c.uniqueVisitors} زائر فريد، اليوم: ${c.todayVisits}، النسبة: ${c.sharePercent}%، القسم الأعلى: ${c.topSectionAr})`)
      : ['(لم تُسجّل زيارات دولية بعد)']),
    ...(st.unspecifiedVisits > 0 ? [`• 🌐 غير محدد الموقع: ${st.unspecifiedVisits} زيارة`] : []),
    '',
    st.privacyGuaranteeAr,
  ];
  return lines.join('\n');
}

/** Exports the country ledger as UTF-8 CSV (with BOM so Excel opens Arabic cleanly). */
export function csvStatement(report: CensusReport, referenceNow = new Date()): string {
  const st = buildPublicStatement(report, referenceNow);
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const header = ['Rank', 'Code', 'Country (AR)', 'Country (EN)', 'Region (AR)', 'Visits', 'Unique Visitors', 'Today Visits', 'Share %', 'Top Section', 'Top Language', 'Last Visit At'];
  const rows = st.ledger.map((c) => [
    c.rank, c.code, c.nameAr, c.nameEn, c.regionAr, c.visits, c.uniqueVisitors, c.todayVisits, c.sharePercent, c.topSectionAr, c.topLang, c.lastVisitAt,
  ].map(esc).join(','));
  return `\uFEFF${[header.map(esc).join(','), ...rows].join('\n')}\n`;
}
