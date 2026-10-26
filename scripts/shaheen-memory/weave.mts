/**
 * «الناسج والمؤرشف» — weaver (الربط) + curator (بطاقات المعرفة), one run.
 *
 *   node --import tsx scripts/shaheen-memory/weave.mts
 *
 * Weaver connects every destination to its real cost, carrier, customs, zone and agreement — each thread
 * sourced and dated. Curator turns every verified answer into a knowledge card (source + date + freshness).
 * Neither changes a price or makes a promise.
 *
 * Writes src/data/live/weave.json and src/data/live/curate.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { buildWeave, isWeaveReport } from './weaver';
import { buildCurate, isCurateReport } from './curator';

const env = process.env;
const read = (rel: string) => JSON.parse(readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8'));
const now = Date.now();
const write = (name: string, value: unknown) => writeFileSync(new URL(`../../src/data/live/${name}`, import.meta.url), `${JSON.stringify(value, null, 1)}\n`);

const graph = read('src/data/live/shaheen-graph.json') as { nodes?: { id: string; kind: string }[]; edges?: { from: string; to: string; source?: string | null; updatedAt?: string | null }[] };
const trade = read('src/data/live/trade-lanes.json') as {
  destinations: { code: string; nameAr: string; route?: 'platform_ships' | 'broker' | 'unknown'; carrier?: { id: string; nameAr: string; source?: string | null; dg?: boolean | null } }[];
};
const costs = read('src/data/shipping-costs.json') as { countries?: Record<string, { firstItem?: number; extraItem?: number }>; source?: string; checkedAt?: string };
const shipping = { ...(read('src/data/shipping.json') as { zones?: { id: string; nameAr: string; countries?: string[] }[]; default?: { id: string; nameAr: string }; currency: string }), costs };
const customs = read('src/data/customs.json') as { countries?: Record<string, { vatPercent?: number; source?: string | null; checkedAt?: string; agreement?: string | null }>; agreements?: { id: string; nameAr: string }[]; updatedAt?: string };
const fx = read('src/data/live/fx-rates.json') as { base: string; source?: string | null; updatedAt?: string; rates: Record<string, number> };

// ── weaver ────────────────────────────────────────────────────────────────
const weave = buildWeave({
  now, graph,
  destinations: trade.destinations.map((d) => ({ code: d.code, nameAr: d.nameAr, route: d.route || 'unknown', carrier: d.carrier ? { id: d.carrier.id, nameAr: d.carrier.nameAr, source: d.carrier.source, dg: d.carrier.dg } : undefined })),
  costs, shipping, customs, fx,
});
if (!isWeaveReport(weave)) { console.error('::error::تقرير الناسج مش سليم'); process.exit(1); }
write('weave.json', weave);
console.log(weave.summaryAr);

// ── curator ───────────────────────────────────────────────────────────────
const study = read('src/data/live/shaheen-study.json') as { targets?: { labelAr: string; whyAr: string; priority: number; source?: string | null }[] };
const exam = read('src/data/live/shaheen-exam.json') as { misses?: { question: string; expected: string[]; whyAr: string; source: string }[] };
const reflex = read('src/data/live/shaheen-reflex.json') as { entries?: { question: string; answerAr: string; source: string; updatedAt?: string | null }[] };
const sensesSite = read('src/data/live/senses-site.json') as { shipping?: { zoneFallback: number }; customs?: { vatMissing: number }; fx?: { stale: boolean } };

const curate = buildCurate({
  now,
  studyTargets: study.targets || [],
  examMisses: exam.misses || [],
  reflexEntries: reflex.entries || [],
  senses: {
    shippingZoneFallback: sensesSite.shipping?.zoneFallback ?? 0,
    customsVatMissing: sensesSite.customs?.vatMissing ?? 0,
    fxStale: Boolean(sensesSite.fx?.stale),
  },
});
if (!isCurateReport(curate)) { console.error('::error::تقرير المؤرشف مش سليم'); process.exit(1); }
write('curate.json', curate);
console.log(curate.summaryAr);

for (const line of weave.planAr) console.log(`- ${line}`);
for (const line of curate.planAr) console.log(`- ${line}`);

if (env.GITHUB_STEP_SUMMARY) {
  const lines = [
    '## الناسج والمؤرشف (الربط وبطاقات المعرفة)', '',
    `- ${weave.summaryAr}`, `- ${curate.summaryAr}`, '',
    '### الناسج — مكتملات وناقصة', '| الوجهة | المسار | مكتملة؟ | ناقص |',
    '|---|---|---|---|',
    ...weave.threads.slice(0, 12).map((t) => `| ${t.destination} (${t.code}) | ${t.route} | ${t.complete ? 'نعم' : 'لا'} | ${t.missing.join('، ') || '—'} |`),
    '', '### المؤرشف — بطاقات المعرفة', '| البطاقة | المصدر | التاريخ | حالتها |',
    '|---|---|---|---|',
    ...curate.cards.slice(0, 12).map((c) => `| ${c.topic} | ${c.source} | ${c.checkedAt.slice(0, 10)} | ${c.stale ? 'تحتاج مراجعة' : 'طازجة'} |`),
  ];
  writeFileSync(env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, { flag: 'a' });
}
if (env.GITHUB_ACTIONS) {
  const clip = (t: string) => t.replace(/[\r\n%]/g, ' ').slice(0, 2800);
  const noticeMsg = weave.summaryAr + ' \u00b7 ' + curate.summaryAr;
  console.log(`::notice title=Shaheen weave+curate::${clip(noticeMsg)}`);
}
