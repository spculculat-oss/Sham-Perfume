/**
 * «الجامعة العالمية الإلكترونية داخل دولة المنصة» — 5 كليات: أكاديمي، مهني، تقني، تجريبي،
 * وأذكى أدوات الـAgents. الضمانات: كل كلية منهج كامل، وكل سؤال يجد درسه بالضبط (العنوان = السؤال)،
 * والمحتوى يستحق الحفظ ولا ينتهي صلاحيته.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isTimeBound, worthRemembering } from '../src/utils/shaheenMemory';
import { academyLessons, TRACKS, trackOf } from '../scripts/shaheen-school/curriculum';
import { UNIVERSITY_PAIRS } from '../scripts/shaheen-school/curriculumUniversity';
import { exam, lessonFor, selfLesson } from '../scripts/shaheen-school/school';
import { emptyMemory, remember } from '../src/utils/shaheenMemory';

test('the world university holds 5 colleges with a full curriculum in each', () => {
  const byTopic = new Map<string, number>();
  for (const p of UNIVERSITY_PAIRS) byTopic.set(p.question.topic, (byTopic.get(p.question.topic) ?? 0) + 1);
  for (const college of ['academic', 'vocational', 'technical', 'experimental', 'smart_agents']) {
    assert.ok((byTopic.get(college) ?? 0) >= 20, `college ${college} holds only ${byTopic.get(college)} lessons`);
  }
  assert.ok(UNIVERSITY_PAIRS.length >= 100, `the university holds only ${UNIVERSITY_PAIRS.length} lessons`);
  const ids = new Set(UNIVERSITY_PAIRS.map((p) => p.lesson.id));
  assert.equal(ids.size, UNIVERSITY_PAIRS.length, 'lesson ids are unique');
  for (const t of ['academic', 'vocational', 'technical', 'experimental', 'smart_agents'] as const) {
    assert.ok(TRACKS.some((x) => x.id === t), `track ${t} is registered`);
    assert.equal(trackOf(t), t, `topic ${t} maps to its own track`);
  }
});

test('every university question finds EXACTLY its own lesson (its question is its title)', () => {
  const lessons = academyLessons();
  for (const { lesson, question } of UNIVERSITY_PAIRS) {
    assert.equal(lesson.title, question.q.replace(/؟+$/, ''), `«${question.q}» is its own lesson title`);
    const found = lessonFor(question, lessons);
    assert.equal(found, lesson, `«${question.q}» must find its own lesson (found «${found?.title}»)`);
  }
});

test('university lessons are worth remembering and never time-bound', () => {
  for (const { lesson, question } of UNIVERSITY_PAIRS) {
    assert.ok(worthRemembering(question.q, lesson.content), `«${question.q}» fails the memory checks`);
    assert.ok(!isTimeBound(question.q), `«${question.q}» is time-bound`);
    assert.equal(question.lang, 'ar');
  }
});

test('the university teaches from the library alone (exam → selfLesson → memory)', () => {
  const memory = emptyMemory();
  const first = exam(UNIVERSITY_PAIRS.map((p) => p.question), memory, academyLessons());
  assert.ok(first.reliance.fromLibrary >= UNIVERSITY_PAIRS.length, 'the library answers the whole university');
  const pair = UNIVERSITY_PAIRS.find((p) => p.lesson.id === 'uni-agent-1')!;
  const taught = selfLesson({ question: pair.question, covered: false, score: 0, lesson: pair.lesson });
  assert.ok(taught);
  for (const q of [pair.question.q, ...taught.paraphrases.slice(0, 2)]) {
    assert.ok(remember(memory, { question: q, lang: 'ar', mode: 'auto', answer: taught.answer, source: 'study' }));
  }
  const second = exam(UNIVERSITY_PAIRS.map((p) => p.question), memory, academyLessons());
  assert.ok(second.reliance.covered > first.reliance.covered);
});
