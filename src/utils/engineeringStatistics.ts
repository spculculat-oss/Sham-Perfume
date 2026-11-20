import { EngineeringError } from './engineeringCalculator';
import { solveLinearSystem } from './engineeringAdvanced';
import { compensatedSum } from './engineeringNumeric';

const fail = (message: string): never => { throw new EngineeringError('math', message); };
const finite = (n: number) => Number.isFinite(n) ? n : fail('Result is outside the supported numeric range.');
const sum = (values: number[]) => {
  const plain = compensatedSum(values);
  return Number.isFinite(plain) ? plain : compensatedSum(values.map((v) => v / values.length)) * values.length;
};
const mean = (values: number[]) => {
  const total = sum(values);
  return Number.isFinite(total) ? total / values.length : compensatedSum(values.map((v) => v / values.length));
};

export function summarizeStatistics(values: number[]) {
  if (!values.length || values.length > 180 || !values.every(Number.isFinite)) return fail('Enter 1–180 finite values.');
  const n = values.length;
  const average = mean(values);
  const deviation = Math.hypot(...values.map((x) => (x / Math.sqrt(n)) - (average / Math.sqrt(n))));
  const sorted = [...values].sort((a, b) => a - b);
  return {
    n, sum: finite(sum(values)), mean: average, min: sorted[0], max: sorted[n - 1], median: n % 2 ? sorted[(n - 1) / 2] : mean(sorted.slice(n / 2 - 1, n / 2 + 1)),
    populationDeviation: finite(deviation), sampleDeviation: n > 1 ? finite(deviation * Math.sqrt(n / (n - 1))) : null,
  };
}

export type RegressionKind = 'linear' | 'quadratic' | 'logarithmic' | 'exponential' | 'exponentialBase' | 'power' | 'inverse';

export function fitRegression(kind: RegressionKind, points: [number, number][]) {
  if (points.length < (kind === 'quadratic' ? 3 : 2) || points.length > 180 || !points.every((row) => row.every(Number.isFinite))) {
    return fail('Enter enough finite (x, y) pairs for the selected model (maximum 180).');
  }
  const xOf = kind === 'logarithmic' || kind === 'power' ? Math.log : kind === 'inverse' ? (x: number) => 1 / x : (x: number) => x;
  const logY = ['exponential', 'exponentialBase', 'power'].includes(kind);
  const x = points.map(([x]) => finite(xOf(x)));
  const y = points.map(([, y]) => finite(logY ? Math.log(y) : y));
  const mid = mean(x);
  const yMean = mean(y);
  const spread = Math.max(...x.map((value) => Math.abs(value - mid)));
  if (!spread || !Number.isFinite(spread)) return fail('The x values need distinct, numerically workable values.');
  const t = x.map((value) => (value - mid) / spread);
  const dot = (a: number[], b: number[]) => sum(a.map((z, i) => z * b[i]));
  const terms = kind === 'quadratic' ? [t.map(() => 1), t, t.map((x) => x ** 2)] : [t.map(() => 1), t];
  const centeredY = y.map((value) => value - yMean);
  const beta = solveLinearSystem(terms.map((row) => terms.map((other) => dot(row, other))), terms.map((row) => dot(row, centeredY)));
  const curvature = (beta[2] ?? 0) / spread / spread;
  const b = beta[1] / spread - 2 * mid * curvature;
  const a = yMean + beta[0] - beta[1] * (mid / spread) + (beta[2] ?? 0) * (mid / spread) ** 2;
  const coefficients = (kind === 'quadratic' ? [a, b, curvature] : [logY ? Math.exp(a) : a, kind === 'exponentialBase' ? Math.exp(b) : b]).map(finite);
  const fitted = (z: number) => yMean + beta[0] + beta[1] * z + (beta[2] ?? 0) * z ** 2;
  const total = Math.hypot(...centeredY);
  const error = Math.hypot(...t.map((z, i) => fitted(z) - y[i]));
  return {
    coefficients,
    rSquared: total ? Math.max(0, 1 - (error / total) ** 2) : null,
    predict: (at: number) => {
      const v = fitted((finite(xOf(at)) - mid) / spread);
      return finite(logY ? Math.exp(v) : v);
    },
  };
}

const INV_SQRT_2PI = 0.3989422804014327;

/** Standard normal upper tail, using a rational approximation near the center and a continued fraction in the tails. */
function upperTail(x: number): number {
  if (x < 0) return 1 - upperTail(-x);
  if (x > 38.5) return 0;
  const exponential = Math.exp(-x * x / 2);
  if (x < 5) {
    const p = [0.0352624965998911, 0.700383064443688, 6.37396220353165, 33.912866078383, 112.079291497871, 221.213596169931, 220.206867912376];
    const q = [0.0883883476483184, 1.75566716318264, 16.064177579207, 86.7807322029461, 296.564248779674, 637.333633378831, 793.826512519948, 440.413735824752];
    const evaluate = (coefficients: number[]) => coefficients.reduce((value, c) => value * x + c);
    return exponential * evaluate(p) / evaluate(q);
  }
  let fraction = 0;
  for (let k = 48; k >= 1; k--) fraction = k / (x + fraction);
  return Math.exp(-x * x / 2 + Math.log(INV_SQRT_2PI / (x + fraction)));
}

function validateNormal(mean: number, sd: number) {
  if (!Number.isFinite(mean) || !Number.isFinite(sd) || sd <= 0) fail('Normal distribution needs a finite mean and positive standard deviation.');
}

const standardized = (x: number, mean: number, sd: number) => Number.isFinite(x) && !Number.isFinite(x - mean) ? x / sd - mean / sd : (x - mean) / sd;

export function normalDensity(x: number, mean: number, sd: number): number {
  validateNormal(mean, sd);
  const z = standardized(x, mean, sd);
  return finite(Math.exp(-(z ** 2) / 2 + Math.log(INV_SQRT_2PI) - Math.log(sd)));
}

export function normalProbability(from: number, to: number, mean: number, sd: number): number {
  validateNormal(mean, sd);
  if (!(from <= to)) return fail('The lower bound must be ≤ the upper bound.');
  const a = standardized(from, mean, sd);
  const b = standardized(to, mean, sd);
  const width = (to - from) / sd;
  if (Number.isFinite(a) && Number.isFinite(b) && width > 0 && width * (1 + Math.max(Math.abs(a), Math.abs(b))) < 1e-3) {
    // Subtracting nearly equal CDFs loses all digits for a small interval; integrate its density locally.
    const h = width / 2, m = a + h;
    const left = Math.exp(h * (m - h / 2)), right = Math.exp(-h * (m + h / 2));
    return Math.exp(Math.log(width) - m * m / 2 + Math.log(INV_SQRT_2PI)) * (left + 4 + right) / 6;
  }
  return Math.max(0, a < 0 ? upperTail(-b) - upperTail(-a) : upperTail(a) - upperTail(b));
}

export function inverseNormal(probability: number, mean: number, sd: number): number {
  validateNormal(mean, sd);
  if (!(probability > 0 && probability < 1)) return fail('The probability must be between 0 and 1 (exclusive).');
  if (probability === 0.5) return mean;
  const tail = Math.min(probability, 1 - probability);
  let a = 0;
  let b = 39;
  for (let i = 0; i < 65; i++) {
    const mid = (a + b) / 2;
    if (upperTail(mid) > tail) a = mid; else b = mid;
  }
  return finite(mean + (probability < 0.5 ? -1 : 1) * ((a + b) / 2) * sd);
}

const logFactorials = [0];
function logFactorial(n: number) {
  for (let i = logFactorials.length; i <= n; i++) logFactorials.push(logFactorials[i - 1] + Math.log(i));
  return logFactorials[n];
}

export function binomialProbability(x: number, n: number, p: number, cumulative: boolean): number {
  if (!Number.isInteger(n) || !Number.isInteger(x) || n < 0 || n > 10_000 || x < 0 || x > n || !(p >= 0 && p <= 1)) {
    return fail('Use integers 0 ≤ x ≤ n ≤ 10,000 and a probability from 0 to 1.');
  }
  if (p === 0 || p === 1) { const expected = p * n; return Number(cumulative ? x >= expected : x === expected); }
  if (cumulative && x === n) return 1;
  const logP = Math.log(p);
  const logQ = Math.log1p(-p);
  const base = logFactorial(n);
  let total = 0;
  for (let k = cumulative ? 0 : x; k <= x; k++) total += Math.exp(base - logFactorial(k) - logFactorial(n - k) + k * logP + (n - k) * logQ);
  return Math.min(1, total);
}

export function poissonProbability(x: number, rate: number, cumulative: boolean): number {
  if (!Number.isInteger(x) || x < 0 || x > 10_000 || !(rate >= 0 && rate <= 10_000)) return fail('Use an integer count and a rate from 0 to 10,000.');
  if (rate === 0) return Number(cumulative || x === 0);
  const logRate = Math.log(rate);
  let total = 0;
  for (let k = cumulative ? 0 : x; k <= x; k++) total += Math.exp(k * logRate - rate - logFactorial(k));
  return Math.min(1, total);
}
