/**
 * Sham Bank internal books.
 * A Sham account number is a ledger reference for this platform only.
 * It is not an IBAN, a routing number, or a receiving account at another bank.
 * Internal transfers post and move available balance. An external withdrawal is a hold:
 * available balance drops, and nothing is marked sent or paid outside Sham.
 */

import { decimals, sumMinor, toMinor } from '../finance/money';
import { convert, type FxTable } from '../utils/pricing';
import { ACCOUNT_CURRENCIES, isAccountCurrency, type AccountCurrency } from './shamAccount';
import { guardSnapshot, screenOutbound, type GuardSnapshot } from './shamGuard';

export const PLATFORM_HOLDER = 'sham-platform';
export const LEDGER_COUNTERPARTY = 'SHAM-LEDGER';

const ACCOUNT_DIGITS = 12;

export function normalizeHolderId(customerId: string): string {
  const raw = customerId.trim();
  if (!raw || raw.toLowerCase() === 'guest_client' || raw.toLowerCase() === 'guest') throw new Error('LOGIN_REQUIRED');
  if (raw.toLowerCase() === 'owner') return PLATFORM_HOLDER;
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/.test(raw)) throw new Error('LOGIN_REQUIRED');
  return raw;
}

function fnv(seed: number, text: string): number {
  let hash = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Luhn check digit for a numeric body. The famous payload 7992739871 yields 3. */
export function luhnCheckDigit(body: string): string {
  if (!/^\d+$/.test(body)) throw new Error('INVALID_ACCOUNT');
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    let digit = Number(body[body.length - 1 - i]);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return String((10 - (sum % 10)) % 10);
}

export function luhnOk(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** Stable internal account number. Same holder always gets the same number. Not an IBAN. */
export function shamAccountNumber(customerId: string): string {
  const id = normalizeHolderId(customerId);
  const left = fnv(0x811c9dc5, `sham-account:v1:${id}`);
  const right = fnv(0x811c9dc5 ^ 0x9e3779b9, `sham-account:v1:${id}`);
  const body = ((BigInt(left) << 32n) + BigInt(right)) % 1_000_000_000_000n;
  const digits = body.toString().padStart(ACCOUNT_DIGITS, '0');
  return `SHAM${digits}${luhnCheckDigit(digits)}`;
}

export function formatShamAccount(number: string): string {
  const compact = parseShamAccount(number);
  const digits = compact.slice(4);
  return `SHAM ${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)} ${digits.slice(12)}`;
}

/** True for a real-world IBAN shape. A Sham number must never match. */
export function looksLikeExternalIban(value: string): boolean {
  const compact = value.replace(/\s+/g, '').toUpperCase();
  return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact);
}

export function parseShamAccount(value: string): string {
  const compact = value.replace(/\s+/g, '').toUpperCase();
  if (looksLikeExternalIban(compact) || !/^SHAM\d{13}$/.test(compact) || !luhnOk(compact.slice(4))) throw new Error('INVALID_ACCOUNT');
  return compact;
}

export function idempotencyKey(value: string): string {
  const key = value.trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(key)) throw new Error('INVALID_KEY');
  return key;
}

export interface ShamHolder {
  id: string;
  accountNumber: string;
  openedAt: string;
}

export type PostingKind = 'import' | 'transfer' | 'hold' | 'release' | 'convert';
export type PostingStatus = 'posted' | 'held' | 'released';

export interface ShamPosting {
  id: string;
  holderId: string;
  accountNumber: string;
  currency: string;
  amountMinor: number;
  direction: 'credit' | 'debit';
  status: PostingStatus;
  kind: PostingKind;
  counterparty: string;
  detail: string;
  groupId: string;
  createdAt: string;
}

export interface ShamImport {
  id: string;
  holderId: string;
  currency: string;
  minor: number;
}

export interface ShamLock {
  id: string;
  at: string;
}

export interface LedgerState {
  holders: ShamHolder[];
  postings: ShamPosting[];
  imports: ShamImport[];
}

export function emptyLedger(): LedgerState {
  return { holders: [], postings: [], imports: [] };
}

export interface BalanceRow {
  currency: AccountCurrency;
  availableMinor: number;
  heldMinor: number;
  bookMinor: number;
}

export interface ActivityRow {
  id: string;
  createdAt: string;
  kind: PostingKind;
  currency: string;
  amountMinor: number;
  direction: 'credit' | 'debit';
  status: PostingStatus;
  counterparty: string;
  detail: string;
}

export interface AccountView {
  accountNumber: string;
  openedAt: string;
  balances: BalanceRow[];
  activity: ActivityRow[];
  persistent: boolean;
  guard: GuardSnapshot;
}

function copy(state: LedgerState): LedgerState {
  return {
    holders: state.holders.map((row) => ({ ...row })),
    postings: state.postings.map((row) => ({ ...row })),
    imports: state.imports.map((row) => ({ ...row })),
  };
}

export function holderOf(state: LedgerState, holderId: string): ShamHolder | undefined {
  const id = normalizeHolderId(holderId);
  return state.holders.find((row) => row.id === id);
}

export function ensureHolder(state: LedgerState, holderId: string, at: string): LedgerState {
  const id = normalizeHolderId(holderId);
  if (holderOf(state, id)) return state;
  const next = copy(state);
  next.holders.push({ id, accountNumber: shamAccountNumber(id), openedAt: at });
  return next;
}

export function balanceOf(state: LedgerState, holderId: string, currency: string): BalanceRow {
  const id = normalizeHolderId(holderId);
  const code = currency.toUpperCase();
  if (!isAccountCurrency(code)) throw new Error('INVALID_CURRENCY');
  const credits: number[] = [];
  const postedDebits: number[] = [];
  const heldDebits: number[] = [];
  for (const row of state.postings) {
    if (row.holderId !== id || row.currency !== code || row.status === 'released') continue;
    if (!Number.isSafeInteger(row.amountMinor) || row.amountMinor < 1) continue;
    if (row.direction === 'credit' && row.status === 'posted') credits.push(row.amountMinor);
    if (row.direction === 'debit' && row.status === 'posted') postedDebits.push(row.amountMinor);
    if (row.direction === 'debit' && row.status === 'held') heldDebits.push(row.amountMinor);
  }
  const credit = sumMinor(credits);
  const posted = sumMinor(postedDebits);
  const held = sumMinor(heldDebits);
  return { currency: code, availableMinor: credit - posted - held, heldMinor: held, bookMinor: credit - posted };
}

function requireHolder(state: LedgerState, holderId: string): ShamHolder {
  const holder = holderOf(state, holderId);
  if (!holder) throw new Error('UNKNOWN_ACCOUNT');
  return holder;
}

function amountOf(value: string, currency: string): number {
  const minor = toMinor(value, currency);
  if (minor < 1) throw new Error('INVALID_AMOUNT');
  return minor;
}

export function accountView(state: LedgerState, holderId: string, persistent = false, at = new Date().toISOString()): AccountView {
  const holder = requireHolder(state, holderId);
  const activity = state.postings
    .filter((row) => row.holderId === holder.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .slice(0, 60)
    .map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      kind: row.kind,
      currency: row.currency,
      amountMinor: row.amountMinor,
      direction: row.direction,
      status: row.status,
      counterparty: row.counterparty,
      detail: row.detail,
    }));
  return {
    accountNumber: holder.accountNumber,
    openedAt: holder.openedAt,
    balances: ACCOUNT_CURRENCIES.map((currency) => balanceOf(state, holder.id, currency)),
    activity,
    persistent,
    guard: guardSnapshot(state.postings, holder.id, at),
  };
}

export function findByAccount(state: LedgerState, accountNumber: string): ShamHolder | undefined {
  const number = parseShamAccount(accountNumber);
  return state.holders.find((row) => row.accountNumber === number);
}

function push(state: LedgerState, posting: ShamPosting) {
  if (state.postings.some((row) => row.id === posting.id)) return;
  state.postings.push(posting);
}

export function importRecorded(state: LedgerState, holderId: string, rows: { currency: string; minor: number }[], at: string): LedgerState {
  const id = normalizeHolderId(holderId);
  if (id !== PLATFORM_HOLDER) throw new Error('NOT_PLATFORM');
  const next = ensureHolder(copy(state), id, at);
  const holder = requireHolder(next, id);
  for (const code of ACCOUNT_CURRENCIES) {
    const target = rows.filter((row) => row.currency === code && Number.isSafeInteger(row.minor) && row.minor > 0).reduce((sum, row) => sum + row.minor, 0);
    if (!Number.isSafeInteger(target) || target < 1) continue;
    const markerId = `${id}_${code}`;
    const imported = next.imports.find((row) => row.id === markerId)?.minor || 0;
    if (target <= imported) continue;
    const delta = target - imported;
    push(next, {
      id: `import_${id}_${code}_${target}`,
      holderId: id,
      accountNumber: holder.accountNumber,
      currency: code,
      amountMinor: delta,
      direction: 'credit',
      status: 'posted',
      kind: 'import',
      counterparty: LEDGER_COUNTERPARTY,
      detail: 'confirmed collection',
      groupId: `import_${id}_${code}_${target}`,
      createdAt: at,
    });
    const marker = next.imports.find((row) => row.id === markerId);
    if (marker) marker.minor = target;
    else next.imports.push({ id: markerId, holderId: id, currency: code, minor: target });
  }
  return next;
}

export interface TransferInput {
  fromHolderId: string;
  toAccountNumber: string;
  currency: string;
  amount: string;
  detail: string;
  idempotencyKey: string;
  at: string;
}

export function transfer(state: LedgerState, input: TransferInput): LedgerState {
  const fromId = normalizeHolderId(input.fromHolderId);
  const key = idempotencyKey(input.idempotencyKey);
  const groupId = `t_${key}`;
  if (state.postings.some((row) => row.groupId === groupId)) return state;
  const next = ensureHolder(copy(state), fromId, input.at);
  const from = requireHolder(next, fromId);
  const toNumber = parseShamAccount(input.toAccountNumber);
  const to = findByAccount(next, toNumber);
  if (!to) throw new Error('UNKNOWN_ACCOUNT');
  if (to.id === from.id) throw new Error('SAME_ACCOUNT');
  const currency = input.currency.toUpperCase();
  if (!isAccountCurrency(currency)) throw new Error('INVALID_CURRENCY');
  const amountMinor = amountOf(input.amount, currency);
  if (balanceOf(next, from.id, currency).availableMinor < amountMinor) throw new Error('INSUFFICIENT_FUNDS');
  screenOutbound(next.postings, { holderId: from.id, currency, amountMinor, at: input.at, payee: to.accountNumber });
  const detail = input.detail.trim() || 'internal transfer';
  const base = {
    currency, amountMinor, status: 'posted' as const, kind: 'transfer' as const, detail, groupId, createdAt: input.at,
  };
  push(next, { ...base, id: `${groupId}_out`, holderId: from.id, accountNumber: from.accountNumber, direction: 'debit', counterparty: to.accountNumber });
  push(next, { ...base, id: `${groupId}_in`, holderId: to.id, accountNumber: to.accountNumber, direction: 'credit', counterparty: from.accountNumber });
  return next;
}

export interface HoldInput {
  holderId: string;
  currency: string;
  amount: string;
  detail: string;
  idempotencyKey: string;
  at: string;
}

export function holdWithdrawal(state: LedgerState, input: HoldInput): LedgerState {
  const id = normalizeHolderId(input.holderId);
  const key = idempotencyKey(input.idempotencyKey);
  const groupId = `h_${key}`;
  if (state.postings.some((row) => row.groupId === groupId)) return state;
  const next = ensureHolder(copy(state), id, input.at);
  const holder = requireHolder(next, id);
  const currency = input.currency.toUpperCase();
  if (!isAccountCurrency(currency)) throw new Error('INVALID_CURRENCY');
  const amountMinor = amountOf(input.amount, currency);
  if (balanceOf(next, id, currency).availableMinor < amountMinor) throw new Error('INSUFFICIENT_FUNDS');
  screenOutbound(next.postings, { holderId: id, currency, amountMinor, at: input.at });
  push(next, {
    id: `${groupId}_hold`,
    holderId: id,
    accountNumber: holder.accountNumber,
    currency,
    amountMinor,
    direction: 'debit',
    status: 'held',
    kind: 'hold',
    counterparty: LEDGER_COUNTERPARTY,
    detail: input.detail.trim() || 'withdrawal hold',
    groupId,
    createdAt: input.at,
  });
  return next;
}

export function releaseHold(state: LedgerState, holderId: string, postingId: string, at: string): LedgerState {
  const id = normalizeHolderId(holderId);
  const next = copy(state);
  const hold = next.postings.find((row) => row.id === postingId && row.holderId === id && row.kind === 'hold' && row.status === 'held');
  if (!hold) throw new Error('HOLD_NOT_FOUND');
  hold.status = 'released';
  const holder = requireHolder(next, id);
  push(next, {
    id: `${hold.groupId}_release`,
    holderId: id,
    accountNumber: holder.accountNumber,
    currency: hold.currency,
    amountMinor: hold.amountMinor,
    direction: 'credit',
    status: 'released',
    kind: 'release',
    counterparty: LEDGER_COUNTERPARTY,
    detail: 'hold released',
    groupId: hold.groupId,
    createdAt: at,
  });
  return next;
}

export function quoteConvert(amount: string, from: string, to: string, fx: FxTable): { debitMinor: number; creditMinor: number; rateLabel: string } {
  const fromCode = from.toUpperCase();
  const toCode = to.toUpperCase();
  if (!isAccountCurrency(fromCode) || !isAccountCurrency(toCode)) throw new Error('INVALID_CURRENCY');
  if (fromCode === toCode) throw new Error('SAME_CURRENCY');
  const debitMinor = amountOf(amount, fromCode);
  let creditMajor: number;
  let unit: number;
  try {
    creditMajor = convert(debitMinor / 10 ** decimals(fromCode), fromCode, toCode, fx);
    unit = convert(1, fromCode, toCode, fx);
  } catch {
    throw new Error('RATE_MISSING');
  }
  const creditMinor = Math.round(creditMajor * 10 ** decimals(toCode));
  if (!Number.isSafeInteger(creditMinor) || creditMinor < 1) throw new Error('AMOUNT_TOO_SMALL');
  const places = Math.min(6, decimals(toCode) + 4);
  return { debitMinor, creditMinor, rateLabel: `1 ${fromCode} = ${unit.toFixed(places)} ${toCode}` };
}

export interface ConvertInput {
  holderId: string;
  from: string;
  to: string;
  amount: string;
  idempotencyKey: string;
  at: string;
  fx: FxTable;
}

export function convertBalance(state: LedgerState, input: ConvertInput): LedgerState {
  const id = normalizeHolderId(input.holderId);
  const key = idempotencyKey(input.idempotencyKey);
  const groupId = `c_${key}`;
  if (state.postings.some((row) => row.groupId === groupId)) return state;
  const quote = quoteConvert(input.amount, input.from, input.to, input.fx);
  const next = ensureHolder(copy(state), id, input.at);
  const holder = requireHolder(next, id);
  const from = input.from.toUpperCase();
  if (balanceOf(next, id, from).availableMinor < quote.debitMinor) throw new Error('INSUFFICIENT_FUNDS');
  screenOutbound(next.postings, { holderId: id, currency: from, amountMinor: quote.debitMinor, at: input.at, fx: input.fx });
  const detail = quote.rateLabel;
  push(next, {
    id: `${groupId}_out`, holderId: id, accountNumber: holder.accountNumber, currency: from, amountMinor: quote.debitMinor,
    direction: 'debit', status: 'posted', kind: 'convert', counterparty: holder.accountNumber, detail, groupId, createdAt: input.at,
  });
  push(next, {
    id: `${groupId}_in`, holderId: id, accountNumber: holder.accountNumber, currency: input.to.toUpperCase(), amountMinor: quote.creditMinor,
    direction: 'credit', status: 'posted', kind: 'convert', counterparty: holder.accountNumber, detail, groupId, createdAt: input.at,
  });
  return next;
}

export function statementLines(view: AccountView): string[] {
  const lines = [
    'Sham Bank internal statement',
    `Account ${formatShamAccount(view.accountNumber)}`,
    'Internal Sham account number. Not a bank IBAN. External withdrawals stay held and are not sent.',
    '',
  ];
  for (const row of view.balances) {
    if (row.availableMinor === 0 && row.heldMinor === 0) continue;
    lines.push(`${row.currency} available ${row.availableMinor} held ${row.heldMinor}`);
  }
  lines.push('');
  for (const row of view.activity) {
    lines.push(`${row.createdAt} ${row.kind} ${row.direction} ${row.amountMinor} ${row.currency} ${row.status} ${row.counterparty} ${row.detail}`);
  }
  return lines;
}
