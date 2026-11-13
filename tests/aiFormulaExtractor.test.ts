import assert from 'node:assert/strict';
import test from 'node:test';
import { extractFormulaFromAIMessage, extractFormulasFromAIMessage, isFormulaTransferCommand, removeFormulaBlocks } from '../src/utils/aiFormulaExtractor';
import { stripFormulaBlock } from '../src/components/ShaheenMarkdown';
import { compactTurn } from '../src/utils/chatStore';
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
    { ...formula, concentrationPercent: 'twenty' }, { ...formula, waterPercent: 90 }, { ...formula, fixativePercent: -1 },
    { ...formula, pyramidNotes: [] }, { ...formula, pyramidNotes: [formula.pyramidNotes[0]] },
    { ...formula, pyramidNotes: [{ ...formula.pyramidNotes[0], percentageOfOil: 100, category: 'invalid' }] },
  ]) assert.equal(extractFormulaFromAIMessage(block(value)), null);
  // The same formula twice is one formula; two different ones are ambiguous for a transfer command.
  assert.equal(extractFormulaFromAIMessage(block(formula) + '\n' + block(formula))?.title, 'Test blend');
  assert.equal(extractFormulaFromAIMessage(block(formula) + '\n' + block({ ...formula, title: 'Other' })), null);
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

const analysis = '### تحليل معمّق\nالحساب: 50 مل × 20% = 10 مل زيت.\n\n| المادة | النسبة |\n|---|---|\n| برغموت | 25% |';
const shown = (reply: string) => stripFormulaBlock(reply);

test('deep-analysis replies: every shape seen live still gives the toolbar and never shows raw JSON', () => {
  const json = JSON.stringify(formula, null, 2);
  const shapes: Record<string, string> = {
    'json label': '```json\n' + json + '\n```',
    'no label': '```\n' + json + '\n```',
    'JSON on the fence line': '```sham-formula ' + JSON.stringify(formula) + '\n```',
    'closing fence glued to the object': '```sham-formula\n' + JSON.stringify(formula) + '```',
    'cut answer (no closing fence)': '```sham-formula\n' + json,
    'tilde fence, upper case label': '~~~SHAM-FORMULA\n' + json + '\n~~~',
    'bare JSON line': JSON.stringify(formula),
    'trailing commas and a comment': '```sham-formula\n// الصيغة\n' + json.replace(/\n(\s*)\]/g, ',\n$1]') + '\n```',
  };
  for (const [name, tail] of Object.entries(shapes)) {
    const reply = analysis + '\n\n' + tail + (name.startsWith('cut') ? '' : '\n\nجرّب كمية صغيرة أولاً.');
    const extracted = extractFormulaFromAIMessage(reply);
    assert.equal(extracted?.pyramidNotes[2].nameEn, 'Cedar', name);
    const visible = shown(reply);
    assert.doesNotMatch(visible, /pyramidNotes|"title"|```|~~~/, name);
    assert.match(visible, /50 مل × 20%/, name);
    if (!name.startsWith('cut')) assert.match(visible, /جرّب كمية صغيرة أولاً/, name);
  }
});

test('deep-analysis numbers as models write them: Arabic digits, "%" strings, rounding, shares of the product', () => {
  const arabic = { ...formula, concentrationPercent: '٢٠٪', bottleVolumeMl: '50 ml', macerationDays: '٣٠',
    pyramidNotes: formula.pyramidNotes.map((n) => ({ ...n, percentageOfOil: `${n.percentageOfOil}%` })) };
  assert.equal(extractFormulaFromAIMessage(block(arabic))?.concentrationPercent, 20);
  const rounded = { ...formula, pyramidNotes: [{ ...formula.pyramidNotes[0], percentageOfOil: 33.3 },
    { ...formula.pyramidNotes[1], percentageOfOil: 33.3 }, { ...formula.pyramidNotes[2], percentageOfOil: 33.3 }] };
  const r = extractFormulaFromAIMessage(block(rounded))!;
  assert.equal(r.pyramidNotes.reduce((t, n) => t + n.percentageOfOil, 0).toFixed(2), '100.00');
  // 5 + 7 + 8 = 20 = the concentration: shares of the whole product keep their proportions.
  const ofProduct = { ...formula, pyramidNotes: [{ ...formula.pyramidNotes[0], percentageOfOil: 5 },
    { ...formula.pyramidNotes[1], percentageOfOil: 7 }, { ...formula.pyramidNotes[2], percentageOfOil: 8 }] };
  assert.deepEqual(extractFormulaFromAIMessage(block(ofProduct))!.pyramidNotes.map((n) => n.percentageOfOil), [25, 35, 40]);
  // Aliases: notes grouped by layer, "middle", missing author/summary/water/fixative, "Eau de Parfum".
  const grouped = { title: 'Grouped', concentrationType: 'Eau de Parfum', concentrationPercent: 20, bottleVolumeMl: 50,
    alcoholPercentage: 96, macerationDays: 21, pyramidNotes: { top: [{ name: 'Bergamot', percentageOfOil: 30 }],
      middle: [{ nameAr: 'ورد', nameEn: 'Rose', percentageOfOil: 30 }], base: [{ nameEn: 'Musk', percentageOfOil: 40 }] } };
  const g = extractFormulaFromAIMessage('```json\n' + JSON.stringify(grouped) + '\n```')!;
  assert.equal(g.concentrationType, 'edp');
  assert.deepEqual(g.pyramidNotes.map((n) => n.category), ['top', 'heart', 'base']);
  assert.equal(g.waterPercent, 0);
  assert.ok(g.author && g.summary);
  // Unbalanced recipes are still refused (no invented proportions).
  const broken = { ...formula, pyramidNotes: [{ ...formula.pyramidNotes[0], percentageOfOil: 10 }, { ...formula.pyramidNotes[1], percentageOfOil: 15 }] };
  assert.equal(extractFormulaFromAIMessage(block(broken)), null);
});

test('alternatives in one deep analysis: one toolbar choice per formula, all blocks hidden', () => {
  const reply = analysis + '\n### البديل الأول\n' + block(formula) + '\n### البديل الثاني\n' + block({ ...formula, title: 'Night version', concentrationPercent: 25 });
  const all = extractFormulasFromAIMessage(reply);
  assert.deepEqual(all.map((f) => f.title), ['Test blend', 'Night version']);
  assert.doesNotMatch(shown(reply), /sham-formula|pyramidNotes/);
  assert.match(shown(reply), /البديل الثاني/);
});

test('ordinary code blocks and prose are untouched', () => {
  const reply = 'مثال:\n```text\nزيت 10 مل + كحول 40 مل\n```\nوهذا كل شيء.';
  assert.equal(removeFormulaBlocks(reply), reply);
  assert.deepEqual(extractFormulasFromAIMessage(reply), []);
});

test('a long reply keeps its (non-canonical) formula block when compacted for the history', () => {
  const reply = 'ش'.repeat(5000) + '\n```json\n' + JSON.stringify(formula) + '\n```';
  const compact = compactTurn(reply);
  assert.ok(compact.length <= 4000);
  assert.equal(extractFormulaFromAIMessage(compact)?.title, 'Test blend');
});
