/** Compare generated independent references to the actual calculator engines. */
import { readFileSync } from 'node:fs';
import { evaluateEngineeringExpression as evaluate, evaluateEngineeringValue as value, type AngleMode } from '../src/utils/engineeringCalculator';
import { calculateMatrix, calculateVector, solveLinearSystem, solvePolynomial, solvePolynomialInequality, engineeringTable } from '../src/utils/engineeringAdvanced';
import { studentTwoSided, inferMean } from '../src/utils/engineeringInference';
import { normalProbability, inverseNormal, binomialProbability, poissonProbability, fitRegression } from '../src/utils/engineeringStatistics';
import { timeValue, amortizeLoan, cashFlowAnalysis, bondPrice } from '../src/utils/engineeringFinance';
import { engineeringSequence, engineeringSurface, buildEngineeringGraph, graphIntegral, graphSlope } from '../src/utils/engineeringGraph';

const handlers = {
  expression: (source: string) => evaluate(source),
  trig: (source: string, angleMode: AngleMode) => evaluate(source, { angleMode }),
  complex: (source: string) => {
    const { re, im } = value(source, { complex: true, angleMode: 'RAD' });
    return [re, im];
  },
  det: (matrix: number[][]) => calculateMatrix('det', matrix),
  inverse: (matrix: number[][]) => calculateMatrix('inverse', matrix),
  system: solveLinearSystem,
  vector: calculateVector,
  poly: (coefficients: number[]) => solvePolynomial(coefficients).map(({ re, im }) => [re, im]),
  inequality: (coefficients: number[], op: Parameters<typeof solvePolynomialInequality>[1], x: number) =>
    solvePolynomialInequality(coefficients, op).some(({ from, to }) => x > from && x < to),
  student: studentTwoSided,
  normal: normalProbability,
  inverseNormal,
  binomial: binomialProbability,
  poisson: poissonProbability,
  infer: (data: number[], mean: number, confidence: number) => {
    const { statistic, p, interval } = inferMean(data, mean, confidence);
    return [statistic, p, ...interval];
  },
  regression: (kind: Parameters<typeof fitRegression>[0], pairs: [number, number][], x: number) => {
    const fit = fitRegression(kind, pairs);
    return [fit.predict(x), fit.rSquared];
  },
  loan: (principal: number, rate: number, months: number, row: number) => {
    const loan = amortizeLoan(principal, rate, months);
    return [loan.payment, loan.totalInterest, loan.rows[row].balance, loan.rows.at(-1)?.payment];
  },
  timeValue,
  npv: (flows: number[], rate: number) => cashFlowAnalysis(flows, rate).npv,
  bond: bondPrice,
  integral: (source: string) => evaluate(source, { angleMode: 'RAD' }),
  graph: (start: number, end: number, constant: number, x: number) => {
    const f = buildEngineeringGraph('cartesian', [{ first: `x^2-${constant}`, label: 'y1' }], start, end).curves[0].at;
    return [graphIntegral(f, start, end), graphSlope(f, x)];
  },
  sequence: (first: number, count: number) => engineeringSequence('2y', 'first', count, first, 0),
  surface: (span: number) => engineeringSurface('function', 'x^2+y^2', span)[24][12],
  lineTable: (start: number) => engineeringTable(['x^2+7'], start, start + 4, 1),
};

type Expected = number | boolean | Expected[];
type Case = { [K in keyof typeof handlers]: [K, Parameters<typeof handlers[K]>, Expected, number, number] }[keyof typeof handlers];
const rows: Case[] = JSON.parse(readFileSync(process.argv[2] ?? 0, 'utf8'));
if (!Array.isArray(rows) || rows.length === 0) throw new Error('Expected a nonempty calculator reference fixture.');
const report: Partial<Record<keyof typeof handlers, { checked: number; failed: number; maxNormalizedError: number }>> = {};
const failures: unknown[][] = [];
for (const [kind, args, expected, relative, absolute] of rows) {
  const record = report[kind] ??= { checked: 0, failed: 0, maxNormalizedError: 0 };
  record.checked++;
  const equal = (actual: unknown, ref: Expected): boolean => {
    if (Array.isArray(ref)) return Array.isArray(actual) && ref.length === actual.length && ref.every((item, i) => equal(actual[i], item));
    if (typeof ref === 'boolean') return actual === ref;
    if (typeof actual !== 'number' || !Number.isFinite(actual)) return false;
    const difference = Math.abs(actual - ref);
    const tolerance = absolute + relative * Math.abs(ref);
    record.maxNormalizedError = Math.max(record.maxNormalizedError, tolerance ? difference / tolerance : difference === 0 ? 0 : Infinity);
    return difference <= tolerance;
  };
  try {
    // The generated case's discriminator determines the argument tuple above.
    const actual = (handlers[kind] as (...args: Case[1]) => unknown)(...args);
    if (equal(actual, expected)) continue;
    failures.push([kind, args, expected, actual]);
  } catch (error) {
    failures.push([kind, args, expected, error instanceof Error ? error.message : String(error)]);
  }
  record.failed++;
}
console.table(report);
console.log(`${rows.length - failures.length}/${rows.length} independent reference cases passed`);
for (const failure of failures.slice(0, 25)) console.error(JSON.stringify(failure));
if (failures.length) process.exitCode = 1;
