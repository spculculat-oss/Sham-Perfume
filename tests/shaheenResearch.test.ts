import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import { emptyMemory } from '../src/utils/shaheenMemory';
import { PERPLEXITY_AGENT_URL } from '../server/core/engines';
import { ShaheenMemory } from '../server/core/memory';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { createShaheenRouter } from '../server/shaheen';

const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });

test('live-search links stay hidden until requested, and the unreviewed answer is not learned into school memory', async () => {
  const urls: string[] = [];
  const request = (async (url: string | URL | Request) => {
    urls.push(String(url));
    assert.equal(String(url), PERPLEXITY_AGENT_URL);
    return json({ output: [
      { type: 'search_results', results: [{ title: 'دراسة منشورة', url: 'https://example.org/paper' }] },
      { type: 'message', content: [{ type: 'output_text', text: 'ملخص بحثي [1]' }] },
    ] });
  }) as typeof fetch;
  const store = new MemoryStore();
  const memory = new ShaheenMemory(store, {}, request, emptyMemory());
  const app = express();
  app.use(express.json());
  app.use('/api', createShaheenRouter({
    repo: new Repository(new MemoryStore(), {}),
    env: { PERPLEXITY_API_KEY: 'test-key', SHAM_ANSWER_CACHE_MINUTES: '0' },
    fetch: request,
    memory,
    library: async () => ({ lessons: [], materials: [] }),
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  try {
    const response = await fetch(`${base}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'auto', language: 'ar', conversationHistory: [], message: 'ايه هو البخور؟' }) });
    assert.equal(response.status, 200);
    const body = await response.json() as { reply: string; sources?: { title: string; url: string }[]; engine: { provider: string } };
    assert.doesNotMatch(body.reply, /دراسة منشورة|example\.org/, 'sources are hidden from ordinary replies');
    assert.deepEqual(body.sources, [{ title: 'دراسة منشورة', url: 'https://example.org/paper' }]);
    assert.equal(body.engine.provider, 'shaheen', 'vendor identity stays private');
    assert.deepEqual(urls, [PERPLEXITY_AGENT_URL]);
    const sourceResponse = await fetch(`${base}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'auto', language: 'ar', message: 'مصدر؟', conversationHistory: [
        { role: 'user', text: 'ايه هو البخور؟' }, { role: 'assistant', text: body.reply, sources: body.sources },
      ] }) });
    const sourceBody = await sourceResponse.json() as { reply: string; sources?: { title: string; url: string }[] };
    assert.match(sourceBody.reply, /\[دراسة منشورة\]\(https:\/\/example\.org\/paper\)/);
    assert.deepEqual(sourceBody.sources, body.sources, 'a source reply retains its metadata for repeated requests');
    assert.deepEqual(urls, [PERPLEXITY_AGENT_URL], 'the saved source links answer the follow-up without a second search');
    assert.deepEqual((await memory.learned()).entries, [], 'web research remains a visitor-only, unreviewed answer');
  } finally { await new Promise((done) => server.close(done)); }
});
