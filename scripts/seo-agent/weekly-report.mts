/**
 * Prints the weekly visibility & growth digest of «منارة شاهين» (and writes it to GITHUB_STEP_SUMMARY
 * in Actions, or updates a tracking issue when SEO_WEEKLY_ISSUE=1).
 *
 *   node --import tsx scripts/seo-agent/weekly-report.mts
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mergeCatalog, type RawProduct, type StoreCatalogFile } from '../../src/utils/storeCatalog';
import { buildSitemapEntries } from '../../src/seo/artifacts';
import { readSeoState } from '../../src/seo/agentState';
import { SITE, canonicalSiteUrl } from '../../src/seo/site';
import { renderWeeklyVisibilityReport } from '../../src/seo/visibilityReport';

const env = process.env;
const root = new URL('../..', import.meta.url);
const readJson = <T,>(path: string): T | undefined => {
  try { return JSON.parse(readFileSync(new URL(path, root), 'utf8')) as T; } catch { return undefined; }
};

const siteUrl = canonicalSiteUrl(env);
const state = readSeoState(readJson('src/data/live/seo-agent.json'), new Date());
const productsRaw = readJson<{ products?: RawProduct[] }>('src/data/products.json')?.products || [];
const catalog = readJson<StoreCatalogFile>('src/data/live/store-catalog.json');
const products = mergeCatalog(productsRaw, catalog);
const productRefs = products.map((p) => ({ id: p.id, slug: p.slug, nameAr: p.name.ar, updatedAt: p.createdAt }));
const entries = buildSitemapEntries({ siteUrl, products: productRefs, now: new Date() });

let verificationOk = false;
try {
  const committed = readFileSync(new URL(`public/google${SITE.googleVerification}.html`, root), 'utf8');
  verificationOk = committed === `google-site-verification: google${SITE.googleVerification}.html`;
} catch { verificationOk = false; }

const markdown = renderWeeklyVisibilityReport(state, {
  siteUrl,
  productsCount: products.length,
  sitemapCount: entries.length,
  verificationOk,
  now: new Date(),
});

console.log(markdown);

if (env.GITHUB_STEP_SUMMARY) {
  try { appendFileSync(env.GITHUB_STEP_SUMMARY, `\n${markdown}\n`); } catch { /* ignore summary write errors */ }
}

if (/^(1|true|yes)$/i.test(env.SEO_WEEKLY_ISSUE || '') && env.GH_TOKEN) {
  const title = 'تقرير منارة شاهين الأسبوعي للظهور والانتشار';
  try {
    const listOut = execFileSync('gh', ['issue', 'list', '--search', `"${title}" in:title`, '--state', 'open', '--limit', '1', '--json', 'number'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const found = JSON.parse(listOut) as { number?: number }[];
    if (found[0]?.number) {
      execFileSync('gh', ['issue', 'edit', String(found[0].number), '--body', markdown], { stdio: 'inherit' });
    } else {
      execFileSync('gh', ['issue', 'create', '--title', title, '--body', markdown], { stdio: 'inherit' });
    }
  } catch (error) {
    console.warn(`[SEO] لم يُحدَّث التقرير في Issues: ${(error as Error).message}`);
  }
}
