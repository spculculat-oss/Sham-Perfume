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
      SHAM_ADMIN_TOKEN: 'test-admin-token-1234',
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
  // «شاهين معتمد على نفسه» (O-10): his own brain answers every mode; the council needs several models, so it is off.
  assert.deepEqual(data.models.map((model: { hasApiKey: boolean }) => model.hasApiKey), [true, true, true, false]);
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

test('the design studio is protected by the admin token, validates requests and never fabricates without a configured engine', async () => {
  const path = `${baseUrl}/api/admin/design/brief`;
  const unauthenticated = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(unauthenticated.status, 401);

  const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer test-admin-token-1234' };
  const invalid = await fetch(path, { method: 'POST', headers, body: '{}' });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).code, 'INVALID_BRIEF');

  const unavailable = await fetch(path, { method: 'POST', headers, body: JSON.stringify({
    brief: 'تصميم إعلان لعطر فاخر بدون خصم أو ادعاءات غير مؤكدة',
    platform: 'instagram_story', objective: 'awareness', language: 'ar',
  }) });
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).code, 'PROVIDER_NOT_CONFIGURED');
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

test('chat with the AI platforms closed: Shaheen answers himself, never an outside engine (O-10)', async () => {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'مرحبا' }),
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(typeof data.reply, 'string');
  assert.equal(data.engine.provider, 'shaheen');
  assert.equal(data.perspectives, undefined);
  assert.doesNotMatch(JSON.stringify(data), /gemini|openai|gpt|claude|anthropic|deepseek|openrouter|qwen|manus/i);
  const design = await (await fetch(`${baseUrl}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'صمم لي خلطة شتوية' }),
  })).json();
  assert.equal(design.designer, true);
  assert.match(design.reply, /sham-formula/);
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

test('«استشير متخصصاً»: the board, its toolbox, and an answer that says its source and the tools that ran', async () => {
  const board = await (await fetch(`${baseUrl}/api/specialists/board`)).json() as {
    ai: boolean; specialists: { id: string }[]; sections: { id: string }[]; tools: { id: string }[]; toolCount: number;
  };
  assert.equal(board.ai, false, 'no engine keys here — the board says so instead of pretending');
  assert.equal(board.specialists.length, 10);
  assert.ok(board.toolCount >= 20 && board.tools.length === board.toolCount);
  assert.ok(board.sections.length >= 10);

  const asked = await fetch(`${baseUrl}/api/specialists/consult`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-sham-visitor': 'visitor-specialists-test' },
    body: JSON.stringify({ question: 'احسب مقادير زجاجة 50 مل بتركيز 20%', language: 'ar', visitorId: 'visitor-specialists-test' }),
  });
  assert.equal(asked.status, 200);
  assert.equal(asked.headers.get('cache-control'), 'no-store');
  const reply = await asked.json() as {
    answer: string; source: string; ok: boolean; ai: boolean; specialist: { id: string };
    tools: { tool: string; ok: boolean }[]; actions: { type: string }[];
  };
  assert.equal(reply.ai, false, 'an answer from the tools is not called AI');
  assert.equal(reply.ok, true);
  assert.equal(reply.source, 'calculator');
  assert.equal(reply.specialist.id, 'specialist_scents');
  assert.match(reply.answer, /10\s*مل/, 'the number the site’s own formula computed');
  assert.match(reply.answer, /حاسبات معمل شام/, 'the source is written on the answer');
  assert.ok(reply.tools.some((t) => t.tool === 'calc_concentration' && t.ok), 'the trace shows the tool that answered');
  assert.ok(reply.actions.some((a) => a.type === 'open_tab'), 'the visitor gets the way to the calculator');
  assert.ok(!/gemini|openai|claude|perplexity|deepseek/i.test(reply.answer), 'no vendor name reaches the visitor');

  const empty = await fetch(`${baseUrl}/api/specialists/consult`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: '' }),
  });
  assert.equal(empty.status, 400);
  assert.equal(((await empty.json()) as { code?: string }).code, 'INVALID_QUESTION');

  const tools = await (await fetch(`${baseUrl}/api/specialists/tools?specialist=specialist_scents`)).json() as { tools: { id: string }[]; count: number };
  assert.equal(tools.count, tools.tools.length);
  assert.ok(tools.tools.some((t) => t.id === 'calc_concentration'));

  assert.equal((await fetch(`${baseUrl}/api/specialists/section/store`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/specialists/section/not-a-section`)).status, 404);
});
