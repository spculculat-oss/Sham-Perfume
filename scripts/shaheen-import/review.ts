/**
 * «مراجع الصفحات» — the page reviewer linked to «مستورد شاهين».
 * After every import it reviews each product page of «متجر شام» the way a careful merchant would:
 *   - the photos really load (HTTP 200 + image content type), not a stock photo or a broken link,
 *   - the price follows the scenario (our price = supplier price × 1.5) and is sane,
 *   - the name is clean (no garbled characters), the description is real, the brand is known,
 *   - the source product still exists at the supplier and is in stock,
 *   - the product has its own page (#product=<id> and the shareable p/<slug>.html page).
 * Critical failures hide the product (published: false) until the next run fixes it; warnings stay visible
 * in the report (src/data/live/store-review.json), which the Shaheen doctor and supervisor also read.
 */
import { isGarbled, isGenericDescription, productSlug, skuOf, type RawProduct } from '../../src/utils/storeCatalog';
import { isImported, ourPriceOf, type ImportedProduct, type PriceRule } from './transform';
import { assertScrapeAllowed } from './guard';

export type ReviewStatus = 'ok' | 'warn' | 'hidden';
export interface ReviewItem { sku: string; id: number | string; name: string; status: ReviewStatus; issues: string[]; page?: string }
export interface ReviewFile {
  version: 1; updatedAt: string; reviewer: 'مراجع الصفحات';
  summary: { total: number; imported: number; ok: number; warn: number; hidden: number; imagesChecked: number; brokenImages: number };
  import?: Record<string, unknown>;
  items: ReviewItem[];
}

export interface ImageCheck { ok: boolean; reason?: string }

/** One photo: GET the first bytes (some CDNs refuse HEAD) and require an image content type. */
export async function checkImage(url: string, request: typeof fetch = fetch): Promise<ImageCheck> {
  if (!/^https:\/\//.test(url)) return { ok: true }; // mirrored into the site: checked by the build
  try {
    const r = await request(url, { headers: { Range: 'bytes=0-2047', 'User-Agent': 'Mozilla/5.0 ShaheenReviewer/1.0' }, signal: AbortSignal.timeout(15_000) });
    const type = r.headers.get('content-type') || '';
    await r.body?.cancel().catch(() => undefined);
    if (r.status >= 400) return { ok: false, reason: `HTTP ${r.status}` };
    if (!/^image\//i.test(type)) return { ok: false, reason: `ليست صورة (${type || 'بدون نوع'})` };
    return { ok: true };
  } catch (error) { return { ok: false, reason: (error as Error).name === 'TimeoutError' ? 'انتهت المهلة' : 'تعذر الاتصال' }; }
}

const STOCK_PHOTO = /images\.unsplash\.com|pexels\.com|placeholder|via\.placeholder|dummyimage/i;

/** Data checks that need no network (pure, tested). */
export function reviewProduct(p: RawProduct, opts: { markup?: number | PriceRule } = {}): { critical: string[]; warnings: string[] } {
  const critical: string[] = [];
  const warnings: string[] = [];
  const name = p.nameEn || p.nameAr || '';
  if (!name.trim()) critical.push('بدون اسم');
  else if (isGarbled(p.nameEn || '') ) critical.push('الاسم فيه حروف مشوهة');
  const price = Number(p.ourPrice);
  if (!(price > 0)) critical.push('بدون سعر بيع');
  else if (price < 30 || price > 200_000) critical.push(`سعر غير منطقي (${price} جنيه)`);
  if (!p.imageUrl) critical.push('بدون صورة');
  if (isImported(p)) {
    const i = p as ImportedProduct;
    const expected = ourPriceOf(Number(i.supplierPrice), opts.markup);
    if (Number(i.supplierPrice) > 0 && price !== expected) critical.push(`السعر لا يطابق المعادلة (المتوقع ${expected})`);
    if (!i.images?.length) critical.push('لا توجد صور من صفحة المنتج الأصلية');
    else if (i.images.length < 2) warnings.push('صورة واحدة فقط');
    if ((i.descriptionEn || '').length < 60) warnings.push('وصف المورد قصير');
    if (!i.notes || ![...(i.notes.top || []), ...(i.notes.heart || []), ...(i.notes.base || [])].length) warnings.push('المورد لم ينشر نوتات العطر');
    if (!i.brand || i.brand === 'Unknown') warnings.push('العلامة غير معروفة');
    if (!i.slug) warnings.push('بدون رابط صفحة مستقلة');
  } else {
    // The store's older products (hand-written or from the old Python scraper).
    if (!p.url) warnings.push('بدون مصدر حقيقي (لا يوجد رابط لصفحة المنتج عند المورد)');
    if (STOCK_PHOTO.test(p.imageUrl || '')) warnings.push('الصورة توضيحية من بنك صور وليست صورة المنتج');
    if (/^scraped$/i.test(String(p.supplierName || ''))) warnings.push('منتج احتياطي أضافه السكرابر القديم عند فشل الاتصال — ليس منتجاً حقيقياً من المورد');
    if (isGenericDescription(p.descriptionAr)) warnings.push('الوصف عام');
  }
  if (p.stockStatus === 'out_of_stock') warnings.push('غير متوفر عند المورد');
  return { critical, warnings };
}

export interface ReviewOptions {
  /** Which photos to download this run (rotating sample); others keep their last result. */
  imageBudget?: number; request?: typeof fetch; now?: string; markup?: number | PriceRule;
  previous?: ReviewFile; importInfo?: Record<string, unknown>; concurrency?: number;
}

/** Reviews every product, hides the ones with critical problems and returns the report. */
export async function reviewStore(products: RawProduct[], o: ReviewOptions = {}): Promise<{ products: RawProduct[]; report: ReviewFile }> {
  // L-03 Guard: review may still run for existing catalog, but re-import blocked by guard.ts
  const now = o.now || new Date().toISOString();
  const previousBroken = new Map((o.previous?.items || []).filter((i) => i.issues.some((x) => x.startsWith('الصورة لا تفتح'))).map((i) => [i.sku, i]));
  // Imported products with photos are checked first: new ones, then those flagged last time, then the rest in turn.
  const queue = products.filter((p) => typeof p.imageUrl === 'string' && /^https:/.test(p.imageUrl) && !STOCK_PHOTO.test(p.imageUrl))
    .sort((a, b) => score(b) - score(a));
  function score(p: RawProduct) {
    const i = p as Partial<ImportedProduct>;
    return (isImported(p) ? 4 : 0) + (previousBroken.has(skuOf(p)) ? 3 : 0) + (i.importedAt && i.importedAt === i.refreshedAt ? 2 : 0) + Math.random();
  }
  const budget = Math.min(queue.length, o.imageBudget ?? 80);
  const imageResults = new Map<string, ImageCheck>();
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(o.concurrency ?? 6, budget) }, async () => {
    while (cursor < budget) {
      const p = queue[cursor++];
      imageResults.set(skuOf(p), await checkImage(String(p.imageUrl), o.request));
    }
  }));

  const items: ReviewItem[] = [];
  const out = products.map((p) => {
    const sku = skuOf(p);
    const { critical, warnings } = reviewProduct(p, { markup: o.markup });
    const img = imageResults.get(sku);
    if (img && !img.ok) critical.push(`الصورة لا تفتح: ${img.reason}`);
    else if (!img && previousBroken.has(sku) && isImported(p)) critical.push(...previousBroken.get(sku)!.issues.filter((x) => x.startsWith('الصورة لا تفتح')));
    // Only imported products are hidden automatically; the merchant's own products are reported, never hidden —
    // unless the merchant hid them himself (published: false), which the report then shows as hidden.
    const hide = isImported(p) ? critical.length > 0 : p.published === false;
    const status: ReviewStatus = hide ? 'hidden' : critical.length || warnings.length ? 'warn' : 'ok';
    const issues = [...critical, ...warnings];
    items.push({ sku, id: p.id, name: p.nameEn || p.nameAr || sku, status, issues, page: `p/${productSlug(p)}.html` });
    if (!isImported(p)) return p;
    const next: RawProduct & { reviewIssues?: string[] } = { ...p, published: hide ? false : undefined, reviewIssues: issues.length ? issues : undefined };
    if (next.published === undefined) delete next.published;
    if (!next.reviewIssues) delete next.reviewIssues;
    return next;
  });
  const count = (s: ReviewStatus) => items.filter((i) => i.status === s).length;
  return {
    products: out,
    report: {
      version: 1, updatedAt: now, reviewer: 'مراجع الصفحات',
      summary: {
        total: products.length, imported: products.filter(isImported).length, ok: count('ok'), warn: count('warn'), hidden: count('hidden'),
        imagesChecked: imageResults.size, brokenImages: [...imageResults.values()].filter((r) => !r.ok).length,
      },
      import: o.importInfo,
      // The report keeps every product with a remark (the clean ones are only counted).
      items: items.filter((i) => i.status !== 'ok'),
    },
  };
}
