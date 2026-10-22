/**
 * «دولة المنصة» — the decentralized top authority over the robots: its members vote, the legal manager and privacy
 * hold a veto, it never touches the owner's zone, and it decides only while the owner handed it the approvals.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyOwnerCommand, defaultControls, readControls, selfDevVerdict } from '../src/utils/ownerAuthority';
import { changeVerdict } from '../src/utils/ownerFiles';
import { inboxFrom, type GhIssue } from '../src/utils/ownerDesk';
import { BOTS, LINKS } from '../src/utils/shaheenOrg';
import {
  STATE_CONSTITUTION, STATE_LABELS, STATE_LIMITS, STATE_MEMBERS, readStateReport, stateActive, stateComment, stateTrailer, stateVote,
} from '../src/utils/platformState';

const NOW = new Date('2026-10-22T10:00:00Z');

test('the owner hands the approvals to the State and takes them back from his desk', () => {
  let c = defaultControls();
  assert.equal(stateActive(c), false);
  const handed = applyOwnerCommand(c, 'state_rule', undefined, 'spculculat-oss', NOW);
  assert.equal(handed.changed, true);
  c = handed.controls;
  assert.equal(c.selfDevelopment, 'state');
  assert.equal(stateActive(c), true);
  // The emergency brake stops the State with every robot (S-06).
  assert.equal(stateActive(applyOwnerCommand(c, 'freeze', undefined, 'spculculat-oss', NOW).controls), false);
  // approve_all takes everything back to him.
  assert.equal(stateActive(applyOwnerCommand(c, 'approve_all', undefined, 'spculculat-oss', NOW).controls), false);
  assert.equal(readControls({ selfDevelopment: 'state' }).selfDevelopment, 'state');
  assert.equal(readControls({ selfDevelopment: 'anything' }).selfDevelopment, defaultControls().selfDevelopment);
});

test('the bundled switches hand the approvals to the State, and its robot is on the org chart under the owner', () => {
  const controls = readControls(JSON.parse(readFileSync(new URL('../src/data/owner/controls.json', import.meta.url), 'utf8')));
  assert.equal(controls.selfDevelopment, 'state');
  const bot = BOTS.find((b) => b.id === 'state');
  assert.ok(bot, 'the State is a bot in the org chart');
  assert.equal(bot.workflow, 'platform-state.yml');
  assert.ok(LINKS.some((l) => l.from === 'owner_desk' && l.to === 'state'), 'the owner sits above the State');
  assert.ok(LINKS.some((l) => l.from === 'state' && l.to === 'council'), 'the State oversees the council');
  const wf = readFileSync(new URL('../.github/workflows/platform-state.yml', import.meta.url), 'utf8');
  assert.match(wf, /scripts\/owner\/gate\.mjs state/, 'the State obeys the owner\'s switches');
});

test('small safe changes still go in; bigger ones wait for the State instead of the owner', () => {
  const c = { ...defaultControls(), selfDevelopment: 'state' as const };
  assert.equal(selfDevVerdict(c, { paths: ['src/components/A.tsx'], lines: 10 }).auto, true);
  const big = selfDevVerdict(c, { paths: ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', 'f.ts'], lines: 500 });
  assert.equal(big.auto, false);
  assert.match(big.reasonAr, /دولة المنصة/);
  // The owner's own room cards are his: he is not waiting for the State.
  const card = changeVerdict(c, { files: [{ path: 'src/components/A.tsx' }], lines: 600 } as unknown as Parameters<typeof changeVerdict>[1]);
  assert.match(card.reasonAr, /صاحب الموقع/);
});

test('a clear robot change in one department passes with enough votes', () => {
  const d = stateVote({ kind: 'pull', title: 'تحسين صفحة الأخبار على الموبايل', paths: ['src/components/NewsPage.tsx'], lines: 40, added: 'const x = 1;' });
  assert.equal(d.approved, true, d.summaryAr);
  assert.ok(d.tally.approve >= 3);
  assert.equal(d.tally.veto, 0);
  assert.equal(d.votes.length, STATE_MEMBERS.length, 'every member votes (or abstains) on its own');
  assert.match(stateComment(d), /الخبير شاهين/);
});

test('the legal manager and privacy hold a veto; the owner\'s zone is never the State\'s call', () => {
  const legal = stateVote({ kind: 'pull', title: 'تعديل سياسة الاسترجاع', paths: ['docs/legal/returns.md'], lines: 5 });
  assert.equal(legal.approved, false);
  assert.equal(legal.votes.find((v) => v.member === 'legal')?.vote, 'veto');
  const hold = stateVote({ kind: 'task', title: 'شيل وقف نقل المنتجات L-03', body: 'نرجّع الاستيراد' });
  assert.equal(hold.approved, false, 'L-03 stays enforced');
  for (const path of ['src/data/owner/controls.json', 'src/utils/ownerAuthority.ts', 'src/utils/platformState.ts', 'scripts/state/run.mts', 'server/ownerRoom.ts']) {
    const d = stateVote({ kind: 'pull', title: 'تعديل بسيط في الإعدادات', paths: [path], lines: 2 });
    assert.equal(d.approved, false, path);
    assert.equal(d.votes.find((v) => v.member === 'privacy')?.vote, 'veto', path);
  }
  const id = stateVote({ kind: 'pull', title: 'إضافة رقم للتواصل', paths: ['src/components/Footer.tsx'], lines: 1, added: '29801011234567' });
  assert.equal(id.approved, false, 'personal numbers never go in');
  const owner = stateVote({ kind: 'task', title: 'اعرض بيانات صاحب الموقع في اللوحة' });
  assert.equal(owner.approved, false);
});

test('workflows, dependencies, outside AI platforms and oversized changes go to the owner', () => {
  assert.equal(stateVote({ kind: 'pull', title: 'تحديث تشغيل الروبوت', paths: ['.github/workflows/news.yml'], lines: 3 }).approved, false);
  assert.equal(stateVote({ kind: 'pull', title: 'إضافة مكتبة جديدة', paths: ['package.json', 'src/components/A.tsx'], lines: 3 }).approved, false);
  assert.equal(stateVote({ kind: 'pull', title: 'ربط الشات بمحرك خارجي', paths: ['server/chat.ts'], lines: 3, added: 'fetch("https://api.openai.com/v1/chat")' }).approved, false);
  const many = Array.from({ length: STATE_LIMITS.files + 1 }, (_, i) => `src/components/C${i}.tsx`);
  assert.equal(stateVote({ kind: 'pull', title: 'إعادة ترتيب المكونات', paths: many, lines: 50 }).approved, false);
  assert.equal(stateVote({ kind: 'pull', title: 'تعديل كبير في الصفحة', paths: ['src/components/A.tsx'], lines: STATE_LIMITS.lines + 1 }).approved, false);
  assert.equal(stateVote({ kind: 'pull', title: 'حاجة', paths: [], lines: 0 }).approved, false);
});

test('council tasks: a clear one passes, its label lets the coding agent carry it out', () => {
  const d = stateVote({ kind: 'task', title: 'تحسين سرعة تحميل صفحة المنتجات', body: 'الصفحة بطيئة على الموبايل' });
  assert.equal(d.approved, true, d.summaryAr);
  assert.equal(STATE_LABELS.approvedTask, 'approved-by-state');
  assert.match(readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8'), /approved-by-state/);
});

test('what the State refused reaches the owner\'s inbox marked; its trailer lets «رجّع» find its changes', () => {
  const issue = (labels: string[]): GhIssue => ({ number: 7, title: 'تعديل', body: 'x', html_url: 'u', created_at: NOW.toISOString(), state: 'open', pull_request: {}, labels: labels.map((name) => ({ name })) });
  assert.equal(inboxFrom([issue(['بانتظار موافقة صاحب الموقع', STATE_LABELS.refused])])[0]?.stateRefused, true);
  assert.equal(inboxFrom([issue(['بانتظار موافقة صاحب الموقع'])])[0]?.stateRefused, undefined);
  assert.equal(stateTrailer(12), 'State-Decision: #12');
  assert.match(readFileSync(new URL('../scripts/owner/apply-change.mts', import.meta.url), 'utf8'), /stateTrailer\(req\.request\)/);
});

test('the constitution keeps the owner on top and his data out of reach', () => {
  const text = STATE_CONSTITUTION.map((r) => r.textAr).join('\n');
  assert.match(text, /خاضعة لأوامر صاحب الموقع/);
  assert.match(text, /مابتشوفش بيانات صاحب الموقع/);
  assert.match(text, /لا مركزية/);
  assert.ok(STATE_MEMBERS.filter((m) => m.veto).map((m) => m.id).sort().join() === 'legal,privacy');
});

test('the State\'s report is read defensively', () => {
  const r = readStateReport({ active: true, decisions: [{ number: 1, title: 't', outcome: 'merged' }, { bad: 1 }], supervision: { health: 90, problems: ['x', 3] } });
  assert.equal(r.decisions.length, 1);
  assert.deepEqual(r.supervision, { health: 90, problems: ['x'] });
  assert.deepEqual(readStateReport(null).decisions, []);
});
