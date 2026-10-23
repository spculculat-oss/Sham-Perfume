/**
 * «إدارة المخزون والتنبؤ بالمبيعات»: the catalog audit is real, only confirmed/completed requests count as sales,
 * the forecast is a documented moving average with days of cover and a reorder quantity, and with no sales data
 * the report says so plainly instead of inventing a number. No customer data or amounts reach the report.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { RawProduct } from '../src/utils/storeCatalog';
import {
  adminProducts, adminRequests, buildInventory, isInventoryFile, salesFromRequests,
  LEAD_DAYS, SAFETY_DAYS, SALES_WINDOW_DAYS, LOW_STOCK_LIMIT,
} from '../scripts/shaheen-inventory/plan';

const NOW = Date.parse('2026-10-23T12:00:00Z');
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

const PRODUCTS: RawProduct[] = [
  { id: 1, sku: 'A-1', nameAr: 'عود', nameEn: 'Oud', brand: 'BrandA', stockStatus: 'in_stock', isFeatured: true, families: ['oud'], published: true },
  { id: 2, sku: 'A-2', nameAr: 'ورد', nameEn: 'Rose', brand: 'BrandA', stockStatus: 'out_of_stock', families: ['floral'], published: true },
  { id: 3, sku: 'B-1', nameAr: 'مسك', nameEn: 'Musk', brand: 'BrandB', stockStatus: 'in_stock', families: ['musk'], published: true },
  { id: 4, sku: 'H-1', nameAr: 'مخفي', nameEn: 'Hidden', brand: 'BrandC', stockStatus: 'in_stock', isFeatured: true, families: ['oud'], published: false },
];

const LIVE = {
  products: [
    { sku: 'A-1', stock: 40, active: true },
    { sku: 'A-2', stock: 0, active: true },
    { sku: 'B-1', stock: 0, active: true },
  ],
  requests: [
    // Two confirmed sales for A-1 (14 units), one completed for A-2 (4 units).
    { status: 'confirmed', createdAt: ago(10), items: [{ sku: 'A-1', quantity: 12 }], contact: { name: 'PRIVATE-NAME' }, total: 123456 },
    { status: 'completed', createdAt: ago(5), items: [{ sku: 'A-1', quantity: 2 }, { sku: 'A-2', quantity: 4 }], contact: { name: 'PRIVATE-NAME-2' } },
    // A cancelled request is not a sale, and an old one is outside the window.
    { status: 'cancelled', createdAt: ago(2), items: [{ sku: 'B-1', quantity: 99 }] },
    { status: 'confirmed', createdAt: ago(SALES_WINDOW_DAYS + 10), items: [{ sku: 'A-1', quantity: 100 }] },
  ],
};

test('the catalog is real: hidden products are excluded and out-of-stock counts are exact', () => {
  const report = buildInventory({ now: NOW, products: PRODUCTS, liveFailed: [] });
  assert.ok(isInventoryFile(report));
  assert.equal(report.sources.published, 3, 'the hidden product does not ship');
  assert.equal(report.catalog.published, 3);
  assert.equal(report.catalog.outOfStock, 1);
  assert.equal(report.catalog.featuredOut, 0, 'the featured out-of-stock product is hidden');
  assert.equal(report.stock, null, 'no numeric stock was read');
  assert.equal(report.sources.liveStock, false, 'the stock endpoint never answered');
  assert.equal(report.sources.liveSales, false, 'the requests endpoint never answered');
  assert.equal(report.forecast.basis, 'none');
  assert.deepEqual(report.forecast.items, []);
  assert.match(report.forecast.noteAr, /سجل الطلبات مش مقروء/);
  assert.ok(report.problems.some((problem) => problem.includes('المخزون الرقمي مش مقروء')));
  assert.ok(report.problems.some((problem) => problem.includes('سجل الطلبات مش مقروء')));
  assert.ok(report.restock.some((item) => item.sku === 'A-2'));
  assert.ok(report.planAr[1].includes('مبيعات مؤكدة'));
});

test('an endpoint that answers with zero rows was read — it says «no sales recorded», not «not read»', () => {
  const report = buildInventory({ now: NOW, products: PRODUCTS, live: { products: [], requests: [] }, liveFailed: [] });
  assert.equal(report.sources.liveStock, true, 'the empty product list was read');
  assert.equal(report.sources.liveSales, true, 'the empty order list was read');
  assert.deepEqual(report.stock, { known: true, products: 0, low: 0, out: 0, units: 0 });
  assert.equal(report.sales.orders, 0);
  assert.equal(report.forecast.basis, 'none');
  assert.match(report.forecast.noteAr, /مفيش طلبات مؤكدة/);
  assert.match(report.summaryAr, /مفيش منتجات مسجلة بأرقام مخزون/);
  assert.ok(!report.problems.some((problem) => problem.includes('المخزون الرقمي مش مقروء')), 'read ≠ missing');
  assert.ok(report.ideas.some((idea) => idea.includes('أول ما تتسجل طلبات مؤكدة')));
});

test('only confirmed/completed requests in the window count — cancelled, old and invalid lines are ignored', () => {
  const sales = salesFromRequests(LIVE.requests, NOW);
  assert.equal(sales.orders, 2);
  assert.equal(sales.unitsTotal, 18);
  assert.deepEqual([...sales.units.entries()].sort(), [['A-1', 14], ['A-2', 4]]);
  assert.ok(!sales.units.has('B-1'), 'a cancelled order is not demand');
  assert.equal(sales.units.get('A-1'), 14, 'the 100-unit old order is outside the window');
});

test('the forecast uses real sales, days of cover and lead time — and reorders what will run out', () => {
  const report = buildInventory({ now: NOW, products: PRODUCTS, live: LIVE, liveFailed: [] });
  assert.equal(report.sources.liveStock, true);
  assert.equal(report.sources.liveSales, true);
  assert.equal(report.stock?.products, 3);
  assert.equal(report.stock?.units, 40);
  assert.equal(report.stock?.out, 2);
  assert.equal(report.stock?.low, 0);
  assert.equal(report.sales.orders, 2);
  assert.equal(report.sales.units, 18);
  assert.equal(report.sales.skus, 2);
  assert.equal(report.forecast.basis, 'live');

  const a1 = report.forecast.items.find((item) => item.sku === 'A-1')!;
  assert.equal(a1.units30, 14);
  assert.equal(a1.band, 'high');
  assert.equal(a1.stock, 40);
  assert.equal(a1.coverDays, Math.round((40 / (14 / SALES_WINDOW_DAYS)) * 10) / 10);
  assert.equal(a1.reorderUnits, undefined, '40 units cover more than lead time + safety');
  assert.match(a1.reasonAr, /14 وحدة/);

  const a2 = report.forecast.items.find((item) => item.sku === 'A-2')!;
  assert.equal(a2.units30, 4);
  assert.equal(a2.band, 'medium');
  assert.equal(a2.coverDays, 0);
  assert.equal(a2.reorderInDays, -(LEAD_DAYS + SAFETY_DAYS));
  assert.equal(a2.reorderUnits, 6, 'ceil((4/30 × 28)/3) × 3');
  assert.equal(report.forecast.totals.urgent, 1);
  assert.ok(report.planAr[0].includes('عاجل'));

  const text = JSON.stringify(report);
  for (const secret of ['PRIVATE-NAME', 'PRIVATE-NAME-2', '123456', '987654']) assert.ok(!text.includes(secret), `${secret} leaked`);
  assert.equal((report as unknown as { total?: number }).total, undefined, 'no revenue field on the report');
});

test('numeric admin stock below the limit is «low», with its real number in the reason', () => {
  const report = buildInventory({
    now: NOW,
    products: PRODUCTS,
    live: { products: [{ sku: 'A-1', stock: LOW_STOCK_LIMIT }, { sku: 'A-2', stock: 0 }, { sku: 'B-1', stock: 12 }], requests: [] },
    liveFailed: [],
  });
  assert.equal(report.stock?.low, 1);
  assert.equal(report.stock?.out, 1);
  const low = report.restock.find((item) => item.sku === 'A-1')!;
  assert.equal(low.stock, LOW_STOCK_LIMIT);
  assert.match(low.reasonAr, new RegExp(`${LOW_STOCK_LIMIT} بس`));
  assert.equal(low.priority, 'high', 'a featured low-stock product is high priority');
});

test('a missing admin account is stated, never treated as zero sales or a healthy stock', () => {
  const report = buildInventory({ now: NOW, products: PRODUCTS, liveFailed: ['token:NO_ADMIN_TOKEN'] });
  assert.equal(report.sources.liveStock, false);
  assert.equal(report.sources.liveSales, false);
  assert.deepEqual(report.sources.failed, ['token:NO_ADMIN_TOKEN']);
  assert.ok(report.problems.some((problem) => problem.includes('المخزون الرقمي مش مقروء')));
  assert.match(report.sources.salesBasisAr, /سجل الطلبات مش مقروء/);
  assert.equal(report.forecast.basis, 'none');
});

test('families with nothing available are reported as a real coverage gap', () => {
  const report = buildInventory({ now: NOW, products: PRODUCTS, liveFailed: [] });
  assert.deepEqual(report.coverage.familiesOut.map((family) => family.id), ['floral'], 'oud and musk still have products in stock');
  assert.ok(report.planAr.some((line) => line.includes('العائلات الناقصة')));
});

test('the admin endpoints are parsed defensively — bad shapes become empty lists, never a guessed number', () => {
  assert.deepEqual(adminRequests(null), []);
  assert.deepEqual(adminProducts({ items: 'not a list' }), []);
  const parsed = adminRequests({ items: [null, { status: 'confirmed', items: [{ sku: 'A-1', quantity: '4' }, { sku: 'A-2', quantity: 2 }] }] });
  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed[0], { status: undefined, createdAt: undefined, items: [] }, 'a null row is dropped to an empty record');
  assert.equal(parsed[1].status, 'confirmed');
  assert.equal(parsed[1].createdAt, undefined);
  assert.deepEqual(parsed[1].items, [{ sku: 'A-1', quantity: undefined }, { sku: 'A-2', quantity: 2 }], 'a text quantity is not turned into a number');
  assert.deepEqual(adminProducts({ items: [{ sku: 'A-1', stock: 7, active: true }] }), [{ sku: 'A-1', stock: 7, active: true }]);
  assert.equal(adminProducts({ items: [{ sku: 'A-2', stock: 0, active: false }] })[0].active, false);
});

test('the report is versioned so the panel and the pre-check never read a half-written file', () => {
  assert.equal(isInventoryFile({ version: 1, catalog: {}, forecast: {}, restock: [] }), true);
  assert.equal(isInventoryFile({ version: 2, catalog: {}, forecast: {}, restock: [] }), false);
  assert.equal(isInventoryFile({ version: 1, catalog: {} }), false);
});
