/**
 * The `src/لغات` gateway — one place that answers "which languages does the platform
 * support and how complete is each one?", for Shaheen and for the admin screens.
 *
 * It also guards the folder itself: every language pack lives under `src/لغات` and
 * nothing in `src/utils` may fork a copy back.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SUPPORTED_LANGUAGES } from '../src/types/i18n';
import {
  ALL_CONTENT_LABEL_KEYS,
  isLanguageSupported,
  languageCatalogue,
  languageReport,
  languagesSummary,
  t,
  uiLabel,
} from '../src/لغات';

const ARABIC = /[\u0600-\u06FF]/;
/** Languages whose own script is Arabic-based — they legitimately use this range. */
const ARABIC_SCRIPT = new Set(['ar', 'fa', 'ur', 'ps', 'sd']);

const LANGS_DIR = fileURLToPath(new URL('../src/لغات', import.meta.url));

test('the gateway lists every platform language with its own dir and locale', () => {
  const catalogue = languageCatalogue();
  assert.equal(catalogue.length, SUPPORTED_LANGUAGES.length);
  assert.equal(catalogue.length, 100);
  for (const entry of catalogue) {
    assert.ok(entry.name.length > 0, `${entry.code} has no English name`);
    assert.ok(entry.nativeName.length > 0, `${entry.code} has no native name`);
    assert.ok(['rtl', 'ltr'].includes(entry.dir), `${entry.code} has no direction`);
    // e.g. ar-EG, sr-Latn-RS, zh-CN — script subtags are allowed
    assert.match(entry.locale, /^[a-z]{2}(-[A-Za-z]{4})?(-[A-Za-z]{2})?$/, `${entry.code} locale looks wrong: ${entry.locale}`);
  }
  // the four RTL script languages must keep reporting rtl
  for (const code of ['ar', 'fa', 'ur', 'he']) {
    assert.equal(catalogue.find((e) => e.code === code)?.dir, 'rtl', `${code} should be rtl`);
  }
});

test('every language carries the full content-label set through the gateway', () => {
  assert.equal(ALL_CONTENT_LABEL_KEYS.length, 15);
  const incomplete = languageCatalogue()
    .filter((entry) => entry.contentLabels.translated !== entry.contentLabels.total)
    .map((entry) => `${entry.code}:${entry.contentLabels.translated}/${entry.contentLabels.total}`);
  assert.deepEqual(incomplete, [], `languages missing labels: ${incomplete.join(', ')}`);
});

test('the summary Shaheen quotes is honest and dynamic', () => {
  const summary = languagesSummary();
  assert.match(summary, new RegExp(String(SUPPORTED_LANGUAGES.length)));
  assert.match(summary, /100\/100/);
});

test('a single-language report names the language and its direction', () => {
  for (const code of ['ar', 'de', 'zh', 'fa'] as const) {
    const report = languageReport(code);
    const entry = SUPPORTED_LANGUAGES.find((l) => l.code === code)!;
    assert.ok(report.includes(entry.nativeName), `${code} report misses its native name`);
    assert.ok(
      report.includes(entry.dir === 'rtl' ? 'يمين←يسار' : 'يسار←يمين'),
      `${code} report misses its direction`,
    );
  }
});

test('unsupported codes are rejected instead of silently falling back', () => {
  assert.equal(isLanguageSupported('de'), true);
  assert.equal(isLanguageSupported('ar'), true);
  assert.equal(isLanguageSupported('xx'), false);
  assert.equal(isLanguageSupported(''), false);
});

test('the resolvers reachable from the gateway stay Arabic-free for non-Arabic languages', () => {
  for (const { code } of SUPPORTED_LANGUAGES) {
    if (ARABIC_SCRIPT.has(code)) continue;
    assert.ok(!ARABIC.test(t('nav_calc', code)), `${code} UI string leaks Arabic`);
    assert.ok(!ARABIC.test(uiLabel('currency_egp', code)), `${code} currency leaks Arabic`);
  }
});

test('every language pack lives under src/لغات, not src/utils', () => {
  const inGateway = readdirSync(LANGS_DIR);
  assert.ok(inGateway.includes('localize.ts'));
  assert.ok(inGateway.includes('contentLabels.ts'));
  assert.ok(inGateway.includes('hubL10nExt45.ts'));
  assert.ok(inGateway.filter((f) => /^hubL10n/.test(f)).length >= 49);

  const utils = readdirSync(fileURLToPath(new URL('../src/utils', import.meta.url)));
  const strays = utils.filter((f) => /^(i18n|hubL10n|contentLabels|commonLabelsExt|localizedContent|noteL10n|uiTextL10n|localize)/.test(f));
  assert.deepEqual(strays, [], `language packs must live in src/لغات, found: ${strays.join(', ')}`);
});
