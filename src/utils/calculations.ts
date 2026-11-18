import { CalculationResult, FormulationState, PyramidNote } from '../types/perfume';
import { calculateComposition, type DensityEvidence } from './calculationContract';

/** Compatibility estimates for legacy screens; these are explicitly unverified, not reference data. */
export const LEGACY_DENSITY_ESTIMATES = { oilGramsPerMl: 0.92, alcoholGramsPerMl: 0.8, waterGramsPerMl: 1, fixativeGramsPerMl: 1.02 } as const;

function legacyDensity(value: number | undefined, fallback: number): DensityEvidence {
  // Missing historic fields keep the pre-contract estimate; an explicitly entered zero/invalid value is rejected.
  return {
    gramsPerMl: value === undefined ? fallback : value,
    confidence: 'unverified',
    ...(value === undefined ? { source: 'legacy compatibility estimate (not verified)' } : {}),
  };
}

/**
 * Existing UI compatibility adapter. The v1 contract treats the final batch as a volume recipe;
 * its ingredient masses are estimates until every density has a verified source. Existing formula
 * objects and their density fields are read as-is; no saved data is rewritten or migrated here.
 */
export function calculatePerfumeFormulation(state: FormulationState): CalculationResult {
  const oilPct = state.concentrationPercent;
  const waterPct = state.waterPercent;
  const fixativePct = state.fixativePercent;
  const alcoholPct = 100 - oilPct - waterPct - fixativePct;
  const volume = state.bottleVolumeMl;
  const count = state.batchCount;
  const contract = calculateComposition({
    basis: 'volume',
    target: { value: volume, unit: 'ml' },
    batchCount: count,
    lines: [
      { id: 'oil', percentage: oilPct, density: legacyDensity(state.oilDensity, LEGACY_DENSITY_ESTIMATES.oilGramsPerMl) },
      { id: 'alcohol', percentage: alcoholPct, density: legacyDensity(state.alcoholDensity, LEGACY_DENSITY_ESTIMATES.alcoholGramsPerMl) },
      { id: 'water', percentage: waterPct, density: { gramsPerMl: LEGACY_DENSITY_ESTIMATES.waterGramsPerMl, confidence: 'unverified' } },
      { id: 'fixative', percentage: fixativePct, density: { gramsPerMl: LEGACY_DENSITY_ESTIMATES.fixativeGramsPerMl, confidence: 'unverified' } },
    ],
  });
  const amount = (id: string) => contract.lines.find((line) => line.id === id)?.amount ?? 0;
  const mass = (id: string) => contract.lines.find((line) => line.id === id)?.convertedAmount ?? 0;
  const oilVol = amount('oil');
  const alcoholVol = amount('alcohol');
  const waterVol = amount('water');
  const fixativeVol = amount('fixative');
  const oilWeight = mass('oil');
  const alcoholWeight = mass('alcohol');
  const waterWeight = mass('water');
  const fixativeWeight = mass('fixative');
  const totalWeight = oilWeight + alcoholWeight + waterWeight + fixativeWeight;
  const valid = contract.status === 'valid';
  const volumeOrZero = valid && Number.isFinite(volume) ? volume : 0;
  const batchCountOrZero = valid ? count : 0;

  return {
    calculationStatus: contract.status,
    calculationErrors: contract.errors.map((error) => `${error.field}: ${error.message}`),
    calculationWarnings: [
      ...contract.warnings.map((warning) => warning.message),
      ...(contract.lines.some((line) => line.densitySource?.startsWith('legacy compatibility'))
        ? ['A legacy density estimate was used because this older recipe had no density value.']
        : []),
    ],
    massEstimateStatus: valid ? 'estimated' : 'unavailable',
    oilVolumeMl: oilVol,
    oilWeightGrams: oilWeight,
    oilPercent: valid ? oilPct : 0,
    alcoholVolumeMl: alcoholVol,
    alcoholWeightGrams: alcoholWeight,
    alcoholPercent: valid ? alcoholPct : 0,
    waterVolumeMl: waterVol,
    waterWeightGrams: waterWeight,
    waterPercent: valid ? waterPct : 0,
    fixativeVolumeMl: fixativeVol,
    fixativeWeightGrams: fixativeWeight,
    fixativePercent: valid ? fixativePct : 0,
    totalVolumeMl: volumeOrZero,
    totalWeightGrams: valid ? totalWeight : 0,
    batchTotalVolumeMl: volumeOrZero * batchCountOrZero,
    batchTotalOilGrams: oilWeight * batchCountOrZero,
    batchTotalAlcoholGrams: alcoholWeight * batchCountOrZero,
    batchTotalWaterGrams: waterWeight * batchCountOrZero,
    batchTotalFixativeGrams: fixativeWeight * batchCountOrZero,
    batchTotalWeightGrams: valid ? totalWeight * batchCountOrZero : 0,
  };
}

export function calculateAlcoholDilution(
  initialAlcohol: number,
  targetAlcohol: number,
  targetVolume: number
) {
  if (![initialAlcohol, targetAlcohol, targetVolume].every(Number.isFinite)
    || initialAlcohol <= 0 || initialAlcohol > 100 || targetAlcohol <= 0 || targetAlcohol > 100 || targetVolume <= 0) {
    return {
      pureAlcoholVolumeNeeded: 0,
      distilledWaterVolumeNeeded: 0,
      requiredInitialVolumeMl: 0,
      requiredWaterVolumeMl: 0,
      dilutionFactor: 1,
      isValid: false,
      errorMessage: 'يرجى إدخال تركيزات بين 0 و100% وحجم نهائي موجب وصالح.',
    };
  }
  if (targetAlcohol >= initialAlcohol) {
    return {
      pureAlcoholVolumeNeeded: 0,
      distilledWaterVolumeNeeded: 0,
      requiredInitialVolumeMl: 0,
      requiredWaterVolumeMl: 0,
      dilutionFactor: 1,
      isValid: false,
      errorMessage: 'تركيز الكحول الابتدائي يجب أن يكون أعلى من التركيز المستهدف.',
    };
  }
  if (targetAlcohol <= 0 || initialAlcohol <= 0 || targetVolume <= 0) {
    return {
      pureAlcoholVolumeNeeded: 0,
      distilledWaterVolumeNeeded: 0,
      requiredInitialVolumeMl: 0,
      requiredWaterVolumeMl: 0,
      dilutionFactor: 1,
      isValid: false,
      errorMessage: 'يرجى إدخال قيم موجبة صالحة.',
    };
  }

  const pureAlcoholVolumeNeeded = (targetAlcohol * targetVolume) / initialAlcohol;
  const distilledWaterVolumeNeeded = targetVolume - pureAlcoholVolumeNeeded;

  return {
    pureAlcoholVolumeNeeded,
    distilledWaterVolumeNeeded,
    requiredInitialVolumeMl: pureAlcoholVolumeNeeded,
    requiredWaterVolumeMl: distilledWaterVolumeNeeded,
    dilutionFactor: initialAlcohol / targetAlcohol,
    isValid: true,
  };
}

export interface CostCalculationParams {
  oilCostPerKg: number;
  alcoholCostPerLiter: number;
  bottleUnitCost: number;
  packagingUnitCost: number;
  laborAndOverheadPerUnit: number;
  batchSize: number;
  targetMarginPercent: number;
}

export function calculateCosting(
  result: CalculationResult,
  params: CostCalculationParams
) {
  const {
    oilCostPerKg,
    alcoholCostPerLiter,
    bottleUnitCost,
    packagingUnitCost,
    laborAndOverheadPerUnit,
    batchSize,
    targetMarginPercent,
  } = params;

  const errors: string[] = [];
  const costInputs = { oilCostPerKg, alcoholCostPerLiter, bottleUnitCost, packagingUnitCost, laborAndOverheadPerUnit };
  for (const [field, value] of Object.entries(costInputs)) {
    if (!Number.isFinite(value) || value < 0) errors.push(`${field} must be a finite non-negative amount.`);
  }
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1_000_000) errors.push('batchSize must be a whole number from 1 to 1,000,000.');
  if (!Number.isFinite(targetMarginPercent) || targetMarginPercent < 0 || targetMarginPercent > 1000) errors.push('targetMarginPercent must be from 0 to 1,000.');
  if (result.calculationStatus === 'invalid') errors.push('The formulation calculation is invalid.');
  if (result.massEstimateStatus === 'unavailable') errors.push('Oil mass is unavailable, so material cost cannot be calculated.');
  if (![result.oilWeightGrams, result.alcoholVolumeMl].every((value) => Number.isFinite(value) && value >= 0)) errors.push('Formulation quantities must be finite and non-negative.');

  const zeroResult = {
    oilCostPerBottle: 0, alcoholCostPerBottle: 0, packagingCostPerBottle: 0, laborCostPerBottle: 0,
    totalCostPerBottle: 0, suggestedWholesalePrice: 0, suggestedRetailPrice: 0, profitPerBottleRetail: 0,
    totalBatchCost: 0, totalBatchRevenueRetail: 0, totalBatchProfitRetail: 0,
  };
  if (errors.length) return { ...zeroResult, calculationStatus: 'invalid' as const, calculationErrors: errors, calculationWarnings: [] as string[] };

  const count = batchSize;
  const oilCostPerBottle = (result.oilWeightGrams / 1000) * oilCostPerKg;
  const alcoholCostPerBottle = (result.alcoholVolumeMl / 1000) * alcoholCostPerLiter;
  const packagingCostPerBottle = bottleUnitCost + packagingUnitCost;
  const laborCostPerBottle = laborAndOverheadPerUnit;
  const totalCostPerBottle = oilCostPerBottle + alcoholCostPerBottle + packagingCostPerBottle + laborCostPerBottle;

  // This existing field is a markup-on-cost input, not a gross-margin rate.
  const markup = targetMarginPercent;
  const suggestedRetailPrice = totalCostPerBottle * (1 + markup / 100);
  const suggestedWholesalePrice = totalCostPerBottle * (1 + (markup * 0.4) / 100);
  const profitPerBottleRetail = suggestedRetailPrice - totalCostPerBottle;

  return {
    ...zeroResult,
    oilCostPerBottle,
    alcoholCostPerBottle,
    packagingCostPerBottle,
    laborCostPerBottle,
    totalCostPerBottle,
    suggestedWholesalePrice,
    suggestedRetailPrice,
    profitPerBottleRetail,
    totalBatchCost: totalCostPerBottle * count,
    totalBatchRevenueRetail: suggestedRetailPrice * count,
    totalBatchProfitRetail: profitPerBottleRetail * count,
    calculationStatus: 'valid' as const,
    calculationErrors: [] as string[],
    calculationWarnings: result.massEstimateStatus === 'estimated' ? ['Oil material cost uses an estimated mass from unverified density.'] : [],
  };
}

export const calculatePerfumeCosting = calculateCosting;

export function calculatePyramidDistribution(
  notes: PyramidNote[],
  totalOilWeightGrams: number,
  totalOilVolumeMl: number
) {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (![totalOilWeightGrams, totalOilVolumeMl].every((value) => Number.isFinite(value) && value >= 0)) {
    errors.push('Oil mass and volume must be finite, non-negative quantities in their own units.');
  }
  const seen = new Set<string>();
  notes.forEach((note, index) => {
    if (!note.id?.trim() || seen.has(note.id)) errors.push(`notes[${index}].id must be non-empty and unique.`);
    else seen.add(note.id);
    if (!Number.isFinite(note.percentageOfOil) || note.percentageOfOil < 0 || note.percentageOfOil > 100) {
      errors.push(`notes[${index}].percentageOfOil must be from 0 to 100.`);
    }
  });
  const totalPct = notes.reduce((sum, note) => sum + (Number.isFinite(note.percentageOfOil) ? note.percentageOfOil : 0), 0);
  if (notes.length && Math.abs(totalPct - 100) > 0.01) warnings.push(`Pyramid shares total ${totalPct}%, not 100%; the entered values were not normalized.`);

  let topPct = 0;
  let heartPct = 0;
  let basePct = 0;
  notes.forEach((note) => {
    const p = Number.isFinite(note.percentageOfOil) ? note.percentageOfOil : 0;
    if (note.category === 'top') topPct += p;
    if (note.category === 'heart') heartPct += p;
    if (note.category === 'base') basePct += p;
  });

  const valid = errors.length === 0;
  const safeOilMass = Number.isFinite(totalOilWeightGrams) && totalOilWeightGrams >= 0 ? totalOilWeightGrams : 0;
  const safeOilVolume = Number.isFinite(totalOilVolumeMl) && totalOilVolumeMl >= 0 ? totalOilVolumeMl : 0;
  const notesWithQuantities = notes.map((note) => {
    const ratio = valid ? note.percentageOfOil / 100 : 0;
    return {
      ...note,
      weightGrams: safeOilMass * ratio,
      volumeMl: safeOilVolume * ratio,
    };
  });

  return {
    calculationStatus: valid ? 'valid' as const : 'invalid' as const,
    calculationErrors: errors,
    calculationWarnings: warnings,
    notesWithQuantities,
    totalPercentage: totalPct,
    topPct,
    heartPct,
    basePct,
  };
}

export const calculatePyramidBreakdown = calculatePyramidDistribution;

export function formatNum(value: number, digits = 2): string {
  if (isNaN(value) || !isFinite(value)) return '0.00';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
