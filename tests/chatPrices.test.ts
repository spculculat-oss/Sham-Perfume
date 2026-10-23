import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetsToHome, formatAmount, localizeChatPrices, parseAmount } from '../src/utils/chatPrices';
import { BUNDLED_FX, convert, currencyFor, priceIn } from '../src/utils/pricing';

const FRENCH_REPLY = `**[SOUVENIR DESERT ROSE](https://spculculat-oss.github.io/Sham-Perfume/p/souvenir-desert-rose-1120.html)** — EGP 1,420 · 100 ml
- **Rapport qualité-prix :** EGP 1,420 pour 100 ml (environ EGP 14 par ml — à peu près 1000 vaporisations).
**Le même esprit pour moins cher :** [INARA WHITE](https://spculculat-oss.github.io/Sham-Perfume/p/inara-white-1138.html) — EGP 1,095`;

test('a French conversation from France gets euros — the same price as the product page, links untouched', () => {
  const out = localizeChatPrices(FRENCH_REPLY, currencyFor('FR'), 'fr');
  assert.ok(!/EGP/.test(out), out);
  assert.ok(out.includes(formatAmount(priceIn(1420, 'EUR'), 'EUR', 'fr')), 'same tidy price as the product page');
  assert.ok(out.includes(formatAmount(priceIn(1095, 'EUR'), 'EUR', 'fr')));
  assert.match(out, /€/);
  assert.ok(out.includes('souvenir-desert-rose-1120.html') && out.includes('inara-white-1138.html') && out.includes('100 ml') && out.includes('1000 vaporisations'));
});

test('every country gets its own currency; Egypt keeps its pounds', () => {
  const reply = 'بـ1,420 جنيه لـ100 مل (حوالي 14 جنيه للمل). والأسعار من 450 لـ 2,300 جنيه مصري';
  assert.equal(localizeChatPrices(reply, currencyFor('EG'), 'ar'), reply);
  const sa = localizeChatPrices(reply, currencyFor('SA'), 'ar');
  assert.ok(!/جنيه/.test(sa), sa);
  assert.match(sa, /ر\.س/);
  assert.ok(!/[٠-٩]/.test(sa), 'western digits like the rest of the reply');
  assert.ok(sa.includes('لـ100 مل'));
  for (const [country, mark] of [['US', /\$/], ['GB', /£/], ['AE', /AED|د\.إ/], ['JP', /￥|¥/], ['MY', /RM|MYR/], ['DE', /€/]] as const) {
    const lang = country === 'JP' ? 'ja' : country === 'DE' ? 'de' : 'en';
    const out = localizeChatPrices('EGP 1,420 for 100 ml, or 900–1,500 EGP', currencyFor(country), lang);
    assert.match(out, mark, `${country}: ${out}`);
    assert.ok(!/EGP/.test(out), `${country}: ${out}`);
  }
});

test('ranges, words and spellings the AI platforms use are all converted', () => {
  const eur = (s: string) => localizeChatPrices(s, 'EUR', 'fr');
  for (const s of ['900–1,500 EGP', 'EGP 900 - 1,500', 'de 900 à 1 500 EGP', '1 420 livres égyptiennes', '1.420 EGP', 'from 450 to 2,300 EGP']) assert.ok(!/EGP|égyptiennes/.test(eur(s)) && /€/.test(eur(s)), `${s} → ${eur(s)}`);
  assert.equal((eur('900–1,500 EGP').match(/€/g) || []).length, 2, 'both ends of the range');
  assert.equal(parseAmount('1,420'), 1420);
  assert.equal(parseAmount('1 420'), 1420);
  assert.equal(parseAmount('14,5'), 14.5);
  assert.equal(parseAmount('1.420.000'), 1420000);
});

test('the visitor’s own money reaches the brain in EGP (and nothing else is touched)', () => {
  const egp = (n: number, c: string) => `${Math.round(convert(n, c, 'EGP', BUNDLED_FX))} EGP`;
  assert.equal(budgetsToHome('moins de 30 €', 'EUR', 'fr'), `moins de ${egp(30, 'EUR')}`);
  assert.equal(budgetsToHome('budget 50 euros', 'EUR', 'fr'), `budget ${egp(50, 'EUR')}`);
  assert.equal(budgetsToHome('ميزانيتي 300 ريال', 'SAR', 'ar'), `ميزانيتي ${egp(300, 'SAR')}`);
  assert.equal(budgetsToHome('ميزانيتي 300', 'SAR', 'ar'), `ميزانيتي ${egp(300, 'SAR')}`, 'a bare budget is in the currency he sees');
  assert.equal(budgetsToHome('under $40 please', 'USD', 'en'), `under ${egp(40, 'USD')} please`);
  for (const [t, c, l] of [['under 50 ml', 'USD', 'en'], ['تحت 1000 جنيه', 'SAR', 'ar'], ['عايز عطر 100 مل', 'SAR', 'ar'], ['ميزانيتي 1500', 'EGP', 'ar']] as const) assert.equal(budgetsToHome(t, c, l), t);
});
