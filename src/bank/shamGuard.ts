/**
 * Sham Bank protection. Rules are enforced in the ledger, not only in the page.
 * Modelled on the controls a receiving-account platform actually uses:
 * a step-up confirmation, a per-transfer cap, a daily outflow cap, a small first
 * payment to a new payee, a cooling window before a larger one, and a short
 * freeze when outbound moves come in a burst.
 * It does not invent an IBAN, store a card secret, or mark an external send as paid.
 */
import { decimals } from '../finance/money';
import { BUNDLED_FX, convert, type FxTable } from '../utils/pricing';
import { isAccountCurrency } from './shamAccount';

export const GUARD_LIMITS = {
  coolingMs: 30 * 60 * 1000,
  burstWindowMs: 10 * 60 * 1000,
  dayMs: 24 * 60 * 60 * 1000,
  burstMax: 8,
  newPayeeDayMax: 5,
  customer: { single: 200_000, daily: 500_000, newPayee: 10_000 },
  platform: { single: 1_000_000, daily: 2_500_000, newPayee: 100_000 },
} as const;

export interface GuardPosting {
  holderId: string;
  direction: 'credit' | 'debit';
  status: string;
  kind: string;
  currency: string;
  amountMinor: number;
  counterparty: string;
  createdAt: string;
}

export interface GuardSnapshot {
  status: 'open' | 'frozen';
  frozenUntil?: string;
  singleMaxUsdMinor: number;
  dailyMaxUsdMinor: number;
  dailyUsedUsdMinor: number;
  dailyLeftUsdMinor: number;
  newPayeeMaxUsdMinor: number;
  coolingMinutes: number;
  burstUsed: number;
  burstMax: number;
  newPayeesToday: number;
  newPayeeDayMax: number;
}

const PLATFORM = 'sham-platform';

export function toUsdMinor(amountMinor: number, currency: string, fx: FxTable = BUNDLED_FX): number {
  const code = currency.toUpperCase();
  if (!isAccountCurrency(code)) throw new Error('INVALID_CURRENCY');
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) throw new Error('INVALID_AMOUNT');
  if (amountMinor === 0) return 0;
  const major = amountMinor / 10 ** decimals(code);
  let usd = major;
  if (code !== 'USD') {
    try { usd = convert(major, code, 'USD', fx); } catch { throw new Error('RATE_MISSING'); }
  }
  const minor = Math.round(usd * 100);
  if (!Number.isSafeInteger(minor)) throw new Error('AMOUNT_TOO_LARGE');
  return minor;
}

function limitsFor(holderId: string) {
  return holderId === PLATFORM ? GUARD_LIMITS.platform : GUARD_LIMITS.customer;
}

function outbound(postings: GuardPosting[], holderId: string, at: string, windowMs: number, includeReleased: boolean): GuardPosting[] {
  const end = Date.parse(at);
  const start = end - windowMs;
  if (!Number.isFinite(end)) throw new Error('INVALID_AMOUNT');
  return postings.filter((row) => row.holderId === holderId && row.direction === 'debit' && (includeReleased || row.status !== 'released')
    && (row.kind === 'transfer' || row.kind === 'hold' || row.kind === 'convert')
    && Date.parse(row.createdAt) >= start && Date.parse(row.createdAt) <= end);
}

function trusted(postings: GuardPosting[], holderId: string, payee: string, at: string): boolean {
  const cutoff = Date.parse(at) - GUARD_LIMITS.coolingMs;
  return postings.some((row) => row.holderId === holderId && row.kind === 'transfer' && row.direction === 'debit' && row.status === 'posted'
    && row.counterparty === payee && Date.parse(row.createdAt) <= cutoff);
}

function newPayeesToday(postings: GuardPosting[], holderId: string, at: string): string[] {
  const seen = new Set<string>();
  for (const row of outbound(postings, holderId, at, GUARD_LIMITS.dayMs, false)) {
    if (row.kind === 'transfer' && row.status === 'posted' && row.counterparty.startsWith('SHAM')) seen.add(row.counterparty);
  }
  return [...seen];
}

export function guardSnapshot(postings: GuardPosting[], holderId: string, at: string, fx: FxTable = BUNDLED_FX): GuardSnapshot {
  const limits = limitsFor(holderId);
  const burst = outbound(postings, holderId, at, GUARD_LIMITS.burstWindowMs, true);
  const dailyUsed = outbound(postings, holderId, at, GUARD_LIMITS.dayMs, false).reduce((sum, row) => sum + toUsdMinor(row.amountMinor, row.currency, fx), 0);
  const frozen = burst.length >= GUARD_LIMITS.burstMax;
  const earliest = burst.reduce((min, row) => Math.min(min, Date.parse(row.createdAt)), Number.POSITIVE_INFINITY);
  return {
    status: frozen ? 'frozen' : 'open',
    ...(frozen && Number.isFinite(earliest) ? { frozenUntil: new Date(earliest + GUARD_LIMITS.burstWindowMs).toISOString() } : {}),
    singleMaxUsdMinor: limits.single,
    dailyMaxUsdMinor: limits.daily,
    dailyUsedUsdMinor: dailyUsed,
    dailyLeftUsdMinor: Math.max(0, limits.daily - dailyUsed),
    newPayeeMaxUsdMinor: limits.newPayee,
    coolingMinutes: GUARD_LIMITS.coolingMs / 60_000,
    burstUsed: burst.length,
    burstMax: GUARD_LIMITS.burstMax,
    newPayeesToday: newPayeesToday(postings, holderId, at).length,
    newPayeeDayMax: GUARD_LIMITS.newPayeeDayMax,
  };
}

/** Rejects the move before any posting is written. A passing call changes nothing. */
export function screenOutbound(postings: GuardPosting[], input: {
  holderId: string;
  currency: string;
  amountMinor: number;
  at: string;
  payee?: string;
  fx?: FxTable;
}): void {
  const fx = input.fx || BUNDLED_FX;
  const limits = limitsFor(input.holderId);
  const usd = toUsdMinor(input.amountMinor, input.currency, fx);
  const view = guardSnapshot(postings, input.holderId, input.at, fx);
  if (view.status === 'frozen') throw new Error('ACCOUNT_FROZEN');
  if (usd > limits.single) throw new Error('LIMIT_SINGLE');
  if (view.dailyUsedUsdMinor + usd > limits.daily) throw new Error('LIMIT_DAILY');
  if (!input.payee) return;
  const known = newPayeesToday(postings, input.holderId, input.at);
  if (!known.includes(input.payee) && known.length >= GUARD_LIMITS.newPayeeDayMax) throw new Error('PAYEE_LIMIT');
  if (!trusted(postings, input.holderId, input.payee, input.at) && usd > limits.newPayee) throw new Error('COOLING');
}
