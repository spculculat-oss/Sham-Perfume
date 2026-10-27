/**
 * «حلقة تعلّم شاهين» — الآذان والمعلم والممتحن والانعكاس، على جداول مكتوبة بإيد وبعدها على ملفات الموقع الحقيقية.
 *
 * اللي الاختبارات دي بتحميه (طلب صاحب الموقع، 2026-10-26: «الروبوتات دي تكون جسد الترابط وخلايا عصبية»):
 *   · الآذان بتقرا اللي بيتسأل فعلاً، وبتشيل أي رقم شخصي أو إيميل قبل التقرير — بتعدّه، مش بتنقله.
 *   · المعلم مابيخترعش سؤال: كل سؤال إجابته مكتوبة في ملف حقيقي وليه مصدر، والسؤال بلا مصدر بيترفض.
 *   · الممتحن بيصحح على الرقم/الاسم الموثّق مش على الأسلوب، وفجوة = غلط، والدرجة رقم واحد من 100.
 *   · الانعكاس بيتحسب بنفس دوال الدفع، فمستحيل يقول سعر غير اللي الموقع بيحصّله.
 *   · مفيش أي روبوت بيغيّر سعر: التعلّم بيقيس وبيوصي، والسعر قرار صاحب المتجر.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type { FxTable, ShippingTable } from '../src/utils/pricing';
import { BUNDLED_FX, SHIPPING, convert, handlingFee, realShipping, shippingCost } from '../src/utils/pricing';
import { matchReflex, reflexAnswer, REFLEX } from '../src/utils/shaheenReflex';
import type { ShaheenGraph } from '../src/utils/shaheenGraph';
import { collectEars, isEarsReport, type EarsEntry } from '../scripts/shaheen-mind/ears';
import { anchors, buildStudyPlan, isStudyPlan, type PracticeQuestion } from '../scripts/shaheen-mind/tutor';
import { gradeQuestion, isExamReport, scoreExam } from '../scripts/shaheen-mind/exam';
import { buildReflex, isReflexReport } from '../scripts/shaheen-mind/reflex';
import { isStale, mindSnapshot, type MindFiles } from '../src/utils/shaheenMind';

const root = new URL('..', import.meta.url).pathname;
const read = (rel: string) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
const NOW = Date.parse('2026-10-26T06:00:00Z');
const SPECIALISTS = [
  { id: 'specialist_business', nameAr: 'د. الأعمال', tracks: ['commerce'] },
  { id: 'specialist_geo', nameAr: 'د. الجغرافيا', tracks: ['geography'] },
];

// ————— الآذان —————

test('الآذان: بترتب الأسئلة الحقيقية لكل متخصص، وبتعدّ اللي لسه من غير جواب', () => {
  const entries: EarsEntry[] = [
    { question: 'الشحن لمصر بكام؟', count: 1, lang: 'ar', state: 'answered' },
    { question: 'الشحن للسعودية بكام؟', count: 1, lang: 'ar', state: 'answered' },
    { question: 'جمارك مصر كام في المية؟', count: 1, lang: 'ar', state: 'pending' },
  ];
  const report = collectEars({
    now: NOW, entries, specialists: SPECIALISTS,
    pick: (q) => (q.includes('جمارك') ? 'specialist_geo' : 'specialist_business'),
  });
  assert.equal(report.total, 3);
  assert.equal(report.answered, 2);
  assert.equal(report.pending, 1);
  assert.equal(report.bySpecialist[0].specialistId, 'specialist_business');
  assert.equal(report.bySpecialist[0].asked, 2);
  // أعلى طلب هو اللي بيظهر في الملخص — الإشارة اللي الاجتماع بيبدأ بيها.
  assert.match(report.summaryAr, /د\. الأعمال/);
  assert.ok(isEarsReport(report));
});

test('الآذان: أي رقم شخصي أو إيميل بيتشال قبل التقرير — بيتعدّ ومش بيتنقل', () => {
  const entries: EarsEntry[] = [
    { question: 'رقمي 01012345678 اتأكدوا منه', count: 1, lang: 'ar', state: 'pending' },
    { question: 'ابعتوا على someone@example.com', count: 1, lang: 'ar', state: 'pending' },
    { question: 'الشحن لمصر بكام؟', count: 1, lang: 'ar', state: 'answered' },
  ];
  const report = collectEars({ now: NOW, entries, specialists: SPECIALISTS, pick: () => 'specialist_business' });
  assert.equal(report.total, 1);
  assert.equal(report.dropped, 2);
  const text = JSON.stringify(report);
  assert.ok(!text.includes('01012345678'));
  assert.ok(!text.includes('someone@example.com'));
});

test('الآذان: السؤال اللي اتسأل ومفيش له درس بيتسجل في unmetAr', () => {
  const report = collectEars({
    now: NOW,
    entries: [{ question: 'ايه هي قوانين نيوتن التلاتة للحركة؟', count: 1, lang: 'ar', state: 'answered' }],
    specialists: SPECIALISTS,
    pick: () => 'specialist_geo',
    lessonQuestions: ['الشحن لمصر بكام ومن أي شركة؟'],
  });
  assert.deepEqual(report.unmetAr, ['ايه هي قوانين نيوتن التلاتة للحركة؟']);
});

test('الآذان: تقرير الموقع الحقيقي بيعدّي الحارس', () => {
  const live = read('src/data/live/shaheen-ears.json');
  assert.ok(isEarsReport(live));
  assert.equal(isEarsReport({ version: 1 }), false);
});

// ————— المعلم —————

const graph = (over: Partial<ShaheenGraph> = {}): ShaheenGraph => ({
  version: 1,
  updatedAt: new Date(NOW).toISOString(),
  nodes: [{ id: 'carrier:pos', kind: 'carrier', labelAr: 'بوس لاجو الدولي', ref: 'shipping-lanes.json' }],
  edges: [],
  stats: { nodes: 1, edges: 0, byKind: {}, byRelation: {}, orphans: [], hubs: [] },
  score: { total: 0, coverage: 0, lessons: 0, catalogue: 0, freshness: 0, connectivity: 0, depth: 0, whyAr: '' },
  summaryAr: '',
  ...over,
});

const destination = (over: Record<string, unknown> = {}) => ({
  code: 'EG', nameAr: 'مصر',
  costUsd: 90, extraUsd: 15, chargedEgp: 1876,
  carrierId: 'pos', carrierNameAr: 'بوس لاجو الدولي', carrierSource: 'src/data/shipping-lanes.json', carrierCheckedAt: '2026-10-01',
  carrierDg: null,
  customsVerified: true, vatPercent: 14, customsSource: 'src/data/customs.json',
  ...over,
});

const plan = () => buildStudyPlan({
  now: NOW,
  graph: graph(),
  destinations: [
    destination(),
    destination({ code: 'MY', nameAr: 'ماليزيا', costUsd: null, extraUsd: null, chargedEgp: null, carrierNameAr: null, carrierSource: null, carrierCheckedAt: null, customsVerified: false, vatPercent: null, customsSource: null }),
  ],
  immuneFindings: [{ kind: 'contradiction', severity: 'high', subject: 'سعران للشحن لمصر', whatAr: 'رقمين لنفس الوجهة', fixAr: 'يتوحّد على المنشور' }],
  origins: [{ code: 'MY', nameAr: 'ماليزيا', products: 1063 }],
  specialists: SPECIALISTS,
  tradeSpecialistId: 'specialist_business',
  recall: [{ question: 'الشحن لمصر بكام؟', answer: 'الشحن لمصر 1876 ج.م بتكلفة الشركة 1705', specialistId: 'specialist_business' }],
  staleDays: 120,
});

test('المعلم: الوجهة اللي مالهاش تعريفة أو جمارك مؤكدة بتبقى هدف دراسة لمتخصصها', () => {
  const p = plan();
  const reasons = p.targets.map((t) => t.id);
  assert.ok(reasons.includes('destination:MY'));
  assert.ok(reasons.includes('destination:EG'), 'الجمارك المؤكدة موجودة بس الوجهة مالهاش درس بيشرحها');
  const my = p.targets.find((t) => t.id === 'destination:MY')!;
  assert.equal(my.specialistId, 'specialist_business');
  assert.ok(my.priority >= 60);
  assert.ok(my.whyAr.includes('ماليزيا'));
});

test('المعلم: شركة بتشحن العطر ومش مؤكد إنها بتقبله بتبقى أول أولوية', () => {
  const p = plan();
  const carrier = p.targets.find((t) => t.kind === 'carrier');
  assert.ok(carrier);
  assert.equal(carrier!.priority, 95);
  assert.ok(carrier!.whyAr.includes('UN1266'));
});

test('المعلم: كل سؤال امتحان ليه إجابة موثّقة ومصدر — سؤال بلا مصدر بيترفض', () => {
  const p = plan();
  assert.ok(p.questions.length > 0);
  for (const q of p.questions) {
    assert.ok(q.expected.length > 0, `${q.id} من غير إجابة متوقعة`);
    assert.ok(q.source.length > 0, `${q.id} من غير مصدر`);
    assert.ok(q.question.length > 5);
  }
  // السؤال عن سعر الشحن بيقارن باللي الموقع بيحصّله فعلاً (ج.م) — مش بتكلفة الشركة بالدولار.
  const ship = p.questions.find((q) => q.id === 'q-ship-EG')!;
  assert.deepEqual(ship.expected, ['1876', 'بوس لاجو الدولي']);
  assert.ok(isStudyPlan(p));
  const broken = { ...p, questions: [{ ...p.questions[0], source: '' }] };
  assert.equal(isStudyPlan(broken), false);
});

test('المعلم: سؤال الاسترجاع بيمسك الرقم الكبير من إجابة حقيقية', () => {
  const p = plan();
  const recall = p.questions.find((q) => q.kind === 'rule');
  assert.ok(recall, 'لازم سؤال استرجاع واحد على الأقل من ذاكرة شاهين');
  assert.deepEqual(recall!.expected, ['1876']);
  assert.equal(recall!.source, 'src/data/live/shaheen-memory.json');
});

test('المعلم: anchors بياخد الرقم الأكبر بس، والأرقام الصغيرة مش دليل', () => {
  assert.deepEqual(anchors('تكلفة 10 ج.م وهامش 15% والسعر 1876 ج.م'), ['1876']);
  assert.deepEqual(anchors('مفيش أرقام هنا خالص'), []);
  const words = anchors('التوصيل السريع للقاهرة والجيزة');
  assert.ok(words.length > 0 && words.every((w) => w.length >= 6));
});

test('المعلم: تعارض خطير في المناعة بيتحوّل لحلقة ضعيفة', () => {
  const p = plan();
  const immune = p.targets.find((t) => t.id.startsWith('immune:'));
  assert.equal(immune?.kind, 'consistency');
  assert.equal(immune?.priority, 85);
});

test('المعلم: خطة الموقع الحقيقية بتعدّي الحارس وكل سؤال فيها بمصدره', () => {
  const live = read('src/data/live/shaheen-study.json');
  assert.ok(isStudyPlan(live));
  assert.equal(isStudyPlan({ version: 1, agent: 'tutor', targets: [], questions: [{ id: 'x', question: '؟', expected: [] }] }), false);
});

// ————— الممتحن —————

const question = (over: Partial<PracticeQuestion> = {}): PracticeQuestion => ({
  id: 'q-ship-EG', question: 'الشحن لمصر بكام؟ ومن أي شركة؟', kind: 'shipping_cost',
  expected: ['1876', 'بوس لاجو الدولي'], source: 'src/data/shipping-costs.json',
  specialistId: 'specialist_business', targetId: 'destination:EG',
  ...over,
});

test('الممتحن: بيقبل الرقم بالعربي وبالفاصلة، وبيصحح على الاسم الموثّق', () => {
  assert.equal(gradeQuestion(question(), { id: 'q-ship-EG', answer: 'الشحن ١٨٧٦ ج.م مع بوس لاجو الدولي', source: 'trade_lane', answered: true }).ok, true);
  assert.equal(gradeQuestion(question({ expected: ['1876'] }), { id: 'q-ship-EG', answer: 'الشحن 1,876 ج.م', source: 'trade_lane', answered: true }).ok, false,
    'الفاصلة مش رقم — التصحيح بيقارن الرقم زي ما هو');
});

test('الممتحن: الإجابة الناقصة والـ«فجوة» الاتنين غلط، والسبب بيتكتب', () => {
  const missing = gradeQuestion(question(), { id: 'q-ship-EG', answer: 'الشحن 1876 ج.م', source: 'trade_lane', answered: true });
  assert.equal(missing.ok, false);
  assert.match(missing.whyAr, /بوس لاجو الدولي/);
  const gap = gradeQuestion(question(), { id: 'q-ship-EG', answer: 'محتاج مذاكرة', source: 'gap', answered: false });
  assert.equal(gap.ok, false);
  assert.match(gap.whyAr, /فجوة/);
});

test('الممتحن: درجة واحدة من 100، وأضعف متخصص بيتسمّى، والفشل بيرجع للمعلم', () => {
  const qs = [
    question(),
    question({ id: 'q-customs-EG', question: 'جمارك مصر كام في المية؟', expected: ['14'], specialistId: 'specialist_geo' }),
  ];
  const report = scoreExam({
    now: NOW,
    questions: qs,
    attempts: [
      { id: 'q-ship-EG', answer: '1876 ج.م من بوس لاجو الدولي', source: 'trade_lane', answered: true },
      { id: 'q-customs-EG', answer: '', source: 'gap', answered: false },
    ],
    specialists: SPECIALISTS,
  });
  assert.equal(report.iq, 50);
  assert.equal(report.correct, 1);
  assert.equal(report.fromGap, 1);
  assert.equal(report.misses.length, 1);
  assert.equal(report.misses[0].id, 'q-customs-EG');
  assert.ok(report.bySpecialist.find((s) => s.id === 'specialist_geo')!.percent === 0);
  assert.match(report.summaryAr, /50\/100/);
  assert.ok(isExamReport(report));
  assert.equal(isExamReport({ version: 1, agent: 'examiner' }), false);
});

test('الممتحن: تقرير الموقع الحقيقي عبارة عن درجة بين 0 و100 وبيعدّي الحارس', () => {
  const live = read('src/data/live/shaheen-exam.json');
  assert.ok(isExamReport(live));
  assert.ok(live.iq >= 0 && live.iq <= 100);
  assert.equal(live.correct + live.misses.length, live.asked, 'الصح + الفايت = اللي اتسأل');
});

// ————— الانعكاس —————

const FX: FxTable = { base: 'USD', updatedAt: '2026-10-26', source: 'test', rates: { USD: 1, EGP: 50 } };
const TABLE: ShippingTable = {
  currency: 'USD',
  zones: [{ id: 'world', name: { ar: 'العالم', en: 'World' }, firstItem: 60, extraItem: 20, days: '5-10' }],
  default: { id: 'world', name: { ar: 'العالم', en: 'World' }, firstItem: 60, extraItem: 20, days: '5-10' },
  handling: { percent: 10, capUsd: 5 },
  costs: {
    version: 1, currency: 'USD', source: 'src/data/shipping-costs.json', checkedAt: '2026-10-01',
    countries: { EG: { firstItem: 90, extraItem: 15, carrier: 'بوس لاجو الدولي' }, MY: { firstItem: 5, extraItem: 2 } },
  },
};

const reflexFile = () => buildReflex({
  now: NOW, shipping: TABLE, fx: FX,
  destinations: [
    { code: 'EG', nameAr: 'مصر', carrierNameAr: 'بوس لاجو الدولي', carrierSource: 'src/data/shipping-lanes.json', carrierCheckedAt: '2026-10-01', carrierDg: null, customsVerified: true, vatPercent: 14, customsSource: 'src/data/customs.json' },
    { code: 'KZ', nameAr: 'كازاخستان', carrierNameAr: null, carrierSource: null, carrierCheckedAt: null, carrierDg: null, customsVerified: false, vatPercent: null, customsSource: null },
  ],
  tradeSpecialistId: 'specialist_business',
});

test('الانعكاس: السعر اللي بيقوله هو نفسه اللي محرك الدفع بيحصّله', () => {
  const file = reflexFile();
  const ship = file.entries.find((e) => e.id === 'reflex-ship-EG')!;
  const real = realShipping('EG', 1, TABLE)!;
  const charged = shippingCost('EG', 1, TABLE);
  const expected = Math.round(convert(charged, 'USD', 'EGP', FX));
  assert.ok(ship.answerAr.includes(`${expected} ج.م`), `الإجابة لازم فيها ${expected} ج.م`);
  assert.ok(ship.answerAr.includes(`${Math.round(convert(real, 'USD', 'EGP', FX))} ج.م`), 'التكلفة المنشورة مكتوبة');
  assert.ok(ship.answerAr.includes(`${Math.round(convert(handlingFee(real, TABLE), 'USD', 'EGP', FX))} ج.م`), 'هامش التجهيز مكتوب');
  assert.ok(ship.answerAr.includes('50%'), 'قاعدة الصافي 50% بتتقال');
  assert.ok(ship.source && ship.checkedAt);
});

test('الانعكاس: كل إجابة معاها مصدرها وتاريخها — ومفيش رقم مخترع للجمارك', () => {
  const file = reflexFile();
  for (const e of file.entries) {
    assert.ok(e.source && e.checkedAt, `${e.id} من غير مصدر أو تاريخ`);
    assert.ok(e.answerAr.length > 20);
  }
  const kz = file.entries.filter((e) => e.code === 'KZ');
  assert.equal(kz.some((e) => e.kind === 'customs'), false, 'جمارك كازاخستان مش مؤكدة — مفيش رقم');
  const kzShip = file.entries.find((e) => e.id === 'reflex-ship-KZ');
  assert.ok(kzShip, 'كازاخستان ليها سعر منطقة — إجابة شحن موجودة');
  assert.match(kzShip!.answerAr, /سعر منطقة/);
  assert.match(kzShip!.answerAr, /بيتأكد قبل الدفع/);
  assert.equal(kzShip!.source, 'src/data/shipping.json');
});

test('الانعكاس: قاعدة العطر واحدة، وبتختفي لما الشركة ترفض', () => {
  assert.equal(reflexFile().entries.filter((e) => e.kind === 'perfume_on_board').length, 1);
  const refused = buildReflex({
    now: NOW, shipping: TABLE, fx: FX,
    destinations: [{ code: 'EG', nameAr: 'مصر', carrierNameAr: 'بوس لاجو الدولي', carrierSource: null, carrierCheckedAt: null, carrierDg: true, customsVerified: false, vatPercent: null, customsSource: null }],
    tradeSpecialistId: 'specialist_business',
  });
  assert.equal(refused.entries.some((e) => e.kind === 'perfume_on_board'), false);
  assert.ok(isReflexReport(reflexFile()));
  assert.equal(isReflexReport({ version: 1, updatedAt: 'x', entries: [] }), false);
});

test('الانعكاس: جدول الموقع الحقيقي فيه إجابات كفاية وكل واحدة بمصدرها', () => {
  const live = read('src/data/live/shaheen-reflex.json');
  assert.ok(isReflexReport(live));
  assert.ok(live.entries.length >= 70, `الجدول فيه ${live.entries.length} إجابة بس`);
  assert.ok(live.entries.every((e: { source: string; checkedAt: string }) => e.source && e.checkedAt));
});

// ————— مطابق الانعكاس في الشات —————

test('المطابق: «جمارك مصر» بيروح لسؤال الجمارك، و«الشحن لمصر» لسؤال الشحن', () => {
  assert.equal(matchReflex('الشحن لمصر بكام؟')?.kind, 'shipping');
  assert.equal(matchReflex('جمارك مصر كام؟')?.kind, 'customs');
  assert.equal(matchReflex('الشحن لمصر بكام؟')?.code, 'EG');
});

test('المطابق: العطر من غير بلد بياخد القاعدة العامة، والسؤال الغريب مابيتجاوبش', () => {
  assert.equal(matchReflex('بتشحنوا العطر؟')?.kind, 'perfume_on_board');
  assert.equal(matchReflex('ازاي احسب تركيز 50 مل؟'), undefined);
  assert.equal(matchReflex('الشحن لنيبال بكام؟'), undefined, 'بلد مش في الجدول — مفيش إجابة فورية');
  assert.equal(reflexAnswer('ازاي احسب تركيز 50 مل؟'), undefined);
});

test('المطابق: «بكام العطر ده؟» سؤال سعر متجر — الانعكاس مابيخطفهوش', () => {
  // البوّابة: الانعكاس بيجاوب على سؤال لوجستي صريح بس، وإلا كان سرق كل سؤال فيه كلمة «عطر» من محرك السعر.
  assert.equal(matchReflex('بكام العطر ده؟'), undefined);
  assert.equal(matchReflex('My perfume'), undefined);
  assert.equal(matchReflex('الأسعار عندكم كام؟'), undefined);
});

test('المطابق: الإجابة الفورية بالعربي والإنجليزي من نفس المدخل', () => {
  const ar = reflexAnswer('الشحن لمصر بكام؟', 'ar')!;
  const en = reflexAnswer('الشحن لمصر بكام؟', 'en')!;
  const egpShipping = Math.round(convert(shippingCost('EG', 1), SHIPPING.currency, 'EGP', BUNDLED_FX));
  assert.ok(ar.includes(String(egpShipping)) && ar.includes('المصدر'), `الإجابة لازم تستخدم سعر المحرك الحالي (${egpShipping})`);
  assert.ok(en.includes('EGP') && en.includes('Source'));
  assert.ok(REFLEX.entries.length > 0);
});


// ————— لوحة «درجة عقل شاهين» في لوحة الإدارة —————

test('اللوحة: أربع أرقام من أربع تقارير، وكل رقم بمصدره وتاريخه', () => {
  const files: MindFiles = {
    graph: read('src/data/live/shaheen-graph.json'),
    immune: read('src/data/live/shaheen-immune.json'),
    exam: read('src/data/live/shaheen-exam.json'),
    reflex: read('src/data/live/shaheen-reflex.json'),
    study: read('src/data/live/shaheen-study.json'),
    ears: read('src/data/live/shaheen-ears.json'),
  };
  const snap = mindSnapshot(files);
  assert.deepEqual(snap.numbers.map((n) => n.id), ['brain', 'iq', 'immune', 'reflex']);
  for (const n of snap.numbers) {
    assert.ok(n.value !== null, `${n.id} ظهر من غير رقم`);
    assert.ok(n.src.startsWith('src/data/live/shaheen-'), `${n.id} من غير ملف مصدر`);
    assert.ok(n.updatedAt && Number.isFinite(Date.parse(n.updatedAt)), `${n.id} من غير تاريخ`);
  }
  assert.ok(snap.numbers.find((n) => n.id === 'iq')!.value! <= 100);
  // أضعف رقم هو اللي بيتسمّى في الملخص — عشان صاحب الموقع يعرف يبدأ منين.
  assert.match(snap.summaryAr, /درجة/);
});

test('اللوحة: تقرير ناقص بيتقال «مش متاح» — مش صفر', () => {
  const snap = mindSnapshot({ graph: read('src/data/live/shaheen-graph.json') });
  const iq = snap.numbers.find((n) => n.id === 'iq')!;
  assert.equal(iq.value, null);
  assert.match(iq.noteAr, /مش موجود/);
  assert.equal(isStale(iq, Date.now()), false, 'رقم مش موجود مش «قديم» — هو مش موجود');
});

test('اللوحة: تقرير أقدم من دورة اليوم بيتعلّم «قديم»', () => {
  const old = { version: 1, updatedAt: new Date(NOW - 5 * 86_400_000).toISOString(), score: { total: 99, whyAr: 'تمام' }, stats: { nodes: 1, edges: 1 } };
  const snap = mindSnapshot({ graph: old });
  const brain = snap.numbers.find((n) => n.id === 'brain')!;
  assert.equal(brain.value, 99);
  assert.equal(isStale(brain, NOW, snap.staleHours), true);
});
