/** Real-browser smoke test. Start Vite or a built Pages preview first.
 * READER_BASE_URL=http://localhost:5173/ BROWSER_EXECUTABLE=/path/to/chromium npm run test:reader-browser
 * Browser installation is external; no browser binary is committed.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const base = process.env.READER_BASE_URL || 'http://localhost:5173/';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process', '--use-gl=angle', '--use-angle=swiftshader'],
});
try {
  const context = await browser.newContext();
  // Make language deterministic; keep unrelated third-party assets out of this test.
  await context.addInitScript(() => { localStorage.setItem('sham_language', 'en'); });
  const page = await context.newPage();
  const openGuide = async () => {
    await page.goto(`${base}#world_perfumes`);
    await page.getByRole('button', { name: /Read now|اقرأ الآن/ }).click();
  };
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 667 }]) {
    await page.setViewportSize(viewport);
    await openGuide();
    const next = page.getByRole('button', { name: /Next page|الصفحة التالية/ });
    await next.waitFor({ state: 'visible' });
    await page.waitForFunction(() => [...document.querySelectorAll('dialog button')].some(b => /Next page|الصفحة التالية/.test(b.textContent) && !b.disabled));
    await page.waitForFunction(() => {
      const iframe = document.querySelector('dialog iframe');
      const text = iframe?.contentDocument?.body?.textContent;
      return text?.includes('الفهرس ليس الكتاب') && iframe.getBoundingClientRect().height > 80;
    });
    const toc = page.locator('dialog select');
    await toc.selectOption({ index: 2 });
    await page.waitForFunction(() => document.querySelector('dialog iframe')?.contentDocument?.body?.textContent?.includes('كيف توثق ما تقرأ؟'));
    await page.getByRole('button', { name: /Read plain text|قراءة نصية مباشرة/ }).click();
    assert.ok(await page.locator('dialog article').isVisible());
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog').count(), 0);
  }
  // Fetch failure must leave the complete original guide readable, not a blank box.
  await page.route('**/books/sham-reading-guide.epub', route => route.fulfill({ status: 404, body: 'Not found' }));
  await openGuide();
  await page.locator('dialog [role="alert"]').waitFor();
  assert.ok((await page.locator('dialog article').innerText()).includes('كيف توثق ما تقرأ؟'));
  await page.keyboard.press('Escape');
  // Metadata-only reference cards must not promise or show an empty ebook.
  await page.getByRole('button', { name: /Reference details|تفاصيل المرجع/ }).first().click();
  assert.ok((await page.locator('dialog').innerText()).match(/not currently available|غير متاح/));
  assert.equal(await page.locator('dialog iframe').count(), 0);
  await page.keyboard.press('Escape');
  await context.close();
  console.log('EPUB reader browser checks passed: desktop, mobile, chapters, text fallback, failed fetch, unavailable reference, close/reopen.');
} finally { await browser.close(); }
