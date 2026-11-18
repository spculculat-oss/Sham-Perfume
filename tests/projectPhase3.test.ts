import test from 'node:test';
import assert from 'node:assert/strict';
import { createFragranceProject, exportProjectCollection, importProjectExport, isFragranceProject, restoreProjectVersion, snapshotProject, updateProjectCostLedger } from '../src/utils/fragranceProjects';
import { calculateProjectCostLedger, createProjectCostLedger, validateProjectCostLedger } from '../src/utils/projectCostLedger';
import { addProjectExperiment, createProjectExperiment, deleteProjectExperiment, updateProjectExperiment } from '../src/utils/projectJournal';
import type { FormulationState } from '../src/types/perfume';

const formulation: FormulationState = {
  bottleVolumeMl: 50, batchCount: 1, concentrationPercent: 20, concentrationType: 'edp',
  alcoholPercentage: 79, waterPercent: 0, fixativePercent: 1, oilDensity: 0.92,
  alcoholDensity: 0.8, unitMode: 'ml', currency: 'EGP',
};
const base = () => createFragranceProject({ name: 'Test', formulation, idFactory: () => 'p1', now: '2026-11-13T10:00:00.000Z' });

test('cost ledger calculates per-batch tax, unit cost, markup, and gross margin with distinct bases', () => {
  const ledger = { ...createProjectCostLedger('EGP'), batchUnits: 10, inputTaxPercent: 10, targetPercent: 50, lines: [
    { id: 'raw', label: 'Materials', category: 'materials' as const, batchAmount: 100, subjectToInputTax: true },
    { id: 'pack', label: 'Bottles', category: 'packaging' as const, batchAmount: 50, subjectToInputTax: false },
  ] };
  const markup = calculateProjectCostLedger(ledger);
  assert.equal(markup.status, 'valid');
  assert.equal(markup.subtotalBatch, 150);
  assert.equal(markup.taxableSubtotalBatch, 100);
  assert.equal(markup.inputTaxBatch, 10);
  assert.equal(markup.totalBatchCost, 160);
  assert.equal(markup.costPerUnit, 16);
  assert.equal(markup.pricePerUnit, 24);
  assert.equal(markup.effectiveGrossMarginPercent, 33.33333333333333);
  const grossMargin = calculateProjectCostLedger({ ...ledger, pricingBasis: 'gross_margin' });
  assert.equal(grossMargin.pricePerUnit, 32);
  assert.equal(grossMargin.effectiveGrossMarginPercent, 50);
});

test('cost ledger rejects invalid currencies, duplicate line ids, and impossible gross margin targets', () => {
  const ledger = createProjectCostLedger();
  assert.equal(validateProjectCostLedger({ ...ledger, currency: 'egp' }), false);
  assert.equal(validateProjectCostLedger({ ...ledger, pricingBasis: 'gross_margin', targetPercent: 100 }), false);
  assert.equal(validateProjectCostLedger({ ...ledger, lines: [
    { id: 'same', label: 'A', category: 'other', batchAmount: 1 },
    { id: 'same', label: 'B', category: 'other', batchAmount: 2 },
  ] }), false);
  assert.equal(calculateProjectCostLedger({ ...ledger, lines: [{ id: 'x', label: '', category: 'other', batchAmount: -1 }] }).status, 'invalid');
});

test('ledger and journal persist, export-round-trip, and version restore as project-local records', () => {
  const project = base();
  const ledger = { ...createProjectCostLedger('EGP'), batchUnits: 5, lines: [{ id: 'line1', label: 'Inputs', category: 'materials' as const, batchAmount: 42 }] };
  const withLedger = updateProjectCostLedger(project, ledger, '2026-11-13T10:01:00.000Z');
  const entry = createProjectExperiment({ batchCode: 'B-17', observedAt: '2026-11-12', conditions: 'Room temperature', observation: 'Top notes faded after one hour.', evaluation: 'Repeat test.' }, () => 'exp1', '2026-11-13T10:02:00.000Z');
  const withJournal = addProjectExperiment(withLedger, entry);
  assert.equal(isFragranceProject(withJournal), true);
  const versioned = snapshotProject(withJournal, 'Phase 3 state', () => 'v1', '2026-11-13T10:03:00.000Z');
  const changed = updateProjectCostLedger({ ...versioned, experiments: [] }, createProjectCostLedger('USD'));
  const restored = restoreProjectVersion(changed, 'v1');
  assert.deepEqual(restored.costLedger, ledger);
  assert.deepEqual(restored.experiments, [entry]);
  const jsonRoundTrip = JSON.parse(JSON.stringify(restored));
  assert.equal(isFragranceProject(jsonRoundTrip), true);
  const imported = importProjectExport(exportProjectCollection([restored]));
  assert.deepEqual(imported[0].costLedger, ledger);
  assert.deepEqual(imported[0].experiments, [entry]);
});

test('journal supports edit and delete, and rejects bad dates and blank observations', () => {
  const project = base();
  const input = { batchCode: ' B-1 ', observedAt: '2026-11-13', conditions: '', observation: 'Initial observation', evaluation: '' };
  const first = createProjectExperiment(input, () => 'exp1', '2026-11-13T10:00:00.000Z');
  const added = addProjectExperiment(project, first);
  assert.throws(() => createProjectExperiment({ ...input, observedAt: '2026-02-31' }));
  assert.throws(() => createProjectExperiment({ ...input, observation: '  ' }));
  const edited = updateProjectExperiment(added, 'exp1', { ...input, batchCode: 'B-2', observation: 'Updated observation' }, '2026-11-13T11:00:00.000Z');
  assert.equal(edited.experiments[0].batchCode, 'B-2');
  assert.equal(edited.experiments[0].createdAt, first.createdAt);
  assert.equal(deleteProjectExperiment(edited, 'exp1').experiments.length, 0);
});
