/**
 * «كشّاف المصادر» — GitHub Actions runs this every 6 hours (.github/workflows/shaheen-discover.yml):
 *   node --import tsx scripts/shaheen-discover/run.mts
 * 1. Finds online perfume stores:
 *    - with AI: «الخبير شاهين» searches the web (Gemini with Google Search) in Arabic and English, per market
 *      and per brand the store sells; searches that found good stores are repeated first;
 *    - by himself (no AI, or the quota is used up): the official shops of the brands the store already
 *      sells, the stores an earlier search found but were not checked yet, and DISCOVER_SEEDS;
 *    - optional: BRAVE_SEARCH_API_KEY (a search service) when the merchant adds one.
 * 2. Checks each store politely (robots.txt respected, one page at a time): its product sitemap, then 6 product
 *    pages spread over the catalog must give complete products (name, price, currency, photo) without AI,
 *    in one currency, and be perfume. Good stores become import sources (src/data/live/import-sources.json);
 *    «مستورد شاهين» then imports them with the same method as the original supplier (×1.5, review, photos).
 * 3. Re-checks active stores weekly (a store that stops working is paused, its products stay reviewed).
 * Never imports from marketplaces, social networks or review sites; the merchant can block any site
 * (DISCOVER_BLOCK) and cap the number of active stores (DISCOVER_MAX_ACTIVE).
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { RawProduct } from '../../src/utils/storeCatalog';
import { extractProduct, parseSitemap, parseSitemapIndex } from '../shaheen-import/extract';
import { extractGeneric } from '../shaheen-import/generic';
import { SOURCES } from '../shaheen-import/sources';
import { quotaBook } from '../doctor/agent';
import {
  addCandidates, brandSiteGuesses, domainOf, domainsFromSearch, emptySources, isNeverSource, isSourcesFile, judgeSamples,
  parseRobots, planQueries, PRODUCTISH, spreadSample, summary, vettingQueue, type LiveSource, type Sample, type SourcesFile,
} from './discover';

const env = process.env;
const FILE = new URL('../../src/data/live/import-sources.json', import.meta.url);
const PRODUCTS = new URL('../../src/data/products.json', import.meta.url);
const UA = 'Mozilla/5.0 (compatible; ShaheenImporter/1.0; +https://spculculat-oss.github.io/Sham-Perfume/)';
const started = Date.now();
const BUDGET_MS = Number(env.DISCOVER_TIME_BUDGET_S ?? 900) * 1000;
const MAX_ACTIVE = Math.max(1, Number(env.DISCOVER_MAX_ACTIVE ?? 12));
const VET_PER_RUN = Math.max(1, Number(env.DISCOVER_VET_PER_RUN ?? 8));
const QUERIES = Math.max(0, Number(env.DISCOVER_QUERIES ?? 4));
const BLOCK = (env.DISCOVER_BLOCK || '').split(/[\s,]+/).map(domainOf).filter(Boolean);
const now = new Date();
const iso = now.toISOString();
const notes: string[] = [];
const say = (line: string) => { console.log(line); notes.push(line); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const timeLeft = () => BUDGET_MS - (Date.now() - started);

async function get(url: string, timeoutMs = 20_000): Promise<{ status: number; body: string; url: string }> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en,ar;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
    const type = r.headers.get('content-type') || '';
    const body = /text|xml|html|json/.test(type) || !type ? await r.text() : '';
    return { status: r.status, body: body.slice(0, 15_000_000), url: r.url || url };
  } catch { return { status: 0, body: '', url }; }
}

const read = (): SourcesFile => { try { const d: unknown = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : undefined; return isSourcesFile(d) ? d : emptySources(); } catch { return emptySources(); } };
const file = read();
const before = summary(file);
// The built-in supplier(s) are known already: never «discovered» again.
const builtInHosts = SOURCES.map((s) => domainOf(s.base));
const block = [...BLOCK, ...builtInHosts];
for (const s of file.sources) if (BLOCK.includes(s.host) && s.status !== 'blocked') { s.status = 'blocked'; s.reason = 'حظره التاجر'; }

// Brands the store sells, most common first: the scout looks for their shops and searches by them.
const products: RawProduct[] = (() => { try { return (JSON.parse(readFileSync(PRODUCTS, 'utf8')) as { products?: RawProduct[] }).products || []; } catch { return []; } })();
const brandCount = new Map<string, number>();
for (const p of products) { const b = String(p.brand || '').trim(); if (b && b !== 'Unknown') brandCount.set(b, (brandCount.get(b) || 0) + 1); }
const brands = [...brandCount.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b);

// ── 1. Finding stores ─────────────────────────────────────────────────────────────────────────────────────
let mode: 'ai' | 'self' = 'self';
let found = 0;
const quota = quotaBook(new URL('../../src/data/live/ai-quota.json', import.meta.url));
const geminiKey = env.GEMINI_API_KEY?.trim();
const model = env.DISCOVER_MODEL?.trim() || env.GEMINI_MODEL?.trim() || 'gemini-flash-latest';
if (geminiKey && QUERIES && !quota.pausedUntil('gemini')) {
  for (const q of planQueries(file, brands, now.getTime(), QUERIES)) {
    const prompt = q.lang === 'ar'
      ? `${q.q}. اذكر أسماء نطاقات (domains) متاجر العطور الإلكترونية الحقيقية التي تبيع العطور مباشرة للعملاء بأسعار ظاهرة (ليست أسواقاً مثل أمازون ونون، وليست مواقع مراجعات). سطر لكل متجر: النطاق فقط.`
      : `${q.q}. List the domains of real online perfume shops that sell directly to customers with visible prices (not marketplaces like Amazon or noon, not review sites). One shop per line: the domain only.`;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.3 } }),
        signal: AbortSignal.timeout(60_000),
      });
      if (r.status === 429) { say('Web search: AI quota used up — the scout continues by himself'); break; }
      if (!r.ok) { say(`Web search unavailable (HTTP ${r.status}) — the scout continues by himself`); break; }
      const domains = domainsFromSearch(await r.json());
      const added = addCandidates(file, domains.map((host) => ({ host, foundBy: 'shaheen-search' as const, foundWith: q.q })), iso, block);
      const stat = file.queries.find((x) => x.q === q.q)!;
      stat.runs += 1; stat.found += added; stat.lastRun = iso;
      found += added; mode = 'ai';
      say(`Search «${q.q.slice(0, 70)}»: ${domains.length} sites mentioned, ${added} new stores to check`);
    } catch (error) { say(`Web search failed (${(error as Error).message.slice(0, 80)}) — the scout continues by himself`); break; }
  }
}
const braveKey = env.BRAVE_SEARCH_API_KEY?.trim();
if (braveKey) {
  for (const q of planQueries(file, brands, now.getTime(), 2)) {
    const r = await fetch(`https://api.search.brave.com/res/v1/web/search?count=20&q=${encodeURIComponent(q.q)}`, { headers: { 'X-Subscription-Token': braveKey, Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) }).catch(() => undefined);
    if (!r?.ok) break;
    const data = await r.json() as { web?: { results?: { url?: string }[] } };
    const added = addCandidates(file, (data.web?.results || []).map((x) => ({ host: x.url || '', foundBy: 'search-api' as const, foundWith: q.q })), iso, block);
    found += added;
    say(`Search service «${q.q.slice(0, 60)}»: ${added} new stores to check`);
  }
}
// By himself: official shops of the store's own brands (a few new ones per run) and the merchant's seeds.
const guesses = brandSiteGuesses(brands, 60).filter((g) => !file.sources.some((s) => s.host === g.host)).slice(0, 6);
found += addCandidates(file, guesses.map((g) => ({ host: g.host, foundBy: 'brand-site' as const, foundWith: g.brand })), iso, block);
found += addCandidates(file, (env.DISCOVER_SEEDS || '').split(/[\s,]+/).filter(Boolean).map((host) => ({ host, foundBy: 'seed' as const })), iso, block);
say(`${found} new stores found this run (${mode === 'ai' ? 'web search + own methods' : 'own methods, no AI'})`);

// ── 2. Checking stores ────────────────────────────────────────────────────────────────────────────────────
async function productSitemaps(base: string, listed: string[]): Promise<{ sitemaps: string[]; urls: string[]; refused: number; tried: number }> {
  const queue = listed.length ? [...listed] : ['sitemap.xml', 'sitemap_index.xml', 'wp-sitemap.xml', 'product-sitemap.xml'].map((p) => new URL(p, base).href);
  const seen = new Set<string>(); const used: string[] = []; const urls: string[] = [];
  let generic = false;
  let refused = 0; let tried = 0;
  while (queue.length && seen.size < 12 && urls.length < 60_000 && timeLeft() > 30_000) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    const { status, body } = await get(url);
    tried++;
    // 403/429/503 or a «checking your browser» page instead of XML: the site refuses automated readers.
    if (status === 403 || status === 429 || status === 503 || (status === 200 && /<html/i.test(body.slice(0, 2000)) && /challenge|captcha|just a moment|cf-/i.test(body.slice(0, 20_000)))) refused++;
    if (status !== 200 || !/<(?:urlset|sitemapindex)/.test(body)) continue;
    const children = parseSitemapIndex(body);
    if (children.length) {
      const products = children.filter((c) => /product|perfume|parfum|fragrance|item|catalog/i.test(c));
      queue.unshift(...(products.length ? products : children.slice(0, 4)));
      if (!products.length) generic = true;
      continue;
    }
    const entries = parseSitemap(body).map((e) => e.url);
    if (!entries.length) continue;
    used.push(url);
    urls.push(...entries);
    if (!/product|perfume|parfum|fragrance|item|catalog/i.test(url)) generic = true;
    if (listed.length === 0 && !generic) break;
  }
  // A mixed sitemap (pages + posts + products): keep the links that look like product pages.
  const host = domainOf(base);
  const same = urls.filter((u) => domainOf(u) === host);
  return { sitemaps: used, urls: generic ? same.filter((u) => PRODUCTISH.test(u)) : same, refused, tried };
}

async function rateToEgp(currency: string): Promise<number | undefined> {
  if (currency === 'EGP') return 1;
  try {
    const r = await fetch(`https://open.er-api.com/v6/latest/${currency}`, { signal: AbortSignal.timeout(15_000) });
    const d = await r.json() as { result?: string; rates?: Record<string, number> };
    return d.result === 'success' && d.rates?.EGP ? Math.round(d.rates.EGP * 10_000) / 10_000 : undefined;
  } catch { return undefined; }
}

async function vet(s: LiveSource): Promise<void> {
  s.attempts += 1;
  s.vettedAt = iso;
  const wasActive = s.status === 'active';
  const fail = (reason: string, final = false) => {
    s.reason = reason;
    if (wasActive) s.status = 'paused';
    else if (final || s.attempts >= 3) s.status = 'rejected';
    say(`✗ ${s.host}: ${reason}`);
  };
  const home = await get(s.base);
  if (home.status !== 200 || !home.body) return fail(home.status ? `الموقع لا يفتح (HTTP ${home.status})` : 'الموقع لا يفتح');
  const finalHost = domainOf(home.url);
  if (isNeverSource(finalHost, block)) { s.status = 'blocked'; s.reason = 'يحوّل إلى سوق أو موقع غير متجر'; return; }
  if (finalHost && finalHost !== s.host && !finalHost.endsWith(`.${s.host}`) && !s.host.endsWith(`.${finalHost}`)) {
    if (file.sources.some((x) => x !== s && x.host === finalHost)) { s.status = 'rejected'; s.reason = `نفس متجر ${finalHost}`; return; }
  }
  const base = new URL(home.url).origin;
  s.base = base;
  const siteName = (home.body.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']{2,60})["']/i) || home.body.match(/<title[^>]*>([^<]{2,80})<\/title>/i) || [])[1];
  if (siteName) s.name = siteName.replace(/\s*[|–—-].*$/, '').trim().slice(0, 60) || s.host;
  const robotsText = await get(new URL('/robots.txt', base).href);
  const robots = parseRobots(robotsText.status === 200 ? robotsText.body : '');
  if (!robots.allowed('/')) return fail('ملف robots.txt يمنع القراءة الآلية', true);
  const { sitemaps, urls, refused, tried } = await productSitemaps(base, robots.sitemaps.filter((u) => domainOf(u) === domainOf(base)));
  const allowed = urls.filter((u) => { try { return robots.allowed(new URL(u).pathname); } catch { return false; } });
  if (!allowed.length) {
    return fail(urls.length ? 'روابط المنتجات ممنوعة في robots.txt'
      : refused && refused >= tried / 2 ? 'الموقع يرفض القراءة الآلية (حماية)' : 'لا توجد خريطة منتجات (sitemap)');
  }
  const delay = Math.max(600, robots.crawlDelayMs || 0);
  const samples: Sample[] = [];
  for (const url of spreadSample(allowed, 6)) {
    if (timeLeft() < 20_000) break;
    await sleep(delay);
    const page = await get(url);
    const product = page.status === 200 ? (extractProduct(page.body, url) || extractGeneric(page.body, url, '')) : null;
    samples.push({ url, product, status: page.status });
  }
  const verdict = judgeSamples(samples);
  s.sampleOk = verdict.okCount; s.sampleTotal = verdict.total;
  if (!verdict.ok) return fail(verdict.reason || 'غير صالح');
  const rate = await rateToEgp(verdict.currency!);
  if (!rate) return fail(`لا يوجد سعر صرف للعملة ${verdict.currency}`);
  const pattern = new RegExp(verdict.pattern!, 'i');
  Object.assign(s, {
    currency: verdict.currency, rateToEgp: rate, productPattern: verdict.pattern, sitemaps, via: verdict.via,
    productsEstimate: allowed.filter((u) => pattern.test(u)).length, crawlDelayMs: robots.crawlDelayMs, reason: undefined,
  });
  const activeNow = file.sources.filter((x) => x.status === 'active' && x !== s).length;
  if (wasActive || activeNow < MAX_ACTIVE) {
    s.status = 'active';
    if (!wasActive) {
      const q = file.queries.find((x) => x.q === s.foundWith);
      if (q) q.activated += 1;
    }
    say(`✓ ${s.host}: ${s.productsEstimate} perfumes, ${verdict.okCount}/${verdict.total} pages read without AI, ${verdict.currency} (1 = ${rate} EGP)${wasActive ? ' — still good' : ' — added to the importer'}`);
  } else {
    s.status = 'candidate';
    s.reason = `صالح — ينتظر مكاناً (الحد ${MAX_ACTIVE} مصادر نشطة)`;
    say(`… ${s.host}: good, waiting (already ${MAX_ACTIVE} active stores)`);
  }
}

let vetted = 0;
for (const s of vettingQueue(file, now.getTime(), VET_PER_RUN)) {
  if (timeLeft() < 60_000) { say('Time budget reached — the next run continues the checks'); break; }
  if (isNeverSource(s.host, block)) { s.status = 'blocked'; continue; }
  await vet(s).catch((error) => { s.reason = `خطأ أثناء الفحص: ${(error as Error).message.slice(0, 80)}`; });
  vetted++;
}

const after = summary(file);
file.runs = [{ at: iso, mode, found, vetted, activated: Math.max(0, after.active - before.active), rejected: Math.max(0, after.rejected - before.rejected), notes: notes.slice(-12) }, ...file.runs].slice(0, 30);
file.updatedAt = iso;
writeFileSync(FILE, `${JSON.stringify(file, null, 1)}\n`);
say(`Sources: ${after.active} active (~${after.products} perfumes), ${after.candidate} waiting, ${after.rejected} rejected, ${after.blocked} blocked`);

if (env.GITHUB_ACTIONS) {
  const clean = (t: string) => t.replace(/[\r\n%]/g, ' ').slice(0, 900);
  // Two notices: how stores were found (web search / own methods), and what the checks decided.
  const checks = notes.filter((n) => /^[✓✗…]/.test(n));
  console.log(`::notice title=كشّاف المصادر — البحث::${clean(notes.filter((n) => !checks.includes(n) && !/^Sources:/.test(n)).join(' | '))}`);
  console.log(`::notice title=كشّاف المصادر — الفحص::${clean([...checks.slice(-8), notes[notes.length - 1]].join(' | '))}`);
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `activated=${Math.max(0, after.active - before.active)}\n`);
}
if (env.GITHUB_STEP_SUMMARY) {
  const rows = file.sources.filter((s) => s.status !== 'blocked').slice(-40).map((s) => `| ${s.host} | ${s.status} | ${s.productsEstimate ?? '—'} | ${s.currency ?? '—'} | ${s.reason ?? ''} |`);
  appendFileSync(env.GITHUB_STEP_SUMMARY, `## كشّاف المصادر — ${iso}\n\n${notes.map((n) => `- ${n}`).join('\n')}\n\n| المتجر | الحالة | العطور | العملة | ملاحظة |\n|---|---|---|---|---|\n${rows.join('\n')}\n`);
}
