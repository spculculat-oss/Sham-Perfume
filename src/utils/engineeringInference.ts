import { inverseNormal, normalProbability, summarizeStatistics } from './engineeringStatistics';

const LANCZOS = [676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7];
function logGamma(x: number) {
  // This module uses only x >= 1/2. Log-space keeps the beta prefactor finite at larger n.
  const a = 0.9999999999998099 + LANCZOS.reduce((sum, c, i) => sum + c / (x + i), 0);
  const t = x + 6.5;
  return 0.5 * Math.log(2 * Math.PI) + (x - 0.5) * Math.log(t) - t + Math.log(a);
}

function betaFraction(a: number, b: number, x: number): number {
  // Modified Lentz method for the incomplete beta continued fraction.
  const floor = (v: number) => Math.abs(v) < 1e-280 ? 1e-280 : v;
  let c = 1, d = 1 / floor(1 - (a + b) * x / (a + 1)), h = d;
  for (let i = 1; i <= 180; i++) {
    let v = i * (b - i) * x / ((a + 2 * i - 1) * (a + 2 * i));
    d = 1 / floor(1 + v * d); c = floor(1 + v / c); h *= d * c;
    v = -(a + i) * (a + b + i) * x / ((a + 2 * i) * (a + 2 * i + 1));
    d = 1 / floor(1 + v * d); c = floor(1 + v / c);
    const change = d * c;
    h *= change;
    if (Math.abs(change - 1) < 3e-14) return h;
  }
  throw new Error('The probability did not converge at this precision.');
}
function betaI(a: number, b: number, x: number): number {
  if (x <= 0 || x >= 1) return x <= 0 ? 0 : 1;
  const core = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x));
  const value = x < (a + 1) / (a + b + 2) ? core * betaFraction(a, b, x) / a : 1 - core * betaFraction(b, a, 1 - x) / b;
  return Math.max(0, Math.min(1, value));
}

/** Two-sided Student tail. Use the complementary form near zero to retain the small offset. */
export function studentTwoSided(t: number, degrees: number) {
  if (!Number.isInteger(degrees) || degrees < 1 || degrees > 1000 || Number.isNaN(t)) throw new Error('Use 1–1,000 integral degrees of freedom.');
  if (!Number.isFinite(t)) return 0;
  if (degrees === 1) return (2 / Math.PI) * Math.atan(1 / Math.abs(t));
  const ratio = (t / Math.sqrt(degrees)) ** 2;
  const a = degrees / 2, x = 1 / (1 + ratio);
  // Use the beta continued fraction from the small side, not 1 minus a CDF rounded to one.
  return x > (a + 1) / (a + 2.5) ? 1 - betaI(0.5, a, ratio / (1 + ratio)) : betaI(a, 0.5, x);
}

export function inferMean(values: number[], nullMean: number, confidence: number, knownDeviation?: number) {
  if (values.length < 2 || !Number.isFinite(nullMean) || !(confidence >= 0.5 && confidence <= 0.9999)
    || knownDeviation !== undefined && !(knownDeviation > 0 && Number.isFinite(knownDeviation))) throw new Error('Use at least two values, a finite null mean, and 50–99.99% confidence. Known σ must be positive.');
  const s = summarizeStatistics(values);
  const df = knownDeviation === undefined ? s.n - 1 : undefined;
  const se = (knownDeviation ?? s.sampleDeviation!) / Math.sqrt(s.n);
  if (!(se > 0) || !Number.isFinite(se)) throw new Error('The estimated standard error must be positive.');
  const statistic = (s.mean - nullMean) / se;
  const p = df === undefined ? 2 * normalProbability(Math.abs(statistic), Infinity, 0, 1) : studentTwoSided(statistic, df);
  let critical = 0;
  if (df === undefined) critical = inverseNormal((1 + confidence) / 2, 0, 1);
  else {
    let lo = 0, hi = 10_000;
    for (let i = 0; i < 65; i++) {
      const mid = lo + (hi - lo) / 2;
      if (studentTwoSided(mid, df) > 1 - confidence) lo = mid; else hi = mid;
    }
    critical = (lo + hi) / 2;
  }
  const interval = [s.mean - critical * se, s.mean + critical * se] as const;
  if (![statistic, ...interval].every(Number.isFinite)) throw new Error('The sample is outside the supported numeric scale.');
  return { mean: s.mean, count: s.n, statistic, standardError: se, p, confidence, df, interval };
}

/** Linear-interpolation sample quantiles (type 7), with Tukey fences and actual adjacent data for whiskers. */
export function engineeringBoxPlot(values: number[]) {
  const ordered = [...values].sort((a, b) => a - b);
  if (!ordered.length || ordered.length > 180 || !ordered.every(Number.isFinite)) throw new Error('Enter 1–180 finite values.');
  const quantile = (p: number) => {
    const position = (ordered.length - 1) * p;
    const i = Math.floor(position), part = position - i;
    return ordered[i] * (1 - part) + (ordered[i + 1] ?? ordered[i]) * part;
  };
  const q1 = quantile(0.25), median = quantile(0.5), q3 = quantile(0.75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
  const inner = ordered.filter((v) => v >= lo && v <= hi);
  // With very small samples, quantile interpolation can put a fence between the observed values.
  return { q1, median, q3, lower: Math.min(q1, inner[0] ?? q1), upper: Math.max(q3, inner.at(-1) ?? q3), min: ordered[0], max: ordered.at(-1)!, outliers: ordered.filter((v) => v < lo || v > hi) };
}
