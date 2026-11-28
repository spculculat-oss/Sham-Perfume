import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { initialTalkLanguage, languageAfterSentence, otherTalkLanguage, replyLanguageFor, sayAgainLine, writtenLanguage } from '../src/utils/talkLanguage';
import { validateChatRequest } from '../server/shaheen';
import { correctionFocus, needInstruction, PRECISE_ANSWER_INSTRUCTION } from '../src/utils/naturalTalk';

test('what a sentence is written in: plainly Arabic, plainly English, or not sure', () => {
  assert.equal(writtenLanguage('عايز عطر عود ثابت'), 'ar');
  assert.equal(writtenLanguage('I want a strong oud perfume for the evening'), 'en');
  assert.equal(writtenLanguage('what is this'), 'en');
  assert.equal(writtenLanguage('Je voudrais un parfum boisé'), undefined);
  assert.equal(writtenLanguage('i profumi di rosa'), undefined, 'Italian «i» is not English');
  assert.equal(writtenLanguage('من یک عطر می‌خواهم که خیلی ماندگار باشد'), undefined, 'Persian is not Arabic');
  assert.equal(writtenLanguage('چطوری'), undefined);
  assert.equal(writtenLanguage('OK'), undefined);
});

test('«يرد باللغة اللي اتكلم بيها»: his own language wins over the page\'s', () => {
  assert.equal(replyLanguageFor('هل صناعة العطور كانت موجودة أيام الفراعنة؟', 'en'), 'ar');
  assert.equal(replyLanguageFor('what is the best oud for the summer', 'ar'), 'en');
  assert.equal(replyLanguageFor('Quel est le meilleur parfum ?', 'fr'), 'fr');
  assert.equal(replyLanguageFor('I want to know what is the best perfume for me', 'fr'), 'en');
  assert.equal(replyLanguageFor('Chanel No 5', 'ar'), 'ar');
  assert.equal(replyLanguageFor('من یک عطر می‌خواهم', 'fa'), 'fa');
  assert.equal(replyLanguageFor('عطر', 'fa'), 'fa', 'an Arabic-script page keeps its language');
});

test('the server answers in the language he wrote in (the dialect too)', () => {
  const ar = validateChatRequest({ message: 'عايز عطر عود ثابت يا باشا', language: 'en' }, 'EG');
  assert.equal(ar.language, 'ar');
  const en = validateChatRequest({ message: 'what is the best perfume for the office', language: 'ar' }, 'EG');
  assert.equal(en.language, 'en');
  assert.equal(validateChatRequest({ message: 'Bonjour', language: 'fr' }, 'FR').language, 'fr');
});

test('the microphone starts in his language: his chat → his last choice → the page (Arabic for a plain Arab visitor)', () => {
  assert.equal(initialTalkLanguage({ site: 'en', typed: ['عايز عطر'] }), 'ar');
  assert.equal(initialTalkLanguage({ site: 'ar', typed: ['I want a gift for my wife'] }), 'en');
  assert.equal(initialTalkLanguage({ site: 'en', saved: 'ar' }), 'ar');
  assert.equal(initialTalkLanguage({ site: 'fr', saved: 'de' }), 'fr', 'an old choice of a third language is not used');
  assert.equal(initialTalkLanguage({ site: 'en', country: 'EG', deviceLanguages: ['ar-EG', 'en-US'] }), 'ar');
  assert.equal(initialTalkLanguage({ site: 'en', country: 'US', deviceLanguages: ['en-US'] }), 'en');
  assert.equal(initialTalkLanguage({ site: 'en', country: 'EG', deviceLanguages: ['en-US'] }), 'en', 'he set his device to English');
  assert.equal(otherTalkLanguage('en', 'en'), 'ar');
  assert.equal(otherTalkLanguage('ar', 'ar'), 'en');
  assert.equal(otherTalkLanguage('ar', 'fr'), 'fr');
});

test('after a sentence: words in the other language move the conversation; a badly heard first sentence asks again', () => {
  // Arabic heard while listening in English (the engine sometimes writes it): switch, no question.
  assert.deepEqual(languageAfterSentence({ heard: 'عايز عطر', current: 'en', site: 'en' }), { switchTo: 'ar', askAgain: false });
  assert.deepEqual(languageAfterSentence({ heard: 'I want something fresh for the gym', current: 'ar', site: 'ar' }), { switchTo: 'en', askAgain: false });
  assert.equal(languageAfterSentence({ heard: 'what is', confidence: 0.92, current: 'ar', site: 'ar' }).switchTo, undefined, 'a short ASR fragment must not flip Arabic speech to English');
  // Arabic said into the English engine comes back as unsure English words: an Egyptian visitor → Arabic, «say it again».
  assert.deepEqual(languageAfterSentence({ heard: 'is the cool mood', confidence: 0.32, current: 'en', site: 'en', country: 'EG' }), { switchTo: 'ar', askAgain: true });
  assert.equal(languageAfterSentence({ heard: 'is the cool mood', confidence: 0.32, current: 'en', site: 'en', country: 'US', deviceLanguages: ['en-US'] }).switchTo, undefined);
  // English speaker on the Arabic page with an Arabic-only phone: low-confidence Arabic ASR must ask again in English.
  assert.deepEqual(languageAfterSentence({ heard: 'kool prfm smmr', confidence: 0.28, current: 'ar', site: 'ar', country: 'EG', deviceLanguages: ['ar-EG'] }), { switchTo: 'en', askAgain: true });
  // Heard well, or the conversation already settled: nothing moves.
  assert.equal(languageAfterSentence({ heard: 'fresh perfume', confidence: 0.9, current: 'en', site: 'en', country: 'EG' }).switchTo, undefined);
  assert.equal(languageAfterSentence({ heard: 'is the cool mood', confidence: 0.3, current: 'en', site: 'en', country: 'EG', understood: 2 }).switchTo, undefined);
  assert.match(sayAgainLine('ar'), /قول تاني/);
  assert.match(sayAgainLine('en'), /say it again/);
});

test('the voice hook hears and speaks in the conversation\'s language, and a sound alone never stops or holds Shaheen', () => {
  const hook = readFileSync('src/hooks/useShaheenVoiceMode.ts', 'utf8');
  assert.match(hook, /speechLocaleFor\(talkLanguage, currentStoreCountry\(\), dialect\)/);
  assert.match(hook, /languageAfterSentence\(/);
  assert.match(hook, /watch\.onspeechstart = null;/);
  assert.match(hook, /if \(!candidate\.said\.trim\(\)\) \{ dropCandidate\(\); return; \}/);
  assert.match(hook, /const said = voiceFor\(text\);/, 'speech uses the conversation-language helper');
  assert.match(hook, /arabicSpeechOnly\(normalized, said\.dialect\)/, 'the final human-voice path strips English prose from Arabic audio');
  const stage = readFileSync('src/components/ShaheenVoiceStage.tsx', 'utf8');
  assert.match(stage, /data-testid="voice-talk-language"/);
});

test('«لا أنا ما بتكلمش عن كده، أنا بقولك…»: the correction is understood and the question meant is answered', () => {
  const said = 'يا عم لا انا ما بتكلمش عن كده انت بقول لك صناعه العطور اللي هو صناعه العطور زي اللي موجوده حاليا هل هي كانت موجوده ايام الفراعنه ولا لا';
  const focus = correctionFocus(said)!;
  assert.match(focus, /^صناعه العطور/);
  assert.match(focus, /الفراعنه ولا لا$/);
  const line = needInstruction(said);
  assert.match(line, /بيصحح فهمك/);
  assert.match(line, /أيوه \/ لأ/);
  assert.equal(correctionFocus('لا مش ده قصدي، قصدي العود الكمبودي'), 'العود الكمبودي');
  assert.equal(correctionFocus("No, that's not what I meant. I mean modern perfume making with alcohol"), 'modern perfume making with alcohol');
  // Not corrections: an ordinary question, «بقولك ايه» (= listen), «مش بحب».
  assert.equal(correctionFocus('ايه احسن عطر عود؟'), undefined);
  assert.equal(correctionFocus('بقولك ايه، عايز عطر للشغل'), undefined);
  assert.equal(correctionFocus('مش بحب الفانيليا'), undefined);
  // The first message of a chat corrects nothing.
  assert.doesNotMatch(needInstruction(said, { answered: false }), /بيصحح/);
  assert.match(PRECISE_ANSWER_INSTRUCTION, /صناعة العطور الحديثة/);
});

test('«شيل جملة الانتظار خالص»: nothing is said or shown before the reply, and English replies start with the answer', async () => {
  const hook = readFileSync('src/hooks/useShaheenVoiceMode.ts', 'utf8');
  assert.doesNotMatch(hook, /patienceLine|sayWhileLooking|plan\.filler/);
  for (const file of ['src/components/PerfumerAIChatbot.tsx', 'src/components/PerfumerMasterLabView.tsx']) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /lookingUpLine/, file);
  }
  const { talkify } = await import('../src/utils/talkStyle');
  for (const reply of ['The oud is strong. It lasts all day on the skin.', 'Rose and musk go well together. Try it in the evening.', 'This one is fresh. It suits the summer.', 'Amber is warm. It is best in winter.']) {
    assert.doesNotMatch(talkify(reply, { language: 'en' }), /^(?:So|Well|Honestly),/);
  }
});
