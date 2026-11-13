/**
 * «تدريب وش عمل» — Shaheen's hands-on practice really runs: code executes, calculations are computed,
 * perfume formulas are designed with percentages that really sum to 100, and the repository is inspected.
 * Nothing is simulated.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { designFormula, formulaPercents, formulaText, runPractice } from '../scripts/shaheen-school/practice';
import { emptyMemory, recallSimilar } from '../src/utils/shaheenMemory';

test('every hands-on exercise really runs and passes', () => {
  const report = runPractice(emptyMemory(), '2026-10-22T00:00:00.000Z');
  assert.ok(report.total >= 14, `only ${report.total} exercises`);
  assert.equal(report.passed, report.total, `failed: ${report.items.filter((i) => !i.ok).map((i) => i.id).join(', ')}`);
  for (const item of report.items) assert.ok(item.detail.length > 10, `${item.id} reports what it did`);
  assert.equal(report.at, '2026-10-22T00:00:00.000Z');
});

test('the formula design is real work: percentages sum to 100 and the answer is taught to memory', () => {
  for (const kind of ['citrus-summer', 'oriental-winter'] as const) {
    const f = designFormula(kind);
    const parts = formulaPercents(f);
    assert.equal(parts.reduce((a, b) => a + b, 0), 100, `${kind} percentages`);
    assert.ok(parts.every((p) => p > 0), `${kind} has no empty part`);
    assert.ok(formulaText(f, 'en').includes('100%'));
    assert.ok(formulaText(f, 'ar').includes('100%'));
  }
  const memory = emptyMemory();
  const report = runPractice(memory, '2026-10-22T00:00:00.000Z');
  assert.ok(report.taught >= 2, 'the designed answers are really taught');
  const hit = recallSimilar(memory, 'Suggest a fresh citrus perfume formula for summer with percentages', 'en');
  assert.ok(hit, 'the English formula question is answered from memory after practice');
  assert.match(hit!.entry.answer, /bergamot/);
  const ar = recallSimilar(memory, 'ايه هي تصميم تركيبة شتوية شرقية؟', 'ar');
  assert.ok(ar, 'the Arabic formula question is answered too');
  assert.match(ar!.entry.answer, /عود/);
});
