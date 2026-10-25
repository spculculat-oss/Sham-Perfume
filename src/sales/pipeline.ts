/**
 * «إدارة المبيعات» — خط أنابيب الفرص (the sales pipeline), pure and browser-safe: the admin desk under
 * «بنك شام» draws it, and «مدير المبيعات» reads it in the robot's report.
 *
 * A deal is a real opportunity the owner is working by hand: a shop order that has not been confirmed, a
 * wholesale request, a gift order discussed on the phone. It carries no contact details — the customer's
 * phone, e-mail and address stay in their own account and order; the deal only has a label the owner
 * recognises. Every figure is computed from what he entered, and a forecast says plainly that it is weighted
 * by stage, never a promise.
 */

export const DEAL_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const DEAL_SOURCES = ['store', 'instapay', 'whatsapp', 'phone', 'referral', 'b2b', 'social', 'other'] as const;
export type DealSource = (typeof DEAL_SOURCES)[number];

export const STAGE_LABEL: Record<DealStage, { ar: string; en: string }> = {
  lead: { ar: 'اهتمام جديد', en: 'New lead' },
  qualified: { ar: 'احتياجه واضح', en: 'Qualified' },
  proposal: { ar: 'عرض سعر', en: 'Quote sent' },
  negotiation: { ar: 'تفاوض', en: 'Negotiating' },
  won: { ar: 'اتقفلت — كسبنا', en: 'Won' },
  lost: { ar: 'اتقفلت — خسرنا', en: 'Lost' },
};

export const SOURCE_LABEL: Record<DealSource, { ar: string; en: string }> = {
  store: { ar: 'المتجر', en: 'Store' },
  instapay: { ar: 'إنستاباي', en: 'InstaPay' },
  whatsapp: { ar: 'واتساب', en: 'WhatsApp' },
  phone: { ar: 'تليفون', en: 'Phone' },
  referral: { ar: 'ترشيح من عميل', en: 'Referral' },
  b2b: { ar: 'جملة / شركة', en: 'Wholesale / B2B' },
  social: { ar: 'سوشيال ميديا', en: 'Social media' },
  other: { ar: 'مصدر تاني', en: 'Other' },
};

/** The chance a deal closes while it sits in this stage — the owner may override it. */
export const STAGE_PROBABILITY: Record<DealStage, number> = {
  lead: 10, qualified: 25, proposal: 45, negotiation: 65, won: 100, lost: 0,
};

export interface Deal {
  id: string;
  /** What the owner calls it, e.g. «طقم هدايا — فرع المعادي». No customer contact details. */
  title: string;
  /** A label he recognises, e.g. «عميل جملة — الإسكندرية». Never a phone, e-mail or address. */
  accountLabel: string;
  currency: string;
  /** Expected order value in minor units. */
  valueMinor: number;
  stage: DealStage;
  /** 0–100, defaulted from the stage and editable when he knows more. */
  probability: number;
  source: DealSource;
  /** SKUs or short product names in the opportunity. */
  items: string[];
  /** Local Cairo date (YYYY-MM-DD) of the next step, or '' when none is set yet. */
  nextActionAt: string;
  nextActionAr: string;
  notes: string;
  /** The store order that closed it, when there is one (never invented). */
  orderRef: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  lostReason?: string;
}

export type DealActionState = 'overdue' | 'today' | 'soon' | 'planned' | 'idle' | 'closed';

const DAY = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

/** The calendar day (YYYY-MM-DD) in the store's time zone — the same day the bank's periods use. */
export function dayKey(now: number, timeZone = 'Africa/Cairo'): string {
  if (!Number.isFinite(now)) return '';
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    try { formatter = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }); }
    catch { throw new Error('INVALID_TIMEZONE'); }
    formatters.set(timeZone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(new Date(now)).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export const monthKey = (now: number, timeZone = 'Africa/Cairo') => dayKey(now, timeZone).slice(0, 7);

/** Whole days from `from` to `to` (both YYYY-MM-DD); positive means `to` is later. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / DAY) : 0;
}

export const isOpenDeal = (deal: Deal) => deal.stage !== 'won' && deal.stage !== 'lost';
export const isClosedDeal = (deal: Deal) => !isOpenDeal(deal);
/** The value at its stage probability: a forecast, never a promise. */
export const weightedMinor = (deal: Deal) => Math.round(deal.valueMinor * Math.max(0, Math.min(100, deal.probability)) / 100);

export function dealActionState(deal: Deal, now: number, timeZone = 'Africa/Cairo'): DealActionState {
  if (isClosedDeal(deal)) return 'closed';
  if (!deal.nextActionAt) return 'idle';
  const due = daysBetween(dayKey(now, timeZone), deal.nextActionAt);
  if (due < 0) return 'overdue';
  if (due === 0) return 'today';
  return due <= 3 ? 'soon' : 'planned';
}

export interface DealAction {
  deal: Deal;
  state: Extract<DealActionState, 'overdue' | 'today' | 'idle'>;
  /** Days late (overdue only); 0 otherwise. */
  lateDays: number;
  whyAr: string;
}

const RANK: Record<DealAction['state'], number> = { overdue: 0, today: 1, idle: 2 };

/** What the owner must look at now: overdue first, then today, then opportunities with no next step. */
export function dealActions(deals: readonly Deal[], now: number, timeZone = 'Africa/Cairo', limit = 8): DealAction[] {
  const rows: DealAction[] = [];
  for (const deal of deals) {
    const state = dealActionState(deal, now, timeZone);
    if (state !== 'overdue' && state !== 'today' && state !== 'idle') continue;
    const lateDays = state === 'overdue' ? -daysBetween(dayKey(now, timeZone), deal.nextActionAt) : 0;
    rows.push({
      deal, state, lateDays,
      whyAr: state === 'overdue'
        ? `موعد المتابعة كان ${deal.nextActionAt} (متأخر ${lateDays} يوم)${deal.nextActionAr ? ` — ${deal.nextActionAr}` : ''}.`
        : state === 'today'
          ? `الخطوة الجاية النهارده${deal.nextActionAr ? ` — ${deal.nextActionAr}` : ''}.`
          : 'الفرصة مفتوحة من غير خطوة جاية محددة، وده اللي بيخليها تقف.',
    });
  }
  return rows
    .sort((a, b) => RANK[a.state] - RANK[b.state] || a.deal.nextActionAt.localeCompare(b.deal.nextActionAt) || a.deal.updatedAt.localeCompare(b.deal.updatedAt))
    .slice(0, Math.max(0, limit));
}

/** Why the owner loses deals, from the reasons he wrote himself — grouped, counted, never invented. */
export interface LostReasonGroup {
  reason: string;
  count: number;
  /** The last time a deal was lost for this reason (ISO), for «آخر مرة». */
  lastAt: string;
}

const reasonKey = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Groups the recorded lost reasons (the owner's own words). An empty reason is skipped, not counted as
 * «غير معروف» — an unexplained loss is a gap to fix, and counting it would invent a cause.
 */
export function lostReasonGroups(deals: readonly Deal[], limit = 5): LostReasonGroup[] {
  const groups = new Map<string, LostReasonGroup>();
  for (const deal of deals) {
    if (deal.stage !== 'lost') continue;
    const reason = String(deal.lostReason || '').replace(/\s+/g, ' ').trim();
    if (reason.length < 2) continue;
    const key = reasonKey(reason);
    const current = groups.get(key);
    const at = deal.closedAt || deal.updatedAt;
    if (current) {
      current.count += 1;
      if (at > current.lastAt) current.lastAt = at;
    } else groups.set(key, { reason, count: 1, lastAt: at });
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt) || a.reason.localeCompare(b.reason))
    .slice(0, Math.max(0, limit));
}

/** Open deals that carry no next step — the quietest way a pipeline dies. */
export const dealsWithoutNextStep = (deals: readonly Deal[]) => deals.filter((d) => isOpenDeal(d) && !d.nextActionAt).length;

/** After this many untouched days an open deal is «ساكتة», even when its written next step is still far away. */
export const SILENT_AFTER_DAYS = 7;

export interface SilentDeal {
  deal: Deal;
  /** Whole days since the record was last touched. */
  silentDays: number;
  /** Days until the written next step — always ≥ 1 by definition (due-today and overdue are already listed). */
  dueInDays: number;
  whyAr: string;
}

/**
 * «الفرص الساكتة»: open opportunities whose written next step is still in the future but whose record has
 * not been touched for `days` — the gap the overdue list cannot see («أتابعه بعد ٣ أسابيع» and then nothing).
 * Deals already overdue, due today or with no next step are left to `dealActions`, so nothing is counted twice.
 * Nothing is inferred about why the deal is quiet; the number of days is the only claim.
 */
export function silentDeals(deals: readonly Deal[], now: number, timeZone = 'Africa/Cairo', days = SILENT_AFTER_DAYS, limit = 5): SilentDeal[] {
  const today = dayKey(now, timeZone);
  const rows: SilentDeal[] = [];
  for (const deal of deals) {
    if (!isOpenDeal(deal) || !deal.nextActionAt) continue;
    const dueInDays = daysBetween(today, deal.nextActionAt);
    if (dueInDays <= 0) continue; // overdue or due today: already in the action list
    const touched = dayKey(Date.parse(deal.updatedAt), timeZone);
    if (!touched) continue;
    const silentDays = daysBetween(touched, today);
    if (!Number.isFinite(silentDays) || silentDays < Math.max(1, days)) continue;
    rows.push({ deal, silentDays, dueInDays, whyAr: `مفيش أي حركة على الفرصة من ${silentDays} يوم، وخطوتها الجاية بعد ${dueInDays} يوم — الفترة الطويلة دي هي اللي بتنسّي العميل.` });
  }
  return rows
    .sort((a, b) => b.silentDays - a.silentDays || b.deal.valueMinor - a.deal.valueMinor || a.deal.title.localeCompare(b.deal.title))
    .slice(0, Math.max(0, limit));
}

export interface CurrencyPipeline {
  currency: string;
  openCount: number;
  openMinor: number;
  weightedMinor: number;
  wonCount: number;
  wonMinor: number;
  lostCount: number;
  /** Won ÷ (won + lost) among closed deals in this currency, or null when nothing is closed yet. */
  winRate: number | null;
  avgWonMinor: number | null;
}

export interface StageCount { stage: DealStage; count: number }

export interface PipelineSummary {
  byCurrency: CurrencyPipeline[];
  stages: StageCount[];
  openCount: number;
  closedCount: number;
  wonCount: number;
  lostCount: number;
  winRate: number | null;
  avgWonMinor: number | null;
  overdueCount: number;
  dueTodayCount: number;
  idleCount: number;
  wonThisMonth: number;
  lostThisMonth: number;
  wonThisMonthMinor: { currency: string; minor: number }[];
  actions: DealAction[];
  /** How many open deals have no owner-set next step — the quietest way a pipeline dies. */
  withoutNextStep: number;
  /** The owner's own lost reasons, grouped — what to fix, not a guess. */
  lostReasons: LostReasonGroup[];
  /** Lost deals with no reason recorded: a gap, counted separately and never given an invented cause. */
  lostWithoutReason: number;
  /** Open deals untouched for a week while their next step is still ahead — quiet, not yet late. */
  silentCount: number;
}

export function summarizePipeline(deals: readonly Deal[], now: number, timeZone = 'Africa/Cairo'): PipelineSummary {
  const month = monthKey(now, timeZone);
  const stages: StageCount[] = DEAL_STAGES.map((stage) => ({ stage, count: deals.filter((d) => d.stage === stage).length }));
  const currencies = [...new Set(deals.map((d) => d.currency))].sort();
  const byCurrency = currencies.map((currency): CurrencyPipeline => {
    const rows = deals.filter((d) => d.currency === currency);
    const open = rows.filter(isOpenDeal);
    const won = rows.filter((d) => d.stage === 'won');
    const lost = rows.filter((d) => d.stage === 'lost');
    const closed = won.length + lost.length;
    return {
      currency, openCount: open.length, openMinor: open.reduce((s, d) => s + d.valueMinor, 0),
      weightedMinor: open.reduce((s, d) => s + weightedMinor(d), 0),
      wonCount: won.length, wonMinor: won.reduce((s, d) => s + d.valueMinor, 0), lostCount: lost.length,
      winRate: closed ? Math.round(won.length / closed * 1000) / 10 : null,
      avgWonMinor: won.length ? Math.round(won.reduce((s, d) => s + d.valueMinor, 0) / won.length) : null,
    };
  });
  const won = deals.filter((d) => d.stage === 'won');
  const lost = deals.filter((d) => d.stage === 'lost');
  const closed = won.length + lost.length;
  const wonMonth = won.filter((d) => (d.closedAt ? dayKey(Date.parse(d.closedAt), timeZone).slice(0, 7) === month : false));
  const wonMonthCurrencies = [...new Set(wonMonth.map((d) => d.currency))].sort();
  return {
    byCurrency, stages,
    openCount: deals.filter(isOpenDeal).length, closedCount: closed,
    wonCount: won.length, lostCount: lost.length,
    winRate: closed ? Math.round(won.length / closed * 1000) / 10 : null,
    avgWonMinor: won.length ? Math.round(won.reduce((s, d) => s + d.valueMinor, 0) / won.length) : null,
    overdueCount: deals.filter((d) => dealActionState(d, now, timeZone) === 'overdue').length,
    dueTodayCount: deals.filter((d) => dealActionState(d, now, timeZone) === 'today').length,
    idleCount: deals.filter((d) => dealActionState(d, now, timeZone) === 'idle').length,
    wonThisMonth: wonMonth.length,
    lostThisMonth: lost.filter((d) => (d.closedAt ? dayKey(Date.parse(d.closedAt), timeZone).slice(0, 7) === month : false)).length,
    wonThisMonthMinor: wonMonthCurrencies.map((currency) => ({ currency, minor: wonMonth.filter((d) => d.currency === currency).reduce((s, d) => s + d.valueMinor, 0) })),
    actions: dealActions(deals, now, timeZone),
    withoutNextStep: dealsWithoutNextStep(deals),
    lostReasons: lostReasonGroups(deals),
    lostWithoutReason: lost.filter((d) => String(d.lostReason || '').trim().length < 2).length,
    silentCount: silentDeals(deals, now, timeZone, SILENT_AFTER_DAYS, Number.MAX_SAFE_INTEGER).length,
  };
}

export interface DealMove {
  stage: DealStage;
  nextActionAt?: string;
  nextActionAr?: string;
  lostReason?: string;
  orderRef?: string;
  probability?: number;
}

/** Records a stage change (the owner's action) and keeps the dates honest. */
export function moveDeal(deal: Deal, move: DealMove, now: number): Deal {
  const at = new Date(now).toISOString();
  const stage = move.stage;
  const closed = stage === 'won' || stage === 'lost';
  const reopening = isClosedDeal(deal) && !closed;
  const next: Deal = {
    ...deal, stage, updatedAt: at,
    probability: move.probability === undefined ? (closed ? STAGE_PROBABILITY[stage] : Math.max(deal.probability, STAGE_PROBABILITY[stage])) : Math.max(0, Math.min(100, Math.round(move.probability))),
  };
  if (closed) { next.nextActionAt = ''; next.nextActionAr = ''; }
  else {
    if (move.nextActionAt !== undefined) next.nextActionAt = move.nextActionAt;
    if (move.nextActionAr !== undefined) next.nextActionAr = move.nextActionAr;
  }
  if (stage === 'won') { next.closedAt = at; next.lostReason = undefined; }
  else if (stage === 'lost') { next.closedAt = at; next.lostReason = move.lostReason?.trim() || deal.lostReason || ''; next.orderRef = ''; }
  else if (reopening) next.closedAt = undefined;
  if (move.orderRef !== undefined) next.orderRef = move.orderRef;
  return next;
}

/** Pipeline health from the owner's own numbers: forecast coverage, overdue follow-ups, unattended deals. */
export interface PipelineHygiene {
  score: number;
  overdue: number;
  idle: number;
  withoutNextStep: number;
  openCount: number;
  notesAr: string[];
}

export function pipelineHygiene(summary: PipelineSummary): PipelineHygiene {
  const notices: string[] = [];
  let score = 100;
  if (!summary.openCount) { score = 40; notices.push('مفيش فرص مفتوحة في خط الأنابيب — سجّل أول ٣ فرص حقيقية من المتجر والمكالمات.'); }
  if (summary.overdueCount) {
    const cut = Math.min(40, summary.overdueCount * 10);
    score -= cut;
    notices.push(`${summary.overdueCount} فرصة موعد متابعتها فات — كل واحدة بترجع احتمالية القفل لتحت.`);
  }
  if (summary.withoutNextStep) {
    score -= Math.min(20, summary.withoutNextStep * 5);
    notices.push(`${summary.withoutNextStep} فرصة من غير خطوة جاية — حدّد تاريخ وإجراء لكل واحدة.`);
  }
  if (summary.silentCount) {
    score -= Math.min(15, summary.silentCount * 5);
    notices.push(`${summary.silentCount} فرصة ساكتة من أكتر من ${SILENT_AFTER_DAYS} أيام — خطوتها الجاية بعيدة والسجل ما اتلمسش.`);
  }
  if (summary.winRate !== null && summary.closedCount >= 5 && summary.winRate < 30) {
    score -= 10;
    notices.push(`نسبة الكسب ${summary.winRate}% من ${summary.closedCount} فرصة مقفولة — راجع سبب الخسارة في الأسباب المسجلة.`);
  }
  return { score: Math.max(0, Math.min(100, Math.round(score))), overdue: summary.overdueCount, idle: summary.idleCount, withoutNextStep: summary.withoutNextStep, openCount: summary.openCount, notesAr: notices };
}
