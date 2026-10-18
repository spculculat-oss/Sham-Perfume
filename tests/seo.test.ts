/**
 * «منارة شاهين» — the contracts the SEO layer must keep.
 *
 * The build, the cron cycle and the admin panel all read the same modules; these tests make sure the
 * published files stay honest (guardrailed copy, absolute sitemap URLs, open robots, one canonical per
 * page) before any of them reaches GitHub Pages or Vercel.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { HOME_PAGE, SEO_PAGES, allSeoPages, pageByPath, tabSeo } from '../src/seo/pages';
import { SITE, absoluteUrl, canonicalSiteUrl, indexNowKeyPath } from '../src/seo/site';
import { validateSeoCopy, visibleText } from '../src/seo/audit';
import { SEO_AREAS, TOTAL_LESSONS, nextLesson } from '../src/seo/curriculum';
import {
  buildSitemapEntries, injectHomeFallback, injectHomeHead, renderFeed, renderLlmsTxt, renderRobots, renderSitemap, renderToolPage,
  renderToolsIndex, verificationFiles,
} from '../src/seo/artifacts';
import { emptySeoState, readSeoState } from '../src/seo/agentState';
import lexicon from '../src/seo/lexicon.json';

const site = 'https://sham-perfume-49bf.vercel.app/';
const vendor = new RegExp(`\\b(?:${lexicon.vendorNames.join('|')})\\b`, 'i');

test('every published page passes the same guardrails the AI copy must pass', () => {
  for (const page of allSeoPages()) {
    const problems = validateSeoCopy(
      { title: page.title, description: page.description, h1: page.h1, faq: page.faq || [] },
      { requireFaq: page.id !== 'home' },
    );
    assert.deepEqual(problems, [], `${page.id}: ${problems.join(' | ')}`);
    assert.ok(!vendor.test(`${page.title} ${page.description} ${page.h1}`), `${page.id} names a vendor`);
  }
});

test('the twelve tool tabs have one real static page each, with unique ids and paths', () => {
  assert.equal(SEO_PAGES.length, 12);
  assert.equal(new Set(allSeoPages().map((page) => page.id)).size, allSeoPages().length);
  assert.equal(new Set(SEO_PAGES.map((page) => page.path)).size, SEO_PAGES.length);
  for (const page of SEO_PAGES) {
    assert.match(page.path, /^tools\/[a-z0-9-]+\.html$/, page.id);
    assert.equal(pageByPath(page.path)?.id, page.id);
    assert.equal(tabSeo(page.tab).path, page.path, `tab ${page.tab} must canonicalise to its tool page`);
    assert.ok(page.priority > 0 && page.priority <= 1);
    assert.ok(page.steps.length >= 3, `${page.id} needs actionable steps`);
    assert.ok(page.faq.length >= 2 && page.faq.length <= 5, `${page.id} FAQ size`);
  }
  assert.equal(tabSeo('home').path, '');
  assert.equal(pageByPath('tools/missing.html'), undefined);
});

test('sitemap lists absolute https URLs for the home, tools and product pages without duplicates', () => {
  const products = [
    { id: 1, slug: 'oud-30', updatedAt: '2026-10-01T00:00:00.000Z' },
    { id: 2, slug: 'rose-50' },
  ];
  const entries = buildSitemapEntries({ siteUrl: site, products, now: new Date('2026-10-18T12:00:00Z') });
  const urls = entries.map((entry) => entry.loc);
  assert.equal(urls[0], site);
  assert.equal(new Set(urls).size, urls.length, 'duplicate URLs in the sitemap');
  for (const url of urls) assert.match(url, /^https:\/\/sham-perfume-49bf\.vercel\.app\//);
  assert.ok(urls.includes(absoluteUrl('tools/', site)));
  for (const page of SEO_PAGES) assert.ok(urls.includes(absoluteUrl(page.path, site)), page.path);
  assert.ok(urls.includes(absoluteUrl('p/oud-30.html', site)));
  assert.ok(urls.includes(absoluteUrl('p/rose-50.html', site)));
  const xml = renderSitemap(entries);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.equal((xml.match(/<loc>/g) || []).length, entries.length);
});

test('robots.txt invites search and AI crawlers, points at the sitemap and blocks only the API', () => {
  const robots = renderRobots(site);
  assert.match(robots, new RegExp(`Sitemap: ${site.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}sitemap\\.xml`));
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Disallow: \/api\//);
  assert.doesNotMatch(robots, /^Disallow: \/\s*$/m, 'the whole site must never be blocked');
  for (const bot of lexicon.aiCrawlers) assert.match(robots, new RegExp(`User-agent: ${bot.replace('-', '\\-')}`));
  assert.doesNotMatch(robots, /noindex/i);
});

test('llms.txt and the RSS feed describe the same public site', () => {
  const llms = renderLlmsTxt(site, [{ id: 1, slug: 'oud-30' }]);
  assert.match(llms, new RegExp(SITE.nameAr));
  assert.ok(llms.includes(absoluteUrl('tools/', site)));
  assert.ok(llms.includes(absoluteUrl('sitemap.xml', site)));
  const feed = renderFeed({ siteUrl: site, products: [{ id: 1, slug: 'oud-30', updatedAt: '2026-10-01T00:00:00.000Z' }] });
  assert.match(feed, /<rss version="2.0">/);
  assert.ok(feed.includes(absoluteUrl('p/oud-30.html', site)));
  assert.ok(feed.includes(SITE.nameAr));
});

test('a tool page carries one canonical, Arabic copy, breadcrumbs and FAQ structured data', () => {
  const page = SEO_PAGES[0];
  const html = renderToolPage(page, { siteUrl: site, now: new Date('2026-10-18T12:00:00Z') });
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
  assert.ok(html.includes(`<link rel="canonical" href="${absoluteUrl(page.path, site)}">`));
  assert.ok(html.includes(`<link rel="alternate" hreflang="x-default" href="${absoluteUrl(page.path, site)}">`));
  assert.ok(html.includes(page.h1));
  assert.match(html, /"@type":"BreadcrumbList"/);
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, /"@type":"WebApplication"/);
  assert.match(html, /<html lang="ar" dir="rtl">/);
  assert.doesNotMatch(html, vendor);
});

test('the tools index links every tool page and keeps the same canonical origin', () => {
  const html = renderToolsIndex(SEO_PAGES, { siteUrl: site });
  assert.ok(html.includes(absoluteUrl('tools/', site)));
  for (const page of SEO_PAGES) assert.ok(html.includes(absoluteUrl(page.path, site)), page.path);
});

test('the served home page carries real content before React mounts', () => {
  const source = '<!doctype html><html lang="ar" dir="rtl"><head></head><body><div id="root"></div></body></html>';
  const html = injectHomeFallback(injectHomeHead(source, { siteUrl: site, env: {} }));
  const words = visibleText(html).split(/\s+/).filter(Boolean);
  assert.ok(words.length >= 300, `home visible text is only ${words.length} words`);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.ok((html.match(/<h2\b/g) || []).length >= 2);
  assert.ok((html.match(/<a\s+href="tools\//g) || []).length >= 10, 'the home must link into the tool pages');
  assert.ok(html.indexOf('<!--seo-agent:body:start-->') > html.indexOf('<div id="root">'));
  assert.equal(injectHomeFallback(html), html, 'fallback injection must be idempotent');
  assert.equal((html.match(/<!--seo-agent:body:start-->/g) || []).length, 1);
});

test('the real index.html keeps exactly one H1 once the static copy is injected', () => {
  const source = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const html = injectHomeFallback(injectHomeHead(source, { siteUrl: site, env: {} }));
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.ok(visibleText(html).split(/\s+/).filter(Boolean).length >= 300);
});

test('injecting the home head twice never duplicates a tag (Google reads one canonical)', () => {
  const source = '<!doctype html><html lang="ar" dir="rtl"><head><title>قديم</title>'
    + '<meta name="description" content="قديم"><meta name="robots" content="noindex">'
    + '<link rel="canonical" href="https://old.example/"><meta property="og:title" content="قديم">'
    + '<meta name="twitter:card" content="summary"><meta name="theme-color" content="#000">'
    + '<link rel="alternate" type="application/rss+xml" href="/feed.xml"></head><body></body></html>';
  const once = injectHomeHead(source, { siteUrl: site, env: {} });
  const twice = injectHomeHead(once, { siteUrl: site, env: {} });
  assert.equal(twice, once, 'the head block must be idempotent');
  assert.equal((twice.match(/<title>/g) || []).length, 1);
  assert.equal((twice.match(/rel="canonical"/g) || []).length, 1);
  assert.equal((twice.match(/type="application\/rss\+xml"/g) || []).length, 1);
  assert.equal((twice.match(/name="theme-color"/g) || []).length, 1);
  assert.ok(twice.includes(`<link rel="canonical" href="${site}">`));
  assert.match(twice, /"@type":"Organization"/);
  assert.match(twice, /"@type":"WebSite"/);
  assert.doesNotMatch(twice, /noindex/);
  assert.doesNotMatch(twice, /old\.example/);
});

test('the canonical origin is https-first and localhost is allowed for real local audits', () => {
  assert.equal(canonicalSiteUrl({}), SITE.url);
  assert.equal(canonicalSiteUrl({ SEO_SITE_URL: 'https://example.com' }), 'https://example.com/');
  assert.equal(canonicalSiteUrl({ SEO_SITE_URL: 'https://example.com/base/' }), 'https://example.com/base/');
  assert.equal(canonicalSiteUrl({ SEO_SITE_URL: 'http://localhost:3100' }), 'http://localhost:3100/');
  assert.equal(canonicalSiteUrl({ SEO_SITE_URL: 'http://example.com' }), SITE.url, 'plain http must not become canonical');
  assert.equal(canonicalSiteUrl({ SEO_SITE_URL: 'not a url' }), SITE.url);
  assert.match(SITE.indexNowKey, /^[a-f0-9]{8,128}$/i);
  assert.equal(indexNowKeyPath, `${SITE.indexNowKey}.txt`);
});

test('verification files are generated only from valid environment values', () => {
  assert.deepEqual(verificationFiles({}), []);
  const files = verificationFiles({ GOOGLE_SITE_VERIFICATION: 'abcDEF_123-456', BING_SITE_VERIFICATION: 'bingToken12345' });
  assert.deepEqual(files.map((file) => file.name), ['googleabcDEF_123-456.html', 'BingSiteAuth.xml']);
  assert.match(files[0].content, /google-site-verification: googleabcDEF_123-456\.html/);
  assert.match(files[1].content, /<user>bingToken12345<\/user>/);
  assert.deepEqual(verificationFiles({ GOOGLE_SITE_VERIFICATION: 'short' }), [], 'short tokens must not become files');
});

test('the curriculum covers twelve areas, twenty-four lessons, and cycles after completion', () => {
  assert.equal(Object.keys(SEO_AREAS).length, 12);
  assert.equal(TOTAL_LESSONS, 24);
  const first = nextLesson([]);
  assert.equal(first.id, 'seo-01');
  const all = Array.from({ length: TOTAL_LESSONS }, (_, index) => `seo-${String(index + 1).padStart(2, '0')}`);
  assert.equal(nextLesson(all).id, 'seo-01', 'a finished curriculum starts again');
  assert.equal(nextLesson(all.slice(0, 5), 'schema').id, 'seo-06', 'fresh lessons come before revisions');
  assert.equal(nextLesson(all, 'schema').area, 'schema', 'after the curriculum, the weakest area is revisited first');
});

test('an empty state starts in training with every search engine accounted for', () => {
  const state = emptySeoState(new Date('2026-10-18T12:00:00Z'));
  assert.equal(state.trust.level, 'trainee');
  assert.equal(state.intervalHours, 6);
  assert.equal(state.curriculum.studied.length, 0);
  assert.ok(state.searchEngines.length >= 10);
  assert.ok(state.searchEngines.some((engine) => engine.id === 'google'));
  assert.equal(state.audit.score, 0);
  const parsed = readSeoState({ version: 1, trust: { level: 'hacked' }, searchEngines: 'nope' }, new Date('2026-10-18T12:00:00Z'));
  assert.equal(parsed.trust.level, 'trainee');
  assert.ok(Array.isArray(parsed.searchEngines));
  assert.equal(readSeoState(null).identity.reportsToAr, 'الخبير شاهين');
});

test('a published page path rounds-trips through the page map', () => {
  for (const page of [HOME_PAGE, ...SEO_PAGES]) {
    if (!page.path) continue;
    assert.equal(pageByPath(page.path)?.id, page.id);
    assert.equal(pageByPath(`/${page.path}`)?.id, page.id, 'leading slash must not matter');
  }
});
