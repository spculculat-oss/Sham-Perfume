import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSavedFormulas, persistSavedFormulas, restoreSavedFormula, SAVED_FORMULAS_BACKUP_KEY, SAVED_FORMULAS_STORAGE_KEY, snapshotSavedFormula } from '../src/utils/formulaPersistence';
import type { SavedFormula } from '../src/types/perfume';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const formula: SavedFormula = {
  id: 'formula-phase1-roundtrip', title: 'تركيبة اختبار', author: 'مختبر', dateCreated: '2026-11-13',
  batchCode: 'B-01', notes: 'ملاحظة للحفظ والاستعادة', macerationDays: 28,
  formulation: {
    bottleVolumeMl: 75, batchCount: 3, concentrationPercent: 18, concentrationType: 'edp',
    alcoholPercentage: 96, waterPercent: 2, fixativePercent: 1, oilDensity: 0.91,
    alcoholDensity: 0.79, unitMode: 'grams', currency: 'EGP',
  },
  pyramidNotes: [
    { id: 'top-1', nameAr: 'برغموت', nameEn: 'Bergamot', category: 'top', percentageOfOil: 25, description: 'افتتاحية' },
    { id: 'base-1', nameAr: 'خشب', nameEn: 'Wood', category: 'base', percentageOfOil: 75 },
  ],
};

test('calculator save → existing localStorage key → library restore round-trips every formula field unchanged', () => {
  const storage = new MemoryStorage();
  const saved = snapshotSavedFormula(formula);
  assert.equal(persistSavedFormulas(storage, [saved]), true);
  assert.ok(storage.getItem(SAVED_FORMULAS_STORAGE_KEY));
  const library = loadSavedFormulas(storage, []);
  assert.equal(library.length, 1);
  const restored = restoreSavedFormula(library[0]);
  assert.deepEqual(restored, {
    title: formula.title, author: formula.author, batchCode: formula.batchCode, notes: formula.notes,
    macerationDays: formula.macerationDays, formulation: formula.formulation, pyramidNotes: formula.pyramidNotes,
  });
});

test('legacy recipe records are read without migration or field loss; optional fields keep established UI defaults', () => {
  const storage = new MemoryStorage();
  const legacy = { ...formula, author: undefined, batchCode: undefined, notes: undefined, macerationDays: undefined } as unknown as SavedFormula;
  storage.setItem(SAVED_FORMULAS_STORAGE_KEY, JSON.stringify([legacy]));
  const originalRaw = storage.getItem(SAVED_FORMULAS_STORAGE_KEY);
  const records = loadSavedFormulas(storage, []);
  assert.deepEqual(restoreSavedFormula(records[0]), {
    title: formula.title, author: '', batchCode: '', notes: '', macerationDays: 30,
    formulation: formula.formulation, pyramidNotes: formula.pyramidNotes,
  });
  assert.equal(storage.getItem(SAVED_FORMULAS_STORAGE_KEY), originalRaw, 'loading a legacy formula does not rewrite its data');
});

test('broken, empty, or unavailable library storage falls back without destructive writes', () => {
  const fallback = [formula];
  const storage = new MemoryStorage();
  storage.setItem(SAVED_FORMULAS_STORAGE_KEY, '{bad json');
  assert.equal(loadSavedFormulas(storage, fallback), fallback);
  const before = storage.getItem(SAVED_FORMULAS_STORAGE_KEY);
  assert.equal(persistSavedFormulas({ getItem: () => null, setItem() { throw new Error('quota'); } }, [formula]), false);
  assert.equal(storage.getItem(SAVED_FORMULAS_STORAGE_KEY), before);
  const empty = new MemoryStorage();
  empty.setItem(SAVED_FORMULAS_STORAGE_KEY, '[]');
  assert.equal(loadSavedFormulas(empty, fallback), fallback);
  const beforeReplacingCorrupt = storage.getItem(SAVED_FORMULAS_STORAGE_KEY)!;
  assert.equal(persistSavedFormulas(storage, [formula]), true);
  assert.equal(storage.getItem(SAVED_FORMULAS_BACKUP_KEY), beforeReplacingCorrupt, 'corrupt/empty existing bytes are backed up before replacement');
  assert.deepEqual(loadSavedFormulas(storage, []), [formula]);
});
