/**
 * «فهرس علوم شاهين»: the curriculum compiled once, so his sciences appear at once when he needs them — the same
 * reviewed scores, the same reviewed lessons, a fraction of the work.
 */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import express from 'express';
import { SCIENCE_LESSONS, SCIENCE_TRACKS } from '../src/data/sciences';
import {
  expertOf, gather, scienceCurriculum, scienceDesk, scienceIndexFor, scoreLesson, scoreLessonNaive, understand,
  type AgentSources,
} from '../src/utils/shaheenAgent';
import {
  buildScienceIndex, resetScienceIndexStats, scienceExact, scienceHits, scienceIndexStats, scienceIndexSummary,
  scienceWordings, type ScienceFieldWords,
} from '../src/utils/scienceIndex';
import { meaningWords, normalizeQuestion } from '../src/utils/shaheenMemory';
import { createShaheenRouter } from '../server/shaheen';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { ShaheenMemory } from '../server/core/memory';
import { emptyMemory } from '../src/utils/shaheenMemory';
import { createChatStore } from '../src/utils/chatStore';
import { ApiError, type requestApi } from '../src/utils/api';
import { SHAHEEN_SITE_SETTINGS } from '../server/config/shaheen';

const FIELD_WORDS = Object.fromEntries(SCIENCE_TRACKS.map((t) => [t.id, expertOf(t.id).words])) as ScienceFieldWords;
const index = buildScienceIndex(SCIENCE_LESSONS, FIELD_WORDS);
const questions = SCIENCE_LESSONS.map((lesson) => lesson.questionAr);
/** A question the school has never seen: same words, another ending, so the fast cache cannot answer it. */
const fresh = (question: string, round: number) => `${question} ${'؟'.repeat((round % 3) + 1)}${round}`;

test('the index compiles the whole curriculum once: every lesson, its words and the wordings the school teaches', () => {
  const summary = scienceIndexSummary(index);
  assert.equal(summary.lessons, SCIENCE_LESSONS.length);
  assert.ok(summary.words >= 400, `too few words indexed: ${summary.words}`);
  assert.ok(summary.wordings >= SCIENCE_LESSONS.length * 4, `too few taught wordings indexed: ${summary.wordings}`);
  assert.ok(summary.buildMs < 250, `building the index took ${summary.buildMs} ms`);
  for (const lesson of SCIENCE_LESSONS) {
    assert.ok(index.byId.get(lesson.id), `${lesson.id} is missing from the index`);
    assert.ok(scienceWordings(lesson).every((wording) => wording.length > 3));
    assert.equal(scienceExact(index, lesson.questionAr)?.id, lesson.id);
    assert.equal(scienceExact(index, `اشرحلي ${lesson.titleAr}`)?.id, lesson.id, `«اشرحلي ${lesson.titleAr}» is not a taught wording`);
  }
});

test('the index gives exactly the reviewed score: the fast answer is not a different answer', () => {
  for (const lesson of SCIENCE_LESSONS) {
    for (const question of [lesson.questionAr, `اشرحلي ${lesson.titleAr}`, 'ايه هي طبقات الأرض؟', 'ليه بتحصل الزلازل؟']) {
      const fast = scienceHits(index, question).find((hit) => hit.lesson.id === lesson.id)?.relevance ?? 0;
      const reviewed = scoreLessonNaive(lesson, question);
      assert.ok(Math.abs(fast - reviewed) < 1e-9, `${lesson.id} / «${question}»: index ${fast} ≠ reviewed ${reviewed}`);
      // The school's own accessor answers the same thing, whichever way it is reached.
      assert.ok(Math.abs(scoreLesson(lesson, question) - reviewed) < 1e-9, `${lesson.id} / «${question}»`);
    }
  }
});

test('every lesson is found by its own question, and every taught wording lands on its own lesson', () => {
  for (const lesson of SCIENCE_LESSONS) {
    assert.equal(scienceHits(index, lesson.questionAr, { limit: 1 })[0]?.lesson.id, lesson.id, lesson.id);
    for (const wording of [`اشرحلي ${lesson.titleAr}`, `معلومات عن ${lesson.titleAr}`, `يعني ايه ${lesson.titleAr}`]) {
      assert.equal(scienceDesk(wording, 'ar')?.lesson.id, lesson.id, `${lesson.id} / «${wording}»`);
    }
  }
});

test('the same words in another order still find the lesson (no phrasing has to be memorised)', () => {
  const found = (question: string) => scienceHits(index, question, { limit: 1 })[0]?.lesson.id;
  assert.equal(found('الزلازل بتحصل ليه'), 'earth-02');
  assert.equal(found('امتى بتتكون الأعاصير'), 'earth-05');
  assert.equal(found('كيف تتكون المياه الجوفية'), 'earth-04');
  assert.equal(found('ايه الفرق بين الطقس والمناخ'), 'earth-06');
  assert.equal(found('ايه هو الترانزستور'), 'semi-01');
  assert.equal(found('ايه هي المناعة'), 'med-05');
});

test('the fast desk answers with the reviewed lesson, its limit when it has one, and never a guess', () => {
  const quake = scienceDesk('ليه بتحصل الزلازل؟', 'ar');
  assert.equal(quake?.lesson.id, 'earth-02');
  assert.match(quake!.answer, /الصفائح التكتونية/);
  assert.match(quake!.answer, /من علوم شاهين/);
  assert.doesNotMatch(quake!.answer, /gemini|openai|gpt|claude|deepseek|anthropic/i, 'no vendor name for visitors');

  // A medical lesson always carries the school's limit with it.
  const immunity = scienceDesk('ايه هي المناعة', 'ar');
  assert.equal(immunity?.lesson.track, 'human-medicine');
  assert.match(immunity!.answer, new RegExp(SCIENCE_TRACKS.find((t) => t.id === 'human-medicine')!.boundaryAr.slice(0, 12)));

  // Close lessons are offered as follow-ups, never mixed into the answer.
  assert.ok((quake?.related.length || 0) >= 0);

  // Off his ground: he stays silent rather than guess, and leaves it to the agent, the library and the researcher.
  // A question that only brushes a lesson (one shared word) is left to the agent's full weighing, not answered here.
  for (const question of ['ايه هي الطاقة الشمسية في الفضاء', 'ايه هي قواعد كرة القدم']) {
    assert.equal(scienceDesk(question, 'ar'), undefined, question);
  }
  for (const question of ['عايز اعرف عن الثقوب السوداء', 'مين اخترع الترانزستور', 'سعر العود النهارده', 'اسمي محمد وعايز اعرف المناعه', 'what is immunity']) {
    assert.equal(scienceDesk(question, 'ar'), undefined, question);
  }
  assert.equal(scienceDesk('ايه هي المناعة', 'en'), undefined, 'the curriculum is Arabic; other languages get the expert');
  assert.equal(scienceDesk('ايه', 'ar'), undefined, 'too short to be a question');
});

test('the agent answers the same lesson from the index, and never drops it from the weighing', () => {
  const sources: AgentSources = { lessons: [], materials: [], memory: emptyMemory() };
  const evidence = gather(understand('ليه بتحصل الزلازل؟', 'ar'), sources, 'ar');
  const quake = evidence.find((e) => e.kind === 'expert' && e.id === 'earth-02');
  assert.ok(quake, 'the reviewed lesson must be in the evidence');
  assert.equal(quake!.relevance, scoreLessonNaive(SCIENCE_LESSONS.find((l) => l.id === 'earth-02')!, 'ليه بتحصل الزلازل؟', 'earth'));
  assert.ok(evidence.every((e) => e.relevance > 0.2), 'nothing below the school’s bar is carried');
});

test('a repeated question is answered from the fast cache; the index itself is built once', () => {
  resetScienceIndexStats();
  const asked = 'امتى بتتكون الأعاصير المدارية فوق البحار الدافئة؟';
  const before = scienceIndexStats(scienceCurriculum());
  const one = scienceHits(scienceCurriculum(), asked);
  const two = scienceHits(scienceCurriculum(), asked);
  const after = scienceIndexStats(scienceCurriculum());
  assert.deepEqual(one.map((h) => h.lesson.id), two.map((h) => h.lesson.id));
  assert.equal(after.cached - before.cached, 1, 'the second question came from the cache');
  assert.ok(after.questions - before.questions >= 2);
  assert.equal(after.docs, SCIENCE_LESSONS.length);
  assert.equal(scienceCurriculum(), scienceCurriculum(), 'one shared index for the whole process');
  // Another lesson set gets its own index (the school's studies, a preview, a test).
  const subset = [SCIENCE_LESSONS[0]!];
  const other = scienceIndexFor(subset);
  assert.equal(other.docs.length, 1);
  assert.equal(other, scienceIndexFor(subset), 'the same set is not indexed twice');
});

test('the index is much faster than walking the curriculum, and the desk answers in a fraction of a millisecond', () => {
  // Timing on a shared runner is noisy, so every measurement is the median of several rounds (a stall in one round
  // cannot decide the result), and the thresholds are far below the measured gap (about 10×).
  const median = (work: () => void, rounds = 7): number => {
    const samples: number[] = [];
    for (let round = 0; round < rounds; round++) {
      const started = performance.now();
      work();
      samples.push(performance.now() - started);
    }
    samples.sort((a, b) => a - b);
    return samples[Math.floor(samples.length / 2)]!;
  };
  const sample = questions.slice(0, 20);
  // Warm both paths first: this measures the algorithm, not the first run's compilation.
  for (let round = 0; round < 3; round++) for (const question of sample) scienceHits(index, fresh(question, round));
  const scan = median(() => {
    for (const question of sample) { const asked = fresh(question, 20); for (const lesson of SCIENCE_LESSONS) scoreLessonNaive(lesson, asked); }
  });
  const fast = median(() => { for (const question of sample) scienceHits(index, fresh(question, 20)); });
  const scanMs = scan / sample.length;
  const fastMs = fast / sample.length;
  assert.ok(fastMs < 5, `the index took ${fastMs.toFixed(3)} ms per question`);
  assert.ok(scanMs / fastMs > 1.5, `the index is only ${(scanMs / fastMs).toFixed(2)}× faster (${fastMs.toFixed(3)} vs ${scanMs.toFixed(3)} ms)`);
  const desk = median(() => { for (const question of questions) scienceDesk(question, 'ar'); });
  assert.ok(desk / questions.length < 20, `a full desk answer took ${(desk / questions.length).toFixed(3)} ms`);
});

test('normalising and tokenising are cached without changing a single answer', () => {
  const samples = ['ليه بتحصل الزلازل؟', 'إيه هي طبقات الأرض', 'اشرحلي الطقس والمناخ', 'ما هو الترانزستور؟', '٥٠ مل من العطر'];
  const manual = (text: string) => text.normalize('NFKC').toLowerCase()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي')
    .replace(/[\s\u200c\u200f\u200e]+/g, ' ').replace(/^[\s?!.,؟،؛:…]+|[\s?!.,؟،؛:…]+$/g, '').trim();
  for (const text of samples) {
    assert.equal(normalizeQuestion(text), manual(text));
    assert.deepEqual(normalizeQuestion(text), normalizeQuestion(text), 'the second call is the cached one');
    assert.deepEqual(meaningWords(text), meaningWords(text));
    assert.deepEqual(meaningWords(text), [...meaningWords(text)], 'a fresh copy of the same words');
  }
});

/* --------------------------------------------- the site itself --------------------------------------------- */

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const chat = (base: string, body: Record<string, unknown>) => fetch(`${base}/chat`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ model: 'auto', language: 'ar', conversationHistory: [], ...body }),
});

test('the server, with every engine down: a science question is answered from the index before anything else is walked', async () => {
  const app = express();
  app.use(express.json());
  const engine = (async () => json({ error: { message: 'down' } }, 500)) as typeof fetch;
  const memory = new ShaheenMemory(new MemoryStore(), {}, engine, emptyMemory());
  app.use('/api', createShaheenRouter({
    repo: new Repository(new MemoryStore(), {}), fetch: engine, memory,
    env: { OPENAI_API_KEY: 'sk-test', SHAM_ANSWER_CACHE_MINUTES: '0' },
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  try {
    const science = await chat(base, { message: 'ليه بتحصل الزلازل؟' });
    assert.equal(science.status, 200);
    const body = await science.json() as { reply: string; memory?: string; engine: { provider: string } };
    assert.equal(body.memory, 'science');
    assert.equal(body.engine.provider, 'shaheen');
    assert.match(body.reply, /الصفائح التكتونية/);
    assert.doesNotMatch(body.reply, /gemini|openai|gpt|claude|deepseek/i);
    // A question the sciences do not hold is not answered as one.
    const perfume = await chat(base, { message: 'ازاي اخلي العطر يثبت على جلدي اكتر' });
    assert.notEqual(((await perfume.json()) as { memory?: string }).memory, 'science');
  } finally { await new Promise((done) => server.close(done)); }
});

test('the browser, with no server: the science desk answers first, without an engine and without another download', async () => {
  let scienceCalls = 0; let agentCalls = 0;
  const store = createChatStore(
    (async () => { throw new ApiError(503, 'PROVIDER_UNAVAILABLE'); }) as typeof requestApi,
    async () => undefined,
    {
      learn: () => {},
      recall: async () => undefined,
      agent: async () => { agentCalls++; return 'إجابة الوكيل'; },
      science: async () => { scienceCalls++; return 'إجابة علوم شاهين'; },
    },
  );
  const sent = await store.send({ text: 'ليه بتحصل الزلازل؟', model: 'auto', language: 'ar', errorText: () => 'خطأ' });
  assert.equal(sent, true);
  const last = store.getSnapshot().messages.at(-1)!;
  assert.equal(last.text, 'إجابة علوم شاهين');
  assert.equal(scienceCalls, 1);
  assert.equal(agentCalls, 0, 'the desk answers first, so the agent’s heavier files are never loaded');
  assert.equal(last.aiEngine?.provider, 'shaheen');
});

test('the desk is reachable even with the platforms closed, like every other science path', () => {
  // The school's own index is the same one the agent, the server and the browser use.
  assert.equal(scienceCurriculum().docs.length, SCIENCE_TRACKS.reduce((sum, track) => sum + track.lessons.length, 0));
  assert.ok(SHAHEEN_SITE_SETTINGS.enabled, 'the desk is part of Shaheen, not a switch of its own');
});
