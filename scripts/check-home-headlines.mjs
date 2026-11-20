/** Home news interaction smoke, using only synthetic API responses. Start the built site first:
 * BROWSER_EXECUTABLE=/path/to/chromium node scripts/check-home-headlines.mjs
 * HEADLINES_SCENARIO=desktop|mobile|fallback|midnight|cold optionally runs one scenario;
 * use HEADLINES_SCENARIO=static against a Pages build without an API. */
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
const zone = { BR: 'America/Sao_Paulo', EG: 'Africa/Cairo', FR: 'Europe/Paris', GB: 'Europe/London' };
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
  const includeItems = mode === 'fresh' || mode === 'partial';
  let offset = 0;
  const story = (publisher, title, url, dateKind = 'published') => ({ title, url, publisher, datedAt: new Date(asOf - ++offset * 60_000).toISOString(), dateKind });
  const items = country === 'FR' ? Array.from({ length: 8 }, (_, i) => story('service-public', `Titre français de test ${i + 1}`, `https://www.service-public.gouv.fr/particuliers/actualites/A${41000 + i}`, 'date'))
    : country === 'GB' ? [story('gov-uk', 'Official update for testing a long attribution', 'https://www.gov.uk/government/news/headline-fixture', 'updated')]
    : country === 'BR' ? [{ ...story('agencia-brasil', 'Notícia brasileira de teste', brazilUrl), author: 'Agência Brasil' }]
    : [...Array.from({ length: 8 }, (_, i) => story('youm7', `خبر مصري تجريبي ${i + 1}`, `https://www.youm7.com/${42000 + i}`)),
      story('egypt-today', 'عنوان الكرة المصرية التجريبي', egyptTodayUrl)];
  offset = 0; // The independent world edition starts its own timeline.
  return {
    country, timeZone, asOf, day: date(asOf, timeZone),
    local: zone[country] ? { status: mode, checkedAt, items: includeItems ? items : [] } : { status: 'unsupported', checkedAt: null, items: [] },
    world: { status: mode, checkedAt, items: includeItems ? [
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
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await context.addInitScript((language) => {
    if (window.top !== window) return;
    localStorage.setItem('sham_perfume_user_language', language);
    localStorage.setItem('sham_perfume_user_override_lang', 'true');
    localStorage.setItem('sham_cookie_consent_v1', JSON.stringify({ version: '1.1', essential: true, analytics: false, marketing: false, timestamp: new Date().toISOString() }));
  }, lang);
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/home-headlines') {
      state.calls++;
      if (state.block) await state.block;
      if (state.mode === 'failed') await route.fulfill({ status: 503, headers: cors, json: { code: 'FIXTURE_UNAVAILABLE' } });
      else {
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
  const briefing = board.getByTestId('home-news-briefing');
  await briefing.waitFor();
  return { page, context, board, briefing, state, errors,
    toggle: briefing.locator('.hn-toggle'), strip: briefing.locator('.hn-strip'), panel: briefing.locator('.hn-paper'),
    tab: (name) => briefing.locator('.hn-tabs').getByRole('button', { name, exact: true }),
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

async function fit({ page, briefing }) {
  const measurements = await briefing.evaluate((element) => ({
    width: element.clientWidth, content: element.scrollWidth,
    document: document.documentElement.scrollWidth, viewport: innerWidth,
  }));
  assert.ok(measurements.content <= measurements.width + 1, `briefing overflows: ${JSON.stringify(measurements)}`);
  assert.ok(measurements.viewport <= page.viewportSize().width + 1, `page zoomed out: ${JSON.stringify(measurements)}`);
}

async function originalLink(link, url) {
  assert.equal(await link.getAttribute('href'), url);
  assert.equal(await link.getAttribute('target'), '_blank');
  assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
}

async function desktop() {
  const home = await openHome();
  const { page, context, board, briefing, local, world, localPress, worldPress, toggle, panel, strip, tab, state } = home;
  const refresh = panel.getByRole('button', { name: 'Refresh headlines' });
  const stripLink = strip.locator('.hn-strip-link');
  const french = (n) => stripLink.getByText(`Titre français de test ${n}`, { exact: true });
  const localLead = local.getByTestId('home-news-lead');
  const worldLead = world.getByTestId('home-news-lead');
  const frenchUrl = 'https://www.service-public.gouv.fr/particuliers/actualites/A41000';
  console.log('Checking the automatically rotating top strip before opening the desk…');
  await french(1).waitFor();
  await originalLink(stripLink, frenchUrl);
  assert.equal(await panel.isVisible(), false);
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(await toggle.getAttribute('aria-controls'), await panel.getAttribute('id'));
  assert.equal(await worldPress.count(), 0, 'directory images stay unloaded until requested');
  assert.deepEqual(state.photoReferrers, [], 'collapsed strip makes no photo requests');
  assert.ok((await briefing.boundingBox()).height < 90, 'collapsed briefing fits in a toolbar');
  assert.ok((await briefing.boundingBox()).width >= (await board.boundingBox()).width - 70);
  assert.ok(await briefing.evaluate((element) => element.compareDocumentPosition(element.parentElement.querySelector('.clock-glass')) & Node.DOCUMENT_POSITION_FOLLOWING), 'Home news is above the clock');
  assert.equal(await strip.locator('time').innerText(), '18 Nov', 'the date-only source is not shown with a made-up time');
  const worldFirst = stripLink.getByText('عنوان عالمي تجريبي', { exact: true });
  const pause = strip.getByRole('button', { name: 'Pause headline strip' });
  const play = strip.getByRole('button', { name: 'Rotate headline strip' });
  const next = strip.getByRole('button', { name: 'Next headline' });
  await page.clock.fastForward(8100);
  await worldFirst.waitFor();
  await strip.getByText('World', { exact: true }).waitFor();
  assert.equal(await panel.isVisible(), false, 'opening the desk is not required to see world headlines');
  await stripLink.focus();
  await page.clock.fastForward(8100);
  await worldFirst.waitFor();
  await stripLink.blur();
  await stripLink.hover();
  await page.clock.fastForward(8100);
  await worldFirst.waitFor();
  await page.mouse.move(4, 4);
  await page.clock.fastForward(8100);
  await french(2).waitFor();
  await pause.click();
  await page.mouse.move(4, 4);
  await page.clock.fastForward(8100);
  await french(2).waitFor();
  await next.click();
  await stripLink.getByText(communityStory).waitFor();
  await originalLink(stripLink, communityUrl);
  await play.click();
  await page.mouse.move(4, 4);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await pause.waitFor({ state: 'hidden' });
  await page.clock.fastForward(8100);
  await stripLink.getByText(communityStory).waitFor();
  await next.click();
  await french(3).waitFor();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await play.waitFor();

  console.log('Checking keyboard disclosure and a stable lead and list…');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await panel.waitFor();
  await page.keyboard.press('Tab');
  assert.equal(await tab('Local').evaluate((element) => element === document.activeElement), true);
  await page.keyboard.press('Escape');
  assert.equal(await panel.isVisible(), false);
  assert.equal(await toggle.evaluate((element) => element === document.activeElement), true);
  await page.keyboard.press('Enter');
  await local.getByRole('heading', { name: 'Local news · France' }).waitFor();
  await local.getByText('Official updates').waitFor();
  await local.getByText('Headlines: 8', { exact: true }).waitFor();
  assert.equal(await tab('Local').getAttribute('aria-pressed'), 'true');
  assert.equal(await world.count(), 0);
  await originalLink(localLead.getByRole('link', { name: 'Read at the source' }), frenchUrl);
  assert.equal(await localLead.locator('bdi[lang=fr]').textContent(), 'Titre français de test 1');
  assert.equal(await localLead.locator('img').count(), 0, 'no unlicensed event photos');
  const list = local.locator('.hn-list li');
  assert.equal(await list.count(), 4);
  assert.ok((await local.locator('.hn-latest').boundingBox()).x > (await localLead.boundingBox()).x, 'lead and headlines are side by side on desktop');
  await fit(home);
  const all = local.getByRole('button', { name: 'All available headlines' });
  await all.click();
  assert.equal(await list.count(), 7, 'all remaining headlines are available without repeating the lead');
  assert.equal(await local.getByRole('button', { name: 'Show fewer headlines' }).getAttribute('aria-expanded'), 'true');
  assert.equal(await list.last().locator('.hn-row-link').innerText(), 'Titre français de test 8');
  await local.getByRole('button', { name: 'Show fewer headlines' }).click();
  assert.equal(await list.count(), 4);

  console.log('Checking the independent, illustrated press directory and its country controls…');
  await tab('Press directory').click();
  assert.equal(await local.count(), 0);
  await localPress.getByRole('heading', { name: 'Local newspapers · France', exact: true }).waitFor();
  const leMonde = localPress.getByRole('link', { name: 'Le Monde', exact: true });
  const reuters = worldPress.getByRole('link', { name: 'Reuters', exact: true });
  assert.equal(await localPress.locator('.clock-press-card:visible').count(), 4);
  assert.equal(await worldPress.locator('.clock-press-card:visible').count(), 4);
  await checkCover(leMonde, 'https://www.lemonde.fr/');
  await checkCover(reuters, 'https://www.reuters.com/world/');
  await worldPress.getByRole('link', { name: 'BBC News Arabic', exact: true }).waitFor();
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
  await worldCountry.selectOption('');
  await localCountry.selectOption('');
  await leMonde.waitFor();
  const morePress = localPress.getByRole('link', { name: 'Country newspaper directory' });
  const browsePress = localPress.getByRole('link', { name: 'Newspaper directory by country' });
  assert.equal(await morePress.getAttribute('href'), 'https://www.w3newspapers.com/france/');
  assert.ok(!state.outbound.some((host) => ['www.lemonde.fr', 'www.w3newspapers.com', 'gate.ahram.org.eg', 'www.alarabiya.net', 'www.reuters.com'].includes(host)),
    'covers are bundled; the browser does not contact the outlets while browsing');
  await tab('Local').click();
  await local.getByRole('heading', { name: 'Local news · France' }).waitFor();
  assert.equal(state.calls, callsBeforeBrowse, 'browsing the shelves does not request or switch the live edition');

  console.log('Checking world headlines, sources, filters and verified photo attribution…');
  await tab('World').click();
  assert.equal(await tab('World').getAttribute('aria-pressed'), 'true');
  assert.equal(await local.count(), 0);
  await world.getByRole('heading', { name: 'World news' }).waitFor();
  await world.getByText('Headlines: 6', { exact: true }).waitFor();
  await worldLead.getByRole('heading', { name: communityStory, exact: true }).waitFor();
  await worldLead.getByText('Fixture Writer', { exact: true }).waitFor();
  const img = worldLead.getByRole('img', { name: photo.alt });
  await img.evaluate((element) => element.decode());
  assert.equal(await img.getAttribute('referrerpolicy'), 'no-referrer');
  assert.ok(state.photoReferrers.length && state.photoReferrers.every((referer) => !referer));
  await originalLink(worldLead.getByRole('link', { name: 'Read at the source' }), communityUrl);
  await originalLink(worldLead.getByRole('link', { name: photo.credit }), photo.source);
  await originalLink(worldLead.getByRole('link', { name: 'CC BY-SA 4.0', exact: true }), 'https://creativecommons.org/licenses/by-sa/4.0/');
  await originalLink(worldLead.getByRole('link', { name: 'Headline license: CC BY 3.0' }), 'https://creativecommons.org/licenses/by/3.0/');
  assert.match(await worldLead.locator('time').innerText(), /^18 Nov.*14:57$/, 'publication time is in the declared edition zone');
  await page.evaluate(() => scrollTo(0, 0));
  const filter = world.getByRole('combobox', { name: 'Filter by source' });
  await filter.selectOption('global-voices');
  await world.getByText('Showing 1 of 6 headlines').waitFor();
  assert.equal(await world.locator('.hn-list li').count(), 0);
  await worldLead.getByRole('heading', { name: communityStory, exact: true }).waitFor();
  await filter.selectOption('european-parliament');
  await world.getByText('No headlines available from this source right now.').waitFor();
  await world.getByText('Showing 0 of 6 headlines').waitFor();
  assert.equal(await worldLead.count(), 0);
  await filter.selectOption('');
  await world.getByRole('button', { name: 'All available headlines' }).click();
  assert.equal(await world.locator('.hn-list li').count(), 5);
  await originalLink(world.getByRole('link', { name: 'عنوان العرب اليوم التجريبي', exact: true }), arabsTodayUrl);
  await world.getByText('Sources and licenses', { exact: true }).click();
  await originalLink(world.locator('.hn-sources').getByRole('link', { name: 'UN News', exact: true }), 'https://news.un.org/ar/');

  console.log('Checking auto-refresh, partial updates, offline retention, and empty modes…');
  const before = state.calls;
  const checked = panel.locator('.hn-checked time');
  const previousCheck = await checked.getAttribute('datetime');
  await page.clock.fastForward(5 * 60_000 + 15_000);
  await page.waitForFunction((previous) => Boolean(document.querySelector('.hn-checked time')?.dateTime && document.querySelector('.hn-checked time').dateTime !== previous), previousCheck);
  assert.ok(state.calls > before, 'visible editions are checked again automatically');
  state.mode = 'partial';
  await refresh.click();
  await world.getByText('Some sources couldn’t be refreshed.').waitFor();
  await strip.getByText('Partial update').waitFor();
  await worldLead.getByRole('heading', { name: communityStory }).waitFor();
  state.mode = 'failed';
  await refresh.click();
  await world.getByText('Refresh failed; showing the last available headlines with their dates.').waitFor();
  await strip.getByText('Last available').waitFor();
  await worldLead.getByRole('heading', { name: communityStory }).waitFor();
  await context.setOffline(true);
  await page.waitForFunction(() => !navigator.onLine);
  const offlineCalls = state.calls;
  await refresh.click();
  assert.equal(state.calls, offlineCalls);
  await tab('Press directory').click();
  await leMonde.waitFor();
  await reuters.waitFor();
  await tab('World').click();
  state.mode = 'empty';
  await context.setOffline(false);
  await world.getByText('These sources have no recent headlines right now.').waitFor();
  assert.equal(await stripLink.count(), 0);
  assert.equal(await worldLead.count(), 0);
  await tab('Local').click();
  await local.getByText('These sources have no recent headlines right now.').waitFor();
  state.mode = 'unavailable';
  await refresh.click();
  await local.getByText('Headlines are unavailable right now.').waitFor();

  console.log('Checking entry-country changes, unsupported countries and separation from the perfume Journal…');
  state.mode = 'fresh';
  state.country = 'EG';
  await refresh.click();
  await local.getByRole('heading', { name: 'Local news · Egypt' }).waitFor();
  await localLead.getByRole('heading', { name: 'خبر مصري تجريبي 1', exact: true }).waitFor();
  await local.getByRole('combobox', { name: 'Filter by source' }).selectOption('egypt-today');
  await localLead.getByRole('heading', { name: 'عنوان الكرة المصرية التجريبي', exact: true }).waitFor();
  await originalLink(localLead.getByRole('link', { name: 'Read at the source' }), egyptTodayUrl);
  assert.equal(await localLead.locator('img').count(), 0);
  await tab('Press directory').click();
  await checkCover(localPress.getByRole('link', { name: 'Al-Masry Al-Youm', exact: true }), 'https://www.almasryalyoum.com/');
  await tab('Local').click();
  state.country = 'BR';
  await refresh.click();
  await local.getByRole('heading', { name: 'Local news · Brazil' }).waitFor();
  assert.equal(await localLead.getByText('Notícia brasileira de teste', { exact: true }).getAttribute('lang'), 'pt-BR');
  await originalLink(localLead.getByRole('link', { name: 'Read at the source' }), brazilUrl);
  await tab('Press directory').click();
  await localPress.getByRole('button', { name: 'All outlets', exact: true }).click();
  await checkCover(localPress.getByRole('link', { name: 'Diário do Nordeste', exact: true }), 'https://diariodonordeste.verdesmares.com.br/');
  await tab('Local').click();
  for (const [country, title, path] of [['JP', 'Japan', 'japan/'], ['AD', 'Andorra', 'andorra/'], ['AQ', 'Antarctica', ''], [null, null, '']]) {
    state.country = country;
    await refresh.click();
    await local.getByRole('heading', { name: title ? `Local news · ${title}` : 'Local news', exact: true }).waitFor();
    await local.getByText(country ? 'Local headlines aren’t configured for this entry country.' : 'We couldn’t detect your entry country.', { exact: false }).waitFor();
    assert.equal(await localLead.count(), 0, 'unsupported local editions are not replaced with another country’s news');
    await local.getByRole('button', { name: 'Press directory', exact: true }).click();
    assert.equal(await tab('Press directory').evaluate((element) => element === document.activeElement), true);
    if (country === 'JP') {
      await checkCover(localPress.getByRole('link', { name: 'Asahi Shimbun', exact: true }), 'https://www.asahi.com/');
      assert.equal(await morePress.getAttribute('href'), 'https://www.w3newspapers.com/japan/');
    } else {
      await checkCover(path ? morePress : browsePress, `https://www.w3newspapers.com/${path}`);
      assert.equal(await localPress.locator('.clock-press-card').count(), 0);
    }
    await tab('World').click();
    await world.getByText('Headlines: 6', { exact: true }).waitFor();
    await tab('Local').click();
  }
  state.country = 'GB';
  await refresh.click();
  await local.getByRole('heading', { name: 'Local news · United Kingdom' }).waitFor();
  assert.match(await localLead.locator('time').innerText(), /^Updated 18 Nov.*\d{2}:\d{2}$/);
  await localLead.getByText('Contains public sector information licensed under the Open Government Licence v3.0.').waitFor();
  await page.goto(new URL('#perfume_news', base).href);
  await page.getByTestId('news-portal').waitFor();
  await briefing.waitFor({ state: 'detached' });
  assert.equal(await board.getAttribute('data-clock-layout'), 'compact');
  assert.deepEqual(home.errors, [], 'unexpected browser errors');
}

async function mobile() {
  console.log('Checking Arabic touch controls, right-to-left layout, and photo failure at 320px…');
  const phone = await openHome({ country: 'EG', lang: 'ar', viewport: { width: 320, height: 667 }, mobile: true, reducedMotion: 'reduce', rejectPhoto: true });
  const { page, briefing, strip, toggle, local, world, localPress, worldPress, tab, state } = phone;
  await strip.getByText('خبر مصري تجريبي 1', { exact: true }).waitFor();
  assert.equal(await briefing.getAttribute('dir'), 'rtl');
  assert.ok((await toggle.boundingBox()).height >= 44, 'the opening button is a touch target');
  const next = strip.getByRole('button', { name: 'العنوان التالي' });
  assert.ok((await next.boundingBox()).height >= 44, 'next is a touch target');
  await next.tap();
  await strip.getByText('عنوان عالمي تجريبي', { exact: true }).waitFor();
  await strip.getByText('عالمي', { exact: true }).waitFor();
  assert.match(await strip.locator('time').innerText(), /[٠-٩]/u, 'dates and times follow the site language');
  await originalLink(strip.locator('.hn-strip-link'), 'https://www.youm7.com/43000');
  await fit(phone);
  await toggle.tap();
  await local.getByText('العناوين: ٩', { exact: true }).waitFor();
  const localLead = local.getByTestId('home-news-lead');
  const localList = local.locator('.hn-latest');
  await page.waitForFunction(() => {
    const title = document.querySelector('.hn-lead-title')?.getBoundingClientRect();
    return title && title.top > 0 && title.bottom < innerHeight - 94;
  });
  assert.ok((await localList.boundingBox()).y >= (await localLead.boundingBox()).y + (await localLead.boundingBox()).height);
  assert.equal(await briefing.getByRole('button', { name: 'شغّل تدوير شريط العناوين' }).count(), 0);
  await fit(phone);
  await local.getByRole('button', { name: 'كل العناوين المتاحة' }).tap();
  assert.equal(await local.locator('.hn-list li').count(), 8);
  assert.equal(await local.locator('.hn-list li .hn-order').last().innerText(), '٨');
  await tab('عالمي').tap();
  await world.getByText('العناوين: ٦', { exact: true }).waitFor();
  const lead = world.getByTestId('home-news-lead');
  await lead.getByRole('heading', { name: communityStory }).waitFor();
  await lead.locator('.hn-photo').waitFor({ state: 'detached' });
  assert.ok(state.photoReferrers.length > 0, 'the licensed photo was attempted');
  assert.equal(await lead.locator('img').count(), 0, 'there is no misleading replacement image');
  await originalLink(lead.getByRole('link', { name: 'اقرأ عند المصدر' }), communityUrl);
  const filter = world.getByRole('combobox', { name: 'تصفية حسب المصدر' });
  await filter.selectOption('un-news');
  await world.getByText('العناوين المعروضة: ١ من ٦', { exact: true }).waitFor();
  await lead.getByRole('heading', { name: 'عنوان الأمم المتحدة التجريبي' }).waitFor();
  await fit(phone);
  await tab('دليل الصحف').tap();
  await localPress.getByText('صحف ومواقع: ١٨').waitFor();
  await checkCover(localPress.getByRole('link', { name: 'الأهرام', exact: true }), 'https://gate.ahram.org.eg/');
  await checkCover(worldPress.getByRole('link', { name: 'بي بي سي عربي', exact: true }), 'https://www.bbc.com/arabic');
  assert.ok((await localPress.getByRole('link', { name: 'دليل صحف البلد' }).boundingBox()).height >= 44);
  await localPress.getByRole('button', { name: 'كل الصحف', exact: true }).tap();
  assert.equal(await localPress.locator('.clock-press-card').count(), 18);
  await checkCover(localPress.getByRole('link', { name: 'مصراوي', exact: true }), 'https://www.masrawy.com/');
  await localPress.getByRole('button', { name: 'عرض أقل', exact: true }).tap();
  await fit(phone);
  await briefing.locator('.hn-done').tap();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(await toggle.evaluate((element) => element === document.activeElement), true);
  await toggle.tap();
  await briefing.locator('.hn-quick-close').tap();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(phone.errors, []);
}

async function fallback() {
  console.log('Checking the world default when a country has no local feed, with long German labels…');
  const home = await openHome({ country: 'JP', lang: 'de', viewport: { width: 360, height: 740 }, mobile: true, initialMode: 'partial' });
  await home.strip.getByText('Welt', { exact: true }).waitFor();
  await home.strip.getByText('Teilweise aktualisiert').waitFor();
  await fit(home);
  await home.toggle.tap();
  assert.equal(await home.tab('Welt').getAttribute('aria-pressed'), 'true');
  await home.world.getByTestId('home-news-lead').getByRole('heading', { name: communityStory }).waitFor();
  await fit(home);
  await home.tab('Lokal').tap();
  await home.local.getByRole('heading', { name: 'Lokale Nachrichten · Japan', exact: true }).waitFor();
  await home.local.getByText('Für dieses Zugriffsland sind keine lokalen Meldungen eingerichtet.', { exact: false }).waitFor();
  assert.equal(await home.local.getByTestId('home-news-lead').count(), 0);
  await home.strip.locator('.hn-strip-link').waitFor();
  await home.strip.getByText('Welt', { exact: true }).waitFor();
  await fit(home);
  assert.deepEqual(home.errors, []);
}

async function midnight() {
  console.log('Checking that a delayed refresh and an offline midnight retain dated news, then expire it…');
  const midnight = Date.parse('2026-11-18T23:00:00Z');
  const night = await openHome({ start: midnight - 60_000, reducedMotion: 'reduce' });
  const link = night.strip.locator('.hn-strip-link');
  const time = night.strip.locator('time');
  const lead = night.local.getByTestId('home-news-lead');
  await link.getByText('Titre français de test 1', { exact: true }).waitFor();
  const timestamp = await time.getAttribute('datetime');
  await night.toggle.click();
  await night.briefing.locator('time[datetime="2026-11-18"]').waitFor();
  await lead.waitFor();

  await night.page.clock.fastForward(midnight - (await night.page.evaluate(() => Date.now())) - 5000);
  const refresh = night.panel.getByRole('button', { name: 'Refresh headlines' });
  let unblock;
  night.state.block = new Promise((resolve) => { unblock = resolve; });
  night.state.mode = 'failed';
  try {
    const request = night.page.waitForRequest((request) => new URL(request.url()).pathname === '/api/home-headlines');
    await refresh.click();
    await request;
    await night.page.clock.fastForward(7500);
    await night.briefing.locator('time[datetime="2026-11-19"]').waitFor();
    assert.equal(await refresh.isDisabled(), true, 'the API refresh has not finished yet');
    await night.strip.getByText('Earlier headline', { exact: true }).waitFor();
    assert.equal(await time.getAttribute('datetime'), timestamp, 'the story was not relabelled with the newer edition date');
    assert.equal(await time.innerText(), '18 Nov');
    await lead.waitFor();
  } finally { unblock(); }

  await night.strip.getByText('Last available').waitFor();
  await night.context.setOffline(true);
  await night.page.waitForFunction(() => !navigator.onLine);
  await night.tab('Press directory').click();
  await night.localPress.getByRole('link', { name: 'Le Monde', exact: true }).waitFor();
  await night.tab('Local').click();
  await lead.waitFor();
  const expiry = Date.parse(timestamp) + 48 * 3600_000;
  const span = expiry - (await night.page.evaluate(() => Date.now()));
  await night.page.clock.fastForward(span - 5000);
  await link.waitFor();
  await night.page.clock.fastForward(6000);
  await link.waitFor({ state: 'detached' });
  await lead.waitFor({ state: 'detached' });
  await night.local.getByText('Headlines are unavailable right now.').waitFor();
  night.state.mode = 'fresh';
  await night.context.setOffline(false);
  await lead.waitFor();
  assert.notEqual(await time.getAttribute('datetime'), timestamp, 'reconnecting loads new stories');
  assert.deepEqual(night.errors, []);
}

async function coldStart(staticBuild = false) {
  console.log(`Checking a cold start ${staticBuild ? 'in a deployment with no API' : 'with the headlines API unavailable'}…`);
  const cold = await openHome({ initialMode: 'failed', reducedMotion: 'reduce' });
  await cold.strip.getByText('No headlines available right now.', { exact: true }).waitFor();
  await cold.toggle.click();
  const message = staticBuild ? 'Live headlines aren’t available on this version of the site. The press directory is available.' : 'Headlines are unavailable right now.';
  await cold.local.getByText(message, { exact: true }).waitFor();
  await cold.tab('World').click();
  await cold.world.getByText(message, { exact: true }).waitFor();
  assert.equal(await cold.briefing.getByTestId('home-news-lead').count(), 0, 'there is no fallback to invented headlines');
  if (staticBuild) {
    assert.equal(cold.state.calls, 0);
    assert.equal(await cold.briefing.getByRole('button', { name: 'Refresh headlines' }).count(), 0);
  }
  await cold.world.getByRole('button', { name: 'Press directory', exact: true }).click();
  await cold.localPress.getByText('Choose a country to see its newspapers.').waitFor();
  await checkCover(cold.worldPress.getByRole('link', { name: 'Al Jazeera', exact: true }), 'https://www.aljazeera.net/');
  await cold.localPress.getByRole('combobox', { name: 'Local press country' }).selectOption('EG');
  await checkCover(cold.localPress.getByRole('link', { name: 'Al-Ahram', exact: true }), 'https://gate.ahram.org.eg/');
  await cold.tab('Local').click();
  await cold.local.getByRole('heading', { name: 'Local news', exact: true }).waitFor();
  await cold.local.getByText(message, { exact: true }).waitFor();
  assert.deepEqual(cold.errors, []);
}

const scenarios = { desktop, mobile, fallback, midnight, cold: () => coldStart(), static: () => coldStart(true) };
const selection = process.env.HEADLINES_SCENARIO;
assert.ok(!selection || Object.hasOwn(scenarios, selection), `Unknown scenario: ${selection}`);
for (const name of selection ? [selection] : ['desktop', 'mobile', 'fallback', 'midnight', 'cold']) {
  // The single-process runner shares one renderer: give each scenario a fresh browser.
  browser = await launch();
  try { await scenarios[name](); } finally { await browser.close(); }
  console.log(`Home news browser check passed: ${name}.`);
}
