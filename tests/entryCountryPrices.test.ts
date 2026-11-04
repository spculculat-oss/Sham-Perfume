/**
 * «شاهين يتأكد من دولة الدخول قبل ما يرد»: every chat reply quotes prices in the currency of the country the visitor
 * enters from — never Egyptian pounds outside Egypt. The maneuver (src/utils/priceDrills.ts) runs here on every test
 * run, and the server routes are checked end to end with a stubbed AI platform that answers in pounds.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import express from 'express';
import productsData from '../src/data/products.json';
import catalogFile from '../src/data/live/store-catalog.json';
import { mergeCatalog, type RawProduct, type StoreCatalogFile } from '../src/utils/storeCatalog';
import { replyMoney } from '../src/utils/displayCurrency';
import { localizeChatPrices } from '../src/utils/chatPrices';
import { PLATFORM_SAMPLES, gradePriceCase, livePriceDrillsFor, priceProblems, runPriceDrills, serverReply } from '../src/utils/priceDrills';
import { stateSector } from '../src/utils/stateSectors';
import { countryFromHeaders, moneyOut } from '../server/core/replyMoney';
import { createStoreRouter } from '../server/store';
import { createShaheenRouter } from '../server/shaheen';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';

test('the server decides the reply currency from the entry country of THIS request', () => {
  // The edge (where he is entering from now) beats a stale country the page remembered.
  assert.deepEqual(replyMoney({ edgeCountry: 'SA', country: 'EG', currency: 'EGP', lang: 'ar' }), { country: 'SA', currency: 'SAR', source: 'edge' });
  assert.equal(replyMoney({ edgeCountry: 'US', country: 'EG', lang: 'en' }).currency, 'USD');
  assert.equal(replyMoney({ edgeCountry: 'GB', lang: 'en' }).currency, 'GBP');
  // A language foreign to the country: an Egyptian reading French sees euros (the page's own rule).
  assert.equal(replyMoney({ edgeCountry: 'EG', lang: 'fr' }).currency, 'EUR');
  assert.equal(replyMoney({ edgeCountry: 'EG', lang: 'ar' }).currency, 'EGP');
  // A store country he picked himself (still valid on his page) keeps the currency his page sent.
  assert.deepEqual(replyMoney({ edgeCountry: 'EG', country: 'AE', currency: 'AED', countryManual: true, lang: 'ar' }), { country: 'AE', currency: 'AED', source: 'visitor' });
  // No edge (local server, a proxy): the page's country; nothing at all: Egypt.
  assert.equal(replyMoney({ country: 'KW', lang: 'ar' }).currency, 'KWD');
  assert.equal(replyMoney({ lang: 'ar' }).currency, 'EGP');
  // Garbage never picks a currency.
  assert.equal(replyMoney({ edgeCountry: 'XX', country: 'ZZ', currency: 'FAKE', countryManual: true, lang: 'en' }).currency, 'EGP');
  assert.equal(countryFromHeaders({ 'x-vercel-ip-country': 'de' }), 'DE');
  assert.equal(countryFromHeaders({ 'cf-ipcountry': 'XX' }), undefined);
});

test('every way the pound gets written is converted, and nothing else is touched', () => {
  for (const sample of PLATFORM_SAMPLES) {
    for (const [country, lang] of [['SA', 'ar'], ['US', 'en'], ['FR', 'fr'], ['GB', 'en'], ['JP', 'en']] as const) {
      const out = serverReply(sample, country, lang);
      assert.deepEqual(priceProblems(out, country, lang), [], `${country}: «${sample}» → «${out}»`);
    }
    assert.equal(serverReply(sample, 'EG', 'ar'), sample, 'Egypt keeps its pounds');
  }
  assert.match(localizeChatPrices('السعر 1420 جنيه مصرى', 'SAR', 'ar'), /ر\.س/);
  assert.match(localizeChatPrices('بـ ١٤٢٠ جنيهًا', 'USD', 'en'), /\$/);
  assert.equal(localizeChatPrices('السعر 25 جنيه استرليني', 'SAR', 'ar'), 'السعر 25 جنيه استرليني', 'sterling is not an Egyptian pound');
  assert.equal(localizeChatPrices('le 15 octobre', 'EUR', 'fr'), 'le 15 octobre', 'the French «le» is not money');
  assert.equal(localizeChatPrices('الخارج 300 مرة · 20 جرام', 'SAR', 'ar'), 'الخارج 300 مرة · 20 جرام');
  assert.doesNotMatch(localizeChatPrices('السعر 1500 جنيهات مصرية', 'SAR', 'ar'), /جنيه|ة$/);
});

test('«مناورة دولة الدخول»: his own brain and the platform answers, for every entry country, never show pounds outside Egypt', () => {
  const products = mergeCatalog((productsData as { products: RawProduct[] }).products, catalogFile as StoreCatalogFile);
  const run = runPriceDrills(products);
  assert.deepEqual(run.findings.map((f) => f.detailAr), []);
  assert.ok(run.cases.filter((c) => c.kind === 'brain').length >= 40, 'his brain answered the price questions');
  assert.ok(run.priced >= 200, 'the replies really quote prices in the visitor currency');
  // The grader catches a leak (and only outside Egypt), and the State knows whose work it is.
  const leak = gradePriceCase({ id: 'x', country: 'SA', language: 'ar', say: 'بكام؟', reply: 'السعر EGP 1,420', source: 'chat-live', kind: 'live' });
  assert.equal(leak[0]?.code, 'chat-currency');
  assert.equal(stateSector({ code: 'chat-currency', topic: 'store', section: 'shaheen_chat', kind: 'error' }).dept, 'store');
  assert.deepEqual(gradePriceCase({ id: 'x', country: 'EG', language: 'ar', say: 'بكام؟', reply: 'السعر EGP 1,420', source: 'chat-live', kind: 'live' }), []);
  assert.ok(priceProblems('Prices are in Egyptian pounds', 'US', 'en').length, 'the word alone is a leak too');
  const live = livePriceDrillsFor(new Date('2026-10-24T12:00:00Z'), 3);
  assert.equal(live.length, 3);
  assert.ok(live.every((d) => d.country !== 'EG'));
});

test('moneyOut converts only the answer text and says which country and currency it was written for', () => {
  const money = replyMoney({ edgeCountry: 'AE', lang: 'en' });
  const out = moneyOut({ reply: 'EGP 1,420', engine: 'x', count: 1420 }, money, 'en') as Record<string, unknown>;
  assert.doesNotMatch(String(out.reply), /EGP/);
  assert.equal(out.count, 1420);
  assert.equal(out.country, 'AE');
  assert.equal(out.currency, 'AED');
  assert.deepEqual(moneyOut({ error: 'x' }, money, 'en'), { error: 'x' }, 'errors pass untouched');
});

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

async function withApp(router: express.Router, run: (base: string) => Promise<void>) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`); } finally { await new Promise((done) => server.close(done)); }
}

test('POST /api/chat: a platform answer in pounds reaches a Saudi visitor in riyals (and an Egyptian in pounds)', async () => {
  let calls = 0;
  const engine = (async () => { calls++; return json({ choices: [{ message: { role: 'assistant', content: 'الفرق في نسبة الزيت، والزجاجة عندنا سعرها EGP 1,420 والتانية 900 جنيه مصري.' } }] }); }) as typeof fetch;
  const router = createShaheenRouter({ repo: new Repository(new MemoryStore(), {}), env: { OPENAI_API_KEY: 'sk-test' }, fetch: engine });
  await withApp(router, async (base) => {
    const ask = (question: string, headers: Record<string, string>, extra: Record<string, unknown> = {}) => fetch(`${base}/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ message: question, model: 'auto', language: 'ar', conversationHistory: [], ...extra }),
    });
    const saudi = await ask('ما الفرق بين EDP و EDT؟', { 'x-vercel-ip-country': 'SA' }, { country: 'EG', currency: 'EGP' });
    assert.equal(saudi.status, 200);
    const s = await saudi.json() as { reply: string; country?: string; currency?: string };
    assert.ok(calls > 0, "the platform answered");
    {
      assert.doesNotMatch(s.reply, /EGP|جنيه/, s.reply);
      assert.match(s.reply, /ر\.س/);
    }
    assert.equal(s.country, 'SA', 'the server checked where he enters from (not the stale page country)');
    assert.equal(s.currency, 'SAR');
    // The same question again (from the answer cache): the cache kept the pounds, so Egypt still reads pounds.
    const egypt = await ask('ما الفرق بين EDP و EDT', { 'x-vercel-ip-country': 'EG', 'x-forwarded-for': '10.9.0.2' });
    const e = await egypt.json() as { reply: string; currency?: string };
    assert.equal(e.currency, 'EGP');
    assert.match(e.reply, /EGP 1,420/);
    assert.equal(calls, 1, 'answered from the cache');
  });
});

test('POST /api/store/advise: the advice and every pick reason in the entry country currency (the cache keeps pounds)', async () => {
  const RAW: RawProduct[] = [
    { id: 1, sku: 'LAT-001', nameAr: 'لطافة أمير العود', nameEn: 'Lattafa Ameer Al Oudh', descriptionAr: 'عود شرقي', descriptionEn: '', category: 'عود', brand: 'Lattafa', supplierPrice: 200, ourPrice: 1420, stockStatus: 'in_stock', imageUrl: '', rating: 4.6, reviewCount: 30, createdAt: '2026-09-01' },
    { id: 2, sku: 'GEN-004', nameAr: 'فانيلا الشتاء', nameEn: 'Winter Vanilla', descriptionAr: 'فانيلا وعنبر', descriptionEn: '', category: 'مختلط', brand: 'Shama', supplierPrice: 300, ourPrice: 900, stockStatus: 'in_stock', imageUrl: '', createdAt: '2026-07-01' },
  ];
  const engine = (async () => json({ candidates: [{ content: { parts: [{ text: '{"reply":"اخترت لك عطرين من 900 لـ 1,420 جنيه","picks":[{"id":"LAT-001","why":"عود شرقي بـ EGP 1,420"},{"id":"GEN-004","why":"فانيلا بـ 900 جنيه"}]}' }] } }] })) as typeof fetch;
  const router = createStoreRouter({ env: { GEMINI_API_KEY: 'store-test-key-9' }, fetch: engine, products: RAW, catalog: async () => undefined });
  await withApp(router, async (base) => {
    const post = (headers: Record<string, string>) => fetch(`${base}/store/advise`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ message: 'عطر للسهرات في الشتاء', language: 'ar' }) });
    const us = await (await post({ 'x-vercel-ip-country': 'US' })).json() as { reply: string; picks: { id: string; why: string }[]; currency?: string };
    assert.equal(us.currency, 'USD');
    assert.doesNotMatch(us.reply + us.picks.map((p) => p.why).join(' '), /EGP|جنيه/);
    assert.match(us.picks[0].why, /\$/);
    const eg = await (await post({ 'x-vercel-ip-country': 'EG' })).json() as { reply: string; picks: { why: string }[] };
    assert.match(eg.reply, /جنيه/, 'the same cached advice still reads in pounds for Egypt');
  });
});
