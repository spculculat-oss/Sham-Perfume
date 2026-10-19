/**
 * Publishes the technical SEO layer of the built site:
 *   node --import tsx scripts/seo-build.mts <dist|pages-dist> [siteUrl]
 *
 * Writes robots.txt, sitemap.xml, feed.xml, llms.txt, the IndexNow key file, search-engine verification
 * files, one real landing page per tool (tools/*.html) and injects the home page's head. The copy comes
 * from the pages' baseline or from the agent's live file — but only after the same guardrails pass.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { mergeCatalog, type RawProduct, type StoreCatalogFile } from '../src/utils/storeCatalog';
import {
  buildSitemapEntries, injectHomeFallback, injectHomeHead, renderFeed, renderLlmsTxt, renderRobots, renderSeoBuildReport, renderSitemap,
  renderToolPage, renderToolsIndex, verificationFiles,
} from '../src/seo/artifacts';
import { copyOverride, readPagesFile } from '../src/seo/agentState';
import { HOME_PAGE, SEO_PAGES, seoPage } from '../src/seo/pages';
import { SITE } from '../src/seo/site';

const [outArg = 'dist', siteArg] = process.argv.slice(2);
const env = process.env;
const outDir = outArg.replace(/\/+$/, '');
const root = new URL('../', import.meta.url);
const readJson = <T,>(path: string): T | undefined => {
  try { return JSON.parse(readFileSync(new URL(path, root), 'utf8')) as T; } catch { return undefined; }
};
// One canonical address for both builds: the main site on GitHub Pages (the Vercel engine's copy points to it).
const defaultSite = (outDir.startsWith('pages-dist') && env.PAGES_SITE_URL) || SITE.url;
const siteUrl = (siteArg || env.SEO_SITE_URL || defaultSite).replace(/\/?$/, '/');
const write = (path: string, content: string) => {
  const target = new URL(`${outDir}/${path}`, root);
  mkdirSync(dirname(target.pathname), { recursive: true });
  writeFileSync(target, content);
};

// ---- data ----
const productsRaw = readJson<{ products?: RawProduct[] }>('src/data/products.json')?.products || [];
const catalog = readJson<StoreCatalogFile>('src/data/live/store-catalog.json');
const products = mergeCatalog(productsRaw, catalog);
const productRefs = products.map((p) => ({ id: p.id, slug: p.slug, nameAr: p.name.ar, updatedAt: p.createdAt }));
const livePages = readPagesFile(readJson('src/data/live/seo-pages.json'));

// ---- static files ----
const entries = buildSitemapEntries({ siteUrl, products: productRefs, now: new Date() });
write('sitemap.xml', renderSitemap(entries));
write('robots.txt', renderRobots(siteUrl));
write('llms.txt', renderLlmsTxt(siteUrl, productRefs));
write('feed.xml', renderFeed({ siteUrl, products: productRefs, now: new Date() }));
write(`${SITE.indexNowKey}.txt`, SITE.indexNowKey);
for (const file of verificationFiles(env)) write(file.name, file.content);

// ---- one real page per tool ----
for (const page of SEO_PAGES) {
  const override = copyOverride(livePages, page.id);
  write(page.path, renderToolPage(page, { siteUrl, override, now: new Date() }));
}
write('tools/index.html', renderToolsIndex(SEO_PAGES, { siteUrl, now: new Date() }));

// ---- home head (idempotent; 404.html must stay identical for GitHub Pages) ----
const indexPath = new URL(`${outDir}/index.html`, root);
if (existsSync(indexPath)) {
  const source = readFileSync(indexPath, 'utf8');
  const homeOverride = copyOverride(livePages, HOME_PAGE.id);
  const html = injectHomeFallback(injectHomeHead(source, { siteUrl, override: homeOverride, env, now: new Date() }));
  writeFileSync(indexPath, html);
  const notFound = new URL(`${outDir}/404.html`, root);
  if (existsSync(notFound)) writeFileSync(notFound, html);
}
write('seo-report.json', renderSeoBuildReport({ siteUrl, pages: SEO_PAGES.length, products: products.length, sitemapUrls: entries.length }));

const trusted = Object.keys(livePages.pages).length;
console.log(`SEO files: ${entries.length} URLs in sitemap, ${SEO_PAGES.length} tool pages, ${products.length} product pages, ${trusted} agent copy override(s), canonical ${siteUrl}`);
for (const page of SEO_PAGES) {
  if (!seoPage(page.id)) throw new Error(`Unknown page id ${page.id}`);
}
