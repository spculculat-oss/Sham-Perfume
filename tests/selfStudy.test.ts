import assert from 'node:assert/strict';
import test from 'node:test';
import { HINT_MIN_SCORE, STUDY_FIELDS, buildSelfStudy, hintFrom, studyField, studyPriority } from '../server/core/selfStudy';
import { Bm25Index } from '../server/core/text';
import type { KnowledgeGap } from '../server/core/types';
import { readFileSync } from 'node:fs';

const NOW = Date.parse('2026-11-15T12:00:00Z');
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();
let n = 0;
const gap = (question: string, over: Partial<KnowledgeGap> = {}): KnowledgeGap => ({
  id: `g${++n}`, key: question, question, source: 'no_answer', count: 1, status: 'open', firstAt: ago(2), lastAt: ago(1), ...over,
});

test('questions are sorted into the right field of study', () => {
  const cases: [string, string][] = [
    ['ازاي أثبت العطر على الجلد؟', 'perfume'], ['الطلب بتاعي اتأخر في الشحن', 'store'], ['ازاي أعمل مونتاج فيديو ريلز؟', 'media'],
    ['عايز لوجو وألوان للبراند', 'design'], ['ازاي أزود المبيعات بحملة إعلان؟', 'marketing'], ['اكتبلي كود بايثون', 'code'],
    ['ترجم الجملة دي', 'writing'], ['ايه علاج حساسية البشرة؟', 'health'], ['حكم الصلاة في السفر', 'religion'],
    ['اشرح معادلة في الفيزياء', 'science'], ['مين كسب الماتش؟', 'general'], ['What is the sillage of oud?', 'perfume'],
  ];
  for (const [question, field] of cases) assert.equal(studyField(question), field, question);
  assert.equal(new Set(STUDY_FIELDS).size, STUDY_FIELDS.length);
});

test('what was asked more, let a visitor down, or is recent is studied first', () => {
  assert.ok(studyPriority({ count: 5, source: 'no_answer', lastAt: ago(1) }, NOW) > studyPriority({ count: 2, source: 'no_answer', lastAt: ago(1) }, NOW));
  assert.ok(studyPriority({ count: 2, source: 'negative_feedback', lastAt: ago(1) }, NOW) > studyPriority({ count: 2, source: 'no_answer', lastAt: ago(1) }, NOW));
  assert.ok(studyPriority({ count: 2, source: 'no_answer', lastAt: ago(1) }, NOW) > studyPriority({ count: 2, source: 'no_answer', lastAt: ago(60) }, NOW));
  const study = buildSelfStudy([
    gap('ازاي أثبت العطر؟', { count: 2 }), gap('لوجو للمتجر', { count: 9 }), gap('نوتة العود', { count: 3, source: 'negative_feedback' }),
    gap('سؤال قديم عن العنبر', { status: 'resolved' }), gap('كلام فاضي', { status: 'ignored' }),
  ], { now: NOW });
  assert.deepEqual(study.plan.map((p) => p.question), ['لوجو للمتجر', 'نوتة العود', 'ازاي أثبت العطر؟']);
  assert.ok(study.plan.every((p) => p.id && p.priority > 0));
});

test('the scorecard is honest: mastery per field, the field to focus on, and the weekly trend', () => {
  const study = buildSelfStudy([
    gap('عطر 1', { status: 'resolved' }), gap('عطر 2', { status: 'resolved' }), gap('عطر 3', { status: 'resolved' }), gap('عطر 4', { count: 2 }),
    gap('تصميم لوجو', { count: 7 }), gap('تصميم بانر', { count: 1, firstAt: ago(10), lastAt: ago(10) }),
    gap('كود', { status: 'ignored', firstAt: ago(40), lastAt: ago(40) }),
  ], { now: NOW });
  const perfume = study.fields.find((f) => f.field === 'perfume')!;
  assert.deepEqual([perfume.open, perfume.resolved, perfume.mastery, perfume.waiting], [1, 3, 75, 2]);
  const design = study.fields.find((f) => f.field === 'design')!;
  assert.deepEqual([design.open, design.resolved, design.mastery, design.waiting], [2, 0, 0, 8]);
  assert.equal(study.fields.find((f) => f.field === 'code')!.mastery, null, 'ignored questions are not counted as learned or missed');
  assert.equal(study.focus, 'design');
  assert.equal(study.fields[0]!.field, 'design');
  assert.deepEqual(study.totals, { open: 3, resolved: 3, ignored: 1, mastery: 50 });
  assert.deepEqual(study.trend, { last7: 5, prev7: 1, direction: 'worse' });
  const empty = buildSelfStudy([], { now: NOW });
  assert.deepEqual([empty.plan.length, empty.focus, empty.totals.mastery, empty.trend.direction], [0, null, null, 'same']);
});

test('the hint comes only from his own library and only when it really matches', () => {
  const index = new Bm25Index([
    { id: 'kb-fix', title: 'تثبيت العطر', text: 'تثبيت العطر على الجلد يتحسن بترطيب البشرة ورش العطر على مواضع النبض والابتعاد عن الفرك.', kind: 'knowledge' },
    { id: 'p-1', title: 'عطر عود ملكي', text: 'عطر عود ملكي تثبيت العطر قوي', kind: 'product' },
    { id: 'kb-ship', title: 'الشحن', text: 'الشحن خلال ثلاثة أيام داخل مصر', kind: 'knowledge' },
  ]);
  const hint = hintFrom(index.search('ازاي تثبيت العطر على الجلد', 4, HINT_MIN_SCORE));
  assert.equal(hint?.docId, 'kb-fix');
  assert.match(hint!.excerpt, /ترطيب البشرة/);
  assert.equal(hintFrom(index.search('مين كسب كاس العالم', 4, HINT_MIN_SCORE)), undefined);
  assert.equal(hintFrom([{ doc: { id: 'p-1', title: 'x', text: 'y', kind: 'product' }, score: 9 }]), undefined, 'a product is not a lesson');
  const study = buildSelfStudy([gap('ازاي تثبيت العطر على الجلد')], { now: NOW, hint: (q) => hintFrom(index.search(q, 4, HINT_MIN_SCORE)) });
  assert.equal(study.plan[0]!.hint?.docId, 'kb-fix');
});

test('nothing is learned without the owner: the study module only reads, and never calls a platform', () => {
  const source = readFileSync(new URL('../server/core/selfStudy.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /callEngine|fetch\(|saveKnowledge|resolveGap|\.put\(/);
  const http = readFileSync(new URL('../server/core/http.ts', import.meta.url), 'utf8');
  assert.match(http, /admin\.get\('\/self-study'/);
});

import { chatReport, docField, knowledgeMap, shelfStrength } from '../server/core/selfStudy';
import { NEED_HINT, needInstruction, readNeed } from '../src/utils/naturalTalk';
import { askWorkspace } from '../server/workspace';
import type { Conversation } from '../server/core/types';

const doc = (title: string, words: number, tags: string[] = []) => ({ title, tags, content: Array.from({ length: words }, () => 'كلمة').join(' ') });

test('the knowledge structure shows every field, the empty and weak ones first', () => {
  assert.equal(docField({ title: 'تثبيت العطر', tags: [], content: '' }), 'perfume');
  assert.equal(docField({ title: 'ملاحظة', tags: [], content: 'طريقة مونتاج فيديو قصير' }), 'media', 'falls back to the text');
  const docs = [...Array.from({ length: 9 }, (_, i) => doc(`درس عطر ${i}`, 200)), doc('تصميم لوجو', 50), doc('حملة تسويق', 400), doc('إعلان تسويق', 400), doc('خطة مبيعات', 400)];
  const map = knowledgeMap(docs, [{ field: 'marketing', open: 3, resolved: 1, ignored: 0, waiting: 6, mastery: 25 }]);
  assert.equal(map.length, STUDY_FIELDS.length);
  const of = (field: string) => map.find((s) => s.field === field)!;
  assert.deepEqual([of('perfume').lessons, of('perfume').words, of('perfume').strength], [9, 1800, 'strong']);
  assert.equal(of('design').strength, 'weak', 'one short note is not knowledge');
  assert.equal(of('marketing').strength, 'weak', 'visitors are waiting and most questions are unanswered');
  assert.equal(of('code').strength, 'empty');
  assert.equal(map[0]!.strength, 'empty');
  assert.equal(map[map.length - 1]!.field, 'perfume');
  assert.equal(shelfStrength({ lessons: 4, words: 900, waiting: 0, mastery: null }), 'fair');
});

const talk = (id: string, questions: string[], over: Partial<Conversation> = {}, rate?: 'up' | 'down'): Conversation => ({
  id, visitorId: `v-${id}`, language: 'ar', status: 'open', memory: {}, startedAt: ago(3), updatedAt: ago(3),
  messages: questions.flatMap((text, i) => [
    { role: 'user' as const, text, at: new Date(NOW - 3 * 86_400_000 + i * 60_000).toISOString() },
    { role: 'assistant' as const, text: 'رد', at: new Date(NOW - 3 * 86_400_000 + i * 60_000 + 1000).toISOString(), ...(rate && i === 0 ? { feedback: { rating: rate, at: ago(3) } } : {}) },
  ]), ...over,
});

test('the performance report counts what really happened in the conversations', () => {
  const conversations = [
    talk('a', ['ازاي أثبت العطر؟'], {}, 'up'),
    talk('b', ['ازاي أثبت العطر ؟!', 'وسعر الشحن كام؟']),
    talk('c', ['عايز لوجو', 'وبانر', 'وألوان', 'وكمان فيديو'], { updatedAt: ago(20), startedAt: ago(20) }, 'down'),
    talk('d', ['سؤال ما لوش إجابة عن الفلك']),
    { ...talk('e', []), messages: [] },
  ];
  const gaps = [gap('سؤال ما لوش إجابة عن الفلك', { conversationId: 'd', lastAt: new Date(NOW - 3 * 86_400_000 + 2000).toISOString() })];
  const report = chatReport(conversations, gaps, { now: NOW });
  assert.equal(report.conversations, 4, 'an empty conversation is not counted');
  assert.equal(report.last7, 3);
  assert.deepEqual([report.questions, report.avgQuestions], [8, 2]);
  assert.deepEqual(report.leave, { afterOne: 2, afterFew: 1, afterMany: 1 });
  assert.equal(report.oneQuestionShare, 50);
  assert.equal(report.leftUnanswered, 1);
  assert.deepEqual(report.ratings, { up: 1, down: 1, satisfaction: 50 });
  assert.deepEqual(report.topQuestions, [{ question: 'ازاي أثبت العطر؟', count: 2 }]);
  assert.equal(report.byField[0]!.field, 'design');
  assert.equal(report.byField.reduce((sum, f) => sum + f.questions, 0), 8);
  // He asked again after the unanswered question: that conversation did not end there.
  const stayed = chatReport([talk('d', ['سؤال ما لوش إجابة عن الفلك', 'طيب سؤال تاني'])], gaps, { now: NOW });
  assert.equal(stayed.leftUnanswered, 0);
  const none = chatReport([], [], { now: NOW });
  assert.deepEqual([none.conversations, none.oneQuestionShare, none.ratings.satisfaction, none.avgQuestions], [0, null, null, 0]);
});

test('the visitor\'s need is read from his own words only, and changes how — never what — is answered', async () => {
  const cases: [string, string | undefined][] = [
    ['باختصار ايه هو العود؟', 'hurried'], ['اشرحلي بالتفصيل خطوة خطوة', 'detail'], ['أنا مبتدئ ومش فاهم يعني ايه تركيز', 'simple'],
    ['قلتلك الكود مش شغال برضه غلط', 'upset'], ['محتار بين العود والمسك انهي احسن؟', 'undecided'], ['ليه السما زرقا؟', undefined],
    ['tl;dr what is oud', 'hurried'], ['I can\'t decide, which one is better?', 'undecided'], ['it still doesn\'t work', 'upset'],
  ];
  for (const [message, need] of cases) assert.equal(readNeed(message), need, message);
  assert.equal(needInstruction('ليه السما زرقا؟'), '');
  // «النقاش والوعي»: an objection is neither a complaint to soothe nor a fight to win.
  for (const message of ['انت غلطان، العود مش من شجر', 'مش مقتنع بكلامك', 'ايه دليلك؟', "I disagree, that's not true", 'says who?']) assert.equal(readNeed(message), 'disagrees', message);
  assert.match(NEED_HINT.disagrees, /عندك حق/);
  assert.match(NEED_HINT.disagrees, /ما توافقش علشان ترضيه/);
  assert.match(NEED_HINT.disagrees, /مش متأكد/);
  assert.equal(readNeed(`باختصار ${'كلمة '.repeat(600)}`), undefined, 'a long paste is a document, not a way of asking');
  // Honest by construction: no hint tells Shaheen to press, hide, exaggerate or invent.
  for (const hint of Object.values(NEED_HINT)) assert.doesNotMatch(hint, /اضغط عليه|استعجله|خوّفه|آخر فرصة|الكمية محدودة/);
  assert.match(NEED_HINT.undecided, /ما تضغطش/);
  let system = '';
  const request = (async (_url: string | URL | Request, init?: RequestInit) => { system = String(init?.body); return Response.json({ choices: [{ message: { content: 'رد' } }] }); }) as typeof fetch;
  await askWorkspace({ messages: [{ role: 'user', text: 'باختصار ايه هو العود؟' }] }, { env: { OPENAI_API_KEY: 'test' }, fetch: request });
  assert.ok(system.includes('الشخص مستعجل'));
  await askWorkspace({ messages: [{ role: 'user', text: 'ليه السما زرقا؟' }] }, { env: { OPENAI_API_KEY: 'test' }, fetch: request });
  assert.ok(!system.includes('الشخص مستعجل'));
});
