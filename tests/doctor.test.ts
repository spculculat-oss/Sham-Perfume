import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import express from 'express';
import { applyEdits, attemptFix, checkPath, parsePlan, restore } from '../scripts/doctor/fixer';
import { decide, emptyState, remember, type Capabilities, type DoctorState } from '../scripts/doctor/playbook';
import { probeChat, probeDeploy, type Finding, type ProbeContext } from '../scripts/doctor/probes';
import { eventComment, readState, renderBody } from '../scripts/doctor/report';
import { runDoctor } from '../scripts/doctor/agent';
import type { GitHub } from '../scripts/doctor/github';
import { ShaheenRuntime } from '../server/core/maintenance';
import { createShamCore } from '../server/core/http';
import { MemoryStore } from '../server/core/store';

const MIN = 60_000;
const NOW = Date.parse('2026-10-15T12:00:00Z');
const caps = (over: Partial<Capabilities> = {}): Capabilities => ({ adminToken: true, vercelToken: false, ai: true, write: true, ...over });
const f = (id: Finding['id'], status: Finding['status'], data: Record<string, unknown> = {}, summary: string = id): Finding => ({ id, status, summary, data });
const healthy = (): Finding[] => [f('api', 'ok', { version: 'aaaaaaa' }), f('deploy', 'ok', { live: 'aaaaaaa' }), f('modes', 'ok'), f('chat', 'ok'), f('cors', 'ok'), f('pages', 'ok'), f('runtime', 'ok'), f('ci', 'ok'), f('media', 'ok')];
const withFinding = (findings: Finding[], next: Finding) => findings.map((x) => (x.id === next.id ? next : x));
/** Runs the playbook over several consecutive runs (10 minutes apart), returning the last decision. */
function runs(list: Finding[][], state = emptyState(), c = caps(), start = NOW) {
  let out = { actions: [] as ReturnType<typeof decide>['actions'], notes: [] as string[] };
  list.forEach((findings, i) => { remember(state, findings, start + i * 10 * MIN); out = decide(findings, state, c, start + i * 10 * MIN); });
  return { ...out, state };
}

// ---------------- playbook ----------------
test('the doctor waits for a problem to repeat before acting, then resets the runtime and re-checks keys', () => {
  const failing = withFinding(healthy(), f('chat', 'fail', { problem: 'error', code: 'PROVIDER_UNAVAILABLE' }, 'السؤال فشل'));
  assert.deepEqual(runs([failing]).actions, [], 'one bad run may be a blip');
  const { actions } = runs([failing, failing]);
  assert.deepEqual(actions.map((a) => a.kind), ['reset_runtime', 'rerun_keys']);
  const noAdmin = runs([failing, failing], emptyState(), caps({ adminToken: false })).actions;
  assert.deepEqual(noAdmin.map((a) => a.kind), ['rerun_keys']);
});

test('remedies respect cooldowns, and review mode only reports what it would do', () => {
  const failing = withFinding(healthy(), f('chat', 'fail', { problem: 'error' }));
  const first = runs([failing, failing]);
  first.state.lastActions.reset_runtime = new Date(NOW + 10 * MIN).toISOString();
  first.state.lastActions.rerun_keys = new Date(NOW + 10 * MIN).toISOString();
  remember(first.state, failing, NOW + 20 * MIN);
  const again = decide(failing, first.state, caps(), NOW + 20 * MIN);
  assert.deepEqual(again.actions, []);
  assert.ok(again.notes.some((n) => n.includes('فترة التهدئة')));
  const dry = runs([failing, failing], emptyState(), caps({ write: false }));
  assert.deepEqual(dry.actions, []);
  assert.ok(dry.notes.some((n) => n.includes('وضع المراجعة فقط') && n.includes('reset_runtime')));
});

test('a Vercel rate limit is waited out, then redeployed (token) or nudged with a commit', () => {
  const limited = (age: number) => withFinding(healthy(), f('deploy', 'fail', { reason: 'rate_limited', statusAgeMin: age }));
  const early = runs([limited(60)]);
  assert.deepEqual(early.actions, []);
  assert.ok(early.notes.some((n) => n.includes('هعيد المحاولة تلقائيًا')));
  assert.deepEqual(runs([limited(24 * 60 + 15)]).actions.map((a) => a.kind), ['nudge_deploy']);
  assert.deepEqual(runs([limited(24 * 60 + 15)], emptyState(), caps({ vercelToken: true })).actions.map((a) => a.kind), ['redeploy_vercel']);
  assert.deepEqual(runs([withFinding(healthy(), f('deploy', 'fail', { reason: 'build_failed' }))]).actions.map((a) => a.kind), ['verify_build']);
});

test('a red build on main gets an AI fix at once; one fix at a time, at most 3 a day', () => {
  const red = withFinding(healthy(), f('ci', 'fail', { sha: 'b'.repeat(40), runId: 7 }));
  const { actions } = runs([red]);
  assert.equal(actions[0].kind, 'ai_fix');
  assert.equal(actions[0].problem, `ci:${'b'.repeat(12)}`);
  assert.deepEqual(runs([red], emptyState(), caps({ ai: false })).actions, [], 'no AI key → reported, not attempted');
  const busy = emptyState(); busy.pending = { sha: 'c'.repeat(40), at: new Date(NOW).toISOString(), baseline: [], problem: 'x' };
  assert.notEqual(runs([red], busy).actions[0]?.kind, 'ai_fix');
  const tired = emptyState();
  tired.fixes = [1, 2, 3].map((h) => ({ at: new Date(NOW - h * 60 * MIN).toISOString(), problem: 'p', result: 'verified' as const }));
  const capped = runs([red], tired);
  assert.deepEqual(capped.actions, []);
  assert.ok(capped.notes.some((n) => n.includes('للحد اليومي')));
});

test('a merged fix is verified after 30 quiet minutes live, or reverted when new problems appear', () => {
  const sha = 'd'.repeat(40);
  const make = (): DoctorState => ({ ...emptyState(), pending: { sha, at: new Date(NOW).toISOString(), baseline: ['ci'], problem: 'ci' }, fixes: [{ at: new Date(NOW).toISOString(), problem: 'ci', result: 'merged', sha }] });
  const liveOk = withFinding(healthy(), f('deploy', 'ok', { live: sha.slice(0, 7) }));
  const good = runs([liveOk, liveOk, liveOk, liveOk], make());
  assert.equal(good.state.pending, undefined);
  assert.equal(good.state.fixes[0].result, 'verified');
  const worse = withFinding(liveOk, f('pages', 'fail'));
  const bad = runs([worse, worse], make());
  assert.deepEqual(bad.actions.map((a) => a.kind), ['revert']);
  assert.equal(bad.actions[0].sha, sha);
  const notLive = runs([healthy()], make());
  assert.ok(notLive.state.pending, 'still waiting for the deploy');
});

// ---------------- fixer ----------------
test('the fixer may create and change source files, but never its own code, workflows, dependencies or existing tests', () => {
  assert.equal(checkPath('server/shaheen.ts', true), undefined);
  assert.equal(checkPath('server/new-helper.ts', false), undefined);
  assert.equal(checkPath('tests/new-guard.test.ts', false), undefined);
  for (const [path, existed] of [['scripts/doctor/playbook.ts', true], ['.github/workflows/pages.yml', true], ['package.json', true], ['bun.lock', true],
    ['tests/capacity.test.ts', true], ['../etc/passwd', false], ['/etc/passwd', false], ['docs/index.html', true], ['.env', false]] as const) {
    assert.ok(checkPath(path, existed), `${path} must be refused`);
  }
  assert.deepEqual(parsePlan('note\n```json\n{"summary":"x","edits":[]}\n```').edits, []);
  assert.throws(() => parsePlan('no json here'));
});

test('edits are exact and atomic, and can be restored', () => {
  const root = mkdtempSync(join(tmpdir(), 'doctor-'));
  mkdirSync(join(root, 'server'));
  writeFileSync(join(root, 'server/a.ts'), 'const a = 1;\nconst b = 2;\n');
  assert.throws(() => applyEdits(root, [{ path: 'server/a.ts', find: 'const', replace: 'let' }]), /2 times/);
  assert.throws(() => applyEdits(root, [{ path: 'server/a.ts', find: 'nope', replace: 'x' }]), /not found/);
  assert.throws(() => applyEdits(root, [{ path: 'server/a.ts', find: 'const a = 1;', replace: 'const a = 3;' }, { path: 'package.json', content: '{}' }]), /protected/);
  assert.equal(readFileSync(join(root, 'server/a.ts'), 'utf8'), 'const a = 1;\nconst b = 2;\n', 'nothing written when any edit is refused');
  const { originals } = applyEdits(root, [{ path: 'server/a.ts', find: 'const a = 1;', replace: 'const a = 3;' }, { path: 'server/b.ts', content: 'export {};\n' }]);
  assert.match(readFileSync(join(root, 'server/a.ts'), 'utf8'), /a = 3/);
  restore(root, originals);
  assert.match(readFileSync(join(root, 'server/a.ts'), 'utf8'), /a = 1/);
  assert.equal(existsSync(join(root, 'server/b.ts')), false, 'created files are removed again');
});

test('the fixer retries with the failure output and keeps only a change that passes every check', async () => {
  const root = mkdtempSync(join(tmpdir(), 'doctor-'));
  mkdirSync(join(root, 'server'));
  writeFileSync(join(root, 'server/cors.ts'), 'export const headers = "Content-Type";\n');
  const prompts: string[] = [];
  const replies = [
    '{"summary":"محاولة أولى","edits":[{"path":"server/cors.ts","find":"Content-Type","replace":"Content-Type, BROKEN"}]}',
    '{"summary":"السماح بهيدر معرّف الزائر","edits":[{"path":"server/cors.ts","find":"Content-Type","replace":"Content-Type, X-Sham-Visitor"}]}',
  ];
  const commands: string[] = [];
  const result = await attemptFix({ problem: 'cors', reason: 'هيدر معرّف الزائر مش مسموح', evidence: 'see server/cors.ts' }, {
    root, trackedFiles: async () => ['server/cors.ts', 'package.json'],
    ask: async (_system, prompt) => { prompts.push(prompt); return replies[prompts.length - 1]; },
    sh: async (command) => {
      commands.push(command);
      const broken = readFileSync(join(root, 'server/cors.ts'), 'utf8').includes('BROKEN');
      return command === 'npm test' && broken ? { ok: false, output: 'not ok 3 - CORS allows X-Sham-Visitor' } : { ok: true, output: '' };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 2);
  assert.match(prompts[0], /FILE server\/cors\.ts/, 'the model sees the relevant file');
  assert.match(prompts[1], /npm test.*failed[\s\S]*not ok 3/, 'the second attempt sees why the first failed');
  assert.equal(readFileSync(join(root, 'server/cors.ts'), 'utf8'), 'export const headers = "Content-Type, X-Sham-Visitor";\n');
  assert.deepEqual(commands.slice(-5), ['npm run lint', 'npm test', 'npm run build:vercel', 'npm run test:vercel', 'npm run check:edgeone']);

  const hopeless = await attemptFix({ problem: 'cors', reason: 'x', evidence: '' }, {
    root, trackedFiles: async () => ['server/cors.ts'], ask: async () => replies[0], sh: async (c) => ({ ok: c !== 'npm test', output: 'fail' }),
  });
  assert.equal(hopeless.ok, false);
  assert.match(readFileSync(join(root, 'server/cors.ts'), 'utf8'), /X-Sham-Visitor";/, 'failed attempts leave the code exactly as it was');
});

// ---------------- probes & report ----------------
const statusesGitHub = (statuses: unknown[]) => ({ statuses: async () => statuses }) as unknown as GitHub;
const ctx = (over: Partial<ProbeContext>): ProbeContext => ({ site: 'http://x', pages: 'http://p/', pagesOrigin: 'http://p', vercelProject: 'sham-perfume-49bf', visitorId: 'sham-doctor-probe', fetch, now: NOW, ...over });

test('the deploy probe tells a stale site apart: rate limit, failed build, still deploying, current', async () => {
  const main = { sha: 'e'.repeat(40), date: new Date(NOW - 120 * MIN).toISOString() };
  const status = (state: string, description: string, ageMin: number) => ({ context: 'Vercel – sham-perfume-49bf', state, description, created_at: new Date(NOW - ageMin * MIN).toISOString(), updated_at: new Date(NOW - ageMin * MIN).toISOString() });
  const limited = await probeDeploy(ctx({ main, github: statusesGitHub([status('failure', 'Deployment rate limited — retry in 24 hours.', 90)]) }), null);
  assert.equal(limited.status, 'fail');
  assert.equal(limited.data?.reason, 'rate_limited');
  assert.equal(limited.data?.statusAgeMin, 90);
  assert.equal((await probeDeploy(ctx({ main, github: statusesGitHub([status('failure', 'Build failed', 5)]) }), null)).data?.reason, 'build_failed');
  assert.equal((await probeDeploy(ctx({ main, github: statusesGitHub([status('pending', 'Building', 5)]) }), 'old1234')).status, 'ok');
  assert.equal((await probeDeploy(ctx({ main, github: statusesGitHub([]) }), main.sha.slice(0, 7))).status, 'ok');
});

test('the chat probe flags vendor names and tells provider quota apart from real failures', async () => {
  const answer = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
  assert.equal((await probeChat(ctx({ fetch: answer(200, { reply: 'أنا شاهين' }) }))).status, 'ok');
  const leak = await probeChat(ctx({ fetch: answer(200, { reply: 'I am Gemini' }) }));
  assert.equal(leak.status, 'fail');
  assert.equal(leak.data?.problem, 'vendor_leak');
  assert.equal((await probeChat(ctx({ fetch: answer(503, { code: 'SHAHEEN_BUSY' }) }))).status, 'warn');
  assert.equal((await probeChat(ctx({ fetch: answer(503, { code: 'PROVIDER_UNAVAILABLE' }) }))).status, 'fail');
});

test('the status board carries the memory between runs and comments only on events', () => {
  const state = runs([healthy()]).state;
  state.fixes.push({ at: new Date(NOW).toISOString(), problem: 'cors', result: 'verified', summary: 'سماح بالهيدر' });
  const body = renderBody(healthy(), state, { notes: [], actions: [], site: 'http://x', mode: 'live' });
  assert.match(body, /🟢 كله سليم/);
  assert.match(body, /سماح بالهيدر/);
  assert.deepEqual(readState(body), state);
  assert.deepEqual(readState('no state'), emptyState());
  const failing = withFinding(healthy(), f('pages', 'fail', {}, 'Pages واقع'));
  const s = runs([failing, failing]).state;
  assert.match(eventComment(failing, s.history.at(-2), s, [], []) || '', /مشكلة مؤكدة.*Pages واقع/);
  assert.equal(eventComment(healthy(), { at: '', fails: [], warns: [] }, runs([healthy()]).state, [], []), undefined, 'quiet when nothing happened');
  assert.match(eventComment(healthy(), { at: '', fails: ['pages'], warns: [] }, runs([healthy()]).state, [], []) || '', /رجع سليم/);
});

// ---------------- whole run ----------------
function fakeGitHub(initialBody?: string) {
  const calls: string[] = [];
  let body = initialBody;
  const gh = {
    repo: 'o/r', canWrite: true,
    findIssue: async () => (body === undefined ? undefined : { number: 1, body, html_url: '', title: '' }),
    head: async () => ({ sha: 'a'.repeat(40), date: new Date(NOW - 60 * MIN).toISOString(), message: '' }),
    statuses: async () => [], runs: async () => [{ id: 1, head_sha: 'a'.repeat(40), status: 'completed', conclusion: 'success', html_url: '', created_at: '', updated_at: '', event: 'push' }],
    ensureLabel: async () => { calls.push('label'); },
    createIssue: async (_t: string, b: string) => { calls.push('create'); body = b; return { number: 1, body: b, html_url: '', title: '' }; },
    updateIssue: async (_n: number, b: string) => { calls.push('update'); body = b; return { number: 1, body: b, html_url: '', title: '' }; },
    comment: async (_n: number, c: string) => { calls.push(`comment:${c.slice(0, 40)}`); },
    dispatch: async (w: string) => { calls.push(`dispatch:${w}`); },
  };
  return { gh: gh as unknown as GitHub, calls, body: () => body };
}

test('a full run: probes the site, remembers, resets the runtime through the admin API when chat keeps failing', async () => {
  const requests: string[] = [];
  const site = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    requests.push(`${init?.method || 'GET'} ${url.replace('https://site', '')}`);
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'access-control-allow-origin': 'https://pages.example', 'access-control-allow-headers': 'Content-Type, X-Sham-Visitor' } });
    if (url.endsWith('/api/health')) return json({ status: 'ok', version: 'a'.repeat(40) });
    if (url.endsWith('/api/models')) return json({ models: [{ id: 'auto', hasApiKey: true }], enabled: true });
    if (url.endsWith('/api/chat') && init?.method === 'POST') return json({ code: 'PROVIDER_UNAVAILABLE' }, 503);
    if (url.endsWith('/api/chat')) return json({}, 204);
    if (url.endsWith('/api/admin/maintenance')) return json({ window: { requests: 0 }, providers: {} });
    if (url.includes('/api/media')) return json({ images: [] });
    if (url === 'https://pages.example/x/') return new Response('<script type="module" crossorigin src="/x/assets/index.js"></script>');
    if (url.endsWith('/x/assets/index.js')) return new Response('');
    return json({}, 404);
  }) as typeof fetch;
  const env = { DOCTOR_SITE_URL: 'https://site', DOCTOR_PAGES_URL: 'https://pages.example/x/', SHAM_ADMIN_TOKEN: 'token-1234567890' };
  const { gh, calls, body } = fakeGitHub();
  const base = { env, github: gh, fetch: site, sh: async () => ({ ok: true, output: '' }), root: '.', mode: 'live' as const, log: () => {} };
  const first = await runDoctor({ ...base, now: () => NOW });
  assert.equal(first.findings.find((x) => x.id === 'chat')?.status, 'fail');
  assert.deepEqual(first.actions, []);
  assert.ok(calls.includes('create'), 'the maintenance issue is created on the first run');
  const second = await runDoctor({ ...base, now: () => NOW + 10 * MIN });
  assert.deepEqual(second.actions.map((a) => a.kind), ['reset_runtime', 'rerun_keys']);
  assert.ok(requests.includes('POST /api/admin/maintenance'));
  assert.ok(calls.includes('dispatch:shaheen-keys.yml'));
  assert.ok(calls.includes('update'));
  assert.ok(calls.some((c) => c.startsWith('comment:')), 'the remedy is announced');
  assert.equal(readState(body()).runs, 2, 'memory survives between runs through the issue');

  const quiet = fakeGitHub();
  await runDoctor({ ...base, github: quiet.gh, mode: 'dry', now: () => NOW });
  assert.deepEqual(quiet.calls, [], 'review mode writes nothing');
});

// ---------------- server side ----------------
test('the server keeps outcome counters for the doctor and offers safe remedies to the admin only', async () => {
  const runtime = new ShaheenRuntime('abc1234');
  runtime.record({ ms: 900, status: 200 }); runtime.record({ ms: 1100, status: 200 });
  runtime.record({ ms: 50, status: 503, code: 'SHAHEEN_BUSY' }); runtime.record({ ms: 5, status: 429, code: 'RATE_LIMITED' });
  const stats = runtime.stats();
  assert.equal(stats.requests, 4);
  assert.equal(stats.rateLimited, 1, 'visitors over their own limit are not failures of Shaheen');
  assert.equal(stats.errorRate, 0.333);
  assert.deepEqual(stats.errors, { SHAHEEN_BUSY: 1 });

  const core = createShamCore({ env: { SHAM_ADMIN_TOKEN: 'admin-token-123456' }, store: new MemoryStore(), runtime });
  const app = express();
  app.use(express.json());
  app.use('/api/admin', core.admin);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin/maintenance`;
  const auth = { authorization: 'Bearer admin-token-123456', 'content-type': 'application/json' };
  try {
    assert.equal((await fetch(base)).status, 401);
    const snap = await (await fetch(base, { headers: auth })).json();
    assert.equal(snap.version, 'abc1234');
    assert.equal(snap.window.answered, 2);
    assert.ok(!JSON.stringify(snap.engines).includes('Gemini'), 'ids only');
    assert.equal((await fetch(base, { method: 'POST', headers: auth, body: JSON.stringify({ action: 'drop_database' }) })).status, 400);
    const done = await (await fetch(base, { method: 'POST', headers: auth, body: JSON.stringify({ actions: ['reset_provider_gate', 'clear_answer_cache'] }) })).json();
    assert.deepEqual(done.results.map((r: { action: string }) => r.action), ['reset_provider_gate', 'clear_answer_cache']);
    assert.equal(done.snapshot.remedies.length, 2);
  } finally { await new Promise((d) => server.close(d)); }
});

// ---------------- git: ship a verified fix, then revert it ----------------
test('an AI fix is committed to main after the checks (direct push when PRs are not allowed), and reverted when it misbehaves', async () => {
  const { execFileSync } = await import('node:child_process');
  const { shell } = await import('../scripts/doctor/agent');
  const dir = mkdtempSync(join(tmpdir(), 'doctor-git-'));
  const g = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  g(dir, 'init', '--quiet', '--bare', '-b', 'main', 'remote.git');
  const work = join(dir, 'work');
  g(dir, 'clone', '--quiet', join(dir, 'remote.git'), 'work');
  mkdirSync(join(work, 'server'));
  writeFileSync(join(work, 'server/cors.ts'), 'export const headers = "Content-Type";\n');
  g(work, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--quiet', '--allow-empty', '-m', 'init');
  g(work, 'add', '.'); g(work, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--quiet', '-m', 'base'); g(work, 'push', '--quiet', 'origin', 'HEAD:main');
  const base = g(work, 'rev-parse', 'HEAD');

  const real = shell(work);
  const commands: string[] = [];
  const sh = async (command: string) => { commands.push(command); return command.startsWith('npm ') ? { ok: true, output: '' } : real(command); };
  const { gh, calls } = fakeGitHub();
  const fakes = gh as unknown as Record<string, unknown>;
  let liveVersion = base;
  fakes.head = async () => ({ sha: g(join(dir, 'remote.git'), 'rev-parse', 'main'), date: new Date(NOW - 60 * MIN).toISOString(), message: '' });
  let ciRed = true;
  fakes.runs = async () => [{ id: 9, head_sha: base, status: 'completed', conclusion: ciRed ? 'failure' : 'success', html_url: '', created_at: '', updated_at: '', event: 'push' }];
  fakes.failedJobs = async () => [{ id: 5, name: 'Check and build React', steps: ['Run tests'] }];
  fakes.annotations = async () => [{ path: 'server/cors.ts', start_line: 1, annotation_level: 'failure', message: 'X-Sham-Visitor not allowed' }];
  fakes.jobLog = async () => 'not ok 3 - CORS allows X-Sham-Visitor';
  fakes.createPull = async () => { throw new Error('GitHub Actions is not permitted to create pull requests'); };
  fakes.deleteBranch = async () => undefined;
  const okSite = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'access-control-allow-origin': 'https://pages.example', 'access-control-allow-headers': 'Content-Type, X-Sham-Visitor' } });
    if (url.endsWith('/api/health')) return json({ status: 'ok', version: liveVersion });
    if (url.endsWith('/api/models')) return json({ models: [{ id: 'auto', hasApiKey: true }] });
    if (url.endsWith('/api/chat')) return init?.method === 'POST' ? json({ reply: 'أنا شاهين' }) : json({}, 204);
    if (url.includes('/api/media')) return json({ images: [] });
    if (url === 'https://pages.example/x/') return new Response('<script type="module" src="/x/a.js"></script>');
    if (url.endsWith('/x/a.js')) return new Response('', { status: liveVersion === base ? 200 : 404 }); // the fix "breaks" Pages once live
    return json({}, 404);
  }) as typeof fetch;
  const env = { DOCTOR_SITE_URL: 'https://site', DOCTOR_PAGES_URL: 'https://pages.example/x/' };
  const ask = async () => '{"summary":"السماح بهيدر معرّف الزائر","edits":[{"path":"server/cors.ts","find":"Content-Type","replace":"Content-Type, X-Sham-Visitor"}]}';
  const opts = { env, github: gh, fetch: okSite, sh, ask, root: work, mode: 'live' as const, runId: '42', log: () => {} };

  const fixed = await runDoctor({ ...opts, now: () => NOW });
  assert.equal(fixed.actions[0].kind, 'ai_fix', JSON.stringify(fixed.actions));
  assert.ok(fixed.actions[0].ok, fixed.actions[0].detail);
  const merged = g(join(dir, 'remote.git'), 'rev-parse', 'main');
  assert.notEqual(merged, base);
  assert.match(g(join(dir, 'remote.git'), 'show', 'main:server/cors.ts'), /X-Sham-Visitor/);
  assert.match(g(join(dir, 'remote.git'), 'log', '-1', '--format=%an %s', 'main'), /^Shaheen Doctor fix\(doctor\): /);
  assert.ok(commands.includes('npm run check:edgeone'), 'verified before shipping');
  assert.ok(calls.includes('dispatch:pages.yml'), 'Pages rebuilt explicitly (token pushes do not trigger workflows)');
  assert.equal(fixed.state.pending?.sha, merged);

  // The fix goes live and Pages breaks twice in a row → automatic revert.
  ciRed = false; liveVersion = merged;
  await runDoctor({ ...opts, now: () => NOW + 10 * MIN });
  const reverted = await runDoctor({ ...opts, now: () => NOW + 20 * MIN });
  assert.equal(reverted.actions[0]?.kind, 'revert', JSON.stringify(reverted.actions));
  assert.ok(reverted.actions[0].ok, reverted.actions[0].detail);
  assert.equal(g(join(dir, 'remote.git'), 'show', 'main:server/cors.ts'), 'export const headers = "Content-Type";');
  assert.equal(reverted.state.pending, undefined);
  assert.equal(reverted.state.fixes.at(-1)?.result, 'reverted');
});

test('the admin panel reads the status board the doctor writes', async () => {
  const { parseDoctorIssue } = await import('../src/admin/doctorReport');
  const state = runs([withFinding(healthy(), f('pages', 'warn', {}, 'بطيء'))]).state;
  state.fixes.push({ at: new Date(NOW).toISOString(), problem: 'cors', result: 'verified', summary: 'سماح بالهيدر', url: 'https://x/pr/1' });
  const body = renderBody(withFinding(healthy(), f('pages', 'warn', {}, 'بطيء')), state, { notes: [], actions: [], site: 'http://x', mode: 'live' });
  const report = parseDoctorIssue(body, 'https://github.com/o/r/issues/1');
  assert.equal(report.headline, '🟡 فيه تحذيرات');
  assert.equal(report.rows.length, 9);
  assert.deepEqual(report.rows.find((r) => r.detail === 'بطيء')?.status, '🟡');
  assert.equal(report.timeline, '🟡');
  assert.equal(report.fixes[0].summary, 'سماح بالهيدر');
  assert.equal(report.lastRun, state.lastRunAt);
});
