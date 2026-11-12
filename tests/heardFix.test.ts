import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, test } from 'node:test';
import express from 'express';
import {
  askMessages, confirmAnswer, confirmQuestion, fixHeard, heardDistance, heardNote, learnablePair, lookingUpLine, lookupFiller,
  needsLookup, planVoiceTurn, readingsFrom,
} from '../src/utils/heardFix';
import { emptyMemory, recallSimilar, remember, type MemoryFile } from '../src/utils/shaheenMemory';
import { buildLexicon } from '../src/utils/shaheenSpelling';
import { ShaheenMemory } from '../server/core/memory';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { createShaheenRouter, validateChatRequest } from '../server/shaheen';
import { chatHistory, createChatStore } from '../src/utils/chatStore';
import type { requestApi } from '../src/utils/api';

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
beforeEach(() => {
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  } });
});
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else delete (globalThis as { localStorage?: unknown }).localStorage;
});

// ── «شاهين يصحح اللي اتسمع غلط» ────────────────────────────────────────────────────────────────────────
test('sound-alike letters cost little, other changes a full step', () => {
  assert.equal(heardDistance('عوض', 'عود'), 0.4, 'ض / د are heard alike');
  assert.equal(heardDistance('مسق', 'مسك'), 0.4, 'Egyptian ق / ك');
  assert.equal(heardDistance('vanila', 'vanilla'), 0.4, 'a doubled letter heard once');
  assert.equal(heardDistance('عطر', 'عسل'), 2);
});

test('a word that makes no sense is replaced by the closest one that does («عايز عطر عوض ثابت» → «عود»)', () => {
  const read = fixHeard('عايز عطر عوض ثابت');
  assert.equal(read.text, 'عايز عطر عود ثابت');
  assert.deepEqual(read.fixes, [{ from: 'عوض', to: 'عود', sure: true }]);
  assert.equal(fixHeard('عايز عطر فيه مسق').text, 'عايز عطر فيه مسك');
  assert.equal(fixHeard('بكام عطر الأود').text, 'بكام عطر العود', 'the article stays');
  assert.equal(fixHeard('عايز ريحة صندل و ورض').text, 'عايز ريحة صندل و ورد');
});

test('sensible sentences, dialect words and everyday spellings are left exactly as said', () => {
  for (const said of ['أنا عايز أشتري هدية لمراتي', 'وش عندكم من العطور الحين', 'شو بدك', 'عايز برفان سنتي', 'عايز اعرف السعر بتاع العطر ده', 'بيفوح جامد']) {
    const read = fixHeard(said);
    assert.equal(read.text, said, said);
    assert.equal(read.ask, undefined, said);
  }
});

test('the engine reading that makes sense wins over its first guess', () => {
  assert.deepEqual(readingsFrom([['عايز عطر عصر', 'عايز عطر عود'], ['ثابت']]), ['عايز عطر عصر ثابت', 'عايز عطر عود ثابت']);
  assert.equal(fixHeard('عايز عطر عصر', { alternatives: ['عايز عطر عطر', 'عايز عطر عود'] }).text, 'عايز عطر عود', 'an echo («عطر عطر») is not sense');
});

test('words visitors confirmed before are applied at once', () => {
  const read = fixHeard('عايز عطر فيه زعفلان', { learned: { زعفلان: 'زعفران' } });
  assert.equal(read.text, 'عايز عطر فيه زعفران');
  assert.equal(read.fixes[0]?.sure, true);
});

test('an unsure perfume word is asked first, and yes / no / «لا، عنبر» continue the turn', () => {
  const asked = planVoiceTurn('I want a perfume with vetivr', { language: 'en' });
  assert.equal(asked.action, 'ask');
  if (asked.action !== 'ask') return;
  assert.equal(asked.say, 'Did you mean “vetiver”?');
  const yes = planVoiceTurn('yes', { language: 'en', pending: asked.pending });
  assert.deepEqual(yes, { action: 'send', text: 'I want a perfume with vetiver', heard: [{ from: 'vetivr', to: 'vetiver', confirmed: true }] });
  const no = planVoiceTurn('no', { language: 'en', pending: asked.pending });
  assert.deepEqual(no, { action: 'send', text: 'I want a perfume with vetivr', heard: [] });
  const other = planVoiceTurn('no, vanilla', { language: 'en', pending: asked.pending });
  assert.equal(other.action === 'send' && other.text, 'I want a perfume with vanilla');
  assert.equal(other.action === 'send' && other.heard[0]?.confirmed, undefined, 'a change of mind is not learned as a mishearing');
  // Neither yes nor no: a new sentence.
  assert.equal(planVoiceTurn('بكام العود', { language: 'ar', pending: asked.pending }).action, 'send');
});

test('yes and no are understood in the dialects and languages', () => {
  for (const said of ['أيوه بالظبط', 'اه صح', 'ايوا', 'نعم', 'yes', 'oui', 'evet', 'آره']) assert.equal(confirmAnswer(said), 'yes', said);
  for (const said of ['لا مش كده', 'لأ', 'no', 'non', 'нет']) assert.equal(confirmAnswer(said), 'no', said);
  assert.equal(confirmAnswer('عايز حاجة تانية'), undefined);
  assert.equal(confirmQuestion('ar', 'egyptian', 'عود'), 'قصدك «عود»؟');
  assert.equal(confirmQuestion('ar', 'gulf', 'عود'), 'تقصد «عود»؟');
  assert.equal(confirmQuestion('hi' as never, undefined, 'oud'), 'Did you mean “oud”?', 'a language without its own line uses English');
});

test('store product names count as sensible words', () => {
  const lexicon = buildLexicon({ extra: ['Hawas Ice', 'حواس آيس'] });
  assert.equal(fixHeard('عايز حواس آيس', { lexicon }).text, 'عايز حواس آيس');
});

test('the corrected words are shown with the message (and never sent back as part of what he said)', async () => {
  let body: Record<string, any> = {};
  const store = createChatStore((async (_url: string, init?: RequestInit) => { body = JSON.parse(String(init?.body)); return { reply: 'تمام' }; }) as typeof requestApi);
  store.setMessages([]);
  await store.send({ text: 'عايز عطر عود ثابت', model: 'auto', language: 'ar', errorText: () => 'x',
    voice: { heard: [{ from: 'عوض', to: 'عود' }] } });
  assert.equal(body.message, 'عايز عطر عود ثابت');
  assert.deepEqual(body.voice, { heard: [{ from: 'عوض', to: 'عود' }] });
  const shown = store.getSnapshot().messages.find((message) => message.role === 'user');
  assert.equal(shown?.text, 'عايز عطر عود ثابت\n\n🎧 سمعت «عوض» وفهمتها «عود»');
  assert.equal(chatHistory(store.getSnapshot().messages)[0]?.text, 'عايز عطر عود ثابت');
  assert.equal(heardNote('en', [{ from: 'vetivr', to: 'vetiver' }]), '🎧 I heard «vetivr» and took it as «vetiver»');
  const [heard, ask] = askMessages('عايز برفيوم فيه عمبل', 'قصدك «عنبر»؟', 'ar');
  assert.equal(heard?.role, 'user');
  assert.equal(ask?.role, 'assistant');
  assert.equal(ask?.aiEngine?.provider, 'shaheen');
});

test('only a single known word is ever learned as a correction', () => {
  assert.deepEqual(learnablePair('عوض', 'عود'), { from: 'عوض', to: 'عود' });
  assert.equal(learnablePair('عوض', 'محمد'), undefined, 'never into a name or an unknown word');
  assert.equal(learnablePair('عوض عوض', 'عود'), undefined);
  assert.equal(learnablePair('عود', 'عود'), undefined);
  assert.equal(learnablePair('12345', 'عود'), undefined);
});

// ── «استنى شوية هدخل أشوف البيانات» ───────────────────────────────────────────────────────────────────
test('the looking-up line is said only when the question really needs a look-up, in his dialect', () => {
  for (const said of ['بكام العطر ده', 'عندكم عود؟', 'وعندكم مسك؟', 'how much is it', 'is it in stock', 'ترشحلي عطر هدية']) assert.ok(needsLookup(said), said);
  for (const said of ['المفتاح ضاع', 'الدورة الجاية', 'هو العطر بيثبت ازاي', 'I like costumes', 'إيه الفرق بين العود والعنبر']) assert.ok(!needsLookup(said), said);
  assert.equal(lookupFiller('ar', 'egyptian'), 'ثواني أدخل أشوفلك البيانات.');
  assert.equal(lookupFiller('ar', 'gulf'), 'لحظة أشيّك لك على البيانات.');
  assert.equal(lookupFiller('en'), 'One moment, let me check the details.');
  const plan = planVoiceTurn('بكام عطر عوض', { language: 'ar', dialect: 'gulf' });
  assert.deepEqual(plan, { action: 'send', text: 'بكام عطر عود', heard: [{ from: 'عوض', to: 'عود' }], filler: 'لحظة أشيّك لك على البيانات.' });
  assert.equal(planVoiceTurn('العطر بيثبت ازاي', { language: 'ar' }).action === 'send' && 'filler' in planVoiceTurn('العطر بيثبت ازاي', { language: 'ar' }), false);
  assert.equal(lookingUpLine([{ role: 'user', text: 'بكام العود؟' }, { role: 'assistant', text: 'x' }, { role: 'user', text: 'عندكم مسك؟' }], 'ar', 'levantine'), 'لحظة خليني شوفلك المعلومات.');
  assert.equal(lookingUpLine([{ role: 'user', text: 'ازاي العطر يثبت؟' }], 'ar'), undefined);
});

// ── «شاهين بيتعلم من المنصات» ───────────────────────────────────────────────────────────────────────
const LONG = 'العود الكمبودي له رائحة دخانية عميقة تدوم طويلاً على الجلد، ويُستخدم في القاعدة مع الورد والعنبر والمسك لعطر شرقي فاخر وثابت.';
test('a remembered answer said in the visitor\'s dialect (and for voice) is preferred among close ones', () => {
  const file: MemoryFile = emptyMemory();
  remember(file, { question: 'ايه افضل عطر عود للشتا', lang: 'ar', mode: 'auto', answer: `${LONG} مصري` });
  remember(file, { question: 'ايه افضل عطر عود للشتا', lang: 'ar', mode: 'fast', answer: `${LONG} خليجي`, dialect: 'gulf', spoken: true });
  assert.equal(file.entries[0]?.dialect, undefined, 'Egyptian is the default and is not stored');
  assert.equal(file.entries[1]?.dialect, 'gulf');
  assert.match(recallSimilar(file, 'ايه افضل عطر عود للشتا', 'ar', undefined, { dialect: 'gulf', spoken: true })!.entry.answer, /خليجي/);
  assert.match(recallSimilar(file, 'ايه افضل عطر عود للشتا', 'ar', undefined, { dialect: 'egyptian' })!.entry.answer, /مصري/);
});

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
test('platform answers are learned with how they were said; confirmed words are shared after several visitors', async () => {
  const engine = (async () => json({ choices: [{ message: { role: 'assistant', content: LONG } }] })) as typeof fetch;
  const memory = new ShaheenMemory(new MemoryStore(), {}, engine, emptyMemory());
  const app = express();
  app.use(express.json());
  app.use('/api', createShaheenRouter({ repo: new Repository(new MemoryStore(), {}), env: { OPENAI_API_KEY: 'sk-test', SHAM_ANSWER_CACHE_MINUTES: '0' }, fetch: engine, memory }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const chat = (body: Record<string, unknown>, visitorId: string) => fetch(`${base}/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'auto', language: 'ar', conversationHistory: [], visitorId, ...body }),
  });
  try {
    const said = await chat({ message: 'ازاي اخلي العطر يثبت على جلدي اكتر', dialect: 'gulf', voice: { heard: [{ from: 'عوض', to: 'عود', confirmed: true }] } }, 'v-visitor-0001');
    assert.equal(said.status, 200);
    // The answer is kept right after it is sent.
    let entry = (await memory.learned()).entries[0];
    for (let i = 0; !entry && i < 50; i++) { await new Promise((done) => setTimeout(done, 20)); entry = (await memory.learned()).entries[0]; }
    assert.equal(entry?.dialect, 'gulf');
    assert.equal(entry?.spoken, true);
    // The same visitor confirming again does not count twice.
    await chat({ message: 'عايز عطر عود فخم', voice: { heard: [{ from: 'عوض', to: 'عود', confirmed: true }] } }, 'v-visitor-0001');
    assert.deepEqual((await (await fetch(`${base}/heard-fixes`)).json()).fixes, {});
    await chat({ message: 'عايز عطر عود للسهرة', voice: { heard: [{ from: 'عوض', to: 'عود', confirmed: true }] } }, 'v-visitor-0002');
    await chat({ message: 'عايز عطر عود للشغل', voice: { heard: [{ from: 'عوض', to: 'عود', confirmed: true }] } }, 'v-visitor-0003');
    assert.deepEqual((await (await fetch(`${base}/heard-fixes`)).json()).fixes, { عوض: 'عود' });
  } finally { await new Promise((done) => server.close(done)); }
  // A guess Shaheen made himself (not confirmed) is never learned, and a bad pair is refused.
  assert.equal(await memory.learnCorrection('عوض', 'فلان الفلاني'), false);
});

test('the heard corrections travel safely in the request', () => {
  const request = validateChatRequest({ message: 'عايز عطر عود', voice: { heard: [{ from: 'عوض', to: 'عود', confirmed: true }, { from: 1 }, { from: 'x'.repeat(40), to: 'y' }] } });
  assert.deepEqual(request.voice, { heard: [{ from: 'عوض', to: 'عود', confirmed: true }] });
});

test('a misheard word is guessed from the conversation just now', () => {
  const context = ['عندنا عطر لطافة بديع العود وعطر أمير العرب، الاتنين ثباتهم عالي.'];
  const guessed = planVoiceTurn('عايز بديأ العود', { language: 'ar', context });
  assert.deepEqual(guessed, { action: 'send', text: 'عايز بديع العود', heard: [{ from: 'بديأ', to: 'بديع' }] });
  // Without the conversation it is not guessed (nothing to go on).
  assert.equal(planVoiceTurn('عايز بديأ العود', { language: 'ar' }).action === 'send' && (planVoiceTurn('عايز بديأ العود', { language: 'ar' }) as { text: string }).text, 'عايز بديأ العود');
  // Everyday sentences are left exactly as said.
  for (const said of ['انا عايز عطر للشغل يكون هادي', 'الريحه دي بتفضل قد ايه على الهدوم', 'انا مش فاهم قصدك', 'عايز اشتري هدية لصاحبي']) {
    const plan = planVoiceTurn(said, { language: 'ar', context });
    assert.equal(plan.action === 'send' && plan.text, said, said);
  }
});

test('the engine unsure and the sentence makes no sense: «ممكن تعيد؟» instead of a guess', () => {
  assert.deepEqual(planVoiceTurn('غفص لمحب شطر', { language: 'ar', confidence: 0.3 }), { action: 'repeat', say: 'معلش ماسمعتكش كويس، ممكن تعيد تاني؟' });
  assert.equal(planVoiceTurn('غفص لمحب شطر', { language: 'ar', dialect: 'gulf', confidence: 0.3 }).action === 'repeat', true);
  // A sentence that makes sense is answered even when the engine was unsure; an unknown sureness never asks.
  assert.equal(planVoiceTurn('عايز عطر عود', { language: 'ar', confidence: 0.3 }).action, 'send');
  assert.equal(planVoiceTurn('غفص لمحب شطر', { language: 'ar' }).action, 'send');
});

test('«لا، فيتيفر» that sounds like what was heard is learned as his way of saying it; a change of mind is not', () => {
  const asked = planVoiceTurn('I want a perfume with vetivr', { language: 'en' });
  assert.equal(asked.action, 'ask');
  if (asked.action !== 'ask') return;
  const learned = planVoiceTurn('no, vetiver', { language: 'en', pending: { ...asked.pending, to: 'vanilla', corrected: 'I want a perfume with vanilla' } });
  assert.equal(learned.action === 'send' && learned.heard.at(-1)?.confirmed, true);
});

test('a known word with its usual beginning or ending is never asked about («وثباته»، «حلوة»، «عطوره»)', () => {
  for (const said of ['انا عايز عطر يكون هادي للشغل وثباته عالي', 'ريحته حلوة وثباتها عالي', 'عطوره حلوة']) {
    assert.deepEqual(planVoiceTurn(said, { language: 'ar' }), { action: 'send', text: said, heard: [] }, said);
  }
});
