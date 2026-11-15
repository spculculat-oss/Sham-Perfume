import assert from 'node:assert/strict';
import test from 'node:test';
import { addSavedCosmetic, readSavedCosmetics, type SavedCosmetic } from '../src/components/CosmeticsHub';
import { COSMETICS_UI } from '../src/لغات/cosmeticsL10n';

const one: SavedCosmetic = { product: 'face_cream', skin: 'normal', concerns: ['hydration'], batch: 100, scent: false, nutFree: false, vegan: false, at: 1 };

test('cosmetics save: a saved formula comes back, broken or unknown entries are dropped', () => {
  assert.deepEqual(readSavedCosmetics(JSON.stringify([one])), [one]);
  assert.deepEqual(readSavedCosmetics('not json'), []);
  assert.deepEqual(readSavedCosmetics(null), []);
  assert.deepEqual(readSavedCosmetics(JSON.stringify([{ ...one, product: 'rocket' }, { ...one, concerns: ['<script>'] }, 5, null])), []);
  assert.equal(readSavedCosmetics(JSON.stringify([{ ...one, batch: 999999 }]))[0]!.batch, 2000);
});

test('cosmetics save: newest first, same choices saved twice stay one, at most 20', () => {
  let list: SavedCosmetic[] = [];
  list = addSavedCosmetic(list, one);
  list = addSavedCosmetic(list, { ...one, at: 2 });
  assert.equal(list.length, 1);
  assert.equal(list[0]!.at, 2);
  for (let i = 0; i < 30; i++) list = addSavedCosmetic(list, { ...one, batch: 10 + i, at: 10 + i });
  assert.equal(list.length, 20);
  assert.equal(list[0]!.batch, 39);
});

test('cosmetics save: the button words exist in Arabic and English (no fake "saving to your account")', () => {
  for (const k of ['save', 'savedOk', 'savedTitle', 'savedRemove'] as const) {
    assert.ok(COSMETICS_UI[k].ar && COSMETICS_UI[k].en, k);
    assert.doesNotMatch(COSMETICS_UI[k].ar, /حسابك/);
  }
});
