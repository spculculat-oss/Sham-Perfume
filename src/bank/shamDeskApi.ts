/**
 * Opens the signed-in Sham book. The server book is used when the API answers.
 * If the API is not there, the browser book still posts internal transfers
 * between accounts opened in this browser. It never pretends an external send happened.
 */
import { AdminApiError, adminRequest, getToken, send } from '../admin/adminApi';
import { getSessionToken } from '../community/api';
import { ApiError, ApiUnavailableError, requestApi } from '../utils/api';
import { BUNDLED_FX } from '../utils/pricing';
import {
  PLATFORM_HOLDER,
  accountView,
  convertBalance,
  emptyLedger,
  ensureHolder,
  findByAccount,
  holdWithdrawal,
  importRecorded,
  normalizeHolderId,
  quoteConvert,
  releaseHold,
  transfer,
  type AccountView,
  type LedgerState,
} from './shamLedger';
import type { RecordedBalance } from './shamAccount';

const LOCAL = 'sham_internal_ledger_v1';

export interface DeskAccount extends AccountView {
  book: 'server' | 'browser';
}

export interface ShamSession {
  view: DeskAccount;
  reload(): Promise<DeskAccount>;
  transfer(input: { toAccountNumber: string; currency: string; amount: string; detail: string; idempotencyKey: string; confirmed: boolean }): Promise<DeskAccount>;
  hold(input: { currency: string; amount: string; detail: string; idempotencyKey: string; confirmed: boolean }): Promise<DeskAccount>;
  release(postingId: string): Promise<DeskAccount>;
  convert(input: { from: string; to: string; amount: string; idempotencyKey: string; confirmed: boolean }): Promise<DeskAccount>;
  resolve(accountNumber: string): Promise<boolean>;
}

export function newBookKey(): string {
  const raw = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  const key = raw.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  return key.length >= 8 ? key : `${key}shamdesk`;
}

export function bookErrorCode(error: unknown): string {
  if (error instanceof ApiError && error.code) return error.code;
  if (error instanceof AdminApiError && error.code) return error.code;
  if (error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)) return error.message;
  return 'BOOK_FAILED';
}

function offline(error: unknown): boolean {
  if (error instanceof ApiUnavailableError) return true;
  if (error instanceof ApiError) return error.status === 0 || error.status === 404 || error.status >= 500;
  if (error instanceof AdminApiError) return error.status === 404 || error.status >= 500;
  if (error instanceof TypeError) return true;
  return error instanceof Error && /static page|Failed to fetch|Network/i.test(error.message);
}

function readLocal(): LedgerState {
  if (typeof localStorage === 'undefined') return emptyLedger();
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL) || '') as LedgerState;
    if (!parsed || !Array.isArray(parsed.holders) || !Array.isArray(parsed.postings) || !Array.isArray(parsed.imports)) return emptyLedger();
    return { holders: parsed.holders, postings: parsed.postings, imports: parsed.imports };
  } catch {
    return emptyLedger();
  }
}

function writeLocal(state: LedgerState) {
  localStorage.setItem(LOCAL, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('sham-account-updated'));
}

function browserSession(holderId: string, recorded: RecordedBalance[]): ShamSession {
  const at = () => new Date().toISOString();
  const load = () => {
    let state = ensureHolder(readLocal(), holderId, at());
    if (holderId === PLATFORM_HOLDER && recorded.length) state = importRecorded(state, PLATFORM_HOLDER, recorded, at());
    writeLocal(state);
    return state;
  };
  const finish = (state: LedgerState): DeskAccount => ({ ...accountView(state, holderId, true), book: 'browser' });
  const mutate = (apply: (state: LedgerState) => LedgerState) => {
    const next = apply(load());
    writeLocal(next);
    return finish(next);
  };
  const view = finish(load());
  return {
    view,
    reload: async () => finish(load()),
    transfer: async (input) => { if (input.confirmed !== true) throw new Error('CONFIRMATION_REQUIRED'); return mutate((state) => transfer(state, { ...input, fromHolderId: holderId, at: at() })); },
    hold: async (input) => { if (input.confirmed !== true) throw new Error('CONFIRMATION_REQUIRED'); return mutate((state) => holdWithdrawal(state, { ...input, holderId, at: at() })); },
    release: async (postingId) => mutate((state) => releaseHold(state, holderId, postingId, at())),
    convert: async (input) => { if (input.confirmed !== true) throw new Error('CONFIRMATION_REQUIRED'); return mutate((state) => convertBalance(state, { ...input, holderId, at: at(), fx: BUNDLED_FX })); },
    resolve: async (accountNumber) => {
      try { return Boolean(findByAccount(load(), accountNumber)); } catch { return false; }
    },
  };
}

function tagged(view: AccountView): DeskAccount {
  return { ...view, book: 'server' };
}

async function serverSession(mode: 'customer' | 'platform'): Promise<ShamSession> {
  if (mode === 'platform') {
    if (!getToken()) throw new Error('LOGIN_REQUIRED');
    const call = async (path: string, init?: RequestInit) => tagged(await adminRequest<AccountView>(path, init));
    const view = await call('/finance/bank/sham/import', send('POST', {})).catch(async (error) => {
      if (offline(error)) throw error;
      return call('/finance/bank/sham');
    });
    return {
      view,
      reload: () => call('/finance/bank/sham'),
      transfer: (input) => call('/finance/bank/sham/transfer', send('POST', input)),
      hold: (input) => call('/finance/bank/sham/hold', send('POST', input)),
      release: (postingId) => call('/finance/bank/sham/release', send('POST', { postingId })),
      convert: (input) => call('/finance/bank/sham/convert', send('POST', input)),
      resolve: async (number) => {
        try {
          await adminRequest(`/finance/bank/sham/resolve?number=${encodeURIComponent(number)}`);
          return true;
        } catch (error) {
          if (error instanceof AdminApiError && error.code === 'UNKNOWN_ACCOUNT') return false;
          throw error;
        }
      },
    };
  }
  const token = getSessionToken();
  if (!token) throw new Error('LOGIN_REQUIRED');
  const call = async (path: `/api/${string}`, init?: RequestInit) => tagged(await requestApi<AccountView>(path, {
    ...init,
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${token}` },
  }));
  const view = await call('/api/store/sham-bank');
  return {
    view,
    reload: () => call('/api/store/sham-bank'),
    transfer: (input) => call('/api/store/sham-bank/transfer', { method: 'POST', body: JSON.stringify(input) }),
    hold: (input) => call('/api/store/sham-bank/hold', { method: 'POST', body: JSON.stringify(input) }),
    release: (postingId) => call('/api/store/sham-bank/release', { method: 'POST', body: JSON.stringify({ postingId }) }),
    convert: (input) => call('/api/store/sham-bank/convert', { method: 'POST', body: JSON.stringify(input) }),
    resolve: async (number) => {
      try {
        await requestApi(`/api/store/sham-bank/resolve?number=${encodeURIComponent(number)}`, { headers: { Authorization: `Bearer ${token}` } });
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.code === 'UNKNOWN_ACCOUNT') return false;
        if (error instanceof ApiError && error.status === 404) return false;
        throw error;
      }
    },
  };
}

export async function openShamSession(input: { customerId: string; recorded?: RecordedBalance[] }): Promise<ShamSession> {
  const holderId = normalizeHolderId(input.customerId);
  const mode = holderId === PLATFORM_HOLDER ? 'platform' : 'customer';
  try {
    return await serverSession(mode);
  } catch (error) {
    // A missing API or a session the server cannot read still opens this browser's books. The desk says so.
    if (offline(error) || bookErrorCode(error) === 'LOGIN_REQUIRED') return browserSession(holderId, mode === 'platform' ? input.recorded || [] : []);
    throw error;
  }
}

export function previewConvert(amount: string, from: string, to: string) {
  return quoteConvert(amount, from, to, BUNDLED_FX);
}
