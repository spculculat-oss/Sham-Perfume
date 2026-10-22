import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { COSMETIC_INGREDIENTS } from '../src/utils/cosmeticIngredients';
import {
  CONCERNS, COSMETIC_PRODUCTS, SKIN_TYPES, checkCosmeticFormula, cosmeticFor, cosmeticReply, formulateCosmetic, looksCosmetic, readCosmeticBrief,
  type Concern,
} from '../src/utils/cosmeticFormulator';
import {
  COSMETIC_CONCERN_TEXT, COSMETIC_INGREDIENT_TEXT, COSMETIC_LESSONS, COSMETIC_PRODUCT_TEXT, COSMETIC_ROLE_TEXT, COSMETIC_SKIN_TEXT,
  COSMETIC_STEPS, COSMETIC_WARNINGS, COSMETICS_UI,
} from '../src/لغات/cosmeticsL10n';
import { loc, type LText } from '../src/لغات/localize';
import { designFor } from '../src/utils/shaheenDesigner';
import { productSection, sectionFromHash } from '../src/utils/storeSections';
import { SCHOOL_EXPERTS, fieldsOf } from '../src/utils/shaheenAgent';
import { SCIENCE_TRACKS } from '../src/data/sciences';
import { harvestInlineTexts } from '../scripts/shaheen-languages/translator';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ARABIC = /[\u0600-\u06FF]/;

test('cosmetics formulator: every product × skin × goal × option gives a safe formula that adds up to 100 %', () => {
  let n = 0;
  for (const product of COSMETIC_PRODUCTS) for (const skin of SKIN_TYPES) {
    for (const concerns of [[], ...CONCERNS.map((c) => [c]), ['acne', 'glow', 'aging']] as Concern[][]) {
      for (const scent of [false, true]) for (const nutFree of [false, true]) {
        const f = formulateCosmetic({ product, skin, concerns, batch: 250, scent, nutFree, vegan: nutFree });
        assert.deepEqual(checkCosmeticFormula(f), [], `${product}/${skin}/${concerns.join('+')}/${scent}/${nutFree}`);
        const grams = f.lines.reduce((s, l) => s + l.grams, 0);
        assert.ok(Math.abs(grams - 250) < 0.05, `grams add up to the batch (${grams})`);
        n += 1;
      }
    }
  }
  assert.ok(n > 1000);
});

test('cosmetics formulator: water always brings a preservative, and the safety rules hold', () => {
  for (const product of COSMETIC_PRODUCTS) {
    const f = formulateCosmetic({ product, skin: 'normal', concerns: [], batch: 100 });
    const preserved = f.lines.some((l) => l.id === 'preservative');
    assert.equal(preserved, f.hasWater, `${product}: preservative ⇔ water`);
    if (f.hasWater) assert.ok(f.warnings.includes('preservative_required') && f.ph, product);
    assert.ok(f.warnings.includes('patch_test') && f.warnings.includes('not_medicine'), product);
  }
  // Sensitive skin never gets essential oils, even when asked.
  const sensitive = formulateCosmetic({ product: 'face_cream', skin: 'sensitive', concerns: ['soothing'], batch: 100, scent: true });
  assert.ok(!sensitive.lines.some((l) => l.id === 'lavender' || l.id === 'tea_tree'));
  assert.ok(sensitive.warnings.includes('sensitive_no_scent'));
  // Lips: never essential oils.
  assert.ok(!formulateCosmetic({ product: 'lip_balm', skin: 'normal', concerns: [], batch: 30, scent: true }).lines.some((l) => l.id === 'lavender'));
  // Nut-free: no nut ingredient anywhere.
  for (const product of COSMETIC_PRODUCTS) {
    const f = formulateCosmetic({ product, skin: 'dry', concerns: [], batch: 100, nutFree: true });
    assert.ok(!f.lines.some((l) => ['argan', 'almond', 'shea'].includes(l.id)), product);
  }
  // A broken formula is caught.
  const broken = formulateCosmetic({ product: 'face_cream', skin: 'normal', concerns: [], batch: 100 });
  broken.lines = broken.lines.filter((l) => l.id !== 'preservative');
  assert.ok(checkCosmeticFormula(broken).some((p) => /preservative|total/.test(p)));
});

test('cosmetics: every ingredient, product, role, step and warning has its words in Arabic and English', () => {
  for (const x of COSMETIC_INGREDIENTS) {
    const text = COSMETIC_INGREDIENT_TEXT[x.id];
    assert.ok(text, x.id);
    for (const v of [text.name, text.does, text.note]) assert.ok(ARABIC.test(v.ar) && v.en && !ARABIC.test(v.en), x.id);
    assert.ok(COSMETIC_ROLE_TEXT[x.role], x.role);
    assert.ok(x.typical[0] <= x.typical[1] && x.typical[1] <= x.max, `${x.id} range`);
  }
  for (const p of COSMETIC_PRODUCTS) assert.ok(COSMETIC_PRODUCT_TEXT[p]);
  for (const s of SKIN_TYPES) assert.ok(COSMETIC_SKIN_TEXT[s]);
  for (const c of CONCERNS) assert.ok(COSMETIC_CONCERN_TEXT[c]);
  const all: LText[] = [
    ...Object.values(COSMETICS_UI), ...Object.values(COSMETIC_WARNINGS), ...Object.values(COSMETIC_STEPS).flat(),
    ...COSMETIC_LESSONS.flatMap((l) => [l.title, l.question, l.answer]),
  ];
  for (const v of all) assert.ok(ARABIC.test(v.ar) && v.en && !ARABIC.test(v.en), v.en);
});

test('cosmetics: a non-Arabic visitor never reads Arabic, and the translator can find every text', () => {
  for (const lang of ['en', 'fr', 'de', 'ja', 'sw', 'tr'] as const) {
    const f = formulateCosmetic({ product: 'face_cream', skin: 'dry', concerns: ['glow'], batch: 100, scent: true });
    assert.ok(!ARABIC.test(cosmeticReply(f, lang)), `${lang} reply`);
    for (const l of COSMETIC_LESSONS) assert.ok(!ARABIC.test(loc(lang, l.answer)), `${lang} ${l.id}`);
  }
  // «المترجم الذكي» reads {ar, en} on one line: every English text of the file must be found.
  const source = readFileSync(fileURLToPath(new URL('../src/لغات/cosmeticsL10n.ts', import.meta.url)), 'utf8');
  const found = new Set(harvestInlineTexts(source).map((h) => h.en));
  for (const v of [...Object.values(COSMETICS_UI), ...COSMETIC_LESSONS.map((l) => l.answer), ...Object.values(COSMETIC_WARNINGS)]) {
    if (/\p{L}{2,}/u.test(v.en)) assert.ok(found.has(v.en), `the translator cannot see: ${v.en.slice(0, 50)}`);
  }
});

test('Shaheen reads a cosmetic request, answers it with the formula, and the perfume designer steps aside', () => {
  const brief = readCosmeticBrief('اعملي تركيبة كريم مرطب لبشرة جافة 200 جرام');
  assert.equal(brief?.product, 'face_cream');
  assert.equal(brief?.skin, 'dry');
  assert.equal(brief?.batch, 200);
  assert.equal(readCosmeticBrief('ازاي اعمل مرطب شفايف نباتي')?.product, 'lip_balm');
  assert.equal(readCosmeticBrief('ازاي اعمل مرطب شفايف نباتي')?.vegan, true);
  assert.equal(readCosmeticBrief('عايز وصفة سيروم للحبوب')?.product, 'gel_serum');
  assert.equal(readCosmeticBrief('عايز وصفة سيروم للحبوب')?.skin, 'oily');
  assert.equal(readCosmeticBrief('how do I make a whipped body butter, nut-free')?.product, 'body_butter');
  assert.equal(readCosmeticBrief('make me a hair oil for dry hair')?.product, 'hair_oil');
  assert.equal(readCosmeticBrief('اعمل غسول وش للبشرة الدهنية')?.product, 'face_wash');
  // Not formula requests: a knowledge question, a perfume.
  assert.equal(readCosmeticBrief('ايه فايدة الكريم المرطب؟'), undefined);
  assert.equal(looksCosmetic('صمم عطر فيه ورد وفانيليا'), false);
  assert.ok(designFor('صمم عطر فيه ورد وفانيليا', 'ar')?.design, 'perfume design still works');
  assert.equal(designFor('اعملي تركيبة كريم مرطب للوش', 'ar'), undefined, 'a cream is not a perfume');

  const ar = cosmeticFor('اعملي تركيبة كريم مرطب لبشرة جافة', 'ar');
  assert.ok(ar && ar.lang === 'ar');
  assert.match(ar.reply, /المرحلة \(أ\)/);
  assert.match(ar.reply, /مادة حافظة/);
  assert.match(ar.reply, /اختبار الرقعة/);
  assert.match(ar.reply, /الكمية مش مذكورة/);
  const en = cosmeticFor('give me a recipe for a face serum for glow', 'en');
  assert.ok(en && en.lang === 'en' && /Phase A/.test(en.reply) && !ARABIC.test(en.reply));
});

test('cosmetics science: a track, a school expert who owns its questions, and the store sections', () => {
  const track = SCIENCE_TRACKS.find((t) => t.id === 'cosmetics');
  assert.ok(track && track.lessons.length === COSMETIC_LESSONS.length);
  assert.match(track.boundaryAr, /مفيش/);
  assert.ok(SCHOOL_EXPERTS.some((e) => e.field === 'cosmetics'));
  assert.equal(fieldsOf('ازاي اختار سيروم وكريم مرطب لبشرتي الدهنية؟')[0]?.field, 'cosmetics');
  assert.equal(fieldsOf('ايه أحسن تركيز للعطر عشان يثبت؟')[0]?.field, 'perfume');

  assert.equal(productSection({ category: 'رجالي' }), 'perfumes');
  assert.equal(productSection({ category: 'Skin care' }), 'cosmetics');
  assert.equal(productSection({ category: 'كريمات' }), 'cosmetics');
  assert.equal(sectionFromHash('#store?section=cosmetics'), 'cosmetics');
  assert.equal(sectionFromHash('#store'), 'all');
});

test('the cosmetics page and the home gateway render in Arabic and in English without Arabic', async () => {
  (globalThis as { React?: unknown }).React = React;
  const { default: CosmeticsHub } = await import('../src/components/CosmeticsHub');
  const { SectionsGateway } = await import('../src/components/SectionsGateway');
  const ar = renderToStaticMarkup(React.createElement(CosmeticsHub, { currentLang: 'ar', onNavigate: () => {} }));
  assert.match(ar, /مستحضرات التجميل/);
  assert.match(ar, /المرحلة \(أ\)/);
  for (const lang of ['en', 'de'] as const) {
    const html = renderToStaticMarkup(React.createElement(CosmeticsHub, { currentLang: lang, onNavigate: () => {} }))
      + renderToStaticMarkup(React.createElement(SectionsGateway, { currentLang: lang, onNavigate: () => {} }));
    assert.ok(!ARABIC.test(html.replace(/<[^>]+>/g, ' ')), `${lang} shows Arabic`);
    assert.match(html, /Phase A|Phase/);
  }
});
