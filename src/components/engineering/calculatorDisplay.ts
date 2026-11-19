import type { SupportedLanguage } from '../../types/i18n';
import { formatLocalizedNumber } from '../../لغات/numerals';
import { ENGINEERING_EXPRESSION_LIMIT, ENGINEERING_VARIABLES, radiansPerUnit, type AngleMode, type EngineeringFunctions, type EngineeringValue, type EngineeringVariable } from '../../utils/engineeringCalculator';
import { exact, exactApproximation, type ExactValue } from '../../utils/engineeringExact';

export type CalcText = (ar: string, en: string) => string;
export const FORMATS = ['math', 'decimal', 'mixed', 'eng', 'sci', 'fixed', 'dms', 'polar'] as const;
export type CalcFormat = typeof FORMATS[number];
export const FORMAT_LABEL: Record<CalcFormat, [string, string]> = {
  math: ['كسور وجذور', 'Exact / textbook'], decimal: ['عشري', 'Decimal'], mixed: ['كسر مختلط', 'Mixed fraction'],
  eng: ['هندسي', 'Engineering'], sci: ['ترميز علمي', 'Scientific notation'], fixed: ['منازل عشرية ثابتة', 'Fixed decimals'],
  dms: ['درجات ودقائق وثوانٍ', 'Degrees, minutes, seconds'], polar: ['الصيغة القطبية', 'Polar form'],
};
export const FORMAT_TAG: Record<CalcFormat, string> = { math: 'MATH', decimal: 'DEC', mixed: 'MIX', eng: 'ENG', sci: 'SCI', fixed: 'FIX', dms: 'DMS', polar: 'POL' };

export function displayDigits(text: string, lang: SupportedLanguage) {
  return text.replace(/[0-9]/g, (value) => formatLocalizedNumber(lang, Number(value), { grouping: false }));
}

export function displayNumber(value: number, lang: SupportedLanguage, digits = 11): string {
  if (!Number.isFinite(value)) return value === Infinity ? '∞' : value === -Infinity ? '−∞' : '—';
  const size = Math.abs(value);
  if (size !== 0 && (size >= 10 ** digits || size < 1e-6)) return scientific(value, lang, digits, false);
  return formatLocalizedNumber(lang, Number(value.toPrecision(digits)) || 0, { grouping: false, maximumFractionDigits: 20 });
}

function scientific(value: number, lang: SupportedLanguage, digits: number, eng: boolean): string {
  const [part, exponent] = value.toExponential(digits - 1).split('e');
  const exp = Number(exponent);
  const shift = eng ? ((exp % 3) + 3) % 3 : 0;
  const coefficient = formatLocalizedNumber(lang, Number(part) * (10 ** shift), { grouping: false, maximumFractionDigits: Math.max(0, digits - 1 - shift) });
  return `${coefficient}×10^${displayDigits(String(exp - shift).replace('-', '−'), lang)}`;
}

export function formatComplex(value: EngineeringValue, lang: SupportedLanguage) {
  const { re, im } = value;
  if (!im) return displayNumber(re, lang);
  const imaginary = Math.abs(im) === 1 ? 'i' : `${displayNumber(Math.abs(im), lang)}i`;
  return re ? `${displayNumber(re, lang)} ${im < 0 ? '−' : '+'} ${imaginary}` : `${im < 0 ? '−' : ''}${imaginary}`;
}

export type Readout = { text: string } | { whole?: string; sign?: string; top: string; bottom: string };

function formatExact(value: ExactValue, lang: SupportedLanguage, mixed: boolean): Readout {
  const { numerator, denominator, symbol } = value;
  const n = numerator < 0n ? -numerator : numerator;
  const sign = numerator < 0n ? '−' : '';
  const rad = symbol === 'pi' ? 'π' : symbol ? `√${displayDigits(String(symbol), lang)}` : '';
  const whole = mixed && !symbol ? n / denominator : 0n;
  const remainder = n - whole * denominator;
  const top = (remainder === 1n && rad ? '' : displayDigits(remainder.toString(), lang)) + rad;
  if (denominator === 1n) return { text: sign + displayDigits(whole ? whole.toString() : '', lang) + (whole ? '' : top) };
  return { whole: whole ? displayDigits(whole.toString(), lang) : undefined, sign, top, bottom: displayDigits(denominator.toString(), lang) };
}

export function formatReadout(value: EngineeringValue, format: CalcFormat, precision: number, angle: AngleMode, lang: SupportedLanguage): Readout {
  if (format === 'polar') return { text: `${displayNumber(Math.hypot(value.re, value.im), lang)} ∠ ${displayNumber(value.im || value.re ? Math.atan2(value.im, value.re) / radiansPerUnit(angle) : 0, lang)}${angle === 'DEG' ? '°' : angle === 'GRAD' ? 'g' : ''}` };
  if (value.im) return { text: formatComplex(value, lang) };
  const n = value.re;
  if ((format === 'math' || format === 'mixed') && value.exact && (value.exact.symbol || value.exact.denominator !== 1n || Math.abs(n) < 1e12)) return formatExact(value.exact, lang, format === 'mixed');
  if (format === 'sci' || format === 'eng') return { text: scientific(n, lang, Math.max(3, precision + 1), format === 'eng') };
  if (format === 'fixed' && Math.abs(n) < 1e15) return { text: formatLocalizedNumber(lang, n, { grouping: false, fractionDigits: precision }) };
  if (format === 'dms' && Math.abs(n) <= 1e9) {
    const millis = Math.round(Math.abs(n) * 3_600_000);
    const degrees = Math.floor(millis / 3_600_000);
    const minutes = Math.floor(millis / 60_000) % 60;
    const seconds = (millis % 60_000) / 1000;
    return { text: `${n < 0 ? '−' : ''}${displayNumber(degrees, lang)}° ${displayNumber(minutes, lang)}′ ${displayNumber(seconds, lang)}″` };
  }
  return { text: displayNumber(n, lang) };
}

/** A copyable expression, independent of the display locale and notation preferences. */
export function copyableNumber(value: EngineeringValue, exactPreferred: boolean): string {
  const v = value.exact;
  if (v && exactPreferred && (v.symbol || v.denominator !== 1n)) {
    const symbol = v.symbol === 'pi' ? '*pi' : v.symbol ? `*sqrt(${v.symbol})` : '';
    return `${v.numerator}${symbol}${v.denominator !== 1n ? `/${v.denominator}` : ''}`;
  }
  return value.im ? `${value.re}${value.im >= 0 ? '+' : ''}${value.im}i` : String(value.re);
}

export type CalculatorMemory = Partial<Record<EngineeringVariable, EngineeringValue>>;
interface Preferences { angle: AngleMode; format: CalcFormat; precision: number; variables: CalculatorMemory; functions: EngineeringFunctions }
const STORAGE_KEY = 'sham_engineering_calculator_v1';
export function loadCalculatorPreferences(): Preferences {
  const defaults: Preferences = { angle: 'DEG', format: 'math', precision: 9, variables: {}, functions: {} };
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return defaults;
    if (['DEG', 'RAD', 'GRAD'].includes(raw.angle)) defaults.angle = raw.angle;
    if (FORMATS.includes(raw.format)) defaults.format = raw.format;
    if (Number.isInteger(raw.precision) && raw.precision >= 0 && raw.precision <= 12) defaults.precision = raw.precision;
    for (const variable of ENGINEERING_VARIABLES) {
      const z = raw.variables?.[variable];
      if (!Number.isFinite(z?.re) || !Number.isFinite(z?.im)) continue;
      defaults.variables[variable] = { re: z.re, im: z.im };
      const { n, d, s } = z.exact ?? {};
      if (!z.im && typeof n === 'string' && /^-?\d{1,60}$/.test(n) && typeof d === 'string' && /^\d{1,60}$/.test(d)
        && (s === undefined || s === 'pi' || (Number.isInteger(s) && s >= 2 && s <= 1_000_000))) {
        const saved = exact(BigInt(n), BigInt(d), s);
        if (saved && exactApproximation(saved) === z.re) defaults.variables[variable].exact = saved;
      }
    }
    for (const key of ['f', 'g'] as const) {
      const value = raw.functions?.[key];
      if (typeof value === 'string' && value.length <= ENGINEERING_EXPRESSION_LIMIT) defaults.functions[key] = value;
    }
  } catch { /* keep working in private mode */ }
  return defaults;
}

export function persistCalculatorPreferences(preferences: Preferences) {
  try {
    const variables = Object.fromEntries(Object.entries(preferences.variables).map(([key, { re, im, exact: value }]) => [key, {
      re, im, exact: value ? { n: String(value.numerator), d: String(value.denominator), s: value.symbol } : undefined,
    }]));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...preferences, variables }));
  } catch { /* optional device-local memory */ }
}
