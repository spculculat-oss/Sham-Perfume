/**
 * «كشّاف المصادر» — finds online perfume stores and turns the good ones into import sources for
 * «مستورد شاهين», with the same method as the original supplier (sitemap → product pages → JSON-LD /
 * Shaheen's reader → price rule ×1.5 → review). Pure helpers (no network): robots.txt, product-link patterns,
 * perfume detection, vetting verdicts and the shared state file src/data/live/import-sources.json.
 */
import type { ExtractedProduct } from '../shaheen-import/extract';
import type { ImportSource } from '../shaheen-import/transform';

export type SourceStatus = 'candidate' | 'active' | 'paused' | 'rejected' | 'blocked';
export type FoundBy = 'shaheen-search' | 'search-api' | 'brand-site' | 'seed' | 'built-in';

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
  crawlDelayMs?: number;
  attempts: number;
}

export interface QueryStat { q: string; lang: 'ar' | 'en'; runs: number; found: number; activated: number; lastRun?: string }
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

/**
 * The store's product-link pattern from links that really were products: the shared leading path
 * («/products/», «/ar/p/»…) or, without one, any page on the host one level or more deep.
 */
export function inferProductPattern(urls: string[]): string | undefined {
  const parsed = urls.map((u) => { try { return new URL(u); } catch { return undefined; } }).filter((u): u is URL => Boolean(u));
  if (!parsed.length) return undefined;
  const host = parsed[0].hostname.replace(/^www\./, '');
  if (parsed.some((u) => u.hostname.replace(/^www\./, '') !== host)) return undefined;
  const segs = parsed.map((u) => u.pathname.split('/').filter(Boolean));
  const prefix: string[] = [];
  for (let i = 0; ; i++) {
    const s = segs[0][i];
    if (s === undefined || segs.some((x) => x[i] !== s || x.length <= i + 1)) break;
    prefix.push(s);
  }
  const hostRe = `^https?://(?:www\\.)?${host.replace(/[.]/g, '\\.')}/`;
  const pre = prefix.map((s) => `${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`).join('');
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
  if (okCount < Math.max(2, Math.ceil(total * 0.6))) return { ok: false, reason: `صفحات المنتجات غير مقروءة بدون ذكاء اصطناعي (${okCount}/${total})`, okCount, total, perfumeShare, currency };
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
  if (s.status !== 'active' || !s.productPattern || !s.sitemaps?.length || !s.currency) return undefined;
  let productUrl: RegExp;
  try { productUrl = new RegExp(s.productPattern, 'i'); } catch { return undefined; }
  return {
    id: s.id, name: s.name, base: s.base, sitemaps: s.sitemaps, productUrl, currency: s.currency,
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
  const fresh = file.sources.filter((s) => s.status === 'candidate' && s.attempts < 3).sort((a, b) => Date.parse(a.foundAt) - Date.parse(b.foundAt));
  const recheck = file.sources.filter((s) => s.status === 'active' && age(s) > 7 * DAY).sort((a, b) => age(b) - age(a));
  const retry = file.sources.filter((s) => (s.status === 'paused' || (s.status === 'rejected' && s.attempts < 3)) && age(s) > 30 * DAY);
  return [...fresh, ...recheck, ...retry].slice(0, limit);
}

/** Search words: markets × languages, plus the store's own brands; the ones that found good stores come back first. */
export function planQueries(file: SourcesFile, brands: string[], now: number, count: number): QueryStat[] {
  const base: QueryStat[] = [
    ...['مصر', 'السعودية', 'الإمارات', 'الكويت', 'قطر', 'البحرين', 'عمان', 'الأردن'].map((m) => ({ q: `أفضل متاجر العطور الأصلية أونلاين في ${m} مع الأسعار`, lang: 'ar' as const, runs: 0, found: 0, activated: 0 })),
    ...['Egypt', 'Saudi Arabia', 'UAE', 'Kuwait', 'Malaysia', 'UK', 'USA'].map((m) => ({ q: `online perfume store ${m} buy original Arabic and niche perfumes`, lang: 'en' as const, runs: 0, found: 0, activated: 0 })),
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
