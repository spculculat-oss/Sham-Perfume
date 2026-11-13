import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { harvestInlineTexts } from '../scripts/shaheen-languages/translator';
import { clearAiPacks, registerAiPack } from '../src/لغات/aiPacks';
import { pickArEn } from '../src/لغات/localize';
import { tx } from '../src/community/ui';

test('#502: the smart translator now collects Arabic/English pairs written as calls', () => {
  const src = [
    "<span>{t('مجتمع شام', 'Sham Community')}</span>",
    "actionHint: pickArEn(currentLang, 'كل أخبار العطور', 'All perfume news'),",
    "const x = c(\"عطر\", \"Perfume\");",
    "// t('تعليق', 'Comment only')",
    "t('key', 'English only'); t(`نص ${a}`, `Text ${a}`);",
  ].join('\n');
  const found = harvestInlineTexts(src).map((h) => h.en);
  assert.deepEqual(found, ['Sham Community', 'All perfume news', 'Perfume']);
});

test('#502: pair helpers read the translator’s copy before falling back to English', () => {
  clearAiPacks();
  registerAiPack('ca', { text: { 'Sham Community': 'Comunitat Sham' } });
  assert.equal(tx('ca')('مجتمع شام', 'Sham Community'), 'Comunitat Sham');
  assert.equal(pickArEn('ca', 'مجتمع شام', 'Sham Community'), 'Comunitat Sham');
  assert.equal(tx('ar')('مجتمع شام', 'Sham Community'), 'مجتمع شام');
  assert.equal(tx('en')('مجتمع شام', 'Sham Community'), 'Sham Community');
  assert.equal(tx('de')('مجتمع شام', 'Sham Community'), 'Sham Community');
  clearAiPacks();
});

test('#502: the main screens no longer hard-wire «Arabic or English» copy', () => {
  const ternary = /\b(?:currentLang|lang|language) === 'ar' \? '[^'\n]*[\u0600-\u06FF][^'\n]*' : '[^'\n]*[A-Za-z]{2}[^'\n]*'/;
  for (const file of ['Header', 'Footer', 'HomeHub', 'AuthModal', 'ReportButton', 'Storefront', 'StoreInvoiceBreakdown', 'ProductDetail']) {
    assert.doesNotMatch(readFileSync(`src/components/${file}.tsx`, 'utf8'), ternary, file);
  }
});
