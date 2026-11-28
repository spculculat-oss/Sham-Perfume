import assert from 'node:assert/strict';
import test from 'node:test';
import { askFailureCode, askWorkspace, ReadError, wantsLiveInfo } from '../server/workspace';
import { ApiError } from '../src/utils/api';
import { checkServer, errorKey, lineDropped, type WsStatus } from '../src/workspace/workspaceApi';
import { WS_STRINGS } from '../src/workspace/strings';
import { CHAT_BANK } from '../scripts/inspect/chat-bank';

const wiki = () => Response.json({ query: { search: [{ title: 'صفحة', snippet: 'ملخص', pageid: 3 }] } });
const ok = () => Response.json({ choices: [{ message: { content: 'رد' } }] });
const down = (status = 503, body = '{"error":{"status":"UNAVAILABLE"}}') => new Response(body, { status });
// «بحث جوجل»: the search Gemini runs with its google_search tool (the pages it used come back as grounding).
const google = () => Response.json({ candidates: [{ content: { parts: [{ text: 'ملخص البحث من جوجل' }] }, groundingMetadata: { groundingChunks: [{ web: { uri: 'https://www.youm7.com/a', title: 'صفحة' } }] } }] });
function fake(engine: (n: number) => Response, { googleDown = false } = {}) {
  const seen = { writes: 0, searches: 0, wiki: 0, system: '' };
  const request = (async (url: string | URL | Request, init?: RequestInit) => {
    if (new URL(String(url)).hostname.endsWith('wikipedia.org')) { seen.searches += 1; seen.wiki += 1; return wiki(); }
    if (new URL(String(url)).hostname === 'generativelanguage.googleapis.com') {
      // Only the search itself is answered here; Gemini as a writer is shut (so the other platform writes).
      if (!String(init?.body || '').includes('دوّر في جوجل وجاوب')) return down(401, '{"error":{"status":"UNAUTHENTICATED"}}');
      seen.searches += 1;
      return googleDown ? down(429, '{"error":{"status":"RESOURCE_EXHAUSTED"}}') : google();
    }
    seen.writes += 1;
    seen.system = String(init?.body || '');
    return engine(seen.writes);
  }) as typeof fetch;
  return { request, seen };
}
const env = { OPENAI_API_KEY: 'test' };
const newsEnv = { OPENAI_API_KEY: 'test', GEMINI_API_KEY: 'g' };
const news = { messages: [{ role: 'user', text: 'ايه اخبار الحرب فى الشرق الاوسط انهارده' }] };
const plain = { messages: [{ role: 'user', text: 'ليه السما لونها أزرق؟' }] };
const silent = async <T>(run: () => Promise<T>): Promise<T> => { const warn = console.warn; console.warn = () => {}; try { return await run(); } finally { console.warn = warn; } };

test('the whole question bank is sorted correctly into live and timeless questions', () => {
  assert.ok(CHAT_BANK.length >= 60);
  for (const item of CHAT_BANK) assert.equal(wantsLiveInfo(item.text), item.live, item.text);
});

test('a news question searches Google by itself; a timeless one does not; search:false is respected', async () => {
  const a = fake(ok); const out = await silent(() => askWorkspace(news, { env: newsEnv, fetch: a.request }));
  assert.equal(a.seen.searches > 0, true); assert.equal(out.sources.length > 0, true); assert.equal(out.reply, 'رد');
  assert.equal(a.seen.wiki, 0); assert.equal(out.sources[0]!.url, 'https://www.youm7.com/a');
  const b = fake(ok); await askWorkspace(plain, { env, fetch: b.request }); assert.equal(b.seen.searches, 0);
  const c = fake(ok); await askWorkspace({ ...news, search: false }, { env, fetch: c.request }); assert.equal(c.seen.searches, 0);
});

test('a news question never ends in "busy": the Google answer is shown when every writing platform is down', async () => {
  const w = fake(() => down());
  const out = await silent(() => askWorkspace(news, { env: newsEnv, fetch: w.request, retryDelayMs: 0 }));
  assert.equal(out.via, 'search'); assert.match(out.reply, /جوجل/); assert.ok(out.sources.length > 0);
});

test("today's news is never answered from the encyclopedia when Google search fails (Bahrain 2011 is not today's news)", async () => {
  for (const e of [newsEnv, {}]) {
    const w = fake(() => down(), { googleDown: true });
    const out = await silent(() => askWorkspace(news, { env: e, fetch: w.request, retryDelayMs: 0 }));
    assert.match(out.reply, /البحث المباشر ما رجّعش نتائج موثوقة/);
    assert.equal(out.sources.length, 0);
    assert.equal(w.seen.wiki, 0);
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

test('«فكّر بعمق»: a private plan first, then the answer; a reply that fails the check is rewritten once', async () => {
  const say = (content: string) => () => Response.json({ choices: [{ message: { content } }] });
  const bodies: string[] = [];
  const english = 'This answer drifted into English and keeps going about the topic for quite a while. '.repeat(4);
  const good = 'الفرق في التركيز:\n\n| النوع | التركيز |\n| --- | --- |\n| EDP | أعلى |\n| EDT | أخف |\n\nللصيف خد EDT.';
  const replies = [say('- المطلوب: مقارنة\n- الشكل: جدول'), say(english), say(good)];
  const request = (async (_url: string | URL | Request, init?: RequestInit) => { bodies.push(String(init?.body || '')); return replies[bodies.length - 1]!(); }) as typeof fetch;
  const stages: string[] = [];
  const out = await askWorkspace({ messages: [{ role: 'user', text: 'إيه الفرق بين EDP و EDT؟' }], search: false, deep: true }, { env, fetch: request, onEvent: (e) => { if (e.type === 'stage') stages.push(e.stage); } });
  assert.equal(bodies.length, 3, 'plan, draft, rewrite');
  assert.match(bodies[0]!, /تفكير داخلي/);
  assert.match(bodies[1]!, /ملاحظات تفكيرك الداخلي/, 'the plan reaches the writer');
  assert.match(bodies[2]!, /المراجعة لقت/);
  assert.equal(out.reply, good);
  assert.deepEqual(stages.filter((s, i) => s !== stages[i - 1]), ['thinking', 'writing', 'reviewing', 'writing']);
});

test('without «فكّر بعمق» there is one call, the craft habits ride in the system prompt, and slips are mended in place', async () => {
  const bodies: string[] = [];
  const request = (async (_url: string | URL | Request, init?: RequestInit) => { bodies.push(String(init?.body || '')); return Response.json({ choices: [{ message: { content: 'اتفضل:\n```js\nconsole.log(1)' } }] }); }) as typeof fetch;
  const out = await askWorkspace({ messages: [{ role: 'user', text: 'اكتبلي كود يطبع رقم' }], search: false }, { env, fetch: request });
  assert.equal(bodies.length, 1);
  assert.match(bodies[0]!, /طريقة التفكير/);
  assert.match(bodies[0]!, /نوع السؤال: برمجة/);
  assert.ok(out.reply.trimEnd().endsWith('```'), 'the open code block is closed');
});

test('one missed look at the server is not «not connected»: it tries again before giving up', async () => {
  const ready: WsStatus = { ai: true, search: 'web', image: 'ai', notion: false, slack: false };
  let calls = 0;
  const waits: number[] = [];
  const timeouts: number[] = [];
  const out = await checkServer(undefined, { wait: async (ms) => { waits.push(ms); }, look: async (_signal, timeoutMs) => {
    calls += 1; timeouts.push(timeoutMs ?? 0);
    if (calls < 3) throw new TypeError('Failed to fetch');
    return ready;
  } });
  assert.deepEqual(out, ready);
  assert.equal(calls, 3);
  assert.deepEqual(waits, [1_500, 4_000]);
  assert.ok(timeouts.every((ms) => ms >= 15_000), 'a waking server gets more than the old 10 seconds');
  let tries = 0;
  await assert.rejects(checkServer(undefined, { wait: async () => {}, look: async () => { tries += 1; throw new TypeError('Failed to fetch'); } }));
  assert.equal(tries, 3);
});

test('a dropped line says «send it again», not «this copy has no server»', () => {
  assert.equal(errorKey(new TypeError('Failed to fetch')), 'unreachable');
  assert.equal(errorKey(new DOMException('API request timed out', 'TimeoutError')), 'unreachable');
  assert.equal(lineDropped(new ApiError(503)), false);
  assert.equal(errorKey(new ApiError(503)), 'busy');
  for (const key of ['unreachable', 'reconnecting'] as const) {
    assert.ok(WS_STRINGS[key].ar && WS_STRINGS[key].en, key);
    assert.doesNotMatch(WS_STRINGS[key].ar, /النسخة دي من الموقع/);
  }
});
