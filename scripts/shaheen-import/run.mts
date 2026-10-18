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
import { makeAsk, QuotaExhaustedError, quotaBook } from '../doctor/agent';
import { answerBook } from '../doctor/answers';
import { extractProduct, pageImages, pageText, parseListing, parseSitemap, parseSitemapIndex, validateShaheenReading, type ExtractedProduct, type SitemapEntry } from './extract';
import { reviewStore, type ReviewFile } from './review';
import { loadSources } from './sources';
import { extractGeneric } from './generic';
import { adoptSkill, emptySkills, hostOf, isSkillsFile, learnSkill, readWithSkill, recordUse, skillsSummary, type SkillsFile } from './skills';
import { isPerfume, parseRobots } from '../shaheen-discover/discover';
import { addAltOffer, isImported, nextIdOf, normalizeBrand, ourPriceOf, perfumeKey, planRun, priceInEgp, priceReport, sourceKey, toStoreProduct, useCleanPhotos, type ImageRegistry, type ImportedProduct, type ImportSource, type PriceRule } from './transform';

const env = process.env;
const PRODUCTS = new URL('../../src/data/products.json', import.meta.url);
const REVIEW = new URL('../../src/data/live/store-review.json', import.meta.url);
const UA = 'Mozilla/5.0 (compatible; ShaheenImporter/1.0; +https://spculculat-oss.github.io/Sham-Perfume/)';
const MAX_NEW = Number(env.IMPORT_MAX_NEW ?? 30);
const MAX_REFRESH = Number(env.IMPORT_MAX_REFRESH ?? 25);
// The merchant's price rule — repository variables change it without touching the code:
// IMPORT_MARKUP (×1.5), IMPORT_SHIPPING_EGP (fixed cost per bottle, 0), IMPORT_MAX_PROFIT_EGP (profit cap, none).
const positive = (v?: string) => (Number(v) > 0 ? Number(v) : undefined);
const MARKUP: PriceRule = {
  markup: Number(env.IMPORT_MARKUP) >= 1 ? Number(env.IMPORT_MARKUP) : 1.5,
  shippingEgp: positive(env.IMPORT_SHIPPING_EGP),
  maxProfitEgp: positive(env.IMPORT_MAX_PROFIT_EGP),
};
const CONCURRENCY = Math.max(1, Math.min(6, Number(env.IMPORT_CONCURRENCY ?? 3)));
// Size limits of the store (every product is part of the site's store download and gets its own page):
// IMPORT_MAX_TOTAL products in all, IMPORT_MAX_PER_SOURCE from one store. Beyond them only refreshes run.
const MAX_TOTAL = Math.max(100, Number(env.IMPORT_MAX_TOTAL ?? 5000));
const MAX_PER_SOURCE = Math.max(10, Number(env.IMPORT_MAX_PER_SOURCE ?? 1500));
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

/**
 * Products on the store's own listing that its sitemap lacks. `complete` is false when a listing page could
 * not be read — then no product is treated as gone because it was missing from the listing.
 */
async function listingExtras(source: ImportSource, known: Set<string>): Promise<{ extras: SitemapEntry[]; complete: boolean; pages: number; seen: number }> {
  const extras: SitemapEntry[] = [];
  if (!source.listing) return { extras, complete: true, pages: 0, seen: 0 };
  const pageUrl = (n: number) => source.listing!.url.replace('{page}', String(n));
  const opts = { include: source.productUrl, exclude: source.excludeUrl };
  const first = await get(pageUrl(1));
  if (first.status !== 200) { say(`Listing ${pageUrl(1)}: HTTP ${first.status}`); return { extras, complete: false, pages: 0, seen: 0 }; }
  const one = parseListing(first.body, source.base, opts);
  const pages = Math.min(source.listing.maxPages, one.pages || 1);
  const all = new Set(one.urls);
  let complete = true;
  let cursor = 2;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (cursor <= pages) {
      const n = cursor++;
      await sleep(300); // polite to the supplier
      const page = await get(pageUrl(n));
      if (page.status !== 200) { complete = false; continue; }
      for (const u of parseListing(page.body, source.base, opts).urls) all.add(u);
    }
  }));
  for (const url of all) if (!known.has(url.replace(/\/+$/, ''))) extras.push({ url, images: [] });
  return { extras, complete, pages, seen: all.size };
}

const products: RawProduct[] = read<{ products?: RawProduct[] }>(PRODUCTS)?.products || [];
const previous = read<ReviewFile>(REVIEW);
const before = products.length;
const importInfo: Record<string, unknown> = { at: new Date().toISOString(), markup: MARKUP.markup, pricing: MARKUP, sources: [] as unknown[] };
// AI packages: Shaheen reads pages only while the quota lasts; pages left unread wait for its renewal.
const quota = quotaBook(new URL('../../src/data/live/ai-quota.json', import.meta.url));
let ask: Awaited<ReturnType<typeof makeAsk>>;
// The same page text read before is answered from the bots' memory (no AI call, even with the quota paused).
const memory = answerBook(new URL('../../src/data/live/ai-memory.json', import.meta.url));
try { ask = await makeAsk(env, { quota, memory }); } catch { ask = undefined; }
let aiResumeAt = 0;
// «مهارات شاهين»: how to read each store without AI, learned from AI readings that passed the checks.
const SKILLS = new URL('../../src/data/live/shaheen-skills.json', import.meta.url);
const skills: SkillsFile = (() => { const d = read<unknown>(SKILLS); return isSkillsFile(d) ? d : emptySkills(); })();
let skillsChanged = false;
const sources = loadSources();
const only = (env.IMPORT_SOURCE || '').split(',').map((x) => x.trim()).filter(Boolean);
const selected = sources.filter((s) => (!only.length || only.includes(s.id)) && (env.IMPORT_ONLY_DISCOVERED !== '1' || s.origin === 'discovered'));
// The new-product budget of the run is shared between the stores (each gets its turn, unused budget moves on).
let newBudget = Math.max(0, Math.min(MAX_NEW, MAX_TOTAL - products.length));
if (MAX_NEW > 0 && newBudget === 0) say(`Store size limit reached (${MAX_TOTAL} products, IMPORT_MAX_TOTAL): only refreshes this run`);

const SHAHEEN_READER = `أنت «الخبير شاهين» وتقرأ صفحة منتج عطر من متجر مورّد. استخرج البيانات المكتوبة في الصفحة فقط ولا تخمّن.
أعد JSON فقط: {"name":"","brand":"","price":0,"sku":"","description":"","images":["رابط كامل من القائمة"],"size":"100ml","concentration":"","gender":"men|women|unisex","inStock":true}
السعر هو سعر البيع الظاهر للمنتج نفسه (ليس منتجات مقترحة). الصور فقط من قائمة روابط الصور المعطاة. إذا لم تكن الصفحة صفحة منتج أعد {}.`;

// Shaheen's supervisor (scripts/shaheen-supervisor) can add quality guidance for the page reader.
const supervisor = read<{ tools?: Record<string, { guidance?: { text?: string } }> }>(new URL('../../src/data/live/ai-supervisor.json', import.meta.url));
const READER = SHAHEEN_READER + guidanceBlock(supervisor?.tools?.store_import?.guidance?.text);

for (const [sourceIndex, source] of selected.entries()) {
  const info: Record<string, unknown> = { id: source.id, currency: source.currency };
  (importInfo.sources as unknown[]).push(info);
  const { rate, from } = await rateToEgp(source, previous);
  Object.assign(info, { rate, rateFrom: from });
  importInfo.rate = rate;
  if (!(rate > 0)) { say(`${source.id}: no exchange rate — import skipped (nothing is priced without a rate)`); continue; }
  say(`${source.id}: 1 ${source.currency} = ${rate} EGP (${from})`);

  const sitemap = await sitemapEntries(source);
  info.sitemapProducts = sitemap.length;
  say(`${source.id}: ${sitemap.length} products in the sitemap`);
  if (!sitemap.length) { say(`${source.id}: sitemap unreadable — existing products kept as they are`); continue; }

  const mine = products.filter((p): p is ImportedProduct => isImported(p) && (p as ImportedProduct).supplierId === source.id);
  // The store's listing adds the products its sitemap misses (they are its newest ones: imported first).
  const inSitemap = new Set(sitemap.map((e) => e.url.replace(/\/+$/, '')));
  const listing = await listingExtras(source, inSitemap);
  const listingOnly = new Set(listing.extras.map((e) => e.url.replace(/\/+$/, '')));
  if (source.listing) {
    Object.assign(info, { listingPages: listing.pages, listingProducts: listing.seen, listingOnly: listing.extras.length, listingComplete: listing.complete });
    say(`${source.id}: listing ${listing.seen} products on ${listing.pages} pages, ${listing.extras.length} missing from the sitemap${listing.complete ? '' : ' (some pages unreadable)'}`);
  }
  let entries = [...listing.extras, ...sitemap];
  // Stores found by the scout: their robots.txt is respected on every run (it can change).
  if (source.origin === 'discovered') {
    const robotsPage = await get(new URL('/robots.txt', source.base).href, 1);
    const robots = parseRobots(robotsPage.status === 200 ? robotsPage.body : '');
    const before = entries.length;
    entries = entries.filter((e) => { try { return robots.allowed(new URL(e.url).pathname); } catch { return false; } });
    if (before !== entries.length) say(`${source.id}: ${before - entries.length} links skipped (robots.txt)`);
  }
  // A listing page that could not be read must not make its products look «gone» from the supplier.
  if (!listing.complete) for (const p of mine) if (!inSitemap.has(p.url.replace(/\/+$/, '')) && !listingOnly.has(p.url.replace(/\/+$/, ''))) entries.push({ url: p.url, images: [] });
  // Brands the store already sells come first, so the catalog grows around what customers know.
  const known = new Set(products.map((p) => String(p.brand || '').toLowerCase().replace(/[^a-z]/g, '')).filter(Boolean));
  const brandOf = (u: string) => (u.match(/\/perfumes\/([^/]+)\//) || [])[1]?.replace(/[^a-z]/g, '') || '';
  const first = (u: string) => (listingOnly.has(u.replace(/\/+$/, '')) ? 2 : 0) + Number([...known].some((k) => brandOf(u).startsWith(k)));
  const ordered = [...entries].sort((a, b) => first(b.url) - first(a.url));
  const share = Math.ceil(newBudget / Math.max(1, selected.length - sourceIndex));
  const plan = planRun(ordered, mine, Math.max(0, Math.min(share, MAX_PER_SOURCE - mine.length)), MAX_REFRESH);
  const imagesByUrl = new Map(entries.map((e) => [e.url.replace(/\/+$/, ''), e.images]));
  say(`${source.id}: ${mine.length} already imported; this run: ${plan.fresh.length} new, ${plan.refresh.length} to refresh, ${plan.gone.length} left the supplier`);

  const jobs = [...plan.fresh.map((u) => ({ url: u.url, fresh: true })), ...plan.refresh.map((u) => ({ url: u.url, fresh: false }))];
  const failed: string[] = [];
  const deferred: string[] = [];
  let viaShaheen = 0; let added = 0; let refreshed = 0; let learnedSkills = 0; let notPerfume = 0; let duplicates = 0;
  const via: Record<string, number> = {};
  const bySourceKey = new Map(mine.map((p) => [sourceKey(source.id, p.supplierSku), p]));
  const byUrl = new Map(mine.map((p) => [p.url.replace(/\/+$/, ''), p]));
  let cursor = 0;
  const results: ExtractedProduct[] = [];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      await sleep(Math.max(400, source.delayMs || 0)); // polite to the supplier
      const page = await get(job.url);
      if (page.status !== 200) {
        failed.push(`${job.url} (HTTP ${page.status})`);
        const old = byUrl.get(job.url.replace(/\/+$/, ''));
        if (old && page.status === 404) old.stockStatus = 'out_of_stock';
        continue;
      }
      let x = extractProduct(page.body, job.url, imagesByUrl.get(job.url.replace(/\/+$/, '')) || []);
      // No JSON-LD: Shaheen reads the page by himself — first with what he learned about this store, then
      // from the OpenGraph/microdata signals every platform publishes — before any AI is asked.
      const host = hostOf(job.url);
      const skill = skills.sites[host];
      if (!x && skill && skill.status !== 'retired') {
        x = readWithSkill(page.body, job.url, skill, source.currency);
        recordUse(skill, Boolean(x)); skillsChanged = true;
      }
      if (!x) x = extractGeneric(page.body, job.url, source.currency);
      if (!x && ask && aiResumeAt) { deferred.push(job.url); continue; }
      // A link found only on a listing page is imported only from real product data (no AI spent on
      // a page that may not be a product at all).
      if (!x && listingOnly.has(job.url.replace(/\/+$/, ''))) { failed.push(`${job.url} (listing link without product data)`); continue; }
      if (!x && ask) {
        // No structured data: Shaheen reads the page; his answer must match the page or it is dropped.
        const imgs = pageImages(page.body, job.url).slice(0, 40);
        const prompt = `الرابط: ${job.url}\nروابط الصور في الصفحة:\n${imgs.join('\n')}\n\nنص الصفحة:\n${pageText(page.body).slice(0, 7000)}`;
        try {
          const reply = await ask(READER, prompt);
          const body = (reply || '').replace(/```(?:json)?/gi, '');
          x = validateShaheenReading(JSON.parse(body.slice(body.indexOf('{'), body.lastIndexOf('}') + 1)), page.body, job.url, source.currency);
          if (x) {
            viaShaheen++;
            // Shaheen learns from the checked reading where this store keeps each value (no AI next time).
            const learned = learnSkill(page.body, x);
            if (learned && adoptSkill(skills, learned)) { skillsChanged = true; learnedSkills++; }
          } else memory.forget(READER, prompt);
        } catch (error) {
          // Quota used up: this page (and the next ones needing Shaheen) wait for the renewal — not failures.
          if (error instanceof QuotaExhaustedError) { aiResumeAt = error.resumeAt; deferred.push(job.url); continue; }
          memory.forget(READER, prompt);
          x = null;
        }
      }
      if (!x || x.currency !== source.currency) { failed.push(`${job.url} (${x ? `currency ${x.currency}` : 'no product data'})`); continue; }
      // A store that also sells cosmetics/clothes: only its perfumes come into «متجر شام».
      if (source.perfumeOnly && !isPerfume(x)) { notPerfume++; continue; }
      via[x.via] = (via[x.via] || 0) + 1;
      results.push(x);
    }
  }));

  const now = new Date().toISOString();
  const byPerfume = new Map<string, ImportedProduct>();
  for (const p of products) if (isImported(p)) { const k = perfumeKey(p.brand, String(p.nameEn || ""), p.sizeMl); if (k && !byPerfume.has(k)) byPerfume.set(k, p); }
  for (const x of results) {
    const existing = bySourceKey.get(sourceKey(source.id, x.supplierSku)) || byUrl.get(x.url.replace(/\/+$/, ''));
    // The same perfume from another store is not added twice: it becomes a second place to buy it from.
    if (!existing) {
      const key = perfumeKey(x.brand, x.name, x.sizeMl);
      const twin = key ? byPerfume.get(key) : undefined;
      if (twin && twin.supplierId !== source.id) {
        addAltOffer(twin, { supplierId: source.id, url: x.url, priceEgp: priceInEgp(x.regularPrice && x.regularPrice > x.price ? x.regularPrice : x.price, rate), inStock: x.inStock, at: now });
        duplicates++;
        continue;
      }
    }
    const product = toStoreProduct(x, { source, rate, now, nextId: nextIdOf(products), existing, markup: MARKUP });
    if (existing) { products[products.indexOf(existing)] = product; refreshed++; } else { products.push(product); added++; newBudget = Math.max(0, newBudget - 1); }
    const key = perfumeKey(product.brand, String(product.nameEn || ""), product.sizeMl);
    if (key && !byPerfume.has(key)) byPerfume.set(key, product);
    bySourceKey.set(sourceKey(source.id, x.supplierSku), product);
    byUrl.set(x.url.replace(/\/+$/, ''), product);
  }
  for (const p of plan.gone) p.stockStatus = 'out_of_stock';
  Object.assign(info, { origin: source.origin || 'built-in', added, refreshed, failed: failed.slice(0, 20), failedCount: failed.length, viaShaheen, deferred: deferred.length, gone: plan.gone.length, via, learnedSkills, notPerfume, duplicates });
  say(`${source.id}: +${added} new, ${refreshed} refreshed, ${failed.length} unreadable${viaShaheen ? `, ${viaShaheen} read by Shaheen` : ''}${via.skill ? `, ${via.skill} read with a learned skill` : ''}${via.generic ? `, ${via.generic} read by Shaheen's own reader` : ''}${learnedSkills ? `, ${learnedSkills} new skill learned` : ''}${duplicates ? `, ${duplicates} already sold (kept as a second offer)` : ''}${notPerfume ? `, ${notPerfume} non-perfume skipped` : ''}${deferred.length ? `, ${deferred.length} wait for the AI renewal` : ''}`);
}

if (aiResumeAt) { importInfo.aiResumeAt = new Date(aiResumeAt).toISOString(); say(`AI packages used up until ${importInfo.aiResumeAt}; the import continues then`); }
quota.save();
memory.save();
if (skillsChanged) {
  skills.updatedAt = new Date().toISOString();
  writeFileSync(SKILLS, `${JSON.stringify(skills, null, 1)}\n`);
  const sk = skillsSummary(skills);
  importInfo.skills = sk;
  say(`Shaheen's skills: ${sk.sites} stores (${sk.trusted} trusted), ${sk.readings} pages read with them without AI`);
}
if (memory.hits()) say(`${memory.hits()} page readings answered from Shaheen's memory (no AI call)`);

// A changed price rule applies to every imported product at once (the price is a pure function of the
// supplier's EGP price), so nothing waits for its refresh and the reviewer never hides products for it.
let repriced = 0;
for (const p of products) {
  if (!isImported(p) || !(Number(p.supplierPrice) > 0)) continue;
  // Same for the brand spelling (RASASI → Rasasi): the filter never waits for a refresh to list a brand once.
  if (p.brand && normalizeBrand(p.brand) !== p.brand) p.brand = normalizeBrand(p.brand);
  const price = ourPriceOf(Number(p.supplierPrice), MARKUP);
  if (price !== Number(p.ourPrice)) { p.ourPrice = price; repriced++; }
}
if (repriced) say(`Price rule ×${MARKUP.markup}${MARKUP.shippingEgp ? ` + ${MARKUP.shippingEgp} EGP shipping` : ''}${MARKUP.maxProfitEgp ? `, profit ≤ ${MARKUP.maxProfitEgp} EGP` : ''}: ${repriced} products repriced`);
const prices = priceReport(products);
importInfo.prices = prices;
if (prices.count) say(`Prices of ${prices.count} imported products: ${prices.min}–${prices.max} EGP (median ${prices.median})`);

// Photos whose source/contact marks were removed by «منقّح الصور»: the clean copy in the site, never the supplier's.
const cleanRegistry = read<ImageRegistry>(new URL('../../src/data/live/image-clean.json', import.meta.url));
const cleaned = useCleanPhotos(products, cleanRegistry);
if (cleaned) say(`${cleaned} products use their cleaned photos`);

// «مراجع الصفحات» reviews the whole store after the import.
importInfo.durationMs = Date.now() - started;
const { products: reviewed, report } = await reviewStore(products, { previous, importInfo, markup: MARKUP, imageBudget: Number(env.REVIEW_IMAGE_BUDGET ?? 80) });
say(`Reviewer: ${report.summary.total} products — ${report.summary.ok} ok, ${report.summary.warn} with remarks, ${report.summary.hidden} hidden; ${report.summary.imagesChecked} photos checked, ${report.summary.brokenImages} broken`);

writeFileSync(PRODUCTS, JSON.stringify({ products: reviewed }, null, 2));
writeFileSync(REVIEW, `${JSON.stringify(report, null, 1)}\n`);
say(`products.json: ${before} → ${reviewed.length} products`);

if (env.GITHUB_STEP_SUMMARY) {
  const rows = report.items.slice(0, 25).map((i) => `- **${i.sku}** ${i.name} — ${i.status === 'hidden' ? '🚫 مخفي' : '⚠️'} ${i.issues.join('، ')}`);
  const dear = prices.top.map((t) => `- **${t.sku}** ${t.name} — ${t.price} جنيه (تكلفة المورد ${Math.round(t.supplierEgp)} جنيه)`).join('\n');
  appendFileSync(env.GITHUB_STEP_SUMMARY, `## مستورد شاهين + مراجع الصفحات — ${new Date().toISOString()}\n\n${log.map((l) => `- ${l}`).join('\n')}\n\n### أغلى المنتجات المستوردة\n${dear || 'لا يوجد'}\n\n### ملاحظات المراجع\n${rows.join('\n') || 'لا يوجد'}\n`);
}
if (env.GITHUB_ACTIONS) {
  const clean = (t: string) => t.replace(/[\r\n%]/g, ' ').slice(0, 900);
  console.log(`::notice title=Shaheen importer::${clean(log.join(' | '))}`);
  const added = reviewed.filter((p) => isImported(p) && (p as ImportedProduct).importedAt === (p as ImportedProduct).refreshedAt).slice(-3)
    .map((p) => { const i = p as ImportedProduct; return `${i.sku} ${i.nameEn} — ${i.ourPrice} EGP (${i.supplierPriceOriginal} ${i.supplierCurrency}) — ${i.images.length} photos — notes ${[...(i.notes?.top || []), ...(i.notes?.heart || [])].slice(0, 4).join('/')}`; });
  if (added.length) console.log(`::notice title=Imported samples::${clean(added.join(' || '))}`);
  if (prices.top.length) console.log(`::notice title=Most expensive imports::${clean(prices.top.map((t) => `${t.sku} ${t.name} — ${t.price} EGP (supplier ${Math.round(t.supplierEgp)} EGP)`).join(' || '))}`);
  const remarks = report.items.filter((i) => i.status === 'hidden').slice(0, 4).map((i) => `${i.sku}: ${i.issues.join(', ')}`);
  if (remarks.length) console.log(`::warning title=Reviewer hid::${clean(remarks.join(' || '))}`);
}
