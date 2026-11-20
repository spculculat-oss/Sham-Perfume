import { toLatinDigits } from '../لغات/numerals';
import { compensatedSum, decimalRatio, differentiateNumerically, integrateNumerically } from './engineeringNumeric';
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
  /** Additional real values in the spreadsheet (cell references). No functions or code are resolved. */
  cell?: (name: string) => number | EngineeringValue | undefined;
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

export type EngineeringExpression =
  | { kind: 'number' | 'identifier'; value: string }
  | { kind: 'unary'; op: string; value: Expression }
  | { kind: 'binary'; op: string; left: Expression; right: Expression }
  | { kind: 'call'; name: string; args: Expression[] };

type Expression = EngineeringExpression;

const NUMBER = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eEᴇ][+-]?\d+)?/;
const IDENTIFIER = /^[a-zA-Z_][a-zA-Z_0-9]*/;

export function normalizeEngineeringInput(source: string): string {
  return toLatinDigits(source).replace(/[×·⋅]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-')
    // Keep adjacent π/i and π/number tokens distinct. Superscripts must remain postfix operators.
    .replace(/π/g, ' pi ').replace(/√(?=\s*\()/g, 'sqrt')
    .replace(/(?<![\p{L}_])س(?![\p{L}_])/gu, 'x')
    .replace(/٪/g, '%').replace(/٫/g, '.').replace(/،/g, ',').replace(/＝/g, '=')
    .replace(/[\u061c\u200e\u200f]/g, '');
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
      tokens.push({ kind: 'number', value: number.replace('ᴇ', 'e') });
      index += number.length;
      continue;
    }
    const identifier = rest.match(IDENTIFIER)?.[0];
    if (identifier) {
      tokens.push({ kind: 'identifier', value: identifier });
      index += identifier.length;
      continue;
    }
    if ('+-*/^%!²³√'.includes(char)) tokens.push({ kind: 'operator', value: char });
    else if (char === '(') tokens.push({ kind: 'left', value: char });
    else if (char === ')') tokens.push({ kind: 'right', value: char });
    else if (char === ',') tokens.push({ kind: 'comma', value: char });
    else syntax(`Unsupported character: ${char}`);
    index++;
  }
  return tokens;
}

const STANDARD_OPERATORS = '+-*/';

/** A desk calculator has one running total: fold only the four arithmetic keys in entry order. */
function parseStandardChain(source: string, preview = false): { tree: Expression; subtotal: boolean } {
  if (source.length > ENGINEERING_EXPRESSION_LIMIT) limit('Expression is too long.');
  const clean = source.trimEnd();
  const pastedEquals = /[=＝]$/.test(clean);
  const tokens = tokenize(pastedEquals ? clean.slice(0, -1) : clean);
  let index = 0;
  const operand = (): Expression => {
    const sign = tokens[index];
    const signed = sign?.kind === 'operator' && (sign.value === '+' || sign.value === '-');
    if (signed) index++;
    const token = tokens[index++];
    if (!token) return syntax('Enter a number after the operator.');
    if (token.kind !== 'number' && !(token.kind === 'identifier' && token.value.toLowerCase() === 'ans')) {
      return syntax('Standard mode uses numbers and +, −, ×, ÷. Use Scientific for formulas and parentheses.');
    }
    const value: Expression = token.kind === 'number' ? { kind: 'number', value: token.value } : { kind: 'identifier', value: 'Ans' };
    return signed && sign.value === '-' ? { kind: 'unary', op: '-', value } : value;
  };
  let tree = operand();
  while (index < tokens.length) {
    const operator = tokens[index++];
    if (operator.kind !== 'operator' || !STANDARD_OPERATORS.includes(operator.value)) {
      return syntax('Standard mode uses numbers and +, −, ×, ÷. Use Scientific for formulas and parentheses.');
    }
    if (preview && !pastedEquals && index === tokens.length) return { tree, subtotal: true };
    tree = { kind: 'binary', op: operator.value, left: tree, right: operand() };
  }
  return { tree, subtotal: false };
}

export function parseEngineeringExpression(source: string): EngineeringExpression {
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
    while ((['number', 'identifier', 'left'].includes(peek()?.kind || '') || peek()?.value === '√') && peek()?.value.toLowerCase() !== 'mod') {
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
    while (peek()?.kind === 'operator' && '!%²³'.includes(peek().value)) {
      const op = take().value;
      base = op === '²' || op === '³' ? binary('^', base, { kind: 'number', value: op === '²' ? '2' : '3' }) : { kind: 'unary', op, value: base };
    }
    return operator('^') ? binary('^', base, parseUnary()) : base;
  };
  const parsePrimary = (): Expression => {
    const token = take();
    if (!token) return syntax('Expression is incomplete.');
    if (token.kind === 'number') return { kind: 'number', value: token.value };
    if (token.kind === 'operator' && token.value === '√') return { kind: 'call', name: 'sqrt', args: [parsePrimary()] };
    if (token.kind === 'left') {
      const node = parseAdd();
      rightParen();
      return node;
    }
    if (token.kind !== 'identifier') return syntax('Expected a number, constant, or function.');
    // Known values followed by parentheses may be multiplied: x(x+1), π(2), A(2).
    const variable = ENGINEERING_VARIABLES.includes(token.value as EngineeringVariable) || /^[A-E][1-9]\d?$/i.test(token.value);
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
  // CODATA 2022 central values (rounded for this catalog), SI and conventional adopted values.
  ['Z0', 'Z₀', 376.730313412, 'Ω'], ['planckL', 'lₚ', 1.616255e-35, 'm'], ['planckT', 'tₚ', 5.391247e-44, 's'],
  ['magN', 'μN', 5.0507837393e-27, 'J/T'], ['magB', 'μᵦ', 9.2740100657e-24, 'J/T'], ['fluxQ', 'Φ₀', 2.067833848e-15, 'Wb'],
  ['conductQ', 'G₀', 7.748091729e-5, 'S'], ['Josephson', 'Kⱼ', 4.835978484e14, 'Hz/V'], ['Klitzing', 'Rₖ', 25812.80745, 'Ω'],
  ['mMuon', 'mμ', 1.883531627e-28, 'kg'], ['electronR', 'rₑ', 2.8179403205e-15, 'm'], ['comptonE', 'λ꜀', 2.42631023538e-12, 'm'],
  ['gyroP', 'γₚ', 2.6752218708e8, 'rad/(s·T)'], ['comptonP', 'λ꜀ₚ', 1.32140985360e-15, 'm'], ['comptonN', 'λ꜀ₙ', 1.31959090382e-15, 'm'],
  ['dipoleP', 'μₚ', 1.41060679545e-26, 'J/T'], ['dipoleE', 'μₑ', -9.2847646917e-24, 'J/T'], ['dipoleN', 'μₙ', -9.6623653e-27, 'J/T'],
  ['dipoleMuon', 'μμ', -4.49044830e-26, 'J/T'], ['mTau', 'mτ', 3.16754e-27, 'kg'], ['molarVolume', 'Vₘ', 0.02241396954, 'm³/mol (273.15 K, 1 atm)'],
  ['radiation1', 'c₁', 3.741771852e-16, 'W·m²'], ['radiation2', 'c₂', 1.438776877e-2, 'm·K'],
  ['Klitzing90', 'Rₖ₋₉₀', 25812.807, 'Ω'], ['Josephson90', 'Kⱼ₋₉₀', 4.835979e14, 'Hz/V'], ['icePoint', 'T₀', 273.15, 'K'],
] as const;
const ENGINEERING_CONSTANT_VALUES: Record<string, number> = {
  ...Object.fromEntries(ENGINEERING_CONSTANTS.map(([name, , value]) => [name.toLowerCase(), value])),
  gravity: 9.80665, gasconstant: 8.314462618, avogadro: 6.02214076e23, planck: 6.62607015e-34,
  tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2,
};

export const radiansPerUnit = (mode: AngleMode) => mode === 'DEG' ? Math.PI / 180 : mode === 'GRAD' ? Math.PI / 200 : 1;

/** Preserve exact values at common quadrantal / textbook angles without rounding unrelated small numbers to zero. */
function trig(name: 'sin' | 'cos' | 'tan', x: number, mode: AngleMode, value?: ExactValue): EngineeringValue {
  const quarter = mode === 'DEG' ? 90 : mode === 'GRAD' ? 100 : Math.PI / 2;
  // Reduce by *exact* quarter turns for decimal degrees/gradians and symbolic π radians.
  // At other radian angles let the native trig functions do full-precision argument reduction.
  let axis: number, offset: number;
  let fraction: [bigint, bigint] | undefined;
  if (value && (mode === 'RAD' ? value.symbol === 'pi' : !value.symbol)) {
    const d = mode === 'RAD' ? value.denominator : value.denominator * BigInt(quarter);
    const n = (mode === 'RAD' ? 2n * value.numerator : value.numerator) % (4n * d);
    const sign = n < 0n ? -1n : 1n;
    const nearest = sign * ((2n * n * sign + d) / (2n * d));
    const delta = n - nearest * d;
    fraction = [delta, d];
    axis = Number(nearest);
    offset = decimalRatio(delta, d) * (Math.PI / 2);
  } else if (mode === 'RAD') {
    return complex(Math[name](x));
  } else {
    const phase = x % (4 * quarter);
    axis = Math.round(phase / quarter);
    offset = (phase - axis * quarter) * radiansPerUnit(mode);
  }
  const [n, d] = fraction ?? [0n, 1n];
  const mag = n < 0n ? -n : n;
  const sign = n < 0n ? -1n : 1n;
  const sin = !offset ? exact(0n) : mag * 2n === d ? exact(sign, 2n, 2) : mag * 3n === d ? exact(sign, 2n) : undefined;
  const cos = !offset ? exact(1n) : mag * 2n === d ? exact(1n, 2n, 2) : mag * 3n === d ? exact(1n, 2n, 3) : undefined;
  const realSin = Math.sin(offset), realCos = Math.cos(offset);
  const shifted = (shift: number) => {
    const index = ((axis + shift) % 4 + 4) % 4;
    const base = index % 2 ? cos : sin;
    const re = index % 2 ? realCos : realSin;
    const direction = index < 2 ? 1 : -1;
    const form = base && exact(base.numerator * BigInt(direction), base.denominator, base.symbol);
    return { ...complex(form ? exactApproximation(form) : direction * re), exact: form };
  };
  if (name === 'sin') return shifted(0);
  const c = shifted(1);
  if (name === 'cos') return c;
  if (!c.re) return domain('Tangent is undefined at this angle.');
  const s = shifted(0);
  return { ...complex(s.re / c.re), exact: exactMultiply(s.exact, c.exact, true) };
}

function factorial(value: number): bigint {
  if (!Number.isInteger(value) || value < 0 || value > 170) return domain('Factorial needs an integer from 0 to 170.');
  let result = 1n;
  for (let n = 2n; n <= BigInt(value); n++) result *= n;
  return result;
}

function combination(n: number, r: number, permutation: boolean): bigint {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || n > 170 || r > n) {
    return domain('nCr and nPr need integers with 0 ≤ r ≤ n ≤ 170.');
  }
  const count = permutation ? r : Math.min(r, n - r);
  let result = 1n;
  for (let i = 1; i <= count; i++) {
    result *= BigInt(n - i + 1);
    if (!permutation) result /= BigInt(i);
  }
  return result;
}

class PreviewNeedsExecution extends Error {}

type EvaluationPolicy = 'execute' | 'preview' | 'sample' | 'study';
export interface EngineeringCalculationStep { expression: string; value: EngineeringValue }

function expressionText(node: Expression): string {
  if (node.kind === 'call') return `${node.name}(${node.args.map(expressionText).join(', ')})`;
  if (node.kind === 'binary') return `(${expressionText(node.left)} ${node.op} ${expressionText(node.right)})`;
  if (node.kind === 'unary') return node.op === '-' ? `(-${expressionText(node.value)})` : `(${expressionText(node.value)}${node.op})`;
  return node.value;
}

function evaluate(node: Expression, options: EvaluateOptions, policy: EvaluationPolicy = 'execute', steps?: EngineeringCalculationStep[]): EngineeringValue {
  const preview = policy === 'preview';
  const mode = options.angleMode ?? 'DEG';
  const radians = radiansPerUnit(mode);
  const functionCache = new Map<'f' | 'g', Expression>();
  let budget = policy === 'sample' ? 750 : preview ? 5_000 : 100_000;
  // Exact arithmetic is useful for interactive results, but not inside thousands of numeric samples.
  const real = (z: ComplexValue) => z.im === 0 ? finite(z.re) : domain('This operation needs real numbers.');
  const numeric = (n: number, withExact = false): EngineeringValue => ({ re: finite(n), im: 0, exact: withExact && Number.isSafeInteger(n) ? exact(BigInt(n)) : undefined });
  const stored = (z: number | EngineeringValue | undefined): EngineeringValue => typeof z === 'number' || z === undefined ? numeric(z ?? 0, z === undefined) : z;
  const checked = (z: EngineeringValue): EngineeringValue => {
    if (!Number.isFinite(z.im) || (!z.exact && !Number.isFinite(z.re))) return domain('The result is undefined or outside the numeric range.');
    if (!options.complex && z.im !== 0) return domain('Open Complex mode for imaginary results.');
    if (z.exact) return { ...z, re: finite(exactApproximation(z.exact)) };
    return { re: finite(z.re) || 0, im: finite(z.im) || 0 };
  };

  const integerResult = (n: bigint, withExact: boolean): EngineeringValue => ({ ...complex(finite(Number(n))), exact: withExact ? exact(n) : undefined });
  const integerOperand = (z: EngineeringValue) => {
    const v = real(z);
    if (z.exact ? z.exact.symbol || z.exact.denominator !== 1n : !Number.isSafeInteger(v)) return domain('This operation needs whole numbers.');
    return v;
  };
  const remainder = (a: EngineeringValue, b: EngineeringValue, withExact: boolean) => {
    const x = real(a), y = real(b), ae = a.exact, be = b.exact;
    if (!y) return domain('Cannot divide by zero.');
    if (withExact && ae && be && ae.symbol === be.symbol) {
      const n = ae.numerator * be.denominator, d = ae.denominator * be.numerator;
      const e = exact(n % d, ae.denominator * be.denominator, ae.symbol);
      if (e) return checked({ ...complex(0), exact: e });
    }
    return numeric(x % y, false);
  };

  const nonzero = (z: ComplexValue) => z.re !== 0 || z.im !== 0;
  const rangeChecked = (z: EngineeringValue, mustBeNonzero: boolean): EngineeringValue => {
    if (mustBeNonzero && !z.exact && !nonzero(z)) return limit('The result is too small to represent.');
    return checked(z);
  };
  const power = (a: EngineeringValue, b: EngineeringValue, withExact: boolean) => {
    const e = b.exact;
    if (!options.complex && a.re < 0 && e && (e.symbol || e.denominator !== 1n)) return domain('Use root() for an odd real root of a negative number, or open Complex mode.');
    // Even when the exponent has rounded to the next double, keep its exact integer parity.
    const result = a.re < 0 && !a.im && e && !e.symbol && e.denominator === 1n
      ? complex((e.numerator % 2n ? -1 : 1) * (-a.re) ** b.re)
      : options.complex ? powerComplex(a, b) : complex(real(a) ** real(b));
    return rangeChecked({ ...result, exact: withExact ? exactPower(a.exact, b.exact) : undefined }, nonzero(a));
  };
  const naturalLog = (z: EngineeringValue) => {
    const value = real(z), e = z.exact;
    // A representable positive perturbation can still disappear when 1 + δ is rounded.
    if (e && !e.symbol && value >= 0.5 && value <= 1.5) return Math.log1p(decimalRatio(e.numerator - e.denominator, e.denominator));
    return Math.log(value);
  };

  function visit(tree: Expression, x?: number | EngineeringValue, depth = 0, withExact = policy !== 'sample'): EngineeringValue {
    const value = visitNode(tree, x, depth, withExact);
    if (steps && depth === 0 && steps.length < 16 && tree.kind !== 'number' && tree.kind !== 'identifier') {
      const expression = expressionText(tree);
      if (steps.at(-1)?.expression !== expression) steps.push({ expression, value });
    }
    return value;
  }

  function visitNode(tree: Expression, x: number | EngineeringValue | undefined, depth: number, withExact: boolean): EngineeringValue {
    if (--budget < 0 && preview) throw new PreviewNeedsExecution();
    if (budget < 0 || depth > 8) return limit('Calculation exceeded its work limit.');
    const child = (sub: Expression) => visit(sub, x, depth, withExact);
    if (tree.kind === 'number') {
      const n = finite(Number(tree.value));
      if (!n && /[1-9]/.test(tree.value.split(/[eE]/)[0])) return limit('The number is too small to represent.');
      return { ...complex(n), exact: withExact ? exactLiteral(tree.value) : undefined };
    }
    if (tree.kind === 'identifier') {
      const id = tree.value;
      const lower = id.toLowerCase();
      if (lower === 'ans') return checked(stored(options.answer));
      if (id === 'x' && x !== undefined) return typeof x === 'number' ? numeric(x, withExact) : x;
      if (ENGINEERING_VARIABLES.includes(id as EngineeringVariable)) return checked(stored(options.variables?.[id as EngineeringVariable]));
      if (options.cell) {
        const value = options.cell(id);
        if (value !== undefined) return checked(stored(value));
      }
      if (lower === 'pi') return { ...complex(Math.PI), exact: withExact ? exact(1n, 1n, 'pi') : undefined };
      if (lower === 'e') return complex(Math.E);
      if (lower === 'i' && options.complex) return complex(0, 1);
      if (Object.hasOwn(ENGINEERING_CONSTANT_VALUES, lower)) return complex(ENGINEERING_CONSTANT_VALUES[lower]);
      return syntax(`Unknown constant: ${id}`);
    }
    if (tree.kind === 'unary') {
      const a = child(tree.value);
      if (tree.op === '!') return integerResult(factorial(integerOperand(a)), withExact);
      if (tree.op === '%') return rangeChecked({ ...divideComplex(a, complex(100)), exact: withExact ? exactMultiply(a.exact, exact(100n), true) : undefined }, nonzero(a));
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
        case '*': return rangeChecked({ ...multiplyComplex(a, b), exact: exactMultiply(ae, be) }, nonzero(a) && nonzero(b));
        case '/':
          if (!b.re && !b.im) return domain('Cannot divide by zero.');
          return rangeChecked({ ...divideComplex(a, b), exact: exactMultiply(ae, be, true) }, nonzero(a));
        case '^': return power(a, b, withExact);
        default: return remainder(a, b, withExact);
      }
    }
    if (tree.kind !== 'call') return syntax('Invalid expression.');
    const { name, args } = tree;
    // This also covers rand() inside a user-defined f/g: rendering a preview never rolls a random value.
    if (policy !== 'execute' && (name === 'rand' || name === 'randint')) {
      if (preview) throw new PreviewNeedsExecution();
      return syntax('Random functions are not sampled or used in study steps.');
    }
    const arity = (expected: number) => { if (args.length !== expected) syntax(`${name} expects ${expected} argument(s).`); };
    if (name === 'repeat') {
      arity(2);
      const sign = args[0].kind === 'unary' && args[0].op === '-' ? -1n : 1n;
      const prefix = args[0].kind === 'unary' && args[0].op === '-' ? args[0].value : args[0];
      const period = args[1];
      // Keep the spelling: 03 repeats as two digits, not as the integer 3.
      if (prefix.kind !== 'number' || period.kind !== 'number' || !/^(?:\d{1,24}(?:\.\d{0,24})?|\.\d{1,24})$/.test(prefix.value) || !/^\d{1,24}$/.test(period.value)) {
        return syntax('Use repeat(decimal prefix, repeating digits), for example repeat(0.1,6).');
      }
      const [whole, fraction = ''] = prefix.value.split('.');
      const cycle = 10n ** BigInt(period.value.length) - 1n;
      const d = 10n ** BigInt(fraction.length) * cycle;
      const n = sign * (BigInt(whole + fraction) * cycle + BigInt(period.value));
      const result = exact(n, d);
      return result ? checked({ re: exactApproximation(result), im: 0, exact: withExact ? result : undefined }) : limit('This recurring decimal is too long.');
    }
    if (name === 'integral' || name === 'deriv' || name === 'sumx' || name === 'prodx') {
      if (policy === 'sample') return syntax('Plot or sequence formulas cannot contain nested calculus or series.');
      arity(name === 'deriv' ? 2 : 3);
      const fn = (point: number) => real(visit(args[0], point, depth + 1, false));
      const lower = child(args[1]);
      const a = real(lower);
      if (name === 'deriv') {
        const slope = differentiateNumerically(fn, a);
        return slope === undefined ? domain('The derivative does not exist or did not converge at this point.') : numeric(slope, false);
      }
      const upper = child(args[2]);
      const b = real(upper);
      if (name === 'integral') {
        const integral = integrateNumerically(fn, a, b);
        return integral === undefined ? limit('The integral did not converge on this interval.') : numeric(integral, false);
      }
      if (!Number.isSafeInteger(integerOperand(lower)) || !Number.isSafeInteger(integerOperand(upper)) || b < a || b - a >= 1000) return limit('Use increasing integer bounds with at most 1,000 terms.');
      const term = (i: number) => visit(args[0], a + i, depth + 1, withExact);
      if (name === 'sumx') {
        const terms = Array.from({ length: b - a + 1 }, (_, i) => term(i));
        const form = withExact ? terms.reduce<ExactValue | undefined>((sum, next) => exactAdd(sum, next.exact), exact(0n)) : undefined;
        return form ? checked({ ...complex(0), exact: form }) : numeric(compensatedSum(terms.map(real)));
      }
      let product = numeric(1, withExact);
      for (let i = 0; i <= b - a; i++) {
        const next = term(i);
        product = rangeChecked({ ...complex(real(product) * real(next)), exact: exactMultiply(product.exact, next.exact) }, nonzero(product) && nonzero(next));
      }
      return product;
    }
    if (name === 'f' || name === 'g') {
      arity(1);
      const source = options.functions?.[name];
      if (!source) return syntax(`Define ${name}(x) first.`);
      if (!functionCache.has(name)) functionCache.set(name, parseEngineeringExpression(source));
      const at = child(args[0]);
      real(at);
      return visit(functionCache.get(name)!, at, depth + 1, withExact);
    }
    const values = args.map(child);
    const one = (fn: (value: number) => number) => { arity(1); return numeric(fn(real(values[0]))); };
    const two = (fn: (a: number, b: number) => number) => { arity(2); return numeric(fn(real(values[0]), real(values[1]))); };
    switch (name) {
      case 'sin': case 'cos': case 'tan': arity(1); return checked(trig(name, real(values[0]), mode, values[0].exact));
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
      case 'abs': {
        arity(1); const v = values[0].exact;
        return checked({ ...complex(magnitude(values[0])), exact: v && exact(v.numerator < 0n ? -v.numerator : v.numerator, v.denominator, v.symbol) });
      }
      case 'conj': arity(1); return checked({ ...values[0], im: -values[0].im });
      case 'arg': arity(1); return numeric((values[0].re || values[0].im) ? Math.atan2(values[0].im, values[0].re) / radians : domain('Zero has no argument.'), false);
      case 're': arity(1); return checked({ ...complex(values[0].re), exact: values[0].exact });
      case 'im': arity(1); return numeric(values[0].im, withExact);
      case 'rect': {
        arity(2);
        const radius = real(values[0]);
        const angle = real(values[1]);
        return checked(complex(radius * trig('cos', angle, mode, values[1].exact).re, radius * trig('sin', angle, mode, values[1].exact).re));
      }
      case 'floor': case 'ceil': case 'round': case 'trunc': {
        arity(1);
        const e = values[0].exact;
        if (withExact && e && !e.symbol) {
          const n = e.numerator, d = e.denominator;
          const q = n / d, rem = n % d;
          const rounded = name === 'floor' && rem < 0n ? q - 1n : name === 'ceil' && rem > 0n ? q + 1n
            : name === 'round' && 2n * rem >= d ? q + 1n : name === 'round' && 2n * rem < -d ? q - 1n : q;
          return integerResult(rounded, withExact);
        }
        return one(Math[name]);
      }
      case 'sign': return one(Math.sign);
      case 'ln': arity(1); return numeric(naturalLog(values[0]));
      case 'log': case 'log2': {
        if (name === 'log2' || args.length === 1) {
          arity(1);
          const x = real(values[0]);
          return numeric(x >= 0.5 && x <= 1.5 ? naturalLog(values[0]) / (name === 'log2' ? Math.LN2 : Math.LN10)
            : name === 'log2' ? Math.log2(x) : Math.log10(x));
        }
        arity(2);
        const a = naturalLog(values[0]), b = naturalLog(values[1]);
        return Number.isFinite(a) && Number.isFinite(b) && b ? numeric(a / b) : domain('Logarithm needs a positive value and a positive base other than 1.');
      }
      case 'exp': return one((x) => Math.exp(x) || limit('The result is too small to represent.'));
      case 'fact': arity(1); return integerResult(factorial(integerOperand(values[0])), withExact);
      case 'pow': arity(2); return power(values[0], values[1], withExact);
      case 'root': {
        arity(2);
        const x = real(values[0]), n = real(values[1]), e = values[1].exact;
        if (!n) return domain('The root index cannot be zero.');
        const odd = e ? !e.symbol && e.denominator === 1n && e.numerator % 2n !== 0n : Number.isInteger(n) && Math.abs(n % 2) === 1;
        if (x < 0 && !odd) return domain('A negative real radicand requires an odd integer root index.');
        return rangeChecked(complex((x < 0 ? -1 : 1) * Math.abs(x) ** (1 / n)), x !== 0);
      }
      case 'mod': arity(2); return remainder(values[0], values[1], withExact);
      case 'ncr': case 'npr': arity(2); return integerResult(combination(integerOperand(values[0]), integerOperand(values[1]), name === 'npr'), withExact);
      case 'gcd': case 'lcm': {
        arity(2);
        const [a, b] = values.map((value) => {
          const n = integerOperand(value);
          const int = value.exact?.numerator ?? BigInt(n);
          return int < 0n ? -int : int;
        });
        let d = a, rem = b;
        while (rem) [d, rem] = [rem, d % rem];
        const result = name === 'gcd' ? d : d ? a / d * b : 0n;
        if (withExact && !exact(result)) return limit('The integer result is outside the supported exact range.');
        return integerResult(result, withExact);
      }
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
        if (name === 'min' || name === 'max') {
          let best = values[0];
          for (const v of values.slice(1)) {
            const delta = exactAdd(v.exact, best.exact, -1n)?.numerator;
            const order = delta === undefined ? Math.sign(v.re - best.re) : delta < 0n ? -1 : delta > 0n ? 1 : 0;
            if (name === 'min' ? order < 0 : order > 0) best = v;
          }
          return best;
        }
        if (name === 'hypot') return numeric(Math.hypot(...data));
        const div = name === 'avg' ? data.length : 1;
        const total = withExact ? values.reduce<ExactValue | undefined>((a, b) => exactAdd(a, b.exact), exact(0n)) : undefined;
        const tally = div === 1 ? total : exactMultiply(total, exact(BigInt(div)), true);
        return tally ? checked({ ...complex(0), exact: tally }) : numeric(compensatedSum(data.map((v) => v / div)));
      }
      default: return syntax(`Unknown function: ${name}`);
    }
  }
  return checked(visit(node));
}

/** Parses math as data. A compiled expression can be sampled repeatedly; it never executes JavaScript. */
export function compileEngineeringExpression(source: string, deterministic = false): (options?: EvaluateOptions) => EngineeringValue {
  const node = parseEngineeringExpression(source);
  return (options = {}) => evaluate(node, options, deterministic ? 'study' : 'execute');
}

/** One bounded, deterministic sampler for charts, recurrence and numeric analyses. */
export function compileEngineeringSampler(source: string, options: EvaluateOptions = {}): (x: number, y?: number, z?: number) => number | null {
  const node = parseEngineeringExpression(source);
  return (x, y, z) => {
    if (!Number.isFinite(x) || (y !== undefined && !Number.isFinite(y)) || (z !== undefined && !Number.isFinite(z))) return null;
    try {
      return evaluate(node, { ...options, complex: false, variables: { ...options.variables, x, ...(y === undefined ? {} : { y }), ...(z === undefined ? {} : { z }) } }, 'sample').re;
    } catch (error) {
      if (error instanceof EngineeringError && error.kind === 'math') return null;
      throw error;
    }
  };
}

export function explainEngineeringCalculation(source: string, options: EvaluateOptions = {}): { value: EngineeringValue; steps: EngineeringCalculationStep[] } {
  const steps: EngineeringCalculationStep[] = [];
  return { value: evaluate(parseEngineeringExpression(source), options, 'study', steps), steps };
}

export function evaluateEngineeringValue(source: string, options: EvaluateOptions = {}): EngineeringValue {
  return compileEngineeringExpression(source)(options);
}

/** Keep desk calculation local and use the same exact arithmetic as the scientific worksheet. */
export function evaluateStandardValue(source: string, answer?: EvaluateOptions['answer']): EngineeringValue {
  return evaluate(parseStandardChain(source).tree, { answer });
}

export type EngineeringPreview = { status: 'value'; value: EngineeringValue; subtotal?: boolean } | { status: 'pending' | 'manual' };

export function previewStandardValue(source: string, answer?: EvaluateOptions['answer']): EngineeringPreview {
  if (!source.trim()) return { status: 'pending' };
  try {
    const { tree, subtotal } = parseStandardChain(source, true);
    return { status: 'value', value: evaluate(tree, { answer }, 'preview'), subtotal };
  } catch { return { status: 'pending' }; }
}

/** Same parser and precision as EXE, but no random draws or unbounded work while someone types. */
export function previewEngineeringValue(source: string, options: EvaluateOptions = {}): EngineeringPreview {
  if (!source.trim()) return { status: 'pending' };
  try { return { status: 'value', value: evaluate(parseEngineeringExpression(source), options, 'preview') }; }
  catch (error) { return { status: error instanceof PreviewNeedsExecution ? 'manual' : 'pending' }; }
}

export function evaluateEngineeringExpression(source: string, options: Omit<EvaluateOptions, 'complex'> = {}): number {
  return evaluateEngineeringValue(source, { ...options, complex: false }).re;
}

export type EngineeringUnitCategory = 'length' | 'area' | 'volume' | 'mass' | 'temperature' | 'pressure' | 'speed' | 'energy' | 'power' | 'voltage' | 'current' | 'resistance' | 'frequency' | 'time' | 'angle' | 'force' | 'data';

export const ENGINEERING_UNITS: Record<EngineeringUnitCategory, readonly string[]> = {
  length: ['m', 'km', 'cm', 'mm', 'µm', 'in', 'ft', 'yd', 'mi', 'n mile', 'pc'],
  area: ['m²', 'km²', 'cm²', 'mm²', 'ft²', 'yd²', 'ha', 'acre'],
  volume: ['L', 'mL', 'm³', 'gal US', 'gal UK', 'fl oz US', 'cup US', 'ft³'],
  mass: ['kg', 'g', 'mg', 't', 'lb', 'oz'],
  temperature: ['°C', '°F', 'K'],
  pressure: ['Pa', 'kPa', 'MPa', 'bar', 'atm', 'psi', 'mmHg', 'kgf/cm²'],
  speed: ['m/s', 'km/h', 'mph', 'knot'],
  energy: ['J', 'kJ', 'Wh', 'kWh', 'cal', 'kcal', 'cal15', 'kgf·m'],
  power: ['W', 'kW', 'MW', 'hp'],
  voltage: ['V', 'mV', 'kV'],
  current: ['A', 'mA', 'µA'],
  resistance: ['Ω', 'kΩ', 'MΩ'],
  frequency: ['Hz', 'kHz', 'MHz', 'GHz'],
  time: ['s', 'ms', 'min', 'h', 'd', 'wk'],
  angle: ['°', 'rad', 'grad', 'turn'],
  force: ['N', 'kN', 'dyn', 'lbf', 'kgf'],
  data: ['B', 'kB', 'MB', 'GB', 'KiB', 'MiB', 'GiB'],
};

const FACTORS: Partial<Record<EngineeringUnitCategory, Record<string, number>>> = {
  length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, 'µm': 1e-6, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344, 'n mile': 1852, pc: 648000 / Math.PI * 149_597_870_700 },
  area: { 'm²': 1, 'km²': 1e6, 'cm²': 1e-4, 'mm²': 1e-6, 'ft²': 0.09290304, 'yd²': 0.83612736, ha: 10000, acre: 4046.8564224 },
  volume: { L: 1, mL: 0.001, 'm³': 1000, 'gal US': 3.785411784, 'gal UK': 4.54609, 'fl oz US': 0.0295735295625, 'cup US': 0.2365882365, 'ft³': 28.316846592 },
  mass: { kg: 1, g: 0.001, mg: 1e-6, t: 1000, lb: 0.45359237, oz: 0.028349523125 },
  pressure: { Pa: 1, kPa: 1000, MPa: 1e6, bar: 1e5, atm: 101325, psi: 6894.757293168, mmHg: 133.322387415, 'kgf/cm²': 98_066.5 },
  speed: { 'm/s': 1, 'km/h': 1 / 3.6, mph: 0.44704, knot: 0.514444444444 },
  energy: { J: 1, kJ: 1000, Wh: 3600, kWh: 3.6e6, cal: 4.184, kcal: 4184, cal15: 4.18580, 'kgf·m': 9.80665 },
  power: { W: 1, kW: 1e3, MW: 1e6, hp: 745.699872 },
  voltage: { V: 1, mV: 1e-3, kV: 1e3 },
  current: { A: 1, mA: 1e-3, 'µA': 1e-6 },
  resistance: { 'Ω': 1, 'kΩ': 1e3, 'MΩ': 1e6 },
  frequency: { Hz: 1, kHz: 1e3, MHz: 1e6, GHz: 1e9 },
  time: { s: 1, ms: 1e-3, min: 60, h: 3600, d: 86400, wk: 604800 },
  angle: { '°': Math.PI / 180, rad: 1, grad: Math.PI / 200, turn: 2 * Math.PI },
  force: { N: 1, kN: 1000, dyn: 1e-5, lbf: 4.4482216152605, kgf: 9.80665 },
  data: { B: 1, kB: 1e3, MB: 1e6, GB: 1e9, KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3 },
};

export function convertEngineeringUnit(value: number, category: EngineeringUnitCategory, from: string, to: string): number {
  if (!Number.isFinite(value)) throw new Error('Enter a finite number.');
  if (!Object.hasOwn(ENGINEERING_UNITS, category) || !ENGINEERING_UNITS[category].includes(from) || !ENGINEERING_UNITS[category].includes(to)) throw new Error('Unsupported unit conversion.');
  if (category === 'temperature') {
    const minimum = from === '°C' ? -273.15 : from === '°F' ? -459.67 : 0;
    if (value < minimum) return domain('Absolute temperature cannot be below 0 K.');
    if (from === to) return value;
    if (value === minimum) return to === '°C' ? -273.15 : to === '°F' ? -459.67 : 0;
    if (from === '°C' && to === '°F') return finite(value * (9 / 5) + 32);
    if (from === '°F' && to === '°C') return finite((value - 32) * (5 / 9));
    if (from === '°C') return finite(value + 273.15);
    if (from === '°F') return finite((value + 459.67) * (5 / 9));
    return finite(to === '°C' ? value - 273.15 : value * (9 / 5) - 459.67);
  }
  if (from === to) return value;
  const factors = FACTORS[category];
  if (!factors || factors[from] === undefined || factors[to] === undefined) throw new Error('Unsupported unit conversion.');
  return finite(value * (factors[from]! / factors[to]!));
}
