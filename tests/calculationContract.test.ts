import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateAlcoholDilution, calculateCosting, calculatePerfumeFormulation, calculatePyramidDistribution, LEGACY_DENSITY_ESTIMATES } from '../src/utils/calculations';
import { calculateComposition, type CalculationContractInput } from '../src/utils/calculationContract';
import type { FormulationState } from '../src/types/perfume';
import { toolOf, type SpecialistToolContext } from '../server/specialists/tools';

const density = (gramsPerMl: number, confidence: 'verified' | 'unverified' = 'verified') => ({
  gramsPerMl, confidence, ...(confidence === 'verified' ? { source: 'test supplier data sheet' } : {}),
} as const);
const input = (overrides: Partial<CalculationContractInput> = {}): CalculationContractInput => ({
  basis: 'volume', target: { value: 100, unit: 'ml' }, batchCount: 1,
  lines: [
    { id: 'oil', percentage: 20, density: density(0.9) },
    { id: 'ethanol', percentage: 80, density: density(0.8) },
  ],
  ...overrides,
});
const legacyState = (overrides: Partial<FormulationState> = {}): FormulationState => ({
  bottleVolumeMl: 50, batchCount: 1, concentrationPercent: 20, concentrationType: 'edp',
  alcoholPercentage: 96, waterPercent: 0, fixativePercent: 1,
  oilDensity: 0.92, alcoholDensity: 0.8, unitMode: 'grams', ...overrides,
});

test('volume basis calculates exact millilitres and separately derives grams using stated densities', () => {
  const result = calculateComposition(input());
  assert.equal(result.status, 'valid');
  assert.equal(result.basis, 'volume');
  assert.deepEqual(result.lines.map(({ amount, unit, convertedAmount, convertedUnit }) => ({ amount, unit, convertedAmount, convertedUnit })), [
    { amount: 20, unit: 'ml', convertedAmount: 18, convertedUnit: 'g' },
    { amount: 80, unit: 'ml', convertedAmount: 64, convertedUnit: 'g' },
  ]);
  assert.equal(result.warnings.length, 0);
});

test('mass basis calculates grams and only derives millilitres when density is supplied', () => {
  const result = calculateComposition(input({
    basis: 'mass', target: { value: 25, unit: 'g' },
    lines: [{ id: 'oil', percentage: 100, density: density(0.8) }],
  }));
  assert.equal(result.lines[0].amount, 25);
  assert.equal(result.lines[0].unit, 'g');
  assert.equal(result.lines[0].convertedAmount, 31.25);
  assert.equal(result.lines[0].convertedUnit, 'ml');
});

test('density is never silently invented; unverified conversions are explicitly estimates', () => {
  const missing = calculateComposition(input({ lines: [{ id: 'oil', percentage: 100 }] }));
  assert.equal(missing.lines[0].amount, 100);
  assert.equal(missing.lines[0].unit, 'ml');
  assert.equal(missing.lines[0].convertedAmount, undefined);
  assert.ok(missing.warnings.some((warning) => warning.code === 'DENSITY_UNAVAILABLE'));

  const estimate = calculateComposition(input({ lines: [{ id: 'oil', percentage: 100, density: density(0.92, 'unverified') }] }));
  assert.equal(estimate.lines[0].convertedAmount, 92);
  assert.equal(estimate.lines[0].densityConfidence, 'unverified');
  assert.ok(estimate.warnings.some((warning) => warning.code === 'DENSITY_UNVERIFIED'));
});

test('verified density requires a source and invalid densities fail closed', () => {
  const noSource = calculateComposition(input({ lines: [{ id: 'oil', percentage: 100, density: { gramsPerMl: 0.9, confidence: 'verified' } }] }));
  assert.equal(noSource.status, 'invalid');
  assert.ok(noSource.errors.some((error) => error.code === 'VERIFIED_DENSITY_NEEDS_SOURCE'));
  for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = calculateComposition(input({ lines: [{ id: 'oil', percentage: 100, density: density(value) }] }));
    assert.equal(result.status, 'invalid', `density ${value} must be invalid`);
  }
});

test('invalid quantity, wrong unit, invalid count, negative and non-finite percentages are rejected', () => {
  const badInputs: CalculationContractInput[] = [
    input({ target: { value: 0, unit: 'ml' } }),
    input({ target: { value: -1, unit: 'ml' } }),
    input({ target: { value: Number.NaN, unit: 'ml' } }),
    input({ target: { value: 100, unit: 'g' } }),
    input({ batchCount: 0 }), input({ batchCount: 1.5 }), input({ batchCount: 1_000_001 }),
    input({ lines: [{ id: 'oil', percentage: -0.1 }] }),
    input({ lines: [{ id: 'oil', percentage: 100.1 }] }),
    input({ lines: [{ id: 'oil', percentage: Number.NaN }] }),
  ];
  for (const bad of badInputs) assert.equal(calculateComposition(bad).status, 'invalid');
});

test('percentage totals that are not 100 warn without silently normalizing the recipe', () => {
  const result = calculateComposition(input({ lines: [{ id: 'oil', percentage: 25 }] }));
  assert.equal(result.status, 'valid');
  assert.equal(result.lines[0].percentage, 25);
  assert.equal(result.lines[0].amount, 25);
  assert.ok(result.warnings.some((warning) => warning.code === 'PERCENTAGE_TOTAL'));
});

test('duplicate/empty ingredient ids and empty formulas are rejected', () => {
  assert.equal(calculateComposition(input({ lines: [{ id: '', percentage: 50 }, { id: '', percentage: 50 }] })).status, 'invalid');
  assert.equal(calculateComposition(input({ lines: [{ id: 'x', percentage: 50 }, { id: 'x', percentage: 50 }] })).status, 'invalid');
  assert.equal(calculateComposition(input({ lines: [] })).status, 'invalid');
});

test('legacy calculator adapter preserves valid formula outputs and marks all density-derived masses as estimates', () => {
  const result = calculatePerfumeFormulation(legacyState());
  assert.equal(result.calculationStatus, 'valid');
  assert.equal(result.oilVolumeMl, 10);
  assert.ok(Math.abs(result.oilWeightGrams - 9.2) < 1e-10);
  assert.equal(result.alcoholVolumeMl, 39.5);
  assert.equal(result.alcoholWeightGrams, 31.6);
  assert.equal(result.fixativeVolumeMl, 0.5);
  assert.equal(result.fixativeWeightGrams, 0.51);
  assert.equal(result.totalVolumeMl, 50);
  assert.ok(Math.abs(result.totalWeightGrams - 41.31) < 1e-10);
  assert.equal(result.batchTotalWeightGrams, result.totalWeightGrams);
  assert.equal(result.massEstimateStatus, 'estimated');
  assert.ok(result.calculationWarnings?.some((warning) => /unverified|estimate/i.test(warning)));
  assert.deepEqual(LEGACY_DENSITY_ESTIMATES, { oilGramsPerMl: 0.92, alcoholGramsPerMl: 0.8, waterGramsPerMl: 1, fixativeGramsPerMl: 1.02 });
});

test('legacy calculator flags negative, overfull, and invalid batch inputs instead of reporting a valid calculation', () => {
  for (const state of [
    legacyState({ bottleVolumeMl: 0 }), legacyState({ batchCount: -1 }),
    legacyState({ concentrationPercent: -1 }), legacyState({ concentrationPercent: 101 }),
    legacyState({ waterPercent: 90 }), legacyState({ oilDensity: 0 }), legacyState({ alcoholDensity: Number.NaN }),
  ]) {
    const result = calculatePerfumeFormulation(state);
    assert.equal(result.calculationStatus, 'invalid');
    assert.ok(result.calculationErrors?.length);
    assert.equal(result.totalWeightGrams, 0);
  }
});

test('dilution calculator handles boundary and invalid values', () => {
  const valid = calculateAlcoholDilution(96, 80, 100);
  assert.equal(valid.isValid, true);
  assert.equal(valid.requiredInitialVolumeMl, 100 * 80 / 96);
  assert.equal(valid.requiredWaterVolumeMl, 100 - 100 * 80 / 96);
  assert.equal(calculateAlcoholDilution(80, 80, 100).isValid, false);
  assert.equal(calculateAlcoholDilution(96, 0, 100).isValid, false);
  assert.equal(calculateAlcoholDilution(96, 80, -1).isValid, false);
  assert.equal(calculateAlcoholDilution(Number.NaN, 80, 100).isValid, false);
  assert.equal(calculateAlcoholDilution(96, Number.POSITIVE_INFINITY, 100).isValid, false);
});

test('costing keeps unit conversions explicit and yields stable zero-cost and positive-cost results', () => {
  const formula = calculatePerfumeFormulation(legacyState());
  const result = calculateCosting(formula, {
    oilCostPerKg: 1000, alcoholCostPerLiter: 100, bottleUnitCost: 2,
    packagingUnitCost: 1, laborAndOverheadPerUnit: 0, batchSize: 2, targetMarginPercent: 50,
  });
  assert.ok(Math.abs(result.oilCostPerBottle - 9.2) < 1e-10);
  assert.ok(Math.abs(result.alcoholCostPerBottle - 3.95) < 1e-10);
  assert.equal(result.packagingCostPerBottle, 3);
  assert.ok(Math.abs(result.totalCostPerBottle - 16.15) < 1e-10);
  assert.equal(result.suggestedRetailPrice, result.totalCostPerBottle * 1.5);
  assert.equal(result.calculationStatus, 'valid');
  assert.ok(result.calculationWarnings.some((warning) => /estimated mass/i.test(warning)));
  const invalid = calculateCosting(formula, {
    oilCostPerKg: Number.NaN, alcoholCostPerLiter: 100, bottleUnitCost: 2,
    packagingUnitCost: 1, laborAndOverheadPerUnit: 0, batchSize: 2.5, targetMarginPercent: 50,
  });
  assert.equal(invalid.calculationStatus, 'invalid');
  assert.equal(invalid.totalCostPerBottle, 0);
  assert.ok(invalid.calculationErrors.length >= 2);
  const zeroMarkup = calculateCosting(formula, { oilCostPerKg: 0, alcoholCostPerLiter: 0, bottleUnitCost: 0,
    packagingUnitCost: 0, laborAndOverheadPerUnit: 0, batchSize: 1, targetMarginPercent: 0 });
  assert.equal(zeroMarkup.suggestedRetailPrice, 0);
  assert.equal(calculateCosting({ ...formula, massEstimateStatus: 'unavailable' }, {
    oilCostPerKg: 1, alcoholCostPerLiter: 1, bottleUnitCost: 1, packagingUnitCost: 1,
    laborAndOverheadPerUnit: 0, batchSize: 1, targetMarginPercent: 10,
  }).calculationStatus, 'invalid');
  assert.equal(calculateCosting(formula, {
    oilCostPerKg: 0, alcoholCostPerLiter: 0, bottleUnitCost: 0, packagingUnitCost: 0,
    laborAndOverheadPerUnit: 0, batchSize: 1, targetMarginPercent: 0,
  }).totalCostPerBottle, 0);
});

test('pyramid allocation preserves total percentages and handles an empty pyramid', () => {
  const note = { id: 'n1', nameAr: 'عود', nameEn: 'Oud', category: 'base' as const, percentageOfOil: 100 };
  const one = calculatePyramidDistribution([note], 10, 12);
  assert.equal(one.totalPercentage, 100);
  assert.equal(one.notesWithQuantities[0].weightGrams, 10);
  assert.equal(one.notesWithQuantities[0].volumeMl, 12);
  const empty = calculatePyramidDistribution([], 0, 0);
  assert.equal(empty.totalPercentage, 0);
  assert.deepEqual(empty.notesWithQuantities, []);
  assert.equal(empty.calculationStatus, 'valid');
  const partial = calculatePyramidDistribution([{ ...note, percentageOfOil: 40 }], 10, 12);
  assert.ok(partial.calculationWarnings.some((warning) => /not 100%/.test(warning)));
  assert.equal(partial.notesWithQuantities[0].percentageOfOil, 40, 'shares are not silently normalized');
  assert.equal(calculatePyramidDistribution([{ ...note, percentageOfOil: -1 }], 10, 12).calculationStatus, 'invalid');
  assert.equal(calculatePyramidDistribution([note], Number.NaN, 12).calculationStatus, 'invalid');
  assert.equal(calculatePyramidDistribution([note, note], 10, 12).calculationStatus, 'invalid');
});

test('Shaheen calculation tools disclose estimated masses and never invent pyramid grams without density', async () => {
  const context = { lang: 'ar', question: 'حساب تركيبة', env: {}, signal: AbortSignal.timeout(1000) } as SpecialistToolContext;
  const concentration = await toolOf('calc_concentration')!.run({ volumeMl: 50, percent: 20 }, context);
  assert.ok(concentration?.observation.includes('الأوزان تقديرية من كثافات غير موثقة'));
  const invalid = await toolOf('calc_concentration')!.run({ volumeMl: 50, percent: 20, waterPercent: 90 }, context);
  assert.equal(invalid, undefined);
  const pyramid = await toolOf('calc_pyramid')!.run({ top: 30, heart: 40, base: 30, oilMl: 10 }, context);
  assert.ok(pyramid?.observation.includes('الكتلة بالجرام غير محسوبة لعدم توفر كثافة موثقة'));
  assert.doesNotMatch(pyramid?.observation || '', /\d(?:\.\d+)?\s*جم/);
  const costing = await toolOf('calc_cost')!.run({ volumeMl: 50, percent: 20, oilCostPerKg: 1200 }, context);
  assert.ok(costing?.observation.includes('كثافة غير موثقة'));
});
