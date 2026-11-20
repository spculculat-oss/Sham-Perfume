/** News desk browser smoke. Run against a built preview; no publisher or API service is contacted.
 * NEWS_BASE_URL=... BROWSER_EXECUTABLE=... node scripts/check-perfume-news.mjs
 * Set NEWS_STATIC=1 to check a Pages build without an API, and NEWS_SCREENSHOTS_DIR to save previews. */
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const base = new URL(process.env.NEWS_BASE_URL || 'http://localhost:4173/');
const staticBuild = process.env.NEWS_STATIC === '1';
const screenshots = process.env.NEWS_SCREENSHOTS_DIR;
const bundled = JSON.parse(await readFile(new URL('../src/data/live/shaheen-news.json', import.meta.url), 'utf8'));
const cover = await readFile(new URL('../src/components/news/assets/journal-cover-small.webp', import.meta.url));
const labNote = 'Violet leaf browser fixture';
const report = {
  id: 'rose-workshop-browser-fixture', titleEn: 'Rose workshop report', titleAr: 'تقرير معمل الورد',
  category: 'harvests', categoryLabelAr: 'حصاد ومواد خام', dateIso: '2026-11-18',
  summaryEn: 'A test report on rose absolute.', summaryAr: 'ملخّص للاختبار عن زيت الورد.',
  contentEn: 'A full first paragraph about rose.\n\nA second paragraph for the reader.',
  contentAr: 'الفقرة الأولى عن الورد.\n\nفقرة ثانية في القارئ.', sourceEn: 'Fixture newsroom', source: 'نشرة الاختبار',
  keyNotes: [{ nameEn: labNote, nameAr: 'ورق البنفسج للاختبار', type: 'heart', percentageHint: 100 }],
};
const desk = Array.from({ length: 12 }, (_, i) => {
  const en = i === 0 ? 'Bergamot at the source' : `Fragrance bulletin ${i + 1}`;
  const ar = i === 0 ? 'البرغموت من المصدر' : `نشرة العطور ${i + 1}`;
  return {
    id: `desk-smoke-${i}`, url: `https://publisher.example/article-${i}`, source: i === 0 ? 'Bergamot Gazette' : 'Fixture publisher',
    category: i === 0 ? 'ingredients' : 'industry', original: en, lang: 'en', importance: 4,
    title: { en, ar }, summary: { en: 'Publisher summary.', ar: 'ملخص من الناشر.' }, publishedAt: bundled.updatedAt,
    ...(i < 2 ? { image: `https://publisher.example/photo-${i}.webp` } : {}),
  };
});
const online = { ...bundled, editor: 'feeds', updatedAt: new Date(Date.parse(bundled.updatedAt) + 60_000).toISOString(), items: desk };

const screenshot = async (page, filename) => {
  if (!screenshots) return;
  await mkdir(screenshots, { recursive: true });
  await page.screenshot({ path: join(screenshots, `${filename}.jpg`), quality: 89, animations: 'disabled' });
};

async function withNews(lang, viewport, check) {
  const mobile = viewport.width < 500;
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  let releaseFeed;
  let feedMode = 'blocked';
  let refreshStatus = 200;
  const feedWait = new Promise((resolve) => { releaseFeed = resolve; });
  const requests = { reports: 0, refresh: 0, explain: 0 };
  try {
    const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
    await context.addInitScript((language) => {
      if (window.top !== window) return;
      localStorage.setItem('sham_perfume_user_language', language);
      localStorage.setItem('sham_perfume_user_override_lang', 'true');
      localStorage.setItem('sham_cookie_consent_v1', JSON.stringify({ version: '1.1', essential: true, analytics: false, marketing: false, timestamp: new Date().toISOString() }));
      Object.defineProperty(navigator, 'clipboard', { configurable: true,
        value: { writeText: async (text) => { if (window.denyNewsCopy) throw new Error('Denied'); window.newsCopied = text; } } });
    }, lang);
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      const headers = { 'Access-Control-Allow-Origin': base.origin, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
      const json = (body, status = 200) => route.fulfill({ status, json: body, headers });
      if (url.pathname.endsWith('/src/data/live/shaheen-news.json')) {
        if (lang === 'en') await feedWait; // Verify the bundled lead appears even while the request is pending.
        return feedMode === 'online' ? json(online) : route.abort();
      }
      if (url.hostname === 'publisher.example') {
        if (url.pathname.endsWith('photo-0.webp')) return route.fulfill({ body: cover, contentType: 'image/webp' });
        if (url.pathname.endsWith('photo-1.webp')) return route.fulfill({ status: 404, body: '' });
      }
      if (url.pathname.startsWith('/api/')) {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (url.pathname === '/api/news') {
          requests.reports++;
          return json({ success: true, articles: [] });
        }
        if (url.pathname === '/api/news/refresh') {
          requests.refresh++;
          return refreshStatus === 200 ? json({ success: true, articles: [report] }) : json({}, refreshStatus);
        }
        if (url.pathname === '/api/news/explain') {
          requests.explain++;
          assert.deepEqual(route.request().postDataJSON(), { id: desk[0].id, language: lang });
          return json({ title: 'Desk explanation', summary: 'A fixture explanation about bergamot.', note: '' });
        }
        return route.abort();
      }
      return url.origin === base.origin ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.setDefaultTimeout(10000);
    await page.goto(new URL('#perfume_news', base).href, { waitUntil: 'domcontentloaded' });
    const consent = page.getByRole('button', { name: /Reject non-essential|رفض غير الضروري/ });
    if (await consent.isVisible()) await consent.click();
    const portal = page.getByTestId('news-portal');
    await portal.getByTestId('news-lead-source').waitFor();
    assert.equal(await portal.getAttribute('dir'), lang === 'ar' ? 'rtl' : 'ltr');
    assert.ok(await portal.evaluate((node) => node.compareDocumentPosition(document.querySelector('[data-testid=visitor-local-dashboard]')) & Node.DOCUMENT_POSITION_FOLLOWING), 'shared clock follows the news desk');
    const view = (id) => portal.getByTestId(`news-view-${id}`);
    const fit = async () => {
      const measure = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, viewport: innerWidth }));
      const expected = page.viewportSize().width;
      assert.ok(measure.width <= measure.client + 1, `horizontal overflow at ${lang}/${expected}: ${JSON.stringify(measure)}`);
      assert.ok(measure.viewport <= expected + 1, `mobile layout zoomed out: ${JSON.stringify(measure)}`);
    };
    await fit();
    await check({ page, portal, view, fit, requests, online: () => { feedMode = 'online'; releaseFeed(); }, failRefresh: () => { refreshStatus = 503; } });
    assert.deepEqual(errors, [], 'unexpected browser errors');
  } finally {
    releaseFeed();
    await browser.close();
  }
}

console.log('Desktop: bundled front page, publisher headlines, topic search and photo credit…');
await withNews('en', { width: 1280, height: 900 }, async ({ page, portal, view, fit, requests, online: refreshFeed, failRefresh }) => {
  const lead = portal.getByTestId('news-lead-source');
  assert.equal(await lead.getAttribute('href'), bundled.items[0].url);
  assert.equal(await lead.getAttribute('target'), '_blank');
  assert.match(await lead.getAttribute('rel'), /noopener/);
  await portal.locator('.sn-lead-art img').evaluate((img) => img.decode());
  assert.equal(await portal.locator('.sn-wire-list a').count(), Math.min(3, bundled.items.length - 1));
  await screenshot(page, 'journal-desktop');

  refreshFeed();
  await portal.locator('.sn-lead h2').getByText(desk[0].title.en, { exact: true }).waitFor();
  assert.equal(await lead.getAttribute('href'), desk[0].url);
  await portal.locator('.sn-lead-art').getByText('Image from the publisher').waitFor();
  assert.equal(await portal.locator('.sn-lead-art img').getAttribute('src'), desk[0].image);
  await portal.getByRole('button', { name: 'All headlines', exact: true }).click();
  const live = portal.getByTestId('shaheen-live-news');
  await live.getByRole('heading', { name: desk[0].title.en }).waitFor();
  await page.waitForFunction(() => {
    const heading = document.querySelector('.sn-live h2');
    return heading?.getBoundingClientRect().top >= document.querySelector('body header').getBoundingClientRect().bottom;
  });
  assert.equal(await live.locator('.sn-live-card').count(), 8);
  await live.getByRole('button', { name: 'Show more news' }).click();
  assert.equal(await live.locator('.sn-live-card').count(), desk.length);
  await live.getByText('Publisher image unavailable', { exact: true }).waitFor();
  assert.ok(await live.getByText('No image was published with this story', { exact: true }).first().isVisible());
  const search = portal.getByRole('searchbox');
  await search.fill('BERGAMÓT Gazette');
  assert.equal(await live.locator('.sn-live-card').count(), 1);
  await live.getByRole('button', { name: 'Industry', exact: true }).click();
  await live.getByRole('heading', { name: 'No matching results' }).waitFor();
  await live.getByRole('button', { name: 'Show all' }).click();
  await live.getByRole('button', { name: 'Ingredients', exact: true }).click();
  assert.equal(await live.locator('.sn-live-card').count(), 1);
  const explain = live.getByTestId('news-explain');
  if (!staticBuild) {
    await explain.click();
    await live.getByTestId('news-explained').getByText('Desk explanation').waitFor();
    assert.equal(requests.explain, 1);
  } else assert.equal(await explain.count(), 0);

  console.log('Desktop: editorial filters, refresh/cache, reader/back, truthful clipboard status and lab handoff…');
  // Home views are above the article list; keep all click checks using actual pointer interactions.
  await view('reports').click();
  const reports = portal.getByTestId('news-report-card');
  assert.ok(await reports.first().locator('[data-picture-kind="editorial"]').isVisible());
  const allReports = await reports.count();
  await portal.getByRole('button', { name: 'Botanical Harvests' }).click();
  assert.ok(await reports.count() < allReports);
  await portal.getByRole('button', { name: 'Show all', exact: true }).click();
  await search.fill('oolong smoked');
  assert.equal(await reports.count(), 1);
  const card = reports.first();
  const title = await card.getByRole('heading').innerText();
  const open = card.getByRole('button', { name: 'Read the full photo report' });
  await open.click();
  let dialog = page.getByRole('dialog', { name: title });
  await dialog.waitFor();
  assert.ok(await dialog.locator('.sn-reader-prose').innerText());
  await dialog.getByRole('button', { name: 'Copy report summary' }).click();
  await dialog.getByRole('status').getByText('Summary copied').waitFor();
  assert.ok((await page.evaluate(() => window.newsCopied)).includes(title));
  await page.evaluate(() => { window.denyNewsCopy = true; });
  await dialog.getByRole('button', { name: 'Summary copied' }).click();
  await dialog.getByRole('alert').getByText('Could not copy in this browser').waitFor();
  const scroll = await page.evaluate(() => scrollY);
  await page.evaluate(() => history.back());
  await dialog.waitFor({ state: 'hidden' });
  assert.ok(await open.evaluate((button) => button === document.activeElement));
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - scroll) < 6, 'reader Back should not jump to the top');
  await page.evaluate(() => history.forward());
  await dialog.waitFor();
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });

  const refresh = portal.getByRole('button', { name: 'Refresh reports' });
  if (staticBuild) {
    assert.equal(await refresh.count(), 0);
    assert.equal(requests.reports, 0);
    return;
  }
  await search.fill('');
  await refresh.click();
  await reports.getByRole('heading', { name: report.titleEn }).waitFor();
  assert.equal(requests.refresh, 1);
  failRefresh();
  await refresh.click();
  await portal.getByRole('alert').getByText(/current reports are still here/).waitFor();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await view('reports').click();
  await reports.getByRole('heading', { name: report.titleEn }).getByRole('button').click();
  dialog = page.getByRole('dialog', { name: report.titleEn });
  await dialog.waitFor();
  await dialog.getByRole('button', { name: 'Add to fragrance pyramid' }).click();
  assert.ok(await dialog.getByRole('button', { name: 'Added to pyramid' }).isDisabled());
  // Leaving through the reader's CTA must transfer the formula without a history race back into news.
  await dialog.getByRole('button', { name: 'Apply Full Accord to Formulation Scale & Lab' }).click();
  await page.waitForURL('**/#concentration');
  await page.evaluate(() => { location.hash = '#pyramid'; });
  await page.getByText(labNote, { exact: true }).first().waitFor();
  await page.goto(new URL('#perfume_news', base).href);
  await portal.waitFor();
  assert.equal(await portal.getByRole('dialog').count(), 0);
  await fit();
});

console.log('Arabic touch: narrow RTL layout, Arabic search, saving across reloads and the reader…');
await withNews('ar', { width: 320, height: 780 }, async ({ page, portal, view, fit }) => {
  assert.match(await portal.locator('.sn-edition-meta time').innerText(), /[٠-٩]/);
  assert.equal(await portal.getByTestId('news-lead-source').getAttribute('href'), bundled.items[0].url);
  await portal.locator('.sn-lead-art img').evaluate((img) => img.decode());
  await screenshot(page, 'journal-mobile');
  await view('saved').tap();
  await portal.getByRole('heading', { name: 'لسه مفيش تقارير محفوظة' }).waitFor();
  await portal.getByRole('button', { name: 'تصفّح التقارير' }).tap();
  const search = portal.getByRole('searchbox');
  await search.fill('شَاي أُولُونغ');
  const cards = portal.getByTestId('news-report-card');
  assert.ok(await cards.count() > 0);
  assert.match(await cards.first().innerText(), /إيسنس/);
  const title = await cards.first().getByRole('heading').innerText();
  await cards.first().getByRole('button', { name: 'حفظ في المفضلة' }).tap();
  assert.match(await view('saved').innerText(), /١/);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await view('saved').tap();
  await cards.getByRole('heading', { name: title }).waitFor();
  await cards.getByRole('button', { name: 'قراءة التقرير الكامل بالصور' }).tap();
  const dialog = page.getByRole('dialog', { name: title });
  await dialog.waitFor();
  assert.equal(await dialog.evaluate((node) => getComputedStyle(node).direction), 'rtl');
  await screenshot(page, 'journal-reader-ar');
  await dialog.getByRole('button', { name: 'إغلاق', exact: true }).first().tap();
  await dialog.waitFor({ state: 'hidden' });
  await cards.getByRole('button', { name: 'حفظ في المفضلة' }).tap();
  await portal.getByRole('heading', { name: 'لسه مفيش تقارير محفوظة' }).waitFor();
  await fit();
});
console.log('Long translations: wide desktop navigation and the narrow edition stamp stay inside the screen…');
await withNews('de', { width: 1700, height: 900 }, async ({ page, fit }) => {
  for (const width of [2000, 1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 860 });
    await fit();
  }
});
console.log('Perfume news browser checks passed.');
