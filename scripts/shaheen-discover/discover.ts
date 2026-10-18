/**
 * «كشّاف المصادر» — finds online perfume stores and turns the good ones into import sources for
 * «مستورد شاهين», with the same method as the original supplier (sitemap → product pages → JSON-LD /
 * Shaheen's reader → price rule ×1.5 → review). Pure helpers (no network): robots.txt, product-link patterns,
 * perfume detection, vetting verdicts and the shared state file src/data/live/import-sources.json.
 */
import type { ExtractedProduct } from '../shaheen-import/extract';
import type { ImportSource } from '../shaheen-import/transform';

export type SourceStatus = 'candidate' | 'active' | 'paused' | 'rejected' | 'blocked';
export type FoundBy = 'shaheen-search' | 'search-api' | 'brand-site' | 'known-store' | 'seed' | 'council' | 'built-in';

import type { Region, TrustProfile } from './trust';

export interface LiveSource {
  id: string;
  host: string;
  name: string;
  base: string;
  status: SourceStatus;
  foundBy: FoundBy;
  /** The search words (or brand) that led to it — the scout learns which searches find good stores. */
  foundWith?: string;
  foundAt: string;
  vettedAt?: string;
  /** Why it is not imported (rejected/paused), in plain words for the merchant. */
  reason?: string;
  currency?: string;
  rateToEgp?: number;
  /** Regex source of the store's product links. */
  productPattern?: string;
  sitemaps?: string[];
  productsEstimate?: number;
  sampleOk?: number;
  sampleTotal?: number;
  via?: 'json-ld' | 'generic';
  /** No public sitemap: the category pages its product links are collected from (by browsing). */
  crawlPages?: string[];
  crawlDelayMs?: number;
  attempts: number;
  /** The store's «CV»: trust score out of 100, every check and any red flag (trust.ts). */
  trust?: TrustProfile;
  /** Where it sells from (country domain, else currency). */
  region?: Region;
}

export type QueryLang = 'ar' | 'en' | 'fr' | 'de' | 'es' | 'it' | 'pl' | 'tr' | 'ru' | 'ja' | 'ko' | 'zh';
export interface QueryStat { q: string; lang: QueryLang; region?: Region; runs: number; found: number; activated: number; lastRun?: string }
export interface DiscoverRun { at: string; mode: 'ai' | 'self'; found: number; vetted: number; activated: number; rejected: number; notes: string[] }
export interface SourcesFile { version: 1; updatedAt: string; sources: LiveSource[]; queries: QueryStat[]; runs: DiscoverRun[] }

export const emptySources = (): SourcesFile => ({ version: 1, updatedAt: new Date(0).toISOString(), sources: [], queries: [], runs: [] });
export const isSourcesFile = (d: unknown): d is SourcesFile =>
  Boolean(d && typeof d === 'object' && (d as SourcesFile).version === 1 && Array.isArray((d as SourcesFile).sources));

/** example.com from any URL or bare domain (lower case, no www). Empty when it is not a public domain. */
export function domainOf(input: string): string {
  const raw = input.trim().replace(/^[^a-z0-9]+/i, '');
  if (!raw) return '';
  try {
    const host = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) && !/^\d+(\.\d+)+$/.test(host) ? host : '';
  } catch { return ''; }
}
/** One store across its sub-domains (arabianoud.com ↔ us.arabianoud.com, shop.x.com ↔ x.com). */
export const sameSite = (a: string, b: string) => Boolean(a && b) && (a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`));
export const sourceIdOf = (host: string) => host.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/**
 * Never sources: marketplaces (many unknown sellers), social networks, encyclopedias/review sites (not shops),
 * search engines, and this site itself. The merchant can block more with the DISCOVER_BLOCK variable.
 */
const NEVER = [
  'amazon.', 'noon.com', 'ebay.', 'aliexpress.', 'alibaba.', 'temu.', 'shein.', 'jumia.', 'etsy.', 'walmart.', 'target.com', 'souq.com', 'trendyol.', 'lazada.', 'shopee.', 'ounass.', 'namshi.', 'carrefour', 'lulu', 'flipkart.', 'rakuten.', 'mercadolibre.', 'olx.', 'dubizzle.', 'opensooq.', 'haraj.',
  'facebook.', 'instagram.', 'tiktok.', 'youtube.', 'youtu.be', 'twitter.', 'x.com', 'pinterest.', 'reddit.', 'snapchat.', 'linkedin.', 'telegram.', 'whatsapp.', 'wa.me', 'threads.net',
  'wikipedia.', 'fragrantica.', 'basenotes.', 'parfumo.', 'wikiparfum.', 'quora.', 'medium.com', 'blogspot.', 'wordpress.com', 'google.', 'bing.', 'yahoo.', 'duckduckgo.', 'vertexaisearch.', 'github.', 'apple.com', 'play.google',
  'spculculat-oss.github.io', 'vercel.app',
];
export const isNeverSource = (host: string, extraBlock: string[] = []) =>
  !host || NEVER.some((n) => host.includes(n)) || extraBlock.some((b) => b && (host === b || host.endsWith(`.${b}`)));

export interface Robots { allowed: (path: string) => boolean; sitemaps: string[]; crawlDelayMs?: number }
/** robots.txt for our user agent (falls back to «*»); the longest matching rule wins, Allow wins ties. */
export function parseRobots(text: string, agent = 'ShaheenImporter'): Robots {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[]; delay?: number }[] = [];
  const sitemaps: string[] = [];
  let current: (typeof groups)[number] | undefined;
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase(); const value = m[2].trim();
    if (key === 'sitemap') { if (/^https?:\/\//i.test(value)) sitemaps.push(value); continue; }
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) { current = { agents: [], rules: [] }; groups.push(current); }
      current.agents.push(value.toLowerCase()); lastWasAgent = true; continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === 'allow' || key === 'disallow') { if (value || key === 'allow') current.rules.push({ allow: key === 'allow', path: value }); }
    else if (key === 'crawl-delay') { const d = Number(value); if (d > 0) current.delay = d; }
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== '*' && agent.toLowerCase().includes(a)));
  const group = mine.length ? mine : groups.filter((g) => g.agents.includes('*'));
  const rules = group.flatMap((g) => g.rules);
  const delay = group.map((g) => g.delay).find(Boolean);
  const toRe = (p: string) => new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$')}`);
  return {
    sitemaps,
    crawlDelayMs: delay ? Math.min(delay, 30) * 1000 : undefined,
    allowed: (path: string) => {
      let best: { allow: boolean; len: number } | undefined;
      for (const r of rules) {
        if (!r.path) continue;
        if (!toRe(r.path).test(path)) continue;
        const len = r.path.length;
        if (!best || len > best.len || (len === best.len && r.allow)) best = { allow: r.allow, len };
      }
      return best ? best.allow : true;
    },
  };
}

/** Links of a sitemap that look like product pages (when the sitemap mixes pages, posts and products). */
export const PRODUCTISH = /\/(?:products?|shop|store|item|p|perfumes?|fragrances?|parfums?|عطور|عطر|منتج)\/[^/?#]+\/?$|\.html?$|-\d+ml\b|\/[^/?#]*(?:perfume|parfum|eau-de|edp|edt|oud|attar|عطر)[^/?#]*\/?$/i;

/** Links that are clearly not a product page (store pages, categories, blog, account…), any platform. */
export const NOT_PRODUCT = /\/(?:blogs?|news|articles?|pages?|policies|polic(?:y|ies)|privacy|terms|categor(?:y|ies)|collections?|brands?|tags?|author|contact(?:-us)?|about(?:-us)?|faqs?|cart|checkout|account|login|register|search|wishlist|compare|stores?-locator|sitemap)(?:\/|$|\.html?$)|\/c\d+\/?$/i;

/** Links of a page on the same site (absolute, no #fragment, no ?query), in page order, once each. */
export function pageLinks(html: string, base: string): string[] {
  const host = domainOf(base);
  const out = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)) {
    try {
      const u = new URL(m[1].replace(/&amp;/g, '&'), base);
      if (!/^https?:$/.test(u.protocol) || !sameSite(domainOf(u.href), host)) continue;
      u.hash = ''; u.search = '';
      out.add(u.href);
    } catch { /* not a link */ }
  }
  return [...out];
}

/** Category / «all products» pages, any platform (Shopify collections, Salla «/c123», Woo «/shop/», …). */
export const CATEGORYISH = /\/(?:collections?(?:\/[^/]+)?|categor(?:y|ies)(?:\/[^/]+)?|shop|store|perfumes?|fragrances?|parfums?|men|women|unisex|new-arrivals?|best-?sellers?|all-products|products|عطور|عطور-[^/]+)\/?$|\/c\d+\/?$/i;

/** Page n of a category page («?page=2» unless the store already uses its own scheme). */
export const withPage = (url: string, n: number) => (n <= 1 ? url : `${url}${url.includes('?') ? '&' : '?'}page=${n}`);

/**
 * A multilingual store lists every product once per language («/ar/…», «/en/…», «/fr/…»): one language is
 * kept — English first (the importer writes the Arabic itself), then Arabic, else the most common.
 */
export function oneLanguage(urls: string[]): { urls: string[]; lang?: string } {
  const langOf = (u: string) => { try { const s = new URL(u).pathname.split('/')[1] || ''; return /^[a-z]{2}(?:[-_][a-z]{2})?$/i.test(s) ? s.toLowerCase() : ''; } catch { return ''; } };
  const count = new Map<string, number>();
  for (const u of urls) { const l = langOf(u); if (l) count.set(l, (count.get(l) || 0) + 1); }
  const langs = [...count.entries()].filter(([, n]) => n >= urls.length * 0.1);
  if (langs.length < 2) return { urls };
  const pick = langs.find(([l]) => l === 'en' || l.startsWith('en-') || l.startsWith('en_'))?.[0]
    || langs.find(([l]) => l === 'ar' || l.startsWith('ar-') || l.startsWith('ar_'))?.[0]
    || langs.sort((a, b) => b[1] - a[1])[0][0];
  return { urls: urls.filter((u) => langOf(u) === pick || !langOf(u)), lang: pick };
}

/** Candidate product links of a mixed sitemap: the obvious product links, or everything that is not clearly something else. */
export function productCandidates(urls: string[]): string[] {
  const productish = urls.filter((u) => PRODUCTISH.test(u) && !NOT_PRODUCT.test(u));
  if (productish.length >= 6) return productish;
  return urls.filter((u) => { try { const p = new URL(u).pathname; return p.replace(/\/+$/, '').split('/').filter(Boolean).length >= 1 && !NOT_PRODUCT.test(u); } catch { return false; } });
}

/**
 * The store's product-link pattern from links that really were products: the shared leading path
 * («/products/», «/ar/p/»…) plus the shape of the last part when all share one (Salla «…/p123456»,
 * Magento «….html»); without either, any page on the host one level or more deep.
 */
export function inferProductPattern(urls: string[]): string | undefined {
  const parsed = urls.map((u) => { try { return new URL(u); } catch { return undefined; } }).filter((u): u is URL => Boolean(u));
  if (!parsed.length) return undefined;
  const hosts = parsed.map((u) => u.hostname.replace(/^www\./, ''));
  const host = [...hosts].sort((a, b) => a.length - b.length)[0];
  if (hosts.some((h) => !sameSite(h, host))) return undefined;
  const segs = parsed.map((u) => u.pathname.split('/').filter(Boolean));
  const prefix: string[] = [];
  for (let i = 0; ; i++) {
    const s = segs[0][i];
    // A product's own slug («oud-royal-100ml») is never part of the shared path, even with only one example.
    if (s === undefined || segs.some((x) => x[i] !== s || x.length <= i + 1) || (s.length > 12 && s.includes('-')) || /\d{3,}/.test(s)) break;
    prefix.push(s);
  }
  const hostRe = `^https?://(?:[a-z0-9-]+\\.)*${host.replace(/[.]/g, '\\.')}/`;
  const pre = prefix.map((s) => `${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`).join('');
  const last = segs.map((x) => x[x.length - 1] || '');
  const letters = last.map((l) => (l.match(/^([a-z]{1,3})\d{3,}$/i) || [])[1]?.toLowerCase());
  if (letters[0] && letters.every((l) => l === letters[0])) return `${hostRe}${pre}(?:[^?#]*/)?${letters[0]}\\d+/?$`;
  if (last.every((l) => /\.html?$/i.test(l))) return `${hostRe}${pre}[^?#]+\\.html?$`;
  return `${hostRe}${pre}[^?#]+$`;
}

const PERFUME = /perfume|parfum|fragrance|eau de|\bedp\b|\bedt\b|cologne|attar|\boud\b|\boudh\b|bakhoor|\bmusk\b|عطر|عطور|بخور|دهن|مسك|عود|برفان|كولونيا|\d+\s?ml\b/i;
const NOT_PERFUME = /\b(?:lipstick|mascara|foundation|eyeliner|shampoo|conditioner|nail|serum|cream|lotion|toothpaste|razor|t-?shirt|shoes?|phone|laptop)\b|احمر شفاه|ماسكارا|كريم|شامبو/i;
/** Clearly a perfume (name/description/category/link), and not a cosmetic that merely mentions a scent. */
export function isPerfume(x: Pick<ExtractedProduct, 'name' | 'description' | 'url'> & { category?: string }): boolean {
  const head = `${x.name} ${x.category || ''} ${x.url}`;
  if (NOT_PERFUME.test(x.name) && !/perfume|parfum|eau de|عطر/i.test(x.name)) return false;
  return PERFUME.test(head) || PERFUME.test(String(x.description || '').slice(0, 400));
}

export interface Sample { url: string; product: ExtractedProduct | null; status: number }
export interface Verdict { ok: boolean; reason?: string; currency?: string; via?: 'json-ld' | 'generic'; okCount: number; total: number; perfumeShare: number; pattern?: string }

/**
 * A store is imported when most sampled product pages give a complete product (name, price, currency,
 * photo) by themselves — no AI needed — in one currency, and most of them are perfume.
 */
export function judgeSamples(samples: Sample[]): Verdict {
  const total = samples.length;
  const good = samples.filter((s) => s.product && s.product.price > 0 && s.product.images.length && /^[A-Z]{3}$/.test(s.product.currency)).map((s) => s.product!);
  const okCount = good.length;
  if (!total) return { ok: false, reason: 'لا توجد صفحات منتجات للفحص', okCount, total, perfumeShare: 0 };
  if (samples.filter((s) => s.status === 403 || s.status === 429 || s.status === 0).length > total / 2) return { ok: false, reason: 'الموقع يرفض القراءة الآلية (حماية)', okCount, total, perfumeShare: 0 };
  const perfumeShare = okCount ? good.filter((p) => isPerfume(p)).length / okCount : 0;
  const currencies = new Map<string, number>();
  for (const p of good) currencies.set(p.currency, (currencies.get(p.currency) || 0) + 1);
  const [currency] = [...currencies.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  const via = good.filter((p) => p.via === 'json-ld').length >= good.length / 2 ? 'json-ld' : 'generic';
  const pattern = inferProductPattern(good.map((p) => samples.find((s) => s.product === p)!.url));
  // Half the pages read by himself is enough: the importer reads the rest with a learned skill or the AI reader.
  if (okCount < Math.max(2, Math.ceil(total * 0.5))) return { ok: false, reason: `صفحات المنتجات غير مقروءة بدون ذكاء اصطناعي (${okCount}/${total})`, okCount, total, perfumeShare, currency };
  if (perfumeShare < 0.6) return { ok: false, reason: `أغلب منتجاته ليست عطوراً (${Math.round(perfumeShare * 100)}%)`, okCount, total, perfumeShare, currency };
  if (currencies.size > 1 && (currencies.get(currency!) || 0) < okCount * 0.8) return { ok: false, reason: 'الأسعار بأكثر من عملة', okCount, total, perfumeShare, currency };
  if (!pattern) return { ok: false, reason: 'روابط المنتجات بلا نمط ثابت', okCount, total, perfumeShare, currency };
  return { ok: true, currency, via, okCount, total, perfumeShare, pattern };
}

/** Spread samples over the whole list (newest and oldest products, not only the first page). */
export function spreadSample<T>(items: T[], n: number): T[] {
  if (items.length <= n) return [...items];
  return Array.from({ length: n }, (_, i) => items[Math.floor((i * (items.length - 1)) / (n - 1))]);
}

/** An active store as an import source (the importer's own type). */
export function toImportSource(s: LiveSource): ImportSource | undefined {
  if (s.status !== 'active' || !s.productPattern || !(s.sitemaps?.length || s.crawlPages?.length) || !s.currency) return undefined;
  let productUrl: RegExp;
  try { productUrl = new RegExp(s.productPattern, 'i'); } catch { return undefined; }
  return {
    id: s.id, name: s.name, base: s.base, sitemaps: s.sitemaps || [], productUrl, currency: s.currency,
    ...(s.crawlPages?.length ? { crawl: { pages: s.crawlPages, maxPages: 12 } } : {}),
    fallbackRateToEgp: s.rateToEgp, perfumeOnly: true, delayMs: s.crawlDelayMs, origin: 'discovered',
  };
}

/** Adds newly found stores (once), keeps everything already known (and its verdict). */
export function addCandidates(file: SourcesFile, found: { host: string; foundBy: FoundBy; foundWith?: string }[], now: string, block: string[] = []): number {
  const known = new Set(file.sources.map((s) => s.host));
  let added = 0;
  for (const f of found) {
    const host = domainOf(f.host);
    if (!host || known.has(host) || isNeverSource(host, block)) continue;
    known.add(host);
    file.sources.push({ id: sourceIdOf(host), host, name: host, base: `https://${host}`, status: 'candidate', foundBy: f.foundBy, foundWith: f.foundWith, foundAt: now, attempts: 0 });
    added++;
  }
  return added;
}

/**
 * Which stores to check this run: new candidates first (oldest first), then active stores due for their
 * weekly re-check, then paused/rejected ones worth one more try after a month (a site can change).
 */
export function vettingQueue(file: SourcesFile, now: number, limit: number): LiveSource[] {
  const DAY = 86_400_000;
  const age = (s: LiveSource) => now - Date.parse(s.vettedAt || s.foundAt);
  // Active stores that were accepted before the CV existed are reviewed first: no store stays without one.
  const noCv = file.sources.filter((s) => s.status === 'active' && !s.trust);
  // Real shops first (the merchant's, the council's, the address book, web search), guessed brand domains
  // (often not even online) last; then fewer attempts, then the oldest.
  const rank: Record<string, number> = { seed: 0, council: 1, 'known-store': 2, 'shaheen-search': 3, 'search-api': 3, 'brand-site': 5 };
  const fresh = file.sources.filter((s) => s.status === 'candidate' && s.attempts < 3)
    .sort((a, b) => (rank[a.foundBy] ?? 4) - (rank[b.foundBy] ?? 4) || a.attempts - b.attempts || Date.parse(a.foundAt) - Date.parse(b.foundAt));
  const recheck = file.sources.filter((s) => s.status === 'active' && s.trust && age(s) > 7 * DAY).sort((a, b) => age(b) - age(a));
  const retry = file.sources.filter((s) => (s.status === 'paused' || (s.status === 'rejected' && s.attempts < 3)) && age(s) > 30 * DAY);
  return [...noCv, ...fresh, ...recheck, ...retry].slice(0, limit);
}

/**
 * Search words for the whole world: every region in its own language (Arabic for the Arab world, French,
 * German, Spanish, Italian, Polish and Turkish for Europe, Russian for Central Asia, Japanese, Korean and
 * Chinese for East Asia) and in English per market, plus the store's own brands. The regions take turns,
 * and the searches that found good stores come back first.
 */
export const WORLD_QUERIES: { q: string; lang: QueryLang; region: Region }[][] = [
  ['مصر', 'السعودية', 'الإمارات', 'الكويت', 'قطر', 'البحرين', 'عمان', 'الأردن'].map((m) => ({ q: `أفضل متاجر العطور الأصلية أونلاين في ${m} مع الأسعار`, lang: 'ar' as const, region: 'arab' as const })),
  [
    { q: 'parfumerie en ligne parfums de niche originaux livraison internationale', lang: 'fr', region: 'europe' },
    { q: 'Parfümerie online Nischenparfum original kaufen weltweiter Versand', lang: 'de', region: 'europe' },
    { q: 'perfumería online perfumes originales de nicho envío internacional', lang: 'es', region: 'europe' },
    { q: 'profumeria online profumi di nicchia originali spedizione internazionale', lang: 'it', region: 'europe' },
    { q: 'perfumeria internetowa oryginalne perfumy niszowe sklep', lang: 'pl', region: 'europe' },
    { q: 'orijinal niş parfüm online parfüm mağazası', lang: 'tr', region: 'europe' },
    ...['UK', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands'].map((m) => ({ q: `trusted online perfumery ${m} original niche and Arabic perfumes`, lang: 'en' as const, region: 'europe' as const })),
  ],
  ['USA', 'Canada', 'Mexico', 'Brazil'].map((m) => ({ q: `trusted online perfume store ${m} authentic niche and Arabic fragrances`, lang: 'en' as const, region: 'americas' as const })),
  [
    { q: '香水 通販 正規品 ニッチフレグランス 専門店', lang: 'ja', region: 'east-asia' },
    { q: '정품 향수 온라인 쇼핑몰 니치 향수 전문', lang: 'ko', region: 'east-asia' },
    { q: '正品香水 网上商店 小众沙龙香水 香港', lang: 'zh', region: 'east-asia' },
    ...['Japan', 'South Korea', 'Singapore', 'Hong Kong', 'Malaysia'].map((m) => ({ q: `trusted online perfume store ${m} authentic niche fragrances`, lang: 'en' as const, region: 'east-asia' as const })),
  ],
  [
    { q: 'интернет-магазин оригинальной парфюмерии Казахстан нишевая парфюмерия', lang: 'ru', region: 'central-asia' },
    { q: 'интернет-магазин оригинальной парфюмерии Узбекистан', lang: 'ru', region: 'central-asia' },
    ...['Kazakhstan', 'Uzbekistan', 'Azerbaijan'].map((m) => ({ q: `online perfume store ${m} original perfumes`, lang: 'en' as const, region: 'central-asia' as const })),
  ],
  [
    ...['Egypt', 'Saudi Arabia', 'UAE', 'Kuwait'].map((m) => ({ q: `online perfume store ${m} buy original Arabic and niche perfumes`, lang: 'en' as const, region: 'arab' as const })),
    ...['India', 'Australia'].map((m) => ({ q: `trusted online perfume store ${m} authentic fragrances`, lang: 'en' as const, region: (m === 'India' ? 'south-asia' : 'oceania') as Region })),
  ],
];

/** Round-robin over lists: one of each in turn (regions alternate instead of one region filling a run). */
export function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) out.push(l[i]);
  return out;
}

export function planQueries(file: SourcesFile, brands: string[], now: number, count: number): QueryStat[] {
  const base: QueryStat[] = [
    ...interleave(WORLD_QUERIES).map((x) => ({ ...x, runs: 0, found: 0, activated: 0 })),
    ...brands.slice(0, 25).map((b) => ({ q: `${b} perfume official online store buy`, lang: 'en' as const, runs: 0, found: 0, activated: 0 })),
  ];
  const byQ = new Map(file.queries.map((q) => [q.q, q]));
  for (const q of base) if (!byQ.has(q.q)) byQ.set(q.q, q);
  file.queries = [...byQ.values()];
  const DAY = 86_400_000;
  // Yield (stores activated per run) first; a query is not repeated within a week.
  const score = (q: QueryStat) => (q.runs ? q.activated / q.runs : 0.5) - (q.lastRun && now - Date.parse(q.lastRun) < 7 * DAY ? 10 : 0);
  return [...file.queries].sort((a, b) => score(b) - score(a) || a.runs - b.runs).slice(0, count);
}

/** Domains the AI search mentions: the grounding sources' titles/links and domains written in the answer. */
export function domainsFromSearch(reply: unknown): string[] {
  const out = new Set<string>();
  const r = reply as { candidates?: { content?: { parts?: { text?: string }[] }; groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] } }[] };
  for (const c of r?.candidates || []) {
    for (const g of c.groundingMetadata?.groundingChunks || []) {
      const t = domainOf(g.web?.title || '');
      if (t) out.add(t);
      const u = domainOf(g.web?.uri || '');
      if (u && !u.includes('vertexaisearch')) out.add(u);
    }
    const text = (c.content?.parts || []).map((p) => p.text || '').join('\n');
    for (const m of text.matchAll(/\b((?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9-]{1,62}(?:\.[a-z0-9-]{2,63})+)\b/gi)) {
      const d = domainOf(m[1]);
      if (d && !/\.(?:png|jpe?g|webp|html?|php)$/.test(d)) out.add(d);
    }
  }
  return [...out];
}

/**
 * Shaheen's own address book: well-known online perfume shops and houses around the world (the Arab world,
 * Europe, the Americas, East and Central Asia, Oceania). Only candidates — every one gets its CV read
 * (trust.ts) and is checked like any other store (robots.txt, sitemap, pages, perfume, currency), so a shop
 * that closed, blocks readers or fails the CV is simply not used. Lets the scout work with no AI search at all.
 */
export const KNOWN_STORES_BY_REGION: Record<Exclude<Region, 'global' | 'africa' | 'south-asia'>, string[]> = {
  arab: ['arabianoud.com', 'ajmal.com', 'rasasi.com', 'swissarabian.com', 'abdulsamadalqurashi.com', 'afnan.com', 'nabeel.com', 'alharamainperfumes.com', 'myperfumeshop.ae', 'perfumeboxuae.com', 'niceonesa.com', 'goldenscent.com', 'faces.com', 'wojooh.com'],
  europe: [
    'theperfumeshop.com', 'perfumeprice.co.uk', 'jovoy.com', 'thefragranceshop.co.uk', 'fragrancedirect.co.uk', 'escentual.com', 'notino.co.uk', 'parfumdreams.de', 'flaconi.de', 'douglas.de',
    'essenza-nobile.de', 'ausliebezumduft.de', 'niche-beauty.com', 'nocibe.fr', 'marionnaud.fr', 'perfumesclub.com', 'primor.eu', 'iciparisxl.be', 'kicks.se', 'bangerhead.se',
  ],
  americas: ['fragrancebuy.ca', 'maxaromas.com', 'fragrancenet.com', 'fragrancex.com', 'perfumania.com', 'luckyscent.com', 'twisted-lily.com', 'scentsplit.com', 'lattafa-usa.com', 'perfume.com', 'aedes.com', 'osswaldnyc.com', 'beautyhabit.com', 'fragranceoutlet.com', 'perfumeworldwide.com'],
  'east-asia': ['perfumehub.com.my', 'nose-shop.jp', 'escentials.com', 'strawberrynet.com'],
  'central-asia': ['goldapple.kz', 'letu.kz'],
  oceania: ['perfumeconnection.com.au'],
};
/** Every region in turn, so each run brings stores from different parts of the world. */
export const KNOWN_STORES = interleave(Object.values(KNOWN_STORES_BY_REGION));

/** Official-shop guesses for the brands the store sells (lattafa → lattafa.com, lattafaperfumes.com…). */
export function brandSiteGuesses(brands: string[], max = 30): { host: string; brand: string }[] {
  const out: { host: string; brand: string }[] = [];
  for (const b of brands) {
    const slug = b.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
    if (slug.length < 3) continue;
    for (const h of [`${slug}.com`, `${slug}perfumes.com`, `${slug}parfums.com`]) out.push({ host: h, brand: b });
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}

export function summary(file: SourcesFile) {
  const by = (s: SourceStatus) => file.sources.filter((x) => x.status === s).length;
  return { total: file.sources.length, active: by('active'), candidate: by('candidate'), paused: by('paused'), rejected: by('rejected'), blocked: by('blocked'), products: file.sources.filter((s) => s.status === 'active').reduce((n, s) => n + (s.productsEstimate || 0), 0) };
}
