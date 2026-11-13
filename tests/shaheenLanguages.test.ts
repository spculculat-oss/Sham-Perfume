/**
 * «وكيل اللغات» — the language specialist under Shaheen.
 *
 * Why he exists: the merchant photographed a GERMAN cost page whose number
 * fields showed Arabic-Indic digits (٦٥٠، ٣٥، ١٨…). A native
 * `<input type="number">` renders with the VISITOR's OS/browser locale, so an
 * Egyptian telephone shows Arabic-Indic digits on any page language. The fix
 * is one mechanism — `src/لغات/numerals.ts` + `LocalizedNumberInput` — and
 * this file makes it a fact, not a promise:
 *   - numerals unit tests (format/parse in every digit family),
 *   - the field itself (site-language digits only, lenient parsing),
 *   - the audit that hunts the bug class across the whole src tree,
 *   - the committed live report and its seat at Shaheen's council table.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../src/types/i18n';
import {
  formatInputNumber,
  formatLocalizedNumber,
  numeralLocaleTag,
  parseLocalizedNumber,
  toLatinDigits,
  usesNativeDigits,
} from '../src/لغات/numerals';
import { LocalizedNumberInput } from '../src/components/LocalizedNumberInput';
import {
  applyTranslationCoverage,
  buildLanguageReport,
  findBareLocaleFormatting,
  findLanguageClamps,
  findNativeNumberInputs,
  isLanguageLiveReport,
} from '../scripts/shaheen-languages/audit';
import { buildBriefing, selfMinutes } from '../scripts/shaheen-council/council';

// ── 1. Numerals: the photographed bug, unit by unit ────────────────────────────────
test('input digits follow the SITE language: the German page shows 650, never ٦٥٠', () => {
  assert.equal(formatInputNumber('de', 650), '650');
  assert.equal(formatInputNumber('fr', 650), '650');
  assert.equal(formatInputNumber('ja', 650), '650');
  assert.equal(formatInputNumber('en', 12.5), '12.5');
  assert.equal(formatInputNumber('de', 12.5), '12,5');
  assert.equal(formatInputNumber('ar', 650), '٦٥٠');
  assert.equal(formatInputNumber('fa', 650), '۶۵۰');
  // Latin-digit tools stay Latin even where the locale has native digits (Bengali, Thai).
  assert.equal(formatInputNumber('bn', 650), '650');
  assert.equal(formatInputNumber('th', 650), '650');
  assert.equal(usesNativeDigits('ar'), true);
  assert.equal(usesNativeDigits('de'), false);
  assert.equal(numeralLocaleTag('de'), 'de-DE');
  assert.equal(numeralLocaleTag('ar'), 'ar-EG');
});

test('display numbers keep the site language grouping and separators', () => {
  assert.equal(formatLocalizedNumber('de', 1234.5, { fractionDigits: 2 }), '1.234,50');
  assert.equal(formatLocalizedNumber('en', 1234.5, { fractionDigits: 2 }), '1,234.50');
  assert.equal(toLatinDigits(formatLocalizedNumber('ar', 1234.5, { fractionDigits: 2 }).replace(/[٬٫]/g, '')), '123450');
});

test('parsing accepts whatever the visitor types: Arabic/Persian/Bengali digits, comma decimals, grouping', () => {
  assert.equal(parseLocalizedNumber('٦٥٠'), 650); // an Arabic telephone pinned to a German page
  assert.equal(parseLocalizedNumber('۶۵۰'), 650);
  assert.equal(parseLocalizedNumber('٦٥٠٫٥'), 650.5);
  assert.equal(parseLocalizedNumber('১২৩'), 123);
  assert.equal(parseLocalizedNumber('๒๐๐'), 200);
  assert.equal(parseLocalizedNumber('650'), 650);
  assert.equal(parseLocalizedNumber('12,5'), 12.5);
  assert.equal(parseLocalizedNumber('12.5'), 12.5);
  assert.equal(parseLocalizedNumber('1.234,5'), 1234.5);
  assert.equal(parseLocalizedNumber('1,234.5'), 1234.5);
  assert.equal(parseLocalizedNumber('1,000'), 1000);
  assert.equal(parseLocalizedNumber('1.234.567'), 1234567);
  assert.equal(parseLocalizedNumber('١٬٢٠٠'), 1200);
  assert.equal(parseLocalizedNumber('−5'), -5);
  assert.ok(Number.isNaN(parseLocalizedNumber('')));
  assert.ok(Number.isNaN(parseLocalizedNumber('  ')));
  assert.ok(Number.isNaN(parseLocalizedNumber('abc')));
  assert.equal(toLatinDigits('٦٥٠'), '650');
});

test('every supported language formats and re-reads its own numbers (round-trip)', () => {
  for (const { code } of SUPPORTED_LANGUAGES) {
    const lang = code as SupportedLanguage;
    const shown = formatInputNumber(lang, 1234.5);
    assert.notEqual(shown, '', `empty number for ${lang}`);
    assert.equal(parseLocalizedNumber(shown), 1234.5, `round-trip broke for ${lang}: ${JSON.stringify(shown)}`);
    if (lang !== 'ar' && lang !== 'fa' && lang !== 'ur' && lang !== 'ps' && lang !== 'sd') {
      assert.ok(!/[٠-٩۰-۹]/.test(shown), `${lang} input must not show Arabic-Indic digits: ${shown}`);
    }
  }
});

// ── 2. The field component ────────────────────────────────────────────────────────
const renderInput = (lang: SupportedLanguage, value: number) =>
  renderToString(React.createElement(LocalizedNumberInput, { lang, value, onValue: () => undefined }));

test('LocalizedNumberInput is a text field with the site language\'s digits and a numeric keyboard', () => {
  const de = renderInput('de', 650);
  assert.ok(de.includes('value="650"'), de);
  assert.ok(de.includes('lang="de-DE"'), de);
  assert.ok(de.includes('type="text"'), de);
  assert.ok(de.includes('inputMode="decimal"') || de.includes('inputmode="decimal"'), de);
  const ar = renderInput('ar', 650);
  assert.ok(ar.includes('value="٦٥٠"'), ar);
  const fa = renderInput('fa', 650);
  assert.ok(fa.includes('value="۶۵۰"'), fa);
});

test('LocalizedNumberInput can pin numeric fields to left-to-right layout', () => {
  const markup = renderToString(React.createElement(LocalizedNumberInput, {
    lang: 'ar', value: 12.5, onValue: () => undefined, dir: 'ltr',
  }));
  assert.ok(markup.includes('dir="ltr"'), markup);
});

// ── 3. The audit tools ────────────────────────────────────────────────────────────
test('the audit separates visitor surfaces from operator consoles and sanctions the fix itself', () => {
  const jsx = '<input type="number" value={x} />\n<input type={"number"} value={y} />';
  assert.equal(findNativeNumberInputs('src/components/Foo.tsx', jsx).public.length, 2);
  assert.equal(findNativeNumberInputs('src/components/Foo.tsx', jsx).operator.length, 0);
  assert.equal(findNativeNumberInputs('src/admin/AdminApp.tsx', jsx).operator.length, 2);
  assert.equal(findNativeNumberInputs('src/components/MerchantWorkspace.tsx', jsx).operator.length, 2);
  assert.deepEqual(findNativeNumberInputs('src/components/LocalizedNumberInput.tsx', jsx), { public: [], operator: [] });
  assert.deepEqual(findNativeNumberInputs('src/لغات/numerals.ts', jsx), { public: [], operator: [] });
});

test('the audit flags browser-locale formatting but accepts explicit locales', () => {
  assert.equal(findBareLocaleFormatting('x.ts', 'a.toLocaleString()').length, 1);
  assert.equal(findBareLocaleFormatting('x.ts', 'a.toLocaleString({ maximumFractionDigits: 2 })').length, 1);
  assert.equal(findBareLocaleFormatting('x.ts', 'new Intl.NumberFormat()').length, 1);
  assert.equal(findBareLocaleFormatting('x.ts', "a.toLocaleString('de-DE')").length, 0);
  assert.equal(findBareLocaleFormatting('x.ts', 'new Intl.NumberFormat(tag)').length, 0);
  assert.equal(findBareLocaleFormatting('x.ts', 'd.toLocaleDateString(numeralLocaleTag(lang))').length, 0);
});

test('the audit flags a language clamped to ar|en as a VALUE, not {ar,en} data pairs', () => {
  assert.equal(findLanguageClamps('x.ts', "const lang = siteLang === 'ar' ? 'ar' : 'en';").length, 1);
  assert.equal(findLanguageClamps('x.ts', "const name = lang === 'ar' ? item.nameAr : item.nameEn;").length, 0);
  // The checkout APIs carry Arabic/English catalogue-name language, not the visitor's full UI locale.
  assert.equal(findLanguageClamps('src/utils/storeCheckout.ts', "lang: lang === 'ar' ? 'ar' : 'en'").length, 0);
  assert.equal(findLanguageClamps('src/utils/directPayment.ts', "lang: lang === 'ar' ? 'ar' : 'en'").length, 0);
});

test('report scoring: clean = 100, the German-page bug hurts most', () => {
  const languages = ['ar', 'en', 'de'];
  const full = Object.fromEntries(languages.map((l) => [l, { storeCore: 42, storeTotal: 129, banner: 46, news: 79 }]));
  const clean = buildLanguageReport({
    at: new Date(0).toISOString(), languages, storeCoreSize: 42, bannerSize: 46, newsSize: 79, coverage: full,
    publicNumberInputs: [], operatorNumberInputs: [], bareLocaleFormatting: [], languageClamps: [],
  });
  assert.equal(clean.score, 100);
  assert.equal(clean.fullyCovered, 3);
  assert.ok(clean.notes[0]!.includes('اللغات سليمة'));
  assert.ok(isLanguageLiveReport(clean));

  const dirty = buildLanguageReport({
    at: new Date(0).toISOString(), languages, storeCoreSize: 42, bannerSize: 46, newsSize: 79,
    coverage: { ...full, de: { storeCore: 10, storeTotal: 10, banner: 3, news: 79 } },
    publicNumberInputs: [{ file: 'src/components/X.tsx', line: 7 }],
    operatorNumberInputs: [], bareLocaleFormatting: [], languageClamps: [],
  });
  assert.ok(dirty.score < 90);
  assert.deepEqual(dirty.incompletePacks, [{ lang: 'de', storeCore: '10/42', banner: '3/46', news: '79/79' }]);
  assert.ok(dirty.notes.some((n) => n.includes('LocalizedNumberInput')));
});

// ── 4. The real tree: the regression wall ─────────────────────────────────────────
const ROOT = process.cwd();
const sources = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) sources(rel, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(rel);
  }
  return acc;
};

test('no visitor or operator surface renders a native browser-locale number input', () => {
  const publicHits: string[] = [];
  const operatorHits: string[] = [];
  for (const file of sources('src').sort()) {
    const found = findNativeNumberInputs(file, readFileSync(join(ROOT, file), 'utf8'));
    for (const hit of found.public) publicHits.push(`${hit.file}:${hit.line}`);
    for (const hit of found.operator) operatorHits.push(`${hit.file}:${hit.line}`);
  }
  assert.deepEqual(publicHits, [], `visitor surfaces should use LocalizedNumberInput:\n${publicHits.join('\n')}`);
  assert.deepEqual(operatorHits, [], `operator surfaces should also use LocalizedNumberInput:\n${operatorHits.join('\n')}`);
});

test('no visitor or operator surface formats numbers or dates from the browser locale', () => {
  const hits: string[] = [];
  for (const file of sources('src').sort()) {
    for (const hit of findBareLocaleFormatting(file, readFileSync(join(ROOT, file), 'utf8'))) {
      hits.push(`${hit.file}:${hit.line}`);
    }
  }
  assert.deepEqual(hits, [], `pass the site language to the shared formatting helpers:\n${hits.join('\n')}`);
});

test('the photographed cost calculator and every converted calculator carry no native number field', () => {
  for (const file of [
    'src/components/CostCalculator.tsx',
    'src/components/ConcentrationCalculator.tsx',
    'src/components/AlcoholDilutionCalculator.tsx',
    'src/components/MacerationTimeSimulator.tsx',
    'src/components/PyramidCalculator.tsx',
    'src/components/FragrancePyramidGraphic.tsx',
    'src/components/CountryAndAddressModal.tsx',
    'src/components/ProductCatalog.tsx',
    'src/App.tsx',
    'src/assistant/ShamAssistant.tsx',
  ]) {
    const source = readFileSync(join(ROOT, file), 'utf8');
    assert.ok(!/type="number"|type=\{"number"\}/.test(source), `${file} still ships a native number input`);
    assert.ok(source.includes('LocalizedNumberInput'), `${file} should use LocalizedNumberInput`);
  }
});

// ── 5. The committed report + the council seat ───────────────────────────────────
const liveReport = JSON.parse(readFileSync(join(ROOT, 'src/data/live/shaheen-languages.json'), 'utf8'));

test('the committed language report is valid, complete and clean for visitors', () => {
  assert.ok(isLanguageLiveReport(liveReport));
  assert.equal(liveReport.languageCount, SUPPORTED_LANGUAGES.length);
  assert.equal(liveReport.fullyCovered, SUPPORTED_LANGUAGES.length);
  assert.deepEqual(liveReport.incompletePacks, []);
  assert.deepEqual(liveReport.publicNumberInputs, []);
});

test('Shaheen\'s council hears the language agent: facts always, tasks when something is wrong', () => {
  const now = Date.parse('2026-10-18T07:00:00Z');
  const ok = buildBriefing({ languages: liveReport }, now, []);
  assert.ok(ok.facts.some((f) => f.startsWith('اللغات:')), ok.facts.join('\n'));
  assert.ok(!ok.signals.some((s) => s.decision?.title === 'توحيد أرقام حقول الزوار على لغة الموقع'));

  const bad = buildBriefing({
    languages: {
      ...liveReport,
      score: 40,
      publicNumberInputs: [{ file: 'src/components/X.tsx', line: 12 }],
      incompletePacks: [{ lang: 'sw', storeCore: '10/42', banner: '46/46', news: '79/79' }],
    },
  }, now, []);
  const digits = bad.signals.find((s) => s.decision?.title === 'توحيد أرقام حقول الزوار على لغة الموقع');
  assert.ok(digits, 'the council must raise the digits task');
  assert.equal(digits!.area, 'experience');
  assert.equal(digits!.priority, 'high');
  assert.ok(digits!.decision!.detail.includes('src/components/X.tsx:12'));
  assert.ok(bad.signals.some((s) => s.decision?.title === 'استكمال حزم اللغات الناقصة'));
  // …and without any AI engine the self-written minutes still turn them into decisions.
  const minutes = selfMinutes(bad, '2026-10-18');
  assert.ok(minutes.decisions.some((d) => d.title === 'توحيد أرقام حقول الزوار على لغة الموقع' && d.kind === 'task'));
});

test('«لا تعلن الاكتمال»: full packs with most texts still in English is NOT «سليمة», and the score says so', () => {
  const languages = ['ar', 'en', 'de', 'fr'];
  const full = Object.fromEntries(languages.map((l) => [l, { storeCore: 42, storeTotal: 129, banner: 46, news: 79 }]));
  const packsOnly = buildLanguageReport({
    at: new Date(0).toISOString(), languages, storeCoreSize: 42, bannerSize: 46, newsSize: 79, coverage: full,
    publicNumberInputs: [], operatorNumberInputs: [], bareLocaleFormatting: [], languageClamps: [],
  });
  const half = applyTranslationCoverage(packsOnly, { remaining: 1000, total: 2000, fullyTranslated: 0 });
  assert.equal(half.translationCoverage, 50);
  assert.equal(half.score, 80, 'half translated costs half of the translation weight');
  assert.ok(!half.notes.some((n) => n.includes('اللغات سليمة')), 'never «complete» while texts are in English');
  assert.match(half.notes[0]!, /الترجمة مش مكتملة: 50% .*1000 نص × لغة/);
  assert.ok(isLanguageLiveReport(half));

  const done = applyTranslationCoverage(packsOnly, { remaining: 0, total: 2000, fullyTranslated: 2 });
  assert.equal(done.score, 100);
  assert.equal(done.translationCoverage, 100);
  assert.ok(done.notes[0]!.includes('اللغات سليمة'));

  assert.equal(applyTranslationCoverage(packsOnly, { remaining: 5, total: 0 }), packsOnly, 'no measurement → unchanged');
});
