import assert from 'node:assert/strict';
import test from 'node:test';
import { createHomeHeadlines, headlineEntry, parseHomeHeadlineFeed } from '../server/homeHeadlines';
import { readCommonsHeadlinePhotos } from '../server/homeHeadlineMedia';
import { localHeadlineEdition, WORLD_HEADLINE_EDITION } from '../src/data/homeHeadlineEditions';
import { readHeadlinePhoto } from '../src/utils/headlinePhoto';
import { HEADLINE_REFRESH_MS, HEADLINE_RETRY_MS, headlineDay, headlineLink, nextHeadlineDay, readHeadlines, headlineRotation } from '../src/utils/homeHeadlines';

const now = Date.parse('2026-11-19T00:35:00Z');
const stamp = new Date(now).toISOString();
const cairo = { country: 'EG', timeZone: 'Africa/Cairo' };
const paris = { country: 'FR', timeZone: 'Europe/Paris' };
const egyptFeeds = localHeadlineEdition('EG')!.feeds;
const [egypt, egyptVoices, egyptToday] = egyptFeeds;
const [france, franceBusiness, gouvernement] = localHeadlineEdition('FR')!.feeds;
const [uk] = localHeadlineEdition('GB')!.feeds;
const [world, unitedNations, globalVoices, mongabay, europeanParliament, arabsToday] = WORLD_HEADLINE_EDITION.feeds;
const article = (n: number) => `https://www.youm7.com/story/2026/11/19/title/${n}`;
const frenchArticle = (n: number) => `https://www.service-public.gouv.fr/particuliers/actualites/A${n}`;
const arabicDate = 'الخميس، ١٩ نوفمبر ٢٠٢٦ ٠٢:٢٣ ص';
const story = (id: number, date = arabicDate, url = article(id), title = `خبر ${id}`) => `<item><title><![CDATA[${title}]]></title><link><![CDATA[${url}]]></link><pubDate>${date}</pubDate><description><![CDATA[<b>Do not publish</b> <img src="https://img.youm7.com/photo.jpg">]]></description></item>`;
const frStory = (id: number, date = '2026-11-19T00:00:00+01:00', title = `Actualité française ${id}`) => `<item><title>${title}</title><link>${frenchArticle(id)}?xtor=RSS-111</link><dc:date>${date}</dc:date></item>`;
const infoStory = (title: string, date = 'Thu, 19 Nov 2026 00:12:00 +0100') => `<item><title>${title}</title><link>https://www.info.gouv.fr/actualite/exemple</link><pubDate>${date}</pubDate></item>`;
const rss = (...items: string[]) => `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>News</title>${items.join('')}</channel></rss>`;
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
    if ([...egyptFeeds, ...WORLD_HEADLINE_EDITION.feeds].some((feed) => feed.url === url)) return body();
    throw new Error('Unexpected upstream URL');
  }, () => now);
  const [eg, fr, egAgain, other, unknown] = await Promise.all([
    load(cairo), load(paris), load(cairo), load({ country: 'JP', timeZone: 'Asia/Tokyo' }), load({ country: null, timeZone: 'UTC' }),
  ]);
  assert.deepEqual(eg, egAgain);
  assert.deepEqual(calls.sort(), [...egyptFeeds, france, franceBusiness, gouvernement, ...WORLD_HEADLINE_EDITION.feeds].map(({ url }) => url).sort(), 'world requests are coalesced across countries');
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
    if ([...egyptFeeds, ...WORLD_HEADLINE_EDITION.feeds].some((feed) => feed.url === url)) return body();
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

const commons = 'https://commons.wikimedia.org/wiki/File:Fixture.jpg';
const photoUrl = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/aa/Fixture.jpg/640px-Fixture.jpg';
const imageLicense = 'https://creativecommons.org/licenses/by-sa/4.0/';
const gvLink = 'https://globalvoices.org/2026/11/19/world-perspective';
const imageCaption = `<div class="wp-caption aligncenter"><img alt="River at dawn" src="https://globalvoices.org/wp-content/uploads/2026/11/example.jpg" />
  <p class="wp-caption-text"><a href="${commons}">Photo</a> by A &amp; B. <a href="${imageLicense}deed.en">CC BY-SA 4.0</a>.</p></div>`;
const newsItem = (title: string, url: string, extra = '', date = 'Thu, 19 Nov 2026 00:10:00 GMT') =>
  `<item><title>${title}</title><link>${url}</link><pubDate>${date}</pubDate>${extra}</item>`;
const gvStory = (html: string, author = 'Newsroom Writer', link = gvLink, title = 'World perspective') => newsItem(title, link,
  `<dc:creator><![CDATA[${author}]]></dc:creator><content:encoded><![CDATA[${html}]]></content:encoded>`);
const commonsMetadata = (changes: Record<string, unknown> = {}, license = imageLicense) => ({ query: { pages: [{
  ns: 6, imagerepository: 'local', imageinfo: [{ type: 'bitmap', mime: 'image/jpeg', descriptionurl: commons, thumburl: `${photoUrl}?utm_source=fixture`,
    extmetadata: { LicenseUrl: { value: license }, Artist: { value: '<a href="/wiki/User:Artist">A &amp; B</a>' }, Restrictions: { value: '' } }, ...changes }],
}] } });

// The global feeds use different date/link/byline formats, but no body is published.
test('world publishers preserve their own links, dates and required bylines', () => {
  const unRss = rss(newsItem('خبر الأمم المتحدة', 'https://news.un.org/feed/view/ar/story/2026/11/1123456'));
  assert.deepEqual(parseHomeHeadlineFeed(unRss, unitedNations).map(({ publisher, url }) => ({ publisher, url })), [
    { publisher: 'un-news', url: 'https://news.un.org/ar/story/2026/11/1123456' },
  ]);
  const environment = 'https://news.mongabay.com/short-article/2026/11/fresh-water/';
  assert.equal(parseHomeHeadlineFeed(rss(newsItem('Fresh water', environment, '<dc:creator>Editor</dc:creator>', '19 Nov 2026 00:10:00 +0000')), mongabay)[0].author, 'Editor');
  assert.deepEqual(parseHomeHeadlineFeed(rss(newsItem('Fresh water', environment)), mongabay), [], 'does not strip a required byline');
  const pressRoom = 'https://www.europarl.europa.eu/news/en/press-room/20261118IPR48949/';
  assert.equal(parseHomeHeadlineFeed(rss(newsItem('Official release', pressRoom)), europeanParliament)[0].author, '© European Union, 2026 – EP');
  assert.throws(() => parseHomeHeadlineFeed('<!DOCTYPE rss>' + rss(), globalVoices));
  assert.equal(parseHomeHeadlineFeed(rss(gvStory(imageCaption)), globalVoices)[0].photoCandidate?.title, 'File:Fixture.jpg');
  for (const unlicensed of [`<img src="${photoUrl}" />`, imageCaption.replace('by-sa/4.0', 'by-nc/4.0'), imageCaption.replace(commons, 'https://commons.wikimedia.org.example.org/wiki/File:Fixture.jpg')]) {
    const [title] = parseHomeHeadlineFeed(rss(gvStory(unlicensed)), globalVoices);
    assert.equal(title.photoCandidate, undefined);
  }
});

test('the Guria caption in Global Voices and its Commons imageinfo use the same file and license', () => {
  const source = 'https://commons.wikimedia.org/wiki/File:Guria,_Region_in_Georgia.jpg';
  const encoded = 'Guria%2C_Region_in_Georgia.jpg';
  const thumb = `https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a6/${encoded}/960px-${encoded}`;
  const html = `<div class="wp-caption aligncenter"><img alt="Resort in the Guria region of Georgia." src="https://globalvoices.org/wp-content/uploads/2026/11/960px-Resort-in-Guria-Region_in_Georgia.jpg" />
    <div class="wp-caption-text">Resort in the Guria region of Georgia. <a href="${source}">Photo</a> by Tinari.totoro on
    <a href="https://commons.wikimedia.org/wiki/Main_Page">Wikimedia Commons</a> (<a href="${imageLicense}deed.en">CC BY-SA 4.0</a>).</div></div>`;
  const [entry] = parseHomeHeadlineFeed(rss(gvStory(html, 'Daria Dergacheva')), globalVoices);
  assert.deepEqual(entry.photoCandidate, { title: 'File:Guria, Region in Georgia.jpg', license: 'by-sa/4.0', alt: 'Resort in the Guria region of Georgia.' });
  const photos = readCommonsHeadlinePhotos(commonsMetadata({ descriptionurl: source, thumburl: `${thumb}?utm_source=commons.wikimedia.org`,
    extmetadata: { Artist: { value: 'Tinari.totoro' }, LicenseUrl: { value: imageLicense.slice(0, -1) }, Restrictions: { value: '' } },
  }));
  assert.deepEqual(photos.get(entry.photoCandidate!.title), { url: thumb, source: `https://commons.wikimedia.org/wiki/File:${encoded}`,
    license: 'by-sa/4.0', credit: 'Tinari.totoro', alt: '',
  });
});

test('new publisher feeds are separate, date-filtered and never reuse RSS thumbnails', async () => {
  const localUrl = 'https://www.egypt-today.com/1236/002000-%D8%AE%D8%A8%D8%B1';
  const globalUrl = 'https://www.arabstoday.net/1152/001000-%D8%B9%D8%A7%D8%AC%D9%84';
  const thumbnail = `<description><![CDATA[Full text <img src="${photoUrl}" />]]></description>
    <enclosure url="${photoUrl}" type="image/jpeg" />`;
  const load = createHomeHeadlines(async (url) => {
    if (url === egyptToday.url) return body(newsItem('الكرة المصرية', localUrl, thumbnail, 'Thu, 19 Nov 2026 00:20:00 GMT'),
      newsItem('فريق أمس', `${localUrl}-old`, thumbnail, 'Wed, 18 Nov 2026 21:58:00 GMT'));
    if (url === arabsToday.url) return body(newsItem('العنوان العاجل', `${globalUrl}?ref=rss`, thumbnail),
      newsItem('العنوان العاجل !', `${globalUrl}-duplicate`, '', 'Thu, 19 Nov 2026 00:09:00 GMT'),
      newsItem('خبر لاحق', `${globalUrl}-future`, '', 'Thu, 19 Nov 2026 00:40:00 GMT'),
      newsItem('رابط خارج الناشر', localUrl));
    assert.ok([...egyptFeeds, ...WORLD_HEADLINE_EDITION.feeds].some((feed) => feed.url === url));
    return body();
  }, () => now);
  const eg = readHeadlines(await load(cairo));
  assert.deepEqual(eg.local.items, [{ title: 'الكرة المصرية', publisher: 'egypt-today', url: localUrl, dateKind: 'published', datedAt: '2026-11-19T00:20:00.000Z' }]);
  assert.deepEqual(eg.world.items, [{ title: 'العنوان العاجل', publisher: 'arabs-today', url: globalUrl, dateKind: 'published', datedAt: '2026-11-19T00:10:00.000Z' }]);
  assert.deepEqual((await load({ country: null, timeZone: 'UTC' })).world, eg.world);
  assert.deepEqual(readHeadlines({ ...eg, local: { ...eg.local, items: [...eg.local.items, ...eg.world.items] },
    world: { ...eg.world, items: [...eg.world.items, ...eg.local.items] } }), eg);
});

test('local and world sources expose only verified photos and retain titles on media failure', async () => {
  for (const check of ['approved', 'license-mismatch', 'unsafe-media', 'restricted', 'no-license', 'different-file', 'oversized-metadata', 'lookup-failed'] as const) {
    let photoRequests = 0;
    const load = createHomeHeadlines(async (input, init) => {
      const url = String(input);
      if (url === world.url || url === egypt.url) return body(story(500));
      if (url === egyptVoices.url) return body(gvStory(imageCaption, 'Newsroom Writer', `${gvLink}-egypt`, 'Egypt perspective'));
      if (url === egyptToday.url) return body();
      if (url === arabsToday.url) return body(newsItem('خبر العرب اليوم', 'https://www.arabstoday.net/1152/001000-fixture'));
      if (url === unitedNations.url) return body(newsItem('خبر الأمم المتحدة', 'https://news.un.org/ar/story/2026/11/1123456', '<enclosure url="https://un.org/image.jpg" type="image/jpeg"/>'));
      if (url === globalVoices.url) return body(gvStory(imageCaption));
      if (url === mongabay.url) return body(newsItem('Fresh water', 'https://news.mongabay.com/2026/11/fresh-water/', '<dc:creator>Reporter</dc:creator>'));
      if (url === europeanParliament.url) return body(newsItem('Official release', 'https://www.europarl.europa.eu/news/en/press-room/20261118IPR48949/'));
      const lookup = new URL(url);
      assert.equal(lookup.origin + lookup.pathname, 'https://commons.wikimedia.org/w/api.php');
      assert.equal(lookup.searchParams.get('titles'), 'File:Fixture.jpg');
      assert.ok(init?.signal && init.redirect === 'error');
      photoRequests++;
      if (check === 'lookup-failed') throw new Error('Photo metadata unavailable');
      if (check === 'oversized-metadata') return new Response('x'.repeat(128 * 1024 + 1));
      if (check === 'different-file') return Response.json(commonsMetadata({ descriptionurl: commons.replace('Fixture', 'Other'), thumburl: photoUrl.replaceAll('Fixture', 'Other') }));
      if (check === 'no-license') return Response.json(commonsMetadata({ extmetadata: { Artist: { value: 'A' } } }));
      if (check === 'license-mismatch') return Response.json(commonsMetadata({}, 'https://creativecommons.org/licenses/by/4.0'));
      if (check === 'unsafe-media') return Response.json(commonsMetadata({ thumburl: 'https://example.org/Fixture.jpg' }));
      if (check === 'restricted') return Response.json(commonsMetadata({ extmetadata: { Artist: { value: 'A' }, LicenseUrl: { value: imageLicense }, Restrictions: { value: 'trademarked' } } }));
      return Response.json(commonsMetadata());
    }, () => now);
    const [data, same] = await Promise.all([load(cairo), load(cairo)]);
    assert.deepEqual(data, same);
    assert.equal(photoRequests, 2, 'one verification per refreshed feed, not per visitor');
    assert.equal(data.local.status, 'fresh');
    assert.equal(data.local.items.length, 2);
    assert.equal(data.local.items[0].photo, undefined);
    assert.equal(data.world.status, 'fresh');
    assert.deepEqual(new Set(data.world.items.map((item) => item.publisher)), new Set(WORLD_HEADLINE_EDITION.feeds.map((feed) => feed.publisher)));
    const storyWithPhoto = data.world.items.find((item) => item.publisher === 'global-voices')!;
    assert.equal(storyWithPhoto.title, 'World perspective');
    assert.equal(storyWithPhoto.author, 'Newsroom Writer');
    assert.ok(!('photoCandidate' in storyWithPhoto), 'parser internals do not reach visitors');
    assert.deepEqual(storyWithPhoto.photo, check === 'approved' ? { url: photoUrl, source: commons, license: 'by-sa/4.0', credit: 'A & B', alt: 'River at dawn' } : undefined);
    assert.equal(data.local.items[1].title, 'Egypt perspective');
    assert.deepEqual(data.local.items[1].photo, storyWithPhoto.photo);
    assert.deepEqual(readHeadlines(data), data);
  }
});

test('client photos only accept a matching raster and Commons license, and rotation visits every source', () => {
  const photo = { url: photoUrl, source: commons, license: 'by-sa/4.0', credit: 'Author', alt: '' };
  for (const invalid of [{ ...photo, source: 'https://commons.wikimedia.org/wiki/File:Different.jpg' }, { ...photo, license: 'by-nc/4.0' },
    { ...photo, url: photoUrl.replace('thumb.wikimedia.org', 'thumb.wikimedia.org.invalid') }, { ...photo, url: photoUrl.replace('640px-Fixture.jpg', '640px-Other.jpg') }, { ...photo, url: photoUrl.replace('640px-Fixture.jpg', 'Fixture.svg') }, { ...photo, url: photoUrl.replace('https:', 'http:') }]) {
    assert.equal(readHeadlinePhoto(invalid), undefined);
  }
  const items = parseHomeHeadlineFeed(rss(story(1), story(2), story(3)), world);
  const extra = parseHomeHeadlineFeed(rss(gvStory(imageCaption)), globalVoices)[0];
  const order = headlineRotation([...items, extra]);
  assert.deepEqual(order.map((headline) => headline.publisher), ['youm7', 'global-voices', 'youm7', 'youm7']);
  const response = { ...cairo, day: '2026-11-19', asOf: now, local: { status: 'fresh', checkedAt: stamp, items: [{ ...items[0], photo }] },
    world: { status: 'fresh', checkedAt: stamp, items: [{ ...items[0], photo }, { ...extra, photo }] } };
  const read = readHeadlines(response);
  assert.equal(read.local.items[0].photo, undefined);
  assert.equal(read.world.items[0].photo, undefined);
  assert.deepEqual(read.world.items[1].photo, photo);
  const foreignPhoto = readHeadlines({ ...response, world: { ...response.world, items: [{ ...extra, photo: { ...photo, url: 'https://example.net/Fixture.jpg' } }] } });
  assert.equal(foreignPhoto.world.items[0].title, extra.title);
  assert.equal(foreignPhoto.world.items[0].photo, undefined);
});

test('Brazil receives only its own dated, first-party agency headlines and does not alter other entry editions', async () => {
  const [general, politics] = localHeadlineEdition('BR')!.feeds;
  const asOf = Date.parse('2026-11-19T13:00:00Z');
  const brasil = headlineEntry({ 'x-vercel-ip-country': 'BR', 'accept-language': 'ar-EG' });
  assert.deepEqual(brasil, { country: 'BR', timeZone: 'America/Sao_Paulo' });
  const link = 'https://agenciabrasil.ebc.com.br/geral/noticia/2026-11/fixture';
  const day = 'Thu, 19 Nov 2026 06:30:00 -0300';
  const byline = 'Repórter Teste - Repórter da Agência Brasil';
  const agencyStory = (tag: string, credit: string, date = day, url = link, title = 'Notícia de teste do Brasil') =>
    newsItem(title, url, `<${tag}>${credit}</${tag}><enclosure type="image/jpeg" url="https://agenciabrasil.ebc.com.br/example.jpg" />`, date);
  const eligible = agencyStory('dc:creator', byline);
  assert.deepEqual(parseHomeHeadlineFeed(rss(eligible), general), [
    { publisher: 'agencia-brasil', author: byline, title: 'Notícia de teste do Brasil', url: link, datedAt: '2026-11-19T09:30:00.000Z', dateKind: 'published' },
  ]);
  assert.equal(parseHomeHeadlineFeed(rss(agencyStory('author', 'Agência Brasil')), general)[0].author, 'Agência Brasil');
  for (const credit of ['Agência de terceiro', 'Agência Brasil / Reuters', '']) {
    assert.deepEqual(parseHomeHeadlineFeed(rss(agencyStory('dc:creator', credit)), general), []);
  }
  const calls: string[] = [];
  const load = createHomeHeadlines(async (input) => {
    const url = String(input);
    calls.push(url);
    if (url === general.url) return body(eligible,
      agencyStory('dc:creator', byline, '2026-11-19T01:59:00Z', `${link}-old`, 'Ontem no Brasil'),
      agencyStory('dc:creator', byline, '2026-11-19T13:00:01Z', `${link}-future`, 'Ainda não publicado'),
      agencyStory('dc:creator', 'Publicador parceiro', day, `${link}-partner`, 'Não reutilizar'));
    if (url === politics.url) return new Response(null, { status: 503 });
    if (url === egypt.url || url === world.url) return body(story(801, '2026-11-19T09:30:00Z'));
    if ([...egyptFeeds, ...WORLD_HEADLINE_EDITION.feeds].some((feed) => feed.url === url)) return body();
    throw new Error('Not a configured feed');
  }, () => asOf);
  const [eg, br, bw] = await Promise.all([load(cairo), load(brasil), load({ country: 'BW', timeZone: 'Africa/Gaborone' })]);
  assert.equal(eg.local.items[0].publisher, 'youm7');
  assert.equal(br.local.status, 'partial');
  assert.deepEqual(urls(br.local.items), [link]);
  assert.equal(br.local.items[0].photo, undefined);
  assert.deepEqual(readHeadlines(br), br);
  assert.equal(bw.local.status, 'unsupported', 'the Botswana directory needs no feed requests');
  assert.deepEqual(br.world.items, bw.world.items);
  assert.deepEqual(calls.sort(), [...egyptFeeds, general, politics, ...WORLD_HEADLINE_EDITION.feeds].map((feed) => feed.url).sort());
  const mixed = readHeadlines({ ...br, world: { ...br.world, items: [...br.world.items, ...br.local.items] } });
  assert.deepEqual(mixed.world, br.world);
  const withoutRights = readHeadlines({ ...br, local: { ...br.local, items: [{ ...br.local.items[0], author: 'Reuters' }] } });
  assert.equal(withoutRights.local.status, 'unavailable');
});
