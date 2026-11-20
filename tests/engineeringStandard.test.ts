import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EngineeringError, evaluateEngineeringValue, evaluateStandardValue, previewStandardValue } from '../src/utils/engineeringCalculator';

const calc = (source: string) => evaluateStandardValue(source).re;

test('desk operations use key-entry order, not scientific precedence', () => {
  assert.equal(calc('٧٧−١٥÷١٠٠'), 0.62);
  assert.equal(calc('٧٧ − ١٥ ÷ ١٠٠ ＝ '), 0.62);
  assert.equal(calc('2+3*4'), 20);
  assert.equal(calc('10−2×3+9÷-3'), -11);
  assert.equal(calc('32÷4÷2'), 4);
  assert.equal(evaluateEngineeringValue('٧٧−١٥÷١٠٠').re, 76.85);
  assert.equal(evaluateEngineeringValue('2+3*4').re, 14);
  assert.equal(evaluateEngineeringValue('2*(3+4)').re, 14);
});

test('a pressed operator shows the running total without executing an unfinished chain', () => {
  const started = previewStandardValue('٧٧−');
  assert.equal(started.status, 'value');
  assert.equal(started.status === 'value' && started.value.re, 77);
  const beforeDivision = previewStandardValue('٧٧−١٥÷');
  assert.equal(beforeDivision.status, 'value');
  if (beforeDivision.status === 'value') {
    assert.equal(beforeDivision.subtotal, true);
    assert.equal(beforeDivision.value.re, 62);
  }
  const finished = previewStandardValue('٧٧−١٥÷١٠٠');
  assert.equal(finished.status, 'value');
  if (finished.status === 'value') {
    assert.equal(finished.subtotal, false);
    assert.equal(finished.value.re, 0.62);
  }
  assert.throws(() => calc('٧٧−١٥÷'), /number after the operator/);
  assert.deepEqual(previewStandardValue('٧٧−١٥÷='), { status: 'pending' });
});

test('desk decimals, negative entries and continuation preserve the full running value', () => {
  assert.equal(calc('٢٫٥×−٢+١'), -4);
  assert.equal(calc('1÷3×3'), 1);
  assert.equal(calc('9007199254740993-9007199254740992÷2'), 0.5);
  const first = evaluateStandardValue('77-15/100');
  assert.equal(first.exact?.numerator, 31n);
  assert.equal(first.exact?.denominator, 50n);
  assert.equal(evaluateStandardValue('Ans×100', first).re, 62);
  assert.equal(evaluateStandardValue('Ans×3', evaluateStandardValue('1/3')).re, 1);
});

test('standard mode does not reinterpret malformed numbers or scientific formulas', () => {
  for (const input of ['2^3', '1 2', '2(1+2)', '3+sin(0)', '200+10%', '5=4', '4==', '4//2']) {
    assert.throws(() => calc(input), EngineeringError, input);
    assert.deepEqual(previewStandardValue(input), { status: 'pending' });
  }
  assert.throws(() => calc('1÷0+7'), /divide by zero/);
  assert.deepEqual(previewStandardValue('1÷0+'), { status: 'pending' });
});
