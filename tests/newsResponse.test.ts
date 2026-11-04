/**
 * «مرصد العطور» must answer on the visitor's clock, not on the model's.
 * The patrol's live test (scripts/shaheen-patrol/probes.ts → probeNewsApi) gives the bulletin 20 seconds:
 * when an engine hangs, the old route waited for it (25s per engine) and the test failed with TimeoutError.
 * The bulletin now answers from what is ready — today's notes, else the collected headlines with their
 * sources — and lets the generation finish in the background.
 */
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';

const listen = (server: Server) => new Promise<number>((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
});

test('the bulletin answers at once even when the model never replies (the patrol test never times out)', async () => {
  // A provider that accepts the call and stays silent — the slowest an engine can be.
  const silent = createServer(() => {});
  const silentPort = await listen(silent);
  process.env.SHAM_LLM_BASE_URL = `http://127.0.0.1:${silentPort}/v1`;
  process.env.SHAM_LLM_API_KEY = 'test-key-not-a-real-key';
  process.env.SHAM_LLM_MODEL = 'test-model';
  process.env.SHAM_LIVE_DATA = 'off';
  process.env.SHAM_STORE = 'memory';
  process.env.NODE_ENV = 'development';

  const { default: app } = await import('../server/app');
  const site = createServer(app as never);
  const port = await listen(site);
  try {
    const startedAt = Date.now();
    const response = await fetch(`http://127.0.0.1:${port}/api/news`, { signal: AbortSignal.timeout(30_000) });
    const elapsed = Date.now() - startedAt;
    const data = (await response.json()) as { success?: boolean; aiGenerated?: boolean; collected?: boolean; articles?: { id: string }[] };

    assert.equal(response.status, 200);
    // Well inside the patrol's 20-second budget: the visitor never waits for the silent engine.
    assert.ok(elapsed < 10_000, `the bulletin answered in ${elapsed}ms — it must not wait for the model`);
    assert.equal(data.success, true);
    // Nothing invented: with no answer from the engine, the visitor gets Shaheen's collected headlines.
    assert.equal(data.aiGenerated, false);
    assert.equal(data.collected, true);
    assert.ok((data.articles || []).length > 0, 'the bulletin is never empty while the collected file has headlines');
    assert.ok((data.articles || []).every((a) => a.id.startsWith('collected-')));

    // A second visit is just as quick: the failed attempt is not retried on every request.
    const secondStart = Date.now();
    const second = await fetch(`http://127.0.0.1:${port}/api/news`, { signal: AbortSignal.timeout(30_000) });
    assert.equal(second.status, 200);
    assert.ok(Date.now() - secondStart < 10_000, 'a later visit does not queue behind a hanging engine either');
  } finally {
    site.close();
    // Cut the pending generation loose so the test process does not wait for the engine's own timeout.
    silent.closeAllConnections?.();
    silent.close();
    delete process.env.SHAM_LLM_API_KEY;
    delete process.env.SHAM_LLM_BASE_URL;
    delete process.env.SHAM_LLM_MODEL;
  }
});
