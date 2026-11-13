/**
 * Phase 2 — behaviours reverse-engineered from AI chat apps: streaming, live steps, follow-up
 * suggestions, feedback → knowledge gaps, cross-chat memory with view/forget, the admin
 * operations agent, and signed webhooks.
 */
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import { createShamCore } from '../server/core/http';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { Orchestrator, type StreamEvent } from '../server/core/orchestrator';
import { ThinkFilter } from '../server/core/engines';
import { route } from '../server/core/router';
import { defaultServices } from '../server/core/seed';
import { planAdminTasks, runAdminAgent } from '../server/core/adminAgent';
import { createNotifier } from '../server/core/notify';

const visitor = 'visitor-live-0001';
const freshRepo = () => new Repository(new MemoryStore(), { SHAM_SEED_DEMO: 'true' });
const sseResponse = (chunks: string[]) => {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({ start(c) { for (const chunk of chunks) c.enqueue(encoder.encode(chunk)); c.close(); } });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
};

test('ThinkFilter hides reasoning blocks even when tags are split across chunks', () => {
  const filter = new ThinkFilter();
  const out = ['مرح', 'با <thi', 'nk>سر داخلي', '</th', 'ink> بك', ' في شام'].map((c) => filter.push(c)).join('') + filter.flush();
  assert.equal(out, 'مرحبا  بك في شام');
  const plain = new ThinkFilter();
  assert.equal(plain.push('a < b') + plain.flush(), 'a < b');
});

test('router recognises privacy intents (memory view / forget) before anything else', () => {
  const services = defaultServices();
  assert.equal(route('ماذا تعرف عني؟', services).intent, 'memory_view');
  assert.equal(route('What do you remember about me', services).intent, 'memory_view');
  assert.equal(route('امسح بياناتي من فضلك', services).intent, 'forget');
  assert.equal(route('forget me', services).intent, 'forget');
});

test('chat emits live steps and token deltas that add up to the final reply, plus suggestions', async () => {
  const bot = new Orchestrator(freshRepo(), { env: {} });
  const events: StreamEvent[] = [];
  const out = await bot.chat({ message: 'يعني ايه تعتيق العطر؟', visitorId: visitor, language: 'ar' }, { onEvent: (e) => events.push(e) });
  const steps = events.filter((e) => e.type === 'step');
  assert.ok(steps.length >= 3, 'understand → search → write');
  const text = events.reduce((acc, e) => (e.type === 'reset' ? '' : e.type === 'delta' ? acc + e.text : acc), '');
  assert.equal(text, out.reply);
  assert.equal(events.at(-1)?.type, 'done');
  assert.ok(out.messageId && out.steps.length === steps.length);
  assert.ok(out.suggestions.length > 0 && out.suggestions.length <= 4);
  assert.ok(!JSON.stringify(out.steps).includes('kb-'), 'public steps never leak internal ids/trace');
});

test('OpenAI-compatible engines stream tokens over SSE and <think> never reaches the visitor', async () => {
  const repo = freshRepo();
  const fetchMock = (async (_url: string | URL, init?: RequestInit) => {
    assert.equal(JSON.parse(String(init?.body)).stream, true);
    return sseResponse([
      'data: {"choices":[{"delta":{"content":"<think>plan"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"</think>التعتيق "}}]}\n\ndata: {"choices":[{"delta":{"content":"يعني ترك العطر"}}]}\n\n',
      'data: [DONE]\n\n',
    ]);
  }) as typeof fetch;
  const bot = new Orchestrator(repo, { env: { SHAM_LLM_BASE_URL: 'http://llm.internal:11434/v1' }, fetch: fetchMock });
  const deltas: string[] = [];
  const out = await bot.chat({ message: 'يعني ايه تعتيق العطر؟', visitorId: visitor, language: 'ar' }, { onEvent: (e) => { if (e.type === 'delta') deltas.push(e.text); } });
  assert.equal(out.engine.id, 'sham_ai');
  assert.equal(out.reply, 'التعتيق يعني ترك العطر');
  assert.ok(deltas.length >= 2, 'tokens arrive incrementally');
  assert.ok(!deltas.join('').includes('plan'));
});

test('memory follows the visitor to a new chat, can be viewed, and is erased on request', async () => {
  const repo = freshRepo();
  const bot = new Orchestrator(repo, { env: {} });
  const first = await bot.chat({ message: 'اسمي منى', visitorId: visitor, language: 'ar' });
  const second = await bot.chat({ message: 'ماذا تعرف عني؟', visitorId: visitor, language: 'ar' });
  assert.notEqual(second.conversationId, first.conversationId);
  const card = second.actions.find((a) => a.type === 'privacy');
  assert.equal(card?.memory?.name, 'منى');
  assert.match(second.reply, /منى/);

  const deleted = await repo.deleteVisitorData(visitor);
  assert.equal(deleted.conversations, 2);
  assert.equal(await repo.visitor(visitor), undefined);
  assert.equal(await repo.conversation(first.conversationId), undefined);
  const fresh = await bot.chat({ message: 'ماذا تعرف عني؟', visitorId: visitor, language: 'ar' });
  assert.equal(fresh.actions.find((a) => a.type === 'privacy')?.memory?.name, undefined);
});

test('learning loop: unanswered + 👎 answers become gaps; resolving one teaches the assistant', async () => {
  const repo = freshRepo();
  const bot = new Orchestrator(repo, { env: {} });
  const q = 'هل فرعكم مفتوح يوم الجمعة؟';
  const a = await bot.chat({ message: q, visitorId: visitor, language: 'ar' });
  await bot.chat({ message: q, visitorId: 'visitor-live-0002', language: 'ar' });
  let gaps = await repo.gaps();
  assert.equal(gaps.length, 1, 'same question is de-duplicated');
  assert.equal(gaps[0].count, 2);
  assert.equal(gaps[0].source, 'no_answer');

  const rated = await bot.chat({ message: 'يعني ايه تعتيق العطر؟', visitorId: visitor, conversationId: a.conversationId, language: 'ar' });
  await assert.rejects(repo.setFeedback({ conversationId: a.conversationId, visitorId: 'visitor-intruder-9', messageId: rated.messageId, rating: 'down' }));
  await repo.setFeedback({ conversationId: a.conversationId, visitorId: visitor, messageId: rated.messageId, rating: 'down', reason: 'مش واضح' });
  gaps = await repo.gaps();
  assert.ok(gaps.some((g) => g.source === 'negative_feedback' && g.reason === 'مش واضح'));

  const gap = gaps.find((g) => g.source === 'no_answer')!;
  const resolved = await repo.resolveGap(gap.id, { title: 'مواعيد الفرع يوم الجمعة', content: 'نعم، فرع شام مفتوح يوم الجمعة من 2 ظهراً حتى 11 مساءً.' });
  assert.equal(resolved.status, 'resolved');
  const doc = (await repo.knowledge()).find((d) => d.id === resolved.resolvedDocId);
  assert.ok(doc?.tags.includes('from-gap'));
  const after = await bot.chat({ message: q, visitorId: visitor, language: 'ar' });
  assert.ok(after.citations.some((c) => c.id === doc!.id), 'the new document is retrieved and cited');
});

test('admin agent plans only the relevant tools and reports actionable sections', async () => {
  assert.deepEqual(planAdminTasks('المخزون اللي قرب يخلص'), ['low_stock']);
  assert.equal(planAdminTasks('تقرير اليوم').length, 7);
  const repo = freshRepo();
  await repo.updateSettings({ enginePolicy: ['sham_local'] });
  const result = await runAdminAgent(repo, 'تقرير اليوم', { env: {} });
  assert.equal(result.plan.length, 7);
  assert.ok(result.plan.every((s) => s.status === 'done'));
  assert.equal(result.sections.length, 7);
  assert.equal(result.engine, 'sham_local');
  assert.ok(result.summary.length > 10);
});

test('webhooks are signed with HMAC-SHA256 and never throw', async () => {
  let seen: { url: string; headers: Record<string, string>; body: string } | undefined;
  const notifier = createNotifier({ SHAM_WEBHOOK_URL: 'https://hooks.example.com/sham', SHAM_WEBHOOK_SECRET: 's3cret' }, (async (url: string | URL, init?: RequestInit) => {
    seen = { url: String(url), headers: init?.headers as Record<string, string>, body: String(init?.body) };
    return new Response('ok');
  }) as typeof fetch);
  assert.equal(await notifier.send('request.created', 'طلب جديد', { ref: 'SH-ABC234' }), true);
  assert.equal(seen?.headers['X-Sham-Event'], 'request.created');
  assert.equal(seen?.headers['X-Sham-Signature'], `sha256=${createHmac('sha256', 's3cret').update(seen!.body).digest('hex')}`);
  assert.equal(JSON.parse(seen!.body).data.ref, 'SH-ABC234');

  assert.equal(createNotifier({ SHAM_WEBHOOK_URL: 'http://evil.example.com/' }).configured, false, 'plain http only for localhost');
  const broken = createNotifier({ SHAM_WEBHOOK_URL: 'https://hooks.example.com/' }, (async () => { throw new Error('down'); }) as typeof fetch);
  assert.equal(await broken.send('test', 'x', {}), false);
});

test('HTTP: SSE stream, feedback, privacy endpoints and admin quality/agent APIs', async () => {
  const core = createShamCore({ env: { SHAM_STORE: 'memory', SHAM_SEED_DEMO: 'true', SHAM_ADMIN_TOKEN: 'correct-horse-battery' } });
  const app = express();
  app.use(express.json());
  app.use('/api/assistant', core.assistant);
  app.use('/api/admin', core.admin);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const jsonHeaders = { 'content-type': 'application/json' };
  const auth = { Authorization: 'Bearer correct-horse-battery', ...jsonHeaders };
  try {
    const res = await fetch(`${base}/assistant/chat/stream`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ message: 'اسمي كريم وعايز اعرف يعني ايه تعتيق العطر', visitorId: visitor }) });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/event-stream/);
    const raw = await res.text();
    const events = raw.split('\n\n').filter(Boolean).map((block) => JSON.parse(block.split('\n').find((l) => l.startsWith('data:'))!.slice(5)));
    assert.ok(events.some((e) => e.type === 'step'));
    assert.ok(events.some((e) => e.type === 'delta'));
    const done = events.at(-1);
    assert.equal(done.type, 'done');
    assert.equal(done.output.trace, undefined, 'trace stays admin-only on the stream too');

    const bad = await fetch(`${base}/assistant/chat/stream`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ message: '' }) });
    assert.equal(bad.status, 400, 'validation errors are plain JSON before the stream opens');

    const fb = await fetch(`${base}/assistant/feedback`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ conversationId: done.output.conversationId, messageId: done.output.messageId, rating: 'down', reason: 'ناقص', visitorId: visitor }) });
    assert.equal(fb.status, 200);
    const overview = await (await fetch(`${base}/admin/overview`, { headers: auth })).json();
    assert.equal(overview.counts.feedbackDown, 1);
    assert.equal(overview.notifications.configured, false);
    const gaps = await (await fetch(`${base}/admin/gaps`, { headers: auth })).json();
    assert.equal(gaps.items[0].source, 'negative_feedback');
    const ignored = await (await fetch(`${base}/admin/gaps/${gaps.items[0].id}`, { method: 'PATCH', headers: auth, body: JSON.stringify({ status: 'ignored' }) })).json();
    assert.equal(ignored.item.status, 'ignored');
    const feedback = await (await fetch(`${base}/admin/feedback`, { headers: auth })).json();
    assert.equal(feedback.items[0].reason, 'ناقص');
    assert.match(feedback.items[0].question, /تعتيق/);

    const agent = await (await fetch(`${base}/admin/agent`, { method: 'POST', headers: auth, body: JSON.stringify({ message: 'رضا العملاء' }) })).json();
    assert.deepEqual(agent.plan.map((s: { task: string }) => s.task), ['satisfaction']);
    assert.equal((await fetch(`${base}/admin/notifications/test`, { method: 'POST', headers: auth })).status, 409);
    assert.equal((await fetch(`${base}/admin/agent`, { method: 'POST' })).status, 401);

    const me = await (await fetch(`${base}/assistant/me?visitorId=${visitor}`)).json();
    assert.equal(me.memory.name, 'كريم');
    assert.equal((await fetch(`${base}/assistant/me?visitorId=bad`)).status, 400);
    const erased = await (await fetch(`${base}/assistant/me?visitorId=${visitor}`, { method: 'DELETE' })).json();
    assert.equal(erased.deleted.conversations, 1);
    assert.equal((await fetch(`${base}/assistant/conversations/${done.output.conversationId}?visitorId=${visitor}`)).status, 404);
  } finally { server.close(); }
});
