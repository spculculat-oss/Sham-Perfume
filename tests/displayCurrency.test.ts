import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { displayCurrency, languageHome, spokenIn } from '../src/utils/displayCurrency';
import { localizeChatPrices } from '../src/utils/chatPrices';
import { currencyFor } from '../src/utils/pricing';
import { SUPPORTED_LANGUAGES } from '../src/types/i18n';

const AFNAN_FR = '**[AFNAN](https://spculculat-oss.github.io/Sham-Perfume/p/afnan.html)** — EGP 1,095 · 100 ml (environ EGP 11 par ml)';

test('an Egyptian visitor who switches the site to French sees euros — in the chat and on the pages', () => {
  const currency = displayCurrency('EG', 'fr', { languagePicked: true, languagePickedAt: 1000 });
  assert.equal(currency, 'EUR');
  const out = localizeChatPrices(AFNAN_FR, currency, 'fr');
  assert.ok(!/EGP/.test(out), out);
  assert.match(out, /€/);
  assert.ok(out.includes('afnan.html') && out.includes('100 ml'));
});

test('each language brings its own home currency; Arabic and English keep the country\'s', () => {
  for (const [lang, money] of [['de', 'EUR'], ['es', 'EUR'], ['it', 'EUR'], ['tr', 'TRY'], ['ru', 'RUB'], ['ja', 'JPY'], ['zh', 'CNY'], ['ms', 'MYR'], ['ur', 'PKR'], ['fa', 'IRR']] as const) {
    assert.equal(displayCurrency('EG', lang), money, lang);
  }
  assert.equal(displayCurrency('EG', 'ar'), 'EGP');
  assert.equal(displayCurrency('EG', 'en'), 'EGP');
  assert.equal(displayCurrency('SA', 'ar'), 'SAR');
  assert.equal(displayCurrency('FR', 'ar'), 'EUR', 'an Arab visitor in France keeps euros');
  assert.equal(displayCurrency('US', 'en'), 'USD');
});

test('a language of the visitor\'s own country never changes his currency', () => {
  assert.equal(displayCurrency('CA', 'fr'), currencyFor('CA'), 'Québec keeps dollars');
  assert.equal(displayCurrency('CH', 'de'), currencyFor('CH'));
  assert.equal(displayCurrency('MA', 'fr'), currencyFor('MA'), 'Morocco in French keeps dirhams');
  assert.equal(displayCurrency('FR', 'fr'), 'EUR');
  assert.equal(displayCurrency('MY', 'ms'), 'MYR');
  assert.ok(spokenIn('BE', 'nl') && spokenIn('EG', 'ar') && !spokenIn('EG', 'fr'));
});

test('the newest choice wins: a store-country pick after the language keeps that country\'s money', () => {
  assert.equal(displayCurrency('EG', 'fr', { countryPickedAt: 2000, languagePickedAt: 1000, languagePicked: true }), 'EGP');
  assert.equal(displayCurrency('EG', 'fr', { countryPickedAt: 1000, languagePickedAt: 2000, languagePicked: true }), 'EUR');
  assert.equal(displayCurrency('SA', 'fr', { countryPickedAt: 0, languagePicked: true }), 'SAR', 'an old country pick beats an old untimed language flag');
});

test('every site language resolves to a real currency', () => {
  for (const { code } of SUPPORTED_LANGUAGES) {
    const money = displayCurrency('EG', code);
    assert.match(money, /^[A-Z]{3}$/, code);
    if (code !== 'ar' && code !== 'en') assert.ok(languageHome(code), `${code} has a home country`);
  }
});

test('store pages, cart, chat and the brain all read the same currency rule', () => {
  const store = readFileSync('src/utils/storeCheckout.ts', 'utf8');
  assert.equal((store.match(/displayCurrency\(country, lang, currencyChoices\(\), BUNDLED_FX\)/g) || []).length, 2, 'useChatPrices + useStoreMoney');
  assert.match(store, /quote\(lines, country, \{ fx: BUNDLED_FX, currency \}\)/, 'the cart bill is in the shown currency, shipping by the real country');
  assert.match(readFileSync('src/utils/chatStore.ts', 'utf8'), /budgetsToHome\(text, currentDisplayCurrency\(options\.language\)/);
  assert.match(readFileSync('src/App.tsx', 'utf8'), /LANGUAGE_PICKED_AT_KEY, String\(Date\.now\(\)\)/);
});
