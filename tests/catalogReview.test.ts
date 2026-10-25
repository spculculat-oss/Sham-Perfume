/**
 * «روبوت مراجعة المنتجات»: it reads every product and reports honestly — the merchant's price rule, a price under
 * the delivery cost, an implausible price, a name or a description a visitor cannot read, one photo on many
 * products, and the free-shipping decision in EGP — and it never changes a price or hides a product itself.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { freeShippingAbove, type FxTable, type ShippingTable } from '../src/utils/pricing';
import { BOTS } from '../src/utils/shaheenOrg';
import { refugeIndex } from '../src/utils/shaheenRefuge';
import { ourPriceOf } from '../scripts/shaheen-import/transform';
import { medianPrice, reviewCatalog, shippingEgp, type ReviewProduct } from '../scripts/shaheen-catalog/review';

const FX: FxTable = { base: 'USD', updatedAt: '2026-10-25T00:00:00Z', rates: { USD: 1, EGP: 50, SAR: 3.75, EUR: 0.9 } };
const SHIP: ShippingTable = {
  currency: 'USD',
  zones: [{ id: 'egypt', name: { ar: 'مصر', en: 'Egypt' }, countries: ['EG'], firstItem: 10, extraItem: 2, days: '7-14' }],
  default: { id: 'world', name: { ar: 'العالم', en: 'World' }, firstItem: 20, extraItem: 5 },
};
const product = (p: Partial<ReviewProduct>): ReviewProduct => ({ sku: 'X-1', nameAr: 'عطر ورد', nameEn: 'Rose', descriptionAr: 'عطر ورد طبيعي بثبات طويل ومناسب لكل يوم من أيام الأسبوع.', ourPrice: ourPriceOf(1000), supplierPrice: 1000, stockStatus: 'in_stock', imageUrl: 'https://example.test/1.jpg', url: 'https://example.test/p/1', ...p });

const review = (products: ReviewProduct[], extra: Partial<Parameters<typeof reviewCatalog>[0]> = {}) =>
  reviewCatalog({ now: Date.parse('2026-10-25T00:00:00Z'), products, shipping: SHIP, fx: FX, homeCountry: 'EG', freeShippingAboveEgp: null, ...extra });

test('the merchant’s own price rule: cost × 1.5 rounded up to 5, flagged only when it is really broken', () => {
  assert.equal(ourPriceOf(1000), 1500);
  assert.equal(ourPriceOf(1001), 1505, 'rounded up to a clean 5 EGP');
  const good = review([product({}), product({ sku: 'X-2', supplierPrice: 2000, ourPrice: ourPriceOf(2000) })]);
  assert.deepEqual(good.ruleBreaks, [], 'a product priced by the importer is not a finding');
  const broken = review([product({ sku: 'BAD-1', supplierPrice: 1000, ourPrice: 900 })]);
  assert.equal(broken.ruleBreaks.length, 1);
  assert.deepEqual(broken.ruleBreaks[0], { sku: 'BAD-1', cost: 1000, price: 900, expected: 1500 });
  // The merchant may change the rule (repository variables) — the review follows the same rule, never its own.
  const other = review([product({ sku: 'X-3', supplierPrice: 1000, ourPrice: 1200 })], { priceRule: { markup: 1.2 } });
  assert.deepEqual(other.ruleBreaks, []);
});

test('a product that sells for less than its own delivery costs is a loss — and it says whether it can be bought', () => {
  assert.equal(shippingEgp('EG', SHIP, FX), 500, '10 USD × 50 EGP');
  const cheap = review([product({ sku: 'LOSS-1', supplierPrice: 100, ourPrice: 150 })]);
  assert.equal(cheap.belowShipping.length, 1);
  assert.equal(cheap.belowShipping[0].sellable, true);
  assert.match(cheap.notes.join('\n'), /أقل من تكلفة توصيله/);
  const outOfStock = review([product({ sku: 'LOSS-2', supplierPrice: 100, ourPrice: 150, stockStatus: 'out_of_stock' })]);
  assert.equal(outOfStock.belowShipping[0].sellable, false, 'out of stock is not sellable — but the price is still wrong');
  assert.match(outOfStock.notes.join('\n'), /خلص مخزونهم/);
});

test('an implausible price is found by the catalogue’s own median, never by a number written in the code', () => {
  const products = [
    product({ sku: 'A', supplierPrice: 3000, ourPrice: ourPriceOf(3000) }),
    product({ sku: 'B', supplierPrice: 3200, ourPrice: ourPriceOf(3200) }),
    product({ sku: 'C', supplierPrice: 10, ourPrice: 15 }), // a currency error: 15 instead of 15 × the rate
  ];
  const report = review(products);
  assert.ok(medianPrice(products) > 4000);
  assert.deepEqual(report.outliers.map((o) => o.sku), ['C']);
  assert.equal(report.prices.min, 15);
  assert.ok(report.notes.some((n) => n.includes('1% من متوسط المتجر')));
});

test('names and descriptions a visitor cannot read are counted, and the review never rewrites them', () => {
  const report = review([
    product({ sku: 'KO', nameAr: 'عطر 나 셸라' }),
    product({ sku: 'LAT', nameAr: 'Oud Mood 30ml by Lattafa' }),
    product({ sku: 'GEN', descriptionAr: '' }),
  ]);
  assert.deepEqual(report.garbledNames.map((g) => g.sku), ['KO'], 'the store falls back to the English name for this one');
  assert.equal(report.arabic.namesInLatin, 1, 'a Latin-only Arabic name is one finding — the garbled one is counted once, as garbled');
  assert.ok(report.arabic.genericDescriptions >= 1);
  const latin = report.arabic.examples.map((e) => e.sku);
  assert.ok(latin.includes('LAT') || latin.includes('KO'));
});

test('one photo on several products is a trust defect and is listed with the products', () => {
  const report = review([
    product({ sku: 'A', imageUrl: 'https://example.test/same.jpg' }),
    product({ sku: 'B', imageUrl: 'https://example.test/same.jpg' }),
    product({ sku: 'C', imageUrl: 'https://example.test/other.jpg' }),
  ]);
  assert.equal(report.duplicateImages.length, 1);
  assert.deepEqual(report.duplicateImages[0].skus.sort(), ['A', 'B']);
  assert.equal(report.counts.withPhoto, 3);
});

test('a hidden product is not for sale: it is counted apart and never priced into the store', () => {
  const report = review([
    product({ sku: 'LIVE', ourPrice: 1500, supplierPrice: 1000 }),
    product({ sku: 'HIDDEN', ourPrice: 15, supplierPrice: 10, published: false }),
  ]);
  assert.equal(report.counts.products, 2);
  assert.equal(report.counts.onSale, 1);
  assert.equal(report.counts.hidden, 1);
  assert.deepEqual(report.outliers, [], 'a hidden 15 EGP product is not an on-sale anomaly');
  assert.ok(report.notes.some((n) => n.includes('مخفي')));
});

test('the free-shipping decision: what an order must be worth so the delivery stays under a sixth of it', () => {
  const products = [
    product({ sku: 'SMALL', supplierPrice: 1000, ourPrice: 1500 }),
    product({ sku: 'BIG', supplierPrice: 4000, ourPrice: 6000 }),
  ];
  const off = review(products);
  assert.equal(off.freeShipping.on, false);
  assert.equal(off.freeShipping.thresholdEgp, null);
  const egypt = off.freeShipping.zones.find((z) => z.id === 'egypt')!;
  assert.equal(egypt.shippingEgp, 500);
  assert.equal(egypt.safeOrderEgp, 3000, '500 EGP of delivery must be a sixth of a 3000 EGP order');
  assert.equal(egypt.productsAbove, 1, 'only the 6000 EGP product reaches it');
  assert.match(off.notes.join('\n'), /الشحن المجاني مقفول/);

  const on = review(products, { freeShippingAboveEgp: 3000 });
  assert.equal(on.freeShipping.on, true);
  assert.equal(on.freeShipping.thresholdEgp, 3000);
  assert.equal(on.freeShipping.reachedByProducts, 1);
  assert.match(on.notes.join('\n'), /شغال فوق 3000/);
  // A share other than a sixth is the merchant's call, and the review says which one it used.
  const strict = review(products, { safeShippingShare: 1 / 10 });
  assert.equal(strict.freeShipping.zones.find((z) => z.id === 'egypt')!.safeOrderEgp, 5000);
});

test('the review is wired into Shaheen’s structure and reaches the merchant through the meeting', () => {
  const bot = BOTS.find((b) => b.id === 'catalog_review');
  assert.ok(bot, 'the robot is placed under Shaheen');
  assert.equal(bot!.dept, 'store');
  assert.equal(bot!.report, 'catalog-review.json');
  assert.equal(bot!.workflow, 'shaheen-catalog-review.yml');
  const root = new URL('..', import.meta.url).pathname;
  assert.ok(existsSync(join(root, '.github/workflows', bot!.workflow!)), 'the workflow is real');
  assert.ok(existsSync(join(root, 'src/data/live', bot!.report!)), 'the report is real');
  const ids = new Set(refugeIndex().map((e) => e.id));
  assert.ok(ids.has('robot:catalog_review'), 'the refuge reaches it');
  assert.ok(ids.has('report:catalog-review.json'), 'its report is in the refuge');
  assert.ok(ids.has('workflow:shaheen-catalog-review.yml'), 'its workflow is in the refuge');
});

test('the real catalogue and the real shipping table: the report tells the truth about this repository', () => {
  const root = new URL('..', import.meta.url).pathname;
  const products = JSON.parse(readFileSync(join(root, 'src/data/products.json'), 'utf8')).products as ReviewProduct[];
  const shipping = JSON.parse(readFileSync(join(root, 'src/data/shipping.json'), 'utf8')) as ShippingTable;
  const report = JSON.parse(readFileSync(join(root, 'src/data/live/catalog-review.json'), 'utf8'));
  assert.equal(report.agent, 'catalog-review');
  assert.equal(report.counts.products, products.length, 'every product was reviewed, not a sample');
  const live = reviewCatalog({ now: Date.now(), products, shipping, fx: FX, homeCountry: 'EG', freeShippingAboveEgp: freeShippingAbove(shipping) });
  assert.equal(report.counts.onSale, live.counts.onSale);
  assert.equal(report.counts.outOfStock, live.counts.outOfStock);
  assert.ok(report.score >= 0 && report.score <= 100);
  // The free-shipping promise on the site and the money at checkout come from the same table.
  assert.equal(report.freeShipping.on, freeShippingAbove(shipping) !== null);
  for (const zone of report.freeShipping.zones) assert.ok(zone.shippingEgp > 0, `${zone.id} has a real delivery cost`);
});
