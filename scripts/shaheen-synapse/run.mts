/**
 * «سينابس شاهين» — the robot that keeps the mind connected.
 *
 * Runs every three hours (`.github/workflows/shaheen-synapse.yml`). It reads the site's real files and rebuilds two
 * things from scratch, so nothing can drift:
 *   · `src/data/live/shaheen-graph.json` — the knowledge graph: every product, brand, supplier, origin country,
 *     destination, carrier, customs table, lesson, topic and specialist, joined by edges that each carry their
 *     source and date (`src/utils/shaheenGraph.ts`).
 *   · `src/data/live/shaheen-immune.json` — where two parts of the mind disagree (`./immune.ts`).
 *
 * It changes no price and promises nothing: it connects, counts, and reports.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { academyLessons } from '../../scripts/shaheen-school/curriculum';
import { SITE_SECTIONS, SPECIALISTS } from '../../src/utils/shaheenSpecialists';
import { buildGraph, explain, isShaheenGraph, type ShaheenGraph } from '../../src/utils/shaheenGraph';
import { ourPriceOf } from '../shaheen-import/transform';
import { checkConsistency, type ImmuneReport } from './immune';
import { convert, type FxTable, type ShippingCosts, type ShippingTable } from '../../src/utils/pricing';

const env = process.env;
const read = (rel: string) => JSON.parse(readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8'));
const now = Date.now();

const catalog = read('src/data/products.json') as { products: { sku: string; nameAr: string; brand?: string | null; supplierId?: string | null; supplierName?: string | null; ourPrice?: number; supplierPrice?: number; published?: boolean }[] };
const lanes = read('src/data/shipping-lanes.json') as { platforms: { id: string; nameAr: string; originCountry: string | null; products?: number; shipmentCheckedAt?: string }[]; carriers: { id: string; nameAr: string; source?: string; checkedAt?: string }[] };
const trade = read('src/data/live/trade-lanes.json') as {
  destinations: {
    code: string; nameAr: string; promise: 'we_ship' | 'broker_only' | 'unknown';
    costEgp: [number, number] | null; costExtraEgp?: number | null;
    carrier: { id: string; nameAr: string; source?: string | null } | null;
    customs: { verified: boolean; vatPercent: number | null; dutyPercent: [number, number] | null; deMinimis: string | null; noteAr?: string };
  }[];
};
const customsFile = read('src/data/customs.json') as { updatedAt?: string; countries: { code: string; vatPercent: number | null; source?: string }[] };
const shipping = read('src/data/shipping.json') as ShippingTable;
const costs = read('src/data/shipping-costs.json') as ShippingCosts;
const fx = read('src/data/live/fx-rates.json') as FxTable;

// ربط المنتج بمورده الحقيقي: المعرّف زي ما هو، أو بادئة معرّف المنصة (afnan-com → afnan)، أو اسم المورد.
const platformIds = lanes.platforms.map((p) => p.id);
const supplierOf = (id?: string | null): string | null => {
  const value = String(id || '').trim();
  if (!value || value === 'undefined' || value === 'null') return null;
  if (platformIds.includes(value)) return value;
  return platformIds.find((p) => value.startsWith(p) && value.length > p.length) || null;
};

const shippedUsd = (code: string) => (costs.countries?.[code] ? convert(costs.countries[code].firstItem, costs.currency, 'USD', fx) : undefined);
const carrierOf = (id: string) => lanes.carriers.find((c) => c.id === id);
const customsSource = (code: string) => customsFile.countries.find((c) => c.code === code)?.source || null;

// ── العقل: الشبكة من الملفات الحقيقية ────────────────────────────────────────────────────────────
const graph: ShaheenGraph = buildGraph({
  now,
  products: catalog.products.map((p) => ({
    sku: String(p.sku), nameAr: String(p.nameAr), brand: p.brand ?? null, supplierId: supplierOf(p.supplierId),
    supplierName: p.supplierName ?? null, ourPrice: Number(p.ourPrice) || 0, supplierPrice: Number(p.supplierPrice) || 0, published: p.published,
  })),
  suppliers: lanes.platforms.map((p) => ({ id: p.id, nameAr: p.nameAr, originCountry: p.originCountry, products: Number(p.products) || 0, ...(p.shipmentCheckedAt ? { checkedAt: p.shipmentCheckedAt } : {}) })),
  destinations: trade.destinations.map((d) => ({
    code: d.code, nameAr: d.nameAr,
    costs: d.costEgp && d.carrier
      ? {
        firstItemUsd: convert(d.costEgp[0], 'EGP', 'USD', fx),
        extraItemUsd: convert(Number(d.costExtraEgp) || d.costEgp[0], 'EGP', 'USD', fx),
        carrierId: d.carrier.id, carrierNameAr: d.carrier.nameAr,
        source: String(d.carrier.source || 'src/data/shipping-lanes.json'),
        checkedAt: String(carrierOf(d.carrier.id)?.checkedAt || costs.checkedAt),
      }
      : null,
    customs: {
      verified: Boolean(d.customs.verified), vatPercent: d.customs.vatPercent,
      dutyPercent: d.customs.dutyPercent, deMinimis: d.customs.deMinimis,
      source: customsSource(d.code) || 'src/data/customs.json', checkedAt: customsFile.updatedAt,
    },
  })),
  lessons: academyLessons().map((l) => ({ id: l.id, title: l.title, track: l.track, topic: l.topic, content: l.content, source: 'scripts/shaheen-school/curriculum.ts' })),
  specialists: SPECIALISTS.map((s) => ({
    id: s.id, nameAr: s.nameAr, tracks: s.tracks,
    // الأقسام اللي بتنادي المتخصص ده (الربط بالموقع نفسه، مش بالتخصص بس).
    sections: SITE_SECTIONS.filter((x) => x.consultants.includes(s.id)).map((x) => x.id),
  })),
});

if (!isShaheenGraph(graph)) { console.error('::error::the graph is not valid'); process.exit(1); }
writeFileSync(new URL('../../src/data/live/shaheen-graph.json', import.meta.url), `${JSON.stringify(graph, null, 1)}\n`);

// ── المناعة: فين العقل بيتناقض مع نفسه ──────────────────────────────────────────────────────────
const immune: ImmuneReport = checkConsistency({
  now, fx,
  chargedUsd: Object.fromEntries(trade.destinations.map((d) => [d.code, shippedUsd(d.code) ?? Number.NaN]).filter(([, v]) => Number.isFinite(v)) as [string, number][]),
  destinationCostEgp: trade.destinations.map((d) => ({ code: d.code, nameAr: d.nameAr, costEgp: d.costEgp, carrierId: d.carrier?.id || null, promise: d.promise })),
  costTable: { currency: costs.currency, source: costs.source, checkedAt: costs.checkedAt, countries: costs.countries },
  products: catalog.products.map((p) => ({ sku: String(p.sku), nameAr: String(p.nameAr), ourPrice: Number(p.ourPrice) || 0, supplierPrice: Number(p.supplierPrice) || 0, supplierId: supplierOf(p.supplierId) })),
  expectedPrice: (cost) => ourPriceOf(cost, 1.5),
  promises: trade.destinations.map((d) => ({ code: d.code, nameAr: d.nameAr, promise: d.promise })),
  customs: trade.destinations.map((d) => ({ code: d.code, nameAr: d.nameAr, verified: d.customs.verified, vatPercent: d.customs.vatPercent, source: customsSource(d.code), checkedAt: customsFile.updatedAt || null })),
  carrierChecks: lanes.carriers.map((c) => ({ id: c.id, nameAr: c.nameAr, checkedAt: c.checkedAt || null, source: c.source || null })),
  freeShippingAboveEgp: Number(shipping.freeShippingAboveEgp) > 0 ? Number(shipping.freeShippingAboveEgp) : null,
});
writeFileSync(new URL('../../src/data/live/shaheen-immune.json', import.meta.url), `${JSON.stringify(immune, null, 1)}\n`);

// ── التقرير على الشاشة ───────────────────────────────────────────────────────────────────────────
console.log(graph.summaryAr);
console.log(`- الدرجة: ${graph.score.total}/100 — ${graph.score.whyAr}`);
console.log(`- التغطية ${graph.score.coverage}/25 · الدروس ${graph.score.lessons}/20 · الكتالوج ${graph.score.catalogue}/15 · الحداثة ${graph.score.freshness}/10 · الترابط ${graph.score.connectivity}/5 · العمق ${graph.score.depth}/25`);
for (const hub of graph.stats.hubs.slice(0, 5)) console.log(`· محور: ${hub.labelAr} (${hub.degree} حافة)`);
const sample = graph.nodes.find((n) => n.id === 'destination:EG');
if (sample) for (const line of explain(graph, sample.id, 1).slice(0, 6)) console.log(`  ${line}`);
console.log(immune.summaryAr);
for (const f of immune.findings.slice(0, 8)) console.log(`${f.severity === 'high' ? '!!' : f.severity === 'medium' ? '!' : '?'} ${f.whatAr}`);

if (env.GITHUB_STEP_SUMMARY) {
  const rows = Object.entries(graph.stats.byKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`);
  const rels = Object.entries(graph.stats.byRelation).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`);
  const finds = immune.findings.slice(0, 25).map((f) => `| ${f.severity === 'high' ? '🔴' : f.severity === 'medium' ? '🟡' : '⚪'} | ${f.whatAr} | ${f.sides?.map((s) => `${s.valueAr} ← ${s.source}`).join('<br>') || '—'} | ${f.fixAr} |`);
  const lines = [
    '## عقل شاهين — الشبكة والمناعة', '',
    graph.summaryAr, '',
    `- درجة العقل: **${graph.score.total}/100** — ${graph.score.whyAr}`,
    `- الصحة: **${immune.health}/100** — ${immune.summaryAr}`, '',
    '### العقد', '| النوع | العدد |', '|---|---|', rows.join('\n'), '',
    '### الحواف', '| العلاقة | العدد |', '|---|---|', rels.join('\n'),
    ...(graph.stats.orphans.length ? ['', `### عقد معلّقة (${graph.stats.orphans.length})`, graph.stats.orphans.slice(0, 20).map((o) => `- ${o}`).join('\n')] : []),
    '', '### تعارضات المناعة', '| | المشكلة | الطرفان | الإصلاح |', '|---|---|---|---|', finds.join('\n') || '| — | مفيش | — | — |',
  ];
  writeFileSync(env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, { flag: 'a' });
}
if (env.GITHUB_ACTIONS) {
  const clip = (t: string) => t.replace(/[\r\n%]/g, ' ').slice(0, 2800);
  console.log(`::notice title=Shaheen mind::${clip(graph.summaryAr)}`);
  const serious = immune.findings.filter((f) => f.severity === 'high').length;
  if (serious) console.log(`::warning title=Shaheen mind::${clip(`${serious} تعارض خطير بين أجزاء العقل — ${immune.summaryAr}`)}`);
}
