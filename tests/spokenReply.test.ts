import assert from 'node:assert/strict';
import { test } from 'node:test';
import { everydayWords, numberInWords, speakArabicNumbers, spokenReply, wantsMore } from '../src/utils/spokenReply';
import { pickShaheenVoice } from '../src/utils/shaheenVoice';
import { voiceInstruction } from '../server/shaheen';
import { ShaheenMemory } from '../server/core/memory';
import { MemoryStore } from '../server/core/store';
import { emptyMemory, remember } from '../src/utils/shaheenMemory';

test('numbers are said the way people say them, in the dialect', () => {
  const said = (n: number) => numberInWords(n);
  assert.equal(said(25), 'خمسة وعشرين');
  assert.equal(said(150), 'مية وخمسين');
  assert.equal(said(1250), 'ألف وميتين وخمسين');
  assert.equal(said(3000), 'تلات تلاف');
  assert.equal(said(15500), 'خمستاشر ألف وخمسمية');
  assert.equal(said(2026), 'ألفين وستة وعشرين');
  assert.equal(numberInWords(13, 'gulf'), 'ثلاثطعش');
  assert.equal(numberInWords(250, 'msa'), 'مئتان وخمسون');
});

test('prices, units, percentages, ranges and math are spoken, not read', () => {
  assert.equal(speakArabicNumbers('السعر 1,250 جنيه والتاني 980 ج.م'), 'السعر ألف وميتين وخمسين جنيه والتاني تسعمية وتمانين جنيه');
  assert.equal(speakArabicNumbers('السعر \u200F21 € والتاني \u200F16.50 €'), 'السعر واحد وعشرين يورو والتاني ستاشر يورو ونص');
  assert.equal(speakArabicNumbers('\u200F88 ر.س.\u200F'), 'تمانية وتمانين ريال');
  assert.equal(speakArabicNumbers('\u200F7.30 د.ك.\u200F'), 'سبعة فاصلة تلاتين دينار');
  assert.equal(speakArabicNumbers('زجاجة 50 مل بتركيز 20% وثبات 6-8 ساعات'), 'زجاجة خمسين مللي بتركيز عشرين في المية وثبات من ست لتمن ساعات');
  assert.equal(speakArabicNumbers('حط 3 نقط'), 'حط تلات نقط');
  assert.equal(speakArabicNumbers('٥٠٠ جنيه'), 'خمسمية جنيه');
  assert.equal(speakArabicNumbers('خد 2.5 مل'), 'خد اتنين ونص مللي');
  assert.equal(speakArabicNumbers('الكحول = 70 × 1000 ÷ 96 ≈ 729 مل'), 'الكحول يبقى سبعين في ألف على ستة وتسعين حوالي سبعمية وتسعة وعشرين مللي');
  assert.equal(speakArabicNumbers('زجاجة 50 مل', 'gulf'), 'زجاجة خمسين مللي');
  // Phone numbers and codes are left alone; «مل» inside a word is never touched.
  assert.equal(speakArabicNumbers('رقمي 01001234567 وفيتامين B12'), 'رقمي 01001234567 وفيتامين B12');
  assert.equal(speakArabicNumbers('عطر كامل'), 'عطر كامل');
});

test('written words become everyday ones in the visitor\'s dialect (whole words only)', () => {
  assert.equal(everydayWords('لذلك يجب أن تختار الآن، لكن هذا العطر الذي اخترته جيد وسوف يثبت'),
    'عشان كده لازم تختار دلوقتي، بس العطر ده اللي اخترته كويس وهيثبت');
  assert.equal(everydayWords('لماذا تريد هذا الآن', 'gulf'), 'ليش تبي هذا الحين');
  assert.equal(everydayWords('لماذا تريد هذا الآن', 'levantine'), 'ليش بدك هاد هلق');
  assert.equal(everydayWords('لماذا تريد هذا الآن', 'msa'), 'لماذا تريد هذا الآن', 'Modern Standard stays standard');
  assert.equal(everydayWords('الآخرة والكيفية'), 'الآخرة والكيفية');
});

const STORE = `**فهمت طلبك:** طابع عود · للموسم شتوي

**ليه الاتجاه ده؟**
- في البرد الريحة بتتبخر أبطأ، فالعطور الدافية والتقيلة (عود، عنبر، فانيليا، توابل) بتبان وتثبت أكتر.
- العود قاعدة تقيلة ثباتها عالي جداً وبيدّي فخامة شرقية.

**اختياري الأول ليك من متجر شام:**
1. [Oud Royal](https://x.y/p/oud-royal.html) — 1,250 جنيه · 100 مل · EDP
   - المكونات: الافتتاحية: برجموت · القلب: ورد · القاعدة: عود، مسك

**ولو حابب تقارن، بديلين:**
2. [Amber Night](https://x.y/p/a.html) — 980 جنيه · 50 مل

_ترشيح من فلتر المتجر على حسب كلامك._

تحب أحجزلك واحد؟ 🛒`;

test('a written reply becomes talk: no symbols, lists, links or emoji, and a long one stops at «تحب أكمّلك الباقي؟»', () => {
  const spoken = spokenReply(STORE, { language: 'ar', dialect: 'egyptian' });
  assert.ok(!/[*#\-|_\[\]()🛒·—]|https?:|\d/u.test(spoken.say), spoken.say);
  assert.match(spoken.say, /^فهمت طلبك، طابع عود، للموسم شتوي\. ليه الاتجاه ده؟ في البرد/);
  assert.match(spoken.say, /تحب أكمّلك الباقي؟$/);
  assert.match(spoken.rest, /Oud Royal، ألف وميتين وخمسين جنيه، مية مللي، أو دو بارفان، المكونات، الافتتاحية برجموت، القلب ورد/);
  assert.ok(!/ترشيح من فلتر/.test(`${spoken.say} ${spoken.rest}`), 'footnotes are for the eye');
  // The «اسمع الرد» button says all of it, and other dialects ask in their own words.
  assert.equal(spokenReply(STORE, { language: 'ar', dialect: 'egyptian', words: Infinity }).rest, '');
  assert.match(spokenReply(STORE, { language: 'ar', dialect: 'gulf' }).say, /تبي أكمل لك الباقي؟$/);
  // A short reply is said as it is.
  assert.deepEqual(spokenReply('العود بيثبت أكتر في الشتا. تحب أرشحلك واحد؟', { language: 'ar' }), { say: 'العود بيثبت أكتر في الشتا. تحب أرشحلك واحد؟', rest: '' });
  // Other languages keep their digits (their voices read them well) but lose the page markup.
  assert.equal(spokenReply('### Tip\n- **Oud** lasts 8 hours 🙂', { language: 'en' }).say, 'Tip. Oud lasts 8 hours.');
  assert.deepEqual(spokenReply('```sham-formula\n{"a":1}\n```', { language: 'ar' }), { say: '', rest: '' });
});

test('«أيوه / كمّل» asks for the rest; «لا / خلاص» or a new question does not', () => {
  for (const said of ['أيوه كمل', 'كمّل', 'اه قول كمان', 'yes please', 'go on', 'أبي', 'آره']) assert.ok(wantsMore(said), said);
  for (const said of ['لا خلاص', 'no thanks', 'عايز عطر تاني للصيف', 'بكام ده']) assert.ok(!wantsMore(said), said);
});

test('Shaheen picks a male natural voice when the device has one', () => {
  const voices = [
    { name: 'Microsoft Salma Online (Natural) - Arabic (Egypt)', lang: 'ar-EG' },
    { name: 'Microsoft Shakir Online (Natural) - Arabic (Egypt)', lang: 'ar-EG' },
    { name: 'Google العربية', lang: 'ar-EG' },
  ];
  assert.equal(pickShaheenVoice(voices, 'ar-EG', 'ar')?.name, 'Microsoft Shakir Online (Natural) - Arabic (Egypt)');
});

test('the platforms are told to write talk, with his earlier spoken replies as style examples', async () => {
  const told = voiceInstruction({ examples: ['بص، العود الكمبودي ريحته دخانية وتقيلة، ويليق جداً على الشتا والسهرات.'] });
  assert.match(told, /كلام يتقال مش كلام يتقري/);
  assert.match(told, /بالحروف/);
  assert.match(told, /أمثلة لأسلوب ردودك الصوتية/);
  const shared = emptyMemory();
  const say = 'بص يا سيدي، العود الكمبودي ريحته دخانية وتقيلة، وبيليق على الشتا والسهرات أكتر من الصيف بكتير.';
  remember(shared, { question: 'ايه رأيك في العود الكمبودي للشتا', lang: 'ar', mode: 'auto', answer: say, spoken: true });
  remember(shared, { question: 'ايه رأيك في العود الهندي للشتا', lang: 'ar', mode: 'auto', answer: `${say} وسعره 1,250 جنيه`, spoken: true });
  remember(shared, { question: 'ايه رأيك في المسك الأبيض للصيف', lang: 'ar', mode: 'auto', answer: 'شوف يا غالي، المسك الأبيض ناعم ونظيف ويناسب الصيف والدوام، وما يزعج اللي حولك أبد.', dialect: 'gulf', spoken: true });
  remember(shared, { question: 'ايه رأيك في الورد الطائفي للربيع', lang: 'ar', mode: 'auto', answer: 'الورد الطائفي ريحته فخمة جداً وبتناسب الربيع والمناسبات بشكل ممتاز ومحترم.' });
  const memory = new ShaheenMemory(new MemoryStore(), {}, fetch, shared);
  assert.deepEqual(await memory.spokenExamples('ar', 'egyptian'), [say], 'only short spoken talk in his dialect, never a price or a number');
  assert.equal((await memory.spokenExamples('ar', 'gulf')).length, 1);
});
