/**
 * «اختبار ذوقك» and the lessons taken lawfully from how Facebook learns: what the visitor says about himself
 * (zero-party data), how deeply he looks, people-like-you, and page tests — all consent-gated, nothing covert.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { MemoryStore } from '../server/core/store';
import { createInsightsService } from '../server/insights';
import { mergeCatalog, type RawProduct } from '../src/utils/storeCatalog';
import { QUIZ, hasTaste, rankForTaste, tasteFromAnswers, tasteLine, tasteScore, withViewed } from '../src/utils/tasteQuiz';
import { EXPERIMENTS, bucket, variantOf } from '../src/utils/experiments';
import {
  INSIGHTS_CONSENT_VERSION, applyBatch, experimentResults, insightsSummary, readBatch, togetherIndex, type InsightBatch, type InsightProfile,
} from '../src/utils/visitorInsights';

const RAW: RawProduct[] = [
  { id: 1, sku: 'OUD-1', nameAr: 'عود ملكي', nameEn: 'Royal Oud', descriptionAr: 'عود شرقي للسهرات', descriptionEn: '', category: 'عود', brand: 'Sham', supplierPrice: 1000, ourPrice: 3000, stockStatus: 'in_stock', imageUrl: '', createdAt: '2026-09-01' },
  { id: 2, sku: 'FRS-2', nameAr: 'نسيم البحر', nameEn: 'Sea Breeze', descriptionAr: 'عطر منعش للصيف', descriptionEn: 'Fresh summer scent', category: 'رجالي', brand: 'Sham', supplierPrice: 200, ourPrice: 400, stockStatus: 'in_stock', imageUrl: '', createdAt: '2026-09-01' },
  { id: 3, sku: 'FLR-3', nameAr: 'ورد الياسمين', nameEn: 'Jasmine Rose', descriptionAr: 'عطر نسائي زهري بالورد والياسمين', descriptionEn: '', category: 'نسائي', brand: 'Sham', supplierPrice: 400, ourPrice: 900, stockStatus: 'in_stock', imageUrl: '', createdAt: '2026-09-01' },
  { id: 4, sku: 'MSK-4', nameAr: 'مسك أبيض', nameEn: 'White Musk', descriptionAr: 'مسك ناعم', descriptionEn: '', category: 'مختلط', brand: 'Sham', supplierPrice: 300, ourPrice: 600, stockStatus: 'in_stock', imageUrl: '', createdAt: '2026-09-01' },
];
const PRODUCTS = mergeCatalog(RAW);
const bySku = new Map(PRODUCTS.map((p) => [p.sku, p]));
const yardstick = { low: 500, high: 2000 };
const NOW = new Date('2026-10-25T12:00:00Z');
const batch = (visitorId: string, events: InsightBatch['events']): InsightBatch => ({ visitorId, consent: INSIGHTS_CONSENT_VERSION, events });

test('the quiz: every question has options, the answers become a taste, and the store is sorted by it', () => {
  assert.equal(QUIZ.length, 5);
  for (const q of QUIZ) {
    assert.ok(q.options.length >= 2, q.kind);
    for (const o of q.options) assert.ok(o.label.ar && o.label.en, `${q.kind}:${o.id}`);
  }
  assert.equal(hasTaste(tasteFromAnswers({})), false, 'skipping everything is no taste');
  const taste = tasteFromAnswers({ gender: ['women'], family: ['floral'], occasion: ['evening'], season: ['all'], price: ['any'] });
  assert.equal(taste.gender, 'women');
  assert.equal(taste.price, undefined, '«مش فارقة» sets no price band');
  assert.equal(taste.families.floral, 3, 'the family he picked weighs most');
  assert.ok(hasTaste(taste));
  const ranked = rankForTaste(PRODUCTS, taste, yardstick);
  assert.equal(ranked[0].sku, 'FLR-3');
  assert.ok(tasteScore(bySku.get('FLR-3')!, taste, yardstick) > tasteScore(bySku.get('OUD-1')!, taste, yardstick));
  assert.equal(ranked.length, PRODUCTS.length, 'sorting hides nothing');
  // An invented answer is ignored, not trusted.
  assert.equal(tasteFromAnswers({ gender: ['robot'] }).gender, undefined);
  // What he opened adds lightly to what he said.
  const seen = withViewed(tasteFromAnswers({}), [bySku.get('OUD-1')!]);
  assert.ok(Object.values(seen.families).every((n) => (n || 0) <= 1));
  // The taste line is in the visitor's language.
  const ar = tasteLine(taste, (x) => x.ar);
  const en = tasteLine(taste, (x) => x.en);
  assert.match(ar, /نسائي/);
  assert.doesNotMatch(en, /[\u0600-\u06FF]/);
});

test('page tests: the split is stable, even, and the control is shown without consent', () => {
  for (const id of ['v-abc-12345', 'v-xyz-98765', 'visitor-0001']) {
    assert.equal(bucket(`${id}:quiz_prompt`, 2), bucket(`${id}:quiz_prompt`, 2), 'the same visitor always sees the same version');
  }
  const counts = [0, 0];
  for (let i = 0; i < 2000; i++) counts[bucket(`v-visitor-${i}:quiz_prompt`, 2)]++;
  assert.ok(Math.abs(counts[0] - counts[1]) < 200, `an even split (${counts})`);
  assert.equal(variantOf('quiz_prompt'), EXPERIMENTS.quiz_prompt[0], 'no browser, no consent → control');
});

test('the vault learns declared taste, reading depth and test versions — and only from consenting visitors', () => {
  assert.equal(readBatch({ visitorId: 'v-quiz-0001', consent: '1.0', events: [{ type: 'quiz', value: 'family:oud' }] }), undefined);
  const b = readBatch({
    visitorId: 'v-quiz-0001', consent: INSIGHTS_CONSENT_VERSION,
    events: [{ type: 'quiz', value: 'family:oud' }, { type: 'quiz', value: 'gender:men' }, { type: 'engage', sku: 'OUD-1', value: 'dwell:45' }, { type: 'engage', sku: 'OUD-1', value: 'scroll:80' }, { type: 'engage', sku: 'OUD-1', value: 'zoom:1' }, { type: 'exp', value: 'quiz_prompt:chip' }, { type: 'quiz', value: 'free text with spaces' }],
  });
  assert.ok(b);
  assert.equal(b.events.length, 7);
  assert.equal(b.events[6].value, undefined, 'only short codes are kept, never free text');
  const p = applyBatch(undefined, b, { now: NOW, product: (s) => bySku.get(s) });
  assert.equal(p.declared?.['family:oud'], 1);
  assert.ok((p.families.oud || 0) >= 4, 'what he says outweighs a glance');
  assert.deepEqual(p.engagement, { dwellSec: 45, views: 1, deep: 1, zooms: 1 });
  assert.equal(p.experiments?.quiz_prompt, 'chip');
  const again = applyBatch(p, batch('v-quiz-0001', [{ type: 'exp', value: 'quiz_prompt:card' }, { type: 'engage', sku: 'OUD-1', value: 'dwell:99999' }]), { now: NOW, product: (s) => bySku.get(s) });
  assert.equal(again.experiments?.quiz_prompt, 'chip', 'a visitor stays in his first version');
  assert.equal(again.engagement?.dwellSec, 45 + 900, 'one view counts at most 15 minutes');
  const s = insightsSummary([again], PRODUCTS, NOW);
  assert.equal(s.engagement.quizTakers, 1);
  assert.equal(s.engagement.zoomers, 1);
  assert.ok(s.engagement.declared.some((d) => d.id === 'family:oud'));
});

test('test results call no winner on a small sample', () => {
  const mk = (i: number, version: string, bought: boolean) => {
    const events: InsightBatch['events'] = [{ type: 'exp', value: `quiz_prompt:${version}` }, { type: 'product', sku: 'OUD-1' }];
    if (bought) events.push({ type: 'cart', sku: 'OUD-1' }, { type: 'purchase', sku: 'OUD-1', qty: 1 });
    return applyBatch(undefined, batch(`v-exp-${String(i).padStart(4, '0')}`, events), { now: NOW, product: (s) => bySku.get(s) });
  };
  const few = [mk(1, 'card', true), mk(2, 'chip', false), mk(3, 'chip', false)];
  const [r] = experimentResults(few);
  assert.equal(r.test, 'quiz_prompt');
  assert.equal(r.enough, false);
  assert.equal(r.leader, undefined);
  const many: InsightProfile[] = [];
  for (let i = 0; i < 30; i++) many.push(mk(100 + i, 'card', i < 6), mk(200 + i, 'chip', i < 12));
  const [big] = experimentResults(many);
  assert.equal(big.enough, true);
  assert.equal(big.leader, 'chip');
  assert.equal(big.versions.find((v) => v.version === 'chip')?.buyRate, 40);
});

test('«ناس ذوقهم زيك شافوا كمان»: a pair is shown only when 3 or more different people share it', () => {
  const viewer = (id: string, skus: string[]) => applyBatch(undefined, batch(id, skus.map((sku) => ({ type: 'product' as const, sku }))), { now: NOW, product: (s) => bySku.get(s) });
  const two = [viewer('v-tog-0001', ['OUD-1', 'MSK-4']), viewer('v-tog-0002', ['OUD-1', 'MSK-4'])];
  assert.equal(togetherIndex(two).get('OUD-1'), undefined, 'two people could be recognised — nothing is shown');
  const three = [...two, viewer('v-tog-0003', ['OUD-1', 'MSK-4', 'FRS-2'])];
  assert.deepEqual(togetherIndex(three).get('OUD-1'), ['MSK-4']);
  assert.equal(togetherIndex(three).get('FRS-2'), undefined);
});

test('the /together route answers product codes only, and rejects a bad code', async () => {
  const store = new MemoryStore();
  for (const id of ['v-route-0001', 'v-route-0002', 'v-route-0003']) {
    await store.put('insightProfiles', id, applyBatch(undefined, batch(id, [{ type: 'product', sku: 'FLR-3' }, { type: 'product', sku: 'MSK-4' }]), { now: new Date(), product: (s) => bySku.get(s) }));
  }
  const service = createInsightsService({ store, products: RAW });
  const app = express();
  app.use('/api/insights', service.router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/insights`;
  try {
    const bad = await fetch(`${base}/together?sku=${encodeURIComponent('<script>')}`);
    assert.equal(bad.status, 400);
    assert.equal((await bad.json() as { code: string }).code, 'INVALID_SKU');
    const res = await fetch(`${base}/together?sku=FLR-3`);
    assert.equal(res.status, 200);
    const body = await res.json() as Record<string, unknown>;
    assert.deepEqual(body, { sku: 'FLR-3', skus: ['MSK-4'] });
    assert.doesNotMatch(JSON.stringify(body), /v-route/, 'no visitor id ever leaves');
    assert.deepEqual((await (await fetch(`${base}/together?sku=OUD-1`)).json() as { skus: string[] }).skus, []);
  } finally { await new Promise((done) => server.close(done)); }
});
