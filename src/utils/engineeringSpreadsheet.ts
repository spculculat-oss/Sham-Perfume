import { evaluateEngineeringExpression, type AngleMode } from './engineeringCalculator';

export const SHEET_COLUMNS = ['A', 'B', 'C', 'D', 'E'] as const;
export const SHEET_ROWS = 45;
export const SHEET_CELL_LIMIT = 170;
export const SHEET_CELL_LENGTH = 100;
export type SheetValue = { value: number } | { error: 'formula' | 'cycle' };

function address(name: string): [number, number] | undefined {
  const match = name.match(/^([A-E])([1-9]\d?)$/i);
  if (!match) return undefined;
  const row = Number(match[2]);
  return row <= SHEET_ROWS ? [match[1].toUpperCase().charCodeAt(0) - 65, row] : undefined;
}

/** Resolve only bounded cell references, never sheet commands or JavaScript. Errors follow their dependents. */
export function evaluateEngineeringSheet(cells: Record<string, string>, angleMode: AngleMode = 'DEG'): Record<string, SheetValue> {
  const values: Record<string, SheetValue> = {};
  const active = new Set<string>();
  const cycle = new Error('Circular cell reference');
  const resolve = (name: string): number => {
    const key = name.toUpperCase();
    if (!address(key)) throw new Error('Invalid cell reference');
    const prior = Object.hasOwn(values, key) ? values[key] : undefined;
    if (prior) {
      if ('value' in prior) return prior.value;
      throw prior.error === 'cycle' ? cycle : new Error('Invalid referenced cell');
    }
    if (active.has(key)) throw cycle;
    const input = (Object.hasOwn(cells, key) ? cells[key] : '').trim();
    if (!input) return 0;
    active.add(key);
    try {
      // Spreadsheet cells allow simple expressions and references; numeric sampling and random values are not cell operations.
      if (input.length > SHEET_CELL_LENGTH || /\b(?:integral|deriv|sumx|prodx|rand|randint|f|g)\s*\(/i.test(input)) throw new Error('Unsupported spreadsheet expression');
      const formula = input.replace(/^=/, '').replace(/\$([A-E])|\$(\d)/gi, '$1$2');
      const expanded = formula.replace(/\b(sum|avg|mean|min|max)\s*\(\s*([A-E]\d{1,2})\s*:\s*([A-E]\d{1,2})\s*\)/gi, (_match, op: string, start: string, end: string) => {
        const a = address(start);
        const b = address(end);
        if (!a || !b) throw new Error('Invalid cell range');
        const result: number[] = [];
        for (let row = Math.min(a[1], b[1]); row <= Math.max(a[1], b[1]); row++) {
          for (let col = Math.min(a[0], b[0]); col <= Math.max(a[0], b[0]); col++) {
            const ref = `${SHEET_COLUMNS[col]}${row}`;
            if (Object.hasOwn(cells, ref) && cells[ref].trim()) result.push(resolve(ref));
          }
        }
        const lower = op.toLowerCase();
        const total = () => result.reduce((a, b) => a + b, 0);
        const value = lower === 'sum' ? total() : !result.length ? NaN : lower === 'min' ? Math.min(...result) : lower === 'max' ? Math.max(...result) : total() / result.length;
        if (!Number.isFinite(value)) throw new Error('Invalid cell range result');
        return `(${value})`;
      });
      const value = evaluateEngineeringExpression(expanded, { angleMode, cell: (symbol) => /^[A-E]\d/i.test(symbol) ? resolve(symbol) : undefined });
      values[key] = { value };
      return value;
    } catch (error) {
      values[key] = { error: error === cycle ? 'cycle' : 'formula' };
      throw error;
    } finally { active.delete(key); }
  };
  for (const name of Object.keys(cells).slice(0, SHEET_CELL_LIMIT)) {
    if (address(name)) try { resolve(name); } catch { /* recorded for the grid */ }
  }
  return values;
}
