import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { Vault } from '../server/community/crypto';
import { connectPglite, migrate, type Sql } from '../server/community/db';
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
