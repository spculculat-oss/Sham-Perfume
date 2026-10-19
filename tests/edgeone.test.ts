import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { createStore, MemoryStore } from '../server/core/store';
import { engineStatuses, openCompatibleEngine, EDGEONE_GATEWAY_URL, EDGEONE_DEFAULT_MODEL } from '../server/core/engines';

test('the OpenAI-compatible engine can use Tencent EdgeOne\'s model gateway key on its own', () => {
  assert.equal(openCompatibleEngine({}), null);
  assert.deepEqual(openCompatibleEngine({ AI_GATEWAY_API_KEY: 'eo-key' }),
    { baseUrl: EDGEONE_GATEWAY_URL, apiKey: 'eo-key', model: EDGEONE_DEFAULT_MODEL, gateway: true });
  // An explicit self-hosted server always wins over the gateway.
  assert.equal(openCompatibleEngine({ SHAM_LLM_BASE_URL: 'http://127.0.0.1:11434/v1', AI_GATEWAY_API_KEY: 'eo-key' })!.gateway, false);
  const status = engineStatuses({ AI_GATEWAY_API_KEY: 'eo-key', SHAM_LLM_MODEL: '@makers/hy3' }).find((s) => s.id === 'self_hosted')!;
  assert.deepEqual([status.configured, status.model, status.name], [true, '@makers/hy3', 'Tencent EdgeOne Models']);
});

test('serverless platforms default to the memory store (no durable disk)', () => {
  assert.ok(createStore({ SHAM_SERVERLESS: '1' }) instanceof MemoryStore);
  assert.ok(createStore({ VERCEL: '1' }) instanceof MemoryStore);
});

test('EdgeOne function: one app per instance, /api prefix restored, per-visitor limits by EO-Connecting-IP', async () => {
  // Every engine key off (the robots' workflows carry real keys in their environment).
  const names = ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DEEPSEEK_API_KEY', 'OPENROUTER_API_KEY',
    'PERPLEXITY_API_KEY', 'SHAM_LLM_BASE_URL', 'SHAM_LLM_API_KEY', 'AI_GATEWAY_API_KEY', 'SHAM_SHAHEEN_RATE_PER_MIN'];
  const saved = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  for (const n of names) delete process.env[n];
  process.env.SHAM_SHAHEEN_RATE_PER_MIN = '2';
  const { default: app } = await import('../cloud-functions/api/[[default]]');
  assert.equal(process.env.SHAM_PLATFORM, 'edgeone');
  assert.equal((globalThis as { __shamEdgeOneApp?: unknown }).__shamEdgeOneApp, app, 'the app is cached on globalThis');
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    // With and without the mount prefix (the runtime may strip it).
    for (const path of ['/api/health', '/health']) {
      const res = await fetch(base + path);
      assert.equal(res.status, 200, path);
      const health = await res.json();
      assert.deepEqual({ service: health.service, status: health.status }, { service: 'sham-perfume', status: 'ok' });
      assert.equal(typeof health.version, 'string', 'deployed commit, read by the maintenance agent');
    }
    const chat = (ip: string) => fetch(`${base}/api/chat`, { method: 'POST',
      headers: { 'content-type': 'application/json', 'eo-connecting-ip': ip }, body: JSON.stringify({ message: 'hi' }) });
    // No engines configured → 503, but each call still counts towards that visitor's limit.
    assert.equal((await chat('41.33.1.1')).status, 503);
    assert.equal((await chat('41.33.1.1')).status, 503);
    assert.equal((await chat('41.33.1.1')).status, 429);
    assert.equal((await chat('197.1.1.9')).status, 503, 'another visitor has their own limit');
  } finally {
    for (const n of names) { if (saved[n] !== undefined) process.env[n] = saved[n]; else delete process.env[n]; }
    await new Promise((done) => server.close(done));
  }
});
