/** Browser smoke: run against a built site. The clock and geolocation are simulated;
 * actual Chromium IndexedDB and Web Audio save, restore and play device recordings. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.CLOCK_BASE_URL || 'http://localhost:3000/';
const origin = new URL(base).origin;
const scenario = process.env.PRAYER_SCENARIO || 'all';
const apiOrigin = process.env.PRAYER_API_ORIGIN || origin;
const deviceDatabase = 'sham-prayer-device-audio';
const cairoFajr = Date.parse('2026-11-18T02:52:00Z');
const initial = new Date('2026-11-18T02:12:00Z');
const cairo = { placeId: 'EG:cairo', cityEn: 'Cairo', cityAr: 'القاهرة', country: 'EG', lat: 30.04, lon: 31.24, precision: 'edge-coords' };
const launch = () => chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process', '--use-gl=angle', '--use-angle=swiftshader'],
});
let browser;

const audioURLs = (fixture) => fixture.requests.filter(({ url }) => /\/audio\/adhan\//.test(url)).map(({ url }) => new URL(url).pathname);
const probe = (page) => page.evaluate(() => window.prayerTest);
const open = async (page, lang = 'en', launcher = page.getByTestId('prayer-tools-launcher')) => {
  await launcher.click();
  const dialog = page.getByRole('dialog', { name: lang === 'ar' ? 'أوقات الصلاة' : 'Prayer times', exact: true });
  await dialog.getByRole('button', { name: lang === 'ar' ? 'جدول الصلاة' : 'Schedule', exact: true }).waitFor();
  return dialog;
};
const state = (page, mode) => page.locator(`[data-testid="prayer-reminder-state"][data-mode="${mode}"]`).waitFor({ state: 'attached' });
const playback = (page, status) => page.locator(`[data-testid="adhan-playback"][data-state="${status}"]`).waitFor({ state: 'attached' });
const timeOf = async (dialog, prayer) => Date.parse(await dialog.getByTestId(`prayer-${prayer}`).locator('time').getAttribute('datetime'));
const moveTo = async (page, at) => { await page.clock.setSystemTime(at); await page.clock.fastForward(1500); };
const startNear = (page, at) => moveTo(page, at - 16_000);
const cross = (page, at) => moveTo(page, at + 3000);
const noNotice = async (page) => assert.equal(await page.getByTestId('prayer-notice').count(), 0);
const screenshot = async (page, name) => {
  if (process.env.PRAYER_SCREENSHOTS) await page.screenshot({ path: `${process.env.PRAYER_SCREENSHOTS}/sham-prayer-${name}.png`, animations: 'disabled', timeout: 45_000 });
};

async function fixture({ lang = 'en', mobile = false, geo = { country: 'EG', timezone: 'Africa/Cairo', location: cairo }, timezoneId = 'America/Los_Angeles', savedPrayerPrefs } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 320, height: 740 } : { width: 1360, height: 900 },
    timezoneId, locale: lang === 'ar' ? 'ar-EG' : 'en-GB', isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
  const requests = [];
  const errors = [];
  context.on('request', (r) => requests.push({ url: r.url(), body: r.postData() || '' }));
  await context.grantPermissions(['geolocation'], { origin });
  await context.addInitScript(({ language, savedPrayerPrefs }) => {
    if (window !== window.top) return;
    if (savedPrayerPrefs && !localStorage.getItem('sham_prayer_preferences_v1')) {
      localStorage.setItem('sham_prayer_preferences_v1', JSON.stringify(savedPrayerPrefs));
    }
    localStorage.setItem('sham_perfume_user_language', language);
    localStorage.setItem('sham_perfume_user_override_lang', 'true');
    localStorage.setItem('sham_cookie_consent_v1', JSON.stringify({ version: '1.1', essential: true, analytics: false, marketing: false, timestamp: new Date().toISOString() }));
    const probe = window.prayerTest = { locations: 0, created: 0, played: 0, stopped: 0, block: false, denied: true };
    Object.defineProperty(navigator.geolocation, 'getCurrentPosition', { value: (success, failure) => {
      probe.locations += 1;
      queueMicrotask(() => probe.denied ? failure({ code: 1 }) : success({ timestamp: Date.now(), coords: { latitude: 43.648713, longitude: -79.384761, accuracy: 14 } }));
    } });
    const Actual = window.AudioContext;
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: class extends Actual {
      constructor(...args) { super(...args); probe.created += 1; }
      get state() { return probe.block ? 'suspended' : super.state; }
      resume() { return probe.block ? Promise.reject(new DOMException('Blocked in fixture', 'NotAllowedError')) : super.resume(); }
      createBufferSource() {
        const source = super.createBufferSource();
        const start = source.start.bind(source), stop = source.stop.bind(source);
        source.start = (...args) => { const r = start(...args); probe.played += 1; probe.duration = source.buffer.duration; return r; };
        source.stop = (...args) => { const r = stop(...args); probe.stopped += 1; return r; };
        return source;
      }
    } });
  }, { language: lang, savedPrayerPrefs });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === apiOrigin) {
      const headers = { 'access-control-allow-origin': origin };
      if (url.pathname === '/api/geo') return route.fulfill({ json: geo, headers });
      if (url.pathname === '/api/clock') return route.fulfill({ json: { unixMs: initial.getTime(), timezone: geo.timezone, source: 'server' }, headers });
      if (url.pathname === '/api/weather') return route.fulfill({ json: { temperatureC: 22, weatherCode: 0 }, headers });
      if (url.pathname === '/api/home-headlines') return route.fulfill({ status: 503, json: {}, headers });
    }
    return url.origin === origin ? route.continue() : route.abort();
  });
  // Playwright exposes the same clock to every page in a context.
  await context.clock.install({ time: initial });
  const newPage = async () => {
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.setDefaultTimeout(22_000);
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const cookies = page.getByRole('button', { name: /Reject non-essential|رفض غير الضروري/ });
    if (await cookies.isVisible()) await cookies.click();
    await page.getByTestId('prayer-tools-launcher').waitFor();
    return page;
  };
  return { context, page: await newPage(), newPage, requests, errors };
}

function localWav(seconds = 40, hz = 262) {
  const frames = 8_000 * seconds;
  const bytes = Buffer.alloc(44 + frames * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8); bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22); bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i += 1) bytes.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * hz / 8000) * 640), 44 + i * 2);
  return bytes;
}

async function checkDesktop() {
  console.log('Desktop: optional entry, local timetable, preview, Fajr and silent reminders after navigation…');
  const desktop = await fixture();
  const { page } = desktop;
  assert.equal((await probe(page)).locations, 0, 'already-granted GPS must not be requested');
  assert.equal((await probe(page)).created, 0, 'no AudioContext on entry');
  assert.deepEqual(audioURLs(desktop), []);
  assert.ok(!desktop.requests.some(({ url }) => url.includes('PrayerToolsRuntime')), 'prayer runtime stays lazy');
  const board = page.locator('[data-testid=prayer-times][data-state=ready]');
  await board.locator('.prayer-arc').waitFor();
  assert.equal(await board.locator('[data-key=fajr] time').textContent(), '04:52');
  let dialog = await open(page);
  await dialog.getByTestId('prayer-place').getByText(/Cairo/).waitFor();
  assert.equal(await dialog.getByTestId('prayer-fajr').locator('time').textContent(), '04:52');
  assert.equal(await dialog.locator('.prayer-schedule-pane').getAttribute('data-prayer-place-source'), 'network');
  const fajr = await timeOf(dialog, 'fajr');
  const sunrise = await timeOf(dialog, 'sunrise');
  const dhuhr = await timeOf(dialog, 'dhuhr');
  const asr = await timeOf(dialog, 'asr');
  assert.equal(fajr, cairoFajr);
  await screenshot(page, 'desktop');
  await dialog.locator('.prayer-schedule-pane summary').click();
  assert.equal(await dialog.locator('.prayer-schedule-pane details').evaluate((el) => el.open), true);
  await dialog.getByLabel('Country / territory', { exact: true }).selectOption('US');
  await dialog.getByLabel('Find a city', { exact: true }).fill('Los Angeles');
  await dialog.getByLabel('City', { exact: true }).selectOption({ label: 'Los Angeles · America/Los_Angeles' });
  await dialog.getByTestId('prayer-place').getByText(/Los Angeles/).waitFor();
  assert.equal(await dialog.locator('.prayer-local-date time').getAttribute('datetime'), '2026-11-17');
  assert.match(await board.locator('.prayer-place').textContent(), /Los Angeles/);
  assert.equal(await board.locator('[data-key=fajr] time').getAttribute('datetime'), new Date(await timeOf(dialog, 'fajr')).toISOString());
  assert.match(await dialog.locator('.prayer-method-note').textContent(), /North America · ISNA/);
  await dialog.getByRole('button', { name: 'Use automatic location', exact: true }).click();
  await dialog.getByTestId('prayer-place').getByText(/Cairo/).waitFor();
  await dialog.getByRole('button', { name: 'Adhan & reminders', exact: true }).click();
  await state(page, 'off');
  console.log('  Cairo and Los Angeles dates are correct; checking the disabled and enabled deadlines.');
  await cross(page, fajr);
  await noNotice(page);
  assert.deepEqual(audioURLs(desktop), []);
  assert.equal((await probe(page)).created, 0);
  await dialog.getByLabel('Voice for other prayers', { exact: true }).selectOption('aaqib-azeez');
  await dialog.getByRole('button', { name: 'Preview regular adhan', exact: true }).click();
  await playback(page, 'playing');
  assert.deepEqual(audioURLs(desktop), ['/audio/adhan/aaqib-azeez.mp3'].map((url) => new URL(url.slice(1), base).pathname));
  await dialog.getByRole('button', { name: 'Stop sound', exact: true }).click();
  assert.equal((await probe(page)).stopped, 1);
  console.log('  A licensed MP3 decoded and played only via its Preview button.');
  await state(page, 'off');
  await chooseRecording(voice(dialog, 'fajr'), 'my-adhan.wav');
  await savedRecording(voice(dialog, 'fajr'), 'my-adhan.wav');
  await dialog.getByRole('button', { name: 'Preview Fajr adhan', exact: true }).click();
  await playback(page, 'playing');
  await dialog.getByRole('button', { name: 'Stop sound', exact: true }).click();
  assert.equal(audioURLs(desktop).length, 1, 'imported file should never make an audio request');
  await dialog.getByLabel('Voice for Fajr', { exact: true }).selectOption('ahmed-khalaf');
  await voice(dialog, 'fajr').locator('select:enabled').waitFor();
  const saved = await page.evaluate(() => localStorage.getItem('sham_prayer_preferences_v1'));
  assert.ok(!saved.includes('my-adhan.wav'));
  await startNear(page, fajr);
  await dialog.getByRole('button', { name: 'Reminder with adhan', exact: true }).click();
  await state(page, 'audio');
  assert.equal(audioURLs(desktop).length, 1, 'arming does not start or preload sound');
  await dialog.getByRole('button', { name: 'Close prayer times', exact: true }).click();
  await page.evaluate(() => { location.hash = 'guide'; });
  const compact = page.locator('[data-clock-layout="compact"]');
  await compact.waitFor();
  await compact.getByTestId('prayer-chip').waitFor();
  await cross(page, fajr);
  const notice = page.getByTestId('prayer-notice');
  await notice.getByText(/time for prayer.*Fajr/).waitFor();
  await page.waitForFunction(() => window.prayerTest.played === 3);
  assert.match(audioURLs(desktop).at(-1), /ahmed-khalaf-fajr\.mp3$/);
  console.log('  Fajr fired after navigation, using the Fajr recording.');
  await notice.getByRole('button', { name: 'Dismiss reminder' }).click();
  assert.equal((await probe(page)).stopped, 3);
  await startNear(page, fajr);
  await cross(page, fajr);
  await noNotice(page);
  await cross(page, sunrise);
  await noNotice(page);
  assert.equal(audioURLs(desktop).length, 2);
  await compact.getByRole('button', { name: 'Clock tools', exact: true }).click();
  dialog = await open(page);
  await state(page, 'audio');
  await startNear(page, dhuhr);
  await dialog.getByRole('button', { name: 'Silent on-page reminder', exact: true }).click();
  await state(page, 'visual');
  await cross(page, dhuhr);
  await notice.getByText(/time for prayer.*Dhuhr/).waitFor();
  assert.equal(audioURLs(desktop).length, 2, 'silent reminder requested no recording');
  await dialog.getByRole('button', { name: 'Reminders off', exact: true }).click();
  await state(page, 'off');
  await cross(page, asr);
  await noNotice(page);
  await dialog.getByRole('button', { name: 'Hide tool and turn reminders off', exact: true }).click();
  await page.getByRole('button', { name: 'Restore prayer times & adhkar', exact: true }).waitFor();
  await page.evaluate(() => { location.hash = 'home'; });
  await page.locator('[data-clock-layout="home"]').waitFor();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Restore prayer times & adhkar', exact: true }).waitFor();
  await page.getByTestId('prayer-times').waitFor({ state: 'detached' });
  dialog = await open(page);
  await dialog.getByRole('button', { name: 'Adhan & reminders', exact: true }).click();
  await state(page, 'off');
  assert.equal(await dialog.getByLabel('Voice for other prayers', { exact: true }).inputValue(), 'aaqib-azeez');
  const decoded = await page.evaluate(async (root) => {
    const audio = new AudioContext();
    try {
      const seconds = [];
      for (const name of ['ahmed-khalaf.mp3', 'besim-azemi-fajr.m4a']) {
        const response = await fetch(new URL(`audio/adhan/${name}`, root));
        seconds.push(Math.round((await audio.decodeAudioData(await response.arrayBuffer())).duration));
      }
      return seconds;
    } finally { await audio.close(); }
  }, base);
  assert.ok(decoded.every((seconds) => seconds > 70 && seconds < 300), `decoded durations ${decoded}`);
  assert.deepEqual(desktop.errors, []);
  console.log('  All four recordings decoded; local WAV, silent reminder, hide and reset passed.');
  await page.close();
}

async function checkMobile() {
  console.log('Arabic mobile: timezone suggestion, explicit GPS, blocked audio, publisher listening links, adhkar and focus…');
  const mobile = await fixture({ lang: 'ar', mobile: true, geo: { country: null, timezone: null, location: null }, timezoneId: 'Africa/Cairo' });
  const small = mobile.page;
  const dialog = await open(small, 'ar');
  assert.equal(await dialog.locator('.prayer-schedule-pane').getAttribute('data-prayer-place-source'), 'timezone');
  assert.equal(await dialog.getByTestId('prayer-fajr').locator('time').textContent(), '٠٤:٥٢');
  assert.equal((await probe(small)).locations, 0);
  const fits = () => dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1);
  assert.ok(await fits(), 'schedule fits at 320px');
  await screenshot(small, 'mobile');
  await dialog.getByRole('button', { name: 'الأذان والتنبيه', exact: true }).click();
  assert.ok(await dialog.getByRole('button', { name: 'تنبيه بصوت الأذان', exact: true }).isDisabled());
  await dialog.getByRole('button', { name: 'المكان وطريقة الحساب', exact: true }).click();
  await dialog.getByRole('button', { name: 'استخدم موقعي', exact: true }).click();
  await dialog.getByText(/المتصفح لم يسمح بالموقع/).waitFor();
  await small.evaluate(() => { window.prayerTest.denied = false; });
  await dialog.getByRole('button', { name: 'استخدم موقعي', exact: true }).click();
  await dialog.getByTestId('prayer-place').getByText('موقع الجهاز', { exact: true }).waitFor();
  await dialog.getByText('America/Toronto', { exact: true }).waitFor();
  assert.equal((await probe(small)).locations, 2);
  assert.ok(!mobile.requests.some(({ url, body }) => /43\.64|79\.38/.test(url + body)), 'GPS must stay on the page');
  await dialog.getByRole('button', { name: 'الأذان والتنبيه', exact: true }).click();
  await small.evaluate(() => { window.prayerTest.block = true; });
  await dialog.getByRole('button', { name: 'تنبيه بصوت الأذان', exact: true }).click();
  await dialog.getByRole('alert').filter({ hasText: 'المتصفح منع الصوت' }).waitFor();
  await state(small, 'off');
  assert.deepEqual(audioURLs(mobile), []);
  const library = dialog.locator('.prayer-listening');
  const contextBefore = (await probe(small)).created;
  await library.locator('summary').click();
  for (const name of ['الحرم المكي', 'المسجد النبوي', 'مسجد آيا صوفيا', 'مشاهير القرّاء']) {
    await library.getByRole('heading', { name, exact: true }).waitFor();
  }
  assert.equal(await library.getByRole('link', { name: /^علي بن أحمد ملا/ }).getAttribute('href'), 'https://audio.islamweb.net/audio/info/3');
  assert.equal(await library.getByRole('link', { name: /^عصام بخاري/ }).getAttribute('href'), 'https://audio.islamweb.net/audio/info/5');
  assert.equal(await library.getByRole('link', { name: /^مشاري راشد العفاسي/ }).getAttribute('href'), 'https://misharialafasy.net/azan');
  const dawn = library.getByRole('link', { name: /^أذان الفجر من آيا صوفيا/ });
  const dawnUrl = 'https://www.diyanet.tv/bereket-vakti-ayasofya-2017/video/ayasofyada-sabah-ezani';
  assert.equal(await dawn.getAttribute('href'), dawnUrl);
  assert.match(await dawn.textContent(), /٢٠١٧/);
  assert.match(await library.getByRole('link', { name: /^أذان الجمعة يوم إعادة الافتتاح/ }).textContent(), /٢٠٢٠/);
  assert.equal(await library.locator('iframe, audio, video').count(), 0, 'opening the library must not embed outside media');
  assert.ok(!mobile.requests.some(({ url }) => /islamweb|assabile|misharialafasy|diyanet\.tv|youtube\.com/.test(url)), 'no connection to an audio publisher before clicking a link');
  const mobileFile = 'تسجيل-الأذان-لصلاة-الفجر-من-جهازي-' + 'طويل'.repeat(15) + '.wav';
  await chooseRecording(voice(dialog, 'fajr'), mobileFile);
  await savedRecording(voice(dialog, 'fajr'), mobileFile);
  assert.equal(await voice(dialog, 'fajr').locator('select').inputValue(), 'device-file');
  assert.ok(await fits(), 'the saved filename and actions fit a right-to-left 320px screen');
  assert.ok(await voice(dialog, 'fajr').evaluate((el) => el.scrollWidth <= el.clientWidth + 1), 'the saved filename wraps inside the voice card');
  if (process.env.PRAYER_SCREENSHOTS) {
    await voice(dialog, 'fajr').scrollIntoViewIfNeeded();
    await screenshot(small, 'saved-device-mobile');
  }
  await state(small, 'off');
  assert.ok(await fits(), 'listening library fits at 320px');
  await screenshot(small, 'listening-mobile');
  // Route the new tab to a local fixture: exercises the link without claiming external media playback.
  await mobile.context.route(dawnUrl, (route) => route.fulfill({ contentType: 'text/html', body: '<title>Diyanet publisher fixture</title>' }));
  const [publisher] = await Promise.all([mobile.context.waitForEvent('page'), dawn.click()]);
  await publisher.waitForURL(dawnUrl);
  assert.equal(await publisher.evaluate(() => window.opener === null), true);
  await publisher.close();
  await small.bringToFront();
  await state(small, 'off');
  assert.equal((await probe(small)).created, contextBefore);
  assert.deepEqual(audioURLs(mobile), []);
  await dialog.getByRole('button', { name: 'الأذكار والأدعية', exact: true }).click();
  await dialog.getByRole('link', { name: 'اقرأ حصن المسلم كاملًا', exact: true }).waitFor();
  await dialog.getByRole('searchbox', { name: 'ابحث في الأذكار', exact: true }).fill('سَيِّد الاستِغْفار');
  await dialog.getByRole('heading', { name: 'سيّد الاستغفار', exact: true }).waitFor();
  assert.equal(await dialog.locator('.prayer-dhikr-card').count(), 1);
  await dialog.getByRole('searchbox', { name: 'ابحث في الأذكار', exact: true }).fill('بسم الله الذي لا يضر');
  await dialog.getByRole('button', { name: 'عدّ التكرار · بسم الله الذي لا يضر', exact: true }).click();
  await dialog.getByText('١ / ٣', { exact: true }).waitFor();
  await screenshot(small, 'adhkar');
  assert.ok(await fits(), 'adhkar fits at 320px');
  await dialog.getByRole('button', { name: 'إغلاق أوقات الصلاة', exact: true }).click();
  await small.waitForFunction(() => document.activeElement?.matches('[data-testid=prayer-tools-launcher]'));
  assert.deepEqual(mobile.errors, []);
  await small.close();
}

async function checkRestore() {
  console.log('Restore: existing hidden setting, compact shortcut, retained choices and no automatic rearming…');
  const savedPrayerPrefs = { hidden: true, cityKey: 'city:cairo', method: 'Egyptian', asr: 'hanafi', prayers: ['fajr'], regularVoice: 'aaqib-azeez', fajrVoice: 'besim-azemi-fajr' };
  const restore = await fixture({ lang: 'ar', mobile: true, savedPrayerPrefs });
  const { page } = restore;
  const recoveryName = 'استرجاع المواقيت والأذكار';
  const savedPrefs = () => page.evaluate(() => JSON.parse(localStorage.getItem('sham_prayer_preferences_v1')));
  const home = page.locator('[data-clock-layout="home"]');
  await home.getByRole('button', { name: recoveryName, exact: true }).waitFor();
  await home.getByText('مخفية · التنبيهات متوقفة', { exact: true }).waitFor();
  assert.equal(await page.getByTestId('prayer-times').count(), 0);
  await screenshot(page, 'restore-mobile');
  await page.evaluate(() => { location.hash = 'guide'; });
  const compact = page.locator('[data-clock-layout="compact"]');
  await compact.waitFor();
  await page.reload({ waitUntil: 'domcontentloaded' });
  const compactLauncher = compact.getByTestId('prayer-compact-shortcut');
  await compact.getByRole('button', { name: recoveryName, exact: true }).waitFor();
  const clockTools = compact.getByRole('button', { name: 'أدوات الساعة', exact: true });
  assert.equal(await clockTools.getAttribute('aria-expanded'), 'false');
  assert.equal(await compact.getByTestId('prayer-chip').count(), 0);
  assert.deepEqual(await savedPrefs(), savedPrayerPrefs, 'pre-update hidden preferences survived the reload');
  assert.ok(!restore.requests.some(({ url }) => /PrayerTimesBoard|PrayerToolsRuntime/.test(url)), 'hidden clock did not load timetable or runtime');
  assert.equal((await probe(page)).created, 0);
  assert.equal((await probe(page)).locations, 0);
  assert.deepEqual(audioURLs(restore), []);
  assert.ok(await compactLauncher.evaluate((el) => el.getBoundingClientRect().height >= 44 && document.documentElement.scrollWidth <= innerWidth + 1));
  assert.ok(await compact.locator('.visitor-clock-compact-time').evaluate((el) => el.scrollWidth <= el.clientWidth + 1), 'clock digits do not overlap the weather or the restore shortcut');
  await screenshot(page, 'restore-compact-mobile');

  let dialog = await open(page, 'ar', compactLauncher);
  await dialog.getByTestId('prayer-place').getByText(/القاهرة/).waitFor();
  assert.equal(await dialog.locator('.prayer-schedule-pane').getAttribute('data-prayer-place-source'), 'manual');
  assert.match(await dialog.locator('.prayer-method-note').textContent(), /الهيئة المصرية.*الحنفي/);
  const fajr = await timeOf(dialog, 'fajr');
  assert.deepEqual(await savedPrefs(), { ...savedPrayerPrefs, hidden: false });
  await dialog.getByRole('button', { name: 'الأذان والتنبيه', exact: true }).click();
  await state(page, 'off');
  assert.equal(await dialog.getByLabel('صوت أذان باقي الصلوات', { exact: true }).inputValue(), 'aaqib-azeez');
  assert.equal(await dialog.getByLabel('صوت أذان الفجر', { exact: true }).inputValue(), 'besim-azemi-fajr');
  assert.equal((await probe(page)).created, 0);
  assert.equal((await probe(page)).locations, 0);
  assert.deepEqual(audioURLs(restore), []);
  await dialog.getByRole('button', { name: 'الأذكار والأدعية', exact: true }).click();
  await dialog.getByRole('link', { name: 'اقرأ حصن المسلم كاملًا', exact: true }).waitFor();
  await dialog.getByRole('button', { name: 'إغلاق أوقات الصلاة', exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.matches('[data-testid=prayer-compact-shortcut]'));
  await clockTools.click();
  dialog = await open(page, 'ar');
  await dialog.getByRole('button', { name: 'الأذان والتنبيه', exact: true }).click();
  await startNear(page, fajr);
  await dialog.getByRole('button', { name: 'تنبيه بصوت الأذان', exact: true }).click();
  await state(page, 'audio');
  await dialog.getByRole('button', { name: 'اسمع أذان باقي الصلوات', exact: true }).click();
  await playback(page, 'playing');
  await dialog.getByRole('button', { name: 'إخفاء الأداة وإيقاف التنبيهات', exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.matches('[data-testid=prayer-compact-shortcut][data-hidden=true]'));
  assert.equal((await probe(page)).stopped, 1);
  assert.deepEqual(await savedPrefs(), savedPrayerPrefs);
  assert.equal(await compact.getByTestId('prayer-tools-launcher').count(), 0, 'only one restore shortcut in the compact clock');
  await cross(page, fajr);
  await noNotice(page);
  assert.equal(audioURLs(restore).length, 1, 'hide stopped reminders; the only request was the preview');

  await page.evaluate(() => { location.hash = 'home'; });
  await home.getByRole('button', { name: recoveryName, exact: true }).waitFor();
  dialog = await open(page, 'ar');
  await dialog.getByTestId('prayer-fajr').waitFor();
  await dialog.getByRole('button', { name: 'الأذان والتنبيه', exact: true }).click();
  await state(page, 'off');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await home.getByTestId('prayer-times').locator('.prayer-arc').waitFor();
  assert.deepEqual(await savedPrefs(), { ...savedPrayerPrefs, hidden: false });
  assert.deepEqual(restore.errors, []);
  await page.close();
}

async function checkTwoTabs() {
  console.log('Two tabs: one opted-in adhan for one deadline…');
  const two = await fixture();
  const tabs = [two.page];
  const panels = [];
  for (let index = 0; index < 2; index += 1) {
    const target = tabs[index] ?? await two.newPage();
    tabs[index] = target;
    await target.bringToFront();
    target.setDefaultTimeout(35_000);
    const panel = await open(target);
    await panel.getByTestId('prayer-place').getByText(/Cairo/).waitFor();
    assert.equal(await timeOf(panel, 'fajr'), cairoFajr);
    await panel.getByRole('button', { name: 'Adhan & reminders', exact: true }).click();
    panels.push(panel);
  }
  const lead = 5 * 60_000;
  // First load both dialogs, then freeze their single shared clock. Forced
  // clicks here skip animation stability checks but still use real gestures.
  await two.context.clock.pauseAt(cairoFajr - lead);
  for (const [index, target] of tabs.entries()) {
    await target.bringToFront();
    await panels[index].getByRole('button', { name: 'Reminder with adhan', exact: true }).click({ force: true });
    await target.locator('[data-testid="prayer-reminder-state"][data-mode="audio"]').waitFor({ state: 'attached' });
    assert.equal(await target.evaluate(() => Date.now()), cairoFajr - lead);
  }
  assert.deepEqual(audioURLs(two), []);
  console.log('  Both tabs armed before the same frozen deadline.');
  await two.context.clock.fastForward(lead + 3_000);
  await two.context.clock.resume();
  try {
    await Promise.any(tabs.map((target) => target.locator('[data-testid="adhan-playback"][data-state="playing"]').waitFor({ state: 'attached' })));
  } catch (error) {
    console.error('Two-tab state:', await Promise.all(tabs.map((target) => target.evaluate(() => ({
      now: new Date().toISOString(), visibility: document.visibilityState, probe: window.prayerTest,
      mode: document.querySelector('[data-testid=prayer-reminder-state]')?.dataset.mode,
      notice: document.querySelector('[data-testid=prayer-notice]')?.textContent,
      audio: document.querySelector('[data-testid=adhan-playback]')?.textContent,
    })))), audioURLs(two), two.errors);
    throw error;
  }
  assert.equal((await probe(two.page)).played + (await probe(tabs[1])).played, 1);
  assert.equal(audioURLs(two).length, 1);

  // Hide/restore are shared browser preferences, but permission to play is not.
  const recoveryName = 'Restore prayer times & adhkar';
  await panels[1].getByRole('button', { name: 'Hide tool and turn reminders off', exact: true }).click();
  for (const tab of tabs) {
    await tab.getByRole('button', { name: recoveryName, exact: true }).waitFor();
    await tab.getByTestId('prayer-times').waitFor({ state: 'detached' });
    await tab.getByTestId('prayer-reminder-state').waitFor({ state: 'detached' });
    await noNotice(tab);
  }
  await tabs[0].bringToFront();
  const restored = await open(tabs[0]);
  await restored.getByRole('button', { name: 'Adhan & reminders', exact: true }).click();
  await state(tabs[0], 'off');
  await tabs[1].getByTestId('prayer-times').waitFor();
  assert.equal(audioURLs(two).length, 1, 'restoring in a second tab starts no new sound');
  assert.deepEqual(two.errors, []);
}

const voice = (dialog, variant) => dialog.locator(`[data-voice-variant="${variant}"]`);
const savedRecording = (card, name) => card.locator('.prayer-file-status').getByText(name, { exact: true }).waitFor();
const chooseRecording = (card, name, buffer = localWav(), mimeType = 'audio/wav') => card.locator('input[type=file]:enabled').setInputFiles({ name, mimeType, buffer });
const chooseVoice = async (card, choice) => {
  await card.locator('select:enabled').selectOption(choice);
  await card.locator('select:enabled').waitFor();
  assert.equal(await card.locator('select').inputValue(), choice);
};
const openAdhan = async (page) => {
  const dialog = await open(page);
  await dialog.getByRole('button', { name: 'Adhan & reminders', exact: true }).click();
  await voice(dialog, 'fajr').locator('select:enabled').waitFor();
  return dialog;
};
const hasDeviceDatabase = (page) => page.evaluate(async (name) => (await indexedDB.databases()).some((db) => db.name === name), deviceDatabase);
const localPlayback = async (page, name, duration) => {
  await playback(page, 'playing');
  await page.getByTestId('adhan-playback').getByText(name, { exact: true }).waitFor();
  assert.equal((await probe(page)).duration, duration);
};
const assertNoUploads = (fixture) => {
  assert.ok(!fixture.requests.some(({ url, body }) => /-private\.wav|\bRIFF|UklGR|blob:/.test(`${url} ${body}`)),
    'no local recording filename, data or object URL is sent over the network');
};

async function checkDevice() {
  console.log('Device sounds: separate saved WAVs, playback, reminder opt-in, replacement, hide and removal…');
  const device = await fixture();
  let { page } = device;
  const regularName = 'regular-private.wav', fajrName = 'fajr-private.wav', replacedName = 'replacement-private.wav';
  assert.equal(await hasDeviceDatabase(page), false, 'entry did not open the audio database');
  const schedule = await open(page);
  await schedule.getByTestId('prayer-place').getByText(/Cairo/).waitFor();
  const fajr = await timeOf(schedule, 'fajr'), dhuhr = await timeOf(schedule, 'dhuhr');
  await schedule.getByRole('button', { name: 'Adhan & reminders', exact: true }).click();
  await Promise.all([
    chooseRecording(voice(schedule, 'regular'), regularName, localWav(32)),
    chooseRecording(voice(schedule, 'fajr'), fajrName, localWav(36, 330)),
  ]);
  await savedRecording(voice(schedule, 'regular'), regularName);
  await savedRecording(voice(schedule, 'fajr'), fajrName);
  await state(page, 'off');
  assert.equal((await probe(page)).created, 0, 'saving did not unlock an AudioContext');
  assert.deepEqual(audioURLs(device), []);
  await page.reload({ waitUntil: 'domcontentloaded' });
  let dialog = await openAdhan(page);
  await state(page, 'off');
  await cross(page, fajr);
  await noNotice(page);
  assert.equal((await probe(page)).created, 0, 'opening saved sounds did not unlock audio');
  for (const [variant, name, duration] of [['regular', regularName, 32], ['fajr', fajrName, 36]]) {
    const card = voice(dialog, variant);
    await savedRecording(card, name);
    assert.equal(await card.locator('select').inputValue(), 'device-file');
    await card.getByRole('button', { name: /^Preview/ }).click();
    await localPlayback(page, name, duration);
    await dialog.getByRole('button', { name: 'Stop sound', exact: true }).click();
  }
  const regular = voice(dialog, 'regular');
  await chooseRecording(regular, replacedName, localWav(38, 440));
  await savedRecording(regular, replacedName);
  assert.equal(await regular.getByText(regularName, { exact: true }).count(), 0);
  await savedRecording(voice(dialog, 'fajr'), fajrName);
  await state(page, 'off');
  console.log('  Both local WAVs decoded after reload; a replacement changed only its own slot.');

  await startNear(page, fajr);
  await dialog.getByRole('button', { name: 'Reminder with adhan', exact: true }).click();
  await state(page, 'audio');
  for (const [deadline, label, name, duration] of [[fajr, 'Fajr', fajrName, 36], [dhuhr, 'Dhuhr', replacedName, 38]]) {
    await startNear(page, deadline);
    await cross(page, deadline);
    const notice = page.getByTestId('prayer-notice');
    await notice.getByText(new RegExp(`time for prayer.*${label}`)).waitFor();
    await localPlayback(page, name, duration);
    await notice.getByRole('button', { name: 'Dismiss reminder', exact: true }).click();
  }
  assert.equal((await probe(page)).played, 4, 'only two previews and two explicitly enabled reminders');
  assert.deepEqual(audioURLs(device), [], 'local previews and reminders did not fetch audio');
  await dialog.getByRole('button', { name: 'Hide tool and turn reminders off', exact: true }).click();
  await page.getByRole('button', { name: 'Restore prayer times & adhkar', exact: true }).waitFor();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Restore prayer times & adhkar', exact: true }).waitFor();
  dialog = await openAdhan(page);
  await state(page, 'off');
  await savedRecording(voice(dialog, 'regular'), replacedName);
  await savedRecording(voice(dialog, 'fajr'), fajrName);
  await chooseVoice(voice(dialog, 'regular'), 'aaqib-azeez');
  await savedRecording(voice(dialog, 'regular'), replacedName);
  await page.close();
  page = await device.newPage();
  dialog = await openAdhan(page);
  await state(page, 'off');
  assert.equal((await probe(page)).created, 0);
  assert.equal(await voice(dialog, 'regular').locator('select').inputValue(), 'aaqib-azeez');
  await savedRecording(voice(dialog, 'regular'), replacedName);
  await chooseVoice(voice(dialog, 'regular'), 'device-file');
  await voice(dialog, 'fajr').getByRole('button', { name: /^Delete saved recording/ }).click();
  await voice(dialog, 'fajr').getByText('Recording deleted from this browser', { exact: true }).waitFor();
  await page.reload({ waitUntil: 'domcontentloaded' });
  dialog = await openAdhan(page);
  await state(page, 'off');
  const dawn = voice(dialog, 'fajr');
  assert.equal(await dawn.locator('select').inputValue(), 'ahmed-khalaf');
  assert.equal(await dawn.locator('option[value="device-file"]').count(), 0);
  assert.equal(await voice(dialog, 'regular').locator('select').inputValue(), 'device-file');
  await savedRecording(voice(dialog, 'regular'), replacedName);
  await dawn.getByRole('button', { name: 'Preview Fajr adhan', exact: true }).click();
  await playback(page, 'playing');
  assert.deepEqual(audioURLs(device), [new URL('audio/adhan/ahmed-khalaf-fajr.mp3', base).pathname]);
  const prefs = await page.evaluate(() => localStorage.getItem('sham_prayer_preferences_v1'));
  assert.doesNotMatch(prefs, /\.wav|device-file|reminderMode/);
  assertNoUploads(device);
  assert.deepEqual(device.errors, []);
  console.log('  Restoring and returning kept both choices off, and deletion restored only the Fajr fallback.');
}

async function holdNextDecode(page) {
  await page.evaluate(() => {
    const prototype = OfflineAudioContext.prototype;
    const original = prototype.decodeAudioData;
    prototype.decodeAudioData = function (...args) {
      prototype.decodeAudioData = original;
      return new Promise((resolve, reject) => {
        window.releaseAdhanDecode = async () => {
          delete window.releaseAdhanDecode;
          try { resolve(await original.apply(this, args)); } catch (error) { reject(error); }
        };
      });
    };
  });
}

async function checkDeviceStorage() {
  console.log('Device storage: invalid audio, rolled-back write, hide cancellation and confirmed privacy wipe…');
  const device = await fixture();
  const { page } = device;
  const kept = 'keep-private.wav', dawn = 'dawn-private.wav';
  let dialog = await openAdhan(page);
  let card = voice(dialog, 'regular');
  await chooseRecording(card, kept);
  await savedRecording(card, kept);
  await chooseRecording(voice(dialog, 'fajr'), dawn);
  await savedRecording(voice(dialog, 'fajr'), dawn);
  for (const [name, bytes, type, issue] of [
    ['invalid-private.wav', Buffer.from('<html>'), 'text/html', /Choose an MP3/],
    ['corrupt-private.wav', Buffer.from('Not an audio recording'), 'audio/wav', /could not be decoded/],
    ['long-private.wav', localWav(481), 'audio/wav', /longer than 8 minutes/],
  ]) {
    await chooseRecording(card, name, bytes, type);
    await card.getByRole('alert').filter({ hasText: issue }).waitFor();
    await savedRecording(card, kept);
    assert.equal(await card.locator('select').inputValue(), 'device-file');
  }
  await page.evaluate((dbName) => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      const request = put.call(this, value, key);
      if (this.transaction.db.name === dbName && value.name === 'rolled-back-private.wav') {
        // A put request can succeed even though the overall write failed to commit.
        request.addEventListener('success', () => this.transaction.abort(), { once: true });
      }
      return request;
    };
  }, deviceDatabase);
  await chooseRecording(card, 'rolled-back-private.wav');
  await card.getByRole('alert').filter({ hasText: /could not save the recording/ }).waitFor();
  await savedRecording(card, kept);
  await holdNextDecode(page);
  await chooseRecording(card, 'hidden-pending-private.wav');
  await page.waitForFunction(() => typeof window.releaseAdhanDecode === 'function');
  await card.getByText('Checking and saving the recording…', { exact: true }).waitFor();
  await dialog.getByRole('button', { name: 'Hide tool and turn reminders off', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  await page.evaluate(() => window.releaseAdhanDecode());
  await page.reload({ waitUntil: 'domcontentloaded' });
  dialog = await openAdhan(page);
  card = voice(dialog, 'regular');
  await savedRecording(card, kept);
  await savedRecording(voice(dialog, 'fajr'), dawn);
  await state(page, 'off');
  assert.equal((await probe(page)).created, 0);

  await holdNextDecode(page);
  await chooseRecording(card, 'wipe-pending-private.wav');
  await page.waitForFunction(() => typeof window.releaseAdhanDecode === 'function');
  const freshPage = await device.newPage();
  // This tab has never opened the prayer runtime. Keep an extra real database
  // connection open to exercise the blocked deletion path, then let it close.
  await freshPage.evaluate((name) => new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onsuccess = () => { window.heldAdhanConnection = request.result; resolve(); };
    request.onerror = () => reject(request.error);
  }), deviceDatabase);
  await freshPage.getByRole('button', { name: 'Privacy', exact: true, description: 'User data protection & privacy (GDPR)' }).click();
  await freshPage.getByRole('button', { name: 'Wipe All My Data', exact: true }).click();
  const confirm = freshPage.getByRole('button', { name: 'Confirm Full Wipe', exact: true });
  await confirm.click();
  await freshPage.getByRole('alert').filter({ hasText: /could not confirm that saved adhan recordings were erased/ }).waitFor();
  assert.ok(await confirm.isVisible(), 'a blocked wipe did not close as if it had succeeded');
  assert.notEqual(await freshPage.evaluate(() => localStorage.getItem('sham_prayer_preferences_v1')), null, 'unconfirmed wipe did not discard normal settings');
  await dialog.waitFor({ state: 'detached' });
  await freshPage.evaluate(() => window.heldAdhanConnection.close());
  await freshPage.waitForFunction(async (name) => !(await indexedDB.databases()).some((db) => db.name === name), deviceDatabase);
  await page.evaluate(() => window.releaseAdhanDecode());
  assert.equal(await hasDeviceDatabase(freshPage), false, 'the pending decode cannot recreate the erased store');
  await confirm.click();
  await freshPage.getByRole('heading', { name: /User Data Protection & Privacy Charter/ }).waitFor({ state: 'detached' });
  assert.equal(await hasDeviceDatabase(freshPage), false);
  assert.equal(await freshPage.evaluate(() => localStorage.getItem('sham_prayer_preferences_v1')), null);
  dialog = await openAdhan(freshPage);
  await state(freshPage, 'off');
  assert.equal(await dialog.locator('option[value="device-file"]').count(), 0);
  console.log('  Transaction failure kept the old WAVs; blocked deletion was reported and a retry wiped both slots.');

  await freshPage.reload({ waitUntil: 'domcontentloaded' });
  await freshPage.evaluate((dbName) => {
    const open = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (name, ...args) {
      if (name === dbName) throw new DOMException('Storage denied in fixture', 'SecurityError');
      return open.call(this, name, ...args);
    };
  }, deviceDatabase);
  dialog = await openAdhan(freshPage);
  await dialog.getByRole('alert').filter({ hasText: /Could not read saved recordings/ }).waitFor();
  card = voice(dialog, 'fajr');
  await chooseRecording(card, 'blocked-private.wav');
  await card.getByRole('alert').filter({ hasText: /could not save the recording/ }).waitFor();
  assert.equal(await card.locator('option[value="device-file"]').count(), 0);
  await card.getByRole('button', { name: 'Preview Fajr adhan', exact: true }).click();
  await playback(freshPage, 'playing');
  await state(freshPage, 'off');
  assertNoUploads(device);
  assert.deepEqual(device.errors, []);
}

async function checkPages() {
  console.log('Pages: prefixed built-in asset and a restored local recording without an audio request…');
  const assets = await fixture();
  const { page } = assets;
  let dialog = await openAdhan(page);
  await dialog.getByRole('button', { name: 'Preview Fajr adhan', exact: true }).click();
  await playback(page, 'playing');
  await dialog.getByRole('button', { name: 'Stop sound', exact: true }).click();
  const name = 'pages-private.wav';
  await chooseRecording(voice(dialog, 'fajr'), name);
  await savedRecording(voice(dialog, 'fajr'), name);
  await page.reload({ waitUntil: 'domcontentloaded' });
  dialog = await openAdhan(page);
  await state(page, 'off');
  assert.equal((await probe(page)).created, 0);
  await savedRecording(voice(dialog, 'fajr'), name);
  await dialog.getByRole('button', { name: 'Preview Fajr adhan', exact: true }).click();
  await localPlayback(page, name, 40);
  await dialog.getByRole('button', { name: 'Stop sound', exact: true }).click();
  assert.deepEqual(audioURLs(assets), [new URL('audio/adhan/ahmed-khalaf-fajr.mp3', base).pathname]);
  assertNoUploads(assets);
  assert.deepEqual(assets.errors, []);
}

const checks = { desktop: checkDesktop, mobile: checkMobile, restore: checkRestore, two: checkTwoTabs, device: checkDevice, 'device-storage': checkDeviceStorage, pages: checkPages };
const selected = scenario === 'all' ? ['desktop', 'mobile', 'restore', 'two', 'device', 'device-storage'] : [scenario];
for (const name of selected) {
  if (!Object.hasOwn(checks, name)) throw new Error(`Unknown PRAYER_SCENARIO ${name}`);
  // A clean instance isolates browser emulation/audio state between scenarios.
  browser = await launch();
  try { await checks[name](); }
  finally { await browser.close(); }
}
console.log(`Prayer tools browser smoke passed (${scenario}).`);
