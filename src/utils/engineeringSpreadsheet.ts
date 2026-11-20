import { compileEngineeringExpression, normalizeEngineeringInput, type AngleMode, type EngineeringValue } from './engineeringCalculator';
import { exact, exactAdd, exactApproximation, exactMultiply, type ExactValue } from './engineeringExact';
import { compensatedSum } from './engineeringNumeric';

export const SHEET_COLUMNS = ['A', 'B', 'C', 'D', 'E'] as const;
export const SHEET_ROWS = 45;
export const SHEET_CELL_LIMIT = 170;
export const SHEET_CELL_LENGTH = 100;
export type SheetValue = { value: number; exactInteger?: string } | { error: 'formula' | 'cycle' };

function address(name: string): [number, number] | undefined {
  const match = name.match(/^([A-E])([1-9]\d?)$/i);
  if (!match) return undefined;
  const row = Number(match[2]);
  return row <= SHEET_ROWS ? [match[1].toUpperCase().charCodeAt(0) - 65, row] : undefined;
}

const ZERO = { re: 0, im: 0, exact: exact(0n) };
function aggregate(op: string, values: EngineeringValue[]): EngineeringValue {
  if (!values.length) {
    if (op === 'sum') return ZERO;
    throw new Error('This range has no values.');
  }
  if (op === 'min' || op === 'max') return values.reduce((best, v) => {
    const delta = exactAdd(v.exact, best.exact, -1n)?.numerator;
    const order = delta === undefined ? Math.sign(v.re - best.re) : delta < 0n ? -1 : delta > 0n ? 1 : 0;
    return (op === 'min' ? order < 0 : order > 0) ? v : best;
  });
  const div = op === 'sum' ? 1 : values.length;
  const total = values.reduce<ExactValue | undefined>((acc, v) => exactAdd(acc, v.exact), ZERO.exact);
  const form = div === 1 ? total : exactMultiply(total, exact(BigInt(div)), true);
  const re = form ? exactApproximation(form) : compensatedSum(values.map((v) => v.re / div));
  if (!Number.isFinite(re)) throw new Error('Invalid cell range result');
  return { re, im: 0, exact: form };
}

/** Resolve only bounded cell references, never sheet commands or JavaScript. Errors follow their dependents. */
export function evaluateEngineeringSheet(cells: Record<string, string>, angleMode: AngleMode = 'DEG'): Record<string, SheetValue> {
  const values: Record<string, SheetValue> = {};
  const computed = new Map<string, EngineeringValue>();
  const entries = new Map(Object.entries(cells).filter(([name]) => address(name)).slice(0, SHEET_CELL_LIMIT).map(([name, input]) => [name.toUpperCase(), input.trim()]));
  const active = new Set<string>();
  const cycle = new Error('Circular cell reference');
  const resolve = (name: string): EngineeringValue => {
    const key = name.toUpperCase();
    if (!address(key)) throw new Error('Invalid cell reference');
    const prior = computed.get(key);
    if (prior) return prior;
    const error = values[key];
    if (error && 'error' in error) throw error.error === 'cycle' ? cycle : new Error('Invalid referenced cell');
    if (active.has(key)) throw cycle;
    const input = entries.get(key);
    if (!input) return ZERO;
    active.add(key);
    try {
      // Keep the real value and any exact rational in the cell graph, not the rounded display value.
      const formula = normalizeEngineeringInput(input).replace(/^=/, '').replace(/\$([A-E])|\$(\d)/gi, '$1$2');
      if (input.length > SHEET_CELL_LENGTH || /__range_|\b(?:integral|deriv|sumx|prodx|rand|randint|f|g)\s*\(/i.test(formula)) throw new Error('Unsupported spreadsheet expression');
      const ranges = new Map<string, EngineeringValue>();
      const expanded = formula.replace(/\b(sum|avg|mean|min|max)\s*\(\s*([A-E]\d{1,2})\s*:\s*([A-E]\d{1,2})\s*\)/gi, (_match, op: string, start: string, end: string) => {
        const a = address(start), b = address(end);
        if (!a || !b) throw new Error('Invalid cell range');
        const items = [];
        for (let row = Math.min(a[1], b[1]); row <= Math.max(a[1], b[1]); row++) {
          for (let col = Math.min(a[0], b[0]); col <= Math.max(a[0], b[0]); col++) {
            const ref = `${SHEET_COLUMNS[col]}${row}`;
            if (entries.get(ref)) items.push(resolve(ref));
          }
        }
        const symbol = `__range_${ranges.size}`;
        ranges.set(symbol, aggregate(op.toLowerCase(), items));
        return `(${symbol})`;
      });
      const result = compileEngineeringExpression(expanded, true)({ angleMode, cell: (symbol) => ranges.get(symbol) ?? (/^[A-E]\d/i.test(symbol) ? resolve(symbol) : undefined) });
      computed.set(key, result);
      const form = result.exact;
      const exactInteger = form && !form.symbol && form.denominator === 1n && !Number.isSafeInteger(result.re) ? String(form.numerator) : undefined;
      values[key] = exactInteger === undefined ? { value: result.re } : { value: result.re, exactInteger };
      return result;
    } catch (error) {
      values[key] = { error: error === cycle ? 'cycle' : 'formula' };
      throw error;
    } finally { active.delete(key); }
  };
  for (const name of entries.keys()) {
    try { resolve(name); } catch { /* recorded for the grid */ }
  }
  return values;
}
