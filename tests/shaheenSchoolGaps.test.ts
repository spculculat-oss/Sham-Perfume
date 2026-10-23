/**
 * «تكملة المناهج الناقصة» — the guarantee that NO school question is left without a lesson:
 * every Arabic bank question (the original curriculum, the academy, the experts' syllabus, the
 * materials) finds a lesson in Shaheen's own library, and every gap lesson is found by EXACTLY its
 * own question. This is what makes the exam → selfLesson → memory path complete without any AI.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { isTimeBound, worthRemembering, meaningWords, emptyMemory, remember } from '../src/utils/shaheenMemory';
import { academyLessons, academyPairs } from '../scripts/shaheen-school/curriculum';
import { gapLessons, gapPairs, gapQuestions } from '../scripts/shaheen-school/curriculumGaps';
import { buildBank, exam, lessonFor, materialDocs, selfLesson, type TrainingDoc } from '../scripts/shaheen-school/school';
import { RAW_MATERIALS_DATABASE } from '../src/data/rawMaterials';

const docsUrl = new URL('../src/data/live/sham-training.json', import.meta.url);
const docs: TrainingDoc[] = (JSON.parse(readFileSync(docsUrl, 'utf8')) as { docs?: TrainingDoc[] }).docs || [];
const fullLibrary = [...docs, ...materialDocs(RAW_MATERIALS_DATABASE), ...academyLessons(), ...gapLessons()];

test('no school question is left without a lesson (the missing curricula are complete)', () => {
  const bank = buildBank(docs, [], [], RAW_MATERIALS_DATABASE);
  const ar = bank.filter((q) => q.lang === 'ar');
  assert.ok(ar.length >= 1000, `the bank holds only ${ar.length} Arabic questions`);
  const missing = ar.filter((q) => !lessonFor(q, fullLibrary));
  assert.deepEqual(
    missing.map((q) => `${q.topic}|${q.q}`),
    [],
    'every Arabic question must find a lesson in the library',
  );
});

test('every gap question finds EXACTLY its own lesson in the full library', () => {
  const pairs = gapPairs();
  assert.equal(pairs.length, 229, `the gaps hold ${pairs.length} lessons, expected 229`);
  const ids = new Set(pairs.map((p) => p.lesson.id));
  assert.equal(ids.size, pairs.length, 'lesson ids are unique');
  for (const { lesson, question } of pairs) {
    const found = lessonFor(question, fullLibrary);
    assert.equal(
      found,
      lesson,
      `«${question.q}» must find its own lesson «${lesson.title}» (found «${found?.title}»)`,
    );
  }
});

test('gap lessons have unique word-sets so no two lessons can claim one question', () => {
  const seen = new Map<string, string>();
  for (const { lesson, question } of [...academyPairs(), ...gapPairs()]) {
    const key = meaningWords(lesson.title).sort().join('|');
    const clash = seen.get(key);
    assert.equal(clash, undefined, `«${lesson.title}» shares its word-set with «${clash}»`);
    assert.notEqual(question, undefined);
    seen.set(key, lesson.title);
  }
});

test('gap lessons are worth remembering and never time-bound', () => {
  for (const { lesson, question } of gapPairs()) {
    assert.ok(worthRemembering(question.q, lesson.content), `«${question.q}» / «${lesson.title}» fails the memory checks`);
    assert.ok(!isTimeBound(question.q), `«${question.q}» is time-bound and must not be memorised`);
    assert.equal(question.lang, 'ar');
    assert.equal(question.origin, 'curriculum');
  }
});

test('the exam + selfLesson teach the missing curricula from the library alone', () => {
  const memory = emptyMemory();
  const bank = gapQuestions();
  const first = exam(bank, memory, gapLessons());
  assert.equal(first.reliance.covered, 0, 'nothing is covered before teaching');
  assert.ok(first.reliance.fromLibrary >= 222, `the library answers ${first.reliance.fromLibrary} of the gaps`);
  const pair = gapPairs().find((p) => p.lesson.id === 'gap-exp-med-7')!;
  const taught = selfLesson({ question: pair.question, covered: false, score: 0, lesson: pair.lesson });
  assert.ok(taught);
  for (const q of [pair.question.q, ...taught.paraphrases.slice(0, 2)]) {
    assert.ok(remember(memory, { question: q, lang: 'ar', mode: 'auto', answer: taught.answer, source: 'study' }));
  }
  const second = exam(bank, memory, gapLessons());
  assert.ok(second.reliance.covered > first.reliance.covered, 'teaching one lesson covers its question');
});
