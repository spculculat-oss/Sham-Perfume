/**
 * «إدارة المبيعات» — the desk inside «بنك شام»: the pipeline's arithmetic, the target's honest pace, the daily
 * rhythm, the curriculum built from the handbook and the selling craft, the advisor, the public robot report
 * (counts only), the live service (no contact details, no invented won deal) and the organisation registration.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { MemoryStore } from '../server/core/store';
import { FinanceService } from '../server/finance/service';
import { BankService } from '../server/finance/bank';
import { SalesService } from '../server/sales/service';
import { financeId } from '../server/finance/report';
import {
  DEAL_STAGES, SILENT_AFTER_DAYS, STAGE_PROBABILITY, dayKey, dealActionState, dealActions, daysBetween, lostReasonGroups, moveDeal, monthKey, pipelineHygiene, silentDeals, summarizePipeline, weightedMinor, type Deal,
} from '../src/sales/pipeline';
import { weeklyReview } from '../src/sales/review';
import { daysInMonth, paceTargets, salesHealth, type SalesTarget } from '../src/sales/targets';
import { dailyRhythm } from '../src/sales/rhythm';
import { MODULE_LABEL, SALES_LESSONS, gradeStudy, lessonOfDay, salesPlaybookDoc, studyPlan, studyProgress } from '../src/sales/playbook';
import { answerSales, salesTopicOf, type SalesSnapshot } from '../src/sales/advisor';
import { SALES_PITFALLS, SALES_PRINCIPLES } from '../src/utils/salesCraft';
import { handbookSections } from '../src/utils/botHandbook';
import { BOTS, LINKS, botOf } from '../src/utils/shaheenOrg';
import { SHIFTS, shiftOfBot } from '../scripts/shaheen-patrol/shifts';
import { REVIEWERS } from '../scripts/shaheen-patrol/patrol';
import { SCHEDULES } from '../src/utils/opsLive';
import { runPrecheck } from '../scripts/shaheen-council/precheck';
import { buildSalesReport, type DeskFacts } from '../scripts/shaheen-sales/desk';

const NOW = Date.parse('2026-10-24T09:00:00Z');
const iso = (day: string) => `${day}T00:00:00.000Z`;
const deal = (over: Partial<Deal> = {}): Deal => ({
  id: 'd1', title: 'طقم هدايا', accountLabel: 'عميل جملة', currency: 'EGP', valueMinor: 150000, stage: 'lead', probability: 10,
  source: 'store', items: ['SKU-1'], nextActionAt: '2026-10-20', nextActionAr: 'أتابع السعر', notes: '', orderRef: '',
  createdAt: iso('2026-10-10'), updatedAt: iso('2026-10-10'), ...over,
});
const target = (over: Partial<SalesTarget> = {}): SalesTarget => ({ id: '2026-10:EGP', month: '2026-10', currency: 'EGP', amountMinor: 3000000, updatedAt: iso('2026-10-01'), ...over });

test('pipeline: stages, weighted forecast, overdue/today/idle actions and the win rate', () => {
  assert.equal(dayKey(NOW), '2026-10-24');
  assert.equal(monthKey(NOW), '2026-10');
  assert.equal(daysBetween('2026-10-20', '2026-10-24'), 4);
  assert.equal(weightedMinor(deal({ valueMinor: 100000, probability: 45 })), 45000);
  assert.equal(dealActionState(deal(), NOW), 'overdue');
  assert.equal(dealActionState(deal({ nextActionAt: '2026-10-24' }), NOW), 'today');
  assert.equal(dealActionState(deal({ nextActionAt: '2026-10-26' }), NOW), 'soon');
  assert.equal(dealActionState(deal({ nextActionAt: '' }), NOW), 'idle');
  assert.equal(dealActionState(deal({ stage: 'won' }), NOW), 'closed');

  const deals = [
    deal({ id: 'a', nextActionAt: '2026-10-21' }),
    deal({ id: 'b', nextActionAt: '2026-10-24' }),
    deal({ id: 'c', nextActionAt: '' }),
    deal({ id: 'd', stage: 'won', valueMinor: 200000, probability: 100, closedAt: iso('2026-10-12') }),
    deal({ id: 'e', stage: 'lost', valueMinor: 50000, probability: 0, closedAt: iso('2026-10-13'), lostReason: 'غالي' }),
    deal({ id: 'f', currency: 'USD', valueMinor: 10000, nextActionAt: '2026-10-30' }),
  ];
  const actions = dealActions(deals, NOW);
  assert.deepEqual(actions.map((a) => a.deal.id), ['a', 'b', 'c'], 'overdue, then today, then idle');
  assert.equal(actions[0].lateDays, 3);

  const summary = summarizePipeline(deals, NOW);
  assert.equal(summary.openCount, 4);
  assert.equal(summary.overdueCount, 1);
  assert.equal(summary.dueTodayCount, 1);
  assert.equal(summary.withoutNextStep, 1);
  assert.equal(summary.wonCount, 1); assert.equal(summary.lostCount, 1);
  assert.equal(summary.winRate, 50);
  assert.equal(summary.wonThisMonth, 1);
  assert.deepEqual(summary.wonThisMonthMinor, [{ currency: 'EGP', minor: 200000 }]);
  const egp = summary.byCurrency.find((r) => r.currency === 'EGP')!;
  assert.equal(egp.openMinor, 150000 + 150000 + 150000);
  assert.equal(egp.weightedMinor, 15000 + 15000 + 15000);
  assert.equal(egp.lostCount, 1);
  assert.equal(summary.stages.length, DEAL_STAGES.length);
  assert.ok(pipelineHygiene(summary).score < 100);
  assert.ok(pipelineHygiene(summarizePipeline([], NOW)).notesAr.length);

  // Lost reasons are the owner's own words, grouped and counted — and an unexplained loss stays a gap.
  const lost = [
    deal({ id: 'l1', stage: 'lost', lostReason: 'السعر عالي', closedAt: iso('2026-10-11') }),
    deal({ id: 'l2', stage: 'lost', lostReason: '  السعر   عالي ', closedAt: iso('2026-10-18') }),
    deal({ id: 'l3', stage: 'lost', lostReason: 'لقى أوفر', closedAt: iso('2026-10-15') }),
    deal({ id: 'l4', stage: 'lost', lostReason: '', closedAt: iso('2026-10-16') }),
    deal({ id: 'l5', stage: 'won', lostReason: 'مش خسارة' }),
  ];
  const groups = lostReasonGroups(lost);
  assert.deepEqual(groups.map((g) => [g.reason, g.count]), [['السعر عالي', 2], ['لقى أوفر', 1]]);
  assert.equal(groups[0].lastAt, iso('2026-10-18'));
  assert.equal(summarizePipeline(lost, NOW).lostWithoutReason, 1, 'a loss with no reason is a counted gap, not an invented cause');
  assert.deepEqual(lostReasonGroups([], 3), []);
});

test('pipeline: moving a deal keeps dates honest and reopens cleanly', () => {
  const lost = moveDeal(deal({ stage: 'negotiation', probability: 65 }), { stage: 'lost', lostReason: 'مقارن بالسوق' }, NOW);
  assert.equal(lost.stage, 'lost'); assert.equal(lost.lostReason, 'مقارن بالسوق'); assert.equal(lost.closedAt, new Date(NOW).toISOString());
  assert.equal(lost.nextActionAt, '', 'a closed deal has no next action');
  const reopened = moveDeal(lost, { stage: 'qualified', nextActionAt: '2026-10-28' }, NOW);
  assert.equal(reopened.closedAt, undefined);
  assert.equal(reopened.nextActionAt, '2026-10-28');
  const won = moveDeal(deal(), { stage: 'won' }, NOW);
  assert.equal(won.probability, STAGE_PROBABILITY.won);
});

test('targets: real month days, honest pace, daily need and a labelled projection', () => {
  assert.equal(daysInMonth('2026-10'), 31);
  assert.equal(daysInMonth('2028-02'), 29);
  assert.throws(() => daysInMonth('2026-13'));
  const [pace] = paceTargets([target()], [{ currency: 'EGP', collectedMinor: 2000000, paidOrders: 8 }], NOW);
  assert.equal(pace.dayOfMonth, 24);
  assert.equal(pace.daysLeft, 7);
  assert.equal(pace.percent, 66.7);
  assert.equal(pace.expectedMinor, Math.round(3000000 * 24 / 31));
  assert.equal(pace.pace, 'behind');
  assert.equal(pace.neededPerDayMinor, Math.ceil(1000000 / 7));
  assert.equal(pace.projectionMinor, Math.round(2000000 / 24 * 31));
  assert.equal(pace.confidence, 'medium');
  const [unset] = paceTargets([], [{ currency: 'USD', collectedMinor: 1000, paidOrders: 1 }], NOW);
  assert.equal(unset.pace, 'unset'); assert.equal(unset.percent, null); assert.equal(unset.neededPerDayMinor, null);
  const early = paceTargets([target()], [{ currency: 'EGP', collectedMinor: 100000, paidOrders: 1 }], Date.parse('2026-10-02T09:00:00Z'))[0];
  assert.equal(early.projectionMinor, null, 'no projection from two days of data');
  assert.equal(early.confidence, 'low');
  const health = salesHealth({ targets: [pace], pipelineOverdue: 0, pipelineOpen: 2, waitingConfirmation: 0, winRate: 60 });
  assert.ok(health.score >= 0 && health.score <= 100);
  assert.ok(health.driversAr.length);
});

test('the weekly review: this week against last, no percentage off a zero, and one move from the real numbers', () => {
  const pipeline = summarizePipeline([deal({ nextActionAt: '2026-10-20' }), deal({ id: 'z', nextActionAt: '' })], NOW);
  const thisWeek = [{ currency: 'EGP', collectedMinor: 1200000, paidOrders: 4 }];
  const lastWeek = [{ currency: 'EGP', collectedMinor: 1000000, paidOrders: 3 }, { currency: 'USD', collectedMinor: 5000, paidOrders: 1 }];
  const review = weeklyReview({ thisWeek, lastWeek, pipeline, targets: paceTargets([target()], thisWeek, NOW), waitingConfirmation: 2 });
  const egp = review.compare.find((r) => r.currency === 'EGP')!;
  assert.equal(egp.changePercent, 20);
  assert.equal(egp.thisOrders, 4); assert.equal(egp.lastOrders, 3);
  const usd = review.compare.find((r) => r.currency === 'USD')!;
  assert.equal(usd.changePercent, -100);
  assert.match(review.summaryAr, /EGP|ج\.م/);
  assert.match(review.movesAr.join('\n'), /تحويل/);
  assert.ok(review.movesAr.length <= 3);

  // A first week with nothing before it: no invented percentage, and the text says so.
  const first = weeklyReview({ thisWeek, lastWeek: [], pipeline, targets: [], waitingConfirmation: 0 });
  assert.equal(first.compare[0].changePercent, null);
  assert.match(first.summaryAr, /مفيش نسبة|مفيش تحصيل مؤكد الأسبوع اللي فات/);
  const quiet = weeklyReview({ thisWeek: [], lastWeek: [], pipeline: summarizePipeline([], NOW), targets: [], waitingConfirmation: 0 });
  assert.match(quiet.summaryAr, /مفيش تحصيل مؤكد/);
  assert.ok(quiet.movesAr.length, 'a quiet week still gets one honest move');
  assert.match(quiet.movesAr.join('\n'), /هدف الشهر/);
});

test('quiet opportunities: not late, not unscheduled — just untouched for a week, counted once and never blamed', () => {
  // NOW is 2026-10-24. A next step in the future with no touch for a week is “quiet”; nothing else is.
  const quietOne = deal({ id: 'q1', nextActionAt: '2026-10-30', updatedAt: iso('2026-10-15') });
  const fresh = deal({ id: 'f1', nextActionAt: '2026-10-30', updatedAt: iso('2026-10-22') });
  const overdue = deal({ id: 'o1', nextActionAt: '2026-10-20', updatedAt: iso('2026-10-01') });
  const today = deal({ id: 't1', nextActionAt: '2026-10-24', updatedAt: iso('2026-10-01') });
  const idle = deal({ id: 'i1', nextActionAt: '', updatedAt: iso('2026-10-01') });
  const closed = deal({ id: 'c1', stage: 'won', nextActionAt: '2026-10-30', updatedAt: iso('2026-10-01') });
  const quiet = silentDeals([quietOne, fresh, overdue, today, idle, closed], NOW, 'Africa/Cairo', SILENT_AFTER_DAYS, 10);
  assert.deepEqual(quiet.map((q) => q.deal.id), ['q1'], 'only the untouched-future one is quiet — the rest are already listed elsewhere');
  assert.equal(quiet[0].silentDays, 9);
  assert.equal(quiet[0].dueInDays, 6);
  assert.match(quiet[0].whyAr, /9 يوم/);

  // The boundary is the week, and a deal exactly at it is included.
  assert.equal(silentDeals([deal({ id: 'edge', nextActionAt: '2026-11-01', updatedAt: iso('2026-10-17') })], NOW).length, 1);
  assert.equal(silentDeals([deal({ id: 'just-under', nextActionAt: '2026-11-01', updatedAt: iso('2026-10-18') })], NOW).length, 0);

  // Sorting: the longest silence first, then the larger value.
  const many = silentDeals([
    deal({ id: 'a', nextActionAt: '2026-11-01', updatedAt: iso('2026-10-10'), valueMinor: 1000 }),
    deal({ id: 'b', nextActionAt: '2026-11-01', updatedAt: iso('2026-10-10'), valueMinor: 5000 }),
    deal({ id: 'c', nextActionAt: '2026-11-01', updatedAt: iso('2026-10-01'), valueMinor: 100 }),
  ], NOW);
  assert.deepEqual(many.map((q) => q.deal.id), ['c', 'b', 'a']);
  assert.equal(silentDeals([], NOW).length, 0);

  // The summary counts them once, and the hygiene score notices without inventing a cause.
  const summary = summarizePipeline([quietOne, fresh, overdue, today, idle, closed], NOW);
  assert.equal(summary.silentCount, 1);
  assert.equal(summary.overdueCount, 1, 'the late one is counted as overdue, not as quiet');
  assert.equal(summary.withoutNextStep, 1);
  assert.ok(pipelineHygiene(summary).notesAr.some((n) => /ساكتة/.test(n)));
});

test('the daily rhythm: money first, then follow-ups, the target gap and the lesson — and it never invents a quiet day', () => {
  const live = { today: [{ currency: 'EGP', collectedMinor: 500000, paidOrders: 3 }], month: [{ currency: 'EGP', collectedMinor: 2000000, paidOrders: 8 }],
    waitingConfirmation: 2, awaitingTransfer: 1, bestSellers: [{ sku: 'SKU-1', units: 9, currency: 'EGP' }] };
  const targets = paceTargets([target()], live.month, NOW);
  const rhythm = dailyRhythm({ now: NOW, live, deals: [deal(), deal({ id: 'z', currency: 'EGP' })], targets, lessonTitleAr: 'درس' });
  assert.deepEqual(rhythm.slice(0, 2).map((t) => t.id), ['confirm-transfers', 'awaiting-transfer']);
  assert.ok(rhythm.some((t) => t.id === 'deal-d1'));
  assert.ok(rhythm.some((t) => t.id === 'target-EGP'));
  assert.ok(rhythm.some((t) => t.id === 'study-today'));
  assert.ok(rhythm.every((t) => t.link && t.whyAr && t.titleAr));
  const withQuiet = dailyRhythm({ now: NOW, live, deals: [deal({ id: 'q', nextActionAt: '2026-11-01', updatedAt: iso('2026-10-05') })], targets, lessonTitleAr: 'درس' });
  const quietTask = withQuiet.find((t) => t.id === 'deals-silent');
  assert.ok(quietTask, 'a quiet opportunity reaches the daily rhythm');
  assert.match(quietTask!.titleAr, /ساكتة/);
  assert.equal(quietTask!.link, 'pipeline');
  const blind = dailyRhythm({ now: NOW, live: null, deals: [], targets: [], lessonTitleAr: 'درس' });
  assert.equal(blind[0].id, 'live-not-read');
  assert.ok(blind.some((t) => t.id === 'target-missing'));
});

test('the curriculum comes from the handbook and the selling craft — every lesson names its source', () => {
  const ids = new Set(handbookSections().map((s) => s.id));
  const principleIds = new Set(SALES_PRINCIPLES.map((p) => p.id));
  assert.ok(SALES_LESSONS.length >= 12);
  assert.equal(new Set(SALES_LESSONS.map((l) => l.id)).size, SALES_LESSONS.length);
  for (const module of Object.keys(MODULE_LABEL)) assert.ok(SALES_LESSONS.some((l) => l.module === module), module);
  for (const lesson of SALES_LESSONS) {
    assert.ok(lesson.handbook.length, lesson.id);
    for (const section of lesson.handbook) assert.ok(ids.has(section), `${lesson.id}: ${section}`);
    for (const principle of lesson.principles) assert.ok(principleIds.has(principle), `${lesson.id}: ${principle}`);
    assert.ok(lesson.quiz.correct >= 0 && lesson.quiz.correct < lesson.quiz.optionsAr.length, lesson.id);
    assert.equal(lesson.quiz.optionsAr.length, lesson.quiz.optionsEn.length, lesson.id);
    assert.ok(lesson.ideaAr.length > 40 && lesson.drillAr.length > 20 && lesson.quiz.whyAr, lesson.id);
  }
  // Every handbook section is taught somewhere, and every principle is used by a lesson.
  for (const section of ids) assert.ok(SALES_LESSONS.some((l) => l.handbook.includes(section)), section);
  for (const principle of principleIds) assert.ok(SALES_LESSONS.some((l) => l.principles.includes(principle)), principle);
  const rotation = Array.from({ length: SALES_LESSONS.length }, (_, i) => lessonOfDay(NOW, i).id);
  assert.equal(new Set(rotation).size, SALES_LESSONS.length, 'the rotation covers the whole curriculum');
  assert.equal(studyPlan(NOW, 7).length, 7);
  const graded = gradeStudy([{ lessonId: SALES_LESSONS[0].id, choice: SALES_LESSONS[0].quiz.correct }], new Date(NOW).toISOString());
  assert.equal(graded[0].correct, true);
  const progress = studyProgress([...graded, { lessonId: SALES_LESSONS[1].id, choice: 2, correct: false, at: new Date(NOW).toISOString() }], NOW);
  assert.equal(progress.studied, 2); assert.equal(progress.correct, 1); assert.equal(progress.percent, 50); assert.deepEqual(progress.weak, [SALES_LESSONS[1].id]);
  assert.equal(readFileSync(new URL('../SALES_PLAYBOOK.md', import.meta.url), 'utf8'), `${salesPlaybookDoc()}\n`, 'regenerate: node --import tsx scripts/shaheen-sales/playbook-doc.mts');
  assert.ok(SALES_PITFALLS.length >= 10);
});

function snapshot(over: Partial<SalesSnapshot> = {}): SalesSnapshot {
  const deals = [deal({ nextActionAt: '' })];
  const pipeline = summarizePipeline(deals, NOW);
  return {
    live: true, today: [{ currency: 'EGP', collectedMinor: 500000, paidOrders: 3 }], month: [{ currency: 'EGP', collectedMinor: 2000000, paidOrders: 8 }],
    targets: paceTargets([target()], [{ currency: 'EGP', collectedMinor: 2000000, paidOrders: 8 }], NOW), pipeline,
    health: { score: 62, labelAr: 'ماشية', driversAr: ['هدف تحت الإيقاع'] }, rhythm: [],
    study: { studied: 2, correct: 1, percent: 50, streakDays: 1, weak: [] }, lessonTitle: 'درس النهارده',
    topProducts: [{ sku: 'SKU-1', units: 9, currency: 'EGP' }], waitingConfirmation: 2, awaitingTransfer: 1,
    deals: deals.map((d) => ({ title: d.title, stage: d.stage, valueMinor: d.valueMinor, currency: d.currency, nextActionAt: d.nextActionAt })),
    ...over,
  };
}

test('the advisor answers from the desk and asks for nothing it does not know', () => {
  assert.equal(salesTopicOf('إحنا واقفين فين من الهدف؟'), 'target');
  assert.equal(salesTopicOf('What should I do today?'), 'today');
  assert.equal(salesTopicOf('حاجة مش مفهومة'), 'help');
  const s = snapshot();
  const targetAnswer = answerSales('فاضل كام للهدف؟', s).answer;
  assert.match(targetAnswer, /فاضل/); assert.match(targetAnswer, /EGP|ج\.م/);
  const empty = answerSales('إحنا واقفين فين من الهدف؟', snapshot({ live: false })).answer;
  assert.match(empty, /مش هخترع|لم أقرأ|مقدرتش/);
  assert.match(answerSales('مين أفضل عميل عندي؟', s).answer, /مش هخمن|أقدر أجاوب|I answer/);
  assert.doesNotMatch(answerSales('مين أفضل عميل عندي؟', s).answer, /عميل جملة/, 'never leaks a deal label as a name');

  // «ليه بنخسر؟»: the owner's recorded reasons only — an unexplained loss is a gap, never a guessed cause.
  assert.equal(salesTopicOf('ليه بنخسر؟'), 'loss');
  assert.match(answerSales('ليه بنخسر؟', s).answer, /مفيش خسائر/);
  const lostPipeline = summarizePipeline([deal({ id: 'x', stage: 'lost', lostReason: 'السعر عالي' }), deal({ id: 'y', stage: 'lost', lostReason: '' })], NOW);
  const lossAnswer = answerSales('ليه بنخسر؟', snapshot({ pipeline: lostPipeline })).answer;
  assert.match(lossAnswer, /السعر عالي/);
  assert.match(lossAnswer, /من غير سبب مسجل/);
  assert.doesNotMatch(lossAnswer, /عميل جملة/);

  // «إيه الفرص الساكتة؟»: from the quiet list, and an honest empty answer when nothing is quiet.
  assert.equal(salesTopicOf('إيه الفرص الساكتة؟'), 'silent');
  assert.equal(salesTopicOf('which opportunities went quiet?'), 'silent');
  assert.match(answerSales('إيه الفرص الساكتة؟', s).answer, /مفيش فرصة ساكتة/);
  const quietAnswer = answerSales('إيه الفرص الساكتة؟', snapshot({ quiet: [{ title: 'عرض جملة', silentDays: 9, dueInDays: 6 }] })).answer;
  assert.match(quietAnswer, /عرض جملة/);
  assert.match(quietAnswer, /(9|٩) يوم بدون حركة/);
  assert.doesNotMatch(quietAnswer, /01000000000|@/);

  // «الأسبوع ده عامل إيه؟»: no comparison is invented when the week was not read.
  assert.equal(salesTopicOf('الأسبوع ده عامل إيه؟'), 'week');
  assert.match(answerSales('الأسبوع ده عامل إيه؟', s).answer, /مفيش مقارنة|مفيش تحصيل/);
  const weekAnswer = answerSales('الأسبوع ده عامل إيه؟', snapshot({ week: [{ currency: 'EGP', thisWeekMinor: 1200000, lastWeekMinor: 1000000, thisOrders: 4, lastOrders: 3, changePercent: 20 }] })).answer;
  assert.match(weekAnswer, /\+20%/);
  assert.match(weekAnswer, /EGP|ج\.م/);
});

test('the public robot report carries counts only — no amounts, no deal labels, no contacts', () => {
  const blind = buildSalesReport({ now: NOW, live: { checked: false, at: new Date(NOW).toISOString(), failed: ['token:NO_ADMIN_TOKEN'] }, facts: null });
  assert.equal(blind.facts, null);
  assert.equal(blind.live.checked, false);
  assert.match(blind.summaryAr, /ما اتقرأتش/);
  assert.ok(blind.findings.some((fnd) => fnd.level === 'warn'));
  assert.ok(blind.planAr.length >= 5);
  assert.ok(blind.curriculum.handbookSections.length >= 6);

  const facts: DeskFacts = {
    paidOrdersToday: 3, paidOrdersMonth: 8, ordersThisWeek: 4, ordersLastWeek: 6, waitingConfirmation: 2, awaitingTransfer: 1, openDeals: 4, overdue: 1, withoutNextStep: 1, silent: 2,
    won: 2, lost: 1, winRate: 66.7, bestSellers: [{ sku: 'SKU-1', units: 9 }],
    targets: [{ currency: 'EGP', pace: 'behind', daysLeft: 7 }], health: { score: 62, labelAr: 'ماشية' }, studyAnsweredToday: true,
  };
  const report = buildSalesReport({ now: NOW, live: { checked: true, at: new Date(NOW).toISOString(), failed: [] }, facts,
    results: [{ lessonId: lessonOfDay(NOW).id, choice: 0, correct: true, at: new Date(NOW).toISOString() }] });
  const json = JSON.stringify(report);
  for (const forbidden of ['amountMinor', 'valueMinor', 'collectedMinor', 'nextActionAr', 'orderRef', 'accountLabel', 'phone', 'email', 'طقم هدايا', 'عميل جملة']) {
    assert.ok(!json.includes(forbidden), `the public report must not include ${forbidden}`);
  }
  assert.equal(report.facts?.paidOrdersMonth, 8);
  assert.equal(report.live.checked, true);
  assert.equal(report.study.answeredToday, true);
  assert.ok(report.findings.some((fnd) => /متابعتها فات/.test(fnd.textAr)));
  assert.ok(report.findings.some((fnd) => /الأسبوع ده 4 مقابل 6/.test(fnd.textAr)), 'a falling week is reported from counts, not money');
  assert.ok(report.findings.some((fnd) => /فرصة ساكتة/.test(fnd.textAr)), 'quiet opportunities are reported from counts');
  assert.equal(report.facts?.silent, 2);
  assert.equal(report.pipeline?.silentCount, 2);
  assert.equal(report.facts?.ordersThisWeek, 4);
  assert.doesNotMatch(JSON.stringify(report), /collectedMinor|amountMinor/, 'the public report stays counts only');
});

test('the live desk: opportunities without contacts, a target, real study answers and honest flags', async () => {
  class Durable extends MemoryStore { override readonly persistent = true; }
  const store = new Durable();
  const finance = new FinanceService(store, {}, { now: () => NOW, fetch: (async () => { throw new Error('no network'); }) as typeof fetch });
  const bank = new BankService(finance, {}, (async () => { throw new Error('no network'); }) as typeof fetch);
  const sales = new SalesService(finance, bank, {});

  await assert.rejects(() => sales.saveDeal(undefined, { title: 'مكالمة', accountLabel: 'أحمد 01000000000', value: '1000' }), /PERSONAL_DATA|بيانات التواصل/);
  await assert.rejects(() => sales.saveDeal(undefined, { title: 'مكالمة', accountLabel: 'a@b.com', value: '1000' }), /PERSONAL_DATA|بيانات التواصل/);
  await assert.rejects(() => sales.saveDeal(undefined, { title: 'x', accountLabel: 'عميل', value: '1000' }), /اسم الفرصة|INVALID_TEXT/);

  const created = await sales.saveDeal(undefined, { title: 'طقم هدايا', accountLabel: 'عميل جملة', value: '1500', nextActionAt: '2026-10-20', nextActionAr: 'أتابع', source: 'whatsapp' });
  assert.equal(created.valueMinor, 150000);
  assert.equal(created.stage, 'lead');
  await assert.rejects(() => sales.saveDeal(created.id, { value: '0' }), /أكبر من صفر/);
  await assert.rejects(() => sales.moveDeal(created.id, { stage: 'lost' }), /سبب الخسارة/);
  await assert.rejects(() => sales.moveDeal(created.id, { stage: 'won', orderRef: 'SP-NOT-PAID' }), /PAID_ORDER_REQUIRED|مش متحصل/);
  const lost = await sales.moveDeal(created.id, { stage: 'lost', lostReason: 'لقى أوفر' });
  assert.equal(lost.stage, 'lost');
  const second = await sales.saveDeal(undefined, { title: 'عرض جملة', accountLabel: 'شركة', value: '3000', stage: 'proposal', nextActionAt: '2026-10-26' });
  await sales.saveDeal(undefined, { title: 'طلب متأخر', accountLabel: 'عميل متجر', value: '800', nextActionAt: '2026-10-21' });

  await sales.saveTarget({ currency: 'EGP', amount: '30000', month: '2026-10' });
  const lesson = lessonOfDay(NOW);
  const wrong = await sales.recordStudy({ lessonId: lesson.id, choice: (lesson.quiz.correct + 1) % lesson.quiz.optionsAr.length });
  assert.equal(wrong.correct, false);
  await sales.recordStudy({ lessonId: lesson.id, choice: lesson.quiz.correct });

  const dashboard = await sales.dashboard();
  assert.equal(dashboard.pipeline.openCount, 2);
  assert.equal(dashboard.pipeline.lostCount, 1);
  assert.equal(dashboard.deals.length, 3);
  assert.ok(!JSON.stringify(dashboard.deals).includes('01000000000'));
  assert.equal(dashboard.targetsPace.find((t) => t.currency === 'EGP')?.targetMinor, 3000000);
  assert.equal(dashboard.study.todayId, lesson.id);
  assert.equal(dashboard.study.progress.studied, 2);
  assert.equal(dashboard.health.score >= 0, true);
  assert.ok(dashboard.audit.some((a) => a.action === 'deal.create'));
  assert.ok(Array.isArray(dashboard.paidOrders));
  assert.ok(dashboard.review.summaryAr.length > 0);
  assert.ok(dashboard.review.movesAr.length > 0);
  assert.ok(dashboard.review.week.from <= dashboard.review.week.to);

  const asked = await sales.ask('خط الأنابيب عامل إيه؟');
  assert.match(asked.answer, /فرصة|خط الأنابيب/);
  assert.doesNotMatch(JSON.stringify(asked), /01000000000|a@b\.com/);

  // The audit hook registered with «أمين شاهين» flags the overdue follow-up and the missing next step.
  const flags: { code: string; condition: boolean }[] = [];
  for (const check of finance.checks) await check(async (code, condition) => { flags.push({ code, condition }); });
  assert.ok(flags.some((f) => f.code === 'SALES_FOLLOW_UP_OVERDUE' && f.condition), 'the overdue deal is flagged');
  assert.ok(flags.some((f) => f.code === 'SALES_NO_TARGET' && !f.condition), 'a target exists this month');
  assert.ok(flags.some((f) => f.code === 'SALES_NO_NEXT_STEP' && !f.condition), 'the second deal has a next step');
  // «SALES_DEAL_SILENT» fires only for a deal whose next step is still ahead and untouched for a week.
  assert.ok(flags.some((f) => f.code === 'SALES_DEAL_SILENT' && !f.condition), 'no quiet deal in this fixture yet');
  const quietDeal = await sales.saveDeal(undefined, { title: 'فرصة ساكتة', accountLabel: 'متجر ساكت', value: '700', nextActionAt: '2026-11-05' });
  await store.put('salesDeals', quietDeal.id, { ...quietDeal, updatedAt: iso('2026-10-10') });
  const quietFlags: { code: string; condition: boolean }[] = [];
  for (const check of finance.checks) await check(async (code, condition) => { quietFlags.push({ code, condition }); });
  assert.ok(quietFlags.some((f) => f.code === 'SALES_DEAL_SILENT' && f.condition), 'the untouched deal is flagged');
  const quietDash = await sales.dashboard();
  assert.ok(quietDash.quiet.some((q) => q.id === quietDeal.id));
  assert.ok(!JSON.stringify(quietDash.quiet).includes('01000000000'));
  await sales.deleteDeal(quietDeal.id);

  // «البيع مايتسجلش غير لما تشوف الفلوس»: a win without a paid order in the ledger is refused, and a real one lands.
  await assert.rejects(() => sales.moveDeal(second.id, { stage: 'won' }), /PAID_ORDER_REQUIRED|البيع بيتسجل/);
  await assert.rejects(() => sales.saveDeal(undefined, { title: 'بيع وهمي', accountLabel: 'عميل', value: '900', stage: 'won' }), /PAID_ORDER_REQUIRED|البيع بيتسجل/);
  const orderRef = 'SP-1001';
  const entryId = financeId('sale', 'live', orderRef);
  await store.create('financeEntries', entryId, { id: entryId, kind: 'sale', mode: 'live', currency: 'EGP', amountMinor: 300000, orderRef, at: new Date(NOW).toISOString(), recordedAt: new Date(NOW).toISOString(), source: 'direct' });
  // Editing a deal that is already won keeps its own order — it never conflicts with itself.
  const editedWon = await sales.saveDeal(second.id, { stage: 'won', orderRef, notes: 'اتقفلت على الطلب' });
  assert.equal(editedWon.orderRef, orderRef);
  const won = await sales.moveDeal(second.id, { stage: 'won', orderRef });
  assert.equal(won.stage, 'won'); assert.equal(won.orderRef, orderRef); assert.equal(won.nextActionAt, '');
  await assert.rejects(() => sales.moveDeal(second.id, { stage: 'lost', lostReason: 'رجوع', orderRef }), /مرجع الطلب/);
  const wonDashboard = await sales.dashboard();
  assert.equal(wonDashboard.pipeline.wonCount, 1);
  assert.ok(wonDashboard.paidOrders.length >= 1);

  // The paid orders the owner can close a deal on: real refs from the ledger, no contacts.
  const paid = await sales.paidOrders();
  assert.equal(paid.length, 1);
  assert.deepEqual({ ref: paid[0].ref, currency: paid[0].currency, amountMinor: paid[0].amountMinor, linkedDealId: paid[0].linkedDealId },
    { ref: orderRef, currency: 'EGP', amountMinor: 300000, linkedDealId: second.id });
  assert.doesNotMatch(JSON.stringify(paid), /01000000000|a@b\.com/);
  // One order closes one opportunity: a second deal cannot claim the same money.
  const third = await sales.saveDeal(undefined, { title: 'فرصة تانية', accountLabel: 'متجر تاني', value: '900', stage: 'negotiation' });
  await assert.rejects(() => sales.moveDeal(third.id, { stage: 'won', orderRef }), /مربوط بفرصة/);
  // Losing a won deal clears the order reference: confirmed money is not a lost sale.
  const relost = await sales.moveDeal(second.id, { stage: 'lost', lostReason: 'رجوع عن الطلب' });
  assert.equal(relost.orderRef, '');
  assert.equal(relost.stage, 'lost');

  const finalDashboard = await sales.dashboard();
  assert.equal(finalDashboard.pipeline.wonCount, 0);
  assert.equal(finalDashboard.pipeline.lostCount, 2);
  assert.ok(finalDashboard.review.lostReasons.some((r) => r.reason === 'رجوع عن الطلب'));
  assert.equal(finalDashboard.review.lostWithoutReason, 0, 'every lost deal here has a recorded reason');
});

test('the robot is registered under Shaheen with a shift, a reviewer, a timetable and a pre-check', () => {
  const bot = botOf('sales');
  assert.ok(bot, 'sales bot registered');
  assert.equal(bot?.workflow, 'shaheen-sales.yml');
  assert.equal(bot?.report, 'shaheen-sales.json');
  assert.equal(bot?.everyHours, 6);
  assert.ok(LINKS.some((l) => l.from === 'sales') && LINKS.some((l) => l.to === 'sales'));
  assert.ok(LINKS.some((l) => l.from === 'finance' && l.to === 'sales'));
  assert.ok(SHIFTS.some((s) => s.bots.includes('sales')));
  assert.equal(shiftOfBot('sales'), 0);
  assert.ok(REVIEWERS.sales);
  assert.deepEqual(SCHEDULES['shaheen-sales.yml'], ['33 */6 * * *']);
  assert.ok(BOTS.some((b) => b.nameAr.includes('إدارة المبيعات')));

  // The pre-check reads the report the robot actually writes — not a hand-made shape that happens to match.
  const factsFor = (over: Partial<DeskFacts> = {}): DeskFacts => ({
    paidOrdersToday: 2, paidOrdersMonth: 9, ordersThisWeek: 5, ordersLastWeek: 3, waitingConfirmation: 0, awaitingTransfer: 0, openDeals: 4, overdue: 0,
    withoutNextStep: 0, silent: 0, won: 2, lost: 1, winRate: 66.7, bestSellers: [], targets: [{ currency: 'EGP', pace: 'on', daysLeft: 7 }],
    health: { score: 82, labelAr: 'قوية' }, studyAnsweredToday: true, ...over,
  });
  const report = (facts: DeskFacts | null, checked = true) => buildSalesReport({
    now: NOW, live: { checked, at: new Date(NOW).toISOString(), failed: checked ? [] : ['token:NO_ADMIN_TOKEN'] }, facts,
  });
  const check = runPrecheck({ 'shaheen-sales.json': report(factsFor()) }, {}, NOW).bots.find((b) => b.id === 'sales')!;
  assert.equal(check.status, 'ok');
  const blind = runPrecheck({ 'shaheen-sales.json': report(null, false) }, {}, NOW).bots.find((b) => b.id === 'sales')!;
  assert.equal(blind.status, 'warn');
  assert.ok(blind.fixes.length);
  const bad = runPrecheck({ 'shaheen-sales.json': report(factsFor({ overdue: 3, withoutNextStep: 2, health: { score: 20, labelAr: 'متعطلة' } })) }, {}, NOW).bots.find((b) => b.id === 'sales')!;
  assert.equal(bad.status, 'fail');
  assert.ok(bad.problems.some((p) => /متابعة|موعد/.test(p)));
});
