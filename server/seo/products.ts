/**
 * The real product pages of the store, for the sitemap and the agent's reports. Read from the same
 * two files the product-page generator uses, so the sitemap can never list a page that was not built.
 */
import productsJson from '../../src/data/products.json';
import catalogJson from '../../src/data/live/store-catalog.json';
import { mergeCatalog, type RawProduct, type StoreCatalogFile, type StoreProduct } from '../../src/utils/storeCatalog';

let cached: { at: number; products: StoreProduct[] } | undefined;

export function storeProducts(): StoreProduct[] {
  if (!cached || Date.now() - cached.at > 10 * 60_000) {
    const raw = (productsJson as { products?: RawProduct[] }).products || [];
    let catalog: StoreCatalogFile | undefined;
    try { catalog = catalogJson as StoreCatalogFile; } catch { catalog = undefined; }
    cached = { at: Date.now(), products: mergeCatalog(raw, catalog) };
  }
  return cached.products;
}

export function productRefs() {
  return storeProducts().map((p) => ({ id: p.id, slug: p.slug, nameAr: p.name.ar, updatedAt: p.createdAt }));
}
