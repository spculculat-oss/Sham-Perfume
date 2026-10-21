import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cardLiveCopy, inspectCardEntry, inspectExpiry, inspectWalletEntry, registerCard, registerWallet, renewCardExpiry, requestInstrumentPull, savedCardExpired, tokenizeCard, tokenizeWalletHandle, tokenizeWalletPhone, assertDisplayOnly, walletEntryBlocked } from '../src/utils/paymentElement';

const FIXTURE_VISA = '4916338506082832';
const FIXTURE_AMEX = '3742454554001269';
import { getSavedPaymentMethods } from '../src/utils/customerPaymentVault';

test('card entry keeps only brand, last 4 and expiry — never the number or the security code', () => {
  const token = tokenizeCard({ number: FIXTURE_VISA, expiry: '12/30', cvc: '123', name: 'Amina Hassan', postal: '12511' }, new Date('2026-10-21'));
  assert.equal(token.brand, 'visa');
  assert.equal(token.last4, '2832');
  assert.equal(token.expMonth, '12');
  assert.equal(JSON.stringify(token).includes(FIXTURE_VISA), false);
  assert.equal(JSON.stringify(token).includes('123'), false);
  assert.throws(() => tokenizeCard({ number: '4916338506082833', expiry: '12/30', cvc: '123', name: 'Amina Hassan' }, new Date('2026-10-21')), /INVALID_NUMBER/);
  assert.throws(() => tokenizeCard({ number: FIXTURE_VISA, expiry: '01/26', cvc: '123', name: 'Amina Hassan' }, new Date('2026-10-21')), /INVALID_EXPIRY/);
  assert.throws(() => tokenizeCard({ number: FIXTURE_AMEX, expiry: '12/30', cvc: '123', name: 'Amina Hassan' }, new Date('2026-10-21')), /INVALID_CVC/);
  assert.throws(() => tokenizeCard({ number: '4242424242424242', expiry: '12/30', cvc: '123', name: 'Amina Hassan' }, new Date('2026-10-21')), /TEST_NUMBER/);
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
  assert.throws(() => registerCard('guest_client', tokenizeCard({ number: FIXTURE_VISA, expiry: '12/30', cvc: '123', name: 'Amina Hassan' }, new Date('2026-10-21')), true), /LOGIN_REQUIRED/);
  const saved = registerCard('usr-1', tokenizeCard({ number: FIXTURE_VISA, expiry: '12/30', cvc: '123', name: 'Amina Hassan' }, new Date('2026-10-21')), true);
  assert.equal(saved.identifier, '•••• 2832');
  assert.equal(JSON.stringify(getSavedPaymentMethods('usr-1')).includes(FIXTURE_VISA), false);
  assert.equal(tokenizeWalletPhone('01012345566').last4, '5566');
  assert.equal(tokenizeWalletHandle('amina@instapay').display.includes('instapay'), true);
  assert.equal(tokenizeWalletHandle('amina@instapay').display.includes('amina@'), false);
  const renewed = renewCardExpiry('usr-1', saved.id, '11/31', new Date('2026-10-21'));
  assert.equal(renewed.expiry, '11/31');
  const pull = requestInstrumentPull('usr-1', saved.id, 'EGP 120');
  assert.equal(pull.status, 'requested');
  assert.equal(JSON.stringify(pull).includes(FIXTURE_VISA), false);
  assert.equal(JSON.stringify(pull).includes('succeeded'), false);
  } finally {
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else Object.defineProperty(globalThis, 'window', { value: previousWindow, configurable: true });
    if (previousStorage === undefined) delete (globalThis as { localStorage?: unknown }).localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { value: previousStorage, configurable: true });
  }
});

test('instant card check tells dummy, rejected, and expired apart, and never calls a format-valid card active', () => {
  const now = new Date('2026-10-21');
  assert.equal(inspectCardEntry('', '', now).verdict, 'empty');
  assert.equal(inspectCardEntry('4916', '', now).verdict, 'typing');
  assert.equal(inspectCardEntry('424242', '', now).verdict, 'dummy');
  assert.equal(inspectCardEntry('4242424242424242', '12/30', now).verdict, 'dummy');
  assert.equal(inspectCardEntry('0000000000000000', '12/30', now).verdict, 'dummy');
  assert.equal(inspectCardEntry('4916338506082833', '12/30', now).verdict, 'invalid');
  assert.equal(inspectCardEntry(FIXTURE_VISA, '01/26', now).verdict, 'expired');
  const accepted = inspectCardEntry(FIXTURE_VISA, '12/30', now);
  assert.equal(accepted.verdict, 'format_ok');
  assert.equal(accepted.brand, 'visa');
  assert.equal(cardLiveCopy('format_ok', 'ar').includes('لم يُؤكد'), true);
  assert.equal(cardLiveCopy('format_ok', 'ar').includes('مفعّلة'), false);
  assert.equal(JSON.stringify(accepted).includes(FIXTURE_VISA), false);
});

test('expiry, a saved card, and a wallet are checked instantly and a dummy wallet is not stored', () => {
  const now = new Date('2026-10-21');
  assert.equal(inspectExpiry('01/26', now), 'expired');
  assert.equal(inspectExpiry('12/30', now), 'ok');
  assert.equal(savedCardExpired('01/26', now), true);
  assert.equal(savedCardExpired('12/30', now), false);
  assert.equal(inspectWalletEntry('00000000', 'phone').verdict, 'dummy');
  assert.equal(inspectWalletEntry('01012345566', 'phone').verdict, 'format_ok');
  assert.equal(inspectWalletEntry('test@instapay', 'handle').verdict, 'dummy');
  assert.equal(inspectWalletEntry('amina@instapay', 'handle').verdict, 'format_ok');
  assert.equal(walletEntryBlocked('00000000', 'phone'), true);
  assert.throws(() => registerWallet('usr-1', {
    provider: 'vodafone_cash', title: 'فودافون كاش', titleEn: 'Vodafone Cash', type: 'wallet', holderName: 'Amina', phone: '00000000', consent: true,
  }), /TEST_WALLET/);
});
