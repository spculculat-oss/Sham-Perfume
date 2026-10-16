/**
 * Phase 4 — localized content.
 *
 * The public library (world perfumes), the materials encyclopedia and the news
 * desk must never show Arabic text to a visitor who is not reading Arabic:
 * every non-Arabic language resolves to its own translation when one exists and
 * otherwise to English, never to the Arabic source.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { SUPPORTED_LANGUAGES } from '../src/types/i18n';
import { WORLD_PERFUMES } from '../src/data/worldPerfumes';
import { RAW_MATERIALS_DATABASE } from '../src/data/rawMaterials';
import { PERFUME_NEWS_DATA } from '../src/data/perfumeNews';
import { PERFUME_TRANSLATIONS, getLocalizedPerfume, getLocalizedRawMaterial, getLocalizedNewsArticle } from '../src/لغات/localizedContent';

const ARABIC = /[\u0600-\u06FF]/;
/** Persian, Urdu, Pashto and Sindhi write in an Arabic-based script. */
const ARABIC_SCRIPT = new Set(['fa', 'ur', 'ps', 'sd']);
const LATIN_ONLY = /^[\u0000-\u058F\u1E00-\u1EFF\u2000-\u2BFF\u3000-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF]*$/;
const NON_ARABIC = SUPPORTED_LANGUAGES.map((l) => l.code).filter((code) => code !== 'ar' && !ARABIC_SCRIPT.has(code));

test('every recipe in the world library has an English translation', () => {
  for (const recipe of WORLD_PERFUMES) {
    const entry = PERFUME_TRANSLATIONS[recipe.id]?.en;
    assert.ok(entry, `missing English translation for ${recipe.id}`);
    for (const field of ['title', 'category', 'concentration', 'description', 'sillage', 'longevity', 'season', 'compoundingTips'] as const) {
      assert.ok((entry?.[field] ?? '').length > 0, `${recipe.id} has no English ${field}`);
    }
  }
});

test('the world perfume library shows no Arabic to non-Arabic visitors', () => {
  for (const lang of NON_ARABIC) {
    for (const recipe of WORLD_PERFUMES) {
      const localized = getLocalizedPerfume(recipe, lang);
      for (const field of ['nameAr', 'categoryAr', 'concentrationTypeAr', 'descriptionAr', 'sillage', 'longevity', 'seasonAr', 'compoundingTips'] as const) {
        assert.ok(!ARABIC.test(String(localized[field])), `${lang} leaks Arabic in ${recipe.id}.${field}`);
      }
    }
  }
});

test('the materials encyclopedia shows no Arabic to non-Arabic visitors', () => {
  for (const lang of NON_ARABIC) {
    for (const material of RAW_MATERIALS_DATABASE) {
      const localized = getLocalizedRawMaterial(material, lang) as unknown as Record<string, unknown>;
      for (const field of ['nameAr', 'categoryAr', 'pyramidPlacementAr', 'descriptionAr']) {
        assert.ok(!ARABIC.test(String(localized[field] ?? '')), `${lang} leaks Arabic in ${material.id}.${field}`);
      }
    }
  }
});

test('the news desk shows no Arabic to non-Arabic visitors', () => {
  for (const lang of NON_ARABIC) {
    for (const article of PERFUME_NEWS_DATA) {
      const localized = getLocalizedNewsArticle(article, lang) as unknown as Record<string, unknown>;
      for (const field of ['titleAr', 'summaryAr', 'contentAr', 'expertVerdict', 'marketImpact', 'categoryLabelAr']) {
        assert.ok(!ARABIC.test(String(localized[field] ?? '')), `${lang} leaks Arabic in ${article.id}.${field}`);
      }
    }
  }
});
