import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CHANGE_TITLE_PREFIX, changeFromIssue, changeIssue, changeRule, changeSummary, changeVerdict, decodeChange, displayReply, encodeChange,
  fileForShaheen, fileIndex, mentionedFiles, newIssueUrl, parseChanges, planChange, readRequests,
} from '../src/utils/ownerFiles';
import { defaultControls } from '../src/utils/ownerAuthority';
import { readRoom } from '../src/utils/ownerRoom';
import { validateRoomRequest } from '../server/ownerRoom';
import { isOwnersRequest } from '../scripts/owner/apply-change.mts';

const FOOTER = 'export function Footer() {\n  return <footer>أهلاً</footer>;\n}\n';
const files: Record<string, string> = { 'src/components/Footer.tsx': FOOTER, 'src/utils/pricing.ts': 'export const MARGIN = 1.5;\n' };
const read = (p: string) => files[p];

const REPLY = [
  'هغيّر جملة الترحيب في الفوتر علشان تبقى أوضح.',
  '[[تعديل: src/components/Footer.tsx]]',
  '```',
  '<<<<<<< SEARCH',
  '  return <footer>أهلاً</footer>;',
  '=======',
  '  return <footer>أهلاً بيك في شام</footer>;',
  '>>>>>>> REPLACE',
  '```',
  '[[/تعديل]]',
  'ولو حابب أشوف كمان [[اقرأ: src/App.tsx]]',
].join('\n');

test('what stays out of Shaheen\'s reach, whatever he proposes', () => {
  for (const p of ['.github/workflows/pages.yml', 'src/utils/ownerFiles.ts', 'src/utils/ownerAuthority.ts', 'src/data/owner/controls.json', 'scripts/owner/gate.mjs',
    'docs/legal/terms.md', 'src/legal/legalExpert.ts', 'src/data/live/store-catalog.json', 'package.json', 'bun.lock', '.env', '../x.ts', '/etc/passwd', 'scripts/doctor/agent.ts']) {
    const r = changeRule(p);
    assert.equal(r.allowed, false, p);
    assert.ok(!r.allowed && r.reasonAr, `${p} says why`);
  }
  for (const p of ['src/components/Footer.tsx', 'server/shaheen.ts', 'src/App.tsx', 'tests/new.test.ts']) assert.equal(changeRule(p).allowed, true, p);
});

test('the reply: change blocks, read requests and what the owner reads', () => {
  const edits = parseChanges(REPLY);
  assert.equal(edits.length, 1);
  assert.equal(edits[0]!.path, 'src/components/Footer.tsx');
  assert.equal(edits[0]!.search, '  return <footer>أهلاً</footer>;');
  assert.equal(edits[0]!.replace, '  return <footer>أهلاً بيك في شام</footer>;');
  assert.deepEqual(readRequests(REPLY), ['src/App.tsx']);
  const shown = displayReply(REPLY);
  assert.doesNotMatch(shown, /SEARCH|REPLACE|\[\[/);
  assert.match(shown, /اقتراح تعديل على `src\/components\/Footer\.tsx`/);
  assert.equal(changeSummary(REPLY), 'هغيّر جملة الترحيب في الفوتر علشان تبقى أوضح.');
  assert.equal(changeSummary(`شفت الفوتر. هخلي المفتاح أوضح شوية.\n${REPLY.split('\n').slice(1).join('\n')}`), 'هخلي المفتاح أوضح شوية.');
  // A new file: an empty SEARCH.
  const created = parseChanges('[[تعديل: src/utils/hello.ts]]\n<<<<<<< SEARCH\n=======\nexport const hi = 1;\n>>>>>>> REPLACE\n[[/تعديل]]');
  assert.deepEqual(created, [{ path: 'src/utils/hello.ts', search: '', replace: 'export const hi = 1;' }]);
});

test('the plan: every old part must match exactly once, and the verdict follows the owner\'s rules', () => {
  const ok = planChange(parseChanges(REPLY), read);
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.files.length, 1);
  assert.match(ok.files[0]!.after, /أهلاً بيك في شام/);
  assert.equal(changeVerdict(defaultControls(), ok).auto, true, 'small and safe');
  assert.equal(changeVerdict({ ...defaultControls(), selfDevelopment: 'approve_all' }, ok).auto, false);

  const sensitive = planChange([{ path: 'src/utils/pricing.ts', search: 'MARGIN = 1.5', replace: 'MARGIN = 1.4' }], read);
  assert.deepEqual(sensitive.problems, []);
  assert.equal(changeVerdict(defaultControls(), sensitive).auto, false, 'money waits for an explicit approval');

  assert.match(planChange([{ path: 'src/components/Footer.tsx', search: 'غير موجود', replace: 'x' }], read).problems[0]!, /مش موجود/);
  assert.match(planChange([{ path: 'src/components/Footer.tsx', search: 'o', replace: 'x' }], read).problems[0]!, /متكرر/);
  assert.match(planChange([{ path: 'src/components/Footer.tsx', search: '', replace: 'x' }], read).problems[0]!, /موجود/);
  assert.match(planChange([{ path: 'src/missing.ts', search: 'a', replace: 'b' }], read).problems[0]!, /مش موجود/);
  assert.match(planChange([{ path: '.github/workflows/x.yml', search: '', replace: 'x' }], read).problems[0]!, /workflows/);
  assert.ok(planChange([], read).problems.length);
  const created = planChange([{ path: 'src/utils/hello.ts', search: '', replace: 'export const hi = 1;' }], read);
  assert.equal(created.files[0]!.before, undefined);
  assert.equal(created.files[0]!.after, 'export const hi = 1;\n');
});

test('the request carries only the change, and the desk reads back exactly what the suite sent', async () => {
  const edits = parseChanges(REPLY);
  const encoded = await encodeChange({ v: 1, summary: 'الفوتر', edits });
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  const plan = planChange(edits, read);
  const issue = changeIssue('غيّر الفوتر 4111 1111 1111 1111', plan, changeVerdict(defaultControls(), plan), encoded);
  assert.ok(issue.title.startsWith(CHANGE_TITLE_PREFIX));
  assert.doesNotMatch(issue.title, /4111/, 'no card numbers in a public request');
  assert.deepEqual(await decodeChange(changeFromIssue(issue.body)!), { v: 1, summary: 'الفوتر', edits });
  assert.equal(await decodeChange('not-a-change'), undefined);
  assert.ok(newIssueUrl(issue.title, issue.body).length < 7_500, 'a small change fits in the link');
});

test('only the owner\'s own request is applied', () => {
  const issue = { number: 5, title: `${CHANGE_TITLE_PREFIX}الفوتر`, body: '', author_association: 'OWNER', user: { login: 'spculculat-oss' } };
  assert.equal(isOwnersRequest({ issue }), true);
  assert.equal(isOwnersRequest({ issue: { ...issue, user: { login: 'someone' } } }), false);
  assert.equal(isOwnersRequest({ issue: { ...issue, author_association: 'CONTRIBUTOR' } }), false);
  assert.equal(isOwnersRequest({ issue: { ...issue, title: 'الفوتر' } }), false);
  assert.equal(isOwnersRequest({}), false);
  const y = readFileSync(new URL('../.github/workflows/owner-control.yml', import.meta.url), 'utf8');
  const job = y.slice(y.indexOf('\n  change:'));
  assert.match(job, /github\.event\.issue\.user\.login == github\.repository_owner/);
  assert.match(job, /github\.event\.issue\.author_association == 'OWNER'/);
  assert.match(job, /startsWith\(github\.event\.issue\.title, '\[شاهين\] '\)/);
  assert.match(job, /scripts\/owner\/apply-change\.mts/);
  assert.match(y, /issues:\n {4}types: \[opened\]/);
  assert.match(y, /if: github\.actor == github\.repository_owner && github\.event_name == 'workflow_dispatch'/, 'orders still come only from the Run button');
});

test('the files Shaheen sees: the list, the files the owner names, and long files cut with a note', () => {
  const paths = ['src/components/Footer.tsx', 'src/components/Header.tsx', 'src/admin/Header.tsx', 'server/shaheen.ts', 'src/data/live/x.json', 'public/a.png', 'README.md'];
  const index = fileIndex(paths);
  assert.match(index, /src\/components: Footer\.tsx, Header\.tsx/);
  assert.doesNotMatch(index, /src\/data|public/);
  assert.ok(fileIndex(paths, 40).endsWith('…'));
  assert.deepEqual(mentionedFiles('شوف Footer.tsx و server/shaheen.ts و Header.tsx', paths), ['src/components/Footer.tsx', 'server/shaheen.ts'], 'an ambiguous name is not guessed');
  const long = fileForShaheen('a.ts', `${'x\n'.repeat(20_000)}`);
  assert.ok(long.content.length < 17_000);
  assert.match(long.content, /اتقطع هنا/);
  assert.doesNotMatch(fileForShaheen('a.ts', 'card 4111 1111 1111 1111').content, /4111/);
});

test('the room server takes the files, checks them, and keeps them for Shaheen only', () => {
  const history = [{ by: 'owner', text: 'شوف الفوتر' }];
  const r = validateRoomRequest({ to: 'shaheen', history, files: [{ path: 'src/components/Footer.tsx', content: FOOTER }], index: 'src/components: Footer.tsx' });
  assert.equal(r.files?.length, 1);
  assert.equal(r.index, 'src/components: Footer.tsx');
  assert.equal(validateRoomRequest({ to: 'secretary', history, files: [{ path: 'src/components/Footer.tsx', content: FOOTER }] }).files, undefined);
  assert.throws(() => validateRoomRequest({ to: 'shaheen', history, files: [{ path: '../etc/passwd', content: 'x' }] }), /Invalid file/);
  assert.throws(() => validateRoomRequest({ to: 'shaheen', history, files: [1, 2, 3, 4].map((i) => ({ path: `a${i}.ts`, content: 'x' })) }), /Too many files/);
});

test('the owner\'s answers to proposals are kept only for messages that exist', () => {
  const room = readRoom({ messages: [{ id: 'm1', by: 'shaheen', text: 'x', at: '' }], notes: [], decisions: { m1: 'sent', gone: 'rejected', m2: 'bogus' } });
  assert.deepEqual(room.decisions, { m1: 'sent' });
  assert.equal(readRoom({ messages: [], notes: [] }).decisions, undefined);
});
