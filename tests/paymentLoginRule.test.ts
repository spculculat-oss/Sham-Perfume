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

/** Owner's rule (2026-10-24): no payment without signing in to a real account. No free/demo/guest way around it. */

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

test('server: a payment cannot start without a signed-in account', async () => {
  const finance = new FinanceService(new Durable(), {}, { fetch: offline });
  const bank = new BankService(finance, {}, offline);
  const acc = await bank.saveAccount(undefined, instapay);
  const fx = async () => ({ base: 'USD', updatedAt: '2026-10-20T00:00:00Z', rates: { EGP: 50, USD: 1 } });
  const app = express(); app.use(express.json());
  app.use('/visitor/api', createCheckoutRouter({ finance, bank, env: {}, products, catalog: async () => undefined, fx, customer: async () => undefined }));
  app.use('/member/api', createCheckoutRouter({ finance, bank, env: {}, products, catalog: async () => undefined, fx, customer: async (req) => (req.headers.authorization ? { id: 'u_1' } : undefined) }));
  const server = app.listen(0); const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (path: string, headers: Record<string, string> = {}) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(order(acc.id)) });
  try {
    const visitor = await post('/visitor/api/store/checkout/direct');
    assert.equal(visitor.status, 401);
    assert.equal((await visitor.json() as { code: string }).code, 'LOGIN_REQUIRED');
    assert.equal((await finance.store.list('financeOrders')).length, 0, 'nothing is reserved for a visitor');
    assert.equal((await post('/member/api/store/checkout/direct')).status, 401, 'no session header');
    assert.equal((await post('/member/api/store/checkout/direct', { Authorization: 'Bearer real' })).status, 201, 'a signed-in customer pays');
  } finally { server.close(); }
});

test('live app wires the account check into checkout', () => {
  const app = readFileSync('server/app.ts', 'utf8');
  assert.match(app, /customer: async \(req\) => community\.userFrom\(req\)/);
  const site = readFileSync('src/App.tsx', 'utf8');
  assert.doesNotMatch(site, /signedIn=\{Boolean\(currentUser\)\}/, 'the store must not treat any local profile as signed in');
});
