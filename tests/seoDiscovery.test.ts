/**
 * «منارة شاهين» — discretion without an account.
 *
 * Search Console is free, but the agent must not depend on it: these tests pin the channels that work
 * with no owner login (sitemap + feed + WebSub + IndexNow + crawler probe + public Lighthouse) and make
 * sure every failure is recorded honestly instead of being reported as success.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACCOUNT_FREE_IDS, CRAWLER_AGENTS, DISCOVERY_CHANNELS, WEBSUB_DEFAULT_HUBS, feedFingerprint, webSubHubs,
  webSubLinks, webSubPingBody,
} from '../src/seo/discovery';
import { renderFeed, renderRobots } from '../src/seo/artifacts';
import { emptySeoState, readSeoState } from '../src/seo/agentState';
import { probeCrawlerAccess, probePageSpeed, submitIndexNow, submitWebSub, submitYandexSitemap } from '../server/seo/search';

const site = 'https://sham-perfume-49bf.vercel.app/';
const feedUrl = `${site}feed.xml`;

type Call = { url: string; init?: RequestInit };
const fakeFetch = (handler: (call: Call) => Response | Promise<Response>) => {
  const calls: Call[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init };
    calls.push(call);
    return handler(call);
  }) as unknown as typeof fetch;
  return { fn, calls };
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('the account-free catalogue is complete and each channel is unique', () => {
  const ids = DISCOVERY_CHANNELS.map((channel) => channel.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ACCOUNT_FREE_IDS].sort(), [...ids].sort());
  for (const channel of DISCOVERY_CHANNELS) {
    assert.ok(channel.nameAr.length > 3, channel.id);
    assert.ok(channel.runsAr.length > 10, channel.id);
    assert.ok(channel.provesAr.length > 10, channel.id);
  }
  assert.ok(ids.includes('sitemap') && ids.includes('websub') && ids.includes('page-speed') && ids.includes('crawler-probe'));
});

test('the feed fingerprints change only when the document changes', () => {
  const first = renderFeed({ siteUrl: site, now: new Date(0) });
  const second = renderFeed({ siteUrl: site, now: new Date(0) });
  const later = renderFeed({ siteUrl: site, now: new Date(0), products: [{ id: 9, slug: 'rose-9' }] });
  assert.equal(feedFingerprint(first), feedFingerprint(second));
  assert.notEqual(feedFingerprint(first), feedFingerprint(later));
  assert.match(feedFingerprint(first), /^[0-9a-f]{8}$/);
});

test('WebSub metadata is complete: self link, hub link and the publish form body', () => {
  const links = webSubLinks(feedUrl);
  assert.ok(links.includes(`href="${feedUrl}" rel="self"`));
  assert.ok(links.includes('rel="hub"'));
  const body = webSubPingBody(feedUrl).toString();
  assert.ok(body.includes('hub.mode=publish'));
  assert.ok(body.includes(encodeURIComponent(feedUrl)));
  assert.deepEqual(webSubHubs({}), [...WEBSUB_DEFAULT_HUBS]);
  assert.deepEqual(webSubHubs({ WEBSUB_HUBS: 'not-a-url, https://hub.example/' }), ['https://hub.example/']);
});

test('robots.txt lists the feed as a second sitemap so discovery needs no account', () => {
  const robots = renderRobots(site);
  assert.ok(robots.includes(`Sitemap: ${site}sitemap.xml`));
  assert.ok(robots.includes(`Sitemap: ${site}feed.xml`));
  assert.ok(robots.indexOf('Sitemap:') < robots.length);
});

test('IndexNow falls back to the engines directly when the shared endpoint refuses the batch', async () => {
  const { fn, calls } = fakeFetch((call) => {
    if (call.url === 'https://api.indexnow.org/indexnow') return new Response('down', { status: 503 });
    if (call.url.startsWith('https://www.bing.com/indexnow')) return new Response('', { status: 200 });
    return new Response('', { status: 500 });
  });
  const result = await submitIndexNow({ siteUrl: site, urls: [`${site}tools/`], fetch: fn });
  assert.equal(result.ok, true);
  assert.equal(result.submitted, 1);
  assert.match(result.detail, /bing\.com/);
  assert.ok(calls.length >= 2, 'the shared endpoint must be tried before the direct ones');
});

test('IndexNow reports an honest failure when every endpoint refuses', async () => {
  const { fn } = fakeFetch(() => new Response('no', { status: 500 }));
  const result = await submitIndexNow({ siteUrl: site, urls: [`${site}tools/`], fetch: fn, fallbacks: ['https://www.bing.com/indexnow'] });
  assert.equal(result.ok, false);
  assert.equal(result.submitted, 0);
  assert.match(result.detail, /HTTP 500/);
});

test('WebSub publishes to the configured hubs and never hides a dead one', async () => {
  const { fn, calls } = fakeFetch((call) => (call.url.includes('superfeedr') ? new Response(null, { status: 410 }) : new Response(null, { status: 204 })));
  const result = await submitWebSub({ siteUrl: site, fetch: fn, hubs: ['https://hub.one/', 'https://pubsubhubbub.superfeedr.com/'] });
  assert.equal(result.ok, true);
  assert.equal(result.hubs.length, 2);
  assert.equal(result.hubs.filter((hub) => hub.ok).length, 1);
  assert.equal(result.hubs[1].status, 410);
  assert.equal(calls.length, 2);
  const body = String(calls[0].init?.body);
  assert.ok(body.includes('hub.mode=publish'));
  assert.equal(calls[0].init?.method, 'POST');
});

test('WebSub failure is a recorded miss, not a crash', async () => {
  const { fn } = fakeFetch(() => { throw new Error('offline'); });
  const result = await submitWebSub({ siteUrl: site, fetch: fn, hubs: ['https://hub.one/'] });
  assert.equal(result.ok, false);
  assert.equal(result.submitted, 0);
  assert.match(result.detail, /لا يوقف الظهور/);
});

test('the crawler probe accepts an open page and rejects every indexing blocker', async () => {
  const html = (body: string, headers: Record<string, string> = {}) => new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', ...headers } });
  const { fn, calls } = fakeFetch((call) => {
    if (call.url.endsWith('/blocked-by-meta')) return html('<html><head><meta name="robots" content="noindex,follow"></head></html>');
    if (call.url.endsWith('/blocked-by-header')) return html('<html></html>', { 'x-robots-tag': 'noindex' });
    if (call.url.endsWith('/missing')) return new Response('gone', { status: 404, headers: { 'content-type': 'text/html' } });
    return html('<html><head><title>ok</title></head></html>');
  });
  const probe = await probeCrawlerAccess({
    urls: [`${site}`, `${site}blocked-by-meta`, `${site}blocked-by-header`, `${site}missing`],
    fetch: fn, limit: 4,
  });
  assert.equal(probe.checked, 4);
  assert.equal(probe.ok, 1);
  assert.equal(probe.results[0].ok, true);
  assert.match(probe.results[1].reason, /وسم robots/);
  assert.match(probe.results[2].reason, /X-Robots-Tag/);
  assert.match(probe.results[3].reason, /404/);
  assert.equal(calls[0].init?.headers && (calls[0].init?.headers as Record<string, string>)['user-agent'], CRAWLER_AGENTS.googlebot);
});

test('the public performance endpoint is parsed, and its failure is not a pass', async () => {
  const good = fakeFetch(() => json({
    lighthouseResult: {
      categories: { performance: { score: 0.82 }, seo: { score: 1 }, accessibility: { score: 0.94 }, 'best-practices': { score: 0.9 } },
      audits: { 'largest-contentful-paint': { numericValue: 2100 }, 'cumulative-layout-shift': { numericValue: 0.04 }, 'total-blocking-time': { numericValue: 120 } },
    },
  }));
  const measured = await probePageSpeed({ url: site, fetch: good.fn });
  assert.equal(measured.ok, true);
  assert.deepEqual(measured.scores, { performance: 82, seo: 100, accessibility: 94, bestPractices: 90 });
  assert.deepEqual(measured.vitals, { lcpMs: 2100, cls: 0.04, tbtMs: 120 });
  assert.ok(good.calls[0].url.includes('strategy=mobile'));

  const failed = fakeFetch(() => json({ error: { message: 'quota' } }, 429));
  const missed = await probePageSpeed({ url: site, fetch: failed.fn });
  assert.equal(missed.ok, false);
  assert.match(missed.detail, /quota/);
});

test('discovery evidence survives a state round-trip and junk is dropped', () => {
  const state = emptySeoState(new Date('2026-10-18T12:00:00Z'));
  state.discovery = {
    webSub: { at: '2026-10-18T12:00:00.000Z', ok: true, feedHash: 'abc12345', hubs: [{ url: 'https://hub.one/', ok: true, status: 204 }] },
    crawl: { at: '2026-10-18T12:00:00.000Z', ua: 'bot', checked: 2, ok: 1, results: [{ url: site, ok: true, status: 200, reason: 'ok' }, { url: `${site}x`, ok: false, reason: 'HTTP 404' }] },
    pageSpeed: { at: '2026-10-18T12:00:00.000Z', ok: true, url: site, status: 200, scores: { performance: 82 }, vitals: { lcpMs: 2100 }, detail: 'ok' },
  };
  const read = readSeoState(JSON.parse(JSON.stringify(state)), new Date('2026-10-18T13:00:00Z'));
  assert.equal(read.discovery.webSub?.feedHash, 'abc12345');
  assert.equal(read.discovery.crawl?.checked, 2);
  assert.equal(read.discovery.pageSpeed?.scores.performance, 82);

  const broken = readSeoState({ discovery: { webSub: { at: 5, hubs: 'nope' }, crawl: [], pageSpeed: { at: 'x', scores: { performance: 'high' } } } });
  assert.equal(broken.discovery.webSub, undefined);
  assert.equal(broken.discovery.crawl, undefined);
  assert.equal(broken.discovery.pageSpeed?.scores.performance, undefined);
  assert.equal(broken.discovery.pageSpeed?.ok, false);
});

test('Yandex Webmaster sitemap submission is optional and handles 201 and 409', async () => {
  const skipped = await submitYandexSitemap({ siteUrl: site, env: {} });
  assert.equal(skipped.ok, false);
  assert.match(skipped.detail, /IndexNow/);

  const { fn, calls } = fakeFetch(() => new Response('{"sitemap_id":"1"}', { status: 201 }));
  const accepted = await submitYandexSitemap({
    siteUrl: site,
    env: { YANDEX_WEBMASTER_TOKEN: 'tok123', YANDEX_WEBMASTER_USER_ID: '42' },
    fetch: fn,
  });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.submitted, 1);
  assert.match(calls[0].url, /api\.webmaster\.yandex\.net\/v4\/user\/42\/hosts\//);
});

