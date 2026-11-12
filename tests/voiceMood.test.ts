import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moodOf, moodTune, tunedVoice } from '../src/utils/voiceMood';

test('the visitor’s mood is read from his last sentences (an upset visitor first)', () => {
  assert.equal(moodOf(['الاوردر اتأخر اسبوع ومحدش رد عليا']), 'upset');
  assert.equal(moodOf(['انا مستعجل شوية، عايز عطر بسرعة']), 'hurried');
  assert.equal(moodOf(['خطوبتي الاسبوع الجاي وعايز حاجة تحفة']), 'happy');
  assert.equal(moodOf(['انا تعبان النهارده']), 'low');
  assert.equal(moodOf(['عايز عطر للشغل']), 'neutral');
  assert.equal(moodOf(['العطر تحفة', 'بس الشحن اتأخر ومشكلة']), 'upset', 'a complaint wins over a compliment');
  assert.equal(moodOf(['my order is late, this is terrible']), 'upset');
});

test('the voice follows the mood with small nudges, and never when he turned it off', () => {
  assert.ok(moodTune('upset').rate < 0 && moodTune('upset').pitch < 0, 'calmer for someone upset');
  assert.ok(moodTune('hurried').rate > 0, 'quicker for someone in a hurry');
  const choice = { rate: 0.96, pitch: 1 };
  assert.deepEqual(tunedVoice(choice, ['عايز عطر للشغل']), { rate: 0.96, pitch: 1, mood: 'neutral' });
  assert.equal(tunedVoice(choice, ['اتأخر ليه كده']).mood, 'upset');
  assert.deepEqual(tunedVoice({ ...choice, mood: false }, ['اتأخر ليه كده']), { rate: 0.96, pitch: 1, mood: 'neutral' });
  // Always within the engine's comfortable range.
  assert.ok(tunedVoice({ rate: 1.3, pitch: 1.5 }, ['مستعجل بسرعة']).rate <= 1.35);
});
