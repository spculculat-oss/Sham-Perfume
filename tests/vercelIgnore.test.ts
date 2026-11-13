/**
 * The Vercel build gate.
 *
 * The production alias must never be left on an old deployment: that is exactly how the canonical
 * host ended up serving a pre-SEO SPA shell (no robots.txt/sitemap.xml/verification file), which the
 * live audit scored 1/100. These tests pin the contract of scripts/vercel-ignore.sh:
 *   exit 1 = build, exit 0 = skip.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/vercel-ignore.sh', import.meta.url));

const run = (env: Record<string, string>) => spawnSync('sh', [script], {
  env: { PATH: process.env.PATH || '/usr/bin:/bin', ...env },
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  encoding: 'utf8',
});

test('the main Vercel project always builds, whatever changed', () => {
  const result = run({ VERCEL_PROJECT_PRODUCTION_URL: 'sham-perfume-49bf.vercel.app' });
  assert.equal(result.status, 1, `main project must build, got ${result.status}: ${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /Main project: building/);
});

test('the unused second project skips when its redirect settings did not change', () => {
  // `true` stands in for "git diff found no change" so the test never depends on repo history.
  const result = run({ VERCEL_PROJECT_PRODUCTION_URL: 'sham-perfume.vercel.app', VERCEL_IGNORE_DIFF_CMD: 'true' });
  assert.equal(result.status, 0, `second project should skip, got ${result.status}: ${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /skipping this build/);
});

test('the second project builds once when its redirect settings changed', () => {
  const result = run({ VERCEL_PROJECT_PRODUCTION_URL: 'sham-perfume.vercel.app', VERCEL_IGNORE_DIFF_CMD: 'false' });
  assert.equal(result.status, 1, `second project should build, got ${result.status}: ${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /redirect settings changed/);
});

test('an unknown project is treated as the main project and builds', () => {
  const result = run({ VERCEL_URL: 'sham-perfume-49bf-abc123.vercel.app' });
  assert.equal(result.status, 1, `unknown project must build, got ${result.status}: ${result.stdout}${result.stderr}`);
});

/* ─────────────────────────────────────────────────────────────────────────────
 * .vercelignore — what is never uploaded to Vercel.
 *
 * 14 Nov 2026: the deployment failed with
 *   [LAMBDA_SIZE_EXCEEDED] Total bundle size (235.01 MB) exceeds the maximum size
 * The site itself built fine; Vercel had auto-detected `api/main.py` (the old local FastAPI
 * server) as a Python function and installed `api/requirements.txt` (fastapi + uvicorn[standard]
 * + pydantic + starlette) on top of the Node function. Ignoring `api/` keeps the deployment to
 * the one Node function (server/vercel-entry.cts) — and these tests keep it that way.
 */
const root = fileURLToPath(new URL('..', import.meta.url));
const ignoreFile = path.join(root, '.vercelignore');

const ignoreLines = () => readFileSync(ignoreFile, 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  // gitignore syntax: a trailing comment is not part of the pattern; blank lines do nothing.
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => line.replace(/^!/, '').replace(/\/+$/, '').replace(/^\//, ''));

test('the local FastAPI folder is excluded from the deployment (no Python function, no 250 MB bundle)', () => {
  assert.ok(existsSync(ignoreFile), 'a .vercelignore must exist: without it Vercel builds api/main.py as a Python function again');
  assert.ok(ignoreLines().includes('api'), 'api/ must be listed in .vercelignore — it is the local FastAPI server, not the site API');
});

test('the excluded files still exist in the repository, for local development', () => {
  // API_README.md documents `uvicorn api.main:app`: the folder stays in git, it is only never uploaded.
  assert.ok(existsSync(path.join(root, 'api', 'main.py')), 'api/main.py is the local API (API_README.md) and must stay in the repo');
  assert.ok(existsSync(path.join(root, 'api', 'requirements.txt')), 'api/requirements.txt is what made the bundle exceed 250 MB when uploaded');
});

test('the deployed API is the Node function built from server/vercel-entry.cts, never a Python one', () => {
  const build = readFileSync(path.join(root, 'scripts', 'build-vercel.mjs'), 'utf8');
  assert.match(build, /entryPoints:\s*\['server\/vercel-entry\.cts'\]/, 'the Vercel function entry is the Node server');
  assert.doesNotMatch(build, /api\/main\.py/, 'the build never touches the local FastAPI app');
});
