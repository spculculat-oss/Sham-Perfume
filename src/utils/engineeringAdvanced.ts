import { EngineeringError, compileEngineeringExpression, normalizeEngineeringInput, radiansPerUnit, type AngleMode, type EvaluateOptions } from './engineeringCalculator';
import { complex } from './engineeringComplex';
import { exactAdd, exactApproximation, exactLiteral } from './engineeringExact';
import { commonDecimalScale, compensatedSum, decimalRatio } from './engineeringNumeric';
export { solvePolynomial, solvePolynomialInequality, type InequalityOperator, type Interval } from './engineeringPolynomial';

const fail = (message: string): never => { throw new EngineeringError('math', message); };
const finite = (value: number) => Number.isFinite(value) ? value : fail('Result is outside the supported numeric range.');
const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);
export type Matrix = number[][];
export type MatrixOperation = 'add' | 'subtract' | 'multiply' | 'det' | 'inverse' | 'transpose' | 'identity';

function matrixSize(a: Matrix): [number, number] {
  const n = a.length;
  const m = a[0]?.length ?? 0;
  if (n < 1 || n > 4 || m < 1 || m > 4 || !a.every((row) => row.length === m && row.every(Number.isFinite))) {
    return fail('Enter a rectangular matrix with up to 4 rows and 4 columns.');
  }
  return [n, m];
}

const vectorDot = (a: number[], b: number[]) => finite(compensatedSum(a.map((item, i) => item * b[i])));
const transpose = (a: Matrix): Matrix => a[0].map((_, col) => a.map((row) => row[col]));
export const identityMatrix = (n: number): Matrix => {
  if (!Number.isInteger(n) || n < 1 || n > 4) return fail('Matrix size must be from 1 to 4.');
  return Array.from({ length: n }, (_, row) => Array.from({ length: n }, (_, col) => Number(row === col)));
};

function reduceSquare(a: Matrix, right: Matrix): Matrix | null {
  const n = a.length;
  const scales = a.map((row) => Math.max(...row.map(Math.abs)));
  if (scales.some((scale) => !scale)) return null;
  const m = a.map((row, i) => row.concat(right[i]).map((value) => finite(value / scales[i])));
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let i = col + 1; i < n; i++) if (Math.abs(m[i][col]) > Math.abs(m[pivot][col])) pivot = i;
    const scale = m[pivot][col];
    if (Math.abs(scale) < 4 * Number.EPSILON) return null;
    if (col !== pivot) [m[col], m[pivot]] = [m[pivot], m[col]];
    m[col] = m[col].map((value) => finite(value / scale));
    for (let i = 0; i < n; i++) {
      if (i === col) continue;
      const factor = m[i][col];
      m[i] = m[i].map((value, j) => j === col ? 0 : finite(value - factor * m[col][j]));
    }
  }
  return m.map((row) => row.slice(n));
}

function determinant(a: Matrix): number {
  const { integers, exponent } = commonDecimalScale(a.flat());
  const n = a.length;
  const rows = a.map((_, i) => integers.slice(i * n, (i + 1) * n));
  const expand = (m: bigint[][]): bigint => m.length === 1 ? m[0][0] : m[0].reduce((total, coefficient, i) =>
    coefficient ? total + (i % 2 ? -1n : 1n) * coefficient * expand(m.slice(1).map((row) => row.filter((_, j) => i !== j))) : total, 0n);
  const exact = expand(rows);
  const value = finite(Number(`${exact}e${exponent * n}`));
  return !value && exact ? fail('The determinant is too small to represent.') : value;
}

export function calculateMatrix(op: MatrixOperation, a: Matrix, b: Matrix = []): Matrix | number {
  const [rows, cols] = matrixSize(a);
  if (op === 'transpose') return transpose(a);
  if (op === 'identity') return identityMatrix(rows);
  if (op === 'det' || op === 'inverse') {
    if (rows !== cols) return fail('This operation requires a square matrix.');
    if (op === 'det') return determinant(a);
    return reduceSquare(a, identityMatrix(rows)) ?? fail('This matrix is singular or too ill-conditioned to invert.');
  }
  const [bRows, bCols] = matrixSize(b);
  if (op === 'multiply') {
    if (cols !== bRows) return fail('Columns of A must equal rows of B.');
    const columns = transpose(b);
    return a.map((row) => columns.map((column) => vectorDot(row, column)));
  }
  if (rows !== bRows || cols !== bCols) return fail('Matrices must have the same dimensions.');
  return a.map((row, i) => row.map((value, j) => finite(value + (op === 'add' ? b[i][j] : -b[i][j]))));
}

export function solveLinearSystem(a: Matrix, b: number[]): number[] {
  const [rows, cols] = matrixSize(a);
  if (rows < 2 || rows !== cols || b.length !== rows || !b.every(Number.isFinite)) return fail('Enter a square system with 2–4 unknowns.');
  const solution = reduceSquare(a, b.map((value) => [value]));
  return solution?.map(([value]) => value) ?? fail('No numerically reliable unique solution for this system.');
}

export type VectorOperation = 'add' | 'subtract' | 'dot' | 'cross' | 'angle' | 'unit' | 'norm';
export function calculateVector(op: VectorOperation, a: number[], b: number[] = [], angle: AngleMode = 'DEG'): number | number[] {
  if ((a.length !== 2 && a.length !== 3) || !a.every(Number.isFinite)) return fail('Use a vector with 2 or 3 coordinates.');
  const lengthA = Math.hypot(...a);
  if (op === 'norm') return finite(lengthA);
  const unit = (vector: number[]) => {
    const scale = Math.max(...vector.map(Math.abs));
    if (!scale) return fail('A zero vector has no direction.');
    const scaled = vector.map((v) => v / scale);
    const length = Math.hypot(...scaled);
    return scaled.map((v) => v / length);
  };
  if (op === 'unit') return unit(a);
  if (a.length !== b.length || !b.every(Number.isFinite)) return fail('Both vectors must have the same dimension.');
  if (op === 'angle') {
    const u = unit(a), v = unit(b);
    return 2 * Math.atan2(Math.hypot(...u.map((x, i) => x - v[i])), Math.hypot(...u.map((x, i) => x + v[i]))) / radiansPerUnit(angle);
  }
  if (op === 'dot') return vectorDot(a, b);
  if (op === 'cross') {
    if (a.length !== 3) return fail('The cross product requires two 3D vectors.');
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]].map(finite);
  }
  return a.map((value, i) => finite(value + (op === 'add' ? b[i] : -b[i])));
}

export function solveNumericEquation(source: string, guess: number, options: EvaluateOptions = {}): { root: number; residual: number } {
  const sides = normalizeEngineeringInput(source).split('=');
  if (sides.length > 2) return fail('Use f(x) or one equals sign in an equation.');
  const left = compileEngineeringExpression(sides[0], true);
  const right = sides.length === 2 ? compileEngineeringExpression(sides[1], true) : undefined;
  if (!Number.isFinite(guess)) return fail('Enter a finite starting value.');
  const value = (x: number) => {
    const exact = exactLiteral(String(x));
    const config = { ...options, variables: { ...options.variables, x: { ...complex(x), exact } }, complex: false };
    const a = left(config);
    if (!right) return finite(a.re);
    const b = right(config);
    const difference = exactAdd(a.exact, b.exact, -1n);
    return finite(difference ? exactApproximation(difference) : a.re - b.re);
  };
  const near = (x: number): number | undefined => {
    try { return Number.isFinite(x) ? value(x) : undefined; } catch { return undefined; }
  };
  const isolated = (x: number): boolean => {
    const h = Math.max(1, Math.abs(x)) * 1e-6;
    const neighbors = [near(x - h), near(x + h), near(x - 64 * h), near(x + 64 * h)];
    // Domain endpoints may have samples only on one side, but an interval of zeros is not an isolated root.
    return !neighbors.includes(0) && neighbors.some((sample) => sample !== undefined);
  };
  const crossesNearby = (x: number, residual: number): boolean => {
    const h = Math.max(Number.MIN_VALUE, Math.abs(x) * (16 * Number.EPSILON));
    const a = near(x - h), b = near(x + h);
    return a !== undefined && b !== undefined && Math.sign(a) * Math.sign(b) === -1
      && Math.abs(residual) < Math.min(Math.abs(a), Math.abs(b));
  };
  let x = guess;
  let y = value(x);
  const verified = (root: number, residual: number) => isolated(root)
    ? { root, residual } : fail('Could not verify an isolated root at this point.');
  if (!y || crossesNearby(x, y)) return verified(x, y);
  for (let iteration = 0; iteration < 60; iteration++) {
    const h = Math.cbrt(Number.EPSILON) * Math.max(1, Math.abs(x));
    let a: number | undefined;
    let b: number | undefined;
    try { a = value(x - h); } catch { /* allow one-sided differences near a domain edge */ }
    try { b = value(x + h); } catch { /* allow one-sided differences near a domain edge */ }
    const slope = a === undefined ? b === undefined ? 0 : (b - y) / h : b === undefined ? (y - a) / h : (b - a) / (2 * h);
    if (!Number.isFinite(slope) || !slope) break;
    let next = x;
    let nextY = y;
    let step = y / slope;
    for (let tries = 0; tries < 12; tries++, step /= 2) {
      if (!Number.isFinite(x - step)) continue;
      try {
        const candidate = value(x - step);
        if (Math.abs(candidate) <= Math.abs(nextY)) { next = x - step; nextY = candidate; break; }
      } catch { /* shorten a step that leaves the real domain */ }
    }
    if (!nextY || crossesNearby(next, nextY)) return verified(next, nextY);
    if (next === x) {
      // Newton may stall one representable number away from a touching root. Only accept an actual zero here.
      const ulp = Math.max(Number.MIN_VALUE, 2 ** (Math.floor(Math.log2(Math.abs(x))) - 52));
      for (const step of [ulp / 2, ulp, 2 * ulp]) {
        for (const point of [x - step, x + step]) if (point !== x && near(point) === 0) return verified(point, 0);
      }
      break;
    }
    x = next;
    y = nextY;
  }
  return fail('No convergence. Try a different starting value.');
}

export type Radix = 2 | 8 | 10 | 16;
export type BaseOperation = '=' | '+' | '-' | '*' | '/' | 'AND' | 'OR' | 'XOR' | 'XNOR' | 'NOT';

export function calculateBaseN(first: string, second: string, radix: Radix, op: BaseOperation): Record<Radix, string> {
  const parse = (raw: string) => {
    const digits = { 2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^\d+$/, 16: /^[\da-f]+$/i }[radix];
    const input = raw.trim();
    const sign = input[0] === '-' ? -1n : 1n;
    const text = /^[+-]/.test(input) ? input.slice(1) : input;
    if (!digits.test(text) || text.length > 34) return fail('Enter an integer using digits valid in this base.');
    const prefix = { 2: '0b', 8: '0o', 10: '', 16: '0x' }[radix];
    const value = sign * BigInt(prefix + text);
    if (value < -0x80000000n || value > (radix === 10 ? 0x7fffffffn : 0xffffffffn)) return fail('Use a signed 32-bit integer or its base representation.');
    return BigInt.asIntN(32, value);
  };
  const a = parse(first);
  const b = op === '=' || op === 'NOT' ? 0n : parse(second);
  let result: bigint;
  switch (op) {
    case '+': result = a + b; break;
    case '-': result = a - b; break;
    case '*': result = a * b; break;
    case '/': if (!b) return fail('Cannot divide by zero.'); result = a / b; break;
    case 'AND': result = a & b; break;
    case 'OR': result = a | b; break;
    case 'XOR': result = a ^ b; break;
    case 'XNOR': result = ~(a ^ b); break;
    case 'NOT': result = ~a; break;
    default: result = a;
  }
  if (result !== BigInt.asIntN(32, result)) return fail('Result overflows a signed 32-bit integer.');
  const unsigned = BigInt.asUintN(32, result);
  return { 2: unsigned.toString(2), 8: unsigned.toString(8), 10: result.toString(), 16: unsigned.toString(16).toUpperCase() };
}

export function solveRatio(a: number, b: number, known: number, missing: 'left' | 'right'): number {
  if (b === 0 || (missing === 'right' ? a === 0 || known === 0 : known === 0)) return fail('These values do not give a unique, defined ratio.');
  if (![a, b, known].every(Number.isFinite)) return fail('Enter finite ratio values.');
  const { integers: [x, y, v], exponent } = commonDecimalScale([a, b, known]);
  return finite(missing === 'left' ? decimalRatio(x * v, y, exponent) : decimalRatio(y * v, x, exponent));
}

export function engineeringTable(functions: string[], start: number, end: number, step: number, options: EvaluateOptions = {}): (number | null)[][] {
  if (functions.length < 1 || functions.length > 2 || ![start, end, step].every(Number.isFinite) || step <= 0 || start > end) {
    return fail('Choose an increasing range and positive step that give at most 45 distinct rows.');
  }
  const { integers: [a, b, increment], exponent } = commonDecimalScale([start, end, step]);
  const rows = (b - a) / increment + 1n;
  if (rows > 45n) return fail('Choose an increasing range and positive step that give at most 45 distinct rows.');
  const compiled = functions.map((body) => compileEngineeringExpression(body, true));
  let previous = -Infinity;
  return Array.from({ length: Number(rows) }, (_, index) => {
    const x = Number(`${a + BigInt(index) * increment}e${exponent}`);
    if (!(x > previous)) return fail('The table step is too small to produce distinct values.');
    previous = x;
    return [x, ...compiled.map((fn) => {
      try { return fn({ ...options, complex: false, variables: { ...options.variables, x } }).re; }
      catch (error) { if (error instanceof EngineeringError && error.kind === 'math') return null; throw error; }
    })];
  });
}

export function simulateMathBox(kind: 'dice' | 'coin', items: number, trials: number, seed?: number) {
  if (!Number.isInteger(items) || items < 1 || items > 3 || !Number.isInteger(trials) || trials < 1 || trials > 250) {
    return fail('Choose 1–3 dice or coins and 1–250 trials.');
  }
  let state = seed;
  const sample = () => {
    if (state === undefined) return Math.random();
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  const min = kind === 'dice' ? items : 0;
  const max = kind === 'dice' ? items * 6 : items;
  const counts = Array.from({ length: max - min + 1 }, (_, i) => ({ outcome: i + min, count: 0 }));
  const rolls = Array.from({ length: trials }, () => {
    const row = Array.from({ length: items }, () => kind === 'dice' ? 1 + Math.floor(sample() * 6) : Math.floor(sample() * 2));
    counts[sum(row) - min].count++;
    return row;
  });
  return { rolls, frequencies: counts.map(({ outcome, count }) => ({ outcome, count, relative: count / trials })) };
}
