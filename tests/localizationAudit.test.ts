/**
 * «روبوت مراقبة جودة الترجمة واللغات»: every country in its own currency, real rates, the money words in every
 * language, no hard-coded amounts — and the audit runs honestly over the site's real tables.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import countryCurrency from '../src/data/country-currency.json';
import fxData from '../src/data/live/fx-rates.json';
import { SUPPORTED_LANGUAGES } from '../src/types/i18n';
import { currencyFor, isFxTable, type FxTable } from '../src/utils/pricing';
import { displayCurrency, languageHome, spokenIn } from '../src/utils/displayCurrency';
import { auditLocalization, chargeCurrencyOf, findHardcodedMoney, MONEY_KEYS } from '../scripts/shaheen-localization/audit';

const fx = fxData as FxTable;
const now = Date.parse('2026-10-24T00:00:00Z');

const fixture = () => auditLocalization({
  now,
  countries: { EG: 'EGP', FR: 'EUR', KP: 'KPW', XX: 'XYZ' },
  fx: { base: 'USD', updatedAt: '2026-10-23T00:00:00Z', rates: { USD: 1, EGP: 50, EUR: 0.9 } },
  accepted: ['EGP', 'USD'],
  home: 'EGP',
  languages: ['ar', 'en', 'aa'],
  moneyText: (lang) => (lang === 'aa' ? { sf_total: 'Total' } : Object.fromEntries(MONEY_KEYS.map((k) => [k, 'x']))),
  languageHome: (lang) => (lang === 'aa' ? 'XX' : undefined),
  spokenIn: (country, lang) => (country === 'EG' && (lang === 'ar' || lang === 'en')) || (country === 'XX' && lang === 'aa'),
  displayCurrency: (country, lang) => (country === 'XX' && lang === 'aa' ? 'EUR' : ((countryCurrency as Record<string, string>)[country] || 'USD')),
  sources: [
    { file: 'src/components/Demo.tsx', code: "const a = 'السعر €19.99 فقط';\n// 30$ في تعليق\nconst b = q.replace(/x/, '$1');" },
    { file: 'src/legal/terms.ts', code: "const fine = '$50,000';" },
  ],
});

test('each country keeps its own currency; a missing rate is a finding, never a silent dollar', () => {
  const report = fixture();
  assert.deepEqual(report.rateGaps.map((g) => g.country).sort(), ['KP', 'XX']);
  assert.deepEqual(report.invalidCurrencies, ['XYZ'], 'a currency the money engine does not know would crash the checkout');
  assert.equal(chargeCurrencyOf('EGP', ['EGP', 'USD'], 'EGP'), 'EGP');
  assert.equal(chargeCurrencyOf('SAR', ['EGP', 'USD'], 'EGP'), 'EGP', 'an unaccepted currency falls back, never a third one');
  assert.ok(report.score > 0 && report.score <= 100);
});

test('the money words of every language, and only real fixed amounts', () => {
  const report = fixture();
  assert.deepEqual(report.moneyTerms, [{ language: 'aa', missing: MONEY_KEYS.filter((k) => k !== 'sf_total') }]);
  assert.equal(report.hardcoded.length, 1, 'a comment, a $1 replacement and a legal quote are not prices');
  assert.equal(report.hardcoded[0].file, 'src/components/Demo.tsx');
  const money = findHardcodedMoney([{ file: 'src/legal/x.ts', code: "const fine = '$7,500';" }, { file: 'src/utils/pricing.ts', code: "const s = '€1';" }]);
  assert.equal(money.length, 0, 'the money engine and legal documents are the reference');
});

test('the language switch is counted; a language of the visitor\'s own country showing another currency is a bug', () => {
  const report = fixture();
  assert.ok(report.languageSwitch.bugs.length > 0);
  assert.equal(report.languageSwitch.bugs[0].country, 'XX');
  assert.match(report.summaryAr, /فحص اللغات والعملات/);
});

test('the real tables: every country\'s own currency has a rate except the one that truly lacks it', () => {
  assert.ok(isFxTable(fx), 'the bundled rates are a real FX table');
  const report = auditLocalization({
    now, countries: countryCurrency as Record<string, string>, fx: { base: fx.base, updatedAt: fx.updatedAt, rates: fx.rates },
    accepted: [], home: 'EGP', languages: SUPPORTED_LANGUAGES.map((l) => l.code),
    moneyText: (lang) => (lang === 'ar' ? Object.fromEntries(MONEY_KEYS.map((k) => [k, 'x'])) : {}),
    languageHome, spokenIn, displayCurrency: (c, l) => displayCurrency(c, l as never), sources: [],
  });
  assert.deepEqual(report.rateGaps.map((g) => g.currency), ['KPW'], 'only the North-Korean won has no rate today');
  assert.deepEqual(report.invalidCurrencies, [], 'every official currency is known to the money engine');
  assert.equal(report.tables.countries, Object.keys(countryCurrency).length);
  assert.ok(report.tables.languages === SUPPORTED_LANGUAGES.length);

  for (const [country, currency] of Object.entries(countryCurrency as Record<string, string>)) {
    if (Number(fx.rates[currency]) > 0) assert.equal(currencyFor(country, fx), currency, `${country} keeps ${currency}`);
    const primary = SUPPORTED_LANGUAGES.find((l) => l.code === 'ar');
    assert.ok(primary);
    assert.equal(spokenIn(country, 'ar') ? displayCurrency(country, 'ar', {}, fx) : currencyFor(country, fx), currencyFor(country, fx), `${country}: a spoken language never changes his money`);
  }
});

test('the report ships with the robot and the refuge indexes it', async () => {
  const raw = JSON.parse(readFileSync('src/data/live/shaheen-localization.json', 'utf8')) as { version: number; agent: string };
  assert.equal(raw.version, 1);
  assert.equal(raw.agent, 'localization-audit');
  const { refugeIndex } = await import('../src/utils/shaheenRefuge');
  const ids = new Set(refugeIndex().map((e) => e.id));
  assert.ok(ids.has('report:shaheen-localization.json'));
  assert.ok(ids.has('workflow:shaheen-localization.yml'));
});
