// Builds the site with Tencent's own EdgeOne CLI, then runs the generated Cloud Function in an
// isolated folder (no node_modules, like the platform) and checks the API end to end — including
// that state survives between requests (EdgeOne re-evaluates the bundle on every request).
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CLI = process.env.EDGEONE_CLI || 'edgeone@1.6.41';
const build = spawnSync('npx', ['--yes', CLI, 'makers', 'build'], { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });
if (build.status !== 0) { console.log(build.stdout); throw new Error('edgeone makers build failed'); }
assert.match(build.stdout, /Node functions build completed successfully/, 'EdgeOne did not detect the Cloud Function');

const out = '.edgeone/cloud-functions/api-node';
const routes = JSON.parse(await readFile(`${out}/config.json`, 'utf8')).routes.map((r) => r.src);
assert.deepEqual(routes, ['^/api$', '^/api/(.*)$']);
await readFile('.edgeone/assets/index.html', 'utf8');

const dir = await mkdtemp(path.join(tmpdir(), 'sham-edgeone-'));
await copyFile(`${out}/index.mjs`, path.join(dir, 'index.mjs'));
const child = spawn(process.execPath, ['index.mjs'], { cwd: dir, stdio: ['ignore', 'ignore', 'inherit'],
  env: { PATH: process.env.PATH, SHAM_SHAHEEN_RATE_PER_MIN: '2', SHAM_ADMIN_TOKEN: 'edgeone-check-token' } });
const base = 'http://127.0.0.1:9000';
const headers = { 'eo-pages-host': 'sham.edgeone.app', 'content-type': 'application/json' };
try {
  for (let i = 0; ; i++) {
    try { if ((await fetch(`${base}/api/health`, { headers })).ok) break; } catch { /* starting */ }
    if (i > 50) throw new Error('function did not start');
    await new Promise((r) => setTimeout(r, 200));
  }
  const health = await (await fetch(`${base}/api/health`, { headers })).json();
  assert.deepEqual({ service: health.service, status: health.status }, { service: 'sham-perfume', status: 'ok' });
  const models = await (await fetch(`${base}/api/models`, { headers })).json();
  assert.deepEqual(models.models.map((m) => m.id), ['auto', 'fast', 'deep', 'council']);

  // State must persist across requests: admin setting, then per-visitor rate limit.
  const auth = { ...headers, authorization: 'Bearer edgeone-check-token' };
  const saved = await fetch(`${base}/api/admin/settings`, { method: 'PUT', headers: auth, body: JSON.stringify({ shaheen: { allowVisitorChoice: false } }) });
  assert.equal(saved.status, 200);
  assert.equal((await (await fetch(`${base}/api/models`, { headers })).json()).allowVisitorChoice, false, 'admin settings were lost between requests');
  const chat = () => fetch(`${base}/api/chat`, { method: 'POST', headers: { ...headers, 'eo-connecting-ip': '41.33.1.1' }, body: '{"message":"hi"}' });
  const codes = [(await chat()).status, (await chat()).status, (await chat()).status];
  assert.deepEqual(codes, [503, 503, 429], 'rate limit state was lost between requests');
  console.log('EdgeOne build verified: Cloud Function detected, isolated bundle serves /api, state persists between requests.');
} finally {
  child.kill();
  await rm(dir, { recursive: true, force: true });
}
