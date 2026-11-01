/**
 * Sham Bank is the bank the customer sees.
 * WorldFirst is the receiving institution behind it: sale receipts, merchant purchases, and platform profit.
 * An owner report that the account was accepted is not a provider confirmation.
 * Receiving details are not invented, and a queued instruction is never marked sent.
 */

/**
 * Currencies WorldFirst showed on the accepted account screen.
 * Every figure is the zero the owner saw. It is not a live balance and not Sham's money.
 */
export const WORLDFIRST_WALLETS = [
  { currency: 'AUD', available: '0.00', pending: '0.00' },
  { currency: 'HKD', available: '0.00', pending: '0.00' },
  { currency: 'SGD', available: '0.00', pending: '0.00' },
  { currency: 'JPY', available: '0', pending: '0' },
  { currency: 'EUR', available: '0.00', pending: '0.00' },
  { currency: 'GBP', available: '0.00', pending: '0.00' },
  { currency: 'CAD', available: '0.00', pending: '0.00' },
  { currency: 'USD', available: '0.00', pending: '0.00' },
  { currency: 'NZD', available: '0.00', pending: '0.00' },
  { currency: 'CNH', available: '0.00', pending: '0.00' },
] as const;
export type WorldFirstCurrency = typeof WORLDFIRST_WALLETS[number]['currency'];

export function isWorldFirstCurrency(value: string): value is WorldFirstCurrency {
  return WORLDFIRST_WALLETS.some((row) => row.currency === value);
}

export type SettlementKind = 'sale_receipt' | 'merchant_purchase' | 'platform_profit';

export interface SettlementLeg {
  kind: SettlementKind;
  amountMinor: number;
  status: 'queued';
  sent: false;
}

export interface SaleSettlement {
  id: string;
  currency: string;
  customerPaidMinor: number;
  merchantCostMinor: number;
  shippingMinor: number;
  profitMinor: number;
  /** True when the profit is half the merchant cost, the platform's stated margin. */
  marginMatchesPolicy: boolean;
  legs: SettlementLeg[];
  status: 'queued';
  externalRef: '';
  sent: false;
  createdAt: string;
}

export interface WorldFirstSnapshot {
  visibleBank: 'sham';
  settlementInstitution: 'worldfirst';
  account: 'owner_reported_accepted';
  verifiedByProvider: false;
  receiving: 'not_issued';
  api: 'not_connected' | 'keys_present';
  sendsExternal: false;
  transmission: 'blocked';
  blockReason: 'RECEIVING_NOT_ISSUED';
  queued: number;
  /** Owner's screen, not a provider feed. */
  balancesLive: false;
  reportedTotalUsd: '0.00';
  wallets: typeof WORLDFIRST_WALLETS;
}

const SALE_ID = /^[A-Za-z0-9_-]{8,40}$/;

/** Presence only. The values are never returned or logged. */
export function worldFirstApiConfigured(env: { WORLDFIRST_CLIENT_ID?: string; WORLDFIRST_PRIVATE_KEY?: string } | undefined): boolean {
  return Boolean(env?.WORLDFIRST_CLIENT_ID?.trim() && env?.WORLDFIRST_PRIVATE_KEY?.trim());
}

export function worldFirstSnapshot(apiKeysPresent: boolean, queued: number): WorldFirstSnapshot {
  return {
    visibleBank: 'sham',
    settlementInstitution: 'worldfirst',
    account: 'owner_reported_accepted',
    verifiedByProvider: false,
    receiving: 'not_issued',
    api: apiKeysPresent ? 'keys_present' : 'not_connected',
    sendsExternal: false,
    transmission: 'blocked',
    blockReason: 'RECEIVING_NOT_ISSUED',
    queued,
    balancesLive: false,
    reportedTotalUsd: '0.00',
    wallets: WORLDFIRST_WALLETS,
  };
}

/** Transmission stays closed until WorldFirst itself issues receiving details and returns a transfer id. */
export function transmissionAllowed(): false {
  return false;
}

export function prepareSaleSettlement(input: {
  saleId: string;
  currency: string;
  customerPaidMinor: number;
  merchantCostMinor: number;
  shippingMinor?: number;
  at: string;
}): SaleSettlement {
  const id = input.saleId.trim();
  if (!SALE_ID.test(id)) throw new Error('INVALID_SALE');
  if (!isWorldFirstCurrency(input.currency)) throw new Error('INVALID_CURRENCY');
  const paid = input.customerPaidMinor;
  const cost = input.merchantCostMinor;
  const shipping = input.shippingMinor ?? 0;
  if (!Number.isSafeInteger(paid) || !Number.isSafeInteger(cost) || !Number.isSafeInteger(shipping)) throw new Error('INVALID_AMOUNT');
  if (paid < 1 || paid > 100_000_000_00 || cost < 0 || shipping < 0 || cost + shipping > paid) throw new Error('INVALID_AMOUNT');
  const profit = paid - cost - shipping;
  const leg = (kind: SettlementKind, amountMinor: number): SettlementLeg => ({ kind, amountMinor, status: 'queued', sent: false });
  return {
    id,
    currency: input.currency,
    customerPaidMinor: paid,
    merchantCostMinor: cost,
    shippingMinor: shipping,
    profitMinor: profit,
    marginMatchesPolicy: profit * 2 === cost,
    legs: [leg('sale_receipt', paid), leg('merchant_purchase', cost), leg('platform_profit', profit)].filter((row) => row.amountMinor > 0),
    status: 'queued',
    externalRef: '',
    sent: false,
    createdAt: input.at,
  };
}
