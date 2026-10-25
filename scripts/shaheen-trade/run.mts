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
import type { FxTable, ShippingTable } from '../../src/utils/pricing';
import { reviewTrade, type Carrier, type CustomsCountry, type Platform, type TradeAgreement } from './review';

const env = process.env;
const read = (rel: string) => JSON.parse(readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8'));

const lanes = read('src/data/shipping-lanes.json') as { platforms: Platform[]; carriers: Carrier[] };
const customs = read('src/data/customs.json') as { countries: CustomsCountry[]; agreements: TradeAgreement[] };
const shipping = read('src/data/shipping.json') as ShippingTable;
const fx = read('src/data/live/fx-rates.json') as FxTable;
const catalog = read('src/data/products.json') as { products: { ourPrice?: number; supplierPrice?: number; published?: boolean }[] };

// What one bottle earns us, from the catalogue's own two numbers (never a guess).
const sold = (catalog.products || []).filter((p) => p.published !== false && Number(p.ourPrice) > 0 && Number(p.supplierPrice) > 0);
const profitPerBottleEgp = sold.length ? Math.round((sold.reduce((s, p) => s + (Number(p.ourPrice) - Number(p.supplierPrice)), 0) / sold.length) * 100) / 100 : 0;

const report = reviewTrade({
  now: Date.now(),
  platforms: lanes.platforms,
  carriers: lanes.carriers,
  customs,
  shipping,
  fx,
  profitPerBottleEgp,
});

writeFileSync(new URL('../../src/data/live/trade-lanes.json', import.meta.url), `${JSON.stringify(report, null, 1)}\n`);

console.log(report.summaryAr);
for (const line of report.planAr) console.log(`- ${line}`);
for (const note of report.notes) console.log(`! ${note}`);
for (const gap of report.gaps) console.log(`? ${gap.kindAr}: ${gap.whatAr}`);

if (env.GITHUB_STEP_SUMMARY) {
  const rows = report.destinations.map((d) => `| ${d.nameAr} (${d.code}) | ${d.lane} | ${d.carrier?.nameAr || '—'} | ${d.chargedEgp} | ${d.costEgp ? `${d.costEgp[0]}–${d.costEgp[1]}` : '—'} | ${d.verdict} | ${d.customs.verified ? '✅' : '—'} |`);
  const gaps = report.gaps.map((g) => `| ${g.kindAr} | ${g.whatAr} | ${g.fixAr} |`);
  const lines = [
    '## روبوت الشحن والتجارة الدولية',
    '',
    report.summaryAr,
    '',
    `- وساطة (المنصة بتشحن): ${report.modes.platform_ships.products} منتج · إحنا بنشحن: ${report.modes.broker.products} · مش معروف: ${report.modes.unknown.products}`,
    `- الدرجة: ${report.score}/100 · متوسط اللي بنحصّله شحن: ${report.money.averageChargedEgp} EGP`,
    `- وجهات بنحصّل فيها أكتر من التكلفة بكثير: ${report.money.overChargedDestinations} · وجهات بنخسر فيها: ${report.money.lossDestinations}`,
    '',
    '### الخطة',
    report.planAr.map((l) => `- ${l}`).join('\n') || '- لا يوجد',
    '',
    '### الممرات',
    '| الوجهة | الممر | الشركة | بنحصّل (EGP) | التكلفة (EGP) | الحكم | جمارك متأكدة |',
    '|---|---|---|---|---|---|---|',
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
