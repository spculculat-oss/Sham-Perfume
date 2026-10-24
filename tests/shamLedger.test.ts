import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { MemoryStore } from '../server/core/store';
import { FinanceService } from '../server/finance/service';
import { BankService } from '../server/finance/bank';
import { createFinanceRouter } from '../server/finance/router';
import { createCheckoutRouter } from '../server/checkout';
import { ShamBooks } from '../server/finance/shamBooks';
import { ACCOUNT_CURRENCIES } from '../src/bank/shamAccount';
import { decimals } from '../src/finance/money';
import {
  PLATFORM_HOLDER,
  balanceOf,
  convertBalance,
  emptyLedger,
  ensureHolder,
  formatShamAccount,
  holdWithdrawal,
  importRecorded,
  looksLikeExternalIban,
  luhnCheckDigit,
  parseShamAccount,
  releaseHold,
  shamAccountNumber,
  statementLines,
  transfer,
  accountView,
} from '../src/bank/shamLedger';

const at = '2026-10-24T12:00:00Z';
const fx = { base: 'USD', updatedAt: at, rates: { USD: 1, EUR: 0.92, EGP: 48 } };

test('a Sham account number is stable, check-digit protected, and not an IBAN', () => {
  assert.equal(luhnCheckDigit('7992739871'), '3');
  const number = shamAccountNumber('u_alice');
  assert.equal(shamAccountNumber('u_alice'), number);
  assert.notEqual(shamAccountNumber('u_bob'), number);
  assert.match(number, /^SHAM\d{13}$/);
  assert.equal(parseShamAccount(formatShamAccount(number)), number);
  assert.equal(looksLikeExternalIban(number), false);
  assert.equal(/^[A-Z]{2}\d{2}/.test(number), false);
  assert.throws(() => parseShamAccount('EG380019000500000000263180002'), /INVALID_ACCOUNT/);
  assert.throws(() => parseShamAccount(`${number.slice(0, -1)}${number.endsWith('0') ? '1' : '0'}`), /INVALID_ACCOUNT/);
  assert.throws(() => shamAccountNumber('guest_client'), /LOGIN_REQUIRED/);
  for (const code of ACCOUNT_CURRENCIES) assert.equal(Number.isInteger(decimals(code)), true);
});

test('an internal transfer deducts the sender, credits the recipient, and does not invent money', () => {
  let state = ensureHolder(ensureHolder(emptyLedger(), 'u_alice', at), 'u_bob', at);
  state = importRecorded(state, 'owner', [{ currency: 'USD', minor: 5000 }], at);
  const house = shamAccountNumber(PLATFORM_HOLDER);
  const alice = shamAccountNumber('u_alice');
  assert.throws(() => transfer(state, { fromHolderId: PLATFORM_HOLDER, toAccountNumber: alice, currency: 'USD', amount: '60.00', detail: 'too much', idempotencyKey: 'key-too-much', at }), /INSUFFICIENT_FUNDS/);
  assert.equal(balanceOf(state, PLATFORM_HOLDER, 'USD').availableMinor, 5000);
  state = transfer(state, { fromHolderId: PLATFORM_HOLDER, toAccountNumber: alice, currency: 'USD', amount: '25.00', detail: 'profit share', idempotencyKey: 'key-transfer-1', at });
  assert.equal(balanceOf(state, PLATFORM_HOLDER, 'USD').availableMinor, 2500);
  assert.equal(balanceOf(state, 'u_alice', 'USD').availableMinor, 2500);
  const again = transfer(state, { fromHolderId: PLATFORM_HOLDER, toAccountNumber: alice, currency: 'USD', amount: '25.00', detail: 'profit share', idempotencyKey: 'key-transfer-1', at });
  assert.equal(again, state, 'the same key does not post twice');
  assert.throws(() => transfer(state, { fromHolderId: 'u_alice', toAccountNumber: alice, currency: 'USD', amount: '1.00', detail: 'self', idempotencyKey: 'key-self-pay', at }), /SAME_ACCOUNT/);
  assert.throws(() => transfer(state, { fromHolderId: 'u_alice', toAccountNumber: shamAccountNumber('u_nobody'), currency: 'USD', amount: '1.00', detail: 'missing', idempotencyKey: 'key-missing', at }), /UNKNOWN_ACCOUNT/);
  assert.equal(balanceOf(state, 'u_bob', 'USD').availableMinor, 0);
  state = transfer(state, { fromHolderId: 'u_alice', toAccountNumber: shamAccountNumber('u_bob'), currency: 'USD', amount: '10.00', detail: 'to bob', idempotencyKey: 'key-to-bob', at });
  assert.equal(balanceOf(state, 'u_alice', 'USD').availableMinor, 1500);
  assert.equal(balanceOf(state, 'u_bob', 'USD').availableMinor, 1000);
  assert.equal(balanceOf(state, PLATFORM_HOLDER, 'USD').availableMinor + balanceOf(state, 'u_alice', 'USD').availableMinor + balanceOf(state, 'u_bob', 'USD').availableMinor, 5000);
  const view = accountView(state, 'u_bob');
  assert.equal(view.activity[0].status, 'posted');
  assert.equal(view.activity[0].counterparty, alice);
  assert.equal(statementLines(view).some((line) => /succeeded|paid|sent to bank/i.test(line)), false);
  assert.equal(JSON.stringify(state.postings).includes('iban'), false);
  assert.equal(house.startsWith('SHAM'), true);
});

test('import is idempotent, a hold reduces available without being sent, and convert posts both legs', () => {
  let state = importRecorded(emptyLedger(), PLATFORM_HOLDER, [{ currency: 'USD', minor: 10000 }, { currency: 'EGP', minor: 48000 }], at);
  const once = state.postings.length;
  state = importRecorded(state, PLATFORM_HOLDER, [{ currency: 'USD', minor: 10000 }], at);
  assert.equal(state.postings.length, once);
  state = importRecorded(state, PLATFORM_HOLDER, [{ currency: 'USD', minor: 12000 }], at);
  assert.equal(balanceOf(state, PLATFORM_HOLDER, 'USD').availableMinor, 12000);
  state = importRecorded(state, PLATFORM_HOLDER, [{ currency: 'USD', minor: 9000 }], at);
  assert.equal(balanceOf(state, PLATFORM_HOLDER, 'USD').availableMinor, 12000, 'a lower restatement does not claw funds back');
  assert.throws(() => importRecorded(state, 'u_alice', [{ currency: 'USD', minor: 1 }], at), /NOT_PLATFORM/);
  state = holdWithdrawal(state, { holderId: PLATFORM_HOLDER, currency: 'USD', amount: '20.00', detail: 'Cairo bank', idempotencyKey: 'key-hold-1', at });
  assert.equal(balanceOf(state, PLATFORM_HOLDER, 'USD').availableMinor, 10000);
  assert.equal(balanceOf(state, PLATFORM_HOLDER, 'USD').bookMinor, 12000);
  assert.equal(balanceOf(state, PLATFORM_HOLDER, 'USD').heldMinor, 2000);
  const hold = state.postings.find((row) => row.kind === 'hold');
  assert.equal(hold?.status, 'held');
  assert.equal(JSON.stringify(state.postings).includes('succeeded'), false);
  state = releaseHold(state, PLATFORM_HOLDER, hold!.id, at);
  assert.equal(balanceOf(state, PLATFORM_HOLDER, 'USD').availableMinor, 12000);
  assert.equal(balanceOf(state, PLATFORM_HOLDER, 'USD').heldMinor, 0);
  state = convertBalance(state, { holderId: PLATFORM_HOLDER, from: 'USD', to: 'EUR', amount: '10.00', idempotencyKey: 'key-convert-1', at, fx });
  assert.equal(balanceOf(state, PLATFORM_HOLDER, 'USD').availableMinor, 11000);
  assert.equal(balanceOf(state, PLATFORM_HOLDER, 'EUR').availableMinor > 0, true);
  assert.equal(state.postings.filter((row) => row.groupId === 'c_key-convert-1').length, 2);
});

test('server books: a visitor cannot open the ledger, and a posted transfer is shared', async () => {
  const store = new MemoryStore();
  const offline = (async () => { throw new Error('no network'); }) as typeof fetch;
  const finance = new FinanceService(store, {}, { now: () => Date.parse(at), fetch: offline });
  const bank = new BankService(finance, {}, offline);
  const books = new ShamBooks(store, () => at, () => true);
  const app = express();
  app.use(express.json());
  app.use('/api', createCheckoutRouter({ finance, bank, env: {}, customer: async (req) => {
    const token = String(req.headers.authorization || '');
    if (token === 'Bearer alice') return { id: 'u_alice' };
    if (token === 'Bearer bob') return { id: 'u_bob' };
    return undefined;
  }, catalog: async () => undefined, fx: async () => fx }));
  app.use('/api/admin/finance', createFinanceRouter(finance, bank));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    assert.equal((await fetch(`${base}/api/store/sham-bank`)).status, 401);
    const opened = await (await fetch(`${base}/api/store/sham-bank`, { headers: { Authorization: 'Bearer alice' } })).json() as { accountNumber: string; balances: { currency: string; availableMinor: number }[] };
    assert.equal(opened.accountNumber, shamAccountNumber('u_alice'));
    assert.equal(opened.balances.find((row) => row.currency === 'USD')?.availableMinor, 0);
    await books.importConfirmed([{ currency: 'USD', minor: 8000 }]);
    const unpaid = await fetch(`${base}/api/admin/finance/bank/sham/transfer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toAccountNumber: opened.accountNumber, currency: 'USD', amount: '15.50', detail: 'desk', idempotencyKey: 'http-transfer-1' }) });
    assert.equal(unpaid.status, 400);
    assert.equal((await unpaid.json()).code, 'CONFIRMATION_REQUIRED');
    const paid = await fetch(`${base}/api/admin/finance/bank/sham/transfer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toAccountNumber: opened.accountNumber, currency: 'USD', amount: '15.50', detail: 'desk', idempotencyKey: 'http-transfer-1', confirmed: true }) });
    assert.equal(paid.status, 200, await paid.clone().text());
    const alice = await (await fetch(`${base}/api/store/sham-bank`, { headers: { Authorization: 'Bearer alice' } })).json() as { balances: { currency: string; availableMinor: number }[]; activity: { status: string }[] };
    assert.equal(alice.balances.find((row) => row.currency === 'USD')?.availableMinor, 1550);
    assert.equal(alice.activity[0].status, 'posted');
    const replay = await (await fetch(`${base}/api/admin/finance/bank/sham/transfer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toAccountNumber: opened.accountNumber, currency: 'USD', amount: '15.50', detail: 'desk', idempotencyKey: 'http-transfer-1', confirmed: true }) })).json() as { balances: { currency: string; availableMinor: number }[] };
    assert.equal(replay.balances.find((row) => row.currency === 'USD')?.availableMinor, 6450);
    const held = await (await fetch(`${base}/api/store/sham-bank/hold`, { method: 'POST', headers: { Authorization: 'Bearer alice', 'Content-Type': 'application/json' }, body: JSON.stringify({ currency: 'USD', amount: '5.00', detail: 'Cairo bank', idempotencyKey: 'http-hold-1', confirmed: true }) })).json() as { balances: { currency: string; availableMinor: number; heldMinor: number }[]; activity: { status: string; kind: string }[] };
    assert.equal(held.balances.find((row) => row.currency === 'USD')?.availableMinor, 1050);
    assert.equal(held.balances.find((row) => row.currency === 'USD')?.heldMinor, 500);
    assert.equal(held.activity.some((row) => row.kind === 'hold' && row.status === 'held'), true);
    assert.equal(JSON.stringify(held.activity).includes('succeeded'), false);
    const secret = await fetch(`${base}/api/store/sham-bank/transfer`, { method: 'POST', headers: { Authorization: 'Bearer alice', 'Content-Type': 'application/json' }, body: JSON.stringify({ toAccountNumber: shamAccountNumber(PLATFORM_HOLDER), currency: 'USD', amount: '1.00', detail: 'IBAN EG380019000500000000263180002', idempotencyKey: 'http-secret', confirmed: true }) });
    assert.equal(secret.status, 400);
    assert.equal((await secret.json()).code, 'SECRET');
    const minted = await fetch(`${base}/api/admin/finance/bank/sham/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ balances: [{ currency: 'USD', minor: 999999 }] }) });
    assert.equal(minted.status, 200, await minted.clone().text());
    const house = await minted.json() as { balances: { currency: string; availableMinor: number }[] };
    assert.equal(house.balances.find((row) => row.currency === 'USD')?.availableMinor, 6450, 'a browser-supplied amount cannot mint a balance');
  } finally { server.close(); }
});
