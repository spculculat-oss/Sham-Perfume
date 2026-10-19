import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { classifyPath, commitFromDir, emptyBridge, gitBytes, issueFor, mergeText, planImport, recordRun, runOf } from '../scripts/aistudio/bridge';
import { luhn } from '../scripts/aistudio/review';

const dirs: string[] = [];
after(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

/** One throwaway repository holding the site (branch main) and the studio (an unrelated branch, like its own repo). */
function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'bridge-test-'));
  dirs.push(dir);
  const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' };
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q', '-b', 'main');
  const commit = (branch: string, files: Record<string, string | null>, message = 'change') => {
    const exists = git('branch', '--list', branch);
    if (git('branch', '--show-current') !== branch) {
      if (exists) git('checkout', '-q', branch);
      else { git('checkout', '-q', '--orphan', branch); git('rm', '-rq', '--cached', '--ignore-unmatch', '.'); git('clean', '-fdq'); }
    }
    for (const [p, c] of Object.entries(files)) {
      const f = join(dir, p);
      if (c === null) unlinkSync(f); else { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, c); }
    }
    git('add', '-A');
    git('commit', '-q', '--allow-empty', '-m', message);
    return git('rev-parse', 'HEAD');
  };
  const plan = (head: string, base?: string) => planImport(gitBytes(dir), { head, base, main: 'main' });
  return { dir, git, commit, plan };
}
const lines = (n: number, tag = '') => Array.from({ length: n }, (_, i) => `line ${i + 1}${tag}`).join('\n') + '\n';
const byPath = (p: ReturnType<ReturnType<typeof repo>['plan']>) => Object.fromEntries(p.files.map((f) => [f.path, f]));
const skippedPaths = (p: ReturnType<ReturnType<typeof repo>['plan']>) => p.skipped.map((s) => s.path).sort();

test('the filter: robots, workflows, legal, lock files and keys never come in; server and settings wait for approval', () => {
  for (const p of ['.github/workflows/pages.yml', 'src/data/live/aistudio-bridge.json', 'docs/legal/terms.md', 'bun.lock', 'package-lock.json',
    '.env', '.env.local', 'pages-dist/index.html', 'public/p/x.html', 'public/store-images/a.jpg', 'metadata.json', 'src/لغات/ai/fr.json', '../etc/passwd', '/abs']) {
    assert.equal(classifyPath(p).cls, 'blocked', p);
  }
  for (const p of ['server/shaheen.ts', 'scripts/aistudio/bridge.ts', 'tests/x.test.ts', 'package.json', 'vite.config.ts', 'tsconfig.json', 'index.html',
    'src/admin/AdminApp.tsx', 'src/community/Feed.tsx', 'README.md', '.env.example', 'AGENTS.md']) {
    assert.equal(classifyPath(p).cls, 'review', p);
  }
  for (const p of ['src/components/Hero.tsx', 'src/App.tsx', 'src/index.css', 'public/logo.png', 'src/لغات/ar.ts']) assert.equal(classifyPath(p).cls, 'auto', p);
  assert.ok(classifyPath('.github/workflows/x.yml').reason, 'every refusal says why');
});

test('first import: stale copies are skipped, real studio changes wait for approval, nothing is deleted', () => {
  const r = repo();
  r.commit('main', { 'src/a.ts': 'v1\n', 'src/c.ts': 'site c\n', 'src/only-site.ts': 'x\n', 'src/data/live/r.json': '{}\n' });
  r.commit('main', { 'src/a.ts': 'v2\n' });
  const head = r.commit('studio', {
    'src/a.ts': 'v1\n', // an older site version: AI Studio imported long ago
    'src/b.ts': 'brand new\n',
    'src/c.ts': 'studio c\n',
    '.github/workflows/w.yml': 'on: push\n',
    'src/data/live/r.json': '{"old":1}\n',
    'metadata.json': '{}\n',
  });
  const p = r.plan(head);
  assert.equal(p.mode, 'first');
  assert.equal(p.verdict, 'review');
  const f = byPath(p);
  assert.deepEqual(Object.keys(f).sort(), ['src/b.ts', 'src/c.ts']);
  assert.equal(f['src/b.ts'].how, 'new');
  assert.equal(f['src/c.ts'].how, 'studio');
  assert.ok(p.files.every((x) => x.cls === 'review' && x.action === 'write'));
  assert.deepEqual(skippedPaths(p), ['.github/workflows/w.yml', 'metadata.json', 'src/a.ts', 'src/data/live/r.json']);
  assert.equal(f['src/c.ts'].content!.toString(), 'studio c\n');
});

test('update: a site file the site did not touch comes in automatically; server code waits', () => {
  const r = repo();
  r.commit('main', { 'src/x.ts': 'one\n', 'server/s.ts': 'a\n' });
  const s1 = r.commit('studio', { 'src/x.ts': 'one\n', 'server/s.ts': 'a\n' });
  const s2 = r.commit('studio', { 'src/x.ts': 'two\n' }, 'Make the hero bigger');
  let p = r.plan(s2, s1);
  assert.equal(p.mode, 'update');
  assert.equal(p.verdict, 'auto');
  assert.deepEqual(p.files.map((x) => [x.path, x.how, x.cls]), [['src/x.ts', 'studio', 'auto']]);
  assert.equal(p.commits[0].subject, 'Make the hero bigger');
  const s3 = r.commit('studio', { 'server/s.ts': 'b\n' });
  p = r.plan(s3, s2);
  assert.equal(p.verdict, 'review');
  assert.equal(byPath(p)['server/s.ts'].cls, 'review');
  assert.equal(r.plan(s3, s3).verdict, 'none', 'nothing new since the last import');
});

test('update: both sides changed → merged when apart, set aside when overlapping (newer site work is never undone)', () => {
  const r = repo();
  r.commit('main', { 'src/m.tsx': lines(30) });
  const s1 = r.commit('studio', { 'src/m.tsx': lines(30) });
  r.commit('main', { 'src/m.tsx': lines(30).replace('line 2\n', 'line 2 site\n') });
  const s2 = r.commit('studio', { 'src/m.tsx': lines(30).replace('line 28\n', 'line 28 studio\n') });
  const p = r.plan(s2, s1);
  const m = byPath(p)['src/m.tsx'];
  assert.equal(m.how, 'merged');
  assert.match(m.content!.toString(), /line 2 site\n[\s\S]*line 28 studio\n/);
  assert.equal(p.verdict, 'auto');

  const s3 = r.commit('studio', { 'src/m.tsx': lines(30).replace('line 2\n', 'line 2 studio\n').replace('line 28\n', 'line 28 studio\n') });
  const q = r.plan(s3, s2);
  assert.equal(q.files.length, 0);
  assert.deepEqual(skippedPaths(q), ['src/m.tsx']);
  assert.equal(q.verdict, 'none');
  assert.equal(mergeText('a\n', 'a\n', 'b\n'), 'b\n');
  assert.equal(mergeText('x\n', 'a\n', 'b\n'), undefined);
});

test('keys and real card numbers are never imported', () => {
  const r = repo();
  r.commit('main', { 'src/k.ts': 'export const k = 1;\n' });
  const s1 = r.commit('studio', { 'src/k.ts': 'export const k = 1;\n' });
  const key = 'AIza' + 'Q'.repeat(35);
  const s2 = r.commit('studio', { 'src/k.ts': `export const k = '${key}';\n` });
  let p = r.plan(s2, s1);
  assert.equal(p.files.length, 0);
  assert.match(p.skipped[0].reason, /مفتاح/);
  const card = '4532015112830366';
  assert.equal(luhn(card), true);
  const s3 = r.commit('studio', { 'src/k.ts': 'export const k = 1;\n', 'src/pay.ts': `const card = '${card}';\n` });
  p = r.plan(s3, s2);
  assert.deepEqual(p.files, [], 'the site already has the clean k.ts; the card file is left out');
  assert.match(p.skipped.find((x) => x.path === 'src/pay.ts')!.reason, /بطاقة/);
});

test('deletions always wait for approval, and never remove a file the site changed since', () => {
  const r = repo();
  r.commit('main', { 'src/old.ts': 'o\n', 'src/kept.ts': 'k\n' });
  const s1 = r.commit('studio', { 'src/old.ts': 'o\n', 'src/kept.ts': 'k\n' });
  r.commit('main', { 'src/kept.ts': 'k2\n' });
  const s2 = r.commit('studio', { 'src/old.ts': null, 'src/kept.ts': null });
  const p = r.plan(s2, s1);
  assert.deepEqual(p.files.map((x) => [x.path, x.action, x.cls]), [['src/old.ts', 'delete', 'review']]);
  assert.deepEqual(skippedPaths(p), ['src/kept.ts']);
  assert.equal(p.verdict, 'review');
});

test('a rewritten studio history (force push) is treated as a first import', () => {
  const r = repo();
  r.commit('main', { 'src/x.ts': 'one\n' });
  r.commit('studio', { 'src/x.ts': 'one\n' });
  const head = r.commit('studio2', { 'src/x.ts': 'two\n' });
  const unrelated = r.git('rev-parse', 'studio');
  const p = r.plan(head, unrelated);
  assert.equal(p.mode, 'first');
  assert.equal(p.verdict, 'review');
});

test('the report keeps 30 runs, never file contents; the issue is a shaheen-task the coding agent picks up', () => {
  const r = repo();
  r.commit('main', { 'src/x.ts': 'one\n' });
  const s1 = r.commit('studio', { 'src/x.ts': 'one\n' });
  const s2 = r.commit('studio', { 'src/x.ts': 'two\n', 'server/a.ts': 'a\n' }, 'Add a banner');
  const plan = r.plan(s2, s1);
  let file = emptyBridge('o/studio');
  for (let i = 0; i < 35; i++) file = recordRun(file, { ...runOf(plan, 'review'), studioSha: `sha${i}` }, 'review', { repo: 'o/studio', lastStudioSha: `sha${i}` });
  assert.equal(file.runs.length, 30);
  assert.equal(file.runs[0].studioSha, 'sha34');
  assert.equal(file.lastStudioSha, 'sha34');
  assert.ok(!JSON.stringify(file).includes('"content"'));
  const kept = recordRun(file, undefined, 'waiting_repo', { repo: 'o/studio', note: 'n' });
  assert.equal(kept.lastStudioSha, 'sha34');
  assert.equal(kept.note, 'n');

  const issue = issueFor(plan, { repo: 'o/studio', branch: `aistudio/${s2.slice(0, 7)}`, checksFailed: [], siteRepo: 'o/site' });
  assert.match(issue.title, /جوجل استوديو: Add a banner/);
  assert.deepEqual(issue.labels, ['shaheen-task', 'aistudio', 'needs-approval']);
  assert.match(issue.body, /server\/a\.ts/);
  assert.match(issue.body, /نفذ مهام شاهين/);
  assert.deepEqual(issueFor(plan, { repo: 'o/studio', branch: 'b', checksFailed: ['الاختبارات'], siteRepo: 'o/site' }).labels, ['shaheen-task', 'aistudio']);
});

test('a downloaded project (ZIP folder) goes through the same filter, ignoring node_modules and never deleting', () => {
  const r = repo();
  r.commit('main', { 'src/a.ts': 'v1\n', 'src/keep.ts': 'k\n', 'src/data/live/r.json': '{}\n' });
  r.commit('main', { 'src/a.ts': 'v2\n' });
  const dl = mkdtempSync(join(tmpdir(), 'bridge-dl-'));
  dirs.push(dl);
  const put = (p: string, c: string) => { mkdirSync(dirname(join(dl, p)), { recursive: true }); writeFileSync(join(dl, p), c); };
  put('src/a.ts', 'v1\n'); // stale
  put('src/new.tsx', 'export default 1;\n');
  put('src/data/live/r.json', '{"x":1}\n');
  put('node_modules/lib/index.js', 'junk\n');
  put('.gitignore', 'dist/\n');
  put('dist/x.js', 'built\n');
  const before = r.git('rev-parse', 'HEAD');
  const head = commitFromDir(r.dir, dl);
  assert.equal(r.git('rev-parse', 'HEAD'), before, 'no branch or working tree change');
  const p = r.plan(head);
  assert.deepEqual(p.files.map((f) => f.path).sort(), ['.gitignore', 'src/new.tsx'], 'dist/ (ignored) and node_modules never come');
  assert.deepEqual(skippedPaths(p), ['src/a.ts', 'src/data/live/r.json']);
  assert.ok(!p.files.some((f) => f.action === 'delete'), 'src/keep.ts is missing from the download but is not deleted');
});
