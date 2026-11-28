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

/* ─────────────────────────────────────────────────────────────────────────────
 * Branches that must never auto-deploy, and the trap behind it.
 *
 * `git.deploymentEnabled` is a DENY list, not an allow list: Vercel's documentation says
 * "By default, any unspecified branch is set to true". Two real failures came from that:
 *   27 Nov — branch `agent/approved-store-design-arabic-2026-11-27` (commit 62f2d84) deployed from a
 *            main that predates scripts/vercel-ignore.sh:
 *              sh: scripts/vercel-ignore.sh: No such file or directory
 *   28 Nov — branch `fix/shaheen-faster-turns-stable-language-2026-11-28` deployed and reached the end:
 *            "agent/**" and "preview/**" were listed, but a fix/* branch matches neither.
 * Listing the working-branch patterns one by one cannot keep up with names chosen per session, so the
 * rule is inverted: everything is off except main.
 */

/**
 * The branch matching Vercel performs (minimatch syntax over the whole branch name), and one `true`
 * rule wins over any `false`. Written here instead of importing minimatch so the check needs no new
 * dependency; it is only ever asked about `main`, `*` and `**`, which are the three forms we use.
 */
function globToRegExp(pattern: string): RegExp {
  const body = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex metacharacters (glob has its own)
    .replace(/\*\*/g, '\u0000')            // `**` spans slashes, `*` does not — keep them apart
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*');
  return new RegExp(`^${body}$`);
}
const minimatch = (branch: string, pattern: string) => globToRegExp(pattern).test(branch);

function deploys(branch: string, rules: Record<string, boolean>): boolean {
  const matched = Object.keys(rules).filter((pattern) => minimatch(branch, pattern));
  if (matched.length === 0) return true; // unspecified ⇒ true (Vercel's documented default)
  return matched.some((pattern) => rules[pattern] === true);
}

const branchRules = () => {
  const settings = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8')) as {
    git?: { deploymentEnabled?: Record<string, boolean> | boolean };
  };
  const enabled = settings.git?.deploymentEnabled;
  assert.equal(typeof enabled, 'object', 'git.deploymentEnabled must list branches explicitly');
  return enabled as Record<string, boolean>;
};

test('only main deploys: every other branch, including names nobody has used yet, is skipped', () => {
  const rules = branchRules();
  assert.equal(deploys('main', rules), true, 'main is the production branch and must deploy');
  // Real branch names from this repository's failures, plus names a future session would invent.
  for (const branch of [
    'agent/approved-store-design-arabic-2026-11-27',
    'fix/shaheen-faster-turns-stable-language-2026-11-28',
    'arena/31119fed-sham-perfume',
    'doctor/maintenance',
    'feature/a/b',
    'chore/tidy',
    'hotfix/urgent',
    'release-2026-12',
  ]) {
    assert.equal(deploys(branch, rules), false, `${branch} must not auto-deploy — only main reaches production`);
  }
});

test('main is never disabled and the deny-all rule stays in place', () => {
  const rules = branchRules();
  assert.equal(rules['**'], false, 'a deny-all rule keeps new branch names from deploying');
  assert.notEqual(rules.main, false, 'main must never be disabled — production is built from main');
  assert.equal(deploys('main', rules), true, 'the deny-all rule plus main:true must still deploy main');
});

test('a missing ignore script falls back to building instead of failing the deployment', () => {
  const settings = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8')) as { ignoreCommand?: string };
  // Some Vercel deployments have reported the tracked script missing even on main. Exit 1 means
  // "build" to Vercel, so the fallback keeps production deployable instead of failing pre-build.
  assert.equal(settings.ignoreCommand, 'sh scripts/vercel-ignore.sh || false');
  assert.ok(existsSync(path.join(root, 'scripts', 'vercel-ignore.sh')), 'the script named by ignoreCommand must exist in this commit');
  const result = spawnSync('sh', ['-c', settings.ignoreCommand], {
    cwd: path.join(root, 'src'), // scripts/ does not exist relative to this working directory
    encoding: 'utf8',
  });
  assert.equal(result.status, 1, `missing script must request a build, got ${result.status}`);
});

test('every branch the ignore script treats as main builds, and the unused backup skips', () => {
  // The gate is covered in depth by tests/vercelIgnore.test.ts; this is the smoke check that the
  // script still exits 1 (build) for the main project after the branch rules changed.
  const result = spawnSync('sh', [path.join(root, 'scripts', 'vercel-ignore.sh')], {
    env: { PATH: process.env.PATH || '/usr/bin:/bin', VERCEL_PROJECT_PRODUCTION_URL: 'sham-perfume-49bf.vercel.app' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 1, `main project must build: ${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /Main project: building/);
});

test('the build log stays clean: the main project never runs git, so no "bad revision" line', () => {
  // Seen in real deployments: `fatal: bad revision 'HEAD^'` printed while the build continued. The
  // main project must decide before any git command, and the backup comparison must not need HEAD^.
  const envs: Record<string, string>[] = [
    { VERCEL_PROJECT_PRODUCTION_URL: 'sham-perfume-49bf.vercel.app' },
    { VERCEL_URL: 'sham-perfume-49bf-abc123.vercel.app' },
    { VERCEL_PROJECT_PRODUCTION_URL: 'sham-perfume.vercel.app' },
  ];
  for (const env of envs) {
    const result = run(env);
    const output = `${result.stdout}${result.stderr}`;
    assert.doesNotMatch(output, /fatal:/, `no git error may reach the Vercel log for ${JSON.stringify(env)}: ${output}`);
  }
  // Comments may explain the old behaviour; only executable lines matter.
  const code = readFileSync(script, 'utf8').split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');
  assert.doesNotMatch(code, /HEAD\^/, 'a shallow clone has no HEAD^ — comparing against it always fails');
});
