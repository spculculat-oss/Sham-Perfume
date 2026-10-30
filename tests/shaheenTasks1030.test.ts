import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('#402/#405/#409: the trade bot rebuilds the instant answers and publishes them with its cost table', () => {
  assert.match(read('scripts/shaheen-trade/run.mts'), /rebuildReflexFromFiles\(\)/);
  const wf = read('.github/workflows/shaheen-trade.yml');
  assert.match(wf, /src\/data\/live\/shaheen-reflex\.json/);
  assert.match(wf, /tests\/shaheenMindLoop\.test\.ts/, 'the bot runs the test that broke main before it publishes');
});

test('#408: Malaysia has a published local rate (Pos Laju, highest counter price — covers East Malaysia)', () => {
  const lanes = JSON.parse(read('src/data/shipping-lanes.json')) as { carriers: { id: string; perCountryBand?: { currency: string; rates: Record<string, [number, number]> }; source: string }[] };
  const pos = lanes.carriers.find((c) => c.id === 'pos_malaysia');
  assert.deepEqual(pos?.perCountryBand, { currency: 'MYR', rates: { MY: [11, 10] } });
  assert.match(pos!.source, /^https:\/\//);
  const costs = JSON.parse(read('src/data/shipping-costs.json')) as { countries: Record<string, { carrier: string }> };
  assert.equal(costs.countries.MY?.carrier, 'pos_malaysia');
});

test('#411: the order shows its steps and the delivery/payment step gets a wider page', () => {
  const store = read('src/components/Storefront.tsx');
  assert.match(store, /data-testid="checkout-steps"/);
  assert.match(store, /step === 'form' \? 'sm:max-w-lg' : 'max-w-sm'/);
});

test('#397/#410: no letter-spacing on right-to-left pages, localized cookie footer and currency chip', () => {
  assert.match(read('src/index.css'), /\[dir='rtl'\] :is\(\.tracking-wide, \.tracking-wider, \.tracking-widest/);
  const cookie = read('src/components/CookieConsent.tsx');
  assert.doesNotMatch(cookie, /يُحفظ مع timestamp/);
  assert.match(cookie, /L\('record_note'\)/);
  assert.match(read('src/components/TopPromoHub.tsx'), /currencyLabel\(money\.currency, currentLang\)/);
});
