/**
 * «روبوت مراجعة المنتجات» (bot `catalog_review`, workflow `.github/workflows/shaheen-catalog-review.yml`,
 * report `src/data/live/catalog-review.json`) — the merchant said «راجع جميع المنتجات», so this reads **every**
 * product in `src/data/products.json` and says, honestly and with numbers from the files themselves, what a
 * visitor (and the merchant's money) would actually get:
 *
 *   1. **The pricing rule**: `ourPrice` must be the supplier cost × 1.5 (`src/utils/pricing.ts`). Any product
 *      that breaks it is listed by name — never silently "corrected" (the merchant's prices are his).
 *   2. **Prices under the delivery cost**: a bottle that sells for less than delivering it to the home country
 *      costs makes a loss on every sale. Computed from `shipping.json` + the day's rates, in EGP.
 *   3. **Prices two orders of magnitude below the catalogue** (under 1% of the median): almost always a
 *      currency/data error — the merchant confirms, the robot never changes a price.
 *   4. **Names and descriptions a visitor cannot read**: garbled names (Korean/Chinese/`؟`), Arabic names with no
 *      Arabic letters, and products whose Arabic description is only the generic template.
 *   5. **One photo on many products**: the same image used by several products is a trust defect the store fixes.
 *   6. **What is on sale**: out-of-stock share, products with no source page, products with no photo.
 *   7. **The free-shipping decision, in numbers**: per shipping zone, what the delivery costs in EGP, what an
 *      order must be worth for the shipping to stay under a sixth of it, and how many products reach that — so
 *      the owner's «شحن مجاني» (src/utils/freeShipping.ts) is a decision, never a slogan.
 *
 * Pure: the product list, the shipping table and the rates are parameters (`tests/catalogReview.test.ts`).
 * It reports; it never edits a price, a name or a photo.
 */
import { isGarbled, isGenericDescription, type RawProduct } from '../../src/utils/storeCatalog';
import { HOME_CURRENCY, convert, type FxTable, type ShippingTable, type ShippingZone } from '../../src/utils/pricing';
import { ourPriceOf, type PriceRule } from '../shaheen-import/transform';

/** A product as the merchant's file holds it (the review reads the file itself, not the enriched copy). */
export type ReviewProduct = Pick<RawProduct,
  'sku' | 'nameAr' | 'nameEn' | 'descriptionAr' | 'descriptionEn' | 'ourPrice' | 'supplierPrice' |
  'stockStatus' | 'imageUrl' | 'url' | 'brand' | 'category' | 'published'>;

export interface CatalogReviewInput {
  now: number;
  products: ReviewProduct[];
  shipping: ShippingTable;
  fx: FxTable;
  /** The home country's zone (the merchant's own market) — the one whose delivery cost is compared to prices. */
  homeCountry: string;
  /** The merchant's approved free-shipping threshold in EGP, or `null` (none). */
  freeShippingAboveEgp: number | null;
  /** The share of an order's value the delivery may take before it eats the profit (default: a sixth). */
  safeShippingShare?: number;
  /** The merchant's approved price rule — the very one «مستورد شاهين» priced with (default: cost × 1.5, rounded up to 5). */
  priceRule?: number | PriceRule;
}

export interface CatalogReviewReport {
  version: 1;
  agent: 'catalog-review';
  updatedAt: string;
  counts: {
    products: number; onSale: number; hidden: number; priced: number; outOfStock: number;
    brands: number; categories: number; withPhoto: number; withSourcePage: number;
  };
  /** The declared rule (cost × 1.5) — products that break it, with both numbers. */
  ruleBreaks: { sku: string; cost: number; price: number; expected: number }[];
  /** The catalogue's own price spread, in EGP. */
  prices: { min: number; median: number; max: number; average: number };
  /** Selling for less than the delivery costs → a loss on every sale. `sellable` = it can be bought right now. */
  belowShipping: { sku: string; price: number; shippingEgp: number; sellable: boolean }[];
  /** Under 1% of the median price: almost always a currency or import error. */
  outliers: { sku: string; name: string; price: number; median: number }[];
  /** Names a visitor cannot read (garbled scripts) — the store falls back to the English name. */
  garbledNames: { sku: string; nameAr: string }[];
  /** Arabic names written only in Latin letters, and descriptions that are the generic template. */
  arabic: { namesInLatin: number; genericDescriptions: number; examples: { sku: string; nameAr: string }[] };
  /** One photo on several different products. */
  duplicateImages: { image: string; skus: string[] }[];
  /** Products on sale with no photo / no source page. */
  missing: { noPhoto: { sku: string }[]; noSourcePage: number };
  /** The free-shipping decision, zone by zone, in EGP. */
  freeShipping: {
    on: boolean;
    thresholdEgp: number | null;
    reachedByProducts: number;
    safeShippingShare: number;
    zones: { id: string; nameAr: string; shippingEgp: number; safeOrderEgp: number; productsAbove: number }[];
  };
  score: number;
  notes: string[];
  planAr: string[];
  summaryAr: string;
}

/** The catalogue's own median price (EGP) — the yardstick every other price is compared to. */
export function medianPrice(products: ReviewProduct[]): number {
  const prices = products.map((p) => Number(p.ourPrice)).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!prices.length) return 0;
  const mid = Math.floor(prices.length / 2);
  return prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
}

/** The delivery of one bottle to `country`, in EGP (shipping.json is in its own currency). */
export function shippingEgp(country: string, zones: ShippingTable, fx: FxTable): number {
  const code = country.toUpperCase();
  const zone = (zones.zones || []).find((z: ShippingZone) => z.countries?.includes(code)) || zones.default;
  if (!zone) return 0;
  const one = convert(zone.firstItem, zones.currency, HOME_CURRENCY, fx);
  return Math.round(one * 100) / 100;
}

const hasArabic = (text = '') => /[\u0600-\u06FF]/.test(text);
const round = (n: number) => Math.round(n * 100) / 100;

export function reviewCatalog(input: CatalogReviewInput): CatalogReviewReport {
  const { products, shipping, fx, homeCountry, freeShippingAboveEgp } = input;
  const now = new Date(input.now).toISOString();
  const safeShare = input.safeShippingShare && input.safeShippingShare > 0 ? input.safeShippingShare : 1 / 6;
  // A product hidden by «مراجع الصفحات» is not on sale — the review still counts it, and says so separately.
  const onSale = products.filter((p) => p.published !== false && (p.nameAr || p.nameEn));
  const priced = onSale.filter((p) => Number(p.ourPrice) > 0);
  const median = medianPrice(onSale);
  const homeShipping = shippingEgp(homeCountry, shipping, fx);

  // The rule the importer priced with (`ourPriceOf`: cost × markup, rounded up to a clean 5 EGP) — never a guess.
  const ruleBreaks = onSale.flatMap((p) => {
    const cost = Number(p.supplierPrice);
    const price = Number(p.ourPrice);
    if (!(cost > 0) || !(price > 0)) return [];
    const expected = ourPriceOf(cost, input.priceRule ?? 1.5);
    return Math.abs(price - expected) <= 0.01 ? [] : [{ sku: String(p.sku || ''), cost, price, expected }];
  });

  const belowShipping = priced
    .filter((p) => Number(p.ourPrice) < homeShipping)
    .map((p) => ({ sku: String(p.sku || ''), price: Number(p.ourPrice), shippingEgp: homeShipping, sellable: p.stockStatus !== 'out_of_stock' }))
    .sort((a, b) => a.price - b.price);

  const outlierFloor = median / 100;
  const outliers = priced
    .filter((p) => median > 0 && Number(p.ourPrice) < outlierFloor)
    .map((p) => ({ sku: String(p.sku || ''), name: String(p.nameAr || p.nameEn || ''), price: Number(p.ourPrice), median }))
    .sort((a, b) => a.price - b.price);

  const garbledNames = onSale
    .filter((p) => p.nameAr && isGarbled(String(p.nameAr)))
    .map((p) => ({ sku: String(p.sku || ''), nameAr: String(p.nameAr) }));

  const namesInLatin = onSale.filter((p) => p.nameAr && !hasArabic(String(p.nameAr)));
  const genericDescriptions = onSale.filter((p) => isGenericDescription(String(p.descriptionAr || '')));

  const imageUse = new Map<string, string[]>();
  for (const p of onSale) {
    const image = String(p.imageUrl || '').trim();
    if (!image) continue;
    imageUse.set(image, [...(imageUse.get(image) || []), String(p.sku || '')]);
  }
  const duplicateImages = [...imageUse.entries()]
    .filter(([, skus]) => skus.length > 1)
    .map(([image, skus]) => ({ image, skus }))
    .sort((a, b) => b.skus.length - a.skus.length);

  const noPhoto = onSale.filter((p) => !String(p.imageUrl || '').trim()).map((p) => ({ sku: String(p.sku || '') }));
  const noSourcePage = onSale.filter((p) => !p.url).length;

  // The free-shipping decision: what an order must be worth so the delivery stays under `safeShare` of it.
  const zoneRows = [...(shipping.zones || []), shipping.default].filter(Boolean) as ShippingZone[];
  const zones = zoneRows.map((zone) => {
    const egp = shippingEgp((zone.countries || [homeCountry])[0] || homeCountry, { ...shipping, zones: [zone], default: zone }, fx);
    const safeOrderEgp = round(egp / safeShare);
    return {
      id: zone.id,
      nameAr: zone.name?.ar || zone.id,
      shippingEgp: egp,
      safeOrderEgp,
      productsAbove: priced.filter((p) => Number(p.ourPrice) >= safeOrderEgp).length,
    };
  });
  const threshold = Number(freeShippingAboveEgp) > 0 ? Number(freeShippingAboveEgp) : null;

  const outOfStock = onSale.filter((p) => p.stockStatus === 'out_of_stock');
  const totalPrices = priced.map((p) => Number(p.ourPrice));
  const prices = {
    min: totalPrices.length ? Math.min(...totalPrices) : 0,
    median,
    max: totalPrices.length ? Math.max(...totalPrices) : 0,
    average: totalPrices.length ? round(totalPrices.reduce((s, n) => s + n, 0) / totalPrices.length) : 0,
  };

  // The score: the share of products that pass every check, weighted by what costs the merchant money.
  const bad = new Set([
    ...ruleBreaks.map((x) => x.sku), ...belowShipping.map((x) => x.sku), ...outliers.map((x) => x.sku),
    ...garbledNames.map((x) => x.sku), ...noPhoto.map((x) => x.sku),
  ]);
  const score = onSale.length ? Math.max(0, Math.round(100 - (bad.size / onSale.length) * 60 - (genericDescriptions.length / Math.max(1, onSale.length)) * 25 - (outOfStock.length / Math.max(1, onSale.length)) * 15)) : 0;

  const notes: string[] = [];
  const planAr: string[] = [];
  if (!priced.length) notes.push('مفيش أي منتج بسعر في الملف — المراجعة مش قادرة تحكم على الأسعار.');
  if (belowShipping.length) {
    const sellable = belowShipping.filter((x) => x.sellable).length;
    notes.push(`${belowShipping.length} منتج سعره أقل من تكلفة توصيله لنفس البلد (${homeShipping} ${HOME_CURRENCY}) — كل بيعة بتخسر${sellable ? `، و${sellable} منهم معروض للبيع دلوقتي` : '، وكلهم خلص مخزونهم دلوقتي'}.`);
    planAr.push(`${belowShipping.length} منتج تحت تكلفة الشحن (أرخصهم ${belowShipping[0].price} ${HOME_CURRENCY}، ${sellable} معروض للبيع) — يتأكد السعر أو يتوقف العرض.`);
  }
  if (outliers.length) {
    notes.push(`${outliers.length} سعر أقل من 1% من متوسط المتجر (${median} ${HOME_CURRENCY}) — غالباً السعر اتكتب بعملة تانية.`);
    planAr.push(`أسعار مش طبيعية: ${outliers.slice(0, 5).map((o) => `${o.sku} (${o.price})`).join('، ')} — صاحب المتجر يأكدها.`);
  }
  if (ruleBreaks.length) {
    notes.push(`${ruleBreaks.length} منتج مش على قاعدة السعر (التكلفة × 1.5).`);
    planAr.push(`${ruleBreaks.length} منتج سعره مش التكلفة × 1.5 — يتظبط في ملف المنتجات.`);
  }
  if (garbledNames.length) notes.push(`${garbledNames.length} اسم فيه حروف تالفة (كوري/صيني/رموز) — الموقع بيوري الاسم الإنجليزي بداله.`);
  if (namesInLatin.length) notes.push(`${namesInLatin.length} منتج اسمه العربي مكتوب بحروف لاتينية بس.`);
  if (genericDescriptions.length) notes.push(`${genericDescriptions.length} منتج وصفه العربي هو الجملة العامة — مش وصف حقيقي.`);
  if (duplicateImages.length) notes.push(`${duplicateImages.length} صورة مستخدمة لأكتر من منتج (أكترها ${duplicateImages[0].skus.length} منتجات).`);
  if (outOfStock.length) notes.push(`${outOfStock.length} منتج من ${onSale.length} نفد مخزونه (${Math.round((outOfStock.length / Math.max(1, onSale.length)) * 100)}%).`);
  if (products.length > onSale.length) notes.push(`${products.length - onSale.length} منتج مخفي مش للبيع (مراجع الصفحات شالته) — مش داخل حسابات المتجر.`);
  if (!threshold) notes.push('الشحن المجاني مقفول: مفيش رقم موافق عليه في src/data/shipping.json — والباقر مش بيوعد بيه.');
  else notes.push(`الشحن المجاني شغال فوق ${threshold} ${HOME_CURRENCY} — والتوصيل بيخصم فعلاً من نفس الجدول.`);

  const homeZone = zones.find((z) => z.productsAbove > 0) || zones[0];
  if (homeZone) planAr.push(`لو عايز شحن مجاني يبقى الطلب ${homeZone.safeOrderEgp} ${HOME_CURRENCY} على الأقل في ${homeZone.nameAr} (الشحن ${homeZone.shippingEgp} = سُدس الطلب) — ${homeZone.productsAbove} منتج بيوصل الرقم ده لوحده.`);

  const worst = belowShipping.length + outliers.length;
  const summaryAr = `مراجعة المنتجات: ${onSale.length} منتج معروض (${priced.length} بسعر) — ${ruleBreaks.length + worst} محتاج قرار من صاحب المتجر، ${garbledNames.length} اسم تالف، ${outOfStock.length} نفد مخزونه.`;

  return {
    version: 1, agent: 'catalog-review', updatedAt: now,
    counts: {
      products: products.length, onSale: onSale.length, hidden: products.length - onSale.length, priced: priced.length, outOfStock: outOfStock.length,
      brands: new Set(onSale.map((p) => p.brand).filter(Boolean)).size,
      categories: new Set(onSale.map((p) => p.category).filter(Boolean)).size,
      withPhoto: onSale.length - noPhoto.length, withSourcePage: onSale.length - noSourcePage,
    },
    ruleBreaks, prices, belowShipping, outliers, garbledNames,
    arabic: { namesInLatin: namesInLatin.length, genericDescriptions: genericDescriptions.length, examples: namesInLatin.slice(0, 5).map((p) => ({ sku: String(p.sku || ''), nameAr: String(p.nameAr) })) },
    duplicateImages, missing: { noPhoto, noSourcePage },
    freeShipping: { on: threshold !== null, thresholdEgp: threshold, reachedByProducts: threshold ? priced.filter((p) => Number(p.ourPrice) >= threshold).length : 0, safeShippingShare: safeShare, zones },
    score, notes, planAr, summaryAr,
  };
}
