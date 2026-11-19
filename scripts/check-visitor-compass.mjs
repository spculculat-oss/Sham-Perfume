/** Browser smoke: BROWSER_EXECUTABLE=/path/to/chromium node scripts/check-visitor-compass.mjs
 * Start the site first. Compass events and OS permission replies are simulated. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.CLOCK_BASE_URL || 'http://localhost:3000/';
const origin = new URL(base).origin;
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process', '--use-gl=angle', '--use-angle=swiftshader'],
});

async function openHome(lang, viewport, mobile = false) {
  const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile, reducedMotion: 'reduce' });
  await context.addInitScript((language) => {
    localStorage.setItem('sham_perfume_user_language', language);
    localStorage.setItem('sham_perfume_user_override_lang', 'true');
    localStorage.setItem('sham_cookie_consent_v1', JSON.stringify({ version: '1.1', essential: true, analytics: false, marketing: false, timestamp: new Date().toISOString() }));
    window.compassTest = { permission: 'granted', requests: [], readers: new Set() };
    const test = window.compassTest;
    Object.defineProperty(DeviceOrientationEvent, 'requestPermission', { configurable: true, value: async (absolute) => {
      test.requests.push(absolute);
      return test.permission === 'deferred' ? new Promise((resolve) => { test.resolvePermission = resolve; }) : test.permission;
    } });
    const add = window.addEventListener.bind(window);
    const remove = window.removeEventListener.bind(window);
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
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  const noCookies = page.getByRole('button', { name: /Reject non-essential|رفض غير الضروري/ });
  if (await noCookies.isVisible()) await noCookies.click();
  const compass = page.getByTestId('visitor-compass');
  await compass.waitFor();
  return { page, compass };
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

try {
  const { page, compass } = await openHome('en', { width: 1280, height: 800 });
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
  await extra.click();
  await compass.waitFor({ state: 'detached' });
  await page.evaluate(() => { window.compassTest.permission = 'deferred'; location.hash = 'home'; });
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
  await ar.compass.getByRole('button', { name: 'إيقاف البوصلة', exact: true }).tap();
  assert.equal(await readers(ar.page), 0);
  console.log('Compass desktop and Arabic mobile checks passed.');
} finally {
  await browser.close();
}
