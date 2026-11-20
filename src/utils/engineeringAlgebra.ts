import { ENGINEERING_EXPRESSION_LIMIT, EngineeringError, parseEngineeringExpression, type EngineeringExpression } from './engineeringCalculator';
import { exact, exactAdd, exactApproximation, exactLiteral, exactMultiply, exactPower, exactRoot, type ExactValue } from './engineeringExact';
import { solvePolynomial } from './engineeringAdvanced';
import type { ComplexValue } from './engineeringComplex';

export const POLYNOMIAL_MAX_DEGREE = 12;
export type AlgebraAction = 'simplify' | 'factor' | 'differentiate' | 'integrate' | 'solve';
export type Polynomial = ExactValue[]; // constant term first, no trailing zero terms
const ZERO = exact(0n)!;
const ONE = exact(1n)!;
const syntax = (message: string): never => { throw new EngineeringError('syntax', message); };
function bounded(value?: ExactValue): ExactValue {
  if (value && !value.symbol) return value;
  throw new EngineeringError('limit', 'Exact coefficients are outside the supported range.');
}
const negate = (a: ExactValue) => bounded(exact(-a.numerator, a.denominator));
const integer = (n: number) => exact(BigInt(n))!;
const trim = (a: Polynomial) => {
  while (a.length > 1 && !a.at(-1)!.numerator) a.pop();
  return a;
};
const sum = (a: Polynomial, b: Polynomial, sign = 1n): Polynomial => trim(Array.from({ length: Math.max(a.length, b.length) },
  (_, i) => bounded(exactAdd(a[i] ?? ZERO, b[i] ?? ZERO, sign))));
const multiply = (a: Polynomial, b: Polynomial): Polynomial => {
  if ((a.length === 1 && !a[0].numerator) || (b.length === 1 && !b[0].numerator)) return [ZERO];
  const len = a.length + b.length - 1;
  if (len > POLYNOMIAL_MAX_DEGREE + 1) throw new EngineeringError('limit', 'Polynomial degree exceeds 12.');
  const result = Array<ExactValue>(len).fill(ZERO);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    result[i + j] = bounded(exactAdd(result[i + j], bounded(exactMultiply(a[i], b[j]))));
  }
  return trim(result);
};

export function algebraInput(source: string): string {
  return source.trim().replace(/(?<![\p{L}_])(?:س|X)(?![\p{L}_])/gu, 'x').replace(/＝/g, '=');
}

/** Exact rational polynomials of one variable. Division by a variable is not cancelled: that could hide a hole. */
export function readEngineeringPolynomial(source: string): Polynomial {
  const build = (node: EngineeringExpression): Polynomial => {
    if (node.kind === 'number') return [bounded(exactLiteral(node.value))];
    if (node.kind === 'identifier' && /^x$/i.test(node.value)) return [ZERO, ONE];
    if (node.kind === 'unary' && (node.op === '-' || node.op === '%')) {
      return build(node.value).map((value) => node.op === '-' ? negate(value) : bounded(exactMultiply(value, integer(100), true)));
    }
    if (node.kind !== 'binary') return syntax('Use x and rational numbers in a polynomial.');
    const a = build(node.left);
    const b = build(node.right);
    switch (node.op) {
      case '+': return sum(a, b);
      case '-': return sum(a, b, -1n);
      case '*': return multiply(a, b);
      case '/': {
        if (b.length !== 1 || !b[0].numerator) return syntax('Divide only by a nonzero rational constant.');
        return a.map((value) => bounded(exactMultiply(value, b[0], true)));
      }
      case '^': {
        if (b.length !== 1 || b[0].denominator !== 1n || b[0].numerator > BigInt(POLYNOMIAL_MAX_DEGREE)) return syntax('Use a whole-number power up to 12.');
        const exp = b[0].numerator;
        if (exp < 0n) {
          if (a.length !== 1 || !a[0].numerator || exp < -12n) return syntax('Negative powers require a nonzero rational constant.');
          return [bounded(exactPower(a[0], b[0]))];
        }
        let product = [ONE];
        for (let i = 0n; i < exp; i++) product = multiply(product, a);
        return product;
      }
      default: return syntax('This operation is not polynomial algebra.');
    }
  };
  return build(parseEngineeringExpression(algebraInput(source)));
}

export function exactExpression(value: ExactValue): string {
  const sym = value.symbol === 'pi' ? 'pi' : value.symbol ? `sqrt(${value.symbol})` : '';
  const n = sym && value.numerator === 1n ? sym : sym && value.numerator === -1n ? `-${sym}` : sym ? `${value.numerator}*${sym}` : String(value.numerator);
  return value.denominator === 1n ? n : `${n}/${value.denominator}`;
}

export function polynomialExpression(values: Polynomial): string {
  const terms: string[] = [];
  for (let i = values.length - 1; i >= 0; i--) {
    const c = values[i];
    if (!c.numerator) continue;
    const a = c.numerator < 0n ? negate(c) : c;
    const variable = i === 1 ? 'x' : i > 1 ? `x^${i}` : '';
    const factor = exactExpression(a);
    const body = !variable ? factor : a.numerator === a.denominator ? variable : `${factor}*${variable}`;
    terms.push(`${c.numerator < 0n ? terms.length ? ' - ' : '-' : terms.length ? ' + ' : ''}${body}`);
  }
  return terms.join('') || '0';
}

function squareRootInteger(n: bigint): bigint | undefined {
  if (n < 0n) return undefined;
  if (n <= 1n) return n;
  let r = 1n << BigInt(Math.ceil(n.toString(2).length / 2));
  while (true) {
    const next = (r + n / r) / 2n;
    if (next >= r) return r * r === n ? r : undefined;
    r = next;
  }
}
function squareRootRational(value: ExactValue): ExactValue | undefined {
  const n = squareRootInteger(value.numerator);
  const d = squareRootInteger(value.denominator);
  return n === undefined || d === undefined ? undefined : exact(n, d);
}
const discriminantOf = ([c, b, a]: Polynomial) => bounded(exactAdd(bounded(exactMultiply(b, b)),
  bounded(exactMultiply(integer(4), bounded(exactMultiply(a, c)))), -1n));
const denominatorOf = (a: ExactValue) => bounded(exactMultiply(integer(2), a));

export interface AlgebraRoot { value: ComplexValue; exact?: string }
export type AlgebraSolution = {
  polynomial: string;
  degree: number;
  discriminant?: string;
  kind: 'identity' | 'inconsistent' | 'roots';
  roots: AlgebraRoot[];
};

export function solveEngineeringAlgebra(source: string): AlgebraSolution {
  if (source.length > ENGINEERING_EXPRESSION_LIMIT) return syntax('Equation is too long.');
  const sides = algebraInput(source).split('=');
  if (sides.length > 2) return syntax('Use at most one equals sign.');
  const p = sum(readEngineeringPolynomial(sides[0]), readEngineeringPolynomial(sides[1] ?? '0'), -1n);
  const degree = p.length - 1;
  const base = { polynomial: polynomialExpression(p), degree };
  if (!degree) return { ...base, kind: p[0].numerator ? 'inconsistent' : 'identity', roots: [] };
  if (degree === 1) {
    const x = bounded(exactMultiply(negate(p[0]), p[1], true));
    return { ...base, kind: 'roots', roots: [{ value: { re: exactApproximation(x), im: 0 }, exact: exactExpression(x) }] };
  }
  if (degree > 4) throw new EngineeringError('limit', 'Equation solving supports degree 1–4.');
  if (degree === 2) {
    const [, b, a] = p;
    const delta = discriminantOf(p);
    const denominator = denominatorOf(a);
    const rational = squareRootRational(delta);
    if (rational) {
      const roots = (delta.numerator ? [-1n, 1n] : [1n]).map((sign) => {
        const x = bounded(exactMultiply(bounded(exactAdd(negate(b), rational, sign)), denominator, true));
        return { value: { re: exactApproximation(x), im: 0 }, exact: exactExpression(x) };
      }).sort((a, b) => a.value.re - b.value.re);
      return { ...base, kind: 'roots', discriminant: exactExpression(delta), roots };
    }
    const magnitude = delta.numerator < 0n ? negate(delta) : delta;
    const radical = exactRoot(magnitude);
    const real = bounded(exactMultiply(negate(b), denominator, true));
    const scale = bounded(exactMultiply(ONE, denominator, true));
    const mag = Math.sqrt(exactApproximation(magnitude)) * Math.abs(exactApproximation(scale));
    const scaled = radical && exactMultiply(radical, scale.numerator < 0n ? negate(scale) : scale);
    const symbol = scaled ? exactExpression(scaled) : `sqrt(${exactExpression(magnitude)})/(${exactExpression(denominator.numerator < 0n ? negate(denominator) : denominator)})`;
    const complex = delta.numerator < 0n;
    const center = exactApproximation(real);
    const largeSign = center < 0 ? -1 : 1;
    const large = center + largeSign * mag;
    const roots = [-1, 1].map((sign) => ({
      value: { re: complex ? center : sign === largeSign ? large : (exactApproximation(p[0]) / exactApproximation(a)) / large, im: complex ? sign * mag : 0 },
      exact: `${exactExpression(real)} ${sign === 1 ? '+' : '-'} (${symbol})${complex ? '*i' : ''}`,
    }));
    return { ...base, kind: 'roots', discriminant: exactExpression(delta), roots };
  }
  return { ...base, kind: 'roots', roots: solvePolynomial([...p].reverse().map(exactApproximation)).map((value) => ({ value })) };
}

export interface AlgebraTransform { original: string; result: string; changed?: boolean }
export function transformEngineeringAlgebra(source: string, action: Exclude<AlgebraAction, 'solve'>): AlgebraTransform {
  const p = readEngineeringPolynomial(source);
  const original = polynomialExpression(p);
  if (action === 'simplify') return { original, result: original };
  if (action === 'differentiate') return { original, result: polynomialExpression(p.length < 2 ? [ZERO] : p.slice(1).map((v, i) => bounded(exactMultiply(v, integer(i + 1))))) };
  if (action === 'integrate') {
    const body = polynomialExpression([ZERO, ...p.map((v, i) => bounded(exactMultiply(v, integer(i + 1), true)))]);
    return { original, result: body === '0' ? 'C' : `${body} + C` };
  }
  const degree = p.length - 1;
  if (degree !== 2) return { original, result: original, changed: false };
  const a = p[2];
  const delta = squareRootRational(discriminantOf(p));
  if (!delta) return { original, result: original, changed: false };
  const b = negate(p[1]);
  const d = denominatorOf(a);
  const factors = [-1n, 1n].map((sign) => bounded(exactMultiply(bounded(exactAdd(b, delta, sign)), d, true)))
    .map((root) => `(${polynomialExpression([negate(root), ONE])})`);
  const lead = a.numerator === 1n && a.denominator === 1n ? '' : `${exactExpression(a)}*`;
  return { original, result: `${lead}${factors.join('*')}`, changed: true };
}
