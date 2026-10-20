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
      // Every engine key off (the robots' workflows carry real keys in their environment).
      GEMINI_API_KEY: '',
      DEEPSEEK_API_KEY: '',
      OPENAI_API_KEY: '',
      ANTHROPIC_API_KEY: '',
      OPENROUTER_API_KEY: '',
      PERPLEXITY_API_KEY: '',
      SHAM_LLM_BASE_URL: '',
      SHAM_LLM_API_KEY: '',
      AI_GATEWAY_API_KEY: '',
      SHAM_STORE: 'memory',
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
  // Visitors get Shaheen's modes only — no engine ids, vendor or model names.
  assert.deepEqual(data.models.map((model: { id: string }) => model.id), ['auto', 'fast', 'deep', 'council']);
  assert.ok(data.models.every((model: { hasApiKey: boolean }) => model.hasApiKey === false));
  assert.doesNotMatch(JSON.stringify(data), /gemini|openai|gpt|claude|anthropic|deepseek|openrouter|qwen/i);
});

test('news without a key: never AI-written articles — the collected headlines with their sources, refresh fails', async () => {
  const news = await (await fetch(`${baseUrl}/api/news`)).json();
  // GET falls back to the real headlines Shaheen collected (src/data/live/shaheen-news.json), labelled as such.
  assert.equal(news.success, true);
  assert.equal(news.aiGenerated, false);
  assert.equal(news.collected, true);
  assert.ok(news.articles.length > 0);
  for (const article of news.articles) {
    assert.match(article.id, /^collected-/);
    assert.match(article.contentAr, /المصدر: .+ — https:\/\//);
    assert.doesNotMatch(article.badge, /مولّد/);
  }
  const response = await fetch(`${baseUrl}/api/news/refresh`, { method: 'POST' });
  assert.equal(response.status, 503);
  const data = await response.json();
  assert.equal(data.success, false);
  assert.equal(data.articles, undefined);
  assert.equal(typeof data.error, 'string');
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
  assert.deepEqual(await response.json(), { error: 'Message is required', code: 'INVALID_MESSAGE' });
});

test('chat refuses malformed bodies, history and unknown providers without creating a canned answer', async () => {
  for (const body of [null, [], { message: '   ' }, { message: 'hello', model: 'fake' },
    { message: 'hello', conversationHistory: [null] }, { message: 'hello', conversationHistory: {} },
    { message: 'hello', language: 'unsupported' }, { message: 'x'.repeat(4001) }]) {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.equal(typeof data.error, 'string');
    assert.equal(data.reply, undefined);
  }
});

test('chat without credentials gives an actionable 503 instead of impersonating four AI engines', async () => {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'مرحبا' }),
  });
  assert.equal(response.status, 503);
  const data = await response.json();
  assert.equal(data.code, 'PROVIDER_NOT_CONFIGURED');
  assert.equal(data.reply, undefined);
  assert.equal(data.perspectives, undefined);
});

test('invalid JSON and oversized payloads return JSON errors', async () => {
  for (const [body, status] of [['{broken', 400], [JSON.stringify({ message: 'x'.repeat(140000) }), 413]] as const) {
    const response = await fetch(`${baseUrl}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    assert.equal(response.status, status);
    assert.match(response.headers.get('content-type') || '', /application\/json/);
    assert.equal((await response.json()).code, 'INVALID_REQUEST');
  }
});

test('CORS: the GitHub Pages origin may call the API cross-origin, other sites may not', async () => {
  const pages = 'https://spculculat-oss.github.io';
  for (const path of ['/api/chat', '/api/assistant/chat/stream', '/api/admin/settings']) {
    const preflight = await fetch(`${baseUrl}${path}`, { method: 'OPTIONS', headers: { Origin: pages, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,authorization' } });
    assert.equal(preflight.status, 204, path);
    assert.equal(preflight.headers.get('access-control-allow-origin'), pages);
    assert.match(preflight.headers.get('access-control-allow-headers') || '', /Authorization/);
    assert.equal(preflight.headers.get('access-control-allow-credentials'), null, 'no cookies cross-origin');
  }
  const models = await fetch(`${baseUrl}/api/models`, { headers: { Origin: pages } });
  assert.equal(models.headers.get('access-control-allow-origin'), pages);
  const bad = await fetch(`${baseUrl}/api/chat`, { method: 'POST', headers: { Origin: pages, 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal(bad.status, 400);
  assert.equal(bad.headers.get('access-control-allow-origin'), pages, 'errors are readable by the Pages site too');

  const evil = await fetch(`${baseUrl}/api/models`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(evil.headers.get('access-control-allow-origin'), null);
  assert.match(evil.headers.get('vary') || '', /Origin/);
  const evilPreflight = await fetch(`${baseUrl}/api/chat`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' } });
  assert.equal(evilPreflight.headers.get('access-control-allow-origin'), null);
});
