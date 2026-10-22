import { bookStudyBriefing } from '../../server/library/bookStudyArchive';
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
import { research, RESEARCH_USER_AGENT, researchBlock, type Research } from '../../src/utils/webResearch';
import {
  buildBank, emptySchool, exam, importerShare, isSchoolFile, LOCAL_TEACHER_STYLE, materialDocs, pickStudy, parseReview, REVIEW_SYSTEM, reviewPrompt, selfLesson, STUDY_SYSTEM, studyCheck, studyPrompt,
  spellingReport, toolStats, trackStats, visitorQuestions, type BankQuestion, type SchoolFile, type TrainingDoc,
} from './school';
import { academyLessons, SCHOOL_PROGRAMS, TRACKS } from './curriculum';
import { duePrograms, runAndRecord, schoolActions } from './programs';
import { buildProgram, emptyBlocks, isBlocksFile, nextRun, validateProgram, type BlocksFile } from '../../src/utils/shaheenBlocks';
import { buildLexicon } from '../../src/utils/shaheenSpelling';

const env = process.env;
const live = (name: string) => new URL(`../../src/data/live/${name}`, import.meta.url);
const read = <T,>(url: URL): T | undefined => { try { return existsSync(url) ? JSON.parse(readFileSync(url, 'utf8')) as T : undefined; } catch { return undefined; } };
const MAX_STUDY = Math.max(0, Number(env.SCHOOL_MAX_STUDY ?? 10));
const notes: string[] = [];
const say = (line: string) => { console.log(line); notes.push(line); };
const nowIso = new Date().toISOString();

// Study queue is context only, never trusted training lessons or visitor memory.
for (const line of bookStudyBriefing()) say(line);

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
// His library: the training lessons and the raw-materials encyclopaedia (learned without AI), the academy
// lessons (all programming languages, blocks & scheduling, software engineering, graphics & design, website
// maintenance, and every AI tool's field), and the references every study answer is grounded on.
const academy = academyLessons();
const library = [...docs, ...materialDocs(RAW_MATERIALS_DATABASE), ...academy];
const bank = buildBank(docs, councilStudy(readCouncil(), Date.now()), visitors, RAW_MATERIALS_DATABASE);
const first = exam(bank, memory, library);
say(`Exam: Shaheen answers ${first.reliance.covered} of ${first.reliance.total} questions by himself (${first.reliance.score}%); ${first.reliance.fromLibrary} more can be learned from his own library`);

// ── Self-study (no AI): his own library lessons become ready answers ──────────────────────────────────────
// Intensive by default (the academy teaches all its missions in a run or two); SCHOOL_INTENSIVE=0 keeps the old pace.
const SELF_CAP = env.SCHOOL_INTENSIVE === '0' ? 80 : 250;
let selfTaught = 0;
for (const r of first.results) {
  if (r.covered || selfTaught >= SELF_CAP) continue;
  const lesson = selfLesson(r);
  if (!lesson) continue;
  let kept = 0;
  // Question + two close wordings are enough: recallSimilar answers the rest from the closest wording.
  for (const q of [r.question.q, ...lesson.paraphrases.slice(0, 2)]) if (remember(memory, { question: q, lang: r.question.lang, mode: 'auto', answer: lesson.answer, source: 'study' })) kept++;
  if (kept) selfTaught++;
}
if (selfTaught) say(`Learned ${selfTaught} answers by himself from his library (no AI)${selfTaught >= SELF_CAP ? ' (the rest next run)' : ''}`);

// ── Study ─────────────────────────────────────────────────────────────────────────────────────────────────
let studied = 0;
let localTaught = 0;
let researched = 0;
let reviewRejected = 0;
let mode: 'ai' | 'self' | 'local' = 'self';
let engineUsed = '';
const deadline = Date.now() + Math.max(1, Number(env.SCHOOL_BUDGET_MIN) || 20) * 60_000;
const quota = quotaBook(live('ai-quota.json'));
const answers = answerBook(live('ai-memory.json'));
let ask: Awaited<ReturnType<typeof makeAsk>>;
// SCHOOL_PREFER=self_hosted: the local teacher first (free, always there), the AI services as the fallback.
try { ask = await makeAsk(env, { bot: 'teacher', quota, memory: answers, maxWaitMs: 60_000, prefer: env.SCHOOL_PREFER?.trim() || undefined, onEngine: (id) => { engineUsed = id; } }); } catch { ask = undefined; }
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
    // «باحث شاهين»: what open sources (Wikipedia) say about it, read and analysed, joins his library's references.
    const found: Research | undefined = env.SHAM_WEB_RESEARCH === '0' ? undefined
      : await research(fetch as never, b.q, b.lang, { userAgent: RESEARCH_USER_AGENT, timeoutMs: 20_000 }).catch(() => undefined);
    if (found) researched++;
    const prompt = studyPrompt(b, [referenceBlock(searchLibrary({ lessons: library, materials: [], memory }, b.q, b.lang), 1200), researchBlock(found, 1400)].filter(Boolean).join('\n'));
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
      // The local teacher's lesson is reviewed by a strict second pass before it is kept.
      if (engineUsed === 'self_hosted') {
        const verdict = parseReview(await ask(REVIEW_SYSTEM, reviewPrompt(b, lesson.answer)).catch(() => ''));
        if (!verdict.ok) {
          answers.forget(SYSTEM, prompt); answers.forget(REVIEW_SYSTEM, reviewPrompt(b, lesson.answer)); reviewRejected++;
          say(`Review rejected «${b.q.slice(0, 60)}»: ${verdict.reason}${rehearsal ? ` [${preview(lesson.answer)}]` : ''} — studied again next time`);
          continue;
        }
      }
      if (rehearsal) say(`Lesson «${b.q.slice(0, 60)}» (${teacher}${found ? `, read ${found.sources.map((x) => x.title).join(' + ')}` : ''}): ${preview(lesson.answer)}`);
      // Wikipedia's text is CC BY-SA: a lesson written from it names its articles.
      if (found) lesson.answer += `\n\n_${b.lang === 'ar' ? 'مراجع' : 'Sources'}: ${found.sources.map((x) => `${b.lang === 'ar' ? 'ويكيبيديا' : 'Wikipedia'} «${x.title}»`).join('، ')}_`;
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
  say(`Studied ${studied} new questions${studied ? ' (each kept with its other wordings)' : ''}; open sources found for ${researched}; ${reviewRejected} lessons rejected by the review`);
}
// Rehearsal (branches): «باحث شاهين» tried live on a few everyday questions, so a change is checked on the real web.
if (env.PUBLISH !== 'true' && env.SHAM_WEB_RESEARCH !== '0') {
  for (const [q, lang] of [['ايه هو البخور وبيتعمل ازاي؟', 'ar'], ['ايه هو المسك؟', 'ar'], ['ايه تاريخ ماء الورد؟', 'ar'], ['What is ambergris?', 'en']] as const) {
    const r = await research(fetch as never, q, lang, { userAgent: RESEARCH_USER_AGENT, timeoutMs: 20_000 }).catch((error: Error) => error);
    say(r instanceof Error ? `Research «${q}»: failed (${r.message.slice(0, 60)})`
      : r ? `Research «${q}» → ${r.sources.map((x) => x.title).join(' + ')} (${r.passages.length} passages, ${r.passages.filter((p) => p.agreed > 1).length} confirmed): ${r.passages[0]!.text.slice(0, 70)}`
      : `Research «${q}»: nothing solid found`);
  }
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
// The academy missions: per-track self-reliance, and every AI tool's field with what it studies next.
school.tracks = trackStats(final.results);
const tracksLine = TRACKS.map((t) => `${t.titleAr} ${(school.tracks![t.id] || { score: 0 }).score}%`).join('، ');
say(`المسارات: ${tracksLine}`);
school.tools = toolStats(final.results, nowIso);
const weakest = [...school.tools.items].sort((a, b) => a.score - b.score).slice(0, 3).map((t) => `${t.field} ${t.score}%`).join('، ');
say(`تطوير الأدوات: ${school.tools.items.length} أداة في مجالها — أضعفها ${weakest || 'مكتملة'}`);
school.importer = importerShare(read(live('store-review.json'))) || school.importer;
school.studiedTotal += studied;
school.localTaughtTotal = (school.localTaughtTotal || 0) + localTaught;
if (localTaught) say(`The local teacher (open model, no key) taught ${localTaught} of them`);
school.selfTaughtTotal = (school.selfTaughtTotal || 0) + selfTaught;
school.history = [{ at: nowIso, score: final.reliance.score, studied: learnedNow, mode }, ...school.history].slice(0, 60);
// «فهم شاهين للغلطات»: the spelling drill and exam (mistyped words and questions must still be understood).
school.spelling = spellingReport(bank, final.results, learnedNow ? curated : memory, library, buildLexicon({ lessons: [...docs, ...academy], materials: RAW_MATERIALS_DATABASE, memory: learnedNow ? curated : memory }), nowIso);
say(`Spelling: understood ${school.spelling.understood}/${school.spelling.tried} mistyped words (${school.spelling.score}%); answers ${school.spelling.questions.answered}/${school.spelling.questions.tried} questions by himself with their main word mistyped`);
school.pending = final.results.filter((r) => !r.covered).slice(0, 12).map((r) => ({ q: r.question.q, lang: r.question.lang, topic: r.question.topic }));
school.updatedAt = nowIso;
// «بلوكات شاهين»: he builds his programs from blocks, schedules them, and RUNS the due ones for real.
const blocksRaw = read<unknown>(live('shaheen-blocks.json'));
const blocks: BlocksFile = isBlocksFile(blocksRaw) ? blocksRaw : emptyBlocks();
const built = SCHOOL_PROGRAMS.map((p) => buildProgram(p));
const blockErrors = built.flatMap((p) => validateProgram(p).map((e) => `${p.id}: ${e}`));
blocks.programs = built;
blocks.updatedAt = nowIso;
// Execute the school's due programs (study day, tool development) with this run's real measurements.
const toolItems = school.tools?.items || [];
const weakestTool = [...toolItems].sort((a, b) => a.score - b.score)[0] || { field: '—', focus: '—', score: 0, covered: 0, total: 0, id: '' };
const schoolBlockActions = schoolActions({
  covered: final.reliance.covered, total: final.reliance.total, score: final.reliance.score,
  selfTaught, studied,
  toolField: weakestTool.field, toolFocus: weakestTool.focus,
});
for (const program of duePrograms(blocks, 'school', Date.parse(nowIso))) {
  const report = await runAndRecord(program, schoolBlockActions, blocks, { gaps: final.reliance.total - final.reliance.covered }, new Date(nowIso));
  const failed = report.steps.filter((s) => s.status === 'failed');
  say(`البرنامج «${program.title}»: ${report.ok ? 'اشتغل بالكامل' : `مع ${failed.length} خطوة فاشلة`} (${report.steps.length} خطوة)`);
}
const nextRuns = built.map((p) => ({ id: p.id, next: p.schedule ? (nextRun(p.schedule, Date.parse(nowIso))?.toISOString() || null) : null }));
writeFileSync(live('shaheen-blocks.json'), `${JSON.stringify(blocks, null, 1)}\n`);
school.blocks = { at: nowIso, programs: built.length, scheduled: nextRuns.filter((n) => n.next).length, errors: blockErrors.length, nextRuns };
if (blockErrors.length) say(`Block programs need fixes: ${blockErrors.slice(0, 3).join(' | ')}`);
else say(`Built ${built.length} block programs and scheduled ${school.blocks.scheduled} of them (${built.map((p) => p.id).join('، ')})`);
writeFileSync(live('shaheen-school.json'), `${JSON.stringify(school, null, 1)}\n`);
say(`Self-reliance now ${final.reliance.score}% (${final.reliance.covered}/${final.reliance.total})${school.importer ? `; product pages read without AI: ${school.importer.localShare}%` : ''}`);

if (env.GITHUB_ACTIONS) console.log(`::notice title=مدرسة شاهين::${notes.join(' | ').replace(/[\r\n%]/g, ' ').slice(0, 900)}`);
if (env.GITHUB_STEP_SUMMARY) {
  appendFileSync(env.GITHUB_STEP_SUMMARY, `## مدرسة شاهين — ${nowIso}\n\n${notes.map((n) => `- ${n}`).join('\n')}\n\n${school.pending.length ? `### لسه هيذاكرها\n${school.pending.map((p) => `- ${p.q}`).join('\n')}\n` : ''}`);
}
