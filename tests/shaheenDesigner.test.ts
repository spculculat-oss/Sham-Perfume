/**
 * «مصمم شاهين الذاتي» — Shaheen designs a blend himself (no AI platform): the right family for the wish, the
 * materials the visitor named, every layer present, 100% of the oil, each material under its usual maximum, and a
 * formula block the formula builder can open.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeDesign, designAnswer, readBrief } from '../src/utils/shaheenDesigner';
import { extractFormulaFromAIMessage } from '../src/utils/aiFormulaExtractor';

const formulaOf = (text: string) => {
  const f = extractFormulaFromAIMessage(text);
  assert.ok(f, 'the answer carries a formula the builder can open');
  return f!;
};
const names = (text: string) => formulaOf(text).pyramidNotes.map((n) => n.nameAr).join(' ');

test('a winter request gets a warm blend resting on its base', () => {
  const answer = designAnswer('صمم لي خلطة شتوية', 'ar')!;
  assert.ok(answer);
  const f = formulaOf(answer);
  const base = f.pyramidNotes.filter((n) => n.category === 'base').reduce((s, n) => s + n.percentageOfOil, 0);
  const top = f.pyramidNotes.filter((n) => n.category === 'top').reduce((s, n) => s + n.percentageOfOil, 0);
  assert.ok(base > top, 'a warm perfume rests on its base');
  assert.match(names(answer), /عنبر|عود|صندل|فانيليا/);
  assert.doesNotMatch(names(answer), /كالون/); // no marine note in a winter blend
  assert.match(answer, /IFRA/);
});

test('a summer request gets a fresh blend that opens wide', () => {
  const answer = designAnswer('design a fresh summer perfume for men', 'en')!;
  const f = formulaOf(answer);
  const top = f.pyramidNotes.filter((n) => n.category === 'top').reduce((s, n) => s + n.percentageOfOil, 0);
  const base = f.pyramidNotes.filter((n) => n.category === 'base').reduce((s, n) => s + n.percentageOfOil, 0);
  assert.ok(top > base);
  assert.match(f.pyramidNotes.map((n) => n.nameEn).join(' '), /Bergamot|Lemon|Mandarin|Grapefruit/);
  assert.doesNotMatch(f.pyramidNotes.map((n) => n.nameEn).join(' '), /Oud|Smoky/);
});

test('the materials the visitor names are in, sizes and concentrations are read', () => {
  const answer = designAnswer('اعملي عطر نسائي حلو فيه فانيليا وياسمين تركيز 25% 100 مل', 'ar')!;
  assert.match(names(answer), /فانيليا/);
  assert.match(names(answer), /ياسمين/);
  const f = formulaOf(answer);
  assert.equal(f.bottleVolumeMl, 100);
  assert.equal(f.concentrationPercent, 25);
  assert.match(answer, /٢٥ مل/); // 100 × 25% of oil
  assert.ok(readBrief('صمم عطر فيه فل', 'ar')!.named.includes('jasmine'));
  assert.ok(readBrief('صمم عطر بالفل', 'ar')!.named.includes('jasmine'));
  assert.deepEqual(readBrief('صمم عطر فلفل وردي', 'ar')!.named, ['pink_pepper']);
  assert.ok(readBrief('صمم عطر للحر', 'ar')!.fresh);
});

test('every design sums to 100% of the oil, keeps each material under its maximum, and has all three layers', () => {
  const wishes = ['صمم عطر شتوي رجالي فيه عود', 'صمم عطر صيفي منعش', 'صمم عطر شرقي للسهرة', 'صمم عطر نسائي زهري بودري',
    'صمم عطر حار بالتوابل فيه قرفة وقرنفل وزعفران', 'design a clean everyday perfume', 'design a smoky oud perfume 30 ml'];
  for (const wish of wishes) {
    const lang = /[a-z]/i.test(wish) ? 'en' : 'ar';
    const design = composeDesign(readBrief(wish, lang)!, lang);
    assert.equal(design.notes.reduce((s, n) => s + n.percentageOfOil, 0), 100, wish);
    for (const layer of ['top', 'heart', 'base']) assert.ok(design.notes.some((n) => n.category === layer), `${wish}: ${layer}`);
    assert.ok(design.notes.length <= 15, wish);
    const cinnamon = design.notes.find((n) => n.id === 'cinnamon');
    if (cinnamon) assert.ok(cinnamon.percentageOfOil <= 1, 'cinnamon stays in drops');
    const clove = design.notes.find((n) => n.id === 'clove');
    if (clove) assert.ok(clove.percentageOfOil <= 2, 'clove stays in drops');
    formulaOf(designAnswer(wish, lang)!);
  }
});

test('no direction → he asks instead of guessing; questions and shopping are not design requests', () => {
  const ask = designAnswer('صمم عطر', 'ar')!;
  assert.match(ask, /منعش/);
  assert.equal(extractFormulaFromAIMessage(ask), null);
  assert.equal(designAnswer('ايه هي التركيبة الهرمية؟', 'ar'), undefined);
  assert.equal(designAnswer('ما هو العود', 'ar'), undefined);
  assert.equal(designAnswer('عايز اشتري عطر شتوي', 'ar'), undefined);
  assert.equal(designAnswer('كم سعر عطر عود', 'ar'), undefined);
  assert.equal(designAnswer('what is a perfume pyramid?', 'en'), undefined);
});

test('a follow-up changes the last design: the new wish wins', () => {
  const sweeter = designAnswer('خليه أحلى', 'ar', 'صمم عطر شتوي رجالي فيه عود')!;
  assert.match(sweeter, /حلو/);
  assert.match(names(sweeter), /عود/);
  const summer = designAnswer('خليه صيفي', 'ar', 'صمم عطر شتوي رجالي فيه عود')!;
  assert.doesNotMatch(summer.split('\n')[0]!, /شتوي/);
  assert.equal(formulaOf(designAnswer('اعمله 100 مل', 'ar', 'صمم عطر صيفي')!).bottleVolumeMl, 100);
  assert.equal(designAnswer('شكرا', 'ar', 'صمم عطر صيفي'), undefined);
});
