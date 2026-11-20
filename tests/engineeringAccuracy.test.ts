import assert from 'node:assert/strict';
import { test } from 'node:test';
import { convertEngineeringUnit, evaluateEngineeringExpression as calc, evaluateEngineeringValue as value, previewEngineeringValue } from '../src/utils/engineeringCalculator';
import { calculateBaseN, calculateMatrix, calculateVector, engineeringTable, simulateMathBox, solveNumericEquation, solvePolynomial, solvePolynomialInequality, solveRatio } from '../src/utils/engineeringAdvanced';
import { solveEngineeringAlgebra } from '../src/utils/engineeringAlgebra';
import { analyzeEngineeringGraph, buildEngineeringGraph, engineeringSequence, engineeringSurface, graphIntegral } from '../src/utils/engineeringGraph';
import { amortizeLoan, breakEven, cashFlowAnalysis, depreciation } from '../src/utils/engineeringFinance';
import { engineeringPercentField, splitEngineeringValues } from '../src/utils/engineeringInput';
import { studentTwoSided } from '../src/utils/engineeringInference';
import { binomialProbability, inverseNormal, normalProbability, poissonProbability, summarizeStatistics } from '../src/utils/engineeringStatistics';
import { evaluateEngineeringSheet } from '../src/utils/engineeringSpreadsheet';
import { compareStudyAnswer, localStudyPlan, runStudyPlan } from '../src/utils/engineeringStudy';
import { exactDecimalText, formatReadout } from '../src/components/engineering/calculatorDisplay';

function close(actual: number, expected: number, relative = 1e-10, absolute = 0) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= absolute + relative * Math.abs(expected), `${actual} vs reference ${expected}`);
}

test('squares and cubes are applied before a following percent, factorial or power', () => {
  assert.equal(calc('٢²!'), 24);
  assert.equal(calc('٢²٪'), 0.04);
  assert.equal(calc('2²³'), 64);
  assert.equal(calc('2²^3'), 64);
  assert.equal(calc('-2² + ٣ × √٩'), 5);
  assert.equal(calc('٣س+١', { variables: { x: 2 } }), 7);
  assert.equal(value('2πi', { complex: true }).im, 2 * Math.PI);
  assert.equal(calc('٢٠٠×(١+١٠٪)'), 220);
});

test('reported Arabic subtraction keeps the division and the decimal visible in fractional formats', () => {
  const source = '٧٧−١٥÷١٠٠';
  const result = value(source);
  assert.equal(result.re, 76.85);
  assert.deepEqual(result.exact, { numerator: 1537n, denominator: 20n, symbol: undefined });
  assert.deepEqual(previewEngineeringValue(source), { status: 'value', value: result });
  assert.deepEqual(formatReadout(result, 'mixed', 9, 'DEG', 'ar'), { whole: '٧٦', sign: '', top: '١٧', bottom: '٢٠' });
  assert.equal(exactDecimalText(result, 'ar'), '٧٦٫٨٥');
  assert.equal(exactDecimalText(value('-76.85'), 'ar'), '−٧٦٫٨٥');
  assert.equal(exactDecimalText(value('76+1/3'), 'ar'), undefined, 'do not label a rounded value as equal');
  assert.equal(exactDecimalText(value('77'), 'ar'), undefined, 'do not repeat an integer result');
  const plan = localStudyPlan(`احسب ${source}؟`);
  assert.ok(plan);
  const worked = runStudyPlan(plan);
  assert.equal(worked.kind, 'calculation');
  assert.equal(worked.kind === 'calculation' && exactDecimalText(worked.steps[0].value, 'ar'), '٠٫١٥');
  assert.equal(worked.kind === 'calculation' && exactDecimalText(worked.value, 'ar'), '٧٦٫٨٥');
});

test('the scientific entry token joins the mantissa before doing any arithmetic', () => {
  assert.equal(previewEngineeringValue('1÷2ᴇ').status, 'pending');
  assert.equal(calc('١÷٢ᴇ٣'), 0.0005);
  assert.equal(calc('2ᴇ-3^2'), 0.000004);
  assert.equal(calc('2e'), 2 * Math.E, 'Euler’s number remains available');
  assert.equal(calc('C+E'), 0, 'unassigned uppercase variables are zero, not lowercase constants');
  assert.equal(calc('C+E', { variables: { C: 7, E: 9 } }), 16);
  assert.equal(calc('c'), 299_792_458);
});

test('literal, exact arithmetic and display do not erase a meaningful last digit', () => {
  const raw = '5920597.0043472545';
  assert.equal(calc(`-${raw}`), Number(`-${raw}`));
  assert.equal(calc('sum(1e16,1,-1e16)'), 1);
  assert.equal(calc('1 mod 0.1'), 0);
  assert.equal(calc('mod(-5/3,1/2)'), -1 / 6);
  assert.equal(calc('floor(9007199254740992.5)-9007199254740992'), 0);
  assert.throws(() => calc('5.000000000000000001!'), /whole numbers/);
  assert.equal(value('30!').exact?.numerator, 265252859812191058636308480000000n);
  assert.equal(calc('f(9007199254740993)', { functions: { f: 'x-9007199254740992' } }), 1);
  assert.deepEqual(formatReadout(value('10000000000000002'), 'math', 9, 'DEG', 'ar'), { text: '١٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٢' });
  assert.deepEqual(formatReadout(value('1234'), 'sci', 0, 'DEG', 'en'), { text: '1×10^3' });
});

test('finite sums, exponents and logs keep the input precision where mathematically significant', () => {
  assert.equal(calc('sumx(1e16+x-1e16,1,1)'), 1);
  assert.equal(calc('prodx(1e16+x-1e16,1,3)'), 6);
  assert.equal(calc('(-1)^9007199254740993'), -1);
  assert.equal(value('(-1)^9007199254740993', { complex: true }).re, -1);
  close(calc('ln(1+1e-20)'), 1e-20, 1e-14);
  assert.equal(calc('log(1+1e-20,1+2e-20)'), 0.5);
  assert.equal(calc('root(-8,3)'), -2);
  assert.throws(() => calc('root(-8,3.000000000000000001)'), /odd integer/);
  assert.throws(() => calc('(-4)^1.000000000000000001'), /root/);
  for (const source of ['10^-400', '1e-200*1e-200', '1e-200/1e200']) assert.throws(() => calc(source), /too small/);
});

test('trig matches the correct quadrant and keeps near-poles separate from undefined angles', () => {
  close(calc('sin(1e100)', { angleMode: 'RAD' }), -0.3806377310050287, 1e-14);
  close(calc('cos(-5920597.0043472545)', { angleMode: 'RAD' }), -0.18304024804745525, 1e-14);
  assert.equal(calc('sin(13*pi/6)', { angleMode: 'RAD' }), 0.5);
  assert.equal(calc('cos(200)', { angleMode: 'GRAD' }), -1);
  assert.throws(() => calc('tan(pi/2)', { angleMode: 'RAD' }), /undefined/);
  assert.throws(() => calc('tan(270)'), /undefined/);
  close(calc('cos(90+1e-20)'), -Math.PI / 180 * 1e-20, 1e-13);
  close(calc('tan(90+1e-20)'), -180 / Math.PI / 1e-20, 1e-13);
  const tiny = value('sqrt(5e-324i)', { complex: true });
  close(tiny.re, Math.sqrt(Number.MIN_VALUE) / Math.SQRT2, 1e-13);
  close(tiny.im, tiny.re, 1e-13);
  assert.deepEqual(value('1e308/(0.5+0.5i)', { complex: true }), { re: 1e308, im: -1e308 });
});

test('inverse trig preserves exact inputs at either side of its real endpoints', () => {
  for (const fn of ['asin', 'acos']) {
    for (const input of ['1+1e-20', '-1-1e-20', '1.01', '-1.01']) {
      assert.throws(() => calc(`${fn}(${input})`), /from −1 to 1/);
    }
  }
  // acos(1 − 10⁻²⁰) = sqrt(2 × 10⁻²⁰) to better than double precision.
  const gap = 1.414213562373095e-10;
  close(calc('acos(1-1e-20)', { angleMode: 'RAD' }), gap, 1e-14);
  close(calc('acos(1-1e-20)', { angleMode: 'DEG' }), gap * 180 / Math.PI, 1e-14);
  close(calc('asin(-1+1e-20)', { angleMode: 'RAD' }), -Math.PI / 2 + gap, 2e-16);
  assert.equal(calc('acos(1)'), 0);
  close(calc('acos(-1)', { angleMode: 'GRAD' }), 200, 2e-16);
  close(calc('asin(-1)'), -90, 2e-16);
});

test('calculus does not accept an aliased integral, a pole, or a tiny corner as a correct result', () => {
  close(calc('integral(cos(360*32*x),0,1)'), 0, 0, 1e-11);
  close(calc('integral(exp(-x^2),0,1)'), 0.746824132812427, 1e-10);
  assert.throws(() => calc('integral(1/x,0,0)'), /zero/);
  assert.throws(() => calc('integral(1/(x-0.233),0,1)'), /converge|zero/);
  assert.throws(() => calc('deriv(abs(x)*1e-6,0)'), /derivative/);
  close(calc('deriv(x^2/10000,1)'), 0.0002, 1e-9);
});

test('matrix determinant preserves a nonzero small pivot and vector angle resolves near-parallel inputs', () => {
  assert.equal(calculateMatrix('det', [[1, 1], [1, 1.0000000000000002]]), 2e-16);
  assert.throws(() => calculateMatrix('inverse', [[1, 1], [1, 1.0000000000000002]]), /ill-conditioned/);
  assert.equal(calculateVector('angle', [1, 1], [2, 2]), 0);
  close(calculateVector('angle', [1, 0], [1, 1e-10], 'RAD') as number, 1e-10, 1e-13);
  assert.equal(calculateVector('dot', [1e16, 1, 1e16], [1, 1, -1]), 1);
});

test('polynomial inequality distinguishes touching, nearly touching and complex roots', () => {
  assert.deepEqual(solvePolynomialInequality([1, -2, 1.0000000000000002], '<='), []);
  assert.deepEqual(solvePolynomialInequality([1, -4, 6, -4, 1.000000000000002], '<='), []);
  const [band] = solvePolynomialInequality([1, -2, 0.9999999999999998], '<');
  assert.ok(band.from < 1 && band.to > 1);
  assert.ok(!band.includeFrom && !band.includeTo);
  assert.deepEqual(solvePolynomialInequality([1, -4, 6, -4, 1], '<='), [{ from: 1, to: 1, includeFrom: true, includeTo: true }]);
  const roots = solvePolynomial([1, 4, 10, 12, 9]); // (x²+2x+3)^2
  roots.forEach((root, i) => { assert.equal(root.re, -1); close(root.im, (i < 2 ? -1 : 1) * Math.SQRT2); });
  const small = solveEngineeringAlgebra('x^2-1e16*x+2=0').roots[0];
  close(small.value.re, 2e-16);
  assert.ok(small.exact);
});

test('polynomial solvers reproduce generated factors, not just small residuals', () => {
  let seed = 1783;
  const next = () => (seed = (Math.imul(1664525, seed) + 1013904223) >>> 0);
  for (let i = 0; i < 150; i++) {
    const roots = Array.from({ length: 2 + i % 3 }, () => next() % 15 - 7).sort((a, b) => a - b);
    const coefficients = roots.reduce((terms, root) => {
      const product = Array<number>(terms.length + 1).fill(0);
      terms.forEach((term, j) => { product[j] += term; product[j + 1] -= term * root; });
      return product;
    }, [1]);
    const found = solvePolynomial(coefficients);
    assert.equal(found.length, roots.length);
    found.forEach((root, j) => { close(root.re, roots[j], 1e-12, 1e-12); assert.equal(root.im, 0); });
    const ranges = solvePolynomialInequality(coefficients, '>=');
    for (let x = -8.5; x <= 8.5; x++) {
      assert.equal(ranges.some(({ from, to }) => x > from && x < to), roots.reduce((p, y) => p * (x - y), 1) > 0);
    }
  }
});

test('numerical solver distinguishes a verifiable root from an underflowed or constant zero', () => {
  assert.throws(() => solveNumericEquation('0', 3), /isolated root/);
  assert.throws(() => solveNumericEquation('exp(-x)', 800), /too small/);
  assert.throws(() => solveNumericEquation('x-rand()', 1), /Random/);
  assert.throws(() => solveNumericEquation('max(x,0)', 0), /isolated root/);
  assert.throws(() => solveNumericEquation('(x-.234)^2+1e-16', .23), /convergence/);
  assert.throws(() => solveNumericEquation('1e-100/(x-.234)', .23), /convergence/);
  assert.deepEqual(solveNumericEquation('(x-.234)^2', .23), { root: .234, residual: 0 });
  close(solveNumericEquation('س²＝٢', 1).root, Math.SQRT2);
  close(solveNumericEquation('x^2=2', Math.SQRT2).root, Math.SQRT2);
  close(solveNumericEquation('1e30 + x = 1e30 + 3', 4).root, 3);
});

test('small normal intervals and representable distribution tails do not get cancelled to zero', () => {
  close(studentTwoSided(12, 179), 1.0095175287215917e-24, 1e-11);
  close(studentTwoSided(1e200, 1), 6.366197723675814e-201, 1e-11);
  close(normalProbability(-1e-18, 1e-18, 0, 1), 7.978845608028654e-19, 1e-12);
  close(normalProbability(8, 9, 0, 1), 6.219831985865831e-16, 1e-12);
  close(inverseNormal(1e-100, 0, 1), -21.273453560965322, 1e-11);
  close(binomialProbability(2, 10, 0.5, true), 56 / 1024);
  close(poissonProbability(2, 2, true), 5 * Math.exp(-2));
  const s = summarizeStatistics([1e16, 1, -1e16]);
  assert.equal(s.sum, 1);
  assert.equal(s.mean, 1 / 3);
  assert.equal(s.median, 1);
});

test('percentage fields do not divide twice and lists keep nested arguments and empty periods distinct', () => {
  assert.equal(engineeringPercentField('٥٪'), 0.05);
  assert.equal(engineeringPercentField('٩٥'), 0.95);
  assert.equal(engineeringPercentField('-(١٠/٢)٪'), -0.05);
  assert.throws(() => engineeringPercentField('5%%'), /one %/);
  assert.throws(() => engineeringPercentField('5%+1'), /percentage/);
  assert.deepEqual(splitEngineeringValues('log(٨،٢)، (١ + ٢) ٦').map((val) => calc(val)), [3, 3, 6]);
  assert.throws(() => splitEngineeringValues('-1000,,1100'), /skip/);
  assert.deepEqual(splitEngineeringValues('-1000, 0, 1100'), ['-1000', '0', '1100']);
});

test('finance: a decimal contribution margin does not add a unit, and loan payments stay level', () => {
  assert.deepEqual(breakEven(3, 0.3, 0.2), { units: 30, wholeUnits: 30, revenue: 9, margin: 0.1 / 0.3 });
  assert.equal(breakEven(3.0000000000000004, 0.3, 0.2).wholeUnits, 31);
  const loan = amortizeLoan(1000, 1, 600);
  assert.equal(loan.rows.at(-1)?.payment, loan.payment);
  assert.equal(loan.rows.at(-1)?.balance, 0);
  close(loan.rows.reduce((s, r) => s + r.principal, 0), 1000, 1e-12);
  close(loan.totalPaid - loan.totalInterest, 1000, 1e-12);
  assert.equal(amortizeLoan(1200, 0, 12).rows[0].balance, 1100);
  close(amortizeLoan(1e308, 0, 12).rows[0].balance, 1e308 / 12 * 11, 1e-14);
  assert.equal(cashFlowAnalysis([1e15, 0.01, -1e15], 0).npv, 0.01);
  assert.equal(depreciation(1e16, 1e16 - 2, 2, 1).expense, 1);
  assert.equal(depreciation(1e12, 0, 5, 3, 1e-20).expense, 1e-8);
  assert.equal(cashFlowAnalysis([-100, 10100], 0.05).irr, 100);
});

test('graph checks solve the curve, not a pole or a merely close minimum', () => {
  const graph = (first: string) => buildEngineeringGraph('cartesian', [{ first, label: 'Y1' }], -1, 1);
  assert.deepEqual(analyzeEngineeringGraph(graph('(x-0.234)^2+1e-16'), 0).roots, []);
  assert.deepEqual(analyzeEngineeringGraph(graph('1/(x-0.233)'), 0).roots, []);
  close(analyzeEngineeringGraph(graph('(x-0.234)^2'), 0).roots[0], 0.234, 1e-13);
  close(graphIntegral(graph('cos(360*32*x)').curves[0].at, 0, 1)!, 0, 0, 1e-11);
  const path = buildEngineeringGraph('parametric', [{ first: '2t', second: '-3t', label: 'C1' }], 0, 1);
  assert.deepEqual(path.curves[0].points[256], { t: 1, x: 2, y: -3 });
  assert.deepEqual(engineeringSequence('2n', 'explicit', 4, 0, 0), [2, 4, 6, 8]);
  assert.deepEqual(engineeringSurface('function', 'x^2+y^2', 2)[24][12], [2, 0, 4]);
});

test('table and spreadsheet use the actual input grid and carry exact references', () => {
  assert.deepEqual(engineeringTable(['x'], 0, 0.999999999999, 1), [[0, 0]]);
  assert.deepEqual(engineeringTable(['x'], 0.1, 0.3, 0.1), [[0.1, 0.1], [0.2, 0.2], [0.3, 0.3]]);
  assert.throws(() => engineeringTable(['rand()'], 0, 1, 1), /Random/);
  const sheet = evaluateEngineeringSheet({ a1: '9007199254740993', B1: '=A1-9007199254740992', B2: '=SUM($A$١:A١)-9007199254740992', B3: '=A1(2)-18014398509481984', C1: '=avg(B1:B3)', C2: '=SUM(A2:A5)' });
  assert.equal('exactInteger' in sheet.A1 && sheet.A1.exactInteger, '9007199254740993');
  assert.deepEqual(sheet.B1, { value: 1 });
  assert.deepEqual(sheet.B2, { value: 1 });
  assert.deepEqual(sheet.B3, { value: 2 });
  assert.deepEqual(sheet.C1, { value: 4 / 3 });
  assert.deepEqual(sheet.C2, { value: 0 });
});

test('units, base, ratio, simulation and study reference checks remain consistent at boundaries', () => {
  close(convertEngineeringUnit(1e308, 'length', 'km', 'mi'), 6.213711922373339e307, 1e-14);
  assert.equal(convertEngineeringUnit(-40, 'temperature', '°C', '°F'), -40);
  assert.equal(convertEngineeringUnit(-459.67, 'temperature', '°F', 'K'), 0);
  assert.throws(() => convertEngineeringUnit(-1, 'temperature', 'K', '°C'), /below/);
  assert.equal(calculateBaseN('80000000', '', 16, '=')[10], '-2147483648');
  assert.equal(solveRatio(1e200, 1e-150, 1e-150, 'left'), 1e200);
  const simulation = simulateMathBox('coin', 3, 50, 9);
  assert.equal(simulation.frequencies.reduce((n, entry) => n + entry.count, 0), 50);
  assert.ok(simulation.rolls.every((row) => row.every((v) => v === 0 || v === 1)));
  assert.equal(compareStudyAnswer(value('exp(-50)'), '0', 'DEG'), 'different');
});
