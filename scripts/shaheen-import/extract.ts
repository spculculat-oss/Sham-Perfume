/**
 * «مستورد شاهين» — extraction layer (pure, no network).
 * Cheapest and most reliable source first:
 *   1. the supplier's sitemap (every product URL + its gallery images),
 *   2. the product page's schema.org JSON-LD (Product + Offer) and OpenGraph tags,
 *   3. the visible spec table (concentration, size, seasons, occasions, longevity),
 *   4. only when 1–3 are not enough, Shaheen reads the cleaned page text (see run.mts) and its answer is
 *      validated against the page: a price or image that is not on the page is rejected.
 * Nothing here ever invents a product: an unreadable page returns `null` and the run reports it.
 */

export interface SitemapEntry { url: string; lastmod?: string; images: string[] }

export type ExtractVia = 'json-ld' | 'generic' | 'skill' | 'shaheen';

export interface ExtractedProduct {
  url: string;
  supplierSku: string;
  name: string;
  brand?: string;
  description: string;
  images: string[];
  /** Current selling price at the supplier, in `currency`. */
  price: number;
  /** Regular price when the supplier shows a time-limited discount. */
  regularPrice?: number;
  currency: string;
  inStock: boolean;
  gender?: 'men' | 'women' | 'unisex';
  sizeMl?: number;
  concentration?: string;
  families: string[];
  notes: { top: string[]; heart: string[]; base: string[] };
  seasons: string[];
  occasions: string[];
  longevity?: string;
  barcode?: string;
  category?: string;
  /**
   * Which layer produced the record: the page's JSON-LD, Shaheen's own reader (OpenGraph/microdata, no AI),
   * a site skill Shaheen learned from an earlier AI reading (no AI), or an AI reading checked against the page.
   */
  via: ExtractVia;
}

const decode = (s: string) => s
  .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');

export const squash = (s: string) => decode(s).replace(/\s+/g, ' ').trim();

/** Product URLs (and their images) from a sitemap; language duplicates such as /ms/ are skipped. */
/**
 * Product links on a store listing page (relative or absolute), in page order, restricted to the source's
 * product URL pattern; plus the page count it announces («Page 1 of 45»), when it does.
 */
export function parseListing(html: string, base: string, opts: { include?: RegExp; exclude?: RegExp } = {}): { urls: string[]; pages?: number } {
  const urls: string[] = [];
  for (const m of html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
    let url: string;
    try { url = new URL(decode(m[1]).split('?')[0], base).href; } catch { continue; }
    if (!url.endsWith('/') && !/\.[a-z0-9]{2,5}$/i.test(url)) url += '/';
    if (opts.include && !opts.include.test(url)) continue;
    if (opts.exclude && opts.exclude.test(url)) continue;
    if (!urls.includes(url)) urls.push(url);
  }
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const pages = Number((text.match(/Page\s+\d+\s+of\s+(\d+)/i) || [])[1]) || undefined;
  return { urls, pages };
}

export function parseSitemap(xml: string, opts: { include?: RegExp; exclude?: RegExp } = {}): SitemapEntry[] {
  const out: SitemapEntry[] = [];
  const seen = new Set<string>();
  for (const block of xml.match(/<url>[\s\S]*?<\/url>/g) || []) {
    const url = decode((block.match(/<loc>\s*([^<\s]+)\s*<\/loc>/) || [])[1] || '');
    if (!url || seen.has(url)) continue;
    if (opts.include && !opts.include.test(url)) continue;
    if (opts.exclude && opts.exclude.test(url)) continue;
    seen.add(url);
    const lastmod = (block.match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1];
    const images = [...block.matchAll(/<image:loc>\s*([^<\s]+)\s*<\/image:loc>/g)].map((m) => decode(m[1]));
    out.push({ url, lastmod, images: [...new Set(images)] });
  }
  return out;
}

/** Child sitemaps listed by a sitemap index. */
export const parseSitemapIndex = (xml: string): string[] =>
  /<sitemapindex/.test(xml) ? [...xml.matchAll(/<sitemap>[\s\S]*?<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => decode(m[1])) : [];

/** Every JSON-LD node on the page, flattening arrays and @graph. */
export function jsonLdNodes(html: string): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  const push = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(push);
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      nodes.push(o);
      if (Array.isArray(o['@graph'])) (o['@graph'] as unknown[]).forEach(push);
    }
  };
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { push(JSON.parse(m[1].trim())); } catch { /* a broken block never stops the import */ }
  }
  return nodes;
}

const isType = (n: Record<string, unknown>, t: string) => {
  const v = n['@type'];
  return v === t || (Array.isArray(v) && v.includes(t));
};

export function metaTags(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(/<meta\s+[^>]*>/gi)) {
    const tag = m[0];
    const key = (tag.match(/(?:property|name)=["']([^"']+)["']/i) || [])[1];
    const content = (tag.match(/content=["']([^"']*)["']/i) || [])[1];
    if (key && content !== undefined && !(key in out)) out[key.toLowerCase()] = decode(content);
  }
  return out;
}

/** Visible text of the page (scripts/styles removed), used for the spec table and Shaheen's fallback. */
export const pageText = (html: string) => squash(
  html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>|<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
);

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
const str = (v: unknown): string => (typeof v === 'string' ? v : v && typeof v === 'object' && 'name' in v ? String((v as { name: unknown }).name ?? '') : '');
const list = (s: string) => s.split(/\s*(?:,|•|·|\/|\band\b)\s*/i).map((x) => x.trim()).filter((x) => x && x.length < 40);

/** «Top: a, b  Middle: c  Base: d» inside a description. */
export function parseNotes(text: string): ExtractedProduct['notes'] {
  const t = text.replace(/\s+/g, ' ');
  const grab = (labels: string) => {
    const m = t.match(new RegExp(`(?:${labels})\\s*(?:notes?)?\\s*[:：-]\\s*([^.:]+?)(?=\\s+(?:Top|Head|Middle|Heart|Base|Dry ?down)\\s*(?:notes?)?\\s*[:：-]|\\.|$)`, 'i'));
    return m ? list(m[1]).slice(0, 10) : [];
  };
  return { top: grab('Top|Head|Opening'), heart: grab('Middle|Heart'), base: grab('Base|Dry ?down') };
}

/** Value of a label in the visible spec table, e.g. «Concentration Eau de Parfum Family …». */
function spec(text: string, label: string, next: string[]): string | undefined {
  const m = text.match(new RegExp(`\\b${label}\\s+(.{1,80}?)\\s+(?=${next.join('|')})`, 'i'));
  return m ? m[1].trim() : undefined;
}

const SPEC_LABELS = ['Concentration', 'Family', 'Fragrance Family', 'Size', 'Quantity', 'Launch Year', 'Seasons', 'Best For', 'Longevity', 'Tags', 'Weak', 'Share', 'Add to'];

export function genderOf(...hints: (string | undefined)[]): ExtractedProduct['gender'] {
  const h = hints.filter(Boolean).join(' ').toLowerCase();
  if (/\bunisex\b|for all|both|للجنسين/.test(h)) return 'unisex';
  if (/\b(women|woman|female|her|ladies|femme|wanita)\b|نسائي/.test(h)) return 'women';
  if (/\b(men|man|male|him|homme|lelaki|pour homme)\b|رجالي/.test(h)) return 'men';
  return undefined;
}

export const sizeOf = (...hints: (string | undefined)[]) => {
  const m = hints.filter(Boolean).join(' ').match(/(\d{1,4}(?:\.\d)?)\s*ml\b/i);
  return m ? Number(m[1]) : undefined;
};

const absolute = (u: string, base: string) => { try { return new URL(u, base).href; } catch { return ''; } };

/** Product from JSON-LD (+ meta + spec table). Returns null when the page has no usable Product. */
export function extractProduct(html: string, url: string, sitemapImages: string[] = []): ExtractedProduct | null {
  const nodes = jsonLdNodes(html);
  const p = nodes.find((n) => isType(n, 'Product'));
  const meta = metaTags(html);
  if (!p) return null;
  const offersRaw = p.offers;
  const offers = (Array.isArray(offersRaw) ? offersRaw : [offersRaw]).filter(Boolean) as Record<string, unknown>[];
  const offer = offers[0] || {};
  const price = num(offer.price) ?? num(offer.lowPrice) ?? num(meta['product:price:amount']);
  const strike = (Array.isArray(offer.priceSpecification) ? offer.priceSpecification : [offer.priceSpecification])
    .filter(Boolean).map((s) => s as Record<string, unknown>)
    .find((s) => String(s.priceType || '').includes('StrikethroughPrice') || String(s.priceType || '').includes('ListPrice'));
  const regular = num(strike?.price);
  const currency = String(offer.priceCurrency || meta['product:price:currency'] || '').toUpperCase();
  const name = squash(str(p.name) || meta['og:title']?.replace(/\s*\|.*$/, '') || '');
  if (!name || !price || !currency) return null;

  const imagesLd = (Array.isArray(p.image) ? p.image : [p.image]).map((i) => {
    if (typeof i === 'string') return i;
    const o = (i || {}) as Record<string, unknown>;
    return String(o.url || o.contentUrl || '');
  });
  const images = [...new Set([...imagesLd, ...sitemapImages, meta['og:image'] || ''].map((u) => absolute(u, url)).filter((u) => /^https:\/\//.test(u)))]
    // OpenGraph crops (1200×630) are only a last resort.
    .sort((a, b) => Number(/OGImage|og-image/i.test(a)) - Number(/OGImage|og-image/i.test(b)))
    .slice(0, 8);

  const description = String(p.description || meta['og:description'] || meta.description || '').replace(/\r/g, '').trim();
  const text = pageText(html);
  const props = (Array.isArray(p.additionalProperty) ? p.additionalProperty : []) as Record<string, unknown>[];
  const prop = (re: RegExp) => props.find((x) => re.test(String(x.name || '')))?.value as string | undefined;
  const familyRaw = prop(/family/i) || spec(text, 'Family', SPEC_LABELS);
  const seasons = spec(text, 'Seasons', SPEC_LABELS);
  const bestFor = spec(text, 'Best For', SPEC_LABELS);
  const longevity = spec(text, 'Longevity', SPEC_LABELS)?.replace(/\s*Weak.*$/, '');
  const concentration = spec(text, 'Concentration', SPEC_LABELS) || (name.match(/\b(EDP|EDT|Eau de Parfum|Eau de Toilette|Parfum|Extrait|Attar|Oil)\b/i) || [])[1];
  const audience = p.audience as Record<string, unknown> | undefined;

  return {
    url: absolute(String(offer.url || '') || url, url) || url,
    supplierSku: String(p.sku || p.productID || p.mpn || '').trim() || url.replace(/\/+$/, '').split('/').pop() || url,
    name,
    brand: squash(str(p.brand) || str(p.manufacturer)) || undefined,
    description,
    images,
    price,
    regularPrice: regular && regular > price ? regular : undefined,
    currency,
    inStock: !/OutOfStock|SoldOut|Discontinued/i.test(String(offer.availability || 'InStock')),
    gender: genderOf(str(audience?.suggestedGender) || String(audience?.suggestedGender || ''), name),
    sizeMl: sizeOf(String(p.size || ''), spec(text, 'Size', SPEC_LABELS), name),
    concentration: concentration ? squash(concentration) : undefined,
    families: familyRaw ? list(familyRaw) : [],
    notes: parseNotes(description),
    seasons: seasons ? list(seasons.replace(/\s+/g, ', ')) : [],
    occasions: bestFor ? (bestFor.match(/Date Night|Special Event|Daily Wear|Daily|Office|Evening|Dinner|Casual|Sport|Party|Wedding/gi) || []) : [],
    longevity: longevity || undefined,
    barcode: String(p.gtin13 || p.gtin || '') || undefined,
    category: str(p.category) || undefined,
    via: 'json-ld',
  };
}

/** Image URLs present in the page source (used to validate Shaheen's fallback answers). */
export const pageImages = (html: string, base: string) => [...new Set(
  [...html.matchAll(/(?:src|data-src|href|content)=["']([^"']+\.(?:jpe?g|png|webp|avif)(?:\?[^"']*)?)["']/gi)].map((m) => absolute(decode(m[1]), base)),
)].filter((u) => u.startsWith('https://'));

/**
 * Validates Shaheen's reading of a page that had no structured data: the price must be written on the page
 * and every image must exist in the page source; otherwise the answer is dropped (never invented).
 */
export function validateShaheenReading(raw: unknown, html: string, url: string, currency: string): ExtractedProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = squash(String(r.name || ''));
  const price = num(r.price);
  const text = pageText(html);
  if (!name || !price || name.length > 160) return null;
  const priceOnPage = new RegExp(`(?<![\\d.])${price.toFixed(2).replace(/\.00$/, '').replace('.', '\\.')}(?:\\.00?)?(?![\\d])`).test(text.replace(/,/g, ''));
  if (!priceOnPage) return null;
  const allowed = new Set(pageImages(html, url));
  const images = (Array.isArray(r.images) ? r.images : []).map((u) => absolute(String(u), url)).filter((u) => allowed.has(u)).slice(0, 8);
  if (!images.length) return null;
  const description = String(r.description || '').trim();
  return {
    url, supplierSku: String(r.sku || '').trim() || url.replace(/\/+$/, '').split('/').pop() || url, name,
    brand: r.brand ? squash(String(r.brand)) : undefined, description, images, price, currency,
    inStock: r.inStock !== false, gender: genderOf(String(r.gender || ''), name), sizeMl: sizeOf(String(r.size || ''), name),
    concentration: r.concentration ? String(r.concentration) : undefined, families: [], notes: parseNotes(description),
    seasons: [], occasions: [], via: 'shaheen',
  };
}
