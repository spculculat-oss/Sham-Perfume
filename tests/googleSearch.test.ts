import assert from 'node:assert/strict';
import { test } from 'node:test';
import { callEngine, groundingSources, resetGoogleRefusals } from '../server/core/engines';
import { googleHealth } from '../server/core/googleHealth';
import { webSearch } from '../server/workspace';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const grounded = (text: string) => ({ candidates: [{ content: { parts: [{ text }] }, groundingMetadata: { groundingChunks: [
  { web: { uri: 'https://www.youm7.com/story/1', title: 'اليوم السابع' } },
  { web: { uri: 'https://apnews.com/world-news' } },
  { web: { uri: 'http://insecure.example/x', title: 'no' } },
] } }] });

test('Google grounding pages: HTTPS only, the site name when the title is missing', () => {
  assert.deepEqual(groundingSources(grounded('x').candidates[0]!.groundingMetadata), [
    { title: 'اليوم السابع', url: 'https://www.youm7.com/story/1' },
    { title: 'apnews.com', url: 'https://apnews.com/world-news' },
  ]);
  assert.deepEqual(groundingSources(undefined), []);
});

test('a Google search refused by one model is tried on the next, and the owner sees why', async () => {
  googleHealth.reset();
  const models: string[] = [];
  const fetchMock = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    assert.ok(!u.includes('wikipedia'), 'the encyclopedia is not needed when Google answers');
    models.push(decodeURIComponent(u.match(/models\/([^:]+):/)![1]!));
    assert.deepEqual(JSON.parse(String(init!.body)).tools, [{ google_search: {} }]);
    if (models.length === 1) return json({ error: { status: 'PERMISSION_DENIED' } }, 403);
    return json(grounded('الدولار النهارده ٥٥٫٨ جنيه.'));
  }) as typeof fetch;
  const out = await webSearch('سعر الدولار النهارده', 'ar', { env: { GEMINI_API_KEY: 'k' }, fetch: fetchMock, live: true });
  assert.equal(out.kind, 'web');
  assert.equal(out.answer, 'الدولار النهارده ٥٥٫٨ جنيه.');
  assert.equal(out.results.length, 2);
  assert.equal(models.length, 2);
  assert.notEqual(models[0], models[1]);
  const health = googleHealth.snapshot();
  assert.equal(health.ok, 1);
  assert.equal(health.failed, 1);
  assert.equal(health.lastError?.status, 403);
  assert.equal(health.lastError?.detail, 'PERMISSION_DENIED');
  assert.ok(!/"k"|x-goog/.test(JSON.stringify(health)), 'never the key');
});

test("today's news never comes from the encyclopedia (Bahrain 2011 is not today's news)", async () => {
  googleHealth.reset();
  let wiki = 0;
  const fetchMock = (async (url: string | URL) => {
    if (String(url).includes('wikipedia')) { wiki++; return json({ query: { search: [{ title: 'Bahraini uprising of 2011', snippet: 'old' }] } }); }
    return json({ error: { status: 'RESOURCE_EXHAUSTED' } }, 429);
  }) as typeof fetch;
  const live = await webSearch('اخبار النهارده', 'ar', { env: { GEMINI_API_KEY: 'k' }, fetch: fetchMock, live: true });
  assert.deepEqual(live.results, []);
  assert.equal(wiki, 0);
  assert.ok(googleHealth.snapshot().failed >= 2);
  // A timeless question may still fall back to the encyclopedia.
  const timeless = await webSearch('تاريخ العطور', 'ar', { env: { GEMINI_API_KEY: 'k' }, fetch: fetchMock });
  assert.equal(timeless.kind, 'encyclopedia');
  assert.ok(wiki >= 1);
});

test('Gemini in a chat searches Google itself, and its pages come back as sources', async () => {
  resetGoogleRefusals();
  const bodies: Record<string, unknown>[] = [];
  const fetchMock = (async (_url: string | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init!.body)));
    return json(grounded('ده آخر خبر.'));
  }) as typeof fetch;
  const found: { title: string; url: string }[] = [];
  const reply = await callEngine('gemini', 'sys', [{ role: 'user', text: 'مين كسب ماتش امبارح؟' }], {
    env: { GEMINI_API_KEY: 'k' }, fetch: fetchMock, signal: AbortSignal.timeout(5000), temperature: 0.5, googleSearch: true,
    onSources: (s) => found.push(...s),
  });
  assert.equal(reply, 'ده آخر خبر.');
  assert.deepEqual(bodies[0]!.tools, [{ google_search: {} }]);
  assert.equal(found.length, 2);
});

test('a key or model without Google search still answers, and is not asked to search again for an hour', async () => {
  resetGoogleRefusals();
  googleHealth.reset();
  const bodies: Record<string, unknown>[] = [];
  const fetchMock = (async (_url: string | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init!.body)) as Record<string, unknown>;
    bodies.push(body);
    if (body.tools) return json({ error: { status: 'INVALID_ARGUMENT' } }, 400);
    return json({ candidates: [{ content: { parts: [{ text: 'إجابة من غير بحث.' }] } }] });
  }) as typeof fetch;
  const ask = () => callEngine('gemini', 'sys', [{ role: 'user', text: 'سؤال' }], {
    env: { GEMINI_API_KEY: 'k2' }, fetch: fetchMock, signal: AbortSignal.timeout(5000), temperature: 0.5, googleSearch: true,
  });
  assert.equal(await ask(), 'إجابة من غير بحث.');
  assert.equal(bodies.length, 2);
  assert.equal(googleHealth.snapshot().lastError?.status, 400);
  assert.equal(await ask(), 'إجابة من غير بحث.');
  assert.equal(bodies.length, 3, 'the second answer goes straight without the refused search');
  assert.equal(bodies[2]!.tools, undefined);
});

test('without googleSearch the request carries no search tool', async () => {
  let body: Record<string, unknown> = {};
  const fetchMock = (async (_url: string | URL, init?: RequestInit) => { body = JSON.parse(String(init!.body)); return json({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }); }) as typeof fetch;
  await callEngine('gemini', 'sys', [{ role: 'user', text: 'x' }], { env: { GEMINI_API_KEY: 'k' }, fetch: fetchMock, signal: AbortSignal.timeout(5000), temperature: 0.5 });
  assert.equal(body.tools, undefined);
});

test('the site chat: any question Gemini is unsure of goes to Google by itself, and the answer shows its links', async () => {
  resetGoogleRefusals();
  const { executeChat, validateChatRequest } = await import('../server/shaheen');
  const bodies: Record<string, any>[] = [];
  const fetchMock = (async (_url: string | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init!.body)));
    return json(grounded('مؤسس دار جيرلان هو بيير فرانسوا باسكال جيرلان سنة 1828.'));
  }) as typeof fetch;
  const webGate = { fetch: async () => { throw new Error('not needed'); } };
  const answer = await executeChat(validateChatRequest({ message: 'مين أسس دار جيرلان وإمتى؟', model: 'gemini', language: 'ar' }),
    { env: { GEMINI_API_KEY: 'k3', SHAM_LIVE_DATA: 'off' }, fetch: fetchMock, webGate: webGate as never });
  assert.deepEqual(bodies[0]!.tools, [{ google_search: {} }]);
  assert.match(answer.reply, /1828/);
  assert.match(answer.reply, /youm7\.com/);
  assert.ok(answer.sources?.every((s) => s.title && s.url.startsWith('https://')));
});

test('the other engines get told to ask for a Google search instead of guessing', async () => {
  const { executeChat, validateChatRequest } = await import('../server/shaheen');
  const systems: string[] = [];
  const asked: unknown[] = [];
  const fetchMock = (async (_url: string | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init!.body));
    systems.push(JSON.stringify(body.messages?.[0]?.content || ''));
    return Response.json({ choices: [{ message: { content: systems.length === 1 ? '[[ويب: سنة تأسيس جيرلان]]' : 'جيرلان اتأسست سنة 1828.' } }] });
  }) as typeof fetch;
  const webGate = { fetch: async (body: unknown) => { asked.push(body); return { kind: 'search', answer: 'تأسست سنة 1828', sources: [{ title: 'guerlain.com', url: 'https://www.guerlain.com/', snippet: '' }], via: 'web', cached: false, at: 'now' }; } };
  const answer = await executeChat(validateChatRequest({ message: 'مين أسس دار جيرلان وإمتى؟', model: 'openai', language: 'ar' }),
    { env: { OPENAI_API_KEY: 'test', SHAM_LIVE_DATA: 'off' }, fetch: fetchMock, webGate: webGate as never });
  assert.match(systems[0]!, /عندك بحث جوجل/);
  assert.equal(asked.length, 1);
  assert.match(answer.reply, /1828/);
  assert.doesNotMatch(answer.reply, /\[\[ويب/);
  assert.match(answer.reply, /guerlain\.com/);
});

test('the exact live failure: the gate hands back encyclopedia pages for today\'s news → no archive links, an honest line', async () => {
  const { executeChat, validateChatRequest } = await import('../server/shaheen');
  const systems: string[] = [];
  const fetchMock = (async (_url: string | URL, init?: RequestInit) => {
    systems.push(JSON.stringify(JSON.parse(String(init!.body)).messages?.[0]?.content || ''));
    return Response.json({ choices: [{ message: { content: 'البحث على الإنترنت ماردّش دلوقتي، جرّب كمان شوية.' } }] });
  }) as typeof fetch;
  const webGate = { fetch: async () => ({ kind: 'search', sources: [{ title: 'انتفاضة البحرين 2011', url: 'https://ar.wikipedia.org/wiki/x', snippet: 'old' }], via: 'encyclopedia', cached: false, at: 'now' }) };
  const answer = await executeChat(validateChatRequest({ message: 'روح للنت وقولي اخبار النهارده', model: 'openai', language: 'ar' }),
    { env: { OPENAI_API_KEY: 'test', SHAM_LIVE_DATA: 'off' }, fetch: fetchMock, webGate: webGate as never });
  assert.doesNotMatch(answer.reply, /wikipedia|2011/);
  assert.ok(!answer.sources?.length);
  assert.match(systems[0]!, /مارجعش نتايج/);
  assert.doesNotMatch(systems[0]!, /البحرين 2011/);
});
