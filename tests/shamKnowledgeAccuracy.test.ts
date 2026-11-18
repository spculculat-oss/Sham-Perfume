/**
 * Sham Knowledge Accuracy benchmark: business facts are tested separately from general conversation skill.
 * All products/policies here are synthetic or built-in fixtures; no live storefront or customer data is used.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { tools } from '../server/core/tools';
import { assessComprehension } from '../server/core/comprehension';

const freshRepo = () => new Repository(new MemoryStore(), {});

test('Sham Knowledge Accuracy: product lookup returns the stored synthetic price and cites that product', async () => {
  const repo = freshRepo();
  await repo.ready();
  const product = await repo.saveProduct({
    sku: 'QA-001', nameAr: 'عطر العنبر التجريبي', nameEn: 'Benchmark Amber Perfume',
    category: 'perfume', price: 799, currency: 'EGP', stock: 5, unit: '50 ml',
    descriptionAr: 'منتج اصطناعي لاختبار القياس فقط', descriptionEn: 'Synthetic benchmark fixture only',
    tags: ['amber'], active: true,
  });
  const result = await tools.search_catalog.run({ query: 'عطر العنبر التجريبي', limit: 3 }, { repo, env: {} } as never);
  const catalogData = result.data as { products?: Array<{ id: string; price: number; currency: string }> } | undefined;
  const found = catalogData?.products?.find((item) => item.id === product.id);
  assert.equal(found?.price, 799);
  assert.equal(found?.currency, 'EGP');
  assert.ok(result.citations?.some((citation) => citation.id === product.id && citation.kind === 'product'));
});

test('Sham Knowledge Accuracy: seeded service and shipping-policy queries return source citations', async () => {
  const repo = freshRepo();
  await repo.ready();
  const serviceResult = await tools.retrieve_knowledge.run({ query: 'خطوات طلب عطر مخصص والميزانية' }, { repo } as never);
  assert.ok(serviceResult.citations?.some((citation) => citation.id === 'kb-custom'));
  assert.match(serviceResult.observation || '', /الميزانية/);

  const policyResult = await tools.retrieve_knowledge.run({ query: 'سياسة شحن مناطق الشحن' }, { repo } as never);
  assert.ok(policyResult.citations?.some((citation) => citation.id === 'kb-platform-shipping'));
  assert.match(policyResult.observation || '', /الرسوم الجمركية/);
});

test('Sham Knowledge Accuracy: absent facts return no retrieval result and an unsupported price is flagged', async () => {
  const repo = freshRepo();
  await repo.ready();
  const result = await tools.retrieve_knowledge.run({ query: 'zzqvxx blorp quux synthetic unknown fact' }, { repo } as never);
  assert.equal(result.observation, 'NO_RESULTS');
  assert.deepEqual(result.citations, []);

  const verdict = assessComprehension('سعر المنتج كام؟', 'سعره 999 EGP', 'ar', ['QA-001 | سعر موثق: 799 EGP']);
  assert.equal(verdict.hallucinated, true);
  assert.equal(verdict.answersQuestion, false);
});

test('Sham Knowledge Accuracy baseline limitation: a stale knowledge item is still retrievable', async () => {
  const repo = freshRepo();
  await repo.ready();
  await repo.store.put('knowledge', 'kb-benchmark-stale', {
    id: 'kb-benchmark-stale',
    title: 'Old synthetic benchmark policy',
    content: 'Old policy says synthetic returns must be requested within 17 days after receipt.',
    tags: ['benchmark', 'syntheticreturns'],
    updatedAt: '2000-01-01T00:00:00.000Z',
  });
  const result = await tools.retrieve_knowledge.run({ query: 'synthetic returns requested within days' }, { repo } as never);
  const passages = result.data as Array<{ id: string; title: string; text: string }> | undefined;
  const stale = passages?.find((passage) => passage.id === 'kb-benchmark-stale');
  assert.ok(stale, 'current retriever surfaces the stale fixture; record this as a known gap, not a quality success');
  assert.doesNotMatch(JSON.stringify(stale), /updatedAt/);
});
