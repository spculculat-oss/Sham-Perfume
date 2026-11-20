import assert from 'node:assert/strict';
import test from 'node:test';
import { algebraInput, readEngineeringPolynomial, solveEngineeringAlgebra, transformEngineeringAlgebra as algebra } from '../src/utils/engineeringAlgebra';
import { compileEngineeringSampler, convertEngineeringUnit, ENGINEERING_CONSTANTS, ENGINEERING_UNITS, evaluateEngineeringValue as value, explainEngineeringCalculation } from '../src/utils/engineeringCalculator';
import { amortizeLoan, bondPrice, breakEven, cashFlowAnalysis, countCalendarDays, depreciation, effectiveRate, simpleInterest, timeValue } from '../src/utils/engineeringFinance';
import { analyzeEngineeringGraph, buildEngineeringGraph, engineeringSequence, engineeringSurface, graphIntegral, graphSlope, GRAPH_SAMPLES } from '../src/utils/engineeringGraph';
import { engineeringBoxPlot, inferMean, studentTwoSided } from '../src/utils/engineeringInference';
import { compareStudyAnswer, localStudyPlan, privateStudyText, readStudyPlan, readTutorReply, runStudyPlan } from '../src/utils/engineeringStudy';
import { copyableNumber, formatReadout } from '../src/components/engineering/calculatorDisplay';

const close = (actual: number | undefined, expected: number, tolerance = 1e-8) => {
  assert.notEqual(actual, undefined);
  assert.ok(Math.abs(actual! - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
};
const graph = (formula: string, lo = -5, hi = 5) => buildEngineeringGraph('cartesian', [{ first: formula, label: 'Y1' }], lo, hi);

test('recurring notation is exact, localizes the cycle, and copies an unambiguous expression', () => {
  const n = value('repeat(٠٫١،٦)');
  assert.deepEqual(n.exact, { numerator: 1n, denominator: 6n, symbol: undefined });
  assert.equal(copyableNumber(n, true), '1/6');
  assert.deepEqual(formatReadout(n, 'recurring', 9, 'DEG', 'en'), { text: '0.1(6)' });
  assert.deepEqual(formatReadout(value('repeat(-0,03)'), 'recurring', 9, 'DEG', 'ar'), { text: '−٠٫(٠٣)' });
  assert.equal(value('repeat(2.3,9)').re, 2.4);
  assert.equal(value('repeat(.0,06)').exact?.denominator, 165n);
  assert.equal(value('repeat(0,3)*3').re, 1);
  assert.equal(value('٥٠٪*٣٢').re, 16);
  assert.match((formatReadout(value('1/97'), 'recurring', 9, 'DEG', 'en') as { text: string }).text, /^≈ /);
  assert.match((formatReadout(value('pi'), 'recurring', 9, 'DEG', 'en') as { text: string }).text, /^≈ /);
  for (const bad of ['repeat(0,3+3)', 'repeat(0,-6)', 'repeat(0,0.6)', 'repeat(1e5,6)', 'repeat(2,1234567890123456789012345)']) assert.throws(() => value(bad));
});

test('polynomial transforms preserve rational coefficients and reject hidden singularities or unsupported input', () => {
  assert.equal(algebra('(س+٢)(س-٣)', 'simplify').result, 'x^2 - x - 6');
  assert.equal(algebra('X(X+1) - X^2', 'simplify').result, 'x');
  assert.equal(algebra('(x+1)^3/2', 'differentiate').result, '3/2*x^2 + 3*x + 3/2');
  assert.equal(algebra('x^2+3*x-2', 'integrate').result, '1/3*x^3 + 3/2*x^2 - 2*x + C');
  assert.equal(algebra('x-x', 'integrate').result, 'C');
  assert.equal(algebra('x^12', 'integrate').result, '1/13*x^13 + C');
  assert.equal(algebra('x^2-x-6', 'factor').result, '(x + 2)*(x - 3)');
  assert.equal(algebra('(-2*x+1)*(x-3)', 'factor').changed, true);
  assert.equal(algebra('x^2-2', 'factor').changed, false);
  for (const bad of ['(x^2-1)/(x-1)', 'x^13', 'x^(-2)', 'sin(x)', 'x+y', '1/(x-x)', 'x^12*x', 'a=b']) assert.throws(() => readEngineeringPolynomial(bad), Error, bad);
  assert.equal(algebraInput('س^٢ + نفس'), 'x^٢ + نفس');
});

test('algebra distinguishes exact linear and quadratic roots, identity and approximate higher-degree roots', () => {
  assert.equal(solveEngineeringAlgebra('3x=1').roots[0].exact, '1/3');
  assert.deepEqual(solveEngineeringAlgebra('x^2-5x+6=0').roots.map((r) => r.exact), ['2', '3']);
  assert.equal(solveEngineeringAlgebra('x^2-2').discriminant, '8');
  const rad = solveEngineeringAlgebra('-x^2+2');
  for (const [i, root] of rad.roots.entries()) {
    close(root.value.re, (i ? 1 : -1) * Math.SQRT2);
    close(value(root.exact!).re, root.value.re);
  }
  const complex = solveEngineeringAlgebra('2x^2 + 4x + 6=0');
  assert.deepEqual(complex.roots.map((r) => r.value.re), [-1, -1]);
  close(complex.roots[0].value.im, -Math.SQRT2);
  assert.equal(solveEngineeringAlgebra('(x+1)^2=x^2+2*x+1').kind, 'identity');
  assert.equal(solveEngineeringAlgebra('x+1=x').kind, 'inconsistent');
  assert.equal(solveEngineeringAlgebra('(x-2)^2').roots.length, 1);
  const quartic = solveEngineeringAlgebra('(x-1)*(x-2)*(x-3)*(x-4)');
  quartic.roots.forEach(({ exact, value }, i) => { assert.equal(exact, undefined); close(value.re, i + 1); });
  assert.throws(() => solveEngineeringAlgebra('x^5=1'));
});

test('Cartesian analysis separates roots, intersections, extremum, slope and signed area', () => {
  const g = buildEngineeringGraph('cartesian', [{ first: 'x^2-4', label: 'Y1' }, { first: 'x', label: 'Y2' }], -5, 5);
  assert.equal(g.curves[0].points.length, GRAPH_SAMPLES);
  const a = analyzeEngineeringGraph(g, 0);
  assert.equal(a.roots.length, 2);
  close(a.roots[0], -2); close(a.roots[1], 2);
  assert.equal(a.extrema.length, 1);
  close(a.extrema[0].x, 0, 1e-7); close(a.extrema[0].y, -4); assert.equal(a.extrema[0].min, true);
  assert.equal(a.intersections[0].points.length, 2);
  close(a.intersections[0].points[1].x, (1 + Math.sqrt(17)) / 2);
  close(graphSlope(g.curves[0].at, 3), 6);
  close(graphIntegral(g.curves[0].at, -2, 2), -32 / 3);
  close(graphIntegral(g.curves[0].at, 2, -2), 32 / 3);
  assert.equal(analyzeEngineeringGraph(graph('x-x'), 0).allZero, true);
  close(analyzeEngineeringGraph(graph('(x-0.234)^2'), 0).roots[0], 0.234, 1e-7);
  const pole = graph('1/(x-0.234)');
  assert.deepEqual(analyzeEngineeringGraph(pole, 0).roots, []);
  assert.equal(graphIntegral(pole.curves[0].at, -5, 5), undefined);
  assert.equal(graphSlope(graph('abs(x)').curves[0].at, 0), undefined);
  assert.equal(graph('1/x', -1, 1).curves[0].points[128], null);
  assert.throws(() => graph('sqrt(-1)'), /No real/);
  assert.throws(() => graph('x', 2, 2), /increasing/);
});

test('polar and parametric coordinates follow angle mode; meshes and recurrences have finite bounds', () => {
  const polar = buildEngineeringGraph('polar', [{ first: '2', label: 'r' }], 0, Math.PI * 2, { angleMode: 'RAD' });
  close(polar.curves[0].points[64]?.x, 0); close(polar.curves[0].points[64]?.y, 2);
  const parametric = buildEngineeringGraph('parametric', [{ first: '3*cos(t)', second: '2*sin(t)', label: 'P' }], 0, 400, { angleMode: 'GRAD' });
  close(parametric.curves[0].points[64]?.x, 0); close(parametric.curves[0].points[64]?.y, 2);
  const sphere = engineeringSurface('sphere', '', 2);
  assert.equal(sphere.length * sphere[0].length, 625);
  sphere.flat().forEach((p) => close(Math.hypot(...p!), 2));
  assert.deepEqual(engineeringSurface('function', 'x+y', 3)[0][0], [-3, -3, -6]);
  assert.throws(() => engineeringSurface('function', 'rand()', 1), /Random/);
  assert.throws(() => compileEngineeringSampler('integral(x,0,1)')(0), /nested/);
  assert.equal(compileEngineeringSampler('1/x')(0), null);
  assert.deepEqual(engineeringSequence('n^2', 'explicit', 4, 0, 0), [1, 4, 9, 16]);
  assert.deepEqual(engineeringSequence('y+z', 'second', 7, 1, 1), [1, 1, 2, 3, 5, 8, 13]);
  assert.deepEqual(engineeringSequence('y+n', 'first', 4, 1, 0), [1, 3, 6, 10]);
  assert.throws(() => engineeringSequence('n', 'explicit', 101, 0, 0));
});

test('constant names and conversion pairs cover the 47-entry and 40-command UK catalog', () => {
  assert.equal(ENGINEERING_CONSTANTS.length, 47);
  assert.equal(new Set(ENGINEERING_CONSTANTS.map(([key]) => key.toLowerCase())).size, 47);
  for (const [key, , reference] of ENGINEERING_CONSTANTS) assert.equal(value(key).re, reference, key);
  assert.equal(Object.keys(ENGINEERING_UNITS).length, 17);
  close(convertEngineeringUnit(1, 'length', 'n mile', 'm'), 1852);
  close(convertEngineeringUnit(1, 'volume', 'gal UK', 'L'), 4.54609);
  close(convertEngineeringUnit(760, 'pressure', 'mmHg', 'atm'), 1, 2e-7);
  close(convertEngineeringUnit(1, 'energy', 'kgf·m', 'J'), 9.80665);
  close(convertEngineeringUnit(1, 'data', 'MiB', 'B'), 1_048_576);
});

test('finance checks zero-rate payments, standard references and when IRR must not be claimed', () => {
  assert.deepEqual(simpleInterest(100, 0.01, 6), { interest: 6, total: 106 });
  close(timeValue('future', 100, 10, 0, 0, 12), 220);
  close(timeValue('future', 100, 10, 0, 0.1, 2, true), 144.1);
  close(timeValue('present', 0, 10, 144.1, 0.1, 2, true), 100);
  close(timeValue('payment', 100, 0, 144.1, 0.1, 2, true), 10);
  const loan = amortizeLoan(1200, 0, 12);
  assert.equal(loan.payment, 100); assert.equal(loan.rows.at(-1)?.balance, 0); assert.equal(loan.totalInterest, 0);
  close(amortizeLoan(1000, 0.12, 12).payment, 88.848788678);
  close(effectiveRate(0.12, 12), 0.12682503013197);
  const cash = cashFlowAnalysis([-100, 60, 60], 0.1);
  close(cash.npv, 4.13223140495867); close(cash.irr, 0.130662386291807); close(cash.payback, 5 / 3);
  assert.equal(cashFlowAnalysis([-100, 230, -132], 0.1).irr, undefined);
  close(bondPrice(1000, 0.06, 0.06, 2, 6), 1000);
  assert.deepEqual(depreciation(1000, 100, 10, 5), { expense: 90, bookValue: 550 });
  assert.equal(breakEven(1000, 40, 15).wholeUnits, 40);
  assert.equal(countCalendarDays('٢٠٢٤-٠٢-٢٨', '٢٠٢٤-٠٣-٠١'), 2);
  assert.throws(() => countCalendarDays('2025-02-29', '2025-03-01'));
  assert.throws(() => timeValue('future', 100, 5, 0, -1, 12));
  assert.throws(() => breakEven(1000, 10, 13));
});

test('one-sample t/z inference and box plots agree with reference cases', () => {
  close(studentTwoSided(1, 1), 0.5);
  close(studentTwoSided(2.7764451051977987, 4), 0.05);
  close(studentTwoSided(1.95996, 1000), 0.05027709, 2e-6);
  close(studentTwoSided(0, 5), 1);
  const t = inferMean([12, 13, 15, 14, 16], 12, 0.95);
  assert.equal(t.df, 4); close(t.mean, 14); close(t.statistic, Math.sqrt(8));
  close(t.interval[0], 12.0367568385); close(t.interval[1], 15.9632431615); close(t.p, 0.0474206555843);
  const z = inferMean([1, 2, 3, 4], 2.5, 0.95, 2);
  assert.equal(z.df, undefined); close(z.p, 1); close(z.interval[0], 0.54003601546);
  assert.throws(() => inferMean([1, 1], 0, 0.95), /error must be positive/);
  assert.throws(() => inferMean([1, 2], 0, 0.95, 0));
  const box = engineeringBoxPlot([16, 19, 20, 22, 24, 27, 100]);
  assert.equal(box.median, 22); assert.equal(box.q1, 19.5); assert.equal(box.q3, 25.5);
  assert.equal(box.upper, 27); assert.deepEqual(box.outliers, [100]);
});

test('tutoring separates a recognized question, untrusted AI, and bounded arithmetic work', () => {
  const plan = localStudyPlan('احسب ١٥٪ من ٢٤٠؟');
  assert.deepEqual(plan, { action: 'calculate', math: '15% * 240' });
  const percent = runStudyPlan(plan!);
  assert.equal(percent.kind, 'calculation');
  if (percent.kind === 'calculation') {
    assert.equal(percent.value.re, 36);
    assert.equal(compareStudyAnswer(percent.value, '٧٢/٢', 'DEG'), 'exact');
    assert.equal(compareStudyAnswer(percent.value, '35', 'DEG'), 'different');
    assert.throws(() => compareStudyAnswer(percent.value, 'Ans+36', 'DEG'));
  }
  assert.deepEqual(localStudyPlan('مساحة مستطيل طوله ١٢ وعرضه ٥'), { action: 'calculate', math: '12 * 5' });
  assert.deepEqual(localStudyPlan('حل:س²-٥س+٦=٠'), { action: 'solve', math: 'x²-٥x+٦=٠' });
  assert.equal(localStudyPlan('3x+2x')?.action, 'simplify');
  assert.equal(localStudyPlan('I walked 3 km, what is my speed?'), undefined);
  assert.equal(localStudyPlan('x+Ans'), undefined);
  assert.equal(readStudyPlan({ action: 'execute', math: '2+3' }), undefined);
  assert.ok(privateStudyText('student@example.com'));
  assert.equal(readTutorReply({ kind: 'suggestion', hint: 'Reach me at https://example.net.' }), undefined);
  assert.equal(readTutorReply({ kind: 'suggestion', hint: '<p>Invalid markup</p>' }), undefined);
  assert.throws(() => runStudyPlan({ action: 'calculate', math: 'rand()' }));
  const trace = explainEngineeringCalculation('2*(3+4)');
  assert.deepEqual(trace.steps.map((step) => [step.expression, step.value.re]), [['(3 + 4)', 7], ['(2 * (3 + 4))', 14]]);
  const numerical = runStudyPlan({ action: 'calculate', math: 'integral(exp(-x^2),0,1)' });
  if (numerical.kind !== 'calculation') assert.fail('expected a numerical result');
  close(numerical.value.re, 0.746824132812427);
  assert.equal(numerical.value.exact, undefined);
  assert.ok(explainEngineeringCalculation(Array(30).fill('1').join('+')).steps.length <= 16);
});
