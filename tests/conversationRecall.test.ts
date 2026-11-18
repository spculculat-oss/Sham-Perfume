import assert from 'node:assert/strict';
import test from 'node:test';
import { selectRelevantExchangeIndices } from '../src/utils/conversationRecall';

const turns = [
  { role: 'user' as const, text: 'بفضل العود الدافي في الشتاء' },
  { role: 'assistant' as const, text: 'تمام، تحب الروائح الدافئة.' },
  ...Array.from({ length: 12 }, (_, i) => [
    { role: 'user' as const, text: `موضوع عام مختلف ${i + 1}` },
    { role: 'assistant' as const, text: `إجابة عامة ${i + 1}` },
  ]).flat(),
];

test('conversation recall selects only relevant complete old exchanges and returns chronological indices', () => {
  const selected = selectRelevantExchangeIndices(turns, 'كنت قلت بحب العود؟', { recentTurnCount: 10 });
  assert.deepEqual(selected, [0, 1]);
});

test('conversation recall is bounded and excludes sensitive and unanswered exchanges', () => {
  const sensitive = [
    { role: 'user' as const, text: 'رقم تليفوني 01012345678 وبحب العود' },
    { role: 'assistant' as const, text: 'حاضر' },
    ...turns.slice(0, 20),
  ];
  assert.deepEqual(selectRelevantExchangeIndices(sensitive, 'العود', { recentTurnCount: 2 }), [2, 3]);
  assert.deepEqual(selectRelevantExchangeIndices(turns.slice(0, 1), 'العود', { recentTurnCount: 0 }), []);
  const result = selectRelevantExchangeIndices(turns, 'العود', { recentTurnCount: 10, maxTurns: 1 });
  assert.deepEqual(result, []); // never split user/assistant exchange to satisfy the turn limit
});

test('conversation recall does not match unrelated queries', () => {
  assert.deepEqual(selectRelevantExchangeIndices(turns, 'طريقة زراعة الطماطم', { recentTurnCount: 10 }), []);
});
