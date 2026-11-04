/**
 * «نبض الدول» and «دراسة الطلبات» — the lawful studies next to the visitors' vault: anonymous counts per country
 * (no id, no text; a visitor who refused is not counted) and what each country actually pays for.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { MemoryStore } from '../server/core/store';
import { createInsightsService } from '../server/insights';
import { mergeCatalog, type RawProduct } from '../src/utils/storeCatalog';
import { applyPulse, orderStudies, pulseCountries, pulseExpired, pulseId, readPulse } from '../src/utils/insightsPulse';
import { INSIGHTS_CONSENT_VERSION, priceYardstick } from '../src/utils/visitorInsights';

const RAW: RawProduct[] = [
  { id: 1, sku: 'OUD-1', nameAr: 'عود ملكي', nameEn: 'Royal Oud', descriptionAr: 'عود شرقي فاخر للسهرات', descriptionEn: '', category: 'عود', brand: 'Sham', supplierPrice: 1000, ourPrice: 3000, stockStatus: 'in_stock', imageUrl: '', createdAt: '2026-09-01' },
  { id: 2, sku: 'FRS-2', nameAr: 'نسيم البحر', nameEn: 'Sea Breeze', descriptionAr: 'عطر منعش للصيف', descriptionEn: 'Fresh summer scent', category: 'رجالي', brand: 'Sham', supplierPrice: 200, ourPrice: 400, stockStatus: 'in_stock', imageUrl: '', createdAt: '2026-09-01' },
  { id: 3, sku: 'FLR-3', nameAr: 'ورد الياسمين', nameEn: 'Jasmine Rose', descriptionAr: 'عطر نسائي زهري بالورد والياسمين', descriptionEn: '', category: 'نسائي', brand: 'Sham', supplierPrice: 400, ourPrice: 900, stockStatus: 'in_stock', imageUrl: '', createdAt: '2026-09-01' },
  { id: 4, sku: 'MSK-4', nameAr: 'مسك أبيض', nameEn: 'White Musk', descriptionAr: 'مسك ناعم', descriptionEn: '', category: 'مختلط', brand: 'Sham', supplierPrice: 300, ourPrice: 600, stockStatus: 'in_stock', imageUrl: '', createdAt: '2026-09-01' },
];
const PRODUCTS = mergeCatalog(RAW);
const bySku = new Map(PRODUCTS.map((p) => [p.sku, p]));
const product = (sku: string) => bySku.get(sku);

test('a pulse batch keeps counts only: no visitor id, no text, no admin pages', () => {
  const b = readPulse({ visitorId: 'v-someone-1', text: 'ahmed@example.com', language: 'fr-FR', device: 'mobile', hour: 20, events: [
    { type: 'product', sku: 'OUD-1', text: 'secret' }, { type: 'section', section: 'admin' }, { type: 'search', text: 'عود' }, { type: 'cart', sku: 'OUD-1' },
  ] });
  assert.deepEqual(b, { events: [{ type: 'product', sku: 'OUD-1' }, { type: 'cart', sku: 'OUD-1' }], language: 'fr', device: 'mobile', hour: 20 });
  assert.equal(readPulse({ events: [{ type: 'chat', text: 'x' }] }), undefined);
  assert.equal(pulseId('SA', new Date('2026-10-24T10:00:00Z')), 'SA:2026-10');
  assert.equal(pulseId(undefined, new Date('2026-10-24T10:00:00Z')), 'ZZ:2026-10');
  assert.equal(pulseExpired({ month: '2024-10' }, new Date('2026-10-24')), true);
  assert.equal(pulseExpired({ month: '2025-01' }, new Date('2026-10-24')), false);
});

test("a country's pulse reads its taste, price band, device, peak hour and funnel", () => {
  const yardstick = priceYardstick(PRODUCTS);
  const now = new Date('2026-10-24T12:00:00Z');
  let doc = applyPulse(undefined, { events: Array.from({ length: 20 }, () => ({ type: 'product' as const, sku: 'OUD-1' })), device: 'mobile', hour: 22 }, { id: 'SA:2026-10', product, yardstick });
  doc = applyPulse(doc, { events: [{ type: 'cart', sku: 'OUD-1' }, { type: 'purchase', sku: 'OUD-1' }], device: 'mobile', hour: 22 }, { id: 'SA:2026-10', product, yardstick });
  const fr = applyPulse(undefined, { events: [{ type: 'product', sku: 'FLR-3' }], device: 'desktop', hour: 9 }, { id: 'FR:2026-10', product, yardstick });
  const old = applyPulse(undefined, { events: [{ type: 'product', sku: 'FRS-2' }] }, { id: 'EG:2026-01', product, yardstick });
  assert.equal(JSON.stringify(doc).includes('visitor'), false);
  const countries = pulseCountries([doc, fr, old], now);
  assert.deepEqual(countries.map((c) => c.country), ['SA', 'FR'], 'only the last 3 months');
  const sa = countries[0];
  assert.equal(sa.families[0].id, 'oud');
  assert.equal(sa.prices[0].id, 'premium');
  assert.equal(sa.peakHour, 22);
  assert.deepEqual(sa.funnel, { products: 20, carts: 1, checkouts: 0, purchases: 1 });
  assert.ok(sa.insights.some((l) => /100 مشاهدة/.test(l.ar)));
});

test('the order study counts live paid orders per country, never a refunded or test one', () => {
  const at = '2026-10-20T10:00:00Z';
  const orders = [
    { ref: 'A', mode: 'live', country: 'SA', currency: 'SAR', totalMinor: 1, createdAt: at, lines: [{ sku: 'OUD-1', qty: 2 }] },
    { ref: 'B', mode: 'live', country: 'SA', currency: 'SAR', totalMinor: 1, createdAt: at, lines: [{ sku: 'MSK-4', qty: 1 }] },
    { ref: 'C', mode: 'live', country: 'SA', currency: 'SAR', totalMinor: 1, createdAt: at, lines: [{ sku: 'FRS-2', qty: 1 }] },
    { ref: 'T', mode: 'test', country: 'EG', currency: 'EGP', totalMinor: 1, createdAt: at, lines: [{ sku: 'FRS-2', qty: 1 }] },
  ];
  const entries = [{ kind: 'sale', mode: 'live', orderRef: 'A' }, { kind: 'sale', mode: 'live', orderRef: 'B' }, { kind: 'refund', mode: 'live', orderRef: 'B' }, { kind: 'sale', mode: 'test', orderRef: 'T' }];
  const study = orderStudies(orders, entries, product);
  assert.equal(study.length, 1);
  assert.equal(study[0].country, 'SA');
  assert.equal(study[0].orders, 3);
  assert.equal(study[0].paid, 1);
  assert.equal(study[0].units, 2);
  assert.equal(study[0].products[0].sku, 'OUD-1');
  assert.equal(study[0].families[0].id, 'oud');
});

test('the server: anonymous pulse from the edge country, accepted visitors counted too, the admin sees pulse and orders', async () => {
  const store = new MemoryStore();
  const service = createInsightsService({ store, products: RAW });
  const app = express();
  app.use('/api/insights', service.router);
  app.use('/api/admin/insights', service.admin);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) => fetch(`${base}/insights/${path}`, { method: 'POST', headers: { 'Content-Type': 'text/plain', ...headers }, body: JSON.stringify(body) });
  try {
    const r = await post('pulse', { visitorId: 'v-should-vanish', events: [{ type: 'product', sku: 'OUD-1' }, { type: 'cart', sku: 'OUD-1' }] }, { 'x-vercel-ip-country': 'KW' });
    assert.equal((await r.json() as { counted: boolean }).counted, true);
    await post('events', { visitorId: 'v-accepted-01', consent: INSIGHTS_CONSENT_VERSION, events: [{ type: 'product', sku: 'FLR-3' }, { type: 'search', text: 'ورد' }] }, { 'x-vercel-ip-country': 'KW' });
    assert.equal((await (await post('pulse', { events: [{ type: 'product', sku: 'OUD-1' }] }, { 'user-agent': 'Googlebot/2.1' })).json() as { counted: boolean }).counted, false);
    const docs = await store.list('insightPulse');
    assert.equal(docs.length, 1);
    assert.equal(docs[0].country, 'KW');
    assert.equal(docs[0].funnel.products, 2, 'the anonymous view and the accepted visitor\'s view');
    assert.doesNotMatch(JSON.stringify(docs), /v-should-vanish|v-accepted|ورد/);
    await store.put('financeOrders', 'o1', { id: 'o1', ref: 'R1', provider: 'direct', mode: 'live', country: 'KW', currency: 'KWD', totalMinor: 100, shippingChargedMinor: 0, createdAt: '2026-10-20T00:00:00Z', lines: [{ sku: 'OUD-1', qty: 1, unitMinor: 100 }] });
    await store.put('financeEntries', 'e1', { id: 'e1', kind: 'sale', mode: 'live', currency: 'KWD', amountMinor: 100, orderRef: 'R1', at: '2026-10-20T00:00:00Z', recordedAt: '2026-10-20T00:00:00Z', source: 'direct' });
    const admin = await (await fetch(`${base}/admin/insights`)).json() as { pulse: { country: string }[]; orders: { country: string; paid: number }[] };
    assert.equal(admin.pulse[0].country, 'KW');
    assert.deepEqual(admin.orders.map((o) => [o.country, o.paid]), [['KW', 1]]);
  } finally { await new Promise((done) => server.close(done)); }
});

test('the page sends a pulse only when the visitor has not refused, and the taste memory stays on his device', () => {
  const tracker = readFileSync(new URL('../src/utils/insightsTracker.ts', import.meta.url), 'utf8');
  assert.match(tracker, /return !\(raw && raw\.analytics === false\)/, 'a refusal under any consent text stops the pulse');
  assert.match(tracker, /if \(!pulseAllowed\(\) \|\| insightsAllowed\(\)\) \{ pulseQueue = \[\]; return; \}/);
  assert.match(tracker, /localStorage\.removeItem\(TASTE_KEY\)/, 'withdrawing forgets the taste memory');
  assert.doesNotMatch(tracker.slice(tracker.indexOf('function flushPulse'), tracker.indexOf('export function flushInsights')), /visitorId|accountId|\btext\b/, 'no id or text in a pulse');
  const legal = readFileSync(new URL('../src/components/LegalCenter.tsx', import.meta.url), 'utf8');
  assert.match(legal, /عدّ مجهول الهوية \(نبض الدول\)/);
  assert.match(legal, /دراسة الطلبات/);
});
