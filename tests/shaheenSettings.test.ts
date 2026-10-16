import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import { SHAHEEN_SITE_SETTINGS, normalizeShaheen, ShaheenConfigError } from '../server/config/shaheen';
import { Repository, ValidationError } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { callEngine, classifyEngineFailure, failureDetail, geminiQuotaFallbacks, geminiThinking, pickGeminiModel, GEMINI_DEFAULT_MODEL } from '../server/core/engines';
import { createShaheenRouter, executeChat, getChatModels, probeEngines, systemInstruction } from '../server/shaheen';
import { compactTurn, chatHistory } from '../src/utils/chatStore';
import { isChatMessage, type ChatMessage } from '../src/utils/chatStorage';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const openAiReply = (text: string) => json({ choices: [{ message: { role: 'assistant', content: text } }] });
const repo = () => new Repository(new MemoryStore(), {});

test('Shaheen settings follow the shared file until the admin changes something', async () => {
  const r = repo();
  assert.deepEqual((await r.settings()).shaheen, SHAHEEN_SITE_SETTINGS);
  assert.equal(await r.shaheenSource(), 'file');

  // Saving other settings (or Shaheen unchanged) must not freeze a copy of the file defaults.
  await r.updateSettings({ temperature: 0.3, shaheen: { ...SHAHEEN_SITE_SETTINGS } });
  assert.equal(await r.shaheenSource(), 'file');

  const changed = await r.updateSettings({ shaheen: { ...SHAHEEN_SITE_SETTINGS, engines: ['openai', 'gemini'], temperature: 0.8,
    models: { openai: 'gpt-4.1-mini' }, instructions: '  اذكر بديلاً اقتصادياً  ' } });
  assert.deepEqual(changed.shaheen.engines, ['openai', 'gemini']);
  assert.equal(changed.shaheen.instructions, 'اذكر بديلاً اقتصادياً');
  assert.equal(await r.shaheenSource(), 'admin');
  assert.equal((await r.settings()).temperature, 0.3, 'other settings are kept');

  // Editing back to exactly the file values follows the file again; null resets explicitly.
  await r.updateSettings({ shaheen: { ...SHAHEEN_SITE_SETTINGS } });
  assert.equal(await r.shaheenSource(), 'file');
  await r.updateSettings({ shaheen: { ...SHAHEEN_SITE_SETTINGS, enabled: false } });
  assert.equal(await r.shaheenSource(), 'admin');
  await r.updateSettings({ shaheen: null } as never);
  assert.equal(await r.shaheenSource(), 'file');
  assert.equal((await r.settings()).shaheen.enabled, true);
});

test('invalid Shaheen settings are rejected with a clear validation error', async () => {
  const r = repo();
  for (const bad of [{ engines: ['sham_local'] }, { temperature: 3 }, { maxTokens: 50 },
    { models: { openai: 'bad model with spaces' } }, { instructions: 42 }]) {
    await assert.rejects(r.updateSettings({ shaheen: { ...SHAHEEN_SITE_SETTINGS, ...bad } as never }),
      (error: unknown) => error instanceof ValidationError && error.code === 'INVALID_SHAHEEN', JSON.stringify(bad));
  }
  assert.throws(() => normalizeShaheen('nope'), ShaheenConfigError);
  assert.equal(normalizeShaheen({ instructions: 'x'.repeat(2500) }).instructions.length, 2000);
  assert.deepEqual(normalizeShaheen({ engines: ['gemini', 'openai', 'gemini'] }).engines, ['gemini', 'openai'], 'duplicates are removed');
});

test('models list hides engines the admin did not allow and reflects per-engine models', () => {
  const env = { OPENAI_API_KEY: 'sk-test', GEMINI_API_KEY: 'g-test' };
  const settings = { ...SHAHEEN_SITE_SETTINGS, engines: ['openai' as const], models: { openai: 'gpt-4.1-mini' } };
  const models = getChatModels(env, settings);
  assert.deepEqual(models.map((m) => m.id), ['auto', 'openai']);
  assert.equal((models[1] as { model?: string }).model, 'gpt-4.1-mini');
  assert.equal(models[0].hasApiKey, true);
  assert.equal(getChatModels(env, { ...settings, enabled: false }).every((m) => !m.hasApiKey), true);
});

test('admin instructions are appended without replacing the safety rules', () => {
  const text = systemInstruction('ar', 'اقترح خامات متوفرة في مصر');
  assert.match(text, /لا تصف علاجات/);
  assert.match(text, /تعليمات إضافية من إدارة الموقع[\s\S]*اقترح خامات متوفرة في مصر/);
  assert.doesNotMatch(systemInstruction('ar', '   '), /تعليمات إضافية/);
});

test('executeChat uses the admin order, model, length and temperature, and honours allowVisitorChoice', async () => {
  const bodies: any[] = [];
  const fetch = (async (_url: string, init: RequestInit) => { bodies.push(JSON.parse(String(init.body))); return openAiReply('رد'); }) as typeof globalThis.fetch;
  const env = { OPENAI_API_KEY: 'sk-test', DEEPSEEK_API_KEY: 'ds-test' };
  const settings = { ...SHAHEEN_SITE_SETTINGS, engines: ['openai' as const, 'deepseek' as const], models: { openai: 'gpt-4.1-mini' },
    temperature: 0.2, maxTokens: 2048, instructions: 'كن مختصراً' };
  const result = await executeChat({ message: 'سؤال', model: 'auto', language: 'ar', conversationHistory: [] }, { env, fetch, settings });
  assert.equal(result.engine.provider, 'openai');
  assert.equal(result.engine.model, 'gpt-4.1-mini');
  assert.equal(bodies[0].model, 'gpt-4.1-mini');
  assert.equal(bodies[0].temperature, 0.2);
  assert.equal(bodies[0].max_tokens, 2048);
  assert.match(bodies[0].messages[0].content, /كن مختصراً/);

  // Visitor asks for DeepSeek, but the admin turned visitor choice off → auto order (OpenAI first).
  const forced = await executeChat({ message: 'سؤال', model: 'deepseek', language: 'ar', conversationHistory: [] },
    { env, fetch, settings: { ...settings, allowVisitorChoice: false } });
  assert.equal(forced.engine.provider, 'openai');
  // A disallowed engine cannot be reached even with a key.
  await assert.rejects(executeChat({ message: 'سؤال', model: 'gemini', language: 'ar', conversationHistory: [] },
    { env: { ...env, GEMINI_API_KEY: 'g' }, fetch, settings }), { code: 'PROVIDER_NOT_CONFIGURED' });
  await assert.rejects(executeChat({ message: 'سؤال', model: 'auto', language: 'ar', conversationHistory: [] },
    { env, fetch, settings: { ...settings, enabled: false } }), { status: 503, code: 'SHAHEEN_DISABLED' });
});

test('Gemini thinking is disabled or capped so it cannot eat the answer budget', () => {
  assert.deepEqual(geminiThinking('gemini-2.5-flash', 4096), { maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } });
  assert.deepEqual(geminiThinking('gemini-2.5-pro', 4096), { maxOutputTokens: 5120, thinkingConfig: { thinkingBudget: 128 } });
  assert.equal(geminiThinking('gemini-3-pro-preview', 1024).maxOutputTokens, 3072);
  assert.deepEqual(geminiThinking('gemini-2.0-flash', 1024), { maxOutputTokens: 1024 });
});

test('probeEngines reports each allowed engine honestly without leaking upstream details', async () => {
  const fetch = (async (url: string) => {
    if (String(url).includes('openai')) return openAiReply('OK');
    if (String(url).includes('deepseek')) return json({ error: { message: 'secret upstream detail' } }, 401);
    throw new Error('network down');
  }) as typeof globalThis.fetch;
  const settings = { ...SHAHEEN_SITE_SETTINGS, engines: ['openai' as const, 'deepseek' as const, 'claude' as const, 'self_hosted' as const] };
  const results = await probeEngines(settings, { env: { OPENAI_API_KEY: 'a', DEEPSEEK_API_KEY: 'b', ANTHROPIC_API_KEY: 'c' }, fetch });
  const byId = Object.fromEntries(results.map((r) => [r.id, r]));
  assert.equal(byId.openai.ok, true);
  assert.equal(byId.deepseek.ok, false);
  assert.equal(byId.deepseek.error, 'invalid_key');
  assert.equal(byId.claude.error, 'unreachable');
  assert.deepEqual({ ok: byId.self_hosted.ok, error: byId.self_hosted.error, configured: byId.self_hosted.configured },
    { ok: false, error: 'not_configured', configured: false });
  assert.doesNotMatch(JSON.stringify(results), /secret upstream detail/);
});

async function withRouter(env: Record<string, string>, r: Repository, run: (base: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  const fetch = (async () => openAiReply('رد من الخادم')) as typeof globalThis.fetch;
  app.use('/api', createShaheenRouter({ repo: r, env, fetch }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`); }
  finally { await new Promise((done) => server.close(done)); }
}
const post = (base: string, body: unknown) => fetch(`${base}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('router: admin settings reach visitors immediately, and visitors are rate limited', async () => {
  const r = repo();
  await withRouter({ OPENAI_API_KEY: 'sk-test', SHAM_SHAHEEN_RATE_PER_MIN: '3' }, r, async (base) => {
    let models = await (await fetch(`${base}/models`)).json();
    assert.equal(models.enabled, true);
    assert.deepEqual(models.models, [{ id: 'auto', hasApiKey: true }, { id: 'fast', hasApiKey: true }, { id: 'deep', hasApiKey: true },
      { id: 'council', hasApiKey: false }], 'one engine: no council, and no vendor names');
    assert.equal(models.allowVisitorChoice, true);

    await r.updateSettings({ shaheen: { ...SHAHEEN_SITE_SETTINGS, allowVisitorChoice: false } });
    models = await (await fetch(`${base}/models`)).json();
    assert.equal(models.allowVisitorChoice, false);

    const ok = await post(base, { message: 'مرحبا', model: 'deepseek' });
    assert.equal(ok.status, 200);
    const okBody = await ok.json();
    assert.equal(okBody.mode, 'auto', 'visitor choice is off → auto');
    assert.deepEqual(okBody.engine, { id: 'auto', provider: 'shaheen', name: 'الخبير شاهين', badge: 'شاهين', accentColor: 'amber' });
    assert.doesNotMatch(JSON.stringify(okBody), /openai|gpt|deepseek/i, 'visitors never learn which vendor answered');
    assert.equal((await post(base, { message: 'مرحبا' })).status, 200);

    await r.updateSettings({ shaheen: { ...SHAHEEN_SITE_SETTINGS, enabled: false } });
    const off = await post(base, { message: 'مرحبا' });
    assert.equal(off.status, 503);
    assert.equal((await off.json()).code, 'SHAHEEN_DISABLED');

    // Limit is 3 per minute (2 answered + 1 refused while off): the 4th message from the same visitor is refused.
    const limited = await post(base, { message: 'مرحبا' });
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).code, 'RATE_LIMITED');
    // Invalid input is rejected before counting/forwarding.
    assert.equal((await post(base, { message: '' })).status, 400);
  });
});

test('long replies are shortened in the history instead of wiping the conversation', () => {
  const formula = '```sham-formula\n{"title":"x"}\n```';
  const long = 'ا'.repeat(6000) + '\n' + formula;
  const short = compactTurn(long);
  assert.ok(short.length <= 4000);
  assert.ok(short.endsWith(formula), 'the transferable formula block is kept');
  assert.equal(compactTurn('قصير'), 'قصير');

  const messages: ChatMessage[] = [
    { id: 'welcome', role: 'assistant', text: 'أهلاً', timestamp: 't' },
    { id: 'user-1', role: 'user', text: 'صمم لي عطر', timestamp: 't' },
    { id: 'bot-1', role: 'assistant', text: long, timestamp: 't' },
    { id: 'bot-err-1', role: 'assistant', kind: 'error', text: 'خطأ', timestamp: 't' },
    { id: 'user-2', role: 'user', text: 'خليها 100 مل', timestamp: 't' },
  ];
  const history = chatHistory(messages);
  assert.deepEqual(history.map((h) => h.role), ['user', 'assistant', 'user']);
  assert.equal(history[0].text, 'صمم لي عطر');
});

test('replies from the newer engines are accepted and saved', () => {
  for (const provider of ['self_hosted', 'openrouter', 'gemini'] as const) {
    assert.equal(isChatMessage({ id: 'bot-1', role: 'assistant', text: 'رد', timestamp: 't',
      aiEngine: { id: provider, provider, name: 'x', badge: 'x', model: 'm' } }), true, provider);
  }
  assert.equal(isChatMessage({ id: 'bot-1', role: 'assistant', text: 'رد', timestamp: 't',
    aiEngine: { id: 'x', provider: 'unknown', name: 'x', badge: 'x' } }), false);
});

test('provider refusals are classified into fixed codes (no upstream text)', () => {
  const cases: [number, unknown, string][] = [
    [400, { error: { code: 400, status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } }, 'invalid_key'],
    [400, { error: { status: 'FAILED_PRECONDITION', message: 'User location is not supported for the API use.' } }, 'region_blocked'],
    [429, { error: { status: 'RESOURCE_EXHAUSTED' } }, 'rate_limited'],
    [429, { error: { code: 'insufficient_quota', type: 'insufficient_quota' } }, 'no_credit'],
    [401, { error: { code: 'invalid_api_key' } }, 'invalid_key'],
    [404, { error: { code: 'model_not_found' } }, 'model_not_found'],
    [400, { type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } }, 'no_credit'],
    [402, { error: { message: 'Insufficient Balance' } }, 'no_credit'],
    [529, { type: 'error', error: { type: 'overloaded_error' } }, 'upstream_error'],
    [400, 'not json', 'bad_request'],
  ];
  for (const [status, body, expected] of cases) {
    assert.equal(classifyEngineFailure(status, typeof body === 'string' ? body : JSON.stringify(body)), expected, JSON.stringify(body));
  }
});

test('Gemini: picks the best chat model the key can actually use', () => {
  const m = (name: string, gen = true) => ({ name: `models/${name}`, supportedGenerationMethods: gen ? ['generateContent'] : ['embedContent'] });
  assert.equal(pickGeminiModel([m('gemini-3.5-flash'), m('gemini-flash-latest'), m('gemini-4-pro')]), 'gemini-flash-latest');
  assert.equal(pickGeminiModel([m('gemini-3-flash-preview'), m('gemini-3.5-flash'), m('gemini-3.1-flash-lite'), m('gemini-3.5-flash-image'), m('text-embedding-004', false)]), 'gemini-3.5-flash');
  assert.equal(pickGeminiModel([m('gemini-3.1-flash-lite'), m('gemini-3-flash-preview')]), 'gemini-3.1-flash-lite');
  assert.equal(pickGeminiModel([m('gemini-embedding-001', false)]), undefined);
  assert.equal(GEMINI_DEFAULT_MODEL, 'gemini-flash-latest');
});

test('Gemini: a retired model is replaced automatically and remembered', async () => {
  const calls: string[] = [];
  const fetch = (async (url: string) => {
    calls.push(String(url).replace('https://generativelanguage.googleapis.com/v1beta/', ''));
    if (String(url).includes('/models?')) {
      return json({ models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3.5-flash', supportedGenerationMethods: ['generateContent'] }] });
    }
    if (String(url).includes('gemini-2.5-flash:')) return json({ error: { code: 404, status: 'NOT_FOUND' } }, 404);
    return json({ candidates: [{ content: { parts: [{ text: 'أهلاً' }] } }] });
  }) as typeof globalThis.fetch;
  const opts = { env: { GEMINI_API_KEY: 'retired-model-key' }, fetch, signal: AbortSignal.timeout(5000), temperature: 0.5, model: 'gemini-2.5-flash' };
  assert.equal(await callEngine('gemini', 'sys', [{ role: 'user', text: 'hi' }], opts), 'أهلاً');
  assert.deepEqual(calls, ['models/gemini-2.5-flash:generateContent', 'models?pageSize=1000', 'models/gemini-3.5-flash:generateContent']);
  calls.length = 0;
  assert.equal(await callEngine('gemini', 'sys', [{ role: 'user', text: 'hi' }], opts), 'أهلاً');
  assert.deepEqual(calls, ['models/gemini-3.5-flash:generateContent']);
});

const QUOTA_429 = { error: { code: 429, status: 'RESOURCE_EXHAUSTED',
  message: 'You exceeded your current quota, please check your plan and billing details. key=AIzaSyFAKEFAKEFAKEFAKE',
  details: [
    { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests', quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', quotaValue: '20' }] },
    { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '41s' },
  ] } };

test('Gemini: quota fallbacks try Lite first and never the model that failed', () => {
  const m = (name: string) => ({ name: `models/${name}`, supportedGenerationMethods: ['generateContent'] });
  assert.deepEqual(geminiQuotaFallbacks([m('gemini-flash-latest'), m('gemini-3.5-flash'), m('gemini-flash-lite-latest'), m('gemini-3.1-flash-lite'), m('gemini-3-flash-preview')], 'gemini-flash-latest'),
    ['gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-3.5-flash']);
});

test('Gemini: an exhausted model quota switches to another model for an hour, and reports the reason', async () => {
  const calls: string[] = [];
  const fetch = (async (url: string) => {
    calls.push(String(url).replace('https://generativelanguage.googleapis.com/v1beta/', ''));
    if (String(url).includes('/models?')) {
      return json({ models: ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-flash-lite-latest'].map((n) => ({ name: `models/${n}`, supportedGenerationMethods: ['generateContent'] })) });
    }
    if (String(url).includes('gemini-flash-latest:')) return json(QUOTA_429, 429);
    return json({ candidates: [{ content: { parts: [{ text: 'تمام' }] } }] });
  }) as typeof globalThis.fetch;
  let used = '';
  const opts = { env: { GEMINI_API_KEY: 'quota-key' }, fetch, signal: AbortSignal.timeout(5000), temperature: 0.5, onModel: (m: string) => { used = m; } };
  assert.equal(await callEngine('gemini', 'sys', [{ role: 'user', text: 'hi' }], opts), 'تمام');
  assert.deepEqual(calls, ['models/gemini-flash-latest:generateContent', 'models?pageSize=1000', 'models/gemini-flash-lite-latest:generateContent']);
  assert.equal(used, 'gemini-flash-lite-latest');
  calls.length = 0;
  assert.equal(await callEngine('gemini', 'sys', [{ role: 'user', text: 'hi' }], opts), 'تمام');
  assert.deepEqual(calls, ['models/gemini-flash-lite-latest:generateContent'], 'remembered: no wasted call on the exhausted model');

  // Every model exhausted: the failure carries Google's reason without the key.
  let failure = ''; let detail = '';
  const allOut = (async (url: string) => String(url).includes('/models?')
    ? json({ models: [{ name: 'models/gemini-flash-lite-latest', supportedGenerationMethods: ['generateContent'] }] })
    : json(QUOTA_429, 429)) as typeof globalThis.fetch;
  assert.equal(await callEngine('gemini', 'sys', [{ role: 'user', text: 'hi' }], { env: { GEMINI_API_KEY: 'dead-quota-key' }, fetch: allOut,
    signal: AbortSignal.timeout(5000), temperature: 0.5, onFailure: (f, _s, d) => { failure = f; detail = d; } }), undefined);
  assert.equal(failure, 'no_credit');
  assert.match(detail, /GenerateRequestsPerDayPerProjectPerModel-FreeTier limit 20/);
  assert.match(detail, /retry in 41s/);
  assert.doesNotMatch(detail, /AIza/);
  assert.equal(failureDetail('not json'), '');
});

test('Gemini: a model overloaded by Google (503 UNAVAILABLE) hands the question to another model for 10 minutes', async () => {
  const calls: string[] = [];
  const fetch = (async (url: string) => {
    calls.push(String(url).replace('https://generativelanguage.googleapis.com/v1beta/', ''));
    if (String(url).includes('/models?')) {
      return json({ models: ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-flash-lite-latest'].map((n) => ({ name: `models/${n}`, supportedGenerationMethods: ['generateContent'] })) });
    }
    if (String(url).includes('gemini-flash-latest:')) return json({ error: { code: 503, status: 'UNAVAILABLE', message: 'This model is currently experiencing high demand.' } }, 503);
    return json({ candidates: [{ content: { parts: [{ text: 'المنظف يحتاج عطراً مقاوماً للقلويات' }] } }] });
  }) as typeof globalThis.fetch;
  let used = '';
  const opts = { env: { GEMINI_API_KEY: 'overloaded-key' }, fetch, signal: AbortSignal.timeout(5000), temperature: 0.5, onModel: (m: string) => { used = m; } };
  assert.match(await callEngine('gemini', 'sys', [{ role: 'user', text: 'عطر لمنظف' }], opts) || '', /المنظف/);
  assert.deepEqual(calls, ['models/gemini-flash-latest:generateContent', 'models?pageSize=1000', 'models/gemini-flash-lite-latest:generateContent']);
  assert.equal(used, 'gemini-flash-lite-latest');
  calls.length = 0;
  await callEngine('gemini', 'sys', [{ role: 'user', text: 'hi' }], opts);
  assert.deepEqual(calls, ['models/gemini-flash-lite-latest:generateContent'], 'remembered while Google is overloaded');

  // Every model overloaded: still a clean failure for the failover chain.
  let failure = '';
  const allDown = (async (url: string) => String(url).includes('/models?')
    ? json({ models: [{ name: 'models/gemini-flash-lite-latest', supportedGenerationMethods: ['generateContent'] }] })
    : json({ error: { code: 503, status: 'UNAVAILABLE' } }, 503)) as typeof globalThis.fetch;
  assert.equal(await callEngine('gemini', 'sys', [{ role: 'user', text: 'hi' }], { env: { GEMINI_API_KEY: 'all-down-key' }, fetch: allDown,
    signal: AbortSignal.timeout(5000), temperature: 0.5, onFailure: (f) => { failure = f; } }), undefined);
  assert.equal(failure, 'upstream_error');
});
