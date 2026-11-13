import type { StoreProduct } from './storeCatalog';

/**
 * «بانر المنتجات» (TopPromoHub): which store products the banner rotates through, and in what order.
 * Pure helpers so the ranking and filters are tested and identical wherever the banner is rendered.
 */
export type ShowcaseCategory = 'all' | 'men' | 'women' | 'unisex';

/** Placeholder stock photos (the seed/demo rows) are not the merchant's real product photos. */
export const isStockPhoto = (url?: string) => !url || /unsplash\.com/i.test(url);

/**
 * Real, sellable products first: a real photo and in stock, then featured/new, then the rest.
 * Demo rows (stock photos) and sold-out items stay reachable by search but never lead the banner.
 * The sort is stable, so the merchant's own order is kept inside each group.
 */
export function rankShowcase(products: StoreProduct[]): StoreProduct[] {
  const score = (p: StoreProduct) =>
    (p.price > 0 ? 0 : 100) + (isStockPhoto(p.imageUrl) ? 20 : 0) + (p.inStock ? 0 : 10) + (p.isFeatured || p.isNew ? 0 : 1);
  return products
    .map((p, i) => ({ p, i, s: score(p) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map(({ p }) => p);
}

/** Gender from the store's cleaned data (covers «عطور/عود» rows the raw category text missed). */
export function matchesCategory(p: StoreProduct, category: ShowcaseCategory): boolean {
  if (category === 'all') return true;
  if (p.gender) return p.gender === category;
  const c = p.category || '';
  return category === 'men' ? /رجالي|رجالى/.test(c) : category === 'women' ? /نسائي|نسائى/.test(c) : /مختلط|للجنسين/.test(c);
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

/** Every word of the query must appear somewhere in the product (Arabic letter variants folded). */
export function matchesQuery(p: StoreProduct, query: string): boolean {
  const words = norm(query).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = norm([p.name.ar, p.name.en, p.brand, p.description.ar, p.description.en, p.tags.join(' '), p.families.join(' ')].join(' '));
  return words.every((w) => hay.includes(w));
}

export function filterShowcase(ranked: StoreProduct[], category: ShowcaseCategory, query: string): StoreProduct[] {
  return ranked.filter((p) => p.price > 0 && matchesCategory(p, category) && matchesQuery(p, query));
}

/** Indexes of the thumbnail strip: up to `count` neighbours around the active product, wrapping around. */
export function thumbWindow(total: number, active: number, count = 5): number[] {
  const n = Math.min(count, total);
  if (n <= 0) return [];
  const start = active - Math.floor(n / 2);
  return Array.from({ length: n }, (_, i) => (((start + i) % total) + total) % total);
}
