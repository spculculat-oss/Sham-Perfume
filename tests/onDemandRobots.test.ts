import assert from 'node:assert/strict';
import test from 'node:test';
import { hasSchedule, onDemandWorkflows } from '../scripts/shaheen-council/runs';
import { ON_DEMAND_AR, runPrecheck } from '../scripts/shaheen-council/precheck';

const NOW = Date.parse('2026-11-13T12:00:00Z');
const old = new Date(NOW - 190 * 3_600_000).toISOString();

test('on-demand robots: a timer is a real schedule trigger, not a comment that mentions one', () => {
  assert.equal(hasSchedule('on:\n  schedule:\n    - cron: "0 6 * * *"\n  workflow_dispatch:\n'), true);
  assert.equal(hasSchedule('on:\n  # Paused: robots no longer run on a schedule here.\n  workflow_dispatch:\n'), false);
  assert.equal(hasSchedule('on:\n  # schedule:\n  #   - cron: "0 6 * * *"\n  workflow_dispatch:\n'), false);
  const od = onDemandWorkflows();
  assert.equal(od.has('live-smoke.yml'), false, 'the daily live check keeps its timer');
  assert.equal(od.has('platform-state.yml'), true);
  assert.equal(od.has('shaheen-catalog-review.yml'), true);
});

test('on-demand robots: an old report is not «very late» when the robot only runs on request (#532, #533)', () => {
  const reports = { 'platform-state.json': { updatedAt: old }, 'catalog-review.json': { updatedAt: old } };
  const before = runPrecheck(reports, {}, NOW);
  for (const id of ['state', 'catalog_review']) assert.ok(before.bots.find((b) => b.id === id)!.problems.some((p) => p.includes('متأخر جداً')), id);
  const after = runPrecheck(reports, {}, NOW, undefined, new Set(['platform-state.yml', 'shaheen-catalog-review.yml']));
  for (const id of ['state', 'catalog_review']) {
    const bot = after.bots.find((b) => b.id === id)!;
    assert.equal(bot.status, 'ok', id);
    assert.deepEqual(bot.problems, [], id);
    assert.ok(bot.ideas.includes(ON_DEMAND_AR), id);
  }
  // A failed last run is still a breakdown, on demand or not.
  const failed = runPrecheck(reports, { 'platform-state.yml': { conclusion: 'failure', status: 'completed', at: old } }, NOW, undefined, new Set(['platform-state.yml']));
  assert.equal(failed.bots.find((b) => b.id === 'state')!.status, 'fail');
});
