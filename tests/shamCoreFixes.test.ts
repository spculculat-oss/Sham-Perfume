/**
 * Phase 2.1 — bugs found by driving the real UI in a headless browser, and the
 * ChatGPT/Claude-style controls added afterwards (stop, regenerate, edit).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { Orchestrator, AssistantError, validateChatInput } from '../server/core/orchestrator';
import { matchesKeyword, route, stripIntro } from '../server/core/router';
import { normalize } from '../server/core/text';
import { tools } from '../server/core/tools';
import { defaultServices } from '../server/core/seed';
import { runAdminAgent } from '../server/core/adminAgent';

const visitor = 'visitor-fix-00001';
const freshRepo = () => new Repository(new MemoryStore(), { SHAM_SEED_DEMO: 'true' });
const padded = (text: string) => ` ${normalize(text)} `;

test('keyword matching accepts real inflections but not arbitrary continuations', () => {
  assert.equal(matchesKeyword(padded('عايز اكلم بشري'), 'بشري'), true);
  assert.equal(matchesKeyword(padded('تغليف بشريط مخملي'), 'بشري'), false, 'بشري ≠ بشريط');
  assert.equal(matchesKeyword(padded('المنتج مطلوب'), 'طلب'), false);
  assert.equal(matchesKeyword(padded('اكلم الموظف'), 'موظف'), true, 'article prefix');
  assert.equal(matchesKeyword(padded('موظفين خدمة العملاء'), 'موظف'), true, 'plural');
  assert.equal(matchesKeyword(padded('اطلبلي عطر'), 'اطلب'), true, 'Egyptian dative');
  assert.equal(matchesKeyword(padded('his order'), 'hi '), false, 'exact keyword');
  assert.equal(matchesKeyword(padded('ordering now'), 'order'), true);
});

test('router regressions found in testing', () => {
  const services = defaultServices();
  assert.notEqual(route('هل عندكم تغليف بشريط مخملي؟', services).intent, 'handoff');
  assert.equal(route('ايه الخدمات اللي عندكم', services).intent, 'list_services');
  assert.equal(route('فين طلباتي', services).intent, 'track_order');
  assert.equal(route('الطلب موصلش لحد دلوقتي', services).intent, 'track_order');
  assert.equal(route('عايز اكلم الموظف', services).intent, 'handoff');
});

test('self-introductions are stripped from search queries and admin analytics', async () => {
  assert.equal(stripIntro('اسمي أحمد، يعني ايه تعتيق العطر؟'), 'يعني ايه تعتيق العطر؟');
  assert.equal(stripIntro('my name is Sara, what is maceration?'), 'what is maceration?');
  assert.equal(stripIntro('مرحبا'), 'مرحبا');
  const repo = freshRepo();
  const bot = new Orchestrator(repo, { env: {} });
  await bot.chat({ message: 'اسمي منى، هل فرعكم مفتوح يوم الجمعة؟', visitorId: visitor, language: 'ar' });
  const [gap] = await repo.gaps();
  assert.ok(gap && !gap.question.includes('منى'), 'the visitor name does not leak into knowledge gaps');
});

test('retrieval cites only passages that add a significant part of the answer', async () => {
  const repo = freshRepo();
  const ids = async (query: string) => (await tools.retrieve_knowledge.run({ query }, { repo } as never)).citations!.map((c) => c.id);
  assert.deepEqual(await ids('يعني ايه تعتيق العطر؟'), ['kb-maceration']);
  assert.deepEqual(await ids('مدة التعتيق ومدة الشحن'), ['kb-maceration', 'kb-orders'], 'multi-part questions still get both');
});

test('privacy card shows service names, not internal ids; admin agent uses Arabic labels', async () => {
  const repo = freshRepo();
  const bot = new Orchestrator(repo, { env: {} });
  await bot.chat({ message: 'عايز اشتري زيت عود', visitorId: visitor, language: 'ar' });
  const out = await bot.chat({ message: 'ماذا تعرف عني؟', visitorId: visitor, language: 'ar' });
  const memory = out.actions.find((a) => a.type === 'privacy')?.memory || {};
  assert.ok(memory.lastService && memory.lastService !== 'store', `got ${memory.lastService}`);

  await repo.updateSettings({ enginePolicy: ['sham_local'] });
  const report = await runAdminAgent(repo, 'اهتمامات الزوار', { env: {} });
  const lines = report.sections.flatMap((s) => s.lines).join('\n');
  assert.doesNotMatch(lines, /service_request|browse_products|memory_view/);
});

test('regenerate/edit rewinds only the latest exchange and never over a staff reply', async () => {
  const repo = freshRepo();
  const bot = new Orchestrator(repo, { env: {} });
  const a = await bot.chat({ message: 'يعني ايه تعتيق العطر؟', visitorId: visitor, language: 'ar' });
  await bot.chat({ message: 'بتقدموا خدمات ايه؟', visitorId: visitor, conversationId: a.conversationId, language: 'ar' });
  // Edit the last message:
  await bot.chat({ message: 'ازاي احسب تركيز العطر', rewind: 'بتقدموا خدمات ايه؟', visitorId: visitor, conversationId: a.conversationId, language: 'ar' });
  let conv = (await repo.conversation(a.conversationId))!;
  assert.deepEqual(conv.messages.filter((m) => m.role === 'user').map((m) => m.text), ['يعني ايه تعتيق العطر؟', 'ازاي احسب تركيز العطر']);
  // Regenerate with a stale/unknown text: nothing is removed (e.g. a stopped request that was never stored).
  await bot.chat({ message: 'ازاي احسب تركيز العطر', rewind: 'رسالة غير موجودة', visitorId: visitor, conversationId: a.conversationId, language: 'ar' });
  conv = (await repo.conversation(a.conversationId))!;
  assert.equal(conv.messages.filter((m) => m.role === 'user').length, 3);
  // Staff replied → no rewinding over it.
  await bot.addHumanReply(a.conversationId, 'أهلاً، معك سارة');
  await assert.rejects(
    bot.chat({ message: 'x', rewind: 'ازاي احسب تركيز العطر', visitorId: visitor, conversationId: a.conversationId, language: 'ar' }),
    (e: unknown) => e instanceof AssistantError && e.status === 409,
  );
  assert.throws(() => validateChatInput({ message: 'hi', visitorId: visitor, rewind: 42 }), AssistantError);
});

test('stop keeps exactly what the visitor saw, without failover to another engine', async () => {
  const repo = freshRepo();
  const encoder = new TextEncoder();
  let calls = 0;
  const fetchMock = (async (_url: string | URL, init?: RequestInit) => {
    calls++;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"التعتيق هو "}}]}\n\n'));
        init?.signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')));
      },
    });
    return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
  }) as typeof fetch;
  const bot = new Orchestrator(repo, { env: { SHAM_LLM_BASE_URL: 'http://llm.internal/v1', OPENAI_API_KEY: 'k' }, fetch: fetchMock });
  const controller = new AbortController();
  const out = await bot.chat({ message: 'يعني ايه تعتيق العطر؟', visitorId: visitor, language: 'ar' }, {
    signal: controller.signal,
    onEvent: (e) => { if (e.type === 'delta') controller.abort(); },
  });
  assert.equal(calls, 1, 'no failover after a stop');
  assert.equal(out.reply, 'التعتيق هو');
  const saved = (await repo.conversation(out.conversationId))!.messages.at(-1)!;
  assert.equal(saved.stopped, true);
  assert.equal(saved.text, 'التعتيق هو');
});

test('concurrent requests on one conversation are serialised (no lost updates)', async () => {
  const repo = freshRepo();
  const bot = new Orchestrator(repo, { env: {} });
  const first = await bot.chat({ message: 'مرحبا', visitorId: visitor, language: 'ar' });
  await Promise.all(['بتقدموا خدمات ايه؟', 'يعني ايه تعتيق العطر؟', 'تتبع طلبي'].map((message) =>
    bot.chat({ message, visitorId: visitor, conversationId: first.conversationId, language: 'ar' })));
  const conv = (await repo.conversation(first.conversationId))!;
  assert.equal(conv.messages.length, 8, 'all 4 exchanges are stored');
});
