import type { CostLedgerCategory, PricingBasis, ProjectCostLedger } from '../types/fragranceProject';

const categories: CostLedgerCategory[] = ['materials', 'packaging', 'labor', 'shipping', 'other'];

export function validateProjectCostLedger(value: unknown): value is ProjectCostLedger {
  if (!value || typeof value !== 'object') return false;
  const ledger = value as ProjectCostLedger;
  if (typeof ledger.currency !== 'string' || !/^[A-Z]{3}$/.test(ledger.currency)) return false;
  if (!Number.isInteger(ledger.batchUnits) || ledger.batchUnits < 1 || ledger.batchUnits > 1_000_000) return false;
  if (!Number.isFinite(ledger.inputTaxPercent) || ledger.inputTaxPercent < 0 || ledger.inputTaxPercent > 1000) return false;
  if (ledger.pricingBasis !== 'markup' && ledger.pricingBasis !== 'gross_margin') return false;
  if (!Number.isFinite(ledger.targetPercent) || ledger.targetPercent < 0) return false;
  if (ledger.pricingBasis === 'markup' && ledger.targetPercent > 1000) return false;
  if (ledger.pricingBasis === 'gross_margin' && ledger.targetPercent >= 100) return false;
  if (!Array.isArray(ledger.lines)) return false;
  const ids = new Set<string>();
  return ledger.lines.length <= 1000 && ledger.lines.every((line) => {
    if (!line || typeof line.id !== 'string' || !line.id.trim() || ids.has(line.id)
      || typeof line.label !== 'string' || !line.label.trim() || line.label.length > 120 || !categories.includes(line.category)
      || !Number.isFinite(line.batchAmount) || line.batchAmount < 0 || line.batchAmount > 1_000_000_000_000
      || (line.subjectToInputTax !== undefined && typeof line.subjectToInputTax !== 'boolean')) return false;
    ids.add(line.id);
    return true;
  });
}

export function createProjectCostLedger(currency = 'EGP'): ProjectCostLedger {
  const normalizedCurrency = /^[A-Z]{3}$/.test(currency) ? currency : 'EGP';
  return { currency: normalizedCurrency, batchUnits: 1, inputTaxPercent: 0, pricingBasis: 'markup', targetPercent: 0, lines: [] };
}

export interface ProjectCostLedgerResult {
  status: 'valid' | 'invalid';
  errors: string[];
  warnings: string[];
  currency: string;
  subtotalBatch: number;
  taxableSubtotalBatch: number;
  inputTaxBatch: number;
  totalBatchCost: number;
  costPerUnit: number;
  pricePerUnit: number;
  revenueBatch: number;
  profitPerUnit: number;
  effectiveGrossMarginPercent: number;
}

const emptyResult = (ledger: ProjectCostLedger): ProjectCostLedgerResult => ({
  status: 'invalid', errors: [], warnings: [], currency: ledger.currency,
  subtotalBatch: 0, taxableSubtotalBatch: 0, inputTaxBatch: 0, totalBatchCost: 0, costPerUnit: 0,
  pricePerUnit: 0, revenueBatch: 0, profitPerUnit: 0, effectiveGrossMarginPercent: 0,
});

/**
 * Batch costs are entered as explicit currency amounts. Non-recoverable tax-on-inputs is a separate
 * percentage assumption. Pricing can be markup-on-cost or gross-margin target; the bases differ.
 */
export function calculateProjectCostLedger(ledger: ProjectCostLedger): ProjectCostLedgerResult {
  const result = emptyResult(ledger);
  if (!validateProjectCostLedger(ledger)) {
    result.errors.push('Enter a valid currency, positive batch size, non-negative costs, tax rate, and pricing target.');
    return result;
  }
  const subtotal = ledger.lines.reduce((sum, line) => sum + line.batchAmount, 0);
  const taxableSubtotal = ledger.lines.reduce((sum, line) => sum + (line.subjectToInputTax === true ? line.batchAmount : 0), 0);
  const inputTax = taxableSubtotal * ledger.inputTaxPercent / 100;
  const total = subtotal + inputTax;
  if (![subtotal, taxableSubtotal, inputTax, total].every(Number.isFinite)) {
    result.errors.push('Cost totals exceed the supported numeric range.');
    return result;
  }
  const perUnit = total / ledger.batchUnits;
  const price = ledger.pricingBasis === 'markup'
    ? perUnit * (1 + ledger.targetPercent / 100)
    : perUnit / (1 - ledger.targetPercent / 100);
  result.status = 'valid';
  result.subtotalBatch = subtotal;
  result.taxableSubtotalBatch = taxableSubtotal;
  result.inputTaxBatch = inputTax;
  result.totalBatchCost = total;
  result.costPerUnit = perUnit;
  result.pricePerUnit = price;
  result.revenueBatch = price * ledger.batchUnits;
  result.profitPerUnit = price - perUnit;
  result.effectiveGrossMarginPercent = price > 0 ? (result.profitPerUnit / price) * 100 : 0;
  if (!ledger.lines.length) result.warnings.push('No expense lines have been entered.');
  if (ledger.pricingBasis === 'markup') result.warnings.push('Target is markup on cost; it is not a gross-margin target.');
  else result.warnings.push('Gross-margin target is applied to cost before any sales taxes or fees.');
  return result;
}

export function setProjectPricingBasis(ledger: ProjectCostLedger, basis: PricingBasis, targetPercent = ledger.targetPercent): ProjectCostLedger {
  const next = { ...ledger, pricingBasis: basis, targetPercent };
  if (!validateProjectCostLedger(next)) throw new Error('Invalid pricing basis/target.');
  return next;
}
