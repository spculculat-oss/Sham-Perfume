/**
 * «تشغيل بلوكات شاهين فعلياً» — the school runs its own programs; the patrol runs «إدارة الذكاء الذاتي»
 * (ai-self) with NO external AI app, and the site-care programme from this hour's real probes.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildProgram, emptyBlocks, type BlocksFile } from '../src/utils/shaheenBlocks';
import { duePrograms, lastRunAt, patrolActions, recordRun, runAndRecord, schoolActions, type PatrolMeasurements, type SchoolMeasurements } from '../scripts/shaheen-school/programs';
import { SCHOOL_PROGRAMS } from '../scripts/shaheen-school/curriculum';

const NOW = Date.parse('2026-10-21T12:00:00Z');
const fresh = (): BlocksFile => ({ ...emptyBlocks(), programs: SCHOOL_PROGRAMS.map((p) => buildProgram(p)) });

test('duePrograms: never-run programs are due; a fresh run delays them; the runner selects its own programs', () => {
  const file = fresh();
  const schoolIds = (list: { id: string }[]) => list.map((p) => p.id).sort();
  assert.deepEqual(schoolIds(duePrograms(file, 'school', NOW)), ['school-day', 'tool-dev'], 'the school executes only its own');
  assert.deepEqual(schoolIds(duePrograms(file, 'patrol', NOW)), ['ai-self', 'site-care'], 'the patrol executes only its own');

  // The school ran its day programme just now → next due in 6 hours.
  recordRun(file, { program: 'school-day', startedAt: 'x', finishedAt: 'y', ok: true, steps: [{ id: 'b1', label: 't', status: 'done' }] }, new Date(NOW));
  assert.deepEqual(schoolIds(duePrograms(file, 'school', NOW)), ['tool-dev']);
  assert.deepEqual(schoolIds(duePrograms(file, 'school', NOW + 6 * 3_600_000)), ['school-day', 'tool-dev']);
  assert.equal(lastRunAt(file, 'school-day'), NOW);

  // The patrol's 12-hour programme behaves the same; the daily site-care programme comes back tomorrow.
  recordRun(file, { program: 'ai-self', startedAt: 'x', finishedAt: 'y', ok: true, steps: [] }, new Date(NOW));
  recordRun(file, { program: 'site-care', startedAt: 'x', finishedAt: 'y', ok: true, steps: [] }, new Date(NOW));
  assert.deepEqual(schoolIds(duePrograms(file, 'patrol', NOW)), []);
  assert.deepEqual(schoolIds(duePrograms(file, 'patrol', NOW + 12 * 3_600_000)), ['ai-self']);
  assert.deepEqual(schoolIds(duePrograms(file, 'patrol', NOW + 24 * 3_600_000)), ['ai-self', 'site-care']);
});

test('the school runs its programmes with real measurements only', async () => {
  const file = fresh();
  const m: SchoolMeasurements = { covered: 460, total: 466, score: 99, selfTaught: 61, studied: 3, toolField: 'المحاسبة', toolFocus: 'مراجعة قواعد التسجيل' };
  const day = file.programs.find((p) => p.id === 'school-day')!;
  const report = await runAndRecord(day, schoolActions(m), file, { gaps: 6 }, new Date(NOW));
  assert.equal(report.ok, true);
  assert.equal(report.steps.length, 6, 'exam → self-study → AI study → hands-on practice → remember → report');
  assert.match(report.steps[0].detail!, /460\/466 \(99%\)/);
  assert.match(report.steps[1].detail!, /61/);
  assert.match(report.steps[2].detail!, /3/);
  assert.equal(file.runs[0].program, 'school-day');
  assert.equal(file.runs[0].ok, true);

  const tools = file.programs.find((p) => p.id === 'tool-dev')!;
  const toolsReport = await runAndRecord(tools, schoolActions(m), file, {}, new Date(NOW));
  assert.equal(toolsReport.ok, true);
  assert.ok(toolsReport.steps.some((s) => /المحاسبة/.test(s.detail || '')), 'the tool field is really named');
  assert.ok(toolsReport.steps.some((s) => /مراجعة قواعد التسجيل/.test(s.detail || '')), 'the next focus is really named');
});

test('the patrol runs «إدارة الذكاء الذاتي»: memory → library → local model → honest note, no external AI', async () => {
  const file = fresh();
  const c: PatrolMeasurements = {
    reliance: { score: 99, covered: 460, total: 466, fromMemory: 455, fromLibrary: 5 },
    localTaught: 74, pending: 6, spellingScore: 96,
    probes: { site: 'الموقع: سليم ✅ — يفتح' },
    openIssues: 2,
  };
  const aiSelf = file.programs.find((p) => p.id === 'ai-self')!;
  const report = await runAndRecord(aiSelf, patrolActions(c), file, { externalEngineUp: false, gaps: 6 }, new Date(NOW));
  assert.equal(report.ok, true);
  const byLabel = Object.fromEntries(report.steps.map((s) => [s.label, s]));
  assert.match(byLabel['قياس الاعتماد على النفس لكل مسار'].detail!, /99% \(460\/466\)/);
  assert.match(byLabel['الرد من ذاكرة شاهين'].detail!, /455/, 'answers really come from memory');
  assert.match(byLabel['الرد من مكتبة شاهين'].detail!, /5/);
  assert.match(byLabel['الرد من النموذج المحلي'].detail!, /74/, 'the self-hosted model (no key, no account)');
  assert.ok(byLabel['الإدارة الذاتية تشتغل بالكامل'], 'the self-management note runs when no engine is up');
  assert.match(byLabel['مراجعة صراحة الردود عند العجز'].detail!, /6/, 'the honest-refusal gap count is real');
  assert.match(byLabel['تقرير الإدارة الذاتية'].detail!, /مرفوع/);

  // With an engine up the self answers STILL run (that is the point) — only the no-engine note is skipped.
  const withEngine = await runAndRecord(file.programs.find((p) => p.id === 'ai-self')!, patrolActions(c), file, { externalEngineUp: true }, new Date(NOW + 3_600_000));
  const labels = withEngine.steps.map((s) => s.label);
  assert.ok(labels.includes('الرد من ذاكرة شاهين'));
  assert.ok(!labels.includes('الإدارة الذاتية تشتغل بالكامل'));
  assert.equal(withEngine.steps.find((s) => s.label === 'لو مفيش محرك خارجي شغال')!.status, 'skipped');
});

test('the site-care programme reports from the hour\'s real probes — and says so when a probe did not run', async () => {
  const file = fresh();
  const c: PatrolMeasurements = {
    reliance: { score: 99, covered: 460, total: 466, fromMemory: 455, fromLibrary: 5 },
    localTaught: 0, pending: 0,
    probes: { site: 'الموقع: سليم ✅', images: 'الصور: فشل ❌ — 3 صور لا تفتح' },
    openIssues: 1,
  };
  const care = file.programs.find((p) => p.id === 'site-care')!;
  const report = await runAndRecord(care, patrolActions(c), file, { siteUp: true }, new Date(NOW));
  assert.equal(report.ok, true);
  const byLabel = Object.fromEntries(report.steps.map((s) => [s.label, s]));
  assert.match(byLabel['فحص صحة الصفحات الأساسية'].detail!, /سليم/);
  assert.match(byLabel['فحص الصور'].detail!, /3 صور لا تفتح/);
  assert.match(byLabel['فحص الروابط المكسورة'].detail!, /وردية أخرى/, 'an uncovered probe is honestly skipped, never faked');
  assert.ok(!byLabel['بلاغ صيانة عاجل'], 'no alert while the site is up');
  assert.ok(byLabel['فحص ثلاث عينات من صفحات المنتجات'], 'the loop step ran');

  // Site down: the alert branch runs and counts the real open items.
  const down = await runAndRecord(care, patrolActions(c), file, { siteUp: false }, new Date(NOW + 3_600_000));
  const downLabels = Object.fromEntries(down.steps.map((s) => [s.label, s]));
  assert.match(downLabels['بلاغ صيانة عاجل'].detail!, /1 مشكلة/, 'the alert counts the real open items');
  assert.equal(downLabels['لو الموقع شغال'].status, 'skipped');
});
