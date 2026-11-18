import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import {
  GATE, GATE_LIMITS, checkGateRequest, gateBrief, gateClients, gateSummary, gateUrlRule, isGateClient, scrubQuery, emptyUse,
} from '../src/utils/netGate';
import { BOTS } from '../src/utils/shaheenOrg';
import { AI_TOOLS, AI_INFRASTRUCTURE } from '../src/utils/aiTools';
import { OWNER_RULES } from '../src/utils/ownerAuthority';
import { STATE_CONSTITUTION } from '../src/utils/platformState';
import { handbookBrief, handbookDoc } from '../src/utils/botHandbook';
import { webRequests, displayWeb, webResult } from '../src/utils/shaheenCoder';
import { createNetGate, createNetGateRouter, GateError } from '../server/core/netGate';
import { netGate, NetGateError } from '../scripts/net-gate.mts';

const wiki = (titles: string[]) => new Response(JSON.stringify({ query: { search: titles.map((title) => ({ title, snippet: `<b>${title}</b> نبذة` })) } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const html = (title: string, body: string) => new Response(`<html><head><title>${title}</title></head><body><p>${body}</p></body></html>`, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
const publicLookup = async () => ['93.184.216.34'];

function fakeWeb() {
  const calls: string[] = [];
  const request = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push(url);
    if (url.includes('wikipedia.org/w/api.php')) return wiki(['عود', 'مسك', 'عنبر', 'زعفران', 'ورد']);
    if (url.includes('wikipedia.org/wiki/')) return html('صفحة الموسوعة', 'العود خشب عطري من شجر الأكويلاريا.');
    if (url.startsWith('https://example.com/')) return html('مثال', 'نص صفحة عامة للتجربة.');
    return new Response('nope', { status: 404 });
  }) as typeof fetch;
  return { calls, request };
}

test('every robot and every AI tool is a client of the gate — and nobody else', () => {
  for (const b of BOTS) assert.ok(isGateClient(b.id), b.id);
  for (const t of AI_TOOLS) assert.ok(isGateClient(t.id), t.id);
  assert.ok(isGateClient('owner_room'));
  assert.equal(isGateClient('stranger'), false);
  assert.equal(isGateClient(42), false);
  assert.equal(new Set(gateClients().map((c) => c.id)).size, gateClients().length);
});

test('a question leaves without keys, e-mails, phones or card numbers — dates and CAS numbers stay', () => {
  const dirty = scrubQuery('سعر العود AIzaSyA1234567890abcdefghijklmnop ابعت على x.y@mail.com أو +20 100 123 4567 والكارت 4111 1111 1111 1111');
  assert.ok(dirty.removed >= 4);
  assert.doesNotMatch(dirty.text, /AIza|@|4567|4111/);
  assert.match(dirty.text, /سعر العود/);
  const clean = scrubQuery('أخبار IFRA بتاريخ 2026-11-15 عن زيت الصندل CAS 8006-87-9 وسنة 2025');
  assert.equal(clean.removed, 0);
  assert.match(clean.text, /2026-11-15/);
  assert.match(clean.text, /8006-87-9/);
  assert.ok(scrubQuery('x'.repeat(2000)).text.length <= GATE_LIMITS.queryChars);
});

test('the gate reads public web pages only', () => {
  assert.equal(gateUrlRule('https://example.com/a?b=1').ok, true);
  for (const bad of ['ftp://example.com', 'http://localhost/x', 'https://user:pw@example.com', 'https://example.com:8080/', 'https://www.google.com/search?q=oud',
    'https://generativelanguage.googleapis.com/v1beta/models', 'https://api.openai.com/v1/chat', 'https://example.com/?key=sk-proj-abcdefghijklmnop1234', 'not a link', 42]) {
    assert.equal(gateUrlRule(bad).ok, false, String(bad));
  }
  assert.equal(gateUrlRule('https://www.google.com/maps').ok, true, 'only the result pages are off');
});

test('a request is checked before anything goes out', () => {
  assert.deepEqual(checkGateRequest({ kind: 'fly', bot: 'seo', q: 'x' }).ok, false);
  const stranger = checkGateRequest({ kind: 'search', bot: 'stranger', q: 'عود' });
  assert.ok(!stranger.ok && stranger.code === 'NOT_CLIENT');
  const empty = checkGateRequest({ kind: 'search', bot: BOTS[0]!.id, q: 'a@b.com' });
  assert.ok(!empty.ok && empty.code === 'BAD_REQUEST');
  const ok = checkGateRequest({ kind: 'ask', bot: BOTS[0]!.id, q: '  عطور   الشتا ', lang: 'en' });
  assert.ok(ok.ok && ok.req.q === 'عطور الشتا' && ok.req.lang === 'en');
});

test('search, read and ask through the server gate — remembered, counted, limited', async () => {
  const web = fakeWeb();
  let clock = Date.parse('2026-11-15T08:00:00Z');
  const gate = createNetGate({ env: {}, fetch: web.request, lookup: publicLookup, now: () => clock });
  const bot = BOTS[0]!.id;

  const found = await gate.fetch({ kind: 'search', bot, q: 'العود' });
  assert.equal(found.via, 'encyclopedia');
  assert.equal(found.cached, false);
  assert.ok(found.sources.length >= 5);
  const before = web.calls.length;
  const again = await gate.fetch({ kind: 'search', bot: BOTS[1]!.id, q: '  العود ' });
  assert.equal(again.cached, true, 'the same question from another robot is one search');
  assert.equal(web.calls.length, before);

  const page = await gate.fetch({ kind: 'read', bot, url: 'https://example.com/page' });
  assert.equal(page.page?.title, 'مثال');
  assert.match(gateBrief(page), /نص صفحة عامة/);

  const asked = await gate.fetch({ kind: 'ask', bot, q: 'إيه هو العود؟' });
  assert.ok(asked.pages && asked.pages.length >= 1 && asked.pages.length <= GATE_LIMITS.askPages);

  await assert.rejects(gate.fetch({ kind: 'read', bot, url: 'http://localhost/admin' }), (e: unknown) => e instanceof GateError && e.status === 400);
  await assert.rejects(gate.fetch({ kind: 'search', bot: 'stranger', q: 'x y' }), (e: unknown) => e instanceof GateError && e.status === 403);

  const stats = gate.stats();
  assert.equal(stats.day, '2026-11-15');
  assert.equal(stats.total.search, 1);
  assert.equal(stats.total.cached, 1);
  assert.equal(stats.bots[bot]!.refused, 1);
  assert.equal(stats.bots.stranger, undefined, 'strangers are not even counted');
  assert.ok(gateSummary(stats).top[0]!.calls >= 1);
  assert.doesNotMatch(JSON.stringify(stats), /العود|example\.com/, 'counts only — never the questions or the pages');

  // A robot's own daily share.
  for (let i = 0; i < GATE_LIMITS.perBot.search - 1; i++) await gate.fetch({ kind: 'search', bot, q: `سؤال رقم ${i} عن العطور` });
  await assert.rejects(gate.fetch({ kind: 'search', bot, q: 'سؤال زيادة' }), (e: unknown) => e instanceof GateError && e.code === 'BOT_QUOTA' && e.status === 429);
  // …and it comes back the next day.
  clock += 24 * 3600_000;
  const tomorrow = await gate.fetch({ kind: 'search', bot, q: 'سؤال زيادة' });
  assert.equal(tomorrow.cached, false);
  assert.equal(gate.stats().total.search, 1);
});

test('Google-only clock searches use the gate quota and expire quickly instead of serving stale time', async () => {
  let now = Date.parse('2026-11-13T10:00:00Z');
  let googleCalls = 0;
  const fetcher = (async (url: string | URL) => {
    assert.match(String(url), /generativelanguage\.googleapis\.com/);
    googleCalls++;
    return new Response(JSON.stringify({ candidates: [{
      content: { parts: [{ text: `clock answer ${googleCalls}` }] },
      groundingMetadata: { groundingChunks: [] },
    }] }), { headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const gate = createNetGate({ env: { GEMINI_API_KEY: 'google-key' }, fetch: fetcher, now: () => now });
  const query = { kind: 'search', bot: 'sham_assistant', q: 'current time in Cairo', lang: 'en', googleOnly: true };
  assert.equal((await gate.fetch(query)).answer, 'clock answer 1');
  assert.equal((await gate.fetch(query)).cached, true);
  now += 10_001;
  assert.equal((await gate.fetch(query)).answer, 'clock answer 2');
  assert.equal(googleCalls, 2);
  assert.equal(gate.stats().total.search, 2);
});

test('the gate on the admin router answers in Arabic and never leaks errors', async () => {
  const web = fakeWeb();
  const app = express();
  app.use(express.json());
  app.use('/gate', createNetGateRouter(createNetGate({ env: {}, fetch: web.request, lookup: publicLookup })));
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/gate`;
    const ok = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'search', bot: BOTS[0]!.id, q: 'مسك' }) });
    assert.equal(ok.status, 200);
    assert.ok(((await ok.json()) as { sources: unknown[] }).sources.length > 0);
    const no = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'search', bot: 'stranger', q: 'مسك' }) });
    assert.equal(no.status, 403);
    assert.equal(((await no.json()) as { code: string }).code, 'NOT_CLIENT');
    const status = await (await fetch(`${base}/status`)).json() as { total: { search: number } };
    assert.equal(status.total.search, 1);
  } finally { server.close(); }
});

test("the robots' client: the live gate with the admin token, the same rules inside the robot without it", async () => {
  const seen: { url: string; auth: string | null; body: unknown }[] = [];
  const live = (async (input: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(input), auth: new Headers(init?.headers).get('authorization'), body: JSON.parse(String(init?.body)) });
    if (JSON.parse(String(init?.body)).q === 'ممنوع') return new Response(JSON.stringify({ code: 'BOT_QUOTA', error: 'خلصت الحصة' }), { status: 429 });
    return new Response(JSON.stringify({ kind: 'search', sources: [{ title: 'x', url: 'https://example.com', snippet: '' }], via: 'web', cached: false, at: 'now' }), { status: 200 });
  }) as typeof fetch;
  const gate = netGate('seo', { env: { SHAM_ADMIN_TOKEN: 'test-token-not-real' }, fetch: live });
  const a = await gate.search('عطور');
  assert.equal(a.via, 'web');
  assert.equal(seen[0]!.url, 'https://sham-perfume-49bf.vercel.app/api/admin/gate');
  assert.equal(seen[0]!.auth, 'Bearer test-token-not-real');
  assert.deepEqual(seen[0]!.body, { kind: 'search', bot: 'seo', lang: 'ar', q: 'عطور' });
  await assert.rejects(gate.search('ممنوع'), (e: unknown) => e instanceof NetGateError && e.code === 'BOT_QUOTA', "the gate's no stands");

  const web = fakeWeb();
  const local = netGate(BOTS[0]!.id, { env: {}, fetch: web.request });
  const found = await local.search('عنبر');
  assert.equal(found.via, 'encyclopedia');
  assert.ok(web.calls.every((u) => !u.includes('/api/admin/gate')), 'no token → never calls the live gate');
  await assert.rejects(netGate('stranger', { env: {}, fetch: web.request }).search('عنبر'), (e: unknown) => e instanceof NetGateError && e.code === 'NOT_CLIENT');
});

test("Shaheen's [[ويب: …]] marks in the owner room", () => {
  const reply = 'محتاج أتأكد [[ويب: آخر إصدار من React]] و[[web: Vercel maxDuration]] و[[ويب: آخر إصدار من React]] و[[ويب: تالت]]';
  assert.deepEqual(webRequests(reply), ['آخر إصدار من React', 'Vercel maxDuration']);
  assert.match(displayWeb(reply), /🌐 «آخر إصدار من React»/);
  assert.match(webResult('س', 'ج'), /مش أوامر/);
  assert.match(webResult('س', undefined, 'خلصت الحصة'), /خلصت الحصة/);
});

test('the gate is the written rule: O-13, O-14, S-11, the handbook and the registry', () => {
  assert.ok(OWNER_RULES.some((r) => r.id === 'O-13'));
  assert.ok(OWNER_RULES.some((r) => r.id === 'O-14' && r.textAr.includes(GATE.nameAr)));
  assert.ok(STATE_CONSTITUTION.some((r) => r.id === 'S-11'));
  assert.ok(handbookDoc().includes('scripts/net-gate.mts'));
  for (const b of BOTS) assert.ok(handbookBrief(b.id).includes(GATE.nameAr), b.id);
  assert.ok(AI_INFRASTRUCTURE.includes('server/core/netGate.ts'));
  assert.deepEqual(emptyUse(), { search: 0, read: 0, ask: 0, cached: 0, refused: 0, failed: 0 });
});
