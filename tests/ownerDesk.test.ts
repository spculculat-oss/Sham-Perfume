/**
 * «شاهين الوكيل المسؤول» — Shaheen prepares, the owner approves (rule O-09). The desk's requests, the order cards,
 * the approvals inbox and the log with «رجّع».
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  changeDraft, decideDraft, decodeDesk, deskIssue, deskLog, displayOrders, inboxFrom, logUrl, orderableBots, orderDraft, orderText,
  parseOrders, plainSummary, readDesk, readOrder, requestTrailer, revertDraft, TASK_APPROVAL_LABEL, type GhIssue,
} from '../src/utils/ownerDesk';
import { CHANGE_TITLE_PREFIX, encodePayload, isReadablePath, planChange } from '../src/utils/ownerFiles';
import { OWNER, OWNER_APPROVAL_LABEL, OWNER_RULES, defaultControls, readControls, selfDevVerdict } from '../src/utils/ownerAuthority';
import { readRoom } from '../src/utils/ownerRoom';
import { DESK_CHECKS, isOwnersRequest } from '../scripts/owner/apply-change.mts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('orders in a reply: known actions and robots only, at most three, no repeats', () => {
  const reply = 'هوقف الطبيب شوية.\n[[أمر: pause doctor]]\n[[أمر: pause doctor]]\n[[امر: freeze]]\n[[أمر: run patrol]]\n[[أمر: resume ghost]]\n[[أمر: delete_all]]\n[[أمر: unfreeze]]';
  const orders = parseOrders(reply);
  assert.deepEqual(orders, [{ action: 'pause', bot: 'doctor' }, { action: 'freeze' }, { action: 'run', bot: 'patrol' }]);
  // freeze/unfreeze need no robot; the others need one the desk may order.
  assert.deepEqual(readOrder({ action: 'unfreeze', bot: 'doctor' }), { action: 'unfreeze' });
  assert.equal(readOrder({ action: 'pause' }), undefined);
  assert.equal(readOrder({ action: 'safe_auto' }), undefined, 'Shaheen can never change how changes are approved');
  // The site's publishing and the owner's own desk can't be ordered around.
  const ids = orderableBots().map((b) => b.workflow);
  assert.ok(!ids.includes('pages.yml') && !ids.includes('owner-control.yml'));
  assert.ok(orderableBots().length >= 10);
  const shown = displayOrders(reply);
  assert.doesNotMatch(shown, /\[\[أمر: pause doctor\]\]/);
  assert.match(shown, /مستني موافقتك/);
  assert.match(shown, /\[\[أمر: delete_all\]\]/, 'an unknown order stays visible as text');
  assert.match(orderText({ action: 'pause', bot: 'doctor' }), /^وقف روبوت: /);
});

test('the desk reads every kind of request and refuses anything malformed', async () => {
  assert.deepEqual(readDesk({ v: 2, kind: 'order', summary: 'x', order: { action: 'run', bot: 'patrol' } }), { v: 2, kind: 'order', summary: 'x', order: { action: 'run', bot: 'patrol' } });
  assert.equal(readDesk({ v: 2, kind: 'order', summary: 'x', order: { action: 'run', bot: 'nobody' } }), undefined);
  assert.equal(readDesk({ v: 2, kind: 'decide', summary: 'x', target: 12, decision: 'return' }), undefined, 'sending back needs a note');
  assert.equal(readDesk({ v: 2, kind: 'decide', summary: 'x', target: 12, decision: 'merge_now' }), undefined);
  assert.equal(readDesk({ v: 2, kind: 'decide', summary: 'x', target: -3, decision: 'approve' }), undefined);
  const back = readDesk({ v: 2, kind: 'decide', summary: 'x', target: 12, decision: 'return', note: 'غيّر اللون — رقمي 29801011234567' });
  assert.equal(back?.kind, 'decide');
  assert.doesNotMatch(JSON.stringify(back), /\d{12,}/, 'an ID or card number never reaches GitHub');
  assert.deepEqual(readDesk({ v: 2, kind: 'revert', summary: 'x', request: 40 }), { v: 2, kind: 'revert', summary: 'x', request: 40 });
  assert.equal(readDesk({ v: 3, kind: 'revert', summary: 'x', request: 40 }), undefined);
  // The first room changes (version 1) still work.
  const v1 = readDesk({ v: 1, summary: 'جملة', edits: [{ path: 'src/components/Footer.tsx', search: 'a', replace: 'b' }] });
  assert.equal(v1?.kind, 'change');
  const draft = orderDraft({ action: 'freeze' }, 'في مشكلة');
  assert.deepEqual(await decodeDesk(await encodePayload(draft.payload)), draft.payload);
});

test('every answer becomes a plain request titled for the desk, with the request inside', () => {
  const plan = planChange([{ path: 'src/components/Footer.tsx', search: 'a', replace: 'b' }], () => 'a b c');
  const drafts = [
    changeDraft('جملة الفوتر', plan, selfDevVerdict(defaultControls(), { paths: ['src/components/Footer.tsx'], lines: 2 }), [{ path: 'src/components/Footer.tsx', search: 'a', replace: 'b' }]),
    orderDraft({ action: 'pause', bot: 'doctor' }, ''),
    decideDraft({ number: 7, kind: 'pull', title: 'تحسين الصور' }, 'approve'),
    decideDraft({ number: 8, kind: 'task', title: 'مهمة' }, 'return', 'بس من غير ألوان'),
    revertDraft({ number: 9, title: 'جملة الفوتر' }),
  ];
  for (const d of drafts) {
    assert.ok(readDesk(d.payload), `${d.payload.kind} is readable by the desk`);
    const issue = deskIssue(d.title, d.lines, 'ENC');
    assert.ok(issue.title.startsWith(CHANGE_TITLE_PREFIX));
    assert.match(issue.body, /```shaheen-change\nENC\n```/);
  }
  assert.equal(drafts[3]!.payload.kind === 'decide' && drafts[3]!.payload.note, 'بس من غير ألوان');
  assert.equal(requestTrailer(41), 'Owner-Request: #41');
});

const issue = (x: Partial<GhIssue> & { number: number }): GhIssue => ({
  title: 't', body: '', state: 'open', html_url: `https://github.com/x/y/issues/${x.number}`, created_at: `2026-10-${10 + (x.number % 10)}T00:00:00Z`, labels: [], ...x,
} as GhIssue);

test('the inbox lists robots\' changes marked for approval and council tasks that need it — nothing else', () => {
  const items = inboxFrom([
    issue({ number: 1, pull_request: {}, labels: [{ name: OWNER_APPROVAL_LABEL }], title: 'تحسين الصور', body: '## ليه\n- عشان أسرع\n<!-- hidden -->\n```diff\n+x\n```' }),
    issue({ number: 2, labels: [{ name: 'shaheen-task' }, { name: TASK_APPROVAL_LABEL }], title: 'مهمة شاهين: صفحة جديدة' }),
    issue({ number: 3, labels: [{ name: 'shaheen-task' }], title: 'مهمة عادية' }),
    issue({ number: 4, pull_request: {}, labels: [], title: 'PR بدون موافقة' }),
    issue({ number: 5, state: 'closed', labels: [{ name: 'shaheen-task' }, { name: TASK_APPROVAL_LABEL }] }),
    issue({ number: 2, labels: [{ name: 'shaheen-task' }, { name: TASK_APPROVAL_LABEL }], title: 'مهمة شاهين: صفحة جديدة' }),
  ]);
  assert.deepEqual(items.map((i) => [i.number, i.kind]), [[2, 'task'], [1, 'pull']]);
  assert.equal(items[0]!.title, 'صفحة جديدة');
  assert.equal(items[1]!.summary, 'ليه · عشان أسرع');
  assert.equal(plainSummary('a'.repeat(400)).length, 320);
});

test('the log shows only the owner\'s own requests, with «رجّع» only where something may have changed', () => {
  const log = deskLog([
    issue({ number: 10, title: `${CHANGE_TITLE_PREFIX}جملة الفوتر`, state: 'closed', state_reason: 'completed', user: { login: OWNER.github } }),
    issue({ number: 11, title: `${CHANGE_TITLE_PREFIX}رفض #7: تحسين`, state: 'closed', state_reason: 'completed', user: { login: OWNER.github } }),
    issue({ number: 12, title: `${CHANGE_TITLE_PREFIX}وقف روبوت`, state: 'closed', state_reason: 'not_planned', user: { login: OWNER.github } }),
    issue({ number: 13, title: `${CHANGE_TITLE_PREFIX}بيتنفذ`, user: { login: OWNER.github } }),
    issue({ number: 14, title: `${CHANGE_TITLE_PREFIX}من حد غريب`, user: { login: 'stranger' } }),
    issue({ number: 15, title: 'issue عادي', user: { login: OWNER.github } }),
  ], OWNER.github);
  assert.deepEqual(log.map((l) => [l.number, l.state, l.undoable]), [[13, 'waiting', true], [12, 'refused', true], [11, 'done', false], [10, 'done', true]]);
  assert.match(logUrl(), new RegExp(`creator=${OWNER.github}`));
});

test('the desk acts only on the owner\'s own requests, and checks everything before anything lands', () => {
  const ev = (login: string, assoc: string, title: string) => ({ issue: { number: 1, title, body: '', user: { login }, author_association: assoc } });
  assert.equal(isOwnersRequest(ev(OWNER.github, 'OWNER', `${CHANGE_TITLE_PREFIX}وقف روبوت`)), true);
  assert.equal(isOwnersRequest(ev('someone', 'NONE', `${CHANGE_TITLE_PREFIX}وقف روبوت`)), false);
  assert.equal(isOwnersRequest(ev(OWNER.github, 'OWNER', 'عنوان تاني')), false);
  assert.deepEqual(DESK_CHECKS, ['npm run lint', 'npm test', 'npm run build:pages', 'npm run build:vercel', 'npm run test:vercel']);
  // The desk itself can never be changed from the room.
  assert.equal(isReadablePath('src/utils/ownerDesk.ts') && planChange([{ path: 'src/utils/ownerDesk.ts', search: 'a', replace: 'b' }], () => 'a').problems.length === 0, false);
  const wf = read('.github/workflows/owner-control.yml');
  assert.match(wf, /fetch-depth: 300/, '«رجّع» needs the recent history');
});

test('the owner chose: the robots go to «دولة المنصة» for approvals, nothing goes in by itself beyond small safe fixes', () => {
  const c = readControls(JSON.parse(read('src/data/owner/controls.json')));
  assert.equal(c.selfDevelopment, 'state');
  assert.ok(OWNER_RULES.some((r) => r.id === 'O-09' && /صندوق الموافقات/.test(r.textAr)));
  assert.match(read('scripts/shaheen-council/run.mts'), /ownerApprovesAll[\s\S]*t\.needsApproval = true/);
  assert.match(read('scripts/aistudio/bridge.mts'), /selfDevelopment === 'approve_all'[\s\S]*plan\.verdict = 'review'/);
  // Shaheen knows his role and how to write an order.
  const room = read('server/ownerRoom.ts');
  assert.match(room, /الوكيل المسؤول/);
  assert.match(room, /\[\[أمر: pause doctor\]\]/);
  assert.match(room, /مفيش أي حاجة بتتنفذ غير بعد ما يراجعها ويوافق/);
  assert.match(room, /orderableBots\(\)/);
});

test('an order\'s answer in the room is remembered next to the change cards', () => {
  const room = readRoom({ version: 1, messages: [{ id: 'm1', by: 'shaheen', text: 'x', at: '2026-10-22T00:00:00Z' }], decisions: { m1: 'returned', 'm1:order:0': 'sent', 'zz:order:0': 'sent', m2: 'sent' } });
  assert.deepEqual(room.decisions, { m1: 'returned', 'm1:order:0': 'sent' });
});
