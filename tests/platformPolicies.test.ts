import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { OPERATING_RULES, POLICY_VERSION, RESPONSE_TARGETS, RISK_LANES } from '../src/utils/platformPolicies';
import { readControls } from '../src/utils/ownerAuthority';
import controls from '../src/data/owner/controls.json';

test('proposed productivity rules have distinct identifiers and measurable outcomes', () => {
  assert.equal(POLICY_VERSION, 'draft-2026-10-22');
  assert.equal(OPERATING_RULES.length, 16);
  assert.equal(new Set(OPERATING_RULES.map((r) => r.id)).size, OPERATING_RULES.length);
  for (const rule of OPERATING_RULES) {
    assert.ok(rule.title.length && rule.rule.length && rule.measure.length);
  }
});
test('risk-based speed never implies silent approval or overrides the owner', () => {
  assert.deepEqual(RISK_LANES.map((r) => r.id), ['green', 'amber', 'red']);
  assert.ok(RISK_LANES[0].condition.includes('كل تغيير بموافقتي'));
  assert.ok(RISK_LANES[2].condition.includes('لا موافقة بالسكوت'));
  assert.ok(OPERATING_RULES.find((r) => r.id === 'P05')!.rule.includes('لا يسمح بالتنفيذ'));
  assert.ok(RESPONSE_TARGETS.every((t) => t.kind && t.target));
  assert.equal(readControls(controls).selfDevelopment, 'approve_all');
});
test('policy tab is behind the server-backed owner gate and has no execution side effects', () => {
  const panel = readFileSync(new URL('../src/admin/GovernancePanel.tsx', import.meta.url), 'utf8');
  assert.ok(panel.indexOf('if (!connected) return') < panel.indexOf("tab === 'policies'"));
  const policies = readFileSync(new URL('../src/utils/platformPolicies.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(policies, /fetch\(|adminRequest\(|callEngine\(|localStorage/);
});
