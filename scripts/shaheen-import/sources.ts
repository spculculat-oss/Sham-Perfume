/**
 * Suppliers «مستورد شاهين» imports from. Adding a supplier = one entry here: its sitemap and which URLs are
 * product pages. Any site that publishes schema.org Product data (Shopify, WooCommerce, Salla, Zid, Astro…)
 * works directly; for the others Shaheen reads the page and his answer is validated against it.
 */
import type { ImportSource } from './transform';

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
  },
];

export const sourceById = (id: string) => SOURCES.find((s) => s.id === id);
