import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';

interface EnvVar { id: string; key: string; value: string; target: string[]; type: string }

/** Minimal fake of the Vercel REST endpoints the sync script uses. */
function fakeVercel(initial: Record<string, EnvVar[]>) {
  const envs = structuredClone(initial);
  const calls: string[] = [];
  let next = 1;
  const server = createServer((req, res) => {
    const url = new URL(req.url!, 'http://x');
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      calls.push(`${req.method} ${url.pathname}`);
      const send = (status: number, data: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
      if (req.headers.authorization !== 'Bearer tok' || url.searchParams.get('slug') !== 'team') return send(403, { error: { code: 'forbidden' } });
      let m = url.pathname.match(/^\/v9\/projects\/([^/]+)\/env$/);
      if (m && req.method === 'GET') return send(200, { envs: (envs[m[1]] || []).map(({ value: _v, ...e }) => ({ ...e, value: 'enc' })) });
      m = url.pathname.match(/^\/v1\/projects\/([^/]+)\/env\/([^/]+)$/);
      if (m) return send(200, envs[m[1]].find((e) => e.id === m![2]));
      m = url.pathname.match(/^\/v9\/projects\/([^/]+)\/env\/([^/]+)$/);
      if (m && req.method === 'DELETE') { envs[m[1]] = envs[m[1]].filter((e) => e.id !== m![2]); return send(200, {}); }
      m = url.pathname.match(/^\/v10\/projects\/([^/]+)\/env$/);
      if (m && req.method === 'POST') { const e = JSON.parse(body); (envs[m[1]] ||= []).push({ id: `n${next++}`, ...e }); return send(201, {}); }
      if (url.pathname === '/v6/deployments') return send(200, { deployments: [{ uid: `dpl_${url.searchParams.get('projectId')}` }] });
      if (url.pathname === '/v13/deployments' && req.method === 'POST') return send(200, { id: 'new', readyState: 'BUILDING', url: 'x.vercel.app' });
      if (url.pathname === '/v13/deployments/new') return send(200, { readyState: 'READY' });
      send(404, { error: { code: 'not_found' } });
    });
  });
  return { server, envs, calls };
}

function run(base: string, env: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, ['scripts/sync-vercel-env.mjs'], {
      env: { PATH: process.env.PATH!, VERCEL_API_URL: base, VERCEL_TOKEN: 'tok', VERCEL_SCOPE: 'team', VERCEL_PROJECTS: 'api,site', SHAM_SYNC_POLL_MS: '10', ...env },
    }, (error, stdout, stderr) => (error ? reject(new Error(stderr || error.message)) : resolve(stdout + stderr)));
  });
}

test('sync copies GitHub keys to every Vercel project and redeploys only on change', async () => {
  const all = ['production', 'preview', 'development'];
  const fake = fakeVercel({
    api: [
      { id: 'g1', key: 'GEMINI_API_KEY', value: 'old-gemini', target: ['production'], type: 'encrypted' },
      { id: 'o1', key: 'OPENAI_API_KEY', value: 'sk-same', target: all, type: 'encrypted' },
      { id: 'x1', key: 'UNRELATED', value: 'keep', target: all, type: 'encrypted' },
    ],
    site: [],
  });
  await new Promise<void>((r) => fake.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(fake.server.address() as AddressInfo).port}`;
  const dir = mkdtempSync(join(tmpdir(), 'sync-'));
  const verify = join(dir, 'verify.json');
  writeFileSync(verify, JSON.stringify({ gemini: 'ok', openai: 'ok', claude: 'invalid_key' }));
  try {
    const out = await run(base, { GEMINI_API_KEY: ' new-gemini ', OPENAI_API_KEY: 'sk-same', ANTHROPIC_API_KEY: 'bad', SHAM_VERIFY_FILE: verify });
    const keys = (p: string) => Object.fromEntries(fake.envs[p].map((e) => [e.key, [e.value, e.target.join(',')]]));
    assert.deepEqual(keys('api'), {
      OPENAI_API_KEY: ['sk-same', all.join(',')], UNRELATED: ['keep', all.join(',')], GEMINI_API_KEY: ['new-gemini', all.join(',')],
    });
    assert.deepEqual(keys('site'), { GEMINI_API_KEY: ['new-gemini', all.join(',')], OPENAI_API_KEY: ['sk-same', all.join(',')] });
    assert.match(out, /ANTHROPIC_API_KEY.*skipped.*invalid_key/);
    assert.equal(fake.calls.filter((c) => c === 'POST /v13/deployments').length, 2);
    assert.doesNotMatch(out, /new-gemini|sk-same/);

    fake.calls.length = 0;
    const again = await run(base, { GEMINI_API_KEY: 'new-gemini', OPENAI_API_KEY: 'sk-same', SHAM_VERIFY_FILE: verify });
    assert.match(again, /already up to date/);
    assert.equal(fake.calls.filter((c) => c.startsWith('POST') || c.startsWith('DELETE')).length, 0);
  } finally {
    fake.server.close();
  }
});

test('sync without VERCEL_TOKEN is a harmless no-op', async () => {
  const out = await run('http://127.0.0.1:9', { VERCEL_TOKEN: '', GEMINI_API_KEY: 'x' });
  assert.match(out, /VERCEL_TOKEN secret is missing/);
});
