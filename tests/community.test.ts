import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import express from 'express';
import { Vault, hashPassword, verifyPassword } from '../server/community/crypto';
import { connectPglite, databaseErrorKind, databaseHints, findDatabase, migrate, type Sql } from '../server/community/db';
import * as svc from '../server/community/service';
import * as social from '../server/community/social';
import * as chat from '../server/community/messenger';
import * as admin from '../server/community/admin';
import { createCommunity, createCommunityRouter } from '../server/community/router';
import type { FxTable } from '../src/utils/pricing';

const KEY = 'test-data-key-0123456789-abcdefghijklmnop';
const FX: FxTable = { base: 'USD', updatedAt: '2026-10-01T00:00:00Z', rates: { USD: 1, EGP: 50, EUR: 0.9, SAR: 3.75 } };
let sql: Sql;
let ctx: svc.Ctx;
let seq = 0;
const email = (name: string) => `${name}.${++seq}@example.com`;
const PASSWORD = 'Sham2026pass';

before(async () => {
  sql = await connectPglite();
  await migrate(sql);
  await migrate(sql); // idempotent
  ctx = { sql, vault: new Vault(KEY), fx: async () => FX, env: {} }; // empty env: no e-mail provider can leak into the tests
});
after(async () => { await sql?.close(); });

const newMember = async (name: string, extra: Record<string, unknown> = {}) => (await svc.register(ctx, { name, email: email(name.toLowerCase()), password: PASSWORD, country: 'EG', ...extra })).me;
const raw = async (query: string, params: unknown[] = []) => JSON.stringify(await sql.query(query, params));

/* --------------------------------------------- security --------------------------------------------- */

test('passwords are scrypt-hashed and private data is AES-GCM encrypted with a server key', async () => {
  const hash = await hashPassword('Secret123');
  assert.match(hash, /^scrypt\$32768\$/);
  assert.equal(await verifyPassword('Secret123', hash), true);
  assert.equal(await verifyPassword('Secret124', hash), false);
  const vault = new Vault(KEY);
  const sealed = vault.seal('رسالة سرية')!;
  assert.doesNotMatch(sealed, /رسالة/);
  assert.equal(vault.open(sealed), 'رسالة سرية');
  assert.notEqual(vault.seal('x'), vault.seal('x'), 'random IV per value');
  assert.equal(new Vault(`${KEY}-other`).open(sealed), '', 'another key cannot read it');
  const parts = sealed.split('.'); parts[3] = `${parts[3].startsWith('A') ? 'B' : 'A'}${parts[3].slice(1)}`;
  assert.equal(vault.open(parts.join('.')), '', 'tampering is detected');
  assert.equal(vault.index('A@B.com '), vault.index('a@b.com'));
  assert.throws(() => new Vault('short'));
});

test('accounts: register, log in, sessions, generic login errors, suspended accounts', async () => {
  const address = email('mona');
  const { token, me } = await svc.register(ctx, { name: 'منى', email: address, password: PASSWORD, country: 'EG', phone: '01001234567' });
  assert.equal(me.email, address);
  assert.deepEqual(me.private, { phone: '01001234567', city: '' });
  const stored = await raw(`SELECT * FROM users WHERE id = $1`, [me.id]);
  assert.doesNotMatch(stored, new RegExp(address.replace('.', '\\.')), 'the e-mail is not stored in clear');
  assert.doesNotMatch(stored, /01001234567|Sham2026pass/);
  assert.doesNotMatch(await raw(`SELECT * FROM sessions`), new RegExp(token), 'only the token hash is stored');
  assert.equal((await svc.authenticate(ctx, token))?.id, me.id);
  await assert.rejects(svc.register(ctx, { name: 'Mona', email: address.toUpperCase(), password: PASSWORD }), { code: 'EMAIL_EXISTS' });
  await assert.rejects(svc.register(ctx, { name: 'X', email: email('x'), password: 'short' }), { code: 'INVALID_FIELD' });
  await assert.rejects(svc.register(ctx, { name: 'Weak', email: email('weak'), password: 'onlyletters' }), { code: 'WEAK_PASSWORD' });
  await assert.rejects(svc.login(ctx, { email: address, password: 'Wrong2026pass' }), { code: 'INVALID_LOGIN' });
  await assert.rejects(svc.login(ctx, { email: 'nobody@example.com', password: PASSWORD }), { code: 'INVALID_LOGIN' }, 'same answer for an unknown e-mail');
  const second = await svc.login(ctx, { email: address, password: PASSWORD });
  if ('pending' in second) throw new Error('unexpected pending login');
  await svc.logout(ctx, second.token);
  assert.equal(await svc.authenticate(ctx, second.token), undefined);
  assert.ok(await svc.authenticate(ctx, token), 'other sessions stay');
  await admin.setUserStatus(ctx, me.id, 'suspended');
  assert.equal(await svc.authenticate(ctx, token), undefined, 'suspension signs out everywhere');
  await assert.rejects(svc.login(ctx, { email: address, password: PASSWORD }), { code: 'ACCOUNT_SUSPENDED' });
});

/* ------------------------------------------ merchants & store ------------------------------------------ */

test('merchants: review before publishing, private source links, +50 % price, no contacts on the public page', async () => {
  const seller = await newMember('Seller');
  await assert.rejects(svc.createProduct(ctx, seller.id, { name: 'x', price: 1, currency: 'EGP' }), { code: 'NOT_MERCHANT' });
  const store = await svc.applyMerchant(ctx, seller.id, {
    storeName: 'Oud House', about: 'Best oud. Call 01001234567 or visit https://oudhouse.example.com', country: 'EG', currency: 'USD',
    legal: { legalName: 'Oud House LLC', phone: '+20 100 123 4567', taxId: 'TAX-1' }, payout: { method: 'bank', iban: 'EG380019000500000000263180002' },
  });
  assert.equal(store.status, 'pending');
  assert.equal(store.payout.iban, 'EG380019000500000000263180002');
  assert.doesNotMatch(await raw(`SELECT * FROM merchants WHERE user_id = $1`, [seller.id]), /EG3800190005|TAX-1/, 'legal and payout data are encrypted');

  const product = await svc.createProduct(ctx, seller.id, {
    name: 'Royal Oud 50ml', description: 'Rich oud. WhatsApp +201001234567, shop at www.oudhouse.example.com', category: 'perfume', price: 20, currency: 'USD', stock: 5,
    images: ['https://cdn.example.com/oud.jpg'], source: { links: 'https://supplier.example.com/oud?id=7', notes: 'warehouse B' },
  });
  assert.equal(product.status, 'pending');
  assert.doesNotMatch(product.description, /\+?201001234567|www\./, 'contacts are stripped from what buyers read');
  assert.deepEqual(product.source, { links: ['https://supplier.example.com/oud?id=7'], notes: 'warehouse B' });
  assert.doesNotMatch(await raw(`SELECT * FROM merchant_products WHERE id = $1`, [product.id]), /supplier\.example/, 'source links are encrypted');

  await assert.rejects(svc.storePage(ctx, store.slug), { code: 'NOT_FOUND' }, 'not public before approval');
  await admin.reviewMerchant(ctx, seller.id, { status: 'approved' });
  assert.equal((await svc.storePage(ctx, store.slug)).products.length, 0, 'a pending product is not published');
  await admin.reviewProduct(ctx, product.id, { status: 'approved' });
  const page = await svc.storePage(ctx, store.slug);
  assert.equal(page.products.length, 1);
  assert.equal(page.products[0].priceEgp, 1500, '20 USD × 50 EGP × 1.5');
  assert.equal(svc.sellingPriceEgp(20, 'USD', FX), 1500);
  const pageJson = JSON.stringify(page);
  assert.doesNotMatch(pageJson, /supplier|warehouse|01001234567|oudhouse|IBAN|EG3800|"price":20/, 'no source, contact, payout or merchant price in public');
  assert.ok((await svc.storeDirectory(ctx)).some((s) => s.slug === store.slug));
  const arabic = await newMember('Musk');
  const musk = await svc.applyMerchant(ctx, arabic.id, { storeName: 'بيت المسك', legal: { phone: '01000000001' } });
  assert.match(musk.slug, /^[a-z0-9-]+-store$/, 'an Arabic store name gets an address from the owner’s username');

  // Changing what buyers see sends the product back to review; stock alone does not.
  assert.equal((await svc.updateProduct(ctx, seller.id, product.id, { stock: 9 })).status, 'approved');
  assert.equal((await svc.updateProduct(ctx, seller.id, product.id, { price: 25 })).status, 'pending');
  await admin.reviewProduct(ctx, product.id, { status: 'approved' });
  const notes = await social.notifications(ctx, seller.id);
  assert.ok(notes.some((n) => n.kind === 'merchant_approved') && notes.some((n) => n.kind === 'product_approved'));

  // Checkout: server-side price, one order per merchant, stock reserved when paid, buyer address encrypted.
  const buyer = await newMember('Buyer');
  const [priced] = await svc.productsForCheckout(ctx, [product.id, 'mp_unknownproduct1']);
  assert.equal(priced.price, 1900, '25 USD × 50 × 1.5 = 1875, rounded up to a tidy price like the rest of the store');
  assert.equal(await svc.recordCheckout(ctx, { ref: 'SP-TEST-1', buyerId: buyer.id, country: 'EG', items: [{ sku: product.id, qty: 2 }],
    address: { name: 'Buyer', phone: '01112223334', city: 'Giza', line: '12 Pyramids St' }, shippingUsd: 18, total: 4650, currency: 'EGP' }), 1);
  assert.equal((await svc.merchantOrders(ctx, seller.id)).length, 0, 'unpaid orders are not shown to the merchant');
  assert.doesNotMatch(await raw(`SELECT * FROM orders`), /Pyramids|01112223334/);
  assert.equal(await svc.markPaid(ctx, 'SP-TEST-1'), 1);
  assert.equal(await svc.markPaid(ctx, 'SP-TEST-1'), 0, 'idempotent');
  const [order] = await svc.merchantOrders(ctx, seller.id);
  assert.equal(order.amount, 50, 'the merchant sees their own price × qty');
  assert.equal(JSON.stringify(order).includes('Pyramids'), false, 'not the buyer address');
  assert.equal((await svc.myProducts(ctx, seller.id))[0].stock, 7);
  const [buyerOrder] = await svc.myOrders(ctx, buyer.id);
  assert.equal(buyerOrder.store, 'Oud House');
  assert.equal(buyerOrder.total, 4650, 'hiding the margin never changes the customer total');
  assert.doesNotMatch(JSON.stringify(buyerOrder), /margin|commission|markup|merchantUnit|merchant_total|costPrice|platformRevenue/i,
    'customer order/receipt data must not expose internal pricing or margin fields');
  const [adminOrder] = await admin.orders(ctx);
  assert.equal(adminOrder.address.line, '12 Pyramids St');
  assert.equal(adminOrder.marginEgp, 1300, 'the site margin (2 × (1900 − 1250 EGP)) is recorded for the administration');
  await svc.merchantOrderReady(ctx, seller.id, order.id);
  await admin.setOrderStatus(ctx, order.id, 'shipped');
  assert.equal((await svc.myOrders(ctx, buyer.id))[0].status, 'shipped');

  // One payment with a merchant's product and the site's own product: two orders, the total shown once.
  assert.equal(await svc.recordCheckout(ctx, { ref: 'SP-TEST-2', buyerId: buyer.id, country: 'EG', items: [{ sku: product.id, qty: 1 }, { sku: 'sham-oud-1', qty: 1 }],
    catalog: [{ sku: 'sham-oud-1', qty: 1, price: 900, name: 'عود شام', image: 'https://example.com/oud.jpg' }],
    address: { name: 'Buyer', city: 'Giza', line: 'x' }, shippingUsd: 18, total: 3700, currency: 'EGP' }), 1);
  assert.equal(await svc.markPaid(ctx, 'SP-TEST-2'), 1, 'only the merchant order notifies a merchant');
  const second = (await svc.myOrders(ctx, buyer.id)).filter((o) => o.status === 'paid');
  assert.deepEqual(second.map((o) => o.store).sort(), ['Oud House', svc.SITE_STORE].sort());
  assert.equal(second.filter((o) => o.total === 3700).length, 1, 'the payment total appears once');
  assert.ok((await admin.orders(ctx)).some((o) => o.storeName === svc.SITE_STORE && o.items.some((i: { sku: string }) => i.sku === 'sham-oud-1')));
});

/* ------------------------------------------- user portal ------------------------------------------- */

test('recipes and learning belong to their owner; sharing follows the chosen visibility', async () => {
  const a = await newMember('Amal'); const b = await newMember('Badr');
  const recipe = await svc.saveRecipe(ctx, a.id, { title: 'عود ملكي', data: { oils: [{ name: 'Oud', pct: 20 }] }, visibility: 'private' });
  await assert.rejects(svc.getRecipe(ctx, b.id, recipe.id), { code: 'NOT_FOUND' });
  await svc.saveRecipe(ctx, a.id, { id: recipe.id, title: 'عود ملكي', data: recipe.data, visibility: 'friends' });
  await assert.rejects(svc.getRecipe(ctx, b.id, recipe.id), { code: 'NOT_FOUND' });
  await social.requestFriend(ctx, b.id, a.id); await social.acceptFriend(ctx, a.id, b.id);
  assert.equal((await svc.getRecipe(ctx, b.id, recipe.id)).title, 'عود ملكي');
  await assert.rejects(svc.saveRecipe(ctx, b.id, { id: recipe.id, title: 'stolen' }), { code: 'NOT_FOUND' });
  await svc.saveLearning(ctx, a.id, { itemId: 'guide:fixatives', kind: 'guide', title: 'المثبتات', progress: 60 });
  const learning = await svc.saveLearning(ctx, a.id, { itemId: 'guide:fixatives', kind: 'guide', title: 'المثبتات', progress: 30 });
  assert.equal(learning[0].progress, 60, 'progress never goes back');
  const exported = await svc.exportMyData(ctx, a.id);
  assert.equal(exported.recipes.length, 1);
  assert.equal(exported.learning.length, 1);
});

/* ------------------------------------------------ social ------------------------------------------------ */

test('social: public and friends-only posts, reactions, comments, friend requests, blocking, reports', async () => {
  const sara = await newMember('Sara'); const omar = await newMember('Omar'); const lina = await newMember('Lina');
  const pub = await social.createPost(ctx, sara.id, { body: 'أول تجربة عود 🌹', visibility: 'public' });
  const priv = await social.createPost(ctx, sara.id, { body: 'للأصدقاء فقط', visibility: 'friends' });
  let omarFeed = await social.feed(ctx, omar.id);
  assert.ok(omarFeed.some((p) => p.id === pub.id));
  assert.ok(!omarFeed.some((p) => p.id === priv.id), 'friends-only is hidden from non-friends');
  await assert.rejects(social.getPost(ctx, omar.id, priv.id), { code: 'NOT_FOUND' });

  assert.equal(await social.requestFriend(ctx, omar.id, sara.id), 'requested');
  assert.equal(await social.relation(ctx, sara.id, omar.id), 'incoming');
  assert.equal((await social.friends(ctx, sara.id)).incoming[0].id, omar.id);
  assert.equal(await social.acceptFriend(ctx, sara.id, omar.id), 'friends');
  omarFeed = await social.feed(ctx, omar.id);
  assert.ok(omarFeed.some((p) => p.id === priv.id), 'friends see it');
  assert.equal((await social.feed(ctx, omar.id, { scope: 'friends' })).every((p) => p.author.id === sara.id || p.author.id === omar.id), true);

  const reacted = await social.react(ctx, omar.id, pub.id, 'love');
  assert.deepEqual(reacted.reactions, { love: 1 });
  assert.equal(reacted.myReaction, 'love');
  await assert.rejects(social.react(ctx, omar.id, pub.id, 'angry-bird'), { code: 'INVALID_REACTION' });
  const thread = await social.addComment(ctx, omar.id, pub.id, 'رائع!');
  assert.equal(thread.length, 1);
  await social.deleteComment(ctx, sara.id, thread[0].id); // the post's author may remove comments
  assert.equal((await social.comments(ctx, omar.id, pub.id)).length, 0);
  const kinds = (await social.notifications(ctx, sara.id)).map((n) => n.kind);
  assert.ok(kinds.includes('friend_request') && kinds.includes('reaction') && kinds.includes('comment'));

  const profile = await social.profile(ctx, lina.id, sara.handle);
  assert.equal(profile.relation, 'none');
  assert.ok(profile.posts.every((p) => p.visibility === 'public'));
  assert.ok((await social.searchPeople(ctx, lina.id, 'sar')).some((u) => u.id === sara.id));
  assert.ok((await social.suggestions(ctx, lina.id)).length > 0);

  await social.block(ctx, sara.id, lina.id);
  assert.ok(!(await social.feed(ctx, lina.id)).some((p) => p.author.id === sara.id), 'blocked people disappear from the feed');
  assert.ok(!(await social.searchPeople(ctx, lina.id, 'sar')).some((u) => u.id === sara.id));
  await assert.rejects(social.profile(ctx, lina.id, sara.handle), { code: 'NOT_FOUND' });
  await assert.rejects(social.requestFriend(ctx, lina.id, sara.id), { code: 'NOT_FOUND' });
  await social.report(ctx, lina.id, { kind: 'post', id: pub.id, reason: 'spam' });
  assert.equal((await admin.reports(ctx)).filter((r) => r.targetId === pub.id).length, 1);
  await admin.moderate(ctx, 'post', pub.id, 'hidden', 'reported');
  assert.ok(!(await social.feed(ctx, omar.id)).some((p) => p.id === pub.id), 'hidden by the administration');
});

/* ----------------------------------------------- messenger ----------------------------------------------- */

test('messenger: encrypted messages, replies, edits, delete for everyone, reactions, receipts, typing, polling', async () => {
  const hana = await newMember('Hana'); const karim = await newMember('Karim'); const zaid = await newMember('Zaid');
  const id = await chat.openDirect(ctx, hana.id, karim.id);
  assert.equal(await chat.openDirect(ctx, karim.id, hana.id), id, 'one conversation per pair');
  const first = await chat.send(ctx, hana.id, id, { text: 'أهلاً كريم، عندك عود كمبودي؟' });
  assert.doesNotMatch(await raw(`SELECT * FROM messages`), /كمبودي/, 'the database holds ciphertext only');
  const reply = await chat.send(ctx, karim.id, id, { text: 'أيوه، عندي 12 جرام', replyTo: first.id });
  await assert.rejects(chat.messages(ctx, zaid.id, id), { code: 'NOT_FOUND' }, 'only members can read');

  let inbox = await chat.conversations(ctx, hana.id);
  assert.equal(inbox[0].unread, 1);
  assert.equal(inbox[0].last?.text, 'أيوه، عندي 12 جرام');
  assert.equal((await chat.pulse(ctx, hana.id)).messages, 1);
  const view = await chat.messages(ctx, hana.id, id);
  assert.equal(view.messages.length, 2);
  assert.equal(view.messages[1].replyTo?.text, 'أهلاً كريم، عندك عود كمبودي؟');
  await chat.markRead(ctx, hana.id, id);
  assert.equal((await chat.pulse(ctx, hana.id)).messages, 0);
  const karimView = await chat.messages(ctx, karim.id, id);
  const hanaMember = karimView.members.find((m) => m.id === hana.id)!;
  assert.ok(new Date(hanaMember.lastReadAt!) >= new Date(karimView.messages[1].createdAt!), 'read receipt (✓✓)');

  await chat.typing(ctx, karim.id, id);
  assert.equal((await chat.messages(ctx, hana.id, id)).members.find((m) => m.id === karim.id)?.typing, true);
  assert.deepEqual((await chat.conversations(ctx, hana.id))[0].typing, ['Karim']);

  // Polling sees edits, reactions and deletions since the last look.
  const since = view.serverTime!;
  await chat.reactMessage(ctx, hana.id, reply.id, '🔥');
  await chat.editMessage(ctx, hana.id, first.id, 'أهلاً كريم، عندك عود هندي؟');
  await assert.rejects(chat.editMessage(ctx, karim.id, first.id, 'hack'), { code: 'NOT_FOUND' });
  let changes = (await chat.messages(ctx, karim.id, id, { since })).messages;
  assert.deepEqual(changes.map((m) => m.id).sort(), [first.id, reply.id].sort());
  assert.deepEqual(changes.find((m) => m.id === reply.id)?.reactions, { '🔥': 1 });
  assert.equal(changes.find((m) => m.id === first.id)?.text, 'أهلاً كريم، عندك عود هندي؟');
  await chat.deleteMessage(ctx, hana.id, first.id);
  changes = (await chat.messages(ctx, karim.id, id, { since })).messages;
  const gone = changes.find((m) => m.id === first.id)!;
  assert.equal(gone.deleted, true);
  assert.equal(gone.text, '');
  const [stored] = await sql.query(`SELECT body_enc FROM messages WHERE id = $1`, [first.id]);
  assert.equal(stored.body_enc, null, 'deleted for everyone = erased');

  // Pictures and voice notes; recipes; size and type checks.
  const png = `data:image/png;base64,${Buffer.from('fake-png').toString('base64')}`;
  assert.equal((await chat.send(ctx, karim.id, id, { kind: 'image', attachment: png })).attachment, png);
  const voice = `data:audio/webm;codecs=opus;base64,${Buffer.from('opus').toString('base64')}`;
  assert.equal((await chat.send(ctx, karim.id, id, { kind: 'voice', attachment: voice })).kind, 'voice');
  await assert.rejects(chat.send(ctx, karim.id, id, { kind: 'image', attachment: 'javascript:alert(1)' }), { code: 'INVALID_IMAGE' });
  const recipe = await svc.saveRecipe(ctx, hana.id, { title: 'مسك أبيض', data: { musk: 30 } });
  const shared = await chat.send(ctx, hana.id, id, { kind: 'recipe', recipeId: recipe.id });
  assert.equal(JSON.parse(shared.attachment!).title, 'مسك أبيض');

  // Groups need friends; blocking stops a direct chat.
  await assert.rejects(chat.createGroup(ctx, hana.id, { title: 'صناع العطور', members: [karim.id] }), { code: 'NOT_FRIENDS' });
  await social.requestFriend(ctx, hana.id, karim.id); await social.acceptFriend(ctx, karim.id, hana.id);
  await social.requestFriend(ctx, hana.id, zaid.id); await social.acceptFriend(ctx, zaid.id, hana.id);
  const group = await chat.createGroup(ctx, hana.id, { title: 'صناع العطور', members: [karim.id] });
  await chat.updateGroup(ctx, hana.id, group, { add: [zaid.id], title: 'صناع العطور 🌹' });
  await chat.send(ctx, zaid.id, group, { text: 'سلام عليكم' });
  assert.equal((await chat.conversations(ctx, karim.id)).find((c) => c.id === group)?.title, 'صناع العطور 🌹');
  await chat.updateGroup(ctx, karim.id, group, { muted: true });
  await chat.markRead(ctx, karim.id, id); // Hana's shared recipe in the direct chat
  assert.equal((await chat.pulse(ctx, karim.id)).messages, 0, 'muted chats do not count');
  await social.block(ctx, karim.id, hana.id);
  await assert.rejects(chat.send(ctx, hana.id, id, { text: 'hello?' }), { code: 'BLOCKED' });

  // The administration reads a conversation only with a reason, and it is audited.
  await assert.rejects(admin.readConversation(ctx, id, ''), { code: 'REASON_REQUIRED' });
  const file = await admin.readConversation(ctx, id, 'بلاغ عن احتيال');
  assert.ok(file.messages.some((m) => m.text === 'أيوه، عندي 12 جرام'));
  assert.ok((await admin.auditLog(ctx)).some((a) => a.action === 'read_conversation' && a.detail === 'بلاغ عن احتيال'));
});

/* ---------------------------------------------- HTTP API ---------------------------------------------- */

async function withApi(env: Record<string, string>, run: (base: string) => Promise<void>, withDb = true) {
  const app = express();
  app.use(['/api/community', '/api/admin/community'], express.json({ limit: '3mb' }));
  app.use(express.json({ limit: '128kb' }));
  const community = createCommunity({ env, sql: withDb ? sql : undefined, fx: async () => FX });
  app.use('/api', createCommunityRouter(community, { env }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`); } finally { await new Promise((done) => server.close(done)); }
}
const call = async (base: string, path: string, init: { method?: string; body?: unknown; token?: string } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method: init.method || (init.body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return { status: res.status, data: await res.json().catch(() => null) as any };
};

test('HTTP: not configured without a database or key; members, public stores and the administration', async () => {
  await withApi({}, async (base) => {
    assert.deepEqual((await call(base, '/community/status')).data, { enabled: false, reason: 'database', found: [] });
    assert.equal((await call(base, '/community/auth/login', { body: { email: 'a@b.co', password: 'x' } })).data.code, 'COMMUNITY_NOT_CONFIGURED');
  }, false);
  await withApi({ SHAM_DATA_KEY: KEY }, async (base) => {
    assert.deepEqual((await call(base, '/community/status')).data, { enabled: false, reason: 'database', found: [] });
  }, false);

  await withApi({ SHAM_DATA_KEY: KEY, SHAM_ADMIN_TOKEN: 'admin-token-for-tests' }, async (base) => {
    assert.equal((await call(base, '/community/status')).data.enabled, true);
    const address = email('http');
    const reg = await call(base, '/community/auth/register', { body: { name: 'Http User', email: address, password: PASSWORD } });
    assert.equal(reg.status, 200);
    const token = reg.data.token as string;
    assert.equal((await call(base, '/community/me')).status, 401);
    assert.equal((await call(base, '/community/me', { token })).data.email, address);
    const post = await call(base, '/community/posts', { token, body: { body: 'مرحبا مجتمع شام', image: `data:image/jpeg;base64,${'A'.repeat(200_000)}` } });
    assert.equal(post.status, 200, 'pictures fit (larger body limit on community routes)');
    assert.equal((await call(base, '/community/feed', { token })).data[0].body, 'مرحبا مجتمع شام');
    const savedPath = `/community/posts/${post.data.id}/saved`;
    assert.equal((await call(base, savedPath, { method: 'PUT' })).status, 401);
    assert.equal((await call(base, savedPath, { method: 'DELETE' })).status, 401);
    assert.equal((await call(base, savedPath, { method: 'PUT', token })).data.saved, true);
    assert.deepEqual((await call(base, '/community/feed?scope=saved', { token })).data.map((p: any) => p.id), [post.data.id]);
    assert.equal((await call(base, savedPath, { method: 'DELETE', token })).status, 200);
    assert.deepEqual((await call(base, '/community/feed?scope=saved', { token })).data, []);
    assert.equal((await call(base, '/community/pulse', { token })).data.messages, 0);
    assert.ok(Array.isArray((await call(base, '/community/stores')).data), 'stores are public');

    assert.equal((await call(base, '/admin/community/overview')).status, 401);
    assert.equal((await call(base, '/admin/community/overview', { token })).status, 401, 'a member token is not an admin token');
    const overview = await call(base, '/admin/community/overview', { token: 'admin-token-for-tests' });
    assert.ok(overview.data.users >= 1);
    const found = await call(base, `/admin/community/users?q=${encodeURIComponent(address)}`, { token: 'admin-token-for-tests' });
    assert.equal(found.data[0].email, address, 'the administration finds a member by e-mail (blind index)');
    const file = await call(base, `/admin/community/users/${found.data[0].id}`, { token: 'admin-token-for-tests' });
    assert.equal(file.data.account.email, address);
    assert.equal((await call(base, '/community/auth/logout', { token, body: {} })).status, 200);
    assert.equal((await call(base, '/community/me', { token })).status, 401);
  });
});

test('data key: a database alone is enough (auto key), SHAM_DATA_KEY added later wraps it, a wrong one is refused', async () => {
  const fresh = await connectPglite();
  try {
    const open = async (env: Record<string, string>) => createCommunity({ env, sql: fresh, fx: async () => FX });
    const auto = await open({});
    assert.deepEqual(await auto.status(), { enabled: true, store: 'pglite', keyMode: 'auto' });
    const ctx = (await auto.ready())!;
    const reg = await svc.register(ctx, { name: 'Auto Key', email: 'auto@key.test', password: PASSWORD }, 'test');
    const [stored] = await fresh.query(`SELECT value FROM community_meta WHERE key = 'data_key'`);
    assert.match(stored.value, /^plain:/);

    const wrapped = await open({ SHAM_DATA_KEY: KEY });
    assert.equal((await wrapped.status()).keyMode, 'wrapped');
    const [after] = await fresh.query(`SELECT value FROM community_meta WHERE key = 'data_key'`);
    assert.match(after.value, /^wrapped:/, 'the key is no longer readable from the database alone');
    const ctx2 = (await wrapped.ready())!;
    const login = await svc.login(ctx2, { email: 'auto@key.test', password: PASSWORD }, 'test');
    if ('pending' in login) throw new Error('unexpected pending login');
    assert.equal(login.me.id, reg.me.id, 'members created before the key was wrapped still sign in');
    assert.equal((await svc.me(ctx2, reg.me.id)).email, 'auto@key.test', 'and their encrypted data still opens');

    assert.deepEqual(await (await open({ SHAM_DATA_KEY: 'a-completely-different-key-0123456789' })).status(), { enabled: false, reason: 'key' });
    assert.deepEqual(await (await open({})).status(), { enabled: false, reason: 'key' });
  } finally {
    await fresh.close();
  }
});

test('database setting: found under any name the dashboard gives it; status lists names only', () => {
  const url = 'postgresql://u:p@ep-x.neon.tech/db?sslmode=require';
  assert.deepEqual(findDatabase({}), { url: '' });
  assert.deepEqual(findDatabase({ DATABASE_URL: url }), { url, name: 'DATABASE_URL' });
  assert.deepEqual(findDatabase({ POSTGRES_URL: url, SHAM_DATABASE_URL: 'postgres://a/b' }), { url: 'postgres://a/b', name: 'SHAM_DATABASE_URL' });
  // a custom prefix from Vercel → Storage → Connect; the pooled URL wins over the unpooled one
  assert.deepEqual(findDatabase({ STORAGE_DATABASE_URL_UNPOOLED: 'postgres://direct/db', STORAGE_DATABASE_URL: url }), { url, name: 'STORAGE_DATABASE_URL' });
  assert.deepEqual(findDatabase({ sham_POSTGRES_URL: url }), { url, name: 'sham_POSTGRES_URL' });
  assert.equal(findDatabase({ STORAGE_DATABASE_URL: 'not a url' }).url, '');
  // Neon's separate parts
  const parts = findDatabase({ NEON_PGHOST: 'ep-x.neon.tech', NEON_PGUSER: 'me', NEON_PGPASSWORD: 'p@ss', NEON_PGDATABASE: 'neondb' });
  assert.equal(parts.url, 'postgresql://me:p%40ss@ep-x.neon.tech/neondb?sslmode=require');
  // any setting holding a postgres URL
  assert.equal(findDatabase({ MY_DB: url, GEMINI_API_KEY: 'x' }).name, 'MY_DB');
  assert.deepEqual(databaseHints({ GEMINI_API_KEY: 'x', NEON_PROJECT_ID: 'y', STORAGE_PGHOST: 'z', DATABASE_URL: '' }), ['DATABASE_URL', 'NEON_PROJECT_ID', 'STORAGE_PGHOST']);
  assert.equal(databaseErrorKind(new Error('password authentication failed for user "x"')), 'auth');
  assert.equal(databaseErrorKind(Object.assign(new Error('getaddrinfo ENOTFOUND ep-x'), { code: 'ENOTFOUND' })), 'network');
});

/* ------------------- account security v2 — the Google/Apple/Meta study (SHAM_AUTH.md) ------------------- */
import { issueCode } from '../server/community/codes';
import { totpCode, totpCounter } from '../server/community/totp';

test('common passwords are refused: the top-10k breached list blocks sign-up and changes', async () => {
  await assert.rejects(svc.register(ctx, { name: 'Weak', email: email('common1'), password: 'password123' }), { code: 'COMMON_PASSWORD' });
  await assert.rejects(svc.register(ctx, { name: 'Weak', email: email('common2'), password: 'Qwerty123' }), { code: 'COMMON_PASSWORD' });
  await assert.rejects(svc.changePassword(ctx, (await svc.register(ctx, { name: 'Wk', email: email('common3'), password: PASSWORD })).me.id, { current: PASSWORD, next: 'welcome1' }), { code: 'COMMON_PASSWORD' });
  const strong = await newMember('Strong', { password: 'Xk9mP2vQ8wL4nZ' });
  assert.ok(strong.id, 'an uncommon password is accepted');
});

test('per-account lockout after 5 wrong passwords, with the security audit trail', async () => {
  const address = email('locked');
  const { me } = await svc.register(ctx, { name: 'Lock', email: address, password: PASSWORD });
  for (let i = 0; i < 4; i++) await assert.rejects(svc.login(ctx, { email: address, password: 'Wrong9999xx' }), { code: 'INVALID_LOGIN' });
  const [row] = await sql.query(`SELECT failed_logins FROM users WHERE id = $1`, [me.id]);
  assert.equal(row.failed_logins, 4, 'the counter climbs one per failure');
  await assert.rejects(svc.login(ctx, { email: address, password: 'Wrong9999xx' }), { code: 'INVALID_LOGIN' }); // the fifth one locks
  const [row2] = await sql.query(`SELECT failed_logins, locked_until FROM users WHERE id = $1`, [me.id]);
  assert.ok(row2.locked_until && new Date(row2.locked_until).getTime() > Date.now(), 'locked for the window');
  await assert.rejects(svc.login(ctx, { email: address, password: PASSWORD }), { code: 'ACCOUNT_LOCKED' }, 'even the right password waits');
  await sql.query(`UPDATE users SET locked_until = now() - interval '1 second' WHERE id = $1`, [me.id]); // the clock moves on
  const back = await svc.login(ctx, { email: address, password: PASSWORD });
  if ('pending' in back) throw new Error('unexpected pending login');
  const audit = await sql.query(`SELECT action FROM audit WHERE actor = $1 ORDER BY id`, [me.id]);
  const actions = audit.map((r) => r.action);
  for (const a of ['register', 'login_fail', 'account_locked', 'login_ok']) assert.ok(actions.includes(a), `audit has ${a}`);
});

test('e-mail verification: soft at register, the code sets the flag, single use, honest e-mail', async () => {
  const address = email('verify');
  const { me } = await svc.register(ctx, { name: 'Vera', email: address, password: PASSWORD });
  assert.equal(me.emailVerified, null, 'unverified until the code is entered');
  const code = await issueCode(ctx, me.id, 'verify_email'); // the test stands in for the e-mail provider
  const after = await svc.verifyEmail(ctx, me.id, code);
  assert.ok(after.emailVerified, 'the flag is set');
  await assert.rejects(svc.verifyEmail(ctx, me.id, code), { code: 'CODE_INVALID' }, 'the code is single-use');
  await assert.rejects(svc.resendVerification(ctx, me.id), { code: 'EMAIL_UNAVAILABLE' }, 'no provider → no fake code');
  // the rolling limit: five codes in the window, the sixth waits
  const limiter = email('verifylimit');
  const limited = await svc.register(ctx, { name: 'Lim', email: limiter, password: PASSWORD });
  if ('pending' in limited) throw new Error('unexpected pending login');
  for (let i = 0; i < 4; i++) await issueCode(ctx, limited.me.id, 'verify_email'); // register issued the first
  await assert.rejects(issueCode(ctx, limited.me.id, 'verify_email'), { code: 'CODE_LIMITED' });
});

test('password reset: identical answers either way, single-use codes, every session dies', async () => {
  const address = email('reset');
  const { token, me } = await svc.register(ctx, { name: 'Reset', email: address, password: PASSWORD });
  await assert.rejects(svc.requestPasswordReset(ctx, { email: address }), { code: 'EMAIL_UNAVAILABLE' }, 'no provider → honest 503');
  await assert.rejects(svc.requestPasswordReset(ctx, { email: 'ghost@example.com' }), { code: 'EMAIL_UNAVAILABLE' }, 'no provider → honest 503 even for unknown (no leak)');
  const code = await issueCode(ctx, me.id, 'reset_password');
  await assert.rejects(svc.confirmPasswordReset(ctx, { email: address, code: code === '000000' ? '111111' : '000000', next: 'NewPass99xx' }), { code: 'CODE_INVALID' });
  await assert.rejects(svc.confirmPasswordReset(ctx, { email: 'ghost@example.com', code, next: 'NewPass99xx' }), { code: 'CODE_INVALID' }, 'the code never crosses e-mails');
  await svc.confirmPasswordReset(ctx, { email: address, code, next: 'NewPass99xx' });
  assert.equal(await svc.authenticate(ctx, token), undefined, 'the old session is dead');
  const back = await svc.login(ctx, { email: address, password: 'NewPass99xx' });
  if ('pending' in back) throw new Error('unexpected pending login');
  const audit = await sql.query(`SELECT action FROM audit WHERE actor = $1 ORDER BY id`, [me.id]);
  assert.ok(audit.map((r) => r.action).includes('password_reset'));
  // a weak new password is refused even with a valid code
  const code2 = await issueCode(ctx, me.id, 'reset_password');
  await assert.rejects(svc.confirmPasswordReset(ctx, { email: address, code: code2, next: 'short' }), { code: 'WEAK_PASSWORD' });
});

test('devices: listed with ip, the current one flagged, revoking one leaves the rest', async () => {
  const address = email('devices');
  const { token, me } = await svc.register(ctx, { name: 'Dev', email: address, password: PASSWORD }, 'Mozilla/1.0 (device-one)', '1.2.3.4');
  const again = await svc.login(ctx, { email: address, password: PASSWORD }, 'Mozilla/2.0 (device-two)', '5.6.7.8');
  if ('pending' in again) throw new Error('unexpected pending login');
  const sessions = await svc.mySessions(ctx, me.id, again.token);
  assert.equal(sessions.length, 2);
  const current = sessions.find((s) => s.current)!;
  assert.ok(current.agent.includes('device-two') && current.ip === '5.6.7.8');
  const other = sessions.find((s) => !s.current)!;
  const notes = await social.notifications(ctx, me.id);
  assert.ok(notes.some((n) => n.kind === 'security'), 'the second sign-in raised the new-device alert');
  await svc.revokeSession(ctx, me.id, other.id, again.token);
  assert.equal(await svc.authenticate(ctx, token), undefined, 'the revoked device is out');
  assert.ok(await svc.authenticate(ctx, again.token), 'the current device stays');
  const now = await svc.mySessions(ctx, me.id, again.token);
  await assert.rejects(svc.revokeSession(ctx, me.id, now.find((s) => s.current)!.id, again.token), { code: 'INVALID_FIELD' }, 'the current device uses sign-out');
  await assert.rejects(svc.revokeSession(ctx, me.id, 'missing', again.token), { code: 'NOT_FOUND' });
});

test('two-factor: setup proves the password, login is gated, replays refused, disable needs both', async () => {
  // A frozen clock makes the 30-second counters deterministic: each accepted code advances the
  // replay guard, so every step of the flow uses the *next* window.
  const realNow = Date.now;
  const base = totpCounter();
  let clockStep = 0;
  const tick = (steps = 0) => { clockStep = steps; };
  Date.now = () => (base + clockStep) * 30_000 + 5_000;
  try {
    const address = email('tfa');
    const { me } = await svc.register(ctx, { name: 'Tfa', email: address, password: PASSWORD });
    await assert.rejects(svc.totpSetup(ctx, me.id, 'Wrong9999xx'), { code: 'WRONG_PASSWORD' });
    const { secret, uri } = await svc.totpSetup(ctx, me.id, PASSWORD);
    assert.ok(uri.startsWith('otpauth://totp/') && uri.includes(secret));
    await assert.rejects(svc.totpConfirm(ctx, me.id, '999999'), { code: 'CODE_INVALID' }, 'a wrong code does not enable it');
    await svc.totpConfirm(ctx, me.id, totpCode(secret, totpCounter())); // consumes window 0
    assert.equal((await svc.me(ctx, me.id)).totp, true);
    // the password alone now stops at the pending login
    const mid = await svc.login(ctx, { email: address, password: PASSWORD }, 'agent', '9.9.9.9');
    if (!('pending' in mid)) throw new Error('expected a pending two-factor login');
    await assert.rejects(svc.loginTwoFactor(ctx, { pendingToken: 'tooshort', code: '000000' }), { code: 'INVALID_FIELD' });
    await assert.rejects(svc.loginTwoFactor(ctx, { pendingToken: mid.pendingToken, code: '000000' }), { code: 'INVALID_LOGIN' });
    await assert.rejects(svc.loginTwoFactor(ctx, { pendingToken: mid.pendingToken, code: totpCode(secret, totpCounter()) }), { code: 'INVALID_LOGIN' }, 'the just-confirmed code is a replay');
    const done = await svc.loginTwoFactor(ctx, { pendingToken: mid.pendingToken, code: totpCode(secret, totpCounter() + 1) }); // the next window
    assert.ok(done.token && done.me.id === me.id);
    await assert.rejects(svc.loginTwoFactor(ctx, { pendingToken: mid.pendingToken, code: totpCode(secret, totpCounter() + 2) }), { code: 'INVALID_LOGIN' }, 'the pending token is single-use');
    // replay guard on a fresh pending login: every accepted window so far is dead
    const mid2 = await svc.login(ctx, { email: address, password: PASSWORD });
    if (!('pending' in mid2)) throw new Error('expected a pending two-factor login');
    await assert.rejects(svc.loginTwoFactor(ctx, { pendingToken: mid2.pendingToken, code: totpCode(secret, totpCounter()) }), { code: 'INVALID_LOGIN' });
    await assert.rejects(svc.loginTwoFactor(ctx, { pendingToken: mid2.pendingToken, code: totpCode(secret, totpCounter() + 1) }), { code: 'INVALID_LOGIN' }, 'window 1 was already accepted');
    tick(1);
    const done2 = await svc.loginTwoFactor(ctx, { pendingToken: mid2.pendingToken, code: totpCode(secret, totpCounter() + 1) });
    assert.ok(done2.token, 'a fresh window still works');
    await assert.rejects(svc.totpDisable(ctx, me.id, 'Wrong9999xx', totpCode(secret, totpCounter() + 2)), { code: 'WRONG_PASSWORD' });
    tick(2);
    await svc.totpDisable(ctx, me.id, PASSWORD, totpCode(secret, totpCounter() + 1));
    assert.equal((await svc.me(ctx, me.id)).totp, false, 'off again');
    const plain = await svc.login(ctx, { email: address, password: PASSWORD });
    if ('pending' in plain) throw new Error('plain login after disable');
  } finally {
    Date.now = realNow;
  }
});

test('Meta WhatsApp: phone stays pending until verified, enables sign-in 2FA, and can be cancelled safely', async () => {
  const env = {
    SHAM_WHATSAPP_ACCESS_TOKEN: 'server-only-test-token',
    SHAM_WHATSAPP_PHONE_NUMBER_ID: '123456789012345',
    SHAM_WHATSAPP_GRAPH_VERSION: 'v99.0',
    SHAM_WHATSAPP_AUTH_TEMPLATE: 'sham_login_code',
    SHAM_WHATSAPP_TEMPLATE_LANGUAGE: 'ar_EG',
  };
  const phoneCtx: svc.Ctx = { ...ctx, env };
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  let providerStatus = 200;
  globalThis.fetch = (async (input, init) => {
    requests.push({ url: String(input), init });
    return new Response('{"messages":[{"id":"test-message"}]}', { status: providerStatus });
  }) as typeof fetch;
  const codeFrom = (index: number) => String(JSON.parse(String(requests[index]?.init?.body)).template.components[0].parameters[0].text);
  try {
    const { me } = await svc.register(ctx, { name: 'WhatsApp', email: email('whatsapp'), password: PASSWORD });
    assert.deepEqual(svc.authPublicConfig(env), { whatsappOtp: true });
    assert.deepEqual(svc.authPublicConfig({}), { whatsappOtp: false });
    await assert.rejects(svc.setupPhone2fa(phoneCtx, me.id, { phone: '+201001234567', method: 'whatsapp', password: 'Wrong9999xx' }), { code: 'WRONG_PASSWORD' });
    assert.equal(requests.length, 0, 'wrong password never triggers a provider request');

    await svc.setupPhone2fa(phoneCtx, me.id, { phone: '+201001234567', method: 'whatsapp', password: PASSWORD });
    const registrationCode = codeFrom(0);
    assert.match(registrationCode, /^\d{6}$/);
    assert.equal(requests[0].url, 'https://graph.facebook.com/v99.0/123456789012345/messages');
    const requestBody = JSON.parse(String(requests[0].init?.body));
    assert.equal(requestBody.to, '201001234567');
    assert.equal(requestBody.template.components[0].parameters[0].text, registrationCode);

    const pending = await sql.query(`SELECT phone_2fa_enabled, phone_2fa_phone_enc, phone_2fa_pending_phone_enc, phone_2fa_pending_expires_at FROM users WHERE id = $1`, [me.id]);
    assert.equal(pending[0].phone_2fa_enabled, false, 'sending a code never enables 2FA');
    assert.equal(pending[0].phone_2fa_phone_enc, null, 'unverified number is not the active factor');
    assert.ok(pending[0].phone_2fa_pending_phone_enc, 'pending number is encrypted and held only for verification');
    assert.ok(pending[0].phone_2fa_pending_expires_at, 'the pending destination expires with its OTP');
    assert.doesNotMatch(JSON.stringify(pending), /201001234567/);
    assert.doesNotMatch(await raw(`SELECT code_salt, code_hash FROM auth_codes WHERE user_id = $1 AND purpose = 'phone_2fa'`, [me.id]), new RegExp(registrationCode));
    const securityAudit = await sql.query(`SELECT action, target, detail FROM audit WHERE actor = $1`, [me.id]);
    assert.doesNotMatch(JSON.stringify(securityAudit), /201001234567|4567/);
    assert.doesNotMatch(JSON.stringify(securityAudit), new RegExp(registrationCode));
    await assert.rejects(svc.confirmPhone2fa(phoneCtx, me.id, registrationCode === '000000' ? '111111' : '000000'), { code: 'CODE_INVALID' });
    assert.equal((await svc.me(phoneCtx, me.id)).phone2fa.enabled, false, 'a wrong code leaves it disabled');

    await svc.confirmPhone2fa(phoneCtx, me.id, registrationCode);
    const active = await sql.query(`SELECT phone_2fa_enabled, phone_2fa_method, phone_2fa_phone_enc, phone_2fa_pending_phone_enc FROM users WHERE id = $1`, [me.id]);
    assert.equal(active[0].phone_2fa_enabled, true);
    assert.equal(active[0].phone_2fa_method, 'whatsapp');
    assert.ok(active[0].phone_2fa_phone_enc);
    assert.equal(active[0].phone_2fa_pending_phone_enc, null);
    assert.doesNotMatch(JSON.stringify(active), /201001234567/);

    const login = await svc.login(phoneCtx, { email: me.email, password: PASSWORD });
    if (!('pending' in login)) throw new Error('verified WhatsApp must gate password login');
    assert.equal(login.method, 'phone');
    assert.equal(login.phoneMethod, 'whatsapp');
    assert.equal(requests.length, 1, 'password login waits for the client to explicitly request the code');
    await svc.requestPhoneLoginCode(phoneCtx, login.pendingToken);
    const loginCode = codeFrom(1);
    assert.notEqual(loginCode, registrationCode);
    const complete = await svc.verifyPhoneLoginCode(phoneCtx, { pendingToken: login.pendingToken, code: loginCode });
    assert.equal(complete.me.id, me.id);
    assert.ok(complete.token);
    await assert.rejects(svc.verifyPhoneLoginCode(phoneCtx, { pendingToken: login.pendingToken, code: loginCode }), { code: 'INVALID_LOGIN' }, 'pending login is single-use');

    const expiredConfirm = await newMember('WhatsAppExpiredConfirm');
    await svc.setupPhone2fa(phoneCtx, expiredConfirm.id, { phone: '+201001234567', method: 'whatsapp', password: PASSWORD });
    const expiredConfirmCode = codeFrom(requests.length - 1);
    await sql.query(`UPDATE users SET phone_2fa_pending_expires_at = now() - interval '1 second' WHERE id = $1`, [expiredConfirm.id]);
    await assert.rejects(svc.confirmPhone2fa(phoneCtx, expiredConfirm.id, expiredConfirmCode), { code: 'CODE_INVALID' });
    const afterExpiredConfirm = await sql.query(`SELECT phone_2fa_enabled, phone_2fa_pending_phone_enc FROM users WHERE id = $1`, [expiredConfirm.id]);
    assert.equal(afterExpiredConfirm[0].phone_2fa_enabled, false);
    assert.equal(afterExpiredConfirm[0].phone_2fa_pending_phone_enc, null, 'expired destinations are cleared before code confirmation');

    const expiredRead = await newMember('WhatsAppExpiredRead');
    await svc.setupPhone2fa(phoneCtx, expiredRead.id, { phone: '+201001234567', method: 'whatsapp', password: PASSWORD });
    const expiredReadCode = codeFrom(requests.length - 1);
    await sql.query(`UPDATE users SET phone_2fa_pending_expires_at = now() - interval '1 second' WHERE id = $1`, [expiredRead.id]);
    await svc.me(phoneCtx, expiredRead.id);
    const afterExpiredRead = await sql.query(`SELECT phone_2fa_pending_phone_enc FROM users WHERE id = $1`, [expiredRead.id]);
    assert.equal(afterExpiredRead[0].phone_2fa_pending_phone_enc, null, 'profile reads clear abandoned expired destinations');
    await assert.rejects(svc.confirmPhone2fa(phoneCtx, expiredRead.id, expiredReadCode), { code: 'PHONE_SETUP_NOT_STARTED' });

    const cancelled = await newMember('WhatsAppCancel');
    const cancelRequestIndex = requests.length;
    await svc.setupPhone2fa(phoneCtx, cancelled.id, { phone: '+201001234567', method: 'whatsapp', password: PASSWORD });
    const abandonedCode = codeFrom(cancelRequestIndex);
    await assert.rejects(svc.cancelPhone2faSetup(phoneCtx, cancelled.id, 'Wrong9999xx'), { code: 'WRONG_PASSWORD' });
    await svc.cancelPhone2faSetup(phoneCtx, cancelled.id, PASSWORD);
    const afterCancel = await sql.query(`SELECT phone_2fa_enabled, phone_2fa_pending_phone_enc FROM users WHERE id = $1`, [cancelled.id]);
    assert.equal(afterCancel[0].phone_2fa_enabled, false);
    assert.equal(afterCancel[0].phone_2fa_pending_phone_enc, null);
    await assert.rejects(svc.confirmPhone2fa(phoneCtx, cancelled.id, abandonedCode), { code: 'PHONE_SETUP_NOT_STARTED' });

    const unavailable = await newMember('WhatsAppUnavailable');
    providerStatus = 503;
    await assert.rejects(svc.setupPhone2fa(phoneCtx, unavailable.id, { phone: '+201001234567', method: 'whatsapp', password: PASSWORD }), { code: 'WHATSAPP_UNAVAILABLE' });
    const afterFailure = await sql.query(`SELECT phone_2fa_enabled, phone_2fa_pending_phone_enc FROM users WHERE id = $1`, [unavailable.id]);
    assert.equal(afterFailure[0].phone_2fa_enabled, false);
    assert.equal(afterFailure[0].phone_2fa_pending_phone_enc, null, 'failed Meta delivery leaves no pending number');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('previously verified phone formats are normalized for delivery without changing stored values', async () => {
  const env = {
    SHAM_WHATSAPP_ACCESS_TOKEN: 'server-only-test-token',
    SHAM_WHATSAPP_PHONE_NUMBER_ID: '123456789012345',
    SHAM_WHATSAPP_GRAPH_VERSION: 'v99.0',
    SHAM_WHATSAPP_AUTH_TEMPLATE: 'sham_login_code',
    SHAM_WHATSAPP_TEMPLATE_LANGUAGE: 'ar_EG',
  };
  const phoneCtx: svc.Ctx = { ...ctx, env };
  const originalFetch = globalThis.fetch;
  const destinations: string[] = [];
  globalThis.fetch = (async (_input, init) => {
    destinations.push(String(JSON.parse(String(init?.body)).to));
    return jsonResponse({ messages: [{ id: 'legacy-phone-test' }] });
  }) as typeof fetch;
  try {
    const cases = [
      { name: 'LegacyInternational', country: '', storedPhone: '201001234567', expected: '201001234567' },
      { name: 'LegacyLocal', country: 'EG', storedPhone: '01001234567', expected: '201001234567' },
    ];
    for (const item of cases) {
      const { me } = await svc.register(phoneCtx, { name: item.name, email: email(item.name.toLowerCase()), password: PASSWORD, country: item.country });
      await sql.query(
        `UPDATE users SET phone_2fa_enabled = true, phone_2fa_method = 'whatsapp', phone_2fa_phone_enc = $1 WHERE id = $2`,
        [phoneCtx.vault.seal(item.storedPhone), me.id],
      );
      const pending = await svc.login(phoneCtx, { email: me.email, password: PASSWORD });
      if (!('pending' in pending)) throw new Error('expected a pending login for a verified phone factor');
      await svc.requestPhoneLoginCode(phoneCtx, pending.pendingToken);
      assert.equal(destinations.at(-1), item.expected, `normalized delivery for ${item.name}`);
      const stored = await sql.query<{ phone_2fa_phone_enc: string }>(`SELECT phone_2fa_phone_enc FROM users WHERE id = $1`, [me.id]);
      assert.equal(phoneCtx.vault.open(stored[0].phone_2fa_phone_enc), item.storedPhone, 'normalization never silently rewrites the encrypted number');
    }
    assert.deepEqual(destinations, ['201001234567', '201001234567']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('changing the password signs out the other devices — the current one stays', async () => {
  const address = email('chpw');
  const { token, me } = await svc.register(ctx, { name: 'Chpw', email: address, password: PASSWORD });
  const again = await svc.login(ctx, { email: address, password: PASSWORD });
  if ('pending' in again) throw new Error('unexpected pending login');
  await svc.changePassword(ctx, me.id, { current: PASSWORD, next: 'Fresh99xx' }, again.token);
  assert.equal(await svc.authenticate(ctx, token), undefined, 'the other device is out');
  assert.ok(await svc.authenticate(ctx, again.token), 'the device that changed it stays');
});

/* ------------------------------------- passkeys (WebAuthn) — study v2 ------------------------------------- */
import { createHash, createSign, generateKeyPairSync } from 'node:crypto';

const sha256 = (b: Buffer): Buffer => createHash('sha256').update(b).digest();

test('passkeys: register a device credential, sign in with it, reject forgeries and clones', async () => {
  /* A stand-in authenticator: node:crypto signs with a key the "device" keeps. */
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' }) as { x: string; y: string };
  const x = Buffer.from(jwk.x, 'base64url'); const y = Buffer.from(jwk.y, 'base64url');
  /* minimal CBOR encoder (small ints, byte strings, text, maps) */
  const b1 = (n: number) => Buffer.from([n]);
  const cborBytes = (buf: Buffer) => Buffer.concat([b1(0x58), b1(buf.length), buf]);
  const cborText = (s: string) => { const b = Buffer.from(s, 'utf8'); return Buffer.concat([b1(0x60 + b.length), b]); };
  const cborInt = (n: number) => (n >= 0 && n < 24 ? b1(n) : n >= 24 && n < 256 ? Buffer.from([0x18, n]) : n < 0 && n > -25 ? Buffer.from([0x20 + (-1 - n)]) : Buffer.from([0x38, -1 - n]));
  const cborVal = (v: Buffer | string | number) => (Buffer.isBuffer(v) ? cborBytes(v) : typeof v === 'string' ? cborText(v) : cborInt(v));
  const cborMap = (entries: [string | number, Buffer | string | number][]) =>
    Buffer.concat([b1(0xa0 + entries.length), ...entries.flatMap(([k, v]) => [cborVal(k), cborVal(v)])]);
  const coseKey = cborMap([[1, 2], [-1, -7], [3, x], [4, y]]);

  const ORIGIN = 'https://spculculat-oss.github.io';
  const rpIdHash = sha256(Buffer.from('spculculat-oss.github.io'));
  const credId = Buffer.alloc(32, 7);
  const b64u = (b: Buffer) => b.toString('base64url');
  const clientData = (type: string, challenge: string, origin = ORIGIN) =>
    b64u(Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false })));
  const makeAuthData = (flags: number, signCount: number, withCred: boolean) => {
    const base = Buffer.concat([rpIdHash, b1(flags), Buffer.from(signCount.toString(16).padStart(8, '0'), 'hex')]);
    return withCred
      ? Buffer.concat([base, Buffer.alloc(16), b1(credId.length).length ? Buffer.concat([b1(0), b1(credId.length)]) : b1(0), credId, coseKey])
      : base;
  };
  const attestationOf = (challenge: string, signCount: number, origin = ORIGIN) => Buffer.concat([
    b1(0xa3),
    cborText('fmt'), cborText('none'),
    cborText('attStmt'), b1(0xa0),
    cborText('authData'), cborBytes(makeAuthData(0x0d, signCount, true)),
  ]);
  const assertOf = (challenge: string, signCount: number, key = privateKey, origin = ORIGIN) => {
    const authData = makeAuthData(0x09, signCount, false);
    const cd = Buffer.from(clientData('webauthn.get', challenge, origin), 'base64url');
    const sig = createSign('sha256').update(Buffer.concat([authData, sha256(cd)])).sign(key);
    return { clientDataJSON: b64u(cd), authenticatorData: b64u(authData), signature: b64u(sig) };
  };

  const address = email('passkey');
  const reg = await svc.register(ctx, { name: 'Pk', email: address, password: PASSWORD });
  if ('pending' in reg) throw new Error('unexpected pending login');

  /* a passkey-less account and an unknown e-mail get the same quiet 404 */
  const nobody = await svc.register(ctx, { name: 'NoPk', email: email('nopk'), password: PASSWORD });
  await assert.rejects(svc.passkeyLoginBegin(ctx, { email: address }), { code: 'NOT_FOUND' });
  await assert.rejects(svc.passkeyLoginBegin(ctx, { email: 'ghost@example.com' }), { code: 'NOT_FOUND' });
  await assert.rejects(svc.passkeyLoginBegin(ctx, { email: email('nopk') && nobody.me.email }), { code: 'NOT_FOUND' }, 'registered but no passkey: the same 404');

  /* register the device credential */
  const begin = await svc.passkeyRegisterBegin(ctx, reg.me.id, { name: 'موبايلي', password: PASSWORD });
  const created = { clientDataJSON: clientData('webauthn.create', begin.challenge), attestationObject: b64u(attestationOf(begin.challenge, 0)) };
  const list = await svc.passkeyRegisterFinish(ctx, reg.me.id, { challengeId: begin.id, name: 'موبايلي', ...created });
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'موبايلي');
  assert.ok((await sql.query(`SELECT cred_id FROM passkeys WHERE user_id = $1`, [reg.me.id])).length, 'the public key is stored');
  const [storedKey] = await sql.query(`SELECT pub_key FROM passkeys WHERE user_id = $1`, [reg.me.id]);
  assert.ok(storedKey.pub_key && !String(storedKey.pub_key).toLowerCase().includes('private'), 'the private key never reaches the DB');

  /* forgeries at registration */
  await assert.rejects(svc.passkeyRegisterFinish(ctx, reg.me.id, { challengeId: begin.id, ...created }), { code: 'CHALLENGE_INVALID' }, 'a used challenge is dead');
  const begin2 = await svc.passkeyRegisterBegin(ctx, reg.me.id, { name: 'x', password: PASSWORD });
  await assert.rejects(svc.passkeyRegisterFinish(ctx, reg.me.id, { challengeId: begin2.id, clientDataJSON: clientData('webauthn.create', begin2.challenge, 'https://evil.example'), attestationObject: b64u(attestationOf(begin2.challenge, 0, 'https://evil.example')) }), { code: 'PASSKEY_INVALID' }, 'a foreign origin is refused');
  const begin3 = await svc.passkeyRegisterBegin(ctx, reg.me.id, { name: 'x', password: PASSWORD });
  await assert.rejects(svc.passkeyRegisterFinish(ctx, reg.me.id, { challengeId: begin3.id, clientDataJSON: clientData('webauthn.get', begin3.challenge), attestationObject: b64u(attestationOf(begin3.challenge, 0)) }), { code: 'PASSKEY_INVALID' }, 'a get answer cannot create');

  /* sign in with the passkey */
  const lb = await svc.passkeyLoginBegin(ctx, { email: address });
  assert.equal(lb.allowedCredentials[0].id, b64u(credId));
  const proof = assertOf(lb.challenge, 1);
  const done = await svc.passkeyLoginFinish(ctx, { challengeId: lb.id, credentialId: b64u(credId), ...proof }, 'passkey-agent', '6.6.6.6');
  assert.ok(done.token);
  assert.equal(done.me.id, reg.me.id);
  assert.ok(await svc.authenticate(ctx, done.token), 'the session is live');
  const [pkRow] = await sql.query(`SELECT sign_count, last_used_at FROM passkeys WHERE user_id = $1`, [reg.me.id]);
  assert.equal(Number(pkRow.sign_count), 1);
  assert.ok(pkRow.last_used_at);

  /* replay, wrong signature, foreign credential */
  await assert.rejects(svc.passkeyLoginFinish(ctx, { challengeId: lb.id, credentialId: b64u(credId), ...proof }), { code: 'CHALLENGE_INVALID' }, 'the challenge is single-use');
  const lb2 = await svc.passkeyLoginBegin(ctx, { email: address });
  const forged = assertOf(lb2.challenge, 2);
  await assert.rejects(svc.passkeyLoginFinish(ctx, { challengeId: lb2.id, credentialId: b64u(credId), ...forged, signature: Buffer.from(forged.signature, 'base64url').subarray(0, 30).toString('base64url') }), { code: 'PASSKEY_INVALID' }, 'a mangled signature fails');
  const lb3 = await svc.passkeyLoginBegin(ctx, { email: address });
  await assert.rejects(svc.passkeyLoginFinish(ctx, { challengeId: lb3.id, credentialId: b64u(Buffer.alloc(32, 9)), ...assertOf(lb3.challenge, 2) }), { code: 'PASSKEY_INVALID' }, 'a credential that was never registered fails');

  /* clone detection: a valid signature on a *backwards* counter */
  const lb4 = await svc.passkeyLoginBegin(ctx, { email: address });
  await assert.rejects(svc.passkeyLoginFinish(ctx, { challengeId: lb4.id, credentialId: b64u(credId), ...assertOf(lb4.challenge, 0) }), { code: 'PASSKEY_INVALID' }, 'the counter went backwards');
  const audit = await sql.query(`SELECT action FROM audit WHERE actor = $1 ORDER BY id`, [reg.me.id]);
  const actions = audit.map((r) => r.action);
  for (const a of ['passkey_added', 'login_ok', 'passkey_clone_suspect']) assert.ok(actions.includes(a), `audit has ${a}`);

  /* management */
  const pkList = await svc.myPasskeys(ctx, reg.me.id);
  assert.equal(pkList.length, 1);
  await svc.deletePasskey(ctx, reg.me.id, pkList[0].id);
  assert.equal((await svc.myPasskeys(ctx, reg.me.id)).length, 0);
  await assert.rejects(svc.passkeyLoginBegin(ctx, { email: address }), { code: 'NOT_FOUND' }, 'no passkeys left: the same quiet 404');
  void storedKey;
});

test('saved posts are idempotent, private to each account, and can be removed repeatedly', async () => {
  const author = await newMember('BookmarkAuthor');
  const reader = await newMember('BookmarkReader');
  const other = await newMember('BookmarkOther');
  const post = await social.createPost(ctx, author.id, { body: 'A useful perfume experiment' });
  assert.equal((await social.getPost(ctx, reader.id, post.id)).saved, false);
  assert.equal((await social.savePost(ctx, reader.id, post.id)).saved, true);
  await social.savePost(ctx, reader.id, post.id);
  assert.equal((await sql.query(`SELECT * FROM saved_posts WHERE user_id = $1 AND post_id = $2`, [reader.id, post.id])).length, 1);
  assert.deepEqual((await social.feed(ctx, reader.id, { scope: 'saved' })).map(p => p.id), [post.id]);
  assert.equal((await social.getPost(ctx, other.id, post.id)).saved, false);
  assert.deepEqual(await social.feed(ctx, other.id, { scope: 'saved' }), []);
  await social.unsavePost(ctx, other.id, post.id);
  assert.equal((await social.getPost(ctx, reader.id, post.id)).saved, true, 'another account cannot remove my bookmark');
  await social.unsavePost(ctx, reader.id, post.id);
  await social.unsavePost(ctx, reader.id, post.id);
  assert.deepEqual(await social.feed(ctx, reader.id, { scope: 'saved' }), []);
  await assert.rejects(social.savePost(ctx, reader.id, 'missing-post'), { code: 'NOT_FOUND' });
});

test('bookmarks never bypass visibility changes, moderation, deletion or blocking', async () => {
  const author = await newMember('BookmarkPrivacyAuthor');
  const reader = await newMember('BookmarkPrivacyReader');
  const post = await social.createPost(ctx, author.id, { body: 'Public for now' });
  await social.savePost(ctx, reader.id, post.id);
  await social.editPost(ctx, author.id, post.id, { visibility: 'friends' });
  assert.deepEqual(await social.feed(ctx, reader.id, { scope: 'saved' }), []);
  await assert.rejects(social.savePost(ctx, reader.id, post.id), { code: 'NOT_FOUND' });
  await social.editPost(ctx, author.id, post.id, { visibility: 'public' });
  assert.equal((await social.feed(ctx, reader.id, { scope: 'saved' })).length, 1);
  await sql.query(`UPDATE posts SET status = 'hidden' WHERE id = $1`, [post.id]);
  assert.deepEqual(await social.feed(ctx, reader.id, { scope: 'saved' }), []);
  await sql.query(`UPDATE posts SET status = 'visible' WHERE id = $1`, [post.id]);
  await social.deletePost(ctx, author.id, post.id);
  assert.deepEqual(await social.feed(ctx, reader.id, { scope: 'saved' }), []);
  await social.unsavePost(ctx, reader.id, post.id); // cleanup still allowed when inaccessible
  const blocked = await social.createPost(ctx, author.id, { body: 'Block test' });
  await social.savePost(ctx, reader.id, blocked.id);
  await social.block(ctx, author.id, reader.id);
  assert.deepEqual(await social.feed(ctx, reader.id, { scope: 'saved' }), []);
  await assert.rejects(social.savePost(ctx, reader.id, blocked.id), { code: 'NOT_FOUND' });
  await social.unsavePost(ctx, reader.id, blocked.id);
});

/* ------------------------------------------ Google / Facebook ------------------------------------------ */

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('google and facebook login never treats a typed e-mail or an unsigned token as a link', async () => {
  const before = (await sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM users`))[0].n;
  await assert.rejects(svc.loginWithGoogle(ctx, { idToken: 'person@example.com' }), { code: 'OAUTH_NOT_CONFIGURED' });
  await assert.rejects(svc.loginWithFacebook(ctx, { accessToken: 'person@example.com' }), { code: 'OAUTH_NOT_CONFIGURED' });
  const forged = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"email":"forged@example.com","sub":"evil"}').toString('base64url')}.sig`;
  await assert.rejects(svc.loginWithGoogle(ctx, { idToken: forged }), { code: 'OAUTH_NOT_CONFIGURED' });
  await assert.rejects(svc.loginWithGoogle(ctx, { idToken: JSON.stringify({ email: 'forged@example.com' }) }), { code: 'OAUTH_NOT_CONFIGURED' });
  assert.equal((await sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM users`))[0].n, before, 'a rejected link creates no account');
  assert.deepEqual(svc.oauthPublicConfig({ GOOGLE_CLIENT_ID: 'gid', FACEBOOK_APP_ID: 'fid', FACEBOOK_APP_SECRET: 'sec' }), { googleClientId: 'gid', facebookAppId: 'fid' });
  assert.equal(svc.oauthPublicConfig({ FACEBOOK_APP_ID: 'fid' }).facebookAppId, null);
  assert.equal(JSON.stringify(svc.oauthPublicConfig({ FACEBOOK_APP_SECRET: 'sec' })).includes('sec'), false);
});

test('a verified provider token links the provider subject, not the word google or facebook', async () => {
  const original = globalThis.fetch;
  const address = email('oauthlink');
  const other = email('oauthother');
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === 'oauth2.googleapis.com') {
      const token = url.searchParams.get('access_token') || url.searchParams.get('id_token') || '';
      if (token === 'good') return jsonResponse({ aud: 'test-google-client', email: address, email_verified: 'true', sub: 'google-sub-42', name: 'Nour' });
      if (token === 'same-subject') return jsonResponse({ aud: 'test-google-client', email: other, email_verified: 'true', sub: 'google-sub-42', name: 'Nour' });
      if (token === 'mismatch') return jsonResponse({ aud: 'other-client', email: address, email_verified: 'true', sub: 'google-sub-99' });
      if (token === 'unverified') return jsonResponse({ aud: 'test-google-client', email: address, email_verified: 'false', sub: 'google-sub-1' });
      return jsonResponse({ error: 'invalid' }, 400);
    }
    if (url.hostname === 'graph.facebook.com' && url.pathname === '/debug_token') {
      const token = url.searchParams.get('input_token');
      if (token === 'fb-good') return jsonResponse({ data: { is_valid: true, app_id: 'fb-app', user_id: 'fb-user-9' } });
      if (token === 'fb-other-app') return jsonResponse({ data: { is_valid: true, app_id: 'other-app', user_id: 'fb-user-9' } });
      return jsonResponse({ data: { is_valid: false } });
    }
    if (url.hostname === 'graph.facebook.com' && url.pathname === '/me') {
      return jsonResponse({ id: 'fb-user-9', email: address, name: 'Nour' });
    }
    return jsonResponse({ error: 'unexpected' }, 404);
  };
  try {
    const google = { ...ctx, env: { GOOGLE_CLIENT_ID: 'test-google-client' } };
    const facebook = { ...ctx, env: { FACEBOOK_APP_ID: 'fb-app', FACEBOOK_APP_SECRET: 'fb-secret' } };
    await assert.rejects(svc.loginWithGoogle(google, { accessToken: 'mismatch' }), { code: 'OAUTH_INVALID' });
    await assert.rejects(svc.loginWithGoogle(google, { accessToken: 'unverified' }), { code: 'OAUTH_INVALID' });
    await assert.rejects(svc.loginWithGoogle(google, { idToken: address }), { code: 'OAUTH_INVALID' });
    const existing = await newMember('OAuthExisting', { email: address });
    const linked = await svc.loginWithGoogle(google, { accessToken: 'good' });
    if ('pending' in linked) throw new Error('unexpected pending login');
    assert.equal(linked.me.id, existing.id, 'the provider e-mail links the account that already exists');
    assert.equal(linked.me.email, address);
    const row = await sql.query<{ oauth_google_id: string }>(`SELECT oauth_google_id FROM users WHERE id = $1`, [existing.id]);
    assert.equal(row[0].oauth_google_id, 'google-sub-42');
    assert.notEqual(row[0].oauth_google_id, 'google');
    const again = await svc.loginWithGoogle(google, { accessToken: 'same-subject' });
    if ('pending' in again) throw new Error('unexpected pending login');
    assert.equal(again.me.id, existing.id, 'the same provider subject stays on the same account');
    assert.equal(again.me.email, address, 'a different address in a later token does not replace the account');
    await assert.rejects(svc.loginWithFacebook(facebook, { accessToken: 'fb-other-app' }), { code: 'OAUTH_INVALID' });
    const fb = await svc.loginWithFacebook(facebook, { accessToken: 'fb-good' });
    if ('pending' in fb) throw new Error('unexpected pending login');
    assert.equal(fb.me.id, existing.id);
    const fbRow = await sql.query<{ oauth_facebook_id: string }>(`SELECT oauth_facebook_id FROM users WHERE id = $1`, [existing.id]);
    assert.equal(fbRow[0].oauth_facebook_id, 'fb-user-9');
  } finally {
    globalThis.fetch = original;
  }
});

test('OAuth login creates a pending 2FA challenge without sending or issuing a phone code prematurely', async () => {
  const original = globalThis.fetch;
  const address = email('oauthphone2fa');
  const member = await newMember('OAuthPhone2FA', { email: address });
  await sql.query(
    `UPDATE users SET phone_2fa_enabled = true, phone_2fa_method = 'whatsapp', phone_2fa_phone_enc = $1 WHERE id = $2`,
    [ctx.vault.seal('+201001234567'), member.id],
  );
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === 'oauth2.googleapis.com') {
      return jsonResponse({ aud: 'test-google-client', email: address, email_verified: 'true', sub: 'google-phone-sub', name: 'Nour' });
    }
    if (url.hostname === 'graph.facebook.com' && url.pathname === '/debug_token') {
      return jsonResponse({ data: { is_valid: true, app_id: 'fb-app', user_id: 'fb-phone-user' } });
    }
    if (url.hostname === 'graph.facebook.com' && url.pathname === '/me') {
      return jsonResponse({ id: 'fb-phone-user', email: address, name: 'Nour' });
    }
    return jsonResponse({ error: 'unexpected' }, 404);
  };
  try {
    const googleCtx = { ...ctx, env: { GOOGLE_CLIENT_ID: 'test-google-client' } };
    const facebookCtx = { ...ctx, env: { FACEBOOK_APP_ID: 'fb-app', FACEBOOK_APP_SECRET: 'fb-secret' } };
    const countPhoneCodes = async () => (await sql.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM auth_codes WHERE user_id = $1 AND purpose = 'phone_2fa'`, [member.id],
    ))[0].n;

    const googlePending = await svc.loginWithGoogle(googleCtx, { accessToken: 'google-phone' });
    assert.equal('pending' in googlePending, true);
    if (!('pending' in googlePending)) throw new Error('expected a pending Google login');
    assert.equal(googlePending.phoneMethod, 'whatsapp');
    assert.equal(await countPhoneCodes(), 0, 'Google login waits for the client to request the code');

    const facebookPending = await svc.loginWithFacebook(facebookCtx, { accessToken: 'facebook-phone' });
    assert.equal('pending' in facebookPending, true);
    if (!('pending' in facebookPending)) throw new Error('expected a pending Facebook login');
    assert.equal(facebookPending.phoneMethod, 'whatsapp');
    assert.equal(await countPhoneCodes(), 0, 'Facebook login also waits for the client to request the code');
  } finally {
    globalThis.fetch = original;
  }
});
