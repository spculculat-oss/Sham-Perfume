/**
 * Real-browser inspection: opens each public site in Chrome like a visitor, asks Shaheen in every answer
 * mode, and reports (as GitHub annotations) exactly what the chat bubble shows — raw code, calculator links,
 * the formula toolbar — and whether tapping a calculator link really opens that tool on the site.
 * Usage (CI): PUPPETEER_PATH=/tmp/pp/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js node scripts/inspect/browser.mjs
 */
const { default: puppeteer } = await import(process.env.PUPPETEER_PATH || 'puppeteer-core');

const SITES = (process.env.INSPECT_SITES || 'https://spculculat-oss.github.io/Sham-Perfume/,https://sham-perfume-49bf.vercel.app/').split(',');
const QUESTIONS = (process.env.INSPECT_QUESTIONS || 'عايز أخفف كحول 96% إلى 70% وأعمل منه 1 لتر، أحط كام مية؟|صمم لي عطر شرقي بالعود والورد 50 مل تركيز EDP').split('|');
const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
const note = (level, title, body) => console.log(`::${level} title=${esc(title).replace(/[:,]/g, ' ')}::${esc(body)}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--lang=ar'] });

for (const site of SITES) {
  const host = new URL(site).host;
  // 1. Which build is the site serving?
  try {
    const html = await (await fetch(site, { cache: 'no-store' })).text();
    const asset = html.match(/assets\/index-[\w-]+\.js/)?.[0];
    const js = asset ? await (await fetch(new URL(asset, site))).text() : '';
    note('notice', `build ${host}`, JSON.stringify({ asset, bytes: js.length, toolLinks_PR42: js.includes('shaheen-tool-links'), latexFix_PR48: js.includes('list-[circle]') }));
  } catch (e) { note('warning', `build ${host}`, String(e)); }

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const apiCalls = [];
  page.on('response', (r) => { if (r.url().includes('/api/chat')) apiCalls.push(`${r.status()} ${r.url()}`); });
  page.on('pageerror', (e) => note('warning', `js error ${host}`, String(e).slice(0, 500)));
  try {
    await page.goto(site, { waitUntil: 'networkidle2', timeout: 60_000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await page.click('button[title*="شاهين"]');
    await page.waitForSelector('form input[maxlength="4000"]', { timeout: 15_000 });
    await wait(1500);
    const modes = await page.$$eval('button[aria-pressed]', (bs) => bs.map((b) => b.textContent.trim()));
    note('notice', `modes ${host}`, JSON.stringify(modes));
    for (let m = 0; m < modes.length; m++) {
      for (const question of QUESTIONS) {
        const buttons = await page.$$('button[aria-pressed]');
        if (buttons[m]) await buttons[m].click();
        await wait(300);
        const before = await page.$$eval('div.font-sans[dir="auto"]', (els) => els.length);
        await page.type('form input[maxlength="4000"]', question);
        await page.click('form button[type="submit"]');
        const started = Date.now();
        try {
          await page.waitForFunction((n) => document.querySelectorAll('div.font-sans[dir="auto"]').length > n + 1
            && !document.querySelector('form button[type="submit"]')?.closest('form')?.querySelector('input')?.disabled, { timeout: 90_000 }, before);
        } catch { /* reported below */ }
        await wait(1500);
        const seen = await page.evaluate(() => {
          const bubbles = [...document.querySelectorAll('div.font-sans[dir="auto"]')];
          const last = bubbles[bubbles.length - 1];
          const card = last?.closest('div.rounded-2xl, div.rounded-3xl')?.parentElement || last?.parentElement;
          const links = card ? [...card.querySelectorAll('[data-testid="shaheen-tool-links"] button')].map((b) => b.textContent.trim()) : [];
          const buttons = card ? [...card.querySelectorAll('button')].map((b) => b.textContent.trim()).filter(Boolean) : [];
          const text = last?.innerText || '';
          return { text, html: last?.innerHTML.slice(0, 1500) || '', pre: last ? last.querySelectorAll('pre').length : 0, links, buttons: buttons.slice(0, 25) };
        });
        const problems = [];
        if (!seen.text) problems.push('لا رد');
        if (/\$\$|\\(frac|times|text|approx|cdot)\b|\$[A-Za-z]_/.test(seen.text)) problems.push('LaTeX ظاهر');
        if (/```|"pyramidNotes"|"tools"\s*:|sham-(formula|tool|media)/.test(seen.text)) problems.push('كود/JSON ظاهر');
        if (seen.pre) problems.push(`صندوق كود ظاهر (${seen.pre})`);
        if (!seen.links.length) problems.push('لا روابط أدوات');
        // Does the first calculator link really open the tool?
        let opened = '';
        if (seen.links.length) {
          const headBefore = await page.evaluate(() => document.querySelector('main')?.innerText.slice(0, 120) || '');
          await page.evaluate(() => { const b = [...document.querySelectorAll('[data-testid="shaheen-tool-links"] button')].pop(); b?.click(); });
          await wait(1500);
          opened = await page.evaluate(() => document.querySelector('main')?.innerText.slice(0, 160) || '');
          if (opened === headBefore) problems.push('رابط الأداة لم يغيّر الصفحة');
          // Re-open the chat if the tool navigation closed it.
          if (!(await page.$('form input[maxlength="4000"]'))) { await page.click('button[title*="شاهين"]'); await page.waitForSelector('form input[maxlength="4000"]', { timeout: 10_000 }).catch(() => {}); }
        }
        note(problems.length ? 'warning' : 'notice', `${host} · ${modes[m]} · ${question.slice(0, 30)}`,
          `${JSON.stringify({ ms: Date.now() - started, links: seen.links, buttons: seen.buttons, api: apiCalls.slice(-1) })}\nمشاكل: ${problems.join(' | ') || 'لا شيء'}\n----- الأداة بعد الضغط -----\n${opened}\n----- ما يراه الزائر -----\n${seen.text.slice(0, 3000)}\n----- HTML -----\n${seen.html}`);
        await wait(3000);
      }
    }
  } catch (e) {
    note('warning', `browser ${host}`, `${String(e).slice(0, 800)}\napi: ${apiCalls.join(' ; ')}`);
  }
  await page.close();
}
await browser.close();
