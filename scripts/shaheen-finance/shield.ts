/**
 * «روبوت حراسة أمان المدفوعات والعمولات» (bot `finance_shield`, workflow `.github/workflows/shaheen-finance-shield.yml`,
 * report `src/data/live/finance-shield.json`) — the pure auditor behind the instant server guard.
 *
 * The guard itself runs inside the checkout (`src/finance/shield.ts → reviewCharge`, called from `server/checkout.ts`
 * before a gateway session or a direct receipt is opened). This auditor proves, every 6 hours, that:
 *   1. the guard is still wired in front of **both** payment paths (a static check — a refactor that drops it fails),
 *   2. the guard still **stops** deliberately broken carts (tampered totals, a foreign currency, a repeated line,
 *      a negative shipping, an impossible quantity, a commission outside range, a cart below supplier cost),
 *   3. the live payment page charges every probed country in its own currency (no third country's money).
 *
 * Pure: the runner (`shield-run.mts`) reads the source and probes the live server, then calls `auditShield`.
 * No customer data, no card data and no amounts of real orders ever enter the report.
 */
import { reviewCharge, type ShieldInput } from '../../src/finance/shield';

export interface Drill {
  id: string;
  nameAr: string;
  expect: 'pass' | 'hold';
  input: ShieldInput;
  /** The code the guard must report (a hold without the right reason is not a pass). */
  expectCode?: string;
}

const base: ShieldInput = {
  country: 'EG', displayCurrency: 'EGP', chargeCurrency: 'EGP', officialCurrency: 'EGP', accepted: ['EGP'],
  lines: [{ sku: 'SKU-1', qty: 1, unit: 1200, subtotal: 1200 }],
  items: 1200, shipping: 60, total: 1260, commissionRate: 0.2, supplierCost: 900,
};

/** The carts the guard is challenged with — one legit sale and the ways money goes wrong. */
export const SHIELD_DRILLS: Drill[] = [
  { id: 'legit', nameAr: 'طلب سليم', expect: 'pass', input: base },
  { id: 'empty', nameAr: 'سلة فاضية', expect: 'hold', expectCode: 'EMPTY_CART', input: { ...base, lines: [], items: 0, total: 60 } },
  { id: 'tampered-total', nameAr: 'إجمالي متلاعب فيه', expect: 'hold', expectCode: 'TOTAL_MATH', input: { ...base, total: 900 } },
  { id: 'foreign-currency', nameAr: 'عملة مش عملة بلد الزائر', expect: 'hold', expectCode: 'CHARGE_CURRENCY_NOT_COUNTRY', input: { ...base, displayCurrency: 'EUR', chargeCurrency: 'EUR' } },
  { id: 'duplicate-line', nameAr: 'صنف مكرر', expect: 'hold', expectCode: 'DUPLICATE_LINE', input: { ...base, lines: [{ sku: 'SKU-1', qty: 1, unit: 1200, subtotal: 1200 }, { sku: 'SKU-1', qty: 1, unit: 1200, subtotal: 1200 }], items: 2400, total: 2460 } },
  { id: 'line-math', nameAr: 'سطر مش مضبوط', expect: 'hold', expectCode: 'LINE_MATH', input: { ...base, lines: [{ sku: 'SKU-1', qty: 2, unit: 1200, subtotal: 1200 }], items: 1200 } },
  { id: 'negative-shipping', nameAr: 'شحن سالب', expect: 'hold', expectCode: 'INVALID_SHIPPING', input: { ...base, shipping: -60 } },
  { id: 'impossible-qty', nameAr: 'كمية مستحيلة', expect: 'hold', expectCode: 'INVALID_QTY', input: { ...base, lines: [{ sku: 'SKU-1', qty: 1000, unit: 1200, subtotal: 1_200_000 }], items: 1_200_000, total: 1_200_060 } },
  { id: 'commission-out-of-range', nameAr: 'عمولة خارج النطاق', expect: 'hold', expectCode: 'COMMISSION_RANGE', input: { ...base, commissionRate: 0.75 } },
  { id: 'below-cost', nameAr: 'بيع تحت التكلفة', expect: 'pass', input: { ...base, supplierCost: 5000 } },
];

export interface LiveProbe {
  country: string;
  official: string;
  /** The currency the live server says it will charge (undefined when payments are off/unconfigured). */
  currency?: string;
  enabled: boolean;
}

export interface ShieldAuditInput {
  now: number;
  /** The checkout source (`server/checkout.ts`) — the static wiring check. */
  checkoutSource: string;
  live: LiveProbe[];
  probeFailed: string[];
  gateways: { enabled: boolean; mode?: string };
}

export interface ShieldAuditReport {
  version: 1;
  agent: 'finance-shield';
  updatedAt: string;
  guard: { wired: boolean; calls: number; holdsReasons: string[]; limits: { maxLines: number; maxQtyPerLine: number; maxCommissionRate: number } };
  drills: { total: number; passed: number; failed: { id: string; nameAr: string; expected: string; got: string; codes: string[] }[] };
  live: {
    gateways: { enabled: boolean; mode?: string };
    probed: number;
    enabledPages: number;
    mismatches: { country: string; official: string; charged: string }[];
    failed: string[];
  };
  score: number;
  notes: string[];
  planAr: string[];
  summaryAr: string;
}

export function auditShield(input: ShieldAuditInput): ShieldAuditReport {
  const now = new Date(input.now);
  const calls = (input.checkoutSource.match(/reviewCharge\(/g) || []).length;
  const wires = {
    shieldImport: /from '\.\.\/src\/finance\/shield'/.test(input.checkoutSource),
    heldCode: /PAYMENT_HELD/.test(input.checkoutSource),
    serverPricing: /toMinor\(/.test(input.checkoutSource),
    webhookSignature: /verifyWebhook\(/.test(input.checkoutSource),
  };
  const wired = calls >= 2 && Object.values(wires).every(Boolean) && wires.shieldImport;

  const drillRows = SHIELD_DRILLS.map((drill) => {
    const verdict = reviewCharge(drill.input, now);
    const codes = verdict.findings.map((f) => f.code);
    const ok = drill.expect === 'pass'
      ? verdict.ok && !verdict.findings.some((f) => f.level === 'stop')
      : !verdict.ok && (!drill.expectCode || codes.includes(drill.expectCode));
    return { drill, ok, got: verdict.verdict, codes };
  });
  const failed = drillRows.filter((r) => !r.ok).map((r) => ({
    id: r.drill.id, nameAr: r.drill.nameAr, expected: r.drill.expect === 'pass' ? 'يمرّ' : `يتوقف (${r.drill.expectCode || 'أي سبب'})`, got: r.got, codes: r.codes,
  }));

  const mismatches = input.live
    .filter((p) => p.enabled && p.currency && p.currency !== p.official)
    .map((p) => ({ country: p.country, official: p.official, charged: String(p.currency) }));

  const notes: string[] = [];
  if (!wired) notes.push('الحارس مش موصول في نقطة الدفع زي المتوقع — لازم يتنادى قبل أي جلسة دفع وقبل أي إيصال مباشر.');
  const liveRead = input.live.length + input.probeFailed.length > 0;
  if (!liveRead) notes.push('مفيش قراءة حية في التشغيل ده (تشغيل بدون شبكة) — الفحص اتحقق من الحارس والتمارين بس.');
  else if (!input.live.length) notes.push('مفيش صفحة دفع حية اتقريت — كل المحاولات فشلت.');
  if (input.probeFailed.length) notes.push(`${input.probeFailed.length} دولة فشل قراية صفحة الدفع بتاعتها: ${input.probeFailed.slice(0, 5).join('، ')}.`);
  if (liveRead && !input.gateways.enabled) notes.push('بوابة الدفع الحية مش مضبوطة في التشغيل — الصفحات بتقول «الدفع الإلكتروني مش متاح»، ومفيش عملة بتتفرض.');
  if (mismatches.length) notes.push(`${mismatches.length} دولة صفحة الدفع فيها بتخصم بعملة غير عملتها.`);
  if (failed.length) notes.push(`${failed.length} تمرين أمان فشل — الحارس لازم يتصلح قبل أي دفع.`);

  const score = Math.max(0, Math.min(100, Math.round(
    100 - (wired ? 0 : 30) - Math.min(45, failed.length * 9) - Math.min(20, mismatches.length * 4) - Math.min(10, input.probeFailed.length),
  )));

  const planAr = [
    ...(wired ? [] : ['أرجّع نداء الحارس `reviewCharge` في مساري الدفع (بوابة وإيصال مباشر) قبل أي مبلغ.']),
    ...failed.map((f) => `تمرين «${f.nameAr}»: متوقع ${f.expected} وطلع ${f.got} (${f.codes.join('، ') || 'من غير سبب'}).`),
    ...mismatches.map((m) => `${m.country}: الخصم بـ${m.charged} بدل ${m.official} — يتصلح في إعداد عملة البوابة.`),
    ...input.probeFailed.slice(0, 4).map((c) => `صفحة الدفع في ${c} مش مقروءة — يتأكد إن الموقع الحي شغال.`),
  ];

  const liveText = input.live.length
    ? (mismatches.length ? 'وفيه دول بتخصم بعملة غير عملتها.' : 'والحي بيخصم بعملة كل بلد اتقرت.')
    : 'والقراءة الحية مش متاحة في التشغيل ده.';
  const summaryAr = planAr.length
    ? `حارس المدفوعات: ${drillRows.length - failed.length}/${drillRows.length} تمرين أمان عدّى، والحارس ${wired ? 'موصول' : 'مش موصول'}، وفيه ${planAr.length} حاجة محتاجة شغل.`
    : `حارس المدفوعات سليم: ${drillRows.length} تمرين أمان كلهم عدّوا، والحارس موصول قبل الدفع، ${liveText}`;

  return {
    version: 1,
    agent: 'finance-shield',
    updatedAt: now.toISOString(),
    guard: { wired, calls, holdsReasons: [...new Set(SHIELD_DRILLS.flatMap((d) => reviewCharge(d.input, now).findings.map((f) => f.code)))], limits: { maxLines: 30, maxQtyPerLine: 99, maxCommissionRate: 0.5 } },
    drills: { total: drillRows.length, passed: drillRows.length - failed.length, failed },
    live: {
      gateways: { enabled: input.gateways.enabled, ...(input.gateways.mode ? { mode: input.gateways.mode } : {}) },
      probed: input.live.length,
      enabledPages: input.live.filter((p) => p.enabled).length,
      mismatches,
      failed: [...new Set(input.probeFailed)].slice(0, 20),
    },
    score,
    notes,
    planAr,
    summaryAr,
  };
}
