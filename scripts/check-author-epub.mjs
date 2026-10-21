/** Real-browser check of the full author EPUB; use a local Pages preview.
 * BROWSER_EXECUTABLE=/path/to/chromium READER_BASE_URL=http://localhost:4173/Sham-Perfume/ node scripts/check-author-epub.mjs
 */
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process', '--use-gl=angle', '--use-angle=swiftshader'] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${process.env.READER_BASE_URL || 'http://localhost:4173/Sham-Perfume/'}#world_perfumes`);
  for (const size of [{width:1280,height:900},{width:390,height:844}]) {
    await page.setViewportSize(size);
    await page.getByRole('button', { name: /Read Mustafa|اقرأ كتاب مصطفى/ }).click();
    await page.waitForFunction(() => {
      const select=document.querySelector('dialog select');
      const img=document.querySelector('dialog iframe')?.contentDocument?.querySelector('img');
      return select?.options.length===360 && !select.disabled && img?.complete && img?.naturalWidth>0;
    }, null, { timeout: 120000 });
    for (const number of [2,180,359]) {
      await page.locator('dialog select').selectOption({index:number});
      await page.waitForFunction(n => {
        const frame=document.querySelector('dialog iframe');
        const img=frame?.contentDocument?.querySelector('img');
        return frame?.contentDocument?.title===`Page ${n}` && img?.complete && img.naturalWidth>0 && frame.getBoundingClientRect().height>100;
      }, number, {timeout:30000});
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog').count(),0);
  }
  assert.deepEqual(errors, []);
  console.log('Author EPUB passed: 359 pages, cover, pages 2/180/359, desktop/mobile, rendered images, close/reopen.');
} finally { await browser.close(); }
