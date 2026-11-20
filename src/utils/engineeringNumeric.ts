/** Bounded numerical helpers shared by the calculator modes. No changes to store/accounting math. */
export function compensatedSum(values: Iterable<number>): number {
  let total = 0, correction = 0;
  for (const value of values) {
    const next = total + value;
    correction += Math.abs(total) >= Math.abs(value) ? (total - next) + value : (value - next) + total;
    total = next;
  }
  return total + correction;
}

/** Treat the supplied finite decimal coefficients as written; useful for exact sign and zero tests.
 * Only small matrices and degree ≤ 4 polynomials use this, so the BigInt work stays bounded. */
export function commonDecimalScale(values: readonly number[]) {
  const parts = values.map((value) => {
    const [text, exponent = '0'] = String(value).split('e');
    const [whole, fraction = ''] = text.split('.');
    return { numerator: BigInt(whole + fraction), exponent: Number(exponent) - fraction.length };
  });
  const exponent = Math.min(0, ...parts.filter(({ numerator }) => numerator !== 0n).map((part) => part.exponent));
  return { exponent, integers: parts.map((part) => part.numerator * 10n ** BigInt(part.exponent - exponent)) };
}

/** Correctly round a rational to a double (including ties-to-even). Rounding numerator and
 * denominator separately loses an ulp on plain input literals, especially noticeable with angles. */
export function decimalRatio(n: bigint, d: bigint, exponent = 0): number {
  if (!n) return 0;
  if (exponent > 0) n *= 10n ** BigInt(exponent);
  if (exponent < 0) d *= 10n ** BigInt(-exponent);
  const sign = (n < 0n) === (d < 0n) ? 1 : -1;
  if (n < 0n) n = -n;
  if (d < 0n) d = -d;
  if (n <= 9_007_199_254_740_991n && d <= 9_007_199_254_740_991n) return sign * (Number(n) / Number(d));
  let power = n.toString(2).length - d.toString(2).length;
  if (power >= 0 ? n < (d << BigInt(power)) : (n << BigInt(-power)) < d) power--;
  if (power > 1023) return sign * Infinity;
  const shift = 52 - Math.max(power, -1022);
  if (shift >= 0) n <<= BigInt(shift); else d <<= BigInt(-shift);
  let bits = n / d;
  const twiceRemainder = 2n * (n % d);
  if (twiceRemainder > d || (twiceRemainder === d && bits % 2n)) bits++;
  return sign * Number(bits) * (2 ** -shift);
}

// The embedded 7-point Gauss / 15-point Kronrod rule samples at different, non-dyadic phases.
// This avoids a whole family of false "convergence" results on oscillations sampled by Simpson grids.
const KRONROD = [
  [0.9914553711208126, 0.02293532201052922, 0],
  [0.9491079123427585, 0.06309209262997855, 0.1294849661688697],
  [0.8648644233597691, 0.1047900103222502, 0],
  [0.7415311855993945, 0.1406532597155259, 0.2797053914892766],
  [0.5860872354676911, 0.1690047266392679, 0],
  [0.4058451513773972, 0.1903505780647854, 0.3818300505051189],
  [0.2077849550078985, 0.2044329400752989, 0],
] as const;

/** Numerical integral on a finite interval. A gap, non-finite sample or unconverged estimate is not an answer. */
export function integrateNumerically(fn: (x: number) => number | undefined, from: number, to: number, maxSamples = 8000): number | undefined {
  const lo = Math.min(from, to), hi = Math.max(from, to), span = hi - lo;
  if (!Number.isFinite(span) || !Number.isFinite(fn(lo))) return;
  if (!span) return 0;
  if (!Number.isFinite(fn(hi))) return;
  let remaining = maxSamples - 2;
  function estimate(a: number, b: number, depth: number): number | undefined {
    const h = (b - a) / 2, mid = a + h;
    if (!h || mid === a || mid === b || (remaining -= 15) < 0) return;
    const center = fn(mid);
    if (center === undefined || !Number.isFinite(center)) return;
    let kronrod = center * 0.2094821410847278;
    let gauss = center * 0.4179591836734694;
    let magnitude = Math.abs(kronrod);
    for (const [x, k, g] of KRONROD) {
      const left = fn(mid - h * x), right = fn(mid + h * x);
      if (left === undefined || right === undefined || !Number.isFinite(left) || !Number.isFinite(right)) return;
      kronrod += k * left + k * right;
      gauss += g * left + g * right;
      magnitude += k * Math.abs(left) + k * Math.abs(right);
    }
    if (!Number.isFinite(kronrod) || !Number.isFinite(gauss) || !Number.isFinite(magnitude)) return;
    if (Math.abs(kronrod - gauss) <= Math.max(1e-12 / span, 2e-10 * magnitude)) {
      const result = kronrod * h;
      return Number.isFinite(result) ? result : undefined;
    }
    if (depth <= 0) return;
    const left = estimate(a, mid, depth - 1);
    if (left === undefined) return;
    const right = estimate(mid, b, depth - 1);
    if (right !== undefined && Number.isFinite(left + right)) return left + right;
  }
  const parts: number[] = [];
  const borders = Array.from({ length: 9 }, (_, i) => i === 8 ? hi : lo + span * (i / 8));
  if (borders.slice(1, -1).some((x) => !Number.isFinite(fn(x)))) return;
  remaining -= 7;
  for (let i = 0; i < 8; i++) {
    const start = borders[i], end = borders[i + 1];
    if (start === end) continue;
    const value = estimate(start, end, 18);
    if (value === undefined) return;
    parts.push(value);
  }
  const sum = compensatedSum(parts);
  return Number.isFinite(sum) ? (from > to ? -sum : sum) : undefined;
}

/** Check both one-sided limits, including small-scale corners whose central slope looks like zero. */
export function differentiateNumerically(fn: (x: number) => number | undefined, point: number): number | undefined {
  const center = fn(point);
  if (center === undefined || !Number.isFinite(center)) return;
  const estimates = [];
  for (let i = 0; i < 8; i++) {
    const h = Math.max(1, Math.abs(point)) * 1e-4 * 2 ** -i;
    const a = point - h, b = point + h;
    if (a === point || b === point || !Number.isFinite(a) || !Number.isFinite(b)) break;
    const left = fn(a), right = fn(b);
    if (left === undefined || right === undefined || !Number.isFinite(left) || !Number.isFinite(right)) return;
    const l = (center - left) / (point - a), r = (right - center) / (b - point);
    const noise = 4 * Number.EPSILON * Math.max(Math.abs(center), Math.abs(left), Math.abs(right)) / h;
    if (!Number.isFinite(l) || !Number.isFinite(r) || !Number.isFinite(noise)) continue;
    estimates.push({ l, r, noise });
    if (estimates.length < 4) continue;
    const [u, v, w, z] = estimates.slice(-4);
    const l1 = (u.l - 6 * v.l + 8 * w.l) / 3, r1 = (u.r - 6 * v.r + 8 * w.r) / 3;
    const l2 = (v.l - 6 * w.l + 8 * z.l) / 3, r2 = (v.r - 6 * w.r + 8 * z.r) / 3;
    const scale = Math.max(...[u, v, w, z].flatMap(({ l, r }) => [Math.abs(l), Math.abs(r)]));
    const tol = 1e-5 * scale + 8 * Math.max(u.noise, v.noise, w.noise, z.noise);
    if (Math.max(Math.abs(l1 - l2), Math.abs(r1 - r2), Math.abs(l2 - r2)) <= tol) return l2 / 2 + r2 / 2;
  }
}
