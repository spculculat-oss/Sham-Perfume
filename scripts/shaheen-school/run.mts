/**
 * «مدرسة شاهين» — GitHub Actions runs this every 6 hours (.github/workflows/shaheen-discover.yml):
 *   node --import tsx scripts/shaheen-school/run.mts
 * Exam (no AI) → study the failed questions while an AI engine is up (SCHOOL_MAX_STUDY per run, default 10;
 * the AI packages are respected: a used-up quota just means «study next time») → exam again → report.
 * What he studies goes into src/data/live/shaheen-memory.json: the memory the site answers from when no
 * AI engine is available — in the visitor's browser on GitHub Pages too.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { curateMemory, emptyMemory, isMemoryFile, remember, type MemoryFile } from '../../src/utils/shaheenMemory';
import { guidanceBlock } from '../../src/utils/aiTools';
import { makeAsk, QuotaExhaustedError, quotaBook } from '../doctor/agent';
import { answerBook } from '../doctor/answers';
import { buildBank, emptySchool, exam, importerShare, isSchoolFile, parseStudy, pickStudy, selfLesson, STUDY_SYSTEM, type SchoolFile, type TrainingDoc } from './school';

const env = process.env;
const live = (name: string) => new URL(`../../src/data/live/${name}`, import.meta.url);
const read = <T,>(url: URL): T | undefined => { try { return existsSync(url) ? JSON.parse(readFileSync(url, 'utf8')) as T : undefined; } catch { return undefined; } };
const MAX_STUDY = Math.max(0, Number(env.SCHOOL_MAX_STUDY ?? 10));
const notes: string[] = [];
const say = (line: string) => { console.log(line); notes.push(line); };
const nowIso = new Date().toISOString();

const memoryRaw = read<unknown>(live('shaheen-memory.json'));
const memory: MemoryFile = isMemoryFile(memoryRaw) ? memoryRaw : emptyMemory();
const docs: TrainingDoc[] = read<{ docs?: TrainingDoc[] }>(live('sham-training.json'))?.docs || [];
const schoolRaw = read<unknown>(live('shaheen-school.json'));
const school: SchoolFile = isSchoolFile(schoolRaw) ? schoolRaw : emptySchool();

const bank = buildBank(docs);
const first = exam(bank, memory, docs);
say(`Exam: Shaheen answers ${first.reliance.covered} of ${first.reliance.total} questions by himself (${first.reliance.score}%); ${first.reliance.fromLibrary} more can be learned from his own library`);

// ── Self-study (no AI): his own library lessons become ready answers ──────────────────────────────────────
let selfTaught = 0;
for (const r of first.results) {
  if (r.covered || selfTaught >= 60) continue;
  const lesson = selfLesson(r);
  if (!lesson) continue;
  let kept = 0;
  for (const q of [r.question.q, ...lesson.paraphrases]) if (remember(memory, { question: q, lang: r.question.lang, mode: 'auto', answer: lesson.answer, source: 'study' })) kept++;
  if (kept) selfTaught++;
}
if (selfTaught) say(`Learned ${selfTaught} answers by himself from his library (no AI)`);

// ── Study ─────────────────────────────────────────────────────────────────────────────────────────────────
let studied = 0;
let mode: 'ai' | 'self' = 'self';
const quota = quotaBook(live('ai-quota.json'));
const answers = answerBook(live('ai-memory.json'));
let ask: Awaited<ReturnType<typeof makeAsk>>;
try { ask = await makeAsk(env, { quota, memory: answers, maxWaitMs: 60_000 }); } catch { ask = undefined; }
// Shaheen's supervisor (scripts/shaheen-supervisor) can add quality guidance for the study answers.
const supervisor = read<{ tools?: Record<string, { guidance?: { text?: string } }> }>(live('ai-supervisor.json'));
const SYSTEM = STUDY_SYSTEM + guidanceBlock(supervisor?.tools?.shaheen_school?.guidance?.text);
const todo = pickStudy(first.results, MAX_STUDY);
if (!todo.length) say('Nothing left to study in the bank — Shaheen answers every question by himself');
else if (!ask) say(`No AI engine available: ${todo.length} questions wait for the next study session (Shaheen keeps answering from what he learned)`);
else {
  for (const b of todo) {
    try {
      const reply = await ask(SYSTEM, `السؤال (${b.lang === 'ar' ? 'عربي' : 'English'}): ${b.q}`);
      const lesson = parseStudy(reply, b);
      if (!lesson) { answers.forget(SYSTEM, `السؤال (${b.lang === 'ar' ? 'عربي' : 'English'}): ${b.q}`); say(`Study «${b.q.slice(0, 60)}»: answer did not pass the checks — retried next time`); continue; }
      mode = 'ai';
      let kept = 0;
      for (const q of [b.q, ...lesson.paraphrases]) if (remember(memory, { question: q, lang: b.lang, mode: 'auto', answer: lesson.answer, source: 'study' })) kept++;
      if (kept) {
        studied++;
        school.lastStudied = [{ q: b.q, lang: b.lang, at: nowIso, variants: kept - 1 }, ...school.lastStudied].slice(0, 20);
      }
    } catch (error) {
      if (error instanceof QuotaExhaustedError) { say(`AI packages used up until ${new Date(error.resumeAt).toISOString()} — study continues then`); break; }
      const msg = (error as Error).message;
      say(/no AI engine answered/.test(msg) ? `No AI engine answered: ${todo.length - studied} questions wait for the next study session (Shaheen keeps answering from what he learned)` : `Study paused: ${msg.slice(0, 100)}`);
      break;
    }
  }
  say(`Studied ${studied} new questions${studied ? ' (each kept with its other wordings)' : ''}`);
}
quota.save();
answers.save();

// ── Report ────────────────────────────────────────────────────────────────────────────────────────────────
const { file: curated } = curateMemory(memory);
// Study answers are kept even unused; curate only drops what fails the checks or exceeds the limit.
const learnedNow = studied + selfTaught;
if (learnedNow) writeFileSync(live('shaheen-memory.json'), `${JSON.stringify(curated, null, 1)}\n`);
const final = exam(bank, learnedNow ? curated : memory, docs);
school.reliance = final.reliance;
school.importer = importerShare(read(live('store-review.json'))) || school.importer;
school.studiedTotal += studied;
school.selfTaughtTotal = (school.selfTaughtTotal || 0) + selfTaught;
school.history = [{ at: nowIso, score: final.reliance.score, studied: learnedNow, mode }, ...school.history].slice(0, 60);
school.pending = final.results.filter((r) => !r.covered).slice(0, 12).map((r) => ({ q: r.question.q, lang: r.question.lang, topic: r.question.topic }));
school.updatedAt = nowIso;
writeFileSync(live('shaheen-school.json'), `${JSON.stringify(school, null, 1)}\n`);
say(`Self-reliance now ${final.reliance.score}% (${final.reliance.covered}/${final.reliance.total})${school.importer ? `; product pages read without AI: ${school.importer.localShare}%` : ''}`);

if (env.GITHUB_ACTIONS) console.log(`::notice title=مدرسة شاهين::${notes.join(' | ').replace(/[\r\n%]/g, ' ').slice(0, 900)}`);
if (env.GITHUB_STEP_SUMMARY) {
  appendFileSync(env.GITHUB_STEP_SUMMARY, `## مدرسة شاهين — ${nowIso}\n\n${notes.map((n) => `- ${n}`).join('\n')}\n\n${school.pending.length ? `### لسه هيذاكرها\n${school.pending.map((p) => `- ${p.q}`).join('\n')}\n` : ''}`);
}
