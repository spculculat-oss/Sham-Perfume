// #169 — the mobile purchase journey: one country and one currency on every screen, a checkout that goes to
// the order (never to the chat), and product photos that never leave a blank box. The pricing rule itself
// (product × 1.5 + shipping per country) is untouched: these tests only read it.
import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { BUNDLED_FX, COUNTRY_CODES, currencyFor, priceIn, quote, tidy } from '../src/utils/pricing';
import { alignEnvironmentToCountry, createEnvironmentProfileFromCountry, getInitialUserEnvironment } from '../src/utils/environmentAdapter';
import { findCountryByCode } from '../src/data/worldCountries';
import { findCurrencyByCode } from '../src/data/worldCurrencies';
import { getCountryMeta } from '../src/utils/countryCurrencyMeta';
import { cartSummary, orderMessage, orderRef, orderRequestEmail, type PricedOrder } from '../src/utils/storeCart';
import { contactMailto, STORE_EMAIL } from '../src/config/contact';
import { formatMoney } from '../src/utils/storeCheckout';
import { SafeImage, photoSources } from '../src/components/SafeImage';
import type { StoreProduct } from '../src/utils/storeCatalog';

const egypt = () => createEnvironmentProfileFromCountry(findCountryByCode('EG')!);

const product = (over: Partial<StoreProduct>): StoreProduct => ({
  id: 1, sku: 'SHM-001', name: { ar: 'عود ملكي', en: 'Royal Oud' },
  description: { ar: 'وصف', en: 'A warm oud.' }, brand: 'Lattafa', category: 'perfume', gender: 'men',
  families: ['oud'], notes: { top: [], heart: [], base: [] }, seasons: [], occasions: [], tags: [], price: 1500,
  imageUrl: '', images: [], slug: 'royal-oud', inStock: true, rating: 4.6, reviewCount: 3, isNew: false,
  isFeatured: false, enrichedBy: 'shaheen', createdAt: '2026-01-01', ...over,
});

test('the lab environment follows the store country and uses the store currency', () => {
  const sg = alignEnvironmentToCountry(egypt(), 'SG');
  assert.equal(sg.countryCode, 'SG');
  assert.equal(sg.currencyCode, currencyFor('SG'));
  // Lebanon / Palestine: the lab list said USD, the store charges in the official currency — they must agree.
  for (const code of ['LB', 'PS', 'SA', 'AE', 'MY']) {
    assert.equal(alignEnvironmentToCountry(egypt(), code).currencyCode, currencyFor(code), code);
  }
  // A country the lab list does not describe still gets its own name, flag and currency (never the riyal).
  const unknown = COUNTRY_CODES.find((c) => !findCountryByCode(c) && currencyFor(c) !== 'USD')!;
  const aligned = alignEnvironmentToCountry(egypt(), unknown);
  assert.equal(aligned.countryCode, unknown);
  assert.equal(aligned.currencyCode, currencyFor(unknown));
  assert.notEqual(aligned.countryNameEn, 'Egypt');
  // Same country → the same profile (a currency the visitor picked in the lab is kept); junk → unchanged.
  const mine = { ...egypt(), currencyCode: 'USD' };
  assert.equal(alignEnvironmentToCountry(mine, 'EG'), mine);
  assert.equal(alignEnvironmentToCountry(mine, 'XX'), mine);
});

test('no saved choice no longer means Saudi Arabia, and an unknown currency is never shown as SAR', () => {
  assert.equal(getInitialUserEnvironment().countryCode, 'EG');
  assert.equal(findCurrencyByCode('ILS').code, 'ILS');
  assert.ok(findCurrencyByCode('ILS').rateToUSD > 1, 'the live table supplies the rate');
  assert.equal(findCurrencyByCode('SAR').code, 'SAR');
});

test('the promo banner, the store, the product page and the cart name the same currency for every country', () => {
  const mismatched = COUNTRY_CODES.filter((code) => getCountryMeta(code, 'ar').currency !== currencyFor(code));
  assert.deepEqual(mismatched, []);
  const lb = getCountryMeta('LB', 'ar');
  assert.equal(lb.currency, 'LBP');
  assert.notEqual(lb.symbolAr, '$', 'the banner must not say dollars while the cart says pounds');
  assert.equal(getCountryMeta('SA', 'ar').symbolAr, 'ر.س');
});

test('the order hand-off carries the prices the visitor saw, in their currency', () => {
  const p = product({});
  const summary = cartSummary({ [p.sku]: 2 }, [p]);
  const bill = quote([{ sku: p.sku, price: p.price, qty: 2 }], 'SG');
  const money = (n: number) => formatMoney(n, bill.currency, 'ar', 'جنيه');
  const priced: PricedOrder = { line: () => money(bill.lines[0].subtotal), shipping: money(bill.shipping), total: money(bill.total) };
  const message = orderMessage(summary, 'ar', priced);
  assert.ok(message.includes(money(bill.total)), message);
  assert.ok(!/جنيه/.test(message), 'no EGP amount in a Singapore order');
  assert.equal(bill.lines[0].unit, priceIn(p.price, 'SGD'), 'the unit price is the unchanged store rule');
  // Without priced amounts the old EGP message is unchanged (assistant hand-off, tests elsewhere).
  assert.match(orderMessage(summary, 'ar'), /3000 جنيه/);
});

test('checkout without an online method sends a ready e-mail to the store inbox (not the chat)', () => {
  const p = product({});
  const summary = cartSummary({ [p.sku]: 1 }, [p]);
  const priced: PricedOrder = { line: () => '5.30 SGD', shipping: '30 SGD', total: '35.30 SGD' };
  const ref = orderRef(Date.UTC(2026, 9, 20), () => 0.5);
  assert.match(ref, /^SH-[0-9A-Z]+-[0-9A-Z]{3}$/);
  const mail = orderRequestEmail(summary, 'ar', priced, { name: ' منى  أحمد ', email: 'mona@example.com', phone: '+65 5555', city: 'سنغافورة', line: 'شارع 1' }, 'سنغافورة', ref);
  assert.ok(mail.subject.includes(ref));
  for (const part of [ref, 'منى أحمد', 'mona@example.com', '+65 5555', 'شارع 1', '35.30 SGD', '30 SGD']) assert.ok(mail.body.includes(part), part);
  const link = contactMailto('orders', 'ar', mail.subject, mail.body);
  assert.ok(link.startsWith(`mailto:${STORE_EMAIL}?subject=`));
  assert.ok(decodeURIComponent(link).includes('[شام | الطلبات]'));
});

test('a product photo falls back through every photo, then to a placeholder — never a blank box', () => {
  assert.deepEqual(photoSources('a.jpg', ['a.jpg', ' b.jpg ', ''], undefined, 'c.jpg'), ['a.jpg', 'b.jpg', 'c.jpg']);
  const none = renderToString(React.createElement(SafeImage, { sources: [], alt: 'عود', className: 'w-full' }));
  assert.match(none, /role="img"/);
  assert.match(none, /aria-label="عود"/);
  const some = renderToString(React.createElement(SafeImage, { sources: ['https://cdn.example/x.jpg'], alt: 'عود', className: 'w-full', testId: 'product-photo' }));
  assert.match(some, /<img[^>]+src="https:\/\/cdn.example\/x.jpg"/);
  assert.match(some, /data-testid="product-photo"/);
});

test('a shared product page converts its EGP price with the store rule and table', async () => {
  const { moneyTable, renderProductPage } = await import('../scripts/product-pages/render');
  const table = moneyTable();
  assert.equal(table.home, 'EGP');
  for (const code of COUNTRY_CODES) assert.equal(table.currency[code], currencyFor(code, BUNDLED_FX), code);
  for (const cur of new Set(Object.values(table.currency))) assert.ok(table.rates[cur] > 0, cur);
  const html = renderProductPage(product({}), [], { siteUrl: 'https://example.com/' });
  assert.match(html, /fetch\('money\.json'\)/);
  assert.match(html, /sham-store-country/);
  assert.match(html, /"priceCurrency":"EGP"/, 'search engines keep the catalog price');
  // The page's rounding is the store's `tidy`, number for number.
  const source = /function td\(v\)\{.*?\n?\}(?=\n\}\)\(\))/s.exec(html)?.[0];
  assert.ok(source, 'the page carries its rounding helper');
  const td = new Function(`${source}; return td;`)() as (v: number) => number;
  for (const v of [0.31, 9.31, 37.4, 99.99, 1247, 5321.7, 123456]) assert.equal(td(v), tidy(v), String(v));
});
