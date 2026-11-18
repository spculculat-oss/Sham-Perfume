export type AngleMode = 'DEG' | 'RAD';

export interface EvaluateOptions {
  angleMode?: AngleMode;
  answer?: number;
}

interface Token {
  kind: 'number' | 'identifier' | 'operator' | 'left' | 'right' | 'comma';
  value: string;
}

const NUMBER = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;
const IDENTIFIER = /^[a-zA-Z_][a-zA-Z_0-9]*/;

function tokenize(source: string): Token[] {
  const normalized = source.replace(/[×·]/g, '*').replace(/[÷]/g, '/').replace(/[−–]/g, '-').replace(/π/g, 'pi').replace(/√/g, 'sqrt');
  if (!normalized.trim()) throw new Error('Enter an expression.');
  if (normalized.length > 240) throw new Error('Expression is too long.');
  const tokens: Token[] = [];
  for (let index = 0; index < normalized.length;) {
    const char = normalized[index];
    if (/\s/.test(char)) { index += 1; continue; }
    const rest = normalized.slice(index);
    const number = rest.match(NUMBER)?.[0];
    if (number) {
      tokens.push({ kind: 'number', value: number });
      index += number.length;
      continue;
    }
    const identifier = rest.match(IDENTIFIER)?.[0];
    if (identifier) {
      tokens.push({ kind: 'identifier', value: identifier.toLowerCase() });
      index += identifier.length;
      continue;
    }
    if ('+-*/^%!'.includes(char)) {
      tokens.push({ kind: 'operator', value: char });
      index += 1;
      continue;
    }
    if (char === '(') tokens.push({ kind: 'left', value: char });
    else if (char === ')') tokens.push({ kind: 'right', value: char });
    else if (char === ',') tokens.push({ kind: 'comma', value: char });
    else throw new Error(`Unsupported character: ${char}`);
    index += 1;
  }
  return tokens;
}

const finite = (value: number): number => {
  if (!Number.isFinite(value)) throw new Error('Result is outside the supported numeric range.');
  return value;
};

const factorial = (value: number): number => {
  if (!Number.isInteger(value) || value < 0 || value > 170) throw new Error('Factorial needs a whole number from 0 to 170.');
  let result = 1;
  for (let n = 2; n <= value; n += 1) result *= n;
  return result;
};

const combination = (n: number, r: number, permutation: boolean): number => {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || n > 170 || r > n) {
    throw new Error('nCr and nPr need whole numbers with 0 ≤ r ≤ n ≤ 170.');
  }
  let result = 1;
  for (let i = 0; i < r; i += 1) result *= n - i;
  return finite(permutation ? result : result / factorial(r));
};

/** Safe scientific expression evaluator. It parses a small math grammar and never runs JavaScript. */
export function evaluateEngineeringExpression(source: string, options: EvaluateOptions = {}): number {
  const tokens = tokenize(source);
  let cursor = 0;
  const mode = options.angleMode ?? 'DEG';
  const toRadians = (value: number) => mode === 'DEG' ? value * Math.PI / 180 : value;
  const fromRadians = (value: number) => mode === 'DEG' ? value * 180 / Math.PI : value;
  const constants: Record<string, number> = {
    pi: Math.PI,
    e: Math.E,
    tau: Math.PI * 2,
    phi: (1 + Math.sqrt(5)) / 2,
    ans: options.answer ?? 0,
    c: 299_792_458,
    g: 9.80665,
    gravity: 9.80665,
    r: 8.314462618,
    gasconstant: 8.314462618,
    na: 6.02214076e23,
    avogadro: 6.02214076e23,
    h: 6.62607015e-34,
    planck: 6.62607015e-34,
  };
  const peek = () => tokens[cursor];
  const take = () => tokens[cursor++];
  const matchOperator = (value: string) => peek()?.kind === 'operator' && peek()?.value === value && Boolean(take());
  const expectRight = () => {
    if (peek()?.kind !== 'right') throw new Error('Missing closing parenthesis.');
    take();
  };

  const callFunction = (name: string, args: number[]): number => {
    const one = (fn: (value: number) => number) => {
      if (args.length !== 1) throw new Error(`${name} expects one argument.`);
      return finite(fn(args[0]));
    };
    const two = (fn: (a: number, b: number) => number) => {
      if (args.length !== 2) throw new Error(`${name} expects two arguments.`);
      return finite(fn(args[0], args[1]));
    };
    switch (name) {
      case 'sin': return one((x) => Math.sin(toRadians(x)));
      case 'cos': return one((x) => Math.cos(toRadians(x)));
      case 'tan': return one((x) => Math.tan(toRadians(x)));
      case 'asin': return one((x) => fromRadians(Math.asin(x)));
      case 'acos': return one((x) => fromRadians(Math.acos(x)));
      case 'atan': return one((x) => fromRadians(Math.atan(x)));
      case 'sinh': return one(Math.sinh);
      case 'cosh': return one(Math.cosh);
      case 'tanh': return one(Math.tanh);
      case 'asinh': return one(Math.asinh);
      case 'acosh': return one(Math.acosh);
      case 'atanh': return one(Math.atanh);
      case 'sqrt': return one(Math.sqrt);
      case 'cbrt': return one(Math.cbrt);
      case 'abs': return one(Math.abs);
      case 'floor': return one(Math.floor);
      case 'ceil': return one(Math.ceil);
      case 'round': return one(Math.round);
      case 'trunc': return one(Math.trunc);
      case 'sign': return one(Math.sign);
      case 'ln': return one(Math.log);
      case 'log': return args.length === 1 ? finite(Math.log10(args[0])) : two((x, base) => Math.log(x) / Math.log(base));
      case 'log2': return one(Math.log2);
      case 'exp': return one(Math.exp);
      case 'fact': return one(factorial);
      case 'pow': return two((x, y) => x ** y);
      case 'root': return two((x, degree) => {
        if (degree === 0) throw new Error('Root degree cannot be zero.');
        if (x < 0 && Number.isInteger(degree) && Math.abs(degree % 2) === 1) return -((-x) ** (1 / degree));
        return x ** (1 / degree);
      });
      case 'mod': return two((x, y) => x % y);
      case 'ncr': return two((n, r) => combination(n, r, false));
      case 'npr': return two((n, r) => combination(n, r, true));
      case 'min':
      case 'max':
      case 'sum':
      case 'avg':
        if (args.length < 1) throw new Error(`${name} needs at least one value.`);
        if (name === 'min') return Math.min(...args);
        if (name === 'max') return Math.max(...args);
        if (name === 'sum') return finite(args.reduce((a, b) => a + b, 0));
        return finite(args.reduce((a, b) => a + b, 0) / args.length);
      case 'hypot':
        if (args.length < 1) throw new Error('hypot needs at least one value.');
        return finite(Math.hypot(...args));
      default: throw new Error(`Unknown function: ${name}`);
    }
  };

  const parseAdd = (): number => {
    let value = parseMultiply();
    while (peek()?.kind === 'operator' && (peek()?.value === '+' || peek()?.value === '-')) {
      const operator = take().value;
      const right = parseMultiply();
      value = finite(operator === '+' ? value + right : value - right);
    }
    return value;
  };

  const startsAtom = (token: Token | undefined) => Boolean(token && (token.kind === 'number' || token.kind === 'identifier' || token.kind === 'left'));
  const parseMultiply = (): number => {
    let value = parseUnary();
    while (true) {
      if (matchOperator('*')) value = finite(value * parseUnary());
      else if (matchOperator('/')) value = finite(value / parseUnary());
      else if (peek()?.kind === 'identifier' && peek()?.value === 'mod') { take(); value = finite(value % parseUnary()); }
      else if (startsAtom(peek())) value = finite(value * parseUnary());
      else break;
    }
    return value;
  };

  const parseUnary = (): number => {
    if (matchOperator('+')) return parseUnary();
    if (matchOperator('-')) return finite(-parseUnary());
    return parsePower();
  };

  const parsePower = (): number => {
    const base = parsePostfix();
    if (matchOperator('^')) return finite(base ** parseUnary());
    return base;
  };

  const parsePostfix = (): number => {
    let value = parsePrimary();
    while (peek()?.kind === 'operator' && (peek()?.value === '!' || peek()?.value === '%')) {
      const operator = take().value;
      value = operator === '!' ? factorial(value) : value / 100;
    }
    return finite(value);
  };

  const parsePrimary = (): number => {
    const token = take();
    if (!token) throw new Error('Expression is incomplete.');
    if (token.kind === 'number') return finite(Number(token.value));
    if (token.kind === 'left') {
      const value = parseAdd();
      expectRight();
      return value;
    }
    if (token.kind !== 'identifier') throw new Error('Expected a number, constant, or function.');
    if (peek()?.kind === 'left') {
      take();
      const args: number[] = [];
      if (peek()?.kind !== 'right') {
        args.push(parseAdd());
        while (peek()?.kind === 'comma') { take(); args.push(parseAdd()); }
      }
      expectRight();
      return callFunction(token.value, args);
    }
    if (Object.hasOwn(constants, token.value)) return finite(constants[token.value]);
    throw new Error(`Unknown constant: ${token.value}`);
  };

  const result = parseAdd();
  if (cursor < tokens.length) throw new Error('Check the operator or parentheses.');
  return finite(result);
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
  if (category === 'temperature') {
    const kelvin = from === '°C' ? value + 273.15 : from === '°F' ? (value + 459.67) * 5 / 9 : value;
    const result = to === '°C' ? kelvin - 273.15 : to === '°F' ? kelvin * 9 / 5 - 459.67 : kelvin;
    return finite(result);
  }
  const factors = FACTORS[category];
  if (!factors || factors[from] === undefined || factors[to] === undefined) throw new Error('Unsupported unit conversion.');
  return finite(value * factors[from]! / factors[to]!);
}
