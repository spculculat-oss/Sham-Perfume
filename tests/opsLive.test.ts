/**
 * «مين شغال دلوقتي»: the live layer of the operations map — running / queued / stopped (and why) / waiting (and
 * when) / on demand, the scenario moving through the tools, and timetables that match the workflow files.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { BOTS, botOf } from '../src/utils/shaheenOrg';
import {
  allLive, botLive, currentStep, latestByWorkflow, lastFinishedByWorkflow, liveScenarios, nextCron, nextRunOf, SCHEDULES, TRIGGERS_AR,
  type GhRun,
} from '../src/utils/opsLive';

const NOW = Date.parse('2026-10-21T10:05:00Z'); // a Wednesday
const iso = (t: number) => new Date(t).toISOString();
const M = 60_000;
let id = 1;
const run = (file: string, status: string, conclusion: string | null, minutesAgo: number, extra: Partial<GhRun> = {}): GhRun => ({
  id: id++, path: `.github/workflows/${file}`, event: 'schedule', status, conclusion, created_at: iso(NOW - minutesAgo * M), updated_at: iso(NOW - minutesAgo * M + 2 * M),
  run_started_at: iso(NOW - minutesAgo * M), html_url: `https://github.com/x/actions/runs/${id}`, head_branch: 'main', ...extra,
});

test('timetables match the workflow files exactly', () => {
  const dir = new URL('../.github/workflows/', import.meta.url);
  const fromFiles: Record<string, string[]> = {};
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.yml'))) {
    const crons = [...readFileSync(new URL(f, dir), 'utf8').matchAll(/^\s*- cron: '([^']+)'/gm)].map((m) => m[1]);
    if (crons.length) fromFiles[f] = crons;
  }
  assert.deepEqual(SCHEDULES, fromFiles, 'copy the cron lines of .github/workflows into src/utils/opsLive.ts SCHEDULES');
  // Every bot's workflow either has a timetable or a known trigger.
  for (const b of BOTS) if (b.workflow) assert.ok(SCHEDULES[b.workflow] || TRIGGERS_AR[b.workflow], `${b.id}: ${b.workflow} has no timetable or trigger text`);
});

test('the next run time of a cron (UTC), including steps, lists and week days', () => {
  assert.equal(iso(nextCron('*/10 * * * *', NOW)), '2026-10-21T10:10:00.000Z');
  assert.equal(iso(nextCron('7,37 * * * *', NOW)), '2026-10-21T10:07:00.000Z');
  assert.equal(iso(nextCron('37 */2 * * *', NOW)), '2026-10-21T10:37:00.000Z');
  assert.equal(iso(nextCron('15 8 * * *', NOW)), '2026-10-22T08:15:00.000Z');
  assert.equal(iso(nextCron('15 5 * * 3,6', NOW)), '2026-10-24T05:15:00.000Z', 'Wednesday 05:15 has passed → Saturday');
  assert.equal(iso(nextRunOf('shaheen-languages.yml', NOW)!), '2026-10-21T21:11:00.000Z', 'the earliest of two timetables');
  assert.equal(nextRunOf('pages.yml', NOW), undefined);
});

test('live states: running with its step, queued, stopped with the reason, waiting with its next turn, on demand', () => {
  const runs = [
    run('shaheen-import.yml', 'in_progress', null, 3),
    run('shaheen-seo.yml', 'queued', null, 0),
    run('shaheen-news.yml', 'completed', 'failure', 60),
    run('shaheen-doctor.yml', 'completed', 'success', 5),
    run('shaheen-import.yml', 'completed', 'success', 125),
    run('shaheen-precheck.yml', 'completed', 'success', 5 * 24 * 60), // far older than twice a day
    run('product-pages-check.yml', 'completed', 'skipped', 10),
    run('shaheen-patrol.yml', 'in_progress', null, 1, { head_branch: 'arena/x' }), // not main
  ];
  const live = allLive({ runs, workflows: [{ path: '.github/workflows/shaheen-finance.yml', state: 'disabled_manually' }], now: NOW });
  const of = (b: string) => live.find((l) => l.id === b)!;
  assert.equal(of('importer').state, 'running'); assert.equal(of('images').state, 'running', 'bots sharing a workflow run together');
  assert.match(of('importer').noteAr, /شغالة دلوقتي \(في ميعاده\)/);
  assert.equal(of('seo').state, 'queued');
  assert.equal(of('news').state, 'stopped'); assert.match(of('news').noteAr, /آخر تشغيل فشل/);
  assert.equal(of('doctor').state, 'waiting'); assert.equal(of('doctor').next, '2026-10-21T10:10:00.000Z');
  assert.equal(of('precheck').state, 'stopped'); assert.match(of('precheck').noteAr, /متأخرة/);
  assert.equal(of('finance').state, 'stopped'); assert.match(of('finance').noteAr, /اتقفل/);
  assert.equal(of('patrol').state, 'unknown', 'a run on another branch is not the live bot');
  assert.equal(of('chat').state, 'ondemand'); assert.match(of('chat').noteAr, /زائر/);
  assert.equal(of('product_pages').state, 'unknown', 'a skipped run did no work');

  // Older than the live list → the pre-meeting check's last run.
  const council = botLive(botOf('council')!, { latest: {}, finished: {}, fallback: { conclusion: 'success', status: 'completed', at: iso(NOW - 2 * 3_600_000) }, now: NOW });
  assert.equal(council.state, 'waiting'); assert.equal(council.next, '2026-10-22T08:15:00.000Z');
});

test('newest run per workflow; finished runs skip the skipped ones', () => {
  const a = run('shaheen-seo.yml', 'in_progress', null, 1); const b = run('shaheen-seo.yml', 'completed', 'skipped', 5); const c = run('shaheen-seo.yml', 'completed', 'success', 9);
  assert.equal(latestByWorkflow([a, b, c])['shaheen-seo.yml'].id, a.id);
  assert.equal(lastFinishedByWorkflow([a, b, c])['shaheen-seo.yml'].id, c.id);
});

test('the current step of a running job', () => {
  const step = currentStep([
    { name: 'Done job', status: 'completed', conclusion: 'success', steps: [] },
    { name: 'Import supplier products', status: 'in_progress', conclusion: null, steps: [
      { name: 'Checkout', status: 'completed', conclusion: 'success', number: 1 },
      { name: 'Import products', status: 'in_progress', conclusion: null, number: 2 },
      { name: 'Publish', status: 'queued', conclusion: null, number: 3 },
    ] },
  ]);
  assert.deepEqual(step, { job: 'Import supplier products', step: 'Import products', done: 1, total: 3 });
  assert.equal(currentStep([]), undefined);
});

test('the scenario moving now: the journeys with a running step, most advanced first', () => {
  const live = allLive({ runs: [run('shaheen-import.yml', 'in_progress', null, 2)], now: NOW });
  const sc = liveScenarios(live);
  assert.ok(sc.length >= 1);
  assert.equal(sc[0].journey.id, 'product');
  assert.equal(sc[0].bot, 'importer'); assert.equal(sc[0].step, 2);
  assert.deepEqual(liveScenarios(allLive({ runs: [], now: NOW })), []);
});

test('the browser reads GitHub without a key and stays under the keyless allowance', () => {
  const hook = readFileSync(new URL('../src/admin/useOpsLive.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(hook, /Authorization|token/i, 'no key in the browser');
  assert.match(hook, /RUNS_EVERY_MS = 120_000/);
  assert.match(hook, /visibilityState === 'visible'/, 'nothing while the tab is hidden');
  assert.match(hook, /x-ratelimit-reset/);
  // 30 run lists + 4 workflow lists + ≤ 2 step reads every third refresh (+ new runs) stay under 60 an hour.
  assert.ok(60 / 2 + 60 / 15 + (2 * 60) / 6 < 60);
});
