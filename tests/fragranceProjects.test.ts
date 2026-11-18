import test from 'node:test';
import assert from 'node:assert/strict';
import type { FormulationState, SavedFormula } from '../src/types/perfume';
import {
  ACTIVE_PROJECT_STORAGE_KEY,
  PROJECTS_STORAGE_KEY,
  addProjectIngredient,
  archiveProject,
  calculateProjectIngredientAmounts,
  createFragranceProject,
  deleteArchivedProject,
  duplicateProject,
  exportProjectCollection,
  importLegacyFormulas,
  importProjectExport,
  loadProjects,
  mergeImportedProjects,
  persistProjects,
  projectToSavedFormula,
  restoreArchivedProject,
  restoreProjectVersion,
  savedFormulaToProject,
  snapshotProject,
  toggleProjectFavoriteMaterial,
  updateProjectCosting,
  updateProjectIngredients,
  updateProjectWorkbench,
} from '../src/utils/fragranceProjects';

const formulation: FormulationState = {
  bottleVolumeMl: 50, batchCount: 2, concentrationPercent: 20, concentrationType: 'edp',
  alcoholPercentage: 79, waterPercent: 0, fixativePercent: 1, oilDensity: 0.92,
  alcoholDensity: 0.8, unitMode: 'ml', currency: 'EGP',
};
const legacy: SavedFormula = {
  id: 'legacy-a', title: 'Cairo dusk', dateCreated: '2026-01-05', author: 'Maker', batchCode: 'B-7',
  notes: 'Test notes', macerationDays: 40, formulation, pyramidNotes: [{ id: 'n1', nameAr: 'ورد', nameEn: 'Rose', category: 'heart', percentageOfOil: 100 }],
};
const ids = (...values: string[]) => { let i = 0; return () => values[i++] ?? `generated-${i}`; };

function fakeStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
    data,
  };
}

test('new projects are local/private and model an explicit volume basis with ingredient lines', () => {
  const project = createFragranceProject({ name: '  Test  ', formulation, idFactory: ids('p1'), now: '2026-02-01T00:00:00Z' });
  assert.equal(project.name, 'Test');
  assert.equal(project.ownerId, null);
  assert.equal(project.formula.basis, 'volume');
  assert.equal(project.formula.unit, 'ml');
  assert.deepEqual(project.formula.ingredientLines, []);
  assert.deepEqual(project.experiments, []);
});

test('legacy formula import is explicit, repeat-safe, and retains the original record for round trip', () => {
  const { projects, importedCount } = importLegacyFormulas([], [legacy]);
  assert.equal(importedCount, 1);
  assert.equal(projects[0].id, 'legacy-legacy-a');
  assert.deepEqual(projectToSavedFormula(projects[0]), legacy);
  assert.equal(projects[0].formula.ingredientLines.length, 0, 'descriptive pyramid notes are not silently treated as a material formula');
  const repeated = importLegacyFormulas(projects, [legacy]);
  assert.equal(repeated.importedCount, 0);
  assert.equal(repeated.projects.length, 1);
});

test('workbench edits update project formula and pyramid without replacing project identity', () => {
  const base = createFragranceProject({ name: 'Lab', formulation, pyramid: legacy.pyramidNotes, idFactory: ids('p1'), now: '2026-01-01T00:00:00Z' });
  const original = updateProjectIngredients(base, [{ id: 'i1', name: 'Rose', role: 'other', percentage: 100 }]);
  const nextFormulation = { ...formulation, bottleVolumeMl: 100 };
  const updated = updateProjectWorkbench(original, { formulation: nextFormulation, pyramid: [] }, '2026-02-01T00:00:00Z');
  assert.equal(updated.id, original.id);
  assert.equal(updated.formula.formulation.bottleVolumeMl, 100);
  assert.equal(updated.formula.ingredientLines[0].percentage, 100);
  assert.deepEqual(updated.pyramid, []);
  assert.equal(updated.updatedAt, '2026-02-01T00:00:00Z');
  assert.equal(original.formula.formulation.bottleVolumeMl, 50);
});

test('project costing persists only validated explicit input and restores with the project', () => {
  const project = createFragranceProject({ name: 'Cost project', formulation, idFactory: ids('p') });
  const costing = { oilCostPerKg: 1000, alcoholCostPerLiter: 40, bottleUnitCost: 20, packagingUnitCost: 10, laborAndOverheadPerUnit: 5, batchSize: 24, targetMarginPercent: 80, currency: 'EGP' };
  const editedByWorkbench = updateProjectWorkbench(project, { formulation: { ...formulation, bottleVolumeMl: 75 }, pyramid: legacy.pyramidNotes });
  const updated = updateProjectCosting(editedByWorkbench, costing);
  const storage = fakeStorage();
  assert.equal(persistProjects(storage, [updated]), true);
  assert.deepEqual(loadProjects(storage)[0].costing, costing);
  assert.equal(loadProjects(storage)[0].formula.formulation.bottleVolumeMl, 75);
  assert.equal(loadProjects(storage)[0].pyramid[0].nameEn, 'Rose');
  assert.throws(() => updateProjectCosting(project, { ...costing, oilCostPerKg: Number.NaN }));
});

test('material favorites are project-scoped, toggleable, and serializable', () => {
  const project = createFragranceProject({ name: 'Favorites', formulation, idFactory: ids('p') });
  const favorite = toggleProjectFavoriteMaterial(project, 'mat-rose', '2026-02-01T00:00:00Z');
  assert.deepEqual(favorite.favoriteMaterialIds, ['mat-rose']);
  assert.deepEqual(toggleProjectFavoriteMaterial(favorite, 'mat-rose').favoriteMaterialIds, []);
  const storage = fakeStorage();
  assert.equal(persistProjects(storage, [favorite]), true);
  assert.deepEqual(loadProjects(storage)[0].favoriteMaterialIds, ['mat-rose']);
});

test('raw-material selection links catalog identity without copying unverified catalog density or inventing a share', () => {
  const project = createFragranceProject({ name: 'Catalog link', formulation, idFactory: ids('p') });
  const linked = addProjectIngredient(project, { id: 'line-1', materialId: 'material-1', name: 'Selected catalog name', role: 'other', percentage: 0 });
  assert.equal(linked.formula.ingredientLines[0].materialId, 'material-1');
  assert.equal(linked.formula.ingredientLines[0].percentage, 0);
  assert.equal(linked.formula.ingredientLines[0].density, undefined);
  assert.throws(() => addProjectIngredient(linked, linked.formula.ingredientLines[0]), /Duplicate/);
});

test('ingredient lines use the central unit contract and never infer mass without density', () => {
  const project = createFragranceProject({ name: 'Lines', formulation, idFactory: ids('p') });
  const updated = updateProjectIngredients(project, [
    { id: 'a', name: 'Ingredient A', role: 'other', percentage: 60 },
    { id: 'b', name: 'Ingredient B', role: 'other', percentage: 40, density: { gramsPerMl: 0.8, confidence: 'unverified' } },
  ]);
  const result = calculateProjectIngredientAmounts(updated);
  assert.equal(result.status, 'valid');
  assert.equal(result.target.value, 10); // 50 ml at 20% concentrate
  assert.equal(result.lines[0].amount, 6);
  assert.equal(result.lines[0].convertedAmount, undefined);
  assert.equal(result.lines[1].amount, 4);
  assert.equal(result.lines[1].convertedAmount, 3.2);
  assert.equal(result.warnings.some((warning) => warning.code === 'DENSITY_UNVERIFIED'), true);
  const unbalanced = calculateProjectIngredientAmounts(updateProjectIngredients(project, [
    { id: 'a', name: 'Ingredient A', role: 'other', percentage: 60 },
  ]));
  assert.equal(unbalanced.status, 'valid');
  assert.equal(unbalanced.warnings.some((warning) => warning.code === 'PERCENTAGE_TOTAL'), true);
});

test('duplicate, archive, restore, and confirmed-domain delete rules are safe', () => {
  const project = createFragranceProject({ name: 'A', formulation, idFactory: ids('a') });
  const copy = duplicateProject(project, ids('b'), '2026-02-01T00:00:00Z');
  assert.notEqual(copy.id, project.id);
  assert.equal(copy.name, 'A copy');
  assert.deepEqual(copy.versions, []);
  const archived = archiveProject(project, '2026-02-02T00:00:00Z');
  assert.equal(archived.status, 'archived');
  assert.throws(() => deleteArchivedProject(project), /Only archived/);
  assert.equal(deleteArchivedProject(archived), null);
  assert.equal(restoreArchivedProject(archived).status, 'active');
});

test('immutable project snapshots can be restored without mutating later state', () => {
  const base = createFragranceProject({ name: 'A', description: 'Original description', family: 'Oriental', targetProductType: 'perfume', formulation, pyramid: legacy.pyramidNotes, idFactory: ids('p1') });
  const project = toggleProjectFavoriteMaterial(base, 'mat-rose');
  const versioned = snapshotProject(project, 'initial', ids('v1'), '2026-02-01T00:00:00Z');
  const priced = updateProjectCosting(versioned, { oilCostPerKg: 1, alcoholCostPerLiter: 1, bottleUnitCost: 1, packagingUnitCost: 1, laborAndOverheadPerUnit: 1, batchSize: 1, targetMarginPercent: 0, currency: 'EGP' });
  const edited = updateProjectWorkbench(priced, { formulation: { ...formulation, bottleVolumeMl: 99 }, pyramid: [], name: 'Changed', description: 'Changed description' });
  edited.family = 'Fresh';
  edited.targetProductType = 'mist';
  edited.favoriteMaterialIds = [];
  const restored = restoreProjectVersion(edited, 'v1', '2026-02-02T00:00:00Z');
  assert.equal(restored.formula.formulation.bottleVolumeMl, 50);
  assert.equal(restored.pyramid.length, 1);
  assert.equal(restored.name, 'A');
  assert.equal(restored.description, 'Original description');
  assert.equal(restored.family, 'Oriental');
  assert.equal(restored.targetProductType, 'perfume');
  assert.deepEqual(restored.favoriteMaterialIds, ['mat-rose']);
  assert.equal(edited.formula.formulation.bottleVolumeMl, 99);
  assert.equal(restored.currentVersionId, 'v1');
  assert.equal(restored.costing, undefined, 'restoring a version without project costing clears later costing');
  assert.throws(() => restoreProjectVersion(project, 'missing'));
});

test('pre-metadata project versions remain readable and restore without dropping current metadata', () => {
  const project = createFragranceProject({ name: 'Old project', family: 'Fresh', formulation, idFactory: ids('old') });
  project.favoriteMaterialIds = ['mat-legacy'];
  project.versions = [{ id: 'old-version', createdAt: '2026-02-01T00:00:00Z', note: 'legacy snapshot', snapshot: {
    name: 'Earlier name', formula: project.formula, pyramid: [],
  } }];
  project.currentVersionId = 'old-version';
  const storage = fakeStorage({ [PROJECTS_STORAGE_KEY]: JSON.stringify([project]) });
  assert.equal(loadProjects(storage).length, 1);
  const restored = restoreProjectVersion(project, 'old-version');
  assert.equal(restored.family, 'Fresh');
  assert.deepEqual(restored.favoriteMaterialIds, ['mat-legacy']);
});

test('versioned JSON export imports and rejects unsupported or malformed payloads', () => {
  const project = createFragranceProject({ name: 'A', formulation, idFactory: ids('p1') });
  const imported = importProjectExport(exportProjectCollection([project]));
  assert.deepEqual(imported, [project]);
  assert.throws(() => importProjectExport(JSON.stringify({ format: 'other', version: 1, projects: [] })), /Unsupported/);
  assert.throws(() => importProjectExport(JSON.stringify({ format: 'sham-perfume-projects', version: 1, projects: [{ id: 'bad' }] })), /Invalid project/);
});

test('import collision is non-destructive and assigns a distinct project id', () => {
  const existing = createFragranceProject({ name: 'Existing', formulation, idFactory: ids('same') });
  const imported = createFragranceProject({ name: 'Imported', formulation, idFactory: ids('same') });
  const merged = mergeImportedProjects([existing], [imported]);
  assert.deepEqual(merged.map((project) => project.id), ['same', 'same-import-2']);
  assert.equal(merged[0].name, 'Existing');
});

test('project local adapter validates writes, reads failures as empty, and backs up corrupt old bytes', () => {
  const project = createFragranceProject({ name: 'A', formulation, idFactory: ids('p1') });
  const storage = fakeStorage({ [PROJECTS_STORAGE_KEY]: '{broken' });
  assert.deepEqual(loadProjects(storage), []);
  assert.equal(persistProjects(storage, [project]), true);
  assert.equal(storage.getItem(`${PROJECTS_STORAGE_KEY}.backup-v1`), '{broken');
  assert.deepEqual(loadProjects(storage), [project]);
  assert.equal(persistProjects(storage, [{ id: 'invalid' } as never]), false);
  assert.equal(storage.getItem(ACTIVE_PROJECT_STORAGE_KEY), null);
});
