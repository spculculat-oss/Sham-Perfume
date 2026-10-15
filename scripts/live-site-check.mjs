#!/usr/bin/env node
/**
 * Live site check (companion to live-smoke.mjs): what a visitor's browser needs besides Shaheen's
 * answers — both front-ends load the current build, the GitHub Pages site may call the API
 * (CORS), core endpoints answer, the shipped visitor bundle names no AI vendor, and main still
 * carries the expected features (guards against an external tool overwriting it again).
 * Runs from GitHub Actions; results go to annotations (one per check) and the job summary.
 *
 *   SITE_URL=https://sham-perfume-49bf.vercel.app PAGES_URL=https://spculculat-oss.github.io/Sham-Perfume/ node scripts/live-site-check.mjs
 */
const SITE = (process.env.SITE_URL || 'https://sham-perfume-49bf.vercel.app').replace(/\/+$/, '');
const PAGES = (process.env.PAGES_URL || 'https://spculculat-oss.github.io/Sham-Perfume/').replace(/\/?$/, '/');
const SECOND = (process.env.SECOND_URL || 'https://sham-perfume.vercel.app').replace(/\/+$/, '');
const PAGES_ORIGIN = new URL(PAGES).origin;
const VENDORS = /\b(Gemini|DeepSeek|ChatGPT|GPT-\d|Claude|OpenAI|Anthropic|OpenRouter)\b/;

const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
const annotate = (level, title, message) => console.log(`::${level} title=${esc(title).replace(/[:,]/g, ' ')}::${esc(message)}`);
const get = async (url, init = {}) => {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30000) });
    return { status: res.status, headers: res.headers, text: await res.text() };
  } catch (error) {
    return { status: 0, headers: new Headers(), text: String(error?.message || error) };
  }
};
const json = (text) => { try { return JSON.parse(text); } catch { return undefined; } };

const rows = [];
let failures = 0;
function report(title, ok, message, level) {
  const lvl = level || (ok ? 'notice' : 'error');
  if (lvl === 'error') failures++;
  annotate(lvl, title, `${ok ? 'OK' : lvl === 'warning' ? 'WARN' : 'FAIL'} · ${message}`);
  rows.push(`| ${title} | ${ok ? '✅' : lvl === 'warning' ? '⚠️' : '❌'} | ${message.replace(/\|/g, '/').replace(/\n/g, ' ')} |`);
}

// 1) Both front-ends load, and their JS bundle carries no vendor names.
for (const [title, base] of [['GitHub Pages site', PAGES], ['Vercel site', `${SITE}/`]]) {
  const page = await get(base);
  const scripts = [...page.text.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => new URL(m[1], base).href);
  const bundles = await Promise.all(scripts.map((src) => get(src)));
  const code = bundles.map((b) => b.text).join('\n');
  const leak = code.match(VENDORS)?.[0];
  const pagesApi = title.startsWith('GitHub') ? (code.includes(SITE) ? ` · calls ${SITE}` : ' · API base NOT found in bundle') : '';
  const ok = page.status === 200 && scripts.length > 0 && bundles.every((b) => b.status === 200) && !leak && !pagesApi.includes('NOT');
  report(title, ok, `HTTP ${page.status} · ${scripts.length} bundle(s) ${Math.round(code.length / 1024)} KB${pagesApi}${leak ? ` · vendor name in visitor bundle: ${leak}` : ' · no vendor names'}`);
}

// 2) The Pages site (another origin) is allowed to call the API.
const preflight = await get(`${SITE}/api/chat`, { method: 'OPTIONS', headers: { origin: PAGES_ORIGIN, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } });
const allow = preflight.headers.get('access-control-allow-origin');
report('CORS for the Pages site', preflight.status < 400 && allow === PAGES_ORIGIN, `preflight HTTP ${preflight.status} · allow-origin=${allow || 'none'}`);

// 3) Core endpoints.
const health = await get(`${SITE}/api/health`);
report('API health', health.status === 200 && json(health.text)?.status === 'ok', `HTTP ${health.status} ${health.text.slice(0, 80)}`);
const models = json((await get(`${SITE}/api/models`)).text);
const ready = (models?.models || []).filter((m) => m.hasApiKey).map((m) => m.id);
report('Shaheen modes', Boolean(models) && ready.includes('auto') && !VENDORS.test(JSON.stringify(models)),
  `available: ${ready.join(', ') || 'none'}${models && !ready.includes('council') ? ' (council needs 2 working keys)' : ''}`);
const news = await get(`${SITE}/api/news`);
const newsData = json(news.text);
const articles = Array.isArray(newsData?.news) ? newsData.news : Array.isArray(newsData?.articles) ? newsData.articles : Array.isArray(newsData) ? newsData : [];
report('Perfume news feed', news.status === 200 && articles.length > 0, `HTTP ${news.status} · ${articles.length} article(s)`, news.status === 200 ? undefined : 'warning');
const config = json((await get(`${SITE}/api/assistant/config`)).text);
report('Sham assistant config', Boolean(config?.services?.length), `${config?.services?.length || 0} services · model-enhanced=${config?.modelEnhanced} · council seats=${config?.council?.seats ?? '?'}`);

// Shaheen's visual aids: real images from Wikimedia Commons, videos from YouTube (or a search link).
const img = await get(`${SITE}/api/media?type=image&q=agarwood`);
const imgData = json(img.text);
const imgOk = img.status === 200 && Array.isArray(imgData?.images) && imgData.images.length > 0 && imgData.images.every((i) => /^https:\/\/upload\.wikimedia\.org\//.test(i.thumb));
report('Shaheen images', imgOk, `HTTP ${img.status} · ${imgData?.images?.length ?? 0} image(s)${imgData?.images?.[0] ? ` · e.g. «${imgData.images[0].title}» (${imgData.images[0].license})` : ''}`,
  imgOk ? undefined : img.status === 404 ? 'warning' : undefined);
const vid = await get(`${SITE}/api/media?type=video&q=perfume%20maceration&lang=ar`);
const vidData = json(vid.text);
const vidOk = vid.status === 200 && typeof vidData?.searchUrl === 'string';
report('Shaheen videos', vidOk && vidData.source === 'youtube',
  vid.status !== 200 ? `HTTP ${vid.status}` : vidData?.source === 'youtube' ? `${vidData.videos.length} embeddable video(s) · e.g. «${vidData.videos[0]?.title}»`
    : 'search link only — enable "YouTube Data API v3" in the Google Cloud project of the Gemini key, or add a YOUTUBE_API_KEY secret',
  vidOk && vidData.source === 'youtube' ? undefined : vid.status === 404 || vidOk ? 'warning' : undefined);

// 4) Second Vercel project (informational: it only gets keys once VERCEL_TOKEN syncs them).
const second = json((await get(`${SECOND}/api/models`)).text);
const secondReady = (second?.models || []).some((m) => m.hasApiKey);
report('Second Vercel project', secondReady, secondReady ? `${SECOND} has working keys` : `${SECOND} has no AI keys — add the VERCEL_TOKEN secret (or the keys in its Vercel settings)`, secondReady ? undefined : 'warning');

const out = ['## Live site check', '', '| Check | Result | Details |', '|---|---|---|', ...rows].join('\n');
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, out + '\n\n');
} else console.log(out);
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
