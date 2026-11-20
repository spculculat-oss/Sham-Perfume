import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// «وصل الجديد من جوجل استوديو من غير ما نلمس القديم»: the Studio's own additions that came into
// this repository must stay wired to the site's existing rules (one currency, one vault, one checkout).

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the Studio price helper exists beside our own money rule and never replaces it', async () => {
  const meta = read('src/utils/countryCurrencyMeta.ts');
  assert.match(meta, /export function formatProductPriceInCountry\(/);
  // Our rule (#169) stays: the store's currency is the only currency, so the banner never disagrees with the cart.
  assert.match(meta, /const currency = currencyFor\(code, BUNDLED_FX\);/);
  assert.match(meta, /const sameMoney = known\?\.currency === currency;/);
  const { formatProductPriceInCountry } = await import('../src/utils/countryCurrencyMeta');
  const formatted = formatProductPriceInCountry(1000, 'EG', 'ar');
  assert.ok(formatted.formatted.trim().length > 0, 'a price is shown');
  assert.equal(formatted.currency, 'EGP');
});

test('the payment vault window keeps our sign-in hook next to the Studio card wallet', async () => {
  const modal = read('src/components/PaymentEnvironmentModal.tsx');
  assert.match(modal, /onRequireAuth\?: \(\) => void;/, 'our callers still get the sign-in request');
  assert.match(modal, /onSelectMethod\?: \(method: SavedPaymentMethod\) => void;/, 'and the Studio can hand a saved card back');
  assert.match(modal, /local: \{ nameAr:/, 'the store’s own direct transfer has a face in the wallet list too');
  const { PAYMENT_WINDOW_NOTE } = await import('../src/components/PaymentEnvironmentModal');
  assert.match(PAYMENT_WINDOW_NOTE, /no charge/i, 'saving or picking a card never marks an order paid');
});

test('the storefront hands a picked saved card back to the page without charging', () => {
  const store = read('src/components/Storefront.tsx');
  assert.match(store, /selectableMode/);
  assert.match(store, /onSelectMethod=\{\(method\) => \{/);
  assert.match(store, /setChosenSavedMethod\(method\);/);
  assert.match(store, /data-testid="store-chosen-method"/);
});

test('the sales-by-category chart stays in the merchant and admin desks and is localised', () => {
  for (const file of ['src/community/MerchantPortal.tsx', 'src/components/AdminMerchantManagement.tsx', 'src/components/Storefront.tsx']) {
    assert.match(read(file), /StoreSalesCategoryChart/, `${file} shows the sales chart`);
  }
  const chart = read('src/components/StoreSalesCategoryChart.tsx');
  assert.match(chart, /formatLocalizedNumber/, 'the numbers follow the page language');
});
