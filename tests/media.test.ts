import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import { createMediaRouter, sanitizeQuery, searchImages, searchVideos } from '../server/media';
import { systemInstruction } from '../server/shaheen';
import { extractMediaRequest, stripMediaBlock } from '../src/utils/shaheenMedia';
import { stripFormulaBlock } from '../src/components/ShaheenMarkdown';
import { compactTurn } from '../src/utils/chatStore';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const page = (index: number, title: string, extra: Record<string, unknown> = {}) => ({
  index, title, imageinfo: [{
    // Shape of the live API (Oct 2026): thumbnails on thumb.wikimedia.org with utm_* tracking params.
    thumburl: `https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/${index}.jpg/500px-${index}.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail`,
    responsiveUrls: { 2: `https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/${index}.jpg/1280px-${index}.jpg?utm_source=commons.wikimedia.org` },
    thumbwidth: 500, thumbheight: 375, width: 3000,
    descriptionurl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`, mime: 'image/jpeg',
    extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: '<a href="//x">Jane &amp; Co</a>' } }, ...extra,
  }],
});

test('Shaheen is told how to ask for real images/videos and to use tables, never to write media links', () => {
  const prompt = systemInstruction('ar');
  assert.match(prompt, /sham-media/);
  assert.match(prompt, /لا تكتب أبداً روابط صور أو فيديو/);
  assert.match(prompt, /جدول Markdown/);
  assert.match(systemInstruction('en', '', 'fast'), /sham-media/);
});

test('the sham-media block is parsed, limited, cleaned and hidden from the visible text', () => {
  const reply = 'العود راتنج يتكوّن في شجر الأكويلاريا.\n\n| المادة | الطبقة |\n|---|---|\n| عود | قاعدة |\n\n```sham-media\n{"images":["agarwood resin","Aquilaria tree","oud chips"],"videos":["oud distillation","second video"]}\n```';
  assert.deepEqual(extractMediaRequest(reply), { images: ['agarwood resin', 'Aquilaria tree'], videos: ['oud distillation'] });
  const visible = stripMediaBlock(reply);
  assert.doesNotMatch(visible, /sham-media|agarwood/);
  assert.match(visible, /\| عود \| قاعدة \|/);
  assert.doesNotMatch(stripFormulaBlock(reply), /sham-media/);
  // Links are never accepted as topics; malformed or missing blocks give nothing.
  assert.deepEqual(extractMediaRequest('```sham-media json\n{"images":["https://evil.example/x.jpg rose"],"video":"<b>maceration</b>"}\n```'),
    { images: ['rose'], videos: ['b maceration b'] });
  assert.equal(extractMediaRequest('```sham-media\nnot json\n```'), undefined);
  assert.equal(extractMediaRequest('plain answer'), undefined);
  assert.equal(stripMediaBlock('answer\n```sham-media\n{"images":["ro'), 'answer');
});

test('long turns drop the media block before trimming the history', () => {
  const text = `${'x'.repeat(3990)}\n\`\`\`sham-media\n{"images":["rose"]}\n\`\`\``;
  assert.equal(compactTurn(text), 'x'.repeat(3990));
});

test('media queries are sanitised', () => {
  assert.equal(sanitizeQuery('  agarwood   resin '), 'agarwood resin');
  assert.equal(sanitizeQuery('عود <script>'), 'عود script');
  assert.equal(sanitizeQuery('x'), undefined);
  assert.equal(sanitizeQuery('1234'), undefined);
  assert.equal(sanitizeQuery('a'.repeat(81)), undefined);
  assert.equal(sanitizeQuery(['rose']), undefined);
});

test('images come from Wikimedia Commons with credit, filtered by type, size and safety', async () => {
  let url = '';
  let ua = '';
  const result = await searchImages('agarwood', { fetch: (async (u: string, init?: RequestInit) => {
    url = u; ua = new Headers(init?.headers).get('user-agent') || '';
    return json({ query: { pages: {
      a: page(3, 'File:Agarwood_chips.jpg'),
      b: page(1, 'File:Agarwood resin.JPG'),
      c: page(2, 'File:Nude model with perfume.jpg'),
      d: page(4, 'File:Tiny.png', { thumbwidth: 120, thumbheight: 90 }),
      e: page(5, 'File:Diagram.svg', { mime: 'image/svg+xml' }),
      f: page(6, 'File:Elsewhere.jpg', { thumburl: 'https://evil.example/a.jpg' }),
      g: page(7, 'File:Lookalike.jpg', { thumburl: 'https://thumb.wikimedia.org.evil.example/a.jpg' }),
    } } });
  }) as typeof fetch });
  assert.match(url, /^https:\/\/commons\.wikimedia\.org\/w\/api\.php\?/);
  assert.equal(new URL(url).searchParams.get("gsrsearch"), "agarwood filetype:bitmap");
  assert.match(ua, /ShamPerfume/);
  assert.deepEqual(result.images.map((i) => i.title), ['Agarwood resin', 'Agarwood chips']);
  assert.equal(result.images[0].license, 'CC BY-SA 4.0');
  assert.equal(result.images[0].author, 'Jane & Co');
  assert.equal(result.images[0].thumb, 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/1.jpg/500px-1.jpg');
  assert.equal(result.images[0].large, 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/1.jpg/1280px-1.jpg');
  assert.equal(result.source, 'wikimedia');
});

test('image search drops synonym noise and retries a long topic with fewer words', async () => {
  const asked: string[] = [];
  const result = await searchImages('agarwood resin chips', { fetch: (async (u: string) => {
    const q = new URL(u).searchParams.get('gsrsearch') || '';
    asked.push(q);
    if (q !== 'agarwood filetype:bitmap') return json({ batchcomplete: '' });
    return json({ query: { pages: {
      a: page(1, 'File:Agarwood top grade.jpg'),
      b: page(2, 'File:Huis Oud Wulven bij Houten.jpg'),
      c: page(3, 'File:Infected Agarwoods Aquilaria Malaysia.jpg'),
    } } });
  }) as typeof fetch });
  assert.deepEqual(asked, ['agarwood resin chips filetype:bitmap', 'agarwood resin filetype:bitmap', 'agarwood filetype:bitmap']);
  assert.deepEqual(result.images.map((i) => i.title), ['Agarwood top grade', 'Infected Agarwoods Aquilaria Malaysia']);
});

test('videos use the YouTube API with the key in a header, and fall back to a search link', async () => {
  const calls: { url: string; key: string | null }[] = [];
  const env = { YOUTUBE_API_KEY: 'yt-test-key-1' };
  const ok = await searchVideos('perfume maceration', { env, lang: 'ar', fetch: (async (u: string, init?: RequestInit) => {
    calls.push({ url: u, key: new Headers(init?.headers).get('x-goog-api-key') });
    return json({ items: [
      { id: { videoId: 'abcdefghijk' }, snippet: { title: 'How to macerate perfume &amp; age it', channelTitle: 'Lab' } },
      { id: { videoId: 'bad' }, snippet: { title: 'Broken id' } },
    ] });
  }) as typeof fetch });
  assert.equal(calls.length, 1);
  assert.doesNotMatch(calls[0].url, /yt-test-key-1/);
  assert.equal(calls[0].key, 'yt-test-key-1');
  assert.match(calls[0].url, /safeSearch=strict/);
  assert.match(calls[0].url, /relevanceLanguage=ar/);
  assert.deepEqual(ok.videos, [{ id: 'abcdefghijk', title: 'How to macerate perfume & age it', channel: 'Lab', thumb: 'https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg' }]);
  assert.equal(ok.source, 'youtube');

  // No key at all: no request, just a YouTube search link.
  const none = await searchVideos('oud', { env: {}, fetch: (async () => { throw new Error('must not be called'); }) as typeof fetch });
  assert.deepEqual(none, { videos: [], searchUrl: 'https://www.youtube.com/results?search_query=oud', source: 'link' });

  // The API is not enabled for the (Gemini) key: one 403, then the key is not retried.
  let refusedCalls = 0;
  const refusedFetch = (async () => { refusedCalls++; return json({ error: { code: 403 } }, 403); }) as typeof fetch;
  const genv = { GEMINI_API_KEY: 'gemini-key-without-youtube' };
  assert.equal((await searchVideos('rose', { env: genv, fetch: refusedFetch })).source, 'link');
  assert.equal((await searchVideos('jasmine', { env: genv, fetch: refusedFetch })).source, 'link');
  assert.equal(refusedCalls, 1);
});

test('GET /api/media validates, caches and rate-limits lookups', async () => {
  let upstream = 0;
  const app = express();
  app.use('/api', createMediaRouter({ env: { SHAM_MEDIA_RATE_PER_MIN: '3' }, fetch: (async () => {
    upstream++;
    return json({ query: { pages: { a: page(1, `File:Rose ${upstream}.jpg`) } } });
  }) as typeof fetch }));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/media`;
  try {
    assert.equal((await fetch(`${base}?type=gif&q=rose`)).status, 400);
    assert.equal((await fetch(`${base}?type=image&q=x`)).status, 400);
    const first = await fetch(`${base}?type=image&q=Damask%20rose%20petals`);
    assert.equal(first.status, 200);
    const body = await first.json() as { images: { title: string }[] };
    assert.equal(body.images[0].title, 'Rose 1');
    // Same topic again (any case): served from the cache.
    await fetch(`${base}?type=image&q=damask%20ROSE%20petals`);
    assert.equal(upstream, 1);
    // Video without any key still answers with a search link.
    const video = await fetch(`${base}?type=video&q=distillation`);
    assert.equal(video.status, 200);
    assert.equal(((await video.json()) as { source: string }).source, 'link');
    assert.equal((await fetch(`${base}?type=image&q=vetiver%20roots%20a`)).status, 200);
    const limited = await fetch(`${base}?type=image&q=vetiver%20roots%20b`);
    assert.equal(limited.status, 429);
    assert.equal(((await limited.json()) as { code: string }).code, 'RATE_LIMITED');
  } finally {
    server.close();
  }
});
