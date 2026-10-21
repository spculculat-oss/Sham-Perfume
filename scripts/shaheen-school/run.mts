/**
 * «مدرسة شاهين» — GitHub Actions runs this every 6 hours (.github/workflows/shaheen-discover.yml):
 *   node --import tsx scripts/shaheen-school/run.mts
 * Exam (no AI) → study the failed questions with «المعلم المحلي» (an open model on the runner, no key —
 * scripts/shaheen-school/teacher.sh) or an AI engine (SCHOOL_MAX_STUDY per run, default 10, within SCHOOL_BUDGET_MIN
 * minutes; the AI packages are respected: a used-up quota just means «study next time») → exam again → report.
 * Every study answer is grounded on what his own library says (src/utils/shaheenLibrary.ts). Visitors' questions that
 * no engine answered (the server's knowledge gaps, with SHAM_ADMIN_TOKEN) are studied first.
 * What he studies goes into src/data/live/shaheen-memory.json: the memory the site answers from when no
 * AI engine is available — in the visitor's browser on GitHub Pages too.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { curateMemory, emptyMemory, isMemoryFile, remember, type MemoryFile } from '../../src/utils/shaheenMemory';
import { guidanceBlock } from '../../src/utils/aiTools';
import { makeAsk, QuotaExhaustedError, quotaBook } from '../doctor/agent';
import { answerBook } from '../doctor/answers';
import { councilStudy, readCouncil } from '../shaheen-council/council';
import { RAW_MATERIALS_DATABASE } from '../../src/data/rawMaterials';
import { referenceBlock, searchLibrary } from '../../src/utils/shaheenLibrary';
import {
  buildBank, emptySchool, exam, importerShare, isSchoolFile, LOCAL_TEACHER_STYLE, materialDocs, pickStudy, selfLesson, STUDY_SYSTEM, studyCheck, studyPrompt,
  visitorQuestions, type BankQuestion, type SchoolFile, type TrainingDoc,
} from './school';

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

// Questions visitors asked while no engine answered (admin-only knowledge gaps on the live server).
let visitors: BankQuestion[] = [];
const site = (env.SHAM_SITE_URL || 'https://sham-perfume-49bf.vercel.app').replace(/\/$/, '');
if (env.SHAM_ADMIN_TOKEN?.trim()) {
  try {
    const response = await fetch(`${site}/api/admin/gaps`, { headers: { Authorization: `Bearer ${env.SHAM_ADMIN_TOKEN.trim()}` }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    visitors = visitorQuestions(((await response.json()) as { items?: [] }).items || []);
    say(`Visitors' questions waiting for study: ${visitors.length}`);
  } catch (error) { say(`Visitors' questions not collected (${(error as Error).message.slice(0, 80)})`); }
}
// His library: the training lessons and the raw-materials encyclopaedia (learned without AI), and the references
// every study answer is grounded on.
const library = [...docs, ...materialDocs(RAW_MATERIALS_DATABASE)];
const bank = buildBank(docs, councilStudy(readCouncil(), Date.now()), visitors, RAW_MATERIALS_DATABASE);
const first = exam(bank, memory, library);
say(`Exam: Shaheen answers ${first.reliance.covered} of ${first.reliance.total} questions by himself (${first.reliance.score}%); ${first.reliance.fromLibrary} more can be learned from his own library`);

// ── Self-study (no AI): his own library lessons become ready answers ──────────────────────────────────────
let selfTaught = 0;
for (const r of first.results) {
  if (r.covered || selfTaught >= 80) continue;
  const lesson = selfLesson(r);
  if (!lesson) continue;
  let kept = 0;
  for (const q of [r.question.q, ...lesson.paraphrases]) if (remember(memory, { question: q, lang: r.question.lang, mode: 'auto', answer: lesson.answer, source: 'study' })) kept++;
  if (kept) selfTaught++;
}
if (selfTaught) say(`Learned ${selfTaught} answers by himself from his library (no AI)`);

// ── Study ─────────────────────────────────────────────────────────────────────────────────────────────────
let studied = 0;
let localTaught = 0;
let mode: 'ai' | 'self' | 'local' = 'self';
let engineUsed = '';
const deadline = Date.now() + Math.max(1, Number(env.SCHOOL_BUDGET_MIN) || 20) * 60_000;
const quota = quotaBook(live('ai-quota.json'));
const answers = answerBook(live('ai-memory.json'));
let ask: Awaited<ReturnType<typeof makeAsk>>;
// SCHOOL_PREFER=self_hosted: the local teacher first (free, always there), the AI services as the fallback.
try { ask = await makeAsk(env, { quota, memory: answers, maxWaitMs: 60_000, prefer: env.SCHOOL_PREFER?.trim() || undefined, onEngine: (id) => { engineUsed = id; } }); } catch { ask = undefined; }
if (env.SHAM_LLM_BASE_URL?.trim()) say(`Local teacher ready (${env.SHAM_LLM_MODEL || 'open model'} on this runner, no key)`);
// Shaheen's supervisor (scripts/shaheen-supervisor) can add quality guidance for the study answers.
const supervisor = read<{ tools?: Record<string, { guidance?: { text?: string } }> }>(live('ai-supervisor.json'));
const localFirst = Boolean(env.SHAM_LLM_BASE_URL?.trim()) && env.SCHOOL_PREFER?.trim() === 'self_hosted';
const SYSTEM = STUDY_SYSTEM + (localFirst ? LOCAL_TEACHER_STYLE : '') + guidanceBlock(supervisor?.tools?.shaheen_school?.guidance?.text);
const todo = pickStudy(first.results, MAX_STUDY);
if (!todo.length) say('Nothing left to study in the bank — Shaheen answers every question by himself');
else if (!ask) say(`No AI engine available: ${todo.length} questions wait for the next study session (Shaheen keeps answering from what he learned)`);
else {
  for (const b of todo) {
    if (Date.now() > deadline) { say(`Study time is up: ${todo.length - todo.indexOf(b)} questions wait for the next session`); break; }
    const prompt = studyPrompt(b, referenceBlock(searchLibrary({ lessons: library, materials: [], memory }, b.q, b.lang)));
    const started = Date.now();
    try {
      engineUsed = '';
      const reply = await ask(SYSTEM, prompt);
      const checked = studyCheck(reply, b);
      const lesson = 'lesson' in checked ? checked.lesson : null;
      const teacher = engineUsed === 'self_hosted' ? 'local teacher' : engineUsed || 'saved answer';
      const rehearsal = env.PUBLISH !== 'true';
      const preview = (text: string) => text.replace(/\s+/g, ' ').slice(0, 160);
      if (!lesson) { answers.forget(SYSTEM, prompt); say(`Study «${b.q.slice(0, 60)}» (${teacher}): ${'reason' in checked ? checked.reason : ''} — retried next time${rehearsal ? ` [${preview(reply)} … ${reply.replace(/\s+/g, ' ').slice(-120)}]` : ''}`); continue; }
      if (rehearsal) say(`Lesson «${b.q.slice(0, 60)}» (${teacher}): ${preview(lesson.answer)}`);
      if (engineUsed === 'self_hosted') { if (mode !== 'ai') mode = 'local'; } else mode = 'ai';
      let kept = 0;
      for (const q of [b.q, ...lesson.paraphrases]) if (remember(memory, { question: q, lang: b.lang, mode: 'auto', answer: lesson.answer, source: 'study' })) kept++;
      if (kept) {
        studied++;
        if (engineUsed === 'self_hosted') localTaught++;
        console.log(`Studied «${b.q.slice(0, 80)}» with the ${teacher} in ${Math.round((Date.now() - started) / 1000)}s (${kept - 1} other wordings)`);
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
const final = exam(bank, learnedNow ? curated : memory, library);
school.reliance = final.reliance;
school.importer = importerShare(read(live('store-review.json'))) || school.importer;
school.studiedTotal += studied;
school.localTaughtTotal = (school.localTaughtTotal || 0) + localTaught;
if (localTaught) say(`The local teacher (open model, no key) taught ${localTaught} of them`);
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
