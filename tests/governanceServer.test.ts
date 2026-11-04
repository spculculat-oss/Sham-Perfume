import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { connectPglite } from '../server/community/db';
import { PostgresStore } from '../server/core/pgStore';
import { MemoryStore } from '../server/core/store';
import { GovernanceService } from '../server/governance/service';
import { createShamCore } from '../server/core/http';

const task = { title: 'مهمة داخلية سرية للاختبار', institution: 'technology', responsible: 'مسؤول الاختبار', due: '2026-12-01', acceptance: 'قائمة مراجعة', resources: 'إذن قراءة' };
const env = { SHAM_ADMIN_TOKEN: 'test-admin-token-only', SHAM_GOVERNANCE_OWNER_TOKEN: 'test-owner-token-independent-12345', SHAM_STORE: 'memory' };

test('governance refuses temporary storage and rejects malformed commands', async () => {
  const service = new GovernanceService(new MemoryStore());
  await assert.rejects(service.read(), (e: any) => e.status === 503);
  await assert.rejects(service.command({ revision: 0, action: 'create', task }), (e: any) => e.status === 503);
});

test('Postgres governance survives service recreation, uses atomic revisions, and trusts no client identity', async () => {
  const sql = await connectPglite();
  try {
    const store = new PostgresStore(async () => sql);
    const a = new GovernanceService(store);
    const b = new GovernanceService(new PostgresStore(async () => sql));
    const results = await Promise.allSettled([a.command({ revision: 0, action: 'create', task }), b.command({ revision: 0, action: 'create', task })]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    assert.equal(rejected.reason.status, 409);
    const saved = await b.read();
    assert.equal(saved.revision, 1);
    assert.equal(saved.plan.tasks.length, 1);
    await assert.rejects(a.command({ revision: 0, action: 'create', task }), (e: any) => e.status === 409);
    await assert.rejects(a.command({ revision: 1, action: 'delete' }), (e: any) => e.status === 400);
    await assert.rejects(a.command({ revision: 1, action: 'create', task: { ...task, responsible: '' } }), (e: any) => e.status === 400);
    const second = await a.command({ revision: 1, action: 'create', task: { ...task, id: 'forged', status: 'done', evidence: 'forged', actor: 'worker' } });
    assert.notEqual(second.plan.tasks[1].id, 'forged');
    assert.equal(second.plan.tasks[1].status, 'draft');
    assert.equal(second.plan.tasks[1].evidence, '');
    assert.equal(second.actor, 'owner');
    assert.equal((await store.get('governanceRevisions', '1'))!.plan.tasks.length, 1, 'old revision remains unchanged');
    assert.equal((await new GovernanceService(new PostgresStore(async () => sql)).read()).revision, 2);
  } finally { await sql.close(); }
});

test('HTTP: visitors and ordinary admins cannot read/write governance; no leak in admin export', async () => {
  const sql = await connectPglite();
  const store = new PostgresStore(async () => sql);
  const core = createShamCore({ env, store });
  const app = express(); app.use(express.json()); app.use('/api/admin', core.admin); app.use('/api/assistant', core.assistant);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const auth = { Authorization: `Bearer ${env.SHAM_ADMIN_TOKEN}`, 'Content-Type': 'application/json' };
  const owner = { ...auth, 'X-Sham-Owner': env.SHAM_GOVERNANCE_OWNER_TOKEN };
  try {
    assert.equal((await fetch(`${base}/admin/governance`)).status, 401);
    assert.equal((await fetch(`${base}/admin/governance`, { headers: auth })).status, 403);
    assert.equal((await fetch(`${base}/admin/governance/commands`, { method: 'POST', headers: auth, body: JSON.stringify({ revision: 0, action: 'create', task }) })).status, 403);
    const response = await fetch(`${base}/admin/governance/commands`, { method: 'POST', headers: owner, body: JSON.stringify({ revision: 0, action: 'create', task }) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const saved = await response.json(); assert.equal(saved.revision, 1);
    const read = await fetch(`${base}/admin/governance`, { headers: owner });
    assert.equal((await read.json()).plan.tasks[0].title, task.title);
    for (const path of ['/admin/export', '/admin/overview', '/assistant/config']) {
      const r = await fetch(`${base}${path}`, { headers: auth });
      assert.equal(r.status, 200); assert.ok(!(await r.text()).includes(task.title), path);
    }
    assert.equal((await fetch(`${base}/admin/governance/1`, { method: 'DELETE', headers: owner })).status, 404);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); await sql.close(); }
});

test('HTTP fails closed without independent owner configuration', async () => {
  const core = createShamCore({ env: { ...env, SHAM_GOVERNANCE_OWNER_TOKEN: env.SHAM_ADMIN_TOKEN }, store: new MemoryStore() });
  const app = express(); app.use('/api/admin', core.admin);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>((r) => server.once('listening', r));
  try {
    const r = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin/governance`, { headers: { Authorization: `Bearer ${env.SHAM_ADMIN_TOKEN}`, 'X-Sham-Owner': env.SHAM_ADMIN_TOKEN } });
    assert.equal(r.status, 503);
  } finally { await new Promise<void>((r) => server.close(() => r())); }
});
