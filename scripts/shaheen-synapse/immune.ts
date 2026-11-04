/**
 * «مناعة شاهين» — the immune system: it finds the places where two parts of the mind disagree.
 *
 * The mind is only as good as its weakest contradiction: a cost in one file and a different cost in another, a
 * promise the shipping cannot keep, a «verified» customs figure with no source, a lesson that teaches a rule the
 * catalogue breaks. Each finding names **both** sides and **both** sources, and it is either:
 *   · `contradiction` — two numbers for the same thing (must be fixed),
 *   · `promise` — the site says something the data cannot honour (must be fixed),
 *   · `untraceable` — a number with no source/date (must be fixed),
 *   · `stale` — true once, unchecked for too long (re-check).
 * It never edits a price: prices are the merchant's (his rule, 2026-10-26).
 *
 * Pure: everything is a parameter (`tests/shaheenMind.test.ts`).
 */
import { convert, type FxTable } from '../../src/utils/pricing';

export type FindingKind = 'contradiction' | 'promise' | 'untraceable' | 'stale';
export type Severity = 'high' | 'medium' | 'low';

export interface Finding {
  kind: FindingKind;
  severity: Severity;
  /** What the finding is about (a country code, a SKU, a carrier id…). */
  subject: string;
  whatAr: string;
  /** The two sides of a contradiction, each with its source — so the fix is obvious. */
  sides?: { valueAr: string; source: string }[];
  fixAr: string;
}

export interface ImmuneInput {
  now: number;
  fx: FxTable;
  /** What the price engine actually charges per destination (USD, first bottle). */
  chargedUsd: Record<string, number>;
  /** What the trade report recorded as the carrier's cost (EGP). */
  destinationCostEgp: { code: string; nameAr: string; costEgp: [number, number] | null; carrierId: string | null; promise: string }[];
  /** The generated cost table (`shipping-costs.json`). */
  costTable: { currency: string; source: string; checkedAt: string; countries: Record<string, { firstItem: number; carrier: string }> };
  /** The catalogue with both prices, so the merchant's ×1.5 rule can be checked line by line. */
  products: { sku: string; nameAr: string; ourPrice: number; supplierPrice: number; supplierId?: string | null }[];
  /** What the merchant's price rule should produce for a given cost. */
  expectedPrice: (cost: number) => number;
  /** Destinations we claim to ship to, from the trade report. */
  promises: { code: string; nameAr: string; promise: 'we_ship' | 'broker_only' | 'unknown' }[];
  customs: { code: string; nameAr: string; verified: boolean; vatPercent: number | null; source: string | null; checkedAt: string | null }[];
  carrierChecks: { id: string; nameAr: string; checkedAt: string | null; source: string | null }[];
  /** Free shipping is the merchant's switch; the immune system only reports what the file says. */
  freeShippingAboveEgp: number | null;
  staleDays?: number;
}

export interface ImmuneReport {
  version: 1;
  agent: 'immune';
  updatedAt: string;
  findings: Finding[];
  counts: Record<FindingKind, number>;
  /** 0–100: 100 = nothing contradicts anything. */
  health: number;
  summaryAr: string;
}

const DAY = 86_400_000;
const round = (n: number) => Math.round(n * 100) / 100;

export function checkConsistency(input: ImmuneInput): ImmuneReport {
  const findings: Finding[] = [];
  const staleDays = Number(input.staleDays) || 120;

  // 1) التكلفة اللي الموقع بيحسب بيها مقابل التكلفة اللي التقرير سجّلها — لو اختلفوا، رقمين لحاجة واحدة.
  for (const d of input.destinationCostEgp) {
    const row = input.costTable.countries?.[d.code];
    const chargedUsd = input.chargedUsd[d.code];
    if (!row || !d.costEgp) continue;
    const fromTableEgp = convert(row.firstItem, input.costTable.currency, 'EGP', input.fx);
    const fromReportEgp = d.costEgp[0];
    const gap = Math.abs(fromTableEgp - fromReportEgp);
    if (gap > Math.max(2, fromReportEgp * 0.02)) {
      findings.push({
        kind: 'contradiction', severity: isBigGap(gap, fromReportEgp) ? 'high' : 'medium', subject: d.code,
        whatAr: `${d.nameAr}: تكلفة الشحن في جدول الموقع غير تكلفة تقرير الشحن`,
        sides: [
          { valueAr: `${round(fromTableEgp)} ج.م`, source: `src/data/shipping-costs.json (${input.costTable.source}, ${input.costTable.checkedAt})` },
          { valueAr: `${round(fromReportEgp)} ج.م`, source: 'src/data/live/trade-lanes.json' },
        ],
        fixAr: 'شغّل روبوت الشحن ليعيد توليد جدول التكلفة من نفس التقرير (مصدر واحد للرقم)',
      });
    }
    if (chargedUsd === undefined) {
      findings.push({
        kind: 'promise', severity: 'high', subject: d.code,
        whatAr: `${d.nameAr}: التقرير بيسعّر شحنها ومحرك السعر مالوش سعر ليها — الزائر هيشوف سعر منطقة مش سعر حقيقي`,
        fixAr: 'راجع shipping-costs.json و shipping.json لنفس الوجهة',
      });
    }
  }

  // 2) وعد التوصيل مقابل اللي الشحن يقدر عليه.
  for (const p of input.promises) {
    if (p.promise === 'we_ship' && !input.destinationCostEgp.find((d) => d.code === p.code)?.carrierId) {
      findings.push({
        kind: 'promise', severity: 'high', subject: p.code,
        whatAr: `${p.nameAr}: بنقول إننا بنشحن لها ومفيش شركة مسجلة للمسار`,
        fixAr: 'سجّل شركة وتعريفة للمسار، أو غيّر الوعد لـ«بتتأكد» لحد ما تتأكد',
      });
    }
  }

  // 3) الجمارك: «متأكد» من غير مصدر منشور = ادعاء. والضريبة اللي بتتغير من بلد لبلد بتتجمّع في ملاحظة واحدة.
  let varyingVat = 0;
  for (const c of input.customs) {
    if (c.verified && !c.source) {
      findings.push({
        kind: 'untraceable', severity: 'medium', subject: c.code,
        whatAr: `${c.nameAr}: جماركها معلّمة «متأكد» من غير مصدر منشور`,
        fixAr: 'سجّل المصدر في src/data/customs.json أو خلّيها «بتتأكد»',
      });
    }
    if (c.verified && c.vatPercent === null) varyingVat += 1;
  }
  if (varyingVat) {
    findings.push({
      kind: 'promise', severity: 'low', subject: 'vat-varies',
      whatAr: `${varyingVat} وجهة ضريبتها بتتغير من بلد لبلد (زي أوروبا) — لازم تُقال للزائر كده، مش برقم واحد`,
      fixAr: 'الرد بيقول «الضريبة بتتغير حسب البلد وبتتأكد قبل الدفع» — راجع نص الرد في tools.ts',
    });
  }

  // 4) تعريفة شركة من غير تاريخ أو من غير مصدر، أو قديمة.
  for (const c of input.carrierChecks) {
    if (!c.source) {
      findings.push({ kind: 'untraceable', severity: 'medium', subject: c.id, whatAr: `«${c.nameAr}»: تعريفة من غير رابط مصدر`, fixAr: 'سجّل رابط التعريفة المنشورة في shipping-lanes.json' });
    }
    const at = Date.parse(String(c.checkedAt || ''));
    if (Number.isFinite(at) && input.now - at > staleDays * DAY) {
      findings.push({
        kind: 'stale', severity: 'low', subject: c.id,
        whatAr: `«${c.nameAr}»: التعريفة اتفحصت آخر مرة من ${Math.floor((input.now - at) / DAY)} يوم`,
        fixAr: 'راجع التعريفة وحدّث checkedAt',
      });
    }
  }

  // 5) قاعدة التاجر (التكلفة × ١.٥) مقابل الكتالوج — من غير أي تعديل سعر.
  const broken = input.products.filter((p) => p.supplierPrice > 0 && p.ourPrice > 0 && p.ourPrice + 0.01 < input.expectedPrice(p.supplierPrice));
  if (broken.length) {
    findings.push({
      kind: 'contradiction', severity: broken.length > 20 ? 'high' : 'medium', subject: 'pricing-rule',
      whatAr: `${broken.length} منتج سعره أقل من قاعدة صاحب المتجر (التكلفة × ١.٥)`,
      sides: [
        { valueAr: `مثال: ${broken[0].nameAr} بـ${broken[0].ourPrice} ج.م وتكلفته ${broken[0].supplierPrice}`, source: 'src/data/products.json' },
        { valueAr: 'القاعدة: التكلفة × ١.٥ مقرّبة لفوق', source: 'scripts/shaheen-import/transform.ts' },
      ],
      fixAr: 'القرار لصاحب المتجر: يا يعدّل السعر، يا يعتمد استثناء مكتوب',
    });
  }

  // 6) منتجات بلا مورد مسجل: مصدرها مش معروف، ومصدرها هو اللي بيحدد بلد الشحن.
  const noSupplier = input.products.filter((p) => p.ourPrice > 0 && !p.supplierId);
  if (noSupplier.length) {
    findings.push({
      kind: 'untraceable', severity: 'low', subject: 'suppliers',
      whatAr: `${noSupplier.length} منتج سعره منشور ومورده مش مسجل — يعني بلد شحنه مش معروف`,
      sides: [{ valueAr: `مثال: ${noSupplier[0].nameAr}`, source: 'src/data/products.json' }],
      fixAr: 'سجّل supplierId الصح للمنتجات دي في المستورد، أو شيلها من البيع لحد ما مصدرها يتعرف',
    });
  }

  // 7) الشحن المجاني: مفتوح ولا مقفول — القرار لصاحب المتجر، والمناعة بتتأكد إن الموقع مايوعدش بيه.
  if (input.freeShippingAboveEgp !== null) {
    findings.push({
      kind: 'promise', severity: 'low', subject: 'free-shipping',
      whatAr: `الشحن المجاني مفتوح فوق ${input.freeShippingAboveEgp} ج.م — لازم يكون متغطي من الهامش`,
      fixAr: 'راجع الأرقام، أو اقفله بإزالة المفتاح من shipping.json (القرار لصاحب المتجر)',
    });
  }

  const counts = { contradiction: 0, promise: 0, untraceable: 0, stale: 0 } as Record<FindingKind, number>;
  for (const f of findings) counts[f.kind] += 1;
  const high = findings.filter((f) => f.severity === 'high').length;
  const medium = findings.filter((f) => f.severity === 'medium').length;
  const low = findings.filter((f) => f.severity === 'low').length;
  const health = Math.max(0, 100 - high * 15 - medium * 4 - low * 1);
  const summaryAr = findings.length
    ? `مناعة شاهين: ${findings.length} مشكلة (${counts.contradiction} تعارض رقم · ${counts.promise} وعد مش مدعوم · ${counts.untraceable} رقم بلا مصدر · ${counts.stale} قديم) — الصحة ${health}/100`
    : `مناعة شاهين: مفيش أي تعارض — الصحة 100/100`;
  return { version: 1, agent: 'immune', updatedAt: new Date(input.now).toISOString(), findings, counts, health, summaryAr };
}

function isBigGap(gap: number, base: number): boolean {
  return base > 0 && gap / base > 0.1;
}
