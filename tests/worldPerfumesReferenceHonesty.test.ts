import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  formatWorldPerfumeReference,
  WorldPerfumesLibrary,
  worldPerfumeStudyDisclaimer,
  worldPerfumeStudyTitle,
} from '../src/components/WorldPerfumesLibrary';
import { WORLD_PERFUMES } from '../src/data/worldPerfumes';
import { getLocalizedPerfume } from '../src/لغات/localizedContent';

function renderLibrary(currentLang: 'ar' | 'en' | 'fr') {
  return renderToStaticMarkup(React.createElement(WorldPerfumesLibrary, {
    currentLang,
    onLoadWorldFormula: () => {},
    onPrintWorldFormula: () => {},
  }));
}

test('the world perfume library explicitly identifies its ratios as inspired educational examples', () => {
  const arabic = renderLibrary('ar');
  assert.ok(arabic.includes('لا تمثل تركيبات الشركات الأصلية'));
  assert.ok(arabic.includes('ليست تركيبات أصلية مؤكدة'));
  assert.ok(!arabic.includes('النسب الدقيقة'));
  assert.ok(!arabic.includes('الدار الأصلية'));

  const english = renderLibrary('en');
  assert.ok(english.includes('not manufacturers’ original formulas'));
  assert.ok(english.includes('not verified original formulas'));
  assert.ok(english.includes('not tested'));
  assert.ok(english.includes('Suggested model maceration'));
  assert.ok(!english.includes('Optimal Maceration'));
  assert.ok(!english.includes('Master Formula'));

  const french = renderLibrary('fr');
  assert.ok(french.includes('pas des formules originales vérifiées'));
  assert.ok(!/[\u0600-\u06FF]/.test(french));
});

test('copied reference text carries the non-original-formula disclaimer in Arabic, English and French', () => {
  const recipe = WORLD_PERFUMES.find((item) => item.id === 'creed-aventus');
  assert.ok(recipe);

  const arabicCopy = formatWorldPerfumeReference(recipe, 'ar');
  assert.ok(arabicCopy.includes('ليست تركيبة أصلية مؤكدة'));
  assert.ok(arabicCopy.includes('توزيع توضيحي'));

  const englishCopy = formatWorldPerfumeReference(recipe, 'en');
  assert.ok(englishCopy.includes('illustrative proportions only—not a verified original formula'));
  assert.ok(englishCopy.includes('Illustrative accord breakdown (100%)'));
  assert.ok(!englishCopy.includes('Master Formula'));

  const frenchCopy = formatWorldPerfumeReference(recipe, 'fr');
  assert.ok(frenchCopy.includes('pas une formule originale vérifiée'));
});

test('downstream load/print labels and notes preserve the inspired-study disclaimer', () => {
  assert.ok(worldPerfumeStudyTitle('Aventus', 'ar').startsWith('نموذج أكورد تعليمي مستوحى'));
  assert.ok(worldPerfumeStudyTitle('Aventus', 'en').startsWith('Inspired educational accord study'));
  assert.ok(worldPerfumeStudyTitle('Aventus', 'fr').startsWith('Étude pédagogique d’accord inspirée'));
  assert.ok(worldPerfumeStudyDisclaimer('ar').includes('لا تمثل تركيبات الشركات الأصلية'));
  assert.ok(worldPerfumeStudyDisclaimer('en').includes('not manufacturers’ original formulas'));
  assert.ok(worldPerfumeStudyDisclaimer('fr').includes('ni formules originales des fabricants'));
});

test('the English Aventus reference is titled as an accord study, not a master formula', () => {
  const recipe = WORLD_PERFUMES.find((item) => item.id === 'creed-aventus');
  assert.ok(recipe);
  assert.ok(!recipe.nameEn.includes('Master Formula'));
  const localized = getLocalizedPerfume(recipe, 'en');
  assert.ok(localized.nameAr.includes('Accord Study'));
  assert.ok(!localized.nameAr.includes('Master Formula'));
  assert.ok(!localized.nameEn.includes('Master Formula'));
});
