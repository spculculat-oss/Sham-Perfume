import type { FragranceProject, ProjectExperiment } from '../types/fragranceProject';

export interface ProjectExperimentInput {
  batchCode: string;
  observedAt: string;
  conditions: string;
  observation: string;
  evaluation: string;
}
export type ProjectIdFactory = () => string;
const makeId: ProjectIdFactory = () => globalThis.crypto?.randomUUID?.() ?? `experiment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const nowIso = () => new Date().toISOString();

export function validateProjectExperimentInput(input: ProjectExperimentInput): string[] {
  const errors: string[] = [];
  if (typeof input.batchCode !== 'string' || !input.batchCode.trim() || input.batchCode.length > 80) errors.push('Batch code is required and must be at most 80 characters.');
  const dateMatch = typeof input.observedAt === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.observedAt) : null;
  const date = dateMatch ? new Date(Date.UTC(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]))) : null;
  if (!dateMatch || !date || date.toISOString().slice(0, 10) !== input.observedAt) errors.push('Observation date must be a valid YYYY-MM-DD date.');
  if (typeof input.conditions !== 'string' || input.conditions.length > 2000) errors.push('Conditions must be at most 2,000 characters.');
  if (typeof input.observation !== 'string' || !input.observation.trim() || input.observation.length > 5000) errors.push('Observation is required and must be at most 5,000 characters.');
  if (typeof input.evaluation !== 'string' || input.evaluation.length > 3000) errors.push('Evaluation must be at most 3,000 characters.');
  return errors;
}

export function createProjectExperiment(input: ProjectExperimentInput, idFactory: ProjectIdFactory = makeId, timestamp = nowIso()): ProjectExperiment {
  const errors = validateProjectExperimentInput(input);
  if (errors.length) throw new Error(errors.join(' '));
  return { ...input, batchCode: input.batchCode.trim(), id: idFactory(), createdAt: timestamp, updatedAt: timestamp };
}

export function addProjectExperiment(project: FragranceProject, experiment: ProjectExperiment): FragranceProject {
  if (project.experiments.some((entry) => entry.id === experiment.id)) throw new Error('Duplicate experiment id.');
  return { ...structuredClone(project), experiments: [...structuredClone(project.experiments), structuredClone(experiment)], updatedAt: experiment.updatedAt };
}

export function updateProjectExperiment(project: FragranceProject, id: string, input: ProjectExperimentInput, updatedAt = nowIso()): FragranceProject {
  const errors = validateProjectExperimentInput(input);
  if (errors.length) throw new Error(errors.join(' '));
  const exists = project.experiments.some((entry) => entry.id === id);
  if (!exists) throw new Error('Experiment not found.');
  return {
    ...structuredClone(project),
    experiments: project.experiments.map((entry) => entry.id === id
      ? { ...entry, ...input, batchCode: input.batchCode.trim(), updatedAt }
      : entry),
    updatedAt,
  };
}

export function deleteProjectExperiment(project: FragranceProject, id: string, updatedAt = nowIso()): FragranceProject {
  if (!project.experiments.some((entry) => entry.id === id)) throw new Error('Experiment not found.');
  return { ...structuredClone(project), experiments: project.experiments.filter((entry) => entry.id !== id), updatedAt };
}
