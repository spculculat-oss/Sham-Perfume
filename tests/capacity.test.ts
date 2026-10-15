import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, test } from 'node:test';
import express from 'express';
import { AnswerCache, GateBusyError, ProviderGate, capacityConfig, normalizeQuestion, retryHintMs } from '../server/core/capacity';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { corsMiddleware } from '../server/cors';
import { createShaheenRouter } from '../server/shaheen';
import { ApiError, type requestApi } from '../src/utils/api';
import { BUSY_RETRIES, createChatStore } from '../src/utils/chatStore';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const openAiReply = (text: string) => json({ choices: [{ message: { role: 'assistant', content: text } }] });
const rateLimited = () => json({ error: { code: 'rate_limit_exceeded', type: 'requests' } }, 429);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRouter(env: Record<string, string>, fetch: typeof globalThis.fetch, run: (base: string) => Promise<void>) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api', createShaheenRouter({ repo: new Repository(new MemoryStore(), {}), env: { OPENAI_API_KEY: 'sk-test', ...env }, fetch }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`); }
  finally { await new Promise((done) => server.close(done)); }
}
const ask = (base: string, body: Record<string, unknown>, headers: Record<string, string> = {}) => fetch(`${base}/chat`, {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify({ model: 'auto', language: 'ar', conversationHistory: [], ...body }),
});

test('questions written slightly differently share one cache entry', () => {
  assert.equal(normalizeQuestion('  ما الفرقُ بين EDP و EDT؟ '), normalizeQuestion('ما الفرق بين edp و edt'));
  assert.equal(normalizeQuestion('أفضل عطر'), normalizeQuestion('افضل عطر?'));
  assert.notEqual(normalizeQuestion('عطر عود'), normalizeQuestion('عطر ورد'));
  assert.equal(retryHintMs('429 RESOURCE_EXHAUSTED · retry in 23s'), 23_000);
  assert.equal(retryHintMs('nothing'), undefined);
});

test('the answer cache is an LRU with expiry, and concurrent loads of one key run once', async () => {
  const cache = new AnswerCache<string>(2, 50);
  let loads = 0;
  const load = async () => { loads++; await sleep(20); return 'answer'; };
  const results = await Promise.all(Array.from({ length: 25 }, () => cache.getOrLoad('k', load)));
  assert.ok(results.every((r) => r === 'answer'));
  assert.equal(loads, 1, '25 identical questions at once → one provider call');
  assert.equal(await cache.getOrLoad('k', load), 'answer');
  assert.equal(loads, 1, 'then served from the cache');
  cache.set('a', '1'); cache.set('b', '2');
  assert.equal(cache.get('k'), undefined, 'least recently used entry evicted (max 2)');
  await sleep(60);
  assert.equal(cache.get('b'), undefined, 'expired');
  // Failed loads are not kept, and the next visitor retries.
  await assert.rejects(cache.getOrLoad('x', async () => { throw new Error('down'); }));
  assert.equal(await cache.getOrLoad('x', async () => 'ok'), 'ok');
});

test('the gate paces a provider after a 429 (AIMD) and honours its retry hint', async () => {
  const gate = new ProviderGate(10, 0);
  let calls = 0;
  const outcome: Array<'ok' | 'limited'> = ['ok', 'ok', 'ok', 'ok', 'limited'];
  for (let i = 0; i < 5; i++) {
    await gate.run(['a'], async () => { calls++; return outcome[i] === 'ok' ? { outcome: 'ok', value: i } : { outcome: 'limited', retryMs: 1500 } }).catch(() => {});
  }
  assert.equal(calls, 5);
  const state = gate.snapshot().a;
  assert.equal(state.rpm, 2, 'first refusal: pace = half of the 4 accepted this minute (the refused one used no quota)');
  assert.ok(state.coolingMs > 1000 && state.coolingMs <= 1500, 'paused for the delay the provider asked for');
  assert.equal(gate.canStart('a'), false);
  // Nobody may queue (maxWait 0): busy with a Retry-After of about the remaining pause.
  await assert.rejects(gate.run(['a'], async () => ({ outcome: 'ok', value: 1 })), (e: unknown) => e instanceof GateBusyError && e.retryAfterMs >= 1000);
  // With a second provider the question goes there instead of waiting.
  assert.equal(await gate.run(['a', 'b'], async (id) => ({ outcome: 'ok', value: id })), 'b');
  // A known quota can be configured; it is never "learned" away.
  const fixed = new ProviderGate(10, 0, { a: 2 });
  for (let i = 0; i < 2; i++) await fixed.run(['a'], async () => ({ outcome: 'ok', value: i }));
  assert.equal(fixed.canStart('a'), false, '2 per minute');
  assert.equal(capacityConfig({ SHAM_GEMINI_RPM: '1000' }).providerRpm.gemini, 1000);
  assert.deepEqual(capacityConfig({}).providerRpm, {});
});

test('router: 60 visitors asking the same opening question at once cost one provider call', async () => {
  let calls = 0;
  const fake = (async () => { calls++; await sleep(80); return openAiReply('الفرق في نسبة الزيت.'); }) as typeof fetch;
  await withRouter({}, fake, async (base) => {
    const replies = await Promise.all(Array.from({ length: 60 }, (_, i) =>
      ask(base, { message: i % 2 ? 'ما الفرق بين EDP و EDT؟' : 'ما الفرق بين edp و edt' }, { 'x-forwarded-for': `10.1.0.${i + 1}` })));
    assert.deepEqual([...new Set(replies.map((r) => r.status))], [200]);
    assert.equal(calls, 1);
    assert.equal((await (await ask(base, { message: 'ما الفرق بين EDP و EDT' }, { 'x-forwarded-for': '10.2.0.1' })).json()).reply, 'الفرق في نسبة الزيت.');
    assert.equal(calls, 1, 'later visitors are answered from the cache');
    // A follow-up depends on the conversation: never cached.
    await ask(base, { message: 'ما الفرق بين EDP و EDT؟', conversationHistory: [{ role: 'user', text: 'مرحبا' }, { role: 'assistant', text: 'أهلاً' }] }, { 'x-forwarded-for': '10.2.0.2' });
    assert.equal(calls, 2);
  });
  calls = 0;
  await withRouter({ SHAM_ANSWER_CACHE_MINUTES: '0' }, fake, async (base) => {
    await ask(base, { message: 'سؤال' }); await ask(base, { message: 'سؤال' });
    assert.equal(calls, 2, 'the cache can be turned off');
  });
});

test('router: visitors behind one shared IP have their own quota, bounded per IP', async () => {
  const fake = (async () => openAiReply('رد')) as typeof fetch;
  await withRouter({ SHAM_SHAHEEN_RATE_PER_MIN: '1', SHAM_SHAHEEN_RATE_PER_IP_MIN: '5' }, fake, async (base) => {
    const shared = { 'x-forwarded-for': '41.33.0.7' };
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await ask(base, { message: `سؤال ${i}` }, { ...shared, 'x-sham-visitor': `visitor-${i}-abcdef` })).status);
    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429], 'five people on one carrier IP, then the per-IP ceiling');
    const own = { 'x-forwarded-for': '41.33.0.8', 'x-sham-visitor': 'visitor-same-123' };
    assert.equal((await ask(base, { message: 'أ' }, own)).status, 200);
    assert.equal((await ask(base, { message: 'ب' }, own)).status, 429, 'one visitor is still limited');
    const bogus = { 'x-forwarded-for': '41.33.0.9', 'x-sham-visitor': '<script>' };
    assert.equal((await ask(base, { message: 'ج' }, bogus)).status, 200);
    assert.equal((await ask(base, { message: 'د' }, { ...bogus, 'x-sham-visitor': 'other' })).status, 429, 'invalid ids fall back to the IP');
  });
});

test('router: a provider 429 makes visitors wait in line, then answers, or says busy with Retry-After', async () => {
  let calls = 0;
  const flaky = (async () => { calls++; return calls === 1 ? rateLimited() : openAiReply('تم'); }) as typeof fetch;
  await withRouter({ SHAM_QUEUE_WAIT_SECONDS: '6' }, flaky, async (base) => {
    const started = Date.now();
    const response = await ask(base, { message: 'سؤال واحد' });
    assert.equal(response.status, 200, 'the visitor waited for the provider to reopen instead of getting an error');
    assert.equal((await response.json()).reply, 'تم');
    assert.ok(Date.now() - started >= 1500, 'it respected the pause after the 429');
    assert.equal(calls, 2);
  });
  calls = 0;
  const refusing = (async () => { calls++; return rateLimited(); }) as typeof fetch;
  await withRouter({ SHAM_QUEUE_WAIT_SECONDS: '0' }, refusing, async (base) => {
    const first = await ask(base, { message: 'أ' });
    assert.equal(first.status, 503);
    assert.equal((await first.json()).code, 'SHAHEEN_BUSY');
    assert.ok(Number(first.headers.get('retry-after')) >= 1);
    const second = await ask(base, { message: 'ب' });
    assert.equal(second.status, 503);
    assert.equal(calls, 1, 'while paused the provider is not called again');
  });
});

test('CORS lets the Pages site send the visitor id and read Retry-After', async () => {
  const app = express();
  app.use('/api', corsMiddleware(undefined));
  app.post('/api/chat', (_req, res) => { res.setHeader('Retry-After', '5'); res.status(503).json({ code: 'SHAHEEN_BUSY' }); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const origin = 'https://spculculat-oss.github.io';
    const pre = await fetch(`${base}/api/chat`, { method: 'OPTIONS', headers: { origin, 'access-control-request-headers': 'content-type,x-sham-visitor' } });
    assert.match(pre.headers.get('access-control-allow-headers') || '', /X-Sham-Visitor/);
    const res = await fetch(`${base}/api/chat`, { method: 'POST', headers: { origin } });
    assert.match(res.headers.get('access-control-expose-headers') || '', /Retry-After/);
  } finally { await new Promise((done) => server.close(done)); }
});

// ---------- browser side ----------
const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
beforeEach(() => {
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k),
  } });
});
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else delete (globalThis as { localStorage?: unknown }).localStorage;
});
const options = { text: 'سؤال', model: 'auto' as const, language: 'ar' as const, errorText: (e: unknown) => (e instanceof ApiError ? e.code || 'x' : 'x') };

test('the chat waits in line by itself when Shaheen is busy, and sends an anonymous visitor id', async () => {
  const seen: { visitor?: string; timeout?: number }[] = [];
  const waits: number[] = [];
  let calls = 0;
  const request = (async (_path: string, init?: RequestInit, timeout?: number) => {
    seen.push({ visitor: (init?.headers as Record<string, string>)['X-Sham-Visitor'], timeout });
    if (++calls <= 2) throw new ApiError(503, 'SHAHEEN_BUSY', 7000);
    return { reply: 'أهلاً' };
  }) as typeof requestApi;
  const busySeen: boolean[] = [];
  const store = createChatStore(request, async (ms) => { waits.push(ms); busySeen.push(Boolean(store.getSnapshot().busy)); });
  assert.equal(await store.send(options), true);
  const snap = store.getSnapshot();
  assert.equal(snap.messages.at(-1)?.text, 'أهلاً', 'answered after waiting, no error bubble');
  assert.equal(snap.busy, false);
  assert.deepEqual(busySeen, [true, true], 'the "in line" note is shown while waiting');
  assert.ok(waits.every((ms) => ms >= 5600 && ms <= 8400), 'waits as long as the server asked (±20 % jitter)');
  assert.match(seen[0].visitor || '', /^[A-Za-z0-9_-]{8,64}$/);
  assert.ok(seen.every((s) => s.visitor === seen[0].visitor), 'the same id on every request');
  assert.ok((seen[0].timeout || 0) > 50_000, 'long enough for a queued answer');

  calls = -100; // always busy now
  const giveUp = createChatStore((async () => { throw new ApiError(503, 'SHAHEEN_BUSY'); }) as typeof requestApi, async () => {});
  await giveUp.send(options);
  const last = giveUp.getSnapshot().messages.at(-1);
  assert.equal(last?.kind, 'error');
  assert.equal(last?.text, 'SHAHEEN_BUSY', `gives up after ${BUSY_RETRIES} retries with the busy message`);
  // Other errors are not retried.
  let tries = 0;
  const other = createChatStore((async () => { tries++; throw new ApiError(429, 'RATE_LIMITED'); }) as typeof requestApi, async () => {});
  await other.send(options);
  assert.equal(tries, 1);
});
