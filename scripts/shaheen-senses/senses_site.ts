/**
 * «حسّاسات الموقع» — senses_site: what the site knows about itself, read from its own files.
 *
 * Every data point the robots and the prices rest on — products and their cost/price/stock, the shipping table
 * and each destination's real cost, customs with source+date, exchange rates, and how fresh every live report is.
 * It never changes anything: it only observes and reports freshness, gaps and contradictions, each with source
 * and date, so the rest of the mind can trust (or not trust) the number it reads.
 *
 * Output: src/data/live/senses-site.json
 */
import { readFileSync } from 'node:fs';
import type { FxTable, ShippingCosts, ShippingTable } from '../../src/utils/pricing';
import { realShipping } from '../../src/utils/pricing';

export type SiteSenseLevel = 'ok' | 'note' | 'warn' | 'fail';

export interface SiteSense {
  id: string;
  level: SiteSenseLevel;
  whatAr: string;
  whyAr: string;
  fixAr: string;
  source: string;
  checkedAt: string;
}

export interface SensesSiteReport {
  version: 1;
  agent: 'senses_site';
  updatedAt: string;
  score: number;
  counts: { ok: number; note: number; warn: number; fail: number };
  senses: SiteSense[];
  products: { total: number; inStock: number; belowCost: number; noSupplier: number };
  shipping: {
    destinations: number; withPublishedCost: number; zoneFallback: number;
    carriers: number; carrierWithDg: number; carrierWithoutSource: number;
  };
  customs: { countries: number; verified: number; vatMissing: number };
  fx: { base: string; source: string | null; updatedAt: string | null; ageDays: number | null; stale: boolean };
  live: { reports: number; fresh: number; stale: number; missing: number };
  summaryAr: string;
  planAr: string[];
}

const DAY = 86_400_000;
const FRESH_HOURS = 48;
const STALE_DAYS = 10;

const sense = (id: string, level: SiteSenseLevel, whatAr: string, whyAr: string, fixAr: string,
  source: string, checkedAt: string): SiteSense => ({ id, level, whatAr, whyAr, fixAr, source, checkedAt });

/** Age of a date string in days, or null when unreadable. */
function ageDays(at: string | null | undefined): number | null {
  if (!at) return null;
  const t = Date.parse(at);
  return Number.isFinite(t) ? Math.floor((Date.now() - t) / DAY) : null;
}

/** Freshness of a live report file: fresh < FRESH_HOURS, else stale, missing when the file cannot be read. */
function freshness(file: string, now: number): { status: 'fresh' | 'stale' | 'missing'; ageHours: number | null } {
  try {
    const raw = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
    const d = JSON.parse(raw);
    const at = d && typeof d === 'object' && (d as { updatedAt?: string; checkedAt?: string }).updatedAt
      || (d && typeof d === 'object' && (d as { updatedAt?: string; checkedAt?: string }).checkedAt);
    const age = at ? Math.floor((now - Date.parse(at)) / 3_600_000) : null;
    return { status: age === null ? 'stale' : age < FRESH_HOURS ? 'fresh' : 'stale', ageHours: age };
  } catch { return { status: 'missing', ageHours: null }; }
}

export interface SensesSiteInput {
  now: number;
  products: { sku: string; supplierPrice?: number; ourPrice?: number; stockStatus?: string; inStock?: boolean }[];
  shipping: ShippingTable;
  costs: ShippingCosts;
  customs: { countries?: Record<string, { vatPercent?: number; source?: string | null; checkedAt?: string }>; updatedAt?: string; source?: string | null };
  fx: FxTable;
  tradeDestinations: { code: string; nameAr: string }[];
  carriers: { id: string; nameAr: string; dg: boolean | null; source?: string | null; checkedAt?: string }[];
  liveReports: { file: string; name: string }[];
}

/**
 * Reads only the site's own files. Every number carries its source and date; «غير متأكد» is reported as such,
 * never invented. The report is the sense-organ of the site's inner body.
 */
export function buildSensesSite(input: SensesSiteInput): SensesSiteReport {
  const { now, products: prods, shipping, costs, customs, fx, tradeDestinations, liveReports } = input;
  const senses: SiteSense[] = [];
  const add = (s: SiteSense) => senses.push(s);

  // ── products ──
  let inStock = 0, belowCost = 0, noSupplier = 0;
  for (const p of prods) {
    if (p.inStock ?? p.stockStatus === 'in_stock') inStock += 1;
    if (typeof p.supplierPrice === 'number' && p.supplierPrice > 0
      && typeof p.ourPrice === 'number' && p.ourPrice > 0 && p.ourPrice < p.supplierPrice * 1.5) belowCost += 1;
    if (!(typeof p.supplierPrice === 'number' && p.supplierPrice > 0)) noSupplier += 1;
  }
  add(sense('products:stock', prods.length ? (inStock === prods.length ? 'ok' : 'note') : 'fail',
    `في الكتالوج ${prods.length} منتج، متوفر منها ${inStock}`,
    'المخزون من ملف المنتجات نفسه؛ منتج نفد يختفي من واجهات البيع.',
    'راجع حالة توفر المنتجات الناقصة مع المورد.', 'src/data/products.json', new Date(now).toISOString()));
  add(sense('products:cost', belowCost ? 'warn' : 'ok',
    `${belowCost} منتج سعره أقل من قاعدة صاحب المتجر (التكلفة × ١.٥)`,
    'قاعدة البائع: لايُباع بأقل من تكلفة × 1.5؛ البيع تحت التكلفة يكسر الهامش الصافي.',
    'راجع السعر أو ثبت استثناء مكتوب من صاحب المتجر.', 'src/data/products.json', new Date(now).toISOString()));
  add(sense('products:supplier', noSupplier ? 'warn' : 'ok',
    `${noSupplier} منتج من غير تكلفة مورد معروفة`,
    'من غير تكلفة مورد لا يمكن اختبار «تحت التكلفة» ولا حساب الربح الحقيقي.',
    'أضف تكلفة المورد لكل منتج في كتالوج المنتجات.', 'src/data/products.json', new Date(now).toISOString()));

  // ── shipping ──
  const withCost = Object.keys(costs.countries || {}).length;
  let zoneFallback = 0, carrierWithDg = 0, carrierWithoutSource = 0;
  for (const d of tradeDestinations) {
    if (!realShipping(d.code, 1, shipping)) zoneFallback += 1;
  }
  const carriers = input.carriers;
  for (const c of carriers) {
    if (c.dg === true) carrierWithDg += 1;
    if (!c.source) carrierWithoutSource += 1;
  }
  add(sense('shipping:published', tradeDestinations.length ? (withCost === tradeDestinations.length ? 'ok' : 'warn') : 'fail',
    `في الشحن ${withCost} وجهة من ${tradeDestinations.length} لها تعريفة منشورة`,
    'الFace الذي ليس له تعريفة منشورة يُحسب من جدول المناطق (تقديري) وليس من شركة حقيقية.',
    '«كشّاف الشحن» يجلب تعريفة حقيقية لكل وجهة بمصدر وتاريخ.', 'src/data/shipping-costs.json', costs.checkedAt || new Date(now).toISOString()));
  add(sense('shipping:zone-fallback', zoneFallback ? 'warn' : 'ok',
    `${zoneFallback} وجهة سعرها من جدول المناطق (تقديري، بيتأكد قبل الدفع)`,
    'السعر التقديري قد يفرق عن التكلفة الحقيقية — الزائر لازم يشوف "تقديري" قبل الدفع.',
    'سجل تعريفة شركة منشورة لكل وجهة لإزالة التقدير.', 'src/data/shipping.json', new Date(now).toISOString()));
  add(sense('shipping:carriers', carriers.length ? 'ok' : 'fail',
    `${carriers.length} شركة شحن مسجلة، منها ${carrierWithDg} تقبل مواد خطر (UN1266)`,
    'الشحن الجوي للعطور يحتاج شركة معتمدة للمواد الخطرة.',
    'أضف شركة شحن معتمدة للعطور لكل ممر دولي.', 'src/data/shipping-lanes.json', new Date(now).toISOString()));
  if (carrierWithoutSource) add(sense('shipping:carrier-source', 'warn',
    `${carrierWithoutSource} شركة من غير رابط مصدر لتعريفتها`,
    'تعريفة من غير مصدر وتاريخ لا تُصدّق للأسعار.',
    'أضف رابط المصدر وتاريخ الفحص لكل شركة في shipping-lanes.json.', 'src/data/shipping-lanes.json', new Date(now).toISOString()));

  // ── customs ──
  const ctry = customs.countries || {};
  const verified = Object.values(ctry).filter((c) => c.vatPercent !== null).length;
  const vatMissing = Object.values(ctry).filter((c) => c.vatPercent === null).length;
  add(sense('customs:verified', Object.keys(ctry).length ? (verified === Object.keys(ctry).length ? 'ok' : 'warn') : 'fail',
    `في الجمارك ${Object.keys(ctry).length} دولة، مؤكد منها ${verified}`,
    'الجمارك غير المؤكدة لا تُعرض للزائر ولا تدخل في أي وعد توصيل.',
    '«كشّاف الشحن» يجلب مصدر الجمارك لكل دولة.', 'src/data/customs.json', customs.updatedAt || new Date(now).toISOString()));
  if (vatMissing) add(sense('customs:vat-missing', 'warn',
    `${vatMissing} دولة من غير نسبة ضريبة جمرك`,
    'النسبة الناقصة تعني سعراً تقديرياً للجمارك — والنص يظل "مش متأكد".',
    'أضف نسبة الضريبة ومصدرها لكل دولة.', 'src/data/customs.json', new Date(now).toISOString()));

  // ── fx ──
  const fxAge = ageDays(fx.updatedAt);
  const fxStale = fxAge === null ? true : fxAge > STALE_DAYS;
  add(sense('fx:fresh', fxStale ? 'warn' : 'ok',
    `أسعار الصرف أساسها ${fx.base}، مصدرها ${fx.source || 'غير معروف'}، آخر تحديث ${fx.updatedAt || 'غير معروف'}`,
    'كل سعر بعملة غير الجنيه مبني على جدول الصرف؛ الجدول القديم يغير الأسعار المعروضة والمخصومة.',
    'حدّث أسعار الصرف من مصدرها المسجل.', fx.source || 'src/data/live/fx-rates.json', fx.updatedAt || new Date(now).toISOString()));

  // ── live reports freshness ──
  let fresh = 0, stale = 0, missing = 0;
  for (const r of liveReports) {
    const f = freshness(r.file, now);
    if (f.status === 'fresh') fresh += 1;
    else if (f.status === 'stale') stale += 1;
    else missing += 1;
  }
  add(sense('live:reports', missing ? 'fail' : stale ? 'warn' : 'ok',
    `تقارير العقل الحية ${liveReports.length}: طازج ${fresh}، قديم ${stale}، مفقود ${missing}`,
    'تقرير قديم أو مفقود يعني الروبوت المسؤول عنه لم يشتغل، ورقم العقل مبني على بيانات قد تكون قديمة.',
    'شغّل الروبوتات المسؤولة عن التقارير الناقصة.', 'scripts/shaheen-* / .github/workflows', new Date(now).toISOString()));

  const counts = { ok: 0, note: 0, warn: 0, fail: 0 };
  for (const s of senses) counts[s.level] += 1;
  const score = Math.max(0, Math.min(100, 100 - counts.fail * 15 - counts.warn * 5 - counts.note * 1));
  const fails = senses.filter((s) => s.level === 'fail');
  const warns = senses.filter((s) => s.level === 'warn');

  return {
    version: 1, agent: 'senses_site', updatedAt: new Date(now).toISOString(),
    score, counts, senses,
    products: { total: prods.length, inStock, belowCost, noSupplier },
    shipping: { destinations: tradeDestinations.length, withPublishedCost: withCost, zoneFallback,
      carriers: carriers.length, carrierWithDg, carrierWithoutSource },
    customs: { countries: Object.keys(ctry).length, verified, vatMissing },
    fx: { base: fx.base, source: fx.source ?? null, updatedAt: fx.updatedAt ?? null, ageDays: fxAge, stale: fxStale },
    live: { reports: liveReports.length, fresh, stale, missing },
    summaryAr: fails.length
      ? `حسّاسات الموقع: ${fails.length} مشكلة ضرورية · ${counts.ok}/${senses.length} senso متأكدة`
      : `حسّاسات الموقع: ${counts.ok}/${senses.length} سليمة · ${warns.length} ملاحظة · النتيجة ${score}/100`,
    planAr: [
      ...fails.slice(0, 4).map((s) => `${s.whatAr} — ${s.fixAr}`),
      ...warns.slice(0, 3).map((s) => `ملاحظة: ${s.whatAr} — ${s.fixAr}`),
      ...(fails.length || warns.length ? [] : ['مفيش حاجة مفتوحة: بيانات الموقع الداخلية طازجة ومتسقة.']),
    ],
  };
}

export const isSensesSiteReport = (v: unknown): v is SensesSiteReport => {
  const r = v as SensesSiteReport | undefined;
  return Boolean(r && r.version === 1 && r.agent === 'senses_site' && typeof r.score === 'number' && Array.isArray(r.senses));
};
