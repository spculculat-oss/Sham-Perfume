/**
 * Sham Bank account desk, arranged like a multi-currency receiving account:
 * balances, receiving rails, activity, withdrawal banks, pay, and a card slot.
 * Withdrawal banks keep a nickname and last 4 only. Spendable money lives in shamLedger.
 */

export const ACCOUNT_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD',
  'CAD', 'AUD', 'CHF', 'SGD', 'HKD', 'JPY', 'CNY', 'INR', 'TRY', 'MXN',
] as const;
export type AccountCurrency = typeof ACCOUNT_CURRENCIES[number];

export interface ReceivingRail {
  id: string;
  currency: AccountCurrency;
  countryAr: string;
  countryEn: string;
  networkAr: string;
  networkEn: string;
  status: 'not_issued';
}

/** Public receiving rails. No account number, IBAN, or routing number is invented. */
export const RECEIVING_RAILS: ReceivingRail[] = [
  { id: 'usd-us', currency: 'USD', countryAr: 'الولايات المتحدة', countryEn: 'United States', networkAr: 'تحويل محلي أو سلك', networkEn: 'ACH / wire', status: 'not_issued' },
  { id: 'eur-eu', currency: 'EUR', countryAr: 'أوروبا', countryEn: 'Europe', networkAr: 'تحويل أوروبي', networkEn: 'SEPA', status: 'not_issued' },
  { id: 'gbp-gb', currency: 'GBP', countryAr: 'المملكة المتحدة', countryEn: 'United Kingdom', networkAr: 'تحويل محلي سريع', networkEn: 'Faster Payments', status: 'not_issued' },
  { id: 'cad-ca', currency: 'CAD', countryAr: 'كندا', countryEn: 'Canada', networkAr: 'تحويل محلي', networkEn: 'EFT', status: 'not_issued' },
  { id: 'aud-au', currency: 'AUD', countryAr: 'أستراليا', countryEn: 'Australia', networkAr: 'تحويل محلي', networkEn: 'Local transfer', status: 'not_issued' },
  { id: 'mxn-mx', currency: 'MXN', countryAr: 'المكسيك', countryEn: 'Mexico', networkAr: 'تحويل فوري', networkEn: 'SPEI', status: 'not_issued' },
];

export type AccountRequestKind = 'withdraw' | 'convert' | 'pay' | 'card' | 'receiving';

export interface AccountRequest {
  id: string;
  customerId: string;
  kind: AccountRequestKind;
  status: 'requested';
  currency: string;
  amountLabel: string;
  detail: string;
  createdAt: string;
}

export interface WithdrawalBank {
  id: string;
  customerId: string;
  nickname: string;
  currency: string;
  country: string;
  last4: string;
  createdAt: string;
}

export interface RecordedBalance {
  currency: string;
  minor: number;
}

export interface ShamBeneficiary {
  id: string;
  customerId: string;
  nickname: string;
  accountNumber: string;
  createdAt: string;
}

const REQUESTS = 'sham_account_requests_v1_';
const BANKS = 'sham_withdrawal_banks_v1_';
const PAYEES = 'sham_beneficiaries_v1_';
const LONG_DIGITS = /\d(?:[ -]?\d){7,18}/;

export function isAccountCurrency(value: string): value is AccountCurrency {
  return (ACCOUNT_CURRENCIES as readonly string[]).includes(value);
}

export function cleanAccountLabel(value: string, field: string): string {
  const text = value.replace(/[\u0000-\u001f]/g, ' ').trim();
  if (text.length < 2 || text.length > 40) throw new Error('INVALID_LABEL');
  if (LONG_DIGITS.test(text) || /\b(cvv|cvc|iban|routing)\b/i.test(text)) throw new Error('SECRET');
  return text.slice(0, 40) || field;
}

export function recordedBalance(rows: RecordedBalance[], currency: string): number {
  return rows.filter((row) => row.currency === currency).reduce((sum, row) => sum + (Number.isFinite(row.minor) ? row.minor : 0), 0);
}

/** A request never reduces the recorded balance. */
export function balanceAfterRequests(recordedMinor: number, _requests: AccountRequest[]): number {
  return recordedMinor;
}

function key(prefix: string, customerId: string) {
  const id = customerId.trim().toLowerCase();
  if (!id || id === 'guest_client') throw new Error('LOGIN_REQUIRED');
  return `${prefix}${id}`;
}

function read<T>(storageKey: string): T[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]') as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function write(storageKey: string, value: unknown) {
  localStorage.setItem(storageKey, JSON.stringify(value));
  const host = globalThis as { dispatchEvent?: (event: CustomEvent) => void };
  host.dispatchEvent?.(new CustomEvent('sham-account-updated'));
}

export function listAccountRequests(customerId: string): AccountRequest[] {
  try { return read<AccountRequest>(key(REQUESTS, customerId)).filter((row) => row && row.status === 'requested'); }
  catch { return []; }
}

export function listWithdrawalBanks(customerId: string): WithdrawalBank[] {
  try { return read<WithdrawalBank>(key(BANKS, customerId)); }
  catch { return []; }
}

export function saveWithdrawalBank(customerId: string, input: { nickname: string; currency: string; country: string; last4: string }): WithdrawalBank {
  const currency = input.currency.toUpperCase();
  if (!isAccountCurrency(currency)) throw new Error('INVALID_CURRENCY');
  const bank: WithdrawalBank = {
    id: `bank_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    customerId: customerId.trim().toLowerCase(),
    nickname: cleanAccountLabel(input.nickname, 'nickname'),
    currency,
    country: cleanAccountLabel(input.country, 'country'),
    last4: input.last4.replace(/\D/g, ''),
    createdAt: new Date().toISOString(),
  };
  if (!/^\d{4}$/.test(bank.last4)) throw new Error('INVALID_LAST4');
  const next = [bank, ...listWithdrawalBanks(customerId)].slice(0, 12);
  write(key(BANKS, customerId), next);
  return bank;
}

export function listBeneficiaries(customerId: string): ShamBeneficiary[] {
  try { return read<ShamBeneficiary>(key(PAYEES, customerId)); }
  catch { return []; }
}

export function saveBeneficiary(customerId: string, input: { nickname: string; accountNumber: string }): ShamBeneficiary {
  const accountNumber = input.accountNumber.replace(/\s+/g, '').toUpperCase();
  if (!/^SHAM\d{13}$/.test(accountNumber)) throw new Error('INVALID_ACCOUNT');
  const payee: ShamBeneficiary = {
    id: `payee_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    customerId: customerId.trim(),
    nickname: cleanAccountLabel(input.nickname, 'nickname'),
    accountNumber,
    createdAt: new Date().toISOString(),
  };
  const next = [payee, ...listBeneficiaries(customerId).filter((row) => row.accountNumber !== accountNumber)].slice(0, 20);
  write(key(PAYEES, customerId), next);
  return payee;
}

export function requestAccountAction(customerId: string, input: {
  kind: AccountRequestKind;
  currency: string;
  amountLabel?: string;
  detail: string;
}): AccountRequest {
  const currency = input.currency.toUpperCase();
  if (!isAccountCurrency(currency) && input.kind !== 'receiving') throw new Error('INVALID_CURRENCY');
  const amountLabel = (input.amountLabel || '').trim();
  if (input.kind !== 'card' && input.kind !== 'receiving' && !/^\d{1,9}(\.\d{1,2})?$/.test(amountLabel)) throw new Error('INVALID_AMOUNT');
  const detail = cleanAccountLabel(input.detail, 'detail');
  const request: AccountRequest = {
    id: `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    customerId: customerId.trim().toLowerCase(),
    kind: input.kind,
    status: 'requested',
    currency: isAccountCurrency(currency) ? currency : 'USD',
    amountLabel: amountLabel || '—',
    detail,
    createdAt: new Date().toISOString(),
  };
  if (LONG_DIGITS.test(`${request.detail} ${request.amountLabel}`)) throw new Error('SECRET');
  const next = [request, ...listAccountRequests(customerId)].slice(0, 40);
  write(key(REQUESTS, customerId), next);
  return request;
}
