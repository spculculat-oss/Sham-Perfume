/**
 * «بنك شام» — the store's own money-management layer on top of «أمين شاهين»'s append-only ledger.
 *
 *  - Direct collection with NO payment gateway: InstaPay, bank transfer, mobile wallets and cash on delivery.
 *    The buyer reserves an order, pays from their own bank app, reports the transfer reference; the owner
 *    confirms after seeing the money (or after matching a pasted bank statement). Only then is a sale posted.
 *  - Payables (bills we owe), monthly budgets with alerts, cash-flow forecast, profitability, audit trail and
 *    «شاهين المحاسب» (questions answered from the figures).
 *
 * Boundaries: it never moves money, never stores cards, passwords or full statements, and never confirms a
 * payment by itself. Buyer contacts stay out of the ledger (only a one-way hash for repeat-order checks).
 */
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { decimals, toMinor } from '../../src/finance/money';
import { COLLECTION_KINDS, EXPENSE_CATEGORIES, type CollectionKind, type ExpenseCategory } from '../../src/finance/bankKinds';
import { accountBalances, budgetUsage, cashForecast, convertEstimate, countryPerformance, matchStatement, parseStatement, payablesAgeing, productPerformance } from '../../src/finance/bankTools';
import { answerFinance, type AccountantSnapshot, type CurrencyFigures } from '../../src/finance/accountant';
import { isCountry, type FxTable } from '../../src/utils/pricing';
import { ValidationError } from '../core/repository';
import { createNotifier } from '../core/notify';
import { financeId } from './report';
import type { FinanceService } from './service';
import type { BankAudit, CollectionAccount, DirectPayment, FinanceEntry, FinanceOrder, Payable } from './types';

type Env = Record<string, string | undefined>;
const fail = (code: string, message: string, status = 400): never => { throw new ValidationError(code, message, status); };
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const DAY = 86400_000;
const OPEN: DirectPayment['state'][] = ['awaiting_payment', 'claimed'];

/** Card-number shaped digits (13–19 digits starting 2–6, Luhn-valid) — never allowed in free text. */
export function looksLikeCard(text: string): boolean {
  for (const m of text.replace(/[ -]/g, '').matchAll(/(?<![A-Za-z0-9])[2-6]\d{12,18}(?!\d)/g)) {
    const digits = m[0]; let sum = 0;
    for (let i = 0; i < digits.length; i++) {
      let d = Number(digits[digits.length - 1 - i]);
      if (i % 2) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
    }
    if (sum % 10 === 0) return true;
  }
  return false;
}
const SECRET_WORDS = /password|passcode|\bpin\b|cvv|cvc|otp|كلمة\s*(السر|المرور)|الرقم\s*السري|رمز\s*التحقق|-----BEGIN|sk_(live|test)_|\bBearer\s/i;
/** Free text an admin or buyer types: control characters stripped, length-bounded, no secrets or card numbers. */
export function cleanText(value: unknown, min: number, max: number, field: string): string {
  const text = typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').trim() : '';
  if (text.length < min || text.length > max) fail('INVALID_TEXT', `راجع ${field}: من ${min} إلى ${max} حرفاً.`);
  if (SECRET_WORDS.test(text) || looksLikeCard(text)) fail('SECRET_IN_TEXT', `لا تكتب كلمات سر أو أرقام بطاقات أو رموز تحقق في ${field}.`);
  return text;
}
const western = (s: string) => s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
const majorText = (minor: number, currency: string) => { const d = decimals(currency); return (minor / 10 ** d).toFixed(d); };
const KIND_NAMES: Record<CollectionKind, string> = { instapay: 'إنستاباي', bank_transfer: 'تحويل بنكي', wallet: 'محفظة موبايل', cod: 'الدفع عند الاستلام' };

export interface DirectOrderInput {
  ref: string; accountId: string; country: string; currency: string; totalMinor: number; shippingChargedMinor: number;
  lines: FinanceOrder['lines']; contact: { email: string; phone: string };
}
export interface DirectReceipt {
  ref: string; token: string; kind: CollectionKind; label: string; instructions: string;
  totalMinor: number; amount: string; currency: string; expiresAt: string;
}

export class BankService {
  constructor(readonly finance: FinanceService, readonly env: Env = finance.env, private fetcher: typeof fetch = fetch) {
    finance.checks.push((flag) => this.audit(flag));
  }
  get store() { return this.finance.store; }
  private now() { return this.finance.now(); }
  private at() { return new Date(this.now()).toISOString(); }
  private async log(action: string, target: string, detail?: string) {
    const item: BankAudit = { id: `${this.at()}_${randomUUID().slice(0, 8)}`, at: this.at(), action, target: target.slice(0, 80), ...(detail ? { detail: detail.slice(0, 160) } : {}) };
    await this.store.create('bankAudit', item.id, item);
  }

  /* ───────── Collection accounts ───────── */
  async accounts() { return (await this.store.list('bankAccounts')).sort((a, b) => a.createdAt.localeCompare(b.createdAt)); }
  readAccount(body: unknown, previous?: CollectionAccount): CollectionAccount {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const kind = (b.kind ?? previous?.kind) as CollectionKind;
    if (!COLLECTION_KINDS.includes(kind)) fail('INVALID_KIND', 'اختر: إنستاباي، تحويل بنكي، محفظة، أو الدفع عند الاستلام.');
    const label = cleanText(b.label ?? previous?.label ?? KIND_NAMES[kind], 2, 60, 'اسم الحساب');
    const instructions = cleanText(b.instructions ?? previous?.instructions ?? '', kind === 'cod' ? 0 : 5, 500, 'تعليمات الدفع');
    const currencies = Array.isArray(b.currencies) ? [...new Set(b.currencies.map((c) => String(c).trim().toUpperCase()))] : previous?.currencies || ['EGP'];
    if (!currencies.length || currencies.length > 5 || currencies.some((c) => { try { decimals(c); return false; } catch { return true; } })) fail('INVALID_CURRENCY', 'اختر من عملة إلى خمس عملات صحيحة (مثل EGP).');
    const countries = Array.isArray(b.countries) ? [...new Set(b.countries.map((c) => String(c).trim().toUpperCase()))] : previous?.countries || ['EG'];
    if (!countries.length || countries.length > 250 || countries.some((c) => !isCountry(c))) fail('INVALID_COUNTRY', 'اكتب رموز دول صحيحة (مثل EG, SA).');
    const holdHours = b.holdHours === undefined ? previous?.holdHours ?? (kind === 'cod' ? 720 : 72) : Number(b.holdHours);
    if (!Number.isInteger(holdHours) || holdHours < 1 || holdHours > 720) fail('INVALID_HOLD', 'مدة حجز الطلب من ساعة إلى ٧٢٠ ساعة.');
    const at = this.at();
    return { id: previous?.id || `acc_${kind}_${randomBytes(4).toString('hex')}`, kind, label, instructions, currencies, countries, holdHours,
      active: b.active === undefined ? previous?.active ?? true : b.active === true, createdAt: previous?.createdAt || at, updatedAt: at };
  }
  async saveAccount(id: string | undefined, body: unknown) {
    const previous = id ? await this.store.get('bankAccounts', id) : undefined;
    if (id && !previous) fail('NOT_FOUND', 'الحساب غير موجود.', 404);
    const account = this.readAccount(body, previous);
    await this.store.put('bankAccounts', account.id, account);
    await this.log(previous ? 'account.update' : 'account.create', account.id, `${account.kind} · ${account.active ? 'active' : 'off'}`);
    return account;
  }
  /** What the store shows a buyer: active accounts for their country. Nothing is offered without a durable ledger. */
  async publicMethods(country: string, wanted: string) {
    if (!this.finance.persistent || !isCountry(country)) return [];
    return (await this.accounts()).filter((a) => a.active && a.countries.includes(country))
      .map((a) => ({ id: a.id, kind: a.kind, label: a.label, currency: a.currencies.includes(wanted) ? wanted : a.currencies[0] }));
  }

  /* ───────── Direct orders (buyer side) ───────── */
  async createDirect(input: DirectOrderInput): Promise<DirectReceipt> {
    const found = await this.store.get('bankAccounts', input.accountId);
    const account = found && found.active && found.countries.includes(input.country) && found.currencies.includes(input.currency) ? found : fail('METHOD_UNAVAILABLE', 'وسيلة الدفع غير متاحة لهذا البلد أو العملة.', 409);
    await this.finance.recordOrder({ ref: input.ref, provider: 'direct', mode: 'live', country: input.country, currency: input.currency,
      totalMinor: input.totalMinor, shippingChargedMinor: input.shippingChargedMinor, lines: input.lines });
    const token = randomBytes(24).toString('base64url');
    const contactHash = sha(`${input.contact.email.trim().toLowerCase()}|${input.contact.phone.replace(/\D/g, '')}`);
    const all = await this.store.list('bankDirect');
    const risk: string[] = [];
    if (all.filter((d) => d.contactHash === contactHash && OPEN.includes(d.state)).length >= 2) risk.push('MANY_OPEN_ORDERS');
    const paid = all.filter((d) => d.state === 'paid' && d.currency === input.currency).map((d) => d.totalMinor).sort((a, b) => a - b);
    if (paid.length >= 5 && input.totalMinor > 3 * paid[Math.floor(paid.length / 2)]) risk.push('HIGH_AMOUNT');
    const item: DirectPayment = { id: input.ref, ref: input.ref, accountId: account.id, kind: account.kind, currency: input.currency, totalMinor: input.totalMinor,
      country: input.country, tokenHash: sha(token), contactHash, state: 'awaiting_payment', createdAt: this.at(), expiresAt: new Date(this.now() + account.holdHours * 3600_000).toISOString(), risk };
    if (!await this.store.create('bankDirect', item.id, item)) fail('DUPLICATE_ORDER', 'مرجع الطلب موجود بالفعل.', 409);
    return { ref: item.ref, token, kind: account.kind, label: account.label, instructions: account.instructions, totalMinor: item.totalMinor,
      amount: majorText(item.totalMinor, item.currency), currency: item.currency, expiresAt: item.expiresAt };
  }
  private async owned(ref: string, token: unknown): Promise<DirectPayment> {
    const item = typeof ref === 'string' && /^SP-[A-Z0-9-]{4,40}$/.test(ref) ? await this.store.get('bankDirect', ref) : undefined;
    const given = Buffer.from(sha(typeof token === 'string' ? token : ''), 'hex');
    if (!item || !timingSafeEqual(given, Buffer.from(item.tokenHash, 'hex'))) fail('NOT_FOUND', 'الطلب غير موجود.', 404);
    return this.expireOne(item!);
  }
  private async expireOne(item: DirectPayment) {
    if (item.state === 'awaiting_payment' && item.kind !== 'cod' && this.now() > Date.parse(item.expiresAt)) {
      const next = { ...item, state: 'expired' as const };
      await this.store.put('bankDirect', item.id, next);
      return next;
    }
    return item;
  }
  async publicView(ref: string, token: unknown) {
    const item = await this.owned(ref, token);
    const account = await this.store.get('bankAccounts', item.accountId);
    return { ref: item.ref, state: item.state, kind: item.kind, label: account?.label || KIND_NAMES[item.kind], instructions: account?.instructions || '',
      totalMinor: item.totalMinor, amount: majorText(item.totalMinor, item.currency), currency: item.currency, expiresAt: item.expiresAt, claimed: Boolean(item.claim) };
  }
  async claim(ref: string, token: unknown, body: unknown) {
    const item = await this.owned(ref, token);
    if (item.kind === 'cod') fail('COD_NO_CLAIM', 'الدفع عند الاستلام لا يحتاج إبلاغاً بالتحويل.', 409);
    if (item.state !== 'awaiting_payment') fail('INVALID_STATE', item.state === 'expired' ? 'انتهت مدة حجز الطلب؛ تواصل معنا.' : 'تم استلام بلاغك بالفعل.', 409);
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const payerName = cleanText(b.payerName, 2, 80, 'اسم المحوِّل');
    const transferRef = western(cleanText(b.transferRef, 3, 40, 'رقم العملية')).toUpperCase();
    if (!/^[A-Z0-9#/_ .-]+$/.test(transferRef)) fail('INVALID_REFERENCE', 'رقم العملية: حروف إنجليزية وأرقام فقط كما يظهر في تطبيق البنك.');
    const paidAt = typeof b.paidAt === 'string' ? Date.parse(b.paidAt) : NaN;
    if (!Number.isFinite(paidAt) || paidAt > this.now() + 10 * 60_000 || paidAt < Date.parse(item.createdAt) - 2 * DAY) fail('INVALID_DATE', 'اكتب وقت التحويل الصحيح.');
    let amountMinor: number;
    try { amountMinor = toMinor(western(String(b.amount ?? '')).replace(/,/g, ''), item.currency); } catch { return fail('INVALID_AMOUNT', 'اكتب المبلغ الذي حوّلته بالأرقام.'); }
    const risk = new Set(item.risk);
    if (amountMinor !== item.totalMinor) risk.add('AMOUNT_MISMATCH');
    if (paidAt < Date.parse(item.createdAt) - 3600_000) risk.add('PAID_BEFORE_ORDER');
    const key = transferRef.replace(/[^A-Z0-9]/g, '');
    const others = (await this.store.list('bankDirect')).filter((d) => d.id !== item.id && d.claim && d.claim.transferRef.replace(/[^A-Z0-9]/g, '') === key);
    if (others.length) risk.add('DUPLICATE_REFERENCE');
    const next: DirectPayment = { ...item, state: 'claimed', risk: [...risk], claim: { payerName, transferRef, paidAt: new Date(paidAt).toISOString(), amountMinor, submittedAt: this.at() } };
    await this.store.put('bankDirect', item.id, next);
    await this.finance.issue('DIRECT_CLAIM', 'عميل بلّغ عن تحويل ينتظر تأكيدك', 'افتح تطبيق البنك أو إنستاباي وتأكد من وصول المبلغ نفسه، ثم أكّد الطلب من «بنك شام». لا تؤكد قبل رؤية الفلوس.', risk.size ? 'critical' : 'warning', item.ref);
    try { await createNotifier(this.env, this.fetcher).send('finance.claim', `بنك شام: تحويل ${KIND_NAMES[item.kind]} ينتظر التأكيد (${item.ref}).`, { ref: item.ref, kind: item.kind, risk: [...risk] }); } catch { /* the issue is saved */ }
    return { ref: item.ref, state: next.state };
  }

  /* ───────── Owner decisions ───────── */
  private async resolveClaimIssue(ref: string) {
    const id = financeId('issue', 'DIRECT_CLAIM', ref);
    const issue = await this.store.get('financeIssues', id);
    if (issue && !issue.resolvedAt) await this.store.put('financeIssues', id, { ...issue, resolvedAt: this.at() });
  }
  async confirm(ref: string, body: unknown) {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const item = await this.store.get('bankDirect', String(ref));
    if (!item) return fail('NOT_FOUND', 'الطلب غير موجود.', 404);
    if (item.state === 'paid') return item;
    if (item.state === 'rejected') fail('INVALID_STATE', 'الطلب مرفوض؛ لا يمكن تأكيده.', 409);
    if (b.seen !== true) fail('CONFIRMATION_REQUIRED', 'أكّد إنك شفت المبلغ في حسابك أو استلمته نقداً.');
    if (item.risk.includes('AMOUNT_MISMATCH') && b.acceptMismatch !== true) fail('AMOUNT_MISMATCH', 'المبلغ المُبلَّغ مختلف عن قيمة الطلب. راجع حسابك أولاً.', 409);
    if (!this.finance.persistent) fail('FINANCE_STORAGE_REQUIRED', 'التأكيد يحتاج قاعدة بيانات دائمة.', 503);
    const note = b.note === undefined || b.note === '' ? '' : cleanText(b.note, 2, 160, 'الملاحظة');
    const saleId = financeId('sale', 'live', item.ref);
    const entry: FinanceEntry = { id: saleId, kind: 'sale', mode: 'live', currency: item.currency, amountMinor: item.totalMinor, orderRef: item.ref,
      at: this.at(), recordedAt: this.at(), source: 'direct', accountId: item.accountId };
    await this.store.create('financeEntries', saleId, entry); // atomic: one sale per order even if confirmed twice
    const next: DirectPayment = { ...item, state: 'paid', decidedAt: this.at(), saleId, ...(note ? { decision: note } : {}) };
    await this.store.put('bankDirect', item.id, next);
    await this.resolveClaimIssue(item.ref);
    await this.log('direct.confirm', item.ref, `${item.kind}${item.risk.length ? ` · risk:${item.risk.join(',')}` : ''}`);
    try { await this.finance.onPaid?.(item.ref); } catch { await this.finance.issue('PAID_SYNC_FAILED', 'التحصيل محفوظ والتسليم يحتاج متابعة', 'طابق الطلب المحصل مع نظام التجار؛ لا تطلب الدفع مرة ثانية.', 'critical', item.ref); }
    return next;
  }
  async reject(ref: string, reason: unknown) {
    const item = await this.store.get('bankDirect', String(ref));
    if (!item) return fail('NOT_FOUND', 'الطلب غير موجود.', 404);
    if (item.state === 'paid') fail('INVALID_STATE', 'الطلب مدفوع؛ سجّل استرداداً من السجل بدلاً من الرفض.', 409);
    const next: DirectPayment = { ...item, state: 'rejected', decidedAt: this.at(), decision: cleanText(reason, 3, 160, 'سبب الرفض') };
    await this.store.put('bankDirect', item.id, next);
    await this.resolveClaimIssue(item.ref);
    await this.log('direct.reject', item.ref);
    return next;
  }
  /** Pairs a pasted bank / InstaPay statement with orders waiting for money. The statement itself is not stored. */
  async matchStatement(text: unknown, currency: unknown) {
    if (typeof text !== 'string' || text.length > 400_000) fail('INVALID_STATEMENT', 'الصق كشف الحساب (CSV) بحد أقصى ٢٠٠٠ سطر.');
    const cur = String(currency || 'EGP').toUpperCase();
    try { decimals(cur); } catch { fail('INVALID_CURRENCY', 'عملة غير صحيحة.'); }
    const lines = parseStatement(text as string);
    const waiting = (await this.store.list('bankDirect')).filter((d) => ['awaiting_payment', 'claimed', 'expired'].includes(d.state) && d.kind !== 'cod');
    const result = matchStatement(lines, waiting.map((d) => ({ ref: d.ref, totalMinor: d.totalMinor, currency: d.currency, createdAt: d.createdAt, transferRef: d.claim?.transferRef })), cur);
    await this.log('statement.match', cur, `${lines.length} lines · ${result.matches.length} matches`);
    return { lines: lines.length, ...result };
  }

  /* ───────── Payables and budgets ───────── */
  async addPayable(body: unknown) {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    if (typeof b.idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{16,80}$/.test(b.idempotencyKey)) fail('INVALID_IDEMPOTENCY_KEY', 'مطلوب معرف ثابت لمنع التكرار.');
    const category = b.category as ExpenseCategory;
    if (!EXPENSE_CATEGORIES.includes(category)) fail('INVALID_CATEGORY', 'اختر بند المصروف.');
    const currency = String(b.currency || '').toUpperCase();
    let amountMinor: number;
    try { amountMinor = toMinor(b.amount, currency); } catch { return fail('INVALID_AMOUNT', 'اكتب مبلغاً صحيحاً بعملة صحيحة.'); }
    if (amountMinor <= 0) fail('INVALID_AMOUNT', 'المبلغ لازم يكون أكبر من صفر.');
    const dueDate = String(b.dueDate || '');
    if (!/^\d{4}-\d\d-\d\d$/.test(dueDate) || !Number.isFinite(Date.parse(`${dueDate}T00:00:00Z`))) fail('INVALID_DATE', 'اكتب تاريخ الاستحقاق.');
    const orderRef = typeof b.orderRef === 'string' ? b.orderRef.trim() : '';
    if (orderRef && !await this.store.get('financeEntries', financeId('sale', 'live', orderRef))) fail('PAID_ORDER_REQUIRED', 'اربط الفاتورة بطلب مدفوع فعلاً أو اتركها عامة.');
    const id = financeId('payable', b.idempotencyKey as string).slice(0, 32);
    const item: Payable = { id, party: cleanText(b.party, 2, 80, 'اسم الجهة'), category, currency, amountMinor, dueDate, note: b.note ? cleanText(b.note, 0, 240, 'الملاحظة') : '',
      status: 'open', createdAt: this.at(), ...(orderRef ? { orderRef } : {}) };
    if (!await this.store.create('bankPayables', id, item)) return (await this.store.get('bankPayables', id))!;
    await this.log('payable.create', id, `${category} ${currency}`);
    return item;
  }
  /** Records that the owner paid a bill (from his own bank). Posts the cost/expense entry; moves no money. */
  async payPayable(id: string) {
    const item = await this.store.get('bankPayables', String(id));
    if (!item) return fail('NOT_FOUND', 'الفاتورة غير موجودة.', 404);
    if (item.status !== 'open') return item;
    const entry = await this.finance.addEntry({ idempotencyKey: `payable_${item.id}`, kind: item.orderRef ? 'cost' : 'expense', category: item.category, amount: majorText(item.amountMinor, item.currency),
      currency: item.currency, orderRef: item.orderRef || '', at: this.at(), reason: `سداد مستحق: ${item.party}` });
    const next: Payable = { ...item, status: 'paid', settledAt: this.at(), entryId: entry.id };
    await this.store.put('bankPayables', item.id, next);
    await this.log('payable.paid', item.id);
    return next;
  }
  async cancelPayable(id: string) {
    const item = await this.store.get('bankPayables', String(id));
    if (!item) return fail('NOT_FOUND', 'الفاتورة غير موجودة.', 404);
    if (item.status !== 'open') fail('INVALID_STATE', 'لا يمكن إلغاء فاتورة مسددة؛ سجّل قيداً عكسياً.', 409);
    const next: Payable = { ...item, status: 'cancelled', settledAt: this.at() };
    await this.store.put('bankPayables', item.id, next);
    await this.log('payable.cancel', item.id);
    return next;
  }
  async setBudget(body: unknown) {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const category = b.category as ExpenseCategory;
    if (!EXPENSE_CATEGORIES.includes(category)) fail('INVALID_CATEGORY', 'اختر بند المصروف.');
    const currency = String(b.currency || '').toUpperCase();
    let monthlyMinor: number;
    try { monthlyMinor = toMinor(b.amount, currency); } catch { return fail('INVALID_AMOUNT', 'اكتب الميزانية الشهرية بالأرقام (صفر للإلغاء).'); }
    const item = { id: `${category}:${currency}`, category, currency, monthlyMinor, updatedAt: this.at() };
    await this.store.put('bankBudgets', item.id, item);
    await this.log('budget.set', item.id);
    return item;
  }

  /* ───────── Supervision (runs inside «أمين شاهين»'s audit) ───────── */
  private async audit(flag: Parameters<FinanceService['checks'][number]>[0]) {
    const [accounts, direct, payables, budgets, entries] = await Promise.all([this.accounts(), this.store.list('bankDirect'), this.store.list('bankPayables'), this.store.list('bankBudgets'), this.store.list('financeEntries')]);
    for (const d of direct) await this.expireOne(d);
    await flag('BANK_LEDGER_TEMPORARY', accounts.some((a) => a.active) && !this.finance.persistent, 'بنك شام متوقف: لا توجد قاعدة بيانات دائمة', 'أضف قاعدة البيانات المجانية من فيرسال (Storage → Neon). بدونها لا نعرض وسائل الدفع المباشر حتى لا يضيع أي طلب.', 'critical');
    await flag('DIRECT_WAITING', direct.some((d) => d.state === 'claimed' && this.now() - Date.parse(d.claim!.submittedAt) > DAY), 'تحويلات منتظرة أكثر من يوم', 'راجع حسابك البنكي وأكّد أو ارفض البلاغات المعلقة في «بنك شام».', 'critical');
    await flag('PAYABLE_OVERDUE', payables.some((p) => p.status === 'open' && Date.parse(`${p.dueDate}T23:59:59Z`) < this.now()), 'فواتير متأخرة السداد', 'راجع تبويب المستحقات: سدّد أو عدّل التاريخ أو ألغِ الفاتورة.');
    const month = this.finance.period('monthly');
    for (const use of budgetUsage(budgets, entries, month.from, month.to)) {
      await flag(`BUDGET_${use.state === 'over' ? 'OVER' : 'WARN'}_${use.category}_${use.currency}`, use.state === 'over' || use.state === 'warning',
        use.state === 'over' ? `تجاوز ميزانية ${use.category}` : `اقتراب من ميزانية ${use.category}`, `المصروف ${use.percent}% من الميزانية الشهرية. راجع المصروفات قبل أي صرف جديد.`, use.state === 'over' ? 'critical' : 'warning');
    }
  }

  /* ───────── Dashboard & accountant ───────── */
  private figures(report: Awaited<ReturnType<FinanceService['report']>>): CurrencyFigures[] {
    return report.currencies.map((c) => ({ currency: c.currency, collectedMinor: c.collectedMinor, refundsMinor: c.refundsMinor + c.chargebacksMinor, expensesMinor: c.expensesMinor,
      recordedResultMinor: c.recordedResultMinor, netProfitMinor: c.netProfitMinor, paidOrders: c.paidOrders }));
  }
  async snapshot(): Promise<AccountantSnapshot & { raw: { direct: DirectPayment[]; payables: Payable[]; accounts: CollectionAccount[]; entries: FinanceEntry[] } }> {
    const [today, month, orders, entries, direct, payables, budgets, accounts] = await Promise.all([
      this.finance.report(this.finance.period('daily')), this.finance.report(this.finance.period('monthly')), this.store.list('financeOrders'), this.store.list('financeEntries'),
      this.store.list('bankDirect'), this.store.list('bankPayables'), this.store.list('bankBudgets'), this.accounts(),
    ]);
    const m = this.finance.period('monthly');
    return { today: this.figures(today), month: this.figures(month), products: productPerformance(orders, entries), countries: countryPerformance(orders, entries),
      budgets: budgetUsage(budgets, entries, m.from, m.to), ageing: payablesAgeing(payables, this.now()), forecast: cashForecast(entries, payables, this.now()),
      waitingConfirmation: direct.filter((d) => d.state === 'claimed').length, awaitingTransfer: direct.filter((d) => d.state === 'awaiting_payment').length,
      raw: { direct, payables, accounts, entries } };
  }
  async ask(question: unknown) {
    const q = cleanText(question, 2, 300, 'السؤال');
    const { raw: _raw, ...snapshot } = await this.snapshot();
    return answerFinance(q, snapshot);
  }
  async dashboard(fx?: FxTable) {
    const { raw, ...snapshot } = await this.snapshot();
    const audit = (await this.store.list('bankAudit')).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50);
    const order = (d: DirectPayment) => ['claimed', 'awaiting_payment', 'expired', 'paid', 'rejected'].indexOf(d.state);
    const direct = raw.direct.sort((a, b) => order(a) - order(b) || b.createdAt.localeCompare(a.createdAt)).slice(0, 100)
      .map(({ tokenHash: _t, contactHash: _c, ...rest }) => rest);
    const monthTotals = snapshot.month.map((c) => ({ currency: c.currency, minor: c.collectedMinor }));
    return { persistent: this.finance.persistent, storage: this.store.kind, ...snapshot, direct,
      accounts: raw.accounts, balances: accountBalances(raw.accounts, raw.entries),
      payables: raw.payables.sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open') || a.dueDate.localeCompare(b.dueDate)).slice(0, 100),
      estimateEGP: fx && monthTotals.length > 1 ? { ...convertEstimate(monthTotals, 'EGP', fx), rateDate: fx.updatedAt || '' } : null,
      audit, categories: EXPENSE_CATEGORIES, kinds: COLLECTION_KINDS };
  }
}
export type BankDashboard = Awaited<ReturnType<BankService['dashboard']>>;
export type PublicDirectView = Awaited<ReturnType<BankService['publicView']>>;
