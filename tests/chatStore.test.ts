import assert from 'node:assert/strict';
import { beforeEach, afterEach, test } from 'node:test';
import { createChatStore, chatHistory } from '../src/utils/chatStore';
import { CHAT_STORAGE_KEY, DEFAULT_WELCOME_MESSAGE, THIRTY_DAYS_MS, loadStoredChatSession, saveChatSession, type ChatMessage } from '../src/utils/chatStorage';
import type { requestApi } from '../src/utils/api';

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let memory: Map<string, string>;
beforeEach(() => {
  memory = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  } });
});
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else delete (globalThis as any).localStorage;
});
const options = { text: 'My perfume', model: 'auto' as const, language: 'en' as const, errorText: () => 'Service unavailable' };
const message = (id: string): ChatMessage => ({ id, role: 'user', text: 'hi', timestamp: 'now' });
function deferred() {
  let resolve!: (data: any) => void;
  const promise = new Promise<any>((done) => { resolve = done; });
  return { promise, resolve };
}

test('both chat surfaces share one synchronous lock and receive each update once', async () => {
  const pending = deferred();
  let calls = 0;
  const store = createChatStore((async () => { calls++; return pending.promise; }) as typeof requestApi);
  let floating = 0; let lab = 0;
  const stopFloating = store.subscribe(() => { floating++; });
  const stopLab = store.subscribe(() => { lab++; });
  try {
    const first = store.send(options);
    assert.equal(store.getSnapshot().isLoading, true);
    assert.equal(await store.send(options), false);
    assert.equal(calls, 1);
    pending.resolve({ reply: 'A real reply' });
    await first;
    assert.equal(store.getSnapshot().isLoading, false);
    assert.equal(store.getSnapshot().messages.length, 3);
    assert.equal(floating, 2);
    assert.equal(lab, 2);
    assert.equal(store.getSnapshot(), store.getSnapshot(), 'Snapshot must be stable for useSyncExternalStore');
  } finally { stopFloating(); stopLab(); }
});

test('clearing history aborts in-flight requests and late responses cannot resurrect deleted chat', async () => {
  const pending = deferred();
  let signal: AbortSignal | undefined;
  const store = createChatStore((async (_url, init) => { signal = init?.signal as AbortSignal; return pending.promise; }) as typeof requestApi);
  const sending = store.send(options);
  store.clear();
  assert.equal(signal?.aborted, true);
  pending.resolve({ reply: 'Late private reply' });
  await sending;
  assert.deepEqual(store.getSnapshot().messages, [DEFAULT_WELCOME_MESSAGE]);
  assert.equal(store.getSnapshot().isLoading, false);
  assert.ok(!memory.get(CHAT_STORAGE_KEY)?.includes('Late private'));
});

test('a new request after clear is not overwritten by the old request finalizer', async () => {
  const old = deferred(); const fresh = deferred(); let calls = 0;
  const store = createChatStore((async () => ++calls === 1 ? old.promise : fresh.promise) as typeof requestApi);
  const first = store.send(options);
  store.clear();
  const second = store.send({ ...options, text: 'New conversation' });
  old.resolve({ reply: 'Old response' });
  await first;
  assert.equal(store.getSnapshot().isLoading, true);
  fresh.resolve({ reply: 'New response' });
  await second;
  assert.equal(store.getSnapshot().messages.at(-1)?.text, 'New response');
  assert.equal(store.getSnapshot().isLoading, false);
});

test('history includes current conversation, excludes welcome/error text and passes the selected language', async () => {
  let body: any;
  const store = createChatStore((async (_url, init) => { body = JSON.parse(String(init?.body)); return { reply: 'Bonjour' }; }) as typeof requestApi);
  store.setMessages([DEFAULT_WELCOME_MESSAGE, message('user-1'), { ...message('bot-err-1'), role: 'assistant', kind: 'error' }]);
  await store.send({ ...options, language: 'fr', text: 'Et ensuite ?' });
  assert.equal(body.language, 'fr');
  assert.equal(body.message, 'Et ensuite ?');
  assert.deepEqual(body.conversationHistory, [{ role: 'user', text: 'hi' }]);
});

test('upstream failures and invalid replies release the lock and are marked as errors', async () => {
  for (const result of [null, { reply: '' }, { reply: 'hi', perspectives: [null] }]) {
    const store = createChatStore((async () => result) as typeof requestApi);
    await store.send(options);
    assert.equal(store.getSnapshot().isLoading, false);
    assert.equal(store.getSnapshot().messages.at(-1)?.kind, 'error');
    assert.equal(store.getSnapshot().messages.at(-1)?.text, 'Service unavailable');
    assert.ok(chatHistory(store.getSnapshot().messages).every((turn) => turn.text !== 'Service unavailable'));
  }
});

test('history payloads stay within server limits without mutating stored messages', () => {
  const messages = Array.from({ length: 100 }, (_, i) => ({ ...message(String(i)), text: 'x'.repeat(1000) }));
  const history = chatHistory(messages);
  assert.equal(history.length, 16);
  assert.equal(history.reduce((size, turn) => size + turn.text.length, 0), 16000);
  assert.equal(messages.length, 100);
});

test('corrupt dates, unsafe message shapes and invalid JSON cannot break history rendering', () => {
  const now = Date.now();
  for (const raw of ['null', '{broken', '{}', JSON.stringify({ version: 1, messages: [message('x')] }),
    JSON.stringify({ version: 1, createdAt: now, expiresAt: now + THIRTY_DAYS_MS * 2, messages: [message('x')] }),
    JSON.stringify({ version: 1, createdAt: now - 1000, expiresAt: now + 1000, messages: [null, { ...message('x'), text: 4 }] }),
  ]) {
    memory.set(CHAT_STORAGE_KEY, raw);
    const session = loadStoredChatSession();
    assert.deepEqual(session.messages, [DEFAULT_WELCOME_MESSAGE]);
    assert.equal(session.daysRemaining, 30);
  }
});

test('expiry is enforced at the exact deadline and saving does not extend a valid session', () => {
  const now = Date.now(); const createdAt = now - 86400000; const expiresAt = createdAt + THIRTY_DAYS_MS;
  memory.set(CHAT_STORAGE_KEY, JSON.stringify({ version: 1, createdAt, expiresAt, messages: [message('user-1')] }));
  saveChatSession([message('user-2')]);
  const saved = JSON.parse(memory.get(CHAT_STORAGE_KEY)!);
  assert.equal(saved.createdAt, createdAt);
  assert.equal(saved.expiresAt, expiresAt);
  memory.set(CHAT_STORAGE_KEY, JSON.stringify({ ...saved, createdAt: now - THIRTY_DAYS_MS, expiresAt: now }));
  const expired = loadStoredChatSession();
  assert.equal(expired.isExpiredPurged, true);
  assert.deepEqual(expired.messages, [DEFAULT_WELCOME_MESSAGE]);
});

test('storage denial still permits an in-memory conversation and clear', async () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('denied'); } });
  const store = createChatStore((async () => ({ reply: 'Still works' })) as typeof requestApi);
  await store.send(options);
  assert.equal(store.getSnapshot().messages.at(-1)?.text, 'Still works');
  store.clear();
  assert.equal(store.getSnapshot().messages.length, 1);
});

test('cross-tab clears synchronize without echo writes and invalidate pending answers', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const events = new EventTarget();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: events });
  const pending = deferred();
  const store = createChatStore((async () => pending.promise) as typeof requestApi);
  const unsubscribe = store.subscribe(() => {});
  try {
    const sending = store.send(options);
    memory.clear();
    const event = new Event('storage');
    Object.defineProperty(event, 'key', { value: CHAT_STORAGE_KEY });
    events.dispatchEvent(event);
    pending.resolve({ reply: 'Late answer' });
    await sending;
    assert.deepEqual(store.getSnapshot().messages, [DEFAULT_WELCOME_MESSAGE]);
    assert.equal(memory.has(CHAT_STORAGE_KEY), false, 'Storage events must not rebroadcast by writing back');
    assert.equal(store.getSnapshot().isLoading, false);
  } finally {
    unsubscribe();
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else delete (globalThis as any).window;
  }
});

test('loading history removes empty messages and duplicate IDs and caps records at 200', () => {
  const now = Date.now();
  memory.set(CHAT_STORAGE_KEY, JSON.stringify({ version: 1, createdAt: now, expiresAt: now + THIRTY_DAYS_MS,
    messages: [message('duplicate'), message('duplicate'), { ...message('empty'), text: ' ' },
      ...Array.from({ length: 210 }, (_, index) => message(String(index)))],
  }));
  const session = loadStoredChatSession();
  assert.equal(session.messages.length, 200);
  assert.equal(new Set(session.messages.map((item) => item.id)).size, 200);
  assert.ok(session.messages.every((item) => item.text.trim()));
});
