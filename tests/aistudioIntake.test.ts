import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import {
  dependencyChanges, emptyIntake, gitIn, isAiStudioCommit, listCommits, luhn, mergeIntake, pendingCommits,
  reviewCommit, scanSecrets, verdictOf, type CommitMeta,
} from '../scripts/aistudio/review';

const OWNER = 'owner@example.com';
const dirs: string[] = [];
after(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

/** A throwaway repository with commits by the owner (AI Studio), the agent (PRs) and a bot. */
function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'aistudio-'));
  dirs.push(dir);
  const run = (env: Record<string, string>, ...args: string[]) => execFileSync('git', args, { cwd: dir, env: { ...process.env, ...env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  run({}, 'init', '-q', '-b', 'main');
  const who = (name: string, email: string) => ({ GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email });
  const as = { owner: who('owner', OWNER), agent: who('agent', '1+agent@users.noreply.github.com'), bot: who('Shaheen bot', '41898282+github-actions[bot]@users.noreply.github.com') };
  const write = (files: Record<string, string | null>) => {
    for (const [p, c] of Object.entries(files)) {
      const f = join(dir, p);
      if (c === null) unlinkSync(f); else { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, c); }
    }
  };
  const commit = (by: keyof typeof as, message: string, files: Record<string, string | null>) => {
    write(files);
    run(as[by], 'add', '-A');
    run(as[by], 'commit', '-q', '-m', message);
    return run({}, 'rev-parse', 'HEAD').trim();
  };
  return { dir, git: gitIn(dir), commit };
}

test('AI Studio commits are the owner as author and committer, never merges or bots', () => {
  const base: CommitMeta = { sha: 'a', parents: ['p'], authorName: 'o', authorEmail: OWNER, committerEmail: OWNER, date: '', subject: '', body: '' };
  assert.equal(isAiStudioCommit(base, [OWNER]), true);
  assert.equal(isAiStudioCommit({ ...base, authorEmail: 'Owner@Example.com', committerEmail: 'owner@example.com' }, [OWNER]), true);
  assert.equal(isAiStudioCommit({ ...base, committerEmail: 'noreply@github.com' }, [OWNER]), false, 'a PR merge on GitHub');
  assert.equal(isAiStudioCommit({ ...base, parents: ['p', 'q'] }, [OWNER]), false);
  assert.equal(isAiStudioCommit({ ...base, authorEmail: 'bot@x', committerEmail: 'bot@x' }, [OWNER]), false);
});

test('secrets and real card numbers are caught (masked); public test cards and test fixtures are not errors', () => {
  assert.equal(luhn('4242424242424242'), true);
  assert.equal(luhn('4242424242424241'), false);
  const flags = scanSecrets([
    { file: 'src/a.ts', line: `const key = "AIza${'x'.repeat(35)}";` },
    { file: 'src/b.ts', line: 'pay("4539 1488 0343 6467")' }, // valid Luhn, not a public test card
    { file: 'src/c.ts', line: 'demo card 4242 4242 4242 4242 and order 1234567890123' },
    { file: 'tests/d.test.ts', line: "detect('4539148803436467')" },
    { file: 'bun.lock', line: `"AIza${'y'.repeat(35)}"` },
  ]);
  assert.deepEqual(flags.map((f) => [f.kind, f.level, f.file]), [['secret', 'high', 'src/a.ts'], ['card', 'high', 'src/b.ts'], ['card', 'low', 'tests/d.test.ts']]);
  assert.ok(flags.every((f) => !f.text.includes('4539148803436467') && !f.text.includes('x'.repeat(35))), 'the secret itself is never repeated');
});

test('verdicts and dependency changes', () => {
  assert.equal(verdictOf([{ level: 'low', kind: 'heavy', text: '' }], false), 'received');
  assert.equal(verdictOf([{ level: 'high', kind: 'deleted', text: '' }], false), 'attention');
  assert.equal(verdictOf([], true), 'broken');
  assert.deepEqual(dependencyChanges('{"dependencies":{"a":"1","b":"1"}}', '{"dependencies":{"a":"1","c":"1"},"devDependencies":{"d":"1"}}'), { added: ['c', 'd'], removed: ['b'] });
});

test('a change made on a stale copy is caught: the file went back to an older version and newer work is named', () => {
  const r = repo();
  r.commit('owner', 'feat: header v1', { 'src/Header.tsx': 'v1\n', 'server/app.ts': 'server\n', 'package.json': '{"dependencies":{}}' });
  r.commit('agent', 'Community: add the hub link to the header', { 'src/Header.tsx': 'v1\nhub link\n' });
  r.commit('bot', 'مستورد شاهين: نقل منتجات', { 'src/data/live/x.json': '{}' });
  const stale = r.commit('owner', 'refactor(ui): header dropdowns', {
    'src/Header.tsx': 'v1\n', // AI Studio's old copy: the hub link is gone
    'server/app.ts': null,
    'src/new.tsx': `export const k = "AIza${'z'.repeat(35)}";\n`,
    'package.json': '{"dependencies":{"recharts":"3"}}',
  });
  const commit = listCommits(r.git).find((c) => c.sha === stale)!;
  const review = reviewCommit(r.git, commit);
  const kinds = review.flags.map((f) => `${f.kind}:${f.level}:${f.file || ''}`);
  assert.ok(kinds.includes('reverted:high:src/Header.tsx'), kinds.join(' | '));
  assert.match(review.flags.find((f) => f.kind === 'reverted')!.text, /Community: add the hub link/);
  assert.ok(kinds.includes('deleted:high:server/app.ts'));
  assert.ok(kinds.includes('secret:high:src/new.tsx'));
  assert.ok(review.flags.some((f) => f.kind === 'dependency' && /recharts/.test(f.text)));
  assert.deepEqual(review.added, ['src/new.tsx']);
  assert.deepEqual(review.deleted, ['server/app.ts']);
});

test('a normal AI Studio change is received; each commit is reviewed once; failing site checks mark the batch', () => {
  const r = repo();
  r.commit('agent', 'base', { 'src/Promo.tsx': 'a\nb\n' });
  const first = r.commit('owner', 'feat: promo branding', { 'src/Promo.tsx': 'a\nb\nc\n' });
  let state = emptyIntake([OWNER]);
  const pending = pendingCommits(r.git, state, [OWNER]);
  assert.deepEqual(pending.map((c) => c.sha), [first]);
  const review = reviewCommit(r.git, pending[0]);
  assert.deepEqual(review.flags, []);
  const ok = { lint: 'success', test: 'success', build: 'success', pages: 'success' } as const;
  state = mergeIntake(state, [review], { ...ok }, first);
  assert.equal(state.commits[0].verdict, 'received');
  assert.equal(pendingCommits(r.git, state, [OWNER]).length, 0, 'reviewed once');

  const second = r.commit('owner', 'feat: more', { 'src/Promo.tsx': 'a\nb\nc\nd\n' });
  const next = pendingCommits(r.git, state, [OWNER]);
  assert.deepEqual(next.map((c) => c.sha), [second]);
  state = mergeIntake(state, next.map((c) => reviewCommit(r.git, c)), { ...ok, test: 'failure' }, second);
  assert.deepEqual(state.commits.map((c) => [c.sha, c.verdict]), [[second, 'broken'], [first, 'received']]);
  assert.equal(state.checks.test, 'failure');
  assert.equal(state.reviewed.length, 2);
});
