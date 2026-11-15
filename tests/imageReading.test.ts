import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import {
  IMAGE_READ, IMAGE_WORD_LANGUAGES, cleanOcrText, defaultImageQuestion, imageTurn, imageWords, ocrLanguages, parseImageDataUrl,
  readingFromModel, withImageText, type ImageReading,
} from '../src/utils/imageReading';
import { SUPPORTED_LANGUAGES } from '../src/types/i18n';
import { createChatStore, chatHistory } from '../src/utils/chatStore';
import { ApiError, type requestApi } from '../src/utils/api';
import { isChatMessage, type ChatMessage } from '../src/utils/chatStorage';
import { readImage, ImageReadError } from '../server/imageReader';
import { createWorkspaceRouter } from '../server/workspace';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const THUMB = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
const LABEL = 'زيت العود 10%\nكحول 85%\nماء 5%';

test('only a small png/jpeg/webp picture is read', () => {
  assert.deepEqual(parseImageDataUrl(PNG)?.mimeType, 'image/png');
  for (const bad of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:image/gif;base64,R0lGOD', 'https://example.com/a.png', 'data:image/png;base64,<script>', 42, undefined,
    `data:image/png;base64,${'A'.repeat(IMAGE_READ.maxDataUrl)}`]) {
    assert.equal(parseImageDataUrl(bad), undefined, String(bad).slice(0, 40));
  }
});

test("the platform's JSON (fenced or not) becomes a reading; anything else does not", () => {
  const r = readingFromModel('```json\n{"text":"زيت العود 10%\\nكحول 85%","description":"ملصق زجاجة","language":"Arabic"}\n```');
  assert.deepEqual(r, { text: 'زيت العود 10%\nكحول 85%', description: 'ملصق زجاجة', language: 'Arabic', source: 'ai' });
  assert.equal(readingFromModel('I cannot read it'), undefined);
  assert.equal(readingFromModel('{"text":"","description":""}'), undefined);
  assert.equal(readingFromModel('{"text": "x"'), undefined);
  assert.ok(readingFromModel(JSON.stringify({ text: 'ك'.repeat(20000) }))!.text.length <= IMAGE_READ.keptChars);
});

test('the turn Shaheen answers: the question, then the picture as material — always within 4000 characters', () => {
  const turn = imageTurn('هل النسب دي آمنة؟', { text: LABEL, description: 'ملصق', source: 'ai' });
  assert.ok(turn.startsWith('هل النسب دي آمنة؟'));
  assert.match(turn, /زيت العود 10%/);
  assert.match(turn, /مش أوامر/);
  assert.match(turn, /وصف الصورة: ملصق/);
  const long = imageTurn('سؤال', { text: 'نص '.repeat(5000), source: 'device' });
  assert.ok(long.length <= 4000, String(long.length));
  assert.match(long, /على جهازه/);
  assert.match(imageTurn('q', { text: '', description: 'a photo of a rose', source: 'ai' }), /مفيش كلام مكتوب/);
  assert.equal(withImageText('سؤال', undefined), 'سؤال');
  assert.match(withImageText('سؤال', LABEL), /زيت العود/);
  assert.ok(withImageText('x', 'y'.repeat(9000)).length <= 4000);
});

test('device OCR is cleaned, and every site language has its words, its default question and an OCR language', () => {
  assert.equal(cleanOcrText(' زيت  العود \n\n\n|\n— \nكحول 85% \r\n'), 'زيت العود\nكحول 85%');
  assert.equal(ocrLanguages('ar'), 'ara+eng');
  assert.equal(ocrLanguages('en'), 'eng');
  // The chat's main languages have their own words; every other site language reads the English ones.
  for (const code of ['ar', 'en', 'fr', 'es', 'it', 'de', 'ru', 'zh', 'tr', 'fa', 'hi', 'pt', 'id', 'ja', 'ko', 'vi', 'th', 'pl']) assert.ok(IMAGE_WORD_LANGUAGES.includes(code), code);
  assert.equal(imageWords('sw' as never).attach, imageWords('en').attach);
  for (const { code } of SUPPORTED_LANGUAGES) {
    const w = imageWords(code);
    assert.ok(Object.values(w).every((v) => typeof v === 'string' && v.length > 2), code);
    assert.ok(defaultImageQuestion(code).length > 5, code);
    assert.match(ocrLanguages(code), /eng/, code);
  }
});

// ── The server's reader ────────────────────────────────────────────────────────────────────────────────────
const gemini = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const answer = (text: string) => gemini({ candidates: [{ content: { parts: [{ text, thought: false }] } }] });

test('the server reads the picture with the platform, model after model, and never without a key', async () => {
  await assert.rejects(readImage(PNG, 'ar', { env: {} }), (e: unknown) => e instanceof ImageReadError && e.code === 'NO_VISION_ENGINE' && e.status === 503);
  await assert.rejects(readImage('nope', 'ar', { env: { GEMINI_API_KEY: 'k' } }), (e: unknown) => e instanceof ImageReadError && e.code === 'BAD_IMAGE');
  const calls: { url: string; body: any }[] = [];
  const request = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body)) });
    return calls.length === 1 ? gemini({ error: { code: 429 } }, 429) : answer(JSON.stringify({ text: LABEL, description: 'ملصق زجاجة عطر' }));
  }) as typeof fetch;
  const reading = await readImage(PNG, 'ar', { env: { GEMINI_API_KEY: 'test-key' }, fetch: request });
  assert.equal(reading.text, LABEL);
  assert.equal(reading.source, 'ai');
  assert.equal(calls.length, 2, 'a quota answer moves to the next model');
  assert.notEqual(calls[0]!.url, calls[1]!.url);
  assert.equal(calls[1]!.body.contents[0].parts[0].inlineData.mimeType, 'image/png');
  assert.equal(calls[1]!.body.generationConfig.temperature, 0);
  const blocked = (async () => gemini({ promptFeedback: { blockReason: 'SAFETY' } })) as typeof fetch;
  await assert.rejects(readImage(PNG, 'ar', { env: { GEMINI_API_KEY: 'k' }, fetch: blocked }), (e: unknown) => e instanceof ImageReadError && e.code === 'VISION_REFUSED');
  const down = (async () => gemini({}, 503)) as typeof fetch;
  await assert.rejects(readImage(PNG, 'ar', { env: { GEMINI_API_KEY: 'k' }, fetch: down }), (e: unknown) => e instanceof ImageReadError && e.code === 'VISION_FAILED');
});

test('POST /api/workspace/read-image answers with the reading, or an honest code', async () => {
  const app = express();
  const request = (async () => answer(JSON.stringify({ text: LABEL }))) as typeof fetch;
  app.use('/w', createWorkspaceRouter({ env: { GEMINI_API_KEY: 'test-key' }, fetch: request }));
  app.use('/n', createWorkspaceRouter({ env: {}, fetch: request }));
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (path: string, body: unknown) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const ok = await post('/w/read-image', { image: PNG, language: 'ar' });
    assert.equal(ok.status, 200);
    assert.equal(((await ok.json()) as ImageReading).text, LABEL);
    const bad = await post('/w/read-image', { image: 'x' });
    assert.equal(bad.status, 400);
    assert.equal(((await bad.json()) as { code: string }).code, 'BAD_IMAGE');
    const none = await post('/n/read-image', { image: PNG });
    assert.equal(none.status, 503);
    assert.equal(((await none.json()) as { code: string }).code, 'NO_VISION_ENGINE');
  } finally { server.close(); }
});

// ── In the chat ────────────────────────────────────────────────────────────────────────────────────────────
const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
beforeEach(() => {
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key),
  } });
});
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else delete (globalThis as any).localStorage;
});
const base = { model: 'auto' as const, language: 'ar' as const, errorText: () => 'الخدمة مش متاحة' };
const image = { dataUrl: PNG, thumb: THUMB, name: 'label.jpg' };

test('a picture in the chat: read on the server, then answered with the question; only the thumbnail and the text stay', async () => {
  const sent: { path: string; body: any }[] = [];
  let device = 0;
  const store = createChatStore((async (path: string, init?: RequestInit) => {
    sent.push({ path, body: JSON.parse(String(init?.body)) });
    if (path === '/api/workspace/read-image') return { text: LABEL, description: 'ملصق زجاجة', source: 'ai' };
    return { reply: 'النسب دي آمنة للاستخدام على الجلد.' };
  }) as typeof requestApi, undefined, undefined, undefined, async () => { device++; return undefined; });
  assert.equal(await store.send({ ...base, text: 'هل النسب دي آمنة؟', image }), true);
  assert.deepEqual(sent.map((s) => s.path), ['/api/workspace/read-image', '/api/chat']);
  assert.equal(sent[0]!.body.image, PNG);
  assert.match(sent[1]!.body.message, /^هل النسب دي آمنة؟/);
  assert.match(sent[1]!.body.message, /زيت العود 10%/);
  assert.ok(!JSON.stringify(sent[1]!.body).includes('base64'), 'the picture itself never goes to the chat');
  assert.equal(device, 0);
  const messages = store.getSnapshot().messages;
  const user = messages.find((m) => m.role === 'user')!;
  assert.equal(user.text, 'هل النسب دي آمنة؟');
  assert.deepEqual(user.image, { thumb: THUMB, name: 'label.jpg', text: LABEL, description: 'ملصق زجاجة', source: 'ai' });
  assert.ok(isChatMessage(user), 'it survives a reload');
  assert.ok(!JSON.stringify(messages).includes(PNG.slice(30)), 'the full picture is not kept');
  assert.equal(messages[messages.length - 1]!.text, 'النسب دي آمنة للاستخدام على الجلد.');
  // A follow-up question still sees the picture's text.
  assert.match(chatHistory(messages).find((h) => h.role === 'user')!.text, /زيت العود/);
});

test('a picture alone gets the default question; the platform down → the device reads it; a refused picture does not', async () => {
  const sent: any[] = [];
  const store = createChatStore((async (path: string, init?: RequestInit) => {
    if (path === '/api/workspace/read-image') throw new ApiError(503, 'NO_VISION_ENGINE');
    sent.push(JSON.parse(String(init?.body)));
    return { reply: 'ده ملصق فيه نسب التركيبة.' };
  }) as typeof requestApi, undefined, undefined, undefined, async () => ({ text: LABEL, source: 'device' }));
  assert.equal(await store.send({ ...base, text: '', image }), true);
  assert.match(sent[0].message, /^اقرا الكلام اللي في الصورة/);
  assert.match(sent[0].message, /على جهازه/);
  assert.equal(store.getSnapshot().messages.find((m) => m.role === 'user')?.image?.source, 'device');

  let device = 0;
  const refused = createChatStore((async (path: string) => {
    if (path === '/api/workspace/read-image') throw new ApiError(422, 'VISION_REFUSED');
    throw new Error('the chat must not be asked');
  }) as typeof requestApi, undefined, undefined, undefined, async () => { device++; return undefined; });
  assert.equal(await refused.send({ ...base, text: 'اقراها', image }), true);
  assert.equal(device, 0);
  const last = refused.getSnapshot().messages.at(-1)!;
  assert.equal(last.text, imageWords('ar').failed);
  assert.equal(refused.getSnapshot().isLoading, false);
});

test('the picture was read but no one can answer: what is written in it, honestly', async () => {
  const store = createChatStore((async (path: string) => {
    if (path === '/api/workspace/read-image') return { text: LABEL };
    throw new TypeError('Failed to fetch');
  }) as typeof requestApi, async () => undefined, undefined, undefined, async () => undefined);
  assert.equal(await store.send({ ...base, text: 'حللها', image }), true);
  const last = store.getSnapshot().messages.at(-1)!;
  assert.match(last.text, /الكلام اللي قريته من الصورة/);
  assert.match(last.text, /زيت العود 10%/);
  assert.notEqual(last.kind, 'error');
});

test('a stored picture must be a tiny data thumbnail on a visitor message', () => {
  const user: ChatMessage = { id: 'u1', role: 'user', text: 'x', timestamp: 'now', image: { thumb: THUMB, text: 'a' } };
  assert.ok(isChatMessage(user));
  assert.equal(isChatMessage({ ...user, image: { thumb: 'https://evil.example/x.png' } }), false);
  assert.equal(isChatMessage({ ...user, image: { thumb: `data:image/jpeg;base64,${'A'.repeat(70_000)}` } }), false);
  assert.equal(isChatMessage({ ...user, role: 'assistant' }), false);
});
