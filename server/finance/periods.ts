import type { FinancePeriod, PeriodKind } from './types';
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string) {
  if (!formatters.has(timeZone)) formatters.set(timeZone, new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }));
  return formatters.get(timeZone)!;
}
export function localDate(at: number, timeZone: string): string {
  const p = Object.fromEntries(formatter(timeZone).formatToParts(at).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
/** First instant of a calendar date, including Cairo's skipped midnight / 23- and 25-hour days. */
export function dayStart(day: string, timeZone: string): number {
  const center = Date.parse(`${day}T00:00:00Z`);
  let lo = center - 36 * 3600_000; let hi = center + 36 * 3600_000;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (localDate(mid, timeZone) < day) lo = mid + 1; else hi = mid;
  }
  return lo;
}
/** Calendar periods, Monday-based weeks. Half-open [from,to); never rolling 24h/30d approximations. */
export function financePeriod(kind: PeriodKind, now = Date.now(), timeZone = 'Africa/Cairo', offset = 0): FinancePeriod {
  if (!['daily', 'weekly', 'monthly'].includes(kind) || !Number.isInteger(offset) || offset > 0 || offset < -366) throw new Error('INVALID_PERIOD');
  formatter(timeZone); // validate IANA zone
  let from = localDate(now, timeZone); let to: string;
  if (kind === 'monthly') {
    const d = new Date(`${from.slice(0, 7)}-01T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + offset); from = d.toISOString().slice(0, 10);
    d.setUTCMonth(d.getUTCMonth() + 1); to = d.toISOString().slice(0, 10);
  } else {
    if (kind === 'weekly') {
      const weekday = new Date(`${from}T12:00:00Z`).getUTCDay();
      from = addDays(from, -((weekday + 6) % 7));
    }
    const days = kind === 'daily' ? 1 : 7;
    from = addDays(from, offset * days); to = addDays(from, days);
  }
  const start = dayStart(from, timeZone); const end = dayStart(to, timeZone);
  return { id: `${kind}:${from}:${timeZone}`, kind, timeZone, from: new Date(start).toISOString(), to: new Date(end).toISOString(), localFrom: from, localTo: to, closed: now >= end };
}
