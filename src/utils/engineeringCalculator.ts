import { toLatinDigits } from '../لغات/numerals';
import {
  addComplex, complex, divideComplex, magnitude, multiplyComplex, powerComplex, sqrtComplex, subtractComplex,
  type ComplexValue,
} from './engineeringComplex';
import {
  exact, exactAdd, exactApproximation, exactLiteral, exactMultiply, exactPower, exactRoot, type ExactValue,
} from './engineeringExact';

export type AngleMode = 'DEG' | 'RAD' | 'GRAD';
export const ENGINEERING_EXPRESSION_LIMIT = 240;
export const ENGINEERING_VARIABLES = ['A', 'B', 'C', 'D', 'E', 'F', 'x', 'y', 'z'] as const;
export type EngineeringVariable = typeof ENGINEERING_VARIABLES[number];
export type EngineeringFunctions = Partial<Record<'f' | 'g', string>>;
export interface EngineeringValue extends ComplexValue { exact?: ExactValue }

export interface EvaluateOptions {
  angleMode?: AngleMode;
  answer?: number | EngineeringValue;
  variables?: Partial<Record<EngineeringVariable, number | EngineeringValue>>;
  functions?: EngineeringFunctions;
  complex?: boolean;
  /** Additional real constants in the spreadsheet (cell references). No functions or code are resolved. */
  cell?: (name: string) => number | undefined;
}

export class EngineeringError extends Error {
  constructor(public readonly kind: 'syntax' | 'math' | 'limit', message: string) { super(message); }
}

const syntax = (message: string): never => { throw new EngineeringError('syntax', message); };
const domain = (message: string): never => { throw new EngineeringError('math', message); };
const limit = (message: string): never => { throw new EngineeringError('limit', message); };
const finite = (value: number): number => Number.isFinite(value) ? value : domain('Result is outside the supported numeric range.');

interface Token {
  kind: 'number' | 'identifier' | 'operator' | 'left' | 'right' | 'comma';
  value: string;
}

type Expression =
  | { kind: 'number' | 'identifier'; value: string }
  | { kind: 'unary'; op: string; value: Expression }
  | { kind: 'binary'; op: string; left: Expression; right: Expression }
  | { kind: 'call'; name: string; args: Expression[] };

const NUMBER = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;
const IDENTIFIER = /^[a-zA-Z_][a-zA-Z_0-9]*/;

export function normalizeEngineeringInput(source: string): string {
  return toLatinDigits(source).replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-')
    .replace(/π/g, 'pi').replace(/√/g, 'sqrt').replace(/²/g, '^2').replace(/³/g, '^3')
    .replace(/٫/g, '.').replace(/،/g, ',').replace(/[\u061c\u200e\u200f]/g, '');
}

function tokenize(source: string): Token[] {
  if (source.length > ENGINEERING_EXPRESSION_LIMIT) limit('Expression is too long.');
  const normalized = normalizeEngineeringInput(source);
  if (!normalized.trim()) syntax('Enter an expression.');
  const tokens: Token[] = [];
  for (let index = 0; index < normalized.length;) {
    const char = normalized[index];
    if (/\s/.test(char)) { index++; continue; }
    const rest = normalized.slice(index);
    const number = rest.match(NUMBER)?.[0];
    if (number) {
      if (tokens.at(-1)?.kind === 'number') syntax('Separate adjacent numbers with an operator.');
      tokens.push({ kind: 'number', value: number });
      index += number.length;
      continue;
    }
    const identifier = rest.match(IDENTIFIER)?.[0];
    if (identifier) {
      tokens.push({ kind: 'identifier', value: identifier });
      index += identifier.length;
      continue;
    }
    if ('+-*/^%!'.includes(char)) tokens.push({ kind: 'operator', value: char });
    else if (char === '(') tokens.push({ kind: 'left', value: char });
    else if (char === ')') tokens.push({ kind: 'right', value: char });
    else if (char === ',') tokens.push({ kind: 'comma', value: char });
    else syntax(`Unsupported character: ${char}`);
    index++;
  }
  return tokens;
}

function parseExpression(source: string): Expression {
  const tokens = tokenize(source);
  let cursor = 0;
  const peek = () => tokens[cursor];
  const take = () => tokens[cursor++];
  const operator = (value: string) => peek()?.kind === 'operator' && peek().value === value && Boolean(take());
  const rightParen = () => {
    if (peek()?.kind !== 'right') syntax('Missing closing parenthesis.');
    take();
  };
  const binary = (op: string, left: Expression, right: Expression): Expression => ({ kind: 'binary', op, left, right });
  const parseAdd = (): Expression => {
    let value = parseMultiply();
    while (peek()?.kind === 'operator' && (peek().value === '+' || peek().value === '-')) value = binary(take().value, value, parseMultiply());
    return value;
  };
  const parseImplied = (): Expression => {
    let value = parseUnary();
    while (['number', 'identifier', 'left'].includes(peek()?.kind || '') && peek()?.value.toLowerCase() !== 'mod') {
      value = binary('*', value, parseUnary());
    }
    return value;
  };
  const parseMultiply = (): Expression => {
    let value = parseImplied();
    while (true) {
      if (operator('*')) value = binary('*', value, parseImplied());
      else if (operator('/')) value = binary('/', value, parseImplied());
      else if (peek()?.kind === 'identifier' && peek().value.toLowerCase() === 'mod') { take(); value = binary('mod', value, parseImplied()); }
      else return value;
    }
  };
  const parseUnary = (): Expression => {
    if (operator('+')) return parseUnary();
    if (operator('-')) return { kind: 'unary', op: '-', value: parseUnary() };
    let base = parsePrimary();
    while (peek()?.kind === 'operator' && (peek().value === '!' || peek().value === '%')) {
      base = { kind: 'unary', op: take().value, value: base };
    }
    return operator('^') ? binary('^', base, parseUnary()) : base;
  };
  const parsePrimary = (): Expression => {
    const token = take();
    if (!token) return syntax('Expression is incomplete.');
    if (token.kind === 'number') return { kind: 'number', value: token.value };
    if (token.kind === 'left') {
      const node = parseAdd();
      rightParen();
      return node;
    }
    if (token.kind !== 'identifier') return syntax('Expected a number, constant, or function.');
    // Known values followed by parentheses may be multiplied: x(x+1), π(2), A(2).
    const variable = ENGINEERING_VARIABLES.includes(token.value as EngineeringVariable);
    const name = token.value.toLowerCase();
    const constant = (name !== 'g' && Object.hasOwn(ENGINEERING_CONSTANT_VALUES, name)) || ['ans', 'i', 'pi', 'e'].includes(name);
    if (peek()?.kind !== 'left' || variable || constant) return { kind: 'identifier', value: token.value };
    take();
    const args: Expression[] = [];
    if (peek()?.kind !== 'right') {
      args.push(parseAdd());
      while (peek()?.kind === 'comma') { take(); args.push(parseAdd()); }
    }
    rightParen();
    return { kind: 'call', name, args };
  };
  const result = parseAdd();
  if (cursor !== tokens.length) syntax('Check the operator or parentheses.');
  return result;
}

/** Selected SI/CODATA constants; identifiers are also the keys accepted by the parser. */
export const ENGINEERING_CONSTANTS = [
  ['c', 'c', 299_792_458, 'm/s'], ['g', 'g₀', 9.80665, 'm/s²'], ['R', 'R', 8.314462618, 'J/(mol·K)'],
  ['NA', 'Nₐ', 6.02214076e23, 'mol⁻¹'], ['h', 'h', 6.62607015e-34, 'J·s'], ['hbar', 'ℏ', 1.054571817e-34, 'J·s'],
  ['qe', 'e₀', 1.602176634e-19, 'C'], ['kB', 'kᵦ', 1.380649e-23, 'J/K'], ['Ggrav', 'G', 6.67430e-11, 'm³/(kg·s²)'],
  ['me', 'mₑ', 9.1093837139e-31, 'kg'], ['mp', 'mₚ', 1.67262192595e-27, 'kg'], ['mn', 'mₙ', 1.67492750056e-27, 'kg'],
  ['amu', 'u', 1.66053906892e-27, 'kg'], ['eps0', 'ε₀', 8.8541878188e-12, 'F/m'], ['mu0', 'μ₀', 1.25663706127e-6, 'N/A²'],
  ['Fconst', 'F', 96_485.33212, 'C/mol'], ['sigmaSB', 'σ', 5.670374419e-8, 'W/(m²·K⁴)'], ['a0', 'a₀', 5.29177210544e-11, 'm'],
  ['alpha', 'α', 7.2973525643e-3, ''], ['Rydberg', 'R∞', 1.0973731568157e7, 'm⁻¹'], ['atm', 'atm', 101_325, 'Pa'],
] as const;
const ENGINEERING_CONSTANT_VALUES: Record<string, number> = {
  ...Object.fromEntries(ENGINEERING_CONSTANTS.map(([name, , value]) => [name.toLowerCase(), value])),
  gravity: 9.80665, gasconstant: 8.314462618, avogadro: 6.02214076e23, planck: 6.62607015e-34,
  tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2,
};

export const radiansPerUnit = (mode: AngleMode) => mode === 'DEG' ? Math.PI / 180 : mode === 'GRAD' ? Math.PI / 200 : 1;

/** Preserve exact values at common quadrantal / textbook angles without rounding unrelated small numbers to zero. */
function trig(name: string, x: number, mode: AngleMode): EngineeringValue {
  const quarter = mode === 'DEG' ? 90 : mode === 'GRAD' ? 100 : Math.PI / 2;
  const cycle = x % (4 * quarter);
  const sine = (angle: number): EngineeringValue => {
    const reduced = angle % (4 * quarter);
    const turn = Math.abs(reduced);
    const quadrant = Math.floor(turn / quarter);
    const acute = quadrant % 2 ? (quadrant + 1) * quarter - turn : turn - quadrant * quarter;
    const sign = (quadrant >= 2) !== (reduced < 0) ? -1n : 1n;
    const match = [[0, 0n, 1n], [1 / 3, 1n, 2n], [1 / 2, 1n, 2n, 2], [2 / 3, 1n, 2n, 3], [1, 1n, 1n]] as const;
    const special = match.find(([ratio]) => acute === quarter * ratio || (ratio !== 0 && Math.abs(acute / quarter - ratio) < 5e-16));
    const precise = special && exact(sign * special[1], special[2], special[3]);
    return { ...complex(precise ? exactApproximation(precise) : Math.sin(angle * radiansPerUnit(mode))), exact: precise };
  };
  if (name === 'sin') return sine(cycle);
  const shifted = sine(quarter - Math.abs(cycle));
  if (name === 'cos') return shifted.exact ? shifted : complex(Math.cos(cycle * radiansPerUnit(mode)));
  if (shifted.re === 0) return domain('Tangent is undefined at this angle.');
  const s = sine(cycle);
  return { ...complex(s.re / shifted.re), exact: exactMultiply(s.exact, shifted.exact, true) };
}

function factorial(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 170) return domain('Factorial needs an integer from 0 to 170.');
  let result = 1;
  for (let n = 2; n <= value; n++) result *= n;
  return result;
}

function combination(n: number, r: number, permutation: boolean): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || n > 170 || r > n) {
    return domain('nCr and nPr need integers with 0 ≤ r ≤ n ≤ 170.');
  }
  const count = permutation ? r : Math.min(r, n - r);
  let result = 1n;
  for (let i = 1; i <= count; i++) {
    result *= BigInt(n - i + 1);
    if (!permutation) result /= BigInt(i);
  }
  return Number(result);
}

function adaptiveIntegral(fn: (x: number) => number, a: number, b: number): number {
  if (a === b) return 0;
  if (a > b) return -adaptiveIntegral(fn, b, a);
  const simpson = (size: number, lo: number, mid: number, hi: number) => size * (lo / 6 + mid * (2 / 3) + hi / 6);
  function refine(lo: number, hi: number, fa: number, fm: number, fb: number, previous: number, tolerance: number, depth: number): number {
    const mid = lo + (hi - lo) / 2;
    const left = fn(lo + (mid - lo) / 2);
    const right = fn(mid + (hi - mid) / 2);
    const first = simpson(mid - lo, fa, left, fm);
    const second = simpson(hi - mid, fm, right, fb);
    const delta = finite((first + second) - previous);
    if (Math.abs(delta) <= 15 * tolerance) return first + second + delta / 15;
    if (depth <= 0) return limit('The integral did not converge on this interval.');
    return refine(lo, mid, fa, left, fm, first, tolerance / 2, depth - 1) + refine(mid, hi, fm, right, fb, second, tolerance / 2, depth - 1);
  }
  // Start with several subintervals so the first few samples do not all alias to the same phase as often.
  let total = 0;
  const span = finite(b - a);
  for (let i = 0; i < 8; i++) {
    const lo = a + span * i / 8;
    const hi = i === 7 ? b : a + span * (i + 1) / 8;
    const fa = fn(lo);
    const fb = fn(hi);
    const fm = fn(lo + (hi - lo) / 2);
    const whole = finite(simpson(hi - lo, fa, fm, fb));
    total += refine(lo, hi, fa, fm, fb, whole, 1e-11 + Math.abs(whole) * 1e-10, 18);
  }
  return total;
}

function evaluate(node: Expression, options: EvaluateOptions): EngineeringValue {
  const mode = options.angleMode ?? 'DEG';
  const radians = radiansPerUnit(mode);
  const functionCache = new Map<'f' | 'g', Expression>();
  let budget = 100_000;
  // Exact arithmetic is useful for interactive results, but not inside thousands of numeric samples.
  const real = (z: ComplexValue) => z.im === 0 ? finite(z.re) : domain('This operation needs real numbers.');
  const numeric = (n: number, withExact = true): EngineeringValue => ({ re: finite(n), im: 0, exact: withExact && Number.isSafeInteger(n) ? exact(BigInt(n)) : undefined });
  const stored = (z: number | EngineeringValue | undefined): EngineeringValue => typeof z === 'number' || z === undefined ? numeric(z ?? 0) : z;
  const checked = (z: EngineeringValue): EngineeringValue => {
    if (!Number.isFinite(z.im) || (!z.exact && !Number.isFinite(z.re))) return domain('The result is undefined or outside the numeric range.');
    if (!options.complex && z.im !== 0) return domain('Open Complex mode for imaginary results.');
    if (z.exact) return { ...z, re: finite(exactApproximation(z.exact)) };
    return { re: finite(z.re) || 0, im: finite(z.im) || 0 };
  };

  function visit(tree: Expression, x?: number, depth = 0, withExact = true): EngineeringValue {
    if (--budget < 0 || depth > 8) return limit('Calculation exceeded its work limit.');
    const child = (sub: Expression) => visit(sub, x, depth, withExact);
    if (tree.kind === 'number') return { ...complex(finite(Number(tree.value))), exact: withExact ? exactLiteral(tree.value) : undefined };
    if (tree.kind === 'identifier') {
      const id = tree.value;
      const lower = id.toLowerCase();
      if (lower === 'ans') return checked(stored(options.answer));
      if (id === 'x' && x !== undefined) return numeric(x, withExact);
      if (options.variables && ENGINEERING_VARIABLES.includes(id as EngineeringVariable)) return checked(stored(options.variables[id as EngineeringVariable]));
      if (options.cell) {
        const value = options.cell(id);
        if (value !== undefined) return numeric(value, withExact);
      }
      if (lower === 'pi') return { ...complex(Math.PI), exact: withExact ? exact(1n, 1n, 'pi') : undefined };
      if (lower === 'e') return complex(Math.E);
      if (lower === 'i' && options.complex) return complex(0, 1);
      if (Object.hasOwn(ENGINEERING_CONSTANT_VALUES, lower)) return complex(ENGINEERING_CONSTANT_VALUES[lower]);
      if (ENGINEERING_VARIABLES.includes(id as EngineeringVariable)) return numeric(0, withExact);
      return syntax(`Unknown constant: ${id}`);
    }
    if (tree.kind === 'unary') {
      const a = child(tree.value);
      if (tree.op === '!') return numeric(factorial(real(a)), withExact);
      if (tree.op === '%') return checked({ ...divideComplex(a, complex(100)), exact: withExact ? exactMultiply(a.exact, exact(100n), true) : undefined });
      return checked({ re: -a.re, im: -a.im, exact: withExact && a.exact ? exact(-a.exact.numerator, a.exact.denominator, a.exact.symbol) : undefined });
    }
    if (tree.kind === 'binary') {
      const a = child(tree.left);
      const b = child(tree.right);
      const ae = withExact ? a.exact : undefined;
      const be = withExact ? b.exact : undefined;
      switch (tree.op) {
        case '+': return checked({ ...addComplex(a, b), exact: exactAdd(ae, be) });
        case '-': return checked({ ...subtractComplex(a, b), exact: exactAdd(ae, be, -1n) });
        case '*': return checked({ ...multiplyComplex(a, b), exact: exactMultiply(ae, be) });
        case '/':
          if (!b.re && !b.im) return domain('Cannot divide by zero.');
          return checked({ ...divideComplex(a, b), exact: exactMultiply(ae, be, true) });
        case '^': return checked({ ...(options.complex ? powerComplex(a, b) : complex(real(a) ** real(b))), exact: exactPower(ae, be) });
        default: return numeric(real(a) % real(b), withExact);
      }
    }
    if (tree.kind !== 'call') return syntax('Invalid expression.');
    const { name, args } = tree;
    const arity = (expected: number) => { if (args.length !== expected) syntax(`${name} expects ${expected} argument(s).`); };
    if (name === 'integral' || name === 'deriv' || name === 'sumx' || name === 'prodx') {
      arity(name === 'deriv' ? 2 : 3);
      const fn = (point: number) => real(visit(args[0], point, depth + 1, false));
      const a = real(child(args[1]));
      if (name === 'deriv') {
        const h = Math.max(1, Math.abs(a)) * 0.0001;
        const slope = (step: number) => (fn(a + step) - fn(a - step)) / (2 * step);
        const fine = slope(h / 2);
        const coarse = slope(h);
        if (Math.abs(fine - coarse) > 1e-4 * Math.max(1, Math.abs(fine))) domain('The derivative did not converge near this point.');
        // Reject a corner/jump even when the two symmetric slopes happen to agree (e.g. |x| at zero).
        const center = fn(a);
        const sideMismatch = (step: number) => ((fn(a + step) - center) - (center - fn(a - step))) / step;
        if (Math.abs(2 * sideMismatch(h / 2) - sideMismatch(h)) > 1e-4 * Math.max(1, Math.abs(fine))) domain('The derivative does not exist at this point.');
        return numeric((4 * fine - coarse) / 3, false);
      }
      const b = real(child(args[2]));
      if (name === 'integral') return numeric(adaptiveIntegral(fn, a, b), false);
      if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || b < a || b - a >= 1000) return limit('Use increasing integer bounds with at most 1,000 terms.');
      let total = name === 'sumx' ? 0 : 1;
      for (let i = 0; i <= b - a; i++) total = finite(name === 'sumx' ? total + fn(a + i) : total * fn(a + i));
      return numeric(total, withExact);
    }
    if (name === 'f' || name === 'g') {
      arity(1);
      const source = options.functions?.[name];
      if (!source) return syntax(`Define ${name}(x) first.`);
      if (!functionCache.has(name)) functionCache.set(name, parseExpression(source));
      return visit(functionCache.get(name)!, real(child(args[0])), depth + 1, withExact);
    }
    const values = args.map(child);
    const one = (fn: (value: number) => number) => { arity(1); return numeric(fn(real(values[0])), withExact); };
    const two = (fn: (a: number, b: number) => number) => { arity(2); return numeric(fn(real(values[0]), real(values[1])), withExact); };
    switch (name) {
      case 'sin': case 'cos': case 'tan': arity(1); return checked(trig(name, real(values[0]), mode));
      case 'asin': return one((x) => Math.asin(x) / radians);
      case 'acos': return one((x) => Math.acos(x) / radians);
      case 'atan': return one((x) => Math.atan(x) / radians);
      case 'atan2': return two((y, x) => Math.atan2(y, x) / radians);
      case 'sinh': return one(Math.sinh);
      case 'cosh': return one(Math.cosh);
      case 'tanh': return one(Math.tanh);
      case 'asinh': return one(Math.asinh);
      case 'acosh': return one(Math.acosh);
      case 'atanh': return one(Math.atanh);
      case 'sqrt':
        arity(1);
        return checked({ ...(options.complex ? sqrtComplex(values[0]) : complex(Math.sqrt(real(values[0])))), exact: withExact ? exactRoot(values[0].exact) : undefined });
      case 'cbrt': return one(Math.cbrt);
      case 'abs': arity(1); return numeric(magnitude(values[0]), withExact);
      case 'conj': arity(1); return checked(complex(values[0].re, -values[0].im));
      case 'arg': arity(1); return numeric((values[0].re || values[0].im) ? Math.atan2(values[0].im, values[0].re) / radians : domain('Zero has no argument.'), false);
      case 're': arity(1); return numeric(values[0].re, withExact);
      case 'im': arity(1); return numeric(values[0].im, withExact);
      case 'rect': {
        arity(2);
        const radius = real(values[0]);
        const angle = real(values[1]);
        return checked(complex(radius * trig('cos', angle, mode).re, radius * trig('sin', angle, mode).re));
      }
      case 'floor': return one(Math.floor);
      case 'ceil': return one(Math.ceil);
      case 'round': return one(Math.round);
      case 'trunc': return one(Math.trunc);
      case 'sign': return one(Math.sign);
      case 'ln': return one(Math.log);
      case 'log': return args.length === 1 ? one(Math.log10) : two((x, base) => x > 0 && base > 0 && base !== 1 ? Math.log(x) / Math.log(base) : domain('Logarithm needs a positive value and a positive base other than 1.'));
      case 'log2': return one(Math.log2);
      case 'exp': return one(Math.exp);
      case 'fact': return one(factorial);
      case 'pow':
        arity(2);
        return checked({ ...(options.complex ? powerComplex(values[0], values[1]) : complex(real(values[0]) ** real(values[1]))), exact: withExact ? exactPower(values[0].exact, values[1].exact) : undefined });
      case 'root': return two((x, n) => n === 0 ? NaN : x < 0 && Number.isInteger(n) && Math.abs(n % 2) === 1 ? -((-x) ** (1 / n)) : x ** (1 / n));
      case 'mod': return two((x, y) => x % y);
      case 'ncr': return two((n, r) => combination(n, r, false));
      case 'npr': return two((n, r) => combination(n, r, true));
      case 'gcd': case 'lcm': return two((a, b) => {
        if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) return domain('GCD and LCM need whole numbers.');
        let d = Math.abs(a);
        let rem = Math.abs(b);
        while (rem) [d, rem] = [rem, d % rem];
        if (name === 'gcd') return d;
        const multiple = d ? Math.abs((a / d) * b) : 0;
        return Number.isSafeInteger(multiple) ? multiple : limit('LCM is too large to represent exactly.');
      });
      case 'dms': arity(3); {
        const [d, m, s] = values.map(real);
        if (!Number.isInteger(d) || !Number.isInteger(m) || m < 0 || m >= 60 || s < 0 || s >= 60) return domain('Use whole degrees and minutes, with minutes and seconds below 60.');
        const signedZero = !d && args[0].kind === 'unary' && args[0].op === '-';
        return numeric(d + (d < 0 || signedZero ? -1 : 1) * (m / 60 + s / 3600), false);
      }
      case 'rand': arity(0); return numeric(Math.random(), false);
      case 'randint': return two((lo, hi) => Number.isSafeInteger(lo) && Number.isSafeInteger(hi) && hi >= lo && hi - lo <= 1e9 ? lo + Math.floor(Math.random() * (hi - lo + 1)) : domain('Use ordered integer bounds no more than 1,000,000,000 apart.'));
      case 'min': case 'max': case 'sum': case 'avg': case 'hypot': {
        if (!args.length) return syntax(`${name} needs at least one value.`);
        const data = values.map(real);
        const sum = () => data.reduce((a, b) => a + b, 0);
        return numeric(name === 'min' ? Math.min(...data) : name === 'max' ? Math.max(...data)
          : name === 'hypot' ? Math.hypot(...data) : name === 'sum' ? sum() : sum() / data.length, withExact);
      }
      default: return syntax(`Unknown function: ${name}`);
    }
  }
  return checked(visit(node));
}

/** Parses math as data. A compiled expression can be sampled repeatedly; it never executes JavaScript. */
export function compileEngineeringExpression(source: string): (options?: EvaluateOptions) => EngineeringValue {
  const node = parseExpression(source);
  return (options = {}) => evaluate(node, options);
}

export function evaluateEngineeringValue(source: string, options: EvaluateOptions = {}): EngineeringValue {
  return compileEngineeringExpression(source)(options);
}

export function evaluateEngineeringExpression(source: string, options: Omit<EvaluateOptions, 'complex'> = {}): number {
  return evaluateEngineeringValue(source, { ...options, complex: false }).re;
}

export type EngineeringUnitCategory = 'length' | 'area' | 'volume' | 'mass' | 'temperature' | 'pressure' | 'speed' | 'energy' | 'power' | 'voltage' | 'current' | 'resistance' | 'frequency';

export const ENGINEERING_UNITS: Record<EngineeringUnitCategory, readonly string[]> = {
  length: ['m', 'km', 'cm', 'mm', 'µm', 'in', 'ft', 'yd', 'mi'],
  area: ['m²', 'km²', 'cm²', 'mm²', 'ft²', 'acre'],
  volume: ['L', 'mL', 'm³', 'gal US', 'cup US'],
  mass: ['kg', 'g', 'mg', 't', 'lb', 'oz'],
  temperature: ['°C', '°F', 'K'],
  pressure: ['Pa', 'kPa', 'MPa', 'bar', 'atm', 'psi'],
  speed: ['m/s', 'km/h', 'mph', 'knot'],
  energy: ['J', 'kJ', 'Wh', 'kWh', 'cal', 'kcal'],
  power: ['W', 'kW', 'MW', 'hp'],
  voltage: ['V', 'mV', 'kV'],
  current: ['A', 'mA', 'µA'],
  resistance: ['Ω', 'kΩ', 'MΩ'],
  frequency: ['Hz', 'kHz', 'MHz', 'GHz'],
};

const FACTORS: Partial<Record<EngineeringUnitCategory, Record<string, number>>> = {
  length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, 'µm': 1e-6, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 },
  area: { 'm²': 1, 'km²': 1e6, 'cm²': 1e-4, 'mm²': 1e-6, 'ft²': 0.09290304, acre: 4046.8564224 },
  volume: { L: 1, mL: 0.001, 'm³': 1000, 'gal US': 3.785411784, 'cup US': 0.2365882365 },
  mass: { kg: 1, g: 0.001, mg: 1e-6, t: 1000, lb: 0.45359237, oz: 0.028349523125 },
  pressure: { Pa: 1, kPa: 1000, MPa: 1e6, bar: 1e5, atm: 101325, psi: 6894.757293168 },
  speed: { 'm/s': 1, 'km/h': 1 / 3.6, mph: 0.44704, knot: 0.514444444444 },
  energy: { J: 1, kJ: 1000, Wh: 3600, kWh: 3.6e6, cal: 4.184, kcal: 4184 },
  power: { W: 1, kW: 1e3, MW: 1e6, hp: 745.699872 },
  voltage: { V: 1, mV: 1e-3, kV: 1e3 },
  current: { A: 1, mA: 1e-3, 'µA': 1e-6 },
  resistance: { 'Ω': 1, 'kΩ': 1e3, 'MΩ': 1e6 },
  frequency: { Hz: 1, kHz: 1e3, MHz: 1e6, GHz: 1e9 },
};

export function convertEngineeringUnit(value: number, category: EngineeringUnitCategory, from: string, to: string): number {
  if (!Number.isFinite(value)) throw new Error('Enter a finite number.');
  if (!Object.hasOwn(ENGINEERING_UNITS, category) || !ENGINEERING_UNITS[category].includes(from) || !ENGINEERING_UNITS[category].includes(to)) throw new Error('Unsupported unit conversion.');
  if (from === to) return value;
  if (category === 'temperature') {
    const kelvin = from === '°C' ? value + 273.15 : from === '°F' ? (value + 459.67) * 5 / 9 : value;
    const result = to === '°C' ? kelvin - 273.15 : to === '°F' ? kelvin * (9 / 5) - 459.67 : kelvin;
    return finite(result);
  }
  const factors = FACTORS[category];
  if (!factors || factors[from] === undefined || factors[to] === undefined) throw new Error('Unsupported unit conversion.');
  return finite(value * factors[from]! / factors[to]!);
}
