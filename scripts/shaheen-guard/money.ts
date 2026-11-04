/**
 * «حارس الفلوس» — a strict audit of the payment machinery, not a description of it.
 *
 * The owner's question (2026-10-26): «تشيك كامل على آليات الدفع والأخطاء اللي بنقع فيها». So this robot checks two
 * things every day, and refuses to be satisfied by a promise in a comment:
 *
 *  1. **الحمايات لسه في الكود** — a list of invariants, each one proved by a code pattern that must still exist in the
 *     file that protects it: prices recomputed on the server, the ledger written *before* a payment page opens, the
 *     webhook signature verified and the provider re-read, one sale per order, no card secret touching our server,
 *     the guard standing in front of the money, and a refund that can never be added automatically. If somebody
 *     refactors one of them away, this audit fails the next morning instead of the mistake reaching a visitor.
 *  2. **البيانات اللي السعر بيقف عليها** — rate age, destinations priced from a zone instead of a carrier, customs
 *     still unverified, and the currency the gateway will really charge in each country.
 *
 * What it never does: change a price, promise a delivery time, or call a finding a bug before it is proved from a
 * real file. Findings say what happened, why, and the exact fix (`src/utils/rapidFix.ts` turns them into a queue).
 */
import type { FxTable, ShippingTable } from '../../src/utils/pricing';
import { chargeCurrency, convert, currencyFor, realShipping, shippingZone } from '../../src/utils/pricing';
import { FAULTS } from '../../src/finance/errors';

export type MoneyLevel = 'fail' | 'warn' | 'note';

export interface MoneyFinding {
  id: string;
  level: MoneyLevel;
  whatAr: string;
  whyAr: string;
  fixAr: string;
  /** The file, or the data table, the finding is about. */
  where: string;
}

export interface MoneyAudit {
  version: 1;
  agent: 'money_guard';
  updatedAt: string;
  score: number;
  counts: { fail: number; warn: number; note: number; ok: number };
  /** Every protection, proved or missing. */
  invariants: { id: string; ar: string; ok: boolean; where: string }[];
  findings: MoneyFinding[];
  /** What the gateway really charges, per destination — the number the visitor must be told. */
  currencies: { code: string; nameAr: string; official: string; charge: string; fallback: boolean; priced: boolean; carrierRate: boolean }[];
  summaryAr: string;
  planAr: string[];
}

const DAY = 86_400_000;

/**
 * Each invariant is one thing that must stay true for money to be safe. `proof` is searched in `where`; a missing
 * proof is a `fail` — the protection is gone (or was renamed and must be re-proved).
 */
export const PAYMENT_INVARIANTS: {
  id: string; ar: string; en: string; where: string; proof: RegExp; level: MoneyLevel;
}[] = [
  { id: 'SERVER_PRICES', ar: 'الأسعار بتتحسب على السيرفر من الكتالوج — سعر المتصفح مايتبناش عليه', en: 'Prices are recomputed on the server', where: 'server/checkout.ts', proof: /await priceItems\(input\)/, level: 'fail' },
  { id: 'QUOTED_TOTAL', ar: 'المبلغ اللي الزائر شافه بيتقارن بالمبلغ اللي هيتخصم — مفيش خصم بسعر مختلف في السكوت', en: 'The quoted total is compared with the charge', where: 'server/checkout.ts', proof: /PRICE_CHANGED/, level: 'fail' },
  { id: 'SUPPLIER_COST', ar: 'حارس المدفوعات عارف تكلفة المورد — يعرف يكشف بيع تحت التكلفة', en: 'The guard knows the supplier cost', where: 'server/checkout.ts', proof: /supplierCost:/, level: 'warn' },
  { id: 'GUARD_BEFORE_MONEY', ar: 'حارس المدفوعات بيقف قبل تسجيل الطلب وقبل فتح صفحة الدفع', en: 'The payment guard stands before any money moves', where: 'server/checkout.ts', proof: /reviewCharge\(/, level: 'fail' },
  { id: 'LEDGER_FIRST', ar: 'الطلب بيتسجل في السجل المالي قبل ما صفحة الدفع تفتح', en: 'The order is recorded before the payment page opens', where: 'server/checkout.ts', proof: /await finance\.recordOrder\(/, level: 'fail' },
  { id: 'WEBHOOK_SIGNATURE', ar: 'الويبهوك بيتحقق بتوقيع HMAC قبل أي تصديق', en: 'The webhook signature is verified', where: 'server/checkout.ts', proof: /verifyWebhook\(data, signature, cfg\.apiKey\)/, level: 'fail' },
  { id: 'PROVIDER_REREAD', ar: 'حالة الدفع بتتقرا من البوابة نفسها، مش من المتصفح ولا من الويبهوك وحده', en: 'The payment state is re-read from the provider', where: 'server/checkout.ts', proof: /await sessionPayment\(cfg/, level: 'fail' },
  { id: 'AMOUNT_MATCH', ar: 'المبلغ والعملة والجلسة بيتطابقوا مع الطلب قبل أي تأكيد', en: 'Amount, currency and session must match the order', where: 'server/finance/service.ts', proof: /PAYMENT_MISMATCH/, level: 'fail' },
  { id: 'ONE_SALE', ar: 'بيعة واحدة لكل طلب — مفتاح واحد بيتقفل، فمفيش إيراد مكرر', en: 'One sale per order (atomic key)', where: 'server/finance/service.ts', proof: /financeId\('sale'/, level: 'fail' },
  { id: 'DURABLE_LEDGER', ar: 'الدفع الحي متوقف لو السجل مش دائم — مفيش فلوس بلا ذاكرة', en: 'Live payment needs a durable ledger', where: 'server/finance/service.ts', proof: /FINANCE_STORAGE_REQUIRED/, level: 'fail' },
  { id: 'NO_CARD_SECRET', ar: 'سر الكارت مايوصلش سيرفرنا أبداً (الحقول المستضافة عند البوابة)', en: 'Card secrets never reach our server', where: 'src/utils/cardNetwork.ts', proof: /export function containsCardSecret/, level: 'fail' },
  { id: 'SAFE_REDIRECT', ar: 'الرجوع من البوابة لنطاقات الموقع بس (قائمة مسموحة)', en: 'The provider may only redirect to our own origins', where: 'server/checkout.ts', proof: /safeReturnUrl\(input\.returnUrl, allowed\)/, level: 'fail' },
  { id: 'SAFE_SESSION_URL', ar: 'رابط صفحة الدفع لازم يكون نطاق البوابة نفسه', en: 'The payment URL must be the provider’s own domain', where: 'src/utils/storeCheckout.ts', proof: /payments\.kashier\.io/, level: 'fail' },
  { id: 'RATE_LIMIT', ar: 'حد معدل على الدفع والمطابقة — ضد التكرار والاحتيال', en: 'Rate limits on checkout and verification', where: 'server/checkout.ts', proof: /new RateLimiter\(/, level: 'fail' },
  { id: 'SIGN_IN_RULE', ar: 'البطاقة والمحفظة بحساب مؤكد من السيرفر؛ المباشر للزائر', en: 'Card and wallet need a verified account', where: 'server/checkout.ts', proof: /signedIn\(req, res\)/, level: 'fail' },
  { id: 'NO_AUTO_REFUND', ar: 'مفيش استرداد أو تغيير حالة دفع تلقائي — القرار والكشف البشري', en: 'No automatic refunds or status changes', where: 'server/finance/service.ts', proof: /INVALID_ENTRY_KIND/, level: 'fail' },
  { id: 'IDEMPOTENT_BOOKS', ar: 'كل قيد مالي بمفتاح منع تكرار', en: 'Every ledger entry is idempotent', where: 'server/finance/service.ts', proof: /INVALID_IDEMPOTENCY_KEY/, level: 'fail' },
  { id: 'TEST_MODE_VISIBLE', ar: 'الوضع التجريبي بيتقال صريح للزائر — مش تحصيل حقيقي', en: 'Test mode is labelled for the visitor', where: 'server/finance/service.ts', proof: /TEST_MODE/, level: 'warn' },
];

export interface MoneyInput {
  now: number;
  fx: FxTable;
  shipping: ShippingTable;
  destinations: {
    code: string; nameAr: string;
    carrierNameAr: string | null; carrierCheckedAt: string | null;
    customsVerified: boolean; vatPercent: number | null;
  }[];
  gateway: { enabled: boolean; mode?: string; currencies: string[] };
  /** The real source files, as text — the audit reads the guards themselves. */
  sources: Record<string, string>;
  /** How many products sell below cost × 1.5 (the merchant's own rule). */
  belowCost: number;
  /** How old the rate table may get before it becomes a finding. */
  fxWarnDays?: number;
  fxFailDays?: number;
}

/** Is the protection still in the code? Reads the file, not the comment. */
export function auditInvariants(sources: Record<string, string>): { id: string; ar: string; ok: boolean; where: string }[] {
  return PAYMENT_INVARIANTS.map((inv) => {
    const text = sources[inv.where] || '';
    return { id: inv.id, ar: inv.ar, ok: inv.proof.test(text), where: inv.where };
  });
}

/**
 * The order of two steps in the same file: the guard and the ledger entry must both happen before the payment page
 * opens. A refactor that moves one of them below `createSession` reopens the hole this audit exists to keep shut.
 */
export function orderOfSteps(source: string): { guard: number; ledger: number; session: number } {
  const at = (needle: string) => source.indexOf(needle);
  return { guard: at('reviewCharge('), ledger: at('await finance.recordOrder('), session: at('await createSession(') };
}

export function auditMoney(input: MoneyInput): MoneyAudit {
  const findings: MoneyFinding[] = [];
  const add = (f: MoneyFinding) => findings.push(f);
  const invariants = auditInvariants(input.sources);
  const checkout = input.sources['server/checkout.ts'] || '';
  const steps = orderOfSteps(checkout);

  for (const inv of invariants) {
    if (inv.ok) continue;
    const spec = PAYMENT_INVARIANTS.find((i) => i.id === inv.id)!;
    add({
      id: `inv:${inv.id}`, level: spec.level, where: inv.where,
      whatAr: `حماية ناقصة: ${spec.ar}`,
      whyAr: `الدليل على الحماية (${spec.proof}) مش موجود في ${inv.where} — يعني الحماية اتشالت أو اتغير اسمها.`,
      fixAr: 'رجّع الحماية أو أثبت الجديدة بنمط واضح، وبعدها شغّل «حارس الفلوس» تاني.',
    });
  }

  // الترتيب: الحارس ← السجل ← صفحة الدفع. لو الترتيب اتقلب، فلوس ممكن تتحرك قبل التسجيل.
  if (steps.guard >= 0 && steps.ledger >= 0 && steps.guard > steps.ledger) {
    add({ id: 'order:guard', level: 'fail', where: 'server/checkout.ts', whatAr: 'حارس المدفوعات بقى بعد تسجيل الطلب', whyAr: 'المراجعة لازم تكون قبل أي قفل في السجل، مش بعده.', fixAr: 'قدّم `reviewCharge` فوق `recordOrder`.' });
  }
  if (steps.ledger >= 0 && steps.session >= 0 && steps.ledger > steps.session) {
    add({ id: 'order:ledger', level: 'fail', where: 'server/checkout.ts', whatAr: 'صفحة الدفع بتفتح قبل تسجيل الطلب', whyAr: 'كده ممكن فلوس تتحصّل من غير سجل مالي يطابقها (UNTRACKED_PAYMENT).', fixAr: 'السجل أولاً، وصفحة الدفع بعده.' });
  }

  // عمر أسعار الصرف: كل سعر غير الجنيه المصري مبني عليه.
  const fxAt = Date.parse(String(input.fx.updatedAt || ''));
  const fxDays = Number.isFinite(fxAt) ? Math.floor((input.now - fxAt) / DAY) : null;
  const warnDays = input.fxWarnDays ?? 3;
  const failDays = input.fxFailDays ?? 10;
  if (fxDays === null) {
    add({ id: 'fx:unknown', level: 'warn', where: 'src/data/live/fx-rates.json', whatAr: 'تاريخ أسعار الصرف مش مقروء', whyAr: 'كل سعر بعملة غير الجنيه مبني على الجدول ده؛ من غير تاريخ مفيش دقة.', fixAr: 'الروبوت اليومي يكتب `updatedAt` مع كل تحديث.' });
  } else if (fxDays >= failDays) {
    add({ id: 'fx:stale', level: 'fail', where: 'src/data/live/fx-rates.json', whatAr: `أسعار الصرف بقالها ${fxDays} يوم`, whyAr: `أي سعر خارج مصر اتحسب بجدول أقدم من ${failDays} أيام — الفرق ممكن يبقى أكبر من الهامش.`, fixAr: 'حدّث أسعار الصرف دلوقتي (مصدرها مكتوب في الملف)، وبعدها السعر يتعيد.' });
  } else if (fxDays >= warnDays) {
    add({ id: 'fx:aging', level: 'warn', where: 'src/data/live/fx-rates.json', whatAr: `أسعار الصرف بقالها ${fxDays} يوم`, whyAr: `الجدول بيتحدث يومياً؛ ${fxDays} يوم يعني التحديث وقف.`, fixAr: 'راجع تشغيل تحديث أسعار الصرف.' });
  }

  // العملة اللي البوابة هتخصم بيها فعلاً لكل وجهة — ده الرقم اللي الزائر لازم يشوفه.
  const currencies = input.destinations.map((d) => {
    const official = currencyFor(d.code, input.fx);
    const charge = input.gateway.currencies.length ? chargeCurrency(official, input.gateway.currencies) : official;
    const carrier = realShipping(d.code, 1, input.shipping) !== null;
    return { code: d.code, nameAr: d.nameAr, official, charge, fallback: charge !== official, priced: Boolean(realShipping(d.code, 1, input.shipping) ?? shippingZone(d.code, input.shipping)), carrierRate: carrier };
  });
  const fallbackTo = (currency: string) => currencies.filter((c) => c.fallback && c.charge === currency).length;
  if (input.gateway.enabled) {
    const fallbackCount = currencies.filter((c) => c.fallback).length;
    if (fallbackCount) {
      const egp = fallbackTo('EGP');
      add({
        id: 'fx:fallback', level: 'warn', where: 'src/data/live/trade-lanes.json',
        whatAr: `${fallbackCount} وجهة البوابة هتخصم منها بعملة غير عملتها (${egp} منهم بالجنيه)`,
        whyAr: 'البوابة بتقبل عملات محدودة؛ الباقي بيتحول للجنيه أو الدولار — والزائر لازم يشوف مبلغ الخصم الحقيقي قبل الدفع.',
        fixAr: 'الواجهة بتعرض مبلغ الخصم وعملته (موجود)، ولو العملة الأصلية مقبولة من البوابة تتضاف لإعداداتها.',
      });
    }
  } else {
    add({
      id: 'gateway:off', level: 'note', where: 'server/core/kashier.ts',
      whatAr: 'البوابة الأونلاين مش مفعّلة في البيئة دي — الدفع المباشر هو المسار الشغال',
      whyAr: 'من غير مفاتيح، السيرفر بيرفض فتح جلسة دفع ويرجّع PAYMENTS_NOT_CONFIGURED (وهو سلوك صح).',
      fixAr: 'مش مشكلة كود: مفاتيح كاشير وقرار الوضع الحي بيتظبطوا في إعدادات النشر بقرار صاحب المتجر.',
    });
  }

  const unverified = input.destinations.filter((d) => !d.customsVerified || d.vatPercent === null).length;
  if (unverified) add({
    id: 'customs:unverified', level: 'warn', where: 'src/data/customs.json',
    whatAr: `${unverified} وجهة جمركها لسه مش مؤكد`, whyAr: 'السعر بيتبني على الشحن، لكن اللي العميل هيدفعه جمرك في بلده مش موثّق — والزائر لازم يسمع «بتتأكد قبل الدفع».',
    fixAr: '«كشّاف الشحن» يجيب مصدر جمرك لكل وجهة، ولحد ما يتأكد النص يفضل صريح.',
  });
  const zonePriced = currencies.filter((c) => !c.carrierRate).length;
  if (zonePriced) add({
    id: 'shipping:zone', level: 'note', where: 'src/data/shipping.json',
    whatAr: `${zonePriced} وجهة سعرها من جدول المناطق مش من تعريفة شركة منشورة`,
    whyAr: 'ده سعر تقديري (بديل محسوب)، مش تعريفة شركة — ممكن يطلع أرخص أو أغلى من الحقيقي.',
    fixAr: 'الانعكاس بيقول «تقديري وبيتأكد قبل الدفع»؛ التعريفة الحقيقية تتحفظ في `shipping-lanes.json` بمصدرها.',
  });
  const staleCarrier = input.destinations.filter((d) => {
    const at = Date.parse(String(d.carrierCheckedAt || ''));
    return Number.isFinite(at) && (input.now - at) / DAY > 120;
  }).length;
  if (staleCarrier) add({
    id: 'carrier:stale', level: 'warn', where: 'src/data/shipping-lanes.json',
    whatAr: `${staleCarrier} تعريفة شركة بقالها أكتر من 120 يوم`, whyAr: 'التعريفة القديمة بتاكل الهامش من غير ما حد ياخد باله.',
    fixAr: '«كشّاف الشحن» يعيد فحص التعريفة من صفحة الشركة ويحدّث تاريخها.',
  });
  if (input.belowCost) add({
    id: 'price:below-cost', level: 'note', where: 'src/data/products.json',
    whatAr: `${input.belowCost} منتج سعره أقل من قاعدة صاحب المتجر (التكلفة × 1.5)`,
    whyAr: 'الهامش الصافي مضمون على الشحن، لكن على سعر المنتج نفسه القاعدة مش محققة — والقرار قرار صاحب المتجر.',
    fixAr: 'يتراجع السعر أو يثبت استثناء مكتوب من صاحب المتجر؛ الحارس بينبّه (warn) مش بيوقف البيع.',
  });

  // الكود مقابل القاموس: أي كود خطأ في مسار الفلوس لازم يكون له تفسير عربي ثابت.
  const used = new Set<string>();
  for (const text of Object.values(input.sources)) {
    for (const m of text.matchAll(/code:?\s*[:=]\s*'([A-Z][A-Z_]{2,})'/g)) used.add(m[1]);
    for (const m of text.matchAll(/error\('([A-Z][A-Z_]{2,})'/g)) used.add(m[1]);
    for (const m of text.matchAll(/KashierError\('([A-Z][A-Z_]{2,})'/g)) used.add(m[1]);
  }
  const known = new Set(FAULTS.map((f) => f.code));
  const unexplained = [...used].filter((c) => !known.has(c) && !['SALE', 'REFUND', 'COST', 'FEE', 'TAX'].includes(c));
  if (unexplained.length) add({
    id: 'codes:missing', level: 'fail', where: 'src/finance/errors.ts',
    whatAr: `${unexplained.length} كود خطأ في مسار الدفع من غير تفسير عربي`,
    whyAr: `الزائر بيشوف «${unexplained[0]}» ومش فاهم حاجة، والإدارة مش عارفة تعمل إيه.`,
    fixAr: 'كل كود بيتضاف لقاموس `src/finance/errors.ts` بنصه وإصلاحه.',
  });

  const counts = { fail: 0, warn: 0, note: 0, ok: 0 };
  for (const f of findings) counts[f.level] += 1;
  counts.ok = invariants.filter((i) => i.ok).length;
  const score = Math.max(0, Math.min(100, 100 - counts.fail * 12 - counts.warn * 4 - counts.note * 1));
  const fails = findings.filter((f) => f.level === 'fail');
  const warns = findings.filter((f) => f.level === 'warn');

  return {
    version: 1, agent: 'money_guard', updatedAt: new Date(input.now).toISOString(),
    score, counts, invariants, findings, currencies,
    summaryAr: fails.length
      ? `حارس الفلوس: ${fails.length} ثغرة لازم تتقفل · ${counts.ok} حماية متأكدة من ${invariants.length}`
      : `حارس الفلوس: ${counts.ok}/${invariants.length} حماية متأكدة · ${warns.length} ملاحظة · النتيجة ${score}/100`,
    planAr: [
      ...fails.slice(0, 4).map((f) => `${f.whatAr} — ${f.fixAr}`),
      ...warns.slice(0, 3).map((f) => `ملاحظة: ${f.whatAr} — ${f.fixAr}`),
      ...(fails.length || warns.length ? [] : ['مفيش حاجة مفتوحة: كل الحمايات موجودة وبيانات السعر محدثة.']),
    ],
  };
}

export const isMoneyAudit = (v: unknown): v is MoneyAudit => {
  const a = v as MoneyAudit | undefined;
  return Boolean(a && a.version === 1 && a.agent === 'money_guard' && typeof a.score === 'number' && Array.isArray(a.findings));
};

/** The number the visitor must see before paying: what his country's money is, and what the gateway will charge. */
export function chargeLineFor(code: string, fx: FxTable, accepted: string[]): { official: string; charge: string; differs: boolean } {
  const official = currencyFor(code, fx);
  const charge = accepted.length ? chargeCurrency(official, accepted) : official;
  return { official, charge, differs: charge !== official };
}

/** A quick sanity figure for the merchant: what one bottle costs him in EGP at today's rates. */
export const inEgp = (usd: number, fx: FxTable) => Math.round(convert(usd, 'USD', 'EGP', fx));

// ─────────────────────────────────────────────────────────────────────────────
//  Standalone run: one audit a day, writes src/data/live/money-audit.json
//    node --import tsx scripts/shaheen-guard/money.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs';

const read = (rel: string) => JSON.parse(readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8'));

function readSources(): Record<string, string> {
  const want = ['server/checkout.ts', 'server/finance/service.ts', 'src/utils/cardNetwork.ts',
    'src/utils/storeCheckout.ts'];
  const out: Record<string, string> = {};
  for (const w of want) {
    try { out[w] = readFileSync(new URL(`../../${w}`, import.meta.url), 'utf8'); }
    catch { out[w] = ''; }
  }
  return out;
}

const now = Date.now();
const fx = read('src/data/live/fx-rates.json') as { updatedAt?: string; rates: Record<string, number> };
const shipping = { ...(read('src/data/shipping.json') as { costs?: unknown }), costs: read('src/data/shipping-costs.json') };
const trade = read('src/data/live/trade-lanes.json') as {
  destinations: { code: string; nameAr: string; carrier?: { id?: string; nameAr?: string; source?: string | null; checkedAt?: string } | null; customs: { verified: boolean; vatPercent: number | null } }[];
};
const customs = read('src/data/customs.json') as { countries?: Record<string, { vatPercent?: number }> };
const products = read('src/data/products.json') as { products: { sku: string; supplierPrice?: number; ourPrice?: number }[] };
const gateway = { enabled: false, mode: 'test', currencies: ['EGP'] as string[] };

const belowCost = products.products.filter((p) => {
  if (!(typeof p.supplierPrice === 'number' && p.supplierPrice > 0 && typeof p.ourPrice === 'number' && p.ourPrice > 0)) return false;
  return p.ourPrice < p.supplierPrice * 1.5;
}).length;

const destinations = trade.destinations.map((d) => {
  const c = customs.countries?.[d.code];
  const checkedAt = d.carrier?.checkedAt || shipping.costs?.checkedAt || null;
  return {
    code: d.code, nameAr: d.nameAr,
    carrierNameAr: d.carrier?.nameAr || null,
    carrierCheckedAt: checkedAt || null,
    customsVerified: Boolean(d.customs.verified),
    vatPercent: d.customs.vatPercent ?? (c?.vatPercent ?? null),
  };
});

const audit = auditMoney({
  now, fx, shipping, destinations,
  gateway,
  sources: readSources(),
  belowCost,
  fxWarnDays: 3, fxFailDays: 10,
});

writeFileSync(new URL('../../src/data/live/money-audit.json', import.meta.url), `${JSON.stringify(audit, null, 1)}\n`);
console.log(audit.summaryAr);
for (const line of audit.planAr) console.log(`- ${line}`);
