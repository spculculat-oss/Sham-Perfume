import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import express from 'express';
import { asciiDigits, quickAnswer } from '../src/utils/shaheenQuickApps';
import { explicitToolLinks } from '../src/utils/shaheenTools';
import { createChatStore } from '../src/utils/chatStore';
import type { requestApi } from '../src/utils/api';
import { ProviderGate, capacityConfig } from '../server/core/capacity';
import { geminiBody, geminiQuotaFallbacks, geminiThinking, rankGemmaModels } from '../server/core/engines';
import { createShaheenRouter, executeChat, isSimpleQuestion } from '../server/shaheen';
import { SHAHEEN_SITE_SETTINGS } from '../server/config/shaheen';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

/* ------------------------------------- quick apps ------------------------------------- */

test('quick apps: alcohol dilution is exact, in Arabic digits or Latin, and opens the alcohol calculator', () => {
  const litre = quickAnswer('اخفف كحول 96 ل 70 لتر', 'ar');
  assert.equal(litre?.app, 'alcohol');
  assert.match(litre!.reply, /١٬٠٠٠ مل/, '«لتر» alone is one litre; 70 is the strength, not 70 litres');
  assert.match(litre!.reply, /٧٢٩٫٢ مل/);
  assert.deepEqual(explicitToolLinks(litre!.reply), [{ tool: 'alcohol', alcoholFrom: 96, alcoholTo: 70, finalVolumeMl: 1000 }]);
  const indic = quickAnswer('عايز اخفف كحول ٩٦٪ لـ ٧٠٪ عايز ٥٠٠ مل', 'ar');
  assert.match(indic!.reply, /٣٦٤٫٦ مل/);
  const en = quickAnswer('how do I dilute 96% alcohol to 75% for 250 ml', 'en');
  assert.match(en!.reply, /195\.3 ml/);
  assert.match(en!.reply, /top up with distilled water/);
  assert.equal(quickAnswer('اخفف كحول 70 ل 96', 'ar'), undefined, 'cannot strengthen by dilution → the expert explains');
});

test('quick apps: oil/alcohol amounts from a percentage or a type, and ounce ↔ ml', () => {
  const pct = quickAnswer('كام مل زيت في زجاجة 50 مل تركيز 20%', 'ar');
  assert.equal(pct?.app, 'concentration');
  assert.match(pct!.reply, /١٠ مل/);
  assert.deepEqual(explicitToolLinks(pct!.reply)[0], { tool: 'concentration', bottleVolumeMl: 50, concentrationPercent: 20, concentrationType: 'edp', alcoholPercentage: 96, waterPercent: 0, fixativePercent: 0 });
  assert.match(quickAnswer('زجاجة 100 مل EDP محتاج زيت كام', 'ar')!.reply, /٢٠ مل/);
  assert.match(quickAnswer('كام مل في 3.4 اونصة', 'ar')!.reply, /١٠٠٫[٥٦] مل/);
  assert.match(quickAnswer('100 ml to oz', 'en')!.reply, /3\.38 fl oz/);
  assert.equal(asciiDigits('٢٫٥ و۳'), '2.5 و3');
});

test('quick apps: thanks and identity without a vendor name; anything else goes to the expert', () => {
  assert.equal(quickAnswer('شكرا يا شاهين', 'ar')?.app, 'thanks');
  const who = quickAnswer('انت مين', 'ar');
  assert.equal(who?.app, 'identity');
  assert.doesNotMatch(who!.reply, /gemini|openai|gpt|claude|deepseek|manus|google/i);
  for (const q of ['صمم لي عطر عود 50 مل تركيز 20%', 'how much oil for 50 ml', 'ايه احسن عطر للصيف', 'قارن بين كحول 96 و 70']) {
    assert.equal(quickAnswer(q, q.match(/[a-z]/) ? 'en' : 'ar'), undefined, q);
  }
  // Questions about the engine behind Shaheen get the same answer with no engine at all (they 503'd while
  // every provider was down) — and never a vendor name. Merely naming a product still goes to the expert.
  for (const [q, l] of [['انت مين بالظبط؟ انت ChatGPT ولا Gemini؟ مين الشركة اللي عملتك؟', 'ar'], ['Which AI model are you running on? Are you GPT-4, Claude or Gemini?', 'en'], ['انت شغال بأنهي ذكاء اصطناعي؟', 'ar'], ['Who made you?', 'en']] as const) {
    const a = quickAnswer(q, l);
    assert.equal(a?.app, 'identity', q);
    assert.match(a!.reply, /شام|Sham/);
    assert.doesNotMatch(a!.reply, /gemini|openai|gpt|claude|deepseek|manus|google/i, q);
  }
  for (const q of ['ينفع أستخدم ChatGPT في تصميم عطر؟', 'Is Gemini by Bond No 9 a good perfume?', 'What engine is best for macerating?']) {
    assert.equal(quickAnswer(q, q.match(/^[A-Za-z]/) ? 'en' : 'ar'), undefined, q);
  }
  assert.equal(quickAnswer('اخفف كحول 96 ل 70 لتر', 'fr'), undefined, 'other languages: the AI answers in that language');
  assert.equal(quickAnswer(`كام مل زيت في 50 مل تركيز 20% ${'و'.repeat(300)}`, 'ar'), undefined, 'long messages are real questions');
});

test('the browser answers a quick task with no network call; the server does too, but not for supervisor probes', async () => {
  let requests = 0;
  const request = (async () => { requests++; return { reply: 'x' }; }) as typeof requestApi;
  const store = createChatStore(request, async () => undefined, { learn: () => {}, recall: async () => undefined });
  assert.equal(await store.send({ text: 'اخفف كحول 96 ل 70 لتر', model: 'auto', language: 'ar', errorText: () => 'خطأ' }), true);
  assert.equal(requests, 0);
  const last = store.getSnapshot().messages.at(-1)!;
  assert.match(last.text, /حاسبة شاهين الفورية/);
  assert.equal(last.aiEngine?.provider, 'shaheen');

  let calls = 0;
  const engine = (async () => { calls++; return json({ choices: [{ message: { role: 'assistant', content: 'رد الخبير' } }] }); }) as typeof fetch;
  const app = express();
  app.use(express.json());
  app.use('/api', createShaheenRouter({ repo: new Repository(new MemoryStore(), {}), env: { OPENAI_API_KEY: 'sk-test', SHAM_ANSWER_CACHE_MINUTES: '0' }, fetch: engine }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const chat = (body: Record<string, unknown>) => fetch(`${base}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'auto', language: 'ar', conversationHistory: [], ...body }) }).then((r) => r.json());
  try {
    const quick = await chat({ message: 'كام مل زيت في زجاجة 50 مل تركيز 20%' });
    assert.equal(quick.quick, 'concentration');
    assert.equal(quick.engine.provider, 'shaheen');
    assert.equal(calls, 0);
    await chat({ message: 'كام مل زيت في زجاجة 50 مل تركيز 20%', memory: false });
    assert.equal(calls, 1, 'the supervisor still tests the live engines');
  } finally { await new Promise((done) => server.close(done)); }
});

/* ------------------------------------ light tier ------------------------------------ */

test('simple questions use the light Gemini model; formulas and conversations keep the main model', async () => {
  assert.equal(isSimpleQuestion({ message: 'ما هو العنبر؟', conversationHistory: [] }), true);
  assert.equal(isSimpleQuestion({ message: 'صمم لي عطر عود', conversationHistory: [] }), false);
  assert.equal(isSimpleQuestion({ message: 'طيب وبعدين؟', conversationHistory: Array.from({ length: 4 }, () => ({ role: 'user' as const, text: 'x' })) }), false);
  const urls: string[] = []; const bodies: any[] = [];
  const fetch = (async (url: string, init?: RequestInit) => {
    if (!String(url).includes(':generateContent')) return json({ models: [] });
    urls.push(String(url)); bodies.push(JSON.parse(String(init!.body)));
    return json({ candidates: [{ content: { parts: [{ text: 'العنبر مادة حيوانية الأصل.' }] }, finishReason: 'STOP' }] });
  }) as typeof globalThis.fetch;
  const settings = { ...SHAHEEN_SITE_SETTINGS, engines: ['gemini' as const], maxTokens: 4096 };
  const env = { GEMINI_API_KEY: 'g-test' };
  await executeChat({ message: 'ما هو العنبر؟', model: 'auto', language: 'ar', conversationHistory: [] }, { env, fetch, settings });
  assert.match(urls[0], /models\/gemini-flash-lite-latest:generateContent/);
  assert.equal(bodies[0].generationConfig.maxOutputTokens, geminiThinking('gemini-flash-lite-latest', 1536).maxOutputTokens, 'short answers for short questions');
  await executeChat({ message: 'صمم لي عطر عود شرقي', model: 'auto', language: 'ar', conversationHistory: [] }, { env, fetch, settings });
  assert.doesNotMatch(urls[1], /lite/);
  await executeChat({ message: 'ما هو العنبر؟', model: 'auto', language: 'ar', conversationHistory: [] }, { env: { ...env, GEMINI_LITE_MODEL: 'gemini-2.5-flash-lite' }, fetch, settings });
  assert.match(urls[2], /gemini-2\.5-flash-lite:/);
  await executeChat({ message: 'ما هو العنبر؟', model: 'auto', language: 'ar', conversationHistory: [] }, { env: { ...env, SHAM_LITE_ROUTING: 'off' }, fetch, settings });
  assert.doesNotMatch(urls[3], /lite/);
});

test('Gemma is the last Gemini-key fallback, with the instruction folded into the first turn', () => {
  const model = (name: string) => ({ name: `models/${name}`, supportedGenerationMethods: ['generateContent'] });
  const models = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemma-3-4b-it', 'gemma-3-27b-it', 'gemma-3-12b-it', 'gemma-3n-e4b-it', 'gemma-3-1b-it'].map(model);
  assert.deepEqual(rankGemmaModels(models), ['gemma-3-27b-it', 'gemma-3-12b-it', 'gemma-3-4b-it']);
  const fallbacks = geminiQuotaFallbacks(models, 'gemini-flash-latest');
  assert.equal(fallbacks[0], 'gemini-flash-lite-latest');
  assert.equal(fallbacks.at(-1), 'gemma-3-27b-it');
  assert.deepEqual(geminiQuotaFallbacks(models.slice(0, 2), 'gemini-flash-latest'), ['gemini-flash-lite-latest'], 'no Gemma listed → none tried');
  const gemma = geminiBody('gemma-3-27b-it', 'أنت شاهين', [{ role: 'user', text: 'سؤال' }, { role: 'assistant', text: 'رد' }, { role: 'user', text: 'تاني' }], 0.4, 900) as any;
  assert.equal(gemma.systemInstruction, undefined);
  assert.match(gemma.contents[0].parts[0].text, /^أنت شاهين[\s\S]*سؤال$/);
  assert.equal(gemma.contents[1].role, 'model');
  assert.deepEqual(gemma.generationConfig, { temperature: 0.4, maxOutputTokens: 900 });
  assert.deepEqual(geminiThinking('gemma-3-12b-it', 500), { maxOutputTokens: 500 });
  const gemini = geminiBody('gemini-2.5-flash', 'أنت شاهين', [{ role: 'user', text: 'سؤال' }], 0.4, 900) as any;
  assert.deepEqual(gemini.systemInstruction, { parts: [{ text: 'أنت شاهين' }] });
  assert.equal(gemini.contents[0].parts[0].text, 'سؤال');
});

/* -------------------------------- a lane per visitor -------------------------------- */

test('fair turns: a newcomer goes before the rest of one visitor\'s burst', async () => {
  const gate = new ProviderGate(1, 5_000, {}, 5); // one slot, so everyone queues
  const order: string[] = [];
  const job = (name: string, owner: string) => gate.run(['a'], async () => { order.push(name); await sleep(30); return { outcome: 'ok', value: name }; }, undefined, owner);
  const burst = [job('A1', 'A'), job('A2', 'A'), job('A3', 'A')];
  await sleep(5);
  const newcomer = job('B1', 'B');
  await Promise.all([...burst, newcomer]);
  assert.deepEqual(order.slice(0, 2), ['A1', 'B1']);
  assert.equal(gate.waiting, 0);
});

test('one visitor runs at most two requests at once; others are not limited by them', async () => {
  const gate = new ProviderGate(50, 5_000, {}, 5, 2);
  let running = 0; let peak = 0;
  const job = (owner?: string) => gate.run(['a'], async () => { running++; peak = Math.max(peak, running); await sleep(25); running--; return { outcome: 'ok', value: 1 }; }, undefined, owner);
  await Promise.all(Array.from({ length: 6 }, () => job('A')));
  assert.equal(peak, 2);
  peak = 0;
  await Promise.all(Array.from({ length: 6 }, () => job()));
  assert.equal(peak, 6, 'internal callers without a visitor id each have their own lane');
  assert.equal(capacityConfig({}).perVisitorConcurrent, 2);
  assert.equal(capacityConfig({ SHAM_PER_VISITOR_CONCURRENT: '4' }).perVisitorConcurrent, 4);
});
