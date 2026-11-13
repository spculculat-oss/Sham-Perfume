import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ApiError } from '../src/utils/api';
import { makeImage, isGeneratedImageData } from '../src/workspace/workspaceApi';
import { SHAHIN_SIGNATURE } from '../src/workspace/motion';
import { loadChat } from '../src/workspace/ChatPanel';
import { SignedImage } from '../src/workspace/SignedImage';
import { WS_STRINGS } from '../src/workspace/strings';
import { workspaceInstruction } from '../server/workspace';

const image = 'data:image/png;base64,aGVsbG8=';

test('generated-image requests use only the configured API and return validated image bytes', async (t) => {
  const urls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string) => { urls.push(String(url)); return Response.json({ image }); });
  assert.deepEqual(await makeImage('a perfume bottle'), { src: image, engine: 'ai' });
  assert.deepEqual(urls, ['/api/workspace/image']);
});

for (const status of [403, 429, 503]) {
  test(`generation ${status} never switches to a provider URL or hides the error`, async (t) => {
    const urls: string[] = [];
    t.mock.method(globalThis, 'fetch', async (url: string) => { urls.push(String(url)); return Response.json({ code: 'NO_IMAGE_ENGINE' }, { status }); });
    await assert.rejects(makeImage('a perfume bottle'), (error: unknown) => error instanceof ApiError && error.status === status);
    assert.deepEqual(urls, ['/api/workspace/image']);
  });
}

test('network failures, malformed results and cancellation cannot return a third-party fallback', async (t) => {
  let calls = 0;
  const mock = t.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('offline'); });
  await assert.rejects(makeImage('a perfume bottle'), /offline/);
  assert.equal(calls, 1);
  mock.mock.mockImplementation(async () => Response.json({ image: 'https://image.pollinations.ai/prompt/test' }));
  await assert.rejects(makeImage('a perfume bottle'), /INVALID_IMAGE_RESULT/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(makeImage('a perfume bottle', undefined, controller.signal), { name: 'AbortError' });
});

test('brand spelling is exactly sharing ai in signature, gallery accessibility, translations and instructions', () => {
  assert.equal(SHAHIN_SIGNATURE, 'sharing ai');
  assert.match(renderToStaticMarkup(createElement(SignedImage, { src: image, lang: 'en' })), /Image signed sharing ai/);
  assert.match(workspaceInstruction('ar'), /sharing ai/);
  assert.doesNotMatch(workspaceInstruction('ar'), /sharin ai/);
  for (const key of ['signed_image', 'motion_note'] as const) {
    for (const value of Object.values(WS_STRINGS[key])) assert.ok(value.includes('sharing ai'));
  }
});

test('stored legacy external generated images are not reloaded; text and inline images survive', (t) => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => JSON.stringify([
    { role: 'assistant', text: 'old answer', image: 'https://image.pollinations.ai/prompt/old' },
    { role: 'assistant', text: 'current answer', image },
  ]) } });
  t.after(() => { if (saved) Object.defineProperty(globalThis, 'localStorage', saved); else delete (globalThis as any).localStorage; });
  const restored = loadChat();
  assert.equal(restored[0].text, 'old answer');
  assert.equal(restored[0].image, undefined);
  assert.equal(restored[0].regenerateImage, true);
  assert.equal(restored[1].image, image);
  assert.equal(isGeneratedImageData(image), true);
  assert.equal(isGeneratedImageData('data:text/html;base64,aGVsbG8='), false);
  assert.equal(isGeneratedImageData('https://example.org/image.jpg'), false);
});
