/**
 * Suppliers «مستورد شاهين» imports from. Adding a supplier = one entry here: its sitemap and which URLs are
 * product pages. Any site that publishes schema.org Product data (Shopify, WooCommerce, Salla, Zid, Astro…)
 * works directly; for the others Shaheen reads the page and his answer is validated against it.
 */
import { readFileSync } from 'node:fs';
import type { ImportSource } from './transform';
import { isSourcesFile, toImportSource } from '../shaheen-discover/discover';

export const SOURCES: ImportSource[] = [
  {
    // The supplier of the original scraper (scripts/scraper/shamperfume_scraper.py): a Malaysian store,
    // prices in ringgit (MYR) → converted to EGP with the day's rate before the ×1.5 markup.
    id: 'shamperfume',
    name: 'Sham perfume',
    base: 'https://www.shamperfume.com',
    sitemaps: ['https://www.shamperfume.com/sitemap.xml'],
    productUrl: /^https:\/\/www\.shamperfume\.com\/perfumes\/[a-z0-9-]+\/[a-z0-9-]+\/?$/,
    excludeUrl: /\/ms\//,
    currency: 'MYR',
    fallbackRateToEgp: 11.5,
    // «Showing 1–24 of 1060 products … Page 1 of 45».
    listing: { url: 'https://www.shamperfume.com/perfumes/?page={page}', maxPages: 80 },
    origin: 'built-in',
    // Deliveries: the store sells inside Malaysia (its own shipping-policy page 404s, and its only payment
    // methods are Malaysian wallets) — so we carry its bottles to the rest of the world.
    delivery: {
      fulfilment: 'broker',
      shipsTo: ['MY'],
      evidenceAr: 'مفيش صفحة سياسة شحن على الموقع (بترجع 404)، وكله مدفوعات محلية ماليزية (Touch n Go · GrabPay · ShopeePay) — يعني بتسلّم جوه ماليزيا بس، وإحنا اللي بنشحن لكل العالم.',
      source: 'https://www.shamperfume.com/perfumes/policies/shipping-policy/',
      checkedAt: '2026-10-25',
    },
  },
];

export const sourceById = (id: string) => SOURCES.find((s) => s.id === id);

/**
 * Every source this run: the built-in suppliers, then the stores «كشّاف المصادر» found and approved
 * (src/data/live/import-sources.json, status «active»).
 */
export function loadSources(file = new URL('../../src/data/live/import-sources.json', import.meta.url)): ImportSource[] {
  let discovered: ImportSource[] = [];
  try {
    const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (isSourcesFile(data)) discovered = data.sources.map(toImportSource).filter((s): s is ImportSource => Boolean(s));
  } catch { /* no discovered stores yet */ }
  const ids = new Set(SOURCES.map((s) => s.id));
  return [...SOURCES, ...discovered.filter((s) => !ids.has(s.id))];
}
