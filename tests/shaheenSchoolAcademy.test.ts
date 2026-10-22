/**
 * «أكاديمية مدرسة شاهين» — the new missions: ALL programming languages, blocks & scheduling, software
 * engineering, graphics & design, website maintenance, and every AI tool developed in its field.
 * The hard guarantee: every question finds EXACTLY its own lesson — that is how the school teaches
 * Shaheen to rely on himself (exam → selfLesson → memory) without any AI service.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isTimeBound, worthRemembering, emptyMemory, remember, recallSimilar } from '../src/utils/shaheenMemory';
import { AI_TOOLS } from '../src/utils/aiTools';
import {
  academyLessons, academyPairs, academyQuestions, PROGRAMMING_LANGUAGES, SCHOOL_PROGRAMS, TOOL_FIELDS, TRACKS, trackOf,
} from '../scripts/shaheen-school/curriculum';
import { buildBank, exam, lessonFor, selfLesson, toolStats, trackStats, CURRICULUM, type TrainingDoc } from '../scripts/shaheen-school/school';
import { buildProgram, validateProgram, parseSchedule } from '../src/utils/shaheenBlocks';

test('the academy teaches ALL known programming languages (100+) with unique, usable lessons', () => {
  assert.ok(PROGRAMMING_LANGUAGES.length >= 100, `only ${PROGRAMMING_LANGUAGES.length} languages`);
  const ar = new Set(PROGRAMMING_LANGUAGES.map((l) => l[0]));
  const en = new Set(PROGRAMMING_LANGUAGES.map((l) => l[1].toLowerCase()));
  assert.equal(ar.size, PROGRAMMING_LANGUAGES.length, 'Arabic names are unique');
  assert.equal(en.size, PROGRAMMING_LANGUAGES.length, 'English names are unique');
  for (const [nameAr, nameEn, family, useAr] of PROGRAMMING_LANGUAGES) {
    assert.ok(useAr.length >= 40, `${nameAr}: the lesson says too little`);
    assert.ok(family, nameAr);
    assert.ok(nameAr.length >= 2, `${nameAr}: the Arabic name must survive question matching`);
    assert.ok(nameEn.length >= 1, nameAr);
  }
  // A sample of the famous ones is really there.
  for (const must of ['بايثون', 'جافا', 'جافاسكريبت', 'سي', 'سي بلس بلس', 'سي شارب', 'روبي', 'باش', 'إس كيو إل', 'راست', 'سويفت', 'كوتلن']) {
    assert.ok(ar.has(must), `${must} is in the catalogue`);
  }
});

test('every academy question finds EXACTLY its own lesson (self-study without AI works)', () => {
  const pairs = academyPairs();
  const lessons = academyLessons();
  assert.ok(pairs.length >= 200, `the academy holds only ${pairs.length} lessons`);
  const ids = new Set(lessons.map((l) => l.id));
  assert.equal(ids.size, lessons.length, 'lesson ids are unique');
  for (const { lesson, question } of pairs) {
    const found = lessonFor(question, lessons);
    assert.equal(found, lesson, `«${question.q}» must find its own lesson «${lesson.title}» (found «${found?.title}»)`);
  }
});

test('the academy lessons are worth remembering and never time-bound', () => {
  for (const { lesson, question } of academyPairs()) {
    assert.ok(worthRemembering(question.q, lesson.content), `«${question.q}» / «${lesson.title}» fails the memory checks`);
    assert.ok(!isTimeBound(question.q), `«${question.q}» is time-bound and must not be memorised`);
    assert.equal(question.lang, 'ar');
    assert.equal(question.origin, 'curriculum');
  }
});

test('the exam + selfLesson teach the academy from the library alone (reliance grows with no AI)', () => {
  const lessons = academyLessons();
  const bank = academyQuestions();
  const memory = emptyMemory();
  const first = exam(bank, memory, lessons);
  assert.equal(first.reliance.covered, 0);
  assert.ok(first.reliance.fromLibrary >= 200, 'the library answers almost the whole academy');
  // Teach exactly one lesson the way run.mts does, then the exam must cover it and its close wordings.
  const pair = academyPairs().find((p) => p.lesson.title === 'لغة بايثون')!;
  const taught = selfLesson({ question: pair.question, covered: false, score: 0, lesson: pair.lesson });
  assert.ok(taught);
  for (const q of [pair.question.q, ...taught.paraphrases.slice(0, 2)]) {
    assert.ok(remember(memory, { question: q, lang: 'ar', mode: 'auto', answer: taught.answer, source: 'study' }));
  }
  const second = exam(bank, memory, lessons);
  assert.ok(second.reliance.covered > first.reliance.covered);
  assert.ok(recallSimilar(memory, 'ايه هي لغة بايثون؟', 'ar'), 'the exact question is in memory');
  assert.ok(recallSimilar(memory, 'حدثني عن لغة بايثون', 'ar'), 'a close wording is answered too');
});

test('tracks cover every mission; tools cover every AI tool with its field and a focus', () => {
  const results = exam(academyQuestions(), emptyMemory(), academyLessons()).results;
  const tracks = trackStats(results);
  for (const t of TRACKS) assert.ok(tracks[t.id], `track ${t.id} is reported`);
  assert.equal(tracks.prog_langs.total, PROGRAMMING_LANGUAGES.length + 6, 'languages + language concepts');
  assert.ok(tracks.blocks.total >= 10);
  assert.ok(tracks.software.total >= 20);
  assert.ok(tracks.graphics.total >= 20);
  assert.ok(tracks.web_care.total >= 20);
  assert.ok(tracks.ai_science.total >= 50, 'the AI mission teaches the whole field');
  assert.ok(tracks.quantum.total >= 15, 'the quantum track');
  assert.ok(tracks.security.total >= 25, 'the cybersecurity track');
  assert.ok(tracks.ai_projects.total >= 20, 'complex AI-dependent projects');
  assert.ok(tracks.it_sciences.total >= 20, 'all IT sciences');
  assert.ok(tracks.frontier.total >= 15, 'specialist sciences unknown to the public');
  assert.ok(tracks.commerce.total >= 20, 'commerce & international trade');
  assert.ok(tracks.law.total >= 20, 'local & international law');
  assert.ok(tracks.pr.total >= 15, 'public relations');
  assert.ok(tracks.management.total >= 18, 'technical & general management');
  assert.ok(tracks.chemistry.total >= 18, 'chemistry');
  assert.ok(tracks.physics.total >= 18, 'physics');
  assert.ok(tracks.math.total >= 18, 'mathematics');
  assert.ok(tracks.history.total >= 18, 'history');
  assert.ok(tracks.geography.total >= 18, 'geography');
  assert.ok(tracks.literature.total >= 15, 'literary sciences');
  assert.ok(tracks.social.total >= 15, 'social sciences');
  assert.ok(tracks.psychology.total >= 18, 'psychology');
  assert.ok(tracks.cyber_psych.total >= 15, 'cyber psychology');
  assert.ok(tracks.ux_psych.total >= 15, 'psychological engineering of user interactions');
  assert.ok(tracks.perfume.total >= 5, 'the practical perfume skills close the original gaps');
  assert.equal(tracks.ai_tools.total, AI_TOOLS.length * 2, 'every tool: its field + how to develop it');
  assert.equal(trackOf('lang'), 'prog_langs');
  assert.equal(trackOf('blocks'), 'blocks');
  assert.equal(trackOf('web-care'), 'web_care');
  assert.equal(trackOf('ai'), 'ai_science');
  assert.equal(trackOf('tool-shaheen_school'), 'ai_tools');
  assert.equal(trackOf('materials'), 'perfume');
  assert.equal(trackOf('proj'), 'ai_projects');
  assert.equal(trackOf('it'), 'it_sciences');
  assert.equal(trackOf('com'), 'commerce');
  assert.equal(trackOf('law'), 'law');
  assert.equal(trackOf('ux'), 'ux_psych');
  assert.equal(trackOf('cps'), 'cyber_psych');

  const tools = toolStats(results, '2026-10-21T00:00:00.000Z');
  assert.equal(tools.items.length, AI_TOOLS.length);
  for (const t of AI_TOOLS) {
    const item = tools.items.find((i) => i.id === t.id)!;
    assert.ok(item, t.id);
    assert.equal(item.total, 2, `${t.id} has its two field lessons`);
    assert.ok(TOOL_FIELDS[t.id].field && TOOL_FIELDS[t.id].goalAr, t.id);
    assert.ok(item.focus.length > 5, `${t.id} names what its field studies next`);
    assert.equal(item.score, 0);
  }
});

test('the school builds its own block programs and can schedule them', () => {
  assert.ok(SCHOOL_PROGRAMS.length >= 3, 'study, site care and tool development');
  for (const spec of SCHOOL_PROGRAMS) {
    const program = buildProgram(spec);
    assert.deepEqual(validateProgram(program), [], `${spec.id} is a valid program`);
    assert.ok(program.schedule && parseSchedule(program.schedule), `${spec.id} has a working schedule`);
    assert.ok(program.blocks.length >= 2, spec.id);
  }
  const ids = SCHOOL_PROGRAMS.map((p) => p.id);
  assert.deepEqual([...new Set(ids)].sort(), ['ai-self', 'school-day', 'site-care', 'tool-dev']);
  // Which runner really executes each programme: the school's day/tooling, the patrol's ai-self/site-care.
  const runnerOf = Object.fromEntries(SCHOOL_PROGRAMS.map((p) => [p.id, p.runner]));
  assert.equal(runnerOf['school-day'], 'school');
  assert.equal(runnerOf['tool-dev'], 'school');
  assert.equal(runnerOf['ai-self'], 'patrol');
  assert.equal(runnerOf['site-care'], 'patrol');
  const siteCare = buildProgram(SCHOOL_PROGRAMS.find((p) => p.id === 'site-care')!);
  assert.ok(JSON.stringify(siteCare).includes('check_links'), 'the maintenance program really checks the site');
  const aiSelf = buildProgram(SCHOOL_PROGRAMS.find((p) => p.id === 'ai-self')!);
  assert.ok(JSON.stringify(aiSelf).includes('answer_from_memory'), 'the self-management program answers from memory first');
});

test('the bank is the old curriculum plus the academy, with no duplicates and no time-bound questions', () => {
  const bank = buildBank([] as TrainingDoc[]);
  assert.ok(bank.length >= CURRICULUM.length + 200);
  const keys = bank.map((b) => `${b.lang}|${b.q}`);
  assert.equal(new Set(keys).size, keys.length, 'no duplicated questions');
  for (const b of academyQuestions()) assert.ok(!isTimeBound(b.q), `time-bound question in the academy: ${b.q}`);
  assert.ok(bank.some((b) => b.q === 'ايه هي لغة بايثون؟'));
  assert.ok(bank.some((b) => b.q === 'ايه هي بلوكات البرمجة؟'));
  assert.ok(bank.some((b) => b.q === 'ايه هي هندسة البرمجة؟'));
  assert.ok(bank.some((b) => b.q === 'ايه هي صيانة المواقع؟'));
  assert.ok(bank.some((b) => b.q === 'ايه هو الاعتماد على النفس في الذكاء الاصطناعي؟'), 'the self-reliance mission is taught');
  assert.ok(bank.some((b) => b.q === 'ايه هي العلوم الحديثة في الذكاء الاصطناعي؟'), 'the modern sciences are taught');
  assert.ok(bank.some((b) => b.topic === 'tool-design_agent'));
});
