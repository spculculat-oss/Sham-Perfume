/**
 * «هدف الشهر» — the monthly sales target and its honest pace, pure and browser-safe.
 *
 * The target is the owner's decision; the collected amount comes from «بنك شام»'s confirmed ledger only
 * (a reported transfer that the owner has not seen is not revenue). The projection is arithmetic on the
 * days actually elapsed, labelled as an estimate — never a promise and never a number invented to look good.
 */
import { dayKey, monthKey } from './pipeline';

export interface SalesTarget {
  /** `${month}:${currency}` — one target per currency per month. */
  id: string;
  month: string;
  currency: string;
  amountMinor: number;
  updatedAt: string;
}

export interface CollectedRow {
  currency: string;
  collectedMinor: number;
  paidOrders: number;
}

export type TargetPaceName = 'unset' | 'ahead' | 'on' | 'behind';

export interface TargetPace {
  month: string;
  currency: string;
  targetMinor: number;
  collectedMinor: number;
  paidOrders: number;
  percent: number | null;
  daysInMonth: number;
  dayOfMonth: number;
  daysLeft: number;
  expectedMinor: number;
  gapMinor: number;
  neededPerDayMinor: number | null;
  projectionMinor: number | null;
  pace: TargetPaceName;
  confidence: 'low' | 'medium';
}

export function daysInMonth(month: string): number {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('INVALID_MONTH');
  const [year, mon] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mon, 0)).getUTCDate();
}

/** The pace of every currency that has a target this month, plus any currency that already collected. */
export function paceTargets(targets: readonly SalesTarget[], collected: readonly CollectedRow[], now: number, timeZone = 'Africa/Cairo'): TargetPace[] {
  const month = monthKey(now, timeZone);
  const day = Number(dayKey(now, timeZone).slice(8, 10));
  const total = daysInMonth(month);
  const left = Math.max(0, total - day);
  const current = targets.filter((t) => t.month === month);
  const currencies = [...new Set([...current.map((t) => t.currency), ...collected.filter((c) => c.collectedMinor > 0).map((c) => c.currency)])].sort();
  return currencies.map((currency) => {
    const target = current.find((t) => t.currency === currency);
    const row = collected.find((c) => c.currency === currency);
    const targetMinor = target?.amountMinor ?? 0;
    const collectedMinor = row?.collectedMinor ?? 0;
    const paidOrders = row?.paidOrders ?? 0;
    if (targetMinor <= 0) {
      return { month, currency, targetMinor: 0, collectedMinor, paidOrders, percent: null, daysInMonth: total, dayOfMonth: day, daysLeft: left,
        expectedMinor: 0, gapMinor: 0, neededPerDayMinor: null, projectionMinor: null, pace: 'unset' as const, confidence: 'low' as const };
    }
    const percent = Math.round(collectedMinor / targetMinor * 1000) / 10;
    const expectedMinor = Math.round(targetMinor * day / total);
    const gapMinor = Math.max(0, targetMinor - collectedMinor);
    const ratio = expectedMinor > 0 ? collectedMinor / expectedMinor : 0;
    return {
      month, currency, targetMinor, collectedMinor, paidOrders, percent,
      daysInMonth: total, dayOfMonth: day, daysLeft: left, expectedMinor, gapMinor,
      neededPerDayMinor: left > 0 ? Math.ceil(gapMinor / left) : (gapMinor ? gapMinor : 0),
      projectionMinor: day >= 3 ? Math.round(collectedMinor / day * total) : null,
      pace: ratio >= 1.1 ? 'ahead' as const : ratio >= 0.9 ? 'on' as const : 'behind' as const,
      confidence: day >= 10 ? 'medium' as const : 'low' as const,
    };
  });
}

/** One number the owner can read at a glance: targets met, pace, follow-through. */
export interface SalesHealth {
  score: number;
  labelAr: string;
  driversAr: string[];
}

export function salesHealth(input: {
  targets: readonly TargetPace[];
  pipelineOverdue: number;
  pipelineOpen: number;
  waitingConfirmation: number;
  winRate: number | null;
}): SalesHealth {
  let score = 50;
  const drivers: string[] = [];
  const withTargets = input.targets.filter((t) => t.targetMinor > 0);
  if (!withTargets.length) drivers.push('مفيش هدف شهري محدد — من غير رقم مستهدف مفيش قياس.');
  else {
    const beat = withTargets.filter((t) => t.pace === 'ahead' || t.pace === 'on').length;
    score += Math.round(beat / withTargets.length * 25);
    if (beat < withTargets.length) drivers.push(`${withTargets.length - beat} عملة تحت إيقاع الهدف الشهري.`);
  }
  if (input.pipelineOpen > 0) score += 10; else drivers.push('خط الأنابيب فاضي — مفيش فرص شغال عليها.');
  if (input.pipelineOverdue === 0 && input.pipelineOpen > 0) { score += 10; drivers.push('كل الفرص المفتوحة مواعيدها جاية في وقتها.'); }
  else if (input.pipelineOverdue) drivers.push(`${input.pipelineOverdue} متابعة متأخرة.`);
  if (input.waitingConfirmation === 0) score += 5;
  else drivers.push(`${input.waitingConfirmation} تحويل مستني تأكيدك في بنك شام.`);
  if (input.winRate !== null) {
    score += input.winRate >= 50 ? 10 : input.winRate >= 30 ? 5 : 0;
    if (input.winRate < 30) drivers.push(`نسبة الكسب ${input.winRate}% — الأسباب المسجلة هي اللي هترفعها.`);
  }
  score = Math.max(0, Math.min(100, score));
  const labelAr = score >= 80 ? 'قوية' : score >= 60 ? 'ماشية' : score >= 40 ? 'محتاجة متابعة' : 'متعطلة';
  return { score, labelAr, driversAr: drivers.length ? drivers : ['كل المؤشرات في مكانها — كمّل على نفس الإيقاع.'] };
}
