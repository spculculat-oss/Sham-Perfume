/** «أمين شاهين» — deterministic finance agent. Models may advise; they never calculate/post money.
 * The append-only ledger is authoritative. No automatic refund, payout, FX conversion or credentials edit.
 */
import { randomUUID } from 'node:crypto';
import { toMinor } from '../../src/finance/money';
import { PAYMENT_CATALOG, PAYMENT_COUNTRIES, PAYMENT_RESEARCHED_AT, PAYMENT_SOURCES, countryResearch } from '../../src/finance/paymentCatalog';
import { kashierConfig, sessionPayment, type SessionPayment } from '../core/kashier';
import { createNotifier } from '../core/notify';
import { ValidationError } from '../core/repository';
import type { Store } from '../core/store';
import { availableMethods, emptyRegistration, paymentReadiness, providerConfiguration, readRegistration } from './payments';
import { financePeriod, localDate } from './periods';
import { COST_KINDS, financeId, makeReport, paymentPerformance } from './report';
import type { EntryKind, FinanceAttempt, FinanceEntry, FinanceIssue, FinanceOrder, FinancePeriod, FinanceReport, FinanceRun, Mode, PeriodKind } from './types';

type Env = Record<string, string | undefined>;
const error = (code: string, message: string, status = 400): never => { throw new ValidationError(code, message, status); };
const cleanReason = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim().length < 3 || value.length > 240 || /\d{13,}|sk_(live|test)_|-----BEGIN|\bBearer\s|password\s*[:=]|secret\s*[:=]/i.test(value)) return error('INVALID_REASON', 'اكتب سبباً محاسبياً قصيراً بدون مفاتيح أو أرقام بطاقات أو بيانات شخصية.');
  return value.trim().replace(/[\u0000-\u001f]/g, ' ');
};
const SAFE_CODES = new Set(['OK', 'UNREACHABLE', 'INVALID_KEYS', 'REJECTED', 'NOT_FOUND', 'FAILED', 'INVALID_RESPONSE', 'PAYMENT_MISMATCH', 'UNTRACKED_PAYMENT', 'REFUND_REVIEW']);
export class FinanceService {
  readonly timeZone: string;
  /** Fulfilment hook used by both callbacks and scheduled reconciliation, only after real collection. */
  onPaid?: (ref: string) => Promise<void>;
  private clock: () => number;
  private fetch: typeof fetch;
  private running?: Promise<{ run: FinanceRun; reports: FinanceReport[] }>;
  constructor(readonly store: Store, readonly env: Env = process.env, options: { now?: () => number; fetch?: typeof fetch } = {}) {
    this.clock = options.now || Date.now; this.fetch = options.fetch || fetch;
    this.timeZone = env.SHAM_FINANCE_TIMEZONE?.trim() || 'Africa/Cairo';
    financePeriod('daily', this.clock(), this.timeZone); // fail on an invalid zone, not silently wrong dates
  }
  /** An explicitly selected file adapter is still ephemeral on serverless platforms. */
  get persistent() { return this.store.persistent && !(this.store.kind === 'file' && (this.env.VERCEL || this.env.SHAM_SERVERLESS)); }
  private at() { return new Date(this.clock()).toISOString(); }
  async registration() { return await this.store.get('paymentRegistrations', 'kashier') || emptyRegistration(); }
  async saveRegistration(body: unknown) {
    const value = readRegistration(body, this.clock());
    await this.store.put('paymentRegistrations', 'kashier', value);
    return value;
  }
  async methods(country: string, currency: string) { return availableMethods(country, currency, this.env, await this.registration(), this.persistent, this.clock()); }
  async recordOrder(input: Omit<FinanceOrder, 'id' | 'createdAt'>) {
    if (input.mode === 'live' && !this.persistent) return error('FINANCE_STORAGE_REQUIRED', 'الدفع الحي متوقف حتى تفعيل السجل المالي الدائم.', 503);
    if (!Number.isSafeInteger(input.totalMinor) || input.totalMinor <= 0 || !Number.isSafeInteger(input.shippingChargedMinor) || input.shippingChargedMinor < 0 ||
      input.lines.some((l) => !Number.isSafeInteger(l.unitMinor) || l.unitMinor < 0 || !Number.isInteger(l.qty) || l.qty < 1) ||
      input.lines.reduce((s, l) => s + l.unitMinor * l.qty, input.shippingChargedMinor) !== input.totalMinor) return error('INVALID_ORDER_TOTAL', 'إجمالي الطلب لا يطابق بنوده.');
    const id = financeId('order', input.mode, input.ref);
    const created = await this.store.create('financeOrders', id, { ...input, id, createdAt: this.at() });
    if (!created) return error('DUPLICATE_ORDER', 'مرجع الطلب موجود بالفعل.', 409);
  }
  async recordSession(ref: string, mode: Mode, sessionId: string) {
    const id = financeId('session', mode, ref);
    if (!await this.store.get('financeOrders', financeId('order', mode, ref))) return error('UNTRACKED_PAYMENT', 'لا يوجد طلب مالي مطابق.', 409);
    if (!await this.store.create('financeSessions', id, { id, ref, mode, sessionId, at: this.at() })) {
      const previous = await this.store.get('financeSessions', id);
      if (previous?.sessionId !== sessionId) return error('SESSION_CONFLICT', 'لا يمكن استبدال جلسة الدفع.', 409);
    }
  }
  async sessionFor(ref: string, mode: Mode) { return this.store.get('financeSessions', financeId('session', mode, ref)); }
  async observation(mode: Mode, phase: FinanceAttempt['phase'], ok: boolean, ms: number, code = 'OK') {
    const id = randomUUID();
    await this.store.create('financeAttempts', id, { id, provider: 'kashier', mode, phase, ok, ms: Math.max(0, Math.round(ms)), code: SAFE_CODES.has(code) ? code : 'FAILED', at: this.at() });
  }
  async issue(code: string, title: string, action: string, severity: FinanceIssue['severity'] = 'warning', ref?: string, automatic = false) {
    const id = financeId('issue', code, ref || '');
    const previous = await this.store.get('financeIssues', id);
    if (previous && !previous.resolvedAt) return previous;
    const item: FinanceIssue = { id, code, title, action, severity, owner: 'shaheen', openedAt: this.at(), automatic, ...(ref ? { ref } : {}) };
    if (previous) await this.store.put('financeIssues', id, item); else await this.store.create('financeIssues', id, item);
    return item;
  }
  async acknowledge(id: string) {
    const item = await this.store.get('financeIssues', id);
    if (!item) return error('NOT_FOUND', 'الملاحظة غير موجودة.', 404);
    await this.store.put('financeIssues', id, { ...item, acknowledgedAt: this.at() });
  }
  async validatePayment(payment: SessionPayment, mode: Mode, sessionId?: string): Promise<FinanceOrder> {
    const order = await this.store.get('financeOrders', financeId('order', mode, payment.order));
    if (!order) {
      await this.issue('UNTRACKED_PAYMENT', 'تحصيل بلا طلب في السجل المالي', 'طابق المرجع مع كشف البوابة. لا نضيف إيراداً أو نسلّم طلباً بلا سجل موثق.', 'critical', payment.order.slice(0, 80));
      return error('UNTRACKED_PAYMENT', 'الطلب غير مسجل للمطابقة.', 409);
    }
    let minor: number | undefined;
    try { minor = toMinor(payment.amount, payment.currency); } catch { /* mismatch */ }
    const session = sessionId ? await this.sessionFor(payment.order, mode) : undefined;
    if (minor !== order.totalMinor || payment.currency !== order.currency || (sessionId && session?.sessionId !== sessionId)) {
      await this.issue('PAYMENT_MISMATCH', 'اختلاف مبلغ أو عملة أو جلسة الدفع', 'شاهين: راجع الطلب وكشف البوابة قبل التسليم. النظام أوقف تأكيد الدفع غير المطابق.', 'critical', order.ref);
      return error('PAYMENT_MISMATCH', 'بيانات التحصيل لا تطابق الطلب.', 409);
    }
    return order;
  }
  async confirmPayment(payment: SessionPayment, mode: Mode, sessionId?: string) {
    const order = await this.validatePayment(payment, mode, sessionId);
    if (/REFUND|CHARGEBACK/i.test(payment.status)) {
      await this.issue('REFUND_REVIEW', 'استرداد أو اعتراض يحتاج قيداً محاسبياً', 'راجع كشف البوابة وسجل الاسترداد الفعلي من لوحة المالية. تغيير حالة الطلب وحده لا يثبت رد المال.', 'critical', order.ref);
    }
    const session = await this.sessionFor(payment.order, mode);
    if (session) await this.store.put('financeSessions', session.id, { ...session, state: payment.state, checkedAt: this.at() });
    if (payment.state !== 'paid') return false;
    if (mode === 'live' && !this.persistent) return error('FINANCE_STORAGE_REQUIRED', 'لا يمكن تأكيد الدفع بدون سجل دائم.', 503);
    const id = financeId('sale', mode, order.ref);
    // One sale per order; all gateway paths converge on this atomic key. Receipt time is explicit:
    // when no authenticated provider timestamp is available, the ledger uses first verified receipt.
    const created = await this.store.create('financeEntries', id, { id, kind: 'sale', mode, currency: order.currency, amountMinor: order.totalMinor,
      orderRef: order.ref, at: this.at(), recordedAt: this.at(), source: 'gateway' });
    const issueId = financeId('issue', 'PAYMENT_MISMATCH', order.ref);
    const mismatch = await this.store.get('financeIssues', issueId);
    if (mismatch && !mismatch.resolvedAt) await this.store.put('financeIssues', issueId, { ...mismatch, resolvedAt: this.at() });
    if (mode === 'live') {
      try { await this.onPaid?.(order.ref); } catch { await this.issue('PAID_SYNC_FAILED', 'التحصيل محفوظ والتسليم يحتاج متابعة', 'طابق الطلب المحصل مع نظام التجار؛ لا تعاود خصم المبلغ.', 'critical', order.ref); }
    }
    return created;
  }
  /** Manual bookkeeping only. Cannot mark an order paid or initiate a refund/payout. */
  async addEntry(body: unknown) {
    const b = body as Record<string, unknown> | null;
    if (!b || typeof b.idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{16,80}$/.test(b.idempotencyKey)) return error('INVALID_IDEMPOTENCY_KEY', 'مطلوب معرف ثابت لمنع تكرار القيد.');
    const kind = b.kind as EntryKind;
    if (!['refund', 'chargeback', 'cost', 'shipping', 'fee', 'tax', 'expense'].includes(kind)) return error('INVALID_ENTRY_KIND', 'لا يمكن إنشاء تحصيل يدوي أو تغيير حالة الدفع.');
    const currency = String(b.currency || '');
    let amountMinor: number;
    try { amountMinor = toMinor(b.amount, currency); } catch { return error('INVALID_AMOUNT', 'اكتب مبلغاً صالحاً بدقة العملة بدون تقريب.'); }
    if (['refund', 'chargeback', 'expense'].includes(kind) && amountMinor === 0) return error('INVALID_AMOUNT', 'هذا القيد يحتاج مبلغاً أكبر من صفر.');
    const reason = cleanReason(b.reason);
    const validAt = typeof b.at === 'string' && Number.isFinite(Date.parse(b.at)) && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(b.at);
    const at = validAt ? new Date(b.at as string).toISOString() : '';
    if (!at || at.replace('.000Z', 'Z') !== String(b.at).replace('.000Z', 'Z') || Date.parse(at) > this.clock()) return error('INVALID_DATE', 'مطلوب تاريخ UTC صحيح، لا يتجاوز الوقت الحالي.');
    const orderRef = typeof b.orderRef === 'string' ? b.orderRef.trim() : '';
    const mode: Mode = 'live';
    if (kind !== 'expense') {
      const sale = await this.store.get('financeEntries', financeId('sale', mode, orderRef));
      if (!sale || sale.currency !== currency) return error('PAID_ORDER_REQUIRED', 'اختر طلباً محصّلاً فعلاً وبنفس العملة.');
      if (['refund', 'chargeback'].includes(kind) && amountMinor > sale.amountMinor) return error('AMOUNT_EXCEEDS_PAYMENT', 'المبلغ أكبر من تحصيل الطلب.');
    } else if (orderRef) return error('INVALID_EXPENSE', 'المصروف العام لا يرتبط بطلب؛ استخدم تكلفة أو رسوم للطلب.');
    const id = financeId('manual', b.idempotencyKey);
    const entry: FinanceEntry = { id, kind, currency, amountMinor, mode, source: 'admin', at, recordedAt: this.at(), reason, ...(orderRef ? { orderRef } : {}) };
    if (!await this.store.create('financeEntries', id, entry)) {
      const old = await this.store.get('financeEntries', id);
      if (JSON.stringify({ ...old, recordedAt: '' }) !== JSON.stringify({ ...entry, recordedAt: '' })) return error('IDEMPOTENCY_CONFLICT', 'معرف القيد مستخدم لبيانات مختلفة.', 409);
      return old!;
    }
    return entry;
  }
  /** Corrections are reversing entries, never deletions. A second reversal cannot double the correction. */
  async reverseEntry(id: string, reason: unknown) {
    const original = await this.store.get('financeEntries', id);
    if (!original || original.kind === 'sale' || original.source !== 'admin' || original.reverses) return error('INVALID_REVERSAL', 'يمكن عكس قيد يدوي فقط؛ لا يمكن محو التحصيل.');
    const reversal: FinanceEntry = { ...original, id: financeId('reversal', id), amountMinor: -original.amountMinor, recordedAt: this.at(), reason: cleanReason(reason), reverses: id };
    await this.store.create('financeEntries', reversal.id, reversal);
    return reversal;
  }
  period(kind: PeriodKind = 'daily', offset = 0) { return financePeriod(kind, this.clock(), this.timeZone, offset); }
  async report(period: FinancePeriod) {
    const [entries, reviews] = await Promise.all([this.store.list('financeEntries'), this.store.list('financeReviews')]);
    return makeReport(period, entries, reviews, this.clock(), this.persistent);
  }
  async reviewExpenses(kind: PeriodKind, offset: number, fingerprint: unknown) {
    const report = await this.report(this.period(kind, offset));
    if (!report.period.closed || report.fingerprint !== fingerprint) return error('STALE_REPORT', 'المراجعة لفترة مغلقة وبنفس بيانات التقرير فقط؛ حدّث الصفحة.', 409);
    if (!this.persistent) return error('FINANCE_STORAGE_REQUIRED', 'المراجعة تحتاج تخزيناً دائماً.', 503);
    const id = financeId('review', report.period.id, report.fingerprint);
    await this.store.create('financeReviews', id, { id, periodId: report.period.id, fingerprint: report.fingerprint, at: this.at() });
  }
  /** Read-only reconciliation recovers a lost return/webhook. Never creates a charge or retries payment. */
  async reconcile() {
    const cfg = kashierConfig(this.env); if (!cfg) return;
    const [sessions, entries] = await Promise.all([this.store.list('financeSessions'), this.store.list('financeEntries')]);
    const pending = sessions.filter((s) => s.mode === cfg.mode && s.state !== 'failed' && !entries.some((e) => e.orderRef === s.ref && e.mode === s.mode && e.kind === 'sale'))
      .sort((a, b) => (a.checkedAt || a.at).localeCompare(b.checkedAt || b.at)).slice(0, 20);
    // Small bounded batches; keep the scheduled HTTP call within serverless execution limits.
    for (let i = 0; i < pending.length; i += 5) await Promise.all(pending.slice(i, i + 5).map(async (s) => {
      const started = Date.now();
      // Rotate through the backlog even when a provider request fails; never starve older sessions.
      await this.store.put('financeSessions', s.id, { ...s, checkedAt: this.at() });
      try { const payment = await sessionPayment(cfg, s.sessionId, this.fetch); await this.confirmPayment(payment, cfg.mode, s.sessionId); await this.observation(cfg.mode, 'verify', true, Date.now() - started); }
      catch (e) { await this.observation(cfg.mode, 'verify', false, Date.now() - started, e instanceof ValidationError ? e.code : 'FAILED'); }
    }));
  }
  async inspect() {
    const [registration, entries, attempts, sessions, orders, allIssues] = await Promise.all([this.registration(), this.store.list('financeEntries'), this.store.list('financeAttempts'), this.store.list('financeSessions'), this.store.list('financeOrders'), this.store.list('financeIssues')]);
    const ready = paymentReadiness(this.env, registration, this.persistent, this.clock());
    const active = new Set<string>();
    const flag = async (code: string, condition: boolean, title: string, action: string, severity: FinanceIssue['severity'] = 'warning') => {
      if (!condition) return;
      const item = await this.issue(code, title, action, severity, undefined, true); active.add(item.id);
    };
    for (const c of ready.checks) await flag(`CONFIG_${c.code}`, !c.ok, 'بيانات الدفع تحتاج مراجعة شاهين', c.message, ['DURABLE_LEDGER', 'WEBHOOK_URL'].includes(c.code) ? 'critical' : 'warning');
    await flag('TEST_MODE', ready.mode === 'test', 'الدفع في وضع تجريبي وليس تحصيلاً حقيقياً', 'بعد اعتماد الحساب، استخدم مفاتيح الوضع الحي. لا تبدّل مفاتيح أو حساب تسوية تلقائياً.');
    const live = entries.filter((e) => e.mode === 'live');
    const reversed = new Set(live.flatMap((e) => e.reverses ? [e.id, e.reverses] : []));
    const sales = live.filter((e) => e.kind === 'sale');
    const missing = sales.filter((s) => COST_KINDS.some((k) => !live.some((e) => e.orderRef === s.orderRef && e.kind === k && !reversed.has(e.id))));
    await flag('MISSING_COSTS', missing.length > 0, 'تكاليف ناقصة تمنع حساب صافي الربح', 'سجل التكلفة الفعلية والشحن والرسوم والضريبة لكل طلب. أدخل صفراً مؤكداً إن كان البند غير منطبق.');
    const overRefunds = sales.some((s) => live.filter((e) => e.orderRef === s.orderRef && ['refund', 'chargeback'].includes(e.kind)).reduce((n, e) => n + e.amountMinor, 0) > s.amountMinor);
    await flag('OVER_REFUND', overRefunds, 'استردادات واعتراضات تتجاوز التحصيل', 'طابق كشف البوابة واعكس القيد المكرر مع سبب واضح؛ لا نعيد إرسال أي مبلغ تلقائياً.', 'critical');
    const performance = paymentPerformance(this.period('daily'), attempts, sessions, entries, orders);
    await flag('GATEWAY_FAILURES', performance.sufficientSample && (performance.failureRate || 0) >= 20, 'ارتفاع فشل طلبات بوابة الدفع', 'راجع أخطاء الاتصال والمفاتيح والوضع في سجل المحاولات. لا تعاود الخصم أو تبدّل البوابة تلقائياً.', 'critical');
    await flag('GATEWAY_SLOW', performance.sufficientSample && (performance.p95Ms || 0) > 8000, 'بطء بوابة الدفع', 'راجع زمن الشبكة وتقارير البوابة؛ القياس لطلبات API وليس ضماناً لوقت إكمال العميل.');
    await flag('STALE_PENDING', sessions.some((s) => s.mode === 'live' && s.state !== 'failed' && this.clock() - Date.parse(s.at) > 86400_000 && !sales.some((e) => e.orderRef === s.ref)), 'جلسات معلقة لأكثر من يوم', 'شغّل المطابقة واقرأ حالة الجلسة من البوابة؛ لا تعتبر الطلب مدفوعاً أو ملغياً بالتخمين.');
    await flag('PAYMENT_RESEARCH_STALE', this.clock() - Date.parse(PAYMENT_RESEARCHED_AT) > 90 * 86400_000, 'مراجعة مصادر وسائل الدفع قديمة', 'راجع المصادر الرسمية وحدّث تاريخ البحث بعد مراجعة المحتوى فعلياً، وليس لمجرد نجاح فتح الرابط.');
    for (const item of allIssues) if (item.automatic && !item.resolvedAt && !active.has(item.id)) await this.store.put('financeIssues', item.id, { ...item, resolvedAt: this.at() });
    return { readiness: ready, performance };
  }
  async run(trigger: FinanceRun['trigger'] = 'admin') {
    if (this.running) return this.running;
    this.running = (async () => {
      await this.reconcile(); await this.inspect();
      const reports: FinanceReport[] = [];
      const [entries, reviews, runs] = await Promise.all([this.store.list('financeEntries'), this.store.list('financeReviews'), this.store.list('financeRuns')]);
      const previous = runs.sort((a, b) => b.at.localeCompare(a.at))[0];
      const day = (at: number) => Date.parse(`${localDate(at, this.timeZone)}T00:00:00Z`);
      const catchUpDays = previous ? Math.max(1, Math.min(31, Math.round((day(this.clock()) - day(Date.parse(previous.at))) / 86400_000))) : 1;
      const periods = Array.from({ length: catchUpDays }, (_, i) => this.period('daily', -i - 1));
      periods.push(this.period('weekly', -1), this.period('monthly', -1));
      for (const period of periods) {
        const report = makeReport(period, entries, reviews, this.clock(), this.persistent);
        await this.store.create('financeReports', report.id, report); reports.push(report);
      }
      const issues = (await this.store.list('financeIssues')).filter((i) => !i.resolvedAt);
      const fresh = issues.filter((i) => !i.notifiedAt);
      const notifier = createNotifier(this.env, this.fetch);
      if (fresh.length && notifier.configured) {
        const delivered = await notifier.send('finance.alert', `أمين شاهين: ${fresh.length} ملاحظة مالية تحتاج مراجعة في لوحة الإدارة.`, { owner: 'shaheen', codes: [...new Set(fresh.map((i) => i.code))] });
        if (delivered) for (const i of fresh) await this.store.put('financeIssues', i.id, { ...i, notifiedAt: this.at() });
      }
      const run: FinanceRun = { id: randomUUID(), at: this.at(), trigger, reportIds: reports.map((r) => r.id), openIssues: issues.length, newIssues: fresh.length };
      await this.store.create('financeRuns', run.id, run);
      return { run, reports };
    })().finally(() => { this.running = undefined; });
    return this.running;
  }
  /** Redacted status for Shaheen/council. No sums, order references, notes, contacts or credentials. */
  async status() {
    const [runs, issues] = await Promise.all([this.store.list('financeRuns'), this.store.list('financeIssues')]);
    const last = runs.sort((a, b) => b.at.localeCompare(a.at))[0]; const open = issues.filter((i) => !i.resolvedAt);
    return { owner: 'shaheen', engine: 'local-rules', persistent: this.persistent, lastRunAt: last?.at || null,
      overdue: !last || this.clock() - Date.parse(last.at) > 36 * 3600_000, openIssues: open.length, criticalIssues: open.filter((i) => i.severity === 'critical').length };
  }
  async dashboard(kind: PeriodKind, offset: number, country: string) {
    const period = this.period(kind, offset);
    const [report, entries, orders, sessions, attempts, issues, registration, runs, reports] = await Promise.all([
      this.report(period), this.store.list('financeEntries'), this.store.list('financeOrders'), this.store.list('financeSessions'), this.store.list('financeAttempts'), this.store.list('financeIssues'),
      this.registration(), this.store.list('financeRuns'), this.store.list('financeReports'),
    ]);
    return { report, storage: { kind: this.store.kind, persistent: this.persistent }, timeZone: this.timeZone,
      readiness: paymentReadiness(this.env, registration, this.persistent, this.clock()), registration, providers: providerConfiguration(this.env),
      performance: paymentPerformance(period, attempts, sessions, entries, orders),
      issues: issues.filter((i) => !i.resolvedAt).sort((a, b) => Number(b.severity === 'critical') - Number(a.severity === 'critical')),
      entries: entries.filter((e) => e.mode === 'live').sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).slice(0, 100),
      orders: orders.filter((o) => o.mode === 'live').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100).map((o) => ({ ...o, paid: entries.some((e) => e.mode === 'live' && e.kind === 'sale' && e.orderRef === o.ref) })),
      runs: runs.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10),
      reports: reports.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)).slice(0, 30),
      catalog: { researchedAt: PAYMENT_RESEARCHED_AT, total: PAYMENT_CATALOG.length, countryCount: PAYMENT_COUNTRIES.length, ...countryResearch(country), sources: PAYMENT_SOURCES },
    };
  }
}
export type FinanceDashboard = Awaited<ReturnType<FinanceService['dashboard']>>;
