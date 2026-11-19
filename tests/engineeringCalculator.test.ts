import assert from 'node:assert/strict';
import test from 'node:test';
import {
  convertEngineeringUnit,
  evaluateEngineeringExpression,
  type EngineeringUnitCategory,
} from '../src/utils/engineeringCalculator';

const close = (actual: number, expected: number, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} is not close to ${expected}`);

test('engineering expression parser respects precedence, unary signs, right-associative powers and implicit multiplication', () => {
  assert.equal(evaluateEngineeringExpression('2 + 3 * 4'), 14);
  assert.equal(evaluateEngineeringExpression('-2^2'), -4);
  assert.equal(evaluateEngineeringExpression('2^3^2'), 512);
  assert.equal(evaluateEngineeringExpression('2(3 + 4) + 2pi'), 14 + Math.PI * 2);
  assert.equal(evaluateEngineeringExpression('5 mod 2'), 1);
});

test('scientific functions, constants, angle modes, combinations and last answer are supported', () => {
  close(evaluateEngineeringExpression('sin(30) + sqrt(16)'), 4.5);
  close(evaluateEngineeringExpression('sin(pi / 6)', { angleMode: 'RAD' }), 0.5);
  close(evaluateEngineeringExpression('asin(0.5)', { angleMode: 'DEG' }), 30);
  assert.equal(evaluateEngineeringExpression('5! + nCr(5, 2)'), 130);
  assert.equal(evaluateEngineeringExpression('ans * 2', { answer: 21 }), 42);
  assert.equal(evaluateEngineeringExpression('log(1000)'), 3);
  close(evaluateEngineeringExpression('root(-27, 3)'), -3);
  assert.equal(evaluateEngineeringExpression('g'), 9.80665);
  assert.equal(evaluateEngineeringExpression('R'), 8.314462618);
  assert.equal(evaluateEngineeringExpression('NA'), 6.02214076e23);
  assert.equal(evaluateEngineeringExpression('h'), 6.62607015e-34);
});

test('invalid, unsafe, and out-of-range expressions are rejected instead of evaluated as code', () => {
  for (const expression of ['1 / 0', 'sqrt(-1)', '2 ** 3', 'globalThis.process', 'unknown(2)', '171!', '(2 + 3']) {
    assert.throws(() => evaluateEngineeringExpression(expression), { name: 'Error' }, expression);
  }
});

test('engineering unit converter covers common mechanical, electrical and thermal units', () => {
  const convert = (value: number, category: EngineeringUnitCategory, from: string, to: string) => convertEngineeringUnit(value, category, from, to);
  assert.equal(convert(1, 'length', 'km', 'm'), 1000);
  assert.equal(convert(1, 'pressure', 'bar', 'Pa'), 100000);
  close(convert(0, 'temperature', '°C', '°F'), 32);
  close(convert(32, 'temperature', '°F', '°C'), 0);
  assert.equal(convert(1, 'power', 'kW', 'W'), 1000);
  assert.equal(convert(1, 'voltage', 'kV', 'V'), 1000);
  assert.equal(convert(60, 'frequency', 'Hz', 'kHz'), 0.06);
  assert.throws(() => convertEngineeringUnit(Number.NaN, 'length', 'm', 'cm'));
});

test('the scientific keypad accepts localized input and uses textbook implied multiplication', () => {
  assert.equal(evaluateEngineeringExpression('١٢٫٥ ÷ ۲٫۵'), 5);
  assert.equal(evaluateEngineeringExpression('٦÷٢(١+٢)'), 1);
  assert.equal(evaluateEngineeringExpression('٣²+٢³'), 17);
  assert.equal(evaluateEngineeringExpression('dms(-0,30,0)'), -0.5);
  assert.equal(evaluateEngineeringExpression('sin(100)', { angleMode: 'GRAD' }), 1);
  assert.equal(evaluateEngineeringExpression('cos(pi/2)', { angleMode: 'RAD' }), 0);
  assert.ok(evaluateEngineeringExpression('sin(1e-15)') > 0, 'tiny angles are not rounded to zero');
  for (const wrong of ['2..3', 'log(3,0)', 'tan(90)', '1/0', '3 4']) assert.throws(() => evaluateEngineeringExpression(wrong), Error);
  assert.throws(() => convertEngineeringUnit(1, 'temperature', 'm', 'K'));
});
