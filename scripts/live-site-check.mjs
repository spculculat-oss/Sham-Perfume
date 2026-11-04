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
const img = await get(`${SITE}/api/media?type=image&q=Rosa%20damascena%20flower`);
const imgData = json(img.text);
const imgOk = img.status === 200 && Array.isArray(imgData?.images) && imgData.images.length > 0 && imgData.images.every((i) => /^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(i.thumb));
report('Shaheen images', imgOk, `HTTP ${img.status} · ${imgData?.images?.length ?? 0} image(s)${imgData?.images?.[0] ? ` · e.g. «${imgData.images[0].title}» (${imgData.images[0].license})` : ''}`,
  imgOk ? undefined : img.status === 404 ? 'warning' : undefined);
const vid = await get(`${SITE}/api/media?type=video&q=perfume%20maceration&lang=ar`);
const vidData = json(vid.text);
const vidOk = vid.status === 200 && typeof vidData?.searchUrl === 'string';
report('Shaheen videos', vidOk && vidData.source === 'youtube',
  vid.status !== 200 ? `HTTP ${vid.status}` : vidData?.source === 'youtube' ? `${vidData.videos.length} embeddable video(s) · e.g. «${vidData.videos[0]?.title}»`
    : 'search link only — enable "YouTube Data API v3" in the Google Cloud project of the Gemini key, or add a YOUTUBE_API_KEY secret',
  vidOk && vidData.source === 'youtube' ? undefined : vid.status === 404 || vidOk ? 'warning' : undefined);
const place = await get(`${SITE}/api/media?type=place&q=Grasse%2C%20France`);
const placeData = json(place.text)?.places?.[0];
// Grasse is at about 43.66 N, 6.92 E.
const placeOk = place.status === 200 && placeData && Math.abs(placeData.lat - 43.66) < 0.3 && Math.abs(placeData.lon - 6.92) < 0.3;
report('Shaheen map places', Boolean(placeOk), `HTTP ${place.status}${placeData ? ` · Grasse → ${placeData.lat}, ${placeData.lon} (${placeData.label})` : ' · not located'}`,
  placeOk ? undefined : place.status === 400 || place.status === 404 ? 'warning' : undefined);

// Community deployment smoke: read-only, no fake members or production posts.
// The community is switched off on the live engine by the owner's decision (no database configured): that is a
// known state, not a failure. Then the member-only routes must still refuse an anonymous visitor — 503
// COMMUNITY_NOT_CONFIGURED is as safe as 401 (nothing is served). Only a broken database («error») or a route
// that answers without login fails.
const communityStatus = await get(`${SITE}/api/community/status`);
const communityInfo = json(communityStatus.text);
const communityReady = communityStatus.status === 200 && communityInfo?.enabled === true;
const communityOff = communityStatus.status === 200 && communityInfo?.enabled === false && communityInfo?.reason !== 'error';
report('Community database readiness', communityReady,
  communityOff ? `HTTP 200 · switched off on this server (no ${communityInfo?.reason || 'database'} configured) — by decision, member routes stay closed`
    : `HTTP ${communityStatus.status} · enabled=${communityInfo?.enabled === true}${communityInfo?.reason ? ` · reason=${communityInfo.reason}` : ''}`,
  communityReady ? undefined : communityOff ? 'warning' : undefined);
for (const [label, path, method] of [
  ['Saved feed requires login', '/api/community/feed?scope=saved', 'GET'],
  ['Save post requires login', '/api/community/posts/deployment-probe/saved', 'PUT'],
  ['Unsave post requires login', '/api/community/posts/deployment-probe/saved', 'DELETE'],
]) {
  const result = await get(`${SITE}${path}`, { method });
  const closed = communityOff && result.status === 503 && json(result.text)?.code === 'COMMUNITY_NOT_CONFIGURED';
  report(label, result.status === 401 || closed,
    closed ? 'HTTP 503 COMMUNITY_NOT_CONFIGURED · closed to anonymous visitors (the community is off on this server)' : `HTTP ${result.status} · expected 401 (no credentials sent)`);
}
const savePreflight = await get(`${SITE}/api/community/posts/deployment-probe/saved`, {
  method: 'OPTIONS', headers: { origin: PAGES_ORIGIN, 'access-control-request-method': 'PUT', 'access-control-request-headers': 'authorization,content-type' },
});
report('Saved posts CORS', savePreflight.status < 400 && savePreflight.headers.get('access-control-allow-origin') === PAGES_ORIGIN && /PUT/.test(savePreflight.headers.get('access-control-allow-methods') || ''), `HTTP ${savePreflight.status} · authenticated cross-origin PUT preflight`);

// 4) Second Vercel project: unused, it only redirects visitors to the main site.
const second = await get(`${SECOND}/`, { redirect: 'manual' });
const secondTarget = second.headers.get('location') || '';
const secondOk = second.status >= 300 && second.status < 400 && secondTarget.startsWith(SITE);
report('Second Vercel project', secondOk, secondOk ? `${SECOND} → ${secondTarget}` : `HTTP ${second.status} — ${SECOND} still serves its own copy (it rebuilds only when vercel.json changes)`, secondOk ? undefined : 'warning');

const out = ['## Live site check', '', '| Check | Result | Details |', '|---|---|---|', ...rows].join('\n');
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, out + '\n\n');
} else console.log(out);
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
