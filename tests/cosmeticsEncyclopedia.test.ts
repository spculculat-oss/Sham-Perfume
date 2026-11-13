import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCIENCE_TRACKS } from '../src/data/sciences';
import { COSMETICS_ENCYCLOPEDIA_LESSONS, COSMETICS_PAGE_LESSONS } from '../src/data/sciences/cosmetics';
import { fieldsOf, runAgent, scienceCurriculum, type AgentSources } from '../src/utils/shaheenAgent';
import { scienceHits } from '../src/utils/scienceIndex';
import { emptyMemory } from '../src/utils/shaheenMemory';

const track = SCIENCE_TRACKS.find((t) => t.id === 'cosmetics')!;
const byId = (id: string) => COSMETICS_ENCYCLOPEDIA_LESSONS.find((l) => l.id === id)!;
const src = (): AgentSources => ({ lessons: [], materials: [], memory: emptyMemory() });

test('cosmetics encyclopedia: the whole industry is in Shaheen’s cosmetics track — factory, raw materials, every product, old and new', () => {
  assert.ok(COSMETICS_ENCYCLOPEDIA_LESSONS.length >= 55, `${COSMETICS_ENCYCLOPEDIA_LESSONS.length} lessons`);
  assert.equal(track.lessons.length, COSMETICS_PAGE_LESSONS.length + COSMETICS_ENCYCLOPEDIA_LESSONS.length);
  const titles = COSMETICS_ENCYCLOPEDIA_LESSONS.map((l) => l.titleAr).join(' | ');
  for (const subject of ['GMP', 'معدات', 'خطوات تصنيع الكريم', 'اختبارات الجودة', 'العبوات', 'قوانين التسجيل', 'المطريات', 'المستحلبات', 'المكثفات', 'المنظفات', 'المواد الحافظة',
    'المواد الفعالة', 'الأصباغ', 'البودرات', 'المستخلصات النباتية', 'المواد الممنوعة', 'غسول الوجه', 'السيروم', 'الكريم المرطب', 'الجسم', 'الجل', 'الماسكات', 'المقشرات',
    'الشامبو', 'البلسم', 'صبغات الشعر', 'فرد الشعر', 'تصفيف', 'الصابون الصلب', 'الشاور جل', 'مزيلات العرق', 'واقي الشمس', 'أحمر الشفاه', 'مرطب الشفاه', 'كريم الأساس',
    'البودرة', 'الماسكارا', 'طلاء الأظافر', 'معجون الأسنان', 'الحلاقة', 'إزالة الشعر', 'الأطفال', 'معطرات الجسم', 'الصلبة', 'مشروع', 'مشاكل التصنيع',
    'قدماء المصريين', 'العربية والإسلامية', 'آسيا وأوروبا', 'التقليدية', 'الحديثة وقوانينها', 'التقنية الحيوية', 'الميكروبيوم', 'التغليف الدقيق', 'الاستدامة', 'الروتين', 'ادعاءات']) {
    assert.ok(titles.includes(subject), `missing: ${subject}`);
  }
  for (const l of COSMETICS_ENCYCLOPEDIA_LESSONS) assert.match(l.id, /^cosx-\d\d$/);
});

test('cosmetics encyclopedia: every lesson is found by its own question, and visitors’ wordings reach the right lesson', () => {
  const index = scienceCurriculum();
  for (const l of COSMETICS_ENCYCLOPEDIA_LESSONS) assert.equal(scienceHits(index, l.questionAr)[0]?.lesson.id, l.id, l.id);
  const asks: [string, string][] = [
    ['ازاي اعمل شامبو؟', 'cosx-26'], ['خطوات تصنيع أحمر الشفاه', 'cosx-35'], ['ازاي اعمل صابون طبيعي في البيت؟', 'cosx-31'], ['ايه مكونات معجون الاسنان؟', 'cosx-41'],
    ['ازاي اعمل حلاوة لازالة الشعر؟', 'cosx-43'], ['الفراعنة كانوا بيعملوا الكحل ازاي؟', 'cosx-49'], ['ايه هو الزهراوي والتجميل؟', 'cosx-50'], ['ايه هو HLB؟', 'cosx-10'],
    ['ايه مكونات طلاء الاظافر؟', 'cosx-40'], ['الكريم بتاعي انفصل ليه؟', 'cosx-48'], ['ايه أقسام مستحضرات التجميل كلها؟', 'cosx-01'], ['يعني ايه ميكروبيوم البشرة؟', 'cosx-55'],
  ];
  for (const [q, id] of asks) assert.equal(scienceHits(index, q)[0]?.lesson.id, id, q);
  for (const q of ['ازاي اصنع ماسكارا؟', 'ازاي اعمل صابون طبيعي في البيت؟', 'ايه مكونات طلاء الاظافر؟']) assert.equal(fieldsOf(q)[0]?.field, 'cosmetics', q);
});

test('cosmetics encyclopedia: Shaheen answers from it on his own, with no AI service', async () => {
  const r = await runAgent('ازاي بيتصنع أحمر الشفاه في المصنع؟', 'ar', { sources: src() });
  assert.match(r.answer!, /الطاحونة الثلاثية/);
  const soap = await runAgent('ازاي الصابون الصلب بيتصنع بالطريقة الباردة والساخنة؟', 'ar', { sources: src() });
  assert.match(soap.answer!, /نظارة وقفازات/);
});

test('cosmetics encyclopedia: safety first — no home sunscreen, banned lighteners named as dangers, professionals for harsh chemistry', () => {
  assert.match(byId('cosx-34').answerAr, /الواقي المنزلي .*ممنوع ومش آمن/);
  assert.match(byId('cosx-18').answerAr, /الزئبق/);
  assert.match(byId('cosx-18').answerAr, /الهيدروكينون والكورتيزون/);
  assert.match(byId('cosx-29').answerAr, /الصالون المتخصص/);
  assert.match(byId('cosx-28').answerAr, /اختبار حساسية/);
  assert.match(byId('cosx-31').answerAr, /القلوي يتحط على الماء مش العكس/);
  assert.match(byId('cosx-04').answerAr, /مادة حافظة/);
  for (const l of COSMETICS_ENCYCLOPEDIA_LESSONS) {
    assert.doesNotMatch(l.answerAr, /هامش|سعر المورّد|margin/i, l.id);
    assert.doesNotMatch(l.answerAr, /بيعالج نهائي|مضمون 100%|نتيجة مضمونة/, l.id);
  }
});
