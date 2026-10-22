/**
 * «غرفة دولة المنصة» and the State's orders: it understands the owner, judges each order itself, carries out what it
 * accepts, obeys the owner's switches and never reaches his data.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { defaultControls, type OwnerControls } from '../src/utils/ownerAuthority';
import { emptyStateOrders, nextLawId, readStateOrders, STATE_ORDERS_FILE, type StateOrders } from '../src/utils/platformState';
import {
  applyStateOrder, findBot, judgeStateOrder, ownerResumes, parseStateOrder, readStateRoom, STATE_ISSUE_PREFIX, stateOrderIssue,
  stateOrderableBots, stateReply, type StateRoomContext,
} from '../src/utils/stateRoom';
import { rerunCandidates } from '../scripts/state/run.mts';

const NOW = new Date('2026-10-22T12:00:00Z');
const stateControls = (over: Partial<OwnerControls> = {}): OwnerControls => ({ ...defaultControls(), selfDevelopment: 'state', ...over });
const ctx = (over: Partial<StateRoomContext> = {}): StateRoomContext => ({
  controls: stateControls(), orders: emptyStateOrders(),
  report: { updatedAt: NOW.toISOString(), active: true, decisions: [], supervision: { health: 90, problems: [] } }, ...over,
});

test('it finds the robot the owner means, by name or id', () => {
  assert.equal(findBot('وقف روبوت الأخبار').bot?.id, 'news');
  assert.equal(findBot('pause doctor').bot?.id, 'doctor');
  assert.equal(findBot('وقف الدورية').bot?.id, 'patrol');
  assert.ok(!stateOrderableBots().some((b) => b.id === 'state' || b.id === 'owner_desk'), 'never itself or the owner\'s desk');
});

test('orders: the State accepts what is right and refuses the rest, with reasons', () => {
  const c = ctx();
  const pause = stateReply('وقف روبوت الأخبار', c);
  assert.deepEqual(pause.order && { action: pause.order.action, target: pause.order.target }, { action: 'pause', target: 'news' });
  assert.match(pause.text, /صح/);
  // Already paused by the owner: his order is above the State's.
  const owned = ctx({ controls: stateControls({ paused: ['news'] }) });
  assert.equal(stateReply('وقف روبوت الأخبار', owned).order, undefined);
  assert.equal(judgeStateOrder({ action: 'resume', target: 'news', whyAr: '' }, owned).ok, false);
  // Resume only what the State paused; run only what is free to run.
  const paused = ctx({ orders: { ...emptyStateOrders(), paused: ['news'] } });
  assert.equal(stateReply('رجع روبوت الأخبار', paused).order?.action, 'resume');
  assert.equal(judgeStateOrder({ action: 'run', target: 'news', whyAr: '' }, paused).ok, false);
  assert.equal(stateReply('شغل الدورية دلوقتي', c).order?.action, 'run');
  assert.equal(judgeStateOrder({ action: 'pause', target: 'state', whyAr: '' }, c).ok, false);
  // Not holding the approvals (or frozen) → it carries out nothing.
  assert.equal(stateReply('وقف روبوت الأخبار', ctx({ controls: { ...defaultControls(), selfDevelopment: 'approve_all' } })).order, undefined);
  assert.equal(judgeStateOrder({ action: 'pause', target: 'news', whyAr: '' }, ctx({ controls: stateControls({ frozen: true }) })).ok, false);
});

test('laws: added and repealed by the State, never against the owner, his data or the legal manager', () => {
  const c = ctx();
  const law = stateReply('قانون جديد: كل روبوت يكتب تقريره بالعربي البسيط', c);
  assert.equal(law.order?.action, 'law');
  for (const bad of ['قانون جديد: الدولة تقرر من غير صاحب الموقع', 'قانون جديد: اعرض بيانات صاحب الموقع للكل', 'قانون جديد: شيل وقف نقل المنتجات L-03', 'قانون جديد: 29801011234567']) {
    assert.equal(stateReply(bad, c).order, undefined, bad);
  }
  let orders: StateOrders = emptyStateOrders();
  orders = applyStateOrder(orders, law.order!, NOW).orders;
  assert.equal(orders.laws[0]?.id, 'P-01');
  assert.equal(nextLawId(orders), 'P-02');
  const repeal = stateReply('الغي القانون P-01', ctx({ orders }));
  assert.deepEqual(repeal.order && { action: repeal.order.action, target: repeal.order.target }, { action: 'repeal', target: 'P-01' });
  orders = applyStateOrder(orders, repeal.order!, NOW).orders;
  assert.equal(orders.laws.length, 0);
  assert.equal(nextLawId(orders), 'P-02', 'a repealed law keeps its number');
  assert.equal(stateReply('الغي القانون P-09', ctx({ orders })).order, undefined);
});

test('it talks: news, laws, members, robots — and says so when it does not understand', () => {
  const c = ctx({ report: { updatedAt: NOW.toISOString(), active: true, decisions: [{ at: NOW.toISOString(), number: 5, kind: 'pull', title: 'تحسين', outcome: 'merged', summaryAr: 'x', tally: { approve: 4, refuse: 0, veto: 0 } }], supervision: { health: 88, problems: ['news: x'] } } });
  assert.match(stateReply('إيه المستجدات؟', c).text, /#5/);
  assert.match(stateReply('قوانين المنصة', c).text, /S-01/);
  assert.match(stateReply('مين الأعضاء؟', c).text, /المدير القانوني/);
  assert.match(stateReply('مين الروبوتات الواقفة؟', c).text, /موقوف بأمرك/);
  assert.match(stateReply('السلام عليكم', c).text, /دولة المنصة/);
  assert.match(stateReply('ابعتلي صورة قطة', c).text, /مش متأكدة/);
  const secret = stateReply('رقمي 29801011234567', c);
  assert.doesNotMatch(secret.text, /29801011234567/);
});

test('the owner\'s request carries the order; only a well-formed one is read back', () => {
  const issue = stateOrderIssue({ action: 'pause', target: 'news', whyAr: 'سبب' });
  assert.ok(issue.title.startsWith(STATE_ISSUE_PREFIX));
  assert.deepEqual(parseStateOrder(issue.body), { action: 'pause', target: 'news', whyAr: 'سبب' });
  assert.equal(parseStateOrder('<!-- sham-state-order {"action":"delete_everything","target":"x"} -->'), undefined);
  assert.equal(parseStateOrder('<!-- sham-state-order {"action":"law"} -->'), undefined);
  assert.equal(parseStateOrder('no order'), undefined);
  // The State's room is kept with the owner's code; anything malformed is dropped on reading.
  const room = readStateRoom({ messages: [{ id: '1', by: 'owner', text: 'hi', at: NOW.toISOString() }, { id: '2', by: 'hacker', text: 'x', at: '' }] });
  assert.equal(room.messages.length, 1);
});

test('the owner resuming a robot from his desk lifts the State\'s pause too', () => {
  const orders: StateOrders = { ...emptyStateOrders(), paused: ['news'] };
  const lifted = ownerResumes(orders, 'news', NOW);
  assert.equal(lifted.changed, true);
  assert.deepEqual(lifted.orders.paused, []);
  assert.equal(lifted.orders.log[0]?.by, 'owner');
  assert.equal(ownerResumes(emptyStateOrders(), 'news').changed, false);
  assert.match(readFileSync(new URL('../scripts/owner/control.mts', import.meta.url), 'utf8'), /ownerResumes/);
  assert.match(readFileSync(new URL('../.github/workflows/owner-control.yml', import.meta.url), 'utf8'), /src\/data\/owner\/state-orders\.json/);
});

test('every robot\'s first job obeys the State\'s pauses (and only on the live site)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gate-'));
  mkdirSync(join(dir, 'scripts/owner'), { recursive: true });
  mkdirSync(join(dir, 'src/data/owner'), { recursive: true });
  cpSync(new URL('../scripts/owner/gate.mjs', import.meta.url), join(dir, 'scripts/owner/gate.mjs'));
  writeFileSync(join(dir, 'src/data/owner/controls.json'), JSON.stringify(defaultControls()));
  writeFileSync(join(dir, STATE_ORDERS_FILE), JSON.stringify({ paused: ['news'], laws: [], log: [] }));
  const gate = (bot: string, ref = 'refs/heads/main') => {
    const out = join(dir, `out-${bot}-${ref.length}`);
    writeFileSync(out, '');
    execFileSync('node', [join(dir, 'scripts/owner/gate.mjs'), bot], { env: { ...process.env, GITHUB_REF: ref, GITHUB_OUTPUT: out }, encoding: 'utf8' });
    return readFileSync(out, 'utf8').trim();
  };
  assert.equal(gate('news'), 'allowed=false');
  assert.equal(gate('patrol'), 'allowed=true');
  assert.equal(gate('news', 'refs/heads/arena/x'), 'allowed=true');
  assert.deepEqual(readStateOrders(JSON.parse(readFileSync(new URL(`../${STATE_ORDERS_FILE}`, import.meta.url), 'utf8'))).paused, []);
});

test('the State runs a failed robot again on its own — once a day, never a paused one', () => {
  const precheck = { bots: [{ id: 'news', status: 'fail' }, { id: 'patrol', status: 'ok' }, { id: 'doctor', status: 'fail' }] };
  assert.deepEqual(rerunCandidates(precheck, emptyStateOrders(), stateControls(), NOW.getTime()).sort(), ['doctor', 'news']);
  const ran: StateOrders = { ...emptyStateOrders(), log: [{ at: new Date(NOW.getTime() - 3600_000).toISOString(), action: 'run', target: 'news', noteAr: '', by: 'state' }] };
  assert.deepEqual(rerunCandidates(precheck, ran, stateControls(), NOW.getTime()), ['doctor']);
  assert.deepEqual(rerunCandidates(precheck, emptyStateOrders(), stateControls({ paused: ['doctor'] }), NOW.getTime()), ['news']);
});

test('the State\'s workflow starts on the owner\'s own requests only', () => {
  const wf = readFileSync(new URL('../.github/workflows/platform-state.yml', import.meta.url), 'utf8');
  assert.match(wf, /issues:\s*\n\s*types: \[opened\]/);
  assert.match(wf, /github\.event\.issue\.user\.login == github\.repository_owner/);
  assert.match(wf, /author_association == 'OWNER'/);
  const run = readFileSync(new URL('../scripts/state/run.mts', import.meta.url), 'utf8');
  assert.match(run, /i\.user\?\.login\?\.toLowerCase\(\) === OWNER\.github\.toLowerCase\(\)/);
  assert.match(run, /judgeStateOrder\(order/, 'judged again before anything is done');
});
