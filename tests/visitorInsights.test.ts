/**
 * «خزنة فهم الزوار»: visitors' interactions recorded and analysed for the administration only — with consent,
 * never a key, password or card number, contact data masked, erasable on request.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { MemoryStore } from '../server/core/store';
import { createInsightsService } from '../server/insights';
import { mergeCatalog, type RawProduct } from '../src/utils/storeCatalog';
import {
  INSIGHTS_CONSENT_VERSION, applyBatch, countryCultures, expired, insightsSummary, priceYardstick, readBatch, readPerson, scrubText, type InsightBatch,
} from '../src/utils/visitorInsights';

const RAW: RawProduct[] = [
  { id: 1, sku: 'OUD-1', nameAr: 'عود ملكي', nameEn: 'Royal Oud', descriptionAr: 'عود شرقي فاخر للسهرات', descriptionEn: '', category: 'عود', brand: 'Sham', supplierPrice: 1000, ourPrice: 3000, stockStatus: 'in_stock', imageUrl: '', createdAt: '2026-09-01' },
  { id: 2, sku: 'FRS-2', nameAr: 'نسيم البحر', nameEn: 'Sea Breeze', descriptionAr: 'عطر منعش للصيف', descriptionEn: 'Fresh summer scent', category: 'رجالي', brand: 'Sham', supplierPrice: 200, ourPrice: 400, stockStatus: 'in_stock', imageUrl: '', createdAt: '2026-09-01' },
  { id: 3, sku: 'FLR-3', nameAr: 'ورد الياسمين', nameEn: 'Jasmine Rose', descriptionAr: 'عطر نسائي زهري بالورد والياسمين', descriptionEn: '', category: 'نسائي', brand: 'Sham', supplierPrice: 400, ourPrice: 900, stockStatus: 'in_stock', imageUrl: '', createdAt: '2026-09-01' },
  { id: 4, sku: 'MSK-4', nameAr: 'مسك أبيض', nameEn: 'White Musk', descriptionAr: 'مسك ناعم', descriptionEn: '', category: 'مختلط', brand: 'Sham', supplierPrice: 300, ourPrice: 600, stockStatus: 'in_stock', imageUrl: '', createdAt: '2026-09-01' },
];
const PRODUCTS = mergeCatalog(RAW);
const bySku = new Map(PRODUCTS.map((p) => [p.sku, p]));
const batch = (events: InsightBatch['events'], extra: Partial<InsightBatch> = {}): InsightBatch => ({ visitorId: 'v-test-visitor-1', consent: INSIGHTS_CONSENT_VERSION, events, ...extra });

test('nothing is recorded without consent to the current text, and secrets or contact data never get in', () => {
  assert.equal(readBatch({ visitorId: 'v-test-visitor-1', consent: '1.0', events: [{ type: 'section', section: 'store' }] }), undefined, 'an older consent text');
  assert.equal(readBatch({ visitorId: 'bad id!', consent: INSIGHTS_CONSENT_VERSION, events: [{ type: 'section', section: 'store' }] }), undefined);
  assert.equal(readBatch({ visitorId: 'v-test-visitor-1', consent: INSIGHTS_CONSENT_VERSION, events: [] }), undefined);
  const b = readBatch({
    visitorId: 'v-test-visitor-1', consent: INSIGHTS_CONSENT_VERSION, country: 'SA', language: 'ar', device: 'mobile', hour: 21,
    events: [
      { type: 'chat', text: 'كلمة السر بتاعتي هي 12345 ابعتلي الطلب' },
      { type: 'chat', text: 'my api key is sk-abc123' },
      { type: 'search', text: 'عايز عود، كلمني على 01012345678 أو ahmed@example.com' },
      { type: 'chat', text: 'ادفع بالكارت 4111 1111 1111 1111؟' },
      { type: 'hack', text: 'x' },
    ],
  });
  assert.ok(b);
  const json = JSON.stringify(b);
  for (const leak of [/12345/, /sk-abc/, /01012345678/, /ahmed@example/, /4111/, /كلمة السر/]) assert.doesNotMatch(json, leak);
  assert.equal(b!.events.length, 4, 'unknown event types are dropped');
  assert.equal(b!.events[0].value, 'secret-dropped');
  assert.match(b!.events[2].text || '', /عايز عود/);
  assert.equal(scrubText('موبايلي ٠١٠١٢٣٤٥٦٧٨'), 'موبايلي [رقم]');
});

test('a profile learns tastes, price comfort, the buying journey and how he talks', () => {
  const now = new Date('2026-10-24T20:00:00Z');
  let p = applyBatch(undefined, batch([
    { type: 'section', section: 'store' },
    { type: 'product', sku: 'OUD-1' }, { type: 'product', sku: 'OUD-1' }, { type: 'product', sku: 'OUD-1' },
    { type: 'chat', text: 'عايز هدية لمراتي في عيد جوازنا، إيه أحسن عود؟' },
    { type: 'cart', sku: 'OUD-1', qty: 1 },
  ], { country: 'SA', language: 'ar', device: 'mobile', hour: 22 }), { now, edgeCountry: 'SA', product: (s) => bySku.get(s) });
  p = applyBatch(p, batch([{ type: 'checkout' }, { type: 'purchase', sku: 'OUD-1', qty: 1 }]), { now: new Date('2026-10-26T20:00:00Z'), product: (s) => bySku.get(s) });
  assert.equal(p.edgeCountry, 'SA');
  assert.equal(p.days.length, 2);
  assert.ok((p.families.oud || 0) > 0);
  assert.deepEqual(p.funnel, { products: 3, carts: 1, checkouts: 1, purchases: 1 });
  assert.equal(p.motives.gift, 1);
  assert.equal(p.recipients.wife, 1);
  const r = readPerson(p, priceYardstick(PRODUCTS));
  assert.equal(r.decision, 'buyer');
  assert.equal(r.price, 'premium');
  assert.equal(r.motive, 'gift');
  assert.equal(r.rhythm, 'evening');
  assert.ok(r.temperament.length >= 1);
  assert.ok(r.approach.some((a) => /هدية/.test(a.ar)));
  assert.ok(r.approach.every((a) => !/خصم حصري|آخر قطعة|الكمية محدودة/.test(a.ar)), 'no pressure tactics');
});

test('countries get a culture reading, and a year-idle record expires', () => {
  const now = new Date('2026-10-24T12:00:00Z');
  const mk = (id: string, country: string, skus: string[], text?: string) => applyBatch(undefined, {
    ...batch([...skus.map((sku) => ({ type: 'product' as const, sku })), ...(text ? [{ type: 'search' as const, text }] : [])], { country, hour: 21 }), visitorId: id,
  }, { now, edgeCountry: country, product: (s) => bySku.get(s) });
  const profiles = [mk('v-sa-000001', 'SA', ['OUD-1', 'OUD-1'], 'هدية عود لأبويا'), mk('v-sa-000002', 'SA', ['OUD-1'], 'عود فاخر'), mk('v-fr-000001', 'FR', ['FLR-3', 'MSK-4'], 'parfum floral')];
  const cultures = countryCultures(profiles, priceYardstick(PRODUCTS));
  assert.equal(cultures[0].country, 'SA');
  assert.equal(cultures[0].families[0].id, 'oud');
  assert.ok(cultures[0].insights.some((l) => /عود/.test(l.ar)));
  assert.ok(cultures[0].words.some((w) => w.word === 'هدية' || w.word === 'فاخر'));
  const summary = insightsSummary(profiles, PRODUCTS, now);
  assert.equal(summary.profiles, 3);
  assert.equal(summary.countries.length, 2);
  const old = { ...profiles[0], lastSeen: '2025-01-01T00:00:00Z' };
  assert.equal(expired(old, now), true);
  assert.equal(insightsSummary([old], PRODUCTS, now).profiles, 0);
});

test('the server: consent-only recording, the entry country from the edge, erase on withdrawal, admin-only reading', async () => {
  const store = new MemoryStore();
  const service = createInsightsService({ store, products: RAW });
  const app = express();
  app.use(express.json());
  app.use('/api/insights', service.router);
  app.use('/api/admin/insights', service.admin);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  try {
    const post = (body: unknown, headers: Record<string, string> = {}) => fetch(`${base}/insights/events`, { method: 'POST', headers: { 'Content-Type': 'text/plain', ...headers }, body: JSON.stringify(body) });
    const ok = await post({ visitorId: 'v-server-0001', consent: INSIGHTS_CONSENT_VERSION, language: 'ar', events: [{ type: 'product', sku: 'FRS-2' }, { type: 'search', text: 'عطر صيفي، إيميلي a@b.com' }, { type: 'section', section: 'admin' }] }, { 'x-vercel-ip-country': 'AE' });
    assert.equal(ok.status, 202);
    assert.equal((await ok.json() as { recorded: boolean }).recorded, true);
    const stored = await store.get('insightProfiles', 'v-server-0001');
    assert.equal(stored?.edgeCountry, 'AE');
    assert.doesNotMatch(JSON.stringify(stored), /a@b\.com|"admin"/);
    assert.equal((await (await post({ visitorId: 'v-server-0002', consent: '1.0', events: [{ type: 'section', section: 'store' }] })).json() as { recorded: boolean }).recorded, false, 'no consent, no record');
    assert.equal((await (await post({ visitorId: 'v-server-0003', consent: INSIGHTS_CONSENT_VERSION, events: [{ type: 'section', section: 'store' }] }, { 'user-agent': 'Googlebot/2.1' })).json() as { recorded: boolean }).recorded, false, 'crawlers are not people');
    const summary = await (await fetch(`${base}/admin/insights`)).json() as { summary: { profiles: number; countries: { country: string }[] }; storage: { persistent: boolean } };
    assert.equal(summary.summary.profiles, 1);
    assert.equal(summary.summary.countries[0].country, 'AE');
    assert.equal(summary.storage.persistent, false);
    const person = await (await fetch(`${base}/admin/insights/profiles/v-server-0001`)).json() as { reading: { decision: string } };
    assert.ok(person.reading.decision);
    const gone = await (await fetch(`${base}/insights/me?visitorId=v-server-0001`, { method: 'DELETE' })).json() as { deleted: boolean };
    assert.equal(gone.deleted, true);
    assert.equal(await store.get('insightProfiles', 'v-server-0001'), undefined, 'withdrawal erases the record');
  } finally { await new Promise((done) => server.close(done)); }
});

test('the admin routes sit behind the admin token, and the privacy texts say what is studied', async () => {
  const { readFileSync } = await import('node:fs');
  const http = readFileSync(new URL('../server/core/http.ts', import.meta.url), 'utf8');
  assert.match(http, /admin\.use\('\/insights', insights\.admin\)/, 'mounted on the token-checked admin router');
  const legal = readFileSync(new URL('../src/components/LegalCenter.tsx', import.meta.url), 'utf8');
  assert.match(legal, /تحليل التفاعل \(بموافقتك\)/);
  const consent = readFileSync(new URL('../src/components/CookieConsent.tsx', import.meta.url), 'utf8');
  assert.match(consent, /CONSENT_VERSION = INSIGHTS_CONSENT_VERSION/, 'the visitor is asked again under the new text');
  const handbook = readFileSync(new URL('../src/utils/botHandbook.ts', import.meta.url), 'utf8');
  assert.match(handbook, /خزنة فهم الزوار/);
  assert.match(handbook, /ممنوع كتابة أو طباعة أي مفتاح أو سر أو كلمة سر/);
});
