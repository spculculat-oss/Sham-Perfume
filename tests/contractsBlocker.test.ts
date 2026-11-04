import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchApprovedDomains } from '../scripts/shaheen-import/guard';
import { contractsChecks, runPrecheck } from '../scripts/shaheen-council/precheck';

const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;

test('importer: the contracts service’s reason is kept (no database ≠ wrong key)', async () => {
  const noDb = await fetchApprovedDomains('https://api.example', 'admin-token-123456', reply(503, { error: 'The database is not configured on this server yet', code: 'CONTRACTS_NOT_CONFIGURED' }));
  assert.deepEqual(noDb, { domains: [], error: 'HTTP 503 CONTRACTS_NOT_CONFIGURED' });
  const badKey = await fetchApprovedDomains('https://api.example', 'admin-token-123456', reply(401, { code: 'UNAUTHORIZED' }));
  assert.equal(badKey.error, 'HTTP 401 UNAUTHORIZED');
  const html = await fetchApprovedDomains('https://api.example', 'admin-token-123456', (async () => new Response('<html>down</html>', { status: 502 })) as unknown as typeof fetch);
  assert.equal(html.error, 'HTTP 502');
  const ok = await fetchApprovedDomains('https://api.example', 'admin-token-123456', reply(200, { stores: [{ domain: 'rose.example' }] }));
  assert.deepEqual(ok, { domains: ['rose.example'] });
});

test('contracts officer: a server with no database is a real stop, not «سليم»', () => {
  for (const error of ['HTTP 503 CONTRACTS_NOT_CONFIGURED', 'HTTP 503']) {
    const [x] = contractsChecks({ approved: 0, permitted: [], error });
    assert.equal(x?.level, 'fail');
    assert.match(x!.problem!, /قاعدة بيانات/);
    assert.match(x!.fix!, /Neon/);
  }
  assert.equal(contractsChecks({ approved: 0, error: 'HTTP 401 UNAUTHORIZED' })[0]?.level, 'fail');
  assert.equal(contractsChecks({ approved: 0, permitted: [] })[0]?.level, 'note', 'working, no store signed yet: L-03 still holds');
  assert.match(contractsChecks({ approved: 2, permitted: ['a', 'b'] })[0]!.idea!, /2 متجر/);
  assert.deepEqual(contractsChecks(undefined), []);

  const NOW = Date.parse('2026-11-04T03:00:00Z');
  const report = { updatedAt: '2026-11-04T02:00:00Z', summary: { total: 10 }, import: { contracts: { approved: 0, permitted: [], error: 'HTTP 503 CONTRACTS_NOT_CONFIGURED' }, blocked: 'L-03' } };
  const check = runPrecheck({ 'store-review.json': report }, {}, NOW).bots.find((b) => b.id === 'contracts')!;
  assert.equal(check.status, 'fail');
  assert.ok(check.problems.some((p) => /نظام التعاقدات واقف/.test(p)));
  const importer = runPrecheck({ 'store-review.json': report }, {}, NOW).bots.find((b) => b.id === 'importer')!;
  assert.notEqual(importer.status, 'fail', 'the importer itself is fine — it is waiting for the contracts');
});
