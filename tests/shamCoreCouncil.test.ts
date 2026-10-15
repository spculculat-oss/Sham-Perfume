/**
 * Advisory council — several models give independent opinions, review each other anonymously,
 * then a chair writes one consultative reply. Providers are faked with an injected fetch.
 */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import { createShamCore } from '../server/core/http';
import { Repository, ValidationError } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { AssistantError, Orchestrator, validateChatInput, type StreamEvent } from '../server/core/orchestrator';
import { CouncilConfigError, defaultCouncil, normalizeCouncil, shouldConvene } from '../server/core/council';
import type { CouncilSettings } from '../server/core/types';

const visitor = 'visitor-council-01';
const ENV = { SHAM_LLM_BASE_URL: 'http://llm.test/v1', SHAM_LLM_MODEL: 'main' };
const QUESTION = 'ازاي أركّب عطر عود ثابت؟';

const seats = (over: Partial<CouncilSettings> = {}): CouncilSettings => ({
  ...defaultCouncil(),
  members: [
    { id: 'seat-a', engine: 'self_hosted', model: 'model-a', role: 'formulator', enabled: true },
    { id: 'seat-b', engine: 'self_hosted', model: 'model-b', role: 'commercial', enabled: true },
    { id: 'seat-c', engine: 'self_hosted', model: 'model-c', role: 'safety', enabled: true },
    { id: 'seat-g', engine: 'gemini', role: 'customer', enabled: true }, // no key → skipped
  ],
  ...over,
});

interface Call { model: string; kind: 'opinion' | 'review' | 'chair' | 'single'; system: string; user: string; stream: boolean }

/** Fake OpenAI-compatible server. `fail` = models that return 503 (optionally only for one kind). */
function fakeLlm(opts: { fail?: (c: Call) => boolean; chairPartialThenFail?: string } = {}) {
  const calls: Call[] = [];
  const fakeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    const system: string = body.messages[0].content;
    const user: string = body.messages.at(-1).content;
    const kind: Call['kind'] = /PEER REVIEW/.test(system) ? 'review' : /You chair/.test(system) ? 'chair' : /advisory council/.test(system) ? 'opinion' : 'single';
    const call = { model: body.model, kind, system, user, stream: Boolean(body.stream) };
    calls.push(call);
    if (opts.fail?.(call)) return new Response('down', { status: 503 });
    const text = kind === 'opinion' ? `رأي ${body.model}: ابدأ بعينة 10 مل.` : kind === 'review' ? `مراجعة ${body.model}: Revised position: موافق.` : kind === 'chair' ? 'الخلاصة\nابدأ بعينة صغيرة.' : 'رد عادي';
    if (body.stream) {
      const encoder = new TextEncoder();
      const partial = kind === 'chair' && opts.chairPartialThenFail === body.model;
      const chunks = text.split(' ').map((piece) => `data: ${JSON.stringify({ choices: [{ delta: { content: `${piece} ` } }] })}\n\n`);
      let i = 0;
      const stream = new ReadableStream<Uint8Array>({
        pull(c) {
          if (i < chunks.length) { c.enqueue(encoder.encode(chunks[i++])); return; }
          if (partial) { c.error(new Error('connection dropped')); return; }
          c.enqueue(encoder.encode('data: [DONE]\n\n')); c.close();
        },
      });
      return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    }
    return Response.json({ choices: [{ message: { content: text } }] });
  }) as typeof globalThis.fetch;
  return { fetch: fakeFetch, calls };
}

async function setup(council: CouncilSettings, llm = fakeLlm(), env: Record<string, string> = ENV) {
  const repo = new Repository(new MemoryStore(), {});
  await repo.updateSettings({ council });
  return { repo, llm, bot: new Orchestrator(repo, { env, fetch: llm.fetch, seatTimeoutMs: 2000 }) };
}

test('council settings are validated (engines, roles, model ids, rounds, chair) and old settings get defaults', async () => {
  assert.throws(() => normalizeCouncil({ members: [{ engine: 'bard', role: 'general' }] }), CouncilConfigError);
  assert.throws(() => normalizeCouncil({ members: [{ engine: 'openai', role: 'ceo' }] }), CouncilConfigError);
  assert.throws(() => normalizeCouncil({ members: [{ engine: 'openai', role: 'general', model: 'a b; rm -rf' }] }), CouncilConfigError);
  assert.throws(() => normalizeCouncil({ rounds: 3 }), CouncilConfigError);
  assert.throws(() => normalizeCouncil({ chair: 'seat-nobody' }), CouncilConfigError);
  assert.throws(() => normalizeCouncil({ intents: ['track_order'] }), CouncilConfigError);
  const ok = normalizeCouncil({ members: [{ id: 'x-1', engine: 'openrouter', model: 'anthropic/claude-sonnet-4.5', role: 'safety' }, { id: 'x-1', engine: 'gemini', role: 'general' }], chair: 'x-1' });
  assert.equal(ok.members.length, 2);
  assert.notEqual(ok.members[0].id, ok.members[1].id, 'duplicate seat ids are renamed');

  const repo = new Repository(new MemoryStore(), {});
  await assert.rejects(repo.updateSettings({ council: { rounds: 9 } as unknown as CouncilSettings }), (e: unknown) => e instanceof ValidationError && e.code === 'INVALID_COUNCIL');
  const store = new MemoryStore();
  const legacy = new Repository(store, {});
  const current = await legacy.settings();
  const { council: _drop, ...old } = current as typeof current & { id: string };
  await store.put('settings', 'core', { ...old, id: 'core' } as never);
  assert.deepEqual((await legacy.settings()).council, defaultCouncil(), 'settings saved before the council existed still work');
});

test('the council only convenes with two configured seats, for allowed intents, automatically or on request', () => {
  const council = seats({ intents: ['perfume_expert'] });
  assert.equal(shouldConvene(council, 'perfume_expert', false, {}), false, 'no provider configured');
  assert.equal(shouldConvene(council, 'perfume_expert', false, ENV), true);
  assert.equal(shouldConvene(council, 'question', false, ENV), false, 'not an automatic intent');
  assert.equal(shouldConvene(council, 'question', true, ENV), true, 'visitor asked for it');
  assert.equal(shouldConvene(council, 'track_order', true, ENV), false, 'never for tracking/privacy/calculations');
  assert.equal(shouldConvene({ ...council, enabled: false }, 'perfume_expert', true, ENV), false);
  const one = seats({ members: [council.members[0], council.members[3]] });
  assert.equal(shouldConvene(one, 'perfume_expert', true, ENV), false, 'one voice is not a council');
  assert.throws(() => validateChatInput({ message: 'x', visitorId: visitor, consult: 'yes' }), AssistantError);
  assert.equal(validateChatInput({ message: 'x', visitorId: visitor, consult: true }).consult, true);
});

test('opinions → anonymous peer review → chair synthesis, streamed, stored, and shown with the discussion', async () => {
  const { bot, llm, repo } = await setup(seats());
  const events: StreamEvent[] = [];
  const out = await bot.chat({ message: QUESTION, visitorId: visitor, language: 'ar' }, { onEvent: (e) => events.push(e) });

  const kinds = llm.calls.map((c) => c.kind);
  assert.deepEqual(kinds, ['opinion', 'opinion', 'opinion', 'review', 'review', 'review', 'chair'], 'opinions in parallel, one review round, one chair');
  assert.deepEqual(llm.calls.slice(0, 3).map((c) => c.model).sort(), ['model-a', 'model-b', 'model-c'], 'per-seat model override reaches the provider');
  for (const c of llm.calls.filter((x) => x.kind !== 'opinion')) {
    assert.ok(!/model-[abc]/.test(c.user.replace(/(رأي|مراجعة) model-[abc]/g, '')), 'reviews and the chair see letters, not model names');
    assert.ok(/Position [A-C]|Advisor [A-C]/.test(c.user));
  }
  const review = llm.calls.find((c) => c.kind === 'review')!;
  assert.ok(!review.user.includes(`### Position ${/seat ([A-C])/.exec(review.system)![1]} `), 'a seat does not review itself as "other"');
  assert.ok(llm.calls.every((c) => c.system.includes('ONLY from CONTEXT')), 'every seat gets the grounding rules');
  assert.ok(llm.calls.find((c) => c.kind === 'chair')!.stream, 'the chair streams to the visitor');

  assert.equal(out.engine.id, 'self_hosted');
  assert.match(out.reply, /الخلاصة/);
  const streamed = events.reduce((acc, e) => (e.type === 'reset' ? '' : e.type === 'delta' ? acc + e.text : acc), '');
  assert.equal(streamed.trim(), out.reply);
  assert.ok(out.steps.some((s) => s.stage === 'council' && s.label.includes('المجلس')));
  assert.equal(out.council?.outcome, 'synthesis');
  assert.equal(out.council?.entries.length, 3);
  assert.equal(out.council?.entries.filter((e) => e.chair).length, 1);
  assert.ok(out.council?.entries.every((e) => e.reviews.length === 1 && e.opinion));
  assert.ok(!JSON.stringify(out.council).includes('seat-a'), 'no internal seat ids for visitors');

  const stored = (await repo.conversation(out.conversationId))!.messages.at(-1)!;
  assert.equal(stored.council?.entries.length, 3);
  assert.ok(stored.trace?.some((t) => t.stage === 'council' && t.detail.startsWith('synthesis')));
});

test('a failing seat is skipped, a failing chair hands over (with reset), and rounds=0 skips the debate', async () => {
  const llm = fakeLlm({ fail: (c) => c.model === 'model-b', chairPartialThenFail: 'model-a' });
  const { bot } = await setup(seats({ chair: 'seat-a', rounds: 0 }), llm);
  const events: StreamEvent[] = [];
  const out = await bot.chat({ message: QUESTION, visitorId: visitor, language: 'ar' }, { onEvent: (e) => events.push(e) });
  assert.equal(llm.calls.filter((c) => c.kind === 'review').length, 0);
  assert.deepEqual(llm.calls.filter((c) => c.kind === 'chair').map((c) => c.model), ['model-a', 'model-c']);
  assert.ok(events.some((e) => e.type === 'reset'), 'partial text of the failed chair is discarded');
  assert.equal(out.council?.entries.length, 2);
  assert.equal(out.council?.entries.find((e) => e.chair)?.label, 'C');
  const streamed = events.reduce((acc, e) => (e.type === 'reset' ? '' : e.type === 'delta' ? acc + e.text : acc), '');
  assert.equal(streamed.trim(), out.reply);
});

test('if every seat fails the normal engine policy answers, and the rate-limit gate can skip the council', async () => {
  const llm = fakeLlm({ fail: (c) => c.kind !== 'single' });
  const { bot } = await setup(seats(), llm);
  const out = await bot.chat({ message: QUESTION, visitorId: visitor, language: 'ar' });
  assert.equal(out.reply, 'رد عادي');
  assert.equal(out.council?.outcome, 'failed');

  const gated = await setup(seats());
  const skipped = await gated.bot.chat({ message: QUESTION, visitorId: visitor, language: 'ar' }, { councilGate: () => false });
  assert.equal(skipped.council, undefined);
  assert.ok(gated.llm.calls.every((c) => c.kind === 'single'));
});

test('stop during the council keeps only what the visitor saw and never calls the chair', async () => {
  const controller = new AbortController();
  const llm = fakeLlm();
  const slow = (async (url: string | URL | Request, init?: RequestInit) => {
    controller.abort();
    await new Promise((r) => setTimeout(r, 5));
    if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    return llm.fetch(url, init);
  }) as typeof fetch;
  const repo = new Repository(new MemoryStore(), {});
  await repo.updateSettings({ council: seats() });
  const bot = new Orchestrator(repo, { env: ENV, fetch: slow });
  const out = await bot.chat({ message: QUESTION, visitorId: visitor, language: 'ar' }, { signal: controller.signal, onEvent: () => undefined });
  assert.ok(!llm.calls.some((c) => c.kind === 'chair'));
  const stored = (await repo.conversation(out.conversationId))!.messages.at(-1)!;
  assert.equal(stored.stopped, true);
});

test('HTTP: config advertises the council, visitors see the discussion only when the admin allows it', async () => {
  const llm = fakeLlm();
  const core = createShamCore({ env: { ...ENV, SHAM_ADMIN_TOKEN: 'admin-token-123' }, fetch: llm.fetch });
  const app = express().use(express.json()).use('/api/assistant', core.assistant).use('/api/admin', core.admin);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const admin = { authorization: 'Bearer admin-token-123', 'content-type': 'application/json' };
  try {
    await fetch(`${base}/api/admin/settings`, { method: 'PUT', headers: admin, body: JSON.stringify({ council: seats({ showDiscussion: false }) }) });
    const config = await (await fetch(`${base}/api/assistant/config`)).json();
    assert.deepEqual(config.council, { available: true, seats: 3, auto: ['perfume_expert'], showDiscussion: false });

    const chat = await (await fetch(`${base}/api/assistant/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'سؤال عام عن الشحن', visitorId: visitor, consult: true }) })).json();
    assert.equal(chat.council, undefined, 'hidden from visitors');
    assert.match(chat.reply, /الخلاصة/, 'but the council still answered (explicit consult)');
    const history = await (await fetch(`${base}/api/assistant/conversations/${chat.conversationId}?visitorId=${visitor}`)).json();
    assert.equal(history.messages.at(-1).council, undefined);
    const full = await (await fetch(`${base}/api/admin/conversations/${chat.conversationId}`, { headers: admin })).json();
    assert.equal(full.item.messages.at(-1).council.entries.length, 3, 'admins always see the full transcript');

    await fetch(`${base}/api/admin/settings`, { method: 'PUT', headers: admin, body: JSON.stringify({ council: { showDiscussion: true } }) });
    const again = await (await fetch(`${base}/api/assistant/conversations/${chat.conversationId}?visitorId=${visitor}`)).json();
    assert.equal(again.messages.at(-1).council.entries.length, 3);
    const bad = await fetch(`${base}/api/admin/settings`, { method: 'PUT', headers: admin, body: JSON.stringify({ council: { members: [{ engine: 'x', role: 'general' }] } }) });
    assert.equal(bad.status, 400);
  } finally {
    server.close();
  }
});
