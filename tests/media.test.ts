import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import { createMediaRouter, sanitizeQuery, searchImages, searchPlace, searchVideos } from '../server/media';
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
  assert.match(prompt, /ابدأ ردك بسياج واحد باسم sham-media/);
  assert.match(prompt, /السياج إلزامي كلما طلب المستخدم صوراً أو فيديو/);
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
  const leading = '```sham-media\n{"images":["agarwood"]}\n```\n### شكل العود\nقطع خشب داكنة.';
  assert.deepEqual(extractMediaRequest(leading), { images: ['agarwood'], videos: [] });
  assert.equal(stripMediaBlock(leading), '### شكل العود\nقطع خشب داكنة.');
  assert.equal(stripFormulaBlock(leading), '### شكل العود\nقطع خشب داكنة.');
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

// Nominatim spacing is per instance; tests reset it so they do not wait.
const resetGeo = () => { (globalThis as { __shamGeoThrottle?: { next: number } }).__shamGeoThrottle!.next = 0; };

test('Shaheen can ask for places; they are parsed, capped at 5 and never accepted as links', () => {
  const prompt = systemInstruction('ar');
  assert.match(prompt, /places/);
  assert.match(prompt, /Grasse, France/);
  assert.match(prompt, /خرائط أو إحداثيات/);
  const reply = '```sham-media\n{"places":["Grasse, France","Taif, Saudi Arabia","Grasse, France","Kannauj, India","Bulgaria Rose Valley","Hainan, China","Assam, India"]}\n```\nمدن العطور:';
  assert.deepEqual(extractMediaRequest(reply), { images: [], videos: [], places: ['Grasse, France', 'Taif, Saudi Arabia', 'Kannauj, India', 'Bulgaria Rose Valley', 'Hainan, China'] });
  assert.equal(extractMediaRequest('```sham-media\n{"images":["rose"]}\n```')?.places, undefined);
  assert.deepEqual(extractMediaRequest('```sham-media\n{"place":"https://maps.example/x Grasse"}\n```')?.places, ['Grasse']);
});

test('places are geocoded with OpenStreetMap (Nominatim, then Photon) and validated', async () => {
  resetGeo();
  let seen = '';
  const ok = await searchPlace('Grasse, France', { lang: 'ar', fetch: (async (u: string, init?: RequestInit) => {
    seen = u;
    assert.match(new Headers(init?.headers).get('user-agent') || '', /ShamPerfume/);
    return json([{ lat: '43.6589123', lon: '6.9237456', display_name: 'غراس، ألب ماريتيم، فرنسا' }]);
  }) as typeof fetch });
  assert.equal(new URL(seen).hostname, 'nominatim.openstreetmap.org');
  assert.equal(new URL(seen).searchParams.get('accept-language'), 'ar,en');
  assert.deepEqual(ok.places, [{ name: 'Grasse, France', label: 'غراس، ألب ماريتيم، فرنسا', lat: 43.65891, lon: 6.92375,
    osm: 'https://www.openstreetmap.org/?mlat=43.65891&mlon=6.92375#map=9/43.65891/6.92375' }]);

  // Unknown to OpenStreetMap: empty, no second service asked.
  resetGeo();
  let calls = 0;
  const none = await searchPlace('Atlantis perfume city', { fetch: (async () => { calls++; return json([]); }) as typeof fetch });
  assert.deepEqual(none.places, []);
  assert.equal(calls, 1);

  // Nominatim refuses this host: Photon (same OpenStreetMap data) answers.
  resetGeo();
  const hosts: string[] = [];
  const fallback = await searchPlace('Taif', { fetch: (async (u: string) => {
    hosts.push(new URL(u).hostname);
    if (hosts.length === 1) return json({ error: 'blocked' }, 403);
    return json({ features: [{ geometry: { coordinates: [40.4158, 21.2703] }, properties: { name: 'Taif', state: 'Makkah Province', country: 'Saudi Arabia' } }] });
  }) as typeof fetch });
  assert.deepEqual(hosts, ['nominatim.openstreetmap.org', 'photon.komoot.io']);
  assert.equal(fallback.places[0].label, 'Taif, Makkah Province, Saudi Arabia');
  assert.equal(fallback.places[0].lat, 21.2703);

  // Nonsense coordinates are dropped.
  resetGeo();
  const bad = await searchPlace('Nowhere', { fetch: (async (u: string) => (u.includes('nominatim')
    ? json([{ lat: '123', lon: '6', display_name: 'x' }])
    : json({ features: [{ geometry: { coordinates: [0, 0] } }] }))) as typeof fetch });
  assert.deepEqual(bad.places, []);
});

test('Nominatim requests from one instance are spaced about a second apart', async () => {
  resetGeo();
  const at: number[] = [];
  const fetchStub = (async () => { at.push(Date.now()); return json([{ lat: '1.5', lon: '2.5', display_name: 'P' }]); }) as typeof fetch;
  await Promise.all([searchPlace('Place one', { fetch: fetchStub }), searchPlace('Place two', { fetch: fetchStub })]);
  assert.ok(at[1] - at[0] >= 1000, `gap ${at[1] - at[0]}ms`);
});

test('GET /api/media?type=place returns coordinates', async () => {
  resetGeo();
  const app = express();
  app.use('/api', createMediaRouter({ env: {}, fetch: (async () => json([{ lat: '30.0444', lon: '31.2357', display_name: 'Cairo, Egypt' }])) as typeof fetch }));
  const server = app.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/media?type=place&q=Khan%20el-Khalili%2C%20Cairo&lang=ar`);
    assert.equal(res.status, 200);
    const body = await res.json() as { places: { name: string; lat: number }[] };
    assert.equal(body.places[0].name, 'Khan el-Khalili, Cairo');
    assert.equal(body.places[0].lat, 30.0444);
  } finally {
    server.close();
  }
});

test('a long Nominatim queue sends extra places straight to Photon', async () => {
  resetGeo();
  (globalThis as { __shamGeoThrottle?: { next: number } }).__shamGeoThrottle!.next = Date.now() + 10_000;
  const hosts: string[] = [];
  const result = await searchPlace('Grasse', { fetch: (async (u: string) => {
    hosts.push(new URL(u).hostname);
    return json({ features: [{ geometry: { coordinates: [6.92, 43.66] }, properties: { name: 'Grasse', country: 'France' } }] });
  }) as typeof fetch });
  assert.deepEqual(hosts, ['photon.komoot.io']);
  assert.equal(result.places[0].label, 'Grasse, France');
  resetGeo();
});

test('the media block is found however the model wrote it (live: ```json and no closing fence)', async () => {
  const { findMediaBlocks, normalizeMediaBlocks, removeMediaBlocks } = await import('../src/utils/mediaBlock');
  const { publicChatResult } = await import('../server/shaheen');
  // Exactly what production returned on 2026-10-15.
  const live = '```json\n{"images":["agarwood raw wood","Aquilaria trees"],"videos":["agarwood essential oil steam distillation process"]}\n### شكل العود الخام\n\nقطع خشبية داكنة.';
  assert.deepEqual(extractMediaRequest(live), { images: ['agarwood raw wood', 'Aquilaria trees'], videos: ['agarwood essential oil steam distillation process'] });
  assert.equal(stripMediaBlock(live), '### شكل العود الخام\n\nقطع خشبية داكنة.');
  assert.equal(stripFormulaBlock(live), '### شكل العود الخام\n\nقطع خشبية داكنة.');
  // The API sends one canonical, closed block instead.
  assert.equal(publicChatResult({ reply: live, mode: 'auto' }).reply,
    '```sham-media\n{"images":["agarwood raw wood","Aquilaria trees"],"videos":["agarwood essential oil steam distillation process"]}\n```\n### شكل العود الخام\n\nقطع خشبية داكنة.');

  // Other shapes: closed json fence at the end, bare line, unlabelled fence, singular keys.
  assert.deepEqual(extractMediaRequest('answer\n```json\n{"places":["Grasse, France"]}\n```'), { images: [], videos: [], places: ['Grasse, France'] });
  assert.equal(removeMediaBlocks('answer\n```json\n{"places":["Grasse, France"]}\n```'), 'answer');
  assert.equal(removeMediaBlocks('{"images":["rose"]}\nالورد الدمشقي.'), 'الورد الدمشقي.');
  assert.equal(removeMediaBlocks('```\n{"place":"Taif"}\n```\nالطائف.'), 'الطائف.');
  assert.equal(normalizeMediaBlocks('```\n{"place":"Taif","image":"Taif rose"}\n```\nالطائف.'), '```sham-media\n{"places":["Taif"],"images":["Taif rose"]}\n```\nالطائف.');

  // Never touched: formula JSON, ordinary code, JSON with other keys, plain text.
  const formula = 'وصفة:\n```sham-formula\n{"title":"x","pyramidNotes":[]}\n```';
  const code = 'مثال:\n```json\n{"title":"Rose","images":["rose"]}\n```';
  for (const text of [formula, code, 'نص عادي فيه كلمة images فقط']) {
    assert.deepEqual(findMediaBlocks(text), []);
    assert.equal(normalizeMediaBlocks(text), text);
  }
  // A broken sham-media fence is still hidden.
  assert.equal(removeMediaBlocks('```sham-media\n{oops\n```\nok'), 'ok');
});
