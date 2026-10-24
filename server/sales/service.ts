/**
 * «إدارة المبيعات» — the sales desk inside «بنك شام», supervised by «مدير المبيعات».
 *
 * It reads the confirmed figures from «أمين شاهين»/«بنك شام» (never the gateway, never a reservation as
 * revenue), keeps the owner's opportunities, monthly targets and study record, builds the daily rhythm and
 * answers his questions from the same numbers. It never confirms a payment, never moves money, never sends a
 * message, never promises a discount and never stores a customer's contact details: a deal is a short label.
 */
import { randomUUID } from 'node:crypto';
import { decimals, major, toMinor } from '../../src/finance/money';
import { cleanText } from '../finance/bank';
import { financeId } from '../finance/report';
import { ValidationError } from '../core/repository';
import type { FinanceService } from '../finance/service';
import type { BankService } from '../finance/bank';
import { HANDBOOK_EDITION } from '../../src/utils/botHandbook';
import {
  DEAL_SOURCES, DEAL_STAGES, STAGE_PROBABILITY, dayKey, monthKey, moveDeal as moveDealRecord, summarizePipeline, type Deal, type DealMove, type DealSource, type DealStage,
} from '../../src/sales/pipeline';
import { daysInMonth, paceTargets, salesHealth, type CollectedRow, type SalesTarget } from '../../src/sales/targets';
import { dailyRhythm } from '../../src/sales/rhythm';
import { answerSales, type SalesSnapshot } from '../../src/sales/advisor';
import { gradeStudy, lessonById, lessonOfDay, studyPlan, studyProgress, type StudyResult } from '../../src/sales/playbook';

type Env = Record<string, string | undefined>;
const fail = (code: string, message: string, status = 400): never => { throw new ValidationError(code, message, status); };
const EMAIL = /[\w.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/;
const PHONE_SHAPED = /(?:\+?\d[\s-]?){8,}/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SOURCES = new Set<string>(DEAL_SOURCES);
const STAGES = new Set<string>(DEAL_STAGES);

/** A label the owner recognises — never a phone, e-mail or address. */
function freeText(value: unknown, min: number, max: number, field: string): string {
  const text = cleanText(value, min, max, field);
  if (EMAIL.test(text) || PHONE_SHAPED.test(text)) fail('PERSONAL_DATA', `بيانات التواصل مكانها حساب العميل وطلبه — اكتب في ${field} اسماً أو وصفاً مختصراً.`);
  return text;
}

export interface SalesAudit { id: string; at: string; action: string; target: string; detail?: string }

export interface SalesDashboardStudy { todayId: string; progress: ReturnType<typeof studyProgress>; results: StudyResult[] }

export class SalesService {
  constructor(readonly finance: FinanceService, readonly bank: BankService, readonly env: Env = finance.env) {
    finance.checks.push((flag) => this.audit(flag));
  }
  get store() { return this.finance.store; }
  private now() { return this.finance.now(); }
  private at() { return new Date(this.now()).toISOString(); }
  private get timeZone() { return this.finance.timeZone; }
  private async log(action: string, target: string, detail?: string) {
    const item: SalesAudit = { id: `${this.at()}_${randomUUID().slice(0, 8)}`, at: this.at(), action, target: target.slice(0, 80), ...(detail ? { detail: detail.slice(0, 160) } : {}) };
    await this.store.create('salesAudit', item.id, item);
  }

  /* ───────── Opportunities ───────── */
  /** The deal form: labels only, no contact data — and «اتقفلت ببيع» needs a real paid order in «بنك شام». */
  async readDeal(body: unknown, previous?: Deal): Promise<Deal> {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const stage = (b.stage ?? previous?.stage ?? 'lead') as DealStage;
    if (!STAGES.has(stage)) fail('INVALID_STAGE', 'اختر مرحلة صحيحة من مراحل خط الأنابيب.');
    const source = (b.source ?? previous?.source ?? 'store') as DealSource;
    if (!SOURCES.has(source)) fail('INVALID_SOURCE', 'اختر مصدراً صحيحاً للفرصة.');
    const currency = String(b.currency ?? previous?.currency ?? 'EGP').trim().toUpperCase();
    try { decimals(currency); } catch { fail('INVALID_CURRENCY', 'اختر عملة صحيحة (مثل EGP).'); }
    let valueMinor: number;
    try { valueMinor = toMinor(b.value ?? (previous ? major(previous.valueMinor, currency) : undefined), currency); } catch { return fail('INVALID_AMOUNT', 'اكتب قيمة الفرصة بالأرقام بعملة صحيحة.'); }
    if (valueMinor <= 0) fail('INVALID_AMOUNT', 'قيمة الفرصة لازم تكون أكبر من صفر.');
    const probabilityRaw = b.probability ?? previous?.probability ?? STAGE_PROBABILITY[stage];
    const probability = Number(probabilityRaw);
    if (!Number.isFinite(probability) || probability < 0 || probability > 100) fail('INVALID_PROBABILITY', 'احتمالية القفل من ٠ إلى ١٠٠.');
    const nextActionAt = String(b.nextActionAt ?? previous?.nextActionAt ?? '').trim();
    if (nextActionAt && (!DATE.test(nextActionAt) || !Number.isFinite(Date.parse(`${nextActionAt}T00:00:00Z`)))) fail('INVALID_DATE', 'اكتب تاريخ المتابعة الجاية بصيغة سنة-شهر-يوم.');
    const items = Array.isArray(b.items) ? b.items.map((i) => String(i).trim()).filter(Boolean).slice(0, 8) : previous?.items ?? [];
    if (items.some((i) => i.length > 60)) fail('INVALID_ITEMS', 'اسم المنتج في الفرصة أطول من ٦٠ حرفاً.');
    const orderRef = String(b.orderRef ?? previous?.orderRef ?? '').trim();
    if (orderRef && !/^[\w.-]{3,80}$/.test(orderRef)) fail('INVALID_ORDER_REF', 'رقم الطلب/المرجع حروف وأرقام بس — من غير مسافات أو بيانات شخصية.');
    if (stage === 'won') await this.assertPaidOrder(orderRef);
    const at = this.at();
    return {
      id: previous?.id || `deal_${randomUUID().slice(0, 10)}`,
      title: freeText(b.title ?? previous?.title ?? '', 2, 80, 'اسم الفرصة'),
      accountLabel: freeText(b.accountLabel ?? previous?.accountLabel ?? '', 2, 60, 'وصف العميل'),
      currency, valueMinor, stage, probability: Math.round(probability), source, items, nextActionAt,
      nextActionAr: (() => { const text = String(b.nextActionAr ?? previous?.nextActionAr ?? '').trim(); return text ? freeText(text, 1, 120, 'الخطوة الجاية') : ''; })(),
      notes: b.notes === undefined ? previous?.notes ?? '' : freeText(b.notes, 0, 300, 'الملاحظات'),
      orderRef,
      createdAt: previous?.createdAt || at, updatedAt: at,
      ...(previous?.closedAt ? { closedAt: previous.closedAt } : {}),
      ...(previous?.lostReason ? { lostReason: previous.lostReason } : {}),
    };
  }
  async saveDeal(id: string | undefined, body: unknown) {
    const previous = id ? await this.store.get('salesDeals', id) : undefined;
    if (id && !previous) fail('NOT_FOUND', 'الفرصة غير موجودة.', 404);
    const deal = await this.readDeal(body, previous);
    if (previous) await this.store.put('salesDeals', deal.id, deal); else await this.store.create('salesDeals', deal.id, deal);
    await this.log(previous ? 'deal.update' : 'deal.create', deal.id, `${deal.stage} ${deal.currency}`);
    return deal;
  }
  async moveDeal(id: string, body: unknown) {
    const deal = await this.store.get('salesDeals', String(id));
    if (!deal) return fail('NOT_FOUND', 'الفرصة غير موجودة.', 404);
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const stage = b.stage as DealStage;
    if (!STAGES.has(stage)) fail('INVALID_STAGE', 'اختر مرحلة صحيحة.');
    const lostReason = String(b.lostReason ?? '').trim();
    if (stage === 'lost' && lostReason.length < 3) fail('LOST_REASON_REQUIRED', 'اكتب سبب الخسارة بصراحة — ده اللي بيعلّمك في المرة الجاية.');
    const nextActionAt = String(b.nextActionAt ?? '').trim();
    if (nextActionAt && !DATE.test(nextActionAt)) fail('INVALID_DATE', 'تاريخ المتابعة بصيغة سنة-شهر-يوم.');
    const orderRef = String(b.orderRef ?? deal.orderRef ?? '').trim();
    if (orderRef && !/^[\w.-]{3,80}$/.test(orderRef)) fail('INVALID_ORDER_REF', 'رقم الطلب/المرجع حروف وأرقام بس — من غير مسافات أو بيانات شخصية.');
    // «البيع مايتسجلش غير لما تشوف الفلوس»: won needs a paid order that really exists in the ledger.
    if (stage === 'won') await this.assertPaidOrder(orderRef);
    else if (orderRef) fail('ORDER_REF_NEEDS_WON', 'مرجع الطلب بيتسجل بس لما الفرصة تتحول لبيع مؤكد.');
    const move: DealMove = { stage, ...(nextActionAt ? { nextActionAt } : {}), ...(b.nextActionAr ? { nextActionAr: String(b.nextActionAr).trim().slice(0, 120) } : {}),
      ...(lostReason ? { lostReason: freeText(lostReason, 3, 200, 'سبب الخسارة') } : {}), ...(orderRef ? { orderRef } : {}) };
    if (b.probability !== undefined) { const p = Number(b.probability); if (!Number.isFinite(p) || p < 0 || p > 100) fail('INVALID_PROBABILITY', 'احتمالية القفل من ٠ إلى ١٠٠.'); move.probability = p; }
    const next = moveDealRecord(deal, move, this.now());
    await this.store.put('salesDeals', next.id, next);
    await this.log('deal.move', next.id, `${deal.stage} → ${next.stage}`);
    return next;
  }
  /** A win must point at a paid, confirmed order in «بنك شام» — no invented sales, no unconfirmed money. */
  private async assertPaidOrder(orderRef: string) {
    if (!orderRef) fail('PAID_ORDER_REQUIRED', 'البيع بيتسجل بعد ما تشوف الفلوس: أكّد التحصيل في بنك شام واكتب رقم الطلب/المرجع.');
    if (!await this.store.get('financeEntries', financeId('sale', 'live', orderRef))) {
      fail('PAID_ORDER_REQUIRED', 'الطلب مش متحصل ومؤكد في بنك شام، فمش ينفع نربطه كبيع. أكّد الدفع الأول.');
    }
  }
  async deleteDeal(id: string) {
    const deal = await this.store.get('salesDeals', String(id));
    if (!deal) return fail('NOT_FOUND', 'الفرصة غير موجودة.', 404);
    await this.store.delete('salesDeals', deal.id);
    await this.log('deal.delete', deal.id);
    return { ok: true };
  }

  /* ───────── Targets ───────── */
  async saveTarget(body: unknown) {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const month = String(b.month ?? '').trim() || monthKey(this.now(), this.timeZone);
    if (!/^\d{4}-\d{2}$/.test(month)) fail('INVALID_MONTH', 'الشهر بصيغة سنة-شهر.');
    daysInMonth(month);
    const currency = String(b.currency ?? 'EGP').trim().toUpperCase();
    try { decimals(currency); } catch { fail('INVALID_CURRENCY', 'اختر عملة صحيحة.'); }
    let amountMinor: number;
    try { amountMinor = toMinor(b.amount, currency); } catch { return fail('INVALID_AMOUNT', 'اكتب الهدف الشهري بالأرقام (صفر للإلغاء).'); }
    const previous = await this.store.get('salesTargets', `${month}:${currency}`);
    const item: SalesTarget = { id: `${month}:${currency}`, month, currency, amountMinor, updatedAt: this.at() };
    if (previous) await this.store.put('salesTargets', item.id, item); else await this.store.create('salesTargets', item.id, item);
    await this.log('target.set', item.id, `${currency} ${amountMinor}`);
    return item;
  }

  /* ───────── Study ───────── */
  async recordStudy(body: unknown) {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const lesson = lessonById(String(b.lessonId ?? ''));
    if (!lesson) throw new ValidationError('UNKNOWN_LESSON', 'الدرس مش موجود في المنهج.', 404);
    const choice = Number(b.choice);
    if (!Number.isInteger(choice) || choice < 0 || choice >= lesson.quiz.optionsAr.length) fail('INVALID_CHOICE', 'اختر إجابة من اللي ظاهرة.');
    const [result] = gradeStudy([{ lessonId: lesson.id, choice }], this.at());
    await this.store.create('salesStudy', `${result.at}_${lesson.id}_${randomUUID().slice(0, 6)}`, result);
    await this.log('study.answer', lesson.id, result.correct ? 'correct' : 'wrong');
    return result;
  }

  /* ───────── Reads ───────── */
  private async studyInfo() {
    const results = (await this.store.list('salesStudy')).sort((a, b) => b.at.localeCompare(a.at));
    const today = lessonOfDay(this.now());
    return { today, progress: studyProgress(results, this.now()), results: results.slice(0, 30) };
  }
  private async pace() {
    const snap = await this.bank.snapshot();
    const month = snap.month.map((c): CollectedRow => ({ currency: c.currency, collectedMinor: c.collectedMinor, paidOrders: c.paidOrders }));
    const targets = await this.store.list('salesTargets');
    return { snap, month, targets, rows: paceTargets(targets, month, this.now(), this.timeZone) };
  }
  /** The advisor's snapshot: the same numbers the screen shows, nothing more. */
  async snapshot(): Promise<SalesSnapshot> {
    const [{ snap, month, rows }, deals, study] = await Promise.all([this.pace(), this.store.list('salesDeals'), this.studyInfo()]);
    const today = snap.today.map((c): CollectedRow => ({ currency: c.currency, collectedMinor: c.collectedMinor, paidOrders: c.paidOrders }));
    const bestSellers = snap.products.slice(0, 5).map((p) => ({ sku: p.sku, units: p.units, currency: p.currency }));
    const pipeline = summarizePipeline(deals, this.now(), this.timeZone);
    const health = salesHealth({ targets: rows, pipelineOverdue: pipeline.overdueCount, pipelineOpen: pipeline.openCount, waitingConfirmation: snap.waitingConfirmation, winRate: pipeline.winRate });
    const rhythm = dailyRhythm({ now: this.now(), live: { today, month, waitingConfirmation: snap.waitingConfirmation, awaitingTransfer: snap.awaitingTransfer, bestSellers },
      deals, targets: rows, lessonTitleAr: study.today.titleAr });
    return {
      live: true, today, month, targets: rows, pipeline, health, rhythm, study: study.progress,
      lessonTitle: study.today.titleAr, topProducts: bestSellers,
      waitingConfirmation: snap.waitingConfirmation, awaitingTransfer: snap.awaitingTransfer,
      deals: deals.map((d) => ({ title: d.title, stage: d.stage, valueMinor: d.valueMinor, currency: d.currency, nextActionAt: d.nextActionAt })),
    };
  }
  async ask(question: unknown) {
    const text = cleanText(question, 2, 300, 'السؤال');
    return answerSales(text, await this.snapshot());
  }
  async dashboard() {
    const [{ snap, month, targets, rows }, deals, study, audit] = await Promise.all([
      this.pace(), this.store.list('salesDeals'), this.studyInfo(), this.store.list('salesAudit'),
    ]);
    const today = snap.today.map((c): CollectedRow => ({ currency: c.currency, collectedMinor: c.collectedMinor, paidOrders: c.paidOrders }));
    const bestSellers = snap.products.slice(0, 6).map((p) => ({ sku: p.sku, units: p.units, currency: p.currency }));
    const pipeline = summarizePipeline(deals, this.now(), this.timeZone);
    const health = salesHealth({ targets: rows, pipelineOverdue: pipeline.overdueCount, pipelineOpen: pipeline.openCount, waitingConfirmation: snap.waitingConfirmation, winRate: pipeline.winRate });
    const rhythm = dailyRhythm({ now: this.now(), live: { today, month, waitingConfirmation: snap.waitingConfirmation, awaitingTransfer: snap.awaitingTransfer, bestSellers },
      deals, targets: rows, lessonTitleAr: study.today.titleAr });
    const sorted = [...deals].sort((a, b) => Number(a.stage === 'won' || a.stage === 'lost') - Number(b.stage === 'won' || b.stage === 'lost') || b.updatedAt.localeCompare(a.updatedAt));
    return {
      at: this.at(), edition: HANDBOOK_EDITION, timeZone: this.timeZone,
      storage: { persistent: this.finance.persistent, kind: this.store.kind },
      live: { today, month, waitingConfirmation: snap.waitingConfirmation, awaitingTransfer: snap.awaitingTransfer, bestSellers,
        countries: snap.countries.slice(0, 8).map((c) => ({ country: c.country, currency: c.currency, paidOrders: c.paidOrders, collectedMinor: c.collectedMinor })) },
      deals: sorted, targets, targetsPace: rows, pipeline, health, rhythm,
      study: { todayId: study.today.id, plan: studyPlan(this.now(), 7).map((l) => ({ id: l.id, titleAr: l.titleAr, module: l.module })),
        progress: study.progress, results: study.results.slice(0, 20) },
      audit: [...audit].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50),
      stages: DEAL_STAGES, sources: DEAL_SOURCES,
    };
  }

  /* ───────── Supervision (runs inside «أمين شاهين»'s audit) ───────── */
  private async audit(flag: Parameters<FinanceService['checks'][number]>[0]) {
    const [deals, targets] = await Promise.all([this.store.list('salesDeals'), this.store.list('salesTargets')]);
    const pipeline = summarizePipeline(deals, this.now(), this.timeZone);
    const month = monthKey(this.now(), this.timeZone);
    await flag('SALES_FOLLOW_UP_OVERDUE', pipeline.overdueCount > 0, 'متابعات مبيعات متأخرة',
      `${pipeline.overdueCount} فرصة موعد متابعتها فات. افتح «بنك شام ← إدارة المبيعات ← إيقاع اليوم» وحدّد خطوة جديدة.`, 'warning');
    await flag('SALES_NO_TARGET', deals.length > 0 && !targets.some((t) => t.month === month && t.amountMinor > 0), 'مفيش هدف مبيعات للشهر ده',
      'حدّد هدف الشهر في «بنك شام ← إدارة المبيعات ← الأهداف» — من غير رقم مستهدف مفيش قياس.', 'warning');
    await flag('SALES_NO_NEXT_STEP', pipeline.withoutNextStep > 0, 'فرص مبيعات من غير خطوة جاية',
      `${pipeline.withoutNextStep} فرصة مفتوحة من غير تاريخ ولا إجراء. كل فرصة محتاجة خطوة واحدة بتاريخ.`, 'warning');
  }
}

export type SalesDashboard = Awaited<ReturnType<SalesService['dashboard']>>;
