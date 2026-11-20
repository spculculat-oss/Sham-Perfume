import { EngineeringError } from './engineeringCalculator';
import { addComplex, complex, divideComplex, magnitude, multiplyComplex, scaleComplex, sqrtComplex, subtractComplex, type ComplexValue } from './engineeringComplex';
import { commonDecimalScale, decimalRatio } from './engineeringNumeric';

const fail = (message: string): never => { throw new EngineeringError('math', message); };
const unresolved = () => fail('Could not resolve distinct polynomial roots at this precision.');
const abs = (x: bigint) => x < 0n ? -x : x;
const trim = (p: bigint[]) => {
  const first = p.findIndex((c) => c !== 0n);
  return first < 0 ? [] : p.slice(first);
};
function gcd(a: bigint, b: bigint) {
  while (b) [a, b] = [b, a % b];
  return abs(a);
}
const derivative = (p: bigint[]) => p.slice(0, -1).map((c, i) => c * BigInt(p.length - 1 - i));
function primitive(p: bigint[]) {
  const nonzero = trim(p);
  const factor = nonzero.reduce(gcd, 0n);
  return nonzero.map((c) => c / factor);
}

/** Integer pseudo-remainders detect exact repeated factors, not just small residuals at a turning point. */
function repeatedFactor(p: bigint[]) {
  let a = primitive(p), b = primitive(derivative(p));
  while (b.length > 1) {
    while (a.length >= b.length) a = primitive(a.map((c, i) => b[0] * c - a[0] * (b[i] ?? 0n)));
    if (!a.length) return b;
    [a, b] = [b, a];
  }
  return [1n];
}
function dividePolynomial(p: bigint[], divisor: bigint[]) {
  const remainder = [...primitive(p)], quotient: bigint[] = [];
  for (let i = 0; i + divisor.length <= p.length; i++) {
    if (remainder[i] % divisor[0]) return unresolved();
    const q = remainder[i] / divisor[0];
    quotient.push(q);
    for (let j = 0; j < divisor.length; j++) remainder[i + j] -= q * divisor[j];
  }
  if (remainder.some(Boolean)) return unresolved();
  return primitive(quotient);
}

/** Scale x = 2^scalePower · t, but keep the coefficients exact during sign tests. */
function prepare(coefficients: number[]) {
  if (coefficients.length < 3 || coefficients.length > 5 || !coefficients.every(Number.isFinite) || !coefficients[0]) {
    return fail('Use a degree 2–4 polynomial with a nonzero leading coefficient.');
  }
  const logLead = Math.log2(Math.abs(coefficients[0]));
  const logBound = Math.max(...coefficients.slice(1).map((v, i) => v ? (Math.log2(Math.abs(v)) - logLead) / (i + 1) : -Infinity));
  const power = logBound === -Infinity ? 0 : Math.max(-1074, Math.min(1023, Math.floor(logBound)));
  const { integers } = commonDecimalScale(coefficients);
  const degree = integers.length - 1;
  const scaled = primitive(integers.map((c, i) => c << BigInt(power >= 0 ? (degree - i) * power : -i * power)));
  const result = (x: number) => {
    const value = x * (2 ** power);
    if (!Number.isFinite(value) || (x && !value)) return fail('A polynomial root is outside the supported numeric range.');
    return value || 0;
  };
  return { scaled, result };
}

const approximate = (p: bigint[]) => p.map((v) => decimalRatio(v, p[0]));
function signAt(p: bigint[], x: number) {
  const { integers: [n], exponent } = commonDecimalScale([x]);
  const d = 10n ** BigInt(-exponent);
  let value = p[0], denominator = 1n;
  for (const c of p.slice(1)) {
    denominator *= d;
    value = value * n + c * denominator;
  }
  return value < 0n ? -1 : value > 0n ? 1 : 0;
}

function quadratic(p: bigint[]): ComplexValue[] {
  const [a, b, c] = p;
  const half = decimalRatio(-b, 2n * a);
  const delta = b * b - 4n * a * c;
  if (!delta) return [complex(half), complex(half)];
  const size = Math.sqrt(decimalRatio(abs(delta), 4n * a * a));
  if (!Number.isFinite(size) || !size) return unresolved();
  if (delta < 0n) return [complex(half, -size), complex(half, size)];
  const large = half + (half < 0 ? -size : size);
  const constant = decimalRatio(c, a);
  if (c && !constant) return unresolved();
  return [complex(large), complex(constant / large)];
}

function distinctRealRoots(p: bigint[]): number[] {
  const degree = p.length - 1;
  if (degree === 0) return [];
  if (degree === 1) return [decimalRatio(-p[1], p[0])];
  if (degree === 2) return [...new Set(quadratic(p).filter((r) => !r.im).map((r) => r.re))].sort((a, b) => a - b);
  const repeated = repeatedFactor(p);
  if (repeated.length > 1) return distinctRealRoots(dividePolynomial(p, repeated));
  const limit = 2 + Math.max(...approximate(p).slice(1).map(Math.abs));
  if (!Number.isFinite(limit) || limit > 1e6) return unresolved();
  const borders = [-limit, ...distinctRealRoots(derivative(p)).filter((x) => Math.abs(x) < limit), limit];
  const signs = borders.map((x) => signAt(p, x));
  const roots: number[] = [];
  for (let i = 0; i < borders.length - 1; i++) {
    if (!signs[i]) roots.push(borders[i]);
    if (!signs[i] || !signs[i + 1] || signs[i] === signs[i + 1]) continue;
    let a = borders[i], b = borders[i + 1];
    for (let step = 0; step < 1100; step++) {
      const mid = a + (b - a) / 2;
      if (mid === a || mid === b) break;
      const sign = signAt(p, mid);
      if (!sign) { a = b = mid; break; }
      if (sign === signs[i]) a = mid; else b = mid;
    }
    roots.push(a + (b - a) / 2);
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

function solveScaled(p: bigint[]): ComplexValue[] {
  const degree = p.length - 1;
  if (degree === 1) return [complex(decimalRatio(-p[1], p[0]))];
  if (degree === 2) return quadratic(p);
  if (degree === 4 && !p[1] && !p[3]) return quadratic([p[0], p[2], p[4]]).flatMap((r) => {
    const z = sqrtComplex(r);
    return [z, scaleComplex(z, -1)];
  });
  const repeated = repeatedFactor(p);
  if (repeated.length > 1) return [...solveScaled(dividePolynomial(p, repeated)), ...solveScaled(repeated)];
  const real = distinctRealRoots(p);
  if (real.length === degree) return real.map((x) => complex(x));
  let remainder = approximate(p).map((c, i) => {
    if (!Number.isFinite(c) || (!c && p[i])) return unresolved();
    return complex(c);
  });
  const roots: ComplexValue[] = [];
  const deflate = (z: ComplexValue) => {
    roots.push(z);
    remainder = remainder.slice(0, -1).reduce<ComplexValue[]>((array, value) => [...array, array.length ? addComplex(value, multiplyComplex(z, array.at(-1)!)) : value], []);
  };
  for (const x of real) deflate(complex(x));
  if (remainder.length === 3) {
    const half = -remainder[1].re / 2;
    const square = remainder[2].re - half * half;
    if (!(square > 0)) return unresolved();
    const size = Math.sqrt(square);
    return [...roots, complex(half, -size), complex(half, size)];
  }
  const root = laguerre(remainder, complex(0)) ?? laguerre(remainder, complex(0.7, 0.6)) ?? laguerre(remainder, complex(-0.4, 1));
  if (!root?.im) return unresolved();
  // With no real roots the quartic has two conjugate pairs. Deflate a whole pair, not an arbitrary complex remainder.
  const half = -(remainder[1].re + 2 * root.re) / 2;
  const norm = root.re * root.re + root.im * root.im;
  const square = remainder[4].re / norm - half * half;
  if (!(square > 0)) return unresolved();
  const size = Math.sqrt(square);
  const rootsOfQuartic = [root, complex(root.re, -root.im), complex(half, -size), complex(half, size)];
  if (rootsOfQuartic.some((z) => {
    const radius = magnitude(z);
    const scale = remainder.reduce((a, b) => a * radius + Math.abs(b.re), 0);
    const residual = magnitude(remainder.reduce((a, b) => addComplex(multiplyComplex(a, z), b)));
    return !Number.isFinite(residual) || residual > 1e-10 * scale;
  })) return unresolved();
  return rootsOfQuartic;
}

export function solvePolynomial(coefficients: number[]): ComplexValue[] {
  const { scaled, result } = prepare(coefficients);
  return solveScaled(scaled).map((z) => complex(result(z.re), result(z.im))).sort((a, b) => a.re - b.re || a.im - b.im);
}

export type InequalityOperator = '>' | '>=' | '<' | '<=';
export interface Interval { from: number; to: number; includeFrom: boolean; includeTo: boolean }

export function solvePolynomialInequality(coefficients: number[], op: InequalityOperator): Interval[] {
  const { scaled, result } = prepare(coefficients);
  const roots = distinctRealRoots(scaled);
  const converted = roots.map(result);
  if (converted.some((r, i) => i > 0 && r <= converted[i - 1])) return unresolved();
  const borders = [-Infinity, ...roots, Infinity];
  const output = [-Infinity, ...converted, Infinity];
  const sign = Math.sign(coefficients[0]);
  const target = op[0] === '>' ? 1 : -1;
  const inclusive = op.length > 1;
  const inside = borders.slice(0, -1).map((from, i) => {
    const to = borders[i + 1];
    if (!Number.isFinite(from)) return sign * ((scaled.length - 1) % 2 ? -1 : 1) === target;
    if (!Number.isFinite(to)) return sign === target;
    const mid = from + (to - from) / 2;
    if (mid === from || mid === to) return unresolved();
    return signAt(scaled, mid) === target;
  });
  const intervals: Interval[] = [];
  output.slice(0, -1).forEach((from, i) => {
    const to = output[i + 1];
    if (inside[i]) {
      const previous = intervals.at(-1);
      if (inclusive && previous?.to === from) {
        previous.to = to;
        previous.includeTo = Number.isFinite(to);
      } else intervals.push({ from, to, includeFrom: inclusive && Number.isFinite(from), includeTo: inclusive && Number.isFinite(to) });
    } else if (inclusive && Number.isFinite(from) && !inside[i - 1]) intervals.push({ from, to: from, includeFrom: true, includeTo: true });
  });
  return intervals;
}
