/**
 * Audits the deployed site itself (never the source tree): the crawler's view, not the developer's.
 * Bounded to ~10 requests per run so the agent can run every six hours without load.
 */
import { SEO_PAGES } from '../../src/seo/pages';
import { SITE } from '../../src/seo/site';
import {
  auditHeaders, auditPage, auditSiteFiles, decodeEntities, scoreFindings, summarize, topFixes, weakestArea,
  type SeoFinding,
} from '../../src/seo/audit';
import type { SeoArea } from '../../src/seo/curriculum';

export interface LivePage { url: string; html: string; status: number; ms: number; bytes: number }
export interface LiveAudit {
  at: string;
  siteUrl: string;
  reachable: boolean;
  score: number;
  findings: SeoFinding[];
  bySeverity: { critical: number; major: number; minor: number };
  byArea: Record<string, number>;
  pages: { url: string; status: number; ms: number; bytes: number; title: string }[];
  pagesChecked: number;
  sitemapUrls: { loc: string; lastmod?: string }[];
  weakestArea?: SeoArea;
  topFixes: SeoFinding[];
  notes: string[];
}

type Fetch = typeof fetch;
interface Fetched { status: number; ok: boolean; text: string; ms: number; bytes: number; headers: Headers }

async function get(url: string, request: Fetch, timeout = 15_000): Promise<Fetched | undefined> {
  const start = Date.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await request(url, { signal: AbortSignal.timeout(timeout), redirect: 'follow', headers: { 'user-agent': 'ManaretShaheenSEO/1.0 (+audit; contact via site)' } });
      const text = await response.text();
      return { status: response.status, ok: response.ok, text, ms: Date.now() - start, bytes: Buffer.byteLength(text), headers: response.headers };
    } catch {
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return undefined;
}

const titleOf = (html: string) => decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
const descriptionOf = (html: string) => decodeEntities(html.match(/<meta\s+name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] || '').trim();

export async function auditLiveSite(input: { siteUrl: string; fetch?: Fetch; now?: Date; products?: { slug: string; updatedAt?: string }[] }): Promise<LiveAudit> {
  const request = input.fetch || fetch;
  const now = input.now || new Date();
  const siteUrl = input.siteUrl.endsWith('/') ? input.siteUrl : `${input.siteUrl}/`;
  const abs = (path: string) => new URL(path.replace(/^\/+/, ''), siteUrl).href;
  const findings: SeoFinding[] = [];
  const pages: LivePage[] = [];
  const pageSummaries: LiveAudit['pages'] = [];
  const notes: string[] = [];

  const home = await get(siteUrl, request);
  if (!home) {
    findings.push({
      id: 'crawl:site:unreachable', area: 'crawl', severity: 'critical', page: '/',
      title: 'الموقع غير قابل للوصول', detail: `تعذّر تحميل ${siteUrl}.`, fix: 'تأكد من النشر وDNS قبل أي تحسين؛ لا معنى لتحسين موقع متوقف.',
    });
    return {
      at: now.toISOString(), siteUrl, reachable: false, score: scoreFindings(findings), findings,
      bySeverity: summarize(findings).bySeverity, byArea: summarize(findings).byArea, pages: [],
      pagesChecked: 0, sitemapUrls: [], topFixes: topFixes(findings), notes: ['الموقع لم يستجب؛ توقف الفحص عند هذه الخطوة.'],
    };
  }
  pages.push({ url: siteUrl, html: home.text, status: home.status, ms: home.ms, bytes: home.bytes });
  findings.push(...auditPage({ url: siteUrl, html: home.text, kind: 'home', ms: home.ms, bytes: home.bytes }));
  findings.push(...auditHeaders({
    url: siteUrl, status: home.status, contentType: home.headers.get('content-type') || undefined,
    compression: home.headers.get('content-encoding') || undefined, hsts: home.headers.get('strict-transport-security') || undefined,
    cacheControl: home.headers.get('cache-control') || undefined,
  }));

  // Site-level files in parallel (they are tiny).
  const [robots, sitemap, llms, feed, keyFile] = await Promise.all([
    get(abs('robots.txt'), request, 10_000), get(abs('sitemap.xml'), request, 15_000), get(abs('llms.txt'), request, 10_000),
    get(abs('feed.xml'), request, 10_000), get(abs(`${SITE.indexNowKey}.txt`), request, 10_000),
  ]);
  const sitemapLocs = sitemap
    ? [...sitemap.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => decodeEntities(m[1]))
    : [];
  const sitemapUrls = sitemap
    ? [...sitemap.text.matchAll(/<url>([\s\S]*?)<\/url>/gi)].map((m) => ({
      loc: decodeEntities(m[1].match(/<loc>\s*([^<\s]+)\s*<\/loc>/i)?.[1] || ''),
      lastmod: m[1].match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/i)?.[1],
    })).filter((u) => u.loc)
    : [];
  const expected = [`tools/`, ...SEO_PAGES.map((p) => p.path), 'p/'];
  findings.push(...auditSiteFiles({
    robots: robots?.ok ? robots.text : undefined,
    sitemap: sitemap?.ok ? sitemap.text : undefined,
    llms: llms?.ok ? llms.text : undefined,
    feed: feed?.ok ? feed.text : undefined,
    indexNowKeyFile: keyFile?.ok ? keyFile.text : undefined,
    indexNowKey: SITE.indexNowKey,
    expectInSitemap: expected,
  }));
  if (sitemapLocs.length > 0 && !sitemapLocs.some((loc) => loc.startsWith('https://'))) notes.push('خريطة الموقع تستخدم روابط غير https.');

  // A real tool page and a real product page, from the sitemap itself.
  const toolPath = SEO_PAGES[0].path;
  const toolUrl = sitemapLocs.find((u) => u.endsWith(toolPath)) || abs(toolPath);
  const productUrl = sitemapLocs.find((u) => /\/p\/[^/]+\.html$/.test(u)) || (input.products?.[0] ? abs(`p/${input.products[0].slug}.html`) : undefined);
  const toolsIndex = await get(abs('tools/'), request);
  const tool = await get(toolUrl, request);
  const product = productUrl ? await get(productUrl, request) : undefined;
  for (const [url, kind, fetched] of [
    [abs('tools/'), 'other', toolsIndex],
    [toolUrl, 'tool', tool],
    ...(productUrl ? [[productUrl, 'product', product] as const] : []),
  ] as const) {
    if (!fetched) { notes.push(`تعذّر تحميل ${url}`); continue; }
    pages.push({ url, html: fetched.text, status: fetched.status, ms: fetched.ms, bytes: fetched.bytes });
    findings.push(...auditPage({ url, html: fetched.text, kind, bytes: fetched.bytes }));
  }

  // Duplicate titles/descriptions across the pages we actually read.
  const titles = new Map<string, string[]>();
  const descriptions = new Map<string, string[]>();
  for (const page of pages) {
    const t = titleOf(page.html); const d = descriptionOf(page.html);
    if (t) titles.set(t, [...(titles.get(t) || []), page.url]);
    if (d) descriptions.set(d, [...(descriptions.get(d) || []), page.url]);
  }
  for (const [title, urls] of titles) if (urls.length > 1) findings.push({
    id: `content:${urls[1]}:duplicatedTitle`, area: 'content', severity: 'major', page: urls[1],
    title: 'عنوان مكرر بين صفحات', detail: `العنوان «${title}» يظهر في ${urls.length} صفحات.`, fix: 'اجعل عنوان كل صفحة فريداً ويصف محتواها.',
  });
  for (const [, urls] of descriptions) if (urls.length > 1) findings.push({
    id: `content:${urls[1]}:duplicatedDescription`, area: 'content', severity: 'minor', page: urls[1],
    title: 'وصف تعريف مكرر', detail: `نفس الوصف يظهر في ${urls.length} صفحات.`, fix: 'اكتب وصفاً خاصاً بكل صفحة.',
  });

  for (const page of pages) pageSummaries.push({ url: page.url, status: page.status, ms: page.ms, bytes: page.bytes, title: titleOf(page.html) });
  const unique = [...new Map(findings.map((f) => [f.id, f])).values()];
  const summary = summarize(unique);
  return {
    at: now.toISOString(), siteUrl, reachable: true, score: scoreFindings(unique), findings: unique,
    bySeverity: summary.bySeverity, byArea: summary.byArea, pages: pageSummaries,
    pagesChecked: pages.length, sitemapUrls, weakestArea: weakestArea(unique),
    topFixes: topFixes(unique, 8), notes,
  };
}
