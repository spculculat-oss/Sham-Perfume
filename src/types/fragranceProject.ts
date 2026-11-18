import type { CostingState, FormulationState, PyramidNote, SavedFormula } from './perfume';
import type { DensityEvidence } from '../utils/calculationContract';

export type FragranceProjectStatus = 'active' | 'archived';
export type IngredientRole = 'oil' | 'alcohol' | 'water' | 'fixative' | 'other';
export type CostLedgerCategory = 'materials' | 'packaging' | 'labor' | 'shipping' | 'other';
export type PricingBasis = 'markup' | 'gross_margin';

export interface ProjectCostLedgerLine {
  id: string;
  label: string;
  category: CostLedgerCategory;
  /** Total expense for the batch, in the ledger currency. */
  batchAmount: number;
  /** User-confirmed tax treatment; omitted on early records means not taxable. */
  subjectToInputTax?: boolean;
}

export interface ProjectCostLedger {
  currency: string;
  batchUnits: number;
  /** Non-recoverable tax-on-inputs assumption; kept separate and applied to listed expenses. */
  inputTaxPercent: number;
  pricingBasis: PricingBasis;
  targetPercent: number;
  lines: ProjectCostLedgerLine[];
}

export interface ProjectExperiment {
  id: string;
  batchCode: string;
  observedAt: string;
  conditions: string;
  observation: string;
  evaluation: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectIngredient {
  id: string;
  materialId?: string;
  name: string;
  role: IngredientRole;
  percentage: number;
  density?: DensityEvidence;
}

export interface ProjectFormula {
  /** Existing calculator is retained as the compatibility-backed formulation editor. */
  formulation: FormulationState;
  basis: 'volume';
  unit: 'ml';
  ingredientLines: ProjectIngredient[];
}

export interface ProjectVersion {
  id: string;
  createdAt: string;
  note: string;
  snapshot: {
    name: string;
    description?: string;
    family?: string;
    targetProductType?: string;
    formula: ProjectFormula;
    pyramid: PyramidNote[];
    favoriteMaterialIds?: string[];
    experiments?: ProjectExperiment[];
    costing?: CostingState;
    costLedger?: ProjectCostLedger;
  };
}

export interface FragranceProject {
  schemaVersion: 1;
  id: string;
  ownerId: null;
  name: string;
  description: string;
  family: string;
  targetProductType: string;
  status: FragranceProjectStatus;
  createdAt: string;
  updatedAt: string;
  currentVersionId?: string;
  formula: ProjectFormula;
  pyramid: PyramidNote[];
  favoriteMaterialIds: string[];
  costing?: CostingState;
  costLedger?: ProjectCostLedger;
  experiments: ProjectExperiment[];
  versions: ProjectVersion[];
  /** Retained to support audited round-trip conversion back to the old library record. */
  legacyFormula?: SavedFormula;
}
