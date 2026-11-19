import { EngineeringError, compileEngineeringExpression, radiansPerUnit, type AngleMode, type EvaluateOptions } from './engineeringCalculator';
import { addComplex, complex, divideComplex, magnitude, multiplyComplex, scaleComplex, sqrtComplex, subtractComplex, type ComplexValue } from './engineeringComplex';

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

const vectorDot = (a: number[], b: number[]) => finite(sum(a.map((item, i) => item * b[i])));
const transpose = (a: Matrix): Matrix => a[0].map((_, col) => a.map((row) => row[col]));
export const identityMatrix = (n: number): Matrix => {
  if (!Number.isInteger(n) || n < 1 || n > 4) return fail('Matrix size must be from 1 to 4.');
  return Array.from({ length: n }, (_, row) => Array.from({ length: n }, (_, col) => Number(row === col)));
};

function reduceSquare(a: Matrix, right: Matrix): { determinant: number; solution: Matrix | null } {
  const n = a.length;
  let swaps = 0;
  const pivots: number[] = [];
  const scales = a.map((row) => Math.max(...row.map(Math.abs)));
  if (scales.some((scale) => !scale)) return { determinant: 0, solution: null };
  const m = a.map((row, i) => row.concat(right[i]).map((value) => finite(value / scales[i])));
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let i = col + 1; i < n; i++) if (Math.abs(m[i][col]) > Math.abs(m[pivot][col])) pivot = i;
    const scale = m[pivot][col];
    if (Math.abs(scale) < 4 * Number.EPSILON) return { determinant: 0, solution: null };
    if (col !== pivot) { [m[col], m[pivot]] = [m[pivot], m[col]]; swaps++; }
    pivots.push(scale);
    m[col] = m[col].map((value) => finite(value / scale));
    for (let i = 0; i < n; i++) {
      if (i === col) continue;
      const factor = m[i][col];
      m[i] = m[i].map((value, j) => j === col ? 0 : finite(value - factor * m[col][j]));
    }
  }
  // Separate mantissa/exponent so a huge row scale followed by a small one does not overflow prematurely.
  let mantissa = swaps % 2 ? -1 : 1;
  let exponent = 0;
  for (const factor of scales.concat(pivots)) {
    const [part, exp] = factor.toExponential().split('e');
    mantissa *= Number(part);
    exponent += Number(exp);
  }
  const [part, exp] = mantissa.toExponential().split('e');
  return { determinant: Number(`${part}e${exponent + Number(exp)}`), solution: m.map((row) => row.slice(n)) };
}

export function calculateMatrix(op: MatrixOperation, a: Matrix, b: Matrix = []): Matrix | number {
  const [rows, cols] = matrixSize(a);
  if (op === 'transpose') return transpose(a);
  if (op === 'identity') return identityMatrix(rows);
  if (op === 'det' || op === 'inverse') {
    if (rows !== cols) return fail('This operation requires a square matrix.');
    const reduction = reduceSquare(a, op === 'det' ? a.map(() => []) : identityMatrix(rows));
    if (op === 'det') return finite(reduction.determinant);
    return reduction.solution ?? fail('This matrix is singular or too ill-conditioned to invert.');
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
  const { solution } = reduceSquare(a, b.map((value) => [value]));
  return solution?.map(([value]) => value) ?? fail('The system has no unique solution.');
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
  if (op === 'angle') return Math.acos(Math.max(-1, Math.min(1, vectorDot(unit(a), unit(b))))) / radiansPerUnit(angle);
  if (op === 'dot') return vectorDot(a, b);
  if (op === 'cross') {
    if (a.length !== 3) return fail('The cross product requires two 3D vectors.');
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]].map(finite);
  }
  return a.map((value, i) => finite(value + (op === 'add' ? b[i] : -b[i])));
}

const horner = (coefficients: number[], x: number) => coefficients.reduce((a, b) => a * x + b, 0);
const hornerScale = (coefficients: number[], x: number) => coefficients.reduce((a, b) => a * Math.abs(x) + Math.abs(b), 0);

function polynomialScale(coefficients: number[]) {
  if (coefficients.length < 3 || coefficients.length > 5 || !coefficients.every(Number.isFinite) || !coefficients[0]) {
    return fail('Use a degree 2–4 polynomial with a nonzero leading coefficient.');
  }
  // Let x = scale · t so root finding is well-conditioned for very large roots.
  const logLead = Math.log(Math.abs(coefficients[0]));
  const maxLog = Math.max(...coefficients.slice(1).map((c, i) => c ? (Math.log(Math.abs(c)) - logLead) / (i + 1) : -Infinity));
  // Power-of-two scaling avoids introducing roundoff when scaling by an exact binary exponent.
  const power = maxLog === -Infinity ? 0 : Math.max(-1074, Math.min(1023, Math.floor(maxLog / Math.LN2)));
  const scale = 2 ** power;
  const normalized = [1, ...coefficients.slice(1).map((c, i) => {
    if (!c) return 0;
    const direct = c / coefficients[0] / scale ** (i + 1);
    const value = direct && Number.isFinite(direct) ? direct : Math.sign(c) * Math.sign(coefficients[0])
      * Math.exp(Math.log(Math.abs(c)) - logLead - (i + 1) * power * Math.LN2);
    if (!value || !Number.isFinite(value) || Math.abs(value) > 32) return fail('The polynomial is outside the supported numeric range.');
    return value;
  })];
  return { normalized, scale };
}

function realRoots(coefficients: number[]): number[] {
  const degree = coefficients.length - 1;
  if (degree === 1) return [-coefficients[1] / coefficients[0]];
  // A polynomial is monotone between roots of its derivative. Check the turning points too, for even multiplicities.
  const bound = 1 + Math.max(...coefficients.slice(1).map((c) => Math.abs(c / coefficients[0])));
  const derivative = coefficients.slice(0, -1).map((c, i) => c * (degree - i));
  const breakpoints = [-bound, ...realRoots(derivative).filter((x) => Math.abs(x) < bound), bound];
  const values = breakpoints.map((x) => horner(coefficients, x));
  const isRoot = breakpoints.map((x, i) => i > 0 && i < breakpoints.length - 1 && Math.abs(values[i]) <= 8 * Number.EPSILON * hornerScale(coefficients, x));
  const roots: number[] = [];
  for (let i = 0; i < values.length - 1; i++) {
    if (isRoot[i]) roots.push(breakpoints[i]);
    if (isRoot[i] || isRoot[i + 1] || Math.sign(values[i]) === Math.sign(values[i + 1])) continue;
    let lo = breakpoints[i];
    let hi = breakpoints[i + 1];
    const sign = Math.sign(values[i]);
    for (let step = 0; step < 1100; step++) {
      const mid = lo + (hi - lo) / 2;
      if (mid === lo || mid === hi) break;
      const value = horner(coefficients, mid);
      if (!value) { lo = hi = mid; break; }
      if (Math.sign(value) === sign) lo = mid;
      else hi = mid;
    }
    roots.push(lo + (hi - lo) / 2);
  }
  return roots;
}

function laguerre(coefficients: ComplexValue[], initial: ComplexValue): ComplexValue | undefined {
  let x = initial;
  const n = coefficients.length - 1;
  for (let step = 1; step <= 100; step++) {
    let p = coefficients[0];
    let d = complex(0);
    let dd = complex(0);
    let scale = magnitude(p);
    const r = magnitude(x);
    for (const c of coefficients.slice(1)) {
      dd = addComplex(multiplyComplex(dd, x), scaleComplex(d, 2));
      d = addComplex(multiplyComplex(d, x), p);
      p = addComplex(multiplyComplex(p, x), c);
      scale = r * scale + magnitude(c);
    }
    if (magnitude(p) <= 8 * Number.EPSILON * scale) return x;
    const g = divideComplex(d, p);
    const g2 = multiplyComplex(g, g);
    const h = subtractComplex(g2, divideComplex(dd, p));
    const discriminant = sqrtComplex(scaleComplex(subtractComplex(scaleComplex(h, n), g2), n - 1));
    const plus = addComplex(g, discriminant);
    const minus = subtractComplex(g, discriminant);
    const divisor = magnitude(plus) >= magnitude(minus) ? plus : minus;
    const delta = magnitude(divisor) ? divideComplex(complex(n), divisor) : complex(Math.cos(step), Math.sin(step));
    const next = subtractComplex(x, scaleComplex(delta, step % 10 === 0 ? 0.5 : 1));
    if (!Number.isFinite(magnitude(next))) return undefined;
    if (next.re === x.re && next.im === x.im) return next;
    x = next;
  }
  return undefined;
}

function quadratic(b: number, c: number): ComplexValue[] {
  const d = (b / 2) ** 2 - c;
  if (d < 0) return [complex(-b / 2, -Math.sqrt(-d)), complex(-b / 2, Math.sqrt(-d))];
  if (d === 0) return [complex(-b / 2), complex(-b / 2)];
  const q = -b / 2 - (b < 0 ? -1 : 1) * Math.sqrt(d);
  return [complex(q), complex(c / q)];
}

export function solvePolynomial(coefficients: number[]): ComplexValue[] {
  const { normalized, scale } = polynomialScale(coefficients);
  const sorted = (roots: ComplexValue[]) => roots.map((z) => complex(finite(z.re * scale) || 0, finite(z.im * scale) || 0)).sort((a, b) => a.re - b.re || a.im - b.im);
  if (normalized.length === 3) return sorted(quadratic(normalized[1], normalized[2]));
  if (normalized.length === 5 && !normalized[1] && !normalized[3]) return sorted(quadratic(normalized[2], normalized[4]).flatMap((v) => {
    const z = sqrtComplex(v);
    return [z, scaleComplex(z, -1)];
  }));
  const roots: ComplexValue[] = [];
  let remainder = normalized.map((c) => complex(c));
  const deflate = (z: ComplexValue) => {
    roots.push(z);
    remainder = remainder.slice(0, -1).reduce<ComplexValue[]>((array, value) => [...array, array.length ? addComplex(value, multiplyComplex(z, array.at(-1)!)) : value], []);
  };
  // Real isolation first preserves real and repeated roots. Laguerre supplies the remaining complex pairs.
  const real = realRoots(normalized);
  for (const x of real) {
    if (remainder.length < 2) break;
    deflate(complex(x));
  }
  while (remainder.length > 1) {
    if (remainder.length === 2) { deflate(divideComplex(scaleComplex(remainder[1], -1), remainder[0])); break; }
    const root = laguerre(remainder, complex(0)) ?? laguerre(remainder, complex(0.7, 0.6)) ?? laguerre(remainder, complex(-0.4, 1));
    if (!root) return fail('Could not resolve the polynomial roots at this precision.');
    const known = real.find((x) => Math.hypot(root.re - x, root.im) < 2e-7 * Math.max(Math.abs(x), 1e-6));
    deflate(known === undefined ? root : complex(known));
  }
  return sorted(roots);
}

export type InequalityOperator = '>' | '>=' | '<' | '<=';
export interface Interval { from: number; to: number; includeFrom: boolean; includeTo: boolean }

export function solvePolynomialInequality(coefficients: number[], op: InequalityOperator): Interval[] {
  const { normalized, scale } = polynomialScale(coefficients);
  const roots = realRoots(normalized);
  const borders = [-Infinity, ...roots, Infinity];
  const ascending = op[0] === '>';
  const inclusive = op.length > 1;
  const sign = Math.sign(coefficients[0]);
  const rescale = (x: number) => Number.isFinite(x) ? finite(x * scale) || 0 : x;
  const inside = borders.slice(0, -1).map((from, i) => {
    const to = borders[i + 1];
    const testPoint = !Number.isFinite(from) ? Math.min(-3, to - 1) : !Number.isFinite(to) ? Math.max(3, from + 1) : from + (to - from) / 2;
    const value = sign * horner(normalized, testPoint);
    return ascending ? value > 0 : value < 0;
  });
  const intervals: Interval[] = [];
  borders.slice(0, -1).forEach((from, i) => {
    const to = borders[i + 1];
    if (inside[i]) {
      const previous = intervals.at(-1);
      if (inclusive && previous?.to === rescale(from)) {
        previous.to = rescale(to);
        previous.includeTo = Number.isFinite(to);
      } else intervals.push({ from: rescale(from), to: rescale(to), includeFrom: inclusive && Number.isFinite(from), includeTo: inclusive && Number.isFinite(to) });
    } else if (inclusive && Number.isFinite(from) && !inside[i - 1]) {
      intervals.push({ from: rescale(from), to: rescale(from), includeFrom: true, includeTo: true });
    }
  });
  return intervals;
}

export function solveNumericEquation(source: string, guess: number, options: EvaluateOptions = {}): { root: number; residual: number } {
  const sides = source.split('=');
  if (sides.length > 2) return fail('Use f(x) or one equals sign in an equation.');
  const left = compileEngineeringExpression(sides[0]);
  const right = sides.length === 2 ? compileEngineeringExpression(sides[1]) : () => complex(0);
  if (!Number.isFinite(guess)) return fail('Enter a finite starting value.');
  const value = (x: number) => {
    const config = { ...options, variables: { ...options.variables, x }, complex: false };
    return finite(left(config).re - right(config).re);
  };
  let x = guess;
  let y = value(x);
  if (y === 0) return { root: x, residual: 0 };
  const initialResidual = Math.abs(y);
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
    if (!nextY || (Math.abs(next - x) <= 1e-10 * Math.max(1, Math.abs(next)) && Math.abs(nextY) <= initialResidual * 1e-10)) return { root: next, residual: nextY };
    if (next === x) break;
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
  return finite(missing === 'left' ? a / b * known : b / a * known);
}

export function engineeringTable(functions: string[], start: number, end: number, step: number, options: EvaluateOptions = {}): (number | null)[][] {
  const intervals = (end - start) / step;
  const rows = Math.floor(intervals + 1e-10) + 1;
  if (functions.length < 1 || functions.length > 2 || !Number.isFinite(intervals) || intervals < 0 || step <= 0 || start > end || rows > 45 || (end > start && start + step === start)) {
    return fail('Choose an increasing range and positive step that give at most 45 distinct rows.');
  }
  const compiled = functions.map(compileEngineeringExpression);
  return Array.from({ length: rows }, (_, index) => {
    const x = start + index * step;
    return [x, ...compiled.map((fn) => {
      try { return fn({ ...options, complex: false, variables: { ...options.variables, x } }).re; }
      catch (error) { if (error instanceof EngineeringError && error.kind !== 'syntax') return null; throw error; }
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
