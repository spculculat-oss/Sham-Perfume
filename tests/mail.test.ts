/**
 * «بريد شام» — the platform mail service (server/community/mail.ts).
 * Runs against PGlite (the real Postgres engine), exactly like the community suite.
 */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import express from 'express';
import { Vault } from '../server/community/crypto';
import { connectPglite, migrate, type Sql } from '../server/community/db';
import * as svc from '../server/community/service';
import * as social from '../server/community/social';
import * as chat from '../server/community/messenger';
import * as mail from '../server/community/mail';
import { createCommunity, createCommunityRouter } from '../server/community/router';
import type { FxTable } from '../src/utils/pricing';

const KEY = 'test-data-key-0123456789-abcdefghijklmnop';
const FX: FxTable = { base: 'USD', updatedAt: '2026-10-01T00:00:00Z', rates: { USD: 1, EGP: 50, EUR: 0.9, SAR: 3.75 } };
let sql: Sql;
let ctx: svc.Ctx;
let seq = 0;
const email = (name: string) => `${name}.${++seq}@example.com`;
const PASSWORD = 'Sham2026mail';

before(async () => {
  sql = await connectPglite();
  await migrate(sql);
  await migrate(sql); // idempotent (v4 tables too)
  ctx = { sql, vault: new Vault(KEY), fx: async () => FX, env: {} }; // empty env: no outbound e-mail in tests
});
after(async () => { await sql?.close(); });

const newMember = async (name: string, saveEmail?: { v?: string }) => {
  const em = email(name.toLowerCase());
  if (saveEmail) saveEmail.v = em;
  return (await svc.register(ctx, { name, email: em, password: PASSWORD, country: 'EG' })).me;
};
const inboxOf = (userId: string) => mail.list(ctx, userId, { folder: 'inbox' });
const raw = async (query: string, params: unknown[] = []) => JSON.stringify(await sql.query(query, params));

test('the welcome letter: a system mail waits in every new member inbox, addressed from «إدارة شام»', async () => {
  const me = await newMember('Rana');
  await mail.welcomeMail(ctx, me.id, me.name, 'ar');
  const inbox = await inboxOf(me.id);
  assert.equal(inbox.items.length, 1);
  const letter = inbox.items[0];
  assert.equal(letter.kind, 'system');
  assert.equal(letter.from.id, null, 'system mail has no human sender');
  assert.equal(letter.from.address, 'admin@sham');
  assert.ok(letter.subject.includes('بريد شام'));
  const counts = await mail.counts(ctx, me.id);
  assert.deepEqual([counts.inbox, counts.unread, counts.drafts], [1, 1, 0]);
  const full = await mail.view(ctx, me.id, letter.id);
  assert.ok(full.body.includes('إدارة شام'));
  assert.equal(full.read, true, 'opening an inbox letter marks it read');
  assert.equal((await mail.counts(ctx, me.id)).unread, 0);
});

test('members write to each other by handle, «handle@sham» and sign-up e-mail; everything is encrypted at rest', async () => {
  const nader = await newMember('Nader');
  const sohaMail: { v?: string } = {};
  const soha = await newMember('Soha', sohaMail);
  const subject = 'تركيبة عود جديدة';
  const body = 'السلام عليكم يا سهى، جربتي التركيبة دي؟';
  const one = await mail.send(ctx, nader.id, { to: [soha.handle], subject, body });
  assert.deepEqual(one.missed, []);
  const byAddress = await mail.send(ctx, nader.id, { to: [`${soha.handle}@sham`], subject: `re ${subject}`, body: 'test two' });
  assert.ok(byAddress.id, '«handle@sham» resolves');
  const byEmail = await mail.send(ctx, nader.id, { to: [sohaMail.v!], subject: 'x', body: 'test three' });
  assert.ok(byEmail.id, 'the sign-up e-mail resolves too');
  assert.equal((await inboxOf(soha.id)).items.length, 3);

  const sent = await mail.list(ctx, nader.id, { folder: 'sent' });
  assert.equal(sent.items[0].folder, 'sent');
  assert.equal(sent.items[0].read, true, 'own sent letters are read');
  assert.ok(sent.items[0].to.some((p) => p.handle === soha.handle));
  assert.equal(sent.items[0].to[0].address, `${soha.handle}@sham`);

  const dump = await raw(`SELECT * FROM mail_messages`);
  assert.doesNotMatch(dump, new RegExp(subject.slice(0, 6)), 'the subject is not stored in clear');
  assert.doesNotMatch(dump, /جربتي/, 'the body is not stored in clear');
});

test('stars, archive, trash, restore, delete-forever — every member keeps their own copy', async () => {
  const hassan = await newMember('Hassan');
  const dina = await newMember('Dina');
  const { id } = await mail.send(ctx, hassan.id, { to: [dina.handle], subject: 'اهلا', body: 'رسالة للاختبار' });
  // star
  await mail.update(ctx, dina.id, id, { starred: true });
  assert.equal((await mail.list(ctx, dina.id, { folder: 'starred' })).items.length, 1);
  assert.equal(await mail.view(ctx, dina.id, id).then((m) => m.starred), true);
  // archive: leaves the inbox but not the mailbox
  await mail.update(ctx, dina.id, id, { folder: 'archive' });
  assert.equal((await inboxOf(dina.id)).items.length, 0);
  assert.equal((await mail.list(ctx, dina.id, { folder: 'archive' })).items.length, 1);
  // restore, then trash
  await mail.update(ctx, dina.id, id, { folder: 'inbox' });
  assert.equal((await inboxOf(dina.id)).items.length, 1);
  const trashed = await mail.remove(ctx, dina.id, id);
  assert.equal(trashed.trashed, true);
  assert.equal((await mail.list(ctx, dina.id, { folder: 'trash' })).items.length, 1);
  // sender keeps their own copy meanwhile
  assert.equal((await mail.list(ctx, hassan.id, { folder: 'sent' })).items.length, 1);
  // deleting inside the trash is forever
  const gone = await mail.remove(ctx, dina.id, id);
  assert.equal(gone.deleted, true);
  await assert.rejects(mail.view(ctx, dina.id, id), { code: 'NOT_FOUND' });
  assert.equal((await mail.list(ctx, hassan.id, { folder: 'sent' })).items.length, 1, 'the sender keeps theirs');
});

test('drafts: save, edit, reopen with raw addresses, then send', async () => {
  const karim = await newMember('Karim');
  const laila = await newMember('Laila');
  await assert.rejects(mail.saveDraft(ctx, karim.id, {}), { code: 'EMPTY_MESSAGE' });
  const { id } = await mail.saveDraft(ctx, karim.id, { to: [laila.handle, 'nobody-xyz'], subject: 'مسودة', body: 'نص اولي' });
  assert.equal((await mail.counts(ctx, karim.id)).drafts, 1);
  const inDrafts = await mail.list(ctx, karim.id, { folder: 'drafts' });
  assert.equal(inDrafts.items.length, 1);
  assert.equal(inDrafts.items[0].subject, 'مسودة');
  const opened = await mail.view(ctx, karim.id, id);
  assert.deepEqual([...opened.draftTo].sort(), [laila.handle, 'nobody-xyz'].sort(), 'raw addresses come back for the composer');
  await mail.saveDraft(ctx, karim.id, { subject: 'مسودة معدلة', body: 'نص نهائي جاهز' }, id);
  const out = await mail.sendDraft(ctx, karim.id, id, { to: [laila.handle] });
  assert.equal(out.delivered, 1);
  assert.equal((await mail.counts(ctx, karim.id)).drafts, 0);
  assert.equal(await mail.view(ctx, karim.id, id).then((m) => m.folder), 'sent');
  const received = await inboxOf(laila.id);
  assert.equal(received.items[0].subject, 'مسودة معدلة');
});

test('blocks stop mail; undeliverable addresses bounce via «خدمة بريد شام»', async () => {
  const wael = await newMember('Wael');
  const mona = await newMember('Mona');
  const omar = await newMember('Omar');
  await social.block(ctx, mona.id, wael.id);
  // fully undeliverable → the send itself fails honestly
  await assert.rejects(mail.send(ctx, wael.id, { to: [mona.handle], subject: 'س', body: 'محاولة' }), { code: 'NOT_FOUND' });
  // mixed: one lands, the blocked one and the typo bounce into the sender inbox
  const out = await mail.send(ctx, wael.id, { to: [omar.handle, mona.handle, 'no-such-user-123'], subject: 'عرض مهم', body: 'نص' });
  assert.equal(out.delivered, 1);
  assert.equal(out.missed.length, 2);
  assert.equal((await inboxOf(omar.id)).items.length, 1);
  const waelInbox = await inboxOf(wael.id);
  assert.equal(waelInbox.items.length, 1);
  assert.equal(waelInbox.items[0].from.address, 'mailer@sham');
  const bounce = await mail.view(ctx, wael.id, waelInbox.items[0].id);
  assert.ok(bounce.subject.startsWith('تعذّر التسليم'));
  assert.ok(bounce.body.includes('no-such-user-123'));
});

test('search: blind-index tokens find words in subjects and bodies, and senders are found by name', async () => {
  const samy = await newMember('Samy');
  const huda = await newMember('Huda');
  await mail.send(ctx, samy.id, { to: [huda.handle], subject: 'سعر مسك الغزال النقي', body: 'كم كيلو متوفر؟' });
  await mail.send(ctx, samy.id, { to: [huda.handle], subject: 'فاتورة', body: 'كلام تاني خالص' });
  const bySubject = await mail.list(ctx, huda.id, { q: 'الغزال' });
  assert.equal(bySubject.items.length, 1);
  assert.equal(bySubject.items[0].subject, 'سعر مسك الغزال النقي');
  const byBody = await mail.list(ctx, huda.id, { q: 'كيلو' });
  assert.equal(byBody.items.length, 1);
  const bySender = await mail.list(ctx, huda.id, { q: 'samy' });
  assert.equal(bySender.items.length, 2, 'sender name/handle matches too');
  const nothing = await mail.list(ctx, huda.id, { q: 'قهوة' });
  assert.equal(nothing.items.length, 0);
  // the search index never stores clear words
  const tokens = await raw(`SELECT * FROM mail_tokens`);
  assert.doesNotMatch(tokens, /الغزال|kilo|كيلو/);
});

test('the pulse carries the unread mail count, and mark-all-read clears it', async () => {
  const adel = await newMember('Adel');
  const nour = await newMember('Nour');
  await mail.send(ctx, adel.id, { to: [nour.handle], subject: '1', body: 'اول' });
  await mail.send(ctx, adel.id, { to: [nour.handle], subject: '2', body: 'تاني' });
  const pulse = await chat.pulse(ctx, nour.id);
  assert.equal(pulse.mail, 2);
  await mail.markAllRead(ctx, nour.id);
  assert.equal((await chat.pulse(ctx, nour.id)).mail, 0);
});

test('the administration sends official mail, audited; mail joins the data export', async () => {
  const zizi = await newMember('Zizi');
  await mail.adminMail(ctx, zizi.id, { subject: 'تنبيه من الإدارة', body: 'أهلاً بيك في شام، ودي رسالة رسمية.' });
  const inbox = await inboxOf(zizi.id);
  assert.equal(inbox.items[0].kind, 'system');
  assert.equal(inbox.items[0].from.address, 'admin@sham');
  const audit = await raw(`SELECT * FROM audit WHERE action = 'mail_send'`);
  assert.match(audit, /mail_send/);
  assert.equal(zizi.id ? audit.includes(zizi.id) : false, true, 'the audit points at the member');
  const exported = await svc.exportMyData(ctx, zizi.id);
  assert.ok(exported.mail.some((m) => m.subject === 'تنبيه من الإدارة'), 'the member exports their mail');
});

/* ------------------------------------ outside the platform (real e-mail) ------------------------------------ */

test('sending to a real e-mail without a provider is honest: kept in sent, «unconfigured», with a bounce', async () => {
  const zaki = await newMember('Zaki');
  const out = await mail.send(ctx, zaki.id, { to: ['someone@gmail.com'], subject: 'ميل لبرا', body: 'محاولة إرسال خارجية' });
  assert.equal(out.external.status, 'unconfigured', 'no provider configured → the truth is «unconfigured»');
  assert.deepEqual(out.external.to, ['someone@gmail.com']);
  const sent = await mail.list(ctx, zaki.id, { folder: 'sent' });
  assert.equal(sent.items[0].extStatus, 'unconfigured');
  assert.ok(sent.items[0].to.some((p) => p.external && p.address === 'someone@gmail.com'), 'external addressee shows');
  const inbox = await inboxOf(zaki.id);
  assert.ok(inbox.items.some((m) => m.subject.startsWith('تعذّر التسليم')), 'a bounce explains honestly');
  const bounceMail = await mail.view(ctx, zaki.id, inbox.items.find((m) => m.subject.startsWith('تعذّر التسليم'))!.id);
  assert.ok(bounceMail.body.includes('RESEND_API_KEY'), 'the bounce names what the administrator must configure');
});

test('sending to a real e-mail through the webhook provider actually hits the wire with threading headers', async () => {
  const captured: Record<string, unknown>[] = [];
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.post('/hook', (req, res) => { captured.push(req.body as Record<string, unknown>); res.json({ ok: true }); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  const hook = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;
  const oldEnv = ctx.env;
  ctx.env = { SHAM_WEBHOOK_URL: hook, SHAM_MAIL_DOMAIN: 'mail.example.org' };
  try {
    const gamila = await newMember('Gamila');
    const out = await mail.send(ctx, gamila.id, { to: ['friend@yahoo.com'], subject: 'من بريد شام', body: 'أهلاً يا صاحبي من منصة شام' });
    assert.equal(out.external.status, 'sent');
    const mails = captured.filter((c) => c.kind === 'platform_mail'); // the account's verification code rides the same webhook
    assert.equal(mails.length, 1, 'the webhook got exactly one outbound letter');
    const wire = mails[0];
    assert.equal(wire.kind, 'platform_mail');
    assert.deepEqual(wire.to, ['friend@yahoo.com']);
    assert.equal(wire.subject, 'من بريد شام');
    assert.ok(String(wire.text).includes('منصة شام للعطور'), 'the platform footer rides along');
    assert.equal(wire.replyTo, `${gamila.handle}@mail.example.org`, 'answers reply back to the member’s platform address');
    assert.match(String((wire.headers as Record<string, string>)['Message-ID']), /^<mail_[^@]+@mail\.example\.org>$/, 'a Message-ID for threading');
    const sent = await mail.view(ctx, gamila.id, out.id);
    assert.equal(sent.extStatus, 'sent');

    // A free mailbox (gmail.com) is someone else's domain: no invented «handle@gmail.com», and the footer says so.
    ctx.env = { SHAM_WEBHOOK_URL: hook, SHAM_EMAIL_FROM_ADDRESS: 'store@gmail.com' };
    await mail.send(ctx, gamila.id, { to: ['friend2@yahoo.com'], subject: 'بدون دومين', body: 'نص' });
    const free = captured.filter((c) => c.kind === 'platform_mail').at(-1)!;
    assert.equal(free.replyTo, '', 'no reply address without a domain we own');
    assert.ok(String(free.text).includes('لا يصل للعضو'), 'the recipient is told replies do not reach the member');
  } finally {
    ctx.env = oldEnv;
    await new Promise((done) => server.close(done));
  }
});

test('inbound routing: normalizes provider payloads, threads replies, dedupes retries, caps floods', async () => {
  const host = await newMember('Hostacc');
  const oldEnv = ctx.env;
  ctx.env = { SHAM_MAIL_DOMAIN: 'mail.shamperfumes.com' };
  try {
    // Resend Inbound shape
    const resendShape = mail.normalizeInbound({ type: 'email.received', data: { from: 'Mona <mona@gmail.com>', to: ['x@mail.shamperfumes.com'], subject: 'س', text: 'نص', message_id: '<aa@b.c>' } });
    assert.equal(resendShape.subject, 'س');
    assert.deepEqual(resendShape.to, ['x@mail.shamperfumes.com']);
    assert.equal(resendShape.messageId, '<aa@b.c>');
    // form-post shape with only html + headers text
    const formShape = mail.normalizeInbound({ from: 'Foe <foe@hotmail.com>', to: 'y', subject: 'f', html: '<p>أهلاً<br>بيك</p><script>bad()</script>', headers: 'Message-ID: <ff@h.m>\nIn-Reply-To: <prev@sham>' });
    assert.equal(formShape.body, 'أهلاً\nبيك');
    assert.equal(formShape.inReplyTo, '<prev@sham>');

    const one = await mail.inbound(ctx, { from: 'Mona Saleh <mona@gmail.com>', to: [`${host.handle}@mail.shamperfumes.com`], subject: 'سؤال عن العطور', body: 'عندكم عود؟', messageId: '<m1@gmail.com>', inReplyTo: '', references: [] });
    assert.equal(one.delivered, 1);
    const inbox = await inboxOf(host.id);
    const letter = inbox.items[0];
    assert.equal(letter.kind, 'external');
    assert.equal(letter.from.external, true);
    assert.equal(letter.from.address, 'mona@gmail.com');
    assert.equal((await mail.view(ctx, host.id, letter.id)).body, 'عندكم عود؟');
    const again = await mail.inbound(ctx, { from: 'mona@gmail.com', to: [`${host.handle}@mail.shamperfumes.com`], subject: 'سؤال عن العطور', body: 'عندكم عود؟', messageId: '<m1@gmail.com>', inReplyTo: '', references: [] });
    assert.equal(again.duplicate, true, 'provider retries never drop a second copy');
    assert.equal((await inboxOf(host.id)).items.length, 1);

    // member answers → out the wire (mocked), the answer carries our Message-ID…
    const hookApp = express();
    hookApp.use(express.json());
    const wires: Record<string, unknown>[] = [];
    hookApp.post('/h', (req, res) => { wires.push(req.body as Record<string, unknown>); res.json({ ok: true }); });
    const hookServer = hookApp.listen(0, '127.0.0.1');
    await new Promise((done) => hookServer.once('listening', done));
    ctx.env = { SHAM_MAIL_DOMAIN: 'mail.shamperfumes.com', SHAM_WEBHOOK_URL: `http://127.0.0.1:${(hookServer.address() as AddressInfo).port}/h` };
    const replyOut = await mail.send(ctx, host.id, { to: ['mona@gmail.com'], subject: 'رد: سؤال', body: 'أيوه عندنا', parentId: letter.id });
    await new Promise((done) => hookServer.close(done));
    assert.equal(replyOut.external.status, 'sent');
    // …then mona replies with In-Reply-To → threads onto the member's sent letter
    const msgId = String((wires[0].headers as Record<string, string>)['Message-ID']);
    const two = await mail.inbound(ctx, { from: 'mona@gmail.com', to: [`${host.handle}@mail.shamperfumes.com`], subject: 'ردّي', body: 'جميل جداً', messageId: '<m2@gmail.com>', inReplyTo: msgId, references: [] });
    const threaded = await mail.view(ctx, host.id, two.id as string);
    assert.equal(threaded.parent?.id, replyOut.id, 'the gmail answer threads onto our sent letter');

    await assert.rejects(mail.inbound(ctx, { from: 'not-an-email', to: [`${host.handle}@mail.shamperfumes.com`], subject: 'x', body: 'y', messageId: '', inReplyTo: '', references: [] }), { code: 'INVALID_REQUEST' });
    const nobody = await mail.inbound(ctx, { from: 'mona@gmail.com', to: ['nobody@mail.shamperfumes.com'], subject: 'x', body: 'y', messageId: '<m3@x.z>', inReplyTo: '', references: [] });
    assert.equal(nobody.delivered, 0, 'unknown platform addressees are dropped honestly');
  } finally {
    ctx.env = oldEnv;
  }
});

/* ---------------------------------------------- HTTP API ---------------------------------------------- */

async function withApi(env: Record<string, string>, run: (base: string) => Promise<void>) {
  const app = express();
  app.use(['/api/community', '/api/admin/community'], express.json({ limit: '3mb' }));
  app.use(express.json({ limit: '128kb' }));
  const community = createCommunity({ env, sql, fx: async () => FX });
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

test('HTTP: /api/community/mail end-to-end — sign-up seeds the welcome mail, members exchange letters', async () => {
  await withApi({ SHAM_DATA_KEY: KEY, SHAM_ADMIN_TOKEN: 'admin-token-for-tests', SHAM_MAIL_INBOUND_TOKEN: 'inbound-secret-token-1', SHAM_MAIL_DOMAIN: 'mail.shamperfumes.com' }, async (base) => {
    const senderEmail = email('httpsender');
    const reg = await call(base, '/community/auth/register', { body: { name: 'HTTP Sender', email: senderEmail, password: PASSWORD, handle: 'httpsender' } });
    assert.equal(reg.status, 200);
    const token = reg.data.token as string;
    // the welcome letter is already there
    const inbox = await call(base, '/community/mail?folder=inbox', { token });
    assert.equal(inbox.status, 200);
    assert.ok(inbox.data.items.some((m: any) => m.kind === 'system' && m.from.address === 'admin@sham'), 'welcome mail seeded on sign-up');
    assert.ok((await call(base, '/community/mail/counts', { token })).data.unread >= 1);
    assert.ok((await call(base, '/community/pulse', { token })).data.mail >= 1);

    // member → member mail over HTTP
    const peer = await newMember('Peer');
    const sent = await call(base, '/community/mail', { token, body: { to: [peer.handle], subject: 'اختبار API', body: 'اهلاً من الاختبار' } });
    assert.equal(sent.status, 200, JSON.stringify(sent.data));
    const check = await call(base, '/community/mail?folder=sent', { token });
    assert.ok(check.data.items.some((m: any) => m.subject === 'اختبار API'));

    // drafts over HTTP
    const draft = await call(base, '/community/mail/drafts', { token, body: { to: [peer.handle], subject: 'مسودة api', body: 'قيد الكتابة' } });
    assert.equal(draft.status, 200);
    const fired = await call(base, `/community/mail/drafts/${draft.data.id}/send`, { token, body: {} });
    assert.equal(fired.status, 200);

    // guest / member isolation
    assert.equal((await call(base, '/community/mail?folder=inbox')).status, 401);

    // the administration writes an official letter over its audited route
    const users = await call(base, `/admin/community/users?q=${encodeURIComponent(senderEmail)}`, { token: 'admin-token-for-tests' });
    const official = await call(base, `/admin/community/mail/${users.data[0].id}`, { token: 'admin-token-for-tests', body: { subject: 'إشعار رسمي', body: 'نص الإشعار' } });
    assert.equal(official.status, 200);
    const after2 = await call(base, '/community/mail?folder=inbox', { token });
    assert.ok(after2.data.items.some((m: any) => m.subject === 'إشعار رسمي' && m.kind === 'system'));
    assert.equal((await call(base, '/community/mail/trash/empty', { token, body: {} })).status, 200);

    // the provider's inbound hook: token-gated, then letters land as «external»
    const noToken = await call(base, '/community/mail/inbound', { body: { from: 'a@b.co', to: ['httpsender@mail.shamperfumes.com'], subject: 'x', text: 'y' } });
    assert.equal(noToken.status, 401);
    const badToken = await call(base, '/community/mail/inbound?token=wrong-token-value', { body: { from: 'a@b.co', to: ['httpsender@mail.shamperfumes.com'], subject: 'x', text: 'y' } });
    assert.equal(badToken.status, 401);
    const land = await call(base, '/community/mail/inbound?token=inbound-secret-token-1', {
      body: { type: 'email.received', data: { from: 'Salma <salma@hotmail.com>', to: ['httpsender@mail.shamperfumes.com'], subject: 'من هوتميل', text: 'وصلت من برا؟', message_id: '<hot-1@hotmail.com>' } },
    });
    assert.equal(land.status, 200, JSON.stringify(land.data));
    assert.ok(land.data.delivered >= 1);
    const externalInbox = await call(base, '/community/mail?folder=inbox', { token });
    assert.ok(externalInbox.data.items.some((m: any) => m.kind === 'external' && m.from.address === 'salma@hotmail.com' && m.subject === 'من هوتميل'), 'the hotmail letter is in the inbox tagged external');
    const form = await fetch(`${base}/community/mail/inbound`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-sham-mail-token': 'inbound-secret-token-1' },
      body: new URLSearchParams({ from: 'form@yahoo.com', to: 'httpsender@mail.shamperfumes.com', subject: 'فورم', text: 'form letter', 'Message-ID': '<fy@yahoo.com>' }).toString(),
    });
    assert.equal(form.status, 200, 'urlencoded forwarder payloads are accepted');
  });
});
