import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { createToolAgentRouter } from '../server/agentRouter';
import { SHAHEEN_SITE_SETTINGS } from '../server/config/shaheen';
import type { Repository } from '../server/core/repository';

async function withRouter(options: Parameters<typeof createToolAgentRouter>[0], run: (url: string) => Promise<void>) {
  const app = express(); app.use(express.json()); app.use('/api/agent', createToolAgentRouter(options));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address() as { port: number };
  try { await run(`http://127.0.0.1:${address.port}/api/agent`); }
  finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
}
const repo = (enabled = true) => ({ settings: async () => ({ shaheen: { ...SHAHEEN_SITE_SETTINGS, enabled, engines: ['gemini'] } }) }) as unknown as Repository;
const post = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('agent route uses current admin settings and returns public identity, actual tools and no provider metadata', async () => {
  let calls = 0;
  await withRouter({ repo: repo(), env: { GEMINI_API_KEY: 'test', SHAM_LIVE_DATA: 'off' }, fetch: (async () => {
    calls++;
    const action = calls === 1 ? { type: 'tool', tool: 'calculate', arguments: { operation: 'multiply', values: [10, 50] } }
      : { type: 'final', reply: 'Total volume is 500 ml.' };
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(action) }] } }] });
  }) as typeof fetch }, async (url) => {
    const response = await fetch(`${url}/chat`, post({ message: 'Compute ten times fifty', language: 'en' }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const data = await response.json();
    assert.equal(data.engine.provider, 'shaheen');
    assert.equal(JSON.stringify(data).includes('gemini'), false);
    assert.deepEqual(data.toolReport.steps, [{ tool: 'calculate', status: 'completed' }]);
  });
  assert.equal(calls, 2);
});

test('agent refuses disabled administration, invalid attachments and invalid search consent', async () => {
  await withRouter({ repo: repo(false), env: {} }, async (url) => {
    const caps = await (await fetch(`${url}/capabilities`)).json();
    assert.equal(caps.enabled, false); assert.deepEqual(caps.tools, []);
    const response = await fetch(`${url}/chat`, post({ message: 'Compute ten times fifty' }));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'SHAHEEN_DISABLED');
  });
  await withRouter({ repo: repo(), env: {} }, async (url) => {
    for (const extra of [{ documents: [{ name: 'file.pdf', text: 'not supported' }] }, { webSearch: 'true' }]) {
      const response = await fetch(`${url}/chat`, post({ message: 'Compute ten times fifty', ...extra }));
      assert.equal(response.status, 400);
      assert.equal((await response.json()).code, 'INVALID_AGENT_REQUEST');
    }
  });
});

test('agent honors owner shutdown for external search and per-visitor request limits', async () => {
  await withRouter({ repo: repo(), env: { SHAM_AI_PLATFORMS: 'off', BRAVE_SEARCH_API_KEY: 'test', SHAM_SHAHEEN_RATE_PER_MIN: '1' } }, async (url) => {
    const caps = await (await fetch(`${url}/capabilities`)).json();
    assert.equal(caps.tools.includes('web_search'), false);
    const first = await fetch(`${url}/chat`, post({ message: 'Compute ten times fifty' }));
    assert.equal(first.status, 503);
    const second = await fetch(`${url}/chat`, post({ message: 'Compute ten times fifty' }));
    assert.equal(second.status, 429);
    assert.equal(second.headers.get('retry-after'), '60');
  });
});
