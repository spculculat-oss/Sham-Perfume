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
export const ourPriceOf = (supplierEgp: number, markup = PRICE_MARKUP) => Math.ceil((supplierEgp * markup) / 5) * 5;


/** «Kenz de Rasasi» → KEN, «Lattafa» → LAT (the scenario's BRAND-PREFIX). */
export const brandPrefix = (brand?: string) => {
  const letters = (brand || '').toUpperCase().normalize('NFKD').replace(/[^A-Z]/g, '');
  return (letters.slice(0, 3) || 'IMP').padEnd(3, 'X');
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

export interface BuildOptions { source: ImportSource; rate: number; now: string; nextId: number; existing?: ImportedProduct; markup?: number }

export function toStoreProduct(x: ExtractedProduct, o: BuildOptions): ImportedProduct {
  const regular = x.regularPrice && x.regularPrice > x.price ? x.regularPrice : x.price;
  const supplierPrice = priceInEgp(regular, o.rate);
  const name = cleanName(x.name);
  const e = o.existing;
  const id = e?.id ?? o.nextId;
  const sku = e?.sku || `${brandPrefix(x.brand)}-${String(id).padStart(3, '0')}`;
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
    brand: x.brand || e?.brand || 'Unknown',
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
