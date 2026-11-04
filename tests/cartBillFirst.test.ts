import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = readFileSync(new URL('../src/components/Storefront.tsx', import.meta.url), 'utf8');
const invoice = readFileSync(new URL('../src/components/StoreInvoiceBreakdown.tsx', import.meta.url), 'utf8');
const footer = readFileSync(new URL('../src/components/Footer.tsx', import.meta.url), 'utf8');

test('#387/#381: in the cart the total and «أكمل الطلب» come before the suggestions', () => {
  const drawer = store.slice(store.indexOf('data-testid="store-cart"'));
  const total = drawer.indexOf('L.itemsTotal');
  const next = drawer.indexOf('data-testid="store-pay-start"');
  const upsell = drawer.indexOf('<CompleteYourOrder');
  assert.ok(total > 0 && next > total, 'the bill and the next step are in the drawer');
  assert.ok(upsell > next, 'the suggestions are after the bill and the button');
});

test('#387: each line shows its full name and quantity × unit price', () => {
  assert.match(store, /line-clamp-2 leading-snug/);
  assert.match(store, /data-testid="cart-line-price"/);
});

test('#382: no English VAT / cookie / complaint labels in the Arabic bill and footer', () => {
  assert.doesNotMatch(invoice, /'VAT [^']*[\u0600-\u06FF]/);
  assert.match(invoice, /ضريبة القيمة المضافة/);
  assert.doesNotMatch(footer, />🍪 Cookie Settings</);
  assert.doesNotMatch(footer, />🇦🇪 UAE</);
});
