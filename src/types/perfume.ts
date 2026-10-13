export type ConcentrationType =
  | 'extrait'
  | 'edp'
  | 'edt'
  | 'edc'
  | 'eau_fraiche'
  | 'aftershave'
  | 'mist'
  | 'oil_pure'
  | 'custom';

export interface FormulationState {
  bottleVolumeMl: number;
  batchCount: number;
  concentrationPercent: number;
  concentrationType: ConcentrationType;
  alcoholPercentage: number;
  waterPercent: number;
  fixativePercent: number;
  oilDensity: number;
  alcoholDensity: number;
  unitMode: 'grams' | 'ml';
  currency?: string;
}

export interface CostingState {
  oilCostPerKg: number;
  alcoholCostPerLiter: number;
  bottleUnitCost: number;
  packagingUnitCost: number;
  laborAndOverheadPerUnit: number;
  batchSize: number;
  targetMarginPercent: number;
  currency: string;
}

export interface CalculationResult {
  oilVolumeMl: number;
  oilWeightGrams: number;
  oilPercent: number;
  alcoholVolumeMl: number;
  alcoholWeightGrams: number;
  alcoholPercent: number;
  waterVolumeMl: number;
  waterWeightGrams: number;
  waterPercent: number;
  fixativeVolumeMl: number;
  fixativeWeightGrams: number;
  fixativePercent: number;
  totalVolumeMl: number;
  totalWeightGrams: number;
  batchTotalVolumeMl: number;
  batchTotalOilGrams: number;
  batchTotalAlcoholGrams: number;
  batchTotalWaterGrams: number;
  batchTotalFixativeGrams: number;
  batchTotalWeightGrams: number;
}

export interface PyramidNote {
  id: string;
  nameAr: string;
  nameEn: string;
  category: 'top' | 'heart' | 'base';
  percentageOfOil: number;
  description?: string;
  weightGrams?: number;
  volumeMl?: number;
}

export interface SavedFormula {
  id: string;
  title: string;
  titleEn?: string;
  author?: string;
  dateCreated: string;
  batchCode?: string;
  notes?: string;
  macerationDays?: number;
  formulation: FormulationState;
  pyramidNotes: PyramidNote[];
}
