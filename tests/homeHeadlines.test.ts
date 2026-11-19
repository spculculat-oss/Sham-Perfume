import assert from 'node:assert/strict';
import test from 'node:test';
import { createHomeHeadlines, headlineEntry, parseHomeHeadlineFeed } from '../server/homeHeadlines';
import { localHeadlineEdition, WORLD_HEADLINE_EDITION } from '../src/data/homeHeadlineEditions';
import { HEADLINE_REFRESH_MS, HEADLINE_RETRY_MS, headlineDay, headlineLink, nextHeadlineDay, readHeadlines } from '../src/utils/homeHeadlines';

const now = Date.parse('2026-11-19T00:35:00Z');
const stamp = new Date(now).toISOString();
const cairo = { country: 'EG', timeZone: 'Africa/Cairo' };
const paris = { country: 'FR', timeZone: 'Europe/Paris' };
const [egypt] = localHeadlineEdition('EG')!.feeds;
const [france, franceBusiness, gouvernement] = localHeadlineEdition('FR')!.feeds;
const [uk] = localHeadlineEdition('GB')!.feeds;
const [world] = WORLD_HEADLINE_EDITION.feeds;
const article = (n: number) => `https://www.youm7.com/story/2026/11/19/title/${n}`;
const frenchArticle = (n: number) => `https://www.service-public.gouv.fr/particuliers/actualites/A${n}`;
const arabicDate = 'الخميس، ١٩ نوفمبر ٢٠٢٦ ٠٢:٢٣ ص';
const story = (id: number, date = arabicDate, url = article(id), title = `خبر ${id}`) => `<item><title><![CDATA[${title}]]></title><link><![CDATA[${url}]]></link><pubDate>${date}</pubDate><description><![CDATA[<b>Do not publish</b> <img src="https://img.youm7.com/photo.jpg">]]></description></item>`;
const frStory = (id: number, date = '2026-11-19T00:00:00+01:00', title = `Actualité française ${id}`) => `<item><title>${title}</title><link>${frenchArticle(id)}?xtor=RSS-111</link><dc:date>${date}</dc:date></item>`;
const infoStory = (title: string, date = 'Thu, 19 Nov 2026 00:12:00 +0100') => `<item><title>${title}</title><link>https://www.info.gouv.fr/actualite/exemple</link><pubDate>${date}</pubDate></item>`;
const rss = (...items: string[]) => `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>News</title>${items.join('')}</channel></rss>`;
const body = (...items: string[]) => new Response(rss(...items), { headers: { 'Content-Type': 'application/rss+xml' } });

const urls = (items: { url: string }[]) => items.map((item) => item.url);

test('edition selection follows the entry edge, not language, checkout country or unconfirmed metadata', () => {
  assert.deepEqual(headlineEntry({ 'x-vercel-ip-country': 'FR', 'accept-language': 'ar-EG', 'x-eo-geo-country': 'EG' }), paris);
  assert.deepEqual(headlineEntry({ 'x-eo-geo-country': 'eg', 'x-eo-geo-timezone': 'Bad/Zone' }), cairo);
  assert.deepEqual(headlineEntry({ 'x-vercel-ip-country': 'XX', 'x-vercel-ip-timezone': 'Europe/Paris' }), paris);
  assert.deepEqual(headlineEntry({ 'cf-ipcountry': 'BW', 'x-vercel-ip-timezone': 'Africa/Gaborone' }), { country: 'BW', timeZone: 'Africa/Gaborone' });
  assert.deepEqual(headlineEntry({ 'accept-language': 'ar-EG' }), { country: null, timeZone: 'UTC' });
  assert.deepEqual(headlineEntry({ 'x-vercel-ip-country': ['https://malicious.test'] }), { country: null, timeZone: 'UTC' });
});

test('RSS and Atom extract genuine dates, original titles and safe direct links only', () => {
  const xml = rss(story(1, arabicDate, article(1), 'خبر &amp; <b>داخل</b> &#xFFFFFF;'),
    story(2, '2026-11-19T00:01:00'), story(3, arabicDate, 'https://www.youm7.com.example.org/5'),
    story(4, arabicDate, 'https://www.youm7.com:8443/4'), story(5, arabicDate, 'https://www.youm7.com@127.0.0.1/5'),
    story(6, '19 نوفمبر 2026 13:23 ص'), story(7, '31 فبراير 2026 12:02 ص'));
  assert.deepEqual(parseHomeHeadlineFeed(xml, egypt), [{ title: 'خبر & داخل', datedAt: '2026-11-19T00:23:00.000Z', dateKind: 'published', url: article(1), publisher: 'youm7' }]);
  assert.throws(() => parseHomeHeadlineFeed('<!DOCTYPE rss>' + rss(), egypt));
  assert.throws(() => parseHomeHeadlineFeed('<rss><channel>', egypt));
  assert.throws(() => parseHomeHeadlineFeed('<html><feed></feed></html>', egypt));
  assert.throws(() => parseHomeHeadlineFeed('<rss></rss>', egypt));
  assert.deepEqual(parseHomeHeadlineFeed(rss(), egypt), []);
  assert.deepEqual(parseHomeHeadlineFeed(rss(frStory(10)), france), [{
    title: 'Actualité française 10', url: frenchArticle(10), publisher: 'service-public', datedAt: '2026-11-18T23:00:00.000Z', dateKind: 'date',
  }]);
  assert.deepEqual(parseHomeHeadlineFeed(`<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Domestic update</title>
    <link rel="self" href="https://www.gov.uk/metadata"/><link rel="alternate" href="/government/news/update"/>
    <updated>2026-11-19T00:00:00+00:00</updated><summary><![CDATA[<link>bogus</link>]]></summary></entry></feed>`, uk), [{
    title: 'Domestic update', url: 'https://www.gov.uk/government/news/update', datedAt: '2026-11-19T00:00:00.000Z', dateKind: 'updated', publisher: 'gov-uk',
  }]);
  assert.equal(headlineLink('javascript:alert(1)', 'youm7'), null);
  assert.equal(headlineLink('https://www.gov.uk/redirect?to=example', 'gov-uk'), null);
});

test('concurrent country editions use only their configured feeds and return every distinct headline from today', async () => {
  const calls: string[] = [];
  const load = createHomeHeadlines(async (input, init) => {
    const url = String(input);
    calls.push(url);
    assert.ok(init?.signal);
    assert.equal(init?.redirect, 'error');
    if (url === egypt.url) return body(...Array.from({ length: 14 }, (_, i) => story(i + 1)),
      story(1, arabicDate, 'http://youm7.com/1?tracking=0'), story(100, '2026-11-18T21:59:00Z'), story(101, '2026-11-19T00:36:00Z'));
    if (url === france.url) return body(frStory(11), frStory(12), frStory(13, '2026-11-18T23:59:00+01:00'));
    if (url === franceBusiness.url) return body(frStory(11), frStory(14, undefined, 'Actualité française 12 !'), frStory(15));
    if (url === gouvernement.url) return body(infoStory('Un autre titre du jour'));
    if (url === world.url) return body(story(500), story(501, '2026-11-18T22:20:00Z'));
    throw new Error('Unexpected upstream URL');
  }, () => now);
  const [eg, fr, egAgain, other, unknown] = await Promise.all([
    load(cairo), load(paris), load(cairo), load({ country: 'JP', timeZone: 'Asia/Tokyo' }), load({ country: null, timeZone: 'UTC' }),
  ]);
  assert.deepEqual(eg, egAgain);
  assert.equal(calls.length, 5, 'shared world, no duplicate requests or article page fetches');
  assert.equal(eg.local.status, 'fresh');
  assert.equal(eg.country, 'EG');
  assert.deepEqual(urls(eg.local.items), Array.from({ length: 14 }, (_, i) => article(i + 1)));
  assert.equal(fr.country, 'FR');
  assert.deepEqual(urls(fr.local.items), ['https://www.info.gouv.fr/actualite/exemple', frenchArticle(11), frenchArticle(12), frenchArticle(15)]);
  assert.deepEqual(urls(fr.world.items), [article(500)], 'world still uses visitor’s date, not the Egypt filter');
  assert.deepEqual(urls(eg.world.items), [article(500), article(501)]);
  for (const unequipped of [other, unknown]) {
    assert.equal(unequipped.local.status, 'unsupported');
    assert.equal(unequipped.local.items.length, 0);
    assert.ok(unequipped.world.items.length);
  }
  assert.deepEqual(readHeadlines(eg), eg, 'browser keeps all entries, not only a fixed handful');
});

test('source failures stay independent; valid empty is not an outage or an old article', async () => {
  let time = now;
  let fail = false;
  let empty = false;
  let firstCalls = 0;
  const load = createHomeHeadlines(async (url) => {
    if (url === france.url) { firstCalls++; return fail ? new Response('<html>busy</html>') : body(frStory(1)); }
    if (url === franceBusiness.url) return empty ? body() : fail ? new Response('Not available', { status: 503 }) : body(frStory(2));
    if (url === gouvernement.url) return fail ? new Response('x'.repeat(1024 * 1024 + 1)) : body(infoStory('Confirmé'));
    if (url === world.url) return body(story(101));
    throw new Error('Not configured');
  }, () => time);
  assert.equal((await load(paris)).local.items.length, 3);
  time += HEADLINE_REFRESH_MS;
  fail = true;
  const stale = await load(paris);
  assert.equal(stale.local.status, 'stale');
  assert.equal(stale.local.checkedAt, stamp);
  assert.equal(stale.local.items.length, 3);
  assert.equal(stale.world.status, 'fresh');
  await load(paris);
  assert.equal(firstCalls, 2, 'publisher errors back off');
  time += HEADLINE_RETRY_MS;
  empty = true;
  const partial = await load(paris);
  assert.equal(partial.local.status, 'partial');
  assert.ok(!partial.local.items.some((item) => item.url === frenchArticle(2)), 'a successful empty feed replaces its previous snapshot');
  time = Date.parse('2026-11-19T23:00:01Z');
  const tomorrow = await load(paris);
  assert.equal(tomorrow.day, '2026-11-20');
  assert.equal(tomorrow.local.status, 'unavailable');
  assert.deepEqual(tomorrow.local.items, []);
  assert.equal(tomorrow.world.status, 'empty');
  const before = firstCalls;
  assert.equal((await load(paris, false)).world.status, 'unavailable');
  assert.equal(firstCalls, before, 'off switches do not read providers');
});

test('midnight filters a still-warm snapshot, and the next day starts on the zone’s real midnight', async () => {
  let time = Date.parse('2026-11-18T21:59:59Z');
  const load = createHomeHeadlines(async () => body(story(1, '2026-11-18T21:58:00Z')), () => time);
  const yesterday = await load(cairo);
  assert.equal(yesterday.day, '2026-11-18');
  assert.equal(yesterday.local.items.length, 1);
  const midnight = Date.parse('2026-11-18T22:00:00Z');
  assert.equal(nextHeadlineDay(time, 'Africa/Cairo'), midnight);
  time = midnight;
  const today = await load(cairo);
  assert.equal(today.day, '2026-11-19');
  assert.equal(today.local.status, 'empty');
  assert.deepEqual(today.local.items, []);
  assert.equal(headlineDay(midnight, 'Europe/Paris'), '2026-11-18');
  assert.equal(nextHeadlineDay(Date.parse('2026-03-28T23:00:00Z'), 'Europe/Paris'), Date.parse('2026-03-29T22:00:00Z'));
});

test('client schema rejects a foreign publisher, yesterday, tampered URLs and missing dates', () => {
  const invalid = { title: 'Unsafe', url: 'https://example.org/story', publisher: 'service-public', dateKind: 'published', datedAt: stamp };
  const valid = { ...invalid, title: 'Report', url: frenchArticle(10) };
  const response = {
    ...paris, day: '2026-11-19', asOf: now,
    local: { status: 'fresh', checkedAt: stamp, items: [valid, invalid, { ...valid, url: frenchArticle(11), title: 'Old', datedAt: '2026-11-18T22:12:00.000Z' },
      { ...valid, url: article(1), publisher: 'youm7' }, { ...valid, url: frenchArticle(12), title: 'Undated', datedAt: null }] },
    world: { status: 'fresh', checkedAt: stamp, items: [valid] },
  };
  assert.deepEqual(readHeadlines(response).local.items, [valid]);
  assert.equal(readHeadlines(response).world.status, 'unavailable');
  assert.equal(readHeadlines({ ...response, country: 'BW' }).local.status, 'unsupported');
  assert.throws(() => readHeadlines({ ...response, country: 'not-a-country' }));
  assert.throws(() => readHeadlines({ ...response, day: '2026-11-18' }));
  assert.throws(() => readHeadlines({ ...response, timeZone: 'Bad/Zone' }));
});
