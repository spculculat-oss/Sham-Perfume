/**
 * «بنك شام» — the analysis toolbox a money-management product offers (statement reconciliation, cash-flow
 * forecast, payables ageing, budgets, product/country profitability, currency estimates). Pure functions over
 * the private ledger: no network, no storage, no model. They never post money; the server's service does that,
 * and only after the owner confirms. Every estimate is labelled as one.
 */
import { decimals, sumMinor } from './money';
import type { Budget, CollectionAccount, FinanceEntry, FinanceOrder, Payable } from '../../server/finance/types';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from './bankKinds';

const COSTS = ['cost', 'shipping', 'fee', 'tax'] as const;
const OUT_KINDS = new Set(['refund', 'chargeback', 'cost', 'shipping', 'fee', 'tax', 'expense']);
const DAY = 86400_000;

/** A major-unit number → exact minor units for the currency, or undefined when it is not exact money. */
export function minorOf(amount: number, currency: string): number | undefined {
  try {
    const d = decimals(currency);
    if (!Number.isFinite(amount)) return undefined;
    const minor = Math.round(amount * 10 ** d);
    return Number.isSafeInteger(minor) && Math.abs(minor / 10 ** d - amount) < 1e-6 ? minor : undefined;
  } catch { return undefined; }
}

/* ───────────── Bank-statement reconciliation ───────────── */
export interface StatementLine { row: number; date: string; amount: number; description: string }
const ARABIC_DIGITS = /[٠-٩۰-۹]/g;
const westernDigits = (s: string) => s.replace(ARABIC_DIGITS, (d) => String('٠١٢٣٤٥٦٧٨٩'.includes(d) ? '٠١٢٣٤٥٦٧٨٩'.indexOf(d) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

function splitRow(line: string, delimiter: string): string[] {
  const cells: string[] = []; let cur = ''; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted; }
    else if (ch === delimiter && !quoted) { cells.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}
/** «1,250.50», «1.250,50», «EGP 1250», «١٢٥٠٫٥٠» → 1250.5 ; debits («-200», «(200)») stay negative. */
export function parseAmount(raw: string): number | undefined {
  let s = westernDigits(raw).replace(/٫/g, '.').replace(/٬/g, ',').replace(/[^\d.,()\-+]/g, '');
  if (!/\d/.test(s)) return undefined;
  const negative = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()+-]/g, '');
  const lastDot = s.lastIndexOf('.'); const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (lastComma >= 0) s = /,\d{1,2}$/.test(s) && (s.match(/,/g) || []).length === 1 ? s.replace(',', '.') : s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? (negative ? -n : n) : undefined;
}
/** 2026-10-19 · 19/10/2026 · 19-10-2026 · 2026/10/19 → «2026-10-19» (day-first, as Egyptian banks print). */
export function parseDate(raw: string): string {
  const s = westernDigits(raw).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  let y: number, mo: number, d: number;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else return '';
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? date.toISOString().slice(0, 10) : '';
}
const HEAD = {
  date: /date|تاريخ|value/i,
  credit: /credit|دائن|deposit|وارد|إيداع|ايداع|in\b/i,
  amount: /amount|مبلغ|قيمة|value amount/i,
  text: /desc|detail|narration|reference|memo|بيان|وصف|مرجع|ملاحظ|تفاصيل/i,
};
/** Reads what a bank or InstaPay app exports (CSV / semicolon / tab, with or without a header). At most 2,000 rows. */
export function parseStatement(text: string): StatementLine[] {
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 2001);
  if (!rows.length) return [];
  const delimiter = ['\t', ';', ','].map((d) => [d, splitRow(rows[0], d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const table = rows.map((r) => splitRow(r, delimiter));
  const header = table[0].some((c) => HEAD.date.test(c) || HEAD.amount.test(c) || HEAD.credit.test(c)) && !table[0].some((c) => parseDate(c)) ? table[0] : undefined;
  const find = (re: RegExp) => header ? header.findIndex((c) => re.test(c)) : -1;
  let dateCol = find(HEAD.date); let amountCol = find(HEAD.credit); if (amountCol < 0) amountCol = find(HEAD.amount); let textCol = find(HEAD.text);
  const body = header ? table.slice(1) : table;
  if (!header && body.length) {
    const sample = body[0];
    dateCol = sample.findIndex((c) => parseDate(c));
    amountCol = sample.findIndex((c, i) => i !== dateCol && parseAmount(c) !== undefined && !parseDate(c) && /\d/.test(c) && c.replace(/[^\d]/g, '').length < 13);
    textCol = sample.reduce((best, c, i) => i !== dateCol && i !== amountCol && c.length > (sample[best]?.length || 0) ? i : best, -1);
  }
  if (amountCol < 0) return [];
  return body.slice(0, 2000).flatMap((cells, i) => {
    const amount = parseAmount(cells[amountCol] || '');
    if (amount === undefined) return [];
    return [{ row: i + (header ? 2 : 1), date: dateCol >= 0 ? parseDate(cells[dateCol] || '') : '', amount, description: (textCol >= 0 ? cells[textCol] : cells.filter((_, j) => j !== amountCol && j !== dateCol).join(' ')).slice(0, 200) }];
  });
}
export interface MatchCandidate { ref: string; totalMinor: number; currency: string; createdAt: string; transferRef?: string }
export interface StatementMatch { ref: string; row: number; date: string; amount: number; confidence: 'strong' | 'amount' ; description: string }
const squash = (s: string) => westernDigits(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
/**
 * Pairs incoming statement lines with orders waiting for a transfer. «strong» = same amount AND the order number
 * or the buyer's transfer reference appears in the line. «amount» = only the amount (and date window) fits, and
 * no other order or line competes for it. Ambiguous pairs are left for the owner. Nothing is confirmed here.
 */
export function matchStatement(lines: StatementLine[], candidates: MatchCandidate[], currency: string): { matches: StatementMatch[]; unmatchedLines: number } {
  const incoming = lines.filter((l) => l.amount > 0);
  const used = new Set<number>(); const matches: StatementMatch[] = [];
  const pending = candidates.filter((c) => c.currency === currency);
  const fits = (l: StatementLine, c: MatchCandidate) => {
    if (minorOf(l.amount, currency) !== c.totalMinor) return false;
    if (!l.date) return true;
    const t = Date.parse(`${l.date}T12:00:00Z`); const created = Date.parse(c.createdAt);
    return t >= created - 1.5 * DAY && t <= created + 10 * DAY;
  };
  const strong = (l: StatementLine, c: MatchCandidate) => {
    const text = squash(l.description);
    return [c.ref, c.transferRef].some((r) => { const k = squash(r || ''); return k.length >= 4 && text.includes(k); });
  };
  for (const c of pending) {
    const hit = incoming.find((l) => !used.has(l.row) && fits(l, c) && strong(l, c));
    if (hit) { used.add(hit.row); matches.push({ ref: c.ref, row: hit.row, date: hit.date, amount: hit.amount, confidence: 'strong', description: hit.description }); }
  }
  for (const c of pending.filter((p) => !matches.some((m) => m.ref === p.ref))) {
    const options = incoming.filter((l) => !used.has(l.row) && fits(l, c));
    const rivals = pending.filter((p) => p !== c && !matches.some((m) => m.ref === p.ref) && options.some((l) => fits(l, p)));
    if (options.length === 1 && !rivals.length) { used.add(options[0].row); matches.push({ ref: c.ref, row: options[0].row, date: options[0].date, amount: options[0].amount, confidence: 'amount', description: options[0].description }); }
  }
  return { matches, unmatchedLines: incoming.length - used.size };
}

/* ───────────── Cash flow, payables, budgets ───────────── */
const live = (entries: FinanceEntry[]) => entries.filter((e) => e.mode === 'live');
export interface Forecast {
  currency: string; basisDays: number; entries: number; avgDailyInMinor: number; avgDailyOutMinor: number;
  projectedNetMinor: number; payablesDueMinor: number; projectedAfterPayablesMinor: number; confidence: 'low' | 'medium';
}
/** Next `days` days from the average of the last 90 (or since the first entry, minimum a week). An estimate, never a promise. */
export function cashForecast(entries: FinanceEntry[], payables: Payable[], now: number, days = 30): Forecast[] {
  const recent = live(entries).filter((e) => Date.parse(e.at) > now - 90 * DAY && Date.parse(e.at) <= now);
  const currencies = [...new Set([...recent.map((e) => e.currency), ...payables.filter((p) => p.status === 'open').map((p) => p.currency)])].sort();
  return currencies.map((currency) => {
    const rows = recent.filter((e) => e.currency === currency);
    const first = rows.reduce((m, e) => Math.min(m, Date.parse(e.at)), now);
    const basisDays = Math.max(7, Math.min(90, Math.ceil((now - first) / DAY)));
    const inflow = sumMinor(rows.filter((e) => e.kind === 'sale').map((e) => e.amountMinor));
    const outflow = sumMinor(rows.filter((e) => OUT_KINDS.has(e.kind)).map((e) => e.amountMinor));
    const avgIn = Math.round(inflow / basisDays); const avgOut = Math.round(outflow / basisDays);
    const projected = Math.round((inflow - outflow) / basisDays * days);
    const due = sumMinor(payables.filter((p) => p.status === 'open' && p.currency === currency && Date.parse(`${p.dueDate}T23:59:59Z`) <= now + days * DAY).map((p) => p.amountMinor));
    return { currency, basisDays, entries: rows.length, avgDailyInMinor: avgIn, avgDailyOutMinor: avgOut, projectedNetMinor: projected, payablesDueMinor: due,
      projectedAfterPayablesMinor: projected - due, confidence: rows.length >= 20 ? 'medium' : 'low' };
  });
}
export interface Ageing { currency: string; overdueMinor: number; week: number; month: number; laterMinor: number; overdue: number; dueWeekMinor: number; dueMonthMinor: number }
/** Open bills by due date: overdue / within 7 days / within 30 days / later. */
export function payablesAgeing(payables: Payable[], now: number): Ageing[] {
  const open = payables.filter((p) => p.status === 'open');
  return [...new Set(open.map((p) => p.currency))].sort().map((currency) => {
    const rows = open.filter((p) => p.currency === currency);
    const left = (p: Payable) => (Date.parse(`${p.dueDate}T23:59:59Z`) - now) / DAY;
    const sum = (f: (p: Payable) => boolean) => sumMinor(rows.filter(f).map((p) => p.amountMinor));
    return { currency, overdue: rows.filter((p) => left(p) < 0).length, overdueMinor: sum((p) => left(p) < 0), week: rows.filter((p) => left(p) >= 0 && left(p) <= 7).length,
      dueWeekMinor: sum((p) => left(p) >= 0 && left(p) <= 7), month: rows.filter((p) => left(p) > 7 && left(p) <= 30).length, dueMonthMinor: sum((p) => left(p) > 7 && left(p) <= 30), laterMinor: sum((p) => left(p) > 30) };
  });
}
export interface BudgetUse { category: ExpenseCategory; currency: string; monthlyMinor: number | null; spentMinor: number; percent: number | null; state: 'ok' | 'warning' | 'over' | 'unbudgeted' }
/** This month's operating expenses per category against the owner's budgets. 80 % warns, above 100 % is over. */
export function budgetUsage(budgets: Budget[], entries: FinanceEntry[], from: string, to: string): BudgetUse[] {
  const month = live(entries).filter((e) => e.kind === 'expense' && Date.parse(e.at) >= Date.parse(from) && Date.parse(e.at) < Date.parse(to));
  const keys = new Set([...budgets.filter((b) => b.monthlyMinor > 0).map((b) => `${b.category}|${b.currency}`), ...month.map((e) => `${e.category || 'other'}|${e.currency}`)]);
  return [...keys].sort().map((key) => {
    const [category, currency] = key.split('|') as [ExpenseCategory, string];
    const spent = sumMinor(month.filter((e) => (e.category || 'other') === category && e.currency === currency).map((e) => e.amountMinor));
    const budget = budgets.find((b) => b.category === category && b.currency === currency && b.monthlyMinor > 0);
    if (!budget) return { category, currency, monthlyMinor: null, spentMinor: spent, percent: null, state: 'unbudgeted' as const };
    const percent = Math.round(spent / budget.monthlyMinor * 1000) / 10;
    return { category, currency, monthlyMinor: budget.monthlyMinor, spentMinor: spent, percent, state: percent > 100 ? 'over' as const : percent >= 80 ? 'warning' as const : 'ok' as const };
  }).sort((a, b) => EXPENSE_CATEGORIES.indexOf(a.category) - EXPENSE_CATEGORIES.indexOf(b.category));
}

/* ───────────── Profitability ───────────── */
function orderCosts(entries: FinanceEntry[], ref: string) {
  const rows = entries.filter((e) => e.orderRef === ref && (COSTS as readonly string[]).includes(e.kind));
  const reversed = new Set(rows.flatMap((e) => e.reverses ? [e.id, e.reverses] : []));
  return { costMinor: sumMinor(rows.map((e) => e.amountMinor)), complete: COSTS.every((k) => rows.some((e) => e.kind === k && !reversed.has(e.id))) };
}
export interface ProductRow { sku: string; currency: string; units: number; revenueMinor: number; estimatedCostMinor: number; estimatedMarginMinor: number; costComplete: boolean }
/** Paid units and revenue per product. Order costs are shared across its lines by value — marked as an estimate. */
export function productPerformance(orders: FinanceOrder[], entries: FinanceEntry[], limit = 20): ProductRow[] {
  const sales = live(entries).filter((e) => e.kind === 'sale');
  const rows = new Map<string, ProductRow>();
  for (const order of orders.filter((o) => o.mode === 'live' && sales.some((s) => s.orderRef === o.ref))) {
    const goods = order.totalMinor - order.shippingChargedMinor;
    const { costMinor, complete } = orderCosts(live(entries), order.ref);
    for (const line of order.lines) {
      const value = line.unitMinor * line.qty;
      const key = `${line.sku}|${order.currency}`;
      const row = rows.get(key) || { sku: line.sku, currency: order.currency, units: 0, revenueMinor: 0, estimatedCostMinor: 0, estimatedMarginMinor: 0, costComplete: true };
      const share = goods > 0 ? Math.round(costMinor * value / goods) : 0;
      row.units += line.qty; row.revenueMinor += value; row.estimatedCostMinor += share; row.estimatedMarginMinor = row.revenueMinor - row.estimatedCostMinor;
      row.costComplete &&= complete;
      rows.set(key, row);
    }
  }
  return [...rows.values()].sort((a, b) => b.revenueMinor - a.revenueMinor).slice(0, limit);
}
export interface CountryRow { country: string; currency: string; paidOrders: number; collectedMinor: number; refundsMinor: number; costsMinor: number; resultMinor: number; costComplete: boolean }
export function countryPerformance(orders: FinanceOrder[], entries: FinanceEntry[]): CountryRow[] {
  const all = live(entries); const rows = new Map<string, CountryRow>();
  for (const order of orders.filter((o) => o.mode === 'live')) {
    const sale = all.find((e) => e.kind === 'sale' && e.orderRef === order.ref);
    if (!sale) continue;
    const key = `${order.country}|${order.currency}`;
    const row = rows.get(key) || { country: order.country, currency: order.currency, paidOrders: 0, collectedMinor: 0, refundsMinor: 0, costsMinor: 0, resultMinor: 0, costComplete: true };
    const refunds = sumMinor(all.filter((e) => e.orderRef === order.ref && (e.kind === 'refund' || e.kind === 'chargeback')).map((e) => e.amountMinor));
    const { costMinor, complete } = orderCosts(all, order.ref);
    row.paidOrders++; row.collectedMinor += sale.amountMinor; row.refundsMinor += refunds; row.costsMinor += costMinor;
    row.resultMinor = row.collectedMinor - row.refundsMinor - row.costsMinor; row.costComplete &&= complete;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.collectedMinor - a.collectedMinor);
}

/* ───────────── Accounts and currencies ───────────── */
export interface AccountBalance { accountId: string; label: string; kind: CollectionAccount['kind']; currency: string; collectedMinor: number; payments: number }
/** Money each collection account received through confirmed direct sales (not a bank balance). */
export function accountBalances(accounts: CollectionAccount[], entries: FinanceEntry[]): AccountBalance[] {
  const sales = live(entries).filter((e) => e.kind === 'sale' && e.source === 'direct' && e.accountId);
  return accounts.flatMap((a) => {
    const mine = sales.filter((e) => e.accountId === a.id);
    const currencies = [...new Set([...mine.map((e) => e.currency), ...(mine.length ? [] : a.currencies.slice(0, 1))])];
    return currencies.map((currency) => ({ accountId: a.id, label: a.label, kind: a.kind, currency, payments: mine.filter((e) => e.currency === currency).length,
      collectedMinor: sumMinor(mine.filter((e) => e.currency === currency).map((e) => e.amountMinor)) }));
  });
}
/** Converts per-currency totals into one currency with the daily rates table. Clearly an estimate for orientation. */
export function convertEstimate(totals: { currency: string; minor: number }[], target: string, fx: { base: string; rates: Record<string, number> }): { minor: number; missing: string[] } {
  const rate = (c: string) => (c === fx.base ? 1 : fx.rates[c]);
  let sum = 0; const missing: string[] = [];
  for (const t of totals) {
    const from = rate(t.currency); const to = rate(target);
    if (!(from > 0) || !(to > 0)) { missing.push(t.currency); continue; }
    try { sum += t.minor / 10 ** decimals(t.currency) / from * to; } catch { missing.push(t.currency); }
  }
  let d = 2; try { d = decimals(target); } catch { /* default */ }
  return { minor: Math.round(sum * 10 ** d), missing };
}
