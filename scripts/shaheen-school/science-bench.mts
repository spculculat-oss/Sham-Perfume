/**
 * «قياس سرعة علوم شاهين» — how fast his sciences appear when he needs them.
 *
 * The site answers a science question in one of two ways:
 *   - the old way: «وكيل شاهين» walks the curriculum and scores all 73 lessons for the question, then walks his
 *     memory (up to 3000 saved answers) and his library before it can answer;
 *   - the index: the curriculum is compiled once, and the question only meets the lessons that share a word with it.
 * This script runs both on the same questions and prints the timings, the accuracy and the exact-score check.
 *
 * Usage: node --import tsx scripts/shaheen-school/science-bench.mts
 */
import { SCIENCE_LESSONS, SCIENCE_TRACKS } from '../../src/data/sciences';
import { expertOf, gather, scienceCurriculum, scienceDesk, scoreLessonNaive, understand } from '../../src/utils/shaheenAgent';
import { buildScienceIndex, scienceHits, scienceIndexSummary, type ScienceFieldWords } from '../../src/utils/scienceIndex';
import { emptyMemory, remember, type MemoryFile } from '../../src/utils/shaheenMemory';

const FIELD_WORDS = Object.fromEntries(SCIENCE_TRACKS.map((t) => [t.id, expertOf(t.id).words])) as ScienceFieldWords;
const questions = SCIENCE_LESSONS.map((lesson) => lesson.questionAr);
/** A question the school has never seen: the same words, another round marker, so the LRU cannot help. */
const fresh = (question: string, round: number) => `${question} ${'؟'.repeat((round % 3) + 1)}${round}`;

const perQuestion = (ms: number, count: number) => Math.round((ms / count) * 1000) / 1000;
function time(work: () => void, rounds: number): number {
  const started = performance.now();
  for (let i = 0; i < rounds; i++) work();
  return performance.now() - started;
}

/* 1. The index is built once per process: the first build (with the modules warming up) and the ones after it. */
const built = buildScienceIndex(SCIENCE_LESSONS, FIELD_WORDS);
const summary = scienceIndexSummary(built);
const warmBuildMs = Math.round(time(() => buildScienceIndex(SCIENCE_LESSONS, FIELD_WORDS), 5) / 5 * 100) / 100;

/* 2. His memory as it really is: the allowed maximum, most of it perfume answers. */
const memory: MemoryFile = emptyMemory();
for (let i = 0; i < 2927; i++) {
  remember(memory, { question: `سؤال قديم رقم ${i} عن تركيزات العطور والتعتيق والمواد الخام`, lang: 'ar', mode: 'auto',
    answer: 'إجابة محفوظة من محادثة قديمة عن التركيز والتعتيق، فيها تفاصيل وشروح طويلة كان الزائر سأل عنها قبل كده.', source: 'chat' });
}
const sources = { lessons: [], materials: [], memory };
const understood = understand("ليه بتحصل الزلازل؟", 'ar');

/* 3. The old way and the index, on questions nobody asked before. */
const warm = buildScienceIndex(SCIENCE_LESSONS, FIELD_WORDS);
time(() => { for (const q of questions) scienceHits(warm, q); }, 2);
const scanMs = time(() => {
  for (let round = 0; round < 5; round++) {
    for (const question of questions) {
      const asked = fresh(question, round);
      for (const lesson of SCIENCE_LESSONS) scoreLessonNaive(lesson, asked);
    }
  }
}, 1) / 5;
const indexMs = time(() => {
  for (let round = 0; round < 5; round++) for (const question of questions) scienceHits(warm, fresh(question, round));
}, 1) / 5;

/* 4. The whole agent (memory + library + curriculum) against the desk that answers straight from the index. */
const agentPerQuestion = time(() => { for (let round = 0; round < 5; round++) for (const question of questions) gather({ ...understood, asked: fresh(question, round) }, sources, 'ar'); }, 1) / 5;
time(() => { for (const q of questions) scienceDesk(q, 'ar'); }, 2);
const deskMs = time(() => { for (let round = 0; round < 5; round++) for (const question of questions) scienceDesk(fresh(question, round), 'ar'); }, 1) / 5;

/* 5. A question asked again: the visitor retrying, or the next visitor asking the same thing. */
const cachedMs = time(() => { for (let round = 0; round < 20; round++) for (const question of questions) scienceHits(built, question); }, 1) / 20;

/* 6. Does it still answer correctly, and with the reviewed scores? */
let own = 0;
for (const lesson of SCIENCE_LESSONS) if (scienceHits(built, lesson.questionAr, { limit: 1 })[0]?.lesson.id === lesson.id) own++;
let wordings = 0;
for (const lesson of SCIENCE_LESSONS) for (const q of [`اشرحلي ${lesson.titleAr}`, `معلومات عن ${lesson.titleAr}`]) if (scienceDesk(q, 'ar')?.lesson.id === lesson.id) wordings++;
let parity = 0;
for (const lesson of SCIENCE_LESSONS) {
  const computed = scienceHits(built, lesson.questionAr).find((hit) => hit.lesson.id === lesson.id)?.relevance ?? 0;
  if (Math.abs(computed - scoreLessonNaive(lesson, lesson.questionAr)) < 1e-9) parity++;
}

const lines = [
  `علوم شاهين — ${summary.lessons} درساً، ${summary.words} كلمة في الفهرس، ${summary.wordings} صيغة سؤال`,
  `بناء الفهرس: ${summary.buildMs} مللي ثانية أول مرة، ${warmBuildMs} مللي ثانية بعد كده — مرة واحدة لكل تشغيل`,
  `السؤال على المسح القديم (٧٣ درساً): ${perQuestion(scanMs, questions.length)} مللي ثانية`,
  `السؤال على الفهرس (سؤال جديد): ${perQuestion(indexMs, questions.length)} مللي ثانية — أسرع ${Math.round(scanMs / indexMs)}×`,
  `سؤال متكرر (ذاكرة سريعة): ${perQuestion(cachedMs, questions.length)} مللي ثانية — أسرع ${Math.round(scanMs / cachedMs)}×`,
  `الوكيل كامل (فهرس + ذاكرة ٢٩٢٧ إجابة + مكتبة): ${perQuestion(agentPerQuestion, questions.length)} مللي ثانية`,
  `المكتب السريع (إجابة كاملة من الفهرس): ${perQuestion(deskMs, questions.length)} مللي ثانية — أسرع ${Math.round(agentPerQuestion / deskMs)}×`,
  `الدقة: ${own}/${SCIENCE_LESSONS.length} بالسؤال الأصلي، ${wordings}/${SCIENCE_LESSONS.length * 2} بالصيغ المعلَّمة، ${parity}/${SCIENCE_LESSONS.length} بنفس درجات الصيغة المراجَعة`,
];
console.log(lines.join('\n'));
// The shared index is what the site uses; it is warm from the lines above and must agree with the measured one.
if (scienceCurriculum().docs.length !== summary.lessons) throw new Error('the shared index is not the curriculum');
