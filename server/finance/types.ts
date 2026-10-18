export type PeriodKind = 'daily' | 'weekly' | 'monthly';
export type Mode = 'test' | 'live';
export interface FinancePeriod {
  id: string; kind: PeriodKind; timeZone: string; from: string; to: string;
  localFrom: string; localTo: string; closed: boolean;
}
/** No customer contacts, card numbers, keys or bank details belong in these collections. */
export interface FinanceOrder {
  id: string; ref: string; provider: 'kashier'; mode: Mode; country: string; currency: string;
  totalMinor: number; shippingChargedMinor: number; createdAt: string;
  lines: { sku: string; qty: number; unitMinor: number }[];
}
export interface FinanceSession {
  id: string; ref: string; mode: Mode; sessionId: string; at: string; state?: 'paid' | 'pending' | 'failed'; checkedAt?: string;
}
export type EntryKind = 'sale' | 'refund' | 'chargeback' | 'cost' | 'shipping' | 'fee' | 'tax' | 'expense';
export interface FinanceEntry {
  id: string; kind: EntryKind; mode: Mode; currency: string; amountMinor: number;
  orderRef?: string; at: string; recordedAt: string; source: 'gateway' | 'admin';
  /** Only an admin's accounting reason, never a gateway response body. */
  reason?: string; reverses?: string;
}
export interface FinanceAttempt {
  id: string; provider: 'kashier'; mode: Mode; phase: 'create' | 'verify'; ok: boolean; ms: number;
  code: string; at: string;
}
export interface FinanceIssue {
  id: string; code: string; severity: 'warning' | 'critical'; owner: 'shaheen';
  title: string; action: string; ref?: string; openedAt: string;
  /** Acknowledging an issue is NOT fixing it. Condition-based issues close only after a successful check. */
  acknowledgedAt?: string; resolvedAt?: string; notifiedAt?: string; automatic: boolean;
}
export interface PaymentRegistration {
  id: 'kashier'; merchantCountry: string; buyerCountries: string[]; methods: string[];
  legalEntityChecked: boolean; settlementBankChecked: boolean; liveAccountApproved: boolean; websiteApproved: boolean;
  reviewedAt: string;
}
export interface CurrencyReport {
  currency: string; paidOrders: number; collectedMinor: number; refundsMinor: number; chargebacksMinor: number;
  costsMinor: number; shippingMinor: number; feesMinor: number; taxesMinor: number; expensesMinor: number;
  recordedResultMinor: number; netProfitMinor: number | null;
  issues: string[];
  missing: { ref: string; kinds: EntryKind[] }[];
}
export interface FinanceReport {
  id: string; period: FinancePeriod; generatedAt: string; fingerprint: string;
  currencies: CurrencyReport[]; excludedTestEntries: number; unreviewedExpenses: boolean;
  basis: 'posted-ledger'; status: 'no_data' | 'incomplete' | 'reviewed';
}
export interface FinanceReview { id: string; periodId: string; fingerprint: string; at: string }
export interface FinanceRun {
  id: string; at: string; trigger: 'admin' | 'schedule'; reportIds: string[]; openIssues: number; newIssues: number;
}
export interface FinancePerformance {
  attempts: number; failures: number; failureRate: number | null; p95Ms: number | null;
  sessions: number; paid: number; pending: number; failedSessions: number; completionRate: number | null; sufficientSample: boolean;
}
