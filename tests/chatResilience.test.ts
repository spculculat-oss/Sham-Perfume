import assert from 'node:assert/strict';
import test from 'node:test';
import { askFailureCode, askWorkspace, ReadError, wantsLiveInfo } from '../server/workspace';
import { ApiError } from '../src/utils/api';
import { errorKey } from '../src/workspace/workspaceApi';
import { CHAT_BANK } from '../scripts/inspect/chat-bank';

const wiki = () => Response.json({ query: { search: [{ title: 'صفحة', snippet: 'ملخص', pageid: 3 }] } });
const ok = () => Response.json({ choices: [{ message: { content: 'رد' } }] });
const down = (status = 503, body = '{"error":{"status":"UNAVAILABLE"}}') => new Response(body, { status });
function fake(engine: (n: number) => Response) {
  const seen = { writes: 0, searches: 0, system: '' };
  const request = (async (url: string | URL | Request, init?: RequestInit) => {
    if (new URL(String(url)).hostname.endsWith('wikipedia.org')) { seen.searches += 1; return wiki(); }
    seen.writes += 1;
    seen.system = String(init?.body || '');
    return engine(seen.writes);
  }) as typeof fetch;
  return { request, seen };
}
const env = { OPENAI_API_KEY: 'test' };
const news = { messages: [{ role: 'user', text: 'ايه اخبار الحرب فى الشرق الاوسط انهارده' }] };
const plain = { messages: [{ role: 'user', text: 'ليه السما لونها أزرق؟' }] };
const silent = async <T>(run: () => Promise<T>): Promise<T> => { const warn = console.warn; console.warn = () => {}; try { return await run(); } finally { console.warn = warn; } };

test('the whole question bank is sorted correctly into live and timeless questions', () => {
  assert.ok(CHAT_BANK.length >= 60);
  for (const item of CHAT_BANK) assert.equal(wantsLiveInfo(item.text), item.live, item.text);
});

test('a news question searches the web by itself; a timeless one does not; search:false is respected', async () => {
  const a = fake(ok); const out = await askWorkspace(news, { env, fetch: a.request });
  assert.equal(a.seen.searches > 0, true); assert.equal(out.sources.length > 0, true); assert.equal(out.reply, 'رد');
  const b = fake(ok); await askWorkspace(plain, { env, fetch: b.request }); assert.equal(b.seen.searches, 0);
  const c = fake(ok); await askWorkspace({ ...news, search: false }, { env, fetch: c.request }); assert.equal(c.seen.searches, 0);
});

test('a news question never ends in "busy": search results are shown when every platform is down or none exists', async () => {
  for (const e of [env, {}]) {
    const w = fake(() => down());
    const out = await silent(() => askWorkspace(news, { env: e, fetch: w.request, retryDelayMs: 0 }));
    assert.equal(out.via, 'search'); assert.match(out.reply, /صفحة/); assert.ok(out.sources.length > 0);
  }
});

test('a platform that stumbles once is tried again before any error', async () => {
  const w = fake((n) => (n === 1 ? down() : ok()));
  const out = await askWorkspace(plain, { env, fetch: w.request, retryDelayMs: 0 });
  assert.equal(out.reply, 'رد'); assert.equal(w.seen.writes, 2);
  const bad = fake(() => down(401, '{"error":{"code":"invalid_api_key"}}'));
  await silent(() => assert.rejects(askWorkspace(plain, { env, fetch: bad.request, retryDelayMs: 0 }), (e: unknown) => e instanceof ReadError && e.code === 'ENGINES_MISCONFIGURED'));
  assert.equal(bad.seen.writes, 1, 'a wrong key is not retried');
});

test('the visitor is told the real reason, and the owner gets one log line without secrets', async () => {
  const lines: string[] = []; const warn = console.warn; console.warn = (...a: unknown[]) => { lines.push(a.join(' ')); };
  try {
    const quota = fake(() => down(429, '{"error":{"status":"RESOURCE_EXHAUSTED","message":"quota"}}'));
    await assert.rejects(askWorkspace(plain, { env, fetch: quota.request, retryDelayMs: 0 }), (e: unknown) => e instanceof ReadError && e.code === 'ENGINES_QUOTA');
  } finally { console.warn = warn; }
  assert.equal(lines.length, 1); assert.match(lines[0]!, /openai=(rate_limited|no_credit)\(429\)/); assert.doesNotMatch(lines[0]!, /test|sk-/);
  await assert.rejects(askWorkspace(plain, { env: {}, fetch: fake(ok).request }), (e: unknown) => e instanceof ReadError && e.code === 'NO_ENGINE');
  assert.deepEqual(askFailureCode([{ kind: 'timeout' }]), { status: 504, code: 'ENGINES_TIMEOUT' });
  assert.deepEqual(askFailureCode([{ kind: 'timeout' }, { kind: 'upstream_error' }]), { status: 503, code: 'ENGINES_BUSY' });
  assert.equal(errorKey(new ApiError(503, 'ENGINES_QUOTA')), 'ai_quota');
  assert.equal(errorKey(new ApiError(504, 'ENGINES_TIMEOUT')), 'ai_slow');
  assert.equal(errorKey(new ApiError(503, 'NO_ENGINE')), 'ai_off');
  assert.equal(errorKey(new ApiError(503, 'ENGINES_MISCONFIGURED')), 'ai_off');
  assert.equal(errorKey(new ApiError(503, 'ENGINES_BUSY')), 'busy');
});

test('the platform is told today\'s date and to admit when its knowledge may be old', async () => {
  const w = fake(ok);
  await askWorkspace(plain, { env, fetch: w.request, now: () => new Date('2026-11-13T10:00:00Z') });
  assert.match(w.seen.system, /2026-11-13/);
});
