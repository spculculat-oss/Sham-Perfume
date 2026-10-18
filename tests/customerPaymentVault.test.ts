import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getSavedPaymentMethods,
  savePaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  getDefaultPaymentMethod,
  recordPaymentTransaction,
  getPaymentTransactions,
  detectCardBrand,
  formatCardNumber,
  formatExpiry,
  type PaymentProvider,
} from '../src/utils/customerPaymentVault';

test('customer payment vault: card brand detection identifies Visa, Mastercard, Mada, Meeza and AMEX', () => {
  assert.equal(detectCardBrand('4242424242424242'), 'visa');
  assert.equal(detectCardBrand('5123456789012345'), 'mastercard');
  assert.equal(detectCardBrand('5888451234567890'), 'mada');
  assert.equal(detectCardBrand('5078123456789012'), 'meeza');
  assert.equal(detectCardBrand('378282246310005'), 'amex');
});

test('customer payment vault: formatting card numbers and expiry dates', () => {
  assert.equal(formatCardNumber('4242424242424242'), '4242 4242 4242 4242');
  assert.equal(formatExpiry('1228'), '12/28');
  assert.equal(formatExpiry('0526'), '05/26');
});

test('customer payment vault: full customer lifecycle - save, set default, transactions and delete', () => {
  // Polyfill window and localStorage if running in Node test runner
  if (typeof globalThis.window === 'undefined') {
    const store = new Map<string, string>();
    (globalThis as any).window = {
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    (globalThis as any).localStorage = {
      getItem: (k: string) => store.get(k) || null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
    };
  }

  const customerId = 'cust_test_vip_99';

  // 1. Initially contains the 4 standard preview payment services
  const initial = getSavedPaymentMethods(customerId);
  assert.equal(initial.length, 4);

  // 2. Save a Visa card
  const visaCard = savePaymentMethod(
    {
      customerId,
      type: 'card',
      title: 'فيزا بنك مصر البلاتينية',
      titleEn: 'Banque Misr Platinum Visa',
      provider: 'visa',
      identifier: '•••• •••• •••• 1122',
      holderName: 'أحمد فؤاد',
      expiry: '08/29',
      isDefault: true,
      metadata: { last4: '1122', brandName: 'Visa' },
    },
    customerId
  );
  assert.ok(visaCard.id);
  assert.equal(visaCard.isDefault, true);

  // 3. Save a smart wallet (Vodafone Cash)
  const vfWallet = savePaymentMethod(
    {
      customerId,
      type: 'wallet',
      title: 'فودافون كاش',
      titleEn: 'Vodafone Cash',
      provider: 'vodafone_cash',
      identifier: '010 •••• 5566',
      holderName: 'أحمد فؤاد',
      isDefault: false,
      metadata: { phone: '01012345566' },
    },
    customerId
  );
  assert.ok(vfWallet.id);

  // 4. Save InstaPay account
  const instaPay = savePaymentMethod(
    {
      customerId,
      type: 'instapay',
      title: 'إنستاباي اللحظي',
      titleEn: 'InstaPay Direct',
      provider: 'instapay',
      identifier: 'ahmed@instapay',
      holderName: 'أحمد فؤاد',
      isDefault: false,
      metadata: { ipaHandle: 'ahmed@instapay' },
    },
    customerId
  );
  assert.ok(instaPay.id);

  // 5. Save Tabby BNPL installment method
  const tabbyBnpl = savePaymentMethod(
    {
      customerId,
      type: 'bnpl',
      title: 'تابي (4 دفعات بدون فوائد)',
      titleEn: 'Tabby (4 Payments)',
      provider: 'tabby',
      identifier: 'مؤهل للتقسيط 4 دفعات',
      holderName: 'أحمد فؤاد',
      isDefault: false,
      metadata: { installmentsCount: 4 },
    },
    customerId
  );
  assert.ok(tabbyBnpl.id);

  // Verify list (4 seed + 4 newly added)
  const list = getSavedPaymentMethods(customerId);
  assert.equal(list.length, 8);

  // 6. Change default method to Tabby
  setDefaultPaymentMethod(tabbyBnpl.id, customerId);
  const updatedDefault = getDefaultPaymentMethod(customerId);
  assert.equal(updatedDefault?.id, tabbyBnpl.id);

  // 7. Record payment transaction
  const tx = recordPaymentTransaction(
    {
      customerId,
      orderRef: 'SP-ORD-2026-TEST',
      amount: 1450,
      currency: 'EGP',
      paymentMethodId: tabbyBnpl.id,
      paymentMethodTitle: 'تابي (4 دفعات بدون فوائد)',
      provider: 'tabby',
      status: 'succeeded',
      authCode: 'AUTH-TEST-7788',
    },
    customerId
  );
  assert.ok(tx.id);
  assert.equal(tx.status, 'succeeded');
  assert.equal(tx.amount, 1450);

  const txs = getPaymentTransactions(customerId);
  assert.equal(txs.length, 1);
  assert.equal(txs[0].orderRef, 'SP-ORD-2026-TEST');

  // 8. Delete a method
  deletePaymentMethod(vfWallet.id, customerId);
  const remaining = getSavedPaymentMethods(customerId);
  assert.equal(remaining.length, 7);
  assert.ok(!remaining.some((m) => m.id === vfWallet.id));
});
