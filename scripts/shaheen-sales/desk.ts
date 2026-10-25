/**
 * «مدير المبيعات» — the sales desk report builder (pure, testable).
 *
 * What leaves the admin server into the public report is **counts only**: no revenue amounts, no deal titles,
 * no customer labels, no order references and no contact details. «أمين شاهين» keeps money in its private
 * ledger; the public report says how the desk is doing without publishing the store's money.
 *
 * The curriculum part is local: the lesson of the day, its handbook sources, the study plan and how much of
 * the curriculum is covered — so the robot studies the book even when the live desk cannot be read.
 */
import { HANDBOOK_EDITION } from '../../src/utils/botHandbook';
import { MODULE_LABEL, SALES_LESSONS, lessonOfDay, studyPlan, studyProgress, type LessonModule, type StudyResult } from '../../src/sales/playbook';
import { SALES_PITFALLS, SALES_PRINCIPLES } from '../../src/utils/salesCraft';

export interface DeskTargetFact { currency: string; pace: 'unset' | 'ahead' | 'on' | 'behind'; daysLeft: number }
export interface DeskFacts {
  paidOrdersToday: number;
  paidOrdersMonth: number;
  /** Paid orders this week and last week — counts only, so the robot can report a trend without money. */
  ordersThisWeek: number;
  ordersLastWeek: number;
  waitingConfirmation: number;
  awaitingTransfer: number;
  openDeals: number;
  overdue: number;
  withoutNextStep: number;
  /** Open deals untouched for over a week while their next step is still ahead — counts only. */
  silent: number;
  won: number;
  lost: number;
  winRate: number | null;
  bestSellers: { sku: string; units: number }[];
  targets: DeskTargetFact[];
  health: { score: number; labelAr: string };
  /** null = the desk’s study answers could not be read. */
  studyAnsweredToday: boolean | null;
}

export interface SalesFinding { level: 'ok' | 'note' | 'warn' | 'fail'; textAr: string }

export interface SalesReport {
  version: 1;
  robot: 'sales';
  updatedAt: string;
  edition: string;
  live: { checked: boolean; at: string; failed: string[] };
  study: {
    lessonId: string;
    titleAr: string;
    module: LessonModule;
    handbook: string[];
    ideaAr: string;
    answeredToday: boolean | null;
    progress: ReturnType<typeof studyProgress>;
  };
  curriculum: {
    lessons: number;
    modules: { id: LessonModule; nameAr: string; lessons: number }[];
    handbookSections: string[];
    principles: number;
    pitfalls: number;
    plan: { id: string; titleAr: string }[];
  };
  facts: DeskFacts | null;
  /** The same counts the pre-check reads — counts only, never amounts or labels. */
  pipeline: { openCount: number; overdueCount: number; withoutNextStep: number; silentCount: number; won: number; lost: number; winRate: number | null } | null;
  targets: DeskTargetFact[];
  health: { score: number; labelAr: string } | null;
  findings: SalesFinding[];
  summaryAr: string;
  planAr: string[];
}

const clean = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0);

export function buildSalesReport(input: {
  now: number;
  live: { checked: boolean; at: string; failed: string[] };
  facts: DeskFacts | null;
  /** Study answers read from the desk (already aggregated; no personal data). */
  results?: StudyResult[];
}): SalesReport {
  const { now, live, facts } = input;
  const lesson = lessonOfDay(now);
  const plan = studyPlan(now, 7);
  const results = input.results || [];
  const progress = studyProgress(results, now);
  const answeredToday = facts ? facts.studyAnsweredToday : null;
  const modules = (Object.keys(MODULE_LABEL) as LessonModule[]).map((id) => ({ id, nameAr: MODULE_LABEL[id].ar, lessons: SALES_LESSONS.filter((l) => l.module === id).length }));
  const handbookSections = [...new Set(SALES_LESSONS.flatMap((l) => l.handbook))];

  const findings: SalesFinding[] = [];
  if (!live.checked || !facts) {
    findings.push({ level: 'warn', textAr: 'مكتب المبيعات ما قراش أرقام بنك شام في آخر دورة — مفيش أرقام حية في التقرير، ومفيش رقم متخمن مكانها.' });
  } else {
    if (facts.overdue) findings.push({ level: 'warn', textAr: `${facts.overdue} فرصة موعد متابعتها فات — كل يوم تأخير بيقلل احتمال القفل.` });
    if (facts.withoutNextStep) findings.push({ level: 'note', textAr: `${facts.withoutNextStep} فرصة مفتوحة من غير خطوة جاية بتاريخ.` });
    if (facts.silent) findings.push({ level: 'note', textAr: `${facts.silent} فرصة ساكتة من أكتر من أسبوع وخطوتها الجاية لسه بعيدة — لمسة واحدة بقيمة حقيقية لكل واحدة.` });
    if (facts.waitingConfirmation) findings.push({ level: 'note', textAr: `${facts.waitingConfirmation} تحويل مستني تأكيد صاحب المتجر بعد رؤية الفلوس — الحجز مش إيراد.` });
    if (facts.health.score < 50) findings.push({ level: facts.health.score < 30 ? 'fail' : 'warn', textAr: `صحة المبيعات ${facts.health.score}/100 (${facts.health.labelAr}).` });
    const behind = facts.targets.filter((t) => t.pace === 'behind');
    if (behind.length) findings.push({ level: 'note', textAr: `${behind.length} عملة تحت إيقاع الهدف الشهري — الفجوة اليومية أهم من رقم الشهر.` });
    if (!facts.targets.some((t) => t.pace !== 'unset')) findings.push({ level: 'warn', textAr: 'مفيش هدف مبيعات محدد للشهر — القياس متوقف.' });
    if (!facts.overdue && !facts.withoutNextStep && !facts.silent && facts.openDeals) findings.push({ level: 'ok', textAr: 'كل الفرص المفتوحة ليها خطوة جاية في وقتها واتلمست في آخر أسبوع — كمّل على نفس الإيقاع.' });
    if (!facts.openDeals) findings.push({ level: 'note', textAr: 'خط الأنابيب فاضي — سجّل أول ٣ فرص حقيقية بخطوة جاية لكل واحدة.' });
    if (!facts.ordersThisWeek && !facts.ordersLastWeek) findings.push({ level: 'note', textAr: 'مفيش طلبات مدفوعة في الأسبوع ده ولا اللي فات — الحجز مش إيراد.' });
    else if (facts.ordersLastWeek > 0 && facts.ordersThisWeek < facts.ordersLastWeek) findings.push({ level: 'note', textAr: `طلبات الأسبوع ده ${facts.ordersThisWeek} مقابل ${facts.ordersLastWeek} الأسبوع اللي فات — راجع سبب واحد وحركة واحدة في «المراجعة».` });
    else if (facts.ordersThisWeek > facts.ordersLastWeek && facts.ordersLastWeek > 0) findings.push({ level: 'ok', textAr: `طلبات الأسبوع ده ${facts.ordersThisWeek} مقابل ${facts.ordersLastWeek} الأسبوع اللي فات.` });
  }
  if (answeredToday === false) findings.push({ level: 'note', textAr: 'درس النهارده ما اتجاوبش لسه في مكتب المبيعات.' });
  if (answeredToday === null) findings.push({ level: 'note', textAr: 'حالة درس النهارده غير معروفة (المكتب ما اتقراش) — الدرس نفسه موجود في المنهج.' });
  if (!findings.length) findings.push({ level: 'ok', textAr: 'مفيش ملاحظات — المكتب بيشتغل من أرقام حقيقية.' });

  const summaryAr = !live.checked || !facts
    ? `مدير المبيعات: راجع منهج الكتيب وعلم البيع (${SALES_LESSONS.length} درساً في ${modules.length} وحدات، ${SALES_PRINCIPLES.length} مبدأ بيع و${SALES_PITFALLS.length} فخ) ودرس النهارده «${lesson.titleAr}»، لكن أرقام بنك شام ما اتقرأتش في آخر دورة — مفيش أرقام متخمنة.`
    : `مدير المبيعات: ${facts.openDeals} فرصة مفتوحة، ${facts.overdue} متابعة متأخرة، ${facts.silent} فرصة ساكتة من أكتر من أسبوع، ونسبة الكسب ${facts.winRate === null ? 'لسه مفيش مقفول' : `${facts.winRate}%`}. التحصيل المؤكد ${facts.paidOrdersToday} طلب النهارده و${facts.paidOrdersMonth} طلب الشهر ده (بعدد الطلبات بس — المبالغ في سجل بنك شام الخاص). ${facts.waitingConfirmation} تحويل مستني التأكيد. الأسبوع ده ${facts.ordersThisWeek} طلب مدفوع مقابل ${facts.ordersLastWeek} الأسبوع اللي فات. صحة المبيعات ${facts.health.score}/100 (${facts.health.labelAr}). درس النهارده «${lesson.titleAr}»${answeredToday === true ? ' ونتيجته متسجلة' : answeredToday === false ? ' ولسه ما اتجاوبش' : ''}.`;

  return {
    version: 1, robot: 'sales', updatedAt: new Date(now).toISOString(), edition: HANDBOOK_EDITION,
    live: { checked: Boolean(live.checked && facts), at: live.at, failed: live.failed.slice(0, 8) },
    study: { lessonId: lesson.id, titleAr: lesson.titleAr, module: lesson.module, handbook: lesson.handbook, ideaAr: lesson.ideaAr, answeredToday, progress },
    curriculum: {
      lessons: SALES_LESSONS.length, modules, handbookSections,
      principles: SALES_PRINCIPLES.length, pitfalls: SALES_PITFALLS.length,
      plan: plan.map((l) => ({ id: l.id, titleAr: l.titleAr })),
    },
    facts: facts ? {
      paidOrdersToday: clean(facts.paidOrdersToday), paidOrdersMonth: clean(facts.paidOrdersMonth),
      ordersThisWeek: clean(facts.ordersThisWeek), ordersLastWeek: clean(facts.ordersLastWeek),
      waitingConfirmation: clean(facts.waitingConfirmation), awaitingTransfer: clean(facts.awaitingTransfer),
      openDeals: clean(facts.openDeals), overdue: clean(facts.overdue), withoutNextStep: clean(facts.withoutNextStep), silent: clean(facts.silent),
      won: clean(facts.won), lost: clean(facts.lost), winRate: facts.winRate,
      bestSellers: facts.bestSellers.slice(0, 5).map((p) => ({ sku: String(p.sku).slice(0, 60), units: clean(p.units) })),
      targets: facts.targets.slice(0, 5).map((t) => ({ currency: t.currency, pace: t.pace, daysLeft: clean(t.daysLeft) })),
      health: { score: clean(facts.health.score), labelAr: facts.health.labelAr },
      studyAnsweredToday: answeredToday,
    } : null,
    pipeline: facts ? {
      openCount: clean(facts.openDeals), overdueCount: clean(facts.overdue), withoutNextStep: clean(facts.withoutNextStep), silentCount: clean(facts.silent),
      won: clean(facts.won), lost: clean(facts.lost), winRate: facts.winRate,
    } : null,
    targets: facts ? facts.targets.slice(0, 5).map((t) => ({ currency: t.currency, pace: t.pace, daysLeft: clean(t.daysLeft) })) : [],
    health: facts ? { score: clean(facts.health.score), labelAr: facts.health.labelAr } : null,
    findings, summaryAr,
    planAr: [
      `اقرأ درس النهارده «${lesson.titleAr}» (${MODULE_LABEL[lesson.module].ar}) — مصادره من الكتيب: ${lesson.handbook.join('، ')}.`,
      `تمرين الدرس: ${lesson.drillAr}`,
      ...plan.slice(1, 6).map((l, i) => `خطة الدرس ${i + 2}: ${l.titleAr}`),
      'ثبّت قواعد المنصة: السعر ×1.5 وتقريب لأعلى ٥ · الهامش مايتقالش · البيع مايتسجلش غير بعد رؤية الفلوس · مفيش رقم متخمن ولا استعجال مزيف.',
    ],
  };
}
