import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

const output = path.resolve('.vercel/output');
let isolatedDirectory;
let server;
let baseUrl;
let config;

before(async () => {
  config = JSON.parse(await readFile(path.join(output, 'config.json'), 'utf8'));
  // Run the generated function outside the repo, without its .env or node_modules.
  // This tests the shipped CJS artifact, not the development TypeScript server.
  isolatedDirectory = await mkdtemp(path.join(tmpdir(), 'sham-vercel-'));
  await cp(path.join(output, 'functions/api.func/index.cjs'), path.join(isolatedDirectory, 'index.cjs'));
  await writeFile(path.join(isolatedDirectory, 'serve.cjs'), `
    const http = require('node:http');
    const app = require('./index.cjs');
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => console.log('PORT:' + server.address().port));
  `);
  server = spawn(process.execPath, ['serve.cjs'], {
    cwd: isolatedDirectory,
    env: {
      ...process.env, NODE_ENV: 'production', NODE_PATH: '',
      GEMINI_API_KEY: '', DEEPSEEK_API_KEY: '', OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '',
      SHAM_LLM_BASE_URL: '', SHAM_STORE: '', SHAM_ADMIN_TOKEN: '', VERCEL: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    let logs = '';
    const timer = setTimeout(() => reject(new Error(`Function startup timeout: ${logs}`)), 10_000);
    server.once('error', (error) => { clearTimeout(timer); reject(error); });
    server.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Function exited (${code}): ${logs}`)); });
    server.stderr.on('data', (chunk) => { logs += chunk.toString(); });
    server.stdout.on('data', (chunk) => {
      logs += chunk.toString();
      const match = logs.match(/PORT:(\d+)/);
      if (match) { clearTimeout(timer); baseUrl = `http://127.0.0.1:${match[1]}`; resolve(); }
    });
  });
});

after(async () => {
  if (server && server.exitCode === null && server.signalCode === null) {
    const exited = once(server, 'exit');
    server.kill();
    await exited;
  }
  if (isolatedDirectory) await rm(isolatedDirectory, { recursive: true, force: true });
});

test('Vercel config builds explicit full-stack output instead of Vite-only dist', async () => {
  const settings = JSON.parse(await readFile('vercel.json', 'utf8'));
  assert.equal(settings.framework, null);
  assert.equal(settings.outputDirectory, null);
  assert.equal(settings.buildCommand, 'npm run build:vercel');
  assert.match(settings.installCommand, /bun@1\.4\.3.*--frozen-lockfile/);
  // Work branches skip Vercel previews (the free plan's daily deployment cap must stay free for main);
  // main is never disabled.
  assert.equal(settings.git.deploymentEnabled['arena/**'], false);
  assert.equal(settings.git.deploymentEnabled['doctor/**'], false, 'the maintenance agent\'s branches must not use the Vercel deploy quota');
  // Fluid compute: one instance serves many visitors at once, sharing Shaheen's answer cache and queue.
  assert.equal(settings.fluid, true);
  assert.notEqual(settings.git.deploymentEnabled.main, false);
  assert.equal(config.version, 3);
  const metadata = JSON.parse(await readFile(path.join(output, 'functions/api.func/.vc-config.json'), 'utf8'));
  assert.equal(metadata.runtime, 'nodejs22.x');
  assert.equal(metadata.handler, 'index.cjs');
  assert.equal(metadata.launcherType, 'Nodejs');
  assert.ok(metadata.maxDuration > 30); // longer than the chat's total deadline
  assert.equal(metadata.environment, undefined); // never bake credentials into the artifact
  assert.ok((await stat(path.join(output, 'static/index.html'))).isFile());
});

test('all API methods/paths route before the filesystem and SPA fallback', () => {
  const route = config.routes[0];
  const pattern = new RegExp(`^(?:${route.src})$`);
  for (const url of ['/api', '/api/health', '/api/models', '/api/chat', '/api/news', '/api/news/refresh', '/api/assistant/chat', '/api/admin/overview', '/api/missing']) {
    assert.ok(pattern.test(url), url);
  }
  for (const url of ['/', '/home', '/apiary', '/assets/index.js']) assert.equal(pattern.test(url), false, url);
  assert.equal(route.dest, '/api');
  assert.equal(route.methods, undefined); // including POST; GET-only routes would break chat
  assert.deepEqual(config.routes[1], { handle: 'filesystem' });
  assert.equal(config.routes.at(-1).dest, '/index.html');
  const missingAsset = config.routes[2];
  assert.ok(new RegExp(missingAsset.src).test('/assets/missing.js'));
  assert.equal(missingAsset.status, 404);
});

test('isolated production function serves health and model diagnostics as JSON', async () => {
  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);
  const healthBody = await health.json();
  assert.deepEqual({ service: healthBody.service, status: healthBody.status }, { service: 'sham-perfume', status: 'ok' });
  assert.equal(typeof healthBody.version, 'string', 'deployed commit, read by the maintenance agent');
  const response = await fetch(`${baseUrl}/api/models`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  const data = await response.json();
  // auto + the six Shaheen engines (gemini, deepseek, openai, claude, self_hosted, openrouter).
  assert.deepEqual(data.models.map((model) => model.id), ['auto', 'fast', 'deep', 'council'], 'visitors see modes, not engines');
  assert.ok(data.models.every((model) => !model.hasApiKey));
  assert.equal(data.enabled, true);
  assert.equal(data.allowVisitorChoice, true);
});

test('isolated chat handler processes POST bodies and returns honest no-key errors', async () => {
  for (const [body, status, code] of [
    [{}, 400, 'INVALID_MESSAGE'],
    [{ message: 'مرحبا', model: 'auto', language: 'ar' }, 503, 'PROVIDER_NOT_CONFIGURED'],
  ]) {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    assert.equal(response.status, status);
    const data = await response.json();
    assert.equal(data.code, code);
    assert.equal(data.reply, undefined);
  }
});

test('malformed JSON and oversized POSTs remain JSON errors in the deployed artifact', async () => {
  for (const [body, status] of [['{', 400], [JSON.stringify({ message: 'x'.repeat(150_000) }), 413]]) {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    });
    assert.equal(response.status, status);
    assert.equal((await response.json()).code, 'INVALID_REQUEST');
  }
});

test('news GET and refresh POST do not fabricate content without a key', async () => {
  for (const [url, method] of [['/api/news', 'GET'], ['/api/news/refresh', 'POST']]) {
    const response = await fetch(`${baseUrl}${url}`, { method });
    assert.equal(response.status, 503);
    const data = await response.json();
    assert.equal(data.success, false);
    assert.equal(data.articles, undefined);
  }
});

test('Sham Core assistant answers without any provider key; admin stays closed without a token', async () => {
  const config = await (await fetch(`${baseUrl}/api/assistant/config`)).json();
  assert.ok(config.services.length >= 6);
  assert.equal(config.modelEnhanced, false);
  const response = await fetch(`${baseUrl}/api/assistant/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'بتقدموا خدمات ايه؟', visitorId: 'visitor-vercel-01', language: 'ar' }),
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.engine.id, 'sham_local');
  assert.equal(data.intent, 'list_services');
  const admin = await fetch(`${baseUrl}/api/admin/overview`, { headers: { Authorization: 'Bearer anything-long-enough' } });
  assert.equal(admin.status, 503);
  assert.equal((await admin.json()).code, 'ADMIN_NOT_CONFIGURED');
});

test('unknown API routes cannot return the React page or a successful response', async () => {
  for (const url of ['/api', '/api/missing']) {
    const response = await fetch(`${baseUrl}${url}`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'API route not found' });
  }
});

test('static React assets do not contain server SDK or handler code', async () => {
  const html = await readFile(path.join(output, 'static/index.html'), 'utf8');
  assert.match(html, /src="\/assets\//);
  const asset = html.match(/src="(\/assets\/[^\"]+\.js)"/)[1];
  const js = await readFile(path.join(output, 'static', asset), 'utf8');
  assert.doesNotMatch(js, /x-goog-api-key|express\.json|function executeChat|PROVIDER_NOT_CONFIGURED.*The configured AI providers|SHAM_ADMIN_TOKEN|timingSafeEqual/);
  const bundle = await readFile(path.join(output, 'functions/api.func/index.cjs'), 'utf8');
  assert.doesNotMatch(bundle, /createViteServer|vite\/dist\/node|vite\/client/);
});
