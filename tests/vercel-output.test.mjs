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
    // Upstream responses are fixtures; geo routing, attribution checks and filtering run from the packaged app.
    const networkFetch = globalThis.fetch;
    const file = 'https://commons.wikimedia.org/wiki/File:Example.jpg';
    const license = 'https://creativecommons.org/licenses/by-sa/4.0/';
    const caption = '<figure><img src="https://globalvoices.org/example.jpg" alt="An example landscape"><figcaption><a href="' + file + '">Example</a> by Fixture Photographer <a href="' + license + '">CC BY-SA 4.0</a></figcaption></figure>';
    const feeds = new Map([
      ['https://www.youm7.com/rss/SectionRss?SectionID=97', ['Egypt fixture', 'https://www.youm7.com/101']],
      ['https://www.youm7.com/rss/SectionRss?SectionID=286', ['World fixture', 'https://www.youm7.com/102']],
      ['https://globalvoices.org/-/world/middle-east-north-africa/egypt/feed/', []],
      ['https://www.egypt-today.com/egypt-football/rss.xml', ['Egypt football fixture', 'https://www.egypt-today.com/1236/002000-fixture', '<enclosure url="https://img.egypt-today.com/fixture.jpg" type="image/jpeg"/>']],
      ['https://www.arabstoday.net/arabstoday-breakingnews/rss.xml', ['Arabs Today fixture', 'https://www.arabstoday.net/1152/001000-fixture']],
      ['https://www.service-public.gouv.fr/abonnements/rss/actu-actualites-particuliers.rss', ['France fixture', 'https://www.service-public.gouv.fr/particuliers/actualites/A103']],
      ['https://www.service-public.gouv.fr/abonnements/rss/actu-actu-pro.rss', []],
      ['https://www.info.gouv.fr/rss/actualites.xml', []],
      ['https://agenciabrasil.ebc.com.br/rss/geral/feed.xml', ['Brazil fixture', 'https://agenciabrasil.ebc.com.br/geral/noticia/2026-11/fixture', '<dc:creator>Agência Brasil</dc:creator>']],
      ['https://agenciabrasil.ebc.com.br/rss/politica/feed.xml', []],
      ['https://globalvoices.org/feed/', ['Community fixture', 'https://globalvoices.org/2026/11/19/example/', '<dc:creator>Fixture Writer</dc:creator><content:encoded><![CDATA[' + caption + ']]></content:encoded>']],
      ['https://news.mongabay.com/feed/', ['Environment fixture', 'https://news.mongabay.com/2026/11/example/', '<dc:creator>Environment Writer</dc:creator>']],
      ['https://www.europarl.europa.eu/rss/doc/press-releases/en.xml', []],
    ]);
    globalThis.fetch = (input, init) => {
      const url = new URL(String(input));
      if (url.href === 'https://news.un.org/feed/subscribe/ar/news/all/rss.xml') return Promise.resolve(new Response(null, { status: 503 }));
      if (url.origin + url.pathname === 'https://commons.wikimedia.org/w/api.php' && url.searchParams.get('titles') === 'File:Example.jpg') {
        return Promise.resolve(Response.json({ query: { pages: [{ ns: 6, imagerepository: 'local', imageinfo: [{
          mime: 'image/jpeg', descriptionurl: file, thumburl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Example.jpg/640px-Example.jpg?utm_source=commons',
          extmetadata: { Artist: { value: '<b>Fixture Photographer</b>' }, LicenseUrl: { value: license }, Restrictions: { value: '' } },
        }] }] } }));
      }
      const item = feeds.get(url.href);
      if (!item) return networkFetch(input, init);
      const story = item.length ? '<item><title>' + item[0] + '</title><link>' + item[1] + '</link><pubDate>' + new Date().toISOString() + '</pubDate>' + (item[2] || '') + '</item>' : '';
      // Before the local calendar day, but still inside the recent-news window.
      const previous = url.searchParams.get('SectionID') === '97' ? '<item><title>Earlier Egypt fixture</title><link>https://www.youm7.com/104</link><pubDate>' + new Date(Date.now() - 26 * 3600000).toISOString() + '</pubDate></item>' : '';
      return Promise.resolve(new Response('<rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>' + story + previous + '</channel></rss>'));
    };
    const app = require('./index.cjs');
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => console.log('PORT:' + server.address().port));
  `);
  server = spawn(process.execPath, ['serve.cjs'], {
    cwd: isolatedDirectory,
    env: {
      ...process.env, NODE_ENV: 'production', NODE_PATH: '',
      GEMINI_API_KEY: '', DEEPSEEK_API_KEY: '', OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '',
      SHAM_LLM_BASE_URL: '', SHAM_STORE: '', SHAM_ADMIN_TOKEN: '', VERCEL: '1', SHAM_WEB_RESEARCH: 'off',
      SHAM_HOME_NEWS: 'on', SHAM_LIVE_DATA: 'on', SHAM_CALCULATOR_TUTOR: 'off',
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
  // main is never disabled. The rule is "main only": `**` is off so a branch name nobody listed yet
  // (fix/…, agent/…, feature/a/b) cannot reach production — see docs/design/vercel-build.md §5.
  assert.equal(settings.git.deploymentEnabled['**'], false, 'only main may deploy: every other branch is denied by default');
  assert.notEqual(settings.git.deploymentEnabled.main, false);
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
  assert.match(await readFile(path.join(output, 'static/third-party/magvar.txt'), 'utf8'), /MIT License/);
  assert.match(await readFile(path.join(output, 'static/third-party/adhan-js.txt'), 'utf8'), /MIT License/);
  assert.match(await readFile(path.join(output, 'static/third-party/tz-lookup.txt'), 'utf8'), /CC0/);
  for (const file of ['ahmed-khalaf.mp3', 'ahmed-khalaf-fajr.mp3', 'aaqib-azeez.mp3', 'besim-azemi-fajr.m4a']) assert.ok((await stat(path.join(output, 'static/audio/adhan', file))).size > 100_000);
  for (const cover of ['morning', 'print', 'world', 'desk']) assert.ok((await stat(path.join(output, 'static/images/press', `${cover}.webp`))).isFile());
});

test('the unused second Vercel project redirects to the main site and does not rebuild', async () => {
  const redirect = config.routes[0];
  assert.deepEqual(redirect.has, [{ type: 'host', value: 'sham-perfume.vercel.app' }]);
  assert.equal(redirect.status, 307);
  assert.equal(redirect.headers.Location, 'https://sham-perfume-49bf.vercel.app/$1');
  const settings = JSON.parse(await readFile('vercel.json', 'utf8'));
  assert.equal(settings.ignoreCommand, 'sh scripts/vercel-ignore.sh || false');
});

test('all API methods/paths route before the filesystem and SPA fallback', () => {
  const route = config.routes[1];
  const pattern = new RegExp(`^(?:${route.src})$`);
  for (const url of ['/api', '/api/health', '/api/models', '/api/chat', '/api/news', '/api/news/refresh', '/api/assistant/chat', '/api/calculator/tutor', '/api/admin/overview', '/api/missing']) {
    assert.ok(pattern.test(url), url);
  }
  for (const url of ['/', '/home', '/apiary', '/assets/index.js']) assert.equal(pattern.test(url), false, url);
  assert.equal(route.dest, '/api');
  assert.equal(route.methods, undefined); // including POST; GET-only routes would break chat
  assert.deepEqual(config.routes[2], { handle: 'filesystem' });
  assert.equal(config.routes.at(-1).dest, '/index.html');
  const missingAsset = config.routes[3];
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
  // «شاهين معتمد على نفسه» (O-10): his own brain answers every mode; the council needs several models.
  assert.deepEqual(data.models.map((model) => model.hasApiKey), [true, true, true, false]);
  assert.equal(data.enabled, true);
  assert.equal(data.allowVisitorChoice, true);
});

test('isolated chat handler processes POST bodies; with the AI platforms closed Shaheen answers himself', async () => {
  const bad = await fetch(`${baseUrl}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).code, 'INVALID_MESSAGE');
  const design = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'صمم لي خلطة شتوية', model: 'auto', language: 'ar' }),
  });
  assert.equal(design.status, 200);
  const data = await design.json();
  assert.equal(data.designer, true);
  assert.match(data.reply, /sham-formula/);
  assert.equal(data.engine.provider, 'shaheen');
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

test('the bundled Home briefing resolves each entry country privately and keeps world news separate', async () => {
  async function brief(country) {
    const origin = 'https://spculculat-oss.github.io';
    const response = await fetch(`${baseUrl}/api/home-headlines?country=EG`, {
      headers: { origin, 'accept-language': 'ar-EG', ...(country ? { 'x-vercel-ip-country': country } : {}) },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    return response.json();
  }
  const [france, egypt, brazil, saudi, unknown] = await Promise.all([brief('FR'), brief('EG'), brief('BR'), brief('SA'), brief(null)]);
  assert.equal(france.country, 'FR');
  assert.deepEqual(france.local.items.map((item) => item.title), ['France fixture']);
  assert.equal(egypt.country, 'EG');
  assert.equal(egypt.local.status, 'fresh');
  assert.deepEqual(egypt.local.items.map((item) => item.title).sort(), ['Earlier Egypt fixture', 'Egypt fixture', 'Egypt football fixture']);
  assert.ok(egypt.local.items.at(-1).datedAt.slice(0, 10) < egypt.day, 'the packaged API retains the earlier item with its own date');
  assert.ok(egypt.local.items.every((item) => !item.photo), 'Egypt Today thumbnails are not licensed by its headline terms');
  assert.equal(brazil.country, 'BR');
  assert.equal(brazil.timeZone, 'America/Sao_Paulo');
  assert.deepEqual(brazil.local.items.map((item) => [item.title, item.author]), [['Brazil fixture', 'Agência Brasil']]);
  assert.equal(saudi.country, 'SA');
  assert.equal(saudi.local.status, 'unsupported', 'press links do not need local upstream requests');
  assert.deepEqual(saudi.local.items, []);
  assert.equal(unknown.country, null);
  assert.equal(unknown.local.status, 'unsupported');
  assert.deepEqual(unknown.local.items, []);
  for (const edition of [france, egypt, brazil, saudi, unknown]) {
    assert.equal(edition.world.status, 'partial', 'a failed feed must not hide the other publishers');
    assert.deepEqual(edition.world.items.map((item) => item.title).sort(), ['Arabs Today fixture', 'Community fixture', 'Environment fixture', 'World fixture']);
    const community = edition.world.items.find((item) => item.publisher === 'global-voices');
    assert.equal(community.author, 'Fixture Writer');
    assert.deepEqual(community.photo, {
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Example.jpg/640px-Example.jpg',
      source: 'https://commons.wikimedia.org/wiki/File:Example.jpg', license: 'by-sa/4.0',
      credit: 'Fixture Photographer', alt: 'An example landscape',
    });
  }
});

test('news without a key: GET shows the collected headlines (not AI-written), refresh POST fails', async () => {
  const news = await (await fetch(`${baseUrl}/api/news`)).json();
  assert.equal(news.success, true);
  assert.equal(news.aiGenerated, false);
  assert.ok(news.articles.length > 0 && news.articles.every((a) => a.id.startsWith('collected-')));
  const response = await fetch(`${baseUrl}/api/news/refresh`, { method: 'POST' });
  assert.equal(response.status, 503);
  const data = await response.json();
  assert.equal(data.success, false);
  assert.equal(data.articles, undefined);
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

test('isolated production function exposes real agent capabilities without private server tools', async () => {
  const response = await fetch(`${baseUrl}/api/agent/capabilities`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.maxSteps, 5);
  assert.ok(data.tools.includes('create_file'));
  assert.ok(data.unavailable.includes('shell_execution'));
  const chat = await fetch(`${baseUrl}/api/agent/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Calculate', documents: [{ name: 'a.txt', text: '100' }] }),
  });
  assert.equal(chat.status, 503);
  assert.equal((await chat.json()).code, 'PROVIDER_NOT_CONFIGURED');
});


test('packaged tutor serves local math and an honest no-engine fallback with Pages CORS', async () => {
  const origin = 'https://spculculat-oss.github.io';
  const endpoint = `${baseUrl}/api/calculator/tutor`;
  const preflight = await fetch(endpoint, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
  const ask = (question) => fetch(endpoint, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ question, language: 'ar' }) });
  const local = await ask('١٥٪ من ٢٤٠؟');
  assert.equal(local.status, 200);
  assert.equal(local.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await local.json(), { kind: 'local', plan: { action: 'calculate', math: '15% * 240' } });
  assert.deepEqual(await (await ask('معايا كتاب ومحتاج أحسب قيمة الخصم، أبدأ إزاي؟')).json(), { kind: 'unavailable' });
  assert.equal((await ask('student@example.org')).status, 400);
});
