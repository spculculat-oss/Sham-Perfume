import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { AI_KEYS, inSnapshot, ROBOTS, robotOf, SECRET_NAMES } from '../scripts/robots/registry';
import { dueRobots, gate, lastFinished, nextSnapshotAt, parseOutputs, robotEnv, runRobot, SERVER_WORKFLOWS, snapshotFiles, type Exec } from '../scripts/robots/runner';
import { fetchRuns, onDemandWorkflows } from '../scripts/shaheen-council/runs';
import { allLive, GITHUB_SCHEDULES, mergeRuns, SCHEDULES, serverRunsAsGh, type RobotServerRun } from '../src/utils/opsLive';
import { BOTS } from '../src/utils/shaheenOrg';
import { changeRule } from '../src/utils/ownerFiles';

const wf = (file: string) => readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), 'utf8');
const settings = { token: 'tok-123', repo: 'spculculat-oss/Sham-Perfume', runnerTemp: '/tmp/r' };

test('every robot timetable that left GitHub runs on the robots\' server — and nothing else does', () => {
  const expected = Object.keys(SCHEDULES).filter((w) => !GITHUB_SCHEDULES[w]).sort();
  assert.deepEqual([...SERVER_WORKFLOWS].sort(), expected);
  assert.deepEqual(ROBOTS.map((r) => r.workflow).sort(), expected, 'one server copy per robot workflow');
  assert.ok(!robotOf('live-smoke.yml'), 'the daily live-site check stays on GitHub');
  assert.ok(expected.length >= 30);
});

test('each server copy obeys the same owner\'s switch as its workflow (the same robots on the gate line)', () => {
  for (const r of ROBOTS) {
    const line = /gate\.mjs ([\w ]+)/.exec(wf(r.workflow))?.[1].trim().split(/\s+/);
    assert.deepEqual(r.bots, line, r.workflow);
    for (const b of r.bots) assert.ok(BOTS.some((x) => x.id === b && x.workflow === r.workflow), `${b} belongs to ${r.workflow}`);
  }
});

test('every step calls scripts and tests that exist', () => {
  for (const r of ROBOTS) for (const s of r.steps) {
    for (const m of s.run.matchAll(/\b((?:scripts|tests)\/[\w./-]+\.(?:mts|ts|mjs|py|sh))\b/g)) {
      assert.ok(existsSync(new URL(`../${m[1]}`, import.meta.url)), `${r.workflow}: ${m[1]}`);
    }
  }
});

test('no robot sees a key its workflow did not give it', () => {
  for (const r of ROBOTS) {
    const given = new Set([...wf(r.workflow).matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]));
    for (const k of r.secrets || []) assert.ok(given.has(k), `${r.workflow} must not get ${k}`);
  }
  const base = { GEMINI_API_KEY: 'g', SHAM_ADMIN_TOKEN: 'a', MANUS_API_KEY: 'm', ROBOTS_GITHUB_TOKEN: 'tok-123', PATH: '/bin', IMPORT_SOURCE: 'x' };
  const carriers = robotEnv(robotOf('shaheen-carriers.yml')!, base, settings);
  for (const k of SECRET_NAMES) assert.equal(carriers[k], undefined, `carriers has no ${k}`);
  assert.equal(carriers.PATH, '/bin');
  assert.equal(carriers.SHAM_PUBLISH_MODE, 'batch', 'results wait for the daily snapshot');
  assert.equal(carriers.GITHUB_REF, 'refs/heads/main');
  const importer = robotEnv(robotOf('shaheen-import.yml')!, base, settings);
  assert.equal(importer.GEMINI_API_KEY, 'g');
  assert.equal(importer.SHAM_ADMIN_TOKEN, 'a');
  assert.equal(importer.MANUS_API_KEY, undefined);
  assert.equal(importer.GITHUB_TOKEN, undefined, 'the importer gets no GitHub token');
  assert.equal(importer.IMPORT_MAX_NEW, '150');
  assert.equal(importer.IMPORT_SOURCE, 'x', 'the owner\'s own settings pass through');
  assert.equal(robotEnv(robotOf('shaheen-import.yml')!, { ...base, IMPORT_MAX_NEW: '20' }, settings).IMPORT_MAX_NEW, '20');
  const patrol = robotEnv(robotOf('shaheen-patrol.yml')!, base, settings);
  assert.equal(patrol.GITHUB_TOKEN, 'tok-123');
  assert.match(patrol.GIT_CONFIG_VALUE_0, /^AUTHORIZATION: basic /);
  assert.ok(!JSON.stringify(robotEnv(robotOf('shaheen-doctor.yml')!, base, settings)).includes('tok-123'), 'the token never reaches a robot that does not need it');
  assert.deepEqual(robotOf('shaheen-patrol.yml')!.secrets, AI_KEYS);
});

test('L-03: the server never turns the import pause off by itself', () => {
  for (const r of ROBOTS) assert.ok(!Object.keys(r.env || {}).includes('SHAM_ALLOW_SCRAPE'), r.workflow);
  assert.equal(robotEnv(robotOf('shaheen-import.yml')!, {}, settings).SHAM_ALLOW_SCRAPE, undefined);
});

test('timetables: who is due, each robot once', () => {
  const at = (iso: string) => Date.parse(iso);
  const due = dueRobots(at('2026-11-19T10:51:30Z'), at('2026-11-19T10:52:30Z')).map((d) => d.workflow);
  assert.ok(due.includes('shaheen-patrol.yml'));
  assert.ok(!due.includes('shaheen-doctor.yml'));
  assert.ok(dueRobots(at('2026-11-19T10:09:50Z'), at('2026-11-19T10:10:10Z')).some((d) => d.workflow === 'shaheen-doctor.yml'));
  // A long run held the queue for an hour: the doctor is due once, not six times.
  const after = dueRobots(at('2026-11-19T10:00:30Z'), at('2026-11-19T11:00:30Z'));
  assert.equal(after.filter((d) => d.workflow === 'shaheen-doctor.yml').length, 1);
  assert.ok(!after.some((d) => d.workflow === 'live-smoke.yml'));
  const manus = dueRobots(at('2026-11-19T06:59:30Z'), at('2026-11-19T07:00:30Z')).find((d) => d.workflow === 'shaheen-manus.yml');
  assert.equal(manus?.cron, '0 7 * * *', 'the robot knows which timetable fired');
  assert.equal(new Date(nextSnapshotAt(at('2026-11-19T10:00:00Z'), 2)).toISOString(), '2026-11-20T02:30:00.000Z');
  assert.equal(new Date(nextSnapshotAt(at('2026-11-19T01:00:00Z'), 2)).toISOString(), '2026-11-19T02:30:00.000Z');
});

test('the owner\'s switch and the State\'s pauses stop a robot on the server too', () => {
  const news = robotOf('shaheen-news.yml')!;
  assert.equal(gate(news, { frozen: false, paused: [] }, { paused: [] }).allowed, true);
  assert.equal(gate(news, { frozen: true, paused: [] }, {}).allowed, false);
  const owner = gate(news, { paused: ['catalog'] }, {});
  assert.equal(owner.allowed, false);
  assert.equal(owner.by, 'owner');
  const state = gate(news, {}, { paused: ['news'] });
  assert.equal(state.by, 'state');
  assert.match(state.why, /دولة المنصة/);
});

test('a robot runs step by step like its workflow job', async () => {
  const calls: string[] = [];
  const fake = (results: Record<string, { code?: number; outputs?: Record<string, string> }>): Exec => async (cmd, env) => {
    calls.push(cmd);
    const hit = Object.entries(results).find(([k]) => cmd.includes(k))?.[1] || {};
    return { code: hit.code ?? 0, log: hit.code ? '::error title=x::broken thing\n' : '', outputs: hit.outputs || {}, env: { SEEN: env.SCHOOL_PREFER || '' } };
  };
  // The scout activated a store → the importer is queued; the local teacher is too heavy for the free server.
  const discover = robotOf('shaheen-discover.yml')!;
  const r1 = await runRobot(discover, robotEnv(discover, {}, settings), fake({ 'shaheen-discover/run.mts': { outputs: { activated: '2' } } }), { heavy: false });
  assert.equal(r1.conclusion, 'success');
  assert.deepEqual(r1.followUps, [{ workflow: 'shaheen-import.yml' }]);
  assert.ok(r1.skipped.some((s) => /المعلم المحلي/.test(s)));
  assert.ok(!calls.some((c) => c.includes('teacher.sh')));
  // An optional step may fail; a required one stops the robot and says why.
  calls.length = 0;
  const importer = robotOf('shaheen-import.yml')!;
  const r2 = await runRobot(importer, robotEnv(importer, {}, settings), fake({ 'shaheen-store/fx.mts': { code: 1 }, 'product-pages.mts': { code: 1 } }), { heavy: false });
  assert.equal(r2.conclusion, 'failure');
  assert.match(r2.failedStep || '', /build check/);
  assert.deepEqual(r2.errors, ['x — broken thing']);
  assert.ok(calls.some((c) => c.includes('shaheen-memory/run.mts')), 'went on after the optional step failed');
  // The patrol only starts the robots its workflow allowed.
  const patrol = robotOf('shaheen-patrol.yml')!;
  const r3 = await runRobot(patrol, robotEnv(patrol, {}, settings), fake({ 'shaheen-patrol/run.mts': { outputs: { reruns: 'shaheen-seo.yml pages.yml shaheen-state.yml', publish: 'true' } } }), { heavy: false });
  assert.deepEqual(r3.followUps, [{ workflow: 'shaheen-seo.yml' }]);
  // A failed run starts nobody.
  const r4 = await runRobot(patrol, robotEnv(patrol, {}, settings), fake({ 'shaheen-patrol/run.mts': { code: 1, outputs: { reruns: 'shaheen-seo.yml' } } }), { heavy: false });
  assert.deepEqual(r4.followUps, []);
  // A step's outputs feed the next steps: no studying when nothing is left.
  calls.length = 0;
  const school = robotOf('shaheen-school-clock.yml')!;
  await runRobot(school, robotEnv(school, {}, settings), fake({ 'backlog.mts': { outputs: { todo: '0' } } }), { heavy: true });
  assert.ok(!calls.some((c) => c.includes('teacher.mts') || c.includes('shaheen-school/run.mts')));
  assert.ok(calls.some((c) => c.includes('shaheen-harvest/run.mts')));
});

test('whole robots too big for the free server are left out and say why', () => {
  for (const w of ['aistudio-bridge.yml', 'product-pages-check.yml']) assert.ok(robotOf(w)!.heavy, w);
  assert.ok(robotOf('platform-state.yml')!.isolated, 'the State reviews pull requests on its own copy');
  assert.ok(!robotOf('shaheen-patrol.yml')!.heavy);
});

test('the daily snapshot carries the robots\' results only — never code, never the owner\'s switches', () => {
  assert.deepEqual(snapshotFiles(['src/data/live/shaheen-patrol.json', 'src/data/products.json', 'src/لغات/ai/de.json', 'public/store-images/a.webp',
    'SALES_PLAYBOOK.md', 'src/App.tsx', 'scripts/robots/server.mts', 'package.json', '.github/workflows/pages.yml', 'src/data/owner/controls.json',
    'src/data/owner/state-orders.json']), ['src/data/live/shaheen-patrol.json', 'src/data/products.json', 'src/لغات/ai/de.json', 'public/store-images/a.webp',
    'SALES_PLAYBOOK.md', 'src/data/owner/state-orders.json']);
  assert.equal(inSnapshot('src/data/owner/controls.json'), false);
});

test('$GITHUB_OUTPUT lines and blocks', () => {
  assert.deepEqual(parseOutputs('a=1\nreruns=x.yml y.yml\nnote<<EOF\nline 1\nline=2\nEOF\nb=\n'), { a: '1', reruns: 'x.yml y.yml', note: 'line 1\nline=2', b: '' });
});

test('publish.mjs keeps the files for the daily snapshot on the server (no commit, no push)', () => {
  const out = execFileSync(process.execPath, ['scripts/ci/publish.mjs', 'msg', 'src/data/live/x.json'], { env: { ...process.env, SHAM_PUBLISH_MODE: 'batch' }, encoding: 'utf8' });
  assert.match(out, /Kept for the daily snapshot/);
});

test('render.yaml: one free web service, the keys entered on Render only, the code refreshed by the server', () => {
  const y = readFileSync(new URL('../render.yaml', import.meta.url), 'utf8');
  assert.match(y, /type: web/);
  assert.match(y, /plan: free/);
  assert.match(y, /autoDeploy: false/);
  assert.match(y, /healthCheckPath: \/health/);
  assert.ok(existsSync(new URL('../Dockerfile', import.meta.url)), 'at the root: Render finds it with no path to type');
  assert.match(readFileSync(new URL('../.dockerignore', import.meta.url), 'utf8'), /^\*\n!scripts\/robots\/boot\.sh$/m, 'the image gets the start script only');
  assert.ok(existsSync(new URL('../scripts/robots/boot.sh', import.meta.url)));
  for (const m of y.matchAll(/- key: ([A-Z_]+)\n\s+(\w+):/g)) {
    if (SECRET_NAMES.includes(m[1])) assert.equal(m[2], 'sync', `${m[1]} is entered by the owner on Render`);
  }
  const docker = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
  assert.match(docker, /COPY scripts\/robots\/boot\.sh \/boot\.sh/);
  assert.match(docker, new RegExp(`bun@${JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).packageManager.split('@')[1].replace(/\./g, '\\.')}`), 'the pinned Bun');
  assert.doesNotMatch(docker, /NODE_ENV=production/, 'the robots need the dev libraries (tsx)');
  // Shaheen's proposals can never change how the robots' server runs.
  for (const p of ['scripts/robots/server.mts', 'render.yaml', 'Dockerfile', '.dockerignore', 'scripts/owner/gateRule.mjs']) assert.equal(changeRule(p).allowed, false, p);
});

test('the live map reads the server\'s runs like GitHub\'s: robots on the server are not «waiting to move»', () => {
  const NOW = Date.parse('2026-11-19T12:00:00Z');
  const run: RobotServerRun = { id: 9, workflow: 'shaheen-import.yml', status: 'completed', conclusion: 'success', trigger: 'schedule', createdAt: '2026-11-19T11:37:00Z', startedAt: '2026-11-19T11:37:05Z', updatedAt: '2026-11-19T11:50:00Z' };
  const runs = mergeRuns([], serverRunsAsGh({ runs: [run] }));
  assert.equal(runs[0].path, '.github/workflows/shaheen-import.yml');
  const importer = BOTS.find((b) => b.workflow === 'shaheen-import.yml')!;
  const on = allLive({ runs, now: NOW, onRobotServer: true }).find((l) => l.id === importer.id)!;
  assert.equal(on.state, 'waiting');
  assert.ok(on.next, 'its next turn on the server');
  const off = allLive({ runs: [], now: NOW }).find((l) => l.id === importer.id)!;
  assert.equal(off.pausedBy, 'moving');
  assert.match(off.noteAr, /Render/);
  const running = mergeRuns([], serverRunsAsGh({ runs: [{ ...run, status: 'in_progress', conclusion: null, step: 'x' }] }));
  assert.equal(allLive({ runs: running, now: NOW, onRobotServer: true }).find((l) => l.id === importer.id)!.state, 'running');
});

test('the pre-meeting check and the patrol judge the robots by their runs on the server', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'robots-runs-'));
  const file = join(dir, 'runs.json');
  const runs: RobotServerRun[] = [
    { id: 1, workflow: 'shaheen-seo.yml', status: 'completed', conclusion: 'failure', trigger: 'schedule', createdAt: '2026-11-19T05:23:00Z', updatedAt: '2026-11-19T05:40:00Z', failedStep: 'Run one Manaret Shaheen cycle', errors: ['x'] },
    { id: 2, workflow: 'shaheen-seo.yml', status: 'completed', conclusion: 'success', trigger: 'schedule', createdAt: '2026-11-19T11:23:00Z', updatedAt: '2026-11-19T11:40:00Z' },
    { id: 3, workflow: 'shaheen-news.yml', status: 'completed', conclusion: 'skipped', trigger: 'schedule', createdAt: '2026-11-19T03:07:00Z', updatedAt: '2026-11-19T03:07:01Z' },
  ];
  writeFileSync(file, JSON.stringify(lastFinished(runs, 'https://sham-robots.onrender.com')));
  const before = process.env.SHAM_ROBOTS_RUNS;
  process.env.SHAM_ROBOTS_RUNS = file;
  try {
    const got = await fetchRuns('spculculat-oss/Sham-Perfume', undefined);
    assert.equal(got['shaheen-seo.yml']?.conclusion, 'success', 'the newest finished run');
    assert.equal(got['shaheen-news.yml'], undefined, 'a skipped run says nothing');
  } finally { if (before === undefined) delete process.env.SHAM_ROBOTS_RUNS; else process.env.SHAM_ROBOTS_RUNS = before; }
  // On the server the timetables run again: their reports can be late; elsewhere they are on demand.
  assert.ok(onDemandWorkflows().has('shaheen-seo.yml'));
  process.env.SHAM_ROBOT_SERVER = '1';
  try { assert.ok(!onDemandWorkflows().has('shaheen-seo.yml')); } finally { delete process.env.SHAM_ROBOT_SERVER; }
});
