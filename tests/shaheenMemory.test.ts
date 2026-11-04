import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import express from 'express';
import {
  curateMemory, emptyMemory, isPersonal, isTimeBound, memoryId, mergeMemory, normalizeQuestion, offlineNote,
  recall, recallSimilar, remember, similarity, touch, worthRemembering, type MemoryFile,
} from '../src/utils/shaheenMemory';
import { ShaheenMemory } from '../server/core/memory';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { createShaheenRouter } from '../server/shaheen';
import { ApiError, type requestApi } from '../src/utils/api';
import { canAnswerFromMemory, createChatStore } from '../src/utils/chatStore';
import type { OfflineMemory } from '../src/utils/browserMemory';
import { answerBook } from '../scripts/doctor/answers';
import { makeAsk } from '../scripts/doctor/agent';

const LONG = 'لتصميم عطر شرقي بالعود والورد بحجم 50 مل وتركيز EDP استخدم 10 مل زيت عطري و40 مل كحول، وعتّقه أسبوعين في مكان مظلم.';
const DAY = 86_400_000;

test('one memory entry per question, whatever the spelling (Arabic letters, diacritics, Arabic-Indic digits)', () => {
  assert.equal(memoryId('  أفضلُ عطرٍ للشتاء؟ ', 'ar', 'auto'), memoryId('افضل عطر للشتاء', 'ar', 'auto'));
  assert.equal(normalizeQuestion('تكلفة ٥٠ مل'), 'تكلفة 50 مل');
  assert.notEqual(memoryId('افضل عطر', 'ar', 'auto'), memoryId('افضل عطر', 'en', 'auto'), 'languages are separate');
  assert.notEqual(memoryId('افضل عطر', 'ar', 'deep'), memoryId('افضل عطر', 'ar', 'auto'), 'a deep analysis is a different answer');
  assert.equal(memoryId('افضل عطر', 'ar', 'gemini'), memoryId('افضل عطر', 'ar', 'auto'), 'engine names are just «auto»');
});

test('time-bound and personal questions are never remembered; normal words containing them are fine', () => {
  for (const q of ['ايه اخبار العطور', 'ايه الجديد في العطور', 'سعر عطر سوفاج كام', 'what is the price of oud', 'perfume trends 2026', 'فين الاوردر بتاعي', 'ايه عروض النهارده'])
    assert.ok(isTimeBound(q), q);
  for (const q of ['ما هي خبرة شاهين في العود؟', 'ما المطلوب لعمل عطر', 'لو الزيت سعره 1200 جنيه احسب تكلفة 50 مل', 'كم يوم أعتق عطر مسك؟', 'how to mix oud with rose'])
    assert.ok(!isTimeBound(q), q);
  // سياسة الشحن والجمارك معرفة تتذاكر، لكن سعرها اللحظي وقتياً زيه زي أي سعر.
  for (const q of ['إزاي أحسب تكلفة الشحن الدولي؟', 'ينفع أشحن عطر دولياً؟', 'الجمارك بتتحسب إزاي؟']) assert.ok(!isTimeBound(q), q);
  for (const q of ['الشحن لمصر بكام؟', 'سعر التوصيل كام؟', 'ايه عروض الشحن النهارده']) assert.ok(isTimeBound(q), q);
  assert.ok(isPersonal('رقمي ٠١٠١٢٣٤٥٦٧٨') && isPersonal('my email is a@b.co') && !isPersonal('عطر 50 مل'));
  assert.ok(worthRemembering('صمم لي عطر شرقي', LONG));
  assert.ok(!worthRemembering('صمم لي عطر شرقي', `${LONG} (Gemini)`), 'no AI vendor names');
  assert.ok(!worthRemembering('صمم لي عطر شرقي', 'قصير'), 'no empty/short answers');
  assert.ok(!worthRemembering('صمم لي عطر شرقي', `${LONG} undefined`), 'no raw code values');
});

test('exact recall: same question → the saved answer; stale, council and time-bound are not served', () => {
  const file = emptyMemory();
  const now = new Date('2026-10-16T10:00:00Z');
  assert.ok(remember(file, { question: 'صمم لي عطر شرقي', lang: 'ar', mode: 'auto', answer: LONG }, now));
  assert.ok(!remember(file, { question: 'صمم لي عطر شرقي', lang: 'ar', mode: 'council', answer: LONG }, now));
  assert.ok(!remember(file, { question: 'ايه اخبار العطور', lang: 'ar', mode: 'auto', answer: LONG }, now));
  assert.equal(file.entries.length, 1);
  assert.equal(recall(file, 'صمّم لي عطر شرقي؟', 'ar', 'auto', now.getTime())?.answer, LONG);
  assert.equal(recall(file, 'صمم لي عطر شرقي', 'ar', 'council', now.getTime()), undefined);
  assert.equal(recall(file, 'صمم لي عطر شرقي', 'ar', 'auto', now.getTime() + 31 * DAY), undefined, 'older than 30 days → asked fresh');
  // Remembering again refreshes the answer, keeps one entry and its uses.
  touch(file.entries[0]);
  remember(file, { question: 'صمم لي عطر شرقي', lang: 'ar', mode: 'auto', answer: `${LONG} جديد` }, now);
  assert.equal(file.entries.length, 1);
  assert.equal(file.entries[0].hits, 1);
});

test('offline recall finds a close wording, never a calculation for other numbers', () => {
  const file = emptyMemory();
  remember(file, { question: 'ازاي اخلي العطر يثبت على جلدي اكتر', lang: 'ar', mode: 'auto', answer: LONG });
  remember(file, { question: 'احسب تكلفة عطر 50 مل تركيز 20%', lang: 'ar', mode: 'auto', answer: `${LONG} 50` });
  assert.ok(recallSimilar(file, 'ازاي اخلي العطر يثبت اكتر على الجلد', 'ar'));
  assert.equal(recallSimilar(file, 'احسب تكلفة عطر 100 مل تركيز 20%', 'ar'), undefined);
  assert.equal(recallSimilar(file, 'احسب تكلفة عطر ٥٠ مل تركيز ٢٠%', 'ar')?.score, 1);
  assert.equal(recallSimilar(file, 'ازاي اخلي العطر يثبت على جلدي اكتر', 'en'), undefined, 'other language');
  assert.equal(recallSimilar(file, 'ما هو افضل كحول للعطور', 'ar'), undefined, 'unrelated');
  assert.equal(similarity('تكلفة 50 مل', 'تكلفة 100 مل'), 0);
  assert.match(offlineNote('ar', false), /ذاكرة شاهين/);
});

test('merging copies keeps every answer and the newest text; curation forgets unused and failing answers', () => {
  const a: MemoryFile = emptyMemory(); const b: MemoryFile = emptyMemory();
  remember(a, { question: 'صمم لي عطر شرقي', lang: 'ar', mode: 'auto', answer: LONG }, new Date('2026-10-01T00:00:00Z'));
  remember(b, { question: 'صمم لي عطر شرقي', lang: 'ar', mode: 'auto', answer: `${LONG} أحدث` }, new Date('2026-10-02T00:00:00Z'));
  remember(b, { question: 'اقترح نوتات لعطر صيفي', lang: 'ar', mode: 'auto', answer: LONG }, new Date('2026-08-01T00:00:00Z'));
  a.entries[0].hits = 5;
  const merged = mergeMemory(a, b);
  assert.equal(merged.entries.length, 2);
  const oriental = merged.entries.find((e) => e.question === 'صمم لي عطر شرقي')!;
  assert.equal(oriental.answer, `${LONG} أحدث`);
  assert.equal(oriental.hits, 5, 'uses are not lost');
  merged.entries.push({ ...oriental, id: 'bad', question: 'سؤال آخر للعطور', answer: `${LONG} ChatGPT` });
  const { file, removed } = curateMemory(merged, Date.parse('2026-10-16T00:00:00Z'));
  assert.equal(removed, 2, 'the summer answer was unused for 60+ days and the vendor answer fails the checks');
  assert.deepEqual(file.entries.map((e) => e.question), ['صمم لي عطر شرقي']);
});

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
async function withShaheen(memory: ShaheenMemory, fetch: typeof globalThis.fetch, run: (base: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  // The per-instance answer cache is off so only the memory can answer a repeated question.
  app.use('/api', createShaheenRouter({ repo: new Repository(new MemoryStore(), {}), env: { OPENAI_API_KEY: 'sk-test', SHAM_ANSWER_CACHE_MINUTES: '0' }, fetch, memory }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`); }
  finally { await new Promise((done) => server.close(done)); }
}
const chat = (base: string, body: Record<string, unknown>) => fetch(`${base}/chat`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ model: 'auto', language: 'ar', conversationHistory: [], ...body }),
});

test('the server answers a repeated question from memory with no AI call, and from the closest memory when no engine answers', async () => {
  let calls = 0; let down = false;
  const engine = (async () => { calls++; return down ? json({ error: { message: 'down' } }, 500) : json({ choices: [{ message: { role: 'assistant', content: LONG } }] }); }) as typeof fetch;
  const memory = new ShaheenMemory(new MemoryStore(), {}, engine, emptyMemory());
  await withShaheen(memory, engine, async (base) => {
    const first = await chat(base, { message: 'ازاي اخلي العطر يثبت على جلدي اكتر' });
    assert.equal(first.status, 200);
    assert.equal(calls, 1);
    const again = await (await chat(base, { message: 'ازاي اخلي العطر يثبت على جلدي اكتر؟' })).json();
    assert.equal(calls, 1, 'the repeated question cost no AI call');
    assert.equal(again.memory, 'exact');
    assert.equal(again.engine.provider, 'shaheen', 'still Shaheen, no vendor');
    assert.equal((await memory.learned()).entries[0].hits, 1, 'the use is counted (self-improvement)');
    // The supervisor bypasses memory to test the live engines.
    await chat(base, { message: 'ازاي اخلي العطر يثبت على جلدي اكتر', memory: false });
    assert.equal(calls, 2);
    // Every engine down: a close wording is answered from memory, marked as such.
    down = true;
    const offline = await chat(base, { message: 'ازاي اخلي العطر يثبت اكتر على الجلد' });
    assert.equal(offline.status, 200);
    const body = await offline.json();
    assert.ok(body.reply.startsWith(LONG.slice(0, 20)));
    assert.match(body.reply, /ذاكرة شاهين/);
    assert.equal(body.memory, 'similar');
    // Nothing close in memory nor in the library: the usual error.
    assert.equal((await chat(base, { message: 'مين اخترع اول زجاجة رش في التاريخ' })).status, 503);
  });
});

test('the shared memory file answers questions this server never saw; follow-ups are not served from memory', async () => {
  const shared = emptyMemory();
  remember(shared, { question: 'اقترح نوتات لعطر صيفي منعش', lang: 'ar', mode: 'auto', answer: LONG, source: 'probe' });
  let calls = 0;
  const engine = (async () => { calls++; return json({ choices: [{ message: { role: 'assistant', content: `${LONG} مختلف` } }] }); }) as typeof fetch;
  await withShaheen(new ShaheenMemory(new MemoryStore(), {}, engine, shared), engine, async (base) => {
    const hit = await (await chat(base, { message: 'اقترح نوتات لعطر صيفي منعش' })).json();
    assert.equal(hit.reply, LONG);
    assert.equal(calls, 0);
    await chat(base, { message: 'اقترح نوتات لعطر صيفي منعش', conversationHistory: [{ role: 'user', text: 'مرحبا' }, { role: 'assistant', text: 'أهلاً' }] });
    assert.equal(calls, 1, 'inside a conversation the context matters: asked live');
  });
});

test('the browser answers from its memory when the server cannot be reached, and learns opening answers', async () => {
  const learned: string[] = [];
  const memory: OfflineMemory = {
    learn: (i) => { learned.push(i.question); },
    recall: async (q) => (q === 'ازاي اخلي العطر يثبت' ? { answer: LONG, exact: false } : undefined),
  };
  const errorText = () => 'خطأ';
  let fail: unknown;
  const request = (async () => { if (fail) throw fail; return { reply: LONG }; }) as typeof requestApi;
  const store = createChatStore(request, async () => undefined, memory);
  await store.send({ text: 'ازاي اخلي العطر يثبت', model: 'auto', language: 'ar', errorText });
  assert.deepEqual(learned, ['ازاي اخلي العطر يثبت']);
  await store.send({ text: 'سؤال تاني', model: 'auto', language: 'ar', errorText });
  assert.equal(learned.length, 1, 'a follow-up inside a conversation is not learned');
  store.clear();
  fail = new TypeError('Failed to fetch');
  await store.send({ text: 'العطر مش بيثبت ليه', model: 'auto', language: 'ar', errorText });
  assert.equal(store.getSnapshot().messages.at(-1)?.text, 'خطأ', 'nothing close → the error bubble');
  await store.send({ text: 'ازاي اخلي العطر يثبت', model: 'auto', language: 'ar', errorText });
  const last = store.getSnapshot().messages.at(-1)!;
  assert.ok(last.text.startsWith(LONG) && /ذاكرة شاهين/.test(last.text) && last.kind === undefined);
  assert.equal(last.aiEngine?.provider, 'shaheen');
  assert.ok(canAnswerFromMemory(new ApiError(503, 'PROVIDER_UNAVAILABLE')) && canAnswerFromMemory(new TypeError('x')));
  assert.ok(!canAnswerFromMemory(new ApiError(429, 'RATE_LIMITED')) && !canAnswerFromMemory(new ApiError(503, 'SHAHEEN_DISABLED')) && !canAnswerFromMemory(new ApiError(400)));
});

test('a mode whose engines are down falls back to the fast mode, then to memory — never straight to an error', async () => {
  const memory: OfflineMemory = { learn: () => undefined, recall: async () => ({ answer: LONG, exact: false }) };
  const asked: string[] = [];
  let fastWorks = true;
  const request = (async (_e: string, init?: RequestInit) => {
    const model = JSON.parse(String(init?.body)).model as string;
    asked.push(model);
    if (model === 'fast' && fastWorks) return { reply: 'إجابة سريعة من شاهين عن الثبات والترطيب قبل الرش على أماكن النبض.', engine: { id: 'fast', name: 'الخبير شاهين', badge: 'شاهين', provider: 'shaheen' } };
    throw new ApiError(503, 'PROVIDER_UNAVAILABLE');
  }) as typeof requestApi;
  const store = createChatStore(request, async () => undefined, memory);
  await store.send({ text: 'ازاي العطر يثبت؟', model: 'deep', language: 'ar', errorText: () => 'خطأ' });
  assert.deepEqual(asked, ['deep', 'fast']);
  assert.match(store.getSnapshot().messages.at(-1)!.text, /إجابة سريعة/);
  fastWorks = false; asked.length = 0;
  await store.send({ text: 'سؤال جديد عن العود', model: 'auto', language: 'ar', errorText: () => 'خطأ' });
  assert.deepEqual(asked, ['auto', 'fast']);
  assert.ok(/ذاكرة شاهين/.test(store.getSnapshot().messages.at(-1)!.text), 'fast down too → memory');
  asked.length = 0;
  await store.send({ text: 'سؤال سريع', model: 'fast', language: 'ar', errorText: () => 'خطأ' });
  assert.deepEqual(asked, ['fast'], 'the fast mode itself is not asked twice');
});

test('the bots reuse an identical AI request from memory (even with every quota paused) and forget unusable replies', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-memory-'));
  try {
    const path = pathToFileURL(join(dir, 'ai-memory.json'));
    let now = Date.parse('2026-10-16T00:00:00Z');
    const book = answerBook(path, () => now);
    let calls = 0;
    const request = (async () => { calls++; return json({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] }, finishReason: 'STOP' }] }); }) as typeof fetch;
    const ask = (await makeAsk({ GEMINI_API_KEY: 'k' }, { memory: book, request }))!;
    assert.equal(await ask('sys', 'prompt'), '{"ok":true}');
    assert.equal(await ask('sys', 'prompt'), '{"ok":true}');
    assert.equal(calls, 1, 'the second identical request cost no AI call');
    book.forget('sys', 'prompt');
    await ask('sys', 'prompt');
    assert.equal(calls, 2, 'a forgotten reply is asked again');
    book.save();
    const saved = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(saved.entries.length, 1);
    assert.ok(!JSON.stringify(saved).includes('prompt'), 'only a hash of the request is stored');
    // No engine at all (no key): what is remembered still answers.
    const offline = (await makeAsk({}, { memory: answerBook(path, () => now) }))!;
    assert.equal(await offline('sys', 'prompt'), '{"ok":true}');
    now += 31 * DAY;
    await assert.rejects(offline('sys', 'prompt'), 'older than 30 days is asked fresh');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
