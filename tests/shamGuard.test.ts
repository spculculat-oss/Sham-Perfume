import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryStore } from '../server/core/store';
import { ValidationError } from '../server/core/repository';
import { ShamBooks } from '../server/finance/shamBooks';
import {
  PLATFORM_HOLDER,
  balanceOf,
  emptyLedger,
  ensureHolder,
  holdWithdrawal,
  importRecorded,
  releaseHold,
  shamAccountNumber,
  transfer,
  accountView,
} from '../src/bank/shamLedger';
import { GUARD_LIMITS, toUsdMinor } from '../src/bank/shamGuard';

const at = '2026-10-24T12:00:00.000Z';
const plus = (ms: number) => new Date(Date.parse(at) + ms).toISOString();
const usd = (minor: number) => (minor / 100).toFixed(2);

function opened() {
  return ensureHolder(ensureHolder(emptyLedger(), PLATFORM_HOLDER, at), 'u_alice', at);
}

function funded(minor = 5_000_000) {
  return importRecorded(opened(), PLATFORM_HOLDER, [{ currency: 'USD', minor }], at);
}

function send(state: ReturnType<typeof funded>, fromHolderId: string, toAccountNumber: string, amountMinor: number, idempotencyKey: string, when: string) {
  const key = idempotencyKey.length >= 8 ? idempotencyKey : `guard-${idempotencyKey}`;
  return transfer(state, { fromHolderId, toAccountNumber, currency: 'USD', amount: usd(amountMinor), detail: key, idempotencyKey: key, at: when });
}

test('a small first transfer posts, and a large first transfer moves nothing', () => {
  const number = shamAccountNumber('u_alice');
  let state = funded();
  assert.throws(() => send(state, PLATFORM_HOLDER, number, GUARD_LIMITS.platform.newPayee + 1, 'cool-big', at), /COOLING/);
  assert.equal(balanceOf(state, PLATFORM_HOLDER, 'USD').availableMinor, 5_000_000);
  state = send(state, PLATFORM_HOLDER, number, 2_500, 'cool-small', at);
  assert.equal(balanceOf(state, 'u_alice', 'USD').availableMinor, 2_500);
  state = send(state, PLATFORM_HOLDER, number, 1_550, 'cool-second', at);
  assert.equal(balanceOf(state, 'u_alice', 'USD').availableMinor, 4_050);
  const later = plus(GUARD_LIMITS.coolingMs + 1_000);
  state = send(state, PLATFORM_HOLDER, number, GUARD_LIMITS.platform.newPayee + 1, 'cool-later', later);
  assert.equal(balanceOf(state, 'u_alice', 'USD').availableMinor, 4_050 + GUARD_LIMITS.platform.newPayee + 1);
});

test('single, daily, and new-payee caps stop the debit', () => {
  const alice = shamAccountNumber('u_alice');
  let state = funded(2_000_000);
  assert.throws(() => send(state, PLATFORM_HOLDER, alice, GUARD_LIMITS.platform.single + 1, 'single', at), /LIMIT_SINGLE/);
  state = send(state, PLATFORM_HOLDER, alice, GUARD_LIMITS.platform.newPayee, 'seed', at);
  const cooled = plus(GUARD_LIMITS.coolingMs + 1_000);
  state = send(state, PLATFORM_HOLDER, alice, 600_000, 'fund', cooled);
  state = ensureHolder(state, 'u_bob', cooled);
  const bob = shamAccountNumber('u_bob');
  state = send(state, 'u_alice', bob, GUARD_LIMITS.customer.newPayee, 'intro', cooled);
  const trusted = plus(GUARD_LIMITS.coolingMs * 2 + 2_000);
  state = send(state, 'u_alice', bob, GUARD_LIMITS.customer.single, 'day-1', trusted);
  state = send(state, 'u_alice', bob, GUARD_LIMITS.customer.single, 'day-2', trusted);
  const before = balanceOf(state, 'u_alice', 'USD').availableMinor;
  const used = GUARD_LIMITS.customer.newPayee + GUARD_LIMITS.customer.single * 2;
  const overDay = GUARD_LIMITS.customer.daily - used + 1;
  assert.ok(overDay > 0 && overDay <= GUARD_LIMITS.customer.single && overDay <= before);
  assert.throws(() => send(state, 'u_alice', bob, overDay, 'day-3', trusted), /LIMIT_DAILY/);
  assert.equal(balanceOf(state, 'u_alice', 'USD').availableMinor, before);
  for (const id of ['u_c1', 'u_c2', 'u_c3', 'u_c4', 'u_c5']) state = ensureHolder(state, id, trusted);
  for (const id of ['u_c1', 'u_c2', 'u_c3', 'u_c4']) {
    state = send(state, 'u_alice', shamAccountNumber(id), 100, `payee-${id}`, trusted);
  }
  assert.throws(() => send(state, 'u_alice', shamAccountNumber('u_c5'), 100, 'payee-c5', trusted), /PAYEE_LIMIT/);
  assert.equal(balanceOf(state, 'u_c5', 'USD').availableMinor, 0);
});

test('a burst freezes the next send, and a release still posts', () => {
  let state = funded();
  const number = shamAccountNumber('u_alice');
  for (let i = 0; i < GUARD_LIMITS.burstMax; i++) {
    state = holdWithdrawal(state, { holderId: PLATFORM_HOLDER, currency: 'USD', amount: '1.00', detail: `hold ${i}`, idempotencyKey: `burst-${String(i).padStart(2, '0')}`, at });
  }
  const before = balanceOf(state, PLATFORM_HOLDER, 'USD').availableMinor;
  assert.throws(() => send(state, PLATFORM_HOLDER, number, 100, 'burst-ninth', at), /ACCOUNT_FROZEN/);
  assert.equal(balanceOf(state, PLATFORM_HOLDER, 'USD').availableMinor, before);
  assert.equal(accountView(state, PLATFORM_HOLDER, false, at).guard.status, 'frozen');
  const held = state.postings.find((row) => row.kind === 'hold' && row.status === 'held');
  assert.ok(held);
  state = releaseHold(state, PLATFORM_HOLDER, held.id, at);
  assert.equal(state.postings.find((row) => row.id === held.id)?.status, 'released');
  const later = plus(GUARD_LIMITS.burstWindowMs + 1_000);
  state = send(state, PLATFORM_HOLDER, number, 100, 'burst-later', later);
  assert.equal(balanceOf(state, 'u_alice', 'USD').availableMinor, 100);
});

test('a euro debit is capped in dollars, and releasing a hold does not erase the burst', () => {
  let state = importRecorded(opened(), PLATFORM_HOLDER, [{ currency: 'USD', minor: 5_000_000 }, { currency: 'EUR', minor: 200_000 }], at);
  const number = shamAccountNumber('u_alice');
  assert.ok(toUsdMinor(95_000, 'EUR') > GUARD_LIMITS.platform.newPayee);
  assert.throws(() => transfer(state, {
    fromHolderId: PLATFORM_HOLDER, toAccountNumber: number, currency: 'EUR', amount: '950.00', detail: 'euro cap', idempotencyKey: 'euro-cap-1', at,
  }), /COOLING/);
  assert.equal(balanceOf(state, PLATFORM_HOLDER, 'EUR').availableMinor, 200_000);
  assert.ok(toUsdMinor(80_000, 'EUR') <= GUARD_LIMITS.platform.newPayee);
  state = transfer(state, {
    fromHolderId: PLATFORM_HOLDER, toAccountNumber: number, currency: 'EUR', amount: '800.00', detail: 'euro ok', idempotencyKey: 'euro-ok-01', at,
  });
  assert.equal(balanceOf(state, 'u_alice', 'EUR').availableMinor, 80_000);
  state = funded();
  for (let i = 0; i < GUARD_LIMITS.burstMax; i++) {
    state = holdWithdrawal(state, { holderId: PLATFORM_HOLDER, currency: 'USD', amount: '1.00', detail: `flip ${i}`, idempotencyKey: `flip-key-${String(i).padStart(2, '0')}`, at });
    const id = state.postings.find((row) => row.kind === 'hold' && row.status === 'held' && row.detail === `flip ${i}`)?.id;
    assert.ok(id);
    state = releaseHold(state, PLATFORM_HOLDER, id, at);
  }
  const before = balanceOf(state, PLATFORM_HOLDER, 'USD').availableMinor;
  assert.throws(() => send(state, PLATFORM_HOLDER, number, 100, 'flip-ninth', at), /ACCOUNT_FROZEN/);
  assert.equal(balanceOf(state, PLATFORM_HOLDER, 'USD').availableMinor, before);
});

test('an unconfirmed book call moves nothing, and the lock allows only one of two parallel debits', async () => {
  const store = new MemoryStore();
  const first = new ShamBooks(store, () => at);
  const second = new ShamBooks(store, () => at);
  await first.importConfirmed([{ currency: 'USD', minor: 6_000 }]);
  await first.open('u_alice');
  const number = shamAccountNumber('u_alice');
  await assert.rejects(first.transfer(PLATFORM_HOLDER, {
    toAccountNumber: number, currency: 'USD', amount: '10.00', detail: 'no confirm', idempotencyKey: 'no-confirm', confirmed: false,
  }), (error: unknown) => error instanceof ValidationError && error.code === 'CONFIRMATION_REQUIRED');
  assert.equal((await first.open(PLATFORM_HOLDER)).balances.find((row) => row.currency === 'USD')?.availableMinor, 6_000);
  const body = { toAccountNumber: number, currency: 'USD', amount: '50.00', detail: 'race', confirmed: true as const };
  const raced = await Promise.allSettled([
    first.transfer(PLATFORM_HOLDER, { ...body, idempotencyKey: 'race-key-a' }),
    second.transfer(PLATFORM_HOLDER, { ...body, idempotencyKey: 'race-key-b' }),
  ]);
  const ok = raced.filter((row) => row.status === 'fulfilled');
  const failed = raced.filter((row) => row.status === 'rejected');
  assert.equal(ok.length, 1);
  assert.equal(failed.length, 1);
  const reason = (failed[0] as PromiseRejectedResult).reason;
  assert.equal(reason instanceof ValidationError ? reason.code : '', 'INSUFFICIENT_FUNDS');
  const view = await first.open(PLATFORM_HOLDER);
  assert.equal(view.balances.find((row) => row.currency === 'USD')?.availableMinor, 1_000);
  assert.equal(view.guard.status, 'open');
  assert.equal(view.guard.dailyUsedUsdMinor, 5_000);
});
