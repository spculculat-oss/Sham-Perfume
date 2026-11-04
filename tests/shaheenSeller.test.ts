import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import productsData from '../src/data/products.json';
import catalogFile from '../src/data/live/store-catalog.json';
import { mergeCatalog, type RawProduct, type StoreCatalogFile, type StoreProduct } from '../src/utils/storeCatalog';
import { productLink, scentKey, storeAnswer, withContext } from '../src/utils/shaheenBrain';
import { complementsFor, focusOf, otherSizes, proofLine, saleMove, salesAnswer, shownInOrder, valueLine } from '../src/utils/shaheenSeller';
import { createShaheenRouter } from '../server/shaheen';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { SELLER_UI } from '../src/لغات/sellerL10n';

const PRODUCTS = mergeCatalog((productsData as { products?: RawProduct[] }).products || [], catalogFile as unknown as StoreCatalogFile);
const link = productLink();
/** What an honest merchant never says without data: fake scarcity, countdowns, invented discounts or popularity. */
const PUSHY = /فاضل (?:\d|قطع|حبة)|آخر قطعة|لفترة محدودة|العرض هينتهي|خصم \d|\d+ ?% ?خصم|الناس كلها|الكل بيشتري|الأكثر مبيعاً|only \d+ left|limited time|hurry|best ?seller|everyone is buying|\d+% off/i;
const WISH = 'عايز عطر رجالي شتوي تحت 5000';
const first = storeAnswer(PRODUCTS, withContext(WISH), 'ar', link)!;
const history = [{ role: 'user' as const, text: WISH }, { role: 'assistant' as const, text: first.reply }];
const after = (message: string) => withContext(message, history);

test('he reads the move: a close, a price objection, doubt — and leaves wishes, comparisons and lessons alone', () => {
  for (const q of ['هاخده', 'خلاص هاخده', 'عايز اطلبه', 'ازاي اطلبه؟', 'ضيفه للسلة', 'اطلبهولي', "I'll take it", 'how do I order?']) assert.equal(saleMove(q), 'buy', q);
  for (const q of ['غالي شوية', 'ده مكلف', 'سعره عالي عليا', 'فوق ميزانيتي', 'too expensive']) assert.equal(saleMove(q), 'price', q);
  for (const q of ['مش متأكد', 'محتار بينهم', 'هفكر وارجعلك', 'يستاهل سعره؟', 'not sure']) assert.equal(saleMove(q), 'doubt', q);
  for (const q of ['عايز اشتري عطر هدية', 'هشتري عطر لمراتي', 'انهي فيهم أرخص؟', 'ايه هو المسك', 'رشحلي عطر صيفي', 'شكرا']) assert.equal(saleMove(q), undefined, q);
});

test('the store answer is focused: one main pick with its card, at most two alternatives, one clear next step', () => {
  assert.ok(first.picks.length >= 1 && first.picks.length <= 3);
  assert.match(first.reply, /اختياري الأول ليك/);
  assert.match(first.reply, /الخطوة الجاية/);
  assert.match(first.reply, /شراء مباشر/);
  assert.equal((first.reply.match(/المكونات:/g) || []).length, 1, 'only the main pick carries the full card');
  assert.equal(shownInOrder(first.reply, PRODUCTS)[0].sku, first.picks[0].sku, 'the main pick is the first one shown');
  assert.doesNotMatch(first.reply, PUSHY);
});

test('«هاخده» closes the sale on the main pick: how to order, the real payment methods, then what completes it', () => {
  const sale = salesAnswer(PRODUCTS, after('هاخده'), 'ar', link)!;
  assert.ok(sale, 'the seller answers');
  const main = first.picks[0];
  assert.equal(sale.picks[0].sku, main.sku);
  assert.ok(sale.reply.includes(`/p/${main.slug}.html`), 'the product page');
  assert.match(sale.reply, /شراء مباشر/);
  assert.match(sale.reply, /عند الاستلام/);
  assert.match(sale.reply, /إنستاباي/);
  assert.match(sale.reply, /SH-/);
  assert.match(sale.reply, /يكمّل معاه/);
  assert.match(sale.reply, /اختياري|تكتفي/, 'the extra is optional, never pushed');
  const linked = [...sale.reply.matchAll(/\/p\/([a-z0-9-]+)\.html/g)].map((m) => m[1]);
  assert.ok(linked.some((s) => s !== main.slug), 'a complementary product is offered');
  assert.doesNotMatch(sale.reply, PUSHY);
  const en = salesAnswer(PRODUCTS, after("I'll take it"), 'en', link)!;
  assert.match(en.reply, /Buy now/);
  assert.match(en.reply, /cash on delivery/);
});

test('«غالي» is answered with value and a cheaper road — never with a discount he cannot give', () => {
  const sale = salesAnswer(PRODUCTS, after('غالي شوية'), 'ar', link)!;
  const main = first.picks[0];
  assert.match(sale.reply, /فاهمك/);
  assert.match(sale.reply, /للمل/, 'the price per ml');
  const offered = PRODUCTS.filter((p) => p.sku !== main.sku && sale.reply.includes(`/p/${p.slug}.html`));
  assert.ok(offered.every((p) => p.price < main.price), 'only cheaper options');
  if (!offered.length) assert.match(sale.reply, /مالقيتش/);
  assert.match(sale.reply, /مفيش خصومات بتتقال في المحادثة/);
  assert.doesNotMatch(sale.reply, PUSHY);
  // A named perfume with a smaller bottle of the same scent offers it first.
  const big = PRODUCTS.find((p) => p.inStock && otherSizes(PRODUCTS, p).some((q) => (q.sizeMl || 0) < (p.sizeMl || 0) && q.price < p.price))!;
  assert.ok(big, 'the catalogue has a perfume in two sizes');
  const named = salesAnswer(PRODUCTS, withContext(`${big.name.en} غالي`), 'ar', link);
  assert.ok(named);
});

test('doubt is met with facts, the real return policy of sealed items and one deciding question — no pressure', () => {
  const sale = salesAnswer(PRODUCTS, after('مش متأكد'), 'ar', link)!;
  assert.match(sale.reply, /طبيعي تحتار/);
  assert.match(sale.reply, /مختوم/);
  assert.match(sale.reply, /14 يوم/);
  assert.match(sale.reply, /المفتوح فمبيترجعش/);
  assert.match(sale.reply, /؟/);
  assert.doesNotMatch(sale.reply, PUSHY);
});

test('no product in sight, no sale: the seller steps aside', () => {
  assert.equal(salesAnswer(PRODUCTS, withContext('هاخده'), 'ar', link), undefined);
  assert.equal(salesAnswer(PRODUCTS, after('ايه هو العنبر'), 'ar', link), undefined);
  assert.equal(salesAnswer([], after('هاخده'), 'ar', link), undefined);
  assert.equal(focusOf(PRODUCTS, 'هاخده'), undefined);
});

test('«يكمّل طلبك»: at most three, in stock, never what was bought, within budget, each with an honest reason', () => {
  const sample = PRODUCTS.filter((p) => p.inStock && p.price > 0).filter((_, i) => i % 37 === 0).slice(0, 20);
  let offered = 0;
  for (const p of sample) {
    const extras = complementsFor(PRODUCTS, [p]);
    offered += extras.length;
    assert.ok(extras.length <= 3);
    assert.equal(new Set(extras.map((c) => c.product.sku)).size, extras.length, 'no duplicates');
    for (const c of extras) {
      assert.notEqual(c.product.sku, p.sku);
      assert.ok(c.product.inStock);
      assert.ok(c.product.price <= p.price * 1.3, `${c.product.name.en} within the budget of ${p.name.en}`);
      assert.ok(c.reason.ar.length > 20 && c.reason.en.length > 20);
      assert.doesNotMatch(c.reason.ar + c.reason.en, PUSHY);
      if (c.kind !== 'travel') assert.notEqual(scentKey(c.product), scentKey(p), 'another perfume, not the same one again');
    }
  }
  assert.ok(offered >= sample.length, 'most purchases get something that completes them');
  // The same scent in a travel size, when the store has it.
  const big = PRODUCTS.find((p) => p.inStock && otherSizes(PRODUCTS, p).some((q) => (q.sizeMl || 0) <= 50 && (q.sizeMl || 0) < (p.sizeMl || 0))) as StoreProduct;
  assert.ok(big);
  const travel = complementsFor(PRODUCTS, [big]).find((c) => c.kind === 'travel');
  assert.ok(travel && scentKey(travel.product) === scentKey(big) && (travel.product.sizeMl || 0) < (big.sizeMl || 0));
  assert.deepEqual(complementsFor(PRODUCTS, []), []);
});

test('honest proof and value: no rating claimed without real reviews; sprays said as an approximation', () => {
  const p = first.picks[0];
  assert.equal(proofLine({ ...p, rating: 5, reviewCount: 1 }, 'ar'), '', 'one review is not proof');
  assert.match(proofLine({ ...p, rating: 4.6, reviewCount: 12 }, 'ar'), /4\.6 من 5 من 12/);
  assert.equal(proofLine({ ...p, rating: undefined, reviewCount: 0 }, 'en'), '');
  if (p.sizeMl) assert.match(valueLine(p, 'ar'), /تقريباً \d+ بخة/);
});

test('the store page texts are written in Arabic and English, one line each', () => {
  for (const [key, text] of Object.entries(SELLER_UI)) {
    assert.match(text.ar, /[\u0600-\u06FF]/, key);
    assert.doesNotMatch(text.en, /[\u0600-\u06FF]/, key);
  }
});

test('the server: «هاخده» after a store answer is closed from the catalogue with no platform call', async () => {
  let calls = 0;
  const engine = (async () => { calls++; return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'رد المنصة: نصيحة عامة طويلة كفاية عن العطور.' } }] }), { status: 200, headers: { 'content-type': 'application/json' } }); }) as typeof fetch;
  const app = express();
  app.use(express.json());
  app.use('/api', createShaheenRouter({ repo: new Repository(new MemoryStore(), {}), env: { OPENAI_API_KEY: 'sk-test', SHAM_ANSWER_CACHE_MINUTES: '0' }, fetch: engine, catalog: async () => PRODUCTS }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const chat = (message: string, conversationHistory: { role: string; text: string }[] = []) => fetch(`${base}/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'auto', language: 'ar', conversationHistory, message }),
  });
  try {
    const wish = await (await chat(WISH)).json() as { reply: string };
    const res = await chat('هاخده', [{ role: 'user', text: WISH }, { role: 'assistant', text: wish.reply }]);
    assert.equal(res.status, 200);
    const body = await res.json() as { reply: string; memory: string; store?: { sale?: boolean } };
    assert.equal(body.memory, 'store');
    assert.equal(body.store?.sale, true);
    assert.match(body.reply, /شراء مباشر/);
    assert.match(body.reply, /يكمّل معاه/);
    assert.equal(calls, 0, 'no platform asked');
  } finally { await new Promise((done) => server.close(done)); }
});
