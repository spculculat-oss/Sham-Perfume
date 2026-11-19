import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateEngineeringExpression as e, evaluateEngineeringValue as value } from '../src/utils/engineeringCalculator';
import { calculateBaseN, calculateMatrix, calculateVector, engineeringTable, simulateMathBox, solveLinearSystem, solveNumericEquation, solvePolynomial, solvePolynomialInequality, solveRatio } from '../src/utils/engineeringAdvanced';
import { binomialProbability, fitRegression, inverseNormal, normalDensity, normalProbability, poissonProbability, summarizeStatistics } from '../src/utils/engineeringStatistics';
import { evaluateEngineeringSheet } from '../src/utils/engineeringSpreadsheet';
import { copyableNumber, formatReadout } from '../src/components/engineering/calculatorDisplay';

const close = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} is not close to ${expected}`);

test('textbook and engineering readouts only show exact fractions or surds when they are known', () => {
  const half = value('1/3+1/6');
  assert.equal(half.re, 0.5);
  assert.deepEqual(formatReadout(half, 'math', 9, 'DEG', 'en'), { whole: undefined, sign: '', top: '1', bottom: '2' });
  assert.deepEqual(formatReadout(half, 'decimal', 9, 'DEG', 'ar'), { text: '٠٫٥' });
  assert.deepEqual(formatReadout(value('7/3'), 'mixed', 9, 'DEG', 'en'), { whole: '2', sign: '', top: '1', bottom: '3' });
  assert.deepEqual(formatReadout(value('√(8)'), 'math', 9, 'DEG', 'en'), { text: '2√2' });
  assert.equal(copyableNumber(value('π/4 + π/4'), true), '1*pi/2');
  assert.equal(copyableNumber(value('sqrt(2)/sqrt(8)'), true), '1/2');
  assert.equal(value('sqrt(2)+sqrt(3)').exact, undefined);
  assert.deepEqual(formatReadout(value('1234'), 'eng', 9, 'RAD', 'en'), { text: '1.234×10^3' });
  assert.deepEqual(formatReadout(value('0.00012'), 'eng', 9, 'DEG', 'en'), { text: '120×10^−6' });
  assert.deepEqual(formatReadout(value('-2.5'), 'dms', 9, 'DEG', 'en'), { text: '−2° 30′ 0″' });
  assert.deepEqual(formatReadout(value('3/2'), 'fixed', 3, 'DEG', 'en'), { text: '1.500' });
});

test('answer, variables and function memory compose without rounding or recursion', () => {
  const third = value('1/3');
  assert.equal(e('3Ans', { answer: third }), 1);
  assert.equal(e('3A', { variables: { A: third } }), 1);
  assert.equal(e('C+E+c', { variables: {} }), 299_792_458, 'C and E are zero until stored');
  assert.equal(e('f(3)+g(4)', { functions: { f: 'x²+1', g: '2x' } }), 18);
  assert.throws(() => e('f(2)', { functions: { f: 'g(x)', g: 'f(x)' } }), /work limit/);
});

test('numeric calculus and finite products/sums are bounded and reject an undefined derivative', () => {
  close(e('integral(x^2,0,1)'), 1 / 3);
  close(e('integral(sin(x),pi,0)', { angleMode: 'RAD' }), -2);
  close(e('deriv(x^3,2)'), 12);
  assert.equal(e('sumx(x^2,1,4)'), 30);
  assert.equal(e('prodx(x,1,5)'), 120);
  assert.throws(() => e('deriv(abs(x),0)'), /does not exist/);
  assert.throws(() => e('integral(1/x,-1,1)'), /zero/);
  assert.throws(() => e('sumx(x,1,1001)'), /1,000/);
});

test('complex mode computes algebra, powers and polar conversion without accepting i in real mode', () => {
  const z = value('(2+3i)/(4-i)', { complex: true });
  close(z.re, 5 / 17);
  close(z.im, 14 / 17);
  assert.deepEqual(value('sqrt(-9)+2i', { complex: true }), { re: 0, im: 5 });
  assert.deepEqual(value('i^2', { complex: true }), { re: -1, im: 0 });
  assert.deepEqual(value('rect(3,90)', { complex: true }), { re: 0, im: 3 });
  assert.deepEqual(formatReadout(value('3i', { complex: true }), 'polar', 9, 'DEG', 'en'), { text: '3 ∠ 90°' });
  assert.throws(() => e('2i'));
});

test('matrix and vector modes compute products, determinant, inverse and coordinate geometry', () => {
  assert.deepEqual(calculateMatrix('multiply', [[1, 2], [3, 4]], [[2], [3]]), [[8], [18]]);
  assert.deepEqual(calculateMatrix('transpose', [[1, 2], [3, 4]]), [[1, 3], [2, 4]]);
  assert.deepEqual(calculateMatrix('inverse', [[2, 0], [0, 4]]), [[0.5, 0], [0, 0.25]]);
  close(calculateMatrix('det', [[1e150, 0, 0, 0], [0, 1e150, 0, 0], [0, 0, 1e-150, 0], [0, 0, 0, 3e-150]]) as number, 3);
  assert.throws(() => calculateMatrix('inverse', [[1, 2], [2, 4]]), /singular/);
  assert.deepEqual(calculateVector('cross', [1, 0, 0], [0, 1, 0]), [0, 0, 1]);
  close(calculateVector('angle', [1, 0], [0, 1], 'GRAD') as number, 100);
  assert.deepEqual(calculateVector('unit', [3, 4]), [0.6, 0.8]);
  assert.throws(() => calculateVector('angle', [0, 0], [0, 1]), /direction/);
});

test('equations report real, complex and repeated roots, and inequality intervals keep endpoint membership', () => {
  assert.deepEqual(solveLinearSystem([[1, 1], [1, -1]], [5, 1]), [3, 2]);
  assert.throws(() => solveLinearSystem([[1, 1], [2, 2]], [5, 1]), /unique/);
  assert.deepEqual(solvePolynomial([1, 0, 2, 0, 1]), [{ re: 0, im: -1 }, { re: 0, im: -1 }, { re: 0, im: 1 }, { re: 0, im: 1 }]);
  solvePolynomial([1, -10, 35, -50, 24]).forEach((z, i) => { close(z.re, i + 1); assert.equal(z.im, 0); });
  assert.deepEqual(solvePolynomial([1, -4, 6, -4, 1]), Array.from({ length: 4 }, () => ({ re: 1, im: 0 })));
  assert.deepEqual(solvePolynomialInequality([1, 0, -4], '<='), [{ from: -2, to: 2, includeFrom: true, includeTo: true }]);
  assert.deepEqual(solvePolynomialInequality([1, -2, 1], '<='), [{ from: 1, to: 1, includeFrom: true, includeTo: true }]);
  assert.deepEqual(solvePolynomialInequality([1, -2, 1], '>='), [{ from: -Infinity, to: Infinity, includeFrom: false, includeTo: false }]);
  assert.deepEqual(solvePolynomialInequality([1, 0, 1], '<'), []);
  close(solveNumericEquation('x^2=2', 1).root, Math.SQRT2);
  assert.throws(() => solveNumericEquation('x^2+1', 1), /convergence/);
});

test('base conversion respects signed 32-bit values and ratio uses the selected unknown', () => {
  assert.deepEqual(calculateBaseN('FF', '1', 16, '+'), { 2: '100000000', 8: '400', 10: '256', 16: '100' });
  assert.equal(calculateBaseN('0', '', 10, 'NOT')[16], 'FFFFFFFF');
  assert.throws(() => calculateBaseN('2147483647', '1', 10, '+'), /overflows/);
  assert.throws(() => calculateBaseN('102', '', 2, '='), /digits/);
  assert.equal(solveRatio(2, 3, 9, 'left'), 6);
  assert.equal(solveRatio(2, 3, 6, 'right'), 9);
  assert.throws(() => solveRatio(0, 3, 0, 'right'), /unique/);
});

test('statistics and all three distribution families produce expected reference values', () => {
  const statistics = summarizeStatistics([2, 4, 6, 8]);
  assert.equal(statistics.mean, 5);
  close(statistics.populationDeviation, Math.sqrt(5));
  close(statistics.sampleDeviation!, Math.sqrt(20 / 3));
  const linear = fitRegression('linear', [[1, 3], [2, 5], [3, 7]]);
  assert.deepEqual(linear.coefficients, [1, 2]);
  assert.equal(linear.predict(4), 9);
  const quad = fitRegression('quadratic', [[-1, 2], [0, 1], [1, 2], [2, 5]]);
  quad.coefficients.forEach((v, i) => close(v, [1, 0, 1][i]));
  close(fitRegression('power', [[1, 2], [2, 8], [3, 18]]).predict(4), 32);
  close(normalDensity(0, 0, 1), 0.3989422804014327);
  close(normalProbability(-1, 1, 0, 1), 0.6826894921370859);
  close(inverseNormal(0.975, 0, 1), 1.959963984540054);
  close(normalProbability(8, 9, 0, 1) / 6.219831985865831e-16, 1, 1e-6);
  close(binomialProbability(2, 10, 0.5, false), 45 / 1024);
  close(binomialProbability(2, 10, 0.5, true), 56 / 1024);
  close(poissonProbability(2, 2, true), 5 * Math.exp(-2));
  assert.throws(() => normalDensity(0, 0, 0));
});

test('spreadsheets resolve references and aggregates and flag errors and circular dependencies', () => {
  const entries = { A1: '2', A2: '3', B1: '=$A$1 * A2', B2: '=SUM(A1:A2) + A3', C1: '=D1 + 1', D1: '=C1', E1: '=C1', C2: '=A46', C3: '=sin(30)' };
  const sheet = evaluateEngineeringSheet(entries);
  assert.deepEqual(sheet.B1, { value: 6 });
  assert.deepEqual(sheet.B2, { value: 5 });
  assert.deepEqual(sheet.C3, { value: 0.5 });
  assert.deepEqual(sheet.C2, { error: 'formula' });
  for (const key of ['C1', 'D1', 'E1']) assert.deepEqual(sheet[key], { error: 'cycle' });
});

test('function tables sample up to 45 rows and Math Box frequencies match their reproducible trials', () => {
  assert.deepEqual(engineeringTable(['x^2', '1/x'], -1, 1, 1), [[-1, 1, -1], [0, 0, null], [1, 1, 1]]);
  assert.equal(engineeringTable(['x'], 0, 44, 1).length, 45);
  assert.throws(() => engineeringTable(['x'], 0, 45, 1), /45/);
  const report = simulateMathBox('dice', 3, 250, 2);
  assert.deepEqual(report, simulateMathBox('dice', 3, 250, 2));
  assert.equal(report.frequencies.reduce((n, f) => n + f.count, 0), 250);
  for (const f of report.frequencies) assert.equal(f.count, report.rolls.filter((r) => r.reduce((a, b) => a + b, 0) === f.outcome).length);
  assert.equal(simulateMathBox('coin', 2, 4, 1).frequencies.length, 3);
});
