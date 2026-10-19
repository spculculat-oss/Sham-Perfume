/**
 * «كشّاف المصادر» — GitHub Actions runs this every 6 hours (.github/workflows/shaheen-discover.yml):
 *   node --import tsx scripts/shaheen-discover/run.mts
 * 1. Finds online perfume stores:
 *    - with AI: «الخبير شاهين» searches the web (Gemini with Google Search) all over the world — the Arab world,
 *      Europe, the Americas, East and Central Asia — each region in its own language and in English, and per
 *      brand the store sells; the regions take turns and searches that found good stores are repeated first;
 *    - his address book of well-known shops worldwide (KNOWN_STORES, a few new ones per run, regions in turn);
 *    - by himself (no AI, or the quota is used up): the official shops of the brands the store already
 *      sells, the stores an earlier search found but were not checked yet, and DISCOVER_SEEDS;
 *    - optional: BRAVE_SEARCH_API_KEY (a search service) when the merchant adds one.
 * 2. Reads each store's «CV» first (trust.ts): domain age (RDAP), https, contact details and company identity,
 *    returns / shipping / privacy / terms, known payment methods, platform, social accounts, «original» promise;
 *    a red flag (copies, a brand-new domain, a dangerous site) or a score under 60/100 rejects it.
 *    Then checks it politely (robots.txt respected, one page at a time): its product sitemap, then 6 product
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
import { keyFingerprint, quotaBook } from '../doctor/agent';
import { councilSeeds, readCouncil } from '../shaheen-council/council';
import {
  addCandidates, brandSiteGuesses, CATEGORYISH, NOT_PRODUCT, oneLanguage, sameSite, domainOf, KNOWN_STORES, pageLinks, withPage, domainsFromSearch, emptySources, isNeverSource, isSourcesFile, judgeSamples,
  inferProductPattern, parseRobots, planQueries, productCandidates, spreadSample, summary, vettingQueue, type LiveSource, type Sample, type SourcesFile,
} from './discover';
import { assessTrust, copyShare, pageKind, rdapRegistered, regionOf, registrableDomain, trustLinks, trustReason, TRUST_MIN, type TrustId, type TrustProfile } from './trust';

const env = process.env;
const FILE = new URL('../../src/data/live/import-sources.json', import.meta.url);
const PRODUCTS = new URL('../../src/data/products.json', import.meta.url);
const UA = 'Mozilla/5.0 (compatible; ShaheenImporter/1.0; +https://spculculat-oss.github.io/Sham-Perfume/)';
const started = Date.now();
const BUDGET_MS = Number(env.DISCOVER_TIME_BUDGET_S ?? 900) * 1000;
const MAX_ACTIVE = Math.max(1, Number(env.DISCOVER_MAX_ACTIVE ?? 20));
const VET_PER_RUN = Math.max(1, Number(env.DISCOVER_VET_PER_RUN ?? 10));
const QUERIES = Math.max(0, Number(env.DISCOVER_QUERIES ?? 4));
const BLOCK = (env.DISCOVER_BLOCK || '').split(/[\s,]+/).map(domainOf).filter(Boolean);
/** Stores the merchant vouches for himself: their CV is still read and shown, a weak score does not stop them. */
const TRUSTED = (env.DISCOVER_TRUSTED || '').split(/[\s,]+/).map(domainOf).filter(Boolean);
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
// Grounded search has its own daily allowance per model: when one model's allowance is used up, the next one is tried.
const models = [...new Set([env.DISCOVER_MODEL?.trim(), env.GEMINI_MODEL?.trim(), 'gemini-flash-latest', 'gemini-flash-lite-latest'].filter((m): m is string => Boolean(m)))];
if (geminiKey && QUERIES && !quota.pausedUntil('gemini', keyFingerprint(env, 'gemini'))) {
  for (const q of planQueries(file, brands, now.getTime(), QUERIES)) {
    // Searches in French, Japanese, Russian… keep their own words; the instruction is in English.
    const prompt = q.lang === 'ar'
      ? `${q.q}. اذكر أسماء نطاقات (domains) متاجر العطور الإلكترونية الحقيقية والموثوقة (شركات معروفة منذ سنوات، تبيع عطوراً أصلية فقط) التي تبيع مباشرة للعملاء بأسعار ظاهرة (ليست أسواقاً مثل أمازون ونون، وليست مواقع مراجعات ولا متاجر عطور مقلدة). سطر لكل متجر: النطاق فقط.`
      : `${q.q}. List the domains of real, established and trustworthy online perfume shops (known companies, several years old, selling only authentic perfumes) that sell directly to customers with visible prices (not marketplaces like Amazon or noon, not review sites, no replica/dupe shops). One shop per line: the domain only.`;
    try {
      let r: Response | undefined;
      while (models.length) {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${models[0]}:generateContent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.3 } }),
          signal: AbortSignal.timeout(60_000),
        });
        if (r.status !== 429 && r.status !== 404) break;
        models.shift();
      }
      if (!r || r.status === 429 || r.status === 404) { say('Web search: AI quota used up — the scout continues by himself'); break; }
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
const known = KNOWN_STORES.filter((h) => !file.sources.some((s) => s.host === h)).slice(0, 6);
found += addCandidates(file, known.map((host) => ({ host, foundBy: 'known-store' as const })), iso, block);
const guesses = brandSiteGuesses(brands, 60).filter((g) => !file.sources.some((s) => s.host === g.host)).slice(0, 6);
found += addCandidates(file, guesses.map((g) => ({ host: g.host, foundBy: 'brand-site' as const, foundWith: g.brand })), iso, block);
found += addCandidates(file, (env.DISCOVER_SEEDS || '').split(/[\s,]+/).filter(Boolean).map((host) => ({ host, foundBy: 'seed' as const })), iso, block);
found += addCandidates(file, councilSeeds(readCouncil(), now.getTime()).map((host) => ({ host, foundBy: 'council' as const, foundWith: 'اجتماع شاهين اليومي' })), iso, block);
say(`${found} new stores found this run (${mode === 'ai' ? 'web search + own methods' : 'own methods, no AI'})`);

// ── 2. Checking stores ────────────────────────────────────────────────────────────────────────────────────
async function productSitemaps(base: string, listed: string[]): Promise<{ sitemaps: string[]; urls: string[]; refused: number; tried: number; trace: string[] }> {
  // Without a sitemap in robots.txt: where WordPress/Yoast, Shopify, Salla, Zid, Magento and others put theirs.
  const queue = listed.length ? [...listed] : ['sitemap.xml', 'sitemap_index.xml', 'wp-sitemap.xml', 'product-sitemap.xml', 'sitemap_products_1.xml', 'sitemap/sitemap.xml', 'media/sitemap.xml', 'pub/media/sitemap.xml'].map((p) => new URL(p, base).href);
  const seen = new Set<string>(); const used: string[] = []; const urls: string[] = [];
  let generic = false;
  let refused = 0; let tried = 0;
  const trace: string[] = [];
  while (queue.length && seen.size < 12 && urls.length < 60_000 && timeLeft() > 30_000) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    const { status, body } = await get(url);
    tried++;
    // 403/429/503 or a «checking your browser» page instead of XML: the site refuses automated readers.
    if (status === 403 || status === 429 || status === 503 || (status === 200 && /<html/i.test(body.slice(0, 2000)) && /challenge|captcha|just a moment|cf-/i.test(body.slice(0, 20_000)))) refused++;
    const xml = /<(?:urlset|sitemapindex)/.test(body);
    const short = (() => { try { const u = new URL(url); return u.pathname.split('/').pop() || u.pathname; } catch { return url; } })();
    if (status !== 200 || !xml) { trace.push(`${short}→${status}${status === 200 ? '(not xml)' : ''}`); continue; }
    const children = parseSitemapIndex(body);
    trace.push(`${short}→${children.length ? `${children.length} maps` : `${parseSitemap(body).length} links`}`);
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
  const same = urls.filter((u) => sameSite(domainOf(u), host));
  const single = oneLanguage(generic ? productCandidates(same) : same);
  const urlsOut = single.urls;
  if (urls.length) trace.push(`${same.length} on site, ${urlsOut.length} product-like${single.lang ? ` (language «${single.lang}» of several)` : ''}`);
  return { sitemaps: used, urls: urlsOut, refused, tried, trace };
}

/**
 * No public sitemap: Shaheen browses the store like a visitor — the home page, then its category pages
 * (page 1 and 2) — and collects the links that look like products. Robots.txt is respected for every page.
 */
async function crawlProducts(base: string, homeHtml: string, robots: ReturnType<typeof parseRobots>, delay: number): Promise<{ pages: string[]; urls: string[] }> {
  const ok = (u: string) => { try { return robots.allowed(new URL(u).pathname); } catch { return false; } };
  const homeLinks = pageLinks(homeHtml, base).filter(ok);
  const shopify = /cdn\.shopify\.com|Shopify\.theme/i.test(homeHtml);
  // Category links by their usual names; without any, the site's menu links (short paths that are not store pages).
  const named = homeLinks.filter((u) => CATEGORYISH.test(u));
  const menu = homeLinks.filter((u) => { try { const d = new URL(u).pathname.split('/').filter(Boolean).length; return d >= 1 && d <= 2 && !NOT_PRODUCT.test(u); } catch { return false; } });
  const categories = [...new Set([...(shopify ? [new URL('/collections/all', base).href] : []), ...(named.length ? named : menu.slice(0, 6))])].slice(0, 8);
  const urls = new Set(productCandidates(homeLinks));
  // The home page itself lists products on many stores: it is browsed every run too.
  const pages: string[] = urls.size >= 3 ? [base] : [];
  for (const cat of categories) {
    if (timeLeft() < 60_000) break;
    let added = 0;
    for (let n = 1; n <= 2; n++) {
      await sleep(delay);
      const page = await get(withPage(cat, n));
      if (page.status !== 200) break;
      const before = urls.size;
      for (const u of productCandidates(pageLinks(page.body, base).filter(ok))) if (!CATEGORYISH.test(u)) urls.add(u);
      added += urls.size - before;
      if (urls.size === before) break;
    }
    if (added) pages.push(cat);
  }
  return { pages, urls: oneLanguage([...urls]).urls };
}

async function rateToEgp(currency: string): Promise<number | undefined> {
  if (currency === 'EGP') return 1;
  try {
    const r = await fetch(`https://open.er-api.com/v6/latest/${currency}`, { signal: AbortSignal.timeout(15_000) });
    const d = await r.json() as { result?: string; rates?: Record<string, number> };
    return d.result === 'success' && d.rates?.EGP ? Math.round(d.rates.EGP * 10_000) / 10_000 : undefined;
  } catch { return undefined; }
}

/**
 * The store's «CV» (trust.ts): its contact / legal / returns pages (robots.txt respected), the domain's
 * registration date from the public registry (RDAP), and Google Safe Browsing when the merchant adds a key.
 */
async function readCv(host: string, base: string, homeHtml: string, robots: ReturnType<typeof parseRobots>, delay: number): Promise<TrustProfile> {
  const pages: { url: string; html: string }[] = [];
  const blocked: TrustId[] = [];
  const tried: string[] = [];
  const short = (u: string) => { try { return new URL(u).pathname; } catch { return u; } };
  for (const url of trustLinks(homeHtml, base, 6)) {
    // A page robots.txt forbids is not opened (Shopify forbids /policies/): the check says «could not check».
    try { if (!robots.allowed(new URL(url).pathname)) { const k = pageKind(url); if (k) blocked.push(k); continue; } } catch { continue; }
    if (timeLeft() < 60_000) break;
    await sleep(delay);
    const page = await get(url);
    tried.push(`${short(url)}→${page.status}`);
    // A missing page that sends back to the home page is not that page.
    const landed = (() => { try { return new URL(page.url).pathname; } catch { return '/'; } })();
    if (page.status === 200 && page.body && landed !== '/' && !/^\/[a-z]{2}(?:-[a-z]{2})?\/?$/i.test(landed)) pages.push({ url: page.url, html: page.body.slice(0, 3_000_000) });
  }
  let registeredAt: string | null | undefined;
  const rdap = await get(`https://rdap.org/domain/${registrableDomain(host)}`, 15_000);
  if (rdap.status === 200) { try { registeredAt = rdapRegistered(JSON.parse(rdap.body)) ?? null; } catch { registeredAt = null; } } else registeredAt = null;
  let safeBrowsing: 'clean' | 'flagged' | undefined;
  const sbKey = env.SAFE_BROWSING_API_KEY?.trim();
  if (sbKey) {
    const r = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(sbKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ client: { clientId: 'sham-perfume-scout', clientVersion: '1.0' }, threatInfo: { threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'], platformTypes: ['ANY_PLATFORM'], threatEntryTypes: ['URL'], threatEntries: [{ url: base }] } }),
    }).catch(() => undefined);
    if (r?.ok) { const d = await r.json().catch(() => ({})) as { matches?: unknown[] }; safeBrowsing = d.matches?.length ? 'flagged' : 'clean'; }
  }
  const cv = assessTrust({ host, finalUrl: base, homeHtml, pages, registeredAt, safeBrowsing, blocked, brands, now: now.getTime() });
  cvPagesRead.set(cv, tried);
  if (blocked.length) cvPagesRead.set(cv, [...(cvPagesRead.get(cv) || []), `robots-blocked: ${blocked.join(',')}`]);
  return cv;
}
const cvPagesRead = new WeakMap<TrustProfile, string[]>();
const pagesRead = (cv: TrustProfile) => `pages: ${(cvPagesRead.get(cv) || []).join(' ') || 'home only'}`;

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
  // Before anything is imported: the store's CV. A red flag rejects it for good; a weak CV may improve
  // (checked again after a month, like other rejections, up to three times).
  const cv = await readCv(s.host, base, home.body, robots, Math.max(600, robots.crawlDelayMs || 0));
  s.trust = cv;
  s.region = regionOf(domainOf(base) || s.host, s.currency);
  const cvLine = `CV ${cv.score}/100${cv.flags.length ? ` ⚑ ${cv.flags[0]}` : ''} [${cv.checks.filter((c) => c.ok).map((c) => c.id).join(',')}]${cv.checks.find((c) => c.id === 'platform')?.detail ? ` on ${cv.checks.find((c) => c.id === 'platform')?.detail}` : ''}`;
  // A red flag (copies, a brand-new domain, dangerous site…) is final: not retried next month.
  if (cv.verdict === 'rejected') { s.attempts = Math.max(s.attempts, 3); return fail(trustReason(cv), true); }
  if (cv.score < TRUST_MIN) {
    say(`  ↳ ${s.host}: ${cvLine} (${pagesRead(cv)})`);
    if (!TRUSTED.some((h) => sameSite(h, s.host))) return fail(trustReason(cv));
    cv.vouched = true;
    say(`  ↳ ${s.host}: weak CV, but the merchant vouches for it (DISCOVER_TRUSTED)`);
  }
  say(`  ↳ ${s.host}: ${cvLine}`);
  const { sitemaps, urls, refused, tried, trace } = await productSitemaps(base, robots.sitemaps.filter((u) => sameSite(domainOf(u), domainOf(base))));
  let allowed = urls.filter((u) => { try { return robots.allowed(new URL(u).pathname); } catch { return false; } });
  let crawlPages: string[] = [];
  if (!allowed.length && !(refused && refused >= tried / 2)) {
    // No sitemap: browse the store's categories instead.
    const crawl = await crawlProducts(base, home.body, robots, Math.max(600, robots.crawlDelayMs || 0));
    trace.push(`browsed ${crawl.pages.length} category pages → ${crawl.urls.length} product-like links`);
    if (crawl.pages.length && crawl.urls.length >= 3) { allowed = crawl.urls; crawlPages = crawl.pages; }
  }
  if (!allowed.length) {
    console.log(`  ${s.host} sitemap trace: ${trace.join(', ')}`);
    notes.push(`  ↳ ${s.host}: ${[...trace.slice(0, 3), ...(trace.length > 5 ? ['…'] : trace.slice(3, 5)), ...(trace.length > 5 ? trace.slice(-2) : [])].join(', ')}`);
    return fail(urls.length ? 'روابط المنتجات ممنوعة في robots.txt'
      : refused && refused >= tried / 2 ? 'الموقع يرفض القراءة الآلية (حماية)' : 'لا توجد خريطة منتجات (sitemap)');
  }
  const delay = Math.max(600, robots.crawlDelayMs || 0);
  const readPages = async (urls: string[]) => {
    const out: Sample[] = [];
    for (const url of urls) {
      if (timeLeft() < 20_000) break;
      await sleep(delay);
      const page = await get(url);
      const product = page.status === 200 ? (extractProduct(page.body, url) || extractGeneric(page.body, url, '')) : null;
      out.push({ url, product, status: page.status });
    }
    return out;
  };
  let samples = await readPages(spreadSample(allowed, 6));
  let verdict = judgeSamples(samples);
  // A sitemap that mixes products with other pages: learn the product-link shape from the pages that were
  // products, keep only the links of that shape, and judge the store on a fresh sample of them.
  const goodUrls = samples.filter((x) => x.product).map((x) => x.url);
  if (!verdict.ok && goodUrls.length && verdict.reason !== 'الموقع يرفض القراءة الآلية (حماية)') {
    const shape = inferProductPattern(goodUrls);
    const re = shape ? new RegExp(shape, 'i') : undefined;
    const narrowed = re ? allowed.filter((u) => re.test(u) && !goodUrls.includes(u)) : [];
    if (re && narrowed.length >= 3 && narrowed.length < allowed.length) {
      samples = [...samples.filter((x) => x.product), ...await readPages(spreadSample(narrowed, 5))];
      verdict = judgeSamples(samples);
    }
  }
  s.sampleOk = verdict.okCount; s.sampleTotal = verdict.total;
  if (!verdict.ok) return fail(verdict.reason || 'غير صالح');
  // The CV's last check: the products themselves are not copies of other houses' perfumes.
  const names = samples.map((x) => x.product?.name || '').filter(Boolean);
  if (copyShare(names) >= 0.3) {
    cv.flags.push('أسماء منتجاته تدل على عطور مقلّدة («dupe / inspired by»)');
    cv.verdict = 'rejected';
    s.attempts = Math.max(s.attempts, 3);
    return fail(trustReason(cv), true);
  }
  const rate = await rateToEgp(verdict.currency!);
  if (!rate) return fail(`لا يوجد سعر صرف للعملة ${verdict.currency}`);
  const pattern = new RegExp(verdict.pattern!, 'i');
  Object.assign(s, {
    currency: verdict.currency, rateToEgp: rate, productPattern: verdict.pattern, sitemaps, via: verdict.via, crawlPages: crawlPages.length ? crawlPages : undefined,
    productsEstimate: allowed.filter((u) => pattern.test(u)).length, crawlDelayMs: robots.crawlDelayMs, reason: undefined,
    region: regionOf(domainOf(base) || s.host, verdict.currency),
  });
  const activeNow = file.sources.filter((x) => x.status === 'active' && x !== s).length;
  if (wasActive || activeNow < MAX_ACTIVE) {
    s.status = 'active';
    if (!wasActive) {
      const q = file.queries.find((x) => x.q === s.foundWith);
      if (q) q.activated += 1;
    }
    say(`✓ ${s.host} (CV ${cv.score}/100): ${s.productsEstimate}${crawlPages.length ? '+ (by browsing)' : ''} perfumes, ${verdict.okCount}/${verdict.total} pages read without AI, ${verdict.currency} (1 = ${rate} EGP)${wasActive ? ' — still good' : ' — added to the importer'}`);
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
  const clean = (t: string) => t.replace(/[\r\n%]/g, ' ').slice(0, 3000);
  // Two notices: how stores were found (web search / own methods), and what the checks decided.
  const checks = notes.filter((n) => /^(?:[✓✗…]|  ↳)/.test(n));
  console.log(`::notice title=كشّاف المصادر — البحث::${clean(notes.filter((n) => !checks.includes(n) && !/^Sources:/.test(n)).join(' | '))}`);
  console.log(`::notice title=كشّاف المصادر — الفحص::${clean([...checks.slice(-16), notes[notes.length - 1]].join(' | '))}`);
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `activated=${Math.max(0, after.active - before.active)}\n`);
}
if (env.GITHUB_STEP_SUMMARY) {
  const rows = file.sources.filter((s) => s.status !== 'blocked').slice(-40).map((s) => `| ${s.host} | ${s.status} | ${s.trust ? `${s.trust.score}/100` : '—'} | ${s.productsEstimate ?? '—'} | ${s.currency ?? '—'} | ${s.reason ?? ''} |`);
  appendFileSync(env.GITHUB_STEP_SUMMARY, `## كشّاف المصادر — ${iso}\n\n${notes.map((n) => `- ${n}`).join('\n')}\n\n| المتجر | الحالة | الثقة | العطور | العملة | ملاحظة |\n|---|---|---|---|---|---|\n${rows.join('\n')}\n`);
}
