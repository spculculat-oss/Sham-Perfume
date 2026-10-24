/**
 * «حارس المدفوعات والعمولات» — the instant guard in front of every payment (bot `finance_shield`).
 *
 * It runs **on the server, inside the checkout, right before a payment session or a direct receipt is opened**
 * (`server/checkout.ts`): the browser's numbers are never trusted, and a cart that does not add up, a currency that
 * is not the visitor's country's, a repeated line, a negative or absurd amount, or a commission outside its range
 * stops the payment with one clear code instead of charging the visitor.
 *
 * The guard is pure and deterministic (`reviewCharge`); the scheduled robot (`scripts/shaheen-finance/shield.ts`,
 * report `src/data/live/finance-shield.json`) also fires the same guard at deliberately broken carts every day to
 * prove it still stops them, and reads the live payment page of every country to check the currency.
 */
import { decimals, toMinor } from './money';

export type ShieldLevel = 'stop' | 'warn';

export interface ShieldFinding {
  code: string;
  level: ShieldLevel;
  ar: string;
  en: string;
}

export interface ShieldLine { sku: string; qty: number; unit: number; subtotal: number }

export interface ShieldInput {
  country: string;
  /** The currency the visitor's page shows (his country's official one). */
  displayCurrency: string;
  /** The currency the gateway will actually charge. */
  chargeCurrency: string;
  /** Currencies the gateway really accepts (empty = no gateway configured). */
  accepted: string[];
  lines: ShieldLine[];
  items: number;
  shipping: number;
  total: number;
  /** The country's official currency (src/utils/pricing.ts → currencyFor), when it differs from the display. */
  officialCurrency?: string;
  /** The platform's commission rate on this order, as a fraction (0–0.5). */
  commissionRate?: number;
  /** The supplier cost of the order in the charge currency, when the ledger knows it (internal check only). */
  supplierCost?: number;
}

export interface ShieldVerdict {
  ok: boolean;
  verdict: 'pass' | 'hold';
  checkedAt: string;
  findings: ShieldFinding[];
}

const money = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const cents = (v: number) => Math.round(v * 100);

/** The guard's own limits. Above them a cart is not «large», it is a mistake or an attack. */
export const SHIELD_LIMITS = {
  maxLines: 30,
  maxQtyPerLine: 99,
  maxBottles: 99 * 30,
  maxTotalMinor: 500_000_000,
  maxCommissionRate: 0.5,
} as const;

/**
 * Reviews one cart before the money moves. `ok` = the payment may continue; otherwise the caller stops it and
 * shows `PAYMENT_HELD`. Warnings never stop a sale — they are recorded for the audit.
 */
export function reviewCharge(input: ShieldInput, now: Date = new Date()): ShieldVerdict {
  const findings: ShieldFinding[] = [];
  const stop = (code: string, ar: string, en: string) => findings.push({ code, level: 'stop', ar, en });
  const warn = (code: string, ar: string, en: string) => findings.push({ code, level: 'warn', ar, en });

  const official = String(input.officialCurrency || input.displayCurrency || '').toUpperCase();
  const charge = String(input.chargeCurrency || '').toUpperCase();
  const display = String(input.displayCurrency || '').toUpperCase();

  if (!/^[A-Z]{2}$/.test(String(input.country || ''))) stop('INVALID_COUNTRY', 'بلد الطلب غير صحيح.', 'The order country is not valid.');
  if (!/^[A-Z]{3}$/.test(charge) || !/^[A-Z]{3}$/.test(display)) {
    stop('INVALID_CURRENCY', 'عملة الطلب غير صحيحة.', 'The order currency is not valid.');
  } else {
    // «مفيش عملة غير عملة بلد الزائر»: the charge is his country's money, or a fallback the gateway really accepts.
    try { decimals(charge); decimals(display); } catch {
      stop('UNKNOWN_CURRENCY', `العملة ${charge} مش معروفة للمحرك المالي.`, `${charge} is unknown to the money engine.`);
    }
    if (charge !== official) {
      const allowedFallback = (charge === 'EGP' || charge === 'USD') && (input.accepted.length ? input.accepted.includes(charge) : false);
      if (!allowedFallback) {
        stop('CHARGE_CURRENCY_NOT_COUNTRY', `الخصم بعملة ${charge} مش عملة بلد الزائر (${official}).`, `Charging in ${charge} is not the visitor's country currency (${official}).`);
      } else {
        warn('CHARGE_CURRENCY_FALLBACK', `الخصم بعملة ${charge} لأن عملة البلد (${official}) مش مقبولة من البوابة — الزائر لازم يشوف ده قبل الدفع.`, `Charging in the accepted fallback ${charge} because ${official} is not accepted by the gateway.`);
      }
    } else if (charge !== display) {
      warn('DISPLAY_CURRENCY_DIFFERS', `الصفحة بتعرض ${display} والخصم بـ${charge} — الزائر لازم يشوف السعر النهائي بالعملة اللي هيتخصم بها.`, `The page shows ${display} but the charge is ${charge}.`);
    }
  }

  const lines = Array.isArray(input.lines) ? input.lines : [];
  if (!lines.length) stop('EMPTY_CART', 'السلة فاضية.', 'The cart is empty.');
  if (lines.length > SHIELD_LIMITS.maxLines) stop('TOO_MANY_LINES', 'عدد أصناف السلة أكبر من الحد.', 'The cart has too many lines.');

  const seen = new Set<string>();
  let bottles = 0;
  let computedItems = 0;
  for (const line of lines) {
    const sku = String(line?.sku || '');
    if (!sku || sku.length > 80) stop('INVALID_SKU', 'فيه صنف من غير كود صحيح.', 'A line has an invalid SKU.');
    if (seen.has(sku)) stop('DUPLICATE_LINE', `الصنف ${sku} مكرر في السلة.`, `The line ${sku} appears twice.`);
    seen.add(sku);
    if (!Number.isInteger(line?.qty) || line.qty < 1 || line.qty > SHIELD_LIMITS.maxQtyPerLine) {
      stop('INVALID_QTY', `كمية غير صحيحة للصنف ${sku || '—'}.`, `Invalid quantity on ${sku || 'a line'}.`);
      continue;
    }
    if (!money(line.unit) || line.unit <= 0 || !money(line.subtotal) || line.subtotal <= 0) {
      stop('INVALID_AMOUNT', `سعر غير صحيح للصنف ${sku}.`, `Invalid price on ${sku}.`);
      continue;
    }
    if (cents(line.unit) * line.qty !== cents(line.subtotal)) {
      stop('LINE_MATH', `حساب الصنف ${sku} مش مضبوط (السعر × الكمية ≠ الإجمالي).`, `The line ${sku} does not add up.`);
    }
    if (line.unit > 100_000_000) stop('ABSURD_PRICE', `سعر الصنف ${sku} مبالغ فيه بشكل مستحيل.`, `The price on ${sku} is impossibly high.`);
    bottles += line.qty;
    computedItems += cents(line.subtotal);
  }
  if (bottles > SHIELD_LIMITS.maxBottles) stop('TOO_MANY_BOTTLES', 'عدد الزجاجات في الطلب أكبر من الحد.', 'Too many bottles in one order.');

  if (!money(input.items) || input.items < 0) stop('INVALID_ITEMS', 'إجمالي الأصناف غير صحيح.', 'The items total is invalid.');
  if (!money(input.shipping) || input.shipping < 0) stop('INVALID_SHIPPING', 'قيمة الشحن غير صحيحة.', 'The shipping amount is invalid.');
  if (!money(input.total) || input.total <= 0) stop('INVALID_TOTAL', 'إجمالي الطلب غير صحيح.', 'The order total is invalid.');

  if (money(input.items) && money(input.shipping) && money(input.total) && lines.length) {
    if (cents(input.items) !== computedItems) stop('ITEMS_MATH', 'إجمالي الأصناف مش مجموع السطور.', 'The items total is not the sum of the lines.');
    if (Math.abs(cents(input.items) + cents(input.shipping) - cents(input.total)) > 1) {
      stop('TOTAL_MATH', 'الإجمالي النهائي مش مساوي للأصناف + الشحن.', 'The total is not items + shipping.');
    }
  }

  if (money(input.total) && /^[A-Z]{3}$/.test(charge)) {
    try {
      const minor = toMinor(input.total, charge);
      if (minor > SHIELD_LIMITS.maxTotalMinor) stop('TOTAL_TOO_LARGE', 'إجمالي الطلب أكبر من الحد المسموح لطلب واحد.', 'The order total is above the allowed maximum.');
    } catch {
      stop('PRECISION', `عدد خانات العملة ${charge} غير صحيح في الإجمالي.`, `The total does not fit ${charge}'s precision.`);
    }
  }

  if (input.commissionRate !== undefined) {
    const rate = Number(input.commissionRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > SHIELD_LIMITS.maxCommissionRate) {
      stop('COMMISSION_RANGE', 'نسبة عمولة المنصة خارج النطاق المسموح.', "The platform commission is outside its allowed range.");
    }
    const commission = money(input.total) ? input.total * rate : NaN;
    if (!Number.isFinite(commission) || commission < 0) stop('COMMISSION_INVALID', 'حساب عمولة المنصة غير صحيح.', 'The platform commission does not compute.');
    if (money(input.supplierCost) && money(input.total) && (input.supplierCost as number) > input.total) {
      warn('BELOW_COST', 'سعر البيع أقل من تكلفة المورد — راجع التسعير قبل الشحن.', 'The sale price is below the supplier cost — check the pricing before shipping.');
    }
  }

  const blocking = findings.some((f) => f.level === 'stop');
  return { ok: !blocking, verdict: blocking ? 'hold' : 'pass', checkedAt: now.toISOString(), findings };
}

/** The code the visitor sees when the guard holds a payment (never a provider or internal name). */
export const PAYMENT_HELD = {
  code: 'PAYMENT_HELD',
  ar: 'الطلب محتاج مراجعة قبل الدفع — اتوقف مؤقتاً لحد ما نتحقق من الأرقام.',
  en: 'This order needs a quick check before payment — it is paused until the numbers are verified.',
} as const;
