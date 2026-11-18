/**
 * Calculation Contract v1: pure, unit-explicit composition math shared by lab features.
 * A quantity's unit is never inferred. Conversion between mass and volume is only returned
 * when a positive density is supplied; density without a cited source remains an estimate.
 */
export type CalculationBasis = 'mass' | 'volume';
export type CalculationUnit = 'g' | 'ml';
export type DensityConfidence = 'verified' | 'unverified';

export interface DensityEvidence {
  /** Grams per millilitre. Must be finite and greater than zero. */
  gramsPerMl: number;
  confidence: DensityConfidence;
  /** Required when confidence is verified; provenance is carried to the result. */
  source?: string;
}

export interface CalculationLineInput {
  id: string;
  percentage: number;
  density?: DensityEvidence;
}

export interface CalculationContractInput {
  basis: CalculationBasis;
  target: { value: number; unit: CalculationUnit };
  batchCount?: number;
  lines: readonly CalculationLineInput[];
  /** Absolute difference from 100% permitted without a warning. */
  percentageTolerance?: number;
}

export type CalculationErrorCode =
  | 'INVALID_BASIS' | 'UNIT_BASIS_MISMATCH' | 'INVALID_TARGET' | 'INVALID_BATCH_COUNT'
  | 'EMPTY_LINES' | 'INVALID_LINE_ID' | 'DUPLICATE_LINE_ID' | 'INVALID_PERCENTAGE'
  | 'INVALID_DENSITY' | 'VERIFIED_DENSITY_NEEDS_SOURCE';

export interface CalculationLineResult {
  id: string;
  percentage: number;
  /** Amount in the exact unit supplied for the target. */
  amount: number;
  unit: CalculationUnit;
  /** Derived amount only when density is available. */
  convertedAmount?: number;
  convertedUnit?: CalculationUnit;
  densityConfidence?: DensityConfidence;
  densitySource?: string;
}

export interface CalculationContractResult {
  contractVersion: 1;
  status: 'valid' | 'invalid';
  basis: CalculationBasis;
  target: { value: number; unit: CalculationUnit };
  batchCount: number;
  totalPercentage: number;
  lines: CalculationLineResult[];
  errors: { code: CalculationErrorCode; field: string; message: string }[];
  warnings: { code: 'PERCENTAGE_TOTAL' | 'DENSITY_UNAVAILABLE' | 'DENSITY_UNVERIFIED'; field: string; message: string }[];
}

const finitePositive = (value: number) => Number.isFinite(value) && value > 0;
const amountUnit = (basis: CalculationBasis): CalculationUnit => basis === 'mass' ? 'g' : 'ml';
const convertedUnit = (basis: CalculationBasis): CalculationUnit => basis === 'mass' ? 'ml' : 'g';

export function calculateComposition(input: CalculationContractInput): CalculationContractResult {
  const basis: CalculationBasis = input.basis === 'mass' ? 'mass' : 'volume';
  const unit = amountUnit(basis);
  const count = input.batchCount ?? 1;
  const totalPercentage = Array.isArray(input.lines)
    ? input.lines.reduce((sum, line) => sum + (Number.isFinite(line?.percentage) ? line.percentage : 0), 0)
    : 0;
  const errors: CalculationContractResult['errors'] = [];
  const warnings: CalculationContractResult['warnings'] = [];
  const lines = Array.isArray(input.lines) ? input.lines : [];

  if (input.basis !== 'mass' && input.basis !== 'volume') {
    errors.push({ code: 'INVALID_BASIS', field: 'basis', message: 'Choose mass or volume explicitly.' });
  }
  if (!input.target || input.target.unit !== unit) {
    errors.push({ code: 'UNIT_BASIS_MISMATCH', field: 'target.unit', message: `The ${basis} basis requires ${unit}.` });
  }
  if (!input.target || !finitePositive(input.target.value)) {
    errors.push({ code: 'INVALID_TARGET', field: 'target.value', message: 'Target quantity must be a finite positive number.' });
  }
  if (!Number.isInteger(count) || count < 1 || count > 1_000_000) {
    errors.push({ code: 'INVALID_BATCH_COUNT', field: 'batchCount', message: 'Batch count must be a whole number from 1 to 1,000,000.' });
  }
  if (lines.length === 0) errors.push({ code: 'EMPTY_LINES', field: 'lines', message: 'Add at least one ingredient line.' });

  const seen = new Set<string>();
  lines.forEach((line, index) => {
    const field = `lines[${index}]`;
    if (typeof line?.id !== 'string' || !line.id.trim()) {
      errors.push({ code: 'INVALID_LINE_ID', field: `${field}.id`, message: 'Each ingredient needs a non-empty id.' });
    } else if (seen.has(line.id)) {
      errors.push({ code: 'DUPLICATE_LINE_ID', field: `${field}.id`, message: 'Ingredient ids must be unique.' });
    } else seen.add(line.id);
    if (!Number.isFinite(line?.percentage) || line.percentage < 0 || line.percentage > 100) {
      errors.push({ code: 'INVALID_PERCENTAGE', field: `${field}.percentage`, message: 'Each percentage must be finite and between 0 and 100.' });
    }
    const density = line?.density;
    if (density && (!finitePositive(density.gramsPerMl) || (density.confidence !== 'verified' && density.confidence !== 'unverified'))) {
      errors.push({ code: 'INVALID_DENSITY', field: `${field}.density`, message: 'Density must be finite, positive, and explicitly marked verified or unverified.' });
    } else if (density?.confidence === 'verified' && !density.source?.trim()) {
      errors.push({ code: 'VERIFIED_DENSITY_NEEDS_SOURCE', field: `${field}.density.source`, message: 'A verified density must include its source.' });
    }
  });

  const tolerance = Number.isFinite(input.percentageTolerance) && (input.percentageTolerance ?? 0) >= 0
    ? input.percentageTolerance!
    : 0.01;
  if (lines.length && Number.isFinite(totalPercentage) && Math.abs(totalPercentage - 100) > tolerance) {
    warnings.push({ code: 'PERCENTAGE_TOTAL', field: 'lines', message: `Ingredient percentages total ${totalPercentage}%, not 100%.` });
  }
  lines.forEach((line, index) => {
    if (!line?.density) {
      warnings.push({ code: 'DENSITY_UNAVAILABLE', field: `lines[${index}].density`, message: 'No mass/volume conversion is available without a density.' });
    } else if (line.density.confidence === 'unverified') {
      warnings.push({ code: 'DENSITY_UNVERIFIED', field: `lines[${index}].density`, message: 'Converted amount is an estimate; the density has no verified source.' });
    }
  });

  const valid = errors.length === 0;
  const outputLines = valid ? lines.map((line) => {
    const amount = input.target.value * line.percentage / 100;
    if (!line.density) return { id: line.id, percentage: line.percentage, amount, unit };
    const convertedAmount = basis === 'volume'
      ? amount * line.density.gramsPerMl
      : amount / line.density.gramsPerMl;
    return {
      id: line.id,
      percentage: line.percentage,
      amount,
      unit,
      convertedAmount,
      convertedUnit: convertedUnit(basis),
      densityConfidence: line.density.confidence,
      ...(line.density.source?.trim() ? { densitySource: line.density.source.trim() } : {}),
    };
  }) : [];

  return {
    contractVersion: 1,
    status: valid ? 'valid' : 'invalid',
    basis,
    target: { value: input.target?.value ?? 0, unit: input.target?.unit ?? unit },
    batchCount: count,
    totalPercentage,
    lines: outputLines,
    errors,
    warnings,
  };
}

/** Explicit validation result for older consumers that need to display errors without throwing. */
export function assertCalculationValid(result: CalculationContractResult): CalculationContractResult {
  if (result.status === 'invalid') {
    const detail = result.errors.map((error) => `${error.field}: ${error.message}`).join('; ');
    throw new RangeError(`Invalid calculation input: ${detail}`);
  }
  return result;
}
