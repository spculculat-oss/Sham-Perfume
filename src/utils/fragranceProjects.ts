import type { FormulationState, PyramidNote, SavedFormula } from '../types/perfume';
import type { FragranceProject, IngredientRole, ProjectFormula, ProjectIngredient } from '../types/fragranceProject';
import { calculateComposition } from './calculationContract';
import { validateProjectCostLedger } from './projectCostLedger';
import { validateProjectExperimentInput } from './projectJournal';

export const PROJECTS_STORAGE_KEY = 'sham_perfume_projects_v1';
export const ACTIVE_PROJECT_STORAGE_KEY = 'sham_perfume_active_project_v1';
export const PROJECT_EXPORT_FORMAT = 'sham-perfume-projects';
export const PROJECT_EXPORT_VERSION = 1;

export interface ProjectStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface ProjectIdFactory { (): string }
const makeId: ProjectIdFactory = () => globalThis.crypto?.randomUUID?.() ?? `project-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const nowIso = () => new Date().toISOString();

export function makeProjectFormula(formulation: FormulationState, ingredientLines: ProjectIngredient[] = []): ProjectFormula {
  return { formulation: { ...formulation }, basis: 'volume', unit: 'ml', ingredientLines: structuredClone(ingredientLines) };
}

export function createFragranceProject(input: {
  name: string;
  formulation: FormulationState;
  pyramid?: PyramidNote[];
  description?: string;
  family?: string;
  targetProductType?: string;
  now?: string;
  idFactory?: ProjectIdFactory;
}): FragranceProject {
  const timestamp = input.now ?? nowIso();
  const id = (input.idFactory ?? makeId)();
  return {
    schemaVersion: 1,
    id,
    ownerId: null,
    name: input.name.trim() || 'Untitled fragrance project',
    description: input.description ?? '',
    family: input.family ?? '',
    targetProductType: input.targetProductType ?? 'perfume',
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
    formula: makeProjectFormula(input.formulation),
    pyramid: structuredClone(input.pyramid ?? []),
    favoriteMaterialIds: [],
    experiments: [],
    versions: [],
  };
}

/** Explicit, non-destructive adapter: the old SavedFormula remains in its original library untouched. */
export function savedFormulaToProject(formula: SavedFormula, idFactory: ProjectIdFactory = () => `legacy-${formula.id}`): FragranceProject {
  if (!isValidFormulation(formula.formulation)) throw new Error('Legacy formula has invalid or incomplete formulation data; it was left in the old library.');
  const legacyPyramid = Array.isArray(formula.pyramidNotes) ? formula.pyramidNotes.filter(isValidPyramidNote) : [];
  const project = createFragranceProject({
    name: formula.title,
    formulation: formula.formulation,
    pyramid: legacyPyramid,
    description: formula.notes ?? '',
    now: Number.isNaN(Date.parse(formula.dateCreated)) ? nowIso() : new Date(formula.dateCreated).toISOString(),
    idFactory,
  });
  // Pyramid notes are descriptive/organizational records; don't silently convert them into an ingredient recipe.
  project.legacyFormula = { ...structuredClone(formula), pyramidNotes: structuredClone(legacyPyramid) };
  return project;
}

export function projectToSavedFormula(project: FragranceProject): SavedFormula {
  if (project.legacyFormula) return { ...structuredClone(project.legacyFormula), pyramidNotes: structuredClone(project.legacyFormula.pyramidNotes ?? project.pyramid) };
  return {
    id: project.id,
    title: project.name,
    dateCreated: project.createdAt.slice(0, 10),
    notes: project.description,
    formulation: { ...project.formula.formulation },
    pyramidNotes: structuredClone(project.pyramid),
  };
}

export function updateProjectCosting(project: FragranceProject, costing: NonNullable<FragranceProject['costing']>, updatedAt = nowIso()): FragranceProject {
  if (!isValidCosting(costing)) throw new Error('Invalid project costing.');
  return { ...structuredClone(project), costing: { ...costing }, updatedAt };
}

export function updateProjectCostLedger(project: FragranceProject, costLedger: NonNullable<FragranceProject['costLedger']>, updatedAt = nowIso()): FragranceProject {
  if (!validateProjectCostLedger(costLedger)) throw new Error('Invalid project cost ledger.');
  return { ...structuredClone(project), costLedger: structuredClone(costLedger), updatedAt };
}

export function toggleProjectFavoriteMaterial(project: FragranceProject, materialId: string, updatedAt = nowIso()): FragranceProject {
  const favorites = project.favoriteMaterialIds ?? [];
  return {
    ...structuredClone(project),
    favoriteMaterialIds: favorites.includes(materialId) ? favorites.filter((id) => id !== materialId) : [...favorites, materialId],
    updatedAt,
  };
}

export function addProjectIngredient(project: FragranceProject, ingredient: ProjectIngredient, updatedAt = nowIso()): FragranceProject {
  if (project.formula.ingredientLines.some((line) => line.id === ingredient.id)) throw new Error('Duplicate project ingredient id.');
  const next = [...project.formula.ingredientLines, structuredClone(ingredient)];
  return updateProjectIngredients(project, next, updatedAt);
}

export function updateProjectIngredients(project: FragranceProject, ingredientLines: ProjectIngredient[], updatedAt = nowIso()): FragranceProject {
  return {
    ...structuredClone(project),
    formula: { ...structuredClone(project.formula), ingredientLines: structuredClone(ingredientLines) },
    updatedAt,
  };
}

export function calculateProjectIngredientAmounts(project: FragranceProject) {
  const formulation = project.formula.formulation;
  return calculateComposition({
    basis: project.formula.basis,
    target: { value: formulation.bottleVolumeMl * formulation.concentrationPercent / 100, unit: project.formula.unit },
    batchCount: formulation.batchCount,
    lines: project.formula.ingredientLines.map((line) => ({ id: line.id, percentage: line.percentage, density: line.density })),
  });
}

export function updateProjectWorkbench(project: FragranceProject, update: {
  formulation?: FormulationState;
  pyramid?: PyramidNote[];
  name?: string;
  description?: string;
}, updatedAt = nowIso()): FragranceProject {
  const formulation = update.formulation ?? project.formula.formulation;
  const next = structuredClone(project);
  next.name = update.name?.trim() || project.name;
  next.description = update.description ?? project.description;
  next.formula = makeProjectFormula(formulation, project.formula.ingredientLines);
  next.pyramid = structuredClone(update.pyramid ?? project.pyramid);
  next.updatedAt = updatedAt;
  return next;
}

export function snapshotProject(project: FragranceProject, note: string, idFactory: ProjectIdFactory = makeId, createdAt = nowIso()): FragranceProject {
  const snapshot = {
    name: project.name,
    description: project.description,
    family: project.family,
    targetProductType: project.targetProductType,
    formula: structuredClone(project.formula),
    pyramid: structuredClone(project.pyramid),
    favoriteMaterialIds: structuredClone(project.favoriteMaterialIds),
    experiments: structuredClone(project.experiments),
    ...(project.costing ? { costing: structuredClone(project.costing) } : {}),
    ...(project.costLedger ? { costLedger: structuredClone(project.costLedger) } : {}),
  };
  const version = { id: idFactory(), createdAt, note: note.trim() || 'Saved version', snapshot };
  return { ...structuredClone(project), versions: [...project.versions, version], currentVersionId: version.id, updatedAt: createdAt };
}

export function restoreProjectVersion(project: FragranceProject, versionId: string, updatedAt = nowIso()): FragranceProject {
  const version = project.versions.find((item) => item.id === versionId);
  if (!version) throw new Error('Project version not found.');
  const restored: FragranceProject = {
    ...structuredClone(project),
    name: version.snapshot.name,
    description: version.snapshot.description ?? project.description,
    family: version.snapshot.family ?? project.family,
    targetProductType: version.snapshot.targetProductType ?? project.targetProductType,
    formula: structuredClone(version.snapshot.formula),
    pyramid: structuredClone(version.snapshot.pyramid),
    favoriteMaterialIds: structuredClone(version.snapshot.favoriteMaterialIds ?? project.favoriteMaterialIds),
    experiments: structuredClone(version.snapshot.experiments ?? project.experiments),
    currentVersionId: version.id,
    updatedAt,
  };
  if (version.snapshot.costing) restored.costing = structuredClone(version.snapshot.costing);
  else delete restored.costing;
  if (version.snapshot.costLedger) restored.costLedger = structuredClone(version.snapshot.costLedger);
  else delete restored.costLedger;
  return restored;
}

export function duplicateProject(project: FragranceProject, idFactory: ProjectIdFactory = makeId, createdAt = nowIso()): FragranceProject {
  const copy = structuredClone(project);
  copy.id = idFactory();
  copy.name = `${project.name} copy`;
  copy.status = 'active';
  copy.createdAt = createdAt;
  copy.updatedAt = createdAt;
  copy.currentVersionId = undefined;
  copy.versions = [];
  delete copy.legacyFormula;
  return copy;
}

export function archiveProject(project: FragranceProject, updatedAt = nowIso()): FragranceProject {
  return { ...structuredClone(project), status: 'archived', updatedAt };
}

export function restoreArchivedProject(project: FragranceProject, updatedAt = nowIso()): FragranceProject {
  return { ...structuredClone(project), status: 'active', updatedAt };
}

export function deleteArchivedProject(project: FragranceProject): null {
  if (project.status !== 'archived') throw new Error('Only archived projects can be permanently deleted.');
  return null;
}

export function mergeImportedProjects(current: FragranceProject[], incoming: FragranceProject[]): FragranceProject[] {
  const result = [...validateProjects(current)];
  const ids = new Set(result.map((project) => project.id));
  for (const imported of validateProjects(incoming)) {
    let candidate = imported;
    if (ids.has(candidate.id)) {
      let suffix = 2;
      while (ids.has(`${candidate.id}-import-${suffix}`)) suffix++;
      candidate = { ...structuredClone(candidate), id: `${candidate.id}-import-${suffix}` };
    }
    ids.add(candidate.id);
    result.push(candidate);
  }
  return result;
}

const roles: IngredientRole[] = ['oil', 'alcohol', 'water', 'fixative', 'other'];
const concentrations = ['extrait', 'edp', 'edt', 'edc', 'eau_fraiche', 'aftershave', 'mist', 'oil_pure', 'custom'];
function isValidFormulation(value: unknown): value is FormulationState {
  if (!value || typeof value !== 'object') return false;
  const f = value as FormulationState;
  return Number.isFinite(f.bottleVolumeMl) && f.bottleVolumeMl > 0
    && Number.isInteger(f.batchCount) && f.batchCount > 0 && f.batchCount <= 1_000_000
    && Number.isFinite(f.concentrationPercent) && f.concentrationPercent >= 0 && f.concentrationPercent <= 100
    && concentrations.includes(f.concentrationType)
    && Number.isFinite(f.alcoholPercentage) && f.alcoholPercentage >= 0 && f.alcoholPercentage <= 100
    && Number.isFinite(f.waterPercent) && f.waterPercent >= 0 && f.waterPercent <= 100
    && Number.isFinite(f.fixativePercent) && f.fixativePercent >= 0 && f.fixativePercent <= 100
    && Number.isFinite(f.oilDensity) && f.oilDensity > 0
    && Number.isFinite(f.alcoholDensity) && f.alcoholDensity > 0
    && (f.unitMode === 'grams' || f.unitMode === 'ml')
    && (f.currency === undefined || typeof f.currency === 'string');
}
function isValidCosting(value: unknown): value is NonNullable<FragranceProject['costing']> {
  if (!value || typeof value !== 'object') return false;
  const c = value as NonNullable<FragranceProject['costing']>;
  return ['oilCostPerKg', 'alcoholCostPerLiter', 'bottleUnitCost', 'packagingUnitCost', 'laborAndOverheadPerUnit']
    .every((key) => Number.isFinite(c[key as keyof typeof c]) && (c[key as keyof typeof c] as number) >= 0)
    && Number.isInteger(c.batchSize) && c.batchSize >= 1 && c.batchSize <= 1_000_000
    && Number.isFinite(c.targetMarginPercent) && c.targetMarginPercent >= 0 && c.targetMarginPercent <= 1000
    && typeof c.currency === 'string' && /^[A-Z]{3}$/.test(c.currency);
}
function isValidProjectExperiment(value: unknown): value is FragranceProject['experiments'][number] {
  if (!value || typeof value !== 'object') return false;
  const experiment = value as FragranceProject['experiments'][number];
  return typeof experiment.id === 'string' && Boolean(experiment.id.trim())
    && typeof experiment.createdAt === 'string' && Number.isFinite(Date.parse(experiment.createdAt))
    && typeof experiment.updatedAt === 'string' && Number.isFinite(Date.parse(experiment.updatedAt))
    && validateProjectExperimentInput(experiment).length === 0;
}
function isValidPyramidNote(value: unknown): value is PyramidNote {
  if (!value || typeof value !== 'object') return false;
  const note = value as PyramidNote;
  return typeof note.id === 'string' && typeof note.nameAr === 'string' && typeof note.nameEn === 'string'
    && ['top', 'heart', 'base'].includes(note.category)
    && Number.isFinite(note.percentageOfOil)
    && (note.weightGrams === undefined || Number.isFinite(note.weightGrams))
    && (note.volumeMl === undefined || Number.isFinite(note.volumeMl))
    && (note.description === undefined || typeof note.description === 'string');
}
export function isFragranceProject(value: unknown): value is FragranceProject {
  if (!value || typeof value !== 'object') return false;
  const project = value as Partial<FragranceProject>;
  return project.schemaVersion === 1
    && typeof project.id === 'string' && Boolean(project.id)
    && project.ownerId === null
    && typeof project.name === 'string' && Boolean(project.name.trim())
    && typeof project.description === 'string' && typeof project.family === 'string' && typeof project.targetProductType === 'string'
    && (project.status === 'active' || project.status === 'archived')
    && typeof project.createdAt === 'string' && Number.isFinite(Date.parse(project.createdAt))
    && typeof project.updatedAt === 'string' && Number.isFinite(Date.parse(project.updatedAt))
    && Boolean(project.formula && project.formula.basis === 'volume' && project.formula.unit === 'ml'
      && isValidFormulation(project.formula.formulation) && Array.isArray(project.formula.ingredientLines)
      && project.formula.ingredientLines.every((line) => typeof line.id === 'string' && Boolean(line.id.trim())
        && typeof line.name === 'string' && Boolean(line.name.trim())
        && (line.materialId === undefined || (typeof line.materialId === 'string' && Boolean(line.materialId.trim())))
        && roles.includes(line.role) && Number.isFinite(line.percentage) && line.percentage >= 0 && line.percentage <= 100
        && (!line.density || (Number.isFinite(line.density.gramsPerMl) && line.density.gramsPerMl > 0
          && (line.density.confidence === 'verified' ? Boolean(line.density.source?.trim()) : line.density.confidence === 'unverified'))))
      && new Set(project.formula.ingredientLines.map((line) => line.id)).size === project.formula.ingredientLines.length)
    && Array.isArray(project.pyramid) && project.pyramid.every(isValidPyramidNote)
    && Array.isArray(project.favoriteMaterialIds) && project.favoriteMaterialIds.every((id) => typeof id === 'string' && Boolean(id))
    && new Set(project.favoriteMaterialIds).size === project.favoriteMaterialIds.length
    && Array.isArray(project.experiments) && project.experiments.every(isValidProjectExperiment)
    && new Set(project.experiments.map((experiment) => experiment.id)).size === project.experiments.length
    && Array.isArray(project.versions)
    && project.versions.every((version) => Boolean(version && typeof version.id === 'string' && typeof version.note === 'string'
      && typeof version.createdAt === 'string' && Number.isFinite(Date.parse(version.createdAt))
      && typeof version.snapshot?.name === 'string'
      && (version.snapshot.description === undefined || typeof version.snapshot.description === 'string')
      && (version.snapshot.family === undefined || typeof version.snapshot.family === 'string')
      && (version.snapshot.targetProductType === undefined || typeof version.snapshot.targetProductType === 'string')
      && (version.snapshot.favoriteMaterialIds === undefined || (Array.isArray(version.snapshot.favoriteMaterialIds)
        && version.snapshot.favoriteMaterialIds.every((id) => typeof id === 'string' && Boolean(id))
        && new Set(version.snapshot.favoriteMaterialIds).size === version.snapshot.favoriteMaterialIds.length))
      && (version.snapshot.experiments === undefined || (Array.isArray(version.snapshot.experiments)
        && version.snapshot.experiments.every(isValidProjectExperiment)
        && new Set(version.snapshot.experiments.map((experiment) => experiment.id)).size === version.snapshot.experiments.length))
      && version.snapshot.formula?.basis === 'volume' && version.snapshot.formula.unit === 'ml'
      && isValidFormulation(version.snapshot.formula.formulation)
      && Array.isArray(version.snapshot.formula.ingredientLines)
      && version.snapshot.formula.ingredientLines.every((line) => typeof line.id === 'string' && Boolean(line.id.trim())
        && typeof line.name === 'string' && Boolean(line.name.trim()) && roles.includes(line.role)
        && Number.isFinite(line.percentage) && line.percentage >= 0 && line.percentage <= 100)
      && Array.isArray(version.snapshot.pyramid) && version.snapshot.pyramid.every(isValidPyramidNote)))
    && (project.costing === undefined || isValidCosting(project.costing))
    && (project.costLedger === undefined || validateProjectCostLedger(project.costLedger))
    && project.versions.every((version) => (version.snapshot.costing === undefined || isValidCosting(version.snapshot.costing))
      && (version.snapshot.costLedger === undefined || validateProjectCostLedger(version.snapshot.costLedger)))
    && (project.currentVersionId === undefined || (typeof project.currentVersionId === 'string' && project.versions.some((version) => version.id === project.currentVersionId)))
    && (project.legacyFormula === undefined || (typeof project.legacyFormula.id === 'string'
      && typeof project.legacyFormula.title === 'string' && isValidFormulation(project.legacyFormula.formulation)
      && (project.legacyFormula.pyramidNotes === undefined || (Array.isArray(project.legacyFormula.pyramidNotes) && project.legacyFormula.pyramidNotes.every(isValidPyramidNote)))));
}

export function validateProjects(value: unknown): FragranceProject[] {
  if (!Array.isArray(value) || !value.every(isFragranceProject)) throw new Error('Invalid project collection.');
  const ids = new Set<string>();
  for (const project of value) {
    if (ids.has(project.id)) throw new Error('Duplicate project id.');
    ids.add(project.id);
  }
  return structuredClone(value);
}

/** Loading is read-only with respect to the formula library and tolerates unavailable browser storage. */
export function loadProjects(storage: Pick<ProjectStorage, 'getItem'>, key = PROJECTS_STORAGE_KEY): FragranceProject[] {
  try {
    const raw = storage.getItem(key);
    return raw ? validateProjects(JSON.parse(raw)) : [];
  } catch { return []; }
}

export function persistProjects(storage: ProjectStorage, projects: FragranceProject[], key = PROJECTS_STORAGE_KEY): boolean {
  try {
    const safeProjects = validateProjects(projects);
    const previous = storage.getItem(key);
    if (previous !== null) {
      try { validateProjects(JSON.parse(previous)); }
      catch {
        const backupKey = `${key}.backup-v1`;
        if (storage.getItem(backupKey) === null) storage.setItem(backupKey, previous);
        else if (storage.getItem(backupKey) !== previous) return false;
      }
    }
    storage.setItem(key, JSON.stringify(safeProjects));
    return true;
  } catch { return false; }
}

export function importProjectExport(raw: string): FragranceProject[] {
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object') throw new Error('Invalid project export.');
  const envelope = data as { format?: string; version?: number; projects?: unknown };
  if (envelope.format !== PROJECT_EXPORT_FORMAT || envelope.version !== PROJECT_EXPORT_VERSION) throw new Error('Unsupported project export format/version.');
  return validateProjects(envelope.projects);
}

export function exportProjectCollection(projects: FragranceProject[]): string {
  return JSON.stringify({ format: PROJECT_EXPORT_FORMAT, version: PROJECT_EXPORT_VERSION, exportedAt: nowIso(), projects: validateProjects(projects) }, null, 2);
}

export function importLegacyFormulas(projects: FragranceProject[], formulas: SavedFormula[]): { projects: FragranceProject[]; importedCount: number; skippedCount: number } {
  const knownLegacyIds = new Set(projects.map((project) => project.legacyFormula?.id).filter((id): id is string => Boolean(id)));
  const incoming = formulas.filter((formula) => {
    if (knownLegacyIds.has(formula.id)) return false;
    knownLegacyIds.add(formula.id);
    return true;
  });
  const usedProjectIds = new Set(projects.map((project) => project.id));
  const migrated: FragranceProject[] = [];
  let skippedCount = 0;
  for (const formula of incoming) {
    try {
      const base = savedFormulaToProject(formula);
      let id = base.id;
      let suffix = 2;
      while (usedProjectIds.has(id)) id = `${base.id}-import-${suffix++}`;
      usedProjectIds.add(id);
      migrated.push(id === base.id ? base : { ...base, id });
    } catch { skippedCount++; }
  }
  return { projects: [...projects, ...migrated], importedCount: migrated.length, skippedCount };
}
