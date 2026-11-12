import assert from 'node:assert/strict';
import test from 'node:test';
import { detectDialect, dialectForCountry, dialectInstruction, dialectLocale, normalizeArabic, resolveDialect } from '../src/utils/arabicDialect';
import { bargeIn, mergeHeard, speechWindow } from '../src/utils/shaheenVoice';
import { systemInstruction, validateChatRequest, voiceInstruction } from '../server/shaheen';

test('the way a visitor writes gives his dialect away', () => {
  assert.equal(detectDialect('عايز عطر خشبي ثابت أوي'), 'egyptian');
  assert.equal(detectDialect('وش أحسن عطر تبي أشتري الحين؟'), 'gulf');
  assert.equal(detectDialect('شو بدك أحسن عطر هلق؟ بدي شي منيح'), 'levantine');
  assert.equal(detectDialect('شلونك؟ شنو أحسن عطر عندكم؟ أريده هواية ثابت'), 'iraqi');
  assert.equal(detectDialect('واش عندكم عطر مزيان؟ بغيت شي حاجة دابا'), 'maghrebi');
  assert.equal(detectDialect('يا زول داير عطر هسي'), 'sudanese');
  assert.equal(detectDialect('اشتي عطر حلو دحين'), 'yemeni');
  // Standard Arabic, English or too little: no guess.
  assert.equal(detectDialect('ما هو أفضل عطر للشتاء؟'), undefined);
  assert.equal(detectDialect('best winter perfume'), undefined);
  // The first clear text decides (this message first, then his earlier ones).
  assert.equal(detectDialect('ما هو أفضل عطر؟', 'وش عندكم الحين'), 'gulf');
});

test('the dialect: his pick, then his words, then his Arab country, then Egyptian', () => {
  assert.equal(resolveDialect({ choice: 'levantine', texts: ['عايز عطر'], country: 'SA' }), 'levantine');
  assert.equal(resolveDialect({ choice: 'auto', texts: ['عايز عطر كده'], country: 'SA' }), 'egyptian');
  assert.equal(resolveDialect({ choice: 'auto', texts: ['ما أفضل عطر؟'], country: 'AE' }), 'gulf');
  assert.equal(resolveDialect({ texts: ['ما أفضل عطر؟'], country: 'ma' }), 'maghrebi');
  assert.equal(resolveDialect({ choice: 'bogus', texts: [], country: 'US' }), 'egyptian');
  assert.equal(dialectForCountry('JO'), 'levantine');
  assert.equal(dialectForCountry('FR'), undefined);
  // Speech engines get the visitor's own country accent when it is known.
  assert.equal(dialectLocale('gulf', 'AE'), 'ar-AE');
  assert.equal(dialectLocale('gulf', 'EG'), 'ar-SA');
  assert.equal(dialectLocale('maghrebi', 'TN'), 'ar-TN');
  assert.equal(normalizeArabic('إِزّيك يا أُستاذة!'), 'ازيك يا استاذه');
});

test('the engines are told the dialect, and a spoken turn is short and answers an interruption directly', () => {
  assert.match(systemInstruction('ar', '', undefined, { dialect: 'gulf' }), /الخليجية/);
  assert.match(systemInstruction('ar', '', undefined, { dialect: 'msa' }), /الفصحى المبسطة/);
  // Default (no dialect): Egyptian, as before.
  assert.match(systemInstruction('ar'), /المصرية العامية/);
  assert.doesNotMatch(systemInstruction('ar'), /صوتية/);
  assert.equal(voiceInstruction(undefined), '');
  assert.match(voiceInstruction({}), /صوتية/);
  const cut = voiceInstruction({ interrupted: 'العود الكمبودي «ثقيل» شوية و' });
  assert.match(cut, /قاطعك/);
  assert.match(cut, /العود الكمبودي "ثقيل" شوية/);
  assert.match(dialectInstruction('levantine'), /الشامية/);

  const request = validateChatRequest({ message: 'شو أحسن عطر؟', language: 'ar', dialect: 'auto', voice: { interrupted: 'كنت بقول' } }, 'EG');
  assert.equal(request.dialect, 'levantine');
  assert.deepEqual(request.voice, { interrupted: 'كنت بقول' });
  assert.equal(validateChatRequest({ message: 'ما أفضل عطر؟', language: 'ar' }, 'KW').dialect, 'gulf');
  assert.equal(validateChatRequest({ message: 'ما أفضل عطر؟', language: 'ar', country: 'IQ' }).dialect, 'iraqi');
  assert.equal(validateChatRequest({ message: 'best perfume?', language: 'en', dialect: 'gulf' }).dialect, undefined);
  assert.equal(validateChatRequest({ message: 'best perfume?', language: 'en' }).voice, undefined);
  // A card number said while interrupting never reaches an engine.
  assert.doesNotMatch(validateChatRequest({ message: 'تمام', language: 'ar', voice: { interrupted: 'رقم 4111 1111 1111 1111' } }).voice?.interrupted || '', /4111 1111 1111 1111/);
});

test('an interruption is the visitor talking, not Shaheen heard through the speakers', () => {
  const reply = 'أنصحك بعطر فيه عود وصندل مع لمسة فانيليا، ثباته عالي ومناسب جداً لليالي الشتا.';
  // His own words coming back (even slightly misheard) do not stop him.
  assert.equal(bargeIn('أنصحك بعطر فيه عود وصندل', reply).barge, false);
  assert.equal(bargeIn('عود وصندل مع لمسه فانيليا', reply).barge, false);
  assert.equal(bargeIn('', reply).barge, false);
  // The visitor's own words do, and are kept.
  const visitor = bargeIn('لا أنا عايز حاجة أرخص', reply);
  assert.equal(visitor.barge, true);
  assert.equal(visitor.said, 'لا أنا عايز حاجة أرخص');
  assert.equal(bargeIn('استنى', reply).barge, true);
  assert.equal(bargeIn('wait', 'This one has oud and sandalwood.').barge, true);
  // Mixed with his echo: only the visitor's words are kept.
  assert.equal(bargeIn('عود وصندل بكام الزجاجة الصغيرة', reply).said, 'بكام الزجاجة الصغيرة');

  assert.equal(mergeHeard('لا أنا عايز', 'لا أنا عايز حاجة أرخص'), 'لا أنا عايز حاجة أرخص');
  assert.equal(mergeHeard('استنى', 'عايز حاجة أرخص'), 'استنى عايز حاجة أرخص');
  assert.equal(mergeHeard('', 'عايز حاجة'), 'عايز حاجة');
  assert.equal(mergeHeard('بكام', ''), 'بكام');
  assert.equal(mergeHeard('بكام الزجاجة', 'الزجاجة الصغيرة'), 'بكام الزجاجة الصغيرة');
});

test('the interruption is faster and never mistakes Shaheen for the visitor', () => {
  const reply = 'أنصحك بعطر فيه عود وصندل مع لمسة فانيليا، ثباته عالي ومناسب جداً لليالي الشتا.';
  // What he is saying around now (the speakers can only bring back that part).
  const long = `${reply} وكمان عندنا اختيار تاني أخف شوية للنهار فيه برغموت وليمون وورد طائفي ومسك أبيض بسعر أقل.`;
  assert.match(speechWindow(long, 'أنصحك بعطر فيه عود'), /عود وصندل/);
  assert.doesNotMatch(speechWindow(long, 'أنصحك بعطر فيه عود'), /برغموت/);
  // Once the visitor was heard starting to talk, one clear word of his is enough.
  assert.equal(bargeIn('أرخص', reply).barge, false);
  assert.equal(bargeIn('أرخص', reply, { eager: true }).barge, true);
  // But his own word coming back is still not the visitor.
  assert.equal(bargeIn('صندل', reply, { eager: true }).barge, false);
  // A slightly misheard echo («فانيلا» for «فانيليا») is still his.
  assert.equal(bargeIn('مع لمسة فانيلا', reply).barge, false);
});
