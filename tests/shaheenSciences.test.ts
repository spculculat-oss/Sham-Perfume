import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCIENCE_LESSONS, SCIENCE_POLICY_AR, SCIENCE_TRACKS } from '../src/data/sciences';
import { emptyMemory, remember, worthRemembering, type MemoryFile } from '../src/utils/shaheenMemory';
import { learnSciences, scienceCovered, scienceDocs, scienceParaphrases, scienceQuestions, scienceReport } from '../scripts/shaheen-school/sciences';

const SENSITIVE = new Set(['war-studies', 'electronic-warfare', 'nuclear', 'biosafety', 'space', 'chemistry', 'computing', 'agriculture']);

test('sciences: nine tracks, a real curriculum in every one', () => {
  assert.equal(SCIENCE_TRACKS.length, 17);
  assert.ok(SCIENCE_LESSONS.length >= 60, 'the curriculum is not a handful of lessons');
  const ids = new Set<string>();
  for (const track of SCIENCE_TRACKS) {
    assert.ok(track.lessons.length >= 6, `${track.id} is too thin`);
    assert.ok(track.summaryAr.length > 40 && track.boundaryAr.length > 30, `${track.id} needs a summary and a boundary`);
    for (const lesson of track.lessons) {
      assert.equal(lesson.track, track.id);
      assert.ok(!ids.has(lesson.id), `duplicate lesson id ${lesson.id}`);
      ids.add(lesson.id);
      assert.match(lesson.questionAr, /[\u0600-\u06FF]/, lesson.id);
      assert.match(lesson.answerAr, /[\u0600-\u06FF]/, lesson.id);
      assert.ok(lesson.questionAr.length >= 8 && lesson.questionAr.length <= 200, lesson.id);
      assert.ok(lesson.answerAr.length >= 300 && lesson.answerAr.length <= 1600, `${lesson.id} answer length ${lesson.answerAr.length}`);
      assert.ok(lesson.keywords.length >= 2, lesson.id);
    }
  }
  assert.ok(SCIENCE_POLICY_AR.includes('مفيش'), 'the policy states the hard limits');
});

test('sciences: every lesson can be remembered and answered by Shaheen with no AI', () => {
  for (const lesson of SCIENCE_LESSONS) {
    assert.ok(worthRemembering(lesson.questionAr, lesson.answerAr), `${lesson.id} cannot be kept in memory`);
    for (const wording of scienceParaphrases(lesson)) {
      assert.ok(wording.length <= 200 && !scienceParaphrases(lesson).includes(lesson.questionAr), lesson.id);
    }
  }
});

test('sciences: the track is studied from the library alone, and the report follows his memory', () => {
  const memory = emptyMemory();
  const first = learnSciences(memory);
  assert.equal(first.learned, SCIENCE_LESSONS.length);
  assert.ok(memory.entries.length >= SCIENCE_LESSONS.length, 'one entry per question at least');
  assert.ok(memory.entries.every((e) => e.source === 'study' && e.lang === 'ar'));

  const report = scienceReport(memory, '2026-10-22T00:00:00.000Z');
  assert.equal(report.score, 100);
  assert.equal(report.learned, report.total);
  assert.equal(report.tracks.length, 17);
  assert.ok(report.tracks.every((t) => t.covered === t.total && t.score === 100));

  const again = learnSciences(memory);
  assert.equal(again.learned, 0, 'nothing is studied twice');
});

test('sciences: a bounded run learns only what fits, and the report keeps the rest for next time', () => {
  const memory = emptyMemory();
  const small = learnSciences(memory, new Date('2026-10-22T00:00:00Z'), 3);
  assert.equal(small.learned, 3);
  const report = scienceReport(memory, '2026-10-22T00:00:00.000Z');
  assert.equal(report.learned, 3);
  assert.ok(report.learned < report.total);
  assert.ok(report.tracks.some((t) => t.score === 0), 'untouched tracks stay at zero');
  assert.ok(small.questions.every((q) => SCIENCE_LESSONS.some((l) => l.questionAr === q)));
});

test('sciences: the lessons and questions keep their shape for the school and the panel', () => {
  const docs = scienceDocs();
  assert.equal(docs.length, SCIENCE_LESSONS.length);
  assert.ok(docs.every((d) => d.tags?.includes('science')));
  const questions = scienceQuestions();
  assert.ok(questions.every((q) => q.lang === 'ar' && q.topic.startsWith('science:') && q.origin === 'curriculum'));
});

test('sciences: the sensitive tracks stay scholarly — no weapon design, attack recipes, dosages or targeting', () => {
  const forbidden = [
    /كيف\s*(تصنع|تبني|تصنيع)\s*(قنبلة|سلاح|رأس|فيروس|بكتيريا|جهاز تشويش)/,
    /\d+\s*(mg|ملجم|ملغ|مجم)/i,
    /(وصفة|خطوات)\s*(لصناعة|لتصنيع)\s*(سلاح|متفجرات|سم)/,
  ];
  for (const lesson of SCIENCE_LESSONS) {
    for (const pattern of forbidden) assert.ok(!pattern.test(lesson.answerAr), `${lesson.id} contains forbidden guidance`);
  }
  for (const track of SCIENCE_TRACKS.filter((t) => SENSITIVE.has(t.id))) {
    assert.match(track.boundaryAr, /مفيش|لا /, `${track.id} must state what it does not teach`);
  }
});

test('sciences: a lesson a visitor asks about is covered once it is in his memory', () => {
  const memory: MemoryFile = emptyMemory();
  const lesson = SCIENCE_LESSONS[0]!;
  assert.equal(scienceCovered(memory, lesson), false);
  assert.equal(remember(memory, { question: lesson.questionAr, lang: 'ar', mode: 'auto', answer: lesson.answerAr, source: 'study' }), true);
  assert.equal(scienceCovered(memory, lesson), true);
});

test('sciences: the hourly syllabus covers every track with safe, real questions studied by that expert', async () => {
  const { SCIENCE_SYLLABUS, SYLLABUS_SIZE } = await import('../src/data/sciences/syllabus');
  const { syllabusQuestions, pickStudy } = await import('../scripts/shaheen-school/school');
  for (const track of SCIENCE_TRACKS) {
    const qs = SCIENCE_SYLLABUS[track.id];
    assert.ok(qs && qs.length >= 6, `${track.id} needs a syllabus`);
    for (const q of qs) assert.ok(q.length >= 8 && q.length <= 120 && !/\d{4}|سعر|جنيه|قنبلة|متفجر|سم قاتل|اختراق حساب/.test(q), `${track.id}: ${q}`);
  }
  const bank = syllabusQuestions();
  assert.equal(bank.length, SYLLABUS_SIZE);
  assert.ok(bank.every((b) => b.topic.startsWith('expert:') && b.origin === 'curriculum' && b.lang === 'ar'));
  const results = [...bank, { q: 'ازاي اعمل عطر فواحة؟', lang: 'ar' as const, topic: 'design-x', origin: 'curriculum' as const }].map((question) => ({ question, covered: false, score: 0 }));
  assert.equal(pickStudy(results, 3)[0]!.topic, 'design-x', 'the 6-hourly run keeps perfume first');
  const hourly = pickStudy(results, 10, 'experts');
  assert.ok(hourly.every((b) => b.topic.startsWith('expert:')), 'the hourly clock studies the experts first');
  assert.ok(new Set(hourly.map((b) => b.topic)).size >= 5, 'and spreads across the fields');
});
