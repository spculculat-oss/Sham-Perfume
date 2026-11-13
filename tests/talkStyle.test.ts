/**
 * «شاهين بيحكي مش بيقرا» (voice v3): a written reply re-said as talk, the naturalness meter, the whole-conversation
 * drills (training, held-out and two later exams), the platforms' spoken-style instruction and the quicker start.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { talkify } from '../src/utils/talkStyle';
import { spokenReply } from '../src/utils/spokenReply';
import { talkScore } from '../src/utils/talkScore';
import { talkChunks } from '../src/utils/shaheenVoice';
import { runTalkTraining, runTalkHeldout, runTalkExam2, runTalkExam3 } from '../scripts/talk-drill';
import { voiceInstruction, isSimpleQuestion } from '../server/shaheen';

const say = (text: string, dialect?: Parameters<typeof talkify>[1]['dialect']) => spokenReply(text, { language: 'ar', dialect, words: Infinity }).say;

test('a list is said as choices, not read as a list', () => {
  const said = say('بالتأكيد! إليك أفضل 3 عطور شتوية:\n\n1. **بديع العود** — عطر دافئ يتميز بثبات عالي.\n2. **عود مود** — يناسب السهرات ويدوم طويلاً.\n3. **هوس آيس**: منعش وخفيف.\n\nهل تريد أن أرشح لك المزيد؟');
  assert.match(said, /^عندي لك أفضل تلات عطور شتوية، أولهم بديع العود/);
  assert.match(said, /والتاني عود مود، بيناسب السهرات وبيقعد وقت طويل/);
  assert.match(said, /والتالت هوس آيس/);
  assert.match(said, /تحب أرشحلك أكتر؟$/);
  assert.ok(!/بالتأكيد|إليك|هل|\*|\d/u.test(said), said);
});

test('labels become phrases, steps are said in order, a table is said row by row with its columns', () => {
  assert.equal(say('### مواصفات العطر\n- السعر: 500 جنيه\n- الثبات: 8 ساعات\n- النوتات: عود، ورد، مسك\n- مناسب لـ: السهرات'),
    'مواصفات العطر، سعره خمسمية جنيه، وثباته حوالي تمن ساعات، وفيه عود، ورد، مسك، وينفع للسهرات.');
  const steps = say('لتخفيف الكحول اتبع الخطوات التالية:\n1. احسب الكمية المطلوبة.\n2. أضف الماء المقطر تدريجياً.\n3. قلّب جيداً واتركه يرتاح يومين.');
  assert.match(steps, /أول حاجة احسب الكمية المطلوبة\. وبعدين ضيف الماء المقطر واحدة واحدة\. وفي الآخر قلّب كويس وسيبه يرتاح يومين\./);
  const table = say('| المقارنة | عود ملكي | عنبر الليل |\n|---|---|---|\n| السعر | 1,250 جنيه | 980 جنيه |');
  assert.equal(table, 'السعر، عود ملكي ألف وميتين وخمسين جنيه، وعنبر الليل تسعمية وتمانين جنيه.');
});

test('written verbs, connectors and the written future are said the spoken way in each dialect', () => {
  assert.match(say('نعتذر بشدة عن هذا التأخير. سنتواصل مع شركة الشحن.'), /^إحنا آسفين قوي على التأخير ده\. وهنتواصل|^إحنا آسفين قوي على التأخير ده\. هنتواصل/);
  assert.match(say('سنتواصل مع شركة الشحن.', 'gulf'), /^راح نتواصل/);
  assert.match(say('سنتواصل مع شركة الشحن.', 'levantine'), /^رح نتواصل/);
  assert.match(say('سنتواصل مع شركة الشحن.', 'maghrebi'), /^غادي نتواصل/);
  assert.match(say('العطر ده ممكن يناسب الشتا، وهو يتميز بلمسة دافئة.'), /ممكن يناسب الشتا، وهو بيتميز بلمسة دافية/);
  assert.equal(say('من حيث الثبات، فإن عود ملكي هو الأثبت، بينما عنبر الليل أخف.'), 'في الثبات، عود ملكي هو الأثبت، بس عنبر الليل أخف.');
  assert.match(say('قلّب جيداً واتركه يرتاح.', 'levantine'), /قلّب منيح وخليه يرتاح/);
  // «ولكن» is «بس», never «وبس».
  assert.equal(say('العطر حلو ولكن غالي.'), 'العطر حلو بس غالي.');
  // From eleven on, the counted noun is singular; «من 5-7 أيام» is not «من من».
  assert.match(say('يدوم 11 ساعات.'), /حداشر ساعة/);
  assert.match(say('يستغرق التوصيل من 5-7 أيام.'), /بياخد التوصيل من خمس لسبع أيام/);
});

test('a natural opener now and then — never before an apology, a greeting or a question', () => {
  const replies = Array.from({ length: 12 }, (_, i) => `العود الكمبودي ريحته دخانية رقم ${i}. وبيليق على الشتا.`);
  const opened = replies.filter((r) => /^(?:بص|بصراحة|طيب|شوف)،/u.test(spokenReply(r, { language: 'ar', words: Infinity, opener: true }).say));
  assert.ok(opened.length >= 3 && opened.length <= 9, `${opened.length}`);
  for (const r of ['نعتذر عن التأخير. هنبعته بكرة.', 'أهلاً بيك! تحب أساعدك في إيه؟', 'تحب عود ولا مسك؟ قولي.']) {
    for (let i = 0; i < 4; i += 1) assert.ok(!/^(?:بص|بصراحة|طيب|شوف)،/u.test(spokenReply(`${r}${' '.repeat(i)}`, { language: 'ar', words: Infinity, opener: true }).say), r);
  }
  // The «اسمع الرد» button (no opener) says the reply as it is.
  assert.equal(spokenReply('العود بيثبت أكتر في الشتا. تحب أرشحلك واحد؟', { language: 'ar' }).say, 'العود بيثبت أكتر في الشتا. تحب أرشحلك واحد؟');
});

test('the naturalness meter catches page leftovers, written words, digits and a missing name', () => {
  assert.equal(talkScore('العود بيثبت أكتر في الشتا. تحب أرشحلك واحد؟', { language: 'ar' }).natural, true);
  const page = talkScore('بالتأكيد! إليك: - **عود** 500 جنيه', { language: 'ar' });
  assert.equal(page.natural, false);
  assert.ok(page.issues.some((i) => /تنسيق/.test(i)) && page.issues.some((i) => /أرقام/.test(i)) && page.issues.some((i) => /افتتاحية/.test(i)));
  assert.equal(talkScore('لدينا عطر يمكنك تجربته الآن.', { language: 'ar' }).natural, false);
  assert.equal(talkScore('الأرخص هو المسك.', { language: 'ar', refer: 'عنبر الليل' }).natural, false);
  assert.equal(talkScore('بص، نعتذر عن التأخير.', { language: 'ar' }).issues.includes('افتتاحية قبل اعتذار'), true);
});

test('whole conversations: training, held-out and the later exams stay natural, short, on context', () => {
  for (const [name, run, floor] of [['training', runTalkTraining, 0.98], ['held-out', runTalkHeldout, 0.95], ['exam 2', runTalkExam2, 0.95], ['exam 3', runTalkExam3, 0.95]] as const) {
    const report = run();
    assert.ok(report.conversations >= 24, name);
    for (const part of report.parts) assert.ok(part.right / part.total >= floor, `${name} — ${part.name}: ${part.right}/${part.total}\n${part.misses.slice(0, 5).join('\n')}`);
  }
  assert.ok(runTalkTraining().conversations + runTalkHeldout().conversations + runTalkExam2().conversations + runTalkExam3().conversations >= 500);
});

test('the platforms are told voice rules win over page rules, with a written → spoken pair in the visitor\'s dialect', () => {
  const egyptian = voiceInstruction({}, undefined, 'ar');
  assert.match(egyptian, /تتقدم على أي تعليمات تنسيق/);
  assert.match(egyptian, /بص، للشتا أنا شايف العود الملكي/);
  assert.match(egyptian, /ممنوع افتتاحيات الكتابة/);
  assert.match(voiceInstruction({}, 'gulf', 'ar'), /وإذا تبي شي أدفى/);
  assert.match(voiceInstruction({}, 'levantine', 'ar'), /بنصحك بالعود الملكي/);
  assert.doesNotMatch(voiceInstruction({}, undefined, 'en'), /مثال للفرق/);
});

test('a spoken turn starts sooner: the quicker tier answers it, and the first sentence is said alone', () => {
  const long = Array.from({ length: 5 }, (_, i) => ({ role: 'user' as const, text: `سؤال ${i}` }));
  assert.equal(isSimpleQuestion({ message: 'طب والأرخص فيهم؟', conversationHistory: long }), false);
  assert.equal(isSimpleQuestion({ message: 'طب والأرخص فيهم؟', conversationHistory: long, voice: {} }), true);
  assert.equal(isSimpleQuestion({ message: 'صمم لي تركيبة عود', conversationHistory: long, voice: {} }), false);
  const chunks = talkChunks('بص. العود الملكي ثباته جامد وبيقعد اليوم كله. ولو عايز حاجة أخف، المسك حلو. تحب تجرب؟');
  assert.equal(chunks[0], 'بص. العود الملكي ثباته جامد وبيقعد اليوم كله.');
  assert.equal(chunks.length, 3);
});
