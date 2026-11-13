/**
 * «عقل شاهين» — the graph and the immune system, tested on hand-written tables and then on the real files.
 *
 * What these tests protect (the owner's request, 2026-10-26: «الروبوتات دي تكون جسد الترابط وخلايا عصبية»):
 *   · كل عقدة وحافة من ملفات الموقع الحقيقية — مفيش حافة من غير مصدر.
 *   · الشبكة بتوصل الدرس بالدنيا اللي بيتطبق عليها (شركة شحن/وجهة)، والدرجة بتحسب العمق مش بس العدد.
 *   · المناعة بتمسك التناقضات: رقمين لحاجة واحدة، وعد مش مدعوم، رقم بلا مصدر، تعريفة قديمة، وسعر تحت قاعدة التاجر.
 *   · مفيش أي تعديل سعر: المناعة بتقول وتقترح، والسعر قرار صاحب المتجر.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type { FxTable } from '../src/utils/pricing';
import {
  brainScore, buildGraph, explain, findNode, graphStats, isShaheenGraph, neighbours, trace,
  type GraphInput,
} from '../src/utils/shaheenGraph';
import { checkConsistency, type ImmuneInput } from '../scripts/shaheen-synapse/immune';

const root = new URL('..', import.meta.url).pathname;
const read = (rel: string) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
const NOW = Date.parse('2026-10-26T00:00:00Z');

const input = (over: Partial<GraphInput> = {}): GraphInput => ({
  now: NOW,
  products: [
    { sku: 'A-1', nameAr: 'عود ملكي', brand: 'Lattafa', supplierId: 'sham', ourPrice: 1500, supplierPrice: 1000, published: true },
    { sku: 'A-2', nameAr: 'مسك أبيض', brand: 'Afnan', supplierId: 'afnan', ourPrice: 900, supplierPrice: 600, published: true },
  ],
  suppliers: [
    { id: 'sham', nameAr: 'شام بيرفيوم', originCountry: 'MY', products: 200, checkedAt: '2026-10-20' },
    { id: 'afnan', nameAr: 'أفنان', originCountry: 'AE', products: 20, checkedAt: '2026-10-20' },
  ],
  destinations: [
    { code: 'EG', nameAr: 'مصر', costs: { firstItemUsd: 30, extraItemUsd: 5, carrierId: 'poslaju', carrierNameAr: 'بوس لاجو', source: 'https://example.com/rates.pdf', checkedAt: '2026-10-20' }, customs: { verified: true, vatPercent: 14, dutyPercent: [0, 60], deMinimis: null, source: 'https://example.com/customs', checkedAt: '2026-10-20' } },
    { code: 'MY', nameAr: 'ماليزيا', costs: null, customs: null },
  ],
  lessons: [
    { id: 'com-trade-dg', title: 'شحن العطور UN1266', track: 'com', topic: 'com', content: 'العطر مادة خطرة UN1266 وبيتحسب عليه شحن.' },
    { id: 'com-trade-eg', title: 'السوق المصري', track: 'com', topic: 'com', content: 'مصر بتاخد 14% ضريبة قيمة مضافة على الطرد.' },
    { id: 'prog-js', title: 'جافاسكريبت', track: 'prog_langs', topic: 'lang', content: 'لغة ويب.' },
  ],
  specialists: [
    { id: 'specialist_business', nameAr: 'أ. طارق التجارة', tracks: ['com'], sections: ['store'] },
    { id: 'specialist_tech', nameAr: 'م. عمر الحاسوب', tracks: ['prog_langs'] },
  ],
  ...over,
});

test('the graph is built from the real tables: a node per thing, an edge per relation, every edge with a source', () => {
  const g = buildGraph(input());
  assert.ok(isShaheenGraph(g));
  assert.equal(g.score.total >= 0 && g.score.total <= 100, true);
  const ids = new Set(g.nodes.map((n) => n.id));
  for (const id of ['product:A-1', 'brand:Lattafa', 'supplier:sham', 'origin:MY', 'destination:EG', 'carrier:poslaju', 'customs:EG', 'lesson:com-trade-dg', 'specialist:specialist_business', 'section:store']) {
    assert.ok(ids.has(id), `${id} is on the graph`);
  }
  for (const e of g.edges) {
    assert.ok(ids.has(e.from) && ids.has(e.to), `${e.relation} points at real nodes`);
    assert.ok(e.source && e.source.length > 3, `${e.from}->${e.to} cites its source`);
    assert.ok((e.confidence ?? 1) > 0 && (e.confidence ?? 1) <= 1);
  }
});

test('the same input always gives the same graph, in the same order (the published file only moves when the truth moves)', () => {
  const a = buildGraph(input());
  const b = buildGraph(input());
  assert.deepEqual(a.edges, b.edges);
  assert.deepEqual(a.nodes, b.nodes);
});

test('the mind is deterministic about dates: a stale rate card lowers freshness, a fresh one restores it', () => {
  const fresh = buildGraph(input());
  assert.equal(fresh.score.freshness, 10);
  // A world claim with no date at all is not «fresh» either.
  const undated = buildGraph(input({ suppliers: [{ id: 'sham', nameAr: 'شام بيرفيوم', originCountry: 'MY', products: 200 }] }));
  assert.ok(undated.score.freshness < 10, 'an undated edge lowers freshness');
  const stale = buildGraph(input({
    destinations: [{ code: 'EG', nameAr: 'مصر', costs: { firstItemUsd: 30, extraItemUsd: 5, carrierId: 'poslaju', carrierNameAr: 'بوس لاجو', source: 'https://example.com/rates.pdf', checkedAt: '2024-01-01' }, customs: null }],
  }));
  assert.ok(stale.score.freshness < fresh.score.freshness, 'an old rate is not fresh');
  assert.match(stale.score.whyAr, /حافة عالمية/);
});

test('depth: a lesson is only «deep» when it reaches a real destination or carrier', () => {
  const g = buildGraph(input());
  const applied = g.edges.filter((e) => e.relation === 'applies_to');
  assert.ok(applied.length >= 2, 'the UN1266 lesson reaches the carrier, the Egypt lesson reaches the destination');
  assert.ok(applied.some((e) => e.from === 'lesson:com-trade-dg' && e.to === 'carrier:poslaju'));
  assert.ok(applied.some((e) => e.from === 'lesson:com-trade-eg' && e.to === 'destination:EG'));
  assert.ok(g.score.depth > 0, 'the world has some written explanation, so depth is not zero');
  // A lesson that talks about nothing real does not get a fake edge.
  assert.ok(!applied.some((e) => e.from === 'lesson:prog-js'));
});

test('the graph answers questions by walking it, not by keyword search', () => {
  const g = buildGraph(input());
  const chain = trace(g, 'product:A-1', 'destination:EG');
  assert.ok(chain && chain.length >= 3, 'a product reaches a destination');
  const first = chain![0];
  assert.equal(first.node.id, 'product:A-1');
  const hop = neighbours(g, 'destination:EG', 'carried_by');
  assert.equal(hop[0].node.id, 'carrier:poslaju');
  assert.equal(hop[0].edge.weight, 30);
  assert.equal(hop[0].edge.unit, 'USD');
  const lines = explain(g, 'destination:EG', 1);
  assert.ok(lines.some((l) => l.includes('بوس لاجو') && l.includes('example.com')), 'the explanation prints the source');
  assert.ok(findNode(g, 'مصر')?.id === 'destination:EG');
  assert.equal(findNode(g, 'حاجة مش موجودة خالص'), undefined);
});

test('orphans are named, and the score says what is weakest in Arabic', () => {
  const stats = graphStats([{ id: 'lonely', kind: 'topic', labelAr: 'لوحده' }], []);
  assert.deepEqual(stats.orphans, ['lonely']);
  const g = buildGraph(input({ lessons: [] }));
  assert.match(g.score.whyAr, /درس|وجهة|عقدة/);
  const rescored = brainScore(g, NOW);
  assert.equal(rescored.total, g.score.total, 'the stored score is the computed one');
});

test('the immune system catches two numbers for one thing, and names both sources', () => {
  const base: ImmuneInput = {
    now: NOW,
    fx: { base: 'USD', updatedAt: '2026-10-26T00:00:00Z', rates: { USD: 1, EGP: 50 } } as FxTable,
    chargedUsd: { EG: 33 },
    destinationCostEgp: [{ code: 'EG', nameAr: 'مصر', costEgp: [1500, 1700], carrierId: 'poslaju', promise: 'we_ship' }],
    costTable: { currency: 'USD', source: 'rate card', checkedAt: '2026-10-25', countries: { EG: { firstItem: 20, carrier: 'poslaju' } } },
    products: [],
    expectedPrice: (cost) => Math.ceil((cost * 1.5) / 5) * 5,
    promises: [{ code: 'EG', nameAr: 'مصر', promise: 'we_ship' }],
    customs: [],
    carrierChecks: [{ id: 'poslaju', nameAr: 'بوس لاجو', checkedAt: '2026-10-25', source: 'https://example.com' }],
    freeShippingAboveEgp: null,
  };
  const report = checkConsistency(base);
  const clash = report.findings.find((f) => f.kind === 'contradiction');
  assert.ok(clash, '1000 vs 1500 EGP for the same cost is a contradiction');
  assert.equal(clash!.subject, 'EG');
  assert.equal(clash!.sides!.length, 2);
  assert.ok(clash!.sides!.every((s) => s.source.length > 3), 'each side cites its own file');
  assert.match(report.summaryAr, /تعارض/);
});

test('the immune system catches a promise with nothing behind it, and a price below the merchant’s rule', () => {
  const report = checkConsistency({
    now: NOW,
    fx: { base: 'USD', updatedAt: '', rates: { USD: 1, EGP: 50 } } as FxTable,
    chargedUsd: { EG: 33 },
    destinationCostEgp: [{ code: 'EG', nameAr: 'مصر', costEgp: [1000, 1200], carrierId: null, promise: 'we_ship' }],
    costTable: { currency: 'USD', source: '', checkedAt: '2026-10-25', countries: {} },
    products: [{ sku: 'X', nameAr: 'عطر رخيص', ourPrice: 1000, supplierPrice: 1000 }],
    expectedPrice: (cost) => Math.ceil((cost * 1.5) / 5) * 5,
    promises: [{ code: 'EG', nameAr: 'مصر', promise: 'we_ship' }],
    customs: [{ code: 'EG', nameAr: 'مصر', verified: true, vatPercent: 14, source: null, checkedAt: null }],
    carrierChecks: [{ id: 'x', nameAr: 'شركة', checkedAt: '2024-01-01', source: null }],
    freeShippingAboveEgp: 500,
  });
  const kinds = report.findings.map((f) => `${f.kind}:${f.subject}`);
  assert.ok(kinds.includes('promise:EG'), 'we ship there, but no carrier is recorded');
  assert.ok(kinds.includes('contradiction:pricing-rule'), 'a price under cost × 1.5 is a contradiction');
  assert.ok(kinds.includes('untraceable:EG'), '«verified» customs with no source');
  assert.ok(kinds.includes('untraceable:x'), 'a carrier with no source');
  assert.ok(kinds.includes('stale:x'), 'a rate card from 2024 is stale');
  assert.ok(kinds.includes('promise:free-shipping'), 'free shipping is reported, not hidden');
  assert.ok(report.health < 100);
  // It reports, it never edits.
  assert.ok(!('products' in report) && !('fixed' in report));
});

test('the real graph is dated, connected, and agrees with the site’s own files', () => {
  const graph = read('src/data/live/shaheen-graph.json');
  assert.ok(isShaheenGraph(graph), 'the published graph has the right shape');
  assert.match(graph.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  const products = (read('src/data/products.json').products as { published?: boolean; ourPrice?: number; sku: string }[])
    .filter((p) => p.published !== false && Number(p.ourPrice) > 0);
  const trade = read('src/data/live/trade-lanes.json');
  assert.equal(graph.stats.byKind.product, products.length, 'every priced product is a node');
  assert.equal(graph.stats.byKind.destination, trade.destinations.length, 'every destination is a node');
  assert.ok(graph.stats.edges > graph.stats.nodes, 'the graph is denser than its pieces');
  for (const e of graph.edges as { from: string; to: string; source: string }[]) {
    assert.ok(e.source && e.source.length > 3, `${e.from}->${e.to} has a source`);
  }
  const ids = new Set((graph.nodes as { id: string }[]).map((n) => n.id));
  for (const e of graph.edges as { from: string; to: string }[]) assert.ok(ids.has(e.from) && ids.has(e.to));
  assert.ok(graph.score.total > 50 && graph.score.total <= 100, `the mind scores ${graph.score.total}`);
});

test('the specialists answer from the graph: a relation question is planned to «mind_link» and answers with sources', async () => {
  const { planFirstTools, toolOf } = await import('../server/specialists/tools');
  const { SPECIALISTS } = await import('../src/utils/shaheenSpecialists');
  const business = SPECIALISTS.find((x) => x.id === 'specialist_business')!;
  const plan = planFirstTools('ايه علاقة ماليزيا بالشحن لمصر؟', business);
  assert.ok(plan.some((p) => p.tool === 'mind_link'), 'a relation question reaches the graph tool');

  const tool = toolOf('mind_link');
  assert.ok(tool, 'the tool is registered');
  const result = await tool!.run({ about: 'مصر' }, {
    question: 'ايه علاقة ماليزيا بالشحن لمصر؟', lang: 'ar', specialist: business,
    env: {}, fetch: (async () => { throw new Error('offline'); }) as unknown as typeof fetch,
  } as unknown as Parameters<NonNullable<typeof tool>['run']>[1]);
  assert.ok(result?.answer, 'the graph answers');
  assert.match(String(result!.answer), /شبكة عقل شاهين/);
  assert.match(String(result!.answer), /مصر/);
  assert.match(String(result!.answer), /https?:|src\/data|scripts\//, 'the chain prints the source of each hop');
  assert.ok((result!.strength || 0) >= 0.8);
});

test('the real immune report is dated and every finding carries a fix', () => {
  const immune = read('src/data/live/shaheen-immune.json');
  assert.equal(immune.agent, 'immune');
  assert.match(immune.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(immune.findings.every((f: { fixAr: string }) => f.fixAr && f.fixAr.length > 5), 'every finding says how to fix it');
  assert.ok(immune.health >= 0 && immune.health <= 100);
  const graph = read('src/data/live/shaheen-graph.json');
  assert.equal(immune.updatedAt, graph.updatedAt, 'the mind and its immune system are one run');
});
