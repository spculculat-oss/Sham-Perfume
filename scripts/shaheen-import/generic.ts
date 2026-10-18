/**
 * «قارئ شاهين الذاتي» — reads a product page without JSON-LD and without any AI service, from the signals
 * almost every store platform publishes anyway: OpenGraph product tags (Shopify, Salla, Zid…), schema.org
 * microdata (itemprop="price"…), and WooCommerce's price markup. Pure (no network).
 * It never guesses: no price signal in the page source → null (the next layer — a learned site skill, then
 * Shaheen's AI reading — takes over).
 */
import { metaTags, pageImages, parsePrice, pageText, sizeOf, genderOf, parseNotes, squash, type ExtractedProduct } from './extract';

/** Price text in any local format — moved to extract.ts (shared with the JSON-LD reader). */
export { parsePrice } from './extract';

const attr = (tag: string, name: string) => (tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i')) || [])[1];
const stripTags = (html: string) => squash(html.replace(/<[^>]+>/g, ' '));

/** First element carrying itemprop="<prop>": its content/href/src attribute, or its text. */
export function itemprop(html: string, prop: string): string | undefined {
  const m = html.match(new RegExp(`<([a-z0-9]+)\\b[^>]*\\bitemprop\\s*=\\s*["'][^"']*\\b${prop}\\b[^"']*["'][^>]*>`, 'i'));
  if (!m) return undefined;
  const tag = m[0];
  const value = attr(tag, 'content') ?? attr(tag, 'href') ?? attr(tag, 'src');
  if (value !== undefined) return squash(value);
  const rest = html.slice((m.index ?? 0) + tag.length);
  const close = rest.search(new RegExp(`</${m[1]}>`, 'i'));
  return close > 0 ? stripTags(rest.slice(0, Math.min(close, 2000))) : undefined;
}

/** WooCommerce: the first «woocommerce-Price-amount» inside the product's price block. */
function wooPrice(html: string): number | undefined {
  const block = html.match(/<p[^>]*class=["'][^"']*\bprice\b[^"']*["'][^>]*>([\s\S]{0,1500}?)<\/p>/i)?.[1];
  if (!block) return undefined;
  // A sale shows the old price in <del> first; the selling price is in <ins> (or the only amount).
  const ins = block.match(/<ins[^>]*>([\s\S]*?)<\/ins>/i)?.[1];
  const amount = (ins || block).match(/woocommerce-Price-amount[^>]*>([\s\S]*?)<\/span>\s*<\/(?:bdi|span)>/i)?.[1]
    || (ins || block).match(/woocommerce-Price-amount[^>]*>([\s\S]*?)<\/span>/i)?.[1];
  return amount ? parsePrice(stripTags(amount).replace(/[^\d.,٠-٩٫٬\s]/g, ' ')) : undefined;
}

/** «Store name | Product» / «Product – Store» → the product part (the longer side is the product). */
export function productTitle(title: string, siteName?: string): string {
  let t = squash(title);
  if (siteName) t = t.replace(new RegExp(`\\s*[|–—-]\\s*${siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'), '');
  const parts = t.split(/\s+[|–—]\s+/);
  return (parts.length > 1 ? parts.sort((a, b) => b.length - a.length)[0] : t).trim();
}

/** Signals that a page is a single product (not a listing, a blog post or the home page). */
export function looksLikeProductPage(html: string, meta = metaTags(html)): boolean {
  return /product/i.test(meta['og:type'] || '')
    || Boolean(meta['product:price:amount'] || meta['og:price:amount'])
    || /itemtype\s*=\s*["'][^"']*schema\.org\/Product["']/i.test(html)
    || /<body[^>]*class=["'][^"']*\bsingle-product\b/i.test(html);
}

export function extractGeneric(html: string, url: string, fallbackCurrency: string): ExtractedProduct | null {
  const meta = metaTags(html);
  if (!looksLikeProductPage(html, meta)) return null;
  const price = parsePrice(meta['product:price:amount'] || meta['og:price:amount'])
    ?? parsePrice(itemprop(html, 'price'))
    ?? wooPrice(html);
  const currency = String(meta['product:price:currency'] || meta['og:price:currency'] || itemprop(html, 'priceCurrency') || fallbackCurrency || '').toUpperCase().trim();
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const name = productTitle(itemprop(html, 'name') && itemprop(html, 'name')!.length < 160 ? itemprop(html, 'name')! : (h1 ? stripTags(h1) : '') || meta['og:title'] || '', meta['og:site_name']);
  if (!name || name.length > 160 || !price || !/^[A-Z]{3}$/.test(currency)) return null;

  const allowed = new Set(pageImages(html, url));
  const og = [...html.matchAll(/<meta\s+[^>]*(?:property|name)=["']og:image(?::secure_url)?["'][^>]*>/gi)].map((m) => attr(m[0], 'content') || '');
  const images = [...new Set([itemprop(html, 'image') || '', ...og].map((u) => { try { return new URL(u, url).href; } catch { return ''; } })
    .filter((u) => /^https:\/\//.test(u) && (allowed.has(u) || og.includes(u) || /\.(?:jpe?g|png|webp|avif)/i.test(u))))].slice(0, 8);
  if (!images.length) return null;

  const description = squash(itemprop(html, 'description') || meta['og:description'] || meta.description || '');
  const availability = `${meta['product:availability'] || ''} ${meta['og:availability'] || ''} ${itemprop(html, 'availability') || ''}`;
  const brand = squash(meta['product:brand'] || meta['og:brand'] || itemprop(html, 'brand') || '') || undefined;
  const sku = squash(itemprop(html, 'sku') || meta['product:retailer_item_id'] || '') || url.replace(/\/+$/, '').split('/').pop() || url;
  const text = pageText(html);
  return {
    url, supplierSku: sku, name, brand: brand && brand.length < 60 ? brand : undefined, description, images, price, currency,
    inStock: !/out ?of ?stock|oos|sold ?out|discontinued|غير متوفر|نفد/i.test(availability),
    gender: genderOf(name, description.slice(0, 300)), sizeMl: sizeOf(name, text.slice(0, 4000)),
    concentration: (name.match(/\b(EDP|EDT|Eau de Parfum|Eau de Toilette|Parfum|Extrait|Attar|Oil)\b/i) || [])[1],
    families: [], notes: parseNotes(description), seasons: [], occasions: [], via: 'generic',
  };
}
