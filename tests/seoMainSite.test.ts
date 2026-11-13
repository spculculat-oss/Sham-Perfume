/**
 * Task #132 («مجلس شاهين»): one canonical address — the main site on GitHub Pages — on every host, and an
 * honest audit when a host serves an out-of-date copy (the app shell for every page).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { SITE, canonicalSiteUrl } from '../src/seo/site';
import { auditLiveSite } from '../server/seo/auditLive';

test('the canonical address is the main site on GitHub Pages, never the engine', () => {
  assert.equal(SITE.url, 'https://spculculat-oss.github.io/Sham-Perfume/');
  assert.equal(canonicalSiteUrl({}), SITE.url);
  assert.equal(canonicalSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'sham-perfume-49bf.vercel.app', APP_URL: 'https://sham-perfume-49bf.vercel.app' }), SITE.url);
  assert.equal(canonicalSiteUrl({ SEO_SITE_URL: 'https://example.com/shop' }), 'https://example.com/shop/', 'an explicit choice still wins');
  assert.notEqual(SITE.engineUrl, SITE.url);
});

const shell = '<!doctype html><html><head><title>صمم عطرك مع شام | حاسبة تركيب وصناعة العطور</title></head><body><div id="root"></div><script src="/assets/app.js"></script></body></html>';
const reply = (body: string, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });

test('an out-of-date deployment is reported as one clear problem, not a page-by-page list', async () => {
  // Every path answers with the same app shell (what an old deployment with an SPA rewrite does).
  const fetchShell = (async () => reply(shell)) as unknown as typeof fetch;
  const audit = await auditLiveSite({ siteUrl: 'https://old.example/', fetch: fetchShell, products: [{ slug: 'oud' }] });
  const stale = audit.findings.find((f) => f.id === 'crawl:site:staleDeployment');
  assert.ok(stale, 'stale deployment detected');
  assert.equal(stale!.severity, 'critical');
  assert.ok(!audit.findings.some((f) => /tools\//.test(f.page) && /H1/.test(f.title)), 'the shell copies of the tool pages are not audited as if they were real pages');
  assert.ok(!audit.findings.some((f) => f.title === 'عنوان مكرر بين صفحات'));
});

test('a site with real tool pages is not called out of date', async () => {
  const page = (title: string) => `<!doctype html><html><head><title>${title}</title></head><body><h1>${title}</h1><p>نص</p></body></html>`;
  const fetchReal = (async (url: string | URL) => {
    const u = String(url);
    if (u.endsWith('/')) return reply(u.includes('tools') ? page('أدوات شام') : shell);
    if (u.includes('/tools/')) return reply(page('حاسبة تركيب العطور'));
    if (u.includes('/p/')) return reply(page('عطر عود'));
    return reply('', 404);
  }) as unknown as typeof fetch;
  const audit = await auditLiveSite({ siteUrl: 'https://fresh.example/', fetch: fetchReal, products: [{ slug: 'oud' }] });
  assert.ok(!audit.findings.some((f) => f.id === 'crawl:site:staleDeployment'));
});
