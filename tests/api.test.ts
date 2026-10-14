import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { requestApi } from '../src/utils/api';

const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' };

test('API requests keep the same-origin URL and POST body', async (t) => {
  const options = { method: 'POST', body: JSON.stringify({ message: 'hello' }) };
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    new Response(JSON.stringify({ reply: 'ok' }), { headers: jsonHeaders }),
  );

  assert.deepEqual(await requestApi('/api/chat', options), { reply: 'ok' });
  assert.deepEqual(fetchMock.mock.calls[0].arguments, ['/api/chat', options]);
});

for (const status of [404, 500, 503]) {
  test(`HTTP ${status} is rejected instead of treated as a successful reply`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => new Response('{"error":"unavailable"}', {
      status,
      headers: jsonHeaders,
    }));
    await assert.rejects(requestApi('/api/news'), new RegExp(`API request failed \\(${status}\\)`));
  });
}

test('a 200 SPA fallback is not parsed as API JSON', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>SPA fallback</html>', {
    headers: { 'Content-Type': 'text/html' },
  }));
  await assert.rejects(requestApi('/api/chat'), /Expected JSON/);
});

test('invalid JSON and network errors propagate to the error UI', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    new Response('broken JSON', { headers: jsonHeaders }),
  );
  await assert.rejects(requestApi('/api/news'), SyntaxError);

  fetchMock.mock.mockImplementation(async () => { throw new Error('offline'); });
  await assert.rejects(requestApi('/api/news'), /offline/);
});

test('the Pages bundle rejects API calls without making any network request', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response());
  const result = await build({
    entryPoints: ['src/utils/api.ts'],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'esm',
    define: { 'import.meta.env': JSON.stringify({ MODE: 'pages' }) },
  });
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`;
  const api = await import(moduleUrl);

  assert.equal(api.isStaticHosting, true);
  await assert.rejects(api.requestApi('/api/chat'), { name: 'ApiUnavailableError' });
  assert.equal(fetchMock.mock.callCount(), 0);
});
