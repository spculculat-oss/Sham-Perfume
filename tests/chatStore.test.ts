import assert from 'node:assert/strict';
import { beforeEach, afterEach, test } from 'node:test';
import { catalogReply, createChatStore, chatHistory, isShoppingQuestion } from '../src/utils/chatStore';
import { ApiError } from '../src/utils/api';
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
  for (const result of [null, { reply: '' }, { reply: 'hi', engine: { id: 'auto', provider: 'unknown' } }]) {
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

test('retry re-asks the question behind a trailing error bubble and replaces it with the answer', async () => {
  let calls = 0;
  const store = createChatStore((async () => {
    calls++;
    if (calls === 1) throw new Error('down');
    return { reply: 'Second time lucky', engine: { id: 'self_hosted', provider: 'self_hosted', name: 'Self-hosted', badge: 'Self-hosted', model: 'qwen' } };
  }) as typeof requestApi);
  await store.send(options);
  const failed = store.getSnapshot().messages;
  assert.equal(failed[failed.length - 1].kind, 'error');
  assert.equal(await store.retry({ model: 'auto', language: 'en', errorText: () => 'x' }), true);
  const after = store.getSnapshot().messages;
  assert.equal(calls, 2);
  assert.deepEqual(after.slice(-2).map((m) => [m.role, m.text]), [['user', 'My perfume'], ['assistant', 'Second time lucky']]);
  assert.equal(after.filter((m) => m.kind === 'error').length, 0);
  assert.equal(await store.retry({ model: 'auto', language: 'en', errorText: () => 'x' }), false, 'nothing to retry');
});

test('replies in the current server shape (mode + anonymous Shaheen engine) are accepted', async () => {
  const engine = { id: 'deep', provider: 'shaheen', name: 'الخبير شاهين', badge: 'شاهين', accentColor: 'amber' };
  const store = createChatStore((async () => ({ reply: 'تحليل', mode: 'deep', engine })) as typeof requestApi);
  await store.send(options);
  const last = store.getSnapshot().messages.at(-1);
  assert.equal(last?.kind, undefined);
  assert.equal(last?.text, 'تحليل');
  assert.equal(last?.aiEngine?.id, 'deep');
});

test('a bare greeting is answered locally at once, without calling the AI', async () => {
  let calls = 0;
  const store = createChatStore((async () => { calls++; return { reply: 'AI tip about DPG' }; }) as typeof requestApi);
  assert.equal(await store.send({ ...options, text: 'السلام عليكم', language: 'ar' }), true);
  assert.equal(calls, 0);
  const [, question, answer] = store.getSnapshot().messages;
  assert.equal(question.text, 'السلام عليكم');
  assert.match(answer.text, /^وعليكم السلام/);
  assert.equal(answer.aiEngine?.provider, 'shaheen');
  assert.equal(store.getSnapshot().isLoading, false);
  await store.send({ ...options, text: 'what is the best winter blend?' });
  assert.equal(calls, 1, 'Real questions still go to Shaheen');
});

test('another tab saving its chat no longer swallows the answer in flight', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const events = new EventTarget();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: events });
  const pending = deferred();
  const store = createChatStore((async () => pending.promise) as typeof requestApi);
  const unsubscribe = store.subscribe(() => {});
  try {
    const sending = store.send(options);
    const event = new Event('storage');
    Object.defineProperty(event, 'key', { value: CHAT_STORAGE_KEY });
    Object.defineProperty(event, 'newValue', { value: memory.get(CHAT_STORAGE_KEY) ?? '{}' });
    events.dispatchEvent(event);
    pending.resolve({ reply: 'The winter blend' });
    assert.equal(await sending, true);
    const messages = store.getSnapshot().messages;
    assert.equal(messages[messages.length - 1].text, 'The winter blend');
    assert.equal(store.getSnapshot().isLoading, false);
  } finally {
    unsubscribe();
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else delete (globalThis as any).window;
  }
});

test('«ترشيح المتجر»: a shopping question no engine could answer gets labelled store picks; formulas go to his designer', async () => {
  assert.ok(isShoppingQuestion('عايز عطر رجالي هدية بـ 500'));
  assert.ok(isShoppingQuestion('Can you recommend a fresh perfume?'));
  assert.ok(!isShoppingQuestion('اعمل لي تركيبة عطر عود بنسب'), 'formula requests are for the expert');
  assert.ok(!isShoppingQuestion('ما هو تاريخ العطور؟'));

  const pick = (name: string, inStock = true) => ({ product: { name: { ar: name, en: name }, slug: name.toLowerCase(), inStock }, why: 'خشبي' });
  const reply = catalogReply([pick('Oud'), pick('Gone', false), pick('Rose'), pick('Musk'), pick('Amber')], 'ar', (slug) => `https://shop.example/p/${slug}.html`)!;
  assert.match(reply, /\[Oud\]\(https:\/\/shop\.example\/p\/oud\.html\) — خشبي/);
  assert.doesNotMatch(reply, /Gone|Amber/, 'in stock only, three at most');
  assert.match(reply, /ترشيح من فلتر المتجر/);
  assert.equal(catalogReply([pick('Gone', false)], 'ar', () => undefined), undefined);

  const down = (async () => { throw new ApiError(503, 'ENGINES_DOWN'); }) as typeof requestApi;
  const noMemory = { learn: () => {}, recall: async () => undefined } as any;
  const asked: string[] = [];
  const catalog = async (text: string) => { asked.push(text); return 'store picks'; };
  const shop = createChatStore(down, async () => {}, noMemory, catalog);
  await shop.send({ ...options, model: 'fast', text: 'recommend a gift perfume' });
  const last = shop.getSnapshot().messages.at(-1)!;
  assert.equal(last.text, 'store picks');
  assert.equal(last.kind, undefined, 'an answer, not an error bubble');
  assert.equal(last.aiEngine?.provider, 'shaheen');

  const formula = createChatStore(down, async () => {}, noMemory, catalog);
  await formula.send({ ...options, model: 'fast', text: 'write me a formula with ratios' });
  // «مصمم شاهين الذاتي»: a formula request with no direction gets his question back, not store picks or a guess.
  assert.equal(formula.getSnapshot().messages.at(-1)!.kind, undefined);
  assert.match(formula.getSnapshot().messages.at(-1)!.text || '', /direction/);
  const vague = createChatStore(down, async () => {}, noMemory, catalog);
  await vague.send({ ...options, model: 'fast', text: 'tell me about the history of perfume' });
  assert.equal(vague.getSnapshot().messages.at(-1)!.kind, 'error');
  assert.deepEqual(asked, ['recommend a gift perfume']);

  const refused = createChatStore((async () => { throw new ApiError(429, 'RATE_LIMITED'); }) as typeof requestApi, async () => {}, noMemory, catalog);
  await refused.send({ ...options, model: 'fast', text: 'recommend a gift perfume' });
  assert.equal(refused.getSnapshot().messages.at(-1)!.kind, 'error', 'limits are not hidden behind store picks');
});

test('«مصمم شاهين الذاتي»: with no server answer, a design request is designed right in the browser', async () => {
  const down = (async () => { throw new ApiError(503, 'PROVIDER_NOT_CONFIGURED'); }) as typeof requestApi;
  const noMemory = { learn: () => {}, recall: async () => undefined } as any;
  const store = createChatStore(down, async () => {}, noMemory, async () => undefined);
  await store.send({ ...options, model: 'fast', text: 'صمم لي خلطة شتوية فيها عود' });
  const last = store.getSnapshot().messages.at(-1)!;
  assert.equal(last.kind, undefined);
  assert.equal(last.aiEngine?.provider, 'shaheen');
  assert.match(last.text || '', /sham-formula/);
  assert.match(last.text || '', /عود/);
  // A follow-up to his formula changes it.
  await store.send({ ...options, model: 'fast', text: 'خليه أحلى' });
  assert.match(store.getSnapshot().messages.at(-1)!.text || '', /حلو/);
});
