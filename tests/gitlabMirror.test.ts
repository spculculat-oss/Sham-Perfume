// «نسخة GitLab»: main is copied to the owner's GitLab project on every push — no timetable, token kept safe.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('main is copied to GitLab after each push only, and the token goes to that one step', () => {
  const wf = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(wf, /^\s+schedule:/m, 'no timetable on GitHub');
  const job = wf.slice(wf.indexOf('\n  mirror:'));
  assert.ok(job.length > 20, 'the mirror job exists');
  assert.match(job, /if: github\.ref == 'refs\/heads\/main' && github\.event_name != 'pull_request'/);
  assert.doesNotMatch(job, /needs:/, 'the backup does not wait for the build');
  assert.equal((wf.match(/secrets\.GITLAB_MIRROR_TOKEN/g) || []).length, 1);
  assert.match(job, /fetch-depth: 0/);
  assert.match(job, /persist-credentials: false/);
  assert.match(job, /HEAD:refs\/heads\/main/);
  assert.doesNotMatch(job, /--force|--mirror|\s-f\s/, 'never overwrites GitLab history');
  assert.doesNotMatch(job, /echo[^\n]*\$\{?GITLAB_MIRROR_TOKEN\}?[^\n]*>>/, 'the token is never written to the summary');
  assert.match(job, /sed "s\/\$\{GITLAB_MIRROR_TOKEN\}\/\*\*\*\/g"/, 'errors are shown with the token hidden');
  for (const line of job.split('\n').filter((l) => /uses:/.test(l))) assert.match(line, /@[0-9a-f]{40} #/);
});
