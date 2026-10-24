/**
 * «مراجعة الأسبوع» — the 20-minute weekly review the curriculum teaches (lesson `growth-review`), computed
 * from real figures only.
 *
 * This week against the week before (confirmed collections from «بنك شام»), the reasons the owner himself
 * recorded for lost deals, and the one move that follows from those numbers. Nothing is written as
 * improvement that did not happen: when last week collected nothing the change is `null` and the text says
 * so, and a loss without a recorded reason is counted as a gap, never given an invented cause.
 */
import { major } from '../finance/money';
import type { PipelineSummary } from './pipeline';
import type { TargetPace } from './targets';

export interface WeekRow {
  currency: string;
  collectedMinor: number;
  paidOrders: number;
}

export interface WeekCompare {
  currency: string;
  thisWeekMinor: number;
  lastWeekMinor: number;
  thisOrders: number;
  lastOrders: number;
  /** null when last week had no confirmed collection in this currency — never a percentage off a zero. */
  changePercent: number | null;
}

export interface ReviewLostReason { reason: string; count: number }

export interface SalesReview {
  compare: WeekCompare[];
  lostReasons: ReviewLostReason[];
  lostWithoutReason: number;
  summaryAr: string;
  /** At most three moves, each tied to a real figure; empty only when the desk really has nothing to say. */
  movesAr: string[];
}

const fmt = (minor: number, currency: string) => {
  try { return new Intl.NumberFormat('ar-EG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(major(minor, currency)); }
  catch { return `${minor} ${currency}`; }
};
const num = (n: number) => new Intl.NumberFormat('ar-EG').format(n);

export function weeklyReview(input: {
  thisWeek: readonly WeekRow[];
  lastWeek: readonly WeekRow[];
  pipeline: PipelineSummary;
  targets: readonly TargetPace[];
  waitingConfirmation: number;
  lessonTitleAr?: string;
}): SalesReview {
  const currencies = [...new Set([...input.thisWeek, ...input.lastWeek].map((r) => r.currency))].sort();
  const compare: WeekCompare[] = currencies.map((currency) => {
    const now = input.thisWeek.find((r) => r.currency === currency);
    const before = input.lastWeek.find((r) => r.currency === currency);
    const thisWeekMinor = Math.max(0, now?.collectedMinor ?? 0);
    const lastWeekMinor = Math.max(0, before?.collectedMinor ?? 0);
    return {
      currency,
      thisWeekMinor,
      lastWeekMinor,
      thisOrders: Math.max(0, now?.paidOrders ?? 0),
      lastOrders: Math.max(0, before?.paidOrders ?? 0),
      changePercent: lastWeekMinor > 0 ? Math.round((thisWeekMinor - lastWeekMinor) / lastWeekMinor * 1000) / 10 : null,
    };
  }).filter((row) => row.thisWeekMinor > 0 || row.lastWeekMinor > 0 || row.thisOrders > 0 || row.lastOrders > 0);

  const lines = compare.map((row) => {
    const head = `${row.currency}: ${fmt(row.thisWeekMinor, row.currency)} من ${num(row.thisOrders)} طلب مدفوع`;
    if (row.changePercent === null) {
      return row.lastWeekMinor === 0 && row.lastOrders === 0
        ? `${head} — مفيش تحصيل مؤكد الأسبوع اللي فات للمقارنة، فمفيش نسبة اتخترعت.`
        : `${head} — الأسبوع اللي فات كان ${fmt(row.lastWeekMinor, row.currency)} من ${num(row.lastOrders)} طلب، ومفيش نسبة من غير رقم باعث.`;
    }
    const sign = row.changePercent >= 0 ? '+' : '';
    return `${head} مقابل ${fmt(row.lastWeekMinor, row.currency)} الأسبوع اللي فات (${sign}${row.changePercent}%).`;
  });
  const summaryAr = lines.length
    ? lines.join('\n')
    : 'مفيش تحصيل مؤكد في الأسبوع ده ولا اللي فات. الطلبات المحجوزة مش إيراد لحد ما الفلوس تتحصل وتتأكد في بنك شام.';

  const lostReasons = input.pipeline.lostReasons.map((r) => ({ reason: r.reason, count: r.count }));
  const moves: string[] = [];
  if (input.waitingConfirmation > 0) moves.push(`أكّد ${num(input.waitingConfirmation)} تحويل مستني عينك في بنك شام — الفلوس اللي مأكدتهاش مش مبيعات لسه.`);
  if (input.pipeline.overdueCount > 0) moves.push(`تابع ${num(input.pipeline.overdueCount)} فرصة فات موعدها وحدّد لكل واحدة خطوة جديدة بتاريخ، أو أقفلها بسبب مسجل.`);
  if (input.pipeline.withoutNextStep > 0) moves.push(`اكتب خطوة جاية لـ${num(input.pipeline.withoutNextStep)} فرصة مفتوحة من غير تاريخ — الفرصة اللي مالهاش خطوة بتنسى.`);
  if (input.pipeline.lostWithoutReason > 0) moves.push(`${num(input.pipeline.lostWithoutReason)} خسارة من غير سبب مسجل — اكتب السبب، هو اللي بيعلّمك المرة الجاية.`);
  if (lostReasons.length && moves.length < 3) moves.push(`أكبر سبب خسارة: «${lostReasons[0].reason}» (${num(lostReasons[0].count)}). ده اللي بيتصلح الأسبوع الجاي — مش الوعود.`);
  const behind = input.targets.find((t) => t.targetMinor > 0 && t.pace === 'behind');
  if (behind && moves.length < 3) moves.push(`هدف ${behind.currency} تحت الإيقاع: فاضل ${fmt(behind.gapMinor, behind.currency)} في ${num(behind.daysLeft)} يوم، يعني ${fmt(behind.neededPerDayMinor ?? behind.gapMinor, behind.currency)} في اليوم.`);
  if (!input.targets.some((t) => t.targetMinor > 0) && moves.length < 3) moves.push('حدّد هدف الشهر — من غير رقم مستهدف مفيش قياس ولا مراجعة.');
  if (!moves.length) moves.push(input.lessonTitleAr
    ? `مفيش رقم بيقول حركة مستعجلة: اقرأ درس «${input.lessonTitleAr}» واعمل المراجعة في ٥ سطور — رقم اتغير، سببه، وحركة الأسبوع الجاي.`
    : 'مفيش رقم بيقول حركة مستعجلة: اعمل المراجعة في ٥ سطور — رقم اتغير، سببه، وحركة الأسبوع الجاي.');

  return { compare, lostReasons, lostWithoutReason: input.pipeline.lostWithoutReason, summaryAr, movesAr: moves.slice(0, 3) };
}
