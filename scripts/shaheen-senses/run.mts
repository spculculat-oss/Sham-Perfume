/**
 * «حسّاسات شاهين» — senses_site (الداخل) + senses_world (الخارج), one run.
 *
 *   node --import tsx scripts/shaheen-senses/run.mts
 *
 * Reads only real files (and, for the world sense, each carrier's own page politely) and writes
 * src/data/live/senses-site.json and src/data/live/senses-world.json. No price changes, no promises.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { buildSensesSite, isSensesSiteReport } from './senses_site';
import { buildSensesWorld, isSensesWorldReport } from './senses_world';
import type { ShippingCosts, ShippingTable } from '../../src/utils/pricing';

const env = process.env;
const read = (rel: string) => JSON.parse(readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8'));
const now = Date.now();
const iso = new Date(now).toISOString();
const write = (name: string, value: unknown) => writeFileSync(new URL(`../../src/data/live/${name}`, import.meta.url), `${JSON.stringify(value, null, 1)}\n`);

const products = read('src/data/products.json') as { products: { sku: string; supplierPrice?: number; ourPrice?: number; stockStatus?: string }[] };
const shipping = { ...(read('src/data/shipping.json') as ShippingTable), costs: read('src/data/shipping-costs.json') as ShippingCosts };
const costs = read('src/data/shipping-costs.json') as ShippingCosts;
const customs = read('src/data/customs.json') as { countries?: Record<string, { vatPercent?: number; source?: string | null; checkedAt?: string }>; updatedAt?: string; source?: string | null };
const fx = read('src/data/live/fx-rates.json') as { base: string; source?: string | null; updatedAt?: string; rates: Record<string, number> };
const lanes = read('src/data/shipping-lanes.json') as { carriers: { id: string; nameAr: string; dg: boolean | null; source?: string | null; checkedAt?: string }[] };
const trade = read('src/data/live/trade-lanes.json') as { destinations: { code: string; nameAr: string }[] };
const candidates = read('src/data/carrier-candidates.json') as { candidates: { id: string; nameAr: string; originCountry?: string | null; ratesUrl?: string; dgUrl?: string }[] };

const liveReports = [
  { file: 'src/data/live/shaheen-graph.json', name: 'شبكة العقل' },
  { file: 'src/data/live/shaheen-immune.json', name: 'المناعة' },
  { file: 'src/data/live/shaheen-reflex.json', name: 'الانعكاس' },
  { file: 'src/data/live/shaheen-ears.json', name: 'الآذان' },
  { file: 'src/data/live/shaheen-exam.json', name: 'الممتحن' },
  { file: 'src/data/live/shaheen-study.json', name: 'المعلم' },
];

const site = buildSensesSite({
  now, products: products.products,
  shipping, costs, customs, fx,
  tradeDestinations: trade.destinations,
  carriers: lanes.carriers,
  liveReports,
});
if (!isSensesSiteReport(site)) { console.error('::error::تقرير حسّاسات الموقع مش سليم'); process.exit(1); }
write('senses-site.json', site);
console.log(site.summaryAr);

// The world sense reads each carrier's own page politely (robots.txt first, one page per site, small budget).
const world = await buildSensesWorld({
  now, candidates: candidates.candidates,
  http: fetch,
});
if (!isSensesWorldReport(world)) { console.error('::error::تقرير حسّاسات العالم مش سليم'); process.exit(1); }
write('senses-world.json', world);
console.log(world.summaryAr);

for (const line of site.planAr) console.log(`- ${line}`);
for (const line of world.planAr) console.log(`- ${line}`);

if (env.GITHUB_STEP_SUMMARY) {
  const lines = [
    '## حسّاسات شاهين (الداخل والخارج)', '',
    `- ${site.summaryAr}`, `- ${world.summaryAr}`, '',
    '### داخل الموقع', '| الحسّاس | المستوى | المصدر | التاريخ |',
    '|---|---|---|---|',
    ...site.senses.slice(0, 10).map((s) => `| ${s.whatAr} | ${s.level} | ${s.source} | ${s.checkedAt.slice(0, 10)} |`),
    '', '### العالم الخارجي', '| الشركة | الصفحة فتحت؟ | مواد خطر؟ | المصدر |',
    '|---|---|---|---|',
    ...world.probes.map((p) => `| ${p.carrierNameAr} | ${p.page.fetched ? 'نعم' : 'لا'} | ${p.page.mentionsDangerousGoods ? 'نعم' : 'لا'} | ${p.source || '—'} |`),
  ];
  writeFileSync(env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, { flag: 'a' });
}
if (env.GITHUB_ACTIONS) {
  const clip = (t: string) => t.replace(/[\r\n%]/g, ' ').slice(0, 2800);
  const noticeMsg = site.summaryAr + ' \u00b7 ' + world.summaryAr;
  console.log(`::notice title=Shaheen senses::${clip(noticeMsg)}`);
}
