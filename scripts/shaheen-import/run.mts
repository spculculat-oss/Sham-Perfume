/**
 * «مستورد شاهين» — GitHub Actions runs this every 12 hours (.github/workflows/shaheen-import.yml):
 *   node --import tsx scripts/shaheen-import/run.mts
 * 1. reads the supplier's sitemap (every product page + its photos),
 * 2. imports new products (IMPORT_MAX_NEW per run) and refreshes the oldest ones (IMPORT_MAX_REFRESH):
 *    name, full description, notes, family, seasons, size, concentration, all photos, price, stock,
 * 3. prices them with the store's scenario (supplier price → EGP at today's rate → × 1.5),
 * 4. runs «مراجع الصفحات» (review.ts) over the whole store and writes src/data/products.json +
 *    src/data/live/store-review.json. Every product then gets its own page (#product=<id> and p/<slug>/).
 * It never invents a product: a page it cannot read is reported, not filled with placeholders.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { guidanceBlock } from '../../src/utils/aiTools';
import type { RawProduct } from '../../src/utils/storeCatalog';
import { makeAsk } from '../doctor/agent';
import { extractProduct, pageImages, pageText, parseSitemap, parseSitemapIndex, validateShaheenReading, type ExtractedProduct, type SitemapEntry } from './extract';
import { reviewStore, type ReviewFile } from './review';
import { SOURCES } from './sources';
import { isImported, nextIdOf, planRun, sourceKey, toStoreProduct, type ImportedProduct, type ImportSource } from './transform';

const env = process.env;
const PRODUCTS = new URL('../../src/data/products.json', import.meta.url);
const REVIEW = new URL('../../src/data/live/store-review.json', import.meta.url);
const UA = 'Mozilla/5.0 (compatible; ShaheenImporter/1.0; +https://spculculat-oss.github.io/Sham-Perfume/)';
const MAX_NEW = Number(env.IMPORT_MAX_NEW ?? 30);
const MAX_REFRESH = Number(env.IMPORT_MAX_REFRESH ?? 40);
// The scenario's markup (×1.5); a repository variable can change it without touching the code.
const MARKUP = Number(env.IMPORT_MARKUP) >= 1 ? Number(env.IMPORT_MARKUP) : undefined;
const CONCURRENCY = Math.max(1, Math.min(6, Number(env.IMPORT_CONCURRENCY ?? 3)));
const started = Date.now();
const log: string[] = [];
const say = (line: string) => { console.log(line); log.push(line); };
const read = <T,>(url: URL): T | undefined => { try { return existsSync(url) ? JSON.parse(readFileSync(url, 'utf8')) as T : undefined; } catch { return undefined; } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string, tries = 3): Promise<{ status: number; body: string }> {
  let last = { status: 0, body: '' };
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(25_000) });
      last = { status: r.status, body: await r.text() };
      if (r.status < 500 && r.status !== 429) return last;
    } catch { last = { status: 0, body: '' }; }
    await sleep(1500 * (i + 1) ** 2);
  }
  return last;
}

/** Today's rate to EGP: live rate → configured rate → last run's rate → the source's fallback. */
async function rateToEgp(source: ImportSource, previous?: ReviewFile): Promise<{ rate: number; from: string }> {
  try {
    const r = await fetch(`https://open.er-api.com/v6/latest/${source.currency}`, { signal: AbortSignal.timeout(15_000) });
    const data = await r.json() as { result?: string; rates?: Record<string, number> };
    const rate = data.rates?.EGP;
    if (data.result === 'success' && rate && rate > 0) return { rate: Math.round(rate * 10_000) / 10_000, from: 'open.er-api.com' };
  } catch { /* offline: fall back */ }
  const configured = Number(env[`IMPORT_RATE_${source.currency}_EGP`]);
  if (configured > 0) return { rate: configured, from: 'repository variable' };
  const last = Number((previous?.import as { rate?: number } | undefined)?.rate);
  if (last > 0) return { rate: last, from: 'last run' };
  return { rate: source.fallbackRateToEgp || 0, from: 'built-in fallback' };
}

async function sitemapEntries(source: ImportSource): Promise<SitemapEntry[]> {
  const all: SitemapEntry[] = [];
  const queue = [...source.sitemaps];
  const seen = new Set<string>();
  while (queue.length && seen.size < 30) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    const { status, body } = await get(url);
    if (status !== 200) { say(`Sitemap ${url}: HTTP ${status}`); continue; }
    const children = parseSitemapIndex(body);
    // From an index only the product sitemaps are needed (not blog, brands, tags…).
    if (children.length) queue.push(...children.filter((c) => /product|perfume|item/i.test(c)));
    else all.push(...parseSitemap(body, { include: source.productUrl, exclude: source.excludeUrl }));
  }
  return all;
}

const products: RawProduct[] = read<{ products?: RawProduct[] }>(PRODUCTS)?.products || [];
const previous = read<ReviewFile>(REVIEW);
const before = products.length;
const importInfo: Record<string, unknown> = { at: new Date().toISOString(), markup: MARKUP ?? 1.5, sources: [] as unknown[] };
let ask: Awaited<ReturnType<typeof makeAsk>>;
try { ask = await makeAsk(env); } catch { ask = undefined; }

const SHAHEEN_READER = `أنت «الخبير شاهين» وتقرأ صفحة منتج عطر من متجر مورّد. استخرج البيانات المكتوبة في الصفحة فقط ولا تخمّن.
أعد JSON فقط: {"name":"","brand":"","price":0,"sku":"","description":"","images":["رابط كامل من القائمة"],"size":"100ml","concentration":"","gender":"men|women|unisex","inStock":true}
السعر هو سعر البيع الظاهر للمنتج نفسه (ليس منتجات مقترحة). الصور فقط من قائمة روابط الصور المعطاة. إذا لم تكن الصفحة صفحة منتج أعد {}.`;

// Shaheen's supervisor (scripts/shaheen-supervisor) can add quality guidance for the page reader.
const supervisor = read<{ tools?: Record<string, { guidance?: { text?: string } }> }>(new URL('../../src/data/live/ai-supervisor.json', import.meta.url));
const READER = SHAHEEN_READER + guidanceBlock(supervisor?.tools?.store_import?.guidance?.text);

for (const source of SOURCES.filter((s) => !env.IMPORT_SOURCE || env.IMPORT_SOURCE === s.id)) {
  const info: Record<string, unknown> = { id: source.id, currency: source.currency };
  (importInfo.sources as unknown[]).push(info);
  const { rate, from } = await rateToEgp(source, previous);
  Object.assign(info, { rate, rateFrom: from });
  importInfo.rate = rate;
  if (!(rate > 0)) { say(`${source.id}: no exchange rate — import skipped (nothing is priced without a rate)`); continue; }
  say(`${source.id}: 1 ${source.currency} = ${rate} EGP (${from})`);

  const entries = await sitemapEntries(source);
  info.sitemapProducts = entries.length;
  say(`${source.id}: ${entries.length} products in the sitemap`);
  if (!entries.length) { say(`${source.id}: sitemap unreadable — existing products kept as they are`); continue; }

  const mine = products.filter((p): p is ImportedProduct => isImported(p) && (p as ImportedProduct).supplierId === source.id);
  // Brands the store already sells come first, so the catalog grows around what customers know.
  const known = new Set(products.map((p) => String(p.brand || '').toLowerCase().replace(/[^a-z]/g, '')).filter(Boolean));
  const brandOf = (u: string) => (u.match(/\/perfumes\/([^/]+)\//) || [])[1]?.replace(/[^a-z]/g, '') || '';
  const ordered = [...entries].sort((a, b) => Number([...known].some((k) => brandOf(b.url).startsWith(k))) - Number([...known].some((k) => brandOf(a.url).startsWith(k))));
  const plan = planRun(ordered, mine, MAX_NEW, MAX_REFRESH);
  const imagesByUrl = new Map(entries.map((e) => [e.url.replace(/\/+$/, ''), e.images]));
  say(`${source.id}: ${mine.length} already imported; this run: ${plan.fresh.length} new, ${plan.refresh.length} to refresh, ${plan.gone.length} left the supplier`);

  const jobs = [...plan.fresh.map((u) => ({ url: u.url, fresh: true })), ...plan.refresh.map((u) => ({ url: u.url, fresh: false }))];
  const failed: string[] = [];
  let viaShaheen = 0; let added = 0; let refreshed = 0;
  const bySourceKey = new Map(mine.map((p) => [sourceKey(source.id, p.supplierSku), p]));
  const byUrl = new Map(mine.map((p) => [p.url.replace(/\/+$/, ''), p]));
  let cursor = 0;
  const results: ExtractedProduct[] = [];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      await sleep(400); // polite to the supplier
      const page = await get(job.url);
      if (page.status !== 200) {
        failed.push(`${job.url} (HTTP ${page.status})`);
        const old = byUrl.get(job.url.replace(/\/+$/, ''));
        if (old && page.status === 404) old.stockStatus = 'out_of_stock';
        continue;
      }
      let x = extractProduct(page.body, job.url, imagesByUrl.get(job.url.replace(/\/+$/, '')) || []);
      if (!x && ask) {
        // No structured data: Shaheen reads the page; his answer must match the page or it is dropped.
        const imgs = pageImages(page.body, job.url).slice(0, 40);
        const prompt = `الرابط: ${job.url}\nروابط الصور في الصفحة:\n${imgs.join('\n')}\n\nنص الصفحة:\n${pageText(page.body).slice(0, 7000)}`;
        try {
          const reply = await ask(READER, prompt);
          const body = (reply || '').replace(/```(?:json)?/gi, '');
          x = validateShaheenReading(JSON.parse(body.slice(body.indexOf('{'), body.lastIndexOf('}') + 1)), page.body, job.url, source.currency);
          if (x) viaShaheen++;
        } catch { x = null; }
      }
      if (!x || x.currency !== source.currency) { failed.push(`${job.url} (${x ? `currency ${x.currency}` : 'no product data'})`); continue; }
      results.push(x);
    }
  }));

  const now = new Date().toISOString();
  for (const x of results) {
    const existing = bySourceKey.get(sourceKey(source.id, x.supplierSku)) || byUrl.get(x.url.replace(/\/+$/, ''));
    const product = toStoreProduct(x, { source, rate, now, nextId: nextIdOf(products), existing, markup: MARKUP });
    if (existing) { products[products.indexOf(existing)] = product; refreshed++; } else { products.push(product); added++; }
    bySourceKey.set(sourceKey(source.id, x.supplierSku), product);
    byUrl.set(x.url.replace(/\/+$/, ''), product);
  }
  for (const p of plan.gone) p.stockStatus = 'out_of_stock';
  Object.assign(info, { added, refreshed, failed: failed.slice(0, 20), failedCount: failed.length, viaShaheen, gone: plan.gone.length });
  say(`${source.id}: +${added} new, ${refreshed} refreshed, ${failed.length} unreadable${viaShaheen ? `, ${viaShaheen} read by Shaheen` : ''}`);
}

// «مراجع الصفحات» reviews the whole store after the import.
importInfo.durationMs = Date.now() - started;
const { products: reviewed, report } = await reviewStore(products, { previous, importInfo, markup: MARKUP, imageBudget: Number(env.REVIEW_IMAGE_BUDGET ?? 80) });
say(`Reviewer: ${report.summary.total} products — ${report.summary.ok} ok, ${report.summary.warn} with remarks, ${report.summary.hidden} hidden; ${report.summary.imagesChecked} photos checked, ${report.summary.brokenImages} broken`);

writeFileSync(PRODUCTS, JSON.stringify({ products: reviewed }, null, 2));
writeFileSync(REVIEW, `${JSON.stringify(report, null, 1)}\n`);
say(`products.json: ${before} → ${reviewed.length} products`);

if (env.GITHUB_STEP_SUMMARY) {
  const rows = report.items.slice(0, 25).map((i) => `- **${i.sku}** ${i.name} — ${i.status === 'hidden' ? '🚫 مخفي' : '⚠️'} ${i.issues.join('، ')}`);
  appendFileSync(env.GITHUB_STEP_SUMMARY, `## مستورد شاهين + مراجع الصفحات — ${new Date().toISOString()}\n\n${log.map((l) => `- ${l}`).join('\n')}\n\n### ملاحظات المراجع\n${rows.join('\n') || 'لا يوجد'}\n`);
}
if (env.GITHUB_ACTIONS) {
  const clean = (t: string) => t.replace(/[\r\n%]/g, ' ').slice(0, 900);
  console.log(`::notice title=Shaheen importer::${clean(log.join(' | '))}`);
  const added = reviewed.filter((p) => isImported(p) && (p as ImportedProduct).importedAt === (p as ImportedProduct).refreshedAt).slice(-3)
    .map((p) => { const i = p as ImportedProduct; return `${i.sku} ${i.nameEn} — ${i.ourPrice} EGP (${i.supplierPriceOriginal} ${i.supplierCurrency}) — ${i.images.length} photos — notes ${[...(i.notes?.top || []), ...(i.notes?.heart || [])].slice(0, 4).join('/')}`; });
  if (added.length) console.log(`::notice title=Imported samples::${clean(added.join(' || '))}`);
  const remarks = report.items.filter((i) => i.status === 'hidden').slice(0, 4).map((i) => `${i.sku}: ${i.issues.join(', ')}`);
  if (remarks.length) console.log(`::warning title=Reviewer hid::${clean(remarks.join(' || '))}`);
}
