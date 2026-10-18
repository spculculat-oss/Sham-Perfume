import { createHash } from 'node:crypto';
import { sumMinor } from '../../src/finance/money';
import type { CurrencyReport, EntryKind, FinanceAttempt, FinanceEntry, FinanceOrder, FinancePerformance, FinancePeriod, FinanceReport, FinanceReview, FinanceSession } from './types';
export const financeId = (...parts: string[]) => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
export const inPeriod = (at: string, p: FinancePeriod) => Date.parse(at) >= Date.parse(p.from) && Date.parse(at) < Date.parse(p.to);
export const COST_KINDS: EntryKind[] = ['cost', 'shipping', 'fee', 'tax'];
export function makeReport(period: FinancePeriod, entries: FinanceEntry[], reviews: FinanceReview[], now: number, persistent: boolean): FinanceReport {
  const selected = entries.filter((e) => e.mode === 'live' && inPeriod(e.at, period));
  const fingerprint = financeId(period.id, JSON.stringify([...selected].sort((a, b) => a.id.localeCompare(b.id))));
  const reviewed = persistent && reviews.some((r) => r.periodId === period.id && r.fingerprint === fingerprint);
  const reversed = new Set(selected.flatMap((e) => e.reverses ? [e.reverses, e.id] : []));
  const currencies: CurrencyReport[] = [...new Set(selected.map((e) => e.currency))].sort().map((currency) => {
    const rows = selected.filter((e) => e.currency === currency);
    const total = (kind: EntryKind) => sumMinor(rows.filter((e) => e.kind === kind).map((e) => e.amountMinor));
    const sales = rows.filter((e) => e.kind === 'sale' && e.source === 'gateway');
    const missing = sales.flatMap((sale) => {
      const kinds = COST_KINDS.filter((k) => !rows.some((e) => e.orderRef === sale.orderRef && e.kind === k && !reversed.has(e.id)));
      return kinds.length ? [{ ref: sale.orderRef!, kinds }] : [];
    });
    const collectedMinor = total('sale'); const refundsMinor = total('refund'); const chargebacksMinor = total('chargeback');
    const costsMinor = total('cost'); const shippingMinor = total('shipping'); const feesMinor = total('fee'); const taxesMinor = total('tax'); const expensesMinor = total('expense');
    const refs = new Set(rows.map((e) => e.orderRef).filter(Boolean));
    const issues: string[] = [];
    for (const ref of refs) {
      const history = entries.filter((e) => e.mode === 'live' && e.orderRef === ref && e.currency === currency);
      const collected = sumMinor(history.filter((e) => e.kind === 'sale').map((e) => e.amountMinor));
      const returned = sumMinor(history.filter((e) => e.kind === 'refund' || e.kind === 'chargeback').map((e) => e.amountMinor));
      if (returned > collected) issues.push('OVER_REFUND');
    }
    const recordedResultMinor = sumMinor([collectedMinor, -refundsMinor, -chargebacksMinor, -costsMinor, -shippingMinor, -feesMinor, -taxesMinor, -expensesMinor]);
    return { currency, paidOrders: sales.length, collectedMinor, refundsMinor, chargebacksMinor, costsMinor, shippingMinor, feesMinor, taxesMinor, expensesMinor,
      recordedResultMinor, netProfitMinor: reviewed && !missing.length && !issues.length ? recordedResultMinor : null, missing, issues: [...new Set(issues)] };
  });
  return { id: financeId('report', period.id, fingerprint, reviewed ? 'reviewed' : 'open'), period, generatedAt: new Date(now).toISOString(), fingerprint,
    currencies, excludedTestEntries: entries.filter((e) => e.mode === 'test' && inPeriod(e.at, period)).length, unreviewedExpenses: !reviewed, basis: 'posted-ledger',
    status: !selected.length ? 'no_data' : currencies.every((c) => c.netProfitMinor !== null) ? 'reviewed' : 'incomplete' };
}
export function paymentPerformance(period: FinancePeriod, attempts: FinanceAttempt[], sessions: FinanceSession[], entries: FinanceEntry[], orders: FinanceOrder[]): FinancePerformance {
  const actual = attempts.filter((e) => e.mode === 'live' && inPeriod(e.at, period));
  const failed = actual.filter((a) => !a.ok).length;
  const durations = actual.map((a) => a.ms).sort((a, b) => a - b);
  const scoped = sessions.filter((s) => s.mode === 'live' && inPeriod(s.at, period));
  const paid = scoped.filter((s) => entries.some((e) => e.mode === 'live' && e.kind === 'sale' && e.orderRef === s.ref && orders.some((o) => o.ref === s.ref && o.mode === 'live'))).length;
  const failedSessions = scoped.filter((s) => s.state === 'failed' && !entries.some((e) => e.mode === 'live' && e.kind === 'sale' && e.orderRef === s.ref)).length;
  return { attempts: actual.length, failures: failed, failureRate: actual.length ? Math.round(failed / actual.length * 10000) / 100 : null,
    p95Ms: durations.length ? durations[Math.ceil(durations.length * .95) - 1] : null, sessions: scoped.length, paid, pending: scoped.length - paid - failedSessions, failedSessions,
    completionRate: scoped.length ? Math.round(paid / scoped.length * 10000) / 100 : null, sufficientSample: actual.length >= 5 };
}
