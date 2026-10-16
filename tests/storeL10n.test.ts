// «متجر شام» speaks every language of the platform: these guards make that a fact, not a promise.
// The rule the visitor sees: language → English → Arabic → key, so a non-Arabic visitor must never
// meet Arabic text, and every language must carry the scent-profile labels and the store's controls.
import assert from 'node:assert/strict';
import test from 'node:test';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../src/types/i18n';
import { STORE_BASE_LANGS, STORE_CORE_KEYS, type StoreTextKey } from '../src/لغات/storeKeys';
import { STORE_TEXT_BASE } from '../src/لغات/storeL10nBase';
import { STORE_TEXT_WAVES } from '../src/لغات/storeL10nExt';
import {
  fillStoreVars, makeStoreT, storeCoreCoverage, storeFamilyLabel, storeGenderLabel, storeLabel,
  storeLocalized, storeNumber, storeOccasionLabel, storeReasonList, storeSeasonLabel, storeText,
} from '../src/لغات/storeL10n';
import { recommend } from '../src/utils/storeAdvisor';
import { cartSummary, orderMessage } from '../src/utils/storeCart';
import { localSuggestion } from '../src/utils/liveStore';
import type { StoreProduct } from '../src/utils/storeCatalog';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Storefront } from '../src/components/Storefront';
import { ProductDetail } from '../src/components/ProductDetail';

/** Languages whose script is Arabic-based: Arabic letters are their own alphabet, not a leak. */
const ARABIC_SCRIPT: SupportedLanguage[] = ['ar', 'fa', 'ur', 'ps', 'sd'];
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
const ALL_KEYS = Object.keys(STORE_TEXT_BASE) as StoreTextKey[];

const product = (over: Partial<StoreProduct>): StoreProduct => ({
  id: 1, sku: 'SHM-001', name: { ar: 'عود ملكي', en: 'Royal Oud' },
  description: { ar: 'وصف', en: 'A warm oud.' }, brand: 'Lattafa', category: 'perfume', gender: 'men',
  families: ['oud', 'woody'], notes: { top: ['برغموت'], heart: [], base: [] }, seasons: ['winter'],
  occasions: ['evening'], tags: [], price: 250, imageUrl: '', images: [], slug: 'royal-oud', inStock: true,
  rating: 4.6, reviewCount: 12, isNew: false, isFeatured: true, enrichedBy: 'shaheen', createdAt: '2026-01-01', ...over,
});

test('the store pack covers every language of the platform, never with an Arabic leak', () => {
  assert.ok(SUPPORTED_LANGUAGES.length >= 100, `only ${SUPPORTED_LANGUAGES.length} languages are offered`);
  // Base pack: every key in the ten platform languages, arrays aligned to STORE_BASE_LANGS.
  const misaligned = ALL_KEYS.filter((key) => STORE_TEXT_BASE[key].length !== STORE_BASE_LANGS.length);
  assert.deepEqual(misaligned, [], 'a store key lost one of its ten base languages');
  const waveLangs = new Set(STORE_TEXT_WAVES.flatMap((wave) => Object.keys(wave.packs)));
  assert.equal(waveLangs.size, SUPPORTED_LANGUAGES.length - STORE_BASE_LANGS.length);
  // Every language carries every core key: the profile labels of any product page resolve, not fall back.
  const short = SUPPORTED_LANGUAGES
    .map((language) => [language.code, storeCoreCoverage(language.code)] as const)
    .filter(([, covered]) => covered !== STORE_CORE_KEYS.length);
  assert.deepEqual(short, [], 'languages without the store core keys');

  const leaks: string[] = [];
  for (const language of SUPPORTED_LANGUAGES) {
    if (ARABIC_SCRIPT.includes(language.code)) continue;
    for (const key of ALL_KEYS) {
      const value = storeText(language.code, key);
      assert.ok(value.length > 0, `${language.code} → ${key} is empty`);
      if (ARABIC.test(value)) leaks.push(`${language.code} → ${key}: ${value}`);
    }
  }
  assert.deepEqual(leaks.slice(0, 20), [], 'a non-Arabic language received Arabic text');
});

test('the resolution order is language → English → Arabic → the key itself', () => {
  assert.equal(storeText('ar', 'sf_cart'), 'السلة');
  assert.equal(storeText('fr', 'sf_cart'), 'Panier');
  assert.equal(storeText('jv', 'sf_cart'), 'Kranjang');
  // A language without that sentence still gets English — never Arabic, never a raw key.
  assert.equal(storeText('jv', 'sf_tagline'), STORE_TEXT_BASE.sf_tagline[1]);
  // Sentences outside the 42 core keys deliberately ride the English floor in most languages.
  const onTheEnglishFloor = SUPPORTED_LANGUAGES
    .filter((language) => storeText(language.code, 'sf_checkout') === STORE_TEXT_BASE.sf_checkout[1]);
  assert.ok(onTheEnglishFloor.length > 30, `only ${onTheEnglishFloor.length} languages fall back to English`);
  assert.ok(SUPPORTED_LANGUAGES.every((language) => storeText(language.code, 'sf_checkout') !== 'sf_checkout'));
  assert.ok(onTheEnglishFloor.every((language) => !ARABIC.test(storeText(language.code, 'sf_checkout'))));
  assert.equal(storeText('ar', 'no_such_key' as StoreTextKey), 'no_such_key');
  // The translator bound to one language behaves the same and lets the caller override.
  const t = makeStoreT('he');
  assert.equal(t('sf_cart'), 'סל');
  assert.equal(makeStoreT('he', { sf_cart: 'עגלה' })('sf_cart'), 'עגלה');
});

test('the scent profile and the store controls read in the visitor’s language', () => {
  assert.equal(storeFamilyLabel('oud', 'ar'), 'عود');
  assert.equal(storeFamilyLabel('oud', 'ja'), 'ウード');
  assert.equal(storeFamilyLabel('leather', 'ta'), 'தோல்');
  assert.equal(storeGenderLabel('women', 'ru'), 'Женский');
  assert.equal(storeSeasonLabel('summer', 'tr'), 'Yaz');
  assert.equal(storeOccasionLabel('gift', 'bn'), 'উপহার');
  assert.equal(storeLabel('gender', 'unisex', 'pt'), 'Unissex');
  // An unknown value passes through instead of inventing a label.
  assert.equal(storeFamilyLabel('unknown-family', 'de'), 'unknown-family');
});

test('placeholders, numerals and product names are filled per language', () => {
  assert.equal(fillStoreVars('{n} / {missing}', { n: 3 }), '3 / {missing}');
  assert.equal(storeText('ar', 'sf_found', { count: 12 }), '12 منتج');
  assert.equal(storeText('de', 'sf_more', { n: 48 }), 'Mehr anzeigen (48 Produkte)');
  assert.equal(storeText('ar', 'cart_order_line', { name: 'عود', sku: 'X-1', qty: 2, subtotal: 500, currency: 'جنيه' }),
    '- عود (X-1) × 2 = 500 جنيه');
  const prompt = storeText('fr', 'pd_ask_prompt', { name: 'Royal Oud', brand: ' (Lattafa)', price: 250 });
  assert.ok(prompt.includes('Royal Oud') && prompt.includes('Lattafa') && prompt.includes('250'));
  assert.ok(!prompt.includes('{'), 'the ask-Shaheen prompt kept an unfilled placeholder');
  assert.equal(storeNumber(1200, 'en'), '1,200');
  assert.equal(storeNumber(1200, 'ar').replace(/[^\u0660-\u0669]/g, ''), '١٢٠٠');
  // The product's own Arabic name is shown to Arabic visitors only; everyone else gets the English one.
  assert.equal(storeLocalized(product({}).name, 'ar'), 'عود ملكي');
  assert.equal(storeLocalized(product({}).name, 'ur'), 'Royal Oud');
  assert.equal(storeLocalized(undefined, 'en'), '');
});

const CATALOG = [
  product({ id: 1, sku: 'LAT-001', name: { ar: 'لطافة أمير العود', en: 'Lattafa Amir Oud' }, price: 260 }),
  product({ id: 2, sku: 'SHM-003', name: { ar: 'ورد الياسمين', en: 'Jasmine Rose' }, gender: 'women', families: ['floral'], price: 180, seasons: ['summer'], occasions: ['daily'] }),
];

test('«اسأل شاهين» answers and why-chips follow the visitor’s language', () => {
  const arabic = recommend(CATALOG, 'عطر عود رجالي للشتاء');
  assert.ok(arabic.picks.length > 0);
  const arLine = storeReasonList('ar', arabic.picks[0].reasons);
  assert.match(arLine, /عود/);
  assert.ok(ARABIC.test(arLine));
  for (const code of ['en', 'fr', 'ja', 'sw', 'ur', 'ps'] as SupportedLanguage[]) {
    const line = storeReasonList(code, arabic.picks[0].reasons);
    assert.ok(line.length > 0, `${code} reasons are empty`);
    if (code === 'ur' || code === 'ps') continue; // Arabic-based script of their own
    assert.ok(!ARABIC.test(line), `${code} reasons leaked Arabic: ${line}`);
  }
  assert.equal(storeReasonList('fr', [{ key: 'reason_family', vars: { value: 'oud' } }]), 'caractère Oud');

  const local = localSuggestion(CATALOG, 'oud for winter', 'de');
  assert.equal(local.source, 'local');
  assert.ok(local.reply.length > 0 && !ARABIC.test(local.reply));
  assert.ok(local.picks.length > 0 && local.picks.every((pick) => !ARABIC.test(pick.why)));
});

test('the order hand-off to the Sham assistant speaks the visitor’s language', () => {
  const summary = cartSummary({ 'LAT-001': 2, 'SHM-003': 1 }, CATALOG);
  const ar = orderMessage(summary, 'ar');
  assert.match(ar, /LAT-001\) × 2 = 520 جنيه/);
  assert.match(ar, /الإجمالي: 700 جنيه/);
  const leak = SUPPORTED_LANGUAGES.filter((language) => !ARABIC_SCRIPT.includes(language.code))
    .filter((language) => ARABIC.test(orderMessage(summary, language.code)))
    .map((language) => language.code);
  assert.deepEqual(leak, [], 'an order message reached a non-Arabic visitor in Arabic');
  const en = orderMessage(summary, 'en');
  assert.match(en, /I’d like to order from Sham store:/);
  assert.match(en, /Lattafa Amir Oud \(LAT-001\) × 2 = 520 EGP/);
  assert.match(orderMessage(summary, 'tr'), /Sham mağazasından sipariş vermek istiyorum:/);
  assert.match(orderMessage(summary, 'tr'), /Toplam: 700 EGP/);
});

test('the standalone product pages carry their chrome in every base language', async () => {
  const { pageLabelTable, renderIndexPage, renderProductPage } = await import('../scripts/product-pages/render');
  const table = pageLabelTable();
  assert.deepEqual(Object.keys(table.packs), [...STORE_BASE_LANGS]);
  for (const lang of STORE_BASE_LANGS) assert.equal(table.packs[lang].length, table.keys.length, `${lang} pack is misaligned`);

  const main = product({ images: ['store/royal-oud.jpg'], notes: { top: ['برغموت', 'زعفران'], heart: [], base: ['عود'] } });
  const html = renderProductPage(main, [product({ id: 2, sku: 'SHM-002', slug: 'other-oud' })], { siteUrl: 'https://example.test/' });
  // Every label the page hands to the switcher exists in the table: a typo would leave Arabic on screen.
  const asked = [...html.matchAll(/data-l="([a-z0-9_]+)"/g)].map((match) => match[1]);
  assert.ok(asked.length > 8, `only ${asked.length} labels are switchable`);
  assert.deepEqual([...new Set(asked)].filter((key) => !table.keys.includes(key as StoreTextKey)), []);
  assert.match(html, /sham_perfume_user_language/, 'the page no longer reads the visitor\'s saved language');
  assert.match(html, /documentElement\.dir/);
  assert.match(html, /data-price="/);
  // No-JS visitors and search engines still get the Arabic page.
  assert.match(html, /<html lang="ar" dir="rtl">/);
  assert.match(html, /الهرم العطري/);

  const leaks: string[] = [];
  for (const lang of STORE_BASE_LANGS) {
    if (lang === 'ar' || lang === 'fa') continue; // fa reads Arabic letters as its own script
    for (const [index, value] of table.packs[lang].entries()) {
      if (ARABIC.test(value)) leaks.push(`${lang} → ${table.keys[index]}: ${value}`);
    }
  }
  assert.deepEqual(leaks.slice(0, 10), [], 'the page chrome leaked Arabic to a non-Arabic visitor');

  const index = renderIndexPage([main], { siteUrl: 'https://example.test/' });
  assert.match(index, /<html lang="ar" dir="rtl">/);
  assert.match(index, /data-name data-ar=/);
});

test('the storefront and the product page themselves render without Arabic for a non-Arabic visitor', () => {
  const tagline: Partial<Record<SupportedLanguage, string>> = { en: 'Scents chosen with care', ja: '丁寧に選んだ香り', sw: 'Manukato yaliyochaguliwa kwa uangalifu', pl: 'Zapachy wybrane z troską' };
  for (const code of ['ar', 'en', 'ja', 'sw', 'pl'] as SupportedLanguage[]) {
    const html = renderToString(React.createElement(Storefront, { currentLang: code, onClose: () => undefined }));
    assert.ok(html.length > 0);
    if (code === 'ar') { assert.ok(ARABIC.test(html), 'the Arabic storefront lost its Arabic'); continue; }
    assert.ok(!ARABIC.test(html), `<${code} storefront> leaked Arabic into the page`);
    assert.ok(html.includes(tagline[code] as string), `the ${code} storefront lost its tagline`);
    assert.ok(!html.includes('{n}') && !html.includes('{count}'), `the ${code} storefront shows an unfilled placeholder`);
  }
  for (const code of ['ar', 'fr', 'ko'] as SupportedLanguage[]) {
    const html = renderToString(React.createElement(ProductDetail, { productId: 1, currentLang: code }));
    assert.ok(html.length > 0);
    if (code === 'ar') continue;
    assert.ok(!ARABIC.test(html), `<${code} product page> leaked Arabic into the page`);
  }
});
