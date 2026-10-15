import assert from 'node:assert/strict';
import { test } from 'node:test';
import { greetingKind, greetingReply } from '../src/utils/shaheenGreeting';

test('bare greetings in many forms are recognised, real questions are not', () => {
  for (const text of ['هاي', 'السلام عليكم', 'السلام عليكم ورحمة الله وبركاته', 'سلام عليكم يا شاهين', 'Hi', 'hello!!', 'هلا والله',
    'مرحباً', 'أهلاً', 'صباح الخير', 'ازيك يا شاهين', 'السلام عليكم، ازيك؟', 'هاااي 👋', 'Hey Shahin', 'bonjour', 'Merhaba']) {
    assert.ok(greetingKind(text), text);
  }
  for (const text of ['ايه افضل خلطة شتوية', 'السلام عليكم عايز تركيبة عود 50 مل', 'hi, how do I dilute 96% alcohol to 70%?',
    'مرحبا كم يوم اعتق العطر', 'شاهين', 'سلامة العطر على البشرة', 'hello world perfume formula']) {
    assert.equal(greetingKind(text), undefined, text);
  }
});

test('«السلام عليكم» is answered «وعليكم السلام», others get a welcome with examples, in the visitor language', () => {
  assert.equal(greetingKind('السلام عليكم'), 'salam');
  assert.equal(greetingKind('هاي'), 'hello');
  assert.match(greetingReply('salam', 'ar'), /^وعليكم السلام/);
  assert.match(greetingReply('hello', 'ar'), /الخبير شاهين/);
  assert.match(greetingReply('hello', 'en'), /Master Shahin/);
  assert.doesNotMatch(greetingReply('hello', 'ar') + greetingReply('salam', 'ar'), /DPG|Gemini|OpenAI|Claude|DeepSeek/);
});
