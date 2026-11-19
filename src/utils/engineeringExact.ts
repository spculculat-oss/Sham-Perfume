/** A bounded exact value: a rational, a rational multiple of π, or a single square root. */
export interface ExactValue {
  numerator: bigint;
  denominator: bigint;
  symbol?: 'pi' | number;
}

const LIMIT = 10n ** 60n;
const abs = (n: bigint) => n < 0n ? -n : n;

function gcd(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b];
  return a;
}

export function exact(n: bigint, d = 1n, symbol?: ExactValue['symbol']): ExactValue | undefined {
  if (!d) return undefined;
  if (!n) return { numerator: 0n, denominator: 1n };
  const factor = gcd(abs(n), abs(d));
  n = (d < 0n ? -n : n) / factor;
  d = abs(d) / factor;
  if (abs(n) >= LIMIT || d >= LIMIT) return undefined;
  return { numerator: n, denominator: d, symbol };
}

export function exactLiteral(raw: string): ExactValue | undefined {
  const [mantissa, exponent = '0'] = raw.toLowerCase().split('e');
  const [integer, decimals = ''] = mantissa.split('.');
  const shift = Number(exponent) - decimals.length;
  if (Math.abs(shift) > 60 || integer.length + decimals.length > 60) return undefined;
  const n = BigInt(integer + decimals);
  return shift >= 0 ? exact(n * 10n ** BigInt(shift)) : exact(n, 10n ** BigInt(-shift));
}

function root(n: bigint, d: bigint): ExactValue | undefined {
  if (n === 0n) return exact(0n);
  if (n < 0n || n * d > 1_000_000n) return undefined;
  let rem = Number(n * d);
  let outside = 1n;
  for (let i = 2; i * i <= rem; i++) {
    while (rem % (i * i) === 0) {
      rem /= i * i;
      outside *= BigInt(i);
    }
  }
  return exact(outside, d, rem === 1 ? undefined : rem);
}

export function exactRoot(value?: ExactValue): ExactValue | undefined {
  return value && value.symbol === undefined ? root(value.numerator, value.denominator) : undefined;
}

export function exactAdd(a: ExactValue | undefined, b: ExactValue | undefined, sign = 1n): ExactValue | undefined {
  if (!a || !b) return undefined;
  if (!a.numerator) return exact(b.numerator * sign, b.denominator, b.symbol);
  if (!b.numerator) return a;
  if (a.symbol !== b.symbol) return undefined;
  return exact(a.numerator * b.denominator + sign * b.numerator * a.denominator, a.denominator * b.denominator, a.symbol);
}

export function exactMultiply(a: ExactValue | undefined, b: ExactValue | undefined, divide = false): ExactValue | undefined {
  if (!a || !b) return undefined;
  const n = a.numerator * (divide ? b.denominator : b.numerator);
  const d = a.denominator * (divide ? b.numerator : b.denominator);
  if (!d) return undefined;
  if (!n) return exact(0n);
  if (!b.symbol) return exact(n, d, a.symbol);
  if (divide && a.symbol === b.symbol) return exact(n, d);
  if (!divide && !a.symbol) return exact(n, d, b.symbol);
  if ((typeof a.symbol === 'number' || !a.symbol) && typeof b.symbol === 'number') {
    const product = divide ? root(BigInt(a.symbol || 1), BigInt(b.symbol)) : root(BigInt((a.symbol || 1) * b.symbol), 1n);
    if (product) return exact(n * product.numerator, d * product.denominator, product.symbol);
  }
  return undefined;
}

export function exactPower(base: ExactValue | undefined, exponent: ExactValue | undefined): ExactValue | undefined {
  if (!base || !exponent || exponent.symbol) return undefined;
  if (exponent.numerator === 1n && exponent.denominator === 2n) return exactRoot(base);
  if (exponent.denominator !== 1n || abs(exponent.numerator) > 32n) return undefined;
  let result = exact(1n);
  for (let n = 0n; n < abs(exponent.numerator) && result; n++) result = exactMultiply(result, base);
  return exponent.numerator < 0n ? exactMultiply(exact(1n), result, true) : result;
}

export function exactApproximation(value: ExactValue): number {
  const factor = value.symbol === 'pi' ? Math.PI : value.symbol ? Math.sqrt(value.symbol) : 1;
  return Number(value.numerator) / Number(value.denominator) * factor;
}
