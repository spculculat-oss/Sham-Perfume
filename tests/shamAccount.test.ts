import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  RECEIVING_RAILS,
  listAccountRequests,
  requestAccountAction,
  saveWithdrawalBank,
} from '../src/bank/shamAccount';
import { balanceOf, emptyLedger, importRecorded } from '../src/bank/shamLedger';

test('receiving rails name the network and never invent an account number', () => {
  assert.equal(RECEIVING_RAILS.length >= 6, true);
  for (const rail of RECEIVING_RAILS) {
    assert.equal(rail.status, 'not_issued');
    assert.equal(JSON.stringify(rail).includes('iban'), false);
    assert.equal(/\d{6,}/.test(JSON.stringify(rail)), false);
  }
});

test('a saved withdrawal bank keeps last 4 only, and a card request does not post money', () => {
  const store = new Map<string, string>();
  const memory = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
  const previousWindow = (globalThis as { window?: unknown }).window;
  const previousStorage = (globalThis as { localStorage?: unknown }).localStorage;
  Object.defineProperty(globalThis, 'window', { value: { dispatchEvent() {} }, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: memory, configurable: true });
  try {
    assert.throws(() => saveWithdrawalBank('usr-1', { nickname: 'My bank 123456789012', currency: 'USD', country: 'US', last4: '1234' }), /SECRET/);
    assert.throws(() => saveWithdrawalBank('usr-1', { nickname: 'Cairo bank', currency: 'USD', country: 'Egypt', last4: '12345678' }), /INVALID_LAST4/);
    const bank = saveWithdrawalBank('usr-1', { nickname: 'Cairo bank', currency: 'USD', country: 'Egypt', last4: '4321' });
    assert.equal(bank.last4, '4321');
    const request = requestAccountAction('usr-1', { kind: 'card', currency: 'USD', detail: 'card request' });
    assert.equal(request.status, 'requested');
    assert.equal(JSON.stringify(listAccountRequests('usr-1')).includes('succeeded'), false);
    const books = importRecorded(emptyLedger(), 'owner', [{ currency: 'USD', minor: 5000 }], '2026-10-24T12:00:00Z');
    assert.equal(balanceOf(books, 'sham-platform', 'USD').availableMinor, 5000);
    assert.throws(() => requestAccountAction('guest_client', { kind: 'pay', currency: 'EUR', amountLabel: '1', detail: 'Amina' }), /LOGIN_REQUIRED/);
  } finally {
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else Object.defineProperty(globalThis, 'window', { value: previousWindow, configurable: true });
    if (previousStorage === undefined) delete (globalThis as { localStorage?: unknown }).localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { value: previousStorage, configurable: true });
  }
});
