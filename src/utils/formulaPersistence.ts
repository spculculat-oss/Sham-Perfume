import type { FormulationState, PyramidNote, SavedFormula } from '../types/perfume';

export const SAVED_FORMULAS_STORAGE_KEY = 'miyaar_perfume_saved_formulas';
export const SAVED_FORMULAS_BACKUP_KEY = `${SAVED_FORMULAS_STORAGE_KEY}.backup-v1`;

export interface FormulaStorageReader { getItem(key: string): string | null }
export interface FormulaStorageWriter { setItem(key: string, value: string): void }
export type FormulaStorage = FormulaStorageReader & FormulaStorageWriter;

/**
 * Reads the legacy browser library without transforming its records. A malformed/unavailable store
 * falls back to the supplied presets; no migration or destructive cleanup is performed.
 */
export function loadSavedFormulas(
  storage: FormulaStorageReader,
  fallback: SavedFormula[],
  key = SAVED_FORMULAS_STORAGE_KEY,
): SavedFormula[] {
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed as SavedFormula[] : fallback;
  } catch {
    return fallback;
  }
}

/** Writes the same JSON array format used by the existing app and reports quota/storage failures. */
export function persistSavedFormulas(
  storage: FormulaStorage,
  formulas: SavedFormula[],
  key = SAVED_FORMULAS_STORAGE_KEY,
): boolean {
  try {
    const previous = storage.getItem(key);
    if (previous !== null) {
      let validCollection = false;
      try {
        const parsed: unknown = JSON.parse(previous);
        validCollection = Array.isArray(parsed) && parsed.length > 0;
      } catch { /* preserve corrupt legacy bytes before replacing them */ }
      if (!validCollection && key === SAVED_FORMULAS_STORAGE_KEY) {
        // Keep a separate raw snapshot each time; fail closed if it cannot be written.
        let savedBackup = false;
        for (let version = 1; version <= 20; version++) {
          const backupKey = version === 1 ? SAVED_FORMULAS_BACKUP_KEY : `${SAVED_FORMULAS_STORAGE_KEY}.backup-v${version}`;
          const existingBackup = storage.getItem(backupKey);
          if (existingBackup === previous) { savedBackup = true; break; }
          if (existingBackup === null) {
            storage.setItem(backupKey, previous);
            savedBackup = true;
            break;
          }
        }
        if (!savedBackup) throw new Error('Could not safely back up the existing formula library.');
      }
    }
    storage.setItem(key, JSON.stringify(formulas));
    return true;
  } catch {
    return false;
  }
}

/** Detaches a saved snapshot from live React state using the same JSON semantics as localStorage. */
export function snapshotSavedFormula<T extends SavedFormula>(formula: T): T {
  return JSON.parse(JSON.stringify(formula)) as T;
}

export interface RestoredFormula {
  title: string;
  author: string;
  batchCode: string;
  notes: string;
  macerationDays: number;
  formulation: FormulationState;
  pyramidNotes: PyramidNote[];
}

/** Restores the full current legacy record shape; optional fields retain the app's previous defaults. */
export function restoreSavedFormula(formula: SavedFormula): RestoredFormula {
  const saved = snapshotSavedFormula(formula);
  return {
    title: saved.title,
    author: saved.author || '',
    batchCode: saved.batchCode || '',
    notes: saved.notes || '',
    macerationDays: saved.macerationDays || 30,
    formulation: saved.formulation,
    pyramidNotes: saved.pyramidNotes || [],
  };
}
