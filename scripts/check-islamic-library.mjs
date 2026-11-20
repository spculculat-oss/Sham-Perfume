/** Interactive smoke test for both the root site and the /Sham-Perfume/ Pages base.
 * LIBRARY_BASE_URL=http://localhost:4173/Sham-Perfume/ LIBRARY_SCREENSHOTS=build/islamic-library-review \
 * BROWSER_EXECUTABLE=/path/to/chromium node scripts/check-islamic-library.mjs */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base = new URL(process.env.LIBRARY_BASE_URL || 'http://localhost:3000/');
const screenshots = process.env.LIBRARY_SCREENSHOTS;
const hash = '#islamic_library';
const asset = new URL('books/tanzil-uthmani-1.1.txt', base).href;
const origin = base.origin;
const popupUrl = 'https://shamela.ws/book/8473';
const provider = /^https:\/\/(?:shamela\.ws|sunnah\.com|islamhouse\.com|tanzil\.net|waqfeya\.net)(?:\/|$)/;
const launchBrowser = () => chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process', '--use-gl=angle', '--use-angle=swiftshader'],
});
async function fixture(browser, lang = 'ar', compact = false) {
  const context = await browser.newContext({ viewport: compact ? { width: 320, height: 720 } : { width: 1440, height: 1150 },
    deviceScaleFactor: 1, isMobile: compact, hasTouch: compact, locale: lang === 'ar' ? 'ar-EG' : 'en-GB', reducedMotion: 'reduce' });
  await context.addInitScript((language) => {
    localStorage.setItem('sham_perfume_user_language', language);
    localStorage.setItem('sham_perfume_user_override_lang', 'true');
    localStorage.setItem('sham_cookie_consent_v1', JSON.stringify({ version: '1.1', essential: true, analytics: false, marketing: false, timestamp: new Date().toISOString() }));
  }, lang);
  const requests = [];
  const errors = [];
  const page = await context.newPage();
  page.setDefaultTimeout(25_000);
  page.on('pageerror', (error) => errors.push(error.message));
  context.on('request', (req) => requests.push(req.url()));
  // Keep unrelated-site requests out of a reproducible browser run. The link-open test services one real target below.
  await context.route('**/*', (route) => {
    const req = route.request();
    const host = new URL(req.url()).origin;
    if (req.url() === popupUrl) return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<html lang="ar"><title>تفسير ابن كثير</title><body>Publisher link test</body></html>' });
    if (host !== origin) return route.abort();
    if (new URL(req.url()).pathname === '/api/geo') return route.fulfill({ json: { country: 'EG', timezone: 'Africa/Cairo' } });
    return route.continue();
  });
  return { context, page, requests, errors };
}

const library = (page) => page.getByTestId('islamic-library');
const modal = (page) => page.locator('dialog.il-dialog[open]');
const volume = (page, id) => library(page).locator(`[data-book="${id}"]`);
const verse = (page, n) => modal(page).locator(`[data-quran-ayah="${n}"] .il-quran-text`);
const goto = (page, to = hash) => page.goto(`${base.href}${to}`, { waitUntil: 'domcontentloaded' });
const focusHas = (element) => element.evaluate((e) => e === e.ownerDocument.activeElement);
const checkedViewport = async (page) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'document does not overflow horizontally');
const close = async (page) => { await page.keyboard.press('Escape'); await modal(page).waitFor({ state: 'detached' }); };
const capture = async (page, name, viewportTop) => {
  if (!screenshots) return;
  if (viewportTop) await viewportTop.evaluate((e) => {
    const offset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sham-global-header-height')) || 0;
    window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY - offset - 9, behavior: 'instant' });
  });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.screenshot({ path: `${screenshots}/${name}.png`, animations: 'disabled', timeout: 50_000 });
};

async function desktop(browser) {
  const { context, page, requests, errors } = await fixture(browser);
  try {
    await goto(page, '#home');
    const launch = page.getByTestId('gateway-islamic-library');
    assert.equal(await launch.getAttribute('href'), hash);
    await launch.click();
    const hall = library(page);
    await hall.getByRole('heading', { name: 'مكتبة شام الإسلامية', exact: true }).waitFor();
    assert.equal(new URL(page.url()).hash, hash);
    assert.equal(await hall.getAttribute('dir'), 'rtl');
    assert.equal(await hall.locator('[data-shelf]').count(), 11);
    assert.equal(await hall.locator('[data-book]').count(), 55);
    await hall.locator('.il-hall img').evaluate((img) => img.decode());
    assert.equal(await hall.locator('.il-hall img').evaluate((img) => img.naturalWidth), 1536);
    assert.deepEqual(requests.filter((url) => provider.test(url) || url.includes('tanzil-uthmani')), []);
    await checkedViewport(page);
    await capture(page, 'sham-islamic-shelves-desktop', hall);

    await hall.getByRole('button', { name: 'تصفّح الأرفف', exact: true }).click();
    const search = hall.getByRole('searchbox');
    await search.fill('تَفْسِير إبن كَثِير');
    assert.equal(await hall.locator('[data-book]').count(), 1);
    const ibnk = volume(page, 'ibn-kathir');
    await ibnk.focus();
    const before = await page.evaluate(() => window.scrollY);
    await ibnk.press('Enter');
    await modal(page).getByRole('heading', { name: 'تفسير ابن كثير' }).waitFor();
    assert.equal(new URL(page.url()).hash, `${hash}?book=ibn-kathir`);
    assert.ok((await modal(page).innerText()).includes('دار طيبة'));
    const atSource = modal(page).getByRole('link', { name: 'اقرأ عند المصدر' });
    assert.equal(await atSource.getAttribute('href'), popupUrl);
    assert.equal(await atSource.getAttribute('target'), '_blank');
    assert.match(await atSource.getAttribute('rel'), /noopener noreferrer/);
    assert.deepEqual(requests.filter((url) => provider.test(url)), []);
    await capture(page, 'sham-islamic-book-edition');
    const popupPromise = context.waitForEvent('page');
    await atSource.click();
    const opened = await popupPromise;
    await opened.waitForURL(popupUrl);
    assert.equal(await opened.evaluate(() => window.opener), null);
    await opened.close();
    await page.bringToFront();
    await close(page);
    assert.ok(await focusHas(ibnk), 'dialog restores the cover focus');
    assert.ok(Math.abs((await page.evaluate(() => window.scrollY)) - before) <= 3, 'close does not scroll the shelves away');
    await page.goForward();
    await modal(page).getByRole('heading', { name: 'تفسير ابن كثير' }).waitFor();
    await page.goBack();
    await modal(page).waitFor({ state: 'detached' });
    await search.fill('non-existing-title-x');
    await hall.getByRole('heading', { name: 'لم نجد عنوانًا مطابقًا' }).waitFor();
    await hall.getByRole('button', { name: 'اعرض كل الأرفف' }).click();
    await hall.getByRole('button', { name: 'الفقه والمذاهب', exact: true }).click();
    assert.equal(await hall.locator('[data-shelf]').count(), 1);
    assert.equal(await hall.locator('[data-book]').count(), 5);
    await hall.getByText('المزيد في الشاملة', { exact: true }).click();
    assert.equal(await hall.getByRole('link', { name: 'الفقه المالكي', exact: true }).getAttribute('href'), 'https://shamela.ws/category/15');
    await hall.getByRole('button', { name: 'كل الأرفف', exact: true }).click();

    const openMushaf = hall.getByRole('link', { name: 'افتح المصحف', exact: true });
    await openMushaf.click();
    await verse(page, 1).waitFor();
    assert.match(await verse(page, 1).textContent(), /بِسْمِ ٱللَّهِ/);
    assert.equal(requests.filter((url) => url === asset).length, 1);
    const surah = modal(page).getByLabel('السورة', { exact: true });
    const ayah = modal(page).getByLabel('الآية', { exact: true });
    assert.equal(await surah.locator('option').count(), 114);
    await capture(page, 'sham-islamic-mushaf-desktop');
    await modal(page).getByRole('button', { name: 'التالي' }).click();
    assert.equal(await surah.inputValue(), '2');
    await ayah.selectOption('255');
    await verse(page, 255).waitFor();
    assert.match(await verse(page, 255).textContent(), /ٱلْحَىُّ ٱلْقَيُّومُ/);
    assert.equal(new URL(page.url()).hash, `${hash}?book=mushaf&surah=2&ayah=255`);
    await modal(page).getByRole('button', { name: 'حفظ موضع الآية ٢٥٥', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('sham_mushaf_bookmark_v1'))), { surah: 2, ayah: 255 });
    await close(page);
    assert.ok(await focusHas(openMushaf));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await library(page).getByRole('link', { name: /تابع من علامتك/ }).click();
    await verse(page, 255).waitFor();
    assert.equal(await ayah.inputValue(), '255');
    assert.equal(await modal(page).getByRole('button', { name: 'حفظ موضع الآية ٢٥٥', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.deepEqual(errors, []);
    console.log('Desktop Arabic: covers, source link tab, native dialog, Back/Forward, bookmark and all 114 surahs indexed.');
  } finally { await context.close(); }
}

async function mobile(browser) {
  const { context, page, requests, errors } = await fixture(browser, 'en', true);
  try {
    await goto(page, `${hash}?book=mushaf&surah=114&ayah=6`);
    await verse(page, 6).waitFor();
    assert.equal((await verse(page, 6).textContent()).trim(), 'مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ');
    assert.equal(await modal(page).getByRole('button', { name: 'Next' }).isDisabled(), true);
    assert.equal(await modal(page).getByLabel('Verse', { exact: true }).inputValue(), '6');
    assert.equal(await modal(page).locator('[data-quran-ayah="6"] .il-verse-number').textContent(), '6');
    assert.ok(requests.includes(asset), `fetch text at ${asset}`);
    const text = modal(page).locator('.il-quran-text').first();
    const fontSize = await text.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    await modal(page).getByRole('button', { name: /Larger type/ }).click();
    assert.ok(await text.evaluate((e) => parseFloat(getComputedStyle(e).fontSize)) > fontSize);
    await checkedViewport(page);
    assert.ok(await modal(page).evaluate((e) => e.scrollWidth === e.clientWidth), 'reader fits the phone');
    await modal(page).getByRole('button', { name: 'Close and return to the shelves', exact: true }).click();
    await modal(page).waitFor({ state: 'detached' });
    assert.equal(new URL(page.url()).hash, hash, 'close direct entry stays in the library');
    assert.equal(await library(page).getAttribute('dir'), 'ltr');
    await library(page).getByRole('combobox', { name: 'Filter by shelf', exact: true }).selectOption('seerah');
    assert.equal(await library(page).locator('[data-book]').count(), 5);
    await volume(page, 'rahiq').click();
    await modal(page).getByRole('heading', { name: 'The Sealed Nectar' }).waitFor();
    assert.equal(await modal(page).getByRole('link', { name: 'Read at source' }).getAttribute('href'), 'https://shamela.ws/book/9820');
    await close(page);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
}

async function mobileArabic(browser) {
  const arabic = await fixture(browser, 'ar', true);
  try {
    const p = arabic.page;
    await p.route(asset, (route) => route.fulfill({ status: 503, body: 'Not available' }), { times: 1 });
    await goto(p, '#home');
    await p.getByRole('navigation', { name: 'التنقل الرئيسي' }).getByRole('button', { name: /^استكشف/ }).click();
    await p.locator('#mobile-nav-menu-explore').getByRole('button', { name: /مكتبة شام الإسلامية/ }).click();
    await library(p).locator('.il-hall img').evaluate((img) => img.decode());
    assert.equal(await library(p).locator('.il-hall img').evaluate((img) => img.naturalWidth), 640);
    await capture(p, 'sham-islamic-shelves-mobile', library(p));
    await capture(p, 'sham-islamic-bookcase-mobile', library(p).locator('.il-shelf').first());
    await library(p).getByRole('link', { name: 'افتح المصحف', exact: true }).click();
    await modal(p).getByRole('alert').waitFor();
    assert.match(await modal(p).getByRole('link', { name: 'القراءة عند تنزيل' }).getAttribute('href'), /^https:\/\/tanzil\.net\/#1:1$/);
    await modal(p).getByRole('button', { name: 'إعادة المحاولة' }).click();
    await verse(p, 1).waitFor();
    await checkedViewport(p);
    await capture(p, 'sham-islamic-mushaf-mobile');
    await close(p);
    assert.deepEqual(arabic.errors, []);
    console.log('Mobile 320 px Arabic/English: fitting shelves and reader, base-aware asset, linked verse, upsize, source failure/retry.');
  } finally { await arabic.context.close(); }
}

if (screenshots) await mkdir(screenshots, { recursive: true });
for (const scenario of [desktop, mobile, mobileArabic]) {
  // Separate heads also work with limited-runtime, single-process Chromium.
  const browser = await launchBrowser();
  try { await scenario(browser); } finally { await browser.close(); }
}
console.log('Islamic library browser checks passed: Home to 11 shelves, search, edition links, full Quran, bookmark/refresh, desktop, and narrow mobile with failed-fetch retry.');
