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
