/**
 * The unified languages button at the top of the page: one icon opens every language
 * the platform ships, with a search box. These tests pin the search behaviour that
 * both pickers share and guard that the header still renders exactly one button.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SUPPORTED_LANGUAGES } from '../src/types/i18n';
import {
  POPULAR_LANGUAGE_CODES,
  filterLanguages,
  findLanguage,
  isLanguageMatch,
  languageCount,
  languageHaystack,
  normalizeQuery,
  popularLanguages,
  splitPopular,
} from '../src/لغات/languagePicker';

const readSource = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const HEADER = readSource('../src/components/Header.tsx');
const SELECTOR = readSource('../src/components/LanguageSelector.tsx');
const MODAL = readSource('../src/components/CountryAndAddressModal.tsx');

test('an empty query shows every language in the curated platform order', () => {
  const all = filterLanguages('');
  assert.equal(all.length, languageCount());
  assert.equal(all.length, 100);
  assert.deepEqual(all.map((l) => l.code), SUPPORTED_LANGUAGES.map((l) => l.code));
  assert.deepEqual(filterLanguages('   ').length, 100, 'whitespace is not a query');
});

test('every language is reachable by its own name, native name and code', () => {
  for (const lang of SUPPORTED_LANGUAGES) {
    for (const query of [lang.code, lang.name, lang.nativeName]) {
      assert.ok(
        isLanguageMatch(lang, query),
        `searching "${query}" must find ${lang.code}`,
      );
    }
    assert.ok(languageHaystack(lang).length > 0, `${lang.code} has an empty search index`);
  }
});

test('accented, diacritic and hamza spellings all find the same language', () => {
  assert.equal(normalizeQuery('Türkçe'), normalizeQuery('turkce'));
  assert.equal(normalizeQuery('Français'), normalizeQuery('francais'));
  assert.equal(normalizeQuery('إنجليزي'), normalizeQuery('انجليزي'));
  assert.equal(normalizeQuery('عربيًّا'), normalizeQuery('عربيا'));
  for (const query of ['Türkçe', 'turkce', 'turkish']) {
    assert.equal(filterLanguages(query)[0]?.code, 'tr', `"${query}" should put Turkish first`);
  }
  for (const query of ['Français', 'francais', 'FRENCH']) {
    assert.equal(filterLanguages(query)[0]?.code, 'fr', `"${query}" should put French first`);
  }
});

test('search understands codes, endonyms and English keywords', () => {
  const first = (query: string) => filterLanguages(query)[0]?.code;
  assert.equal(first('ar'), 'ar');
  assert.equal(first('عربي'), 'ar');
  assert.equal(first('german'), 'de');
  assert.equal(first('deutsch'), 'de');
  assert.equal(first('فارسی'), 'fa');
  assert.equal(first('mandarin'), 'zh');
  assert.equal(first('日本語'), 'ja');
  assert.equal(first('हिन्दी'), 'hi');
  assert.equal(first('scottish gaelic'), 'gd');
  assert.equal(first('kinyarwanda'), 'rw');
  assert.equal(first('pt-BR'), 'pt', 'locales are searchable too');
});

test('an exact code match always wins over a longer word containing it', () => {
  const results = filterLanguages('es');
  assert.equal(results[0].code, 'es');
  const de = filterLanguages('de');
  assert.equal(de[0].code, 'de');
  const he = filterLanguages('he');
  assert.equal(he[0].code, 'he');
});

test('direction keywords filter the list to rtl or ltr languages', () => {
  const rtl = filterLanguages('rtl');
  const ltr = filterLanguages('ltr');
  const expectedRtl = SUPPORTED_LANGUAGES.filter((l) => l.dir === 'rtl').map((l) => l.code);
  assert.deepEqual(rtl.map((l) => l.code).sort(), expectedRtl.sort());
  assert.equal(rtl.length + ltr.length, 100);
  assert.ok(rtl.some((l) => l.code === 'ar') && rtl.some((l) => l.code === 'he'));
});

test('an unknown query returns nothing instead of silently showing everything', () => {
  assert.deepEqual(filterLanguages('zzzz'), []);
  assert.deepEqual(filterLanguages('not-a-language'), []);
  assert.equal(filterLanguages('').length, 100, 'clearing the search restores the full list');
});

test('popular quick picks are real platform languages', () => {
  const popular = popularLanguages();
  assert.equal(popular.length, POPULAR_LANGUAGE_CODES.length);
  for (const lang of popular) {
    assert.ok(findLanguage(lang.code), `${lang.code} is not in SUPPORTED_LANGUAGES`);
  }
  const { popular: pop, rest } = splitPopular(filterLanguages(''));
  assert.equal(pop.length, popular.length);
  assert.equal(pop.length + rest.length, 100);
  assert.equal(rest.some((l) => POPULAR_LANGUAGE_CODES.includes(l.code)), false);
});

test('language lookup and the counter stay dynamic', () => {
  assert.equal(languageCount(), SUPPORTED_LANGUAGES.length);
  assert.equal(findLanguage('de')?.nativeName, 'Deutsch');
  assert.equal(findLanguage('xx'), undefined);
  assert.equal(findLanguage(''), undefined);
  assert.equal(findLanguage(undefined), undefined);
});

test('the header keeps exactly one unified language button at every width', () => {
  const occurrences = HEADER.split('<LanguageSelector').length - 1;
  assert.equal(occurrences, 1, 'the language button must be rendered once, not per breakpoint');
  assert.ok(!HEADER.includes('hidden xl:block', HEADER.indexOf('<LanguageSelector')), 'the button must not be hidden on smaller screens');
  assert.ok(!HEADER.includes('compactMobile'), 'the duplicate compact selector must be gone');
});

test('the button is an icon that opens all languages with a search box', () => {
  assert.ok(SELECTOR.includes('Languages'), 'the unified trigger uses the languages icon');
  assert.ok(SELECTOR.includes('languageCount()'), 'the count comes from the language list, never hard-coded');
  assert.ok(SELECTOR.includes('filterLanguages(searchQuery)'), 'the panel lists the languages through the shared search');
  assert.ok(SELECTOR.includes('type="text"'), 'the panel ships a search input');
  assert.ok(SELECTOR.includes('autoFocus') || SELECTOR.includes('searchRef.current?.focus()'), 'the search box is focused on open');
  for (const key of ['panel_title', 'search_ph', 'popular', 'no_match', 'results_tpl']) {
    assert.ok(SELECTOR.includes(`${key}:`), `the panel is missing the "${key}" string`);
  }
});

test('both pickers search through the same engine', () => {
  assert.ok(MODAL.includes('filterLanguages(languageSearch)'), 'the country modal must reuse the shared search');
  assert.ok(!MODAL.includes('.nativeName.toLowerCase().includes'), 'the modal must not keep a second search implementation');
  assert.ok(SELECTOR.includes("from '../لغات/languagePicker'"));
});

test('the opened panel renders the search box and all 100 languages, RTL aware', async () => {
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { LanguageSelector } = await import('../src/components/LanguageSelector');

  const render = (lang: 'ar' | 'en') =>
    renderToStaticMarkup(
      React.createElement(LanguageSelector, {
        currentLang: lang,
        onSelectLanguage: () => {},
        onAutoDetectLanguage: () => {},
        defaultOpen: true,
      }),
    );

  const arabic = render('ar');
  assert.ok(arabic.includes('role="dialog"'), 'the panel is a dialog');
  assert.ok(arabic.includes('dir="rtl"'), 'Arabic opens the panel right-to-left');
  assert.ok(arabic.includes('ابحث عن لغة'), 'the Arabic search placeholder is rendered');
  assert.equal(arabic.split('data-language-item').length - 1, 100, 'every language is listed');
  for (const code of ['ar', 'en', 'de', 'zh', 'rw', 'ig']) {
    assert.ok(arabic.includes(`>${code}<`) || arabic.includes(`>${code.toUpperCase()}<`), `${code} row is missing`);
  }
  assert.ok(arabic.includes('100'), 'the language counter is rendered');

  const english = render('en');
  assert.ok(english.includes('dir="ltr"'), 'English opens the panel left-to-right');
  assert.ok(english.includes('Search a language'), 'the English search placeholder is rendered');
  assert.equal(english.split('data-language-item').length - 1, 100);
});

test('opening the panel never leaks Arabic wording into another language', async () => {
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { LanguageSelector } = await import('../src/components/LanguageSelector');
  const arabicScriptLanguage = new Set(['ar', 'fa', 'ur', 'ps', 'sd']);

  for (const lang of ['en', 'de', 'zh', 'tr', 'rw'] as const) {
    const html = renderToStaticMarkup(
      React.createElement(LanguageSelector, {
        currentLang: lang,
        onSelectLanguage: () => {},
        defaultOpen: true,
      }),
    );
    // The language rows themselves carry the language's own script — only the chrome is checked.
    const chrome = html
      .split('data-language-item')
      .map((chunk) => chunk.split('</button>')[1] ?? chunk)
      .join(' ');
    const leaked = chrome.match(/[\u0600-\u06FF]+/g) || [];
    assert.deepEqual(
      leaked.filter((word) => !arabicScriptLanguage.has(lang) && word.length > 1 && !/^(ar|fa|ur|ps|sd)$/i.test(word)),
      [],
      `${lang} panel leaks Arabic chrome: ${leaked.join(' ')}`,
    );
  }
});
