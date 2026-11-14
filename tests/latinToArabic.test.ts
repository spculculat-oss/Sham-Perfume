import assert from 'node:assert/strict';
import test from 'node:test';
import { arabicSpeechText, soundInArabic } from '../src/utils/latinToArabic';
import { spokenReply } from '../src/utils/spokenReply';

test('Arabic speech keeps no English: notes and shop words in Arabic, other names in Arabic letters, codes dropped', () => {
  const reply = 'أنصحك بـ Dior Sauvage، وكمان Tom Ford Oud Wood. الـ top notes فيها bergamot و pepper. Free shipping مع DHL. SKU: LAT-095';
  const said = arabicSpeechText(spokenReply(reply, { language: 'ar', dialect: 'egyptian', words: 200 }).say);
  assert.doesNotMatch(said, /[A-Za-z]/, said);
  for (const part of ['ديور سوفاج', 'النوتات العليا', 'برغموت', 'فلفل', 'شحن مجاني', 'دي إتش إل']) assert.match(said, new RegExp(part), part);
  assert.doesNotMatch(said, /الال|095/);
  assert.equal(arabicSpeechText('مفيش إنجليزي هنا'), 'مفيش إنجليزي هنا');
});

test('a Latin word in Arabic letters, the way it sounds (hard g as «ج» in Egyptian, «غ» elsewhere)', () => {
  assert.equal(soundInArabic('Nomade'), 'نوماد');
  assert.equal(soundInArabic('Khamrah'), 'خامرة');
  assert.equal(soundInArabic('wood'), 'وود');
  assert.equal(soundInArabic('Gold'), 'جولد');
  assert.equal(soundInArabic('Gold', 'gulf'), 'غولد');
  assert.equal(soundInArabic('DHL'), 'دي إتش إل');
});
