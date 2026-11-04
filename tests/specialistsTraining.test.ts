/**
 * «تدريب مجلس المتخصصين» — بنك أسئلة التدريب كاختبار.
 *
 * الاختبار ده بيثبت إن الوكيل اتدرّب فعلاً على الحاجات الست اللي البنك بيقيسها:
 *   1) **فهم السؤال**: غلطة الكتابة الحقيقية تتصحح وتترد للزائر، والكلمة الصح ماتتصححش أبداً،
 *      والمتابعة القصيرة تكمل على سؤال الزائر اللي قبلها من غير ما تبلع سؤال مستقل.
 *   2) **التوجيه**: كل سؤال لمتخصصه بمجاله (مش بأول كلمة)، ومجال العطور (موضوع الموقع) مش أفضلية،
 *      والزيارة الواحدة موضوع واحد، واختيار الزائر لمتخصص يحترم من غير رد من مجال تاني.
 *   3) **الأرشيف**: السؤال المقصود يتجاب من دروس الخبير والمكتبة وموسوعة المواد والذاكرة — في نطاق
 *      المتخصص بس (L-32)، فالمقارنة تجيب الطرفين وسؤال التجارة ماياخدش درس عطور.
 *   4) **بيانات الموقع**: الحاسبات والمتجر والنشرة والملجأ والسلامة بأرقامها الحقيقية.
 *   5) **العرض**: سطر المصدر في الآخر، ولغة الزائر، والخطوة الجاية، وأزرار حقيقية.
 *   6) **الصدق**: مافيش تخمين — فجوة صريحة مسجلة، أو أقرب درس مكتوب وهو متسمّي بأقرب درس،
 *      أو سؤال خارج النطاق (سعر لحظي/خبر/حالة شخصية) بيتقال عليه إنه خارج النطاق.
 *
 * كله **من غير أي ذكاء اصطناعي ومن غير شبكة**: البنك بيشتغل على الأرشيف الحقيقي (دروس مكتبة شاهين،
 * موسوعة المواد، علوم مدرسة شاهين، متجر شام، ملجأ شاهين) ومستودع على الذاكرة المؤقتة — فمفيش
 * كتابة على القرص ولا رصيد بيتصرف. التقرير نفسه في `scripts/shaheen-specialists/bench.ts`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatReport, runTraining, trainingCore } from '../scripts/shaheen-specialists/bench';
import { SKILL_LABELS_AR, TRAINING_CASES, type TrainingSkill } from '../scripts/shaheen-specialists/questions';
import { readQuestion, relatedFollowUps, resolveAsked, routeQuestion, sameWordAffix, sameWordStem } from '../server/specialists/brain';
import { lessonsInScope, materialsInScope, ownsField } from '../server/specialists/tools';
import { SPECIALISTS, specialistOf, type Specialist, type SpecialistId } from '../src/utils/shaheenSpecialists';

/** متخصص موجود فعلاً في المجلس — لو الاسم غلط الاختبار يقع هنا مش في مكان مبهم. */
const one = (id: SpecialistId): Specialist => {
  const found = specialistOf(id);
  assert.ok(found, `المتخصص «${id}» مش موجود في المجلس`);
  return found;
};

/** البنك بيتشغل مرة واحدة لكل الاختبارات هنا (٥ ثواني) — التقرير بيتشارك. */
const report = runTraining();

/* ── 1. البنك كله ─────────────────────────────────────────────────────────────────────────────── */
test('the training bank: every case answers as trained — no AI, no network, no guessing', async () => {
  const result = await report;
  const failed = result.outcomes.filter((o) => !o.ok).map((o) => `${o.id}: ${o.problems.join(' · ')}`);
  assert.deepEqual(failed, [], `حالات واقعة في بنك التدريب:\n${formatReport(result)}`);
});

test('the training bank covers every trained skill, and every answer ran at least one tool', async () => {
  const result = await report;
  assert.ok(result.outcomes.length >= 30, 'البنك أصغر من 30 حالة');
  for (const skill of Object.keys(SKILL_LABELS_AR) as TrainingSkill[]) {
    assert.ok(result.outcomes.some((o) => o.skill === skill), `مفيش حالة بتقيس مهارة «${SKILL_LABELS_AR[skill]}»`);
  }
  assert.ok(result.outcomes.every((o) => o.tools.length > 0), 'فيه رد من غير ما تشتغل أي أداة');
  assert.equal(TRAINING_CASES.every((c) => c.why.trim().length > 20), true, 'كل حالة لازم يكون لها سبب مكتوب');
  assert.equal(new Set(TRAINING_CASES.map((c) => c.id)).size, TRAINING_CASES.length, 'فيه حالة متكررة في البنك');
});

test('the bench runs on the real archive, offline, on temporary memory only', async () => {
  const core = await trainingCore();
  assert.ok(core.lessons.length >= 20, 'دروس مكتبة شاهين الحقيقية مش متحملة');
  assert.equal(core.env.SHAM_STORE, 'memory', 'التدريب ما يكتبش على القرص');
  assert.equal(core.env.SHAM_LIVE_DATA, 'off', 'التدريب ما يجيبش بيانات حية من الشبكة');
  assert.equal(core.env.OPENAI_API_KEY, undefined, 'مفيش مفاتيح في بيئة التدريب');
});

/* ── 2. فهم السؤال ────────────────────────────────────────────────────────────────────────────── */
test('reading the question: a real typo is corrected and read back, a correct word never is', () => {
  const typo = readQuestion('ازاي اعمل تعتبق للعطر في البيت؟', 'ar');
  assert.match(typo.asked, /تعتيق/, 'غلطة الكتابة الحقيقية ماتصححتش');
  assert.match(typo.note, /فهمت سؤالك كده/, 'التصحيح لازم يتقال للزائر');

  const material = readQuestion('ايه هو الجلاكسوليد؟', 'ar');
  assert.match(material.asked, /الجالاكسوليد/, 'اسم المادة المكتوب غلط مااتصححش');

  // كلمات الزائر الصح: ماينفعش الوكيل يقول إنه قراها حاجة تانية.
  for (const asked of [
    'بكام عطر العود عندكم؟', 'عايز أشتري 3 زجاجات عطر وتوصيل للقاهرة', 'وين ألاقي تقرير مدرسة شاهين؟',
    'هو العطر حلال ولا حرام؟', 'الجلد متكون من ايه وايه هو حاجز البشرة؟', 'ماهي فوائد المسك الابيض للبشره؟',
    'اشرح لي كل حاجة بالتفصيل', 'إيه توقعك لسعر البيتكوين بكرة؟',
    'ازاي استثمر في مشروع عطور صغير؟', 'إزاي أعمل خطة تسويق لعلامة عطور جديدة؟',
  ]) assert.equal(readQuestion(asked, 'ar').note, '', `«${asked}» اتقريت غلط`);
});

test('the affix guard: the same word with a prefix or a suffix is not a typo', () => {
  assert.equal(sameWordAffix('بمكونات', 'مكونات'), true);
  assert.equal(sameWordAffix('أشتري', 'اشتريت'), true);
  assert.equal(sameWordAffix('عندكم', 'عندك'), true);
  assert.equal(sameWordAffix('تعتبق', 'تعتيق'), false, 'غلطة الكتابة الحقيقية ماتعتبرش نفس الكلمة');
  assert.equal(sameWordAffix('الجلاكسوليد', 'الجالاكسوليد'), false);
});

test('the stem guard: another form of the same root is not a typo either', () => {
  assert.equal(sameWordStem('استثمر', 'استثمار'), true, 'فعل ومصدره: الاتنين كلام صح');
  assert.equal(sameWordStem('صغير', 'تصغير'), true, 'حرف زيادة في أول الجذر مش غلطة كتابة');
  assert.equal(sameWordStem('العطور', 'عطر'), true);
  assert.equal(sameWordStem('تعتبق', 'تعتيق'), false, 'غلطة الكتابة الحقيقية بتغيّر حرف في الجذر');
  // اسم مادة من موسوعة الموقع: هنا الفرق حرف علة فعلاً، بس الاسم بيتكتب غلط كتير فبنقول القراءة للزائر.
  assert.equal(sameWordStem('الجلاكسوليد', 'الجالاكسوليد'), true);
  assert.match(readQuestion('ايه هو الجلاكسوليد؟', 'ar').note, /الجالاكسوليد/, 'غلطة اسم المادة مااتردتش على الزائر');
});

test('a short follow-up keeps the topic of the question before it, a question of its own does not', () => {
  const previous = 'احسب مقادير زجاجة 50 مل بتركيز 20%';
  assert.match(resolveAsked('طيب ولو 100 مل؟', previous), /احسب مقادير/, 'المتابعة ماكملتش على سؤال الحاسبة');
  assert.match(resolveAsked('ولو 15%؟', previous), /احسب مقادير/);
  assert.equal(resolveAsked('ايه هو المسك؟', previous), 'ايه هو المسك؟', 'سؤال مستقل اتبلع في السؤال اللي قبله');
  assert.equal(resolveAsked('ايه هو المسك؟'), 'ايه هو المسك؟', 'من غير سؤال قبله مايتغيرش');
});

/* ── 3. التوجيه والنطاق ───────────────────────────────────────────────────────────────────────── */
test('routing: the field owns the question, and the site’s own topic is not a privilege', () => {
  assert.equal(routeQuestion('الجهاز المناعي والتطعيم بيشتغلوا إزاي؟').specialist.id, 'specialist_health');
  assert.equal(routeQuestion('ايه هي قوانين نيوتن؟').specialist.id, 'specialist_science');
  assert.equal(routeQuestion('ليه بتحصل الزلازل وازاي بيتقاس حجمها؟').specialist.id, 'specialist_engineering');
  // «خطة تسويق» تجارة حتى لو الموضوع عطور: التعادل يكسبه الأكثر تحديداً للسؤال.
  assert.equal(routeQuestion('إزاي أعمل خطة تسويق لعلامة عطور جديدة؟').specialist.id, 'specialist_business');
});

test('routing keeps one topic per visit: a question with no field of its own follows the one before it', () => {
  const previous = 'إزاي أعمل خطة تسويق لعلامة عطور جديدة؟';
  const routed = routeQuestion('ايه المواد اللي أدرسها علشان أنجح في المجال ده؟', { previous });
  assert.equal(routed.specialist.id, 'specialist_business', 'سؤال التجارة راح لمتخصص العطور');
  assert.match(routed.trace, /كمّل على مجال السؤال اللي قبله/);
});

test('scope (L-32): a specialist answers from their own archive only', () => {
  const business = one('specialist_business');
  const scents = one('specialist_scents');
  const perfumeLesson = { id: 'perfume-1', title: 'أشهر المواد الخام الطبيعية واستخداماتها العطرية', content: 'الورد الطائفي والياسمين والفانيليا', tags: ['عطور', 'مواد خام'] };
  assert.equal(lessonsInScope([perfumeLesson], scents).length, 1, 'متخصص العطور يفقد درس العطور');
  assert.equal(lessonsInScope([perfumeLesson], business).length, 0, 'متخصص التجارة رد من درس عطور');
  assert.equal(materialsInScope(scents), true, 'موسوعة المواد من نطاق العطور');
  assert.equal(materialsInScope(business), false, 'موسوعة المواد مش من نطاق التجارة');
  assert.equal(ownsField(scents, 'perfume'), true);
  assert.equal(ownsField(business, 'perfume'), false);
  assert.equal(ownsField(scents, 'general'), false, 'مجال عام محدش يملكه');
});

test('follow-up questions offered to the visitor come from their own specialist’s scope', () => {
  const health = one('specialist_health');
  const followUps = relatedFollowUps('ازاي المناعة بتشتغل وإزاي التطعيم بيحمي؟', health, 'ar');
  assert.ok(followUps.length > 0, 'مفيش سؤال يكمل بيه الزائر');
  assert.ok(followUps.every((q) => q.length > 8), 'سؤال المتابعة قصير أو فاضي');
  assert.deepEqual(relatedFollowUps('How does immunity work?', health, 'en'), [], 'المتابعة عربية بس (المنهج مكتوب بالعربي)');
  assert.ok(SPECIALISTS.every((s) => relatedFollowUps('ايه هو المسك؟', s, 'ar').every((q) => q.length > 0)));
});
