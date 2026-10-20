/**
 * «تسعير شام» — one price engine for the storefront AND the payment server, so the amount a visitor
 * sees is exactly the amount the server charges.
 *
 *   product price = supplier cost × 1.5 (the importer's `ourPrice`, kept in EGP in products.json)
 *   shipping      = the visitor's zone in src/data/shipping.json (USD: first bottle + each extra bottle)
 *   shown in      = the official currency of the visitor's country (src/data/country-currency.json,
 *                   from the MIT package «country-to-currency»), converted with the day's USD rates
 *                   (src/data/live/fx-rates.json, refreshed by the importer every two hours).
 *
 * A currency without a known rate is shown in US dollars. Pure functions: tables are parameters.
 */
import countryCurrency from '../data/country-currency.json';
import shippingData from '../data/shipping.json';
import fxData from '../data/live/fx-rates.json';

export interface FxTable { base: string; updatedAt?: string; source?: string; rates: Record<string, number> }
export interface ShippingZone { id: string; name: { ar: string; en: string }; countries?: string[]; firstItem: number; extraItem: number; days?: string }
export interface ShippingTable { currency: string; zones: ShippingZone[]; default: ShippingZone }

/** The currency of the catalog's own prices (`price` / `ourPrice` in products.json). */
export const HOME_CURRENCY = 'EGP';
export const DEFAULT_COUNTRY = 'EG';

export const BUNDLED_FX = fxData as FxTable;
export const SHIPPING = shippingData as ShippingTable;
const CURRENCY_BY_COUNTRY = countryCurrency as Record<string, string>;

export const isCountry = (code: unknown): code is string => typeof code === 'string' && /^[A-Z]{2}$/.test(code) && code in CURRENCY_BY_COUNTRY;
export const COUNTRY_CODES = Object.keys(CURRENCY_BY_COUNTRY);

export function isFxTable(data: unknown): data is FxTable & { updatedAt: string } {
  const d = data as FxTable | undefined;
  return Boolean(d && typeof d === 'object' && d.base === 'USD' && typeof d.updatedAt === 'string' && d.rates && d.rates.USD === 1 && Number(d.rates[HOME_CURRENCY]) > 0);
}

/** The visitor's currency: their country's official one when its rate is known, otherwise USD. */
export function currencyFor(country: string, fx: FxTable = BUNDLED_FX): string {
  const code = CURRENCY_BY_COUNTRY[country.toUpperCase()];
  return code && Number(fx.rates[code]) > 0 ? code : 'USD';
}

export function convert(amount: number, from: string, to: string, fx: FxTable = BUNDLED_FX): number {
  if (from === to) return amount;
  const a = Number(fx.rates[from]); const b = Number(fx.rates[to]);
  if (!(a > 0) || !(b > 0)) throw new Error(`No exchange rate for ${from}→${to}`);
  return (amount / a) * b;
}

/** Round UP to a tidy price for the size of the number: 1247 → 1250, 37.4 → 37.5, 9.31 → 9.35. */
export function tidy(value: number): number {
  if (!(value > 0)) return 0;
  const digits = Math.floor(Math.log10(value)) + 1;
  const step = Math.max(10 ** (digits - 2) / 2, 0.05);
  return Math.round(Math.ceil(value / step - 1e-9) * step * 100) / 100;
}

/** One catalog price (EGP) in another currency, tidy. Egypt keeps the catalog's exact price. */
export function priceIn(egp: number, currency: string, fx: FxTable = BUNDLED_FX): number {
  return currency === HOME_CURRENCY ? egp : tidy(convert(egp, HOME_CURRENCY, currency, fx));
}

export function shippingZone(country: string, table: ShippingTable = SHIPPING): ShippingZone {
  const code = country.toUpperCase();
  return table.zones.find((z) => z.countries?.includes(code)) || table.default;
}

/** Shipping for `bottles` bottles to `country`, in the table's currency (USD). 0 bottles → 0. */
export function shippingCost(country: string, bottles: number, table: ShippingTable = SHIPPING): number {
  if (bottles < 1) return 0;
  const zone = shippingZone(country, table);
  return zone.firstItem + zone.extraItem * (bottles - 1);
}

export interface QuoteLine { sku: string; price: number; qty: number }
export interface Quote {
  country: string; currency: string; zone: ShippingZone;
  lines: { sku: string; qty: number; unit: number; subtotal: number }[];
  items: number; shipping: number; total: number;
}

/**
 * The full order in one currency. Each line and the shipping are rounded first and the total is their
 * sum, so the receipt always adds up. `currency` defaults to the visitor's own.
 */
export function quote(lines: QuoteLine[], country: string, options: { currency?: string; fx?: FxTable; shipping?: ShippingTable } = {}): Quote {
  const fx = options.fx || BUNDLED_FX;
  const table = options.shipping || SHIPPING;
  const currency = options.currency || currencyFor(country, fx);
  const priced = lines.filter((l) => l.qty > 0 && l.price > 0).map((l) => {
    const unit = priceIn(l.price, currency, fx);
    return { sku: l.sku, qty: l.qty, unit, subtotal: Math.round(unit * l.qty * 100) / 100 };
  });
  const bottles = priced.reduce((s, l) => s + l.qty, 0);
  const shipUsd = shippingCost(country, bottles, table);
  const shipping = shipUsd ? (currency === HOME_CURRENCY ? Math.ceil(convert(shipUsd, table.currency, currency, fx) / 5) * 5 : tidy(convert(shipUsd, table.currency, currency, fx))) : 0;
  const items = Math.round(priced.reduce((s, l) => s + l.subtotal, 0) * 100) / 100;
  return { country, currency, zone: shippingZone(country, table), lines: priced, items, shipping, total: Math.round((items + shipping) * 100) / 100 };
}

/** The currency the payment gateway is asked to charge: the visitor's if the gateway accepts it, else EGP. */
export function chargeCurrency(display: string, accepted: string[]): string {
  return accepted.includes(display) ? display : (accepted.includes(HOME_CURRENCY) ? HOME_CURRENCY : accepted[0] || HOME_CURRENCY);
}

/** Common time zones → country, the offline fallback when the server cannot tell the visitor's country. */
export const ZONE_COUNTRY: Record<string, string> = {
  'Africa/Cairo': 'EG', 'Asia/Riyadh': 'SA', 'Asia/Dubai': 'AE', 'Asia/Kuwait': 'KW', 'Asia/Qatar': 'QA', 'Asia/Bahrain': 'BH',
  'Asia/Muscat': 'OM', 'Asia/Amman': 'JO', 'Asia/Beirut': 'LB', 'Asia/Baghdad': 'IQ', 'Asia/Damascus': 'SY', 'Asia/Gaza': 'PS',
  'Asia/Hebron': 'PS', 'Asia/Aden': 'YE', 'Africa/Tripoli': 'LY', 'Africa/Tunis': 'TN', 'Africa/Algiers': 'DZ', 'Africa/Casablanca': 'MA',
  'Africa/Khartoum': 'SD', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Singapore': 'SG', 'Europe/London': 'GB', 'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE', 'Europe/Rome': 'IT', 'Europe/Madrid': 'ES', 'Europe/Amsterdam': 'NL', 'Europe/Istanbul': 'TR',
  'Europe/Moscow': 'RU', 'Asia/Tehran': 'IR', 'Asia/Shanghai': 'CN', 'Asia/Tokyo': 'JP', 'Asia/Kolkata': 'IN', 'Asia/Karachi': 'PK',
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US', 'America/Toronto': 'CA',
  'Australia/Sydney': 'AU',
};

/** Best guess without the network: the time zone (reliable), then the language's region (ar-EG), then Egypt. */
export function guessCountry(languages: readonly string[] = [], timeZone = ''): string {
  const byZone = ZONE_COUNTRY[timeZone];
  if (byZone && isCountry(byZone)) return byZone;
  for (const tag of languages) {
    const region = tag.split(/[-_]/).slice(1).find((part) => /^[A-Za-z]{2}$/.test(part))?.toUpperCase();
    if (region && isCountry(region)) return region;
  }
  return DEFAULT_COUNTRY;
}
