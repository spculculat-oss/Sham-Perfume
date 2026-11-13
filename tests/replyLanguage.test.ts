import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import productsData from '../src/data/products.json';
import catalogFile from '../src/data/live/store-catalog.json';
import { mergeCatalog, type RawProduct, type StoreCatalogFile } from '../src/utils/storeCatalog';
import { emptyMemory, remember } from '../src/utils/shaheenMemory';
import { checkTranslation, localizeReply, needsTranslation, scriptOf, TranslationCache, untranslatedReply } from '../server/core/replyLanguage';
import { createShaheenRouter } from '../server/shaheen';
import { ShaheenMemory } from '../server/core/memory';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';

const PRODUCTS = mergeCatalog((productsData as { products?: RawProduct[] }).products || [], catalogFile as unknown as StoreCatalogFile);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const EN = 'From the Sham store:\n1. [Hawas Ice](https://x.test/p/hawas-ice-53.html) — EGP 4,910 · 100 ml\n   - Notes: bergamot, lemon and musk. It is fresh and you can wear it for the day.';
const FR = 'Dans la boutique Sham :\n1. [Hawas Ice](https://x.test/p/hawas-ice-53.html) — EGP 4,910 · 100 ml\n   - Notes : bergamote, citron et musc. Il est frais et se porte en journée.';

test('«مترجم ردود شاهين»: which replies need translating for the visitor’s language', () => {
  assert.equal(scriptOf('ازاي احفظ العطر من الحرارة؟'), 'ar');
  assert.equal(scriptOf(EN), 'en');
  assert.equal(scriptOf(FR), 'other');
  assert.equal(needsTranslation(EN, 'fr', 'Hawas Ice est bien ?'), true, 'English store answer, French visitor');
  assert.equal(needsTranslation(FR, 'fr', 'Hawas Ice est bien ?'), false, 'a platform already answered in French');
  assert.equal(needsTranslation('إجابة بالعربي عن العطر', 'fr', 'سؤال بالعربي'), false, 'he wrote Arabic himself');
  assert.equal(needsTranslation('إجابة بالعربي عن العطر', 'fa', 'چطور عطر را نگه دارم؟'), true, 'a Persian visitor needs Persian');
  assert.equal(needsTranslation('إجابة بالعربي عن العطر', 'de', 'Wie lagere ich Parfüm?'), true);
  assert.equal(needsTranslation(EN, 'ar', 'Is Hawas Ice good?'), false, 'an English question on an Arabic page');
  assert.equal(needsTranslation(EN, 'en', 'Is Hawas Ice good?'), false);
});

test('«مترجم ردود شاهين»: a translation is used only when links, numbers and code blocks are kept, in the right script', () => {
  assert.ok(checkTranslation(EN, FR, 'fr'));
  assert.equal(checkTranslation(EN, FR.replace('https://x.test/p/hawas-ice-53.html', 'https://x.test/'), 'fr'), false, 'a link lost');
  assert.equal(checkTranslation(EN, EN, 'fr'), false, 'not translated');
  assert.equal(checkTranslation(EN, `${FR} (traduit par Gemini)`, 'fr'), false, 'never a vendor name');
  assert.equal(checkTranslation('مرحبا بيك في متجر شام، العطر ده منعش ومناسب للصيف.', 'Welcome to the Sham store, this perfume is fresh and fits the summer.', 'de'), false, 'English is not German');
  assert.match(untranslatedReply('إجابة بالعربي', 'fr'), /La traduction n’est pas disponible/);
  assert.equal(untranslatedReply(EN, 'fr'), EN, 'English is every language’s fallback');
});

test('«مترجم ردود شاهين»: translated once, then from the cache; nothing to translate with → the honest line', async () => {
  const cache = new TranslationCache();
  let calls = 0;
  const translate = async () => { calls++; return FR; };
  const a = await localizeReply(EN, 'fr', 'Hawas Ice ?', translate, cache, 10_000);
  assert.deepEqual([a.reply, a.translated], [FR, true]);
  await localizeReply(EN, 'fr', 'Hawas Ice ?', translate, cache, 10_000);
  assert.equal(calls, 1, 'the second time from the cache');
  const none = await localizeReply('إجابة بالعربي عن حفظ العطر', 'de', 'Wie lagere ich Parfüm?', async () => undefined, cache, 10_000);
  assert.match(none.reply, /Übersetzung ist gerade nicht verfügbar/);
  assert.equal(none.translated, false);
});

async function server(engine: typeof fetch, memory?: ShaheenMemory) {
  const app = express();
  app.use(express.json());
  app.use('/api', createShaheenRouter({ repo: new Repository(new MemoryStore(), {}), env: { OPENAI_API_KEY: 'sk-test', SHAM_ANSWER_CACHE_MINUTES: '0' }, fetch: engine, catalog: async () => PRODUCTS, ...(memory ? { memory } : {}) }));
  const s = app.listen(0, '127.0.0.1');
  await new Promise((done) => s.once('listening', done));
  const base = `http://127.0.0.1:${(s.address() as AddressInfo).port}/api`;
  const chat = (message: string, language: string) => fetch(`${base}/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'auto', language, conversationHistory: [], message }),
  }).then((r) => r.json() as Promise<{ reply: string; memory?: string; translated?: string }>);
  return { chat, close: () => new Promise((done) => s.close(done)) };
}

test('the server: a French visitor gets the store’s answer in French, links kept', async () => {
  const seen: string[] = [];
  const engine = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { messages: { role: string; content: string }[] };
    const text = body.messages.at(-1)!.content;
    seen.push(body.messages[0].content);
    // The «translator»: keeps every link of the text it got and writes French around it.
    const links = [...text.matchAll(/\[([^\]]+)\]\((https?:[^)]+)\)/g)].map((m) => `[${m[1]}](${m[2]})`);
    const numbers = (text.replace(/https?:\/\/\S+/g, '').match(/\d+/g) || []).join(' ');
    // A real translation is about as long as its source (the pitch is prose more than links): so is this one.
    const prose = ' Le parfum s’ouvre, se pose puis reste sur la peau.'.repeat(Math.max(1, Math.round(text.length / 120)));
    return json({ choices: [{ message: { role: 'assistant', content: `Voici les parfums de la boutique Sham, avec leurs notes et leur tenue : ${links.join(' ; ')} — ${numbers}.${prose} Voulez-vous les comparer ?` } }] });
  }) as unknown as typeof fetch;
  const { chat, close } = await server(engine);
  try {
    const r = await chat('Hawas Ice est bien ?', 'fr');
    assert.equal(r.memory, 'store');
    assert.equal(r.translated, 'fr');
    assert.match(r.reply, /Voici les parfums/);
    assert.match(r.reply, /\/p\/hawas-ice[a-z0-9-]*\.html/);
    assert.ok(seen.some((s) => /French/.test(s)), 'asked for French');
    const ar = await chat('هاواس آيس كويس؟', 'ar');
    assert.equal(ar.translated, undefined, 'Arabic stays Arabic');
  } finally { await close(); }
});

test('the server: the usual answer is given for an almost-same wording, without asking a platform', async () => {
  let calls = 0;
  const engine = (async () => { calls++; return json({ choices: [{ message: { role: 'assistant', content: 'رد المنصة الجديد عن سؤال جديد فعلاً ومختلف.' } }] }); }) as unknown as typeof fetch;
  const shared = emptyMemory();
  remember(shared, { question: 'ازاي احفظ العطر من الحرارة والشمس؟', lang: 'ar', mode: 'auto', answer: 'الإجابة المعتادة: احفظه في مكان بارد ومظلم بعيد عن الشمس والحمام.', source: 'harvest' });
  const { chat, close } = await server(engine, new ShaheenMemory(new MemoryStore(), {}, engine, shared));
  try {
    const r = await chat('ازاي احفظ العطر من الشمس والحرارة', 'ar');
    assert.match(r.reply, /الإجابة المعتادة/);
    assert.equal(calls, 0, 'no platform for a question he already knows');
    const fresh = await chat('ايه الفرق بين العود الكمبودي والهندي؟', 'ar');
    assert.match(fresh.reply, /رد المنصة/, 'a new question goes to the platform');
  } finally { await close(); }
});
