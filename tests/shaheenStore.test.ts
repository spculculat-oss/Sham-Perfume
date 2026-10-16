import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { cleanText, isGarbled, mergeCatalog, mergeProduct, productHash, ruleEntry, searchText, type RawProduct, type StoreCatalogFile } from '../src/utils/storeCatalog';
import { parseWish, recommend } from '../src/utils/storeAdvisor';
import { auditProduct, buildCatalogFile, entriesFromShaheen, parseJson, staleProducts, storePrompt } from '../scripts/shaheen-store/curate';
import { createStoreRouter, localAdvice, readAdvice } from '../server/store';
import { linkTools, questionIntents } from '../src/utils/shaheenTools';
import { cartSummary, orderMessage } from '../src/utils/storeCart';

// A fixed, hand-written store (never the live data, which Shaheen rewrites every 12 hours).
const RAW: RawProduct[] = [
  { id: 1, sku: 'LAT-001', nameAr: 'لطافة أمير العود', nameEn: 'Lattafa Ameer Al Oudh', descriptionAr: 'عطر عطر بجودة عالية وسعر مميز', descriptionEn: '', category: 'عود', brand: 'Lattafa', supplierPrice: 200, ourPrice: 260, stockStatus: 'in_stock', imageUrl: 'https://images.example/1.jpg', rating: 4.6, reviewCount: 30, createdAt: '2026-09-01' },
  { id: 2, sku: 'SHM-002', nameAr: 'سوفاج 최고 رجالي', nameEn: 'Sauvage style men', descriptionAr: 'عطر رجالي منعش للصيف', descriptionEn: 'Fresh men perfume', category: 'رجالي', brand: 'Shama', supplierPrice: 90, ourPrice: 150, stockStatus: 'in_stock', imageUrl: 'https://images.example/2.jpg', rating: 4.2, reviewCount: 10, createdAt: '2026-10-01' },
  { id: 3, sku: 'SHM-003', nameAr: 'ورد الياسمين نسائي', nameEn: 'Jasmine Rose', descriptionAr: 'عطر نسائي زهري ناعم بالورد والياسمين', descriptionEn: 'Soft floral rose and jasmine for women', category: 'نسائي', brand: 'Shama', supplierPrice: 120, ourPrice: 180, stockStatus: 'in_stock', imageUrl: 'https://images.example/3.jpg', rating: 4.8, reviewCount: 22, createdAt: '2026-08-01' },
  { id: 4, sku: 'GEN-004', nameAr: 'فانيلا الشتاء', nameEn: 'Winter Vanilla', descriptionAr: 'عطر حلو بالفانيلا والعنبر للسهرات', descriptionEn: '', category: 'مختلط', brand: 'Unknown', supplierPrice: 300, ourPrice: 280, stockStatus: 'in_stock', imageUrl: '', createdAt: '2026-07-01' },
];

test('the rules clean garbled names and generic descriptions without inventing notes', () => {
  assert.equal(isGarbled('سوفاج 최고 رجالي'), true);
  assert.equal(isGarbled('لطافة أمير العود'), false);
  assert.equal(cleanText('عطر عطر  رائع / فاخر'), 'عطر رائع فاخر');
  const garbled = ruleEntry(RAW[1]);
  assert.equal(garbled.nameAr, 'Sauvage style men', 'a garbled Arabic name falls back to the clean English one');
  const oud = ruleEntry(RAW[0]);
  assert.ok(oud.families.includes('oud'));
  assert.doesNotMatch(oud.descriptionAr, /جودة عالية/);
  assert.match(oud.descriptionAr, /Lattafa/);
  assert.deepEqual(oud.notes, { top: [], heart: [], base: [] });
  assert.match(ruleEntry(RAW[3]).descriptionEn, /\ban amber|\ba gourmand/);
});

test('the store never exposes supplier prices, and a stale enrichment falls back to the rules', () => {
  const product = mergeProduct(RAW[0]);
  assert.equal(product.price, 260);
  assert.equal('supplierPrice' in product, false);
  assert.equal(product.brand, 'Lattafa');
  assert.equal(mergeProduct(RAW[3]).brand, '', '"Unknown" is not shown as a brand');
  assert.equal(mergeProduct(RAW[3]).imageUrl, undefined);
  const stale = { ...ruleEntry(RAW[0]), editor: 'shaheen' as const, sourceHash: 'old', nameAr: 'اسم قديم' };
  assert.equal(mergeProduct(RAW[0], stale).name.ar, 'لطافة أمير العود');
  const fresh = { ...stale, sourceHash: productHash(RAW[0]) };
  assert.equal(mergeProduct(RAW[0], fresh).name.ar, 'اسم قديم');
  assert.equal(mergeProduct(RAW[0], fresh).enrichedBy, 'shaheen');
});

test('the audit lists real data problems for the merchant', () => {
  assert.ok(auditProduct(RAW[0]).includes('الوصف عام ولا يصف الرائحة'));
  assert.ok(auditProduct(RAW[0]).includes('كلمة مكررة في الوصف'));
  assert.ok(auditProduct(RAW[1]).includes('الاسم العربي فيه حروف غريبة من لغات أخرى'));
  const vanilla = auditProduct(RAW[3]);
  assert.ok(vanilla.includes('سعر البيع لا يزيد عن سعر التوريد'));
  assert.ok(vanilla.includes('بدون صورة'));
  assert.ok(vanilla.includes('العلامة التجارية غير معروفة'));
});

test("Shaheen's rewrite is validated: only asked products, known enums, no garbled or vendor text", () => {
  const prompt = storePrompt([RAW[0]]);
  assert.match(prompt, /LAT-001/);
  assert.doesNotMatch(prompt, /200|supplier/i, 'supplier prices never go to the model');
  const reply = parseJson('```json\n' + JSON.stringify({ products: [
    { sku: 'LAT-001', nameAr: 'لطافة أمير العود', nameEn: 'Ameer Al Oudh', descriptionAr: 'عطر عود شرقي دافئ بلمسة حلوة، مناسب للمساء والشتاء.', descriptionEn: 'A warm oriental oud with a sweet touch.', gender: 'unisex', families: ['oud', 'oriental', 'citrusy'], notes: { top: ['Agarwood'], heart: ['Vanilla'], base: ['Sandalwood', 'made by ChatGPT'] }, seasons: ['winter', 'monsoon'], occasions: ['evening'], tags: ['عود', 'oud'] },
    { sku: 'SHM-002', nameAr: 'سوفاج 최고', nameEn: 'Gemini Sauvage', descriptionAr: 'قصير', descriptionEn: 'short', families: ['fresh'] },
    { sku: 'NOT-ASKED', nameAr: 'منتج آخر' },
  ] }) + '\n```');
  const out = entriesFromShaheen(reply, [RAW[0], RAW[1]], '2026-10-16T00:00:00Z');
  assert.deepEqual(Object.keys(out).sort(), ['LAT-001', 'SHM-002']);
  assert.deepEqual(out['LAT-001'].families, ['oud', 'oriental']);
  assert.deepEqual(out['LAT-001'].seasons, ['winter']);
  assert.deepEqual(out['LAT-001'].notes.base, ['Sandalwood']);
  assert.equal(out['LAT-001'].editor, 'shaheen');
  assert.equal(isGarbled(out['SHM-002'].nameAr), false, 'garbled text from the model never reaches the store');
  assert.equal(out['SHM-002'].nameEn, 'Sauvage style men', 'vendor names are rejected');
  assert.doesNotMatch(out['SHM-002'].descriptionAr, /^قصير$/);
});

test('the catalog keeps trained entries, retrains changed products first and drops removed ones', () => {
  const now = new Date('2026-10-16T00:00:00Z');
  const trained = { ...ruleEntry(RAW[2]), editor: 'shaheen' as const };
  const previous = buildCatalogFile(RAW, undefined, { 'SHM-003': trained }, now);
  assert.equal(previous.entries['SHM-003'].editor, 'shaheen');
  assert.equal(previous.nextUpdateAt, '2026-10-16T12:00:00.000Z');
  assert.ok(previous.audit.issues.length >= 3);
  const changed = RAW.map((p) => (p.sku === 'LAT-001' ? { ...p, descriptionAr: 'وصف جديد من التاجر لعطر العود' } : p));
  const stale = staleProducts(changed, previous);
  assert.equal(stale.some((p) => p.sku === 'SHM-003'), false, 'trained and unchanged: skipped');
  assert.equal(stale.length, 3);
  const next = buildCatalogFile(changed.filter((p) => p.sku !== 'GEN-004'), previous, {}, now);
  assert.equal(next.entries['SHM-003'].editor, 'shaheen');
  assert.equal(next.entries['GEN-004'], undefined);
  assert.equal(next.entries['LAT-001'].sourceHash, productHash(changed[0]));
});

const CATALOG = mergeCatalog(RAW);

test('the advisor understands Egyptian/Arabic and English wishes', () => {
  const w = parseWish('عايز عطر رجالي للصيف تحت 200 جنيه');
  assert.equal(w.gender, 'men');
  assert.ok(w.seasons.includes('summer'));
  assert.equal(w.budgetMax, 200);
  assert.equal(recommend(CATALOG, 'عطر رجالي منعش للصيف تحت 200 جنيه').picks[0].product.sku, 'SHM-002');
  assert.equal(recommend(CATALOG, 'هدية نسائية ورد').picks[0].product.sku, 'SHM-003');
  assert.equal(recommend(CATALOG, 'oud from Lattafa').picks[0].product.sku, 'LAT-001');
  const cheap = recommend(CATALOG, 'تحت 200 جنيه');
  assert.ok(cheap.picks.every((p) => p.product.price <= 200));
  assert.match(searchText(CATALOG[0]), /عود/);
});

test('the server reads only real product ids from Shaheen and hides vendor names', () => {
  const ok = readAdvice('```json\n{"reply":"دي أنسب اختيارات","picks":[{"id":"SHM-003","why":"زهري ناعم"},{"id":"FAKE-9","why":"x"},{"id":"SHM-003","why":"تكرار"}]}\n```', CATALOG);
  assert.deepEqual(ok?.picks, [{ id: 'SHM-003', why: 'زهري ناعم' }]);
  assert.equal(readAdvice('{"reply":"x","picks":[{"id":"NOPE"}]}', CATALOG), undefined);
  assert.equal(readAdvice('no json', CATALOG), undefined);
  assert.equal(readAdvice('{"reply":"اقتراحات من Gemini","picks":[{"id":"LAT-001","why":"عود"}]}', CATALOG)?.reply, '');
  const local = localAdvice(CATALOG, 'عود', 'ar');
  assert.equal(local.source, 'local');
  assert.equal(local.picks[0].id, 'LAT-001');
});

async function withServer(router: express.Router, run: (url: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  const server = app.listen(0);
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/store/advise`); } finally { server.close(); }
}
const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const noCatalog = async () => undefined as StoreCatalogFile | undefined;

test('POST /api/store/advise: Shaheen picks from the real catalog, with a cache and a rate limit', async () => {
  let calls = 0;
  let prompt = '';
  const engine = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls++;
    prompt = String(init?.body || '');
    return json({ candidates: [{ content: { parts: [{ text: '{"reply":"اخترت لك عطرين للسهرة","picks":[{"id":"GEN-004","why":"فانيليا وعنبر دافئ"},{"id":"LAT-001","why":"عود شرقي"},{"id":"X-1","why":"مخترع"}]}' }] } }] });
  }) as typeof fetch;
  const router = createStoreRouter({ env: { GEMINI_API_KEY: 'store-test-key-1', SHAM_STORE_RATE_PER_MIN: '2' }, fetch: engine, products: RAW, catalog: noCatalog });
  await withServer(router, async (url) => {
    assert.equal((await post(url, { message: '' })).status, 400);
    const res = await post(url, { message: 'عطر للسهرات في الشتاء', language: 'ar' });
    assert.equal(res.status, 200);
    const body = await res.json() as { source: string; reply: string; picks: { id: string }[] };
    assert.equal(body.source, 'shaheen');
    assert.equal(body.reply, 'اخترت لك عطرين للسهرة');
    assert.deepEqual(body.picks.map((p) => p.id), ['GEN-004', 'LAT-001']);
    assert.match(prompt, /LAT-001/);
    assert.doesNotMatch(prompt, /supplier|سعر التوريد/, 'supplier prices never reach the model');
    assert.doesNotMatch(JSON.stringify(body), /gemini/i);
    await post(url, { message: 'عطر للسهرات في الشتاء؟', language: 'ar' });
    assert.equal(calls, 1, 'the same wish is answered from the cache');
    assert.equal((await post(url, { message: 'عود' })).status, 429);
  });
});

test('POST /api/store/advise answers with the rule-based advisor when no engine works', async () => {
  const down = (async () => json({ error: { message: 'overloaded' } }, 500)) as typeof fetch;
  for (const env of [{}, { GEMINI_API_KEY: 'store-test-key-2' }]) {
    await withServer(createStoreRouter({ env, fetch: down, products: RAW, catalog: noCatalog }), async (url) => {
      const body = await (await post(url, { message: 'عايز عطر نسائي ورد', language: 'ar' })).json() as { source: string; picks: { id: string; why: string }[]; reply: string };
      assert.equal(body.source, 'local');
      assert.equal(body.picks[0].id, 'SHM-003');
      assert.ok(body.picks[0].why.length > 0);
      assert.ok(body.reply.length > 0);
    });
  }
});

test("Shaheen's chat links shopping questions to the store, and only those", () => {
  assert.ok(questionIntents('عايز عطر رجالي للصيف').includes('store'));
  assert.ok(questionIntents('رشحلي هدية لمراتي').includes('store'));
  assert.ok(questionIntents('Can you recommend a perfume for my wife?').includes('store'));
  assert.deepEqual(questionIntents('بكام عطر العود عندكم؟'), ['store'], 'a store price is not the production-cost calculator');
  assert.equal(questionIntents('صمم لي عطر شرقي بالعود').includes('store'), false);
  assert.equal(questionIntents('عايز اركب عطر لمنظف').includes('store'), false);
  assert.equal(questionIntents('كم يوم أعتق العطر؟').includes('store'), false);
  assert.deepEqual(questionIntents('مرحبا'), []);
  const [link] = linkTools({ question: 'عايز عطر نسائي هدية', answer: 'أنصحك بعطر زهري ناعم.' });
  assert.equal(link.tool, 'store');
  assert.equal(link.search, 'عايز عطر نسائي هدية');
  const explicit = linkTools({ question: 'x', answer: 'تمام\n```sham-tool\n{"tools":[{"tool":"store","search":"عطر عود للسهرات"}]}\n```' });
  assert.deepEqual(explicit, [{ tool: 'store', search: 'عطر عود للسهرات' }]);
});

test('the cart totals from catalog prices and builds the order message for the Sham assistant', () => {
  const summary = cartSummary({ 'LAT-001': 2, 'SHM-003': 1, 'GONE-1': 4 }, CATALOG);
  assert.equal(summary.count, 3);
  assert.equal(summary.total, 260 * 2 + 180);
  const message = orderMessage(summary, 'ar');
  assert.match(message, /LAT-001\) × 2 = 520 جنيه/);
  assert.match(message, /الإجمالي: 700 جنيه/);
  assert.doesNotMatch(message, /GONE-1/);
});
