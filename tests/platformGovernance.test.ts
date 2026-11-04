import assert from 'node:assert/strict';
import test from 'node:test';
import { CHARTER, INSTITUTIONS, addTask, emptyPlan, existingDepartments, overdue, transitionTask, validateTask, type GovernanceTask } from '../src/utils/platformGovernance';

const at = '2026-10-22T10:00:00Z';
const task = (): GovernanceTask => ({ id: 'test-1', title: 'توثيق الصلاحيات', institution: 'technology', responsible: 'مسؤول التقنية', due: '2026-10-25', acceptance: 'قائمة مراجعة معتمدة', resources: 'قراءة سجل الصلاحيات', status: 'draft', evidence: '' });

test('new plans have no fabricated work and preserve existing structure', () => {
  assert.deepEqual(emptyPlan(), { version: 1, tasks: [], events: [] });
  assert.equal(new Set(INSTITUTIONS.map((i) => i.id)).size, INSTITUTIONS.length);
  assert.ok(existingDepartments('technology').some((d) => d.id === 'reliability'));
  assert.ok(CHARTER.some((s) => s.includes('حق الاستئناف')));
});
test('task creation is validated, immutable and logged', () => {
  const initial = emptyPlan();
  const plan = addTask(initial, task(), at);
  assert.equal(initial.tasks.length, 0);
  assert.equal(plan.tasks.length, 1);
  assert.equal(plan.events[0].taskId, 'test-1');
  assert.throws(() => addTask(plan, task(), at));
  for (const key of ['title', 'responsible', 'acceptance', 'resources'] as const) assert.throws(() => validateTask({ ...task(), [key]: ' ' }));
  assert.throws(() => validateTask({ ...task(), due: '2026-02-30' }));
  assert.throws(() => validateTask({ ...task(), institution: 'unknown' as never }));
});
test('state machine requires review and evidence before completion', () => {
  let plan = addTask(emptyPlan(), task(), at);
  assert.throws(() => transitionTask(plan, 'test-1', 'done', 'evidence', at));
  assert.throws(() => transitionTask(plan, 'missing', 'assigned', '', at));
  plan = transitionTask(plan, 'test-1', 'assigned', '', at);
  assert.throws(() => transitionTask(plan, 'test-1', 'blocked', ' ', at));
  plan = transitionTask(plan, 'test-1', 'blocked', 'نحتاج إذن قراءة؛ مطلوب اعتماد المالك', at);
  plan = transitionTask(plan, 'test-1', 'active', '', at);
  plan = transitionTask(plan, 'test-1', 'review', '', at);
  assert.throws(() => transitionTask(plan, 'test-1', 'done', '', at));
  plan = transitionTask(plan, 'test-1', 'done', 'تمت مراجعة القائمة', at);
  assert.equal(plan.tasks[0].status, 'done');
  assert.equal(plan.events.length, 6);
  assert.equal(overdue(plan.tasks[0], '2026-10-26'), false);
});
test('overdue is a follow-up signal, not an enforcement mutation', () => {
  const t = task();
  assert.equal(overdue(t, '2026-10-25'), false);
  assert.equal(overdue(t, '2026-10-26'), true);
  assert.equal(t.status, 'draft');
});
