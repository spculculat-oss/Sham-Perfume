/** Browser smoke: BROWSER_EXECUTABLE=/path/to/chromium node scripts/check-visitor-compass.mjs
 * Start the site first. Location, compass events and OS permission replies are simulated. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.CLOCK_BASE_URL || 'http://localhost:3000/';
const origin = new URL(base).origin;
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process', '--use-gl=angle', '--use-angle=swiftshader'],
});

async function openHome(lang, viewport, mobile = false) {
  const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile, reducedMotion: 'reduce' });
  // A previous origin-wide grant (e.g. for Qibla) doesn't opt into the weather lookup.
  await context.grantPermissions(['geolocation'], { origin });
  const coordinateRequests = [];
  context.on('request', (request) => {
    if (/30\.04443|31\.23579|latitude=30\.04|longitude=31\.24/.test(request.url() + (request.postData() || ''))) coordinateRequests.push(request.url());
  });
  await context.addInitScript((language) => {
    localStorage.setItem('sham_perfume_user_language', language);
    localStorage.setItem('sham_perfume_user_override_lang', 'true');
    localStorage.setItem('sham_cookie_consent_v1', JSON.stringify({ version: '1.1', essential: true, analytics: false, marketing: false, timestamp: new Date().toISOString() }));
    window.compassTest = { permission: 'granted', requests: [], readers: new Set(), geoMode: 'denied', geoRequests: [] };
    const test = window.compassTest;
    Object.defineProperty(navigator.geolocation, 'getCurrentPosition', { value: (success, failure, options) => {
      test.geoRequests.push(options);
      const complete = () => success({ timestamp: Date.now(), coords: { latitude: 30.04443, longitude: 31.23579, accuracy: 14 } });
      if (test.geoMode === 'deferred') { test.completeLocation = complete; return; }
      queueMicrotask(() => {
        if (test.geoMode === 'denied') failure({ code: 1 });
        else if (test.geoMode === 'timeout') failure({ code: 3 });
        else if (test.geoMode === 'uncertain') success({ timestamp: Date.now(), coords: { latitude: 21.422487, longitude: 39.826206, accuracy: 18 } });
        else complete();
      });
    } });
    Object.defineProperty(document, 'hidden', { get: () => test.hidden ?? document.visibilityState === 'hidden' });
    Object.defineProperty(DeviceOrientationEvent, 'requestPermission', { configurable: true, value: async (absolute) => {
      test.requests.push(absolute);
      return test.permission === 'deferred' ? new Promise((resolve) => { test.resolvePermission = resolve; }) : test.permission;
    } });
    const add = window.addEventListener.bind(window);
    const remove = window.removeEventListener.bind(window);
    // Desktop Chromium can queue an empty hardware event after subscription.
    // Isolate our synthetic fixtures from that real (unavailable) sensor stream.
    for (const type of ['deviceorientation', 'deviceorientationabsolute']) {
      add(type, (event) => { if (event.isTrusted) event.stopImmediatePropagation(); }, { capture: true });
    }
    window.addEventListener = (type, listener, ...args) => {
      if (type.startsWith('deviceorientation')) test.readers.add(listener);
      return add(type, listener, ...args);
    };
    window.removeEventListener = (type, listener, ...args) => {
      if (type.startsWith('deviceorientation')) test.readers.delete(listener);
      return remove(type, listener, ...args);
    };
    Object.defineProperty(screen.orientation, 'angle', { get: () => test.angle ?? 0 });
  }, lang);
  await context.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  await page.clock.install({ time: new Date('2026-11-18T12:00:00Z') });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  const noCookies = page.getByRole('button', { name: /Reject non-essential|رفض غير الضروري/ });
  if (await noCookies.isVisible()) await noCookies.click();
  const compass = page.getByTestId('visitor-compass');
  await compass.waitFor();
  return { page, compass, coordinateRequests };
}

const sample = (page, orientation) => page.evaluate(({ absolute = true, webkitCompassHeading, webkitCompassAccuracy, ...angles }) => {
  const event = new DeviceOrientationEvent(absolute ? 'deviceorientationabsolute' : 'deviceorientation', {
    absolute, beta: 0, gamma: 0, ...angles,
  });
  if (webkitCompassHeading !== undefined) Object.defineProperty(event, 'webkitCompassHeading', { value: webkitCompassHeading });
  if (webkitCompassAccuracy !== undefined) Object.defineProperty(event, 'webkitCompassAccuracy', { value: webkitCompassAccuracy });
  window.dispatchEvent(event);
}, orientation);

const readers = (page) => page.evaluate(() => window.compassTest.readers.size);
const geoRequests = (page) => page.evaluate(() => window.compassTest.geoRequests);
const expectMode = async (page, mode) => {
  try {
    await page.waitForFunction((value) => document.querySelector('[data-testid=visitor-compass]')?.dataset.qiblaMode === value, mode);
  } catch (cause) {
    const info = await page.getByTestId('visitor-compass').evaluate((el) => ({ ...el.dataset, text: el.querySelector('.clock-qibla-status')?.textContent, time: new Date().toISOString() }));
    throw new Error(`Expected Qibla mode ${mode}; got ${JSON.stringify(info)}`, { cause });
  }
};
const needleAngle = (needle) => needle.evaluate((el) => parseFloat(el.style.transform.replace('rotate(', '')));
const closeAngle = (actual, expected, tolerance = 0.15) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual}° ≠ ${expected}° ± ${tolerance}°`);

try {
  const { page, compass, coordinateRequests } = await openHome('en', { width: 1280, height: 800 });
  const degreeMarks = compass.locator('.clock-compass-mark');
  const arrow = compass.locator('.clock-compass-arrow');
  const enable = compass.getByRole('button', { name: 'Enable compass', exact: true });
  const stop = compass.getByRole('button', { name: 'Stop compass', exact: true });
  const bearing = compass.getByTestId('compass-bearing');
  const expectBearing = async (text) => { await bearing.getByText(text, { exact: true }).waitFor(); };

  console.log('Checking the numbered dial, permission and relative/invalid readings…');
  assert.deepEqual(await degreeMarks.allTextContents(), Array.from({ length: 12 }, (_, i) => String(i * 30)));
  const dial = await compass.locator('svg.clock-compass-dial').boundingBox();
  assert.ok(dial && dial.width >= 150 && Math.abs(dial.width - dial.height) < 1, 'the desktop dial is round and readable');
  assert.equal(await bearing.textContent(), '—°');
  assert.equal(await readers(page), 0);
  assert.deepEqual(await page.evaluate(() => window.compassTest.requests), []);
  await page.evaluate(() => { window.compassTest.permission = 'denied'; });
  await enable.click();
  await compass.getByRole('status').getByText('Sensor access was denied.', { exact: false }).waitFor();
  assert.equal(await readers(page), 0);
  assert.equal(await arrow.getAttribute('data-bearing'), null);
  await page.evaluate(() => { window.compassTest.permission = 'granted'; });
  await enable.click();
  await stop.waitFor();
  assert.deepEqual(await page.evaluate(() => window.compassTest.requests), [true, true]);
  assert.ok(await readers(page) > 0);
  await sample(page, { absolute: false, alpha: 270 });
  await sample(page, { alpha: null });
  await page.clock.fastForward(5_200);
  await compass.getByRole('status').getByText('No compass reading.', { exact: false }).waitFor();
  assert.equal(await bearing.textContent(), '—°', 'no sensor reading is never displayed as north');

  console.log('Checking the arrow and absolute headings at each quadrant and through north…');
  for (const [alpha, direction, degrees] of [[270, 'East', 90], [180, 'South', 180], [90, 'West', 270], [1, 'North', 359], [0.25, 'North', 0]]) {
    await sample(page, { alpha });
    await expectBearing(`${degrees}°`);
    await compass.getByText(direction, { exact: true }).waitFor();
    assert.equal(await arrow.getAttribute('data-bearing'), String(degrees));
  }
  assert.match(await arrow.getAttribute('style'), /rotate\(360deg\)/);
  await page.evaluate(() => { window.compassTest.angle = 90; screen.orientation.dispatchEvent(new Event('change')); });
  await expectBearing('90°');
  await sample(page, { alpha: 90, beta: 0, gamma: 90 });
  await compass.getByRole('status').getByText('No compass reading.', { exact: false }).waitFor();
  assert.equal(await arrow.getAttribute('data-bearing'), null);
  await stop.click();
  assert.equal(await readers(page), 0);
  await sample(page, { alpha: 70 });
  assert.equal(await bearing.textContent(), '—°');

  console.log('Checking local Qibla location, city fallback and an explicit north-up diagram…');
  const qibla = compass.getByRole('region', { name: 'Qibla direction' });
  const kaaba = compass.getByTestId('qibla-kaaba');
  const qiblaBearing = qibla.getByTestId('qibla-bearing');
  const needle = compass.getByTestId('qibla-needle');
  const locate = qibla.getByRole('button', { name: 'Find Qibla using my location', exact: true });
  const refresh = qibla.getByRole('button', { name: 'Refresh my Qibla location', exact: true });
  const city = qibla.getByRole('combobox', { name: 'Qibla city' });
  const expectQibla = (angle) => qiblaBearing.getByText(angle, { exact: true }).waitFor();
  await kaaba.waitFor();
  assert.deepEqual(await kaaba.locator('circle').evaluate((el) => [el.cx.baseVal.value, el.cy.baseVal.value]), [96, 96]);
  assert.equal(await needle.count(), 0, 'no location is guessed');
  assert.deepEqual(await geoRequests(page), [], 'no location lookup before the button, even with a previous origin grant');
  await locate.click();
  await qibla.getByRole('status').getByText('Location access was denied.', { exact: false }).waitFor();
  assert.equal(await needle.count(), 0);
  assert.deepEqual(await geoRequests(page), [{ enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 }]);
  await qibla.locator('summary').click();
  await city.selectOption('cairo');
  await expectQibla('136°');
  await expectMode(page, 'map');
  await qibla.getByText('Estimate from central Cairo', { exact: false }).waitFor();
  await qibla.getByRole('status').getByText('North-up diagram.', { exact: false }).waitFor();
  closeAngle(await needleAngle(needle), 136.1377);
  assert.equal(await readers(page), 0);
  assert.equal((await geoRequests(page)).length, 1, 'choosing a city only uses the local gazetteer');

  await page.evaluate(() => { window.compassTest.geoMode = 'deferred'; });
  await locate.click();
  await qibla.getByRole('status').getByText('Finding your location…', { exact: true }).waitFor();
  await city.selectOption('london');
  await expectQibla('119°');
  await page.evaluate(async () => { window.compassTest.completeLocation(); await new Promise(requestAnimationFrame); });
  assert.equal(await qiblaBearing.textContent(), '119°', 'late GPS cannot replace a city chosen meanwhile');
  await page.evaluate(() => { window.compassTest.geoMode = 'uncertain'; });
  await locate.click();
  await qibla.getByRole('status').getByText('No reliable bearing', { exact: false }).waitFor();
  assert.equal(await needle.count(), 0, 'at the Kaaba do not display an arbitrary bearing');
  await page.evaluate(() => { window.compassTest.geoMode = 'timeout'; });
  await locate.click();
  await qibla.getByRole('status').getByText('Location timed out.', { exact: false }).waitFor();
  await page.evaluate(() => { window.compassTest.geoMode = 'granted'; window.compassTest.angle = 0; });
  await locate.click();
  await refresh.waitFor();
  await expectQibla('136°');
  await qibla.getByText('From your device location', { exact: false }).waitFor();
  await expectMode(page, 'map');
  assert.deepEqual(coordinateRequests, [], 'Qibla must not send precise or rounded coordinates');
  assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('30.04443'));

  console.log('Checking live Qibla, watch expiry, rotation and hidden-page cleanup…');
  await page.evaluate(() => { delete DeviceOrientationEvent.requestPermission; });
  await enable.click();
  await stop.waitFor();
  await sample(page, { absolute: false, alpha: 229 });
  await page.waitForFunction(() => document.querySelector('[data-testid=visitor-compass]').dataset.state === 'waiting');
  await expectMode(page, 'map');
  await sample(page, { alpha: 270 });
  await expectMode(page, 'live');
  await expectBearing('95°');
  closeAngle(await needleAngle(needle), 41.3673);
  const art = kaaba.locator('.clock-qibla-art');
  const tilt = await art.evaluate((el) => el.style.getPropertyValue('--kaaba-tilt'));
  assert.notEqual(tilt, '0deg', 'center artwork follows the live direction');
  assert.equal(await art.evaluate((el) => getComputedStyle(el).transform), 'none', 'reduced motion keeps art steady');
  await page.evaluate(() => { window.compassTest.angle = 90; screen.orientation.dispatchEvent(new Event('change')); });
  await expectBearing('185°');
  closeAngle(await needleAngle(needle), -48.6327);
  assert.notEqual(await art.evaluate((el) => el.style.getPropertyValue('--kaaba-tilt')), tilt);
  await page.evaluate(() => { window.compassTest.angle = 0; screen.orientation.dispatchEvent(new Event('change')); });
  await sample(page, { alpha: 229 });
  await expectBearing('136°');
  assert.equal(await compass.getAttribute('data-qibla-aligned'), 'true');
  closeAngle(await needleAngle(needle), 0.3673);
  await expectQibla('136°');
  await sample(page, { alpha: 1 });
  await expectBearing('4°');
  const beforeNorth = await needleAngle(needle);
  await sample(page, { alpha: 0 });
  await expectBearing('5°');
  closeAngle(await needleAngle(needle) - beforeNorth, -1);
  await page.clock.fastForward(10_000);
  assert.equal(await compass.getAttribute('data-qibla-mode'), 'live', 'do not expire a stationary compass too soon');
  await page.clock.fastForward(21_000);
  await compass.getByRole('status').getByText('Turn the phone slightly to refresh the heading.', { exact: true }).waitFor();
  await expectMode(page, 'map');
  assert.equal(await bearing.textContent(), '—°');
  await sample(page, { alpha: 229 });
  await expectMode(page, 'live');
  await page.evaluate(() => { window.compassTest.hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
  await expectMode(page, 'map');
  assert.equal(await readers(page), 0);
  await page.evaluate(() => { window.compassTest.hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  await expectMode(page, 'map');
  assert.ok(await readers(page) > 0);
  await sample(page, { alpha: 229 });
  await expectMode(page, 'live');
  await stop.click();
  await expectMode(page, 'map');
  assert.equal(await readers(page), 0);
  assert.deepEqual(coordinateRequests, []);

  console.log('Checking cleanup on navigation, late permission and unsupported browsers…');
  await enable.click();
  await stop.waitFor();
  await page.evaluate(() => { location.hash = 'guide'; });
  await compass.waitFor({ state: 'detached' });
  await page.waitForFunction(() => window.compassTest.readers.size === 0);
  const compact = page.locator('[data-clock-layout="compact"]');
  const extra = compact.getByRole('button', { name: 'Clock tools', exact: true });
  await extra.click();
  await compass.waitFor();
  assert.equal(await needle.count(), 0, 'the GPS-derived angle is not restored in a new compass');
  await qibla.locator('summary').click();
  await city.selectOption('cairo');
  await enable.click();
  await stop.waitFor();
  await sample(page, { alpha: 229 });
  await expectMode(page, 'live');
  await extra.click();
  await compass.waitFor({ state: 'detached' });
  assert.equal(await readers(page), 0, 'closing compact tools stops live Qibla');
  await page.evaluate(() => {
    window.compassTest.permission = 'deferred';
    Object.defineProperty(DeviceOrientationEvent, 'requestPermission', { configurable: true, value: () => new Promise((resolve) => { window.compassTest.resolvePermission = resolve; }) });
    location.hash = 'home';
  });
  await enable.click();
  await compass.getByRole('status').getByText('Allow access to the compass sensor.', { exact: true }).waitFor();
  await page.evaluate(() => { location.hash = 'guide'; });
  await compass.waitFor({ state: 'detached' });
  await page.evaluate(async () => { window.compassTest.resolvePermission('granted'); await new Promise(requestAnimationFrame); });
  assert.equal(await readers(page), 0, 'navigating away during the prompt cannot leak a sensor listener');
  await page.evaluate(() => { Object.defineProperty(window, 'DeviceOrientationEvent', { value: undefined }); location.hash = 'home'; });
  await enable.click();
  await compass.getByRole('status').getByText('Compass is unavailable here.', { exact: false }).waitFor();
  assert.equal(await bearing.textContent(), '—°');
  await qibla.locator('summary').click();
  await city.selectOption('cairo');
  await expectQibla('136°');
  await expectMode(page, 'map');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await compass.waitFor();
  assert.deepEqual(await geoRequests(page), [], 'the weather must not reuse the Qibla permission on reload');
  assert.deepEqual(coordinateRequests, []);
  await page.close();

  console.log('Checking the Arabic dial, touch fit and WebKit heading…');
  const ar = await openHome('ar', { width: 320, height: 660 }, true);
  const arDial = await ar.compass.locator('svg.clock-compass-dial').boundingBox();
  assert.ok(arDial && arDial.width >= 120 && Math.abs(arDial.width - arDial.height) < 1);
  assert.deepEqual(await ar.compass.locator('.clock-compass-mark').allTextContents(), ['٠','٣٠','٦٠','٩٠','١٢٠','١٥٠','١٨٠','٢١٠','٢٤٠','٢٧٠','٣٠٠','٣٣٠']);
  assert.ok(await ar.compass.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
  await ar.compass.getByRole('button', { name: 'فعّل البوصلة', exact: true }).tap();
  await ar.compass.getByRole('button', { name: 'إيقاف البوصلة', exact: true }).waitFor();
  await sample(ar.page, { absolute: false, alpha: 12, webkitCompassHeading: 135, webkitCompassAccuracy: 8 });
  await sample(ar.page, { alpha: null });
  await ar.compass.getByTestId('compass-bearing').getByText('١٣٥°', { exact: true }).waitFor();
  await ar.compass.getByText('جنوب شرق', { exact: true }).waitFor();
  const arArrow = ar.compass.locator('.clock-compass-arrow');
  assert.equal(await arArrow.evaluate((el) => Math.round(new DOMMatrix(getComputedStyle(el).transform).b * 100)), 71, 'RTL does not reverse dial rotation');
  const arQibla = ar.compass.getByRole('region', { name: 'اتجاه القبلة' });
  await arQibla.locator('summary').tap();
  await arQibla.getByRole('combobox', { name: 'مدينة القبلة' }).selectOption('cairo');
  await arQibla.getByTestId('qibla-bearing').getByText('١٣٦°', { exact: true }).waitFor();
  await expectMode(ar.page, 'live');
  closeAngle(await needleAngle(ar.compass.getByTestId('qibla-needle')), -3.6323);
  assert.ok(await ar.compass.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().width < 320));
  await sample(ar.page, { absolute: false, alpha: 12, webkitCompassHeading: 135, webkitCompassAccuracy: -1 });
  await expectMode(ar.page, 'map');
  await ar.compass.getByRole('button', { name: 'إيقاف البوصلة', exact: true }).tap();
  assert.equal(await readers(ar.page), 0);

  console.log('Checking the shared clock and usable Workspace height on a narrow phone…');
  await ar.page.evaluate(() => { location.hash = 'workspace'; });
  await ar.page.locator('[data-clock-layout="compact"]').waitFor();
  const workspace = ar.page.locator('.sham-ws');
  await workspace.waitFor();
  const bounds = await workspace.boundingBox();
  assert.ok(bounds && bounds.height > 200 && bounds.width <= 320, JSON.stringify(bounds));
  console.log('Compass and Qibla desktop and Arabic mobile checks passed (simulated sensors).');
} finally {
  await browser.close();
}
