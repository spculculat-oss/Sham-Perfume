/**
 * «روبوت سلوك الزائر العطري»: the anonymous lab counters, the proposals, and the honesty rule (no signals = no
 * invented numbers). The counters themselves are tested here too (shape, caps, refusals).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import {
  EMPTY_LAB_AGGREGATE, addLabSignal, bandOf, labSignalFromDesign, readLabAggregate, readLabSignalPayload, type LabAggregate,
} from '../src/utils/labSignals';
import { analyzeScentBehaviour, inBank, tagsOfRaw, type BehaviourInput } from '../scripts/shaheen-scent/behaviour';

const bank = [
  { id: 'bergamot', name: { ar: 'برغموت', en: 'Bergamot oil' }, layer: 'top', tags: ['citrus', 'fresh'] },
  { id: 'rose', name: { ar: 'ورد', en: 'Rose absolute' }, layer: 'heart', tags: ['floral', 'rose'] },
  { id: 'oud', name: { ar: 'عود', en: 'Oud oil' }, layer: 'base', tags: ['oud', 'woody'] },
];
const raw = [
  { id: 'mat-sandalwood-mysore', nameAr: 'زيت خشب الصندل الميسوري', nameEn: 'Santalum Album (Sandalwood)', category: 'natural_essential', categoryAr: 'أخشاب', olfactoryFamily: 'خشبي كريمي دافئ', pyramidPlacement: 'base' },
  { id: 'mat-bergamot', nameAr: 'برغموت', nameEn: 'Bergamot oil', category: 'natural_essential', categoryAr: 'حمضيات', olfactoryFamily: 'حمضي منعش', pyramidPlacement: 'top' },
  { id: 'mat-civet', nameAr: 'سيفيت', nameEn: 'Civet absolute', category: 'natural_resin', categoryAr: 'جلود', olfactoryFamily: 'جلدي حيواني', pyramidPlacement: 'base' },
];
const products = [
  { families: ['oud'], inStock: true }, { families: ['woody'], inStock: true }, { families: ['floral'], inStock: true },
  { families: ['leather'], inStock: true }, { families: ['gourmand'], inStock: true },
];

const aggregate: LabAggregate = {
  version: 1, updatedAt: '2026-10-20T00:00:00Z', designs: 10,
  materials: { oud: 8, rose: 5, bergamot: 2, ghost: 4 }, typed: { mysore_santal: 3 }, types: { edp: 6, extrait: 4 }, bands: { edp: 6, extrait: 4 },
};
const input = (over: Partial<BehaviourInput> = {}): BehaviourInput => ({
  now: Date.parse('2026-10-24T00:00:00Z'), aggregate, signalsRead: true, signalsNoteAr: 'مقروء', bank, raw,
  storeFamilies: ['oud', 'woody', 'floral', 'leather', 'gourmand'], products, ...over,
});

test('the anonymous counter is strict: material ids only, a known band, nothing personal', () => {
  const design = {
    type: 'edp', concentration: 20, title: 'سري',
    lines: [{ materialId: 'oud', label: 'Oud', pct: 30 }, { materialId: 'rose', label: 'Rose', pct: 20 }, { materialId: '../etc', label: 'x', pct: 5 }, { label: 'unknown', pct: 3 }],
  };
  const payload = labSignalFromDesign(design)!;
  assert.deepEqual(payload.materials.sort(), ['oud', 'rose'], 'only real ids, no free text, no traversal');
  assert.equal(payload.band, 'edp');
  assert.equal('title' in payload, false, 'the formula title never leaves the device');
  assert.equal(labSignalFromDesign({ type: 'edp', concentration: 20, lines: [{ label: 'unknown', pct: 3 }] }), null);
  assert.equal(readLabSignalPayload({ type: 'edp', band: 'edp', materials: ['oud', 'nope id'] }), null, 'a bad id refuses the whole payload');
  assert.equal(readLabSignalPayload({ type: 'edp', band: 'edp', materials: ['oud'], name: 'someone' })?.materials.length, 1, 'extra fields are ignored, never stored');
  assert.equal(bandOf('edt', 10), 'edt');
  assert.equal(bandOf('oil', 20), 'oil');
});

test('counting: one press adds one design; the record cannot be inflated', () => {
  const one = addLabSignal(EMPTY_LAB_AGGREGATE, { type: 'edp', band: 'edp', materials: ['oud', 'rose'] }, new Date('2026-10-24T00:00:00Z'));
  assert.equal(one.designs, 1);
  assert.deepEqual(one.materials, { oud: 1, rose: 1 });
  assert.deepEqual(one.bands, { edp: 1 });
  assert.equal(one.updatedAt, '2026-10-24T00:00:00.000Z');
  const junk = readLabAggregate({ designs: -5, materials: { 'bad id': 4, oud: 2 }, typed: { ok: 1 } });
  assert.equal(junk.designs, 0);
  assert.deepEqual(junk.materials, { oud: 2 });
});

test('the study: most-used materials, family mix, unused bank and the materials the store family lacks', () => {
  const report = analyzeScentBehaviour(input());
  assert.equal(report.signals.read, true);
  assert.equal(report.signals.designs, 10);
  assert.equal(report.top[0].id, 'oud');
  assert.equal(report.top[0].share, 80);
  assert.ok(!report.top.some((t) => t.id === 'ghost'), 'an id the bank does not know is never shown as a material');
  assert.ok(report.families.some((f) => f.tag === 'oud' || f.tag === 'woody'));
  assert.ok(report.coverage.some((c) => c.family === 'leather' && c.bankMaterials === 0), 'leather is sold but the bank cannot build it');
  assert.ok(report.proposals.some((p) => p.rawId === 'mat-civet'), 'a leather material is proposed for the leather gap');
  assert.ok(report.proposals.some((p) => p.rawId === 'mat-sandalwood-mysore'), 'a woody material is proposed for the woody demand');
  assert.ok(!report.proposals.some((p) => p.rawId === 'mat-bergamot'), 'a material already in the bank is never proposed');
  assert.ok(report.unknownTyped.some((u) => u.label.includes('mysore')), 'what visitors typed is reported');
  assert.ok(report.planAr.length > 0 && report.summaryAr.includes('10'));
  assert.ok(report.score > 0 && report.score <= 100);
});

test('honesty: no live counters means no numbers — content analysis only', () => {
  const report = analyzeScentBehaviour(input({ signalsRead: false, aggregate: { ...EMPTY_LAB_AGGREGATE, designs: 99, materials: { oud: 5 } } }));
  assert.equal(report.signals.read, false);
  assert.equal(report.signals.designs, 0, 'an unread counter is never reported as designs');
  assert.equal(report.top.length, 0);
  assert.equal(report.unused.length, 0);
  assert.match(report.summaryAr, /مش مقروء|مفيش/);
  assert.ok(report.families.length > 0, 'the store families still guide the proposals');
});

test('matching: a material already in the bank is recognised by its name in either language', () => {
  assert.equal(inBank(raw[1], ['bergamot', 'برغموت']), true);
  assert.equal(inBank(raw[0], ['bergamot']), false);
  assert.ok(tagsOfRaw(raw[0]).includes('woody'));
  assert.ok(tagsOfRaw(raw[2]).includes('leather'));
});

test('the refuge indexes the new report and workflow (the structure has no orphan files)', async () => {
  const { refugeIndex } = await import('../src/utils/shaheenRefuge');
  const ids = new Set(refugeIndex().map((e) => e.id));
  assert.ok(ids.has('report:scent-behavior.json'));
  assert.ok(ids.has('workflow:shaheen-scent.yml'));
  assert.ok(existsSync('src/data/live/scent-behavior.json'), 'the report ships with the robot');
});
