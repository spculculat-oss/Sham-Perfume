import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PERFUME_STARTERS, simulatePerfume, starterDesign, type PerfumeDesign } from '../src/utils/designers/perfumeLab';
import { applyAll, consultPerfume, perfumeGoal, perfumeSuggestions, readPerfumeGoal } from '../src/utils/designers/perfumeAdvisor';
import { consultCosmetic, cosmeticGoal, cosmeticSuggestions, readCosmeticGoal } from '../src/utils/designers/cosmeticAdvisor';
import { cosmeticStarter, emptyCosmeticDesign, simulateCosmetic, type CosmeticDesign } from '../src/utils/designers/cosmeticLab';
import { COSMETIC_PRODUCTS } from '../src/utils/cosmeticFormulator';
import { WORLD_PERFUMES } from '../src/data/worldPerfumes';
import type { Msg } from '../src/utils/designers/advisorTypes';

const WORLD = WORLD_PERFUMES.map((w) => ({ id: w.id, name: { ar: w.nameAr, en: w.nameEn }, notes: w.pyramidNotes.map((n) => ({ name: `${n.nameAr} ${n.nameEn}`, pct: n.percentageOfOil })) }));
const ARABIC = /[\u0600-\u06FF]/;
const ar = (m: Msg) => m.t.ar.replace(/\{(\w+)\}/g, (_, k: string) => { const v = m.v?.[k]; return typeof v === 'object' ? v.ar : String(v); });
const msgsOk = (ms: Msg[]) => ms.forEach((m) => {
  assert.ok(m.t.ar && m.t.en && !ARABIC.test(m.t.en), m.t.en);
  for (const k of m.t.ar.match(/\{(\w+)\}/g) || []) assert.ok(m.v && k.slice(1, -1) in m.v, `missing ${k} in ${m.t.ar}`);
});

const messy = (): PerfumeDesign => ({
  ...starterDesign('fresh_citrus')!,
  lines: [{ materialId: 'oud', label: 'Oud', pct: 40 }, { materialId: 'lilial', label: 'Lilial', pct: 20 }, { materialId: 'rose', label: 'Rose', pct: 30 }, { label: 'زعتر بري', pct: 5 }],
});

test('«تعديل مقترح» (perfume): concrete edits with reason, change and effect — and they really improve the formula', () => {
  const d = messy();
  const sim = simulatePerfume(d);
  const s = perfumeSuggestions(d, sim);
  const ids = s.map((x) => x.id);
  for (const id of ['scale', 'compliance', 'cap-oud', 'add-top']) assert.ok(ids.includes(id), `${id} in ${ids.join(',')}`);
  assert.equal(s[0].id, 'scale', 'the sum comes first');
  for (const x of s) {
    msgsOk([x.title, x.why]);
    assert.ok(x.changes.length > 0, `${x.id} changes something`);
    assert.ok(Math.abs(simulatePerfume(x.design).total - 100) < 0.6 || x.id === 'concentration', `${x.id} keeps the sum at 100`);
  }
  const fix = s.find((x) => x.id === 'compliance')!;
  assert.ok(fix.changes.some((c) => c.id === 'lilial' && c.to === 0), 'the prohibited lilial goes');
  assert.ok(fix.effects.some((e) => e.better), 'the effect is shown as better');
  // «طبّق الكل» chains them and ends compliant, with an opening and the oud under control.
  const all = applyAll(d, s);
  const after = simulatePerfume(all);
  assert.notEqual(after.verdict, 'fail');
  assert.ok(after.layers.top >= 5);
  assert.ok((after.active.find((a) => a.material?.id === 'oud')?.oilPct || 0) <= 15);
  // A good starter needs few or no edits, and none makes the verdict worse.
  for (const st of PERFUME_STARTERS) {
    const sd = starterDesign(st.id)!;
    const base = simulatePerfume(sd).verdict;
    for (const x of perfumeSuggestions(sd)) assert.ok(['pass', 'warn', 'fail'].indexOf(simulatePerfume(x.design).verdict) <= ['pass', 'warn', 'fail'].indexOf(base));
    assert.ok(perfumeSuggestions(sd).length <= 2, st.id);
  }
  assert.deepEqual(perfumeSuggestions({ ...d, lines: [] }), []);
});

test('«متخصص يوصّلك لخلطتك» (perfume): understands the goal in Egyptian Arabic and builds the road step by step', () => {
  const it = readPerfumeGoal('زي البخور بس أخف للصيف');
  assert.ok(it.tags.includes('incense') && it.lighter && it.season === 'summer');
  const plan = perfumeGoal('زي البخور بس أخف للصيف', starterDesign('oriental_oud')!, WORLD);
  assert.ok(plan.steps.length >= 2 && plan.design);
  msgsOk([...plan.understood, ...plan.steps.map((s) => s.say)]);
  const final = simulatePerfume(plan.design!);
  assert.ok(final.active.some((a) => a.material?.tags.includes('incense')), 'incense is in');
  assert.ok(plan.design!.concentration < 20, 'lighter');
  assert.ok(plan.match && plan.match.to > plan.match.from);
  // Every step's design is the whole road so far: the last one is the final design.
  assert.deepEqual(plan.steps.at(-1)!.design, plan.design);

  const not = readPerfumeGoal('رجالي خشبي للشتا من غير عود');
  assert.ok(not.excludeMaterials.includes('oud') && not.tags.includes('woody') && !not.tags.includes('oud'));
  const p2 = perfumeGoal('رجالي خشبي للشتا من غير عود', starterDesign('oriental_oud')!, WORLD);
  assert.ok(!p2.design!.lines.some((l) => l.materialId === 'oud'), 'no oud left');

  const p3 = perfumeGoal('عايز حاجة شبه baccarat rouge', starterDesign('fresh_citrus')!, WORLD);
  assert.ok(p3.understood.some((m) => /Baccarat/.test(ar(m))), 'the world reference is understood');
  assert.ok(p3.design!.lines.some((l) => l.materialId === 'saffron'));

  const p4 = perfumeGoal('خليها أثبت', starterDesign('white_floral')!, WORLD);
  assert.ok(simulatePerfume(p4.design!).longevityHours > simulatePerfume(starterDesign('white_floral')!).longevityHours);
  const p5 = perfumeGoal('make it fresh citrus for summer', starterDesign('gourmand')!, WORLD);
  assert.ok(p5.design && simulatePerfume(p5.design).families.slice(0, 4).some((f) => f.tag === 'citrus'));

  // Vague → he asks, with choices that complete the sentence.
  const vague = perfumeGoal('عايز ريحة', starterDesign('fougere')!, WORLD);
  assert.equal(vague.steps.length, 0);
  assert.ok(vague.questions.length >= 2 && vague.questions[0].options.length >= 3);
  vague.questions.forEach((q) => { msgsOk([q.q]); q.options.forEach((o) => assert.ok(o.add.ar && o.add.en)); });
});

test('«استشارة شاهين» (perfume): a score out of 10 with strengths, weaknesses and practical advice', () => {
  const good = consultPerfume(starterDesign('white_floral')!)!;
  const bad = consultPerfume(messy())!;
  assert.ok(good.score >= 8 && good.score <= 10, `good ${good.score}`);
  assert.ok(bad.score < 5, `bad ${bad.score}`);
  assert.ok(good.strengths.length >= 3);
  assert.ok(bad.weaknesses.length >= 3);
  assert.ok(bad.weaknesses.some((m) => /IFRA/.test(ar(m))));
  assert.ok(good.advice.some((m) => /تتعتّق/.test(ar(m))), 'maceration advice');
  assert.equal(good.parts.length, 6);
  good.parts.forEach((p) => assert.ok(p.value >= 0 && p.value <= 100));
  msgsOk([...good.strengths, ...good.weaknesses, ...good.advice, ...bad.strengths, ...bad.weaknesses, ...bad.advice]);
  assert.equal(consultPerfume({ ...messy(), lines: [] }), undefined);
});

const badCream = (): CosmeticDesign => ({ ...emptyCosmeticDesign(), lines: [
  { ingredientId: 'water', label: 'Water', pct: 70 }, { ingredientId: 'almond', label: 'Almond', pct: 15 }, { ingredientId: 'grapeseed', label: 'Grapeseed', pct: 8 },
  { ingredientId: 'hydroquinone', label: 'Hydroquinone', pct: 2 }, { ingredientId: 'lavender', label: 'Lavender', pct: 2 },
] });

test('«تعديل مقترح» (cosmetics): preservative, emulsifier, antioxidant and compliance — each on its own', () => {
  const d = badCream();
  const s = cosmeticSuggestions(d);
  const ids = s.map((x) => x.id);
  for (const id of ['total', 'preservative', 'emulsion', 'compliance', 'antioxidant']) assert.ok(ids.includes(id), `${id} in ${ids.join(',')}`);
  s.forEach((x) => msgsOk([x.title, x.why]));
  const pres = s.find((x) => x.id === 'preservative')!;
  assert.deepEqual(pres.changes.map((c) => c.id).sort(), ['preservative', 'water'], 'only the preservative in, taken from the water');
  const all = applyAll(d, s);
  assert.equal(simulateCosmetic(all).verdict === 'fail', false);
  for (const p of COSMETIC_PRODUCTS) assert.ok(cosmeticSuggestions(cosmeticStarter(p)).length <= 2, p);
});

test('«متخصص يوصّلك لخلطتك» (cosmetics): product, skin, goal and limits from his words', () => {
  const it = readCosmeticGoal('كريم للوش لبشرة دهنية فيها حبوب من غير ريحة');
  assert.equal(it.product, 'face_cream');
  assert.equal(it.skin, 'oily');
  assert.ok(it.concerns.includes('acne') && it.noScent);
  assert.equal(readCosmeticGoal('لوشن للجسم').product, 'body_lotion');
  assert.equal(readCosmeticGoal('زيت للشعر').product, 'hair_oil');
  assert.equal(readCosmeticGoal('مرطب شفايف').product, 'lip_balm');

  const plan = cosmeticGoal('كريم للوش لبشرة دهنية فيها حبوب من غير ريحة', cosmeticStarter('body_butter'));
  assert.ok(plan.design && plan.steps.length >= 2);
  msgsOk([...plan.understood, ...plan.steps.map((s) => s.say)]);
  const sim = simulateCosmetic(plan.design!);
  assert.ok(['cream', 'lotion'].includes(sim.kind));
  assert.notEqual(sim.verdict, 'fail');
  assert.ok(plan.design!.lines.some((l) => l.ingredientId === 'niacinamide'), 'an acne active');
  assert.ok(!plan.design!.lines.some((l) => ['lavender', 'tea_tree', 'peppermint', 'fragrance'].includes(l.ingredientId || '')), 'fragrance-free');

  const tweak = cosmeticGoal('عايزه للترطيب وأخف', cosmeticStarter('face_cream'));
  assert.ok(tweak.design!.lines.some((l) => l.ingredientId === 'hyaluronic'));
  assert.ok(simulateCosmetic(tweak.design!).oil < simulateCosmetic(cosmeticStarter('face_cream')).oil);

  const vague = cosmeticGoal('عايز منتج', emptyCosmeticDesign());
  assert.equal(vague.steps.length, 0);
  assert.ok(vague.questions.some((q) => q.id === 'product'));
});

test('«استشارة شاهين» (cosmetics): proven starters score high, an unsafe cream scores low', () => {
  for (const p of COSMETIC_PRODUCTS) assert.ok(consultCosmetic(cosmeticStarter(p))!.score >= 8, p);
  const bad = consultCosmetic(badCream())!;
  assert.ok(bad.score < 5);
  assert.ok(bad.weaknesses.some((m) => /حافظة|محفوظة/.test(ar(m))));
  msgsOk([...bad.strengths, ...bad.weaknesses, ...bad.advice]);
});

test('the advisor buttons render on both studios in every tested language with no Arabic outside Arabic', async () => {
  (globalThis as { React?: unknown }).React = React;
  const { default: DesignersStudio } = await import('../src/components/DesignersStudio');
  for (const kind of ['perfume', 'cosmetic'] as const) {
    const arHtml = renderToStaticMarkup(React.createElement(DesignersStudio, { kind, currentLang: 'ar', onNavigate: () => {} }));
    for (const id of ['advisor-edits', 'advisor-goal', 'advisor-consult']) assert.match(arHtml, new RegExp(`data-testid="${id}"`));
    assert.match(arHtml, /تعديل مقترح/);
    assert.match(arHtml, /متخصص يوصّلك لخلطتك/);
    assert.match(arHtml, /استشارة شاهين/);
    const en = renderToStaticMarkup(React.createElement(DesignersStudio, { kind, currentLang: 'en', onNavigate: () => {} }));
    assert.match(en, /Suggested edit/);
    assert.ok(!ARABIC.test(en.replace(/<[^>]+>/g, ' ')));
  }
});
