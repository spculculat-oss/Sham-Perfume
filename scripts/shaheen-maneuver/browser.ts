/**
 * «مناورة التخصصات» — the phone-browser pass: every public section of the live site opened in Chrome the way a
 * visitor on a phone opens it (390×844, Arabic), measured, and turned into a PageProbe (src/utils/maneuver.ts).
 * puppeteer-core is installed by the workflow outside the project (PUPPETEER_PATH, like scripts/inspect/browser.mjs);
 * when it or Chrome is missing the pass is skipped with a note — never faked.
 */
import type { PageProbe } from '../../src/utils/maneuver';

export interface Target { section: string; url: string }

/** Runs inside the page (a string, so the browser's globals stay out of the server's types). */
const MEASURE = `(() => {
  const main = document.querySelector('main') || document.body;
  const text = main.innerText || '';
  const raw = (text.match(/\\bundefined\\b|\\bNaN\\b|\\[object Object\\]|\\{\\{[^}]{0,40}\\}\\}/g) || []).slice(0, 8);
  const images = [...document.images].filter((i) => i.getBoundingClientRect().width > 2);
  const buttons = [...document.querySelectorAll('button, [role="button"]')].filter((b) => b.offsetParent !== null);
  return {
    textLength: text.trim().length,
    rawText: raw,
    overflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    brokenImages: images.filter((i) => i.complete && i.naturalWidth === 0).length,
    imagesNoAlt: images.filter((i) => !i.hasAttribute('alt')).length,
    unnamedButtons: buttons.filter((b) => !(b.textContent || '').trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')).length,
    headings: document.querySelectorAll('h1, h2').length,
  };
})()`;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Any = any;

export async function openBrowser(): Promise<{ browser?: Any; noteAr?: string }> {
  let puppeteer: Any;
  try {
    const mod: Any = await import(process.env.PUPPETEER_PATH || 'puppeteer-core');
    puppeteer = mod.default || mod;
  } catch {
    return { noteAr: 'المتصفح مش متركب في التشغيل ده — فحص الأقسام على الموبايل اتأجل للمرة الجاية' };
  }
  try {
    const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--lang=ar'] });
    return { browser };
  } catch (e) {
    return { noteAr: `المتصفح مافتحش (${String(e).slice(0, 120)}) — فحص الأقسام اتأجل` };
  }
}

/** Opens one section in a fresh tab and measures it. */
export async function probeSection(browser: Any, target: Target, timeoutMs = 45_000): Promise<PageProbe> {
  const probe: PageProbe = {
    section: target.section, url: target.url, ok: false, loadMs: 0, pageErrors: [], consoleErrors: [], failed: [],
    textLength: 0, rawText: [], overflowPx: 0, brokenImages: 0, imagesNoAlt: 0, unnamedButtons: 0, headings: 0,
  };
  const page: Any = await browser.newPage();
  try {
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1 ShamManeuver');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ar-EG,ar;q=0.9' });
    await page.evaluateOnNewDocument(() => {
      try { localStorage.setItem('sham_perfume_user_language', 'ar'); localStorage.setItem('sham_perfume_user_override_lang', 'ar'); } catch { /* private mode */ }
    });
    page.on('pageerror', (e: unknown) => probe.pageErrors.push(String((e as Error)?.message || e).slice(0, 300)));
    page.on('console', (m: Any) => { if (m.type() === 'error') probe.consoleErrors.push(String(m.text()).slice(0, 300)); });
    page.on('response', (r: Any) => { const s = r.status(); if (s >= 400) probe.failed.push({ status: s, url: r.url() }); });
    page.on('requestfailed', (r: Any) => {
      const why = String(r.failure()?.errorText || '');
      if (!/ERR_ABORTED|ERR_BLOCKED/i.test(why)) probe.failed.push({ status: 0, url: r.url() });
    });
    const started = Date.now();
    await page.goto(target.url, { waitUntil: 'networkidle2', timeout: timeoutMs });
    // The app routes on the hash after it boots: give the section its moment to render (lazy chunks, data files).
    await page.waitForFunction("(document.body && document.body.innerText || '').trim().length > 80", { timeout: 12_000 }).catch(() => undefined);
    await wait(1500);
    probe.loadMs = Date.now() - started;
    const seen = await page.evaluate(MEASURE);
    Object.assign(probe, seen, { ok: true });
  } catch (e) {
    probe.failure = String((e as Error)?.message || e).slice(0, 200);
  } finally {
    await page.close().catch(() => undefined);
  }
  return probe;
}
