import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import productsData from '../src/data/products.json';
import catalogFile from '../src/data/live/store-catalog.json';
import { mergeCatalog, type RawProduct, type StoreCatalogFile } from '../src/utils/storeCatalog';
import { closeToDesign, designStoreNote, productLink, shownIn, storeAnswer, wantsStore, withContext } from '../src/utils/shaheenBrain';
import { designFor } from '../src/utils/shaheenDesigner';
import { AGENT_LINK, agentLinkOn, agentLinkStatusAr } from '../src/utils/agentLink';
import { STATE_CONSTITUTION, readStateOrders } from '../src/utils/platformState';
import { applyStateOrder, judgeStateOrder, stateReply, type StateRoomContext } from '../src/utils/stateRoom';
import { readControls } from '../src/utils/ownerAuthority';
import { EngineHealth, keyPrint, seedQuotaPauses } from '../server/core/engineHealth';
import { createShaheenRouter } from '../server/shaheen';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';

const PRODUCTS = mergeCatalog((productsData as { products?: RawProduct[] }).products || [], catalogFile as unknown as StoreCatalogFile);
const link = productLink();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('a perfume wish is answered from the store: real products with notes, family, season, concentration, price and link', () => {
  assert.ok(PRODUCTS.length > 50, 'the bundled catalogue');
  const ctx = withContext('محتاج عطر رجالي شتوي تقيل تحت 4000 جنيه');
  assert.ok(wantsStore(ctx.text));
  const a = storeAnswer(PRODUCTS, ctx, 'ar', link)!;
  assert.ok(a && a.picks.length >= 1 && a.picks.length <= 3);
  for (const p of a.picks) {
    assert.ok(p.price <= 4000, `${p.name} within the budget`);
    assert.ok(a.reply.includes(p.name.ar), p.name.ar);
  }
  assert.match(a.reply, /\/p\/[a-z0-9-]+\.html/, 'a link to the product page');
  assert.match(a.reply, /جنيه|EGP/);
  assert.match(a.reply, /ليه|مناسب/, 'why each one fits');
});

test('he remembers the conversation: a follow-up carries the subject of the question before it', () => {
  const first = withContext('عايز عطر نسائي فانيليا');
  const firstAnswer = storeAnswer(PRODUCTS, first, 'ar', link);
  assert.ok(firstAnswer);
  const history = [{ role: 'user' as const, text: 'عايز عطر نسائي فانيليا' }, { role: 'assistant' as const, text: firstAnswer!.reply }];
  const follow = withContext('طب وللصيف؟', history);
  assert.equal(follow.followUp, true);
  assert.match(follow.text, /فانيليا|نسائي/, 'the subject stays');
  assert.ok(wantsStore(follow.text));
  const next = storeAnswer(PRODUCTS, follow, 'ar', link);
  assert.ok(next && next.picks.length);
  // «أنهي فيهم أثبت؟» is about the perfumes he just showed.
  assert.ok(shownIn(firstAnswer!.reply, PRODUCTS).length >= 1);
  assert.equal(withContext('شكرا').followUp, false);
  assert.equal(withContext('ايه هي الطاقة الشمسية', history).followUp, false, '«ايه هي …» is a new question, not «it»');
});

test('questions about perfumery itself, notes for a formula and lab work are not store questions', () => {
  for (const q of ['ايه هو الامبروكسان', 'اقترح نوتات لعطر صيفي منعش', 'ازاي اعمل عطر بريحة المطر', 'يعني ايه عائلة شيبر', 'ايه الفرق بين البرفان والتواليت']) {
    assert.equal(wantsStore(withContext(q).text), false, q);
  }
  for (const q of ['عايز اشتري عطر هدية', 'ايه احسن عطر عندكم', 'سعر عطر عود', 'رشحلي عطر صيفي منعش']) assert.equal(wantsStore(withContext(q).text), true, q);
});

test('a formula he designs is linked to the store’s ready perfumes that share its notes', () => {
  const d = designFor('صمم لي عطر شرقي بالعود والعنبر', 'ar');
  assert.ok(d?.design, 'a design');
  const close = closeToDesign(PRODUCTS, d!.design!);
  assert.ok(close.length >= 1, 'something close in the store');
  for (const c of close) assert.ok(c.shared.length >= 1, `${c.product.name} shares a note`);
  const note = designStoreNote(PRODUCTS, d!.design!, d!.lang, link);
  assert.match(note, /متجر شام|المتجر/);
  assert.match(note, /\/p\/[a-z0-9-]+\.html/);
});

test('«الربط المباشر» under the State (S-10): it can pause it and bring it back; the owner stops it too', () => {
  assert.ok(STATE_CONSTITUTION.some((r) => r.id === 'S-10'));
  const controls = readControls({ selfDevelopment: 'state' });
  const orders = readStateOrders({});
  assert.equal(agentLinkOn(orders, controls), true);
  const ctx = { controls, orders, report: {} } as unknown as StateRoomContext;
  const asked = stateReply('وقف الربط المباشر بين وكيل شاهين وشاهين', ctx);
  assert.equal(asked.order?.action, 'pause');
  assert.equal(asked.order?.target, AGENT_LINK.id);
  assert.equal(judgeStateOrder({ action: 'run', target: AGENT_LINK.id, whyAr: '' }, { controls, orders }).ok, false, 'not a robot that is run');
  const paused = applyStateOrder(orders, asked.order!).orders;
  assert.equal(agentLinkOn(paused, controls), false);
  assert.match(agentLinkStatusAr(paused, controls), /دولة المنصة/);
  const back = stateReply('رجع الربط المباشر', { ...ctx, orders: paused });
  assert.equal(back.order?.action, 'resume');
  assert.equal(agentLinkOn(applyStateOrder(paused, back.order!).orders, controls), true);
  assert.match(stateReply('حالة الربط المباشر', ctx).text, /شغال/);
  assert.equal(agentLinkOn(orders, readControls({ selfDevelopment: 'state', paused: ['chat'] })), false, 'the owner is above the State');
});

test('the bots’ quota file parks a dead key from the first visitor on — only while it is the same key', () => {
  const env = { OPENAI_API_KEY: 'sk-old', DEEPSEEK_API_KEY: 'sk-d', GEMINI_API_KEY: 'g' };
  const now = Date.parse('2026-10-22T10:00:00Z');
  const until = '2026-10-22T12:00:00Z';
  const file = { engines: {
    openai: { reason: 'invalid_key', pausedUntil: until, key: keyPrint(env, 'openai') },
    deepseek: { reason: 'no_credit', pausedUntil: until, key: 'deadbeef' },
    gemini: { reason: 'chat_reserve', pausedUntil: until },
    claude: { reason: 'invalid_key', pausedUntil: until },
  } };
  const health = new EngineHealth(() => now);
  assert.deepEqual(seedQuotaPauses(health, file, env, now), ['openai'], 'a new key (other fingerprint), the chat reserve and a missing key are left alone');
  assert.equal(health.parkedUntil('openai'), Date.parse(until));
  assert.equal(health.parkedUntil('gemini'), 0);
  health.ok('openai');
  assert.equal(health.parkedUntil('openai'), 0, 'the first success brings it back');
  assert.deepEqual(seedQuotaPauses(new EngineHealth(() => now), { engines: { openai: { reason: 'invalid_key', pausedUntil: '2026-10-22T09:00:00Z' } } }, env, now), [], 'an old pause is over');
  assert.deepEqual(seedQuotaPauses(health, null, env, now), []);
});

async function withServer(options: { agentLink?: boolean }, run: (chat: (message: string, history?: { role: string; text: string }[]) => Promise<Response>, calls: () => number) => Promise<void>) {
  let calls = 0;
  const engine = (async () => { calls++; return json({ choices: [{ message: { role: 'assistant', content: 'رد المنصة: نصيحة عامة طويلة كفاية عن العطور والروائح المناسبة لكل موسم ومناسبة.' } }] }); }) as typeof fetch;
  const app = express();
  app.use(express.json());
  app.use('/api', createShaheenRouter({
    repo: new Repository(new MemoryStore(), {}), env: { OPENAI_API_KEY: 'sk-test', SHAM_ANSWER_CACHE_MINUTES: '0' }, fetch: engine,
    catalog: async () => PRODUCTS, ...options,
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const chat = (message: string, history: { role: string; text: string }[] = []) => fetch(`${base}/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'auto', language: 'ar', conversationHistory: history, message }),
  });
  try { await run(chat, () => calls); } finally { await new Promise((done) => server.close(done)); }
}

test('the server, link on: a perfume wish is answered from the store with no platform call; other questions go to the platform', async () => {
  await withServer({}, async (chat, calls) => {
    const res = await chat('عايز عطر رجالي شتوي تحت 5000');
    assert.equal(res.status, 200);
    const body = await res.json() as { reply: string; memory: string; link?: string; engine: { provider: string } };
    assert.equal(body.memory, 'store');
    assert.equal(body.engine.provider, 'shaheen');
    assert.match(body.reply, /\/p\/[a-z0-9-]+\.html/);
    assert.equal(calls(), 0, 'no platform asked');
    // A follow-up in the same conversation keeps the subject.
    const follow = await (await chat('طب وأرخص من كده؟', [{ role: 'user', text: 'عايز عطر رجالي شتوي تحت 5000' }, { role: 'assistant', text: body.reply }])).json() as { memory: string };
    assert.equal(follow.memory, 'store');
    assert.equal(calls(), 0);
    const other = await (await chat('ازاي احافظ على العطر من الحرارة')).json() as { reply: string };
    assert.match(other.reply, /رد المنصة/, 'the platforms answer while they work');
    assert.equal(calls(), 1);
  });
});

test('the server, link paused by the State: the store wish goes to the platform as before', async () => {
  await withServer({ agentLink: false }, async (chat, calls) => {
    const body = await (await chat('عايز عطر رجالي شتوي تحت 5000')).json() as { reply: string };
    assert.match(body.reply, /رد المنصة/);
    assert.equal(calls(), 1);
  });
});
