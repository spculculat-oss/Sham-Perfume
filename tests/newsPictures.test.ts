import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NewsFront } from '../src/components/news/NewsFront';
import { NewsReportCard } from '../src/components/news/NewsReports';
import { ShaheenLiveNews } from '../src/components/ShaheenLiveNews';
import { PERFUME_NEWS_DATA } from '../src/data/perfumeNews';
import { newsText } from '../src/لغات/newsL10n';
import { FEEDS, parseFeed, pictureOf } from '../scripts/shaheen-news/feeds';
import { itemsFromEditor, itemsFromFeeds, type NewsFile } from '../scripts/shaheen-news/curate';
import { newsPictureKind, resolveNewsImage } from '../src/utils/newsCache';
import { newsItemPicture } from '../src/utils/liveNews';

const feed = FEEDS[0];
const item = (inner: string, title = 'Dior unveils a new oud fragrance') =>
  `<item><title>${title}</title><link>https://news.google.com/rss/articles/abc</link><pubDate>Wed, 14 Oct 2026 09:00:00 GMT</pubDate>${inner}</item>`;
const rss = (block: string) => `<?xml version="1.0"?><rss><channel>${block}</channel></rss>`;

test("a publisher's own picture comes from its feed and stays on the story", () => {
  const withEnclosure = parseFeed(rss(item('<enclosure url="https://cdn.vogue.me/photos/dior-oud.jpg" type="image/jpeg" length="1"/>')), feed);
  assert.equal(withEnclosure[0].image, 'https://cdn.vogue.me/photos/dior-oud.jpg');

  const media = parseFeed(rss(item('<media:content url="https://img.example.com/a/b.webp" medium="image"/>')), feed);
  assert.equal(media[0].image, 'https://img.example.com/a/b.webp');

  const thumbnail = parseFeed(rss(item('<media:thumbnail url="https://static.example.com/2026/10/rose.png"/>')), feed);
  assert.equal(thumbnail[0].image, 'https://static.example.com/2026/10/rose.png');

  const inline = parseFeed(rss(item('<description><![CDATA[<p><img src="https://static.example.com/2026/10/upload/harvest.jpg"/></p>]]></description>')), feed);
  assert.equal(inline[0].image, 'https://static.example.com/2026/10/upload/harvest.jpg');

  assert.equal(parseFeed(rss(item('')), feed)[0].image, undefined, 'no picture in the feed means none, never an invented one');
});

test('trackers, data URIs, relative paths and non-image files never become news photos', () => {
  assert.equal(pictureOf('<enclosure url="https://tracker.example/pixel.gif" type="image/gif"/>'), undefined);
  assert.equal(pictureOf('<media:content url="data:image/png;base64,AAA"/>'), undefined);
  assert.equal(pictureOf('<enclosure url="/relative/photo.jpg"/>'), undefined, 'relative addresses are not resolved by guesswork');
  assert.equal(pictureOf('<enclosure url="https://example.com/audio/podcast.mp3"/>'), undefined);
  assert.equal(pictureOf('<enclosure url="https://example.com/huge.jpg?w=1200&amp;h=800"/>'), 'https://example.com/huge.jpg?w=1200&h=800');
});

test('the collected news file keeps the source picture in both editing paths', () => {
  const candidates = parseFeed(rss(item('<enclosure url="https://cdn.example.com/oud.jpg"/>')), feed);
  const [edited] = itemsFromEditor({ items: [{ i: 0, title: { ar: 'ديور تطلق عطر عود', en: 'Dior oud' } }] }, candidates).items;
  assert.equal(edited.image, 'https://cdn.example.com/oud.jpg', 'the editor path keeps the publisher photo');
  const [headlines] = itemsFromFeeds(candidates);
  assert.equal(headlines.image, 'https://cdn.example.com/oud.jpg', 'the headline-only path keeps it too');
  assert.equal(itemsFromFeeds(parseFeed(rss(item('')), feed))[0].image, undefined);
});

test('each card knows whether its picture is the publisher’s or an editorial one', () => {
  const images = ['asset-a.jpg', 'asset-b.jpg'];
  assert.equal(newsPictureKind('https://cdn.example.com/oud.jpg', 'https://cdn.example.com/oud.jpg'), 'source');
  assert.equal(newsPictureKind(undefined, 'asset-b.jpg'), 'editorial');
  assert.equal(newsPictureKind('', 'asset-a.jpg'), 'editorial');
  assert.equal(newsPictureKind(undefined, ''), 'none');
  const buildAsset = resolveNewsImage('/src/old-hash.jpg', images, 'asset-a.jpg');
  assert.equal(buildAsset, 'asset-a.jpg');
  assert.equal(newsPictureKind('/src/old-hash.jpg', buildAsset), 'editorial');

  assert.equal(newsItemPicture({ image: 'https://cdn.example.com/oud.jpg' }), 'https://cdn.example.com/oud.jpg');
  assert.equal(newsItemPicture({ image: 'javascript:alert(1)' }), undefined);
  assert.equal(newsItemPicture({}), undefined);
  assert.equal(newsItemPicture(undefined), undefined);
});

test('front page and headline list show publisher photos only when the feed carries them', () => {
  const url = 'https://publisher.example/oud';
  const image = 'https://cdn.publisher.example/oud.jpg';
  const title = { ar: 'خلاصة عن العود', en: 'A story about oud' };
  const [lead] = itemsFromFeeds(parseFeed(rss(item('')), feed));
  // Two actual publisher links, with an image on only the first one.
  const edition: NewsFile = {
    version: 1, updatedAt: '2026-10-14T10:30:00Z', nextUpdateAt: '2026-10-14T22:30:00Z', intervalHours: 12,
    editor: 'feeds', sources: [], items: [
      { ...lead, id: 'lead', source: 'Publisher', url, image, title, summary: title },
      { ...lead, id: 'plain', source: 'Publisher', url: `${url}-followup`, image: undefined, title, summary: title },
    ],
  };
  const front = () => renderToStaticMarkup(React.createElement(NewsFront, { edition, lang: 'en', onHeadlines: () => {}, onReports: () => {} }));
  const sourceLabel = `<figcaption>${newsText('en', 'photo_source')}</figcaption>`;
  assert.ok(front().includes(sourceLabel));
  assert.ok(front().includes(`src="${image}"`));
  assert.ok(front().includes(`href="${url}"`));
  const list = renderToStaticMarkup(React.createElement(ShaheenLiveNews, { currentLang: 'en', edition }));
  assert.equal((list.match(/<img /g) ?? []).length, 1, 'no substitute image for the second story');
  assert.ok(list.includes(sourceLabel));
  assert.ok(list.includes(newsText('en', 'photo_none')));
  assert.ok(!list.includes(newsText('en', 'photo_stock')));

  edition.items[0] = { ...edition.items[0], image: undefined };
  assert.ok(front().includes('Editorial cover · not a story photo'));
  assert.ok(!front().includes(sourceLabel));
});

test('an illustrated report credits a supplied photo and the community keeps its separate disclosure', () => {
  const imageUrl = 'https://cdn.publisher.example/report.jpg';
  const html = renderToStaticMarkup(React.createElement(NewsReportCard, {
    item: { ...PERFUME_NEWS_DATA[0], imageUrl }, index: 0, lang: 'en', saved: false, onSave: () => {}, onOpen: () => {},
  }));
  assert.match(html, /data-picture-kind="source"/);
  assert.ok(html.includes(`<figcaption>${newsText('en', 'photo_source')}</figcaption>`));
  const community = readFileSync(new URL('../src/community/GeneralNewsPeriodic.tsx', import.meta.url), 'utf8');
  assert.match(community, /Editorial image, not from the story/);
});
