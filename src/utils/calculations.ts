import { CalculationResult, FormulationState, PyramidNote } from '../types/perfume';

export function calculatePerfumeFormulation(state: FormulationState): CalculationResult {
  const {
    bottleVolumeMl,
    batchCount,
    concentrationPercent,
    waterPercent,
    fixativePercent,
    oilDensity,
    alcoholDensity,
  } = state;

  const count = Math.max(1, batchCount || 1);
  const volume = Math.max(1, bottleVolumeMl || 50);

  const oilPct = Math.min(100, Math.max(0, concentrationPercent));
  const waterPct = Math.min(100 - oilPct, Math.max(0, waterPercent || 0));
  const fixativePct = Math.min(100 - oilPct - waterPct, Math.max(0, fixativePercent || 0));
  const alcoholPct = Math.max(0, 100 - (oilPct + waterPct + fixativePct));

  const oilVol = (volume * oilPct) / 100;
  const alcoholVol = (volume * alcoholPct) / 100;
  const waterVol = (volume * waterPct) / 100;
  const fixativeVol = (volume * fixativePct) / 100;

  const oDensity = oilDensity || 0.92;
  const aDensity = alcoholDensity || 0.8;
  const wDensity = 1.0;
  const fDensity = 1.02;

  const oilWeight = oilVol * oDensity;
  const alcoholWeight = alcoholVol * aDensity;
  const waterWeight = waterVol * wDensity;
  const fixativeWeight = fixativeVol * fDensity;

  const totalWeight = oilWeight + alcoholWeight + waterWeight + fixativeWeight;

  return {
    oilVolumeMl: oilVol,
    oilWeightGrams: oilWeight,
    oilPercent: oilPct,
    alcoholVolumeMl: alcoholVol,
    alcoholWeightGrams: alcoholWeight,
    alcoholPercent: alcoholPct,
    waterVolumeMl: waterVol,
    waterWeightGrams: waterWeight,
    waterPercent: waterPct,
    fixativeVolumeMl: fixativeVol,
    fixativeWeightGrams: fixativeWeight,
    fixativePercent: fixativePct,
    totalVolumeMl: volume,
    totalWeightGrams: totalWeight,
    batchTotalVolumeMl: volume * count,
    batchTotalOilGrams: oilWeight * count,
    batchTotalAlcoholGrams: alcoholWeight * count,
    batchTotalWaterGrams: waterWeight * count,
    batchTotalFixativeGrams: fixativeWeight * count,
    batchTotalWeightGrams: totalWeight * count,
  };
}

export function calculateAlcoholDilution(
  initialAlcohol: number,
  targetAlcohol: number,
  targetVolume: number
) {
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

  const count = Math.max(1, batchSize || 1);
  const oilCostPerBottle = (result.oilWeightGrams / 1000) * (oilCostPerKg || 0);
  const alcoholCostPerBottle = (result.alcoholVolumeMl / 1000) * (alcoholCostPerLiter || 0);
  const packagingCostPerBottle = (bottleUnitCost || 0) + (packagingUnitCost || 0);
  const laborCostPerBottle = laborAndOverheadPerUnit || 0;
  const totalCostPerBottle =
    oilCostPerBottle + alcoholCostPerBottle + packagingCostPerBottle + laborCostPerBottle;

  const margin = targetMarginPercent || 50;
  const suggestedRetailPrice = totalCostPerBottle * (1 + margin / 100);
  const suggestedWholesalePrice = totalCostPerBottle * (1 + (margin * 0.4) / 100);
  const profitPerBottleRetail = suggestedRetailPrice - totalCostPerBottle;

  return {
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
  };
}

export const calculatePerfumeCosting = calculateCosting;

export function calculatePyramidDistribution(
  notes: PyramidNote[],
  totalOilWeightGrams: number,
  totalOilVolumeMl: number
) {
  let totalPct = 0;
  let topPct = 0;
  let heartPct = 0;
  let basePct = 0;

  notes.forEach((n) => {
    const p = n.percentageOfOil || 0;
    totalPct += p;
    if (n.category === 'top') topPct += p;
    if (n.category === 'heart') heartPct += p;
    if (n.category === 'base') basePct += p;
  });

  const notesWithQuantities = notes.map((n) => {
    const ratio = (n.percentageOfOil || 0) / 100;
    return {
      ...n,
      weightGrams: totalOilWeightGrams * ratio,
      volumeMl: totalOilVolumeMl * ratio,
    };
  });

  return {
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
