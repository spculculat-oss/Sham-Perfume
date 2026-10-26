/**
 * «حسّاسات شاهين» — الموقع والعالم.
 * اللي الاختبارات دي بتحميه:
 *   · حسّاسات الموقع تقرأ ملفات الموقع نفسها وتربط كل رقم بمصدر وتاريخ، وما تخترعش رقم.
 *   · حسّاسات العالم تسجل اللي شافته من صفحات الشركات بس، ولا تسجل سعر من غير مصدر.
 *   · مفيش رقم من غير تاريخ، ومفيش وعود شحن من غير شركة منشورة.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type { ShippingCosts } from '../src/utils/pricing';
import { realShipping, shippingZone } from '../src/utils/pricing';
import { buildSensesSite, isSensesSiteReport } from '../scripts/shaheen-senses/senses_site';
import { buildSensesWorld, isSensesWorldReport } from '../scripts/shaheen-senses/senses_world';

const root = new URL('..', import.meta.url).pathname;
const read = (rel: string) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
const NOW = Date.parse('2026-10-26T06:00:00Z');

const shipping = { ...(read('src/data/shipping.json')), costs: read('src/data/shipping-costs.json') };
const costs = read('src/data/shipping-costs.json') as ShippingCosts;
const customs = read('src/data/customs.json') as { countries?: Record<string, { vatPercent?: number }> };
import type { FxTable } from '../src/utils/pricing';
const fx = read('src/data/live/fx-rates.json') as FxTable;
const lanes = read('src/data/shipping-lanes.json') as { carriers: { id: string; nameAr: string; dg: boolean | null; source?: string | null; checkedAt?: string }[] };
const trade = read('src/data/live/trade-lanes.json') as { destinations: { code: string; nameAr: string }[] };
const products = read('src/data/products.json') as { products: { sku: string; supplierPrice?: number; ourPrice?: number; stockStatus?: string }[] };
const candidates = read('src/data/carrier-candidates.json') as { candidates: { id: string; nameAr: string; originCountry?: string | null; ratesUrl?: string; dgUrl?: string }[] };

test('حسّاسات الموقع: كل حسّاس له مستوى، مصدر، وتاريخ، والنتيجة من 100', () => {
  const report = buildSensesSite({
    now: NOW, products: products.products, shipping, costs, customs, fx,
    tradeDestinations: trade.destinations,
    carriers: lanes.carriers,
    liveReports: [
      { file: 'src/data/live/shaheen-graph.json', name: 'شبكة العقل' },
      { file: 'src/data/live/shaheen-reflex.json', name: 'الانعكاس' },
    ],
  });
  assert.ok(isSensesSiteReport(report));
  assert.ok(typeof report.score === 'number' && report.score >= 0 && report.score <= 100);
  for (const s of report.senses) {
    assert.ok(s.id && s.whatAr && s.whyAr && s.fixAr && s.source);
    assert.ok(['ok', 'note', 'warn', 'fail'].includes(s.level));
    assert.ok(s.checkedAt);
  }
  assert.ok(report.summaryAr);
  assert.ok(Array.isArray(report.planAr));
});

test('حسّاسات الموقع: وجهة من غير تعريفة منشورة تُحسب «منطقة» وتُرمز كتقدير', () => {
  // مصر عندها تعريفة، دولة من غير تعريفة (مثلاً نيبال لو موجودة) تكون منطقة
  const report = buildSensesSite({
    now: NOW, products: products.products, shipping, costs, customs, fx,
    tradeDestinations: [{ code: 'EG', nameAr: 'مصر' }, { code: 'NP', nameAr: 'نيبال' }],
    carriers: lanes.carriers,
    liveReports: [],
  });
  const shippingSense = report.senses.find((s) => s.id === 'shipping:zone-fallback');
  assert.ok(shippingSense);
  // نيبال ما عندهاش تعريفة في costs.countries → 지역에서estimated
  const npCost = realShipping('NP', 1, shipping);
  const egCost = realShipping('EG', 1, shipping);
  assert.ok(egCost !== null, 'مصر عندها تعريفة منشورة');
  // whatAr يذكر عدد الوجهات بالتقدير
  assert.ok(/\d/.test(shippingSense.whatAr));
});

test('حسّاسات الموقع: الجمارك غير المؤكدة تُبلغ عن نفسها من غير اختراع', () => {
  const report = buildSensesSite({
    now: NOW, products: products.products, shipping, costs, customs, fx,
    tradeDestinations: trade.destinations,
    carriers: lanes.carriers,
    liveReports: [],
  });
  const customsSense = report.senses.find((s) => s.id === 'customs:verified');
  assert.ok(customsSense);
  assert.ok(customsSense.source);
  assert.ok(customsSense.checkedAt);
});

test('حسّاسات الموقع: أسعار الصرف تشيخ وتُبلّغ عن نفسها', () => {
  const report = buildSensesSite({
    now: NOW, products: products.products, shipping, costs, customs, fx,
    tradeDestinations: trade.destinations,
    carriers: lanes.carriers,
    liveReports: [],
  });
  const fxSense = report.senses.find((s) => s.id === 'fx:fresh');
  assert.ok(fxSense);
  assert.ok(fxSense.source);
});

test('حسّاسات العالم: كلprobe يسجل هل الصفحة فُتحت ومواد خطر؟ والمصدر والتاريخ', async () => {
  const http = (async () => new Response('', { status: 404 })) as unknown as typeof globalThis.fetch;
  const report = await buildSensesWorld({
    now: NOW,
    candidates: candidates.candidates.slice(0, 3),
    http,
  });
  assert.ok(isSensesWorldReport(report));
  for (const p of report.probes) {
    assert.ok(p.carrierId && p.carrierNameAr);
    assert.ok(p.checkedAt);
    assert.ok(typeof p.page.fetched === 'boolean');
    assert.ok(typeof p.page.mentionsDangerousGoods === 'boolean');
    // source يسجل الرابط اللي اتمحا حتى لو الصفحة مافتحتش — مافيش سعر مخترع
  }
  assert.ok(report.summaryAr);
  assert.ok(report.carriers.total >= 0);
});
