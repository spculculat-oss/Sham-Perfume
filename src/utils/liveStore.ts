import { isCatalogFile, LIVE_STORE_URL, mergeCatalog, type RawProduct, type StoreCatalogFile, type StoreProduct } from './storeCatalog';
import { recommend } from './storeAdvisor';
import { apiUrl, isStaticHosting } from './api';

/**
 * «متجر شام» as the visitor sees it: the merchant's products + the enrichment «الخبير شاهين» writes every
 * 12 hours (scripts/shaheen-store). The copy in the build is the fallback; the repository copy is newer
 * between deploys and needs no server, so it also works on GitHub Pages.
 */
// The product list grows with «مستورد شاهين» (hundreds of products with photos and notes), so it is a
// separate chunk loaded only when the store opens, not part of the site's first download.
export const storeProducts = async (): Promise<RawProduct[]> =>
  ((await import('../data/products.json')).default as { products?: RawProduct[] }).products || [];

/** Photos mirrored into the site (store/…) are served under the site's base path (/Sham-Perfume/ on Pages). */
export const storeImageSrc = (url: string) => (/^https:\/\//.test(url) ? url : `${(import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'}${url}`);

/** The product's own shareable page, generated at build time (scripts/product-pages.mts). */
export const productPageUrl = (slug: string) => `${(import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'}p/${slug}.html`;

let pending: Promise<StoreProduct[]> | undefined;
export function loadStoreCatalog(request: typeof fetch = fetch): Promise<StoreProduct[]> {
  pending ??= (async () => {
    const bundled = (await import('../data/live/store-catalog.json')).default as unknown as StoreCatalogFile;
    let file = bundled;
    try {
      const response = await request(LIVE_STORE_URL, { cache: 'no-cache', signal: AbortSignal.timeout(8000) });
      const data: unknown = response.ok ? await response.json() : undefined;
      if (isCatalogFile(data) && Date.parse(data.updatedAt) > Date.parse(bundled.updatedAt)) file = data;
    } catch { /* offline or blocked: the bundled enrichment is still good */ }
    return mergeCatalog(await storeProducts(), file);
  })();
  // A failed load (e.g. a chunk blocked offline) must not be cached forever.
  pending.catch(() => { pending = undefined; });
  return pending;
}

export interface StoreSuggestion { source: 'shaheen' | 'local'; reply: string; picks: { product: StoreProduct; why: string }[] }

/** Instant answer from the rule-based advisor (shown first, then upgraded by Shaheen). */
export function localSuggestion(products: StoreProduct[], message: string, lang: 'ar' | 'en'): StoreSuggestion {
  const { picks, matched } = recommend(products, message, 4);
  const reply = lang === 'ar'
    ? (matched ? 'ترشيحات سريعة من المتجر — شاهين بيراجعها لك…' : 'مش لاقي تطابق دقيق، دي أعلى العطور تقييماً — شاهين بيدوّر لك…')
    : (matched ? 'Quick picks from the store — Shaheen is reviewing them…' : 'No exact match; top-rated picks for now — Shaheen is looking…');
  return { source: 'local', reply, picks: picks.map((p) => ({ product: p.product, why: (lang === 'ar' ? p.reasons.ar : p.reasons.en).join(' · ') })) };
}

/** «اسأل شاهين»: POST /api/store/advise; null when the server cannot be reached (keep the local answer). */
export async function askShaheenStore(products: StoreProduct[], message: string, lang: 'ar' | 'en', request: typeof fetch = fetch): Promise<StoreSuggestion | null> {
  if (isStaticHosting) return null;
  try {
    const response = await request(apiUrl('/api/store/advise'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, language: lang }), signal: AbortSignal.timeout(35_000),
    });
    if (!response.ok) return null;
    const data = await response.json() as { source?: string; reply?: string; picks?: { id?: string; why?: string }[] };
    const bySku = new Map(products.map((p) => [p.sku, p]));
    const picks = (data.picks || []).flatMap((p) => {
      const product = bySku.get(String(p.id));
      return product ? [{ product, why: String(p.why || '') }] : [];
    });
    if (!picks.length) return null;
    return { source: data.source === 'shaheen' ? 'shaheen' : 'local', reply: String(data.reply || ''), picks };
  } catch { return null; }
}
