/**
 * «روبوت الشحن والتجارة الدولية» — GitHub Actions runs it every day:
 *   node --import tsx scripts/shaheen-trade/run.mts   (workflow `.github/workflows/shaheen-trade.yml`)
 *
 * Feeds the pure review (`./review.ts`) with the site's real files — the platforms we resell from and how each one
 * delivers, the carriers with their published bands, the customs table with every figure's source and date, the
 * shipping we charge today and the day's rates — and writes `src/data/live/trade-lanes.json` for «الفحص الشامل»
 * and the council. It arranges nothing and promises nothing on its own.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { convert, handlingFee, shippingCost, type FxTable, type ShippingCosts, type ShippingTable } from '../../src/utils/pricing';
import { reviewTrade, type Carrier, type CustomsCountry, type Platform, type TradeAgreement } from './review';

const env = process.env;
const read = (rel: string) => JSON.parse(readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8'));

const lanes = read('src/data/shipping-lanes.json') as { platforms: Platform[]; carriers: Carrier[] };
const customs = read('src/data/customs.json') as { countries: CustomsCountry[]; agreements: TradeAgreement[] };
const shippingFile = read('src/data/shipping.json') as ShippingTable;
// تكلفة الشحن الحقيقية لكل وجهة = نفس الملف اللي الموقع بيحسب منه، مش نسخة تانية في التقرير.
const existingCosts = read('src/data/shipping-costs.json') as ShippingCosts;
const shipping: ShippingTable = { ...shippingFile, costs: existingCosts };
const fx = read('src/data/live/fx-rates.json') as FxTable;
const catalog = read('src/data/products.json') as {
  products: { ourPrice?: number; supplierPrice?: number; published?: boolean; supplierCurrency?: string; exchangeRate?: number }[];
};

// What one bottle earns us, from the catalogue's own two numbers (never a guess).
const sold = (catalog.products || []).filter((p) => p.published !== false && Number(p.ourPrice) > 0 && Number(p.supplierPrice) > 0);
const profitPerBottleEgp = sold.length ? Math.round((sold.reduce((s, p) => s + (Number(p.ourPrice) - Number(p.supplierPrice)), 0) / sold.length) * 100) / 100 : 0;

// The rate every supplier price was converted with, straight from the import file — the catalogue's own memory of it.
const rateGroups = new Map<string, { rateUsed: number; products: number; weight: Map<number, number> }>();
for (const p of catalog.products || []) {
  const currency = String(p.supplierCurrency || '').toUpperCase();
  const rate = Number(p.exchangeRate);
  if (!currency || !(rate > 0)) continue;
  const g = rateGroups.get(currency) || { rateUsed: rate, products: 0, weight: new Map<number, number>() };
  g.products += 1;
  g.weight.set(rate, (g.weight.get(rate) || 0) + 1);
  rateGroups.set(currency, g);
}
const ratesUsed = [...rateGroups.entries()].map(([currency, g]) => {
  // The rate most of the products were actually priced with.
  const rateUsed = [...g.weight.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return { currency, rateUsed, products: g.products };
});

const report = reviewTrade({
  now: Date.now(),
  platforms: lanes.platforms,
  carriers: lanes.carriers,
  customs,
  shipping,
  fx,
  profitPerBottleEgp,
  ratesUsed,
});

writeFileSync(new URL('../../src/data/live/trade-lanes.json', import.meta.url), `${JSON.stringify(report, null, 1)}\n`);

// ── «الشحن بسعره الحقيقي»: جدول تكلفة الشحن لكل وجهة، بيتكتب من التقرير نفسه ────────────────────────────
// الموقع بيقراه (`src/utils/pricing.ts`) ويحسب اللي بيتحصّل = التكلفة + هامش التجهيز اللي صاحب المتجر حاطه.
// الرقم هنا مبني على تعريفة منشورة بتاريخها (كارير الوجهة في التقرير) — مفيش رقم بيتألف.
const round2 = (n: number) => Math.round(n * 100) / 100;
const costs: {
  version: 1; currency: string; source: string; checkedAt: string; noteAr: string;
  countries: Record<string, { firstItem: number; extraItem: number; carrier: string }>;
} = {
  version: 1,
  currency: 'USD',
  source: 'تعريفة كل شركة في src/data/shipping-lanes.json (رابط المصدر وتاريخ الفحص مع كل شركة) + وقود إن وُجد',
  checkedAt: new Date(report.updatedAt).toISOString().slice(0, 10),
  noteAr: 'تكلفة الشحن الحقيقية لأول زجاجة (أول ٥٠٠ جم) لكل وجهة، بالدولار، من تعريفة منشورة. الملف ده بيتولّد من تقرير الشحن — متعدّلوش بإيدك؛ عدّل الهامش في shipping.json والشركات في shipping-lanes.json.',
  countries: {},
};
for (const d of report.destinations) {
  if (!d.costEgp || !d.assumedLane || !d.carrier) continue;
  const usd = (egp: number) => round2(egp / (fx.rates.EGP || 1));
  costs.countries[d.code] = {
    firstItem: usd(d.costEgp[0]),
    extraItem: usd(d.costExtraEgp ?? d.costEgp[0]),
    carrier: d.carrier.id,
  };
}
writeFileSync(new URL('../../src/data/shipping-costs.json', import.meta.url), `${JSON.stringify(costs, null, 1)}\n`);

// ── «الـ50% تفضل صافية»: الشحن بسعره الحقيقي + هامش التجهيز، محسوب بمحرك السعر نفسه ──────────────────
// الأرقام دي هي اللي الزائر هيشوفها بعد التعديل، مش حساب في تقرير لوحده.
const costTable: ShippingCosts = { version: 1, currency: costs.currency, source: costs.source, checkedAt: costs.checkedAt, countries: costs.countries };
const priced = report.destinations.filter((d) => costTable.countries[d.code]);
const liveTable: ShippingTable = { ...shipping, costs: costTable };
const chargedAfter = priced.map((d) => ({ d, chargedEgp: convert(shippingCost(d.code, 1, liveTable), shipping.currency, 'EGP', fx) }));
const feeEgp = (code: string) => {
  const real = costTable.countries[code].firstItem;
  return convert(handlingFee(real, shipping), shipping.currency, 'EGP', fx);
};
const netOf = (d: (typeof priced)[number], chargedEgp: number) => report.money.profitPerBottleEgp + chargedEgp - (d.costEgp ? d.costEgp[0] : chargedEgp);

console.log(report.summaryAr);
for (const line of report.planAr) console.log(`- ${line}`);
for (const note of report.notes) console.log(`! ${note}`);
for (const gap of report.gaps) console.log(`? ${gap.kindAr}: ${gap.whatAr}`);

// الجدول اللي بيجاوب على سؤاله: الشحن بكام، والمكسب الصافي كام.
console.log('\n====== الشحن بعد التعديل: تكلفة حقيقية + هامش تجهيز ======');
for (const zone of report.shippingProposal) {
  const inZone = chargedAfter.filter((x) => zone.destinations.some((z) => z.code === x.d.code));
  if (!inZone.length) continue;
  const avg = Math.round((inZone.reduce((s, x) => s + x.chargedEgp, 0) / inZone.length) * 100) / 100;
  const worstNet = Math.min(...inZone.map((x) => netOf(x.d, x.chargedEgp)));
  console.log(`${zone.nameAr}: ${inZone.length} وجهة · الشحن بيبدأ من ${Math.round(Math.min(...inZone.map((x) => x.chargedEgp)))} ج.م (متوسط ${Math.round(avg)} ج.م) · أضعف مكسب صافي للزجاجة ${Math.round(worstNet)} ج.م (${Math.round((worstNet / (report.money.profitPerBottleEgp / 0.5)) * 100)}% من التكلفة)`);
}
const guaranteed = chargedAfter.filter((x) => netOf(x.d, x.chargedEgp) >= report.money.profitPerBottleEgp * 0.999).length;
const noRate = report.destinations.filter((d) => !costTable.countries[d.code]);
console.log(`✔ الـ50% صافية في ${guaranteed} من ${priced.length} وجهة عندها تعريفة منشورة · متوسط هامش التجهيز ${report.money.medianShippingMarginEgp} ج.م للطرد`);
if (noRate.length) console.log(`? ${noRate.length} وجهة مفيهاش تعريفة منشورة (${noRate.map((d) => d.nameAr).join('، ')}) — سعر المنطقة بيفضل، ومافيش وعد إنه يغطي التكلفة.`);

if (env.GITHUB_STEP_SUMMARY) {
  const rows = report.destinations.map((d) => `| ${d.nameAr} (${d.code}) | ${d.lane} | ${d.assumedOrigin || '—'} | ${d.carrier?.nameAr || '—'} | ${d.chargedEgp} | ${d.costEgp ? `${d.costEgp[0]}–${d.costEgp[1]}` : '—'} | ${d.costVerdict} | ${d.promise} | ${d.customs.verified ? '✅' : '—'} |`);
  const gaps = report.gaps.map((g) => `| ${g.kindAr} | ${g.whatAr} | ${g.fixAr} |`);
  const originRows = report.origins.map((o) => `| ${o.nameAr} (${o.code}) | ${o.products} | ${o.platforms.join('، ')} | ${o.localCarrier ? `${o.localCarrier.nameAr}${o.localCarrier.priceEgp ? ` ${o.localCarrier.priceEgp[0]}–${o.localCarrier.priceEgp[1]} ج.م` : ' (مفيش سعر منشور)'}` : '—'} |`);
  const fxRows = report.fx.lines.map((l) => `| ${l.currency} | ${l.rateUsed} | ${l.rateToday} | ${l.driftPercent > 0 ? '+' : ''}${l.driftPercent}% | ${l.products} |`);
  // «مكسبنا 50% تكون صافية»: الشحن الحقيقي مقابل اللي بنحصّله، والقرار لصاحب المتجر.
  const priceRows = report.shippingProposal.map((z) => `| ${z.nameAr} | ${z.countries} | ${z.currentFirstItem} ${z.currency} | ${z.typicalRequiredFirstItem} ${z.currency} | ${z.maxRequiredFirstItem} ${z.currency} | ${z.drivenByAr || '—'} |`);
  const lines = [
    '## روبوت الشحن والتجارة الدولية',
    '',
    report.summaryAr,
    '',
    `- وساطة (المنصة بتشحن): ${report.modes.platform_ships.products} منتج · إحنا بنشحن: ${report.modes.broker.products} · مش معروف: ${report.modes.unknown.products}`,
    `- الدرجة: ${report.score}/100 · متوسط اللي بنحصّله شحن: ${report.money.averageChargedEgp} EGP`,
    `- وجهات بنحصّل فيها أكتر من التكلفة بكثير: ${report.money.overChargedDestinations} · وجهات بنخسر فيها: ${report.money.lossDestinations}`,
    `- الـ50% صافية في: ${report.money.keptWholeDestinations} وجهة · الشحن بياكل منها في: ${report.money.marginEatenDestinations} · الطلب بخسارة في: ${report.money.orderLossDestinations}`,
    `- الشحن بسعره الحقيقي + هامش في ${report.money.costBasedDestinations} وجهة (متوسط الهامش ${report.money.medianShippingMarginEgp} ج.م) · ${report.money.uncoveredDestinations} وجهة بأسعار المنطقة`,
    '',
    '### البضاعة فين',
    '| البلد | عدد المنتجات | المنصات | شركة محلية |',
    '|---|---|---|---|',
    originRows.join('\n') || '| — | — | — | — |',
    ...(fxRows.length ? ['', '### سعر الصرف اللي السعر مبني عليه', '| العملة | السعر المستخدم | سعر النهاردة | الفرق | منتجات |', '|---|---|---|---|---|', fxRows.join('\n')] : []),
    '',
    '### الشحن الحقيقي مقابل اللي بنحصّله (القرار لصاحب المتجر)',
    '| المنطقة | دول | بنحصّل | المتوسط الحقيقي | الأقصى الحقيقي | أغلى وجهة |',
    '|---|---|---|---|---|---|',
    priceRows.join('\n') || '| — | — | — | — | — | — |',
    '',
    '### الخطة',
    report.planAr.map((l) => `- ${l}`).join('\n') || '- لا يوجد',
    '',
    '### الممرات',
    '| الوجهة | الممر | من بلد | الشركة | بنحصّل (EGP) | التكلفة (EGP) | الحكم | الوعد | جمارك متأكدة |',
    '|---|---|---|---|---|---|---|---|---|',
    rows.join('\n'),
    '',
    '### الناقص',
    '| النوع | إيه الناقص | الإصلاح |',
    '|---|---|---|',
    gaps.join('\n') || '| — | — | — |',
  ];
  writeFileSync(env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, { flag: 'a' });
}
if (env.GITHUB_ACTIONS) {
  const clip = (t: string) => t.replace(/[\r\n%]/g, ' ').slice(0, 2800);
  console.log(`::notice title=Shaheen trade lanes::${clip(report.summaryAr)}`);
  if (report.money.lossDestinations) console.log(`::warning title=Shaheen trade lanes::${clip(`${report.money.lossDestinations} وجهة الشحن فيها بيخسر`)}`);
  if (report.modes.unknown.products) console.log(`::warning title=Shaheen trade lanes::${clip(`${report.modes.unknown.products} منتج من منصة طريقة تسليمها مش مسجلة — مفيش وعد توصيل`)}`);
}
