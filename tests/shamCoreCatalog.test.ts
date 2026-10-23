/**
 * «كتالوج واحد للمنظومة» — المتجر الحقيقي هو مصدر المنتجات، مش كتالوج الإدارة الفاضي.
 *
 * الباج اللي الملف ده بيحرسه: على متجر شغّال كتالوج الإدارة (`repo.products`) كان فاضي، فالمساعد كان
 * يرد «كتالوج المتجر لسه بيتجهز ومفيش منتجات منشورة» والمتجر فيه ١١٦١ منتج، والاستمارة كانت تطلع من
 * غير منتجات، وطلب الشراء كان بيترفض. دلوقتي:
 *
 *  1. `catalogView` بيرجّع كتالوج الإدارة لو فيه صفوف، وإلا كتالوج المتجر الحقيقي (بلا سعر مورّد ولا هامش).
 *  2. `search_catalog` بيدوّر في الرؤية دي، فمفيش أداة تقول «الكتالوج فاضي» والمتجر مليان.
 *  3. طلب الشراء من المحادثة بيتسجل بأسعار المتجر الحقيقية، ومن غير ما يكتب مخزون المتجر في كتالوج الإدارة.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { Orchestrator } from '../server/core/orchestrator';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { catalogView, findStoreProduct, storeItemToProduct, storefrontProducts } from '../server/core/catalog';
import { tools } from '../server/core/tools';
import { storefrontCatalog } from '../server/core/storeGuide';

/** A production-like store: defaults seeded, merchant catalog never filled. */
const productionRepo = () => new Repository(new MemoryStore(), {});
const demoRepo = () => new Repository(new MemoryStore(), { SHAM_SEED_DEMO: 'true' });
const ask = (bot: Orchestrator, message: string) =>
  bot.chat({ message, visitorId: `visitor-catalog-${Math.random().toString(36).slice(2, 10)}`, language: 'ar' });
const run = (tool: keyof typeof tools, args: unknown, repo: Repository) =>
  (tools[tool].run as (a: unknown, c: unknown) => Promise<{ observation: string; data?: unknown; actions?: unknown[] }>)(args, { repo, lang: 'ar', env: {} });

test('the merchant catalog wins when it has rows; the storefront answers when it does not', async () => {
  const empty = await catalogView(productionRepo());
  assert.equal(empty.source, 'storefront');
  assert.ok(empty.products.length > 900, 'the real storefront is the catalog');
  assert.ok(!empty.empty);
  for (const product of empty.products.slice(0, 20)) {
    assert.equal(product.currency, 'EGP');
    assert.ok(product.price > 0);
    assert.ok(product.stock === 0 || product.stock === 1, 'availability, not an inventory count');
    assert.doesNotMatch(JSON.stringify(product), /supplierPrice|ourPrice|margin/);
  }

  const admin = await catalogView(demoRepo());
  assert.equal(admin.source, 'admin');
  assert.ok(admin.products.every((p) => p.demo), 'the merchant’s own rows are used as they are');

  // Browsing the shop always reads the storefront, even when the merchant keeps internal order lines.
  const shopping = await catalogView(demoRepo(), { forceStorefront: true });
  assert.equal(shopping.source, 'storefront');
});

test('no tool can report an empty catalog while the shop sells products', async () => {
  const repo = productionRepo();
  assert.equal((await repo.products()).length, 0, 'the premise: the merchant catalog is empty');
  const found = await run('search_catalog', { query: 'عطر عود' }, repo);
  assert.match(found.observation, /^STOREFRONT_CATALOG/);
  assert.doesNotMatch(found.observation, /CATALOG_EMPTY/);
  const data = found.data as { products: { id: string; price: number; sku: string }[] };
  assert.ok(data.products.length > 0, 'real products are returned');
  const { items } = await storefrontCatalog({});
  const bySku = new Map(items.map((i) => [i.sku, i]));
  for (const product of data.products) assert.equal(bySku.get(product.sku)?.price, product.price, `${product.sku}: the price is the storefront price`);
});

test('"I want to buy a perfume" on an unfilled store quotes real products and a working form', async () => {
  const repo = productionRepo();
  const bot = new Orchestrator(repo, { env: {} });
  const out = await ask(bot, 'عايز أشتري عطر');
  assert.doesNotMatch(out.reply, /مفيش منتجات|لسه بيتجهز/, 'never claims the shop is empty');
  assert.ok(out.actions.some((a) => a.type === 'open_tab' && a.tab === 'store'), 'the store button is offered');
  assert.ok(out.actions.some((a) => a.type === 'request_form' && a.serviceId === 'store'), 'the request form is offered');
  const card = out.actions.find((a) => a.type === 'products') as { products?: { id: string; sku: string; price: number }[] } | undefined;
  assert.ok(card?.products?.length, 'the form lists real products');
  const { items } = await storefrontCatalog({});
  for (const product of card!.products!) {
    assert.ok(items.some((i) => i.id === product.id && i.price === product.price), `${product.sku}: real id and price`);
  }
});

test('a chat order for a storefront product is recorded at the real price and never touches storefront stock', async () => {
  const repo = productionRepo();
  const service = (await repo.services()).find((s) => s.kind === 'store')!;
  const { items } = await storefrontCatalog({});
  const item = items.find((i) => i.inStock && i.price > 0)!;
  const fields = Object.fromEntries(service.formFields.filter((f) => f.required).map((f) => [f.name, f.type === 'select' ? f.options![0] : f.type === 'number' ? '1' : 'تجربة']));

  const request = await repo.createRequest({
    serviceId: service.id, contact: { name: 'عميل تجربة', phone: '01000000000' }, fields,
    items: [{ productId: item.id, quantity: 2 }],
  });
  assert.equal(request.total, Math.round(item.price * 2 * 100) / 100, 'the total is the real storefront price × 2');
  assert.equal(request.items?.[0].name, item.nameAr);
  assert.equal((await repo.products()).length, 0, 'the storefront’s inventory was never written into the merchant catalog');

  // An id that exists nowhere is still rejected, and a sold-out item is refused honestly.
  await assert.rejects(() => repo.createRequest({ serviceId: service.id, contact: { name: 'عميل', phone: '01000000000' }, fields, items: [{ productId: 'not-a-product', quantity: 1 }] }));
  const soldOut = items.find((i) => !i.inStock);
  if (soldOut) {
    await assert.rejects(
      () => repo.createRequest({ serviceId: service.id, contact: { name: 'عميل', phone: '01000000000' }, fields, items: [{ productId: soldOut.id, quantity: 1 }] }),
      (error: { status?: number }) => error.status === 409,
    );
  }
});

test('a storefront product keeps its real identity in the system shape', async () => {
  const { items } = await storefrontCatalog({});
  const item = items[0];
  const product = storeItemToProduct(item);
  assert.equal(product.id, item.id);
  assert.equal(product.sku, item.sku);
  assert.equal(product.price, item.price);
  assert.equal(product.category, 'perfume');
  assert.ok(product.unit.endsWith('ml') || product.unit === 'piece');
  const again = await findStoreProduct(item.id, {});
  assert.equal(again?.item.price, item.price, 'the order path resolves the same item');
  assert.equal(await findStoreProduct('missing-id', {}), undefined);
  // The storefront view is stable and cheap to call twice (cached upstream).
  const a = await storefrontProducts({});
  const b = await storefrontProducts({});
  assert.equal(a.products.length, b.products.length);
});
