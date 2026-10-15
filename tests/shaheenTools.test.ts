import assert from 'node:assert/strict';
import test from 'node:test';
import { alcoholDilutionIn, concentrationPercentIn, explicitToolLinks, linkTools, macerationDaysIn, materialIn,
  questionIntents, removeToolBlocks, volumeMl } from '../src/utils/shaheenTools';
import { stripFormulaBlock } from '../src/components/ShaheenMarkdown';
import { extractFormulasFromAIMessage } from '../src/utils/aiFormulaExtractor';

const tools = (question: string, answer: string, previousQuestion = '') =>
  linkTools({ question, answer, previousQuestion, formulas: extractFormulasFromAIMessage(answer) });

test('the nature of the question decides the tools; greetings, medical questions and small talk get none', () => {
  assert.deepEqual(questionIntents('عايز أخفف كحول 96 لـ 70'), ['alcohol']);
  assert.ok(questionIntents('كام يوم تعتيق للعود؟').includes('maceration'));
  assert.ok(questionIntents('How much oil for a 100 ml EDP?').includes('concentration'));
  assert.ok(questionIntents('بكام أبيع الزجاجة وأكسب كام؟').includes('costing'));
  assert.ok(questionIntents('ايه هي نوتات القلب المناسبة للورد؟').includes('pyramid'));
  assert.ok(questionIntents('ما هو زيت الصندل؟').includes('raw_materials'));
  assert.ok(questionIntents('صمم لي عطر شرقي').includes('formula'));
  for (const q of ['مرحبا', 'شكراً!', 'hello', 'هل اللافندر آمن للحامل؟', 'ما القاعدة في الضيافة؟', 'إيه رأيك في الجو النهارده؟']) {
    assert.deepEqual(questionIntents(q), [], q);
    assert.deepEqual(tools(q, 'إجابة فيها 30 يوم و 50 مل'), [], q);
  }
});

test('a short follow-up keeps the topic of the question before it', () => {
  assert.deepEqual(questionIntents('طيب ولو 500 مل؟', 'عايز أخفف كحول 96 لـ 70'), ['alcohol']);
  const [link] = tools('طيب ولو 500 مل؟', 'تحتاج حوالي 365 مل كحول.', 'عايز أخفف كحول 96 لـ 70');
  assert.equal(link.tool, 'alcohol');
  assert.equal(link.finalVolumeMl, 500);
});

test('values are read from Arabic or Latin text, with sane bounds and no guessing', () => {
  assert.equal(volumeMl('زجاجة ١٠٠ مل'), 100);
  assert.equal(volumeMl('2 لتر'), 2000);
  assert.equal(volumeMl('مليون زجاجة'), undefined);
  assert.equal(concentrationPercentIn('بتركيز 20%'), 20);
  assert.equal(concentrationPercentIn('كحول 96%'), undefined, 'alcohol strength is not the oil concentration');
  assert.deepEqual(alcoholDilutionIn('من ٩٦٪ إلى ٧٠٪'), { from: 96, to: 70 });
  assert.deepEqual(alcoholDilutionIn('70 to 96'), {}, 'dilution only goes down');
  assert.equal(macerationDaysIn('اتركه 4-6 أسابيع'), 42);
  assert.equal(macerationDaysIn('شهرين في مكان مظلم'), 60);
  assert.equal(macerationDaysIn('45 يوماً'), 45);
  assert.equal(macerationDaysIn('900 يوم'), undefined);
  assert.equal(materialIn('ما هو زيت الصندل؟'), 'صندل');
  assert.equal(materialIn('What is ambroxan?'), 'ambroxan');
});

test('each kind of question opens its own calculator with the conversation values', () => {
  const dilution = tools('عايز أخفف كحول 96% إلى 70% وأعمل 1 لتر', 'اخلط 729 مل كحول مع ماء حتى 1000 مل.');
  assert.deepEqual(dilution, [{ tool: 'alcohol', alcoholFrom: 96, alcoholTo: 70, finalVolumeMl: 1000 }]);

  const aging = tools('كام يوم أعتق عطر العود؟', 'العود يحتاج تعتيقاً أطول: من 6 إلى 8 أسابيع في مكان مظلم.');
  assert.deepEqual(aging, [{ tool: 'maceration', macerationDays: 56 }]);

  const amounts = tools('كم زيت أحتاج لزجاجة 100 مل بتركيز 20%؟', 'تحتاج 20 مل زيت و 80 مل كحول.');
  assert.deepEqual(amounts.find((l) => l.tool === 'concentration'), { tool: 'concentration', bottleVolumeMl: 100, concentrationPercent: 20 });

  const material = tools('ما هو زيت الصندل؟', 'خشب الصندل مادة قاعدية دافئة…');
  assert.deepEqual(material, [{ tool: 'raw_materials', search: 'صندل' }]);
});

test('a full formula keeps its own toolbar; Shaheen only adds the maceration simulator with its days', () => {
  const formula = { title: 'Oud', author: 'S', summary: 's', concentrationPercent: 20, concentrationType: 'edp', bottleVolumeMl: 50,
    alcoholPercentage: 96, waterPercent: 0, fixativePercent: 0, macerationDays: 45,
    pyramidNotes: [{ nameAr: 'عود', nameEn: 'Oud', category: 'base', percentageOfOil: 100 }] };
  const answer = '### تحليل معمّق\nبتركيز 20%…\n```json\n' + JSON.stringify(formula) + '\n```';
  const links = tools('صمم لي عطر عود بتركيز 20% مع تحليل معمق', answer);
  assert.deepEqual(links, [{ tool: 'maceration', macerationDays: 45 }]);
});

test("Shaheen's own ```sham-tool block wins, is validated and is never shown", () => {
  const answer = 'التخفيف سهل.\n```sham-tool\n{"tools":[{"tool":"alcohol","alcoholFrom":"٩٦","alcoholTo":70,"finalVolumeMl":500},{"tool":"hack","x":1},{"tool":"maceration","macerationDays":9999}]}\n```';
  assert.deepEqual(explicitToolLinks(answer), [{ tool: 'alcohol', alcoholFrom: 96, alcoholTo: 70, finalVolumeMl: 500 }, { tool: 'maceration' }]);
  assert.equal(removeToolBlocks(answer), 'التخفيف سهل.');
  assert.doesNotMatch(stripFormulaBlock(answer), /sham-tool|alcoholFrom/);
  // Even when the question alone would not have linked anything.
  assert.equal(tools('سؤال', answer)[0].tool, 'alcohol');
});
