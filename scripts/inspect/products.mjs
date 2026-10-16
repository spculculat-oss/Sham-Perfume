/**
 * «فحص صفحات المنتجات»: opens the live store's product pages (p/<slug>.html) in Chrome on a phone screen,
 * like a visitor, and reports as GitHub annotations what a customer would see: the Arabic name, the EGP
 * price, that the photos really load, the order button opening the product in the store, nothing about the
 * supplier (its site, ringgit prices) or any AI vendor, and no sideways scrolling. Then the store page itself:
 * the brand filter must not list one brand twice (RASASI / Rasasi). Screenshots go to INSPECT_SHOTS.
 * Usage (CI): PUPPETEER_PATH=/tmp/pp/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js node scripts/inspect/products.mjs
 */
import { mkdirSync } from 'node:fs';

const { default: puppeteer } = await import(process.env.PUPPETEER_PATH || 'puppeteer-core');
const SITE = (process.env.INSPECT_SITE || 'https://spculculat-oss.github.io/Sham-Perfume/').replace(/\/?$/, '/');
const SHOTS = process.env.INSPECT_SHOTS || '/tmp/shots';
const COUNT = Number(process.env.INSPECT_PRODUCTS || 5);
mkdirSync(SHOTS, { recursive: true });
const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
const note = (level, title, body) => console.log(`::${level} title=${esc(title).replace(/[:,]/g, ' ')}::${esc(body)}`);
const FORBIDDEN = /shamperfume|ringgit|رنجت|\bMYR\b|\bRM\s?\d|سعر المورد|supplier price|Gemini|OpenAI|ChatGPT|Claude|DeepSeek|Anthropic/i;
let problems = 0;
const problem = (title, body) => { problems++; note('error', title, body); };

// 1. The product index: which pages exist on the live site.
const indexHtml = await (await fetch(`${SITE}p/index.html`, { cache: 'no-store' })).text();
const links = [...new Set([...indexHtml.matchAll(/class="card" href="([^"]+\.html)"/g)].map((m) => m[1]))];
const title = indexHtml.match(/<h1>([^<]+)<\/h1>/)?.[1] || '';
note(links.length ? 'notice' : 'error', 'Product index', `${title} — ${links.length} product pages on ${SITE}p/`);
if (!links.length) process.exit(1);
// Imported pages carry the SKU number in the slug (…-52); spread the sample over old and newest products.
const imported = links.filter((l) => /-\d+\.html$/.test(l));
const pool = imported.length ? imported : links;
const sample = [...new Set(Array.from({ length: Math.min(COUNT, pool.length) }, (_, i) => pool[Math.round((i * (pool.length - 1)) / Math.max(1, COUNT - 1))]))];

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--lang=ar'] });
const phone = async () => {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ar-EG,ar;q=0.9' });
  return page;
};

for (const [n, link] of sample.entries()) {
  const url = new URL(link, `${SITE}p/`).href;
  const page = await phone();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  try {
    const res = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });
    // Let the lazy thumbnails load: scroll through the page.
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
    await new Promise((r) => setTimeout(r, 1500));
    const seen = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('.gallery img')];
      const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => { try { return JSON.parse(s.textContent); } catch { return null; } }).find(Boolean);
      return {
        h1: document.querySelector('h1')?.textContent?.trim() || '',
        price: document.querySelector('.price')?.textContent?.trim() || '',
        stock: document.querySelector('.price + p')?.textContent?.trim() || '',
        photos: imgs.length, loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
        mainLoaded: !!document.querySelector('#main') && document.querySelector('#main').naturalWidth > 0,
        order: document.querySelector('a.btn')?.getAttribute('href') || '',
        description: [...document.querySelectorAll('section p')].map((p) => p.textContent).join(' ').trim().length,
        notes: document.querySelectorAll('.notes div').length,
        text: document.body.innerText,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        ldPrice: ld?.offers?.price, ldCurrency: ld?.offers?.priceCurrency,
      };
    });
    const priceNumber = Number(seen.price.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d]/g, ''));
    const forbidden = seen.text.match(FORBIDDEN)?.[0];
    const issues = [];
    if (res?.status() !== 200) issues.push(`HTTP ${res?.status()}`);
    if (!/[\u0600-\u06FF]/.test(seen.h1)) issues.push(`no Arabic name (${seen.h1.slice(0, 40)})`);
    if (!/جنيه/.test(seen.price) || !(priceNumber >= 30)) issues.push(`price «${seen.price}»`);
    if (seen.ldCurrency !== 'EGP' || Number(seen.ldPrice) !== priceNumber) issues.push(`structured price ${seen.ldPrice} ${seen.ldCurrency} ≠ page ${priceNumber}`);
    if (!seen.mainLoaded) issues.push('main photo did not load');
    if (seen.loaded < seen.photos) issues.push(`${seen.photos - seen.loaded}/${seen.photos} photos did not load`);
    if (!/#product=/.test(seen.order)) issues.push(`order button «${seen.order}»`);
    if (seen.description < 60) issues.push('description missing or very short');
    if (forbidden) issues.push(`visitor sees «${forbidden}»`);
    if (seen.overflow > 4) issues.push(`page scrolls sideways by ${seen.overflow}px on a phone`);
    if (errors.length) issues.push(`JS errors: ${errors.join(' / ')}`);
    await page.screenshot({ path: `${SHOTS}/product-${n + 1}.png` });

    // The order button must open this very product in the store.
    let inStore = 'not checked';
    if (/#product=/.test(seen.order)) {
      const target = new URL(seen.order, url).href;
      await page.goto(target, { waitUntil: 'networkidle2', timeout: 60_000 });
      const firstWord = seen.h1.split(/\s+/).filter((w) => w.length > 2)[1] || seen.h1.split(/\s+/)[0];
      const found = await page.waitForFunction((w) => document.body.innerText.includes(w), { timeout: 25_000 }, firstWord).then(() => true).catch(() => false);
      inStore = found ? 'opens in the store' : `store did not show «${firstWord}»`;
      if (!found) issues.push(inStore);
      await new Promise((r) => setTimeout(r, 1200));
      await page.screenshot({ path: `${SHOTS}/product-${n + 1}-store.png` });
    }
    if (issues.length) problem(`Product page ${n + 1}`, `${link}: ${issues.join(' | ')}`);
    else note('notice', `Product page ${n + 1} OK`, `${seen.h1} — ${seen.price} — ${seen.stock} — ${seen.loaded}/${seen.photos} photos — ${seen.notes} note groups — ${inStore} — ${link}`);
  } catch (e) {
    problem(`Product page ${n + 1}`, `${link}: ${String(e).slice(0, 300)}`);
  }
  await page.close();
}

// 2. The store page on a phone: imported products are listed and no brand appears twice in the filter.
const page = await phone();
try {
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 60_000 });
  await page.evaluate(() => { localStorage.setItem('sham_perfume_user_language', 'ar'); localStorage.setItem('sham_perfume_user_override_lang', 'ar'); });
  await page.goto(`${SITE}#store`, { waitUntil: 'networkidle2', timeout: 60_000 });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 3000));
  const store = await page.evaluate(() => ({
    options: [...document.querySelectorAll('select option, [role="option"], button')].map((o) => o.textContent.trim()).filter((t) => t && t.length < 40),
    text: document.body.innerText,
  }));
  const brands = ['Lattafa', 'Rasasi', 'RASASI', 'Al Rehab', 'Lattafa Pride'];
  const listed = store.options.filter((o) => brands.some((b) => o.toLowerCase().startsWith(b.toLowerCase())));
  const lower = listed.map((o) => o.replace(/\s*\(\d+\)\s*$/, '').toLowerCase());
  const dupes = [...new Set(lower.filter((o, i) => lower.indexOf(o) !== i))];
  const forbidden = store.text.match(FORBIDDEN)?.[0];
  const priceCount = (store.text.match(/جنيه/g) || []).length;
  await page.screenshot({ path: `${SHOTS}/store.png` });
  if (dupes.length) problem('Store brand filter', `brand listed twice: ${dupes.join(', ')} (${listed.join(' / ')})`);
  if (forbidden) problem('Store page', `visitor sees «${forbidden}»`);
  note(priceCount ? 'notice' : 'error', 'Store page', `${priceCount} prices shown; brand options: ${listed.join(' / ') || 'none found'}`);
} catch (e) { problem('Store page', String(e).slice(0, 300)); }
await browser.close();
note(problems ? 'error' : 'notice', 'Product pages check', problems ? `${problems} problem(s) found` : `all ${sample.length} product pages and the store look right on a phone`);
process.exit(problems ? 1 : 0);
