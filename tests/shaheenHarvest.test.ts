import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import express from 'express';
import type { AddressInfo } from 'node:net';
import productsData from '../src/data/products.json';
import catalogFile from '../src/data/live/store-catalog.json';
import bankFile from '../src/data/shaheen-harvest-bank.json';
import { mergeCatalog, type RawProduct, type StoreCatalogFile } from '../src/utils/storeCatalog';
import { namedProducts, productLink, withContext } from '../src/utils/shaheenBrain';
import { productAnswer } from '../src/utils/shaheenPitch';
import { curateMemory, emptyMemory, remember, worthRemembering } from '../src/utils/shaheenMemory';
import { bankQuestions, harvestCheck, harvestMode, isHarvestReport, nextReport, pacificHour, pickHarvest, visitorHarvest } from '../scripts/shaheen-harvest/harvest';
import { createShaheenRouter, learnedQuestion } from '../server/shaheen';
import { ShaheenMemory } from '../server/core/memory';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';

const PRODUCTS = mergeCatalog((productsData as { products?: RawProduct[] }).products || [], catalogFile as unknown as StoreCatalogFile);
const link = productLink();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const LONG = '## الإجابة\n\nالعطر بيثبت أكتر لما تحطه على نقاط النبض بعد الاستحمام على بشرة مرطبة، لأن الزيوت بتمسك جزيئات الريحة وبتبطّأ تبخرها. ' .repeat(3) + '\n\n- رشه من مسافة 15 سم.\n- متفركش المعصمين في بعض.';

test('«حصّاد شاهين»: the regular models only in the two hours before the Pacific midnight renewal (daylight saving included)', () => {
  assert.equal(pacificHour(new Date('2026-07-01T05:30:00Z')), 22, 'PDT: 05:30 UTC is 22:30');
  assert.equal(harvestMode(new Date('2026-07-01T05:30:00Z')), 'leftover');
  assert.equal(harvestMode(new Date('2026-07-01T07:10:00Z')), 'open', 'after the renewal: open models only');
  assert.equal(harvestMode(new Date('2026-12-01T06:30:00Z')), 'leftover', 'PST: 06:30 UTC is 22:30');
  assert.equal(harvestMode(new Date('2026-12-01T05:30:00Z')), 'open', 'PST: 05:30 UTC is 21:30');
  assert.equal(harvestMode(new Date('2026-12-01T12:00:00Z'), { HARVEST_MODE: 'off' }), 'off');
});

test('«حصّاد شاهين»: visitors first, nothing he already knows, nothing personal or about today', () => {
  const memory = emptyMemory();
  remember(memory, { question: 'ازاي اخلي العطر يثبت اكتر على جسمي؟', lang: 'ar', mode: 'auto', answer: LONG, source: 'study' });
  const bank = bankQuestions(bankFile);
  assert.ok(bank.length >= 100, 'an everyday bank');
  assert.deepEqual(bank.filter((q) => !worthRemembering(q.q, LONG)).map((q) => q.q), [], 'bank questions are fit to keep');
  const visitors = visitorHarvest([{ question: 'ايه الفرق بين العود الكمبودي والهندي؟', count: 1 }, { question: 'ايه هو المسك الابيض؟', count: 5 }]);
  const picked = pickHarvest([...bank, ...visitors, { q: 'سعر الدولار النهارده كام؟', lang: 'ar', topic: 'x', from: 'visitor' }], memory, 5);
  assert.equal(picked[0].q, 'ايه هو المسك الابيض؟', 'the most asked visitor question first');
  assert.equal(picked[1].from, 'visitor');
  assert.ok(!picked.some((p) => /الدولار/.test(p.q)), 'never a time-bound question');
  assert.ok(!pickHarvest(bank, memory, bank.length).some((p) => p.q === 'ازاي اخلي العطر يثبت اكتر على جسمي؟'), 'already known');
  assert.equal(picked.length, 5);
});

test('«حصّاد شاهين»: only real, complete answers are kept; the report keeps its history', () => {
  assert.ok(harvestCheck('ازاي احفظ العطر؟', LONG).ok);
  assert.equal(harvestCheck('ازاي احفظ العطر؟', 'قصير').why, 'short');
  assert.equal(harvestCheck('ازاي احفظ العطر؟', `لا أستطيع الإجابة عن هذا. ${LONG}`).why, 'refusal');
  assert.equal(harvestCheck('ازاي احفظ العطر؟', `${LONG} ومن أهم الأسباب،`).why, 'cut');
  assert.equal(harvestCheck('ازاي احفظ العطر؟', `${LONG} Gemini`).ok, false, 'never a vendor name');
  assert.equal(harvestCheck('ازاي احفظ العطر؟', 'This is a long English answer about storing perfume. '.repeat(8)).why, 'language');
  const r = nextReport(undefined, { at: '2026-10-22T10:00:00Z', mode: 'open', asked: 3, kept: 2 }, [{ q: 'أ؟', from: 'bank' }, { q: 'ب؟', from: 'visitor' }], 2, 100);
  assert.ok(isHarvestReport(r) && r.lastKept.length === 2 && r.runs.length === 1);
  const memory = emptyMemory();
  remember(memory, { question: 'ازاي احفظ العطر من الحرارة؟', lang: 'ar', mode: 'auto', answer: LONG, source: 'harvest' }, new Date('2026-01-01T00:00:00Z'));
  assert.equal(curateMemory(memory, Date.parse('2026-04-01T00:00:00Z')).file.entries.length, 1, 'kept 3× longer, like the school');
  assert.ok(isHarvestReport(JSON.parse(readFileSync(new URL('../src/data/live/shaheen-harvest.json', import.meta.url), 'utf8'))));
});

test('the academy runs the harvest hourly and publishes its answers', () => {
  const wf = readFileSync(new URL('../.github/workflows/shaheen-school-clock.yml', import.meta.url), 'utf8');
  assert.match(wf, /id: harvest[\s\S]*scripts\/shaheen-harvest\/run\.mts/);
  assert.match(wf, /GEMINI_API_KEY: \$\{\{ secrets\.GEMINI_API_KEY \}\}/);
  assert.match(wf, /steps\.harvest\.outputs\.kept != '0'/);
  assert.match(wf, /src\/data\/live\/shaheen-harvest\.json/);
});

test('«متجر شام»: a named product is answered from the catalogue — card, staying power and close perfumes', () => {
  assert.equal(namedProducts(PRODUCTS, 'Hawas Ice كويس؟')[0]?.name.en.startsWith('Hawas Ice'), true);
  assert.equal(namedProducts(PRODUCTS, 'Rasasi Hawas ثابت؟').length >= 1, true, 'brand + name');
  assert.deepEqual(namedProducts(PRODUCTS, 'ازاي اخلي العطر يثبت'), []);
  assert.deepEqual(namedProducts(PRODUCTS, 'Noir'), [], 'a common word alone is not a product');
  const a = productAnswer(PRODUCTS, withContext('Hawas Ice كويس؟'), 'ar', link)!;
  assert.match(a.reply, /hawas-ice/);
  assert.equal(namedProducts(PRODUCTS, 'رأيك في هاواس آيس؟')[0]?.slug.startsWith('hawas-ice'), true, 'its Arabic name too');
  assert.match(a.reply, /ثبات/);
  assert.match(a.reply, /\/p\/[a-z0-9-]+\.html/);
  assert.equal(productAnswer(PRODUCTS, withContext('اعملي تركيبة زي Hawas Ice'), 'ar', link), undefined, 'the designer’s job');
});

test('a follow-up answered by a platform is kept under the whole question; one that can’t stand alone is not', () => {
  assert.equal(learnedQuestion('ازاي احفظ العطر؟', []), 'ازاي احفظ العطر؟');
  const ctx = learnedQuestion('طب وللصيف؟', [{ role: 'user', text: 'ايه افضل عطر عود للشتا' }, { role: 'assistant', text: 'العود الكمبودي…' }]);
  assert.ok(ctx && ctx.includes('عود') && ctx.includes('للصيف'), String(ctx));
});

test('every platform answer is remembered, and handed to the bots from the durable copy', async () => {
  const ANSWER = 'إجابة المنصة: احفظ العطر بعيداً عن الشمس والحرارة وفي علبته الأصلية علشان مايتأكسدش.';
  const engine = (async () => json({ choices: [{ message: { role: 'assistant', content: ANSWER } }] })) as typeof fetch;
  const durable = new MemoryStore();
  const memory = new ShaheenMemory(new MemoryStore(), {}, engine, emptyMemory(), durable);
  const app = express();
  app.use(express.json());
  app.use('/api', createShaheenRouter({ repo: new Repository(new MemoryStore(), {}), env: { OPENAI_API_KEY: 'sk-test', SHAM_ANSWER_CACHE_MINUTES: '0' }, fetch: engine, catalog: async () => PRODUCTS, memory }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const chat = (message: string, history: { role: string; text: string }[] = []) => fetch(`${base}/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'auto', language: 'ar', conversationHistory: history, message }),
  }).then((r) => r.json() as Promise<{ reply: string }>);
  try {
    await chat('ازاي احفظ العطر من الحرارة؟');
    await chat('طب ولو في العربية؟', [{ role: 'user', text: 'ازاي احفظ العطر من الحرارة؟' }, { role: 'assistant', text: ANSWER }]);
    await new Promise((done) => setTimeout(done, 50));
    const kept = await durable.list('memory');
    assert.ok(kept.some((e) => e.question === 'ازاي احفظ العطر من الحرارة؟'), 'the opening question');
    assert.ok(kept.some((e) => e.question !== 'ازاي احفظ العطر من الحرارة؟' && e.question.includes('العربية')), 'the follow-up, under the whole question');
    const exported = await memory.exported();
    assert.ok(exported.entries.length >= 2);
  } finally { await new Promise((done) => server.close(done)); }
});

test('the package ran out: a saved answer is given before «I don’t know yet» (the agent no longer cuts in front of memory)', async () => {
  const SAVED = 'إجابة محفوظة: انقع رأس الرشاش في مية دافية مع شوية كحول ربع ساعة، وبعدين نشفه وركبه تاني وجرب بخة على منديل قبل الاستخدام.';
  const shared = emptyMemory();
  remember(shared, { question: 'ازاي انضف رشاش البرفان لو اتسد؟', lang: 'ar', mode: 'auto', answer: SAVED, source: 'harvest' });
  const engine = (async () => json({ error: { message: 'insufficient_quota' } }, 429)) as typeof fetch;
  const memory = new ShaheenMemory(new MemoryStore(), {}, engine, shared);
  const app = express();
  app.use(express.json());
  app.use('/api', createShaheenRouter({ repo: new Repository(new MemoryStore(), {}), env: { OPENAI_API_KEY: 'sk-test', SHAM_ANSWER_CACHE_MINUTES: '0' }, fetch: engine, catalog: async () => PRODUCTS, memory }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  try {
    for (const message of ['ازاي انضف رشاش البرفان لو اتسد؟', 'رشاش البرفان اتسد انضفه ازاي']) {
      const res = await fetch(`${base}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'auto', language: 'ar', conversationHistory: [], message }) });
      const data = await res.json() as { reply: string; memory?: string };
      assert.equal(res.status, 200);
      assert.match(data.reply, /إجابة محفوظة/, `${message} → ${data.memory}: ${data.reply.slice(0, 120)}`);
    }
  } finally { await new Promise((done) => server.close(done)); }
});
