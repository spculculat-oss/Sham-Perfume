/**
 * «جناح صاحب الموقع» and «غرفة شاهين الخاصة» — the owner, Shaheen and the secretary only: the room is sealed in
 * the owner's browser with his code, the server answers only with the admin code and keeps nothing, and numbers
 * that look like cards or IDs never leave the browser.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import { createShamCore } from '../server/core/http';
import { validateRoomRequest, roomAnswer } from '../server/ownerRoom';
import {
  emptyRoom, isSealedRoom, openRoom, readRoom, roomHistory, sealRoom, secretaryLocalSummary, secretaryNotes, type RoomMessage,
} from '../src/utils/ownerRoom';
import { OWNER_RULES } from '../src/utils/ownerAuthority';

const msg = (by: RoomMessage['by'], text: string, i = 0): RoomMessage => ({ id: `m${i}`, by, text, at: '2026-10-21T12:00:00Z' });
const FAST = 100_000; // the lowest accepted work factor keeps the test quick

test('the room is sealed with the owner\'s code: only that code opens it, a changed byte breaks it', async () => {
  const room = { ...emptyRoom(), messages: [msg('owner', 'عايز تقرير عن المبيعات'), msg('shaheen', 'حاضر', 1)], notes: [{ id: 'n', text: 'مراجعة الأسعار', at: 'x' }] };
  const sealed = await sealRoom('owner-secret-code-2026', room, FAST);
  assert.ok(isSealedRoom(sealed));
  assert.doesNotMatch(JSON.stringify(sealed), /المبيعات|الأسعار/, 'no plain text in what is stored');
  assert.deepEqual(await openRoom('owner-secret-code-2026', sealed), room);
  assert.equal(await openRoom('someone-else-guessing', sealed), undefined);
  const flipped = { ...sealed, data: sealed.data.slice(0, -4) + (sealed.data.endsWith('AAAA') ? 'BBBB' : 'AAAA') };
  assert.equal(await openRoom('owner-secret-code-2026', flipped), undefined);
  const again = await sealRoom('owner-secret-code-2026', room, FAST);
  assert.notEqual(again.iv, sealed.iv, 'a fresh IV every time');
  assert.equal(isSealedRoom({ ...sealed, iter: 1000 }), false, 'a weak work factor is refused');
  assert.deepEqual(readRoom({ messages: [{ by: 'hacker', text: 'x', id: '1', at: 'y' }, msg('owner', 'تمام')] }).messages.length, 1);
});

test('the secretary writes down the owner\'s orders and decisions, and never a card or ID number', () => {
  const room = [
    msg('owner', 'عايز صفحة عروض جديدة للعيد', 1),
    msg('shaheen', 'تمام، هجهزها', 2),
    msg('owner', 'قررت نوقف الاستيراد لحد الشهر الجاي', 3),
    msg('owner', 'ابعت الفلوس على الحساب 4111 1111 1111 1111', 4),
    msg('owner', 'ازيك يا شاهين', 5),
  ];
  const notes = secretaryNotes(room);
  assert.deepEqual(notes.decisions, ['قررت نوقف الاستيراد لحد الشهر الجاي']);
  assert.equal(notes.orders.length, 2);
  assert.ok(notes.orders.every((o) => !/4111/.test(o)));
  const summary = secretaryLocalSummary(room);
  assert.match(summary, /مفكرة السكرتير/);
  assert.doesNotMatch(summary, /ازيك/);
  assert.match(secretaryLocalSummary([]), /لسه مفيش/);
  const history = roomHistory([...Array.from({ length: 40 }, (_, i) => msg('owner', `رسالة ${i}`, i)), msg('owner', 'رقمي 29001011234567', 99)]);
  assert.equal(history.length, 24);
  assert.equal(history.at(-1)!.text, 'رقمي ••••');
});

test('the server room: only with the admin code, nothing stored, numbers hidden from the engine', async () => {
  const bodies: string[] = [];
  const env = { SHAM_STORE: 'memory', SHAM_SEED_DEMO: 'true', SHAM_ADMIN_TOKEN: 'owner-secret-code-2026', SHAM_LLM_BASE_URL: 'http://llm.test/v1', SHAM_LLM_MODEL: 'main' };
  const fakeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    bodies.push(String(init?.body || ''));
    return new Response(JSON.stringify({ choices: [{ message: { content: 'أهلاً يا ريس، الوضع تمام.' } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const core = createShamCore({ env, fetch: fakeFetch });
  const app = express(); app.use(express.json()); app.use('/api/admin', core.admin);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin/owner-room`;
  const post = (body: unknown, token?: string) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  try {
    const body = { to: 'shaheen', history: [{ by: 'owner', text: 'إيه أخبار الموقع؟ ورقمي القومي 29001011234567' }] };
    assert.equal((await post(body)).status, 401);
    assert.equal((await post(body, 'wrong-code-wrong-code')).status, 401);
    const res = await post(body, env.SHAM_ADMIN_TOKEN);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const answer = await res.json();
    assert.equal(answer.by, 'shaheen');
    assert.match(answer.reply, /الوضع تمام/);
    assert.ok(bodies.length >= 1);
    assert.ok(bodies.every((b) => !b.includes('29001011234567')), 'the engine never sees the number');
    assert.ok(bodies.some((b) => b.includes('غرفة خاصة')), 'Shaheen knows he is in the private room');
    // Nothing of the room is kept on the server.
    assert.equal((await core.repo.conversations()).length, 0);
    assert.ok(!JSON.stringify(await core.memory.learned()).includes('أخبار الموقع'));
    const secretary = await (await post({ to: 'secretary', history: [{ by: 'owner', text: 'عايز تقرير' }, { by: 'shaheen', text: 'حاضر' }] }, env.SHAM_ADMIN_TOKEN)).json();
    assert.equal(secretary.by, 'secretary');
    assert.equal((await post({ to: 'everyone', history: [{ by: 'owner', text: 'x' }] }, env.SHAM_ADMIN_TOKEN)).status, 400);
  } finally { await new Promise((d) => server.close(d)); }
});

test('without any engine Shaheen says so honestly and the secretary answers from the notebook', async () => {
  const shaheen = await roomAnswer(validateRoomRequest({ history: [{ by: 'owner', text: 'عايز خطة للشهر' }] }), { env: {} });
  assert.equal(shaheen.offline, true);
  assert.match(shaheen.reply, /مش متاحة/);
  const sec = await roomAnswer(validateRoomRequest({ to: 'secretary', history: [{ by: 'owner', text: 'عايز خطة للشهر' }] }), { env: {} });
  assert.equal(sec.offline, true);
  assert.match(sec.reply, /عايز خطة للشهر/);
  assert.throws(() => validateRoomRequest({ history: [{ by: 'shaheen', text: 'x' }] }), /owner/);
  assert.throws(() => validateRoomRequest({ history: [] }));
});

test('the owner\'s suite has its own door: #owner, a quiet key in the footer, locked by his code and out of search engines', () => {
  const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
  assert.match(main, /isOwnerRoute/);
  assert.match(main, /import\('\.\/admin\/OwnerSuite\.tsx'\)/, 'loaded only when opened');
  assert.match(readFileSync(new URL('../src/components/Footer.tsx', import.meta.url), 'utf8'), /href="#owner"/);
  const suite = readFileSync(new URL('../src/admin/OwnerSuite.tsx', import.meta.url), 'utf8');
  assert.match(suite, /noindex, nofollow/);
  assert.match(suite, /IDLE_MS = 30 \* 60_000/);
  assert.match(suite, /section === 'room' && access === 'full'/, 'the room needs the admin code');
  assert.ok(OWNER_RULES.some((r) => r.id === 'O-07' && /غرفة شاهين الخاصة/.test(r.textAr)));
});
