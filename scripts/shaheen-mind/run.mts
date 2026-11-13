/**
 * «حلقة تعلّم شاهين» — the learning loop, one run a day (`.github/workflows/shaheen-mind.yml`):
 *
 *   الآذان  → what the platform is really asked (from Shaheen's memory and the school's pending list, with every
 *             personal detail dropped) and what it still cannot answer.
 *   المعلم  → the mind's weak links (a destination with no explanation or no published cost, a carrier whose
 *             dangerous-goods answer is unknown, an immune contradiction) become a study plan **and** exam
 *             questions whose answers are already written in the site's files.
 *   الممتحن → asks those questions to the real offline agent (no network, no engine) and marks it against the
 *             recorded answers: one number, «درجة الذكاء», with every miss named.
 *   الانعكاس→ the answers a visitor must get instantly are rebuilt from the price engine itself.
 *
 * Usage: node --import tsx scripts/shaheen-mind/run.mts [--no-exam]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { pickSpecialist, SPECIALISTS } from '../../src/utils/shaheenSpecialists';
import { isShaheenGraph, type ShaheenGraph } from '../../src/utils/shaheenGraph';
import { type FxTable, type ShippingCosts, type ShippingTable } from '../../src/utils/pricing';
import { academyLessons } from '../shaheen-school/curriculum';
import { collectEars, isEarsReport, type EarsEntry } from './ears';
import { isExamReport, scoreExam, type ExamAttempt } from './exam';
import { buildReflex, isReflexReport } from './reflex';
import { reflexDestinations, tradeSpecialistId, type ShippingLanes, type TradeLanes } from './reflexFiles';
import { buildStudyPlan, isStudyPlan } from './tutor';

const env = process.env;
const noExam = process.argv.includes('--no-exam') || env.MIND_SKIP_EXAM === '1';
const read = (rel: string) => JSON.parse(readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8'));
const now = Date.now();
const write = (name: string, value: unknown) => writeFileSync(new URL(`../../src/data/live/${name}`, import.meta.url), `${JSON.stringify(value, null, 1)}\n`);
const iso = new Date(now).toISOString().slice(0, 10);

const graph = read('src/data/live/shaheen-graph.json') as ShaheenGraph;
if (!isShaheenGraph(graph)) { console.error('::error::شبكة العقل مش موجودة — شغّل سينابس الأول'); process.exit(1); }
const immune = read('src/data/live/shaheen-immune.json') as { findings: { kind: string; severity: string; subject: string; whatAr: string; fixAr: string }[] };
const trade = read('src/data/live/trade-lanes.json') as TradeLanes;
const lanes = read('src/data/shipping-lanes.json') as ShippingLanes;
const costs = read('src/data/shipping-costs.json') as ShippingCosts;
// نفس الجدول اللي الموقع بيحسب بيه: أسعار المناطق + تكلفة كل وجهة الحقيقية.
const shipping: ShippingTable = { ...(read('src/data/shipping.json') as ShippingTable), costs };
const fx = read('src/data/live/fx-rates.json') as FxTable;
const memory = read('src/data/live/shaheen-memory.json') as { entries: { question: string; lang?: string; answer?: string }[] };
const school = read('src/data/live/shaheen-school.json') as { pending?: { q: string; lang?: string }[] };

const destinations = reflexDestinations(trade, lanes, costs, shipping, fx);

// ── 1) الآذان: اللي بيتسأل فعلاً ────────────────────────────────────────────────────────────────
const entries: EarsEntry[] = [
  ...memory.entries.filter((e) => e.question).map((e) => ({ question: e.question, count: 1, lang: (e.lang === 'en' ? 'en' : 'ar') as 'ar' | 'en', state: 'answered' as const })),
  ...(school.pending || []).map((p) => ({ question: p.q, count: 1, lang: (p.lang === 'en' ? 'en' : 'ar') as 'ar' | 'en', state: 'pending' as const })),
];
const ears = collectEars({
  now, entries,
  pick: (question) => pickSpecialist(question)?.id || tradeSpecialistId,
  specialists: SPECIALISTS.map((s) => ({ id: s.id, nameAr: s.nameAr })),
  lessonQuestions: academyLessons().map((l) => l.title),
  limit: 400,
});
if (!isEarsReport(ears)) { console.error('::error::تقرير الآذان مش سليم'); process.exit(1); }
write('shaheen-ears.json', ears);

// ── 2) المعلم: الحلقات الضعيفة ← خطة دراسة + أسئلة امتحان ────────────────────────────────────────
const plan = buildStudyPlan({
  now, graph, destinations,
  immuneFindings: immune.findings || [],
  origins: trade.origins,
  specialists: SPECIALISTS.map((s) => ({ id: s.id, nameAr: s.nameAr, tracks: s.tracks })),
  tradeSpecialistId,
  examSize: Number(env.MIND_EXAM_SIZE) || 12,
  // سؤال استرجاع من كل مجال: الطلب الحقيقي اللي اتسأل واتجاوب، وإجابته محفوظة في الذاكرة.
  recall: memory.entries
    .filter((e) => e.question && String(e.answer || '').length > 80)
    .map((e) => ({ question: e.question, answer: String(e.answer), specialistId: pickSpecialist(e.question)?.id || tradeSpecialistId })),
  recallSize: Number(env.MIND_RECALL_SIZE) || 6,
});
if (!isStudyPlan(plan)) { console.error('::error::خطة المعلم مش سليمة'); process.exit(1); }
write('shaheen-study.json', plan);

// ── 3) الممتحن: نفس الأسئلة على الوكيل الحقيقي، من غير إنترنت ولا محرك ───────────────────────────
async function runExam() {
  const { trainingCore } = await import('../shaheen-specialists/bench');
  const { runSpecialistAgent } = await import('../../server/specialists/agent');
  const { RAW_MATERIALS_DATABASE } = await import('../../src/data/rawMaterials');
  const core = await trainingCore();
  const offline = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
  const attempts: ExamAttempt[] = [];
  for (const q of plan.questions) {
    const specialist = SPECIALISTS.find((s) => s.id === q.specialistId);
    try {
      const started = Date.now();
      const result = await runSpecialistAgent(
        { question: q.question, lang: 'ar', ...(specialist ? { specialistId: specialist.id } : {}) },
        { repo: core.repo, memory: core.memory, env: core.env, fetch: offline, library: async () => ({ lessons: core.lessons, materials: RAW_MATERIALS_DATABASE, memory: await core.memory.all().catch(() => undefined) }) },
      );
      attempts.push({ id: q.id, answer: String(result.answer || ''), source: String(result.source || ''), answered: Boolean(result.answer) });
      console.log(`· ${q.id}: ${result.source} (${Date.now() - started}ms)`);
    } catch (error) {
      attempts.push({ id: q.id, answer: '', source: 'gap', answered: false });
      console.log(`· ${q.id}: خطأ — ${(error as Error).message}`);
    }
  }
  return attempts;
}

const previousExam = read('src/data/live/shaheen-exam.json') as unknown;
const attempts: ExamAttempt[] = noExam ? [] : await runExam();
const exam = noExam && isExamReport(previousExam)
  // --no-exam: بنسيب آخر امتحان حقيقي زي ما هو بدل ما نكتب صفر كاذب.
  ? { ...previousExam, planAr: ['الامتحان اتخطى في التشغيل ده (--no-exam) — الأرقام من آخر امتحان حقيقي.'] }
  : scoreExam({ now, questions: plan.questions, attempts, specialists: SPECIALISTS.map((s) => ({ id: s.id, nameAr: s.nameAr })) });
if (!isExamReport(exam)) { console.error('::error::تقرير الممتحن مش سليم'); process.exit(1); }
write('shaheen-exam.json', exam);

// ── 4) الانعكاس: إجابات فورية من محرك السعر نفسه ────────────────────────────────────────────────
const reflex = buildReflex({ now, shipping, fx, destinations, tradeSpecialistId });
if (!isReflexReport(reflex)) { console.error('::error::جدول الانعكاس مش سليم'); process.exit(1); }
write('shaheen-reflex.json', reflex);

// ── التقرير ────────────────────────────────────────────────────────────────────────────────────
console.log(ears.summaryAr);
console.log(plan.summaryAr);
console.log(exam.summaryAr);
console.log(`الانعكاس: ${reflex.entries.length} إجابة فورية جاهزة (بدون محرك ولا إنترنت)`);
for (const line of plan.planAr) console.log(`- ${line}`);
for (const line of exam.planAr) console.log(`- ${line}`);

if (env.GITHUB_STEP_SUMMARY) {
  const earsRows = ears.bySpecialist.slice(0, 10).map((r) => `| ${r.specialistNameAr} | ${r.asked} | ${r.pending} | ${r.top[0]?.slice(0, 60) || '—'} |`);
  const scoreRows = exam.bySpecialist.map((s) => `| ${s.nameAr} | ${s.correct}/${s.asked} | ${s.percent}% | ${s.missedAr?.slice(0, 60) || '—'} |`);
  const missRows = exam.misses.slice(0, 12).map((m) => `| ${m.question} | ${m.expected.join(' · ')} | ${m.whyAr} | ${m.source} |`);
  const targetRows = plan.targets.slice(0, 12).map((t) => `| ${t.labelAr} | ${t.whyAr} | ${t.priority} |`);
  const lines = [
    '## حلقة تعلّم شاهين', '',
    `- ${ears.summaryAr}`, `- ${plan.summaryAr}`, `- ${exam.summaryAr}`, `- الانعكاس: ${reflex.entries.length} إجابة فورية`, '',
    '### أكتر اللي بيتسأل', '| المتخصص | أسئلة | لسه بلا جواب | أعلى سؤال |', '|---|---|---|---|', earsRows.join('\n') || '| — | — | — | — |', '',
    '### الامتحان', '| المتخصص | صح | النسبة | أول سؤال فاته |', '|---|---|---|---|', scoreRows.join('\n') || '| — | — | — | — |', '',
    ...(missRows.length ? ['### اللي فات', '| السؤال | المتوقع | ليه | المصدر |', '|---|---|---|---|', missRows.join('\n'), ''] : []),
    '### خطة الدراسة', '| الحلقة الضعيفة | ليه | الأولوية |', '|---|---|---|', targetRows.join('\n') || '| — | — | — |',
  ];
  writeFileSync(env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, { flag: 'a' });
}
if (env.GITHUB_ACTIONS) {
  const clip = (t: string) => t.replace(/[\r\n%]/g, ' ').slice(0, 2800);
  console.log(`::notice title=Shaheen mind loop::${clip(`${ears.summaryAr} · ${exam.summaryAr}`)}`);
  if (exam.iq < 60) console.log(`::warning title=Shaheen mind loop::${clip(`درجة الذكاء ${exam.iq}/100 — ${exam.planAr[0] || ''}`)}`);
}
