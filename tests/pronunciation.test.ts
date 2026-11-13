import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alignSounds, learnSounds, soundProfile, swapCost, vowelCost, EMPTY_SOUNDS } from '../src/utils/pronunciation';
import { heardDistance, planVoiceTurn } from '../src/utils/heardFix';

test('a confirmed word is lined up with what was heard: the swapped letters and dropped vowels', () => {
  assert.deepEqual(alignSounds('الب', 'قلب'), { swaps: ['اق'], vowels: 0 }, 'Egyptian «ألب» for «قلب»');
  assert.deepEqual(alignSounds('صندال', 'صندل'), { swaps: [], vowels: 1 });
  assert.deepEqual(alignSounds('زفت', 'زفت'), { swaps: [], vowels: 0 });
  // Far-apart pairs teach nothing (a change of mind, not a sound).
  assert.deepEqual(learnSounds(EMPTY_SOUNDS, 'عطر', 'مسك'), EMPTY_SOUNDS);
});

test('each dialect starts with the sounds it is known for', () => {
  assert.equal(swapCost(soundProfile('egyptian'), 'ق', 'ا'), 0.2, 'Egyptian «ق» said «ء»');
  assert.equal(swapCost(soundProfile('gulf'), 'ج', 'ي'), 0.2, 'Gulf «ج» said «ي»');
  assert.equal(swapCost(soundProfile('sudanese'), 'ق', 'غ'), 0.2, 'Sudanese «ق» said «غ»');
  assert.equal(swapCost(soundProfile('egyptian'), 'ج', 'ي'), undefined);
});

test('«التعلم من الاحتكاك»: the sounds of confirmed words make the next mishearing of that kind easy', () => {
  // A speaker whose long vowels the engine drops: after a few confirmed words, a dropped vowel costs less.
  const before = heardDistance('سمبل', 'سامبل', EMPTY_SOUNDS);
  let profile = soundProfile(undefined);
  profile = learnSounds(profile, 'فنيليا', 'فانيليا');
  profile = learnSounds(profile, 'عنبرر', 'عنبر');
  profile = learnSounds(profile, 'بتشولي', 'باتشولي');
  assert.ok(vowelCost(profile) < vowelCost(EMPTY_SOUNDS));
  assert.ok(heardDistance('سمبل', 'سامبل', profile) < before);
  // A letter swap seen in confirmed words (here «ك» heard as «ج») is learned too.
  const swaps = learnSounds(learnSounds(EMPTY_SOUNDS, 'جهرمان', 'كهرمان'), 'مسج', 'مسك');
  assert.equal(swapCost(swaps, 'ج', 'ك'), 0.2);
});

test('what the shared corrections taught is used for everyone (as text pairs only)', () => {
  // A word Shaheen would only ask about…
  const asked = planVoiceTurn('عايز عطر فيه جهرمان', { language: 'ar' });
  assert.equal(asked.action, 'ask');
  assert.equal(asked.action === 'ask' && asked.pending.corrected, 'عايز عطر فيه كهرمان');
  // …becomes sure once enough visitors confirmed words where «ك» was heard «ج».
  const learned = { مسج: 'مسك', جراميل: 'كراميل' };
  const sure = planVoiceTurn('عايز عطر فيه جهرمان', { language: 'ar', learned });
  assert.equal(sure.action, 'send');
  assert.equal(sure.action === 'send' && sure.text, 'عايز عطر فيه كهرمان');
});
