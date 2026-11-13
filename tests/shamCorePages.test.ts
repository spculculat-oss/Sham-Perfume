/**
 * «كل صفحة ردها منطقي» — المساعد بيتدرّب على صفحات الموقع كلها، مش على المتجر بس.
 *
 *  1. كل تبويب في `src/App.tsx` له دليل في `server/core/pageGuide.ts` وأسئلة واقعية.
 *  2. سؤال عام («إيه أسعار المنتجات؟») على أي صفحة ياخد نطاق السعر الحقيقي وأمثلة على طوله،
 *     ومستحيل يقول «مفيش منتجات» والمتجر فيه منتجات.
 *  3. على صفحة منتج، الرد بيتكلم عن المنتج المفتوح هو، بسعره الحقيقي.
 *  4. على صفحة أداة، الرد بيخص الأداة ومعاه زر يفتحها؛ وعلى صفحات شاهين بيسميه بالاسم.
 *  5. «إزاي أحفظ التركيبة؟» سؤال شرح، مش طلب شراء — حتى لو فيه كلمة بتفتح استمارة.
 *  6. نفس المراجعة اللي في لوحة الإدارة لازم تطلع 100 على متجر نظيف ومن غير أي مفتاح ذكاء اصطناعي.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Orchestrator } from '../server/core/orchestrator';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { PAGES, pageFeature, pageGuide } from '../server/core/pageGuide';
import { PLATFORM_FEATURES, platformFeature } from '../server/core/platformGuide';
import { priceDigest, storefrontCatalog } from '../server/core/storeGuide';
import { reviewPages, reviewPagesCached } from '../server/core/pageReview';

const freshRepo = () => new Repository(new MemoryStore(), { SHAM_SEED_DEMO: 'true' });
const ask = (bot: Orchestrator, message: string, page?: string, productId?: string) =>
  bot.chat({ message, visitorId: `visitor-page-${Math.random().toString(36).slice(2, 10)}`, language: 'ar', page, productId });

test('every tab the visitor can open has a page guide with realistic questions', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const tabs = new Set([...app.matchAll(/activeTab(?: ===|\.startsWith\()\s*'([a-zA-Z_/]+)'/g)].map((m) => m[1]));
  assert.ok(tabs.size >= 12, 'the app still has its tabs');
  for (const page of PAGES) {
    if (page.id === 'productDetail') continue; // reached through #product=<id>, not a tab
    const base = page.id.split('/')[0];
    assert.ok(tabs.has(base), `page “${page.id}” is not a tab in src/App.tsx`);
    assert.ok(page.questions.length >= 2, `${page.id}: needs real questions`);
    assert.ok(page.what.ar.length > 30 && page.offer.ar.length > 20, `${page.id}: explain what the visitor sees`);
    const feature = pageFeature(page.id);
    if (feature) assert.ok(platformFeature(feature), `${page.id}: feature “${feature}” is not in PLATFORM_FEATURES`);
  }
  // The hash forms the widget sends must resolve to the same pages.
  assert.equal(pageGuide('#store')?.id, 'store');
  assert.equal(pageGuide('product=52')?.id, 'productDetail');
  assert.equal(pageGuide('community/merchant')?.id, 'community/merchant');
  assert.equal(pageGuide('nonsense-page'), undefined);
  assert.equal(PLATFORM_FEATURES.filter((f) => f.id === 'guide').length, 1, 'the guide page is a real feature');
});

test('a general price question gets the real spread, never "nothing is published"', async () => {
  const { items, snapshot } = await storefrontCatalog({});
  assert.ok(!snapshot.empty, 'the bundled catalog is not empty');
  const digest = priceDigest(items, 4);
  assert.ok(digest.min > 0 && digest.max > digest.min, 'the digest spans the real range');
  assert.equal(digest.picks.length, 4);
  assert.equal(new Set(digest.picks.map((p) => p.sku)).size, 4, 'four distinct products');
  assert.ok(digest.picks[0].price <= digest.min + 1, 'the first pick is the cheapest end');
  assert.ok(digest.picks[3].price >= digest.max - 1, 'the last pick is the expensive end');

  const bot = new Orchestrator(freshRepo(), { env: {} });
  for (const page of ['store', 'home', 'alcohol', 'community/merchant']) {
    const out = await ask(bot, 'إيه أسعار المنتجات؟', page);
    assert.ok(!/لسه بيتجهز|مفيش منتجات/.test(out.reply), `${page}: claims an empty store while ${snapshot.total} products are published`);
    assert.ok(digest.picks.some((p) => out.reply.includes(p.nameAr)), `${page}: names a real product`);
    assert.ok(out.reply.includes(String(digest.min)) && out.reply.includes(String(digest.max)), `${page}: shows the real price range`);
    assert.ok(out.actions.some((a) => a.type === 'open_tab' && a.tab === 'store'), `${page}: offers the store button`);
  }
});

test('the product page answers about the product the visitor has open', async () => {
  const { items } = await storefrontCatalog({});
  const product = items.find((i) => i.inStock)!;
  const bot = new Orchestrator(freshRepo(), { env: {} });
  for (const q of ['المنتج ده سعره كام؟', 'إيه المقاس والشحن بتاعه؟']) {
    const out = await ask(bot, q, 'productDetail', product.id);
    assert.ok(out.reply.includes(product.nameAr), `${q}: names the open product`);
    assert.ok(out.reply.includes(String(product.price)), `${q}: quotes its real price`);
  }
  // On the page of another product, the reply must not drift to the first one.
  const other = items.filter((i) => i.inStock && i.nameAr !== product.nameAr)[0];
  const out = await ask(bot, 'سعره كام؟', 'productDetail', other.id);
  assert.ok(!out.reply.includes(product.nameAr), 'the reply follows the product that is actually open');
});

test('a how-to question is an explanation, not an order form', async () => {
  const bot = new Orchestrator(freshRepo(), { env: {} });
  const out = await ask(bot, 'إزاي أحفظ التركيبة وأشاركها؟', 'library');
  assert.equal(out.intent, 'platform_help');
  assert.ok(!out.actions.some((a) => a.type === 'request_form'), 'no bespoke form for a library question');
  assert.ok(out.actions.some((a) => a.type === 'open_tab' && a.tab === 'library'), 'opens the library page');
  // …while a real request on the same page still becomes a form.
  const order = await ask(bot, 'عايز أطلب عطر مخصص هدية', 'library');
  assert.ok(order.actions.some((a) => a.type === 'request_form'), 'a real request still opens the form');
});

test('Shaheen keeps his own pages: he is named and his page is offered', async () => {
  const bot = new Orchestrator(freshRepo(), { env: {} });
  const news = await ask(bot, 'إيه آخر أخبار العطور؟', 'perfume_news');
  assert.match(news.reply, /شاهين/);
  assert.ok(news.actions.some((a) => a.type === 'open_tab' && a.tab === 'perfume_news'));
  const advice = await ask(bot, 'رشحلي عطر حلو للهدية', 'store');
  assert.match(advice.reply, /شاهين/, 'a taste recommendation points at «اسأل شاهين»');
});

test('out-of-scope questions (gold, currency) are refused honestly, never answered from the store', async () => {
  const bot = new Orchestrator(freshRepo(), { env: {} });
  const out = await ask(bot, 'كم سعر الذهب النهارده؟', 'store');
  assert.match(out.reply, /مش هقدر أفيدك|برّه تخصصي/);
  assert.ok(!/\d{3,}\s*جنيه/.test(out.reply), 'no price is quoted for something that is not in the store');
  assert.ok(!out.actions.some((a) => a.type === 'products'), 'no product cards for gold');
});

test('the page review is 100%, cached, and its failures are actionable', async () => {
  const repo = freshRepo();
  const review = await reviewPages(repo, { env: {} });
  assert.equal(review.score, 100, review.checks.filter((c) => !c.ok).map((c) => `${c.page}/${c.question} → ${c.actual}`).join('\n'));
  assert.equal(review.passed, review.total);
  assert.equal(review.pages, PAGES.length);
  // Every page's questions, plus the two production checks (the same shop with no merchant catalog).
  assert.equal(review.total, PAGES.reduce((n, p) => n + p.questions.length, 0) + 2);
  for (const check of review.checks) {
    assert.ok(check.expected.length > 5 && check.fix.length > 20, 'every check says what it wanted and how to fix a failure');
    assert.doesNotMatch(JSON.stringify(check), /openai|chatgpt|gemini|anthropic|claude/i);
  }
  // The panel and the API hit the same repo instance: one run per minute, and ?fresh=1 forces a new one.
  const cached = await reviewPagesCached(repo, { env: {} });
  const first = await reviewPagesCached(repo, { env: {} });
  assert.equal(first.at, cached.at, 'the panel and the API share one run per minute');
  const forced = await reviewPagesCached(repo, { env: {} }, true);
  assert.ok(forced.at >= cached.at);
  // A different store never inherits another store's review.
  const otherReview = await reviewPagesCached(freshRepo(), { env: {} });
  assert.notEqual(otherReview, review);
});
