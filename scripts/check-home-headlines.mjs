/** Home news interaction smoke, using only synthetic API responses. Start the built site first:
 * BROWSER_EXECUTABLE=/path/to/chromium node scripts/check-home-headlines.mjs
 * HEADLINES_SCENARIO=desktop|mobile|midnight|cold optionally runs one scenario. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.HEADLINES_BASE_URL || 'http://localhost:3000/';
const origin = new URL(base).origin;
const coverPath = new URL('images/press/', base).pathname;
const launch = () => chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process', '--use-gl=angle', '--use-angle=swiftshader'],
});
let browser;
const sampleTime = Date.parse('2026-11-18T14:00:00Z');
const date = (epoch, timeZone) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(epoch);
const zone = { BR: 'America/Sao_Paulo', EG: 'Africa/Cairo', FR: 'Europe/Paris' };
const brazilUrl = 'https://agenciabrasil.ebc.com.br/geral/noticia/2026-11/fixture';
const photo = {
  url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Fixture.jpg/640px-Fixture.jpg',
  source: 'https://commons.wikimedia.org/wiki/File:Fixture.jpg', license: 'by-sa/4.0',
  credit: 'Fixture Photographer', alt: 'A test view of a valley',
};
const communityStory = 'How a small town restored its wetlands';
const communityUrl = 'https://globalvoices.org/2026/11/18/fixture-story';
const arabsTodayUrl = 'https://www.arabstoday.net/1152/135600-fixture';
const egyptTodayUrl = 'https://www.egypt-today.com/1236/132000-fixture';
const imageFixture = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">
  <path fill="#a7c7cb" d="M0 0h640v360H0z"/><circle cx="490" cy="76" r="38" fill="#fbe6b1"/>
  <path fill="#557877" d="M0 195 145 78l159 95 104-81 232 125v143H0z"/><path fill="#30483e" d="M0 232l113-49 199 86 328-110v201H0z"/>
  <path fill="#8cbebe" d="m305 266 83 21-59 25 160 48H173l82-52-11-22z"/></svg>`;
const sections = (country, asOf, mode) => {
  const timeZone = zone[country] || 'UTC';
  const checkedAt = new Date(asOf).toISOString();
  const datedAt = new Date(asOf - 200).toISOString();
  const story = (publisher, title, url) => ({ title, url, publisher, datedAt, dateKind: 'published' });
  const items = country === 'FR' ? Array.from({ length: 8 }, (_, i) => story('service-public', `Titre français de test ${i + 1}`, `https://www.service-public.gouv.fr/particuliers/actualites/A${41000 + i}`))
    : country === 'BR' ? [{ ...story('agencia-brasil', 'Notícia brasileira de teste', brazilUrl), author: 'Agência Brasil' }]
    : [...Array.from({ length: 8 }, (_, i) => story('youm7', `خبر مصري تجريبي ${i + 1}`, `https://www.youm7.com/${42000 + i}`)),
      story('egypt-today', 'عنوان الكرة المصرية التجريبي', egyptTodayUrl)];
  return {
    country, timeZone, asOf, day: date(asOf, timeZone),
    local: zone[country] ? { status: mode, checkedAt, items: mode === 'fresh' ? items : [] } : { status: 'unsupported', checkedAt: null, items: [] },
    world: { status: mode, checkedAt, items: mode === 'fresh' ? [
      story('youm7', 'عنوان عالمي تجريبي', 'https://www.youm7.com/43000'),
      story('youm7', 'عنوان عالمي تاني', 'https://www.youm7.com/43001'),
      { ...story('global-voices', communityStory, communityUrl), author: 'Fixture Writer', photo },
      story('un-news', 'عنوان الأمم المتحدة التجريبي', 'https://news.un.org/ar/story/2026/11/1123456'),
      { ...story('mongabay', 'An environment headline for testing', 'https://news.mongabay.com/2026/11/water'), author: 'Environment Writer' },
      story('arabs-today', 'عنوان العرب اليوم التجريبي', arabsTodayUrl),
    ] : [] },
  };
};

async function openHome({ country = 'FR', lang = 'en', viewport = { width: 1360, height: 920 }, reducedMotion = 'no-preference', start = sampleTime, mobile = false, rejectPhoto = false, initialMode = 'fresh' } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion, isMobile: mobile, hasTouch: mobile, locale: 'ar-EG', timezoneId: 'Africa/Cairo' });
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  // Keep native input timing on touch devices; advance the desktop clock for loop/midnight tests.
  if (!mobile) await page.clock.install({ time: new Date(start) });
  const state = { country, mode: initialMode, calls: 0, photoReferrers: [], outbound: [] };
  const cors = { 'access-control-allow-origin': origin };
  await context.addInitScript((language) => {
    localStorage.setItem('sham_perfume_user_language', language);
    localStorage.setItem('sham_perfume_user_override_lang', 'true');
    localStorage.setItem('sham_cookie_consent_v1', JSON.stringify({ version: '1.1', essential: true, analytics: false, marketing: false, timestamp: new Date().toISOString() }));
  }, lang);
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/home-headlines') {
      state.calls++;
      if (state.mode === 'failed') await route.fulfill({ status: 503, headers: cors, json: { code: 'FIXTURE_UNAVAILABLE' } });
      else {
        if (state.block) await state.block;
        await route.fulfill({ headers: cors, json: sections(state.country, await page.evaluate(() => Date.now()), state.mode) });
      }
    } else if (url.href === photo.url) {
      state.photoReferrers.push(route.request().headers().referer);
      if (rejectPhoto) await route.fulfill({ status: 404 });
      else await route.fulfill({ contentType: 'image/svg+xml', body: imageFixture });
    } else if (url.pathname === '/api/geo') await route.fulfill({ headers: cors, json: { country: 'EG', source: 'edge', timezone: 'Africa/Cairo' } });
    else if (url.pathname === '/api/clock') await route.fulfill({ headers: cors, json: { source: 'server', unixMs: start, timezone: 'Africa/Cairo' } });
    else if (url.origin === origin) await route.continue();
    else { state.outbound.push(url.hostname); await route.abort(); }
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  const board = page.getByTestId('visitor-local-dashboard');
  const briefing = board.locator('.clock-headlines');
  await briefing.waitFor();
  return { page, context, board, briefing, state,
    local: briefing.locator('[data-news-region="local"]'), world: briefing.locator('[data-news-region="world"]'),
    localPress: briefing.locator('[data-press-region="local"]'), worldPress: briefing.locator('[data-press-region="world"]'),
  };
}

async function checkCover(link, href) {
  const image = link.locator('img');
  await image.scrollIntoViewIfNeeded();
  assert.equal(await link.getAttribute('href'), href);
  assert.equal(await link.getAttribute('target'), '_blank');
  assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
  assert.equal(new URL(await image.evaluate((element) => element.src)).pathname.startsWith(coverPath), true);
  assert.equal(await image.getAttribute('alt'), '', 'art is decorative; the link has the outlet name');
  await image.evaluate((element) => element.decode());
  assert.equal(await image.evaluate((element) => element.naturalWidth), 480);
}

async function desktop() {
  const { page, context, board, briefing, local, world, localPress, worldPress, state } = await openHome();
  const refresh = briefing.getByRole('button', { name: 'Refresh headlines' });
  const stage = local.locator('.clock-headline-stage');
  const story = (n) => stage.getByText(`Titre français de test ${n}`, { exact: true });
  const next = local.getByRole('button', { name: 'Next story' });
  const previous = local.getByRole('button', { name: 'Previous story' });
  console.log('Checking country separation, count, responsive expansion and the continuous loop…');
  await local.getByRole('heading', { name: 'Local news · France' }).waitFor();
  await local.getByText('Headlines: 8', { exact: true }).waitFor();
  await world.getByRole('heading', { name: 'World news' }).waitFor();
  await story(1).waitFor();
  assert.equal(await stage.getByRole('link').getAttribute('href'), 'https://www.service-public.gouv.fr/particuliers/actualites/A41000');
  await stage.getByText('Illustration', { exact: true }).waitFor();
  assert.equal(await stage.locator('.clock-headline-photo').count(), 0, 'local publisher images stay on their own sites');
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

  console.log('Checking both visible picture shelves, all outlets, and country browsing…');
  await localPress.getByRole('heading', { name: 'Local newspapers · France', exact: true }).waitFor();
  const leMonde = localPress.getByRole('link', { name: 'Le Monde', exact: true });
  const reuters = worldPress.getByRole('link', { name: 'Reuters', exact: true });
  // No expansion, scrolling widget, or API article is required to reveal these outlets.
  assert.equal(await localPress.locator('.clock-press-card:visible').count(), 4);
  assert.equal(await worldPress.locator('.clock-press-card:visible').count(), 4);
  await checkCover(leMonde, 'https://www.lemonde.fr/');
  await checkCover(reuters, 'https://www.reuters.com/world/');
  await worldPress.getByRole('link', { name: 'BBC News Arabic', exact: true }).waitFor();
  assert.ok(!(await page.evaluate(() => document.querySelector('details')?.contains(document.querySelector('.clock-press-card')))), 'not hidden in a closed directory');
  await worldPress.getByRole('button', { name: 'Next group of outlets' }).click();
  await worldPress.getByText('Group 2 of 5').waitFor();
  await checkCover(worldPress.getByRole('link', { name: 'Al Arabiya', exact: true }), 'https://www.alarabiya.net/');
  await worldPress.getByRole('button', { name: 'Previous group of outlets' }).click();
  await reuters.waitFor();
  await worldPress.getByRole('button', { name: 'All outlets', exact: true }).click();
  assert.equal(await worldPress.locator('.clock-press-card').count(), 17);
  await checkCover(worldPress.getByRole('link', { name: 'Arabs Today', exact: true }), 'https://www.arabstoday.net/');
  await worldPress.getByRole('button', { name: 'Show fewer', exact: true }).click();
  await localPress.getByRole('button', { name: 'All outlets', exact: true }).click();
  assert.equal(await localPress.locator('.clock-press-card').count(), 12);
  await localPress.getByRole('button', { name: 'Show fewer', exact: true }).click();
  const worldCountry = worldPress.getByRole('combobox', { name: 'World press country' });
  const localCountry = localPress.getByRole('combobox', { name: 'Local press country' });
  assert.ok((await worldCountry.locator('option').count()) >= 240);
  const callsBeforeBrowse = state.calls;
  await worldCountry.selectOption('BR');
  await checkCover(worldPress.getByRole('link', { name: 'Folha de S.Paulo', exact: true }), 'https://www.folha.uol.com.br/');
  await localCountry.selectOption('EG');
  await checkCover(localPress.getByRole('link', { name: 'Al-Ahram', exact: true }), 'https://gate.ahram.org.eg/');
  await local.getByRole('heading', { name: 'Local news · France' }).waitFor();
  assert.equal(state.calls, callsBeforeBrowse, 'browsing the shelves does not request another edition');
  await worldCountry.selectOption('');
  await localCountry.selectOption('');
  await leMonde.waitFor();
  const morePress = localPress.getByRole('link', { name: 'Country newspaper directory' });
  const browsePress = localPress.getByRole('link', { name: 'Newspaper directory by country' });
  assert.equal(await morePress.getAttribute('href'), 'https://www.w3newspapers.com/france/');
  assert.ok(!state.outbound.some((host) => ['www.lemonde.fr', 'www.w3newspapers.com', 'gate.ahram.org.eg', 'www.alarabiya.net', 'www.reuters.com'].includes(host)),
    'covers are bundled; the user does not contact the outlets while browsing');

  console.log('Checking headline source filters and verified photo attribution…');
  const worldStage = world.locator('.clock-headline-stage');
  const filter = world.getByRole('combobox', { name: 'Filter by source' });
  await world.getByText('Configured sources: 6').waitFor();
  await world.getByText('Headlines: 6', { exact: true }).waitFor();
  await filter.selectOption('global-voices');
  await world.getByText('Showing 1 of 6 headlines').waitFor();
  await worldStage.getByText(communityStory, { exact: true }).waitFor();
  const img = worldStage.getByRole('img', { name: photo.alt });
  await img.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => (document.querySelector('.clock-headline-stage .clock-headline-photo')?.naturalWidth || 0) > 0);
  assert.equal(await img.getAttribute('referrerpolicy'), 'no-referrer');
  assert.ok(state.photoReferrers.length && state.photoReferrers.every((referer) => !referer));
  assert.equal(await worldStage.locator('.clock-headline-link').getAttribute('href'), communityUrl);
  assert.equal(await worldStage.getByRole('link', { name: photo.credit }).getAttribute('href'), photo.source);
  assert.equal(await worldStage.getByRole('link', { name: 'CC BY-SA 4.0', exact: true }).getAttribute('href'), 'https://creativecommons.org/licenses/by-sa/4.0/');
  assert.equal(await worldStage.getByRole('link', { name: 'Headline license: CC BY 3.0' }).getAttribute('href'), 'https://creativecommons.org/licenses/by/3.0/');
  await worldStage.getByText('Fixture Writer', { exact: true }).waitFor();
  await world.getByRole('button', { name: 'All today’s headlines' }).click();
  assert.equal(await world.locator('.clock-headline-list li').count(), 1);
  await world.locator('.clock-headline-list').getByRole('img', { name: photo.alt }).waitFor();
  await filter.selectOption('european-parliament');
  await world.getByText('No headlines available from this source right now.').waitFor();
  await filter.selectOption('');
  assert.equal(await world.locator('.clock-headline-list li').count(), 6);
  await world.getByRole('button', { name: 'Collapse list' }).click();
  await worldStage.getByText(communityStory, { exact: true }).waitFor();
  const nextWorld = world.getByRole('button', { name: 'Next story' });
  await nextWorld.click();
  await worldStage.getByText('عنوان عالمي تجريبي', { exact: true }).waitFor();
  await worldStage.getByText('Illustration', { exact: true }).waitFor();
  assert.equal(await worldStage.locator('.clock-headline-photo').count(), 0);
  await nextWorld.click();
  await worldStage.getByText('عنوان الأمم المتحدة التجريبي', { exact: true }).waitFor();
  await nextWorld.click();
  await worldStage.getByText('An environment headline for testing', { exact: true }).waitFor();
  await nextWorld.click();
  await worldStage.getByText('عنوان العرب اليوم التجريبي', { exact: true }).waitFor();
  assert.equal(await worldStage.locator('.clock-headline-link').getAttribute('href'), arabsTodayUrl);
  await nextWorld.click();
  await worldStage.getByText('عنوان عالمي تاني', { exact: true }).waitFor();

  console.log('Checking refresh, offline and empty modes, and country/perfume separation…');
  const before = state.calls;
  await page.clock.fastForward(5 * 60_000 + 15_000);
  await page.waitForFunction(() => !document.querySelector('.clock-headlines-refresh')?.disabled);
  assert.ok(state.calls > before, 'visible editions are checked again automatically');
  state.mode = 'failed';
  await refresh.click();
  await local.getByText('Last available headlines from today; refresh failed.').waitFor();
  await story(2).waitFor();
  await leMonde.waitFor();
  await context.setOffline(true);
  await page.waitForFunction(() => !navigator.onLine);
  await leMonde.waitFor();
  await reuters.waitFor();
  const offlineCalls = state.calls;
  await refresh.click();
  assert.equal(state.calls, offlineCalls);
  state.mode = 'empty';
  await context.setOffline(false);
  await local.getByText('These sources have no headlines dated today yet.').waitFor();
  await world.getByText('These sources have no headlines dated today yet.').waitFor();
  assert.equal(await local.locator('.clock-headline-stage').count(), 0);
  await reuters.waitFor();
  await leMonde.waitFor();
  state.mode = 'unavailable';
  await refresh.click();
  await local.getByText('Headlines are unavailable right now.').waitFor();
  await leMonde.waitFor();
  state.mode = 'fresh';
  state.country = 'EG';
  await refresh.click();
  await local.getByRole('heading', { name: 'Local news · Egypt' }).waitFor();
  await local.getByText('خبر مصري تجريبي 1', { exact: true }).waitFor();
  const egyptFilter = local.getByRole('combobox', { name: 'Filter by source' });
  await egyptFilter.selectOption('egypt-today');
  await local.getByText('عنوان الكرة المصرية التجريبي', { exact: true }).waitFor();
  assert.equal(await local.locator('.clock-headline-link').getAttribute('href'), egyptTodayUrl);
  await local.getByText('Illustration', { exact: true }).waitFor();
  await checkCover(localPress.getByRole('link', { name: 'Al-Masry Al-Youm', exact: true }), 'https://www.almasryalyoum.com/');
  state.country = 'BR';
  await refresh.click();
  await local.getByRole('heading', { name: 'Local news · Brazil' }).waitFor();
  const brazilian = local.getByText('Notícia brasileira de teste', { exact: true });
  await brazilian.waitFor();
  assert.equal(await brazilian.getAttribute('lang'), 'pt-BR');
  assert.equal(await local.locator('.clock-headline-link').getAttribute('href'), brazilUrl);
  await localPress.getByRole('button', { name: 'All outlets', exact: true }).click();
  await checkCover(localPress.getByRole('link', { name: 'Diário do Nordeste', exact: true }), 'https://diariodonordeste.verdesmares.com.br/');
  state.country = 'JP';
  await refresh.click();
  await local.getByRole('heading', { name: 'Local news · Japan' }).waitFor();
  await local.getByText('Live headlines aren’t configured for this country yet.', { exact: false }).waitFor();
  await checkCover(localPress.getByRole('link', { name: 'Asahi Shimbun', exact: true }), 'https://www.asahi.com/');
  assert.equal(await morePress.getAttribute('href'), 'https://www.w3newspapers.com/japan/');
  assert.equal(await local.locator('.clock-headline-header .clock-headline-count').count(), 0, 'a directory is not a feed');
  assert.equal(await localPress.locator('a[href*="agenciabrasil.ebc.com.br"]').count(), 0);
  for (const [country, title, message, path] of [
    ['AD', 'Andorra', 'Live headlines aren’t configured for this country yet.', 'andorra/'],
    ['AQ', 'Antarctica', 'No live headlines are configured for this entry country yet.', ''],
    [null, null, 'We couldn’t detect your entry country.', ''],
  ]) {
    state.country = country;
    await refresh.click();
    await local.getByRole('heading', { name: title ? `Local news · ${title}` : 'Local news', exact: true }).waitFor();
    await local.getByText(message, { exact: false }).waitFor();
    await checkCover(path ? morePress : browsePress, `https://www.w3newspapers.com/${path}`);
    assert.equal(await localPress.locator('.clock-press-card').count(), 0);
    await world.getByText('Headlines: 6', { exact: true }).waitFor();
  }
  await page.goto(new URL('#perfume_news', base).href);
  await page.getByRole('heading', { name: 'Global Perfume Trends Observatory with Exclusive Photos', exact: true }).waitFor();
  await briefing.waitFor({ state: 'detached' });
}

async function mobile() {
  console.log('Checking Arabic at 320px and respecting reduced-motion preferences…');
  const phone = await openHome({ country: 'EG', lang: 'ar', viewport: { width: 320, height: 667 }, mobile: true, reducedMotion: 'reduce', rejectPhoto: true });
  await phone.local.getByText('خبر مصري تجريبي 1', { exact: true }).waitFor();
  await phone.local.getByText('عدد العناوين: ٩').waitFor();
  await phone.local.getByText('١ / ٩').waitFor();
  const digits = phone.local.locator('.clock-headline-position bdi');
  assert.ok((await digits.first().boundingBox()).x < (await digits.last().boundingBox()).x, 'the current position precedes the total even in RTL');
  await phone.local.getByRole('button', { name: 'تشغيل التدوير' }).waitFor();
  await phone.localPress.getByText('صحف ومواقع: ١٨').waitFor();
  await checkCover(phone.localPress.getByRole('link', { name: 'الأهرام', exact: true }), 'https://gate.ahram.org.eg/');
  await checkCover(phone.worldPress.getByRole('link', { name: 'بي بي سي عربي', exact: true }), 'https://www.bbc.com/arabic');
  assert.ok((await phone.localPress.getByRole('link', { name: 'دليل صحف البلد' }).boundingBox()).height >= 44);
  assert.equal(await phone.briefing.getAttribute('dir'), 'rtl');
  await phone.localPress.getByRole('button', { name: 'كل الصحف', exact: true }).tap();
  assert.equal(await phone.localPress.locator('.clock-press-card').count(), 18);
  await checkCover(phone.localPress.getByRole('link', { name: 'مصراوي', exact: true }), 'https://www.masrawy.com/');
  await phone.localPress.getByRole('button', { name: 'عرض أقل', exact: true }).tap();
  await phone.local.getByRole('button', { name: 'كل عناوين اليوم' }).tap();
  assert.equal(await phone.local.locator('.clock-headline-list li').count(), 9);
  await phone.world.getByText('المصادر المفعّلة: ٦').waitFor();
  await phone.world.getByText('عدد العناوين: ٦', { exact: true }).waitFor();
  const phoneStage = phone.world.locator('.clock-headline-stage');
  await phoneStage.scrollIntoViewIfNeeded();
  await phoneStage.getByText(communityStory, { exact: true }).waitFor();
  await phoneStage.getByText('صورة توضيحية', { exact: true }).waitFor();
  assert.equal(await phoneStage.locator('.clock-headline-photo').count(), 0);
  assert.ok(phone.state.photoReferrers.length > 0, 'a failed photo was attempted');
  assert.equal(await phoneStage.locator('.clock-headline-photo-credit').count(), 0);
  assert.equal(await phoneStage.locator('.clock-headline-link').getAttribute('href'), communityUrl, 'the original article still works without the image');
  const phoneFilter = phone.world.getByRole('combobox', { name: 'تصفية حسب المصدر' });
  await phoneFilter.selectOption('un-news');
  await phone.world.getByText('العناوين المعروضة: ١ من ٦').waitFor();
  await phoneStage.getByText('عنوان الأمم المتحدة التجريبي', { exact: true }).waitFor();
  const overflow = await phone.briefing.evaluate((element) => ({ outer: element.clientWidth, inner: element.scrollWidth }));
  assert.ok(overflow.inner <= overflow.outer, 'expanded Arabic briefing fits 320px without horizontal scroll');
  assert.ok((await phone.world.boundingBox()).y >= (await phone.local.boundingBox()).y + (await phone.local.boundingBox()).height);
}

async function midnight() {
  console.log('Checking that Paris midnight clears stale stories even when the next request is still pending…');
  const night = await openHome({ start: Date.parse('2026-11-18T22:59:30Z'), reducedMotion: 'reduce' });
  await night.local.getByText('Titre français de test 1', { exact: true }).waitFor();
  const nightPress = night.localPress.getByRole('link', { name: 'Le Monde', exact: true });
  await nightPress.waitFor();
  let unblock;
  night.state.block = new Promise((resolve) => { unblock = resolve; });
  night.state.mode = 'empty';
  try {
    await night.page.clock.fastForward(33_000);
    await night.local.locator('.clock-headline-stage').waitFor({ state: 'hidden' });
    await night.briefing.locator('time[datetime="2026-11-19"]').waitFor();
    await nightPress.waitFor(); // edition stays available during the next day’s pending request
  } finally { unblock(); }
  await night.local.getByText('These sources have no headlines dated today yet.').waitFor();
}

async function coldStart() {
  console.log('Checking a cold start with the headlines API unavailable…');
  const cold = await openHome({ initialMode: 'failed', reducedMotion: 'reduce' });
  await cold.world.getByText('Headlines are unavailable right now.').waitFor();
  await cold.localPress.getByText('Choose a country to see its newspapers.').waitFor();
  await checkCover(cold.worldPress.getByRole('link', { name: 'Al Jazeera', exact: true }), 'https://www.aljazeera.net/');
  await cold.localPress.getByRole('combobox', { name: 'Local press country' }).selectOption('EG');
  await checkCover(cold.localPress.getByRole('link', { name: 'Al-Ahram', exact: true }), 'https://gate.ahram.org.eg/');
  await cold.local.getByRole('heading', { name: 'Local news', exact: true }).waitFor();
  await cold.local.getByText('Headlines are unavailable right now.').waitFor();
  assert.equal(await cold.briefing.locator('.clock-headline-stage').count(), 0, 'there is no fallback to invented headlines');
}

const scenarios = { desktop, mobile, midnight, cold: coldStart };
const selection = process.env.HEADLINES_SCENARIO;
assert.ok(!selection || Object.hasOwn(scenarios, selection), `Unknown scenario: ${selection}`);
for (const name of selection ? [selection] : Object.keys(scenarios)) {
  // The single-process runner shares one renderer: give each scenario a fresh browser.
  browser = await launch();
  try { await scenarios[name](); } finally { await browser.close(); }
  console.log(`Home news browser check passed: ${name}.`);
}
