/**
 * Server books for بنك شام. Append-only postings on Sham Core's store.
 * The client never supplies an opening balance. Only confirmed collections
 * can fund the platform account, and only an admin route calls that import.
 */
import { ValidationError } from '../core/repository';
import type { Store } from '../core/store';
import type { FxTable } from '../../src/utils/pricing';
import {
  PLATFORM_HOLDER,
  accountView,
  convertBalance,
  emptyLedger,
  ensureHolder,
  holdWithdrawal,
  importRecorded,
  normalizeHolderId,
  parseShamAccount,
  releaseHold,
  transfer,
  type AccountView,
  type LedgerState,
  type ShamHolder,
  type ShamImport,
  type ShamLock,
  type ShamPosting,
} from '../../src/bank/shamLedger';
import { cleanAccountLabel, isAccountCurrency } from '../../src/bank/shamAccount';

const TEXT: Record<string, string> = {
  LOGIN_REQUIRED: 'سجّل الدخول أولاً.',
  INVALID_AMOUNT: 'اكتب مبلغاً صالحاً.',
  INVALID_CURRENCY: 'هذه العملة ليست من أرصدة الحساب.',
  INVALID_ACCOUNT: 'رقم حساب شام غير صالح.',
  UNKNOWN_ACCOUNT: 'لا يوجد حساب شام بهذا الرقم. يجب أن يفتح صاحبه البنك أولاً.',
  SAME_ACCOUNT: 'لا يمكن التحويل إلى نفس الحساب.',
  INSUFFICIENT_FUNDS: 'الرصيد المتاح لا يكفي.',
  INVALID_KEY: 'أعد المحاولة.',
  INVALID_LABEL: 'الاسم قصير أو غير مقبول.',
  SECRET: 'لا تكتب رقم حساب خارجي أو رمزاً سرياً.',
  RATE_MISSING: 'لا يوجد سعر دفتر لهذه العملة.',
  AMOUNT_TOO_SMALL: 'المبلغ أصغر من أن يُحوَّل.',
  SAME_CURRENCY: 'اختر عملتين مختلفتين.',
  HOLD_NOT_FOUND: 'لا يوجد حجز بهذا الرقم.',
  NOT_PLATFORM: 'فتح التحصيل المؤكد لحساب المنصة فقط.',
  BUSY: 'الحساب مشغول. أعد المحاولة.',
  CONFLICT: 'تعارض في الدفتر. أعد المحاولة.',
  INVALID_PRECISION: 'المبلغ أدق من عملته.',
  AMOUNT_TOO_LARGE: 'المبلغ أكبر من حد الدفتر.',
};

function rethrow(error: unknown): never {
  if (error instanceof ValidationError) throw error;
  const code = error instanceof Error ? error.message : '';
  if (TEXT[code]) throw new ValidationError(code, TEXT[code], code === 'UNKNOWN_ACCOUNT' || code === 'HOLD_NOT_FOUND' ? 404 : 400);
  throw error;
}

function isHolder(value: ShamHolder | undefined): value is ShamHolder {
  return Boolean(value && value.id && /^SHAM\d{13}$/.test(value.accountNumber) && value.openedAt);
}

function isPosting(value: ShamPosting | undefined): value is ShamPosting {
  return Boolean(value && value.id && value.holderId && value.groupId && isAccountCurrency(value.currency)
    && Number.isSafeInteger(value.amountMinor) && value.amountMinor > 0
    && (value.direction === 'credit' || value.direction === 'debit')
    && (value.status === 'posted' || value.status === 'held' || value.status === 'released')
    && (value.kind === 'import' || value.kind === 'transfer' || value.kind === 'hold' || value.kind === 'release' || value.kind === 'convert')
    && !/iban|cvv|cvc/i.test(value.detail || ''));
}

function isImport(value: ShamImport | undefined): value is ShamImport {
  return Boolean(value && value.id && value.holderId && isAccountCurrency(value.currency) && Number.isSafeInteger(value.minor) && value.minor >= 0);
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const note = (value: string) => (value.trim() ? cleanAccountLabel(value, 'detail') : '');

export function readMoneyBody(body: unknown) {
  const record = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
  return {
    currency: text(record.currency, 8).toUpperCase(),
    amount: text(record.amount, 20),
    detail: text(record.detail, 80),
    idempotencyKey: text(record.idempotencyKey, 64),
    toAccountNumber: text(record.toAccountNumber, 32),
    from: text(record.from, 8).toUpperCase(),
    to: text(record.to, 8).toUpperCase(),
    postingId: text(record.postingId, 90),
  };
}

export class ShamBooks {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private store: Store, private now: () => string = () => new Date().toISOString(), private persistent: () => boolean = () => store.persistent) {}

  private async load(): Promise<LedgerState> {
    const [holders, postings, imports] = await Promise.all([
      this.store.list('shamHolders'),
      this.store.list('shamPostings'),
      this.store.list('shamImports'),
    ]);
    return {
      holders: holders.filter(isHolder),
      postings: postings.filter(isPosting),
      imports: imports.filter(isImport),
    };
  }

  private async persist(before: LedgerState, after: LedgerState) {
    const known = new Set(before.holders.map((row) => row.id));
    for (const holder of after.holders) {
      if (known.has(holder.id)) continue;
      const created = await this.store.create('shamHolders', holder.id, holder);
      if (!created && !(await this.store.get('shamHolders', holder.id))) throw new ValidationError('CONFLICT', TEXT.CONFLICT, 409);
    }
    const previous = new Map(before.postings.map((row) => [row.id, row]));
    for (const posting of after.postings) {
      const prior = previous.get(posting.id);
      if (!prior) {
        if (!(await this.store.create('shamPostings', posting.id, posting))) throw new ValidationError('CONFLICT', TEXT.CONFLICT, 409);
      } else if (prior.status === 'held' && posting.status === 'released') {
        await this.store.put('shamPostings', posting.id, posting);
      }
    }
    for (const row of after.imports) await this.store.put('shamImports', row.id, row);
  }

  private async withLock<T>(holderId: string, work: () => Promise<T>): Promise<T> {
    const run = this.queue.then(() => this.storeLock(holderId, work), () => this.storeLock(holderId, work));
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }

  private async storeLock<T>(holderId: string, work: () => Promise<T>): Promise<T> {
    const id = `lock_${holderId}`.slice(0, 120);
    for (let attempt = 0; attempt < 8; attempt++) {
      const existing = await this.store.get('shamLocks', id);
      if (existing && Date.now() - Date.parse(existing.at) > 30_000) await this.store.delete('shamLocks', id);
      const lock: ShamLock = { id, at: new Date().toISOString() };
      if (!(await this.store.create('shamLocks', id, lock))) {
        await delay(40 * (attempt + 1));
        continue;
      }
      try { return await work(); } finally { await this.store.delete('shamLocks', id); }
    }
    throw new ValidationError('BUSY', TEXT.BUSY, 409);
  }

  private view(state: LedgerState, holderId: string): AccountView {
    return accountView(state, holderId, this.persistent());
  }

  async open(customerId: string): Promise<AccountView> {
    const holderId = normalizeHolderId(customerId);
    return this.withLock(holderId, async () => {
      try {
        const before = await this.load();
        const after = ensureHolder(before.holders.length ? before : emptyLedger(), holderId, this.now());
        if (!before.holders.some((row) => row.id === holderId)) await this.persist(before, after);
        return this.view(after, holderId);
      } catch (error) { rethrow(error); }
    });
  }

  async exists(accountNumber: string): Promise<boolean> {
    try {
      const number = parseShamAccount(accountNumber);
      return (await this.load()).holders.some((row) => row.accountNumber === number);
    } catch (error) { rethrow(error); }
  }

  async transfer(customerId: string, input: { toAccountNumber: string; currency: string; amount: string; detail: string; idempotencyKey: string }): Promise<AccountView> {
    const holderId = normalizeHolderId(customerId);
    return this.withLock(holderId, async () => {
      try {
        const before = await this.load();
        const after = transfer(before, { ...input, detail: note(input.detail), fromHolderId: holderId, at: this.now() });
        await this.persist(before, after);
        return this.view(await this.load(), holderId);
      } catch (error) { rethrow(error); }
    });
  }

  async hold(customerId: string, input: { currency: string; amount: string; detail: string; idempotencyKey: string }): Promise<AccountView> {
    const holderId = normalizeHolderId(customerId);
    return this.withLock(holderId, async () => {
      try {
        const before = await this.load();
        const after = holdWithdrawal(before, { ...input, detail: note(input.detail), holderId, at: this.now() });
        await this.persist(before, after);
        return this.view(await this.load(), holderId);
      } catch (error) { rethrow(error); }
    });
  }

  async release(customerId: string, postingId: string): Promise<AccountView> {
    const holderId = normalizeHolderId(customerId);
    return this.withLock(holderId, async () => {
      try {
        const before = await this.load();
        const after = releaseHold(before, holderId, postingId, this.now());
        await this.persist(before, after);
        return this.view(await this.load(), holderId);
      } catch (error) { rethrow(error); }
    });
  }

  async convert(customerId: string, input: { from: string; to: string; amount: string; idempotencyKey: string }, fx: FxTable): Promise<AccountView> {
    const holderId = normalizeHolderId(customerId);
    return this.withLock(holderId, async () => {
      try {
        const before = await this.load();
        const after = convertBalance(before, { ...input, holderId, at: this.now(), fx });
        await this.persist(before, after);
        return this.view(await this.load(), holderId);
      } catch (error) { rethrow(error); }
    });
  }

  /** Credits only the platform account, and only by the delta of already-confirmed collections. */
  async importConfirmed(rows: { currency: string; minor: number }[]): Promise<AccountView> {
    return this.withLock(PLATFORM_HOLDER, async () => {
      try {
        const before = await this.load();
        const after = importRecorded(before, PLATFORM_HOLDER, rows, this.now());
        await this.persist(before, after);
        return this.view(await this.load(), PLATFORM_HOLDER);
      } catch (error) { rethrow(error); }
    });
  }
}
