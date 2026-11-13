import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { MemoryStore, FileStore } from '../server/core/store';
import { FirestoreStore } from '../server/core/firestoreStore';
import { createShamCore } from '../server/core/http';
import { FinanceService } from '../server/finance/service';
import { financePeriod, localDate } from '../server/finance/periods';
import { financeId, makeReport } from '../server/finance/report';
import { availableMethods, emptyRegistration, paymentReadiness, readRegistration } from '../server/finance/payments';
import { PAYMENT_CATALOG, PAYMENT_COUNTRIES, PAYMENT_SOURCES, countryResearch } from '../src/finance/paymentCatalog';
import { toMinor, sumMinor } from '../src/finance/money';
import { verifyWebhook, webhookSignature, safeKashierSessionUrl } from '../server/core/kashier';
import type { FinanceEntry } from '../server/finance/types';
class Durable extends MemoryStore { override readonly persistent = true; }
const NOW = Date.parse('2026-10-18T12:00:00Z');
const ENV = { KASHIER_MERCHANT_ID: 'MID-123-456', KASHIER_API_KEY: 'api-for-test', KASHIER_SECRET_KEY: 'secret-for-test', KASHIER_MODE: 'live', SHAM_PUBLIC_API_URL: 'https://api.example.com' };
const service = (store = new Durable()) => new FinanceService(store, ENV, { now: () => NOW, fetch: (async () => { throw new Error('no network'); }) as typeof fetch });
const paid = { order: 'SP-TEST', amount: 100, currency: 'EGP', state: 'paid' as const, status: 'PAID' };
async function seed(f: FinanceService, mode: 'live' | 'test' = 'live') {
  await f.recordOrder({ ref: paid.order, mode, provider: 'kashier', country: 'EG', currency: 'EGP', totalMinor: 10000, shippingChargedMinor: 1000, lines: [{ sku: 'TEST', qty: 1, unitMinor: 9000 }] });
  await f.recordSession(paid.order, mode, 'sess_123456');
}
const entry = (kind: string, amount: string, extra = {}) => ({ idempotencyKey: randomUUID(), kind, amount, currency: 'EGP', orderRef: paid.order, at: '2026-10-18T10:00:00.000Z', reason: 'فاتورة محاسبية', ...extra });

test('finance money: exact minor units, currency precision, negatives and overflow', () => {
  assert.equal(toMinor('0.10', 'EGP'), 10); assert.equal(toMinor('1.234', 'KWD'), 1234); assert.equal(toMinor('123', 'JPY'), 123);
  for (const v of ['NaN', '', '-1', '1e3', 'Infinity', '1.001']) assert.throws(() => toMinor(v, 'EGP'));
  assert.throws(() => toMinor('1.5', 'JPY')); assert.throws(() => toMinor('12', 'ZZZ')); assert.throws(() => sumMinor([Number.MAX_SAFE_INTEGER, 1]));
  assert.equal(sumMinor([toMinor(.1, 'EGP'), toMinor(.2, 'EGP')]), 30);
});
test('finance periods use Cairo dates, Monday weeks, leap months and actual DST midnights', () => {
  const day = financePeriod('daily', Date.parse('2026-10-18T21:15:00Z'));
  assert.equal(day.localFrom, '2026-10-19'); assert.equal(day.from, '2026-10-18T21:00:00.000Z');
  const week = financePeriod('weekly', NOW); assert.equal(week.localFrom, '2026-10-12'); assert.equal(week.localTo, '2026-10-19');
  const feb = financePeriod('monthly', Date.parse('2028-03-01T10:00:00Z'), 'Africa/Cairo', -1);
  assert.equal(feb.localFrom, '2028-02-01'); assert.equal(feb.localTo, '2028-03-01'); assert.equal(feb.closed, true);
  for (const [at, hours] of [['2026-04-24T12:00:00Z', 23], ['2026-10-29T12:00:00Z', 25]] as const) {
    const p = financePeriod('daily', Date.parse(at)); assert.equal((Date.parse(p.to) - Date.parse(p.from)) / 3600000, hours);
    assert.equal(localDate(Date.parse(p.from), p.timeZone), p.localFrom);
    assert.notEqual(localDate(Date.parse(p.from) - 1, p.timeZone), p.localFrom);
  }
  assert.throws(() => financePeriod('yearly' as never)); assert.throws(() => financePeriod('daily', NOW, 'Mars/Base'));
});
test('finance: simultaneous return/webhook deliveries book a sale once, including across service instances', async () => {
  const store = new Durable(); const a = service(store); const b = service(store); await seed(a);
  const result = await Promise.all(Array.from({ length: 25 }, (_, i) => (i % 2 ? a : b).confirmPayment(paid, 'live', 'sess_123456')));
  assert.equal(result.filter(Boolean).length, 1); assert.equal((await store.list('financeEntries')).length, 1);
  const report = await a.report(a.period()); assert.equal(report.currencies[0].collectedMinor, 10000); assert.equal(report.currencies[0].netProfitMinor, null);
});
test('finance: unknown, mismatched, wrong-session and non-durable live receipts never post money', async () => {
  const f = service(); await seed(f);
  for (const payment of [{ ...paid, amount: 1 }, { ...paid, currency: 'USD' }, { ...paid, order: 'SP-UNKNOWN' }]) await assert.rejects(() => f.confirmPayment(payment, 'live', 'sess_123456'));
  await assert.rejects(() => f.confirmPayment(paid, 'live', 'wrong_session'));
  assert.equal((await f.store.list('financeEntries')).length, 0); assert.equal((await f.store.list('financeIssues')).length, 2);
  const temporary = new FinanceService(new MemoryStore(), ENV); await assert.rejects(() => seed(temporary), /دائم/);
});
test('finance: test transactions are isolated and never trigger fulfilment', async () => {
  const f = service(); let fulfilled = 0; f.onPaid = async () => { fulfilled++; }; await seed(f, 'test');
  await f.confirmPayment(paid, 'test', 'sess_123456');
  const report = await f.report(f.period()); assert.equal(report.excludedTestEntries, 1); assert.deepEqual(report.currencies, []); assert.equal(fulfilled, 0);
});
test('finance: actual costs, partial refunds and separate currencies; missing costs/expenses never become profit', async () => {
  const f = service(); await seed(f); await f.confirmPayment(paid, 'live', 'sess_123456');
  for (const [kind, amount] of [['cost', '40'], ['shipping', '10'], ['fee', '3'], ['tax', '0'], ['refund', '5']] as const) await f.addEntry(entry(kind, amount));
  await f.addEntry(entry('expense', '2', { orderRef: '' }));
  await f.addEntry(entry('expense', '7', { orderRef: '', currency: 'USD' }));
  let report = await f.report(f.period());
  assert.equal(report.currencies.find((c) => c.currency === 'EGP')?.recordedResultMinor, 4000);
  assert.equal(report.currencies.find((c) => c.currency === 'USD')?.recordedResultMinor, -700);
  assert.ok(report.currencies.every((c) => c.netProfitMinor === null));
  const nextDay = new FinanceService(f.store, ENV, { now: () => NOW + 86400000 });
  report = await nextDay.report(nextDay.period('daily', -1));
  await nextDay.reviewExpenses('daily', -1, report.fingerprint);
  report = await nextDay.report(nextDay.period('daily', -1));
  assert.equal(report.currencies.find((c) => c.currency === 'EGP')?.netProfitMinor, 4000); assert.equal(report.status, 'reviewed');
  await f.addEntry(entry('fee', '1')); // late posting invalidates the old review
  report = await nextDay.report(nextDay.period('daily', -1)); assert.equal(report.unreviewedExpenses, true);
});
test('finance: manual entries require a paid order, precise values, a reason and idempotency; no manual sale', async () => {
  const f = service(); await seed(f);
  await assert.rejects(() => f.addEntry(entry('cost', '1'))); await f.confirmPayment(paid, 'live', 'sess_123456');
  for (const b of [entry('sale', '10'), entry('fee', '-1'), entry('fee', '1.001'), entry('fee', '1', { currency: 'USD' }), entry('refund', '101'), entry('fee', '1', { at: 'bad' }), entry('fee', '1', { reason: 'sk_live_sensitive' })]) await assert.rejects(() => f.addEntry(b));
  const b = entry('cost', '50'); await f.addEntry(b); await f.addEntry(b);
  assert.equal((await f.store.list('financeEntries')).length, 2);
  await assert.rejects(() => f.addEntry({ ...b, amount: '51' }), /مختلفة/);
});
test('finance: corrections are audit-preserving reversals and never erase sales', async () => {
  const f = service(); await seed(f); await f.confirmPayment(paid, 'live', 'sess_123456');
  const row = await f.addEntry(entry('cost', '20')); await f.reverseEntry(row.id, 'تصحيح فاتورة'); await f.reverseEntry(row.id, 'تصحيح فاتورة');
  assert.equal((await f.store.list('financeEntries')).length, 3);
  assert.equal((await f.report(f.period())).currencies[0].costsMinor, 0);
  assert.ok((await f.report(f.period())).currencies[0].missing[0].kinds.includes('cost'));
  await assert.rejects(() => f.reverseEntry(financeId('sale', 'live', paid.order), 'محو تحصيل'));
});
test('finance: an over-refund blocks reviewed profit instead of being silently accepted as complete', () => {
  const p = financePeriod('daily', NOW); const rows = [
    { id: 'sale', kind: 'sale', amountMinor: 10000 }, { id: 'refund', kind: 'refund', amountMinor: 8000 }, { id: 'dispute', kind: 'chargeback', amountMinor: 8000 },
    ...['cost', 'shipping', 'fee', 'tax'].map((kind) => ({ id: kind, kind, amountMinor: 0 })),
  ].map((e) => ({ ...e, mode: 'live', currency: 'EGP', source: e.kind === 'sale' ? 'gateway' : 'admin', orderRef: 'SP-TEST', at: new Date(NOW).toISOString(), recordedAt: new Date(NOW).toISOString() })) as FinanceEntry[];
  const first = makeReport(p, rows, [], NOW, true);
  const report = makeReport(p, rows, [{ id: 'r', periodId: p.id, fingerprint: first.fingerprint, at: new Date(NOW).toISOString() }], NOW, true);
  assert.equal(report.currencies[0].netProfitMinor, null); assert.deepEqual(report.currencies[0].issues, ['OVER_REFUND']);
});
test('finance: recurring reports are idempotent, include all three periods and never publish secrets', async () => {
  const f = service(); await f.run('schedule'); const before = await f.store.list('financeReports'); await f.run('schedule');
  assert.equal(before.length, 3); assert.equal((await f.store.list('financeReports')).length, 3);
  assert.deepEqual(before.map((r) => r.period.kind), ['daily', 'weekly', 'monthly']);
  const dashboard = await f.dashboard('daily', 0, 'EG');
  for (const secret of [ENV.KASHIER_API_KEY, ENV.KASHIER_SECRET_KEY, ENV.KASHIER_MERCHANT_ID]) assert.ok(!JSON.stringify(dashboard).includes(secret));
  const status = await f.status(); assert.equal(status.engine, 'local-rules'); assert.ok(!('currencies' in status)); assert.ok(!('entries' in status));
  const issue = dashboard.issues[0]; await f.acknowledge(issue.id); assert.equal((await f.store.get('financeIssues', issue.id))?.resolvedAt, undefined);
});
test('finance: failed notification is retried, not labelled delivered', async () => {
  let attempts = 0;
  const f = new FinanceService(new Durable(), { ...ENV, SHAM_WEBHOOK_URL: 'https://hooks.example.com/test' }, { now: () => NOW, fetch: (async () => { attempts++; return new Response('', { status: attempts === 1 ? 503 : 200 }); }) as typeof fetch });
  await f.run(); assert.ok((await f.store.list('financeIssues')).every((i) => !i.notifiedAt));
  await f.run(); assert.equal(attempts, 2); assert.ok((await f.store.list('financeIssues')).every((i) => i.notifiedAt));
});
test('finance: production activation is fail-closed by country, currency, storage and merchant attestation', () => {
  const registration = readRegistration({ ...emptyRegistration(), buyerCountries: ['EG', 'SA'], legalEntityChecked: true, settlementBankChecked: true, liveAccountApproved: true, websiteApproved: true }, NOW);
  assert.equal(paymentReadiness(ENV, registration, true, NOW).liveReady, true);
  assert.deepEqual(availableMethods('EG', 'EGP', ENV, registration, true, NOW).map((m) => m.id), ['card', 'wallet']);
  assert.deepEqual(availableMethods('SA', 'EGP', ENV, registration, true, NOW).map((m) => m.id), ['card']);
  for (const [country, currency, persistent] of [['US', 'EGP', true], ['EG', 'SAR', true], ['EG', 'EGP', false]] as const) assert.deepEqual(availableMethods(country, currency, ENV, registration, persistent, NOW), []);
  assert.deepEqual(availableMethods('EG', 'EGP', ENV, emptyRegistration(), true, NOW), []);
  assert.deepEqual(availableMethods('EG', 'EGP', { ...ENV, SHAM_PUBLIC_API_URL: 'http://bad.example.com' }, registration, true, NOW), []);
  assert.throws(() => readRegistration({ ...registration, methods: ['paypal'] }, NOW));
});
test('payment directory covers country lookup without claiming every local rail or enabling unimplemented integrations', () => {
  assert.ok(PAYMENT_COUNTRIES.length > 200); assert.ok(PAYMENT_CATALOG.length > 40);
  assert.equal(new Set(PAYMENT_CATALOG.map((m) => m.id)).size, PAYMENT_CATALOG.length);
  for (const country of PAYMENT_COUNTRIES) assert.ok(['partial', 'needs_research'].includes(countryResearch(country).coverage));
  assert.equal(countryResearch('AQ').coverage, 'needs_research');
  for (const m of PAYMENT_CATALOG) {
    assert.ok(PAYMENT_SOURCES[m.source].url.startsWith('https://'));
    assert.ok(m.integration === 'not_implemented' || (m.provider === 'kashier' && ['card', 'wallet'].includes(m.id)));
    for (const country of [...(m.customerCountries || []), ...(m.merchantCountries || [])]) assert.ok(PAYMENT_COUNTRIES.includes(country), country);
  }
});
test('payment safety: signatures must cover all financial fields, no duplicate/empty keys or unsafe redirects', () => {
  for (const data of [{ signatureKeys: [] }, { amount: 1, signatureKeys: ['amount'] }, { amount: 1, currency: 'EGP', merchantOrderId: 'SP-1', status: 'PAID', signatureKeys: ['amount', 'currency', 'merchantOrderId', 'status', 'status'] }]) assert.equal(verifyWebhook(data, webhookSignature(data, 'k'), 'k'), false);
  assert.equal(safeKashierSessionUrl('https://payments.kashier.io/session/sess_123456?mode=test'), true);
  for (const url of ['javascript:alert(1)', 'https://payments.kashier.io.evil.example/session/sess_123456', 'https://key@payments.kashier.io/session/sess_123456', 'http://payments.kashier.io/session/sess_123456']) assert.equal(safeKashierSessionUrl(url), false);
});
test('file finance entries survive restart, atomic inserts do not duplicate', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sham-finance-'));
  try { const file = join(dir, 'store.json'); const f = service(new FileStore(file)); await seed(f); await Promise.all([f.confirmPayment(paid, 'live', 'sess_123456'), f.confirmPayment(paid, 'live', 'sess_123456')]);
    const restarted = new FileStore(file); assert.equal((await restarted.list('financeEntries')).length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('Firestore ledger insert uses a server-side nonexistence precondition', async () => {
  let url = ''; const store = new FirestoreStore({ projectId: 'p', clientEmail: 'test', privateKey: 'not-used', prefix: 'test_', fetch: (async (input) => { url = String(input); return new Response('{}', { status: 409 }); }) as typeof fetch });
  (store as any).token = { value: 'fake', expires: Date.now() / 1000 + 1000 };
  assert.equal(await store.create('financeEntries', 'event', {} as FinanceEntry), false); assert.match(url, /currentDocument.exists=false/);
});
test('finance endpoints are admin-only and financial data is never publicly cached', async () => {
  const app = express(); app.use(express.json()); const token = 'finance-test-admin-only';
  const core = createShamCore({ env: { SHAM_ADMIN_TOKEN: token }, store: new MemoryStore() }); app.use('/api/admin', core.admin);
  const server = app.listen(0); const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin/finance`;
  try {
    for (const path of ['', '/status', '/export']) assert.equal((await fetch(base + path)).status, 401);
    const r = await fetch(base, { headers: { Authorization: `Bearer ${token}` } }); assert.equal(r.status, 200); assert.match(r.headers.get('cache-control') || '', /no-store/);
    const bad = await fetch(`${base}?period=yearly`, { headers: { Authorization: `Bearer ${token}` } }); assert.equal(bad.status, 400);
    assert.equal((await fetch(`${base}/entries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
  } finally { server.close(); }
});

test('an explicit file store is not durable finance storage on a serverless platform', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sham-finance-serverless-'));
  try {
    for (const host of [{ VERCEL: '1' }, { SHAM_SERVERLESS: 'true' }]) {
      const f = new FinanceService(new FileStore(join(directory, 'store.json')), { ...ENV, ...host }, { now: () => NOW });
      assert.equal((await f.status()).persistent, false);
      await assert.rejects(() => seed(f), /الدفع الحي متوقف/);
      assert.deepEqual(await f.methods('EG', 'EGP'), []);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('bounded reconciliation rotates oldest unchecked sessions even when the gateway fails', async () => {
  const store = new Durable(); const fetched: string[] = [];
  const f = new FinanceService(store, ENV, { now: () => NOW, fetch: (async (url) => {
    fetched.push(String(url)); throw new Error('unreachable');
  }) as typeof fetch });
  for (let i = 0; i < 25; i++) await store.create('financeSessions', `s${i}`, {
    id: `s${i}`, ref: `SP-${i}`, mode: 'live', sessionId: `session_${i}`, at: '2026-10-17T00:00:00.000Z',
  });
  await f.reconcile(); assert.equal(fetched.length, 20);
  await f.reconcile();
  assert.equal(new Set(fetched).size, 25, 'a persistent failure must not starve the rest of the backlog');
  assert.equal((await store.list('financeEntries')).length, 0);
});
