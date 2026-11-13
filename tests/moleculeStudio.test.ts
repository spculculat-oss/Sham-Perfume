import assert from 'node:assert/strict';
import test from 'node:test';
import { RAW_MATERIALS_DATABASE } from '../src/data/rawMaterials';
import {
  analyzePyramidNotes,
  calculateIngredientMassGrams,
  matchRawMaterialName,
  parsePerfumeIngredientList,
} from '../src/utils/moleculeStudio';

const hedione = RAW_MATERIALS_DATABASE.find((item) => item.id === 'mat-hedione');
assert.ok(hedione, 'test fixture should include Hedione');

test('ingredient lists parse English phases and percentages without guessing missing fields', () => {
  const parsed = parsePerfumeIngredientList(
    'Hedione | heart | 12%\nUnknown accord | base\n# comment\nAmbroxan; base; 8',
    RAW_MATERIALS_DATABASE,
  );

  assert.equal(parsed.rows.length, 3);
  assert.equal(parsed.rows[0].name, 'Hedione');
  assert.equal(parsed.rows[0].phase, 'heart');
  assert.equal(parsed.rows[0].percentage, 12);
  assert.equal(parsed.rows[0].matchStatus, 'matched');
  assert.equal(parsed.rows[0].material?.casNumber, hedione?.casNumber);
  assert.equal(parsed.rows[1].name, 'Unknown accord');
  assert.equal(parsed.rows[1].phase, 'base');
  assert.equal(parsed.rows[1].percentage, undefined);
  assert.equal(parsed.rows[1].matchStatus, 'unmatched');
  assert.equal(parsed.rows[2].percentage, 8);
  assert.deepEqual(parsed.issues, []);
});

test('ingredient lists accept Arabic digits and Arabic phase labels', () => {
  const parsed = parsePerfumeIngredientList('هيديون | قلب | ١٢٫٥٪', RAW_MATERIALS_DATABASE);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].phase, 'heart');
  assert.equal(parsed.rows[0].percentage, 12.5);
  assert.equal(parsed.rows[0].matchStatus, 'matched');
});

test('comma decimal percentages are parsed before list-field separators', () => {
  const parsed = parsePerfumeIngredientList('Hedione | heart | 12,5%', RAW_MATERIALS_DATABASE);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].name, 'Hedione');
  assert.equal(parsed.rows[0].phase, 'heart');
  assert.equal(parsed.rows[0].percentage, 12.5);
});

test('a CAS number shared by multiple reference records is reported as ambiguous', () => {
  const match = matchRawMaterialName('64-17-5', RAW_MATERIALS_DATABASE);
  assert.equal(match.status, 'ambiguous');
  assert.ok((match.candidates?.length ?? 0) > 1);
});

test('single-field name plus percent parses, and out-of-range percentages are flagged', () => {
  const parsed = parsePerfumeIngredientList('Hedione 12%\nAmbroxan | base | 110%', RAW_MATERIALS_DATABASE);
  assert.equal(parsed.rows[0].name, 'Hedione');
  assert.equal(parsed.rows[0].percentage, 12);
  assert.equal(parsed.rows[1].percentage, 110);
  assert.equal(parsed.rows[1].percentageIssue, 'outside-range');
  assert.equal(parsed.issues.length, 1);
});

test('draft analysis preserves supplied ratios and does not claim a match for an accord', () => {
  const rows = analyzePyramidNotes([
    { id: 'known', nameAr: 'هيديون', nameEn: 'Hedione', category: 'heart', percentageOfOil: 20 },
    { id: 'accord', nameAr: 'أكورد غير معروف', nameEn: 'Unlisted accord', category: 'base', percentageOfOil: 80 },
  ], RAW_MATERIALS_DATABASE);

  assert.equal(rows[0].percentage, 20);
  assert.equal(rows[0].matchStatus, 'matched');
  assert.equal(rows[1].percentage, 80);
  assert.equal(rows[1].matchStatus, 'unmatched');
});

test('batch-mass conversion uses only supplied, valid percentages', () => {
  assert.equal(calculateIngredientMassGrams(12, 250), 30);
  assert.equal(calculateIngredientMassGrams(undefined, 250), undefined);
  assert.equal(calculateIngredientMassGrams(120, 250), undefined);
  assert.equal(calculateIngredientMassGrams(10, -2), undefined);
});
