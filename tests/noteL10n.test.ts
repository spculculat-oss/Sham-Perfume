/**
 * Phase 4 — pyramid analysis metrics.
 *
 * The fragrance pyramid and the spray simulator used to print Arabic evaporation
 * times, diffusion radii, scent families and the lab grade for every language.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { SUPPORTED_LANGUAGES } from '../src/types/i18n';
import { NOTE_METRICS, noteMetric } from '../src/لغات/noteL10n';
import { enrichPyramidNote } from '../src/utils/volatilityHelper';
import type { PyramidNote } from '../src/types/perfume';

const ARABIC = /[\u0600-\u06FF]/;
/** Persian and Urdu write in an Arabic-based script. */
const ARABIC_SCRIPT = new Set(['fa', 'ur', 'ps', 'sd']);
const NON_ARABIC = SUPPORTED_LANGUAGES.map((l) => l.code).filter((c) => c !== 'ar' && !ARABIC_SCRIPT.has(c));

const note = (category: PyramidNote['category']): PyramidNote => ({
  id: `note-${category}`,
  nameAr: 'نوتة',
  nameEn: 'Note',
  category,
  percentageOfOil: 20,
});

test('every pyramid metric resolves for every platform language', () => {
  for (const { code } of SUPPORTED_LANGUAGES) {
    for (const field of ['evap_top', 'evap_heart', 'evap_base', 'evap_default', 'radius_top', 'radius_heart', 'radius_base', 'radius_default', 'family_top', 'family_heart', 'family_base', 'family_default', 'grade_a'] as const) {
      assert.ok(noteMetric(field, code).length > 0, `${code}.${field} is empty`);
    }
  }
});

test('enriched notes never show Arabic to a non-Arabic visitor', () => {
  for (const lang of NON_ARABIC) {
    for (const category of ['top', 'heart', 'base'] as const) {
      const enriched = enrichPyramidNote(note(category), lang);
      for (const field of ['evaporationTime', 'diffusionRadius', 'scentFamily', 'qualityGrade'] as const) {
        assert.ok(!ARABIC.test(String(enriched[field])), `${lang} ${category} leaks Arabic in ${field}`);
      }
    }
  }
});

test('Arabic keeps its lab wording and English is used as the fallback', () => {
  assert.equal(enrichPyramidNote(note('top'), 'ar').evaporationTime, '15 - 45 دقيقة');
  assert.equal(enrichPyramidNote(note('top'), 'en').evaporationTime, '15 - 45 minutes');
  assert.equal(enrichPyramidNote(note('heart'), 'fr').evaporationTime, '2 - 5 heures');
  assert.equal(enrichPyramidNote(note('base'), 'zh').evaporationTime, '12 - 24+ 小时');
  // a language without its own pack still gets English rather than Arabic
  assert.equal(enrichPyramidNote(note('top'), 'ti').diffusionRadius, NOTE_METRICS.en?.radius_top);
});

test('the metric pack declares the ten core languages explicitly', () => {
  for (const lang of ['ar', 'en', 'fr', 'es', 'it', 'de', 'ru', 'zh', 'tr', 'fa'] as const) {
    assert.ok(NOTE_METRICS[lang], `missing core pack for ${lang}`);
  }
});
