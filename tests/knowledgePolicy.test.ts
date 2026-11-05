import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ANALYSIS_TEMPLATE, EVIDENCE_CLASSES, KNOWLEDGE_POLICY_VERSION, KNOWLEDGE_RULE, STUDY_BOUNDARIES, STUDY_EXAMPLES } from '../src/utils/knowledgePolicy';

test('knowledge policy distinguishes evidence, hypotheses, belief, heritage and unsupported/refuted claims', () => {
  assert.equal(KNOWLEDGE_POLICY_VERSION, '2026-11-04');
  assert.deepEqual(EVIDENCE_CLASSES.map((c) => c.id), ['supported', 'hypothesis', 'belief', 'heritage', 'unverified', 'refuted']);
  assert.ok(KNOWLEDGE_RULE.includes('مجرد الدراسة لا يعني التبنّي'));
  for (const item of EVIDENCE_CLASSES) assert.ok(item.title && item.description);
});
test('analysis covers sources, uncertainty, context and impact without treating a topic as permission to execute', () => {
  assert.equal(new Set(ANALYSIS_TEMPLATE.map((x) => x.id)).size, ANALYSIS_TEMPLATE.length);
  for (const id of ['question', 'context', 'sources', 'evidence', 'limits', 'impact', 'outcome']) {
    assert.ok(ANALYSIS_TEMPLATE.some((x) => x.id === id));
  }
  assert.ok(STUDY_BOUNDARIES.some((x) => x.includes('لا تعليمات عملية تسهّل الإيذاء')));
  assert.ok(STUDY_BOUNDARIES.some((x) => x.includes('لا تُنشر تلقائياً')));
  assert.ok(STUDY_EXAMPLES.length > 0);
});
test('knowledge view is within the existing owner gate; policy data performs no collection or execution', () => {
  const panel = readFileSync(new URL('../src/admin/GovernancePanel.tsx', import.meta.url), 'utf8');
  assert.ok(panel.includes("['knowledge', 'حرية المعرفة والتحليل']"));
  assert.ok(panel.indexOf('if (!connected) return') < panel.indexOf("tab === 'knowledge'"));
  const policy = readFileSync(new URL('../src/utils/knowledgePolicy.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(policy, /fetch\(|adminRequest\(|callEngine\(|localStorage|sessionStorage/);
});
