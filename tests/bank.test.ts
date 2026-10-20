import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { MemoryStore, createLedgerStore } from '../server/core/store';
import { PostgresStore } from '../server/core/pgStore';
import { connectPglite } from '../server/community/db';
import { FinanceService } from '../server/finance/service';
import { BankService, cleanText, looksLikeCard } from '../server/finance/bank';
import { createFinanceRouter } from '../server/finance/router';
import { createCheckoutRouter } from '../server/checkout';
import { financeId } from '../server/finance/report';
import { budgetUsage, cashForecast, convertEstimate, countryPerformance, matchStatement, parseAmount, parseDate, parseStatement, payablesAgeing, productPerformance } from '../src/finance/bankTools';
import { answerFinance, topicOf } from '../src/finance/accountant';
import type { FinanceEntry, FinanceOrder, Payable } from '../server/finance/types';

class Durable extends MemoryStore { override readonly persistent = true; }
const NOW = Date.parse('2026-10-20T10:00:00Z');
const make = (store = new Durable(), now = { t: NOW }) => {
  const finance = new FinanceService(store, {}, { now: () => now.t, fetch: (async () => { throw new Error('no network'); }) as typeof fetch });
  const bank = new BankService(finance, {}, (async () => { throw new Error('no network'); }) as typeof fetch);
  return { finance, bank, store, now };
};
const instapay = { kind: 'instapay', label: 'إنستاباي شام', instructions: 'حوّل على عنوان إنستاباي sham@instapay واكتب رقم الطلب في الملاحظة.', currencies: ['EGP'], countries: ['EG'] };
const order = (ref: string, accountId: string, totalMinor = 150000) => ({ ref, accountId, country: 'EG', currency: 'EGP', totalMinor, shippingChargedMinor: 10000,
  lines: [{ sku: 'OUD-1', qty: 1, unitMinor: totalMinor - 10000 }], contact: { email: 'buyer@example.com', phone: '+20 100 000 0000' } });

test('bank: secrets and card numbers never enter free text', () => {
  assert.equal(looksLikeCard('4012 0000 3333 0026'), true);
  assert.equal(looksLikeCard('5123-4500-0000-0008'), true);
  assert.equal(looksLikeCard('IBAN EG380019000500000000263180002'), false, 'IBANs are payment instructions, not cards');
  assert.equal(looksLikeCard('محفظة 01000000000'), false);
  assert.throws(() => cleanText('كلمة السر 1234', 2, 50, 'x'), /SECRET|كلمات سر/);
  assert.throws(() => cleanText('CVV 100', 2, 50, 'x'));
  assert.throws(() => cleanText('a', 2, 50, 'x'));
  assert.equal(cleanText('  تحويل بنكي  ', 2, 50, 'x'), 'تحويل بنكي');
});

test('bank: accounts are validated and direct methods are hidden without a durable ledger', async () => {
  const { bank } = make();
  await assert.rejects(() => bank.saveAccount(undefined, { ...instapay, kind: 'crypto' }), /INVALID_KIND|اختر/);
  await assert.rejects(() => bank.saveAccount(undefined, { ...instapay, instructions: 'كارت 4012000033330026' }));
  await assert.rejects(() => bank.saveAccount(undefined, { ...instapay, countries: ['XX'] }));
  const acc = await bank.saveAccount(undefined, instapay);
  assert.match(acc.id, /^acc_instapay_/); assert.equal(acc.holdHours, 72); assert.equal(acc.active, true);
  assert.deepEqual(await bank.publicMethods('EG', 'EGP'), [{ id: acc.id, kind: 'instapay', label: 'إنستاباي شام', currency: 'EGP' }]);
  assert.deepEqual(await bank.publicMethods('SA', 'SAR'), [], 'only the configured countries');
  const cod = await bank.saveAccount(undefined, { kind: 'cod', label: 'الدفع عند الاستلام', countries: ['EG'] });
  assert.equal(cod.holdHours, 720);
  await bank.saveAccount(acc.id, { active: false });
  assert.deepEqual((await bank.publicMethods('EG', 'EGP')).map((m) => m.kind), ['cod']);
  const temp = new BankService(new FinanceService(new MemoryStore(), {}, { now: () => NOW }));
  await temp.saveAccount(undefined, instapay);
  assert.deepEqual(await temp.publicMethods('EG', 'EGP'), [], 'no durable ledger → no direct orders');
  assert.ok((await bank.store.list('bankAudit')).some((a) => a.action === 'account.update'));
});

test('bank: reserve → buyer reports transfer → owner confirms → one sale in the ledger and reports', async () => {
  const { bank, finance, store } = make();
  const paidRefs: string[] = []; finance.onPaid = async (ref) => { paidRefs.push(ref); };
  const acc = await bank.saveAccount(undefined, instapay);
  const receipt = await bank.createDirect(order('SP-TEST-0001', acc.id));
  assert.equal(receipt.amount, '1500.00'); assert.equal(receipt.currency, 'EGP'); assert.match(receipt.instructions, /sham@instapay/);
  assert.ok(receipt.token.length > 20);
  const saved = await store.get('bankDirect', 'SP-TEST-0001');
  assert.ok(saved && !JSON.stringify(saved).includes(receipt.token), 'the token itself is not stored');
  assert.ok(!JSON.stringify(saved).includes('buyer@example.com'), 'no contacts in the ledger');
  await assert.rejects(() => bank.publicView('SP-TEST-0001', 'wrong-token'), /NOT_FOUND|غير موجود/);
  assert.equal((await bank.publicView('SP-TEST-0001', receipt.token)).state, 'awaiting_payment');
  await assert.rejects(() => bank.confirm('SP-TEST-0001', {}), /CONFIRMATION_REQUIRED|أكّد/);
  const claim = await bank.claim('SP-TEST-0001', receipt.token, { payerName: 'أحمد علي', transferRef: 'IP٧٧١٢٣٤', paidAt: new Date(NOW).toISOString(), amount: '1,500' });
  assert.equal(claim.state, 'claimed');
  const claimed = await store.get('bankDirect', 'SP-TEST-0001');
  assert.equal(claimed?.claim?.transferRef, 'IP771234'); assert.deepEqual(claimed?.risk, []);
  assert.ok((await store.list('financeIssues')).some((i) => i.code === 'DIRECT_CLAIM' && !i.resolvedAt));
  await assert.rejects(() => bank.claim('SP-TEST-0001', receipt.token, { payerName: 'x y', transferRef: 'AAA1', paidAt: new Date(NOW).toISOString(), amount: '1500' }), /INVALID_STATE|بالفعل/);
  await Promise.all([bank.confirm('SP-TEST-0001', { seen: true }), bank.confirm('SP-TEST-0001', { seen: true })]);
  const sales = (await store.list('financeEntries')).filter((e) => e.kind === 'sale');
  assert.equal(sales.length, 1); assert.equal(sales[0].source, 'direct'); assert.equal(sales[0].accountId, acc.id); assert.equal(sales[0].amountMinor, 150000);
  assert.equal((await bank.publicView('SP-TEST-0001', receipt.token)).state, 'paid');
  assert.ok(paidRefs.includes('SP-TEST-0001'));
  assert.ok((await store.list('financeIssues')).every((i) => i.code !== 'DIRECT_CLAIM' || i.resolvedAt));
  const report = await finance.report(finance.period('daily'));
  assert.equal(report.currencies[0].collectedMinor, 150000); assert.equal(report.currencies[0].paidOrders, 1);
  assert.equal(report.currencies[0].missing.length, 1, 'direct sales also need their costs before net profit');
  // Costs can be posted against a direct sale exactly like a gateway sale.
  await finance.addEntry({ idempotencyKey: randomUUID(), kind: 'cost', amount: '700', currency: 'EGP', orderRef: 'SP-TEST-0001', at: new Date(NOW).toISOString(), reason: 'فاتورة المورد' });
  await assert.rejects(() => bank.reject('SP-TEST-0001', 'غلط'), /INVALID_STATE|مدفوع/);
});

test('bank: risk flags, rejections, cash on delivery and expiry', async () => {
  const { bank, store, now, finance } = make();
  const acc = await bank.saveAccount(undefined, { ...instapay, holdHours: 24 });
  const cod = await bank.saveAccount(undefined, { kind: 'cod', countries: ['EG'] });
  const a = await bank.createDirect(order('SP-RISK-0001', acc.id));
  await bank.claim('SP-RISK-0001', a.token, { payerName: 'سارة', transferRef: 'REF-55', paidAt: new Date(NOW).toISOString(), amount: '1000' });
  assert.deepEqual((await store.get('bankDirect', 'SP-RISK-0001'))?.risk, ['AMOUNT_MISMATCH']);
  await assert.rejects(() => bank.confirm('SP-RISK-0001', { seen: true }), /مختلف/);
  const b = await bank.createDirect(order('SP-RISK-0002', acc.id));
  await bank.claim('SP-RISK-0002', b.token, { payerName: 'سارة', transferRef: 'ref 55', paidAt: new Date(NOW).toISOString(), amount: '1500' });
  assert.ok((await store.get('bankDirect', 'SP-RISK-0002'))?.risk.includes('DUPLICATE_REFERENCE'));
  const c = await bank.createDirect(order('SP-RISK-0003', acc.id));
  assert.ok((await store.get('bankDirect', 'SP-RISK-0003'))?.risk.includes('MANY_OPEN_ORDERS'));
  await bank.reject('SP-RISK-0002', 'لم يصل التحويل');
  assert.equal((await bank.publicView('SP-RISK-0002', b.token)).state, 'rejected');
  const d = await bank.createDirect(order('SP-COD-0001', cod.id));
  await assert.rejects(() => bank.claim('SP-COD-0001', d.token, {}), /COD_NO_CLAIM|الاستلام/);
  await bank.confirm('SP-COD-0001', { seen: true, note: 'استلم المندوب المبلغ' });
  assert.equal((await store.get('bankDirect', 'SP-COD-0001'))?.state, 'paid');
  now.t = NOW + 25 * 3600_000;
  assert.equal((await bank.publicView('SP-RISK-0003', c.token)).state, 'expired');
  await assert.rejects(() => bank.claim('SP-RISK-0003', c.token, { payerName: 'سارة', transferRef: 'X1234', paidAt: new Date(now.t).toISOString(), amount: '1500' }), /انتهت/);
  // The owner may still confirm an expired reservation once the money is in the account.
  await bank.confirm('SP-RISK-0003', { seen: true });
  assert.equal((await store.get('bankDirect', 'SP-RISK-0003'))?.state, 'paid');
  const { run } = await finance.run('admin');
  assert.ok(run.openIssues >= 1);
  assert.ok((await store.list('financeIssues')).some((i) => i.code === 'DIRECT_WAITING' && !i.resolvedAt), 'claim waiting more than a day');
  assert.ok(!(await store.list('financeIssues')).some((i) => i.code.startsWith('CONFIG_')), 'an unconfigured gateway is dormant, not an alarm');
});

test('bank: payables post real entries, budgets warn, and nothing moves money', async () => {
  const { bank, finance, store } = make();
  await assert.rejects(() => bank.addPayable({ idempotencyKey: 'short', party: 'x', category: 'ai', currency: 'EGP', amount: '1', dueDate: '2026-10-25' }));
  const key = randomUUID();
  const p = await bank.addPayable({ idempotencyKey: key, party: 'مزود الذكاء', category: 'ai', currency: 'EGP', amount: '900', dueDate: '2026-10-19' });
  assert.deepEqual(await bank.addPayable({ idempotencyKey: key, party: 'مزود الذكاء', category: 'ai', currency: 'EGP', amount: '900', dueDate: '2026-10-19' }), p, 'idempotent');
  await bank.setBudget({ category: 'ai', currency: 'EGP', amount: '1000' });
  await finance.run('admin');
  assert.ok((await store.list('financeIssues')).some((i) => i.code === 'PAYABLE_OVERDUE' && !i.resolvedAt));
  const paid = await bank.payPayable(p.id);
  assert.equal(paid.status, 'paid');
  const entry = (await store.list('financeEntries')).find((e) => e.id === paid.entryId)!;
  assert.equal(entry.kind, 'expense'); assert.equal(entry.category, 'ai'); assert.equal(entry.amountMinor, 90000);
  assert.equal((await bank.payPayable(p.id)).entryId, paid.entryId, 'paying twice posts once');
  await assert.rejects(() => bank.cancelPayable(p.id), /INVALID_STATE|مسددة/);
  await finance.run('admin');
  const issues = await store.list('financeIssues');
  assert.ok(issues.some((i) => i.code === 'BUDGET_WARN_ai_EGP' && !i.resolvedAt), '90 % of the AI budget');
  assert.ok(issues.some((i) => i.code === 'PAYABLE_OVERDUE' && i.resolvedAt), 'resolved once paid');
  const answer = await bank.ask('صرفنا كام الشهر ده؟');
  assert.equal(answer.topic, 'expenses'); assert.match(answer.answer, /٩٠٠|900/);
});

test('bank tools: statement parsing and matching are conservative', () => {
  assert.equal(parseAmount('1,250.50'), 1250.5); assert.equal(parseAmount('1.250,50'), 1250.5); assert.equal(parseAmount('EGP ١٬٥٠٠٫٠٠'), 1500);
  assert.equal(parseAmount('(200)'), -200); assert.equal(parseAmount('abc'), undefined);
  assert.equal(parseDate('19/10/2026'), '2026-10-19'); assert.equal(parseDate('2026-10-19 14:00'), '2026-10-19'); assert.equal(parseDate('31/02/2026'), '');
  const csv = 'التاريخ,البيان,مدين,دائن\n2026-10-20,"تحويل إنستاباي SP-AAA-0001",,1500\n2026-10-20,رسوم,5,\n20/10/2026,IPN REF 9981,,"2,000.00"\n21/10/2026,غير معروف,,750';
  const lines = parseStatement(csv);
  assert.equal(lines.length, 3, 'debit-only rows have no credit amount');
  assert.deepEqual(lines.map((l) => l.amount), [1500, 2000, 750]);
  const created = new Date(NOW).toISOString();
  const { matches, unmatchedLines } = matchStatement(lines, [
    { ref: 'SP-AAA-0001', totalMinor: 150000, currency: 'EGP', createdAt: created },
    { ref: 'SP-BBB-0002', totalMinor: 200000, currency: 'EGP', createdAt: created, transferRef: 'REF9981' },
    { ref: 'SP-CCC-0003', totalMinor: 75000, currency: 'EGP', createdAt: created },
    { ref: 'SP-DDD-0004', totalMinor: 75000, currency: 'EGP', createdAt: created },
    { ref: 'SP-EEE-0005', totalMinor: 150000, currency: 'USD', createdAt: created },
  ], 'EGP');
  assert.deepEqual(matches.map((m) => [m.ref, m.confidence]), [['SP-AAA-0001', 'strong'], ['SP-BBB-0002', 'strong']]);
  assert.equal(unmatchedLines, 1, 'two orders compete for 750 → left for the owner');
  const noHeader = parseStatement('20/10/2026;750,00;Transfer from Mona');
  assert.equal(noHeader[0].amount, 750); assert.equal(noHeader[0].date, '2026-10-20');
  assert.equal(matchStatement(noHeader, [{ ref: 'SP-CCC-0003', totalMinor: 75000, currency: 'EGP', createdAt: created }], 'EGP').matches[0].confidence, 'amount');
});

test('bank tools: forecast, ageing, budgets, profitability and currency estimate', () => {
  const e = (kind: FinanceEntry['kind'], amountMinor: number, daysAgo: number, extra: Partial<FinanceEntry> = {}): FinanceEntry => ({ id: randomUUID(), kind, amountMinor, currency: 'EGP', mode: 'live', source: 'admin', at: new Date(NOW - daysAgo * 86400_000).toISOString(), recordedAt: '', ...extra });
  const orders: FinanceOrder[] = [
    { id: 'o1', ref: 'R1', provider: 'direct', mode: 'live', country: 'EG', currency: 'EGP', totalMinor: 30000, shippingChargedMinor: 0, createdAt: '', lines: [{ sku: 'A', qty: 2, unitMinor: 10000 }, { sku: 'B', qty: 1, unitMinor: 10000 }] },
    { id: 'o2', ref: 'R2', provider: 'direct', mode: 'live', country: 'SA', currency: 'EGP', totalMinor: 10000, shippingChargedMinor: 0, createdAt: '', lines: [{ sku: 'B', qty: 1, unitMinor: 10000 }] },
    { id: 'o3', ref: 'R3', provider: 'direct', mode: 'live', country: 'EG', currency: 'EGP', totalMinor: 99999, shippingChargedMinor: 0, createdAt: '', lines: [{ sku: 'C', qty: 1, unitMinor: 99999 }] },
  ];
  const entries = [e('sale', 30000, 2, { orderRef: 'R1', source: 'direct' }), e('sale', 10000, 1, { orderRef: 'R2', source: 'direct' }), e('cost', 15000, 1, { orderRef: 'R1' }), e('expense', 7000, 1, { category: 'marketing' })];
  const products = productPerformance(orders, entries);
  assert.deepEqual(products.map((p) => [p.sku, p.units, p.revenueMinor]), [['A', 2, 20000], ['B', 2, 20000]], 'unpaid R3 is not revenue');
  assert.equal(products[0].estimatedCostMinor, 10000); assert.equal(products[0].costComplete, false);
  const countries = countryPerformance(orders, entries);
  assert.deepEqual(countries.map((c) => [c.country, c.collectedMinor, c.resultMinor]), [['EG', 30000, 15000], ['SA', 10000, 10000]]);
  const payables: Payable[] = [
    { id: 'p1', party: 'x', category: 'rent', currency: 'EGP', amountMinor: 5000, dueDate: '2026-10-18', note: '', status: 'open', createdAt: '' },
    { id: 'p2', party: 'y', category: 'rent', currency: 'EGP', amountMinor: 3000, dueDate: '2026-10-25', note: '', status: 'open', createdAt: '' },
    { id: 'p3', party: 'z', category: 'rent', currency: 'EGP', amountMinor: 1000, dueDate: '2026-12-25', note: '', status: 'open', createdAt: '' },
    { id: 'p4', party: 'z', category: 'rent', currency: 'EGP', amountMinor: 1000, dueDate: '2026-10-25', note: '', status: 'paid', createdAt: '' },
  ];
  assert.deepEqual(payablesAgeing(payables, NOW)[0], { currency: 'EGP', overdue: 1, overdueMinor: 5000, week: 1, dueWeekMinor: 3000, month: 0, dueMonthMinor: 0, laterMinor: 1000 });
  const [f] = cashForecast(entries, payables, NOW);
  assert.equal(f.basisDays, 7); assert.equal(f.payablesDueMinor, 8000); assert.equal(f.confidence, 'low');
  assert.equal(f.projectedNetMinor, Math.round((40000 - 22000) / 7 * 30));
  const usage = budgetUsage([{ id: 'marketing:EGP', category: 'marketing', currency: 'EGP', monthlyMinor: 5000, updatedAt: '' }], entries, '2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z');
  assert.deepEqual(usage.map((u) => [u.category, u.state, u.percent]), [['marketing', 'over', 140]]);
  assert.deepEqual(convertEstimate([{ currency: 'EGP', minor: 5000 }, { currency: 'USD', minor: 100 }], 'EGP', { base: 'USD', rates: { EGP: 50 } }), { minor: 10000, missing: [] });
  assert.deepEqual(convertEstimate([{ currency: 'XYZ', minor: 1 }], 'EGP', { base: 'USD', rates: { EGP: 50 } }).missing, ['XYZ']);
});

test('shaheen accountant: understands Egyptian questions and never invents figures', () => {
  assert.equal(topicOf('كسبنا كام الشهر ده؟'), 'profit');
  assert.equal(topicOf('ايه أكتر منتج بيتباع'), 'products');
  assert.equal(topicOf('في تحويلات مستنية تأكيد؟'), 'pending');
  assert.equal(topicOf('علينا كام للموردين'), 'payables');
  assert.equal(topicOf('السيولة الشهر الجاي'), 'forecast');
  assert.equal(topicOf('what is the weather'), 'help');
  const empty = { today: [], month: [], products: [], countries: [], budgets: [], ageing: [], forecast: [], waitingConfirmation: 0, awaitingTransfer: 0 };
  assert.match(answerFinance('كسبنا كام؟', empty).answer, /مفيش قيود/);
  const month = [{ currency: 'EGP', collectedMinor: 500000, refundsMinor: 0, expensesMinor: 0, recordedResultMinor: 120000, netProfitMinor: null, paidOrders: 4 }];
  const a = answerFinance('كسبنا كام الشهر ده؟', { ...empty, month });
  assert.match(a.answer, /مبدئي/); assert.match(a.answer, /١٬٢٠٠|1,200/);
  assert.match(answerFinance('How much profit?', { ...empty, month }).answer, /preliminary/);
});

test('ledger store: Postgres adapter keeps an atomic, replay-safe ledger (PGlite)', async () => {
  const sql = await connectPglite();
  const store = new PostgresStore(async () => sql);
  const entry = { id: 's1', kind: 'sale', mode: 'live', currency: 'EGP', amountMinor: 100, at: 'x', recordedAt: 'x', source: 'direct' } as FinanceEntry;
  const created = await Promise.all(Array.from({ length: 10 }, () => store.create('financeEntries', 's1', entry)));
  assert.equal(created.filter(Boolean).length, 1);
  assert.deepEqual(await store.get('financeEntries', 's1'), entry);
  await store.put('financeEntries', 's1', { ...entry, amountMinor: 200 });
  assert.equal((await store.list('financeEntries'))[0].amountMinor, 200);
  assert.equal(await store.delete('financeEntries', 's1'), true); assert.equal(await store.get('financeEntries', 's1'), undefined);
  // The ledger reuses the community database only when Core itself is temporary.
  const core = new MemoryStore();
  assert.equal(createLedgerStore({}, core), core);
  assert.equal(createLedgerStore({ VERCEL: '1', DATABASE_URL: 'postgres://u:p@db.example/x' }, core).kind, 'postgres');
  const durable = new Durable();
  assert.equal(createLedgerStore({ DATABASE_URL: 'postgres://u:p@db.example/x' }, durable), durable);
  const { bank } = make(store as never);
  const acc = await bank.saveAccount(undefined, instapay);
  const r = await bank.createDirect(order('SP-PG-00001', acc.id));
  await bank.confirm('SP-PG-00001', { seen: true });
  assert.equal((await store.get('financeEntries', financeId('sale', 'live', 'SP-PG-00001')))?.amountMinor, 150000);
  assert.ok(r.token);
  await sql.close();
});

test('bank HTTP: store checkout reserves direct orders priced by the server, admin routes confirm', async () => {
  const { finance, bank } = make();
  const acc = await bank.saveAccount(undefined, instapay);
  const app = express(); app.use(express.json());
  const products = [{ id: 1, sku: 'OUD-1', nameAr: 'عود', nameEn: 'Oud', descriptionAr: 'عود', descriptionEn: '', category: 'عود', brand: 'Sham', supplierPrice: 200, ourPrice: 1000, stockStatus: 'in_stock', imageUrl: '' }];
  app.use('/api', createCheckoutRouter({ finance, bank, env: {}, products, catalog: async () => undefined, fx: async () => ({ base: 'USD', updatedAt: '2026-10-20T00:00:00Z', rates: { EGP: 50, USD: 1 } }) }));
  app.use('/api/admin/finance', createFinanceRouter(finance, bank));
  const server = app.listen(0); const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const methods = await (await fetch(`${base}/api/store/payments?country=EG`)).json() as { enabled: boolean; direct: { id: string }[] };
    assert.equal(methods.enabled, false, 'no gateway'); assert.deepEqual(methods.direct.map((m) => m.id), [acc.id]);
    const body = { items: [{ sku: 'OUD-1', qty: 2 }], country: 'EG', lang: 'ar', account: acc.id, contact: { name: 'منى', email: 'mona@example.com', phone: '01000000000' }, address: { city: 'الجيزة', line: 'شارع الهرم 10' }, total: 1 };
    const created = await fetch(`${base}/api/store/checkout/direct`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(created.status, 201, await created.clone().text());
    const receipt = await created.json() as { ref: string; token: string; amount: string; totalMinor: number };
    const stored = await finance.store.get('financeOrders', financeId('order', 'live', receipt.ref));
    assert.equal(stored?.provider, 'direct'); assert.equal(stored?.totalMinor, receipt.totalMinor);
    assert.ok(receipt.totalMinor > 200000, 'price comes from the catalog (+ markup and shipping), never the browser');
    const bad = await fetch(`${base}/api/store/checkout/direct`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, account: 'acc_fake' }) });
    assert.equal(bad.status, 409);
    assert.equal((await fetch(`${base}/api/store/checkout/direct/${receipt.ref}`)).status, 404, 'token required');
    const view = await (await fetch(`${base}/api/store/checkout/direct/${receipt.ref}`, { headers: { 'X-Order-Token': receipt.token } })).json() as { state: string };
    assert.equal(view.state, 'awaiting_payment');
    const claim = await fetch(`${base}/api/store/checkout/direct/${receipt.ref}/claim`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Order-Token': receipt.token },
      body: JSON.stringify({ payerName: 'منى', transferRef: 'IP123456', paidAt: new Date(NOW).toISOString(), amount: receipt.amount }) });
    assert.equal(claim.status, 200);
    const match = await (await fetch(`${base}/api/admin/finance/bank/statement?currency=EGP`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: `date,description,credit\n2026-10-20,InstaPay IP123456,${receipt.amount}` })).json() as { matches: { ref: string; confidence: string }[] };
    assert.deepEqual(match.matches.map((m) => [m.ref, m.confidence]), [[receipt.ref, 'strong']]);
    const ok = await fetch(`${base}/api/admin/finance/bank/direct/${receipt.ref}/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seen: true }) });
    assert.equal(ok.status, 200);
    const dash = await (await fetch(`${base}/api/admin/finance/bank`)).json() as { direct: Record<string, unknown>[]; balances: { collectedMinor: number }[]; month: { collectedMinor: number }[] };
    assert.equal(dash.direct[0].state, 'paid'); assert.ok(!('tokenHash' in dash.direct[0]) && !('contactHash' in dash.direct[0]));
    assert.equal(dash.balances[0].collectedMinor, receipt.totalMinor); assert.equal(dash.month[0].collectedMinor, receipt.totalMinor);
    const ask = await (await fetch(`${base}/api/admin/finance/bank/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: 'بعنا كام النهارده؟' }) })).json() as { topic: string };
    assert.equal(ask.topic, 'sales');
  } finally { server.close(); }
});
