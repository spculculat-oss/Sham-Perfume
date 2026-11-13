import type { ExpenseCategory, CollectionKind } from '../../src/finance/bankKinds';
export { EXPENSE_CATEGORIES, COLLECTION_KINDS } from '../../src/finance/bankKinds';
export type { ExpenseCategory, CollectionKind };
export type PeriodKind = 'daily' | 'weekly' | 'monthly';
export type Mode = 'test' | 'live';
export interface FinancePeriod {
  id: string; kind: PeriodKind; timeZone: string; from: string; to: string;
  localFrom: string; localTo: string; closed: boolean;
}
/** No customer contacts, card numbers, keys or bank details belong in these collections. */
export interface FinanceOrder {
  id: string; ref: string; provider: 'kashier' | 'direct'; mode: Mode; country: string; currency: string;
  totalMinor: number; shippingChargedMinor: number; createdAt: string;
  lines: { sku: string; qty: number; unitMinor: number }[];
}
export interface FinanceSession {
  id: string; ref: string; mode: Mode; sessionId: string; at: string; state?: 'paid' | 'pending' | 'failed'; checkedAt?: string;
}
export type EntryKind = 'sale' | 'refund' | 'chargeback' | 'cost' | 'shipping' | 'fee' | 'tax' | 'expense';
export interface FinanceEntry {
  id: string; kind: EntryKind; mode: Mode; currency: string; amountMinor: number;
  orderRef?: string; at: string; recordedAt: string;
  /** gateway = verified by a payment provider; direct = «بنك شام» collection confirmed by the owner; admin = bookkeeping. */
  source: 'gateway' | 'admin' | 'direct';
  /** Only an admin's accounting reason, never a gateway response body. */
  reason?: string; reverses?: string;
  /** Operating-expense category (budgets) and the collection account that received a direct sale. */
  category?: ExpenseCategory; accountId?: string;
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

/* ───────────────────────── «بنك شام» — direct collection, payables, budgets, audit ───────────────────────── */
/** Where customers pay the store directly. Instructions are what a buyer must see to pay (no passwords, no cards). */
export interface CollectionAccount {
  id: string; kind: CollectionKind; label: string; instructions: string;
  currencies: string[]; countries: string[]; active: boolean;
  /** Hours a reserved order waits for the transfer before it expires (COD: until delivery). */
  holdHours: number; createdAt: string; updatedAt: string;
}
export type DirectState = 'awaiting_payment' | 'claimed' | 'paid' | 'rejected' | 'expired';
export interface DirectClaim { payerName: string; transferRef: string; paidAt: string; amountMinor: number; submittedAt: string }
export interface DirectPayment {
  id: string; ref: string; accountId: string; kind: CollectionKind; currency: string; totalMinor: number; country: string;
  /** SHA-256 of the buyer's one-time order token; the token itself is never stored. */
  tokenHash: string;
  /** SHA-256 of the normalised e-mail + phone: repeat-order risk checks without keeping contacts in the ledger. */
  contactHash: string;
  state: DirectState; createdAt: string; expiresAt: string;
  claim?: DirectClaim; risk: string[];
  decidedAt?: string; decision?: string; saleId?: string;
}
export interface Payable {
  id: string; party: string; category: ExpenseCategory; currency: string; amountMinor: number; dueDate: string;
  orderRef?: string; note: string; status: 'open' | 'paid' | 'cancelled'; createdAt: string; settledAt?: string; entryId?: string;
}
export interface Budget { id: string; category: ExpenseCategory; currency: string; monthlyMinor: number; updatedAt: string }
export interface BankAudit { id: string; at: string; action: string; target: string; detail?: string }
