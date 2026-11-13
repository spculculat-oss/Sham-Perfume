import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { realPhotoReply, realPhotoRequest, wantsRealPhoto } from '../src/utils/realPhotos';
import { extractMediaRequest } from '../src/utils/shaheenMedia';
import { normalizeMediaBlocks, removeMediaBlocks } from '../src/utils/mediaBlock';
import { askWorkspace, makeImage as serverImage } from '../server/workspace';
import { makeImage as browserImage } from '../src/workspace/workspaceApi';
import { createMediaRouter, searchImages } from '../server/media';
import { publicChatResult, systemInstruction } from '../server/shaheen';

const prompt = 'عايظ صورة حقيقيه لحسنى مبارك';
const photo = (index: number, title: string, description = '') => ({ index, title: `File:${title}.jpg`, imageinfo: [{
  thumburl: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${index}.jpg/500px-${index}.jpg`,
  thumbwidth: 500, thumbheight: 375, mime: 'image/jpeg',
  descriptionurl: 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(title + '.jpg'),
  extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: 'Archive photographer' }, ImageDescription: { value: description } },
}] });
const commons = () => Response.json({ query: { pages: {
  a: photo(1, 'Hosni Mubarak portrait 2009', 'Photograph at a press conference'),
  b: photo(2, 'Hosni Mubarak painting', 'An oil painting'),
  c: photo(3, 'Hosni Mubarak portrait synthetic', 'AI-generated image'),
  d: photo(4, 'Hosni Mubarak statue', 'A bronze statue'),
  e: photo(5, 'Another president', 'Photograph'),
} } });

test('the exact Egyptian spelling/typo resolves to retrieval, not generated artwork', () => {
  for (const text of [prompt, 'عايز صورة حقيقية لحسني مبارك', 'هات صورة أرشيفية للرئيس الأسبق حسني مبارك', 'I want a real photo of Hosni Mubarak', 'please show me a photograph of Hosni Mubarak']) {
    assert.equal(wantsRealPhoto(text), true, text);
    assert.deepEqual(realPhotoRequest(text), { query: 'Hosni Mubarak' }, text);
    const reply = realPhotoReply(text, [], 'ar')!;
    assert.deepEqual(extractMediaRequest(reply), { images: ['Hosni Mubarak'], videos: [], imageKind: 'photograph' });
    assert.doesNotMatch(reply, /sham-image|sham-video|Google Images|sharin ai/);
    assert.doesNotMatch(removeMediaBlocks(reply), /sham-media/);
  }
  assert.equal(wantsRealPhoto('ارسم صورة واقعية لحسني مبارك'), false);
  assert.equal(wantsRealPhoto('Generate a photorealistic portrait'), false);
  assert.deepEqual(realPhotoRequest('هات صورة حقيقية لبرج القاهرة'), { query: 'برج القاهرة' });
});

test('corrections preserve an explicit earlier photo subject, missing subjects require clarification', () => {
  const history = [{ role: 'user' as const, text: 'عايز صورة لحسني مبارك' }];
  assert.deepEqual(realPhotoRequest('عايز صورة حقيقية مش رسمة', history), { query: 'Hosni Mubarak' });
  assert.deepEqual(realPhotoRequest('هات صورة حقيقية'), {});
  assert.match(realPhotoReply('هات صورة حقيقية', [], 'ar')!, /لمين أو لإيه/);
  assert.equal(extractMediaRequest(realPhotoReply('هات صورة حقيقية', [], 'ar')!), undefined);
});

test('photograph kind survives canonicalization and public chat serialization', () => {
  const reply = realPhotoReply(prompt, [], 'ar')!;
  for (const text of [normalizeMediaBlocks(reply), publicChatResult({ reply }, prompt).reply]) {
    assert.equal(extractMediaRequest(text)!.imageKind, 'photograph');
    assert.doesNotMatch(text, /imageKinds/);
  }
  assert.match(systemInstruction('ar'), /يمكن عرض صور شخصيات عامة/);
});

test('workspace real-photo requests bypass the model and both generation/fallback paths are blocked', async () => {
  let calls = 0;
  const fetcher = (async () => { calls++; throw new Error('should not call a generator/model'); }) as typeof fetch;
  const reply = await askWorkspace({ messages: [{ role: 'user', text: prompt }] }, { env: {}, fetch: fetcher });
  assert.deepEqual(extractMediaRequest(reply.reply)!.images, ['Hosni Mubarak']);
  await assert.rejects(serverImage(prompt, undefined, { env: { GEMINI_API_KEY: 'test' }, fetch: fetcher }), /Use image search/);
  await assert.rejects(browserImage(prompt), /REAL_PHOTO_REQUIRES_SEARCH/);
  assert.equal(calls, 0);
});

test('photo retrieval keeps source, author and license, excluding known artwork, AI and wrong subjects', async () => {
  const images = await searchImages('Hosni Mubarak', { kind: 'photograph', fetch: (async () => commons()) as typeof fetch });
  assert.equal(images.images.length, 1);
  const image = images.images[0];
  assert.equal(image.title, 'Hosni Mubarak portrait');
  assert.equal(image.author, 'Archive photographer');
  assert.equal(image.license, 'CC BY-SA 4.0');
  assert.match(image.page, /^https:\/\/commons.wikimedia.org\//);
  assert.match(image.thumb, /^https:\/\/upload.wikimedia.org\//);
});

test('media route propagates photograph mode and caches it separately from general images', async () => {
  let calls = 0;
  const app = express();
  app.use('/api', createMediaRouter({ fetch: (async () => { calls++; return commons(); }) as typeof fetch }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/media?type=image&q=Hosni%20Mubarak`;
  try {
    const general = await (await fetch(url)).json();
    assert.equal(general.images.length, 4);
    const photos = await (await fetch(url + '&kind=photograph')).json();
    assert.equal(photos.images.length, 1);
    assert.equal(calls, 2);
    await fetch(url + '&kind=photograph');
    assert.equal(calls, 2);
    assert.equal((await fetch(url + '&kind=made-up')).status, 400);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});

test('public chat handles a real photograph without a model and still honors owner shutdown', async () => {
  const { createShaheenRouter } = await import('../server/shaheen');
  const { Repository } = await import('../server/core/repository');
  const { MemoryStore } = await import('../server/core/store');
  const repo = new Repository(new MemoryStore(), {});
  let calls = 0;
  const app = express(); app.use(express.json());
  app.use('/api', createShaheenRouter({ repo, env: { SHAM_LIVE_DATA: 'off' }, fetch: (async () => { calls++; throw new Error('No generator'); }) as typeof fetch }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/chat`;
  const body = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: prompt, language: 'ar' }) };
  try {
    const response = await fetch(url, body);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.deepEqual(extractMediaRequest(result.reply)!.images, ['Hosni Mubarak']);
    assert.equal(calls, 0);
    const current = await repo.settings();
    await repo.updateSettings({ ...current, shaheen: { ...current.shaheen, enabled: false } });
    const disabled = await fetch(url, body);
    assert.equal(disabled.status, 503);
    assert.equal(calls, 0);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});
