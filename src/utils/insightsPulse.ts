/**
 * «نبض الدول» and «دراسة الطلبات» — the two lawful studies next to «خزنة فهم الزوار» (src/utils/visitorInsights.ts).
 *
 * The owner's decision (2026-10-24): stay inside the law, and understand each country as well as the law allows.
 *
 * 1. «نبض الدول» — anonymous counts, per country and month: which sections and scent families are viewed, the price
 *    bands, the devices, the hours, view → cart → purchase. No visitor id, no text, no cookie, nothing written on
 *    the device, no IP kept: a batch only adds to a country's totals and cannot be traced back to anyone. A visitor
 *    who REFUSED «التحليل» is not counted at all; one who accepted is counted through his vault batches. Kept
 *    24 months.
 * 2. «دراسة الطلبات» — the store's own orders (server/finance: country, lines, totals — never contacts), which the
 *    store holds anyway to sell and deliver: what each country actually buys and pays.
 * Pure: no React, no network.
 */
import { FAMILY_LABEL, type Family, type StoreProduct } from './storeCatalog';

export const PULSE_EVENT_TYPES = ['section', 'product', 'cart', 'checkout', 'purchase'] as const;
export type PulseEventType = typeof PULSE_EVENT_TYPES[number];
export interface PulseEvent { type: PulseEventType; sku?: string; section?: string }
export interface PulseBatch { events: PulseEvent[]; language?: string; device?: 'mobile' | 'tablet' | 'desktop'; hour?: number }
export const PULSE_RETENTION_MONTHS = 24;

type Counter = Record<string, number>;
export interface CountryPulse {
  /** `${country}:${YYYY-MM}` — ZZ when the edge did not say. */
  id: string; country: string; month: string; events: number;
  sections: Counter; families: Counter; genders: Counter; prices: Counter; devices: Counter; languages: Counter;
  hours: number[]; funnel: { products: number; carts: number; checkouts: number; purchases: number };
}

const SAFE_ID = /^[A-Za-z0-9_.:@-]{1,80}$/;
const COUNTRY = /^[A-Z]{2}$/;
const LANG = /^[a-z]{2}(?:-[A-Za-z]{2,4})?$/;
const MAX_KEYS = 60;

/** A pulse batch from the page, or undefined. Anything but the known fields is dropped (no id, no text). */
export function readPulse(raw: unknown): PulseBatch | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.events)) return undefined;
  const events: PulseEvent[] = [];
  for (const e of r.events.slice(0, 40)) {
    if (!e || typeof e !== 'object') continue;
    const x = e as Record<string, unknown>;
    if (!PULSE_EVENT_TYPES.includes(x.type as PulseEventType)) continue;
    const event: PulseEvent = { type: x.type as PulseEventType };
    if (typeof x.sku === 'string' && SAFE_ID.test(x.sku)) event.sku = x.sku;
    if (typeof x.section === 'string' && SAFE_ID.test(x.section) && x.section !== 'admin') event.section = x.section;
    if (event.type === 'section' && !event.section) continue;
    events.push(event);
  }
  if (!events.length) return undefined;
  const batch: PulseBatch = { events };
  if (typeof r.language === 'string' && LANG.test(r.language)) batch.language = r.language.slice(0, 2);
  if (r.device === 'mobile' || r.device === 'tablet' || r.device === 'desktop') batch.device = r.device;
  if (typeof r.hour === 'number' && Number.isInteger(r.hour) && r.hour >= 0 && r.hour < 24) batch.hour = r.hour;
  return batch;
}

export const pulseMonth = (d: Date) => d.toISOString().slice(0, 7);
export const pulseId = (country: string | undefined, d: Date) => `${country && COUNTRY.test(country) ? country : 'ZZ'}:${pulseMonth(d)}`;

const bump = (c: Counter, key: string | undefined, by = 1) => {
  if (!key) return;
  c[key] = (c[key] || 0) + by;
  const keys = Object.keys(c);
  if (keys.length > MAX_KEYS) { const low = keys.sort((a, b) => c[a] - c[b])[0]; if (low !== key) delete c[low]; }
};

export function emptyPulse(id: string): CountryPulse {
  const [country, month] = id.split(':');
  return {
    id, country, month, events: 0, sections: {}, families: {}, genders: {}, prices: {}, devices: {}, languages: {},
    hours: Array.from({ length: 24 }, () => 0), funnel: { products: 0, carts: 0, checkouts: 0, purchases: 0 },
  };
}

export type PriceBand = 'budget' | 'mid' | 'premium';
export const priceBand = (price: number, yardstick: { low: number; high: number }): PriceBand =>
  (price <= yardstick.low ? 'budget' : price >= yardstick.high ? 'premium' : 'mid');

export interface PulseContext { id: string; product?: (sku: string) => StoreProduct | undefined; yardstick: { low: number; high: number } }

/** A batch added to its country's month — counts only. */
export function applyPulse(previous: CountryPulse | undefined, batch: PulseBatch, ctx: PulseContext): CountryPulse {
  const p: CountryPulse = previous ? structuredClone(previous) : emptyPulse(ctx.id);
  bump(p.devices, batch.device);
  bump(p.languages, batch.language);
  if (batch.hour !== undefined) p.hours[batch.hour] += batch.events.length;
  for (const e of batch.events) {
    p.events += 1;
    if (e.type === 'section') bump(p.sections, e.section);
    if (e.type === 'product') p.funnel.products += 1;
    if (e.type === 'cart') p.funnel.carts += 1;
    if (e.type === 'checkout') p.funnel.checkouts += 1;
    if (e.type === 'purchase') p.funnel.purchases += 1;
    const product = e.sku && e.type !== 'section' && e.type !== 'checkout' ? ctx.product?.(e.sku) : undefined;
    if (product) {
      const weight = e.type === 'product' ? 1 : e.type === 'cart' ? 3 : 5;
      product.families.forEach((f) => bump(p.families, f, weight));
      bump(p.genders, product.gender, weight);
      if (product.price > 0) bump(p.prices, priceBand(product.price, ctx.yardstick), weight);
    }
  }
  return p;
}

/** Older than the retention window (anonymous counts are kept 24 months). */
export function pulseExpired(p: Pick<CountryPulse, 'month'>, now: Date): boolean {
  const [y, m] = p.month.split('-').map(Number);
  const age = (now.getUTCFullYear() - y) * 12 + (now.getUTCMonth() + 1 - m);
  return !Number.isFinite(age) || age >= PULSE_RETENTION_MONTHS;
}

type Text = { ar: string; en: string };
const share = (c: Counter) => {
  const sum = Object.values(c).reduce((a, b) => a + b, 0);
  return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, share: sum ? Math.round((n / sum) * 100) : 0 }));
};
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const BAND_TEXT: Record<PriceBand, Text> = { budget: { ar: 'الاقتصادي', en: 'budget' }, mid: { ar: 'المتوسط', en: 'mid-range' }, premium: { ar: 'الفاخر', en: 'premium' } };
const DEVICE_TEXT: Record<string, Text> = { mobile: { ar: 'الموبايل', en: 'mobile' }, tablet: { ar: 'التابلت', en: 'tablet' }, desktop: { ar: 'الكمبيوتر', en: 'desktop' } };

export interface PulseCountry {
  country: string; events: number; months: string[];
  families: { id: string; label: Text; share: number }[]; prices: { id: string; share: number }[];
  devices: { id: string; share: number }[]; languages: { id: string; share: number }[];
  peakHour?: number; funnel: CountryPulse['funnel']; insights: Text[];
}

/** Each country's anonymous pulse over the last `months` months (default 3), busiest first. */
export function pulseCountries(docs: CountryPulse[], now = new Date(), months = 3): PulseCountry[] {
  const keep = new Set(Array.from({ length: months }, (_, i) => pulseMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)))));
  const by = new Map<string, CountryPulse[]>();
  for (const d of docs) if (keep.has(d.month)) by.set(d.country, [...(by.get(d.country) || []), d]);
  const out: PulseCountry[] = [];
  for (const [country, list] of by) {
    const sum = emptyPulse(`${country}:all`);
    for (const d of list) {
      sum.events += d.events;
      for (const k of ['sections', 'families', 'genders', 'prices', 'devices', 'languages'] as const) Object.entries(d[k]).forEach(([key, n]) => bump(sum[k], key, n));
      d.hours.forEach((n, h) => { sum.hours[h] += n; });
      for (const k of ['products', 'carts', 'checkouts', 'purchases'] as const) sum.funnel[k] += d.funnel[k];
    }
    const families = share(sum.families).slice(0, 5).map((f) => ({ ...f, label: FAMILY_LABEL[f.id as Family] || { ar: f.id, en: f.id } }));
    const prices = share(sum.prices);
    const devices = share(sum.devices);
    const peak = sum.hours.some((n) => n > 0) ? sum.hours.indexOf(Math.max(...sum.hours)) : undefined;
    const insights: Text[] = [];
    if (families[0]) insights.push({ ar: `الأكثر جذباً: ${families[0].label.ar} (${families[0].share}% من الاهتمام).`, en: `Most attractive: ${families[0].label.en} (${families[0].share}% of interest).` });
    if (prices[0]) { const b = BAND_TEXT[prices[0].id as PriceBand]; if (b) insights.push({ ar: `الاهتمام الأكبر بالسعر ${b.ar} (${prices[0].share}%).`, en: `Most interest in the ${b.en} range (${prices[0].share}%).` }); }
    if (devices[0]) { const d = DEVICE_TEXT[devices[0].id]; if (d) insights.push({ ar: `بيدخلوا أكتر من ${d.ar} (${devices[0].share}%) — الصفحات لازم تبقى مريحة عليه.`, en: `Mostly on ${d.en} (${devices[0].share}%) — pages must be comfortable there.` }); }
    if (peak !== undefined) insights.push({ ar: `وقت الذروة حوالي الساعة ${peak} بتوقيت أجهزتهم — أنسب وقت للنشر والعروض الحقيقية.`, en: `Peak around ${peak}:00 their local time — the best time to post.` });
    if (sum.funnel.products >= 20) insights.push({ ar: `من كل 100 مشاهدة منتج: ${pct(sum.funnel.carts, sum.funnel.products)} إضافة للسلة و${pct(sum.funnel.purchases, sum.funnel.products)} شراء.`, en: `Per 100 product views: ${pct(sum.funnel.carts, sum.funnel.products)} add to cart, ${pct(sum.funnel.purchases, sum.funnel.products)} purchases.` });
    out.push({ country, events: sum.events, months: list.map((d) => d.month).sort(), families, prices, devices, languages: share(sum.languages).slice(0, 4), ...(peak !== undefined ? { peakHour: peak } : {}), funnel: sum.funnel, insights });
  }
  return out.sort((a, b) => b.events - a.events);
}

// ── «دراسة الطلبات» ─────────────────────────────────────────────────────────────────────────────────────────────
export interface StudyOrder { ref: string; mode: string; country: string; currency: string; totalMinor: number; createdAt: string; lines: { sku: string; qty: number }[] }
export interface StudyEntry { kind: string; mode: string; orderRef?: string }
export interface OrderCountry {
  country: string; orders: number; paid: number; units: number; avgUnits: number; currencies: string[];
  families: { id: string; label: Text; share: number }[]; products: { sku: string; name: string; units: number }[];
  insights: Text[];
}

/** What each country actually orders and pays for (live orders only; a refunded sale is not counted as paid). */
export function orderStudies(orders: StudyOrder[], entries: StudyEntry[], product: (sku: string) => StoreProduct | undefined): OrderCountry[] {
  const live = orders.filter((o) => o.mode === 'live');
  const net = new Map<string, number>();
  for (const e of entries) {
    if (e.mode !== 'live' || !e.orderRef) continue;
    const by = e.kind === 'sale' ? 1 : e.kind === 'refund' || e.kind === 'chargeback' ? -1 : 0;
    if (by) net.set(e.orderRef, (net.get(e.orderRef) || 0) + by);
  }
  const by = new Map<string, StudyOrder[]>();
  for (const o of live) by.set(o.country || 'ZZ', [...(by.get(o.country || 'ZZ') || []), o]);
  const out: OrderCountry[] = [];
  for (const [country, list] of by) {
    const paid = list.filter((o) => (net.get(o.ref) || 0) > 0);
    const families: Counter = {}; const units: Counter = {};
    let count = 0;
    for (const o of paid) for (const l of o.lines) {
      const qty = Math.max(0, Math.min(50, Math.floor(l.qty || 0)));
      count += qty;
      units[l.sku] = (units[l.sku] || 0) + qty;
      product(l.sku)?.families.forEach((f) => { families[f] = (families[f] || 0) + qty; });
    }
    const fam = share(families).slice(0, 5).map((f) => ({ ...f, label: FAMILY_LABEL[f.id as Family] || { ar: f.id, en: f.id } }));
    const products = Object.entries(units).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([sku, n]) => ({ sku, name: product(sku)?.name.ar || sku, units: n }));
    const avg = paid.length ? Math.round((count / paid.length) * 10) / 10 : 0;
    const insights: Text[] = [];
    if (list.length) insights.push({ ar: `${paid.length} من ${list.length} طلب اتدفعوا (${pct(paid.length, list.length)}%).`, en: `${paid.length} of ${list.length} orders paid (${pct(paid.length, list.length)}%).` });
    if (fam[0]) insights.push({ ar: `بيشتروا فعلاً: ${fam[0].label.ar} أولاً (${fam[0].share}% من القطع).`, en: `What they actually buy: ${fam[0].label.en} first (${fam[0].share}% of units).` });
    if (avg) insights.push({ ar: `متوسط الطلب ${avg} قطعة${avg >= 2 ? ' — بيحبوا يشتروا أكتر من حاجة مرة واحدة.' : '.'}`, en: `Average order: ${avg} item(s).` });
    out.push({ country, orders: list.length, paid: paid.length, units: count, avgUnits: avg, currencies: [...new Set(list.map((o) => o.currency))], families: fam, products, insights });
  }
  return out.sort((a, b) => b.paid - a.paid || b.orders - a.orders);
}
