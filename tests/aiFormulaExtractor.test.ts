import assert from 'node:assert/strict';
import test from 'node:test';
import { extractFormulaFromAIMessage, isFormulaTransferCommand } from '../src/utils/aiFormulaExtractor';
const formula = { title: 'Test blend', author: 'Shahin', summary: 'Experimental proposal', concentrationPercent: 20,
  concentrationType: 'edp', bottleVolumeMl: 50, alcoholPercentage: 96, waterPercent: 0, fixativePercent: 0,
  macerationDays: 30, pyramidNotes: [
    { id: 'a', nameAr: 'برغموت', nameEn: 'Bergamot', category: 'top', percentageOfOil: 25 },
    { id: 'a', nameAr: 'هيديون', nameEn: 'Hedione', category: 'heart', percentageOfOil: 35 },
    { id: 'a', nameAr: 'أرز', nameEn: 'Cedar', category: 'base', percentageOfOil: 40 },
  ] };
const block = (value: unknown) => '```sham-formula\n' + JSON.stringify(value) + '\n```';

test('general discussions, greetings, medical advice and stray percentages never generate a formula', () => {
  for (const text of ['أهلاً بك في معمل تركيب العطور والزيت والكحول', 'خفف زيت اللافندر إلى 1% ولا تستخدمه للأطفال',
    'I like bergamot, rose and oud. What concentration?', '50ml perfume, 20% EDP', '```json\n{}\n```']) {
    assert.equal(extractFormulaFromAIMessage(text), null);
  }
});

test('only a complete explicit formula is transferable, preserving exact ingredients and proportions', () => {
  const extracted = extractFormulaFromAIMessage('Experimental blend:\n' + block(formula));
  assert.equal(extracted?.concentrationPercent, 20);
  assert.equal(extracted?.pyramidNotes[1].nameEn, 'Hedione');
  assert.equal(extracted?.pyramidNotes[1].percentageOfOil, 35);
  assert.equal(new Set(extracted?.pyramidNotes.map((note) => note.id)).size, 3);
});

test('missing values, impossible totals, unbalanced notes and ambiguous multiple blocks are rejected', () => {
  for (const value of [null, {}, { ...formula, alcoholPercentage: undefined }, { ...formula, bottleVolumeMl: -10 },
    { ...formula, concentrationPercent: '20' }, { ...formula, waterPercent: 90 }, { ...formula, fixativePercent: -1 },
    { ...formula, pyramidNotes: [] }, { ...formula, pyramidNotes: [formula.pyramidNotes[0]] },
    { ...formula, pyramidNotes: [{ ...formula.pyramidNotes[0], percentageOfOil: 100, category: 'invalid' }] },
  ]) assert.equal(extractFormulaFromAIMessage(block(value)), null);
  assert.equal(extractFormulaFromAIMessage(block(formula) + block(formula)), null);
  assert.equal(extractFormulaFromAIMessage('```sham-formula\n{broken}\n```'), null);
});

test('new-formula requests are not mistaken for transferring an older formula', () => {
  for (const command of ['طبق التركيبة على الحاسبة', 'انقل للحاسبة', 'من فضلك انقل الوصفة إلى الحاسبة', 'Apply this formula to the calculator']) {
    assert.equal(isFormulaTransferCommand(command), true, command);
  }
  for (const question of ['Send me a different formula', 'Can you apply chemistry to a new formula?', 'طبق فكرة مختلفة واعمل تركيبة جديدة', 'حول التركيبة لعطر صيفي']) {
    assert.equal(isFormulaTransferCommand(question), false, question);
  }
});
