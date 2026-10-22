/**
 * «الهيكل والتراتبية»: the owner on top, then «دولة المنصة», Shaheen and his agent, the departments and the school, then
 * every robot and every expert — each exactly once, each reporting up to the owner through the State, all on the screen.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { BOTS, DEPARTMENTS } from '../src/utils/shaheenOrg';
import { SCHOOL_EXPERTS } from '../src/utils/shaheenAgent';
import { EDGES, HIERARCHY, ROOM, SEAT_BOTS, TIERS, chainOf, edgePathRoom, nodeOf } from '../src/utils/opsHierarchy';

test('every robot sits once under its department, every expert once under the school', () => {
  assert.deepEqual(nodeOf('owner')?.bots, ['owner_desk'], 'the owner\'s desk is the owner\'s seat');
  assert.deepEqual(nodeOf('state')?.bots, ['state'], 'the State\'s robot is the State\'s seat, under no one but the owner');
  for (const b of BOTS) {
    if (SEAT_BOTS.includes(b.id)) { assert.equal(HIERARCHY.filter((n) => n.kind === 'bot' && n.bots[0] === b.id).length, 0); continue; }
    const nodes = HIERARCHY.filter((n) => n.kind === 'bot' && n.bots[0] === b.id);
    assert.equal(nodes.length, 1, b.id);
    assert.equal(nodes[0]!.parent, `dept:${b.dept}`);
  }
  for (const e of SCHOOL_EXPERTS) assert.equal(HIERARCHY.filter((n) => n.id === `expert:${e.field}` && n.parent === 'school').length, 1, e.field);
  assert.equal(HIERARCHY.filter((n) => n.kind === 'expert').length, 18);
  for (const d of DEPARTMENTS) assert.equal(nodeOf(`dept:${d.id}`)?.parent, 'shaheen');
  assert.equal(new Set(HIERARCHY.map((n) => n.id)).size, HIERARCHY.length, 'unique ids');
});

test('the chain of command: everyone reports up through the State to the owner, who reports to no one', () => {
  assert.equal(nodeOf('owner')?.parent, undefined);
  for (const n of HIERARCHY) {
    const chain = chainOf(n.id).map((x) => x.id);
    assert.equal(chain.at(-1), 'owner', n.id);
    if (n.id !== 'owner') assert.ok(chain.includes('state'), `${n.id} answers to the State`);
  }
  assert.deepEqual(chainOf('expert:chemistry').map((x) => x.id), ['expert:chemistry', 'school', 'agent', 'state', 'owner']);
  assert.deepEqual(chainOf('bot:academy').map((x) => x.id), ['bot:academy', 'dept:reliability', 'shaheen', 'state', 'owner']);
  for (const e of EDGES) assert.ok(edgePathRoom(e.from, e.to).startsWith('M '), `${e.from} → ${e.to}`);
});

test('the screen: every node inside the canvas, the tiers top to bottom, no two nodes on one spot', () => {
  for (const n of HIERARCHY) assert.ok(n.x >= 40 && n.x <= ROOM.width - 40 && n.y >= 20 && n.y <= ROOM.height - 40, `${n.id} at ${n.x},${n.y}`);
  const y = Object.fromEntries(TIERS.map((t) => [t.id, t.y]));
  assert.ok(y.owner < y.state && y.state < y.lead && y.lead < y.branch && y.branch < y.unit);
  for (const n of HIERARCHY) if (n.parent) assert.ok(nodeOf(n.parent)!.y < n.y, `${n.id} sits below ${n.parent}`);
  const spots = new Set(HIERARCHY.map((n) => `${n.x},${n.y}`));
  assert.equal(spots.size, HIERARCHY.length);
  const knowledge = HIERARCHY.filter((n) => n.kind === 'expert').map((n) => n.x);
  const operations = HIERARCHY.filter((n) => n.kind === 'bot').map((n) => n.x);
  assert.ok(Math.max(...knowledge) + 60 < Math.min(...operations), 'the two branches never overlap');
});
