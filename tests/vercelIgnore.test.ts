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
