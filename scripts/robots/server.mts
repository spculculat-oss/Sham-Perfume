/**
 * «سيرفر الروبوتات» (a free Hugging Face Space, or Render) — runs every robot on its timetable, one at a time, on its own copy of the site.
 *   node --import tsx scripts/robots/server.mts        (started by boot.sh inside the copy; see render.yaml)
 *
 * - Timetables: SCHEDULES (src/utils/opsLive.ts); the steps: scripts/robots/registry.ts.
 * - The owner's switches and the State's pauses are read from main before EVERY run (a freeze stops the next robot).
 * - Results stay here and go to main in ONE daily snapshot commit (ROBOTS_SNAPSHOT_HOUR, UTC) — never one per robot.
 * - The site's code is refreshed from main after each snapshot; when the server's own code changed it restarts.
 * - A small read-only web page: / (Arabic summary), /health, /status (JSON for the admin's live map). No key, no
 *   personal data, no secrets — names of robots and times only.
 * Settings (the Space's «Variables and secrets», or Render → Environment): ROBOTS_GITHUB_TOKEN (the owner's token: push the snapshot, issues, pull
 * requests), the robots' keys (same names as the GitHub secrets), ROBOTS_HEAVY=1 on a bigger server,
 * ROBOTS_ENABLED=0 to stop every timetable, ROBOTS_RUN_NOW=<workflow,…> to run some once at start.
 */
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { ROBOTS_SERVER_URL, type RobotServerRun, type RobotServerStatus } from '../../src/utils/opsLive';
import { robotOf, type FollowUp, type Robot } from './registry';
import { dueRobots, gate, gitAuthEnv, lastFinished, nextSnapshotAt, parseOutputs, robotEnv, runRobot, selfUrl, SERVER_WORKFLOWS, snapshotFiles, type Exec } from './runner';

const env = process.env;
const ROOT = process.cwd();
const REPO = env.ROBOTS_REPO || 'spculculat-oss/Sham-Perfume';
const TOKEN = env.ROBOTS_GITHUB_TOKEN?.trim() || undefined;
const HEAVY = env.ROBOTS_HEAVY === '1';
const ENABLED = env.ROBOTS_ENABLED !== '0';
const SNAPSHOT_HOUR = Math.min(23, Math.max(0, Number(env.ROBOTS_SNAPSHOT_HOUR ?? 2) || 0));
const PORT = Number(env.PORT || 10000);
const SELF = selfUrl(env);
const TEMP = mkdtempSync(join(tmpdir(), 'robots-'));
// Kept outside the copy of the site (a restart of the server inside the same machine keeps them).
const STATE_DIR = env.ROBOTS_STATE_DIR || join(tmpdir(), 'robots-state');
mkdirSync(STATE_DIR, { recursive: true });
const RUNS_FILE = join(STATE_DIR, 'robots-runs.json');
const HISTORY_FILE = join(STATE_DIR, 'robots-history.json');
// The pre-meeting check and the patrol judge the robots by their runs here (scripts/shaheen-council/runs.ts).
env.SHAM_ROBOTS_RUNS = RUNS_FILE;
const BASE_FILE = join(ROOT, '.git', 'robots-base');
const startedAt = new Date().toISOString();

const say = (line: string) => console.log(`[robots ${new Date().toISOString().slice(11, 19)}] ${line}`);
const git = (...args: string[]) => execFileSync('git', ['-c', 'core.quotePath=false', ...args], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...env, ...(TOKEN ? gitAuthEnv(TOKEN) : {}) } }).trim();
const tryGit = (...args: string[]) => { try { git(...args); return true; } catch (e) { say(`git ${args[0]}: ${String((e as { stderr?: string }).stderr || (e as Error).message).trim().split('\n').pop()}`); return false; } };
const names = (...args: string[]) => git(...args, '-z').split('\0').filter(Boolean);

// ── State ────────────────────────────────────────────────────────────────────────────────────────────────────
let runs: RobotServerRun[] = [];
try { runs = JSON.parse(readFileSync(HISTORY_FILE, 'utf8')); } catch { /* a fresh server */ }
const queue: { workflow: string; cron?: string; trigger: RobotServerRun['trigger']; env?: Record<string, string>; run: RobotServerRun }[] = [];
let current: { child?: ReturnType<typeof spawn>; run: RobotServerRun } | undefined;
let lastTick = Date.now();
let nextId = Date.now();
const snapshot: RobotServerStatus['snapshot'] = { pending: 0 };
let stopping = false;

const base = () => (existsSync(BASE_FILE) ? readFileSync(BASE_FILE, 'utf8').trim() : '');
const setBase = (sha: string) => writeFileSync(BASE_FILE, `${sha}\n`);
if (!base()) setBase(git('rev-parse', 'HEAD'));
const pending = () => { try { return Number(git('rev-list', '--count', `${base()}..HEAD`)); } catch { return 0; } };

function saveRuns() {
  runs = runs.slice(-300);
  try {
    writeFileSync(HISTORY_FILE, JSON.stringify(runs));
    writeFileSync(RUNS_FILE, JSON.stringify(lastFinished(runs, SELF || ROBOTS_SERVER_URL)));
  } catch { /* the page still has them in memory */ }
}

function enqueue(workflow: string, trigger: RobotServerRun['trigger'], cron?: string, extra?: Record<string, string>) {
  if (!robotOf(workflow) || queue.some((q) => q.workflow === workflow)) return;
  const now = new Date().toISOString();
  const run: RobotServerRun = { id: nextId++, workflow, status: 'queued', conclusion: null, trigger, createdAt: now, updatedAt: now };
  runs.push(run);
  queue.push({ workflow, cron, trigger, env: extra, run });
}

// ── The owner's files, fresh from main before every run ──────────────────────────────────────────────────────
const OWNER = 'src/data/owner';
let lastMainOrders: string | undefined;
async function fromMain(path: string): Promise<string | undefined> {
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}?ref=main`, {
      headers: { Accept: 'application/vnd.github.raw+json', 'X-GitHub-Api-Version': '2022-11-28', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) },
      signal: AbortSignal.timeout(15_000),
    });
    return r.ok ? await r.text() : undefined;
  } catch { return undefined; }
}
/** controls.json is the owner's alone: main's copy always wins. state-orders.json: main's when it changed there (the owner's «رجّع», or the State on GitHub), else the State's latest decision here. */
async function syncOwnerFiles() {
  const local = (f: string) => { try { return readFileSync(join(ROOT, OWNER, f), 'utf8'); } catch { return undefined; } };
  const controls = await fromMain(`${OWNER}/controls.json`);
  if (controls && controls !== local('controls.json')) writeFileSync(join(ROOT, OWNER, 'controls.json'), controls);
  const orders = await fromMain(`${OWNER}/state-orders.json`);
  if (orders && orders !== lastMainOrders) {
    if (lastMainOrders !== undefined || !pending()) writeFileSync(join(ROOT, OWNER, 'state-orders.json'), orders);
    lastMainOrders = orders;
  }
  if (names('status', '--porcelain', '--', OWNER).length) { git('add', '--', OWNER); git('commit', '-q', '-m', 'سيرفر الروبوتات: مفاتيح صاحب الموقع من main'); }
  const read = (f: string) => { try { return JSON.parse(local(f) || '{}'); } catch { return {}; } };
  return { controls: read('controls.json'), stateOrders: read('state-orders.json') };
}

// ── Running a command ────────────────────────────────────────────────────────────────────────────────────────
const execIn = (cwd: string, run: RobotServerRun): Exec => (cmd, stepEnv, timeoutMs) => new Promise((resolve) => {
  const dir = mkdtempSync(join(TEMP, 'step-'));
  const files = { GITHUB_OUTPUT: join(dir, 'output'), GITHUB_ENV: join(dir, 'env'), GITHUB_STEP_SUMMARY: join(dir, 'summary') };
  for (const f of Object.values(files)) writeFileSync(f, '');
  const child = spawn('bash', ['-o', 'pipefail', '-c', cmd], { cwd, env: { ...stepEnv, ...files }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  current = { child, run };
  let log = '';
  let timedOut = false;
  const keep = (b: Buffer) => {
    const text = b.toString();
    log = (log + text).slice(-20_000);
    for (const line of text.split('\n')) if (line.trim()) console.log(`  ${run.workflow}: ${line.slice(0, 400)}`);
  };
  child.stdout.on('data', keep); child.stderr.on('data', keep);
  const timer = setTimeout(() => { timedOut = true; try { process.kill(-child.pid!, 'SIGKILL'); } catch { /* gone */ } }, timeoutMs);
  child.on('close', (code) => {
    clearTimeout(timer);
    const read = (f: string) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };
    rmSync(dir, { recursive: true, force: true });
    resolve({ code: timedOut ? 124 : code ?? 1, log, outputs: parseOutputs(read(files.GITHUB_OUTPUT)), env: parseOutputs(read(files.GITHUB_ENV)), timedOut });
  });
});

/** Back to the last good state of the copy: a failed robot leaves nothing half-written. */
function cleanCopy() { tryGit('reset', '-q', '--hard', 'HEAD'); tryGit('clean', '-fdq'); }

async function runOne(item: typeof queue[number]) {
  const robot = robotOf(item.workflow) as Robot;
  const run = item.run;
  const done = (conclusion: RobotServerRun['conclusion'], more: Partial<RobotServerRun> = {}) => {
    Object.assign(run, { status: 'completed', conclusion, updatedAt: new Date().toISOString(), step: undefined }, more);
    saveRuns();
  };
  Object.assign(run, { status: 'in_progress', startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  if (robot.heavy && !HEAVY) return done('skipped', { noteAr: `مش بيشتغل على السيرفر المجاني: ${robot.heavy}` });
  const { controls, stateOrders } = await syncOwnerFiles();
  const owner = gate(robot, controls, stateOrders);
  if (!owner.allowed) { say(`${item.workflow}: ${owner.why}`); return done('skipped', { noteAr: `${owner.why} — مش هيشتغل لحد ما ${owner.who} يرجعه` }); }

  let cwd = ROOT;
  if (robot.isolated) {
    // Its own copy: it switches branches or applies code, never on the copy holding the day's results.
    cwd = join(TEMP, `iso-${run.id}`);
    git('worktree', 'add', '-q', '--detach', cwd, 'HEAD');
    try { symlinkSync(join(ROOT, 'node_modules'), join(cwd, 'node_modules')); } catch { /* installs nothing then */ }
  }
  const stepEnv = robotEnv(robot, env, { token: TOKEN, repo: REPO, runnerTemp: TEMP }, item.env, item.cron);
  say(`▶ ${item.workflow} (${item.trigger})`);
  let result;
  try {
    result = await runRobot(robot, stepEnv, execIn(cwd, run), { heavy: HEAVY, cron: item.cron, onStep: (step) => { run.step = step; run.updatedAt = new Date().toISOString(); } });
  } catch (e) {
    result = { conclusion: 'failure' as const, failedStep: run.step, errors: [String((e as Error).message).slice(0, 180)], skipped: [], followUps: [] as FollowUp[], outputs: {} };
  } finally { current = undefined; }

  if (robot.isolated) {
    if (result.conclusion === 'success') for (const f of robot.isolated.keep) if (existsSync(join(cwd, f))) { mkdirSync(dirname(join(ROOT, f)), { recursive: true }); cpSync(join(cwd, f), join(ROOT, f)); }
    tryGit('worktree', 'remove', '--force', cwd);
  }
  if (result.conclusion === 'success') {
    const changed = snapshotFiles(names('status', '--porcelain', '--untracked-files=all').map((l) => l.slice(3)));
    if (changed.length) { git('add', '-A', '--', ...changed); git('commit', '-q', '-m', `سيرفر الروبوتات: ${robot.nameAr}`); }
    for (const f of result.followUps) enqueue(f.workflow, 'rerun', undefined, f.env);
  }
  cleanCopy();
  say(`■ ${item.workflow}: ${result.conclusion}${result.failedStep ? ` (${result.failedStep})` : ''}`);
  done(result.conclusion, { ...(result.failedStep ? { failedStep: result.failedStep } : {}), ...(result.errors?.length ? { errors: result.errors } : {}), ...(result.skipped.length ? { skipped: result.skipped } : {}) });
}

// ── The daily snapshot: one commit on main with the day's results ────────────────────────────────────────────
async function publishSnapshot(reason: string): Promise<boolean> {
  const count = pending();
  if (!count) { snapshot.pending = 0; return true; }
  if (!TOKEN) { snapshot.error = 'ROBOTS_GITHUB_TOKEN ناقص — النتايج محفوظة على السيرفر لحد ما يتحط'; return false; }
  // The owner's latest switches and the State's orders from main first: the snapshot never carries an older copy back.
  await syncOwnerFiles();
  const from = base();
  const head = git('rev-parse', 'HEAD');
  git('reset', '-q', '--soft', from);
  const changed = names('diff', '--cached', '--name-only');
  const files = snapshotFiles(changed);
  git('reset', '-q');
  // Anything else (the owner's switches copied from main for the gate) goes back to main's copy before publishing.
  for (const f of changed.filter((x) => !files.includes(x))) {
    if (!tryGit('checkout', '-q', from, '--', f)) rmSync(join(ROOT, f), { force: true });
  }
  if (!files.length) { git('reset', '-q', '--hard', head); setBase(head); return true; }
  say(`Snapshot (${reason}): ${files.length} files from ${count} robot runs`);
  const day = new Date().toISOString().slice(0, 10);
  const ok = await new Promise<boolean>((resolve) => {
    const child = spawn('node', ['scripts/ci/publish.mjs', `روبوتات شام (سيرفر Render): لقطة ${day} — ${count} تشغيل`, ...files], {
      cwd: ROOT, stdio: 'inherit',
      env: { ...env, SHAM_PUBLISH_MODE: '', GIT_AUTHOR_NAME: 'Sham robots server', GIT_AUTHOR_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com', GIT_COMMITTER_NAME: 'Sham robots server', GIT_COMMITTER_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com', ...gitAuthEnv(TOKEN) },
    });
    child.on('close', (code) => resolve(code === 0));
  });
  if (!ok) {
    // The results are in one local commit now (or still waiting in the copy): kept for the next try.
    if (git('rev-parse', 'HEAD') !== from) setBase(git('rev-parse', 'HEAD~1'));
    else if (names('status', '--porcelain').length) { git('add', '-A', '--', ...files); git('commit', '-q', '-m', 'سيرفر الروبوتات: نتايج مستنية اللقطة'); }
    snapshot.error = `اللقطة ما اتنشرتش (${new Date().toISOString().slice(0, 16)}) — هتتحاول تاني بعد ساعة`;
    return false;
  }
  snapshot.lastAt = new Date().toISOString(); snapshot.lastSha = git('rev-parse', 'HEAD'); snapshot.error = undefined;
  return true;
}

/** After a snapshot: the latest site code from main; a restart when the server's own code or the libraries changed. */
function refreshCode(): boolean {
  if (!tryGit('fetch', '-q', '--depth=50', 'origin', 'main')) return false;
  const changed = names('diff', '--name-only', 'HEAD', 'origin/main');
  git('reset', '-q', '--hard', 'origin/main');
  setBase(git('rev-parse', 'HEAD'));
  return changed.some((f) => f.startsWith('scripts/robots/') || f === 'bun.lock' || f === 'package.json' || f === 'src/utils/opsLive.ts' || f === 'scripts/owner/gateRule.mjs');
}

let nextSnapshot = nextSnapshotAt(Date.now(), SNAPSHOT_HOUR);
let retryAt = 0;
async function loop() {
  while (!stopping) {
    const now = Date.now();
    if (ENABLED) for (const due of dueRobots(lastTick, now)) enqueue(due.workflow, 'schedule', due.cron);
    lastTick = now;
    if (!current && queue.length) { await runOne(queue.shift()!); continue; }
    if (!current && (now >= nextSnapshot || (retryAt && now >= retryAt))) {
      const ok = await publishSnapshot('daily');
      retryAt = ok ? 0 : now + 3600_000;
      if (ok) {
        nextSnapshot = nextSnapshotAt(now, SNAPSHOT_HOUR);
        if (refreshCode()) { say('The server\'s code changed on main — restarting with it'); saveRuns(); process.exit(75); }
      }
    }
    snapshot.pending = pending(); snapshot.nextAt = new Date(nextSnapshot).toISOString();
    await new Promise((r) => setTimeout(r, 20_000));
  }
}

// ── The web page ─────────────────────────────────────────────────────────────────────────────────────────────
function status(): RobotServerStatus {
  return { ok: true, startedAt, at: new Date().toISOString(), heavy: HEAVY, runs: runs.slice(-120).reverse(), queue: queue.map((q) => q.workflow), snapshot };
}
const AR: Record<string, string> = { success: '✅ نجح', failure: '🔴 فشل', timed_out: '⏱️ خلص وقته', skipped: '⏸️ ما اشتغلش', cancelled: '⏹️ اتلغى' };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
function page(): string {
  const s = status();
  const rows = s.runs.slice(0, 60).map((r) => `<tr><td>${esc(robotOf(r.workflow)?.nameAr || r.workflow)}</td><td>${r.status === 'completed' ? AR[r.conclusion || ''] || '' : r.status === 'in_progress' ? `🟢 شغال: ${esc(r.step || '')}` : '🔵 في الطابور'}</td><td dir="ltr">${esc((r.startedAt || r.createdAt).slice(0, 16).replace('T', ' '))}</td><td>${esc(r.noteAr || r.failedStep || (r.skipped?.length ? `اتساب ${r.skipped.length} خطوة تقيلة` : ''))}</td></tr>`).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>سيرفر روبوتات شام</title><style>body{font-family:system-ui,sans-serif;background:#0c0a09;color:#e7e5e4;margin:0;padding:16px}table{width:100%;border-collapse:collapse;font-size:14px}td{border-bottom:1px solid #292524;padding:6px}h1{color:#fbbf24;font-size:20px}</style>
<h1>سيرفر روبوتات شام 🤖</h1>
<p>${ENABLED ? `شغال من ${esc(s.startedAt.slice(0, 16).replace('T', ' '))} (UTC) · ${SERVER_WORKFLOWS.length} روبوت على مواعيدهم` : '⏸️ الروبوتات موقفة من إعدادات السيرفر (ROBOTS_ENABLED=0)'}${HEAVY ? '' : ' · الخطوات التقيلة متسابة (سيرفر مجاني)'}</p>
<p>في الطابور: ${s.queue.length ? esc(s.queue.map((w) => robotOf(w)?.nameAr || w).join('، ')) : 'مفيش'} · نتايج مستنية اللقطة اليومية: ${s.snapshot.pending} · آخر لقطة: ${esc(s.snapshot.lastAt?.slice(0, 16).replace('T', ' ') || 'لسه')}${s.snapshot.error ? ` · ⚠️ ${esc(s.snapshot.error)}` : ''}</p>
<table>${rows || '<tr><td>لسه مفيش تشغيل</td></tr>'}</table></html>`;
}
createServer((req, res) => {
  const path = (req.url || '/').split('?')[0];
  const headers = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
  if (path === '/health') { res.writeHead(200, { ...headers, 'Content-Type': 'text/plain' }); res.end('ok'); return; }
  if (path === '/status') { res.writeHead(200, { ...headers, 'Content-Type': 'application/json' }); res.end(JSON.stringify(status())); return; }
  if (path === '/') { res.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8' }); res.end(page()); return; }
  res.writeHead(404, headers); res.end();
}).listen(PORT, '0.0.0.0', () => say(`Listening on ${PORT} · ${SERVER_WORKFLOWS.length} robots · heavy steps ${HEAVY ? 'on' : 'off'} · snapshot ${SNAPSHOT_HOUR}:30 UTC`));

// A free server sleeps with no visit (Render: 15 minutes, a Space: 48 hours): it visits itself (and the admin's map wakes it too).
if (SELF && env.ROBOTS_KEEP_AWAKE !== '0') setInterval(() => { void fetch(`${SELF}/health`, { signal: AbortSignal.timeout(20_000) }).catch(() => undefined); }, 10 * 60_000).unref();

// Render or the Space stops the server on a restart or a new deploy: the robot running now stops, the day's results are published.
async function stop(signal: string) {
  if (stopping) return;
  stopping = true;
  say(`${signal}: saving the day's results before stopping`);
  if (current?.child?.pid) { try { process.kill(-current.child.pid, 'SIGKILL'); } catch { /* gone */ } current.run.status = 'completed'; current.run.conclusion = 'cancelled'; }
  cleanCopy();
  saveRuns();
  const timer = setTimeout(() => process.exit(0), 25_000);
  await publishSnapshot('shutdown').catch(() => false);
  clearTimeout(timer);
  process.exit(0);
}
process.on('SIGTERM', () => void stop('SIGTERM'));
process.on('SIGINT', () => void stop('SIGINT'));

// Runs that were going when the server stopped are not left «running» for ever.
for (const r of runs) if (r.status !== 'completed') Object.assign(r, { status: 'completed', conclusion: 'cancelled', updatedAt: new Date().toISOString() });
cleanCopy();
saveRuns();
// ROBOTS_RUN_NOW=shaheen-doctor.yml,shaheen-patrol.yml: run these once right after the server starts (a check after setup).
for (const w of (env.ROBOTS_RUN_NOW || '').split(/[\s,]+/).filter(Boolean)) enqueue(w, 'boot');
void loop();
