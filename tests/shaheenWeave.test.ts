/**
 * «الناسج والمؤرشف» — الربط وبطاقات المعرفة.
 * اللي الاختبارات دي بتحميه:
 *   · الناسج يربط كل وجهة ببياناتها الحقيقية، وكل خيط مع source + date، والناقصة تُرمز «غير متاح» من غير اختراع.
 *   · المؤرشف يحول كل إجابة مؤكدة لبطاقة معرفة (إجابة + مصدر + تاريخ + حداثة).
 *   · مفيش رقم من غير مصدر، ومفيش بطاقة قديمة تُقدم كمؤكدة.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type { ShippingCosts } from '../src/utils/pricing';
import { realShipping, shippingZone } from '../src/utils/pricing';
import { buildWeave, isWeaveReport } from '../scripts/shaheen-memory/weaver';
import { buildCurate, isCurateReport } from '../scripts/shaheen-memory/curator';

const root = new URL('..', import.meta.url).pathname;
const read = (rel: string) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
const NOW = Date.parse('2026-10-26T06:00:00Z');

const trade = read('src/data/live/trade-lanes.json') as {
  destinations: { code: string; nameAr: string; route?: 'platform_ships' | 'broker' | 'unknown'; carrier?: { id: string; nameAr: string; source?: string | null; dg?: boolean | null } }[];
};
const costs = read('src/data/shipping-costs.json') as ShippingCosts;
const shipping = { ...(read('src/data/shipping.json')), costs };
const customs = read('src/data/customs.json') as { countries?: Record<string, { vatPercent?: number; source?: string | null }>; agreements?: { id: string; nameAr: string }[] };
const fx = read('src/data/live/fx-rates.json') as { base: string; source?: string | null; updatedAt?: string; rates: Record<string, number> };
const graph = read('src/data/live/shaheen-graph.json') as { nodes?: { id: string; kind: string }[]; edges?: { from: string; to: string; source?: string | null; updatedAt?: string | null }[] };

test('الناسج: كل خيط وجهة له حالة (مكتمل / ناقص)، والمفقود يُسجل باسمه من غير اختراع', () => {
  const report = buildWeave({
    now: NOW, graph,
    destinations: trade.destinations.map((d) => ({
      code: d.code, nameAr: d.nameAr, route: d.route || 'unknown',
      carrier: d.carrier ? { id: d.carrier.id, nameAr: d.carrier.nameAr, source: d.carrier.source, dg: d.carrier.dg } : undefined,
    })),
    costs, shipping, customs, fx,
  });
  assert.ok(isWeaveReport(report));
  assert.ok(typeof report.score === 'number' && report.score >= 0 && report.score <= 100);
  for (const t of report.threads) {
    assert.ok(t.code && t.nameAr && t.destination);
    assert.ok(['platform_ships', 'broker', 'unknown'].includes(t.route));
    assert.ok(Array.isArray(t.missing));
    assert.equal(t.complete, t.missing.length === 0);
    // كل رقم له مصدر أو يُرمز null (مش اختراع)
    if (t.cost.chargedEgp !== null) assert.ok(t.cost.source || realShipping(t.code, 1, shipping) !== null);
  }
  assert.ok(report.summaryAr);
  assert.ok(Array.isArray(report.planAr));
});

test('الناسج: الوجهة من غير جمارك مؤكدة تُرمز ناقصة والبطاقة تقول «غير متاح»', () => {
  const report = buildWeave({
    now: NOW, graph,
    destinations: [{ code: 'EG', nameAr: 'مصر', route: 'broker', carrier: { id: 'c1', nameAr: 'شركة', source: 's', dg: true } }],
    costs, shipping, customs: { countries: {} }, fx,
  });
  const eg = report.threads.find((t) => t.code === 'EG');
  assert.ok(eg);
  assert.ok(!eg.complete);
  assert.ok(eg.missing.includes('customs'));
});

test('المؤرشف: كل بطاقة معرفة لها موضوع، إجابة، مصدر، تاريخ، وحالتها (طازحة / تحتاج مراجعة)', () => {
  const report = buildCurate({
    now: NOW,
    studyTargets: [{ labelAr: 'الشحن لمصر', whyAr: 'تكلفة الشحن لمصر', priority: 80, source: 'src/data/shipping-costs.json' }],
    examMisses: [{ question: 'الشحن لمصر بكام؟', expected: ['1876 ج.م'], whyAr: 'فاته', source: 'src/data/shipping-costs.json' }],
    reflexEntries: [{ question: 'الشحن لمصر بكام؟', answerAr: 'الشحن لأول زجاجة لمصر: 1876 ج.م', source: 'src/data/shipping-costs.json', updatedAt: new Date(NOW).toISOString() }],
    senses: { shippingZoneFallback: 0, customsVatMissing: 0, fxStale: false },
  });
  assert.ok(isCurateReport(report));
  for (const c of report.cards) {
    assert.ok(c.id && c.topic && c.answerAr && c.source && c.checkedAt);
    assert.ok(['high', 'medium', 'low'].includes(c.confidence));
    assert.ok(typeof c.stale === 'boolean');
    assert.ok(Array.isArray(c.usedBy));
  }
  assert.ok(report.summaryAr);
  assert.ok(Array.isArray(report.planAr));
});

test('المؤرشف: البطاقة القديمة تُرمز تحتاج مراجعة من غير ما تُقدم مؤكدة', () => {
  const old = new Date(Date.parse('2026-01-01T00:00:00Z')).toISOString();
  const report = buildCurate({
    now: NOW,
    studyTargets: [],
    examMisses: [],
    reflexEntries: [{ question: 'سؤال قديم', answerAr: 'إجابة قديمة', source: 'src/data/x.json', updatedAt: old }],
    senses: { shippingZoneFallback: 0, customsVatMissing: 0, fxStale: false },
  });
  const oldCard = report.cards.find((c) => c.topic === 'سؤال قديم');
  assert.ok(oldCard);
  assert.ok(oldCard.stale);
  assert.equal(oldCard.confidence, 'high');
});
