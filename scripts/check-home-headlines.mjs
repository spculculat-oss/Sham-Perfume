/** Home news interaction smoke, using only synthetic API responses. Start the built site first:
 * BROWSER_EXECUTABLE=/path/to/chromium node scripts/check-home-headlines.mjs */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.HEADLINES_BASE_URL || 'http://localhost:3000/';
const origin = new URL(base).origin;
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process', '--use-gl=angle', '--use-angle=swiftshader'],
});
const sampleTime = Date.parse('2026-11-18T14:00:00Z');
const date = (epoch, timeZone) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(epoch);
const zone = { EG: 'Africa/Cairo', FR: 'Europe/Paris' };
const sections = (country, asOf, mode) => {
  const timeZone = zone[country] || 'UTC';
  const checkedAt = new Date(asOf).toISOString();
  const datedAt = new Date(asOf - 200).toISOString();
  const story = (publisher, title, url) => ({ title, url, publisher, datedAt, dateKind: 'published' });
  const items = country === 'FR' ? Array.from({ length: 8 }, (_, i) => story('service-public', `Titre français de test ${i + 1}`, `https://www.service-public.gouv.fr/particuliers/actualites/A${41000 + i}`))
    : Array.from({ length: 8 }, (_, i) => story('youm7', `خبر مصري تجريبي ${i + 1}`, `https://www.youm7.com/${42000 + i}`));
  return {
    country, timeZone, asOf, day: date(asOf, timeZone),
    local: { status: mode === 'empty' ? 'empty' : zone[country] ? 'fresh' : 'unsupported', checkedAt, items: mode === 'empty' || !zone[country] ? [] : items },
    world: { status: 'fresh', checkedAt, items: [story('youm7', 'عنوان عالمي تجريبي', 'https://www.youm7.com/43000')] },
  };
};

async function openHome({ country = 'FR', lang = 'en', viewport = { width: 1360, height: 920 }, reducedMotion = 'no-preference', start = sampleTime, mobile = false } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion, isMobile: mobile, hasTouch: mobile, locale: 'ar-EG', timezoneId: 'Africa/Cairo' });
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  await page.clock.install({ time: new Date(start) });
  const state = { country, mode: 'fresh', calls: 0 };
  await context.addInitScript((language) => {
    localStorage.setItem('sham_perfume_user_language', language);
    localStorage.setItem('sham_perfume_user_override_lang', 'true');
    localStorage.setItem('sham_cookie_consent_v1', JSON.stringify({ version: '1.1', essential: true, analytics: false, marketing: false, timestamp: new Date().toISOString() }));
  }, lang);
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/home-headlines') {
      state.calls++;
      if (state.mode === 'failed') await route.fulfill({ status: 503, json: { code: 'FIXTURE_UNAVAILABLE' } });
      else {
        if (state.block) await state.block;
        await route.fulfill({ json: sections(state.country, await page.evaluate(() => Date.now()), state.mode) });
      }
    } else if (url.pathname === '/api/geo') await route.fulfill({ json: { country: 'EG', source: 'edge', timezone: 'Africa/Cairo' } });
    else if (url.pathname === '/api/clock') await route.fulfill({ json: { source: 'server', unixMs: start, timezone: 'Africa/Cairo' } });
    else if (url.origin === origin) await route.continue();
    else await route.abort();
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  const board = page.getByTestId('visitor-local-dashboard');
  const briefing = board.locator('.clock-headlines');
  await briefing.waitFor();
  return { page, board, briefing, local: briefing.locator('[data-news-region="local"]'), world: briefing.locator('[data-news-region="world"]'), state };
}

try {
  const { page, board, briefing, local, world, state } = await openHome();
  const refresh = briefing.getByRole('button', { name: 'Refresh headlines' });
  const stage = local.locator('.clock-headline-stage');
  const story = (n) => stage.getByText(`Titre français de test ${n}`, { exact: true });
  const next = local.getByRole('button', { name: 'Next story' });
  const previous = local.getByRole('button', { name: 'Previous story' });
  console.log('Checking country separation, count, responsive expansion and the continuous loop…');
  await local.getByRole('heading', { name: 'Local news · France' }).waitFor();
  await local.getByText('Headlines: 8', { exact: true }).waitFor();
  await world.getByText('عنوان عالمي تجريبي', { exact: true }).waitFor();
  await story(1).waitFor();
  assert.equal(await stage.getByRole('link').getAttribute('href'), 'https://www.service-public.gouv.fr/particuliers/actualites/A41000');
  assert.equal(await briefing.locator('img').count(), 0, 'publisher images stay on their own sites');
  assert.ok((await briefing.boundingBox()).width >= (await board.boundingBox()).width - 70);
  for (const n of [2, 3, 4, 5, 6, 7, 8, 1]) {
    await page.clock.fastForward(8100);
    await story(n).waitFor();
  }
  await local.getByRole('button', { name: 'Pause rotation' }).click();
  await page.mouse.move(4, 4);
  await page.clock.fastForward(8100);
  await story(1).waitFor();
  await previous.click();
  await story(8).waitFor();
  await next.click();
  await story(1).waitFor();
  const collapsedHeight = (await local.boundingBox()).height;
  const expand = local.getByRole('button', { name: 'All today’s headlines' });
  await expand.click();
  assert.equal(await local.getByRole('button', { name: 'Collapse list' }).getAttribute('aria-expanded'), 'true');
  assert.equal(await local.locator('.clock-headline-list li').count(), 8);
  assert.ok((await local.boundingBox()).height > collapsedHeight + 100, 'the list grows in normal page flow');
  await local.getByRole('button', { name: 'Collapse list' }).click();
  await story(1).waitFor();
  await local.getByRole('button', { name: 'Resume rotation' }).click();
  await page.clock.fastForward(8100);
  await story(1).waitFor(); // hovered
  await page.mouse.move(4, 4);
  await page.clock.fastForward(8100);
  await story(2).waitFor();
  await page.keyboard.press('Tab');
  await next.focus();
  await local.getByRole('button', { name: 'Resume rotation' }).waitFor();
  await page.clock.fastForward(8100);
  await story(2).waitFor();

  console.log('Checking live refresh, fail/empty states and changes in entry country…');
  const before = state.calls;
  await page.clock.fastForward(5 * 60_000 + 15_000);
  await page.waitForFunction(() => !document.querySelector('.clock-headlines-refresh')?.disabled);
  assert.ok(state.calls > before, 'visible editions are checked again automatically');
  state.mode = 'failed';
  await refresh.click();
  await local.getByText('Last available headlines from today; refresh failed.').waitFor();
  await story(2).waitFor();
  state.mode = 'empty';
  await refresh.click();
  await local.getByText('These sources have no headlines dated today yet.').waitFor();
  assert.equal(await local.locator('.clock-headline-stage').count(), 0);
  state.mode = 'fresh';
  state.country = 'EG';
  await refresh.click();
  await local.getByRole('heading', { name: 'Local news · Egypt' }).waitFor();
  await local.getByText('خبر مصري تجريبي 1', { exact: true }).waitFor();
  state.country = 'JP';
  await refresh.click();
  await local.getByRole('heading', { name: 'Local news · Japan' }).waitFor();
  await local.getByText('No local sources are configured for this country yet.').waitFor();
  await world.getByText('عنوان عالمي تجريبي', { exact: true }).waitFor();

  console.log('Checking Arabic at 320px and respecting reduced-motion preferences…');
  const phone = await openHome({ country: 'EG', lang: 'ar', viewport: { width: 320, height: 667 }, mobile: true, reducedMotion: 'reduce' });
  await phone.local.getByText('خبر مصري تجريبي 1', { exact: true }).waitFor();
  await phone.local.getByText('عدد العناوين: ٨').waitFor();
  await phone.local.getByText('١ / ٨').waitFor();
  const digits = phone.local.locator('.clock-headline-position bdi');
  assert.ok((await digits.first().boundingBox()).x < (await digits.last().boundingBox()).x, 'the current position precedes the total even in RTL');
  await phone.page.clock.fastForward(17_000);
  await phone.local.getByText('خبر مصري تجريبي 1', { exact: true }).waitFor();
  await phone.local.getByRole('button', { name: 'كل عناوين اليوم' }).tap();
  assert.equal(await phone.local.locator('.clock-headline-list li').count(), 8);
  const overflow = await phone.briefing.evaluate((element) => ({ outer: element.clientWidth, inner: element.scrollWidth }));
  assert.ok(overflow.inner <= overflow.outer, 'expanded Arabic briefing fits 320px without horizontal scroll');
  assert.ok((await phone.world.boundingBox()).y >= (await phone.local.boundingBox()).y + (await phone.local.boundingBox()).height);

  console.log('Checking that Paris midnight clears stale stories even when the next request is still pending…');
  const night = await openHome({ start: Date.parse('2026-11-18T22:59:30Z'), reducedMotion: 'reduce' });
  await night.local.getByText('Titre français de test 1', { exact: true }).waitFor();
  let unblock;
  night.state.block = new Promise((resolve) => { unblock = resolve; });
  night.state.mode = 'empty';
  try {
    await night.page.clock.fastForward(33_000);
    await night.local.locator('.clock-headline-stage').waitFor({ state: 'hidden' });
    await night.briefing.locator('time[datetime="2026-11-19"]').waitFor();
  } finally { unblock(); }
  await night.local.getByText('These sources have no headlines dated today yet.').waitFor();
  console.log('Home daily news browser checks passed.');
} finally {
  await browser.close();
}
