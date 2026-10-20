import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerCard, renewCardExpiry, requestInstrumentPull, tokenizeCard, tokenizeWalletHandle, tokenizeWalletPhone, assertDisplayOnly } from '../src/utils/paymentElement';
import { getSavedPaymentMethods } from '../src/utils/customerPaymentVault';

test('card entry keeps only brand, last 4 and expiry — never the number or the security code', () => {
  const token = tokenizeCard({ number: '4242 4242 4242 4242', expiry: '12/30', cvc: '123', name: 'Amina Hassan', postal: '12511' }, new Date('2026-10-21'));
  assert.equal(token.brand, 'visa');
  assert.equal(token.last4, '4242');
  assert.equal(token.expMonth, '12');
  assert.equal(JSON.stringify(token).includes('4242424242424242'), false);
  assert.equal(JSON.stringify(token).includes('123'), false);
  assert.throws(() => tokenizeCard({ number: '4242424242424241', expiry: '12/30', cvc: '123', name: 'Amina Hassan' }, new Date('2026-10-21')), /INVALID_NUMBER/);
  assert.throws(() => tokenizeCard({ number: '4242424242424242', expiry: '01/26', cvc: '123', name: 'Amina Hassan' }, new Date('2026-10-21')), /INVALID_EXPIRY/);
  assert.throws(() => tokenizeCard({ number: '378282246310005', expiry: '12/30', cvc: '123', name: 'Amina Hassan' }, new Date('2026-10-21')), /INVALID_CVC/);
  assert.throws(() => assertDisplayOnly('4242424242424242'), /SECRET/);
});

test('a saved card and wallet are tied to a signed-in customer and do not keep the full identifier', () => {
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
  assert.throws(() => registerCard('guest_client', tokenizeCard({ number: '4242424242424242', expiry: '12/30', cvc: '123', name: 'Amina Hassan' }, new Date('2026-10-21')), true), /LOGIN_REQUIRED/);
  const saved = registerCard('usr-1', tokenizeCard({ number: '4242424242424242', expiry: '12/30', cvc: '123', name: 'Amina Hassan' }, new Date('2026-10-21')), true);
  assert.equal(saved.identifier, '•••• 4242');
  assert.equal(JSON.stringify(getSavedPaymentMethods('usr-1')).includes('4242424242424242'), false);
  assert.equal(tokenizeWalletPhone('01012345566').last4, '5566');
  assert.equal(tokenizeWalletHandle('amina@instapay').display.includes('instapay'), true);
  assert.equal(tokenizeWalletHandle('amina@instapay').display.includes('amina@'), false);
  const renewed = renewCardExpiry('usr-1', saved.id, '11/31', new Date('2026-10-21'));
  assert.equal(renewed.expiry, '11/31');
  const pull = requestInstrumentPull('usr-1', saved.id, 'EGP 120');
  assert.equal(pull.status, 'requested');
  assert.equal(JSON.stringify(pull).includes('4242424242424242'), false);
  assert.equal(JSON.stringify(pull).includes('succeeded'), false);
  } finally {
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else Object.defineProperty(globalThis, 'window', { value: previousWindow, configurable: true });
    if (previousStorage === undefined) delete (globalThis as { localStorage?: unknown }).localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { value: previousStorage, configurable: true });
  }
});
