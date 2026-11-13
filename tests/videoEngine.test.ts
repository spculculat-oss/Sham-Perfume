import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { cleanVideoRequest, dailyLimit, DailyBudget, interactionBody, readJob, signJob, startVideo, videoAccess, videoBytes, VideoError, videoModel, videoOf, videoStatus } from '../server/videoEngine';
import { createWorkspaceRouter } from '../server/workspace';
import { effectFor, EFFECTS, localStoryboard, particlesAt, shotFor, wordsShown, cleanStoryboard, castOf } from '../src/studio/storyboard';
import { STUDIO_STRINGS } from '../src/studio/studioStrings';

const KEY = { GEMINI_API_KEY: 'k-test', SHAM_ADMIN_TOKEN: 'owner-token-123456' };
const VENDOR = /gemini|google|veo|omni|openai|claude|anthropic|deepseek/i;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const MP4 = Buffer.from('fake-mp4-bytes').toString('base64');
const done = (id = 'int_1') => ({ id, status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'video', mime_type: 'video/mp4', data: MP4 }] }] });

test('video engine: off unless the owner turns it on (and a key exists)', () => {
  assert.equal(videoAccess({}), 'off');
  assert.equal(videoAccess({ SHAM_VIDEO_ENGINE: 'everyone' }), 'off');
  assert.equal(videoAccess({ ...KEY }), 'off');
  assert.equal(videoAccess({ ...KEY, SHAM_VIDEO_ENGINE: 'yes' }), 'off');
  assert.equal(videoAccess({ ...KEY, SHAM_VIDEO_ENGINE: ' Owner ' }), 'owner');
  assert.equal(videoAccess({ ...KEY, SHAM_VIDEO_ENGINE: 'everyone' }), 'everyone');
  assert.equal(videoModel({}), 'gemini-omni-1.2-flash');
  assert.equal(videoModel({ SHAM_VIDEO_MODEL: 'x-model' }), 'x-model');
  assert.equal(dailyLimit({}), 10);
  assert.equal(dailyLimit({ SHAM_VIDEO_DAILY_LIMIT: '3' }), 3);
  assert.equal(dailyLimit({ SHAM_VIDEO_DAILY_LIMIT: '99999' }), 500);
  assert.equal(dailyLimit({ SHAM_VIDEO_DAILY_LIMIT: '-4' }), 10);
});

test('video engine: the daily budget resets each UTC day and can give back a failed start', () => {
  let now = new Date('2026-11-13T10:00:00Z');
  const b = new DailyBudget(() => now);
  assert.equal(b.left(2), 2);
  assert.ok(b.take(2)); assert.ok(b.take(2)); assert.equal(b.take(2), false);
  assert.equal(b.left(2), 0);
  b.give();
  assert.equal(b.left(2), 1);
  now = new Date('2026-11-14T00:00:01Z');
  assert.equal(b.left(2), 2);
  assert.ok(b.take(2));
});

test('video engine: job ids are signed, so nobody can follow or guess other jobs', () => {
  const job = signJob('int_abc-123', KEY);
  assert.equal(readJob(job, KEY), 'int_abc-123');
  assert.equal(readJob(job.replace('abc', 'abd'), KEY), undefined);
  assert.equal(readJob(`${job.slice(0, -1)}${job.endsWith('A') ? 'B' : 'A'}`, KEY), undefined);
  assert.equal(readJob(job, { ...KEY, GEMINI_API_KEY: 'other' }), undefined);
  for (const bad of [undefined, 3, '', '.x', 'no-dot', `../etc.${'a'.repeat(32)}`, 'x'.repeat(400)]) assert.equal(readJob(bad, KEY), undefined);
});

test('video engine: requests are cleaned (length, seconds 3–10, shape, safe pictures only)', () => {
  assert.throws(() => cleanVideoRequest({ prompt: 'x' }), (e: unknown) => e instanceof VideoError && e.status === 400);
  assert.throws(() => cleanVideoRequest(null), VideoError);
  const r = cleanVideoRequest({ prompt: '  a falcon\u0000 over the desert ', seconds: 60, aspect: '1:1', image: 'data:image/svg+xml;base64,AAAA' });
  assert.deepEqual(r, { prompt: 'a falcon  over the desert', seconds: 10, aspect: '16:9' });
  assert.equal(cleanVideoRequest({ prompt: 'abc', seconds: 1 }).seconds, 3);
  assert.equal(cleanVideoRequest({ prompt: 'abc', seconds: 'x' }).seconds, 6);
  assert.equal(cleanVideoRequest({ prompt: 'abc', aspect: '9:16' }).aspect, '9:16');
  assert.equal(cleanVideoRequest({ prompt: 'p'.repeat(5000) }).prompt.length, 2000);
  assert.equal(cleanVideoRequest({ prompt: 'abc', image: 'data:image/png;base64,iVBOR' }).image, 'data:image/png;base64,iVBOR');
  assert.equal(cleanVideoRequest({ prompt: 'abc', image: `data:image/png;base64,${'A'.repeat(3_600_000)}` }).image, undefined);
});

test('video engine: the body asks for a directed video, animating the scene picture when given', () => {
  const text = interactionBody({ prompt: 'a falcon', seconds: 5, aspect: '9:16' }, 'm1', true);
  assert.equal(text.model, 'm1');
  assert.equal(text.background, true);
  assert.match(String(text.input), /^a falcon\nCinematic/);
  assert.deepEqual(text.response_format, { type: 'video', aspect_ratio: '9:16', duration: '5s', resolution: '720p' });
  const pic = interactionBody({ prompt: 'a falcon', seconds: 5, aspect: '16:9', image: 'data:image/jpeg;base64,QUJD' }, 'm1', false);
  assert.equal('background' in pic, false);
  const input = pic.input as Array<Record<string, string>>;
  assert.deepEqual(input[0], { type: 'image', data: 'QUJD', mime_type: 'image/jpeg' });
  assert.match(input[1]!.text!, /Animate this picture/);
});

test('video engine: the clip is found in the answer (inline data or a file address)', () => {
  assert.deepEqual(videoOf(done()), { mime: 'video/mp4', data: MP4 });
  assert.deepEqual(videoOf({ steps: [{ content: [{ type: 'text' }] }, { content: [{ type: 'video', uri: 'https://generativelanguage.googleapis.com/v1beta/files/f1' }] }] }), { mime: 'video/mp4', uri: 'https://generativelanguage.googleapis.com/v1beta/files/f1' });
  assert.equal(videoOf({ steps: [{ content: [{ type: 'text' }] }] }), undefined);
  assert.equal(videoOf({}), undefined);
});

test('video engine: starts in the background, and waits instead when background runs are not offered', async () => {
  const calls: Array<{ url: string; body: Record<string, unknown>; key: string | null }> = [];
  const fake = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push({ url, body, key: new Headers(init.headers).get('x-goog-api-key') });
    if (body.background) return json({ error: { message: 'background is not supported for this model' } }, 400);
    return json(done('int_9'));
  }) as unknown as typeof fetch;
  const out = await startVideo({ prompt: 'a falcon', seconds: 4, aspect: '16:9' }, { env: KEY, fetch: fake });
  assert.deepEqual(out, { id: 'int_9', status: 'completed' });
  assert.equal(calls.length, 2);
  assert.equal(calls[0]!.url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
  assert.equal(calls[0]!.key, 'k-test');
  assert.equal(calls[1]!.body.background, undefined);

  const bg = (async () => json({ id: 'int_2', status: 'in_progress' })) as unknown as typeof fetch;
  assert.deepEqual(await startVideo({ prompt: 'abc', seconds: 4, aspect: '16:9' }, { env: KEY, fetch: bg }), { id: 'int_2', status: 'in_progress' });
});

test('video engine: engine errors become our own words (never the vendor’s), details stay on the server', async () => {
  const cases: Array<[number, string, string]> = [
    [429, 'Gemini quota exceeded', 'VIDEO_BUSY'],
    [400, 'Blocked by Google safety policy', 'VIDEO_REFUSED'],
    [400, 'Invalid gemini-omni argument', 'VIDEO_BAD_REQUEST'],
    [500, 'Google internal error in omni', 'VIDEO_FAILED'],
  ];
  for (const [status, message, code] of cases) {
    const fake = (async () => json({ error: { message } }, status)) as unknown as typeof fetch;
    await assert.rejects(startVideo({ prompt: 'abc', seconds: 4, aspect: '16:9' }, { env: KEY, fetch: fake }), (e: unknown) => {
      assert.ok(e instanceof VideoError);
      assert.equal(e.code, code);
      assert.doesNotMatch(e.message, VENDOR);
      assert.match(e.detail, /Google|Gemini|gemini/);
      return true;
    });
  }
  const noId = (async () => json({ status: 'in_progress' })) as unknown as typeof fetch;
  await assert.rejects(startVideo({ prompt: 'abc', seconds: 4, aspect: '16:9' }, { env: KEY, fetch: noId }), (e: unknown) => e instanceof VideoError && e.code === 'VIDEO_FAILED');
});

test('video engine: status and bytes (inline, file address, file record, foreign hosts refused)', async () => {
  const st = (async (url: string) => (url.endsWith('/int_1') ? json(done()) : json({ id: 'x', status: 'failed' }))) as unknown as typeof fetch;
  assert.equal((await videoStatus('int_1', { env: KEY, fetch: st })).status, 'completed');
  assert.equal((await videoStatus('int_x', { env: KEY, fetch: st })).status, 'failed');
  const noVideo = (async () => json({ id: 'x', status: 'completed', steps: [] })) as unknown as typeof fetch;
  assert.equal((await videoStatus('x', { env: KEY, fetch: noVideo })).status, 'failed');

  const inline = await videoBytes(done(), { env: KEY });
  assert.equal(inline.bytes.toString(), 'fake-mp4-bytes');

  const fileUri = 'https://generativelanguage.googleapis.com/v1beta/files/f1';
  const withUri = { steps: [{ content: [{ type: 'video', mime_type: 'video/mp4', uri: fileUri }] }] };
  const seen: string[] = [];
  const files = (async (url: string) => {
    seen.push(url);
    if (url === fileUri) return json({ state: 'ACTIVE' });
    return new Response(Buffer.from('mp4!'), { headers: { 'content-type': 'video/mp4' } });
  }) as unknown as typeof fetch;
  assert.equal((await videoBytes(withUri, { env: KEY, fetch: files })).bytes.toString(), 'mp4!');
  assert.deepEqual(seen, [fileUri, `${fileUri}:download?alt=media`]);

  const pending = (async () => json({ state: 'PROCESSING' })) as unknown as typeof fetch;
  await assert.rejects(videoBytes(withUri, { env: KEY, fetch: pending }), (e: unknown) => e instanceof VideoError && e.status === 409);
  const foreign = { steps: [{ content: [{ type: 'video', uri: 'https://evil.example/f1' }] }] };
  await assert.rejects(videoBytes(foreign, { env: KEY, fetch: files }), (e: unknown) => e instanceof VideoError && e.code === 'VIDEO_FAILED');
  await assert.rejects(videoBytes({}, { env: KEY }), (e: unknown) => e instanceof VideoError && e.code === 'VIDEO_NOT_READY');
});

async function withServer(env: Record<string, string>, fetcher: typeof fetch, run: (base: string) => Promise<void>, budget = new DailyBudget()) {
  const app = express();
  app.use(express.json({ limit: '4mb' }));
  app.use('/api/workspace', createWorkspaceRouter({ env, fetch: fetcher, lookup: async () => ['93.184.216.34'], videoBudget: budget }));
  const server = app.listen(0);
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/workspace`); } finally { server.close(); }
}
const post = (url: string, body: unknown, headers: Record<string, string> = {}) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('video routes: off → 503 and status says off; owner mode → 403 for visitors, works for the owner', async () => {
  const engine = (async (url: string) => (String(url).includes('/interactions/') ? json(done('int_7')) : json({ id: 'int_7', status: 'in_progress' }))) as unknown as typeof fetch;
  await withServer({ ...KEY }, engine, async (base) => {
    const status = await (await fetch(`${base}/status`)).json() as Record<string, unknown>;
    assert.equal(status.video, 'off');
    assert.equal(status.videoLeft, 0);
    const r = await post(`${base}/video/start`, { prompt: 'a falcon' });
    assert.equal(r.status, 503);
  });
  await withServer({ ...KEY, SHAM_VIDEO_ENGINE: 'owner', SHAM_VIDEO_DAILY_LIMIT: '5' }, engine, async (base) => {
    const status = await (await fetch(`${base}/status`)).json() as Record<string, unknown>;
    assert.equal(status.video, 'owner');
    assert.equal(status.videoLeft, 5);
    assert.equal((await post(`${base}/video/start`, { prompt: 'a falcon' })).status, 403);
    assert.equal((await post(`${base}/video/start`, { prompt: 'a falcon' }, { Authorization: 'Bearer wrong-token-xxxxxx' })).status, 403);
    const ok = await post(`${base}/video/start`, { prompt: 'a falcon', seconds: 5 }, { Authorization: `Bearer ${KEY.SHAM_ADMIN_TOKEN}` });
    assert.equal(ok.status, 200);
    const { job, status: s } = await ok.json() as { job: string; status: string };
    assert.equal(s, 'in_progress');
    assert.doesNotMatch(job, /^int_7$/);
    assert.equal(((await (await fetch(`${base}/video/status?job=${encodeURIComponent(job)}`)).json()) as { status: string }).status, 'completed');
    assert.equal((await fetch(`${base}/video/status?job=int_7`)).status, 404);
    const file = await fetch(`${base}/video/file?job=${encodeURIComponent(job)}`);
    assert.equal(file.status, 200);
    assert.equal(file.headers.get('content-type'), 'video/mp4');
    assert.equal(Buffer.from(await file.arrayBuffer()).toString(), 'fake-mp4-bytes');
    assert.equal(((await (await fetch(`${base}/status`)).json()) as { videoLeft: number }).videoLeft, 4);
  });
});

test('video routes: everyone mode respects the daily budget and gives back failed starts', async () => {
  let fail = true;
  const engine = (async () => (fail ? json({ error: { message: 'gemini exploded' } }, 500) : json({ id: 'int_8', status: 'in_progress' }))) as unknown as typeof fetch;
  await withServer({ ...KEY, SHAM_VIDEO_ENGINE: 'everyone', SHAM_VIDEO_DAILY_LIMIT: '1' }, engine, async (base) => {
    const bad = await post(`${base}/video/start`, { prompt: 'a falcon' });
    assert.equal(bad.status, 502);
    const body = await bad.json() as { error: string; code: string };
    assert.equal(body.code, 'VIDEO_FAILED');
    assert.doesNotMatch(JSON.stringify(body), VENDOR);
    fail = false;
    assert.equal((await post(`${base}/video/start`, { prompt: 'a falcon' })).status, 200);
    const limit = await post(`${base}/video/start`, { prompt: 'a falcon' });
    assert.equal(limit.status, 429);
    assert.equal(((await limit.json()) as { code: string }).code, 'VIDEO_DAILY_LIMIT');
    assert.equal((await post(`${base}/video/start`, { prompt: 'x' })).status, 400);
  });
});

test('free engine: atmosphere from the words, deterministic particles, film grammar, speech-paced captions', () => {
  assert.equal(effectFor('فارس في المطر'), 'rain');
  assert.equal(effectFor('a dragon breathing fire'), 'embers');
  assert.equal(effectFor('قافلة في الصحراء'), 'dust');
  assert.equal(effectFor('سفينة في الفضاء بين النجوم'), 'stars');
  assert.equal(effectFor('a plain room'), 'none');
  const told = localStoryboard('فارس تحت المطر وبعدين تنين بينفث نار', { aspect: '16:9', style: 'cinematic', mood: 'epic', seconds: 20 });
  assert.equal(told.scenes[0]!.effect, 'rain');
  assert.equal(told.scenes[told.scenes.length - 1]!.effect, 'embers');
  const a = particlesAt('snow', 2.5, 7);
  assert.deepEqual(a, particlesAt('snow', 2.5, 7));
  assert.ok(a.length > 50);
  assert.ok(a.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 && p.a >= 0));
  assert.notDeepEqual(particlesAt('rain', 0, 1)[0], particlesAt('rain', 1, 1)[0]);
  assert.deepEqual(particlesAt('none', 1), []);
  assert.equal(shotFor(0, 5), 'wide');
  assert.equal(shotFor(4, 5), 'wide');
  assert.equal(shotFor(3, 5), 'close');
  assert.equal(shotFor(1, 5), 'medium');
  assert.equal(shotFor(1, 5, 'close up on her eyes'), 'close');
  assert.equal(wordsShown('one two three four', 0, 4), 0);
  assert.equal(wordsShown('one two three four', 1.2, 4), 3);
  assert.equal(wordsShown('one two three four', 3.9, 4), 4);
  assert.equal(wordsShown('', 2, 4), 0);
  const board = localStoryboard('تنين بينفث نار فوق قلعة في ليلة مليانة نجوم', { aspect: '16:9', style: 'cinematic', mood: 'epic', seconds: 20 });
  assert.equal(board.depth, true);
  assert.ok(Number.isInteger(board.seed));
  assert.ok(board.scenes.every((s) => EFFECTS.includes(s.effect!)));
  assert.ok(board.scenes.some((s) => s.effect === 'embers' || s.effect === 'stars'));
  assert.ok(castOf(board).length > 0);
  const ai = cleanStoryboard({ title: 'T', scenes: [{ caption: 'c', prompt: 'p in the rain', seconds: 4, effect: 'snow' }, { caption: 'd', prompt: 'desert sand', seconds: 4, effect: 'lava' }] }, { aspect: '16:9', style: 'cinematic', mood: 'calm' });
  assert.equal(ai?.scenes[0]!.effect, 'snow');
  assert.equal(ai?.scenes[1]!.effect, 'dust');
});

test('studio: the new video words exist in all ten languages and never name a vendor', () => {
  const keys = ['narrate', 'narrate_note', 'effect', 'depth', 'pro_title', 'pro_note', 'pro_make', 'pro_one', 'pro_working', 'pro_done', 'pro_failed', 'pro_limit', 'pro_clip', ...EFFECTS.map((e) => `e_${e}`)];
  const strings = STUDIO_STRINGS as unknown as Record<string, Record<string, string>>;
  for (const key of keys) {
    for (const lang of ['ar', 'en', 'fr', 'es', 'it', 'de', 'ru', 'zh', 'tr', 'fa']) {
      assert.ok(strings[key]?.[lang]?.trim(), `${key}.${lang}`);
      assert.doesNotMatch(strings[key]![lang]!, VENDOR, `${key}.${lang}`);
    }
  }
});
