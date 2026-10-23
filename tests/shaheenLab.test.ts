/**
 * «معمل شاهين للتجارب والابتكار» — ضمانات المعمل: مادة علمية كاملة لكل مجال، وتجارب مصممة
 * بفرضية ومتغيرات وضوابط وسلامة، وأبحاث راسخة حقيقية (علماء وسنوات — بلا مراجع مختلقة)،
 * وتعاون بين العلوم، ومنتجات تخدم السوق. والروبوت «المُجرِّب» مسجّل رسمياً بقسم المعمل.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  LAB, LAB_CROSS, LAB_EXPERIMENTS, LAB_FIELDS, LAB_PRODUCTS, LAB_RESEARCH, labStats,
} from '../src/utils/shaheenLab';
import { BOTS, DEPARTMENTS, botOf } from '../src/utils/shaheenOrg';
import { SHIFTS } from '../scripts/shaheen-patrol/shifts';
import { refugeIndex } from '../src/utils/shaheenRefuge';

const fieldIds = new Set(LAB_FIELDS.map((f) => f.id));

test('the lab holds complete scientific material for every field', () => {
  assert.ok(LAB_FIELDS.length >= 12, `only ${LAB_FIELDS.length} fields`);
  const ids = new Set(LAB_FIELDS.map((f) => f.id));
  assert.equal(ids.size, LAB_FIELDS.length, 'field ids are unique');
  for (const f of LAB_FIELDS) {
    assert.ok(f.scienceAr.length >= 60, `${f.id}: the science material is too thin`);
    assert.ok(f.methodsAr.length >= 30, `${f.id}: methods missing`);
    assert.ok(f.toolsAr.length >= 20, `${f.id}: tools missing`);
    assert.ok(f.marketAr.length >= 20, `${f.id}: market missing`);
    assert.ok(labStats().byField.find((x) => x.id === f.id)!.experiments >= 2, `${f.id}: needs designed experiments`);
    assert.ok(labStats().byField.find((x) => x.id === f.id)!.research >= 1, `${f.id}: needs established research`);
    assert.ok(labStats().byField.find((x) => x.id === f.id)!.products >= 1, `${f.id}: needs a product`);
  }
});

test('every experiment is scientifically designed (hypothesis, variables, controls, safety)', () => {
  assert.ok(LAB_EXPERIMENTS.length >= 24, `only ${LAB_EXPERIMENTS.length} experiments`);
  const ids = new Set(LAB_EXPERIMENTS.map((e) => e.id));
  assert.equal(ids.size, LAB_EXPERIMENTS.length, 'experiment ids are unique');
  for (const e of LAB_EXPERIMENTS) {
    assert.ok(fieldIds.has(e.field), `${e.id}: unknown field ${e.field}`);
    assert.ok(e.questionAr.length >= 15, e.id);
    assert.ok(e.hypothesisAr.length >= 25, `${e.id}: hypothesis missing`);
    assert.ok(e.independentAr.length >= 8 && e.dependentAr.length >= 8 && e.controlledAr.length >= 8, `${e.id}: variables incomplete`);
    assert.ok(e.stepsAr.length >= 4, `${e.id}: steps`);
    for (const s of e.stepsAr) assert.ok(s.length >= 10, `${e.id}: thin step`);
    assert.ok(e.safetyAr.length >= 20, `${e.id}: safety missing`);
    assert.ok(e.expectedAr.length >= 15, `${e.id}: expected outcome missing`);
    for (const c of e.crossWith) assert.ok(fieldIds.has(c), `${e.id}: unknown cross field ${c}`);
  }
});

test('the research index is real science (real scientists and years, no fabricated citations)', () => {
  assert.ok(LAB_RESEARCH.length >= 16, `only ${LAB_RESEARCH.length} research entries`);
  for (const r of LAB_RESEARCH) {
    assert.ok(fieldIds.has(r.field), `${r.id}: unknown field`);
    assert.ok(r.scientistAr.length >= 5, `${r.id}: scientist missing`);
    assert.match(r.yearAr, /\d{3,4}/, `${r.id}: year must be a real year`);
    assert.ok(r.findingAr.length >= 40, `${r.id}: finding too thin`);
    assert.ok(!/doi\.org|et al\.|https?:\/\//i.test(`${r.titleAr}${r.scientistAr}${r.findingAr}`), `${r.id}: no URLs or fake journal citations`);
  }
});

test('the products serve the market with real science behind them', () => {
  assert.ok(LAB_PRODUCTS.length >= 12, `only ${LAB_PRODUCTS.length} products`);
  for (const p of LAB_PRODUCTS) {
    assert.ok(fieldIds.has(p.field), `${p.id}: unknown field`);
    assert.ok(p.marketAr.length >= 20, `${p.id}: market need missing`);
    assert.ok(p.scienceAr.length >= 25, `${p.id}: science missing`);
    assert.ok(p.statusAr.length >= 5, `${p.id}: status missing`);
  }
});

test('the cross-field map connects distinct fields with real cooperation', () => {
  assert.ok(LAB_CROSS.length >= 12, `only ${LAB_CROSS.length} cross links`);
  const pairs = new Set<string>();
  for (const c of LAB_CROSS) {
    assert.ok(c.fields.length >= 2, c.id);
    const sorted = [...c.fields].sort();
    for (const f of c.fields) assert.ok(fieldIds.has(f), `${c.id}: unknown field ${f}`);
    assert.equal(new Set(c.fields).size, c.fields.length, `${c.id}: repeated field`);
    const key = sorted.join('+');
    assert.ok(!pairs.has(key), `${c.id}: duplicate pair ${key}`);
    pairs.add(key);
    assert.ok(c.whyAr.length >= 25 && c.sharedAr.length >= 15 && c.productsAr.length >= 15, `${c.id}: thin cooperation`);
  }
});

test('«المُجرِّب» is an official robot of the named lab department', () => {
  const bot = botOf('lab');
  assert.ok(bot, 'the lab robot is registered in BOTS');
  assert.equal(bot!.dept, 'innovation', 'the lab robot sits in the lab department');
  assert.equal(bot!.report, 'shaheen-lab.json');
  assert.equal(bot!.workflow, 'shaheen-lab.yml');
  assert.ok(DEPARTMENTS.some((d) => d.id === 'innovation' && d.nameAr.includes('المعمل')), 'the lab department is named');
  assert.ok(DEPARTMENTS.some((d) => d.id === 'innovation' && d.nameAr.includes('التجارب والابتكار')), 'the full lab name');
  assert.ok(SHIFTS.some((s) => s.bots.includes('lab')), 'the lab robot has a shift');
  const index = refugeIndex();
  const report = index.find((e) => e.id === 'report:shaheen-lab.json');
  assert.ok(report, 'the lab report is indexed in the refuge');
  assert.equal(report!.owner, 'lab');
  assert.ok(report!.nameAr.includes('معمل'));
  const workflow = index.find((e) => e.id === 'workflow:shaheen-lab.yml');
  assert.ok(workflow, 'the lab workflow is indexed in the refuge');
  assert.equal(workflow!.owner, 'lab');
  assert.ok(BOTS.find((b) => b.id === 'lab')!.dutiesAr.includes('معمل شاهين'));
});

test('the lab report written by the robot matches the lab content (no invented numbers)', () => {
  const report = JSON.parse(readFileSync(new URL('../src/data/live/shaheen-lab.json', import.meta.url), 'utf8')) as {
    counts: Record<string, number>;
    fields: unknown[];
    experiments: unknown[];
    research: unknown[];
    products: unknown[];
    cross: unknown[];
  };
  const stats = labStats();
  assert.equal(report.counts.fields, stats.fields);
  assert.equal(report.counts.experiments, stats.experiments);
  assert.equal(report.counts.research, stats.research);
  assert.equal(report.counts.products, stats.products);
  assert.equal(report.counts.crossLinks, stats.crossLinks);
  assert.equal(report.fields.length, stats.fields);
  assert.equal(report.experiments.length, stats.experiments);
  assert.equal(report.research.length, stats.research);
  assert.equal(report.products.length, stats.products);
  assert.equal(report.cross.length, stats.crossLinks);
});
