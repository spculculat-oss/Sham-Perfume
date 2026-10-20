/**
 * «خريطة تشغيل شام»: every bot is on the map, the score uses real data only (no data → «بدون بيانات»),
 * a broken run is always a defect with its cause in plain Arabic, and the journeys only use real bots.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BOTS, DEPARTMENTS, botOf } from '../src/utils/shaheenOrg';
import type { BotCheck, PrecheckFile } from '../scripts/shaheen-council/precheck';
import { runPrecheck } from '../scripts/shaheen-council/precheck';
import {
  GRADE_AT, JOURNEYS, MAP, ROOT, WEIGHTS, failureCauseAr, gradeOf, journeyHealth, layout, scoreAll, scoreBot, shortName, summarize,
  type SupervisorFile,
} from '../src/utils/opsMap';

const NOW = Date.parse('2026-10-21T08:00:00Z');
const iso = (t: number) => new Date(t).toISOString();
const run = (conclusion: string, extra = {}) => ({ conclusion, status: 'completed', at: iso(NOW - 3_600_000), url: 'https://example.test/run', ...extra });

function precheck(bots: Partial<BotCheck>[]): PrecheckFile {
  const list: BotCheck[] = BOTS.map((b) => ({ id: b.id, status: 'idle', problems: [], fixes: [], ideas: [], ...bots.find((x) => x.id === b.id) }));
  return { version: 1, updatedAt: iso(NOW), meetingAt: iso(NOW), health: 0, counts: { ok: 0, warn: 0, fail: 0, idle: 0 }, summaryAr: '', bots: list, handoffs: [] };
}

test('the map places every bot once, inside the canvas, without overlaps', () => {
  const pos = layout();
  assert.equal(pos.length, BOTS.length);
  assert.equal(new Set(pos.map((p) => p.id)).size, BOTS.length);
  for (const p of pos) {
    assert.ok(p.x - MAP.nodeW / 2 >= 0 && p.x + MAP.nodeW / 2 <= MAP.width, `${p.id} is off the map sideways`);
    assert.ok(p.y + MAP.nodeH / 2 <= MAP.height && p.y > ROOT.y, `${p.id} is off the map vertically`);
  }
  for (const a of pos) for (const b of pos) if (a !== b && a.x === b.x) assert.ok(Math.abs(a.y - b.y) >= MAP.nodeH, `${a.id} overlaps ${b.id}`);
  assert.equal(new Set(pos.map((p) => p.x)).size, DEPARTMENTS.length, 'one column per department');
  assert.equal(shortName('الدورية بالتناوب (فحص وإصلاح ومراجعة خبير)'), 'الدورية بالتناوب');
  assert.equal(shortName('السكرتير — مشرف شاهين'), 'السكرتير');
});

test('journeys use only real bots, and the weakest step decides their health', () => {
  for (const j of JOURNEYS) {
    assert.ok(j.steps.length >= 3, j.id);
    for (const s of j.steps) assert.ok(botOf(s.bot), `${j.id}: unknown bot ${s.bot}`);
  }
  const scores = scoreAll({ precheck: precheck([{ id: 'scout', status: 'ok', lastRun: run('success') }, { id: 'images', status: 'fail', problems: ['آخر تشغيل فشل'], lastRun: run('failure') }]) });
  const product = JOURNEYS.find((j) => j.id === 'product')!;
  assert.deepEqual(journeyHealth(product, scores), { grade: 'fail', weakest: 'images' });
});

test('real data only: a bot that never ran and has no review is «بدون بيانات», never a guessed number', () => {
  const s = scoreBot('design_expert', { precheck: precheck([]) });
  assert.equal(s.score, null); assert.equal(s.grade, 'idle'); assert.deepEqual(s.parts, []);
  // A workflow that never ran is not «late» either.
  const patrol = scoreBot('patrol', { precheck: precheck([{ id: 'patrol', status: 'idle', problems: ['لسه ما كتبش تقرير'] }]) });
  assert.equal(patrol.grade, 'idle');
  // A run skipped by its own condition says nothing.
  assert.equal(scoreBot('product_pages', { precheck: precheck([{ id: 'product_pages', lastRun: run('skipped') }]) }).grade, 'idle');
});

test('the score: run, report, AI quality, own numbers, expert review — weighted, and a failure is always a defect', () => {
  const sup: SupervisorFile = { tools: { seo_agent: { nameAr: 'منارة شاهين', score: 9, strengths: ['عناوين واضحة'], issues: [] } } };
  const good = scoreBot('seo', { precheck: precheck([{ id: 'seo', status: 'ok', lastRun: run('success'), reportAt: iso(NOW - 3_600_000), ageHours: 1 }]), supervisor: sup });
  assert.equal(good.grade, 'high'); assert.ok(good.score! >= GRADE_AT.high);
  assert.deepEqual(good.parts.map((p) => p.key).sort(), ['own', 'quality', 'report', 'run']);
  assert.ok(good.strengths.includes('عناوين واضحة'));

  const broken = scoreBot('seo', {
    precheck: precheck([{ id: 'seo', status: 'fail', problems: ['آخر تشغيل فشل'], cause: ['اختبارات الجودة رفضت النتيجة قبل النشر', 'test — not ok 495 - rotating shifts'], lastRun: run('failure'), reportAt: iso(NOW - 3_600_000), ageHours: 1 }]),
    supervisor: sup,
  });
  assert.equal(broken.grade, 'fail', 'a failed run is a defect even with a high quality score');
  assert.ok(broken.score! < GRADE_AT.warn);
  assert.match(broken.causes[0], /^آخر تشغيل فشل: اختبارات الجودة/);
  assert.ok(broken.causes.some((c) => /not ok 495/.test(c)));

  const weak = scoreBot('store_advisor', { precheck: precheck([{ id: 'store_advisor', status: 'warn', problems: ['تقييم 4.8 من 10'] }]), supervisor: { tools: { store_advisor: { nameAr: 'مستشار التسوق', score: 4.8, issues: ['لم يرشّح أي منتج'] } } } });
  assert.ok(weak.score! < GRADE_AT.good, String(weak.score));
  assert.ok(weak.causes.some((c) => /لم يرشّح أي منتج/.test(c)));

  const keys = scoreBot('keys', { precheck: precheck([{ id: 'keys', status: 'warn', problems: ['محركات متوقفة مؤقتاً: deepseek'], lastRun: run('success'), reportAt: iso(NOW), ageHours: 0 }]) });
  assert.equal(keys.owner, true, 'only the owner can recharge a key');
  assert.ok(keys.score! < GRADE_AT.high);

  assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100);
  assert.equal(gradeOf(null), 'idle'); assert.equal(gradeOf(85), 'high'); assert.equal(gradeOf(70), 'good'); assert.equal(gradeOf(50), 'warn'); assert.equal(gradeOf(49), 'fail');
});

test('the expert reviewer\'s verdict and the patrol\'s open items count', () => {
  const patrol = {
    version: 1, updatedAt: iso(NOW), signature: '', summaryAr: '', health: 0, bots: [], probes: [], resolved: [], reviewedRuns: {}, reruns: [], teams: [], engine: { ready: false, noteAr: '' },
    open: [{ key: 'k', bot: 'images', source: 'probe', level: 'fail', textAr: 'صور منتجات مش بتفتح', since: iso(NOW), lastSeen: iso(NOW), status: 'shaheen', nextAr: '', tries: [] }],
    reviews: [{ bot: 'images', reviewerAr: 'خبير الصور', reviewerEn: 'Photo expert', runAt: iso(NOW), verdict: 'rejected', tested: [], defects: ['3 صور واقعة'] }],
  } as never;
  const s = scoreBot('images', { precheck: precheck([{ id: 'images', status: 'ok', lastRun: run('success') }]), patrol });
  assert.ok(s.parts.some((p) => p.key === 'review' && p.points === 0));
  assert.ok(s.causes.some((c) => /خبير الصور: 3 صور واقعة/.test(c)));
  assert.ok(s.causes.includes('صور منتجات مش بتفتح'));
});

test('a failed run gets its cause in plain Arabic in the pre-meeting check', () => {
  assert.match(failureCauseAr('Regression tests with the new data')[0], /اختبارات الجودة/);
  assert.match(failureCauseAr('Ask live questions', ['3. Deep — FAIL · HTTP 503'])[0], /محركات الذكاء/);
  assert.deepEqual(failureCauseAr('Ask live questions', ['3. Deep — FAIL · HTTP 503']).slice(1), ['3. Deep — FAIL · HTTP 503']);
  assert.equal(failureCauseAr('Something new')[0], 'فشل في خطوة «Something new»');
  assert.deepEqual(failureCauseAr(undefined), []);

  const file = runPrecheck({}, { 'shaheen-seo.yml': { conclusion: 'failure', status: 'completed', at: iso(NOW), failedStep: 'Regression tests with the new state', errors: ['test — not ok 1 - x'] } }, NOW);
  const seo = file.bots.find((b) => b.id === 'seo')!;
  assert.equal(seo.status, 'fail');
  assert.ok(seo.problems.includes('آخر تشغيل فشل'));
  assert.match(seo.cause![0], /اختبارات الجودة/);
  assert.match(seo.fixes[0], /^أصلح سبب الفشل: اختبارات الجودة/);
});

test('the map runs on the files that are really published (and the summary counts every bot)', () => {
  const live = (n: string) => JSON.parse(readFileSync(new URL(`../src/data/live/${n}`, import.meta.url), 'utf8'));
  const scores = scoreAll({ precheck: live('shaheen-precheck.json'), supervisor: live('ai-supervisor.json') });
  assert.equal(scores.length, BOTS.length);
  const sum = summarize(scores);
  assert.equal(sum.high.length + sum.good.length + sum.warn.length + sum.fail.length + sum.idle.length, BOTS.length);
  for (const s of scores) if (s.score !== null) assert.ok(s.score >= 0 && s.score <= 100, s.id);
});

test('the map is reachable on the static Pages site (#ops) and in the admin panel, with translated labels', () => {
  const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
  assert.match(main, /isOpsRoute/); assert.match(main, /OpsMapPage/);
  const admin = readFileSync(new URL('../src/admin/AdminApp.tsx', import.meta.url), 'utf8');
  assert.match(admin, /<ShaheenOpsMapPanel \/>/);
  assert.match(admin, /href="#ops"/, 'the Pages «needs server» message points to the map');
  const panel = readFileSync(new URL('../src/admin/ShaheenOpsMapPanel.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(panel, /^import (?!type)[^\n]*shaheen-patrol\/patrol'/m, 'never bundle the Node-only patrol logic');
  assert.doesNotMatch(panel, /^import (?!type)[^\n]*shaheen-council\/precheck'/m, 'never bundle the Node-only check');
});

test('the latest finished run is judged, with the cause of a failure read from its annotations', () => {
  const runs = readFileSync(new URL('../scripts/shaheen-council/runs.ts', import.meta.url), 'utf8');
  assert.match(runs, /r\.status === 'completed' && r\.conclusion !== 'skipped'/);
  assert.match(runs, /check-runs\/\$\{job\.id\}\/annotations/);
  assert.doesNotMatch(runs, /\/logs/, 'logs are never downloaded');
});
