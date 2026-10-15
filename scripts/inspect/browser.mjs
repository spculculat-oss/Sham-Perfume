/**
 * Real-browser inspection: opens each public site in Chrome like a visitor, asks Shaheen in every answer
 * mode, and reports (as GitHub annotations) exactly what the chat bubble shows — raw code, calculator links,
 * the formula toolbar — and whether tapping a calculator link really opens that tool on the site.
 * Usage (CI): PUPPETEER_PATH=/tmp/pp/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js node scripts/inspect/browser.mjs
 */
const { default: puppeteer } = await import(process.env.PUPPETEER_PATH || 'puppeteer-core');

const SITES = (process.env.INSPECT_SITES || 'https://spculculat-oss.github.io/Sham-Perfume/,https://sham-perfume-49bf.vercel.app/').split(',');
const QUESTIONS = (process.env.INSPECT_QUESTIONS || 'عايز أخفف كحول 96% إلى 70% وأعمل منه 1 لتر، أحط كام مية؟|صمم لي عطر شرقي بالعود والورد 50 مل تركيز EDP|احسب تكلفة 100 زجاجة عطر 50 مل تركيز 20% لو الزيت بـ 3 جنيه للمل والكحول بـ 0.2 جنيه للمل').split('|');
// chat = the floating Shaheen bubble; lab = the full «خبير المعمل» page (#master_ai).
const SCENE = (process.env.INSPECT_SCENE || 'chat') + (process.env.INSPECT_MOBILE ? '-mobile' : '');
const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
const note = (level, title, body) => console.log(`::${level} title=${esc(title).replace(/[:,]/g, ' ')}::${esc(body)}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const openChat = (page) => page.evaluate(() => { [...document.querySelectorAll('button[title]')].find((b) => /شاهين|Shahin|Perfumer/i.test(b.title))?.click(); });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--lang=ar'] });

for (const site of SITES) {
  const host = new URL(site).host;
  // 1. Which build is the site serving?
  let build = {};
  try {
    const html = await (await fetch(site, { cache: 'no-store' })).text();
    const asset = html.match(/assets\/index-[\w-]+\.js/)?.[0];
    const js = asset ? await (await fetch(new URL(asset, site))).text() : '';
    build = { asset, bytes: js.length, toolLinks_PR42: js.includes('shaheen-tool-links'), latexFix_PR48: js.includes('list-[circle]') };
  } catch (e) { note('warning', `build ${host}`, String(e)); }

  const page = await browser.newPage();
  // INSPECT_MOBILE=1: a phone screen (most visitors), touch + small viewport.
  if (process.env.INSPECT_MOBILE) {
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  } else await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ar-EG,ar;q=0.9' });
  await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'language', { get: () => 'ar-EG' }); Object.defineProperty(navigator, 'languages', { get: () => ['ar-EG', 'ar'] }); });
  const apiCalls = [];
  page.on('response', (r) => { if (r.url().includes('/api/chat')) apiCalls.push(`${r.status()} ${r.url()}`); });
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(String(e).slice(0, 300)));
  try {
    await page.goto(site, { waitUntil: 'networkidle2', timeout: 60_000 });
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('sham_perfume_user_language', 'ar'); localStorage.setItem('sham_perfume_user_override_lang', 'ar'); });
    const target = SCENE.startsWith('lab') ? `${site.replace(/#.*$/, '')}#master_ai` : site;
    const enter = async () => {
      await page.goto(target, { waitUntil: 'networkidle2', timeout: 60_000 });
      await page.reload({ waitUntil: 'networkidle2' });
      if (!SCENE.startsWith('lab')) await openChat(page);
    };
    await page.goto(target, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => [...document.querySelectorAll('button[title]')].some((b) => /شاهين|Shahin|Perfumer/i.test(b.title)), { timeout: 30_000 })
      .catch(async () => note('warning', `buttons ${host}`, JSON.stringify(await page.$$eval('button', (bs) => bs.map((b) => b.title || b.textContent.trim().slice(0, 30)).slice(0, 80)))));
    if (!SCENE.startsWith('lab')) await openChat(page);
    await page.waitForSelector('form input[maxlength="4000"]', { timeout: 15_000 });
    await wait(1500);
    const modes = await page.$$eval('button[aria-pressed]', (bs) => bs.map((b) => b.textContent.trim()));
    note('notice', `${SCENE} ${host} build`, JSON.stringify({ ...build, modes, lang: await page.evaluate(() => document.documentElement.lang) }));
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
          // The message card: the widest ancestor that still holds only this one answer.
          let card = last;
          while (card?.parentElement && card.parentElement.querySelectorAll('div.font-sans[dir="auto"]').length <= 1) card = card.parentElement;
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
          // Back to Shaheen for the next question (the tool link navigated away / closed the chat).
          if (SCENE.startsWith('lab') || !(await page.$('form input[maxlength="4000"]'))) { await enter(); await page.waitForSelector('form input[maxlength="4000"]', { timeout: 15_000 }).catch(() => {}); await wait(1000); }
        }
        note(problems.length ? 'warning' : 'notice', `${SCENE} ${host} · ${modes[m]} · ${question.slice(0, 30)}`,
          `${JSON.stringify({ ms: Date.now() - started, links: seen.links, buttons: seen.buttons, api: apiCalls.slice(-1), jsErrors: jsErrors.splice(0) })}\nمشاكل: ${problems.join(' | ') || 'لا شيء'}\n----- الأداة بعد الضغط -----\n${opened}\n----- ما يراه الزائر -----\n${seen.text.slice(0, 3000)}\n----- HTML -----\n${seen.html}`);
        await wait(3000);
      }
    }
  } catch (e) {
    note('warning', `browser ${host}`, `${String(e).slice(0, 800)}\napi: ${apiCalls.join(' ; ')}`);
  }
  await page.close();
}
await browser.close();
