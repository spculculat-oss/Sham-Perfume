/**
 * «روبوت مراجعة المنتجات» — GitHub Actions runs it every day: node --import tsx scripts/shaheen-catalog/run.mts
 * (workflow `.github/workflows/shaheen-catalog-review.yml`).
 *
 * Feeds the pure review (`./review.ts`) with the site's real files — every product in src/data/products.json, the
 * shipping table, the day's rates, the merchant's approved free-shipping threshold — and writes
 * `src/data/live/catalog-review.json` for «الفحص الشامل» and the council. It changes no price and no product.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import type { RawProduct } from '../../src/utils/storeCatalog';
import type { FxTable, ShippingTable } from '../../src/utils/pricing';
import { freeShippingAbove } from '../../src/utils/pricing';
import type { PriceRule } from '../shaheen-import/transform';
import { reviewCatalog } from './review';

const env = process.env;
const read = (rel: string) => JSON.parse(readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8'));
const positive = (v?: string) => (Number(v) > 0 ? Number(v) : undefined);

const products = (read('src/data/products.json').products || []) as RawProduct[];
const shipping = read('src/data/shipping.json') as ShippingTable;
const fx = read('src/data/live/fx-rates.json') as FxTable;
// The merchant's price rule — the same repository variables «مستورد شاهين» priced with (defaults: ×1.5).
const priceRule: PriceRule = {
  markup: Number(env.IMPORT_MARKUP) >= 1 ? Number(env.IMPORT_MARKUP) : 1.5,
  shippingEgp: positive(env.IMPORT_SHIPPING_EGP),
  maxProfitEgp: positive(env.IMPORT_MAX_PROFIT_EGP),
};

const report = reviewCatalog({
  now: Date.now(),
  products,
  shipping,
  fx,
  homeCountry: env.SHAM_HOME_COUNTRY || 'EG',
  freeShippingAboveEgp: freeShippingAbove(shipping),
  priceRule,
});

writeFileSync(new URL('../../src/data/live/catalog-review.json', import.meta.url), `${JSON.stringify(report, null, 1)}\n`);

console.log(report.summaryAr);
for (const line of report.planAr) console.log(`- ${line}`);
for (const note of report.notes) console.log(`! ${note}`);

if (env.GITHUB_STEP_SUMMARY) {
  const below = report.belowShipping.slice(0, 12).map((p) => `| ${p.sku} | ${p.price} | ${p.shippingEgp} | ${p.sellable ? 'معروض' : 'نفد'} |`);
  const zones = report.freeShipping.zones.map((z) => `| ${z.nameAr} | ${z.shippingEgp} | ${z.safeOrderEgp} | ${z.productsAbove} |`);
  const lines = [
    '## روبوت مراجعة المنتجات',
    '',
    report.summaryAr,
    '',
    `- المنتجات: ${report.counts.products} · معروض: ${report.counts.onSale} · مخفي: ${report.counts.hidden}`,
    `- الدرجة: ${report.score}/100 · نفد المخزون: ${report.counts.outOfStock}`,
    `- الأسعار: من ${report.prices.min} إلى ${report.prices.max} (المتوسط ${report.prices.median})`,
    `- الشحن المجاني: ${report.freeShipping.on ? `شغال فوق ${report.freeShipping.thresholdEgp}` : 'مقفول (مفيش رقم موافق عليه)'}`,
    '',
    '### الخطة',
    report.planAr.map((l) => `- ${l}`).join('\n') || '- لا يوجد',
    '',
    '### منتجات سعرها أقل من تكلفة توصيلها',
    '| SKU | السعر | الشحن | الحالة |',
    '|---|---|---|---|',
    below.join('\n') || '| — | — | — | — |',
    '',
    '### قرار الشحن المجاني لكل منطقة',
    '| المنطقة | تكلفة الشحن | أقل طلب آمن | منتجات توصل الرقم |',
    '|---|---|---|---|',
    zones.join('\n'),
  ];
  writeFileSync(env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, { flag: 'a' });
}
if (env.GITHUB_ACTIONS) {
  const clip = (t: string) => t.replace(/[\r\n%]/g, ' ').slice(0, 2800);
  console.log(`::notice title=Shaheen catalog review::${clip(report.summaryAr)}`);
  const sellable = report.belowShipping.filter((p) => p.sellable).length;
  if (sellable) console.log(`::warning title=Shaheen catalog review::${clip(`${sellable} منتج معروض سعره أقل من تكلفة توصيله — بيخسر في كل بيعة`)}`);
  if (report.ruleBreaks.length) console.log(`::warning title=Shaheen catalog review::${clip(`${report.ruleBreaks.length} منتج سعره مش على قاعدة السعر`)}`);
}
