import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runExam2, runHoldout, runVoiceBench, type BenchScore } from '../scripts/voice-bench';

const total = (parts: BenchScore[]) => {
  const right = parts.reduce((sum, part) => sum + part.right, 0);
  const all = parts.reduce((sum, part) => sum + part.total, 0);
  return { right, all, share: right / all, misses: parts.flatMap((part) => part.misses.map((miss) => `${part.name}: ${miss}`)) };
};

test('«التدريب المكثف»: every training moment is handled right (turn ends, who is spoken to, misheard words, echo)', () => {
  const score = total(runVoiceBench());
  assert.ok(score.all >= 160, 'the corpus stays large');
  assert.deepEqual(score.misses, []);
});

test('«الامتحان»: the held-out exams (never tuned on) stay at 95% or better', async () => {
  for (const [name, parts] of [['exam 1', await runHoldout()], ['exam 2', await runExam2()]] as const) {
    const score = total(parts);
    assert.ok(score.share >= 0.95, `${name}: ${score.right}/${score.all}\n${score.misses.join('\n')}`);
  }
});
