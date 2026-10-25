import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { freeShippingAbove, priceIn, quote, shipsFree, type FxTable, type ShippingTable } from '../src/utils/pricing';
import { freeShippingOffer, freeShippingSentence } from '../src/utils/freeShipping';

// Hand-written tables — never the live rates or the editable shipping file.
const FX: FxTable = { base: 'USD', updatedAt: '2026-10-25T00:00:00Z', rates: { USD: 1, EGP: 50, SAR: 3.75, EUR: 0.9 } };
const ZONES = {
  zones: [{ id: 'egypt', name: { ar: 'مصر', en: 'Egypt' }, countries: ['EG'], firstItem: 10, extraItem: 2, days: '7-14' }],
  default: { id: 'world', name: { ar: 'العالم', en: 'World' }, firstItem: 20, extraItem: 5 },
};
/** The merchant approved nothing: no free-shipping key at all. */
const NO_OFFER: ShippingTable = { currency: 'USD', ...ZONES };
/** The merchant approved free shipping from 500 EGP of goods. */
const OFFER_500: ShippingTable = { currency: 'USD', ...ZONES, freeShippingAboveEgp: 500 };

test('no approved offer: nothing is promised and shipping is still charged', () => {
  assert.equal(freeShippingAbove(NO_OFFER), null);
  assert.equal(freeShippingOffer(NO_OFFER), null);
  assert.equal(shipsFree(100000, NO_OFFER), false, 'a huge order does not invent an offer');
  const bill = quote([{ sku: 'A', price: 600, qty: 1 }], 'EG', { fx: FX, shipping: NO_OFFER });
  assert.equal(bill.items, 600);
  assert.ok(bill.shipping > 0, 'no offer → the zone price is charged');
  assert.equal(bill.freeShipping, false);
  assert.equal(bill.freeShippingAboveEgp, null);
  assert.equal(bill.total, bill.items + bill.shipping);
});

test('the approved offer really drops the shipping, on the client and on the server (one quote)', () => {
  const below = quote([{ sku: 'A', price: 400, qty: 1 }], 'EG', { fx: FX, shipping: OFFER_500 });
  assert.equal(below.items, 400);
  assert.equal(below.shipping, 500, '10 USD × 50 EGP, rounded up to 5');
  assert.equal(below.freeShipping, false);

  const atThreshold = quote([{ sku: 'A', price: 500, qty: 1 }], 'EG', { fx: FX, shipping: OFFER_500 });
  assert.equal(atThreshold.freeShipping, true, 'the threshold itself counts');
  assert.equal(atThreshold.shipping, 0);
  assert.equal(atThreshold.total, atThreshold.items);

  const above = quote([{ sku: 'A', price: 300, qty: 2 }], 'EG', { fx: FX, shipping: OFFER_500 });
  assert.equal(above.items, 600);
  assert.equal(above.shipping, 0);
  assert.equal(above.freeShippingAboveEgp, 500);
  assert.equal(above.total, 600);
});

test('the rule is the catalog value in EGP, so every display currency reaches it the same way', () => {
  const lines = [{ sku: 'A', price: 600, qty: 1 }];
  for (const currency of ['EGP', 'USD', 'SAR', 'EUR']) {
    const bill = quote(lines, 'EG', { fx: FX, shipping: OFFER_500, currency });
    assert.equal(bill.freeShipping, true, currency);
    assert.equal(bill.shipping, 0, currency);
  }
  // A cart under the threshold pays in its own currency and stays unavailable for the offer.
  const small = quote([{ sku: 'A', price: 100, qty: 1 }], 'SA', { fx: FX, shipping: OFFER_500 });
  assert.equal(small.currency, 'SAR');
  assert.equal(small.freeShipping, false);
  assert.equal(small.shipping, 75, 'the default zone 20 USD → 3.75 SAR/USD');
});

test('the offer is shown in the visitor’s currency, formatted by the store itself', () => {
  const offer = freeShippingOffer(OFFER_500);
  assert.deepEqual(offer, { thresholdEgp: 500 });
  assert.equal(priceIn(offer!.thresholdEgp, 'EGP', FX), 500, 'Egypt keeps the catalog amount');
  assert.equal(priceIn(offer!.thresholdEgp, 'USD', FX), 10); // 500 EGP = 10 USD
  assert.equal(priceIn(offer!.thresholdEgp, 'SAR', FX), 37.5);
  assert.equal(freeShippingSentence(null, '٥٠٠ جنيه', 'ar'), '', 'no offer → no line at all');
});

test('the free-shipping line is written in the visitor’s own language', () => {
  const offer = freeShippingOffer(OFFER_500);
  assert.equal(freeShippingSentence(offer, '٥٠٠ جنيه', 'ar'), 'شحن مجاني للطلبات فوق ٥٠٠ جنيه');
  assert.equal(freeShippingSentence(offer, '$10.00', 'en'), 'Free shipping on orders over $10.00');
  assert.equal(freeShippingSentence(offer, '37,50 SAR', 'fr'), 'Livraison offerte dès 37,50 SAR');
  assert.equal(freeShippingSentence(offer, '500,00 EGP', 'de'), 'Kostenloser Versand ab 500,00 EGP');
  assert.equal(freeShippingSentence(offer, '¥1,500', 'ja'), 'Free shipping on orders over ¥1,500', 'a language with no line yet reads English');
  assert.ok(freeShippingSentence(offer, '500', 'ur').includes('شحن مجاني'), 'an Arabic-script language reads the Arabic line');
  const languages = ['ar', 'en', 'fr', 'es', 'it', 'de', 'ru', 'zh', 'tr', 'fa', 'is', 'sq', 'ps'] as const;
  for (const lang of languages) {
    const line = freeShippingSentence(offer, 'X', lang);
    assert.ok(line.includes('X'), `${lang} keeps the amount`);
    if (lang !== 'ar' && lang !== 'fa' && lang !== 'ps') {
      assert.ok(!/[\u0600-\u06FF]/.test(line), `${lang} is written in its own script`);
    }
  }
});

test('a broken or dishonest threshold is treated as no offer, never as free shipping', () => {
  for (const bad of [0, -500, Number.NaN, Number.POSITIVE_INFINITY, 'abc', null] as unknown[]) {
    const table = { currency: 'USD', ...ZONES, freeShippingAboveEgp: bad } as ShippingTable;
    assert.equal(freeShippingAbove(table), null, String(bad));
    assert.equal(freeShippingOffer(table), null, String(bad));
    const bill = quote([{ sku: 'A', price: 10000, qty: 1 }], 'EG', { fx: FX, shipping: table });
    assert.equal(bill.freeShipping, false, String(bad));
    assert.ok(bill.shipping > 0, String(bad));
  }
});

test('an empty cart never ships free (there is nothing to ship)', () => {
  const bill = quote([], 'EG', { fx: FX, shipping: OFFER_500 });
  assert.equal(bill.items, 0);
  assert.equal(bill.shipping, 0);
  assert.equal(bill.freeShipping, false);
});

test('the live shipping file is honest today: the banner only promises what the table approves', () => {
  const live = JSON.parse(readFileSync(new URL('../src/data/shipping.json', import.meta.url), 'utf8')) as ShippingTable;
  const offer = freeShippingOffer(live);
  if (offer) {
    const bill = quote([{ sku: 'A', price: offer.thresholdEgp, qty: 1 }], 'EG', { fx: FX, shipping: live });
    assert.equal(bill.freeShipping, true, 'a live threshold must really be honoured at checkout');
    assert.equal(bill.shipping, 0);
  } else {
    const bill = quote([{ sku: 'A', price: 10000, qty: 1 }], 'EG', { fx: FX, shipping: live });
    assert.equal(bill.freeShipping, false, 'no live policy → no order ships free');
    assert.ok(bill.shipping > 0);
  }
});

test('no visitor screen promises free shipping on its own — the words come only from the rule', () => {
  const root = fileURLToPath(new URL('../src/', import.meta.url));
  const files = (readdirSync(root, { recursive: true }) as string[]).filter((f) => f.endsWith('.tsx'));
  assert.ok(files.length > 50, 'the whole visitor UI was really scanned');
  const offenders: string[] = [];
  for (const file of files) {
    const code = readFileSync(root + file, 'utf8');
    code.split('\n').forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return; // a comment is not a promise
      if (/شحن مجاني|free shipping|livraison offerte|kostenloser versand/i.test(line)) offenders.push(`${file}:${index + 1} ${trimmed.slice(0, 120)}`);
    });
  }
  assert.deepEqual(offenders, [], 'a fixed free-shipping sentence would drift away from shipping.json');
});
