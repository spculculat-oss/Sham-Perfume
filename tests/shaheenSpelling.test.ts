/**
 * «فهم شاهين للغلطات» — a mistyped question is understood (and what he understood is shown), a correct one is never
 * «corrected», and the school drills it. Fake data only (no network).
 */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import express from 'express';
import { emptyMemory } from '../src/utils/shaheenMemory';
import { baseLexicon, buildLexicon, closestWord, fromEnglishKeyboard, keyboardFix, spellingDrill, typoVariants, understandQuestion, understoodNote, wordDistance } from '../src/utils/shaheenSpelling';
import { research } from '../src/utils/webResearch';
import { ShaheenMemory } from '../server/core/memory';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { createShaheenRouter } from '../server/shaheen';
import { CURRICULUM, exam, spellingExam, spellingReport } from '../scripts/shaheen-school/school';
import { remember } from '../src/utils/shaheenMemory';
import { runPrecheck } from '../scripts/shaheen-council/precheck';

const LOTUS = { id: 'lotus', title: 'زهرة اللوتس في العطور', content: 'زهرة اللوتس زهرة مائية رائحتها مائية ناعمة فيها لمسة بودرية، وبتدخل في العطور الزهرية المنعشة كنوتة قلب.' };
const SRC = { lessons: [LOTUS], materials: [] };
const lex = buildLexicon(SRC);
const read = (q: string, l = lex) => understandQuestion(q, l).text;

test('a mistyped word is read as the word meant', () => {
  assert.equal(read('ايه هي زهرة الوتس'), 'ايه هي زهرة اللوتس', 'the article swallowed the «ل»');
  assert.equal(read('اليمون في العطور', baseLexicon()), 'الليمون في العطور');
  assert.equal(read('زهرهاللوتس'), 'زهره اللوتس', 'two words written together');
  assert.equal(read('ياسمبن', baseLexicon()), 'ياسمين', 'a wrong letter');
  assert.equal(read('معلومات عن الفانيلبا', baseLexicon()), 'معلومات عن الفانيليا', 'with its article kept');
  assert.equal(read('عطررر الياسمين', baseLexicon()), 'عطر الياسمين', 'a held-down key');
  assert.equal(read('ايه هو العووود', baseLexicon()), 'ايه هو العود');
  assert.equal(read('ايه هو الامبروكسن', baseLexicon()), 'ايه هو الامبروكسان', 'a missing letter');
  const u = understandQuestion('زهرة الوتس', lex);
  assert.deepEqual(u.fixes, [{ from: 'الوتس', to: 'اللوتس', how: 'article' }]);
  assert.match(understoodNote('ar', u), /فهمت سؤالك كده: «زهرة اللوتس»/, 'what he understood is shown with the answer');
  assert.equal(understoodNote('ar', understandQuestion('زهرة اللوتس', lex)), '', 'nothing to show when nothing changed');
});

test('a correct question is never «corrected» (and he does not guess when unsure)', () => {
  const curriculum = buildLexicon({ extra: CURRICULUM.map((b) => b.q) });
  for (const b of CURRICULUM) assert.equal(understandQuestion(b.q, curriculum).changed, false, b.q);
  for (const q of ['كيف اصنع عطر من الورد البلدي', 'عايز ريحه زي ريحة المطر', 'الريحة بتروح بسرعة اعمل ايه', 'what is lotus', "What's the difference between EDP and EDT?", 'عطر 100 مل بتركيز 20%', 'ازاي اركب عطر شبه بلو دي شانيل']) {
    assert.equal(understandQuestion(q, baseLexicon()).changed, false, q);
  }
  assert.equal(closestWord(baseLexicon(), 'زز'), undefined, 'too short to guess');
  assert.equal(wordDistance('ياسمبن', 'ياسمين'), 1);
  assert.equal(wordDistance('زهره', 'زهرة'), 0.5, 'letters people mix up cost less');
});

test('Arabic typed with the English keyboard is read as the Arabic meant; English stays English', () => {
  assert.equal(fromEnglishKeyboard('hgg,js'), 'اللوتس');
  assert.equal(keyboardFix('.ivm hgg,js'), 'زهرة اللوتس');
  assert.equal(keyboardFix('Hgg,js'), 'اللوتس', 'a phone capitalising the first letter');
  assert.equal(read('hdi i, hgwk]g'), 'ايه هو الصندل');
  for (const q of ['what is lotus', 'hi', 'Tell me about leather perfumes', 'Dior Sauvage', 'زهرة اللوتس']) assert.equal(keyboardFix(q), undefined, q);
});

test('the server: every engine down, a mistyped question is answered from what he understood (and says so)', async () => {
  const down = (async () => new Response(JSON.stringify({ error: { message: 'down' } }), { status: 500 })) as typeof fetch;
  const repo = new Repository(new MemoryStore(), {});
  const asked: string[] = [];
  const app = express();
  app.use(express.json());
  app.use('/api', createShaheenRouter({
    repo, env: { OPENAI_API_KEY: 'sk-test', SHAM_ANSWER_CACHE_MINUTES: '0' }, fetch: down,
    memory: new ShaheenMemory(new MemoryStore(), {}, down, emptyMemory()), library: async () => SRC,
    research: async (q: string) => { asked.push(q); return undefined; },
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const chat = (message: string) => fetch(`${base}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'auto', language: 'ar', conversationHistory: [], message }) });
  try {
    const res = await chat('ايه هي زهرة الوتس؟');
    assert.equal(res.status, 200);
    const body = await res.json() as { reply: string; memory: string };
    assert.equal(body.memory, 'library');
    assert.match(body.reply, /^✍️ _فهمت سؤالك كده: «ايه هي زهرة اللوتس؟»_/);
    assert.match(body.reply, /زهرة مائية/);
    const typed = await (await chat('.ivm hgg,js')).json() as { reply: string };
    assert.match(typed.reply, /زهرة مائية/, 'the English keyboard too');
    assert.equal((await chat('ايه هي زهرة الخشخاش الزرقا في الصين')).status, 503);
    assert.deepEqual(asked, ['ايه هي زهرة الخشخاش الزرقا في الصين'], 'research gets the question as understood');
  } finally { await new Promise((done) => server.close(done)); }
});

test('the browser with no server: the English keyboard is shown converted; the library gets the understood question', async () => {
  const { createChatStore } = await import('../src/utils/chatStore');
  const offline = (async () => { throw new TypeError('Failed to fetch'); }) as never;
  const libraryAsked: string[] = [];
  const mem = {
    learn: () => {}, recall: async () => undefined,
    understand: async (q: string) => understandQuestion(q, lex),
    library: async (q: string) => { libraryAsked.push(q); return /اللوتس/.test(q) ? 'زهرة اللوتس زهرة مائية' : undefined; },
  };
  const store = createChatStore(offline, async () => {}, mem, async () => undefined);
  await store.send({ model: 'fast', language: 'ar', errorText: () => 'unavailable', text: 'زهرة الوتس' });
  assert.deepEqual(libraryAsked, ['زهرة اللوتس']);
  assert.match(store.getSnapshot().messages.at(-1)!.text, /فهمت سؤالك كده: «زهرة اللوتس»[\s\S]*زهرة مائية/);
  await store.send({ model: 'fast', language: 'ar', errorText: () => 'unavailable', text: '.ivm hgg,js' });
  assert.equal(store.getSnapshot().messages.at(-2)!.text, 'زهرة اللوتس', 'the visitor sees what Shaheen read');
});

test('research: a word Wikipedia knows better is searched with its own spelling suggestion', async () => {
  const fake = (async (url: string) => {
    const u = new URL(url);
    if (u.searchParams.get('list') === 'search') {
      const q = u.searchParams.get('srsearch') || '';
      if (/لوتس/.test(q)) return new Response(JSON.stringify({ query: { search: [{ title: 'لوتس' }] } }));
      return new Response(JSON.stringify({ query: { searchinfo: { suggestion: 'نيلوفر' }, search: [{ title: 'زهرة' }] } }));
    }
    if (u.searchParams.get('list') === null && /نيلوفر/.test(u.searchParams.get('srsearch') || '')) return new Response('{}');
    const title = u.searchParams.get('titles') || '';
    const text = title === 'زهرة' ? 'الزهرة هي العضو التكاثري في النباتات المزهرة، ولها رائحة عطرية أحيانا.' : '';
    return new Response(JSON.stringify({ query: { pages: [{ title, extract: text }] } }));
  }) as never;
  const seen: string[] = [];
  const spy = (async (url: string, init?: never) => { const u = new URL(url); if (u.searchParams.get('srsearch')) seen.push(u.searchParams.get('srsearch')!); return (fake as (a: string, b?: never) => Promise<Response>)(url, init); }) as never;
  await research(spy, 'ايه هو النيلوفرر', 'ar');
  assert.ok(seen.includes('نيلوفر'), `the suggestion is searched (${seen.join(' | ')})`);
});

test('the school drills mistyped words and asks its questions again with the main word mistyped', () => {
  const words = ['ياسمين', 'فانيليا', 'باتشولي', 'امبروكسان', 'برجموت', 'تعتيق', 'مثبتات', 'تركيز'];
  assert.ok(typoVariants('ياسمين').some((v) => v.kind === 'keyboard'));
  const drill = spellingDrill(baseLexicon(), words);
  assert.ok(drill.tried >= 30 && drill.score >= 85, JSON.stringify(drill));
  const memory = emptyMemory();
  const bank = [{ q: 'ايه هي زهرة الياسمين؟', lang: 'ar' as const, topic: 'materials', origin: 'curriculum' as const }];
  remember(memory, { question: bank[0]!.q, lang: 'ar', mode: 'auto', answer: 'الياسمين زهرة بيضا رائحتها قوية وحلوة، وبتدخل في قلب العطور الزهرية والشرقية.', source: 'study' });
  const results = exam(bank, memory, []).results;
  assert.deepEqual(spellingExam(results, memory, [], baseLexicon()), { tried: 1, answered: 1, misses: [] });
  const report = spellingReport(bank, results, memory, [], baseLexicon(), '2026-10-21T00:00:00Z');
  assert.equal(report.questions.answered, 1);
  assert.ok(report.score >= 0 && report.score <= 100);
});

test('the precheck warns when he understands too few mistyped words', () => {
  const now = Date.now();
  const check = (score: number) => runPrecheck({ 'shaheen-school.json': { updatedAt: new Date(now).toISOString(), reliance: { score: 96 }, spelling: { score } } }, {}, now).bots.find((b) => b.id === 'school')!;
  assert.ok(check(60).problems.some((p) => /المكتوبة غلط/.test(p)), JSON.stringify(check(60)));
  assert.ok(!check(95).problems.some((p) => /المكتوبة غلط/.test(p)));
});

test('a question about jasmine («الياسمين» contains «اسمي») is not mistaken for a personal one', async () => {
  const { isPersonal } = await import('../src/utils/shaheenMemory');
  assert.equal(isPersonal('ايه هي زهرة الياسمين؟'), false);
  assert.equal(isPersonal('اسمي منى وعايزة عطر'), true);
  assert.equal(isPersonal('ده رقمي 01012345678'), true);
  assert.equal(isPersonal('واسمي احمد'), true);
});
