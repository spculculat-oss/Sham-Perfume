/**
 * «وكيل شاهين»: he understands the question (field, kind, subjects, typos), plans which school expert and which
 * sources, weighs them (a reviewed expert lesson beats an old answer), checks, and when nothing is solid says so
 * and sends the question to the field's expert — who studies it in the school.
 */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import express from 'express';
import {
  agentFooter, compareParts, EXPERT_GAP_PREFIX, expertGapReason, expertOf, fieldsOf, gather, plan, referralAnswer, runAgent, SCHOOL_EXPERTS, understand,
  type AgentSources,
} from '../src/utils/shaheenAgent';
import { SCIENCE_TRACKS } from '../src/data/sciences';
import { emptyMemory, remember } from '../src/utils/shaheenMemory';
import type { Research } from '../src/utils/webResearch';
import { expertBrief, reviewPrompt, studyPrompt, visitorQuestions } from '../scripts/shaheen-school/school';
import { AI_PLATFORMS_VAR } from '../server/core/selfReliance';
import { createShaheenRouter } from '../server/shaheen';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';

const OLD = 'دي إجابة قديمة محفوظة من محادثة زائر قبل كده عن الزلازل، فيها كلام عام ومش مراجع من خبير المدرسة خالص.';
const src = (): AgentSources => {
  const memory = emptyMemory();
  remember(memory, { question: 'ليه بتحصل الزلازل؟', lang: 'ar', mode: 'auto', answer: OLD, source: 'chat' });
  return { lessons: [], materials: [], memory };
};

test('every science track has its expert in the school, with the track’s limits', () => {
  for (const t of SCIENCE_TRACKS) {
    const e = expertOf(t.id);
    assert.equal(e.field, t.id);
    assert.equal(e.boundaryAr, t.boundaryAr);
  }
  for (const f of ['perfume', 'chemistry', 'physics', 'biology', 'math', 'computing', 'nutrition', 'agriculture']) assert.ok(SCHOOL_EXPERTS.some((e) => e.field === f), f);
  assert.equal(expertOf('nothing').field, 'general');
  assert.equal(expertGapReason('chemistry'), `${EXPERT_GAP_PREFIX}chemistry`);
});

test('understanding: the field, the kind, the subjects; typos read back; vague and out-of-scope questions spotted', () => {
  assert.equal(fieldsOf('ما هو التفاعل الكيميائي')[0].field, 'chemistry');
  assert.equal(fieldsOf('ايه هو الانشطار النووي')[0].field, 'nuclear');
  assert.equal(fieldsOf('ازاي الصاروخ بيوصل للمدار')[0].field, 'space');
  assert.equal(understand('ليه بتحصل الزلازل', 'ar').kind, 'why');
  assert.equal(understand('ازاي اعمل عطر', 'ar').kind, 'howto');
  assert.equal(understand('ايه هو الامبروكسان', 'ar').kind, 'define');
  assert.equal(understand('ايه الفرق بين العود والمسك', 'ar').kind, 'compare');
  assert.deepEqual(compareParts('ايه الفرق بين العود والمسك؟'), ['العود', 'المسك']);
  assert.ok(understand('ايه', 'ar').vague);
  assert.ok(understand('سعر العود النهارده', 'ar').outOfScope);
  assert.equal(plan(understand('ايه هو الترانزستور', 'ar')).expert.field, 'semiconductors');
  assert.deepEqual(plan(understand('ايه هو الترانزستور', 'ar')).steps.slice(0, 1), ['expert'], 'the expert’s reviewed lessons first');
});

test('not just the old answer: the expert’s reviewed lesson wins over a visitor’s saved answer to the same question', async () => {
  const r = await runAgent('ليه بتحصل الزلازل؟', 'ar', { sources: src() });
  assert.equal(r.used[0], 'expert');
  assert.equal(r.expert.field, 'earth');
  assert.equal(r.confidence, 'high');
  assert.doesNotMatch(r.answer!.split('\n\n')[0], /إجابة قديمة/);
  assert.match(r.answer!, /خبير علوم الأرض من مدرسة شاهين/);
  const ev = gather(understand('ليه بتحصل الزلازل؟', 'ar'), src(), 'ar');
  assert.ok(ev.some((e) => e.kind === 'memory'), 'the old answer was considered, as one source among others');
});

test('the right lesson for the subject; a comparison answered side by side; one lesson covering both', async () => {
  assert.match((await runAgent('ايه هو الترانزستور', 'ar', { sources: src() })).answer!, /الترانزستور/);
  const both = await runAgent('ايه الفرق بين الانشطار والاندماج', 'ar', { sources: src() });
  assert.equal(both.expert.field, 'nuclear');
  assert.match(both.answer!, /الانشطار والاندماج/);
});

test('nothing solid: an honest answer, no guess — the question goes to the field’s expert', async () => {
  const r = await runAgent('ما هو قانون نيوتن التاني للحركة', 'ar', { sources: src() });
  assert.equal(r.answer, undefined);
  assert.ok(r.refer);
  assert.equal(r.expert.field, 'physics');
  const text = referralAnswer('ar', r.expert, true);
  assert.match(text, /مش هخمّن/);
  assert.match(text, /خبير الفيزياء/);
  assert.doesNotMatch(referralAnswer('ar', r.expert, false), /بعته/);
  assert.match(referralAnswer('en', r.expert, true), /won't guess/);
});

test('the school has nothing: the researcher reads open sources, and the expert still studies it', async () => {
  const found: Research = { question: 'q', lang: 'ar', query: 'q', sources: [{ title: 'قانون نيوتن', url: 'https://ar.wikipedia.org/wiki/x', site: 'wikipedia', lang: 'ar' }],
    passages: [{ text: 'القوة تساوي الكتلة في التسارع.', source: { title: 'قانون نيوتن', url: 'https://ar.wikipedia.org/wiki/x', site: 'wikipedia', lang: 'ar' }, score: 1, matched: 2, agreed: 1 }] };
  const r = await runAgent('ما هو قانون نيوتن التاني للحركة', 'ar', { sources: src(), research: async () => found, willRecord: true });
  assert.deepEqual(r.used, ['research']);
  assert.ok(r.refer);
  assert.match(r.answer!, /الكتلة في التسارع/);
  assert.match(r.answer!, /سؤالك اتسجل/);
});

test('safety: a personal treatment question gets the doctor, never a prescription; vague questions are asked back', async () => {
  const r = await runAgent('ازاي اعالج الصداع', 'ar', { sources: src() });
  assert.match(r.answer!, /الطبيب/);
  assert.doesNotMatch(r.answer!, /\d+\s*(مجم|mg)/);
  assert.equal(r.refer, false);
  const v = await runAgent('ايه', 'ar', { sources: src() });
  assert.ok(v.clarify);
  assert.match(v.answer!, /بتفاصيل أكتر/);
  const hi = await runAgent('السلام عليكم', 'ar', { sources: src() });
  assert.match(hi.answer!, /وعليكم السلام/);
  assert.match(agentFooter('ar', expertOf('earth'), ['expert'], true), /بعت سؤالك للخبير/);
});

test('the school studies what the agent sent: in the expert’s field, reviewed by that field’s standards', () => {
  const qs = visitorQuestions([
    { question: 'ما هو قانون نيوتن التاني للحركة', status: 'open', reason: 'expert:physics', count: 3 },
    { question: 'ايه هو العنبر الرمادي في العطور', status: 'open', reason: 'shaheen_offline', count: 1 },
    { question: 'سؤال اتقفل خلاص ومش هيتذاكر', status: 'resolved', reason: 'expert:physics', count: 9 },
  ]);
  assert.deepEqual(qs.map((q) => q.topic), ['expert:physics', 'visitors']);
  assert.match(studyPrompt(qs[0]), /خبير الفيزياء/);
  assert.equal(expertBrief('visitors'), '');
  assert.match(reviewPrompt({ q: 'x', lang: 'ar', topic: 'expert:human-medicine', origin: 'visitors' }, 'y'), /مفيش تشخيص/);
});

test('the server (platforms closed): the agent answers from the school; nothing solid → honest answer + the expert’s study list', async () => {
  const repo = new Repository(new MemoryStore(), {});
  const fetch = (async () => { throw new Error('no network in tests'); }) as unknown as typeof globalThis.fetch;
  const app = express();
  app.use(express.json());
  app.use('/api', createShaheenRouter({ repo, env: { [AI_PLATFORMS_VAR]: 'off', SHAM_ANSWER_CACHE_MINUTES: '0' }, fetch, library: async () => src() }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  const chat = async (message: string) => {
    const res = await globalThis.fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'auto', language: 'ar', conversationHistory: [], message }),
    });
    return { status: res.status, data: await res.json() as { reply: string; memory?: string; agent?: { field: string; confidence: string }; engine: { provider: string } } };
  };
  try {
    const quake = await chat('ليه بتحصل الزلازل؟');
    assert.equal(quake.status, 200);
    assert.equal(quake.data.memory, 'agent');
    assert.equal(quake.data.agent?.field, 'earth');
    assert.equal(quake.data.engine.provider, 'shaheen');
    assert.match(quake.data.reply, /الصفائح التكتونية/);
    const physics = await chat('ما هو قانون نيوتن التاني للحركة');
    assert.equal(physics.status, 200);
    assert.equal(physics.data.memory, 'unknown');
    assert.match(physics.data.reply, /مش هخمّن/);
    assert.match(physics.data.reply, /خبير الفيزياء/);
    const gaps = await repo.gaps();
    assert.ok(gaps.some((g) => g.reason === 'expert:physics'), JSON.stringify(gaps.map((g) => g.reason)));
  } finally { await new Promise((done) => server.close(done)); }
});
