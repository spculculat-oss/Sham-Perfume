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
import shippingCostsData from '../data/shipping-costs.json';
import fxData from '../data/live/fx-rates.json';

export interface FxTable { base: string; updatedAt?: string; source?: string; rates: Record<string, number> }
export interface ShippingZone { id: string; name: { ar: string; en: string }; countries?: string[]; firstItem: number; extraItem: number; days?: string }
/** The merchant's margin on the shipping itself (his decision, 2026-10-26): a percentage of the real cost, capped per parcel. */
export interface ShippingHandling { percent: number; capUsd?: number }
export interface ShippingTable {
  currency: string; zones: ShippingZone[]; default: ShippingZone;
  /** Free shipping for orders whose catalog value (EGP) reaches this. Absent = the merchant gives no free shipping. */
  freeShippingAboveEgp?: number;
  /** The margin on shipping. Absent = we charge the real cost with no margin. */
  handling?: ShippingHandling;
  /** The net margin the merchant wants left after everything. Default 50 (his rule). */
  netMarginPercent?: number;
  /** The real carrier cost per destination (generated: `shipping-costs.json`). Absent = zone prices only. */
  costs?: ShippingCosts;
}
/** A destination's real carrier cost (USD, per bottle = the first 500 g), from a published rate card with its date. */
export interface ShippingCostRow { firstItem: number; extraItem: number; carrier?: string }
export interface ShippingCosts {
  version: 1; currency: string; source: string; checkedAt: string;
  countries: Record<string, ShippingCostRow>;
}

/** The currency of the catalog's own prices (`price` / `ourPrice` in products.json). */
export const HOME_CURRENCY = 'EGP';
export const DEFAULT_COUNTRY = 'EG';

export const BUNDLED_FX = fxData as FxTable;
export const SHIPPING_COSTS = shippingCostsData as ShippingCosts;
/** The live table: the merchant's zones + the real cost of every destination we have a published rate for. */
export const SHIPPING: ShippingTable = { ...(shippingData as ShippingTable), costs: SHIPPING_COSTS };
/** The merchant's rule: the 50% is net — the shipping never eats it (his words, 2026-10-26). */
export const NET_MARGIN_PERCENT = 50;
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

/** The real carrier cost for `bottles` to `country` (USD), or `null` when no published rate covers it. */
export function realShipping(country: string, bottles: number, table: ShippingTable = SHIPPING): number | null {
  const row = table.costs?.countries?.[country.toUpperCase()];
  if (!row || !(Number(row.firstItem) > 0)) return null;
  const extra = Number(row.extraItem) > 0 ? Number(row.extraItem) : Number(row.firstItem);
  return round2(row.firstItem + extra * Math.max(0, bottles - 1));
}

/** The merchant's margin on a real shipping cost (USD): a percent, capped per parcel. 0 when he set none. */
export function handlingFee(realUsd: number, table: ShippingTable = SHIPPING): number {
  const pct = Number(table.handling?.percent);
  if (!(realUsd > 0) || !(pct > 0)) return 0;
  const raw = (realUsd * pct) / 100;
  const cap = Number(table.handling?.capUsd);
  return round2(cap > 0 ? Math.min(raw, cap) : raw);
}

/** What the visitor is charged for a **known** real cost: the cost itself + the merchant's margin, in USD. */
export function chargeForCost(realUsd: number, table: ShippingTable = SHIPPING): number {
  if (!(realUsd > 0)) return 0;
  return round2(realUsd + handlingFee(realUsd, table));
}

/**
 * Shipping for `bottles` bottles to `country`, in the table's currency (USD). 0 bottles → 0.
 *
 * When a published rate covers the destination we charge **the real cost + the merchant's margin** — so the 50%
 * stays net. When none does, the zone's own price stands (and nothing promises it covers the cost).
 */
export function shippingCost(country: string, bottles: number, table: ShippingTable = SHIPPING): number {
  if (bottles < 1) return 0;
  const real = realShipping(country, bottles, table);
  if (real !== null) return chargeForCost(real, table);
  const zone = shippingZone(country, table);
  return zone.firstItem + zone.extraItem * (bottles - 1);
}

/** True when the price we charge for this destination is built on a published cost (so the 50% is guaranteed). */
export function shippingIsCostBased(country: string, table: ShippingTable = SHIPPING): boolean {
  return realShipping(country, 1, table) !== null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * What one bottle really leaves after the shipping paid at its real cost: the catalogue's own markup, plus the
 * margin on the shipping, minus nothing else. `netPercent` is measured against the supplier cost (the 50% rule).
 */
export function netAfterShipping(
  priceEgp: number, costEgp: number, country: string,
  options: { table?: ShippingTable; fx?: FxTable } = {},
): { chargedUsd: number; realUsd: number; marginUsd: number; netEgp: number; netPercent: number; costBased: boolean } {
  const table = options.table || SHIPPING; const fx = options.fx || BUNDLED_FX;
  const real = realShipping(country, 1, table);
  const chargedUsd = shippingCost(country, 1, table);
  const realUsd = real === null ? chargedUsd : real;
  const marginUsd = round2(chargedUsd - realUsd);
  const netEgp = Math.round((priceEgp - costEgp + convert(marginUsd, table.currency, HOME_CURRENCY, fx)) * 100) / 100;
  return { chargedUsd, realUsd, marginUsd, netEgp, netPercent: costEgp > 0 ? Math.round((netEgp / costEgp) * 1000) / 10 : 0, costBased: real !== null };
}

/**
 * The merchant's free-shipping rule, in EGP (the catalog's own currency), or `null` when he has approved none.
 * Nothing ever promises free shipping by itself: no rule → the visitor is told nothing and pays the zone price.
 */
export function freeShippingAbove(table: ShippingTable = SHIPPING): number | null {
  const value = Number(table.freeShippingAboveEgp);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Does an order worth `itemsEgp` (catalog value) ship free under the merchant's rule? */
export function shipsFree(itemsEgp: number, table: ShippingTable = SHIPPING): boolean {
  const above = freeShippingAbove(table);
  return above !== null && Number.isFinite(itemsEgp) && itemsEgp >= above;
}

export interface QuoteLine { sku: string; price: number; qty: number }
export interface Quote {
  country: string; currency: string; zone: ShippingZone;
  lines: { sku: string; qty: number; unit: number; subtotal: number }[];
  items: number; shipping: number; total: number;
  /** The rule applied to this order: its EGP threshold, or `null` when the merchant has none. */
  freeShippingAboveEgp: number | null;
  /** Did this order actually ship free? */
  freeShipping: boolean;
}

/**
 * The full order in one currency. Each line and the shipping are rounded first and the total is their
 * sum, so the receipt always adds up. `currency` defaults to the visitor's own.
 */
export function quote(lines: QuoteLine[], country: string, options: { currency?: string; fx?: FxTable; shipping?: ShippingTable } = {}): Quote {
  const fx = options.fx || BUNDLED_FX;
  const table = options.shipping || SHIPPING;
  const currency = options.currency || currencyFor(country, fx);
  const wanted = lines.filter((l) => l.qty > 0 && l.price > 0);
  const priced = wanted.map((l) => {
    const unit = priceIn(l.price, currency, fx);
    return { sku: l.sku, qty: l.qty, unit, subtotal: Math.round(unit * l.qty * 100) / 100 };
  });
  const bottles = priced.reduce((s, l) => s + l.qty, 0);
  // The rule compares the order's catalog value (EGP) — the same number the visitor sees on the products.
  const itemsEgp = wanted.reduce((s, l) => s + l.price * l.qty, 0);
  const freeShipping = priced.length > 0 && shipsFree(itemsEgp, table);
  const shipUsd = freeShipping ? 0 : shippingCost(country, bottles, table);
  const shipping = shipUsd ? (currency === HOME_CURRENCY ? Math.ceil(convert(shipUsd, table.currency, currency, fx) / 5) * 5 : tidy(convert(shipUsd, table.currency, currency, fx))) : 0;
  const items = Math.round(priced.reduce((s, l) => s + l.subtotal, 0) * 100) / 100;
  return {
    country, currency, zone: shippingZone(country, table), lines: priced, items, shipping,
    total: Math.round((items + shipping) * 100) / 100,
    freeShippingAboveEgp: freeShippingAbove(table), freeShipping,
  };
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
