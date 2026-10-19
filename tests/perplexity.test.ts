import assert from 'node:assert/strict';
import { test } from 'node:test';
import { callEngine, engineStatuses, perplexityBody, perplexityText, PERPLEXITY_AGENT_URL } from '../server/core/engines';
import { SHAHEEN_ENGINES, SHAHEEN_SITE_SETTINGS } from '../server/config/shaheen';
import { configuredEngines } from '../scripts/doctor/agent';

const KEY = 'pplx-test-key-123';
const answer = (text: string) => ({
  id: 'resp_1', object: 'response', status: 'completed',
  output: [
    { type: 'search_results', results: [{ id: 1, url: 'https://example.org/a', title: 'A' }] },
    { type: 'message', role: 'assistant', content: [{ type: 'output_text', text, annotations: [] }] },
  ],
});

test('Perplexity is an engine only when its key exists, with the «fast» preset by default', () => {
  assert.equal(engineStatuses({}).find((e) => e.id === 'perplexity')?.configured, false);
  const on = engineStatuses({ PERPLEXITY_API_KEY: KEY }).find((e) => e.id === 'perplexity')!;
  assert.equal(on.configured, true);
  assert.equal(on.model, 'fast');
  assert.equal(engineStatuses({ PERPLEXITY_API_KEY: KEY, PERPLEXITY_PRESET: 'low' }).find((e) => e.id === 'perplexity')!.model, 'low');
  assert.equal(engineStatuses({ PERPLEXITY_API_KEY: 'YOUR_KEY' }).find((e) => e.id === 'perplexity')!.configured, false, 'placeholders do not count');
});

test('the request uses the Agent API (instructions + input items + max_output_tokens), not the retired Sonar shape', async () => {
  let seen: { url: string; headers: Record<string, string>; body: any } | undefined;
  const fake = (async (url: string | URL | Request, init?: RequestInit) => {
    seen = { url: String(url), headers: init?.headers as Record<string, string>, body: JSON.parse(String(init?.body)) };
    return new Response(JSON.stringify(answer('الفانيليا تعطي دفئاً [1][2] وتدوم طويلاً [3].')), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  let streamed = '';
  const reply = await callEngine('perplexity', 'You are Shaheen.', [{ role: 'user', text: 'ما دور الفانيليا؟' }],
    { env: { PERPLEXITY_API_KEY: KEY }, fetch: fake, signal: AbortSignal.timeout(5000), temperature: 0.3, maxTokens: 500, onToken: (t) => { streamed += t; } });
  assert.equal(seen?.url, PERPLEXITY_AGENT_URL);
  assert.equal(seen?.headers.Authorization, `Bearer ${KEY}`);
  assert.equal(seen?.body.preset, 'fast');
  assert.equal(seen?.body.instructions, 'You are Shaheen.');
  assert.deepEqual(seen?.body.input, [{ type: 'message', role: 'user', content: 'ما دور الفانيليا؟' }]);
  assert.equal(seen?.body.max_output_tokens, 500);
  assert.equal(seen?.body.messages, undefined, 'no Sonar messages array');
  assert.equal(reply, 'الفانيليا تعطي دفئاً وتدوم طويلاً.', 'citation markers are removed');
  assert.equal(streamed, reply, 'the caller still receives the answer');
});

test('an explicit model gets the web search tool; output_text is read when present; failures are classified', async () => {
  const body = perplexityBody('openai/gpt-5.6-luna', 'sys', [{ role: 'user', text: 'q' }], 0.2, 100);
  assert.equal(body.model, 'openai/gpt-5.6-luna');
  assert.deepEqual(body.tools, [{ type: 'web_search' }]);
  assert.equal(body.preset, undefined);
  assert.equal(perplexityText({ output_text: 'Hello [1]' }), 'Hello');
  assert.equal(perplexityText({ output: [] }), undefined);

  let failure = '';
  const denied = (async () => new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), { status: 401 })) as unknown as typeof fetch;
  const none = await callEngine('perplexity', 's', [{ role: 'user', text: 'q' }],
    { env: { PERPLEXITY_API_KEY: KEY }, fetch: denied, signal: AbortSignal.timeout(5000), temperature: 0, onFailure: (f) => { failure = f; } });
  assert.equal(none, undefined);
  assert.equal(failure, 'invalid_key');
});

test('Perplexity joins Shaheen, the robots and the council right after the free daily engine', async () => {
  assert.ok(SHAHEEN_ENGINES.includes('perplexity'));
  assert.equal(SHAHEEN_SITE_SETTINGS.engines[1], 'perplexity');
  assert.deepEqual(await configuredEngines({ GEMINI_API_KEY: 'g-key', PERPLEXITY_API_KEY: KEY, DEEPSEEK_API_KEY: 'd-key' }), ['gemini', 'perplexity', 'deepseek']);
  assert.deepEqual(await configuredEngines({ PERPLEXITY_API_KEY: KEY }), ['perplexity'], 'works alone too');
});
