/**
 * Phase 4 (4/n) — units, counters and short UI labels.
 *
 * These keys used to be typed straight into JSX in Arabic (currency, millilitres,
 * "edit"/"cancel", marketplace counters, spray-simulator readouts), so every one
 * of the 99 other languages saw Arabic. The pack guarantees English, and the
 * source guard keeps new raw Arabic JSX from creeping back into those screens.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SUPPORTED_LANGUAGES } from '../src/types/i18n';
import { UI_TEXT, uiLabel } from '../src/utils/uiTextL10n';

const ARABIC = /[\u0600-\u06FF]/;
/** Persian, Urdu, Pashto and Sindhi write in an Arabic-based script. */
const ARABIC_SCRIPT = new Set(['fa', 'ur', 'ps', 'sd']);
const NON_ARABIC = SUPPORTED_LANGUAGES.map((l) => l.code).filter((c) => c !== 'ar' && !ARABIC_SCRIPT.has(c));

const KEYS = Object.keys(UI_TEXT) as (keyof typeof UI_TEXT)[];

// The screens that were de-Arabised in this batch.
const CLEANED = [
  'FragrancePyramidGraphic.tsx',
  'PerfumeSpraySimulator.tsx',
  'ProductCatalog.tsx',
  'CostCalculator.tsx',
  'MerchantWorkspace.tsx',
  'AdminMerchantManagement.tsx',
  'UserProfilePage.tsx',
];

/** Remove comments plus string/template literals, keeping newlines so line numbers stay sane. */
function stripNonText(src: string): string {
  let out = '';
  let i = 0;
  const blank = (ch: string) => {
    out += ch === '\n' ? ch : ' ';
  };
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '//') {
      while (i < src.length && src[i] !== '\n') blank(src[i++]);
      continue;
    }
    if (two === '/*') {
      while (i < src.length && src.slice(i, i + 2) !== '*/') blank(src[i++]);
      blank(' ');
      blank(' ');
      i += 2;
      continue;
    }
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      blank(c);
      i += 1;
      while (i < src.length) {
        if (src[i] === '\\') {
          blank(src[i]);
          blank(src[i + 1] ?? ' ');
          i += 2;
          continue;
        }
        if (src[i] === c) break;
        blank(src[i++]);
      }
      blank(c);
      i += 1;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

test('every UI label resolves for every platform language', () => {
  for (const { code } of SUPPORTED_LANGUAGES) {
    for (const key of KEYS) {
      const value = uiLabel(key, code);
      assert.ok(value.length > 0, `${code}.${key} is empty`);
    }
  }
});

test('a non-Arabic visitor never receives Arabic', () => {
  for (const lang of NON_ARABIC) {
    for (const key of KEYS) {
      const value = uiLabel(key, lang);
      assert.ok(!ARABIC.test(value), `${lang}.${key} leaks Arabic: ${value}`);
    }
  }
});

test('Arabic keeps its lab wording, other languages get their own (or English)', () => {
  assert.equal(uiLabel('currency_egp', 'ar'), 'جنيه');
  assert.equal(uiLabel('currency_egp', 'en'), 'EGP');
  assert.equal(uiLabel('unit_ml', 'ar'), 'مل');
  assert.equal(uiLabel('unit_ml', 'en'), 'ml');
  assert.equal(uiLabel('unit_ml', 'zh'), '毫升');
  assert.equal(uiLabel('cancel', 'fr'), 'Annuler');
  assert.equal(uiLabel('save_edit', 'tr'), 'Değişiklikleri kaydet');
  // a language without an entry falls back to English, never to Arabic
  assert.equal(uiLabel('skin_residue', 'ti'), UI_TEXT.skin_residue.en);
});

test('cleaned screens no longer render raw Arabic JSX text', () => {
  for (const file of CLEANED) {
    const source = readFileSync(fileURLToPath(new URL(`../src/components/${file}`, import.meta.url)), 'utf8');
    const offenders = stripNonText(source)
      .split('\n')
      .map((line, index) => [index + 1, line.trim()] as const)
      .filter(([, line]) => ARABIC.test(line));
    assert.deepEqual(
      offenders.map(([line, text]) => `${file}:${line} ${text.slice(0, 60)}`),
      [],
      `${file} still prints Arabic text for every language`,
    );
  }
});
