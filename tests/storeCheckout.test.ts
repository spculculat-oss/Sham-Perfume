import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FinanceService } from '../server/finance/service';
import { MemoryStore } from '../server/core/store';
import { emptyRegistration } from '../server/finance/payments';
import { createHmac } from 'node:crypto';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { chargeCurrency, currencyFor, guessCountry, priceIn, quote, shippingCost, shippingZone, tidy, type FxTable, type ShippingTable } from '../src/utils/pricing';
import { kashierConfig, paymentState, verifyWebhook, webhookSignature } from '../server/core/kashier';
import { countryFromHeaders, createCheckoutRouter, readCheckout, safeReturnUrl } from '../server/checkout';
import type { RawProduct } from '../src/utils/storeCatalog';

// Fixed, hand-written tables (never the live rates or the editable shipping file).
const FX: FxTable = { base: 'USD', updatedAt: '2026-10-16T00:00:00Z', rates: { USD: 1, EGP: 50, SAR: 3.75, EUR: 0.9, KWD: 0.31, MYR: 4, GBP: 0.75 } };
const SHIP: ShippingTable = {
  currency: 'USD',
  zones: [
    { id: 'egypt', name: { ar: 'مصر', en: 'Egypt' }, countries: ['EG'], firstItem: 10, extraItem: 2, days: '7-14' },
    { id: 'gulf', name: { ar: 'الخليج', en: 'Gulf' }, countries: ['SA', 'KW'], firstItem: 12, extraItem: 3 },
  ],
  default: { id: 'world', name: { ar: 'العالم', en: 'World' }, firstItem: 20, extraItem: 5 },
};
const RAW: RawProduct[] = [
  { id: 1, sku: 'LAT-001', nameAr: 'لطافة أمير العود', nameEn: 'Lattafa Ameer Al Oudh', descriptionAr: 'عود', descriptionEn: '', category: 'عود', brand: 'Lattafa', supplierPrice: 200, ourPrice: 1000, stockStatus: 'in_stock', imageUrl: '' },
  { id: 2, sku: 'SHM-002', nameAr: 'ورد', nameEn: 'Rose', descriptionAr: 'ورد', descriptionEn: '', category: 'نسائي', brand: 'Shama', supplierPrice: 90, ourPrice: 500, stockStatus: 'in_stock', imageUrl: '' },
  { id: 3, sku: 'OUT-003', nameAr: 'نفد', nameEn: 'Gone', descriptionAr: 'نفد', descriptionEn: '', category: 'عود', brand: 'X', supplierPrice: 90, ourPrice: 500, stockStatus: 'out_of_stock', imageUrl: '' },
];
const KEYS = { KASHIER_MERCHANT_ID: 'MID-123-456', KASHIER_API_KEY: 'test-api-key', KASHIER_SECRET_KEY: 'abc$def', KASHIER_MODE: 'test', SHAM_CHECKOUT_RATE_PER_MIN: '100', SHAM_PUBLIC_API_URL: 'https://engine.example' };

test('pricing: tidy prices, the visitor currency, and Egypt keeps the catalog price', () => {
  assert.equal(tidy(1247), 1250);
  assert.equal(tidy(37.4), 37.5);
  assert.equal(tidy(9.31), 9.35);
  assert.equal(tidy(0), 0);
  assert.equal(currencyFor('SA', FX), 'SAR');
  assert.equal(currencyFor('EG', FX), 'EGP');
  assert.equal(currencyFor('JP', FX), 'USD', 'no rate for JPY in this table → dollars');
  assert.equal(priceIn(1000, 'EGP', FX), 1000);
  assert.equal(priceIn(1000, 'SAR', FX), 75); // 1000 EGP = 20 USD = 75 SAR
  assert.equal(priceIn(1000, 'USD', FX), 20);
});

test('pricing: shipping by zone, first bottle + each extra bottle', () => {
  assert.equal(shippingZone('KW', SHIP).id, 'gulf');
  assert.equal(shippingZone('BR', SHIP).id, 'world');
  assert.equal(shippingCost('EG', 0, SHIP), 0);
  assert.equal(shippingCost('EG', 1, SHIP), 10);
  assert.equal(shippingCost('EG', 3, SHIP), 14);
  assert.equal(shippingCost('FR', 2, SHIP), 25);
});

test('pricing: a quote adds up, in the visitor currency and in EGP', () => {
  const lines = [{ sku: 'A', price: 1000, qty: 2 }, { sku: 'B', price: 500, qty: 1 }];
  const sa = quote(lines, 'SA', { fx: FX, shipping: SHIP });
  assert.equal(sa.currency, 'SAR');
  assert.deepEqual(sa.lines.map((l) => l.subtotal), [150, 37.5]);
  assert.equal(sa.shipping, tidy((12 + 3 * 2) * 3.75)); // 3 bottles to the Gulf
  assert.equal(sa.total, sa.items + sa.shipping);
  const eg = quote(lines, 'SA', { fx: FX, shipping: SHIP, currency: 'EGP' });
  assert.equal(eg.items, 2500);
  assert.equal(eg.shipping, 900); // 18 USD × 50, rounded up to 5
  assert.equal(eg.total, 3400);
  assert.equal(chargeCurrency('SAR', ['EGP']), 'EGP');
  assert.equal(chargeCurrency('EUR', ['EGP', 'EUR']), 'EUR');
});

test('pricing: the country guess prefers the time zone, then the language region', () => {
  assert.equal(guessCountry(['en-US'], 'Africa/Cairo'), 'EG');
  assert.equal(guessCountry(['ar-SA'], ''), 'SA');
  assert.equal(guessCountry(['ar'], 'Mars/Base'), 'EG');
});

test('kashier: configuration needs all three keys and never invents a mode', () => {
  assert.equal(kashierConfig({}), undefined);
  assert.equal(kashierConfig({ ...KEYS, KASHIER_MERCHANT_ID: 'my password' }), undefined);
  const cfg = kashierConfig({ ...KEYS, KASHIER_MODE: 'LIVE', KASHIER_CURRENCIES: 'egp, usd' })!;
  assert.equal(cfg.mode, 'live');
  assert.deepEqual(cfg.currencies, ['EGP', 'USD']);
  assert.equal(kashierConfig(KEYS)!.mode, 'test');
  assert.equal(kashierConfig({ ...KEYS, KASHIER_CURRENCIES: 'EGP,xyz' }), undefined);
  assert.equal(kashierConfig({ ...KEYS, KASHIER_MODE: 'typo' }), undefined);
  assert.equal(paymentState('APPROVED'), 'pending', 'authorization is not collection');
  assert.equal(paymentState('PAID'), 'paid');
  assert.equal(paymentState('EXPIRED'), 'failed');
  assert.equal(paymentState('OPENED'), 'pending');
});

test('kashier: webhook signatures follow the documented recipe', () => {
  const data = { amount: 1, channel: 'online | e-commerce', currency: 'EGP', status: 'SUCCESS', merchantOrderId: 'SP-1', signatureKeys: ['status', 'amount', 'channel', 'currency', 'merchantOrderId'] };
  const payload = 'amount=1&channel=online%20%7C%20e-commerce&currency=EGP&merchantOrderId=SP-1&status=SUCCESS';
  assert.equal(webhookSignature(data, 'k'), createHmac('sha256', 'k').update(payload).digest('hex'));
  assert.equal(verifyWebhook(data, webhookSignature(data, 'k'), 'k'), true);
  assert.equal(verifyWebhook({ ...data, amount: 999 }, webhookSignature(data, 'k'), 'k'), false);
  assert.equal(verifyWebhook(data, undefined, 'k'), false);
});

test('checkout: the form is validated and the return page stays on the site', () => {
  const ok = { items: [{ sku: 'A', qty: 1 }, { sku: 'A', qty: 2 }], country: 'eg', contact: { name: 'Ali', email: 'A@B.co', phone: '01001234567' }, address: { city: 'Giza', line: '12 Nile St' } };
  const read = readCheckout(ok);
  assert.ok(!('error' in read));
  assert.deepEqual(read.items, [{ sku: 'A', qty: 3 }]);
  assert.equal(read.country, 'EG');
  assert.equal(read.contact.email, 'a@b.co');
  assert.deepEqual(readCheckout({ ...ok, items: [] }), { error: 'EMPTY_ORDER' });
  assert.deepEqual(readCheckout({ ...ok, country: 'ZZ' }), { error: 'INVALID_COUNTRY' });
  assert.deepEqual(readCheckout({ ...ok, contact: { ...ok.contact, email: 'x' } }), { error: 'INVALID_EMAIL' });
  assert.deepEqual(readCheckout({ ...ok, address: { city: '', line: '' } }), { error: 'MISSING_ADDRESS' });
  const allowed = new Set(['https://spculculat-oss.github.io']);
  assert.equal(safeReturnUrl('https://spculculat-oss.github.io/Sham-Perfume/?x=1#store', allowed), 'https://spculculat-oss.github.io/Sham-Perfume/');
  assert.equal(safeReturnUrl('https://evil.example/steal', allowed), 'https://spculculat-oss.github.io/Sham-Perfume/');
  assert.equal(countryFromHeaders({ 'x-vercel-ip-country': 'sa' }), 'SA');
  assert.equal(countryFromHeaders({ 'x-vercel-ip-country': 'XX' }), undefined);
});

async function serve(env: Record<string, string>, kashier: (url: string, init?: RequestInit) => Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fake = (async (input: string | URL, init?: RequestInit) => { const url = String(input); calls.push({ url, init }); return kashier(url, init); }) as typeof fetch;
  const app = express();
  app.use(express.json());
  const finance = new FinanceService(new MemoryStore(), env, { fetch: fake });
  await finance.saveRegistration({ ...emptyRegistration(), buyerCountries: ['EG', 'SA'] });
  app.use('/api', createCheckoutRouter({ env, finance, fetch: fake, products: RAW, catalog: async () => undefined, fx: async () => FX, shipping: SHIP }));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  return { base, calls, finance, close: () => server.close() };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const order = { items: [{ sku: 'LAT-001', qty: 2 }], country: 'SA', lang: 'ar', contact: { name: 'Ali', email: 'ali@example.com', phone: '+966500000000' }, address: { city: 'Riyadh', line: 'King Fahd Rd 10' }, returnUrl: 'https://spculculat-oss.github.io/Sham-Perfume/' };

test('checkout: without Kashier keys the store says so (the assistant flow stays)', async () => {
  const s = await serve({}, () => json({}));
  try {
    assert.deepEqual(await (await fetch(`${s.base}/store/payments`)).json(), { enabled: false, country: 'EG', methods: [], direct: [] });
    const r = await fetch(`${s.base}/store/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) });
    assert.equal(r.status, 503);
    assert.equal(s.calls.length, 0);
  } finally { s.close(); }
});

test('checkout: the server prices the cart itself and opens a Kashier session', async () => {
  const s = await serve(KEYS, (url) => (url.endsWith('/v3/payment/sessions') ? json({ _id: 'sess_123456', sessionUrl: 'https://payments.kashier.io/session/sess_123456?mode=test' }) : json({}, 404)));
  try {
    const info = await (await fetch(`${s.base}/store/payments`)).json();
    assert.equal(info.enabled, true);
    assert.equal(info.mode, 'test');
    assert.deepEqual(info.currencies, ['EGP']);
    assert.deepEqual(info.methods.map((m: { id: string }) => m.id), ['card', 'wallet']);
    assert.ok(!JSON.stringify(info).includes('abc$def'), 'no key in public answers');
    // A tampered price in the browser changes nothing: only sku + qty are read.
    const r = await fetch(`${s.base}/store/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...order, items: [{ sku: 'LAT-001', qty: 2, price: 1 }] }) });
    const body = await r.json();
    assert.equal(r.status, 200, JSON.stringify(body));
    assert.equal(body.sessionUrl, 'https://payments.kashier.io/session/sess_123456?mode=test');
    assert.equal(body.charge.currency, 'EGP');
    assert.equal(body.charge.total, 2000 + 750); // 2 × 1000 EGP + (12 + 3) USD shipping × 50
    const sent = JSON.parse(String(s.calls[0].init?.body));
    assert.equal(s.calls[0].url, 'https://test-api.kashier.io/v3/payment/sessions');
    assert.equal((s.calls[0].init?.headers as Record<string, string>).Authorization, 'abc$def');
    assert.equal((s.calls[0].init?.headers as Record<string, string>)['api-key'], 'test-api-key');
    assert.equal(sent.merchantId, 'MID-123-456');
    assert.equal(sent.amount, body.charge.total.toFixed(2));
    assert.equal(sent.currency, 'EGP');
    assert.equal(sent.order, body.ref);
    assert.equal(sent.merchantRedirect, `https://spculculat-oss.github.io/Sham-Perfume/?checkout=${body.ref}`);
    assert.equal(sent.serverWebhook, 'https://engine.example/api/store/kashier/webhook');
    assert.equal(sent.metaData.items, 'LAT-001×2');
    assert.equal(sent.metaData.country, 'SA');
    assert.equal(body.display.currency, 'SAR');
  } finally { s.close(); }
});

test('checkout: unavailable products are refused before Kashier is called', async () => {
  const s = await serve(KEYS, () => json({ _id: 'x', sessionUrl: 'y' }));
  try {
    const r = await fetch(`${s.base}/store/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...order, items: [{ sku: 'OUT-003', qty: 1 }] }) });
    assert.equal(r.status, 409);
    assert.equal(s.calls.length, 0);
  } finally { s.close(); }
});

test('checkout: the result is matched to the ledger and test payments never notify fulfilment', async () => {
  const env = { ...KEYS, SHAM_WEBHOOK_URL: 'https://hooks.example/sham' };
  const s = await serve(env, (url) => (url.includes('/payment/sessions/sess_123456/payment')
    ? json({ message: 'success', data: { status: 'PAID', merchantOrderId: 'SP-1', amount: '2900.00', currency: 'EGP', method: 'card', metaData: { items: 'LAT-001×2', name: 'Ali' } } })
    : json({ ok: true })));
  try {
    await seed(s.finance, 'SP-1');
    const first = await (await fetch(`${s.base}/store/checkout/sess_123456`)).json();
    assert.deepEqual(first, { ref: 'SP-1', state: 'paid', status: 'PAID', amount: 2900, currency: 'EGP', mode: 'test' });
    await fetch(`${s.base}/store/checkout/sess_123456`);
    assert.equal(s.calls.filter((c) => c.url === env.SHAM_WEBHOOK_URL).length, 0);
    assert.equal((await fetch(`${s.base}/store/checkout/bad id!`)).status, 400);
  } finally { s.close(); }
});

test('checkout: webhooks are accepted only with a valid Kashier signature', async () => {
  const s = await serve({ ...KEYS, SHAM_WEBHOOK_URL: 'https://hooks.example/sham' }, () => json({ data: { status: 'PAID', merchantOrderId: 'SP-2', amount: 2900, currency: 'EGP' } }));
  await seed(s.finance, 'SP-2');
  try {
    const data = { amount: 2900, currency: 'EGP', status: 'SUCCESS', merchantOrderId: 'SP-2', signatureKeys: ['amount', 'currency', 'merchantOrderId', 'status'] };
    const send = (signature: string) => fetch(`${s.base}/store/kashier/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-kashier-signature': signature }, body: JSON.stringify({ event: 'pay', data }) });
    assert.equal((await send('0'.repeat(64))).status, 401);
    assert.equal(s.calls.length, 0);
    assert.equal((await send(webhookSignature(data, KEYS.KASHIER_API_KEY))).status, 200);
    assert.equal(s.calls.length, 1, 'the provider is re-read; a test payment never triggers fulfilment');
    assert.ok(s.calls[0].url.endsWith('/sess_123456/payment'));
    assert.equal((await s.finance.store.list('financeEntries')).length, 1);
  } finally { s.close(); }
});

async function seed(finance: FinanceService, ref: string) {
  await finance.recordOrder({ ref, provider: 'kashier', mode: 'test', country: 'SA', currency: 'EGP', totalMinor: 290000, shippingChargedMinor: 75000, lines: [{ sku: 'LAT-001', qty: 2, unitMinor: 107500 }] });
  await finance.recordSession(ref, 'test', 'sess_123456');
}
