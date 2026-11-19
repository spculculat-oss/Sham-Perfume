import assert from 'node:assert/strict';
import test from 'node:test';
import { createHomeHeadlines, parseHeadlinePreview, parseHomeHeadlineRss } from '../server/homeHeadlines';
import { HEADLINE_KEEP_MS, HEADLINE_REFRESH_MS, HEADLINE_SOURCE, headlineImage, readHeadlines } from '../src/utils/homeHeadlines';

const start = Date.parse('2026-11-19T00:35:00Z');
const photo = 'https://img.youm7.com/xlarge/example.jpg';
const article = (n: number) => `https://www.youm7.com/story/2026/11/19/title/${n}`;
const date = 'الخميس، 19 نوفمبر 2026 02:23 ص';
const story = (id: number, at = date, extra = '', url = article(id)) => `<item><title><![CDATA[خبر &amp; <b>صورة</b> &#xFFFFFF; ${id}]]></title><link><![CDATA[${url}]]></link><pubDate>${at}</pubDate>${extra}</item>`;
const feed = (...items: string[]) => `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>تقارير مصرية</title>${items.join('')}</channel></rss>`;
const rss = (...items: string[]) => new Response(feed(...items), { headers: { 'Content-Type': 'application/rss+xml' } });
const camera = `<meta content='${photo}?ver=1&amp;x=2' property="og:image">`;

test('RSS extracts dated, deduplicated publisher items without republishing HTML', () => {
  const xml = feed(
    story(101, '2026-11-18T22:53:00Z', `<description><![CDATA[<img src="${photo}"> المصدر:اليوم السابع]]></description>`),
    story(100, date, `<media:thumbnail width="500" url='${photo}' />`),
    story(100, date, '', 'http://youm7.com/100?tracking=1'),
    story(103, '2026-11-19T00:01:00Z', `<enclosure type="image/jpeg" url="${photo}"/>`),
    story(104, '2026-11-01T00:00:00Z'),
    story(105, date, '', 'https://www.youm7.com.other.example/105'),
    story(106, date, '', 'https://www.youm7.com:8080/106'),
    story(107, date, '', 'http://www.youm7.com@127.0.0.1/107'),
  );
  const result = parseHomeHeadlineRss(xml, start);
  assert.deepEqual(result.map((r) => [r.url, r.publishedAt, r.imageUrl]), [
    [article(100), '2026-11-19T00:23:00.000Z', photo],
    [article(103), '2026-11-19T00:01:00.000Z', photo],
    [article(101), '2026-11-18T22:53:00.000Z', photo],
  ]);
  assert.equal(result[0].title, 'خبر & صورة 100');
  assert.deepEqual(parseHomeHeadlineRss('<!DOCTYPE rss>' + xml, start), []);
});

test('preview URLs must be same publisher, with no executable schemes or accidental body images', () => {
  assert.equal(parseHeadlinePreview(`<head><meta property="og:image" content="javascript:alert(1)">${camera}</head>`), `${photo}?ver=1&x=2`);
  assert.equal(parseHeadlinePreview(`<head></head><body>${camera}</body>`), null);
  assert.equal(headlineImage('//img.youm7.com/small/a.png'), 'https://img.youm7.com/small/a.png');
  assert.equal(headlineImage('https://img.youm7.com/logo.svg'), null);
  assert.equal(headlineImage('https://tracker.invalid/a.jpg'), null);
  const valid = readHeadlines({ egypt: { status: 'fresh', checkedAt: new Date(start).toISOString(), items: [{ title: 'safe', url: article(1), imageUrl: 'https://example.com/not-sourced.jpg' }, { title: 'bad', url: 'https://example.com' }] }, world: [] });
  assert.equal(valid.egypt.items.length, 1);
  assert.equal(valid.egypt.items[0].imageUrl, null);
  assert.equal(valid.world.status, 'unavailable');
});

test('concurrent readers share the requests; photos are cached and one failed category does not clear the other', async () => {
  let now = start;
  let failWorld = false;
  const calls: string[] = [];
  const load = createHomeHeadlines(async (input, options) => {
    const url = String(input);
    calls.push(url);
    assert.equal(options?.redirect, 'error');
    assert.ok(options?.signal);
    if (url === HEADLINE_SOURCE.sections.egypt.feed) return rss(story(1));
    if (url === HEADLINE_SOURCE.sections.world.feed) return failWorld ? new Response('No access', { status: 503 }) : rss(story(2, date, `<media:thumbnail url="${photo}"/>`));
    assert.equal(url, article(1));
    return new Response(`<head>${camera}</head><body>Ignored</body>`);
  }, () => now);
  const [a, b, c] = await Promise.all([load(), load(), load()]);
  assert.deepEqual(a, b);
  assert.deepEqual(b, c);
  assert.equal(calls.length, 3);
  assert.equal(a.egypt.items[0].imageUrl, `${photo}?ver=1&x=2`);
  assert.equal(a.world.items[0].imageUrl, photo);
  await load();
  assert.equal(calls.length, 3, 'warm reads do not hit publishers');
  failWorld = true;
  now += HEADLINE_REFRESH_MS;
  const partial = await load();
  assert.equal(calls.length, 5, 'feeds refresh but the same article image is reused');
  assert.equal(partial.egypt.status, 'fresh');
  assert.equal(partial.world.status, 'stale');
  assert.equal(partial.world.checkedAt, a.world.checkedAt);
  await load();
  assert.equal(calls.length, 5, 'upstream errors have a retry delay');
  now += HEADLINE_KEEP_MS;
  assert.equal((await load()).world.status, 'unavailable');
});

test('oversized feeds and upstream failure are safe; an image error leaves a working headline', async () => {
  const load = createHomeHeadlines(async (input) => {
    if (input === HEADLINE_SOURCE.sections.egypt.feed) return new Response('x'.repeat(404 * 1024));
    if (input === HEADLINE_SOURCE.sections.world.feed) return rss(story(1));
    throw new Error('Image metadata not available');
  }, () => start);
  const result = await load();
  assert.equal(result.egypt.status, 'unavailable');
  assert.equal(result.world.items[0].url, article(1));
  assert.equal(result.world.items[0].imageUrl, null);
});
