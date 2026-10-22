/**
 * «التحليل المنطقي والرد المنطقي» (2026-10-22): the inspection set. Every question here was answered wrongly before
 * (an answer beside the point, a wrong typo «correction», an unrelated second source, a card for a how-to, no answer
 * to a plain syllogism); each must now be answered on the point — or honestly not answered.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { agentLexicon, runAgent, type AgentSources } from '../src/utils/shaheenAgent';
import { coreSubjects, coverage, fitsIntent, intentOf, keySentence, reason, sameWord } from '../src/utils/shaheenReasoning';
import { understandQuestion } from '../src/utils/shaheenSpelling';
import { designAnswer } from '../src/utils/shaheenDesigner';
import { emptyMemory, remember } from '../src/utils/shaheenMemory';
import { RAW_MATERIALS_DATABASE } from '../src/data/rawMaterials';
import { SCIENCE_TRACK_BY_ID } from '../src/data/sciences';
import { SCIENCE_SYLLABUS } from '../src/data/sciences/syllabus';
import { REVIEW_SYSTEM, STUDY_SYSTEM } from '../scripts/shaheen-school/school';

const training = JSON.parse(readFileSync(new URL('../src/data/live/sham-training.json', import.meta.url), 'utf8')) as { docs: { id: string; title: string; content: string; tags?: string[] }[] };
const sources = (): AgentSources => {
  const memory = emptyMemory();
  const seed = (question: string, answer: string) => remember(memory, { question, lang: 'ar', mode: 'auto', answer, source: 'seed' });
  seed('احسن مكان للعطر', 'أحسن مكان تحفظ فيه العطر مكان بارد وضلمة بعيد عن الشمس والحمام، وفي علبته الأصلية عشان الحرارة والضوء بيبوظوا المكونات.');
  seed('ازاي اختار عطر مناسب للصيف', 'اختيار عطر الصيف بيعتمد على خفة المكونات: دور على الحمضيات زي الليمون والبرجموت والنوتات المائية والزهور الخفيفة، وابعد عن التقيل زي العود والكراميل في الحر.');
  seed('العطر بتاعي ريحته كحول قوية اعمل ايه', 'ريحة الكحول القوية في الأول طبيعية في العطر الجديد: سيبه يتعتق أسبوعين في مكان بارد وضلمة، ورش على الجلد واستنى دقيقة قبل ما تشم، والريحة الحقيقية هتبان بعد ما الكحول يطير.');
  seed('ايه الفرق بين او دو بارفان واو دو تواليت', 'الفرق في تركيز الزيوت: او دو بارفان تركيزه 15–20% وبيثبت أطول، واو دو تواليت 5–15% وأخف ومناسب للنهار.');
  return {
    lessons: training.docs.map((d) => ({ id: d.id, title: d.title, content: d.content, tags: d.tags || [] })),
    materials: RAW_MATERIALS_DATABASE as unknown as AgentSources['materials'],
    memory,
  };
};
const src = sources();
const lex = agentLexicon(src);
const ask = (q: string) => runAgent(q, 'ar', { sources: src, lexicon: lex });

test('logic track: a new science with its expert, lessons and hourly syllabus, inside an honest boundary', () => {
  const track = SCIENCE_TRACK_BY_ID.logic;
  assert.ok(track && track.lessons.length >= 8);
  assert.match(track.boundaryAr, /مفيش/);
  assert.match(track.boundaryAr, /تلاعب|خداع/);
  assert.equal(SCIENCE_SYLLABUS.logic.length, 8);
  for (const word of ['مغالط', 'استنتاج', 'استقراء', 'سببية', 'شرط']) assert.ok(track.lessons.some((l) => l.answerAr.includes(word)), word);
});

test('analysis: what a question asks for, and its core subjects', () => {
  assert.equal(intentOf('مين اخترع الكهربا؟'), 'who');
  assert.equal(intentOf('كام عدد الكواكب؟'), 'count');
  assert.equal(intentOf('ليه السما زرقا؟'), 'why');
  assert.equal(intentOf('العطر بيروح ليه'), 'why');
  assert.notEqual(intentOf('الانسان ليه رجلين يبقى قطة؟'), 'why', '«ليه» in the middle is «his»');
  assert.equal(intentOf('العطر ريحته كحول اعمل ايه؟'), 'problem');
  assert.equal(intentOf('ازاي اعمل عطر؟'), 'howto');
  assert.equal(intentOf('هل القهوة مضرة؟'), 'yesno');
  assert.equal(intentOf('الفرق بين العود والمسك'), 'compare');
  assert.deepEqual(coreSubjects('ايه احسن عطر للصيف؟'), ['صيف']);
  assert.ok(!coreSubjects('مين اخترع الكهربا؟').includes('مين'));
  assert.ok(sameWord('طائر', 'الطيور') && sameWord('بتطير', 'بيطير') && sameWord('معدن', 'المعادن') && sameWord('قطة', 'القطط'));
  assert.equal(coverage(['صيف'], 'احسن مكان للعطر'), 0);
  assert.equal(coverage(['نباتات', 'بتتغذي'], 'تغذية النباتات بالبناء الضوئي'), 1);
});

test('fit: the answer must be the kind asked for', () => {
  assert.equal(fitsIntent('who', { kind: 'expert', text: 'الكهربا حركة الشحنات في موصل.' }), false);
  assert.equal(fitsIntent('who', { kind: 'expert', text: 'فاراداي اكتشف الحث الكهرومغناطيسي.' }), true);
  assert.equal(fitsIntent('count', { kind: 'expert', text: 'المجموعة الشمسية فيها 8 كواكب.' }), true);
  assert.equal(fitsIntent('why', { kind: 'memory', text: 'السما زرقا بسبب تشتت الضوء الأزرق.' }), true);
  assert.equal(fitsIntent('howto', { kind: 'material', text: 'كحول إيثيلي 96%' }), false);
  const lead = keySentence('الضوء الأبيض فيه كل الألوان. الألوان ليها أطوال موجية مختلفة. السما بتبان زرقا بسبب إن الهوا بيشتت الضوء الأزرق أكتر من الأحمر. ده اسمه تشتت رايلي.', 'ليه السما زرقا؟');
  assert.match(lead || '', /بسبب/);
});

test('reasoning: syllogisms, conditionals and word problems are solved step by step, without guessing', () => {
  const penguin = reason('لو كل الطيور بتطير والبطريق طائر يبقى البطريق بيطير؟')!;
  assert.equal(penguin.kind, 'syllogism-valid');
  assert.match(penguin.answer, /أيوه/);
  assert.match(penguin.answer, /البطريق والنعام/, 'a valid form with a false premise says so');
  assert.equal(reason('لو كل المعادن بتوصل الكهربا والنحاس معدن، النحاس بيوصل؟')?.kind, 'syllogism-valid');
  const cat = reason('كل القطط ليها رجلين والانسان ليه رجلين يبقى الانسان قطة؟')!;
  assert.equal(cat.kind, 'syllogism-invalid');
  assert.match(cat.answer, /لأ/);
  assert.equal(reason('لو الجو بيمطر الأرض بتتبل، الأرض مبلولة يبقى الجو كان بيمطر؟')?.kind, 'affirming-consequent');
  assert.equal(reason('لو الجو بيمطر الأرض بتتبل، والجو بيمطر يبقى الأرض بتتبل؟')?.kind, 'modus-ponens');
  assert.equal(reason('لو الجو بيمطر الأرض بتتبل، والأرض مش مبلولة يبقى الجو مكانش بيمطر؟')?.kind, 'modus-tollens');
  assert.equal(reason('لو ذاكرت هنجح، وانا مذاكرتش يبقى مش هنجح؟')?.kind, 'denying-antecedent');
  const apples = reason('لو عندي 3 تفاحات وأكلت واحدة فاضل كام؟')!;
  assert.equal(apples.kind, 'arithmetic');
  assert.match(apples.answer, /فاضل معاك 2/);
  assert.match(reason('عندي 10 جنيه اشتريت ب 4 وجالي 2 يبقى معايا كام؟')!.answer, /8/, 'paying takes money away');
  assert.match(reason('معايا ٥ أقلام وضاع اتنين باقي كام')!.answer, /3/);
  for (const q of ['عندي عطر 100 مل استخدمت شوية فاضل كام', 'ايه الفرق بين العود والمسك', 'ليه العطر بيروح بسرعة؟', 'كل يوم بحط عطر ليه بيروح؟']) assert.equal(reason(q), undefined, q);
});

test('spelling: everyday words are no longer «corrected» into a field term', () => {
  for (const [q, word] of [['لو عندي 3 تفاحات وأكلت واحدة فاضل كام؟', 'تفاضل'], ['هل الأرض كروية ولا مسطحة؟', 'مساحه'], ['هل الترابط معناه سببية؟', 'سلبيه'], ['البطريق طائر', 'طائره']] as const) {
    const u = understandQuestion(q, lex);
    assert.ok(!u.text.includes(word), `${q} → ${u.text}`);
  }
});

test('inspection set: each question is answered on the point, or honestly referred', async () => {
  // A syllogism and «فاضل كام؟» are solved by the logic expert.
  for (const q of ['لو كل الطيور بتطير والبطريق طائر يبقى البطريق بيطير؟', 'لو عندي 3 تفاحات وأكلت واحدة فاضل كام؟', 'لو الجو بيمطر الأرض بتتبل، الأرض مبلولة يبقى الجو كان بيمطر؟']) {
    const r = await ask(q);
    assert.equal(r.expert.field, 'logic', q);
    assert.deepEqual(r.used, ['reasoning'], q);
    assert.equal(r.refer, false);
  }
  // The logic lessons answer logic questions.
  for (const [q, id] of [['ايه هي المغالطة المنطقية؟', 'logic-04'], ['هل الترابط معناه سببية؟', 'logic-05'], ['ايه الفرق بين الاستنتاج والاستقراء؟', 'logic-02'], ['ازاي اقنع حد برأيي بطريقة منطقية؟', 'logic-08']] as const) {
    const r = await ask(q);
    assert.ok(r.trace.some((t) => t.includes(`expert:${id}`) && t.startsWith('decided')), `${q}: ${r.trace.join(' | ')}`);
  }
  // «مين اخترع الكهربا؟»: the electricity lesson names no inventor — he says he is not sure instead of answering beside it.
  const who = await ask('مين اخترع الكهربا؟');
  assert.equal(who.answer, undefined);
  assert.equal(who.refer, true);
  // «ايه احسن عطر للصيف؟»: the summer answer, never the one about where to keep a perfume.
  const summer = await ask('ايه احسن عطر للصيف؟');
  assert.match(summer.answer || '', /الصيف|الحمضيات/);
  assert.doesNotMatch(summer.answer || '', /بارد وضلمة بعيد عن الشمس/);
  // A problem gets the fix, not the ethanol card.
  const alcohol = await ask('العطر بتاعي ريحته كحول اعمل ايه؟');
  assert.match(alcohol.answer || '', /يتعتق|استنى/);
  assert.ok(!alcohol.trace.some((t) => t.startsWith('decided: material')));
  // EDP vs EDT: no nuclear lesson tacked on.
  const edp = await ask('ايه الفرق بين او دي بارفان و او دي تواليت؟');
  assert.match(edp.answer || '', /تركيز/);
  assert.doesNotMatch(edp.answer || '', /نوو|انشطار/);
  // «ازاي النباتات بتتغذى؟»: photosynthesis, not the aromatic-plants lesson.
  const plants = await ask('ازاي النباتات بتتغذى؟');
  assert.ok(plants.trace.some((t) => t.startsWith('decided: expert:biol-03')), plants.trace.join(' | '));
  // «ايه هو المسك؟»: the lesson on musk, not one synthetic musk's card.
  const musk = await ask('ايه هو المسك؟');
  assert.ok(musk.trace.some((t) => /^decided: lesson:.*musk/.test(t)), musk.trace.join(' | '));
});

test('«ازاي اعمل عطر عود؟» asks for a formula (the designer), while «ازاي احسب التركيز؟» does not', () => {
  assert.match(designAnswer('ازاي اعمل عطر عود؟', 'ar') || '', /مقترح شاهين/);
  assert.equal(designAnswer('ازاي احسب التركيز؟', 'ar'), undefined);
  assert.equal(designAnswer('ازاي اعمل عطر؟', 'ar'), undefined);
});

test('the academy teaches and reviews the logical answer: the direct answer first, and nothing beside the question', () => {
  assert.match(STUDY_SYSTEM, /ابدأ بالإجابة المباشرة/);
  assert.match(STUDY_SYSTEM, /بدل التخمين/);
  assert.match(REVIEW_SYSTEM, /«مين» بلا شخص/);
  assert.match(REVIEW_SYSTEM, /مغالطة منطقية/);
});
