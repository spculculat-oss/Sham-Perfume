import assert from 'node:assert/strict';
import { once } from 'node:events';
import test, { type TestContext } from 'node:test';
import express from 'express';
import { createCalculatorTutorRouter } from '../server/calculatorTutor';
import { EngineHealth } from '../server/core/engineHealth';

async function route(t: TestContext, options: Parameters<typeof createCalculatorTutorRouter>[0] = {}) {
  const app = express();
  app.use(express.json({ limit: '6kb' }));
  app.use('/api/calculator', createCalculatorTutorRouter({ env: {}, ...options }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); }));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing test port');
  return (question: unknown, language = 'ar', angle = 'DEG') => fetch(`http://127.0.0.1:${address.port}/api/calculator/tutor`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, language, angle }),
  });
}
const story = 'A book costs 80. In the sale I take 15 percent off the original price. How do I start?';
const fakeConfig = { OPENAI_API_KEY: 'test-fixture-not-a-real-key' };
const responseFor = (content: string) => Response.json({ choices: [{ message: { content } }] });

test('tutor handles supported work without invoking engines, rejects private text and bounds public calls', async (t) => {
  let calls = 0;
  const post = await route(t, { env: {}, fetch: async () => { calls++; throw new Error('nothing must be uploaded'); } });
  const local = await post('حل س²-٥س+٦=٠');
  assert.equal(local.status, 200);
  assert.equal(local.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await local.json(), { kind: 'local', plan: { action: 'solve', math: 'x²-٥x+٦=٠' } });
  assert.deepEqual(await (await post(story)).json(), { kind: 'unavailable' });
  for (const value of ['student@example.org', 'https://example.org/worksheet', 'x'.repeat(1201), {}, '']) assert.equal((await post(value)).status, 400);
  for (let i = 0; i < 4; i++) assert.equal((await post('2+3')).status, 200);
  const stopped = await post(story);
  assert.equal(stopped.status, 429);
  assert.equal(stopped.headers.get('retry-after'), '60');
  assert.equal(calls, 0);
});

test('online tutor sends only the question and gives a proposal for explicit local calculation; no claim of a verified interpretation', async (t) => {
  const calls: RequestInit[] = [];
  const post = await route(t, { env: fakeConfig, fetch: async (_url, options) => {
    calls.push(options!);
    return responseFor('```json\n{"hint":"Start by subtracting the discount from the original price.","plan":{"action":"calculate","math":"80*(1-15%)"}}\n```');
  } });
  const local = await post('sin(pi/6)', 'en', 'RAD');
  assert.equal((await local.json()).kind, 'local');
  assert.equal(calls.length, 0);
  const reply = await post(story, 'en', 'RAD');
  assert.deepEqual(await reply.json(), { kind: 'suggestion', hint: 'Start by subtracting the discount from the original price.', plan: { action: 'calculate', math: '80*(1-15%)' } });
  assert.equal(calls.length, 1);
  const sent = JSON.parse(String(calls[0].body));
  assert.deepEqual(sent.messages.slice(1), [{ role: 'user', content: story }]);
  assert.match(sent.messages[0].content, /English[\s\S]*RAD/);
  assert.doesNotMatch(sent.messages[0].content, /\[object Promise\]/);
  assert.ok(calls[0].signal);
});

test('AI plans that cannot be validated are not returned; vendor names and malformed output fail closed', async (t) => {
  const contents = [
    JSON.stringify({ hint: 'Try writing the formula in one variable.', plan: { action: 'calculate', math: 'rand()' } }),
    JSON.stringify({ hint: 'I am Gemini.', plan: { action: 'calculate', math: '2+2' } }),
    JSON.stringify({ hint: 'أنا مبني على جيميني.' }),
    'not JSON at all',
  ];
  const post = await route(t, { env: fakeConfig, fetch: async () => responseFor(contents.shift()!) });
  assert.deepEqual(await (await post(story)).json(), { kind: 'suggestion', hint: 'Try writing the formula in one variable.' });
  assert.deepEqual(await (await post(story)).json(), { kind: 'unavailable' });
  assert.deepEqual(await (await post(story)).json(), { kind: 'unavailable' });
  assert.deepEqual(await (await post(story)).json(), { kind: 'unavailable' });
});

test('tutor parks exhausted engines and respects the owner off switch while leaving local work open', async (t) => {
  const health = new EngineHealth();
  let attempts = 0;
  const fetcher = async () => { attempts++; return Response.json({ error: { message: 'Retry in 60s.' } }, { status: 429 }); };
  const post = await route(t, { health, env: fakeConfig, fetch: fetcher });
  assert.deepEqual(await (await post(story)).json(), { kind: 'unavailable' });
  assert.ok(health.parkedUntil('openai'));
  assert.deepEqual(await (await post(story)).json(), { kind: 'unavailable' });
  assert.equal(attempts, 1);
  const off = await route(t, { env: { ...fakeConfig, SHAM_CALCULATOR_TUTOR: 'off' }, fetch: fetcher });
  assert.deepEqual(await (await off(story)).json(), { kind: 'unavailable' });
  assert.equal((await (await off('2*3')).json()).kind, 'local');
  assert.equal(attempts, 1);
});
