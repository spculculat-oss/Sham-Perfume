/**
 * «كشّاف الشحن» — the two promises, tested:
 *   · كل خطأ في تسعير الشحن بيتلقّط (وجهة من غير تعريفة، تعريفة قديمة، شركة من غير مصدر، قبول العطور مش متأكد).
 *   · مفيش سعر بيتحسب لشركة من غير تعريفة + مصدر + تاريخ + قبول مؤكد للعطور (UN1266).
 * الاختبار بيشغّل الدالة النقية على طاولات مكتوبة بالإيد، وبعدين بيتأكد إن تقرير الملفات الحقيقية سليم.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type { FxTable, ShippingCosts, ShippingTable } from '../src/utils/pricing';
import { isCarrierScoutReport, scoutCarriers, type CarrierCandidate, type CurrentCarrier } from '../scripts/shaheen-carriers/scout';

const root = new URL('..', import.meta.url).pathname;
const read = (rel: string) => JSON.parse(readFileSync(join(root, rel), 'utf8'));

const FX: FxTable = { base: 'USD', updatedAt: '2026-10-26T00:00:00Z', rates: { USD: 1, EGP: 50, MYR: 4.5 } };
const SHIP: ShippingTable = {
  currency: 'USD',
  zones: [{ id: 'gulf', name: { ar: 'الخليج', en: 'Gulf' }, countries: ['SA', 'AE'], firstItem: 14, extraItem: 3 }],
  default: { id: 'world', name: { ar: 'العالم', en: 'World' }, firstItem: 28, extraItem: 6 },
  handling: { percent: 10, capUsd: 5 },
  netMarginPercent: 50,
};
const COSTS: ShippingCosts = {
  version: 1, currency: 'USD', source: 'rate card', checkedAt: '2026-10-25',
  countries: { SA: { firstItem: 30, extraItem: 5, carrier: 'poslaju' } },
};
const NOW = Date.parse('2026-10-26T00:00:00Z');

const poslaju: CurrentCarrier = {
  id: 'poslaju', nameAr: 'بوس لاجو', dg: null, source: 'https://example.com/rates.pdf', checkedAt: '2026-10-25', scope: 'international',
};
const destinations = [{ code: 'SA', nameAr: 'السعودية' }, { code: 'MY', nameAr: 'ماليزيا' }];

const candidate = (over: Partial<CarrierCandidate> = {}): CarrierCandidate => ({
  id: 'dhl', nameAr: 'DHL', originCountry: 'MY', scope: 'international',
  ratesUrl: 'https://www.dhl.com/my-en/home.html', dg: true,
  rates: { currency: 'USD', perCountry: { SA: [20, 4] }, surchargePercent: 0, source: 'https://example.com/dhl.pdf', checkedAt: '2026-10-20' },
  ...over,
});

const run = (over: Partial<Parameters<typeof scoutCarriers>[0]> = {}) => scoutCarriers({
  now: NOW, costs: COSTS, destinations, carriers: [poslaju], candidates: [], shipping: SHIP, fx: FX, ...over,
});

test('a destination with no published rate is an error, not a quiet fallback', () => {
  const report = run();
  assert.deepEqual(report.coverage.uncovered.map((u) => u.code), ['MY']);
  assert.equal(report.coverage.priced, 1);
  const err = report.errors.find((e) => e.kind === 'no_rate');
  assert.ok(err, 'the gap is reported');
  assert.equal(err!.level, 'warn');
  assert.match(err!.whatAr, /ماليزيا/);
  assert.match(err!.fixAr, /shipping-lanes\.json/);
});

test('an unknown dangerous-goods answer is «مش متأكد», never «مقبول» — and it is one error per carrier', () => {
  const report = run();
  const dg = report.errors.filter((e) => e.kind === 'dg_unknown');
  assert.equal(dg.length, 1, 'one error for the carrier, not one per destination');
  assert.match(dg[0].whatAr, /UN1266/);
  assert.equal(report.carriersInUse.find((c) => c.id === 'poslaju')!.destinations, 1);
});

test('a carrier that refuses perfume is flagged, and its rate cannot be used', () => {
  const refusing = candidate({ dg: false });
  const report = run({ carriers: [{ ...poslaju, dg: false }], candidates: [refusing] });
  assert.ok(report.errors.some((e) => e.kind === 'dg_refused'));
  assert.equal(report.candidates[0].state, 'unverified');
  assert.equal(report.savings.rows.length, 0, 'a refusal is never a price');
});

test('a stale rate and a rate with no source are both errors', () => {
  const old = run({ carriers: [{ ...poslaju, checkedAt: '2025-01-01' }] });
  assert.ok(old.errors.some((e) => e.kind === 'stale_rate' && /365|يوم/.test(e.whatAr)));
  const noSource = run({ carriers: [{ ...poslaju, source: null }] });
  assert.ok(noSource.errors.some((e) => e.kind === 'no_source'));
  const noHandling = run({ shipping: { ...SHIP, handling: undefined } });
  assert.ok(noHandling.errors.some((e) => e.kind === 'no_handling'));
});

test('a verified cheaper carrier is compared per destination, and the saving is real arithmetic', () => {
  const report = run({ candidates: [candidate()] });
  const verdict = report.candidates[0];
  assert.equal(verdict.state, 'verified');
  assert.equal(verdict.beatsCurrent, 1);
  const row = report.savings.rows.find((r) => r.code === 'SA')!;
  assert.equal(row.currentEgp, 1500, '30 USD × 50');
  assert.equal(row.candidateEgp, 1000, '20 USD × 50');
  assert.equal(row.savingEgp, 500);
  assert.equal(row.savingPercent, 33.3);
  assert.equal(report.savings.bestEgp, 500);
  assert.match(report.planAr.join(' '), /القرار لصاحب المتجر/);
});

test('no rate, no source, no date → no price: the candidate stays unverified and saves nothing', () => {
  const noRates = run({ candidates: [candidate({ rates: null })] });
  assert.equal(noRates.candidates[0].state, 'unverified');
  assert.equal(noRates.savings.rows.length, 0);
  assert.ok(noRates.errors.some((e) => e.kind === 'candidate_untested'));

  const noSource = run({ candidates: [candidate({ rates: { currency: 'USD', perCountry: { SA: [1, 1] }, source: '', checkedAt: '2026-10-20' } })] });
  assert.equal(noSource.candidates[0].state, 'unverified');
  assert.equal(noSource.savings.rows.length, 0);

  const noDate = run({ candidates: [candidate({ rates: { currency: 'USD', perCountry: { SA: [1, 1] }, source: 'https://x', checkedAt: 'غير معروف' } })] });
  assert.equal(noDate.candidates[0].state, 'unverified');
});

test('a candidate with no real URL is rejected outright', () => {
  const report = run({ candidates: [candidate({ ratesUrl: '' })] });
  assert.equal(report.candidates[0].state, 'rejected');
  assert.ok(report.errors.some((e) => e.kind === 'candidate_no_source'));
});

test('the score drops with real coverage and safety problems, and rises when they are fixed', () => {
  const clean: ShippingCosts = { ...COSTS, countries: { ...COSTS.countries, MY: { firstItem: 3, extraItem: 1, carrier: 'poslaju' } } };
  const bad = run().score;
  const good = run({ costs: clean, carriers: [{ ...poslaju, dg: true }] }).score;
  assert.ok(bad < good, `bad ${bad} should be below good ${good}`);
  assert.ok(good >= 90, `a clean picture scores high (${good})`);
});

test('the real report is dated, counted, and honest about what it does not know', () => {
  const report = read('src/data/live/carrier-scout.json');
  assert.ok(isCarrierScoutReport(report), 'the published report has the right shape');
  assert.match(report.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  const trade = read('src/data/live/trade-lanes.json');
  assert.equal(report.coverage.destinations, trade.destinations.length, 'every destination we sell to is reviewed');
  assert.ok(report.coverage.priced > 0);
  for (const c of report.candidates) {
    assert.ok(['verified', 'unverified', 'rejected'].includes(c.state));
    assert.ok(/^https:\/\//.test(c.ratesUrl), `${c.id} cites a real page`);
  }
  for (const row of report.savings.rows) {
    assert.ok(row.savingEgp > 0, 'only real savings are listed');
    assert.ok(row.currentEgp !== null && row.candidateEgp > 0);
  }
  assert.ok(report.notesAr.some((n: string) => n.includes('مايغيّرش أي سعر')), 'the report says it never changes a price');
});

test('the candidate registry is real pages only — and no candidate claims a verified rate it does not have', () => {
  const file = read('src/data/carrier-candidates.json') as { candidates: CarrierCandidate[] };
  assert.ok(file.candidates.length >= 4);
  for (const c of file.candidates) {
    assert.match(c.ratesUrl, /^https:\/\//, `${c.id}: a real rate page`);
    assert.ok(['MY', 'AE', 'EG'].includes(c.originCountry), `${c.id}: one of our real stock countries`);
    if (c.rates) assert.match(String(c.rates.source), /^https:\/\//, `${c.id}: a recorded rate must cite its source`);
    if (c.rates) assert.equal(c.dg, true, `${c.id}: a rate is only usable for perfume when the carrier accepts it`);
  }
});
