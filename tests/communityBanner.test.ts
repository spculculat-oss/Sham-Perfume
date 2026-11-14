import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { createCommunity, createCommunityRouter } from '../server/community/router';
import { after, before, test } from 'node:test';
import { Vault } from '../server/community/crypto';
import { SCHEMA, SCHEMA_VERSION, connectPglite, migrate, type Sql } from '../server/community/db';

const SCHEMA_STATEMENTS = 86;
import * as svc from '../server/community/service';
import * as social from '../server/community/social';
import { BANNER_MAX_CHARS, bannerImage } from '../src/community/ProfilePage';

let sql: Sql; let ctx: svc.Ctx;
before(async () => {
  sql = await connectPglite();
  await migrate(sql);
  ctx = { sql, vault: new Vault('test-data-key-0123456789-abcdefghijklmnop'), fx: async () => ({ base: 'USD', updatedAt: '2026-10-01T00:00:00Z', rates: { USD: 1 } }), env: {} };
});
after(async () => { await sql?.close(); });

const PICTURE = `data:image/jpeg;base64,${'A'.repeat(4000)}`;
const member = async (name: string) => (await svc.register(ctx, { name, email: `${name.toLowerCase()}@example.com`, password: 'Sham2026pass', country: 'EG' })).me;

test('a member page cover is a picture from the device: saved, shown to visitors, replaced and removed', async () => {
  const owner = await member('Banner');
  const visitor = await member('Visitor');
  assert.equal((await social.profile(ctx, owner.id, owner.handle)).banner, null);
  await svc.updateProfile(ctx, owner.id, { banner: PICTURE });
  assert.equal((await social.profile(ctx, owner.id, owner.handle)).banner, PICTURE);
  assert.equal((await social.profile(ctx, visitor.id, owner.handle)).banner, PICTURE, 'visitors see the cover too');
  // Changing something else leaves the cover alone.
  await svc.updateProfile(ctx, owner.id, { bio: 'صانع عطور' });
  assert.equal((await social.profile(ctx, owner.id, owner.handle)).banner, PICTURE);
  await svc.updateProfile(ctx, owner.id, { banner: null });
  assert.equal((await social.profile(ctx, owner.id, owner.handle)).banner, null);
});

test('a link, a non-image or an oversized picture is refused as a cover', async () => {
  const owner = await member('Strict');
  for (const bad of ['https://example.com/a.jpg', 'javascript:alert(1)', 'data:text/html;base64,AAAA', `data:image/jpeg;base64,${'A'.repeat(BANNER_MAX_CHARS + 10)}`]) {
    await assert.rejects(svc.updateProfile(ctx, owner.id, { banner: bad }), (e: unknown) => (e as { code?: string }).code === 'INVALID_IMAGE', bad.slice(0, 30));
  }
  assert.equal((await social.profile(ctx, owner.id, owner.handle)).banner, null);
});

test('the device picture is shrunk step by step until it fits what the server stores', async () => {
  const file = {} as File;
  const sizes: number[] = [];
  const shrinking = async (_f: File, max = 0) => { sizes.push(max); return 'x'.repeat(max >= 1280 ? BANNER_MAX_CHARS + 1 : 1000); };
  assert.equal((await bannerImage(file, shrinking)).length, 1000);
  assert.deepEqual(sizes, [1600, 1280, 1000]);
  assert.equal(await bannerImage(file, async () => 'x'.repeat(BANNER_MAX_CHARS + 1)), '');
  assert.equal((await bannerImage(file, async () => 'ok')), 'ok');
});

test('the edit-banner button opens the device pictures and never asks for a link', () => {
  const page = readFileSync(new URL('../src/community/ProfilePage.tsx', import.meta.url), 'utf8');
  assert.match(page, /type="file" accept="image\/\*"[^>]*profile-banner-file/);
  assert.doesNotMatch(page, /prompt\([^)]*(?:banner|البانر)/i);
  assert.match(page, /data\.banner && <img/);
});

test('a database made before the cover existed gets the column on the next start', async () => {
  const old = await connectPglite();
  try {
    await migrate(old);
    // Put it back the way the live database was: no banner column, schema marked as the previous version.
    await old.query(`ALTER TABLE users DROP COLUMN banner`);
    await old.query(`UPDATE community_meta SET value = '10' WHERE key = 'schema'`);
    await migrate(old);
    const [column] = await old.query(`SELECT 1 AS ok FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'banner'`);
    assert.equal(column?.ok, 1, 'the migration ran again and added the column');
    const [meta] = await old.query(`SELECT value FROM community_meta WHERE key = 'schema'`);
    assert.equal(Number(meta.value), SCHEMA_VERSION);
  } finally { await old.close(); }
});

test('adding a schema statement without raising SCHEMA_VERSION fails here, not on the live site', () => {
  // The live database only re-runs the schema when the version goes up. When you add a statement:
  // raise SCHEMA_VERSION in server/community/db.ts, then update BOTH numbers below.
  assert.deepEqual({ version: SCHEMA_VERSION, statements: SCHEMA.length }, { version: 11, statements: SCHEMA_STATEMENTS });
});

test('the whole road: the page\'s own address saves a large device picture over HTTP and the member page returns it', async () => {
  const page = readFileSync(new URL('../src/community/ProfilePage.tsx', import.meta.url), 'utf8');
  // The address is read from the page itself, so a wrong one fails here instead of in front of a member.
  const path = page.match(/cx\('([^']+)', \{ method: 'PATCH', body: \{ banner: picture \} \}\)/)?.[1];
  assert.ok(path, 'the upload call is in the page');
  const env = { SHAM_DATA_KEY: 'test-data-key-0123456789-abcdefghijklmnop' };
  const app = express();
  app.use(['/api/community', '/api/admin/community'], express.json({ limit: '3mb' }));
  app.use(express.json({ limit: '128kb' }));
  app.use('/api', createCommunityRouter(createCommunity({ env, sql, fx: ctx.fx }), { env }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const call = async (to: string, init: { method?: string; body?: unknown; token?: string } = {}) => {
    const res = await fetch(`${base}${to}`, { method: init.method || (init.body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) }, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
    return { status: res.status, data: await res.json().catch(() => null) as any };
  };
  try {
    const reg = await call('/community/auth/register', { body: { name: 'Road Test', email: 'road.test@example.com', password: 'Sham2026pass' } });
    assert.equal(reg.status, 200);
    const token = reg.data.token as string;
    const big = `data:image/jpeg;base64,${'A'.repeat(BANNER_MAX_CHARS - 100)}`; // the largest cover the page may send
    const saved = await call(path!, { method: 'PATCH', token, body: { banner: big } });
    assert.equal(saved.status, 200, JSON.stringify(saved.data).slice(0, 200));
    const seen = await call(`/community/profile/${reg.data.me.handle}`, { token });
    assert.equal(seen.status, 200);
    assert.equal(seen.data.banner, big);
    assert.equal((await call(path!, { method: 'PATCH', token, body: { banner: null } })).status, 200);
    assert.equal((await call(`/community/profile/${reg.data.me.handle}`, { token })).data.banner, null);
  } finally { await new Promise((done) => server.close(done)); }
});

test('every fixed address the community pages call exists on the server with the same method', () => {
  const router = readFileSync(new URL('../server/community/router.ts', import.meta.url), 'utf8');
  const routes = [...router.matchAll(/router\.(get|post|patch|put|delete)\('([^']+)'/g)].map((m) => ({ method: m[1]!, re: new RegExp(`^${m[2]!.replace(/:\w+/g, '[^/]+')}$`) }));
  assert.ok(routes.length > 100);
  const dir = new URL('../src/community/', import.meta.url);
  const missing: string[] = []; let checked = 0;
  for (const name of readdirSync(dir).filter((f) => /\.tsx?$/.test(f))) {
    const source = readFileSync(new URL(name, dir), 'utf8');
    for (const m of source.matchAll(/cx(?:<[^(]*?>)?\(\s*'(\/community\/[^']*)'\s*(?:,\s*\{([^}]*))?/g)) {
      const path = m[1]!.split('?')[0]!; const options = m[2] || '';
      const method = (options.match(/^\s*method:\s*'(\w+)'/)?.[1] || (/\bbody\b/.test(options) ? 'POST' : 'GET')).toLowerCase();
      checked += 1;
      if (!routes.some((r) => r.method === method && r.re.test(path))) missing.push(`${name}: ${method.toUpperCase()} ${path}`);
    }
  }
  assert.ok(checked > 60, `checked ${checked}`);
  assert.deepEqual(missing, []);
});
