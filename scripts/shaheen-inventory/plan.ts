/**
 * «إدارة المخزون والتنبؤ بالمبيعات» — the pure brain of the inventory robot
 * (`.github/workflows/shaheen-inventory.yml`, `scripts/shaheen-inventory/run.mts`):
 *
 *   - audits the real storefront catalog (`src/data/products.json` + Shaheen's enrichment),
 *   - reads the numeric stock and the recorded confirmed requests through the admin API when a token exists,
 *   - forecasts demand only from **real recorded sales** (confirmed/completed requests in the last 30 days):
 *     moving average per SKU, days of cover, and a reorder quantity by lead time + safety stock,
 *   - with no sales data it says so plainly and plans from stock/catalog only — it never invents a number,
 *   - writes `src/data/live/shaheen-inventory.json` for «الفحص الشامل» and the control centre.
 *
 * No customer data and no revenue amounts are copied into the report: only SKUs, names, counts and quantities.
 * Pure (no network, no Node): `tests/shaheenInventory.test.ts` drives it with fixtures.
 */
import { FAMILY_LABEL, mergeCatalog, type Family, type RawProduct, type StoreCatalogFile, type StoreProduct } from '../../src/utils/storeCatalog';

/** How far back the sales window goes. */
export const SALES_WINDOW_DAYS = 30;
/** Supplier lead time and the safety stock kept on top of it (days of demand). */
export const LEAD_DAYS = 21;
export const SAFETY_DAYS = 7;
/** Numeric stock at or below this is «low». */
export const LOW_STOCK_LIMIT = 3;
/** A request only counts as a sale after it was confirmed (or completed). */
export const SOLD_STATUSES = ['confirmed', 'completed'] as const;

export type DemandBand = 'high' | 'medium' | 'low' | 'none' | 'unknown';
export type ReorderPriority = 'urgent' | 'high' | 'normal';
export type StockSource = 'admin' | 'catalog';

export interface AdminProductLite { sku?: string; stock?: number; active?: boolean }
export interface AdminRequestLite {
  status?: string;
  createdAt?: string;
  items?: { sku?: string; quantity?: number }[];
}

export interface InventoryInput {
  now: number;
  products: RawProduct[];
  catalog?: Pick<StoreCatalogFile, 'entries'> & { updatedAt?: string };
  /** The live admin catalog and the recorded requests, when they could be read. */
  live?: { products: AdminProductLite[]; requests: AdminRequestLite[] };
  /** Whether each endpoint really answered (an empty answer is «read: no rows», not «not read»). */
  stockRead?: boolean;
  salesRead?: boolean;
  /** Safe codes of the endpoints that failed (`requests:HTTP_500`, `products:TIMEOUT`, …). */
  liveFailed: string[];
}

export interface RestockItem {
  sku: string;
  nameAr: string;
  brand: string;
  priority: ReorderPriority;
  stock?: number;
  units30: number;
  reasonAr: string;
}

export interface ForecastItem {
  sku: string;
  nameAr: string;
  brand: string;
  available: boolean;
  stock?: number;
  units30: number;
  band: DemandBand;
  confidence: 'high' | 'medium' | 'low' | 'none';
  velocityPerDay: number;
  coverDays?: number;
  reorderInDays?: number;
  reorderUnits?: number;
  reasonAr: string;
}

export interface InventoryFile {
  version: 1;
  updatedAt: string;
  sources: {
    catalogAt: string;
    total: number;
    published: number;
    liveStock: boolean;
    liveSales: boolean;
    failed: string[];
    salesBasisAr: string;
  };
  catalog: {
    published: number;
    inStock: number;
    outOfStock: number;
    featuredOut: number;
    newOut: number;
    families: number;
    brands: number;
  };
  stock: { known: boolean; products: number; low: number; out: number; units: number } | null;
  sales: {
    windowDays: number;
    orders: number;
    units: number;
    skus: number;
    firstAt?: string;
    lastAt?: string;
  };
  /** How many products need restocking in total (the list itself is capped). */
  restockTotal: number;
  restock: RestockItem[];
  coverage: {
    familiesOut: { id: string; nameAr: string; count: number }[];
    brandsOut: { brand: string; out: number; total: number }[];
  };
  forecast: {
    basis: 'live' | 'none';
    noteAr: string;
    methodAr: string;
    leadDays: number;
    safetyDays: number;
    items: ForecastItem[];
    totals: { urgent: number; soon: number; reorderUnits: number };
  };
  problems: string[];
  fixes: string[];
  ideas: string[];
  summaryAr: string;
  planAr: string[];
}

const o = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? v as Record<string, unknown> : {});
const n = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const round = (value: number, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const bandOf = (units: number): DemandBand => (units >= 10 ? 'high' : units >= 3 ? 'medium' : units > 0 ? 'low' : 'none');
const priorityRank: Record<ReorderPriority, number> = { urgent: 0, high: 1, normal: 2 };
const familyLabel = (family: Family | undefined) => (family ? FAMILY_LABEL[family]?.ar || family : '—');

/** Stock of a SKU as the store really shows it: numeric when the admin catalog was read, otherwise in/out. */
interface StockInfo { available: boolean; stock?: number; source: StockSource }

export function stockIndex(liveProducts: AdminProductLite[] | undefined): Map<string, number> {
  const out = new Map<string, number>();
  for (const product of liveProducts || []) {
    const sku = typeof product.sku === 'string' ? product.sku.trim() : '';
    const stock = n(product.stock);
    if (sku && stock !== undefined && product.active !== false) out.set(sku, Math.max(0, Math.floor(stock)));
  }
  return out;
}

function stockOf(product: StoreProduct, adminStock: Map<string, number>): StockInfo {
  if (adminStock.has(product.sku)) return { available: (adminStock.get(product.sku) as number) > 0, stock: adminStock.get(product.sku), source: 'admin' };
  return { available: product.inStock, source: 'catalog' };
}

/** Confirmed/completed requests in the window → units per SKU, plus the real request count and dates. */
export function salesFromRequests(requests: AdminRequestLite[] | undefined, now: number): {
  units: Map<string, number>; orders: number; unitsTotal: number; firstAt?: string; lastAt?: string;
} {
  const units = new Map<string, number>();
  const since = now - SALES_WINDOW_DAYS * 86_400_000;
  let orders = 0;
  let unitsTotal = 0;
  const times: string[] = [];
  for (const request of requests || []) {
    if (!(SOLD_STATUSES as readonly string[]).includes(String(request.status))) continue;
    const at = typeof request.createdAt === 'string' ? Date.parse(request.createdAt) : NaN;
    if (!Number.isFinite(at) || at < since || at > now) continue;
    const lines = Array.isArray(request.items) ? request.items : [];
    const clean = lines
      .map((line) => ({ sku: typeof line.sku === 'string' ? line.sku.trim() : '', quantity: n(line.quantity) ?? 0 }))
      .filter((line) => line.sku && line.quantity > 0);
    if (!clean.length) continue;
    orders++;
    for (const line of clean) {
      units.set(line.sku, (units.get(line.sku) || 0) + Math.floor(line.quantity));
      unitsTotal += Math.floor(line.quantity);
    }
    times.push(new Date(at).toISOString());
  }
  times.sort();
  return { units, orders, unitsTotal, firstAt: times[0], lastAt: times.at(-1) };
}

/** Does the window really cover two weeks of recorded sales? (a low-confidence forecast otherwise) */
function confidenceOf(units: number, firstAt: string | undefined, now: number): ForecastItem['confidence'] {
  const days = firstAt ? (now - Date.parse(firstAt)) / 86_400_000 : 0;
  if (units >= 10 && days >= 14) return 'high';
  if (units >= 3) return 'medium';
  return 'low';
}

const coverAr = (days: number) => (days <= 0 ? 'المخزون خلص' : `يغطي حوالي ${Math.round(days)} يوم`);

export function buildInventory(input: InventoryInput): InventoryFile {
  const { now, products, catalog, live, liveFailed } = input;
  const merged = mergeCatalog(products, catalog);
  const stockRead = input.stockRead ?? live?.products !== undefined;
  const salesRead = input.salesRead ?? live?.requests !== undefined;
  const adminStock = stockIndex(live?.products);
  const sales = salesFromRequests(live?.requests, now);

  const out = merged.filter((product) => !stockOf(product, adminStock).available);
  const featuredOut = out.filter((product) => product.isFeatured).length;
  const newOut = out.filter((product) => product.isNew).length;
  const families = new Set(merged.flatMap((product) => product.families));
  const brands = new Set(merged.map((product) => product.brand).filter(Boolean));
  const stock = stockRead
    ? {
      known: true,
      products: adminStock.size,
      low: [...adminStock.values()].filter((value) => value > 0 && value <= LOW_STOCK_LIMIT).length,
      out: [...adminStock.values()].filter((value) => value === 0).length,
      units: [...adminStock.values()].reduce((sum, value) => sum + value, 0),
    }
    : null;

  // ── Restock queue: what is out / low, urgent first — sorted by real demand when it exists ────────────────
  const restock: RestockItem[] = [];
  for (const product of merged) {
    const info = stockOf(product, adminStock);
    const units30 = sales.units.get(product.sku) || 0;
    const isOut = !info.available;
    const isLow = info.stock !== undefined && info.stock > 0 && info.stock <= LOW_STOCK_LIMIT;
    if (!isOut && !isLow) continue;
    // isNew is not a signal: the importer marks every row new, so it would make the whole catalogue "urgent".
    const priority: ReorderPriority = isOut && (product.isFeatured || units30 >= 5)
      ? 'urgent'
      : (isOut || isLow) && (product.isFeatured || units30 >= 3) ? 'high' : 'normal';
    const reasonAr = isOut
      ? product.isFeatured ? 'نفد — منتج مميز على الواجهة' : `نفد${units30 ? ` — اتباع ${units30} في آخر ${SALES_WINDOW_DAYS} يوم` : ''}`
      : `المخزون ${info.stock} بس${units30 ? ` — اتباع ${units30} في آخر ${SALES_WINDOW_DAYS} يوم` : ''}`;
    restock.push({ sku: product.sku, nameAr: product.name.ar || product.name.en, brand: product.brand, priority, ...(info.stock !== undefined ? { stock: info.stock } : {}), units30, reasonAr });
  }
  restock.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || b.units30 - a.units30 || a.nameAr.localeCompare(b.nameAr));

  // ── Store coverage: families/brands a visitor cannot buy at all ───────────────────────────────────────────
  const familyStats = new Map<Family, { total: number; inStock: number }>();
  for (const product of merged) {
    for (const family of product.families) {
      const stat = familyStats.get(family) || { total: 0, inStock: 0 };
      stat.total++;
      if (stockOf(product, adminStock).available) stat.inStock++;
      familyStats.set(family, stat);
    }
  }
  const familiesOut = [...familyStats.entries()]
    .filter(([, stat]) => stat.total > 0 && stat.inStock === 0)
    .map(([id, stat]) => ({ id, nameAr: familyLabel(id), count: stat.total }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
  const brandStats = new Map<string, { total: number; inStock: number }>();
  for (const product of merged) {
    if (!product.brand) continue;
    const stat = brandStats.get(product.brand) || { total: 0, inStock: 0 };
    stat.total++;
    if (stockOf(product, adminStock).available) stat.inStock++;
    brandStats.set(product.brand, stat);
  }
  const brandsOut = [...brandStats.entries()]
    .filter(([, stat]) => stat.total >= 2 && stat.inStock === 0)
    .map(([brand, stat]) => ({ brand, out: stat.total - stat.inStock, total: stat.total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  // ── Forecast: real recorded sales only ────────────────────────────────────────────────────────────────────
  const bySku = new Map(merged.map((product) => [product.sku, product]));
  const forecastItems: ForecastItem[] = [];
  for (const [sku, units30] of sales.units) {
    const product = bySku.get(sku);
    if (!product || units30 <= 0) continue;
    const info = stockOf(product, adminStock);
    const velocityPerDay = units30 / SALES_WINDOW_DAYS;
    const confidence = confidenceOf(units30, sales.firstAt, now);
    const coverDays = info.stock !== undefined && velocityPerDay > 0 ? round(info.stock / velocityPerDay) : undefined;
    const reorderInDays = coverDays !== undefined ? round(coverDays - (LEAD_DAYS + SAFETY_DAYS)) : undefined;
    const rawReorder = info.stock !== undefined && coverDays !== undefined && coverDays <= LEAD_DAYS + SAFETY_DAYS
      ? velocityPerDay * (LEAD_DAYS + SAFETY_DAYS) - info.stock
      : 0;
    const reorderUnits = rawReorder > 0 ? Math.ceil(rawReorder / 3) * 3 : undefined;
    const reasonAr = [
      `طلب ${bandOf(units30) === 'high' ? 'عالي' : bandOf(units30) === 'medium' ? 'متوسط' : 'خفيف'}`,
      `${units30} وحدة في ${SALES_WINDOW_DAYS} يوم`,
      coverDays !== undefined ? coverAr(coverDays) : info.available ? 'متوفر' : 'نفد',
    ].join(' — ');
    forecastItems.push({
      sku, nameAr: product.name.ar || product.name.en, brand: product.brand, available: info.available,
      ...(info.stock !== undefined ? { stock: info.stock } : {}), units30, band: bandOf(units30), confidence,
      velocityPerDay: round(velocityPerDay, 2), ...(coverDays !== undefined ? { coverDays } : {}),
      ...(reorderInDays !== undefined ? { reorderInDays } : {}), ...(reorderUnits !== undefined ? { reorderUnits } : {}),
      reasonAr,
    });
  }
  forecastItems.sort((a, b) => b.units30 - a.units30 || a.nameAr.localeCompare(b.nameAr));
  const forecastLive = forecastItems.slice(0, 120);
  const ahead = forecastLive.filter((item) => item.reorderInDays !== undefined && item.coverDays !== undefined);
  const totals = {
    urgent: ahead.filter((item) => (item.coverDays as number) <= LEAD_DAYS).length,
    soon: ahead.filter((item) => (item.coverDays as number) > LEAD_DAYS && (item.coverDays as number) <= LEAD_DAYS + SAFETY_DAYS).length,
    reorderUnits: forecastLive.reduce((sum, item) => sum + (item.reorderUnits || 0), 0),
  };

  const basis: 'live' | 'none' = sales.orders > 0 ? 'live' : 'none';
  const noteAr = sales.orders > 0
    ? `التنبؤ من ${sales.orders} طلب مؤكد/مكتمل مسجل خلال آخر ${SALES_WINDOW_DAYS} يوم (${sales.unitsTotal} وحدة على ${sales.units.size} منتج).`
    : salesRead
      ? `مفيش طلبات مؤكدة أو مكتملة مسجلة في آخر ${SALES_WINDOW_DAYS} يوم — مفيش تنبؤ متخمن؛ الخطة من المخزون والكتالوج بس.`
      : `سجل الطلبات مش مقروء${liveFailed.length ? ` (${liveFailed.join('، ')})` : ''} — مفيش تنبؤ متخمن؛ الخطة من المخزون والكتالوج بس.`;

  const catalogOut = out.length;
  const problems: string[] = [];
  const fixes: string[] = [];
  const ideas: string[] = [];
  if (!stockRead) {
    problems.push('المخزون الرقمي مش مقروء — الاعتماد على حالة «متوفر/نفد» في كتالوج المتجر');
    fixes.push('راجع SHAM_ADMIN_TOKEN أو مسار المنتجات في السيرفر؛ الأعداد الحقيقية تظهر أول ما يتقرأ الحساب');
  } else if (!stock?.products) {
    problems.push('الحساب اتقرأ لكن مفيش منتجات مسجلة بأرقام مخزون — الخطة من الكتالوج بس');
    fixes.push('سجّل المخزون الرقمي لكل SKU في الحساب عشان التغطية بالأيام تتحسب بدقة');
  }
  if (!salesRead) {
    problems.push('سجل الطلبات مش مقروء — التنبؤ بالمبيعات مش هيشتغل من غير قراءة الطلبات');
    fixes.push('راجع SHAM_ADMIN_TOKEN ومسار الطلبات؛ مفيش أرقام مبيعات متخمنة');
  }
  if (liveFailed.length) problems.push(`بعض مصادر المخزون ما اتقرتش (${liveFailed.join('، ')})`);
  if (merged.length && catalogOut > merged.length * 0.4) {
    problems.push(`${catalogOut} منتج من ${merged.length} غير متوفر (${Math.round((100 * catalogOut) / merged.length)}%)`);
    fixes.push('أعد توريد الأكثر طلباً أولاً؛ قائمة إعادة التوريد في التقرير');
  }
  if (featuredOut) {
    problems.push(`${featuredOut} منتج مميز غير متوفر على واجهة المتجر`);
    fixes.push('أعد توريد المنتجات المميزة أو استبدلها بمنتج متوفر من نفس العائلة');
  }
  if (totals.urgent) {
    problems.push(`${totals.urgent} منتج طلبه عالي ومخزونه هيخلص قبل مدة التوريد`);
    fixes.push('اطلب الكميات المقترحة في خطة إعادة التوريد');
  }
  if (salesRead && !sales.orders) ideas.push('أول ما تتسجل طلبات مؤكدة، التنبؤ بالمبيعات يشتغل تلقائياً من غير أي أرقام متخمنة');
  if (familiesOut.length) ideas.push(`${familiesOut.length} عائلة عطرية مفيش منها ولا منتج متوفر — فرصة لتوسيع التوريد`);
  if (brandsOut.length) ideas.push(`${brandsOut.length} ماركة كلها غير متوفرة — راجع البدائل المتاحة`);

  const summaryAr = [
    `المخزون: ${merged.length} منتج منشور، ${merged.length - catalogOut} متوفر و${catalogOut} غير متوفر`,
    featuredOut ? `${featuredOut} مميز نفد` : '',
    stock ? (stock.products ? `المخزون الرقمي ${stock.units} وحدة على ${stock.products} منتج (${stock.low} منخفض و${stock.out} نفد)` : 'مفيش منتجات مسجلة بأرقام مخزون في الحساب') : 'المخزون الرقمي غير مقروء',
    sales.orders ? `المبيعات المؤكدة ${sales.unitsTotal} وحدة على ${sales.orders} طلب في ${SALES_WINDOW_DAYS} يوم` : salesRead ? 'مفيش مبيعات مؤكدة مسجلة في المدة' : 'سجل المبيعات مش مقروء',
    `${restock.length} منتج في قائمة إعادة التوريد`,
  ].filter(Boolean).join(' — ');

  const urgentRestock = restock.filter((item) => item.priority === 'urgent');
  const urgentForecast = forecastLive.filter((item) => item.coverDays !== undefined && item.coverDays <= LEAD_DAYS);
  const urgentCount = Math.max(urgentRestock.length, urgentForecast.length);
  const urgentSkus = (urgentForecast.length ? urgentForecast.map((item) => item.sku) : urgentRestock.map((item) => item.sku)).slice(0, 5);
  const planAr = [
    urgentCount
      ? `ابدأ بـ ${urgentCount} منتج عاجل: ${urgentSkus.join('، ')}`
      : restock.length
        ? `${restock.length} منتج محتاج إعادة توريد — ابدأ بالمميز والأكثر طلباً`
        : 'مفيش منتجات محتاجة إعادة توريد',
    totals.reorderUnits ? `الكمية المقترحة الإجمالية ${totals.reorderUnits} وحدة على مدة توريد ${LEAD_DAYS} يوم + ${SAFETY_DAYS} يوم أمان` : 'الكميات المقترحة تحتاج مبيعات مؤكدة أو مخزوناً رقمياً',
    familiesOut.length ? `أكمل العائلات الناقصة: ${familiesOut.slice(0, 4).map((family) => family.nameAr).join('، ')}` : 'كل العائلات فيها منتج متوفر',
    sales.orders ? 'راجع التنبؤ بعد كل دورة؛ الأرقام بتتحدث من الطلبات المؤكدة بس' : salesRead ? 'سجّل الطلبات المؤكدة في النظام عشان التنبؤ يشتغل' : 'راجع قراءة سجل الطلبات عشان التنبؤ يشتغل',
  ];

  return {
    version: 1,
    updatedAt: new Date(now).toISOString(),
    sources: {
      catalogAt: catalog?.updatedAt || '',
      total: products.length,
      published: merged.length,
      liveStock: stockRead,
      liveSales: salesRead,
      failed: liveFailed,
      salesBasisAr: !salesRead ? 'سجل الطلبات مش مقروء' : sales.orders ? `طلبات ${SOLD_STATUSES.join('/')} مسجلة في نظام شام` : 'لا توجد مبيعات مؤكدة مسجلة في المدة',
    },
    catalog: {
      published: merged.length,
      inStock: merged.length - catalogOut,
      outOfStock: catalogOut,
      featuredOut,
      newOut,
      families: families.size,
      brands: brands.size,
    },
    stock,
    sales: {
      windowDays: SALES_WINDOW_DAYS,
      orders: sales.orders,
      units: sales.unitsTotal,
      skus: sales.units.size,
      ...(sales.firstAt ? { firstAt: sales.firstAt } : {}),
      ...(sales.lastAt ? { lastAt: sales.lastAt } : {}),
    },
    restockTotal: restock.length,
    restock: restock.slice(0, 60),
    coverage: { familiesOut, brandsOut },
    forecast: {
      basis,
      noteAr,
      methodAr: `متوسط الحركة اليومية = الوحدات المؤكدة ÷ ${SALES_WINDOW_DAYS}؛ تغطية المخزون = المخزون ÷ الحركة؛ إعادة الطلب لما التغطية ≤ ${LEAD_DAYS} يوم توريد + ${SAFETY_DAYS} يوم أمان، والكمية تتقرب لأعلى مضاعف 3.`,
      leadDays: LEAD_DAYS,
      safetyDays: SAFETY_DAYS,
      items: forecastLive,
      totals,
    },
    problems,
    fixes,
    ideas,
    summaryAr,
    planAr,
  };
}

export function isInventoryFile(data: unknown): data is InventoryFile {
  const d = data as InventoryFile;
  return Boolean(d && typeof d === 'object' && d.version === 1 && d.catalog && d.forecast && Array.isArray(d.restock));
}

/** Exported for the run script: the safe shape of the two admin endpoints, without trusting their body. */
export const adminRequests = (body: unknown): AdminRequestLite[] =>
  (Array.isArray(o(body).items) ? o(body).items as unknown[] : []).map((item) => {
    const row = o(item);
    return {
      status: typeof row.status === 'string' ? row.status : undefined,
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : undefined,
      items: (Array.isArray(row.items) ? row.items : []).map((line) => {
        const l = o(line);
        return { sku: typeof l.sku === 'string' ? l.sku : undefined, quantity: n(l.quantity) };
      }),
    };
  });

export const adminProducts = (body: unknown): AdminProductLite[] =>
  (Array.isArray(o(body).items) ? o(body).items as unknown[] : []).map((item) => {
    const row = o(item);
    return { sku: typeof row.sku === 'string' ? row.sku : undefined, stock: n(row.stock), active: row.active !== false };
  });
