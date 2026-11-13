/**
 * «قسم المصممين» — the designer's journal and lab, in the perfume and the cosmetics sections:
 *  1. The material bank knows the names designers write (Arabic and English, the specific before the general).
 *  2. The perfume simulation is sane (classic starters pass, an oriental outlasts a fresh citrus, the timeline moves
 *     from the top to the base) and the compliance report fails what IFRA forbids — with the reason and a fix.
 *  3. «صلّح التوافق» and the other creative tools give a formula that adds up and passes.
 *  4. The cosmetics simulation recognises the product, fails water without a preservative, an emulsion without an
 *     emulsifier and over-limit actives, and its fix passes.
 *  5. The journal keeps versions, ratings and comparisons, and exports/imports.
 *  6. The page renders in Arabic and in English with no Arabic, and every word reaches the translator.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PERFUME_MATERIALS, findPerfumeMaterial, perfumeMaterial } from '../src/utils/designers/perfumeMaterials';
import {
  PERFUME_STARTERS, TYPE_RANGE, balancePyramid, boostLongevity, convertType, emptyPerfumeDesign, fixCompliance, inspire, lineFor, scaleTo100,
  simulatePerfume, starterDesign, type PerfumeDesign,
} from '../src/utils/designers/perfumeLab';
import {
  LAB_INGREDIENTS, cosmeticLineFor, cosmeticStarter, emptyCosmeticDesign, findLabIngredient, fixCosmeticCompliance, inspireCosmetic,
  simulateCosmetic, topUpWithWater, type CosmeticDesign,
} from '../src/utils/designers/cosmeticLab';
import { COSMETIC_PRODUCTS } from '../src/utils/cosmeticFormulator';
import { COSMETIC_INGREDIENTS } from '../src/utils/cosmeticIngredients';
import { WORLD_PERFUMES } from '../src/data/worldPerfumes';
import { compareLines, journalExport, journalImport, rateVersion, readJournal, saveVersion } from '../src/utils/designers/journal';
import { DESIGNERS_UI } from '../src/لغات/designersL10n';
import { harvestInlineTexts } from '../scripts/shaheen-languages/translator';

const ARABIC = /[\u0600-\u06FF]/;
const world = WORLD_PERFUMES.map((w) => ({ id: w.id, name: { ar: w.nameAr, en: w.nameEn }, notes: w.pyramidNotes.map((n) => ({ name: `${n.nameAr} ${n.nameEn}`, pct: n.percentageOfOil })) }));
const design = (lines: [string, number][], extra: Partial<PerfumeDesign> = {}): PerfumeDesign => ({ ...emptyPerfumeDesign(), ...extra, lines: lines.map(([n, p]) => lineFor(n, p)) });
const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };

test('the material bank finds what designers write, the specific name before the general one', () => {
  assert.equal(new Set(PERFUME_MATERIALS.map((m) => m.id)).size, PERFUME_MATERIALS.length, 'unique ids');
  for (const m of PERFUME_MATERIALS) {
    assert.equal(findPerfumeMaterial(m.name.ar)?.id, m.id, `Arabic name of ${m.id}`);
    assert.equal(findPerfumeMaterial(m.name.en)?.id, m.id, `English name of ${m.id}`);
    assert.ok(m.life > 0 && m.strength > 0 && m.density > 0.5 && m.density < 1.6, `${m.id}: physical data`);
    if (m.swap) assert.ok(perfumeMaterial(m.swap), `${m.id}: swap exists`);
    if (m.ifra?.kind === 'prohibited') assert.ok(m.swap || m.ifra.why.ar, `${m.id}: a prohibited material says why`);
  }
  const cases: [string, string][] = [
    ['برغموت', 'bergamot'], ['برغموت معصور', 'bergamot_expressed'], ['ليمون', 'lemon'], ['ليمون جراس', 'lemongrass'],
    ['مسك', 'musk'], ['ليليال', 'lilial'], ['Iso E Super', 'iso_e'], ['عود', 'oud'], ['امبروكسان', 'ambroxan'], ['فانيليا', 'vanilla'],
  ];
  for (const [text, id] of cases) assert.equal(findPerfumeMaterial(text)?.id, id, text);
  assert.equal(findPerfumeMaterial('xyz unknown'), undefined);
});

test('perfume simulation: classic starters pass, sum to 100, and behave like real perfumes', () => {
  for (const s of PERFUME_STARTERS) {
    const d = starterDesign(s.id)!;
    assert.ok(Math.abs(d.lines.reduce((t, l) => t + l.pct, 0) - 100) < 0.05, `${s.id}: sums to 100`);
    const sim = simulatePerfume(d, { world });
    assert.equal(sim.verdict, 'pass', `${s.id}: ${sim.checks.filter((c) => c.status === 'fail' || c.status === 'warn').map((c) => c.id).join(',')}`);
    assert.ok(sim.longevityHours >= 3 && sim.longevityHours <= 14, `${s.id}: ${sim.longevityHours} h`);
    assert.ok(sim.projection >= 1 && sim.projection <= 5);
    assert.ok(sim.macerationDays >= 14 && sim.macerationDays <= 42);
    assert.ok(sim.timeline[0].layers.top > sim.timeline[0].layers.base, `${s.id}: the top leads at the spray`);
    const last = sim.timeline[sim.timeline.length - 1];
    assert.ok(last.layers.base >= last.layers.top, `${s.id}: the base is what remains`);
    assert.ok(sim.character.ar.length > 10 && !ARABIC.test(sim.character.en));
  }
  const oriental = simulatePerfume(starterDesign('oriental_oud')!);
  const fresh = simulatePerfume(starterDesign('fresh_citrus')!);
  assert.ok(oriental.longevityHours > fresh.longevityHours + 2, 'an oriental outlasts a fresh citrus');
  const edt = simulatePerfume(convertType(starterDesign('oriental_oud')!, 'edt'));
  const extrait = simulatePerfume(convertType(starterDesign('oriental_oud')!, 'extrait'));
  assert.ok(extrait.longevityHours > oriental.longevityHours && oriental.longevityHours > edt.longevityHours, 'more oil lasts longer');
  // The batch sheet adds up.
  const b = simulatePerfume({ ...starterDesign('oriental_oud')!, bottleMl: 50, bottles: 2 });
  assert.equal(b.carrier.totalMl, 100);
  assert.equal(b.carrier.oilMl, 20);
  assert.ok(Math.abs(b.batch.reduce((t, x) => t + x.ml, 0) - 20) < 0.1);
  assert.ok(Math.abs(b.carrier.alcoholMl - 80) < 0.1);
});

test('what it resembles: the closest world references and store perfumes, by shared materials and character', () => {
  const sim = simulatePerfume(starterDesign('oriental_oud')!, { world, store: [
    { slug: 'oud-rose', name: { ar: 'عود وورد', en: 'Oud & Rose' }, notes: ['Rose', 'Oud', 'Saffron', 'Amber', 'Musk'] },
    { slug: 'citrus', name: { ar: 'حمضي', en: 'Citrus' }, notes: ['Lemon', 'Grapefruit', 'Mint'] },
  ] });
  const top = sim.resemblances.filter((r) => r.kind === 'world');
  assert.equal(top[0]?.id, 'royal-taif-oud');
  assert.ok(top[0].shared.includes('oud') && top[0].shared.includes('rose'));
  const store = sim.resemblances.filter((r) => r.kind === 'store');
  assert.deepEqual(store.map((r) => r.slug), ['oud-rose']);
});

test('international standards: prohibited, over-limit and sun-sensitising materials fail with the reason and a fix', () => {
  const d = design([['برغموت معصور', 20], ['ليمون', 10], ['قرفة', 5], ['ليليال', 10], ['طحلب السنديان', 5], ['مسك', 50]]);
  const sim = simulatePerfume(d);
  assert.equal(sim.verdict, 'fail');
  const fail = (id: string) => sim.checks.find((c) => c.id === id && c.status === 'fail');
  assert.ok(fail('ifra-lilial'), 'Lilial is prohibited');
  assert.ok(fail('ifra-oakmoss'), 'oakmoss over its limit');
  assert.ok(fail('phototoxic'), 'expressed citrus summed over 1');
  assert.ok(fail('constituent-cinnamal'), 'cinnamal from cinnamon over its limit');
  for (const c of sim.checks.filter((x) => x.status === 'fail')) {
    assert.ok(c.detail.ar.length > 10 && c.detail.en.length > 10, `${c.id}: a reason`);
    assert.ok(c.fix, `${c.id}: a fix`);
    assert.ok(!ARABIC.test(c.title.en + c.detail.en + (c.fix?.en || '')), `${c.id}: English has no Arabic`);
  }
  assert.ok(sim.allergens.some((a) => a.inci === 'Butylphenyl Methylpropional' && a.label));
  // Fix compliance: no failure left, still 100 %.
  const fixed = fixCompliance(d);
  const after = simulatePerfume(fixed);
  assert.ok(!after.checks.some((c) => c.status === 'fail'), after.checks.filter((c) => c.status === 'fail').map((c) => c.id).join(','));
  assert.ok(!fixed.lines.some((l) => l.materialId === 'lilial'), 'the prohibited material is swapped');
  assert.ok(Math.abs(fixed.lines.reduce((t, l) => t + l.pct, 0) - 100) < 0.05);
  // Coumarin at an extrait level.
  const coumarin = simulatePerfume(design([['coumarin', 10], ['musk', 90]], { type: 'extrait', concentration: 30 }));
  assert.ok(coumarin.checks.some((c) => c.id === 'constituent-coumarin' && c.status === 'fail'));
  // Unknown material and wrong type.
  const odd = simulatePerfume(design([['Mystery accord', 50], ['musk', 50]], { type: 'edt', concentration: 30 }));
  assert.ok(odd.checks.some((c) => c.id.startsWith('unknown-') && c.status === 'warn'));
  assert.ok(odd.checks.some((c) => c.id === 'type' && c.status === 'warn'));
});

test('creative tools: scale, balance, boost, convert and inspire give sound formulas', () => {
  const d = design([['bergamot', 50], ['rose', 10], ['musk', 10]]);
  assert.ok(Math.abs(scaleTo100(d).lines.reduce((t, l) => t + l.pct, 0) - 100) < 0.05);
  const balanced = simulatePerfume(balancePyramid(d));
  assert.ok(Math.abs(balanced.layers.top - 22) < 1 && Math.abs(balanced.layers.heart - 43) < 1 && Math.abs(balanced.layers.base - 35) < 1, JSON.stringify(balanced.layers));
  const fresh = starterDesign('fresh_citrus')!;
  assert.ok(simulatePerfume(boostLongevity(fresh)).longevityHours > simulatePerfume(fresh).longevityHours);
  for (const t of ['extrait', 'edt', 'mist', 'oil'] as const) {
    const c = convertType(fresh, t);
    assert.ok(c.concentration >= TYPE_RANGE[t][0] && c.concentration <= TYPE_RANGE[t][1]);
  }
  const a = inspire(fresh, 7), b = inspire(fresh, 7), c = inspire(fresh, 8);
  assert.deepEqual(a, b, 'the same seed gives the same variation');
  assert.notDeepEqual(a.lines, c.lines);
  assert.ok(Math.abs(a.lines.reduce((t, l) => t + l.pct, 0) - 100) < 0.05);
});

test('cosmetics simulation: classic formulas pass and are recognised; broken ones fail with reasons; the fix passes', () => {
  const expected: Record<string, string[]> = { face_cream: ['cream', 'lotion'], body_lotion: ['cream', 'lotion'], gel_serum: ['gel'], face_oil: ['oil'], body_butter: ['butter'], lip_balm: ['balm'], hair_oil: ['oil'], face_wash: ['wash'] };
  for (const p of COSMETIC_PRODUCTS) {
    const sim = simulateCosmetic(cosmeticStarter(p));
    assert.equal(sim.verdict, 'pass', `${p}: ${sim.checks.filter((c) => c.status !== 'pass' && c.status !== 'info').map((c) => c.id).join(',')}`);
    assert.ok(expected[p].includes(sim.kind), `${p} → ${sim.kind}`);
    assert.equal(sim.closest[0]?.product, p, `${p} resembles itself`);
  }
  assert.equal(LAB_INGREDIENTS.filter((i) => COSMETIC_INGREDIENTS.some((c) => c.id === i.id)).length, COSMETIC_INGREDIENTS.length, 'all 41 documented ingredients are in the lab');
  assert.equal(findLabIngredient('زيت جوجوبا')?.id, 'jojoba');
  assert.equal(findLabIngredient('هيدروكينون')?.id, 'hydroquinone');
  assert.equal(findLabIngredient('Salicylic acid')?.id, 'salicylic');

  const bad: CosmeticDesign = { ...emptyCosmeticDesign(), lines: [['ماء', 70], ['زيت جوجوبا', 15], ['هيدروكينون', 2], ['ريتينول', 1], ['زيت لافندر', 2], ['نياسيناميد', 5]].map(([n, p]) => cosmeticLineFor(n as string, p as number)) };
  const sim = simulateCosmetic(bad);
  assert.equal(sim.verdict, 'fail');
  for (const id of ['rule-hydroquinone', 'max-retinol', 'preservative', 'emulsion', 'eo']) assert.ok(sim.checks.some((c) => c.id === id && c.status === 'fail'), id);
  for (const c of sim.checks) assert.ok(!ARABIC.test(c.title.en + c.detail.en + (c.fix?.en || '')), `${c.id}: English has no Arabic`);
  const fixed = fixCosmeticCompliance(bad);
  const after = simulateCosmetic(fixed);
  assert.ok(!after.checks.some((c) => c.status === 'fail'), after.checks.filter((c) => c.status === 'fail').map((c) => c.id).join(','));
  assert.ok(Math.abs(fixed.lines.reduce((t, l) => t + l.pct, 0) - 100) < 0.05);
  assert.ok(fixed.lines.some((l) => l.ingredientId === 'alpha_arbutin') && !fixed.lines.some((l) => l.ingredientId === 'hydroquinone'));

  // Area and rinse-off rules.
  const body: CosmeticDesign = { ...cosmeticStarter('body_lotion'), lines: [...cosmeticStarter('body_lotion').lines, cosmeticLineFor('retinol', 0.1)] };
  assert.ok(simulateCosmetic(topUpWithWater(body)).checks.some((c) => c.id === 'max-retinol' && c.status === 'fail'), 'retinol 0.1 % is over the body limit');
  const wash = cosmeticStarter('face_wash');
  const withMit = topUpWithWater({ ...wash, lines: [...wash.lines, cosmeticLineFor('methylisothiazolinone', 0.001)] });
  assert.ok(!simulateCosmetic(withMit).checks.some((c) => c.id === 'rule-methylisothiazolinone'), 'MIT is allowed in rinse-off at 0.0015 %');
  assert.ok(simulateCosmetic({ ...withMit, rinseOff: false }).checks.some((c) => c.id === 'rule-methylisothiazolinone' && c.status === 'fail'), 'but not in leave-on');
  const v = inspireCosmetic(cosmeticStarter('face_cream'), 3);
  assert.ok(Math.abs(v.lines.reduce((t, l) => t + l.pct, 0) - 100) < 0.05);
});

test('the journal keeps versions, ratings and comparisons, and survives export and import', () => {
  const store = memory();
  const d1 = starterDesign('fresh_citrus')!;
  const id = saveVersion('perfume', { title: 'Summer', design: d1, summary: { verdict: 'pass', score: 4 } }, store);
  const d2 = boostLongevity(d1);
  assert.equal(saveVersion('perfume', { id, title: 'Summer', design: d2, summary: { verdict: 'pass', score: 6 } }, store), id);
  rateVersion('perfume', id, 0, 4, 'great after an hour', store);
  const [entry] = readJournal<PerfumeDesign>('perfume', store);
  assert.equal(entry.versions.length, 2);
  assert.equal(entry.versions[0].rating, 4);
  assert.ok(compareLines(entry.versions[1].design.lines, entry.versions[0].design.lines).some((x) => x.from !== undefined && x.to !== undefined && x.to > x.from), 'changed levels are listed');
  assert.deepEqual(compareLines([{ label: 'a', pct: 1 }], [{ label: 'a', pct: 1 }, { label: 'b', pct: 2 }]), [{ label: 'b', from: undefined, to: 2 }]);
  assert.equal(readJournal('cosmetic', store).length, 0, 'perfume and cosmetics journals are separate');
  const file = journalExport('perfume', readJournal('perfume', store));
  const other = memory();
  assert.equal(journalImport('perfume', file, other), 1);
  assert.equal(readJournal<PerfumeDesign>('perfume', other)[0].versions.length, 2);
  assert.equal(journalImport('cosmetic', file, other), 0, 'a perfume file does not go into the cosmetics journal');
});

test('every designers text reaches the translator and the page renders in English with no Arabic', async () => {
  const source = readFileSync(fileURLToPath(new URL('../src/لغات/designersL10n.ts', import.meta.url)), 'utf8');
  const found = new Set(harvestInlineTexts(source).map((h) => h.en));
  for (const v of Object.values(DESIGNERS_UI)) {
    assert.ok(v.ar && v.en && !ARABIC.test(v.en), v.en);
    if (/\p{L}{2,}/u.test(v.en)) assert.ok(found.has(v.en), `the translator cannot see: ${v.en}`);
  }
  (globalThis as { React?: unknown }).React = React;
  const { default: DesignersStudio } = await import('../src/components/DesignersStudio');
  for (const kind of ['perfume', 'cosmetic'] as const) {
    const ar = renderToStaticMarkup(React.createElement(DesignersStudio, { kind, currentLang: 'ar', onNavigate: () => {} }));
    assert.match(ar, /قسم المصممين/);
    assert.match(ar, /data-testid="designer-verdict"/);
    for (const lang of ['en', 'de'] as const) {
      const html = renderToStaticMarkup(React.createElement(DesignersStudio, { kind, currentLang: lang, onNavigate: () => {} }));
      assert.ok(!ARABIC.test(html.replace(/<[^>]+>/g, ' ')), `${kind}/${lang} shows Arabic: ${html.replace(/<[^>]+>/g, ' ').match(/[^ ]*[\u0600-\u06FF][^ ]*/)?.[0]}`);
      assert.match(html, /data-testid="designer-line"/);
    }
  }
});
