import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DIRECT_PURCHASE_EVENT, readDirectPurchase, requestDirectPurchase, takeDirectPurchase } from '../src/utils/directPurchase';
import { addToCart, readCart, removePurchasedItems } from '../src/utils/storeCart';
import { startCheckout, returnedPayment, CheckoutError } from '../src/utils/storeCheckout';
import { storeText } from '../src/لغات/storeL10n';
import { SUPPORTED_LANGUAGES } from '../src/types/i18n';
function browser() {
  const local = new Map<string, string>(); const session = new Map<string, string>(); const events: string[] = [];
  const storage = (map: Map<string, string>) => ({ getItem: (k: string) => map.get(k) || null, setItem: (k: string, v: string) => map.set(k, v), removeItem: (k: string) => map.delete(k) });
  const original = new Map(['window', 'localStorage', 'sessionStorage', 'location', 'history', 'fetch'].map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  const location = { origin: 'https://shop.example', pathname: '/', search: '', hash: '#store', assign: (_url: string) => {} };
  for (const [k, value] of Object.entries({ window: { location, dispatchEvent: (e: Event) => { events.push(e.type); } }, location, localStorage: storage(local), sessionStorage: storage(session), history: { replaceState: (_a: unknown, _b: unknown, _c: unknown) => {} } })) Object.defineProperty(globalThis, k, { configurable: true, writable: true, value });
  return { local, session, events, location, restore() { for (const [k, desc] of original) { if (desc) Object.defineProperty(globalThis, k, desc); else delete (globalThis as any)[k]; } } };
}
test('buy now hands off only SKU and selected quantity, once, without changing the existing basket', () => {
  const b = browser();
  try {
    addToCart('IN-BASKET', 3); assert.equal(requestDirectPurchase('BUY-NOW', 2), true);
    assert.deepEqual(readCart(), { 'IN-BASKET': 3 }); assert.equal(b.location.hash, '#store'); assert.ok(b.events.includes(DIRECT_PURCHASE_EVENT));
    const intent = takeDirectPurchase(); assert.equal(intent?.sku, 'BUY-NOW'); assert.equal(intent?.qty, 2); assert.equal(takeDirectPurchase(), undefined);
    assert.deepEqual(Object.keys(intent!).sort(), ['at', 'qty', 'sku']);
  } finally { b.restore(); }
});
test('buy-now intent rejects stale, future and invalid quantities instead of constructing payment data', () => {
  for (const value of [null, { sku: 'A', qty: 0, at: 100 }, { sku: 'A', qty: 100, at: 100 }, { sku: 'A', qty: 1.5, at: 100 }, { sku: 'A', qty: 1, at: 1001 }, { sku: '', qty: 1, at: 100 }]) assert.equal(readDirectPurchase(value, 1000), undefined);
  assert.equal(readDirectPurchase({ sku: 'A', qty: 1, at: 0 }, 16 * 60000), undefined);
});
test('cart confirmation removes only purchased quantities, keeping later additions and other products', () => {
  const b = browser();
  try { addToCart('A', 4); addToCart('B', 2); removePurchasedItems([{ sku: 'A', qty: 2 }]); assert.deepEqual(readCart(), { A: 2, B: 2 }); }
  finally { b.restore(); }
});
test('direct checkout submits only the chosen item, records no fake success, and preserves the basket on API failure', async () => {
  const b = browser(); let sent: any;
  try {
    addToCart('OLD', 3);
    globalThis.fetch = (async (_url, init) => { sent = JSON.parse(String(init?.body)); return new Response(JSON.stringify({ code: 'FAILED' }), { status: 502 }); }) as typeof fetch;
    await assert.rejects(() => startCheckout([{ sku: 'NEW', qty: 2 }], 'EG', { name: 'Test', phone: '01000000000', email: 'test@example.com', city: 'Giza', line: 'A street' }, 'ar', 'card', 'direct'), CheckoutError);
    assert.deepEqual(sent.items, [{ sku: 'NEW', qty: 2 }]); assert.equal(sent.method, 'card'); assert.ok(!('amount' in sent));
    assert.deepEqual(readCart(), { OLD: 3 }); assert.equal(b.local.has('sham-store-pending-payment'), false);
  } finally { b.restore(); }
});
test('verified direct return never consumes the basket; sandbox or forged return cannot clear it either', async () => {
  const b = browser();
  try {
    addToCart('OLD', 3); b.location.search = '?checkout=SP-BUY';
    for (const mode of ['live', 'test']) {
      b.local.set('sham-store-pending-payment', JSON.stringify({ ref: 'SP-BUY', sessionId: 'session_123', context: 'direct', items: [{ sku: 'NEW', qty: 2 }] }));
      globalThis.fetch = (async () => new Response(JSON.stringify({ ref: 'SP-BUY', state: 'paid', mode }))) as typeof fetch;
      const result = await returnedPayment(); assert.equal(result?.state, 'paid'); assert.equal(result?.cartItems, undefined); assert.deepEqual(readCart(), { OLD: 3 });
    }
    b.local.set('sham-store-pending-payment', JSON.stringify({ ref: 'SP-BUY', sessionId: 'session_123', context: 'cart', items: [{ sku: 'OLD', qty: 3 }] }));
    globalThis.fetch = (async () => new Response(JSON.stringify({ ref: 'SP-WRONG', state: 'paid', mode: 'live' }))) as typeof fetch;
    assert.equal((await returnedPayment())?.state, 'pending'); assert.deepEqual(readCart(), { OLD: 3 });
  } finally { b.restore(); }
});
test('buy now is translated with a safe English fallback and exposed beside both product add buttons', () => {
  assert.equal(storeText('ar', 'sf_buy_now'), 'شراء مباشر'); assert.equal(storeText('en', 'sf_buy_now'), 'Buy now');
  for (const lang of SUPPORTED_LANGUAGES) assert.notEqual(storeText(lang.code, 'sf_buy_now'), 'sf_buy_now');
  for (const [file, ids] of [['Storefront', ['store-buy-now', 'store-add-to-cart']], ['ProductDetail', ['product-buy-now', 'product-add-to-cart']]] as const) {
    const src = readFileSync(new URL(`../src/components/${file}.tsx`, import.meta.url), 'utf8');
    for (const id of ids) assert.ok(src.includes(`data-testid="${id}"`));
    assert.ok(!src.includes("status: 'succeeded'")); assert.ok(!src.includes("state: 'paid'"));
  }
  const store = readFileSync(new URL('../src/components/Storefront.tsx', import.meta.url), 'utf8');
  for (const file of ['PaymentEnvironmentModal', 'UserProfilePage']) {
    const source = readFileSync(new URL(`../src/components/${file}.tsx`, import.meta.url), 'utf8');
    assert.ok(!source.includes('PCI-DSS Level 1')); assert.ok(!source.includes('1-click checkout'));
  }
  assert.ok(!store.includes('cardNumInput')); assert.ok(!store.includes('cardExpInput')); assert.match(store, /result\.mode === 'live'/);
});

test('malformed pending storage never confirms payment or consumes the basket', async () => {
  const b = browser();
  try {
    addToCart('OLD', 3); b.location.search = '?checkout=SP-BUY';
    for (const raw of ['null', '[]', 'true', '123', '{bad json']) {
      b.local.set('sham-store-pending-payment', raw);
      assert.deepEqual(await returnedPayment(), { ref: 'SP-BUY', state: 'pending' });
      assert.deepEqual(readCart(), { OLD: 3 });
    }
  } finally { b.restore(); }
});
