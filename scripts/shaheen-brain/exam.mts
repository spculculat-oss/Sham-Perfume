/**
 * «امتحان عقل شاهين» — asks one model (llama.cpp on the runner, SHAM_LLM_BASE_URL) the exam paper and records
 * the mark in src/data/live/shaheen-brain.json:
 *   EXAM_ROLE=baseline  the current brain (the mark to beat)
 *   EXAM_ROLE=candidate a newly trained brain — approved only if honest and at least as good (scripts/shaheen-brain/exam.ts)
 * EXAM_MODEL_NAME / EXAM_MODEL_URL / EXAM_MODEL_SHA256 describe the model; BRAIN_OUT holds shaheen-eval.jsonl
 * (scripts/shaheen-brain/dataset.mts, same commit = same paper). EXAM_MAX questions (default 24), EXAM_BUDGET_MIN.
 * No AI platform is ever called here: only the open model on this runner.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { callEngine } from '../../server/core/engines';
import { SHAHEEN_SYSTEM, type BrainExample } from './dataset';
import { PROBES, approve, examItems, gradeExam, type ExamAnswer } from './exam';
import { BRAIN_REPORT, emptyReport, markToBeat, readReport, recordExam, validModel, type BrainExam } from './report';

const env = process.env;
const role = env.EXAM_ROLE === 'baseline' ? 'baseline' : 'candidate';
const model = { name: env.EXAM_MODEL_NAME?.trim() || '', url: env.EXAM_MODEL_URL?.trim() || '', sha256: (env.EXAM_MODEL_SHA256 || '').trim().toLowerCase() };
const fail = (why: string) => { console.log(`::warning title=امتحان عقل شاهين::${why}`); process.exit(0); };
if (!env.SHAM_LLM_BASE_URL?.trim()) fail('النموذج مش شغال على الجهاز — مفيش امتحان المرة دي');
if (!validModel(model)) fail('بيانات النموذج ناقصة أو مش آمنة (رابط .gguf على Hugging Face أو GitHub + بصمة SHA-256)');

const dir = env.BRAIN_OUT?.trim() || join(env.RUNNER_TEMP || tmpdir(), 'shaheen-brain');
const evalFile = join(dir, 'shaheen-eval.jsonl');
if (!existsSync(evalFile)) fail('ورقة الامتحان مش موجودة — شغّل dataset.mts الأول');
const heldOut = readFileSync(evalFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as BrainExample);
const evalSha = JSON.parse(readFileSync(join(dir, 'shaheen-card.json'), 'utf8')).sha256.eval as string;
const items = examItems(heldOut, Number(env.EXAM_MAX) || 24);
const deadline = Date.now() + (Number(env.EXAM_BUDGET_MIN) || 30) * 60_000;

const ask = async (lang: 'ar' | 'en', text: string) => {
  if (Date.now() > deadline) return '';
  try {
    return (await callEngine('self_hosted', SHAHEEN_SYSTEM[lang], [{ role: 'user', text }], {
      env, signal: AbortSignal.timeout(150_000), temperature: 0.2, maxTokens: 420, maxChars: 4000,
    })) || '';
  } catch { return ''; }
};

console.log(`امتحان ${role === 'baseline' ? 'العقل الحالي' : 'العقل الجديد'} «${model.name}»: ${items.length} سؤال + ${PROBES.length} أسئلة أمانة`);
const answers: ExamAnswer[] = [];
for (const it of items) answers.push({ id: it.id, reply: await ask(it.lang, it.question) });
const probeAnswers: ExamAnswer[] = [];
for (const p of PROBES) probeAnswers.push({ id: p.id, reply: await ask(p.lang, p.ask) });
const result = gradeExam(items, answers, probeAnswers);

const path = new URL(`../../${BRAIN_REPORT}`, import.meta.url);
let report = existsSync(path) ? readReport(JSON.parse(readFileSync(path, 'utf8'))) : emptyReport();
const exam: BrainExam = { at: new Date().toISOString(), role, model, evalSha, result };
if (role === 'candidate') Object.assign(exam, approve(result, markToBeat(report, evalSha)?.result));
report = recordExam(report, exam);
writeFileSync(path, JSON.stringify(report, null, 1) + '\n');

console.log(`الدرجة ${result.score} (تشابه مع الإجابات المراجَعة ${result.qa}، اللغة ${result.language}، الأمانة ${result.probes.passed}/${result.probes.total})، رد على ${result.answered}/${result.asked}`);
if (role === 'candidate') console.log(`${exam.approved ? '::notice title=عقل شاهين::' : '::warning title=عقل شاهين::'}${exam.whyAr}`);
if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `score=${result.score}\napproved=${exam.approved ? 'true' : 'false'}\n`);
