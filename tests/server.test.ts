import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { after, before, test } from 'node:test';

let server: ChildProcess;
let baseUrl: string;

before(async () => {
  server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: '0',
      DISABLE_HMR: 'true',
      GEMINI_API_KEY: '',
      DEEPSEEK_API_KEY: '',
      OPENAI_API_KEY: '',
      ANTHROPIC_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await new Promise<void>((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => {
      server.kill();
      reject(new Error(`Server startup timed out:\n${output}`));
    }, 20_000);
    const exit = (code: number | null) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited (${code}) before listening:\n${output}`));
    };
    server.once('exit', exit);
    server.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    server.stderr?.on('data', (chunk) => { output += chunk.toString(); });
    server.stdout?.on('data', (chunk) => {
      output += chunk.toString();
      const match = output.match(/Server started on http:\/\/0\.0\.0\.0:(\d+)/);
      if (match) {
        baseUrl = `http://127.0.0.1:${match[1]}`;
        clearTimeout(timeout);
        server.removeListener('exit', exit);
        resolve();
      }
    });
  });
});

after(async () => {
  if (server && server.exitCode === null && server.signalCode === null) {
    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    await exited;
  }
});

test('model diagnostics report missing API keys truthfully', async () => {
  const response = await fetch(`${baseUrl}/api/models`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.models.length, 5);
  assert.ok(data.models.every((model: { hasApiKey: boolean }) => model.hasApiKey === false));
});

test('news fetch and refresh without a key fail without fabricating articles', async () => {
  for (const [endpoint, method] of [['/api/news', 'GET'], ['/api/news/refresh', 'POST']]) {
    const response = await fetch(`${baseUrl}${endpoint}`, { method });
    assert.equal(response.status, 503);
    const data = await response.json();
    assert.equal(data.success, false);
    assert.equal(data.articles, undefined);
    assert.equal(typeof data.error, 'string');
  }
});

test('unknown API routes return JSON 404, not a successful HTML SPA fallback', async () => {
  const response = await fetch(`${baseUrl}/api/does-not-exist`);
  assert.equal(response.status, 404);
  assert.match(response.headers.get('content-type') || '', /application\/json/);
  assert.deepEqual(await response.json(), { error: 'API route not found' });
});

test('chat rejects missing messages with a real validation error', async () => {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Message is required' });
});
