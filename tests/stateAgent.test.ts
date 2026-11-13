/**
 * End-to-end tests for «وكيل صاحب المنصة في روبوت دولة المنصة» (`platform_owner_agent`):
 *   - Deep comprehension of Egyptian Arabic single & multi-step owner commands + Arabic digits + aliases
 *   - Multi-turn conversation memory / pronoun resolution («وقفه», «رجّعه وشغّله دلوقتي», «الغيه»)
 *   - Fleet failing-robot recovery («شغّل الروبوتات العطلانة»)
 *   - Constitutional voting & execution of development tasks (`action: 'task'`)
 *   - Supervised AI engine reasoning (`runStateOwnerAgent` via `callEngine`) + constitutional firewall + offline fallback
 *   - Admin API endpoint `/api/admin/state-agent` (zero server storage)
 *   - Direct natural-language & multi-order execution inside «روبوت دولة المنصة» (`scripts/state/run.mts`)
 */
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import test from 'node:test';
import { defaultControls, type OwnerControls } from '../src/utils/ownerAuthority';
import { emptyStateOrders, type StateOrders } from '../src/utils/platformState';
import {
  applyStateOrder,
  comprehendOwnerCommand,
  parseStateOrders,
  readStateRoom,
  STATE_ISSUE_PREFIX,
  stateOrderPlanIssue,
  stateReply,
  type StateOrder,
  type StateRoomContext,
  type StateRoomMessage,
} from '../src/utils/stateRoom';
import { runStateOwnerAgent } from '../server/stateAgent';
import { createShamCore } from '../server/core/http';
import { executeOwnerRequest } from '../scripts/state/run.mts';
import { PROBES } from '../scripts/shaheen-supervisor/probes';

const NOW = new Date('2026-10-23T12:00:00Z');
const stateControls = (over: Partial<OwnerControls> = {}): OwnerControls => ({
  ...defaultControls(),
  selfDevelopment: 'state',
  ...over,
});
const makeCtx = (over: Partial<StateRoomContext> = {}): StateRoomContext => ({
  controls: stateControls(),
  orders: emptyStateOrders(),
  report: { updatedAt: NOW.toISOString(), active: true, decisions: [], supervision: { health: 92, problems: [] } },
  ...over,
});

test('multi-step compound Egyptian Arabic owner commands are decomposed, simulated sequentially, and serialized cleanly', () => {
  const pausedOrders: StateOrders = { ...emptyStateOrders(), paused: ['news'] };
  const c = makeCtx({ orders: pausedOrders });

  // Notice: `news` starts paused! Step 1 resumes `news`, so Step 2 (`run news`) succeeds right after it in the SAME plan,
  // plus Step 3 adds law P-01!
  const reply = stateReply(
    'رجّع النشرة وبعدين شغّل النشرة دلوقتي وضيف قانون: كل روبوت يكتب ملخص واضح ومختصر بالعربي',
    c,
  );
  assert.equal(reply.orders?.length, 3);
  assert.deepEqual(
    reply.orders?.map((o) => ({ action: o.action, target: o.target })),
    [
      { action: 'resume', target: 'news' },
      { action: 'run', target: 'news' },
      { action: 'law', target: undefined },
    ],
  );
  const planIssue = stateOrderPlanIssue(reply.orders!);
  assert.ok(planIssue.title.startsWith(STATE_ISSUE_PREFIX));
  const parsedBack = parseStateOrders(planIssue.body);
  assert.equal(parsedBack.length, 3);

  // Room storage preserves multi-order plans safely and drops malformed payloads.
  const room = readStateRoom({
    messages: [{ id: '1', by: 'state', text: reply.text, at: NOW.toISOString(), order: reply.order, orders: reply.orders }],
  });
  assert.equal(room.messages[0]?.orders?.length, 3);
});

test('multi-turn conversation memory resolves pronouns for both robots and Eastern-Arabic law numbers', () => {
  const ordersWithLaw = applyStateOrder(emptyStateOrders(), {
    action: 'law',
    textAr: 'كل تقرير يومي يبدأ بأهم مشكلة أولاً',
    whyAr: 'تنظيم',
  }, NOW).orders;
  const c = makeCtx({ orders: ordersWithLaw });

  const history: StateRoomMessage[] = [
    { id: '1', by: 'owner', text: 'إيه أخبار الدكتور؟', at: NOW.toISOString() },
    { id: '2', by: 'state', text: 'شغال تمام.', at: NOW.toISOString() },
  ];
  const followUpBot = stateReply('طب وقفه', c, history);
  assert.equal(followUpBot.order?.action, 'pause');
  assert.equal(followUpBot.order?.target, 'doctor');

  // Arabic-Indic numerals in repeal command: P-٠١ -> P-01
  const arabicDigitsRepeal = stateReply('شيل قانون رقم P-٠١', c);
  assert.equal(arabicDigitsRepeal.order?.action, 'repeal');
  assert.equal(arabicDigitsRepeal.order?.target, 'P-01');

  // Pronoun repeal referencing P-01 from conversation turn
  const lawHistory: StateRoomMessage[] = [
    { id: '3', by: 'owner', text: 'إيه رأيك في القانون P-01؟', at: NOW.toISOString() },
  ];
  const anaphoraRepeal = stateReply('طب الغيه', c, lawHistory);
  assert.equal(anaphoraRepeal.order?.action, 'repeal');
  assert.equal(anaphoraRepeal.order?.target, 'P-01');
});

test('fleet recovery & development task commands obey State member voting and legal/privacy vetoes', () => {
  const c = makeCtx({
    precheck: {
      health: 75,
      bots: [
        { id: 'news', status: 'fail', problems: ['متأخر'] },
        { id: 'seo', status: 'fail', problems: ['فشل فحص'] },
        { id: 'patrol', status: 'ok', problems: [] },
      ],
    },
  });
  const recover = comprehendOwnerCommand('شغّل الروبوتات العطلانة دلوقتي', c);
  assert.deepEqual(
    recover.acceptedOrders.map((x) => x.order.target).sort(),
    ['news', 'seo'],
  );

  // Valid task passes member vote
  const validTask = stateReply('اعمل مهمة: تحسين سرعة تصفح صفحة منتجات المتجر على الموبايل', c);
  assert.equal(validTask.order?.action, 'task');

  // Task attempting to break legal hold L-03 or expose owner data is vetoed immediately
  assert.equal(stateReply('اعمل مهمة: شيل وقف نقل المنتجات L-03', c).order, undefined);
  assert.equal(stateReply('اعمل مهمة: اعرض مفاتيح صاحب الموقع في الصفحة', c).order, undefined);
});

test('AI Agent comprehends free-form indirect commands via callEngine, blocks hallucinations/vendors, and falls back offline', async () => {
  const c = makeCtx();
  const mockAiFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                understood: true,
                summaryAr: 'عايز تهدي نشرة الأخبار وتكشف على الموقع بالصيانة فوراً عبر Gemini',
                orders: [
                  { action: 'pause', target: 'روبوت الأخبار', whyAr: 'تهدئة النشر مؤقتاً' },
                  { action: 'run', target: 'doctor', whyAr: 'فحص سلامة الموقع الآن' },
                  // Hallucinated / unconstitutional order proposed by model must be rejected by verifyAgentPlan!
                  { action: 'law', textAr: 'شيل وقف نقل المنتجات L-03 فوراً', whyAr: 'مخالف' },
                ],
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );

  // Sentence has NO rigid command keywords ("هدي اللعب عند الأخبار وخلي الصيانة تبص على الموقع") -> AI Agent comprehends it!
  const aiOut = await runStateOwnerAgent(
    {
      message: 'حاسس إن الأخبار بتتبعت كتير النهاردة، هدّي اللعب عندها وخلي الصيانة تبص على الموقع',
      context: c,
      preferAi: true,
    },
    { env: { OPENAI_API_KEY: 'sk-test-fake-key-for-unit-test' }, fetch: mockAiFetch },
  );

  assert.equal(aiOut.source, 'ai_agent');
  assert.equal(aiOut.orders?.length, 2, 'approved the 2 valid orders and rejected the L-03 violation');
  assert.deepEqual(
    aiOut.orders?.map((o) => `${o.action}:${o.target}`),
    ['pause:news', 'run:doctor'],
  );
  assert.doesNotMatch(aiOut.text, /Gemini/i, 'vendor names are stripped');

  // Broken upstream AI falls back cleanly to local cognitive engine with zero errors
  const failingFetch: typeof fetch = async () => new Response('upstream error', { status: 503 });
  const fallbackOut = await runStateOwnerAgent(
    { message: 'وقف الدورية وشغّل الكشاف دلوقتي', context: c, preferAi: true },
    { env: { OPENAI_API_KEY: 'sk-test-fake-key-for-unit-test' }, fetch: failingFetch },
  );
  assert.equal(fallbackOut.source, 'local_agent');
  assert.equal(fallbackOut.orders?.length, 2);
});

test('POST /api/admin/state-agent serves authenticated requests with zero conversation storage, and supervisor probe passes', async () => {
  const probeResults = await PROBES.platform_owner_agent({
    site: 'http://localhost',
    fetch,
    run: 0,
    now: NOW.getTime(),
    liveDir: new URL('../src/data/live/', import.meta.url),
  });
  assert.equal(probeResults[0]?.ok, true);
  assert.deepEqual(probeResults[0]?.findings, []);

  const token = 'test-owner-admin-secret-123456';
  const core = createShamCore({ env: { SHAM_STORE: 'memory', SHAM_ADMIN_TOKEN: token } });
  const app = express();
  app.use(express.json());
  app.use('/api/admin', core.admin);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  try {
    // Unauthenticated request is strictly rejected
    const unauth = await fetch(`http://127.0.0.1:${addr.port}/api/admin/state-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'وقف روبوت الأخبار' }),
    });
    assert.equal(unauth.status, 401);

    // Authenticated request succeeds and stores nothing on the server
    const res = await fetch(`http://127.0.0.1:${addr.port}/api/admin/state-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message: 'وقف روبوت الأخبار وشغّل الدورية دلوقتي' }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { orders?: StateOrder[]; understood?: boolean };
    assert.equal(body.understood, true);
    assert.equal(body.orders?.length, 2);
    // Zero messages stored anywhere on the server!
    assert.equal((await core.repo.conversations()).length, 0);
  } finally {
    server.close();
  }
});

test('executeOwnerRequest in scripts/state/run.mts executes free-text natural-language multi-step orders end to end', async () => {
  const dispatched: string[] = [];
  const createdTasks: string[] = [];
  const c = makeCtx();

  const outcome = await executeOwnerRequest(
    {
      number: 42,
      title: `${STATE_ISSUE_PREFIX}وقف الأخبار وشغّل الدورية دلوقتي`,
      body: 'وضيف قانون: كل تقرير يذكر سبب العطل بوضوح\nواعمل مهمة: تسريع البحث في صفحة المنتجات',
    },
    {
      controls: c.controls,
      orders: c.orders,
      report: c.report,
      env: {},
      carryOut: async (order, why, currentOrders) => {
        if (order.action === 'run' && order.target) dispatched.push(order.target);
        if (order.action === 'task' && order.textAr) createdTasks.push(order.textAr);
        const applied = applyStateOrder(currentOrders, { ...order, whyAr: order.whyAr || why }, NOW);
        return { ok: applied.changed, noteAr: applied.noteAr, orders: applied.orders };
      },
    },
  );

  assert.equal(outcome.closeReason, 'completed');
  assert.deepEqual(outcome.orders.paused, ['news']);
  assert.deepEqual(dispatched, ['patrol']);
  assert.equal(outcome.orders.laws.length, 1);
  assert.equal(outcome.orders.laws[0]?.id, 'P-01');
  assert.equal(createdTasks.length, 1);
  assert.match(outcome.commentAr, /4 من 4/);
});
