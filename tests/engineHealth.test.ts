/**
 * «صحة المحركات»: an engine that fails is parked (by reason) and tried last until its time is up; the working
 * engines answer meanwhile; the first success brings it back. The bots tie a pause to the key it happened with.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { EngineHealth, nextDailyRenewal, parkFor } from '../server/core/engineHealth';
import { executeChat, probeEngines, validateChatRequest } from '../server/shaheen';
import { SHAHEEN_SITE_SETTINGS } from '../server/config/shaheen';
import { keyFingerprint, pauseUntil, quotaBook } from '../scripts/doctor/agent';

const MIN = 60_000;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const ok = (text: string) => json({ choices: [{ message: { content: text } }] });
const keys = { DEEPSEEK_API_KEY: 'test-deepseek', OPENAI_API_KEY: 'test-openai' };

test('each failure has its own pause; transient errors only after two in a row', () => {
  const now = Date.parse('2026-10-19T10:00:00Z');
  assert.equal(parkFor('invalid_key', '', 1, now), 30 * MIN);
  assert.equal(parkFor('no_credit', 'Insufficient Balance', 1, now), 60 * MIN);
  assert.equal(parkFor('no_credit', 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', 1, now), 12 * 60 * MIN, 'checked again at least every 12 hours');
  const early = Date.parse('2026-10-19T05:05:00Z');
  assert.equal(parkFor('no_credit', 'daily limit', 1, early), 3 * 60 * MIN, 'daily quota → until the 08:05 UTC renewal');
  assert.equal(new Date(nextDailyRenewal(now)).toISOString(), '2026-10-20T08:05:00.000Z');
  assert.equal(new Date(nextDailyRenewal(Date.parse('2026-10-19T03:00:00Z'))).toISOString(), '2026-10-19T08:05:00.000Z');
  assert.equal(parkFor('region_blocked', '', 1, now), 6 * 60 * MIN);
  assert.equal(parkFor('model_not_found', '', 1, now), 60 * MIN);
  assert.equal(parkFor('rate_limited', '', 1, now), MIN);
  assert.equal(parkFor('rate_limited', 'quota · retry in 40s', 1, now), 45_000);
  assert.equal(parkFor('rate_limited', 'retry in 2s', 1, now), 30_000, 'at least 30 seconds');
  assert.equal(parkFor('upstream_error', '', 1, now), 0, 'one hiccup is not enough');
  assert.equal(parkFor('timeout', '', 2, now), 0, 'a slow answer is not a dead engine');
  assert.equal(parkFor('timeout', '', 3, now), MIN);
  assert.equal(parkFor('timeout', '', 9, now), 3 * MIN, 'briefly');
  assert.equal(parkFor('empty', '', 9, now), 10 * MIN, 'capped');
});

test('parked engines go to the end of the line (soonest back first) and come back after their time or a success', () => {
  let now = Date.parse('2026-10-19T10:00:00Z');
  const health = new EngineHealth(() => now);
  const ids = ['gemini', 'perplexity', 'deepseek', 'openai'] as const;
  assert.deepEqual(health.order(ids), ids, 'nothing known → the admin order');
  health.fail('gemini', 'invalid_key');
  health.fail('deepseek', 'rate_limited');
  assert.deepEqual(health.order(ids), ['perplexity', 'openai', 'deepseek', 'gemini']);
  const snap = health.snapshot();
  assert.equal(snap.gemini.state, 'parked');
  assert.equal(snap.gemini.reason, 'invalid_key');
  assert.equal(snap.gemini.parkedUntil, '2026-10-19T10:30:00.000Z');
  health.fail('openai', 'upstream_error');
  assert.equal(health.snapshot().openai.state, 'failing', 'one error: still tried');
  now += 2 * MIN; // the rate limit is over
  assert.deepEqual(health.order(ids), ['perplexity', 'deepseek', 'openai', 'gemini']);
  health.ok('gemini'); // the admin's test found the new key works
  assert.deepEqual(health.order(ids), ids);
  assert.equal(health.snapshot().gemini.state, 'ok');
  health.fail('openai', 'empty'); health.fail('openai', 'empty');
  assert.equal(health.snapshot().openai.state, 'parked');
  health.reset();
  assert.deepEqual(health.snapshot(), {});
});

test('chat: a dead engine is tried once, then the working one answers first until the pause ends', async () => {
  let now = Date.parse('2026-10-19T10:00:00Z');
  const health = new EngineHealth(() => now);
  const calls: string[] = [];
  const request = (async (url) => {
    const host = new URL(String(url)).host;
    calls.push(host);
    return host.includes('deepseek') ? json({ error: { message: 'Authentication Fails', code: 'invalid_api_key' } }, 401) : ok('جواب شغال');
  }) as typeof fetch;
  const ask = (message: string) => executeChat(validateChatRequest({ message }), { env: keys, fetch: request, settings: SHAHEEN_SITE_SETTINGS, health });

  const first = await ask('سؤال أول');
  assert.equal(first.engine.provider, 'openai');
  assert.deepEqual(calls, ['api.deepseek.com', 'api.openai.com']);
  assert.equal(health.snapshot().deepseek.state, 'parked');

  calls.length = 0;
  const second = await ask('سؤال تاني');
  assert.equal(second.engine.provider, 'openai');
  assert.deepEqual(calls, ['api.openai.com'], 'the parked engine is not tried first anymore');

  now += 31 * MIN; // half an hour later the parked engine gets another chance
  calls.length = 0;
  await ask('سؤال تالت');
  assert.deepEqual(calls, ['api.deepseek.com', 'api.openai.com']);
});

test('chat: a parked engine is still a last resort when every other engine fails', async () => {
  const health = new EngineHealth();
  health.fail('deepseek', 'no_credit');
  const request = (async (url) => (String(url).includes('deepseek') ? ok('آخر حل') : json({ error: 'down' }, 503))) as typeof fetch;
  const answer = await executeChat(validateChatRequest({ message: 'مرحبا' }), { env: keys, fetch: request, settings: SHAHEEN_SITE_SETTINGS, health });
  assert.equal(answer.engine.provider, 'deepseek');
  assert.equal(health.snapshot().deepseek.state, 'ok', 'success clears the pause');
  assert.equal(health.snapshot().openai.failures, 1);
});

test('the admin «test engines» button updates the health record', async () => {
  const health = new EngineHealth();
  health.fail('openai', 'invalid_key');
  const request = (async (url) => (String(url).includes('deepseek') ? json({ error: { message: 'Insufficient Balance' } }, 402) : ok('pong'))) as typeof fetch;
  const results = await probeEngines(SHAHEEN_SITE_SETTINGS, { env: keys, fetch: request, health });
  assert.equal(results.find((r) => r.id === 'openai')?.ok, true);
  assert.equal(health.snapshot().openai.state, 'ok');
  assert.equal(health.snapshot().deepseek.state, 'parked');
  assert.equal(health.snapshot().deepseek.reason, 'no_credit');
});

test('bots: a rejected key pauses for an hour, and a new key ends any pause at once', () => {
  const now = Date.parse('2026-10-19T10:00:00Z');
  assert.equal(pauseUntil(400, 'invalid_key', 'API_KEY_INVALID', now), now + 60 * MIN);
  const oldKey = keyFingerprint({ GEMINI_API_KEY: 'old-key' }, 'gemini');
  const newKey = keyFingerprint({ GEMINI_API_KEY: 'new-key' }, 'gemini');
  assert.match(oldKey, /^[0-9a-f]{8}$/);
  assert.notEqual(oldKey, newKey);
  assert.ok(!oldKey.includes('old'), 'the key itself is never stored');
  assert.equal(keyFingerprint({}, 'gemini'), '');
  const book = quotaBook(undefined, () => now);
  book.pause('gemini', now + 5 * 60 * MIN, 'no_credit', '', oldKey);
  assert.ok(book.pausedUntil('gemini', oldKey) > now);
  assert.equal(book.pausedUntil('gemini', newKey), 0, 'the owner replaced the key → try it now');
  assert.ok(book.pausedUntil('gemini') > now, 'callers without a fingerprint keep the old behaviour');
  book.pause('deepseek', now + MIN, 'rate_limited');
  assert.ok(book.pausedUntil('deepseek', 'anything') > now, 'old pauses without a fingerprint still apply');
});

test('«الشات أولاً»: the bots take only their daily share of a free quota, the rest stays for the visitors', async () => {
  const { botDailyCap, makeAsk, quotaDay } = await import('../scripts/doctor/agent');
  assert.equal(botDailyCap({}, 'gemini'), 10);
  assert.equal(botDailyCap({ SHAHEEN_BOT_DAILY_GEMINI: '0' }, 'gemini'), 0);
  assert.equal(botDailyCap({ SHAHEEN_BOT_DAILY_GEMINI: '-1' }, 'gemini'), Infinity);
  assert.equal(botDailyCap({}, 'perplexity'), Infinity, 'paid engines have no daily share');
  assert.equal(quotaDay(Date.parse('2026-10-19T08:00:00Z')), '2026-10-18', 'before the 08:05 renewal it is still yesterday');
  assert.equal(quotaDay(Date.parse('2026-10-19T08:10:00Z')), '2026-10-19');

  const env = { DEEPSEEK_API_KEY: 'test-deepseek', OPENAI_API_KEY: 'test-openai', SHAHEEN_BOT_DAILY_DEEPSEEK: '2' };
  const book = quotaBook();
  const hosts: string[] = [];
  const request = (async (url) => { hosts.push(new URL(String(url)).host); return ok('جواب'); }) as typeof fetch;
  const ask = (await makeAsk(env, { quota: book, request }))!;
  for (let i = 0; i < 4; i++) await ask('system', `سؤال ${i}`);
  assert.deepEqual(hosts, ['api.deepseek.com', 'api.deepseek.com', 'api.openai.com', 'api.openai.com']);
  assert.equal(book.usedToday('deepseek'), 2);
  assert.equal(book.file().engines.deepseek?.reason, 'chat_reserve');
  assert.equal(book.usedToday('openai'), 0, 'engines without a daily share are not counted');
});
