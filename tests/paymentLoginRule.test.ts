import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { MemoryStore } from '../server/core/store';
import { FinanceService } from '../server/finance/service';
import { BankService } from '../server/finance/bank';
import { createCheckoutRouter } from '../server/checkout';
import { isVerifiedCustomer } from '../src/utils/paymentAccess';

/** قرار دولة المنصة (مهمة #272/#318، الاجتماع اليومي 2026-10-24): الدفع المباشر عبر «بنك شام»
 * (إنستاباي، تحويل بنكي، محفظة، الدفع عند الاستلام) متاح للزائر بدون حساب، والتاجر يؤكد الدفع بعد ما يشوف الفلوس.
 * الدفع عبر بوابة كاشير ما زال يحتاج حساباً مسجلاً ومؤكداً.
 */

class Durable extends MemoryStore { override readonly persistent = true; }
const offline = (async () => { throw new Error('no network'); }) as typeof fetch;
const instapay = { kind: 'instapay', label: 'إنستاباي شام', instructions: 'حوّل على عنوان إنستاباي sham@instapay واكتب رقم الطلب في الملاحظة.', currencies: ['EGP'], countries: ['EG'] };
const products = [{ id: 1, sku: 'OUD-1', nameAr: 'عود', nameEn: 'Oud', descriptionAr: 'عود', descriptionEn: '', category: 'عود', brand: 'Sham', supplierPrice: 200, ourPrice: 1000, stockStatus: 'in_stock', imageUrl: '' }];
const order = (account: string) => ({ items: [{ sku: 'OUD-1', qty: 1 }], country: 'EG', lang: 'ar', account, contact: { name: 'منى', email: 'mona@example.com', phone: '01000000000' }, address: { city: 'الجيزة', line: 'شارع الهرم 10' } });

test('payment access: only a server-verified account pays (demo, guest and device-only profiles never do)', () => {
  const real = { id: 'u_abc123', email: 'mona@example.com' };
  assert.equal(isVerifiedCustomer(real, 'session-token'), true);
  assert.equal(isVerifiedCustomer(real, ''), false, 'no server session → no payment');
  assert.equal(isVerifiedCustomer({ id: 'usr-1790000000000', email: 'any@example.com' }, 'session-token'), false, 'made in this browser only');
  assert.equal(isVerifiedCustomer({ id: 'guest_client', email: 'g@example.com' }, 'session-token'), false);
  assert.equal(isVerifiedCustomer({ id: 'u_abc', email: '' }, 'session-token'), false);
  assert.equal(isVerifiedCustomer(null, 'session-token'), false);
});

test('sign-in window: the free demo login is gone', () => {
  const modal = readFileSync('src/components/AuthModal.tsx', 'utf8');
  assert.doesNotMatch(modal, /handleDemoLogin|demo_login|sham123456|perfumer@sham\.com/);
});

test('server: direct checkout works for a visitor; gateway checkout still needs an account', async () => {
  const finance = new FinanceService(new Durable(), {}, { fetch: offline });
  const bank = new BankService(finance, {}, offline);
  const acc = await bank.saveAccount(undefined, instapay);
  const fx = async () => ({ base: 'USD', updatedAt: '2026-10-20T00:00:00Z', rates: { EGP: 50, USD: 1 } });
  const kashierEnv = { KASHIER_MERCHANT_ID: 'MID-1-1', KASHIER_API_KEY: 'test-key', KASHIER_SECRET_KEY: 'test-secret', KASHIER_MODE: 'test' };
  const app = express(); app.use(express.json());
  app.use('/api', createCheckoutRouter({ finance, bank, env: kashierEnv, products, catalog: async () => undefined, fx, customer: async () => undefined }));
  const server = app.listen(0); const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (path: string) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order(acc.id)) });
  try {
    // الدفع المباشر («بنك شام»): الزائر يقنع الطلب والتاجر يؤكد الدفع لاحقًا — لا حساب مطلوب.
    const direct = await post('/api/store/checkout/direct');
    assert.equal(direct.status, 201, 'direct checkout reserved for a visitor');
    assert.equal((await finance.store.list('financeOrders')).length, 1, 'the visitor order is reserved');
    // الدفع عبر البوابة (كاشير): ما زال يحتاج حساباً مسجلاً ومؤكداً.
    const gateway = await post('/api/store/checkout');
    assert.equal(gateway.status, 401, 'gateway checkout requires sign-in');
    assert.equal((await gateway.json() as { code: string }).code, 'LOGIN_REQUIRED');
  } finally { server.close(); }
});

test('live app wires the account check into checkout', () => {
  const app = readFileSync('server/app.ts', 'utf8');
  assert.match(app, /customer: async \(req\) => community\.userFrom\(req\)/);
  const site = readFileSync('src/App.tsx', 'utf8');
  assert.doesNotMatch(site, /signedIn=\{Boolean\(currentUser\)\}/, 'the store must not treat any local profile as signed in');
});
