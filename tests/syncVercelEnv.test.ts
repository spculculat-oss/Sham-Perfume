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
interface Dpl { uid: string; source?: string; meta?: { githubCommitSha?: string } }
function fakeVercel(initial: Record<string, EnvVar[]>, opts: { deployments?: Record<string, Dpl[]>; live?: Record<string, string>; pinned?: boolean } = {}) {
  const envs = structuredClone(initial);
  const live: Record<string, string> = { ...opts.live };
  const promoted: string[] = [];
  const made: Record<string, Dpl['meta']> = {};
  const metaOf = (id: string) => made[id] ?? Object.values(opts.deployments || {}).flat().find((d) => d.uid === id)?.meta
    ?? { githubCommitSha: `sha_${id.replace(/^dpl_/, '')}` };
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
      if (url.pathname === '/v6/deployments') {
        const p = url.searchParams.get('projectId')!;
        return send(200, { deployments: opts.deployments?.[p] || [{ uid: `dpl_${p}`, source: 'git', meta: metaOf(`dpl_${p}`) }] });
      }
      m = url.pathname.match(/^\/v9\/projects\/([^/]+)$/);
      if (m) return send(200, { targets: { production: { id: live[m[1]] ?? `dpl_${m[1]}` } } });
      m = url.pathname.match(/^\/v10\/projects\/([^/]+)\/promote\/([^/]+)$/);
      if (m && req.method === 'POST') { live[m[1]] = m[2]; promoted.push(`${m[1]}:${m[2]}`); return send(202, {}); }
      if (url.pathname === '/v13/deployments' && req.method === 'POST') {
        const { name, deploymentId } = JSON.parse(body);
        calls.push(`from ${deploymentId}`);
        made[`new_${name}`] = metaOf(deploymentId);
        if (!opts.pinned) live[name] = `new_${name}`;
        return send(200, { id: `new_${name}`, readyState: 'BUILDING', url: 'x.vercel.app' });
      }
      m = url.pathname.match(/^\/v13\/deployments\/([^/]+)$/);
      if (m) return send(200, { readyState: 'READY', meta: metaOf(m[1]) });
      send(404, { error: { code: 'not_found' } });
    });
  });
  return { server, envs, calls, live, promoted };
}

async function listen(fake: ReturnType<typeof fakeVercel>) {
  await new Promise<void>((r) => fake.server.listen(0, '127.0.0.1', r));
  return `http://127.0.0.1:${(fake.server.address() as AddressInfo).port}`;
}

function run(base: string, env: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, ['scripts/sync-vercel-env.mjs'], {
      env: { PATH: process.env.PATH!, GITHUB_SHA: 'headsha', VERCEL_API_URL: base, VERCEL_TOKEN: 'tok', VERCEL_SCOPE: 'team', VERCEL_PROJECTS: 'api,site', SHAM_SYNC_POLL_MS: '10', ...env },
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

test('a production pinned to an old build is promoted to the newest git build, even when no key changed', async () => {
  const all = ['production', 'preview', 'development'];
  const fake = fakeVercel(
    { api: [{ id: 'o1', key: 'OPENAI_API_KEY', value: 'sk-same', target: all, type: 'encrypted' }] },
    {
      // Newest first: a manual «Redeploy» of the old build (old code), then the real newest push, then the old build.
      deployments: { api: [
        { uid: 'redeploy_old', source: 'redeploy', meta: { githubCommitSha: 'old' } },
        { uid: 'git_new', source: 'git', meta: { githubCommitSha: 'new' } },
        { uid: 'git_old', source: 'git', meta: { githubCommitSha: 'old' } },
      ] },
      live: { api: 'redeploy_old' },
    },
  );
  const base = await listen(fake);
  try {
    const out = await run(base, { VERCEL_PROJECTS: 'api', OPENAI_API_KEY: 'sk-same' });
    assert.deepEqual(fake.promoted, ['api:git_new']);
    assert.match(out, /pinned to an older build \(redeploy_old\).*git_new/);
    assert.equal(fake.calls.filter((c) => c === 'POST /v13/deployments').length, 0, 'no rebuild when nothing changed');

    fake.promoted.length = 0;
    await run(base, { VERCEL_PROJECTS: 'api', OPENAI_API_KEY: 'sk-same' });
    assert.deepEqual(fake.promoted, [], 'already live → nothing to do');
  } finally {
    fake.server.close();
  }
});

test('a changed key on a pinned project rebuilds the exact current commit and promotes that build', async () => {
  const fake = fakeVercel({ api: [] }, {
    deployments: { api: [{ uid: 'git_x', source: 'git' }, { uid: 'git_head', source: 'git', meta: { githubCommitSha: 'headsha' } }] },
    live: { api: 'git_old' }, pinned: true,
  });
  const base = await listen(fake);
  try {
    const out = await run(base, { VERCEL_PROJECTS: 'api', ANTHROPIC_API_KEY: 'sk-ant-new' });
    assert.ok(fake.calls.includes('from git_head'));
    assert.deepEqual(fake.promoted, ['api:new_api']);
    assert.match(out, /production redeploy READY/);
    assert.doesNotMatch(out, /sk-ant-new/);
  } finally {
    fake.server.close();
  }
});

test('a refused VERCEL_TOKEN explains how to fix it', async () => {
  const fake = fakeVercel({ api: [] });
  const base = await listen(fake);
  try {
    const out = await run(base, { VERCEL_PROJECTS: 'api', VERCEL_TOKEN: 'wrong', OPENAI_API_KEY: 'x' });
    assert.match(out, /403 forbidden — VERCEL_TOKEN was refused: .*Scope "team"/);
  } finally {
    fake.server.close();
  }
});
