/**
 * «مستورد شاهين» — turns a supplier product into a «متجر شام» product, following the store's existing
 * upload scenario (scripts/scraper + scripts/db): supplier price → our price = supplier × markup (1.5),
 * SKU = BRAND-PREFIX + number, supplier id/name kept for ordering, stock status, real product URL.
 * Pure: no network, no clock unless passed in.
 */
import { slugify, type RawProduct } from '../../src/utils/storeCatalog';

export { slugify };
import type { ExtractedProduct } from './extract';

export interface ImportSource {
  id: string;
  name: string;
  /** Home page; product URLs must stay on this host. */
  base: string;
  sitemaps: string[];
  /** Product URLs only (no listings, brands, blog, other languages). */
  productUrl: RegExp;
  excludeUrl?: RegExp;
  currency: string;
  /** Fallback exchange rate to EGP when the live rate cannot be read. */
  fallbackRateToEgp?: number;
  /**
   * The store's own «all products» listing ({page} = 1, 2, …). Read as well as the sitemap because a sitemap
   * can miss products (shamperfume lists 999 in its sitemap, its second sitemap file is a 404, the store
   * shows 1060): every product on the listing that the sitemap lacks is imported too.
   */
  listing?: { url: string; maxPages: number };
}

export interface ImportedFields {
  supplierId: string; supplierName: string; supplierSku: string; supplierCurrency: string;
  /** Supplier price in its own currency (the regular price, never a time-limited sale). */
  supplierPriceOriginal: number; supplierSalePrice?: number; exchangeRate: number;
  url: string; slug: string; images: string[]; sizeMl?: number; concentration?: string; longevity?: string;
  notes?: { top: string[]; heart: string[]; base: string[] }; families?: string[]; seasonsSource?: string[]; occasionsSource?: string[];
  barcode?: string; importedAt: string; refreshedAt: string; importedVia: 'json-ld' | 'shaheen';
  published?: boolean; reviewIssues?: string[];
}
export type ImportedProduct = RawProduct & ImportedFields;

/** The scenario's markup: our price = supplier price × 1.5, rounded up to a clean 5 EGP. */
export const PRICE_MARKUP = 1.5;
export const priceInEgp = (supplierPrice: number, rate: number) => Math.round(supplierPrice * rate * 100) / 100;
/**
 * The merchant's price rule (repository variables, all optional — the defaults are the scenario's ×1.5):
 * cost = supplier price in EGP + a fixed shipping/handling cost per bottle; profit = cost × (markup − 1),
 * but never more than maxProfitEgp; our price = cost + profit, rounded up to a clean 5 EGP.
 */
export interface PriceRule { markup?: number; shippingEgp?: number; maxProfitEgp?: number }
export const ourPriceOf = (supplierEgp: number, rule: number | PriceRule = PRICE_MARKUP) => {
  const r: PriceRule = typeof rule === 'number' ? { markup: rule } : rule;
  const markup = r.markup && r.markup >= 1 ? r.markup : PRICE_MARKUP;
  const cost = supplierEgp + (r.shippingEgp && r.shippingEgp > 0 ? r.shippingEgp : 0);
  let profit = cost * (markup - 1);
  if (r.maxProfitEgp && r.maxProfitEgp > 0) profit = Math.min(profit, r.maxProfitEgp);
  return Math.ceil(Math.round((cost + profit) * 100) / 100 / 5) * 5;
};


/** The price picture of the imported products (min / median / max and the most expensive ones) for the merchant. */
export function priceReport(products: RawProduct[], top = 5) {
  const items = products.filter(isImported).map((p) => p as ImportedProduct).filter((p) => Number(p.ourPrice) > 0 && p.published !== false)
    .sort((a, b) => Number(b.ourPrice) - Number(a.ourPrice));
  const prices = items.map((p) => Number(p.ourPrice)).sort((a, b) => a - b);
  const median = prices.length ? (prices.length % 2 ? prices[prices.length >> 1] : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2) : 0;
  return {
    count: prices.length, min: prices[0] || 0, median, max: prices.at(-1) || 0,
    top: items.slice(0, top).map((p) => ({ sku: p.sku, name: p.nameEn, price: Number(p.ourPrice), supplierEgp: Number(p.supplierPrice), sizeMl: p.sizeMl })),
  };
}

/** «Kenz de Rasasi» → KEN, «Lattafa» → LAT (the scenario's BRAND-PREFIX). */
export const brandPrefix = (brand?: string) => {
  const letters = (brand || '').toUpperCase().normalize('NFKD').replace(/[^A-Z]/g, '');
  return (letters.slice(0, 3) || 'IMP').padEnd(3, 'X');
};

/** «RASASI» → «Rasasi» (the store already sells «Rasasi»; one brand must not appear twice in the filter). */
export const normalizeBrand = (brand?: string) => {
  const b = (brand || '').trim().replace(/\s+/g, ' ');
  return b.length > 3 && b === b.toUpperCase() && /[A-Z]/.test(b)
    ? b.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, sep: string, c: string) => sep + c.toUpperCase())
    : b;
};

/** Gender in the store's Arabic category words (the store's filters understand them). */
export const CATEGORY_AR = { men: 'رجالي', women: 'نسائي', unisex: 'مختلط' } as const;

/** English names without the supplier's local SEO tails («… Malaysia», «for Men» repeated…). */
export const cleanName = (name: string) => name
  .replace(/\s*\|\s*.*$/, '').replace(/\b(?:in\s+)?Malaysia\b/gi, '').replace(/\s{2,}/g, ' ').replace(/[\s,–-]+$/, '').trim();

/** Description: the supplier's text without its local delivery / country marketing lines. */
export const cleanDescription = (text: string) => text
  .split(/\n+/).map((l) => l.trim()).filter((l) => l && !/malaysia|delivery|shipping|pick ?up|ringgit|\bRM\s?\d/i.test(l))
  .join('\n').replace(/\n{3,}/g, '\n\n').slice(0, 1500).trim();

export const isImported = (p: RawProduct): p is ImportedProduct => typeof (p as Partial<ImportedFields>).supplierSku === 'string' && typeof (p as Partial<ImportedFields>).url === 'string';

/** Key used to never import the same supplier product twice. */
export const sourceKey = (supplierId: string, supplierSku: string) => `${supplierId}:${supplierSku.toUpperCase()}`;

export interface BuildOptions { source: ImportSource; rate: number; now: string; nextId: number; existing?: ImportedProduct; markup?: number | PriceRule }

export function toStoreProduct(x: ExtractedProduct, o: BuildOptions): ImportedProduct {
  const regular = x.regularPrice && x.regularPrice > x.price ? x.regularPrice : x.price;
  const supplierPrice = priceInEgp(regular, o.rate);
  const name = cleanName(x.name);
  const e = o.existing;
  const id = e?.id ?? o.nextId;
  const brand = normalizeBrand(x.brand);
  const sku = e?.sku || `${brandPrefix(brand)}-${String(id).padStart(3, '0')}`;
  const desc = cleanDescription(x.description);
  const product: ImportedProduct = {
    id, sku,
    // Arabic text is written by «الخبير شاهين» in the store training (scripts/shaheen-store); keep his if present.
    nameAr: e?.nameAr && e.nameAr !== e.nameEn ? e.nameAr : name,
    nameEn: name,
    descriptionAr: e?.descriptionAr && e.descriptionAr !== e.descriptionEn ? e.descriptionAr : '',
    descriptionEn: desc,
    imageUrl: x.images[0] || null,
    images: x.images,
    category: x.gender ? CATEGORY_AR[x.gender] : (e?.category || 'عطور'),
    brand: brand || normalizeBrand(e?.brand) || 'Unknown',
    supplierPrice,
    ourPrice: ourPriceOf(supplierPrice, o.markup),
    stockStatus: x.inStock ? 'in_stock' : 'out_of_stock',
    isFeatured: e?.isFeatured ?? false,
    isNew: e ? e.isNew : true,
    rating: e?.rating, reviewCount: e?.reviewCount ?? 0,
    createdAt: e?.createdAt || o.now,
    supplierId: o.source.id, supplierName: o.source.name, supplierSku: x.supplierSku, supplierCurrency: x.currency,
    supplierPriceOriginal: regular, supplierSalePrice: x.regularPrice ? x.price : undefined, exchangeRate: o.rate,
    url: x.url, slug: e?.slug || `${slugify(name)}-${String(id)}`,
    sizeMl: x.sizeMl, concentration: x.concentration, longevity: x.longevity,
    notes: x.notes, families: x.families, seasonsSource: x.seasons, occasionsSource: x.occasions,
    barcode: x.barcode, importedAt: e?.importedAt || o.now, refreshedAt: o.now, importedVia: x.via,
    published: e?.published, reviewIssues: e?.reviewIssues,
  };
  for (const k of Object.keys(product) as (keyof ImportedProduct)[]) if (product[k] === undefined) delete product[k];
  return product;
}

/** Next free numeric id in products.json. */
/**
 * «منقّح الصور» (scripts/shaheen-images/clean.py) keeps a clean copy in the site of every supplier photo that
 * carried a source/contact mark (src/data/live/image-clean.json). A refreshed product gets the supplier's links
 * again, so every run puts the clean copies back. Returns how many products changed.
 */
export interface ImageRegistry { images?: Record<string, string | { s?: string; f?: string }> }
export function useCleanPhotos(products: RawProduct[], registry: ImageRegistry | undefined): number {
  const images = registry?.images || {};
  const clean = (u: string) => { const v = images[u]; return v && typeof v === 'object' && typeof v.f === 'string' && v.f ? v.f : u; };
  let changed = 0;
  for (const p of products) {
    const list = Array.isArray(p.images) ? p.images : [];
    const next = list.map((u) => (typeof u === 'string' ? clean(u) : u));
    const first = typeof p.imageUrl === 'string' ? clean(p.imageUrl) : p.imageUrl;
    if (next.some((u, i) => u !== list[i]) || first !== p.imageUrl) { p.images = next; p.imageUrl = first; changed++; }
  }
  return changed;
}

export const nextIdOf = (products: RawProduct[]) => products.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0) + 1;

/**
 * Which sitemap URLs to read this run: every new product first (up to `maxNew`), then the oldest-refreshed
 * imported products (up to `maxRefresh`) so prices and stock stay current without re-reading everything.
 */
export function planRun(urls: { url: string; lastmod?: string }[], imported: ImportedProduct[], maxNew: number, maxRefresh: number) {
  const byUrl = new Map(imported.map((p) => [p.url.replace(/\/+$/, ''), p]));
  const fresh = urls.filter((u) => !byUrl.has(u.url.replace(/\/+$/, ''))).slice(0, maxNew);
  const listed = new Set(urls.map((u) => u.url.replace(/\/+$/, '')));
  const refresh = imported.filter((p) => listed.has(p.url.replace(/\/+$/, '')))
    .sort((a, b) => Date.parse(a.refreshedAt) - Date.parse(b.refreshedAt)).slice(0, maxRefresh).map((p) => ({ url: p.url }));
  // Imported products that left the supplier's sitemap are no longer sold there.
  const gone = imported.filter((p) => !listed.has(p.url.replace(/\/+$/, '')));
  return { fresh, refresh, gone };
}
