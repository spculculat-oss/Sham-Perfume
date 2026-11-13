/** «مجتمع شام» على طريقة فيسبوك — stories, the discussion salon and product reviews on a real (PGlite) database. */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import express from 'express';
import { Vault } from '../server/community/crypto';
import { connectPglite, migrate, type Sql } from '../server/community/db';
import * as svc from '../server/community/service';
import * as social from '../server/community/social';
import * as hub from '../server/community/hub';
import * as admin from '../server/community/admin';
import { createCommunityRouter, type Community } from '../server/community/router';

const KEY = 'test-data-key-0123456789-abcdefghijklmnop';
let sql: Sql;
let ctx: svc.Ctx;
let seq = 0;
const PASSWORD = 'Sham2026pass';
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

before(async () => {
  sql = await connectPglite();
  await migrate(sql);
  ctx = { sql, vault: new Vault(KEY), env: {} };
});
after(async () => { await sql?.close(); });

const member = async (name: string) => {
  const r = await svc.register(ctx, { name, email: `${name.toLowerCase()}.${++seq}@example.com`, password: PASSWORD, country: 'EG' });
  return { ...r.me, token: r.token };
};
const befriend = async (a: { id: string }, b: { id: string }) => { await social.requestFriend(ctx, a.id, b.id); await social.acceptFriend(ctx, b.id, a.id); };

test('stories: friends see them for 24 hours, strangers do not, views are counted for the author only', async () => {
  const sara = await member('Sara'); const omar = await member('Omar'); const nada = await member('Nada');
  await befriend(sara, omar);
  await assert.rejects(hub.createStory(ctx, sara.id, {}), { code: 'EMPTY_POST' });
  await assert.rejects(hub.createStory(ctx, sara.id, { image: 'javascript:alert(1)' }), { code: 'INVALID_IMAGE' });
  const { id } = await hub.createStory(ctx, sara.id, { image: PIXEL, caption: 'تجربة عود جديدة', bg: 'nope' });
  await hub.createStory(ctx, nada.id, { caption: 'قصة عامة للجميع', visibility: 'public', bg: 'rose' });

  const forOmar = await hub.stories(ctx, omar.id);
  const saraGroup = forOmar.find((g) => g.user.id === sara.id)!;
  assert.ok(saraGroup, 'a friend sees the story');
  assert.equal(saraGroup.seen, false);
  assert.equal((saraGroup.items[0] as hub_Item).bg, 'amber', 'unknown backgrounds fall back');
  assert.equal((saraGroup.items[0] as hub_Item).views, undefined, 'only the author sees the view count');
  assert.ok(forOmar.find((g) => g.user.id === nada.id), 'public stories reach everyone');

  const stranger = await member('Stranger');
  assert.equal((await hub.stories(ctx, stranger.id)).find((g) => g.user.id === sara.id), undefined, 'friends-only stays with friends');
  await assert.rejects(hub.seeStory(ctx, stranger.id, id), { code: 'NOT_FOUND' });

  await hub.seeStory(ctx, omar.id, id);
  await hub.seeStory(ctx, omar.id, id); // once
  assert.equal((await hub.stories(ctx, omar.id)).find((g) => g.user.id === sara.id)!.seen, true);
  const mine = await hub.stories(ctx, sara.id);
  assert.equal(mine[0].mine, true, 'my own stories come first');
  assert.equal((mine[0].items[0] as hub_Item).views, 1);
  assert.deepEqual((await hub.storyViewers(ctx, sara.id, id)).map((u) => u.id), [omar.id]);
  await assert.rejects(hub.storyViewers(ctx, omar.id, id), { code: 'NOT_FOUND' }, 'not the author');

  await sql.query(`UPDATE stories SET expires_at = now() - interval '1 minute' WHERE id = $1`, [id]);
  assert.equal((await hub.stories(ctx, omar.id)).find((g) => g.user.id === sara.id), undefined, 'gone after 24 hours');

  await social.block(ctx, stranger.id, nada.id);
  assert.equal((await hub.stories(ctx, stranger.id)).find((g) => g.user.id === nada.id), undefined, 'blocking hides stories both ways');
});
type hub_Item = { bg: string; views?: number };

test('discussions: threads, replies, one vote each, the author marks the solving answer', async () => {
  const lina = await member('Lina'); const adam = await member('Adam'); const zed = await member('Zed');
  await assert.rejects(hub.createThread(ctx, lina.id, { title: 'abc' }), { code: 'INVALID_FIELD' });
  const t = await hub.createThread(ctx, lina.id, { title: 'كم مدة تعتيق العود؟', body: 'جربت أسبوعين', category: 'maceration', tags: '#عود, تعتيق' });
  assert.equal(t.category, 'maceration');
  assert.deepEqual(t.tags, ['عود', 'تعتيق']);
  const other = await hub.createThread(ctx, zed.id, { title: 'أفضل زجاجات للتعبئة', category: 'weird' });
  assert.equal(other.category, 'cafe', 'unknown categories go to the café');

  const replied = await hub.replyThread(ctx, adam.id, t.id, 'ستة أسابيع على الأقل في مكان مظلم');
  assert.equal(replied.replies, 1);
  const n = await social.notifications(ctx, lina.id);
  assert.equal(n[0].kind, 'thread_reply');

  assert.equal((await hub.voteThread(ctx, adam.id, t.id, true)).votes, 1);
  assert.equal((await hub.voteThread(ctx, adam.id, t.id, true)).votes, 1, 'one vote per member');
  assert.equal((await hub.voteThread(ctx, zed.id, t.id, true)).votes, 2);
  assert.equal((await hub.voteThread(ctx, zed.id, t.id, false)).votes, 1);

  await assert.rejects(hub.solveThread(ctx, adam.id, t.id, replied.replyList[0].id), { code: 'FORBIDDEN' });
  const solved = await hub.solveThread(ctx, lina.id, t.id, replied.replyList[0].id);
  assert.equal(solved.solvedReply, replied.replyList[0].id);
  assert.equal(solved.replyList[0].accepted, true);
  assert.equal((await social.notifications(ctx, adam.id))[0].kind, 'reply_accepted');

  const list = await hub.threads(ctx, zed.id, { category: 'maceration' });
  assert.deepEqual(list.map((x) => x.id), [t.id]);
  assert.deepEqual((await hub.threads(ctx, zed.id, { q: 'زجاجات' })).map((x) => x.id), [other.id]);
  assert.ok(!(await hub.threads(ctx, zed.id, { sort: 'unsolved' })).some((x) => x.id === t.id));
  assert.equal((await hub.threads(ctx, zed.id, { sort: 'top' }))[0].id, t.id);

  await hub.deleteReply(ctx, lina.id, replied.replyList[0].id); // the thread's author may remove a reply
  assert.equal((await hub.thread(ctx, zed.id, t.id)).replies, 0);
  await admin.moderate(ctx, 'thread', other.id, 'hidden', 'test');
  await assert.rejects(hub.thread(ctx, lina.id, other.id), { code: 'NOT_FOUND' }, 'moderated threads disappear');
});

test('reviews: one per member, real average, «verified purchase» only with a paid order', async () => {
  const buyer = await member('Buyer'); const visitor = await member('Visitor');
  const SKU = 'SP-OUD-001';
  const empty = await hub.reviews(ctx, null, SKU);
  assert.deepEqual({ count: empty.count, average: empty.average, list: empty.reviews.length }, { count: 0, average: 0, list: 0 }, 'no invented reviews or stars');
  await assert.rejects(hub.reviews(ctx, null, '../etc'), { code: 'INVALID_FIELD' });
  await assert.rejects(hub.saveReview(ctx, buyer.id, SKU, { rating: 6, body: 'رائع جداً وثابت' }), { code: 'INVALID_FIELD' });
  await assert.rejects(hub.saveReview(ctx, buyer.id, SKU, { rating: 5, body: 'قصير' }), { code: 'INVALID_FIELD' });

  // An unpaid order does not count…
  await sql.query(`INSERT INTO orders (id, number, buyer_id, items, status) VALUES ('o1', 'N1', $1, $2, 'awaiting_payment')`, [buyer.id, JSON.stringify([{ sku: SKU, qty: 1, name: 'عود' }])]);
  let out = await hub.saveReview(ctx, buyer.id, SKU, { rating: 4, body: 'ثبات ممتاز وفوحان متوسط', longevity: 'long', sillage: 'bogus', verified: true } as Parameters<typeof hub.saveReview>[3]);
  assert.equal(out.reviews[0].verified, false, 'the client cannot claim a purchase');
  assert.equal(out.reviews[0].sillage, '');
  // …a paid one does.
  await sql.query(`UPDATE orders SET status = 'paid' WHERE id = 'o1'`);
  out = await hub.saveReview(ctx, buyer.id, SKU, { rating: 5, body: 'بعد التجربة: ثبات ممتاز جداً' });
  assert.equal(out.count, 1, 'updating keeps one review per member');
  assert.equal(out.reviews[0].verified, true);
  assert.equal(out.canVerify, true);

  out = await hub.saveReview(ctx, visitor.id, SKU, { rating: 2, body: 'لم يعجبني على بشرتي' });
  assert.equal(out.average, 3.5);
  assert.deepEqual(out.spread, [0, 1, 0, 0, 1]);
  assert.equal(out.reviews[0].mine, true, 'my review first');
  assert.equal(out.reviews.find((r) => !r.mine)!.verified, true);
  const json = JSON.stringify(await hub.reviews(ctx, null, SKU));
  assert.doesNotMatch(json, /@example\.com|email/i, 'no private data for visitors');

  const buyersReview = out.reviews.find((r) => !r.mine)!;
  await assert.rejects(hub.helpfulReview(ctx, buyer.id, buyersReview.id, true), { code: 'INVALID_TARGET' }, 'not on my own review');
  out = await hub.helpfulReview(ctx, visitor.id, buyersReview.id, true);
  out = await hub.helpfulReview(ctx, visitor.id, buyersReview.id, true);
  assert.equal(out.reviews.find((r) => r.id === buyersReview.id)!.helpful, 1);
  await hub.deleteReview(ctx, visitor.id, out.reviews.find((r) => r.mine)!.id);
  assert.equal((await hub.reviews(ctx, null, SKU)).count, 1);
});

test('profile shows a real friends preview, no invented people', async () => {
  const a = await member('Alpha'); const b = await member('Beta');
  assert.deepEqual((await social.profile(ctx, b.id, a.handle)).friends, []);
  await befriend(a, b);
  assert.deepEqual((await social.profile(ctx, b.id, a.handle)).friends.map((u) => u.id), [b.id]);
});

test('HTTP: reviews are public to read, stories and discussions need an account', async () => {
  const community: Community = { ready: async () => ctx, status: async () => ({ enabled: true }) } as unknown as Community;
  const app = express();
  app.use('/api', createCommunityRouter(community, { env: {} }));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  try {
    const writer = await member('Writer');
    assert.equal((await fetch(`${base}/community/reviews/SKU-1`)).status, 200);
    assert.equal((await fetch(`${base}/community/stories`)).status, 401);
    assert.equal((await fetch(`${base}/community/discussions`)).status, 401);
    const post = await fetch(`${base}/community/reviews/SKU-1`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${writer.token}` }, body: JSON.stringify({ rating: 5, body: 'عطر جميل وثابت جداً' }) });
    assert.equal(post.status, 200);
    const read = await (await fetch(`${base}/community/reviews/SKU-1`, { headers: { authorization: `Bearer ${writer.token}` } })).json();
    assert.equal(read.reviews[0].mine, true);
    const anon = await (await fetch(`${base}/community/reviews/SKU-1`)).json();
    assert.equal(anon.reviews[0].mine, false);
  } finally { server.close(); }
});
