/** Browser smoke for the home clock. Start the site first, then run:
 * BROWSER_EXECUTABLE=/path/to/chromium node scripts/check-clock-tools.mjs
 * Only the publisher/clock HTTP responses are fixtures; the clock tools run as shipped. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.CLOCK_BASE_URL || 'http://localhost:3000/';
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process', '--use-gl=angle', '--use-angle=swiftshader'],
});
const origin = new URL(base).origin;
const fixtureTime = new Date('2026-11-18T10:00:01Z');
const checkedAt = fixtureTime.toISOString();
const feeds = {
  country: 'EG', timeZone: 'Africa/Cairo', day: '2026-11-18', asOf: fixtureTime.getTime(),
  local: { status: 'empty', checkedAt, items: [] },
  world: { status: 'fresh', checkedAt, items: [{ title: 'عنوان عالمي للاختبار',
    url: 'https://www.youm7.com/story/2026/11/18/news/3', datedAt: checkedAt, dateKind: 'published', publisher: 'youm7',
  }] },
};

async function openHome(lang, viewport, mobile = false) {
  const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile, timezoneId: 'Africa/Cairo' });
  await context.addInitScript((language) => {
    if (!sessionStorage.getItem('clock_smoke_initialized')) {
      localStorage.removeItem('sham_clock_tools_v1');
      sessionStorage.setItem('clock_smoke_initialized', 'yes');
    }
    localStorage.setItem('sham_perfume_user_language', language);
    localStorage.setItem('sham_perfume_user_override_lang', 'true');
    localStorage.setItem('sham_cookie_consent_v1', JSON.stringify({ version: '1.1', essential: true, analytics: false, marketing: false, timestamp: new Date().toISOString() }));
  }, lang);
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/home-headlines') {
      await route.fulfill({ json: feeds });
    } else if (url.pathname === '/api/clock') {
      await route.fulfill({ json: { source: 'server', unixMs: fixtureTime.getTime(), timezone: 'Africa/Cairo' } });
    } else if (url.origin === origin) {
      await route.continue();
    } else {
      await route.abort();
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  await page.clock.install({ time: fixtureTime });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  const consent = page.getByRole('button', { name: /Reject non-essential|رفض غير الضروري/ });
  if (await consent.isVisible()) await consent.click();
  const board = page.getByTestId('visitor-local-dashboard');
  await board.waitFor();
  return { page, board };
}

try {
  const { page, board } = await openHome('en', { width: 1280, height: 800 });
  const dialog = page.getByRole('dialog', { name: 'Clock tools' });
  const launcher = (name) => board.getByRole('button', { name, exact: true });
  const tool = (name) => dialog.getByRole('button', { name, exact: true });
  const notice = () => page.locator('.clock-notice-float');
  const dismiss = () => notice().getByRole('button', { name: 'Dismiss' }).click();
  const close = () => tool('Close clock tools').click();
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('sham_clock_tools_v1') || '{}'));

  console.log('Checking repeating alarms, snooze, and focus return…');
  await launcher('Alarms').click();
  await tool('Add alarm').click();
  const hour = dialog.getByRole('textbox', { name: 'Hour', exact: true });
  const minute = dialog.getByRole('textbox', { name: 'Minute', exact: true });
  const initialHour = await hour.inputValue();
  await hour.fill('25');
  await tool('Save & enable').click();
  await dialog.getByRole('alert').getByText('Enter an hour from', { exact: false }).waitFor();
  await hour.fill(initialHour);
  await minute.waitFor();
  await dialog.getByLabel('Alarm name').fill('Stretch');
  await tool('Every day').click();
  await tool('Save & enable').click();
  await dialog.getByRole('switch', { name: 'Stretch · Alarms' }).waitFor();
  assert.deepEqual((await state()).alarms[0].days, [0, 1, 2, 3, 4, 5, 6]);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Alarms');
  await page.clock.fastForward(61_000);
  await notice().getByText('Stretch', { exact: true }).waitFor();
  await notice().getByRole('button', { name: 'Snooze 5 min' }).click();
  await notice().waitFor({ state: 'hidden' });
  await launcher('Alarms').click();
  await dialog.getByText('Snoozed until', { exact: false }).waitFor();
  await close();
  await page.clock.fastForward(5 * 60_000 + 1000);
  await notice().getByText('Alarm ringing', { exact: true }).waitFor();
  await dismiss();
  await launcher('Alarms').click();
  await dialog.getByRole('switch', { name: 'Stretch · Alarms' }).click();
  await dialog.getByText('Off', { exact: true }).waitFor();
  await tool('Edit · Stretch').click();
  await tool('Once').click();
  await tool('Save & enable').click();
  await dialog.getByText(/Once · Africa\/Cairo/).waitFor();
  await tool('Delete · Stretch').click();
  await dialog.getByText('No alarms yet.', { exact: false }).waitFor();
  await close();

  console.log('Checking timer pause, reload, resume and alert on a different site page…');
  await launcher('Timer').click();
  await dialog.getByRole('textbox', { name: 'Minutes', exact: true }).fill('0');
  await dialog.getByRole('textbox', { name: 'Seconds', exact: true }).fill('10');
  await tool('Start').click();
  await tool('Pause').click();
  await tool('Resume').waitFor();
  const pause = (await state()).timer;
  assert.equal(pause.status, 'paused');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await launcher('Timer').click();
  await tool('Resume').waitFor();
  assert.deepEqual((await state()).timer, pause);
  await tool('Resume').click();
  await tool('Pause').waitFor();
  await close();
  await page.evaluate(() => { location.hash = 'guide'; });
  await page.locator('[data-clock-layout="compact"]').waitFor();
  assert.equal(await board.getByRole('complementary', { name: 'News briefing' }).count(), 0, 'the full briefing is only on Home');
  await page.clock.fastForward(11_000);
  await notice().getByText('Time is up', { exact: true }).waitFor();
  await dismiss();
  await page.evaluate(() => { location.hash = 'home'; });

  console.log('Checking stopwatch laps and the existing calculator launcher…');
  await launcher('Stopwatch').click();
  await tool('Start').click();
  await page.clock.fastForward(2300);
  await tool('Lap').click();
  await dialog.locator('.clock-laps tbody tr').first().waitFor();
  await tool('Pause').click();
  assert.equal((await state()).stopwatch.laps.length, 1);
  await tool('Reset').click();
  await dialog.getByText('00:00.00', { exact: true }).waitFor();
  await close();
  await launcher('Engineering calculator').click();
  await page.getByRole('dialog', { name: 'Engineering calculator' }).waitFor();
  console.log('Checking the Arabic mobile layout and native digits…');
  const mobile = await openHome('ar', { width: 390, height: 667 }, true);
  await mobile.board.getByText('عنوان عالمي للاختبار', { exact: true }).waitFor();
  const mobileFace = await mobile.board.locator('.visitor-clock-face').boundingBox();
  const mobileBriefing = await mobile.board.getByRole('complementary', { name: 'موجز الأخبار' }).boundingBox();
  assert.ok(mobileBriefing.y >= mobileFace.y + mobileFace.height - 1);
  const shortEdges = await mobile.board.evaluate((el) => ({ scroll: el.scrollWidth, width: el.clientWidth }));
  assert.ok(shortEdges.scroll <= shortEdges.width, 'home clock does not scroll horizontally');
  await mobile.board.getByRole('button', { name: 'العداد التنازلي', exact: true }).tap();
  const arabic = mobile.page.getByRole('dialog', { name: 'أدوات الساعة' });
  await arabic.waitFor();
  assert.equal(await arabic.getAttribute('dir'), 'rtl');
  assert.equal(await arabic.getByRole('textbox', { name: 'دقايق' }).inputValue(), '٥');
  await arabic.getByRole('textbox', { name: 'دقايق' }).fill('٣');
  await arabic.getByText('٠٠:٠٣:٠٠', { exact: true }).waitFor();
  const bounds = await arabic.boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390 && bounds.y >= 0 && bounds.y + bounds.height <= 667);
  console.log('Home clock browser checks passed.');
} finally {
  await browser.close();
}
