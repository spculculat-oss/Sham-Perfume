import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../src/types/i18n';
import { BANNER_KEYS } from '../src/لغات/bannerKeys';
import { BANNER_PACKS, bannerLanguages, bannerText, makeBannerT } from '../src/لغات/bannerL10n';
import { languageForCountryCode, languageFromLanguageTags } from '../src/utils/geoDetector';
import { getInitialLanguage } from '../src/لغات/i18n';
import { TopPromoHub } from '../src/components/TopPromoHub';

const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
// Languages whose own script is Arabic-based: Arabic-range characters are their text, not a leak.
const ARABIC_SCRIPT_HOME = new Set<SupportedLanguage>(['ar', 'fa', 'ur', 'ps', 'sd']);

test('every platform language carries the full banner, translated, with no Arabic leaking', () => {
  assert.equal(BANNER_KEYS.length, 21);
  assert.deepEqual(bannerLanguages(), SUPPORTED_LANGUAGES.map((l) => l.code));
  for (const { code } of SUPPORTED_LANGUAGES) {
    const row = BANNER_PACKS[code];
    assert.ok(row, `<${code}> has no banner row`);
    assert.equal(row.length, BANNER_KEYS.length, `<${code}> banner row is short`);
    for (let i = 0; i < BANNER_KEYS.length; i++) {
      const value = row[i];
      assert.ok(value && value.trim().length > 0, `<${code}:${BANNER_KEYS[i]}> is empty`);
      assert.notEqual(value, BANNER_KEYS[i], `<${code}:${BANNER_KEYS[i]}> shows the raw key`);
      if (code === 'ar') {
        assert.ok(ARABIC.test(value), `Arabic banner lost its Arabic at ${BANNER_KEYS[i]}`);
      } else if (!ARABIC_SCRIPT_HOME.has(code)) {
        assert.ok(!ARABIC.test(value), `<${code}:${BANNER_KEYS[i]}> leaked Arabic: ${value}`);
      }
    }
  }
});

test('bannerText resolves the visitor language first, with the Arabic and English originals intact', () => {
  assert.equal(bannerText('ar', 'promo_title'), 'عالم عطور شام');
  assert.equal(bannerText('ar', 'campaign_headline'), 'عطرك… توقيع لا يُنسى');
  assert.equal(bannerText('en', 'promo_title'), 'The Sham Fragrance Edit');
  assert.equal(bannerText('en', 'compact_eyebrow'), 'TODAY’S SHAM PICK');
  assert.equal(bannerText('fr', 'campaign_headline'), 'Un parfum qui reste avec vous');
  assert.equal(bannerText('ja', 'view_store'), 'この香水を購入');
  assert.equal(bannerText('sw', 'compact_cta'), 'Nunua sasa');
  assert.equal(bannerText('he', 'view_store'), 'לקנות את הבושם הזה');
  assert.equal(bannerText('pl', 'price_label'), 'Cena');
  assert.equal(makeBannerT('tr')('collapse'), bannerText('tr', 'collapse'));
  for (const { code } of SUPPORTED_LANGUAGES) {
    for (const key of BANNER_KEYS) {
      assert.notEqual(bannerText(code, key), key, `<${code}:${key}> fell through to the raw key`);
    }
  }
});

test('entry-country helpers map countries and browser language tags to platform languages', () => {
  assert.equal(languageForCountryCode('EG'), 'ar');
  assert.equal(languageForCountryCode('FR'), 'fr');
  assert.equal(languageForCountryCode('JP'), 'ja');
  assert.equal(languageForCountryCode('TR'), 'tr');
  assert.equal(languageForCountryCode('xx'), null);
  assert.equal(languageForCountryCode(null), null);
  assert.equal(languageFromLanguageTags(['pt-BR', 'en']), 'pt');
  assert.equal(languageFromLanguageTags(['nb-NO']), 'no');
  assert.equal(languageFromLanguageTags(['fil-PH']), 'tl');
  assert.equal(languageFromLanguageTags(['xx-YY', 'sw-KE']), 'sw');
  assert.equal(languageFromLanguageTags([]), null);
});

test('a language the visitor picked beats entry-country detection, and detection never throws', () => {
  const g = globalThis as unknown as { localStorage?: unknown };
  const original = g.localStorage;
  try {
    const store = new Map<string, string>([
      ['sham_perfume_user_language', 'fr'],
      ['sham_perfume_user_override_lang', 'true'],
    ]);
    g.localStorage = {
      getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    assert.equal(getInitialLanguage(), 'fr', 'manual pick must win over the entry country');
    store.clear();
    const detected = getInitialLanguage();
    assert.ok(
      SUPPORTED_LANGUAGES.some((l) => l.code === detected),
      `entry detection returned an unsupported language: ${detected}`,
    );
  } finally {
    if (original === undefined) delete g.localStorage;
    else g.localStorage = original;
  }
});

test('the banner itself renders in the visitor language without Arabic for non-Arabic visitors', () => {
  const expected: Partial<Record<SupportedLanguage, string>> = {
    fr: 'Un parfum qui reste avec vous',
    ja: 'この香水を購入',
    sw: 'Nunua harufu hii',
    he: 'לקנות את הבושם הזה',
    pl: 'Kup ten zapach',
  };
  for (const code of ['ar', 'fr', 'ja', 'sw', 'he', 'pl'] as SupportedLanguage[]) {
    const html = renderToString(React.createElement(TopPromoHub, { currentLang: code }));
    assert.ok(html.length > 0);
    if (code === 'ar') {
      assert.ok(html.includes('عطرك… توقيع لا يُنسى'), 'the Arabic banner lost its headline');
      continue;
    }
    assert.ok(!ARABIC.test(html), `<${code} banner> leaked Arabic into the page`);
    assert.ok(html.includes(expected[code] as string), `the ${code} banner lost its copy`);
    assert.ok(/\d/.test(html), `the ${code} banner lost its price`);
  }
});

test('the app hands the banner the real language and manual picks stay marked', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.ok(
    /<TopPromoHub\s+currentLang=\{currentLang\}/.test(app),
    'App must pass the visitor language through to TopPromoHub',
  );
  assert.ok(
    !/TopPromoHub[\s\S]{0,120}=== 'ar' \|\|/.test(app),
    'the banner must not be clamped back to Arabic/English',
  );
  assert.ok(app.includes('detectEntryLanguageAsync'), 'App refines the opening language by entry country');

  const i18n = readFileSync(new URL('../src/لغات/i18n.ts', import.meta.url), 'utf8');
  assert.ok(i18n.includes('detectEntryLanguage()'), 'getInitialLanguage opens in the entry-country language');
  assert.ok(i18n.includes('USER_LANGUAGE_MANUAL_OVERRIDE_KEY'), 'getInitialLanguage honors the manual pick');

  const context = readFileSync(new URL('../src/context/LanguageContext.tsx', import.meta.url), 'utf8');
  assert.ok(
    context.includes('USER_LANGUAGE_MANUAL_OVERRIDE_KEY'),
    'context language picks must be marked manual so detection never stomps them',
  );
});
