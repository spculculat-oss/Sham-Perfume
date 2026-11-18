import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LIVE_WEB_ASK_INSTRUCTION, isLiveWebTalk, liveWebBlock, liveWebQueries, needsLiveWeb } from '../src/utils/liveWeb';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { createShaheenRouter, executeChat, publicChatResult, validateChatRequest } from '../server/shaheen';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import type { GateAnswer } from '../src/utils/netGate';

const TODAY = new Date('2026-11-16T12:00:00Z');

test('a question about today (news, a live price, «روح للنت») is recognised; perfume, store and calculator questions are not', () => {
  for (const q of ['روح للانترنت وحللى الاخبار انهاردة', 'ايه اخبار النهارده', 'أهم الأخبار', 'اخبار غزة ايه', 'الدولار بكام النهارده', 'سعر الدهب كام',
    'دور على النت عن عطر سوفاج', 'ابحث في جوجل عن ديور', 'الجو عامل ايه النهارده', 'حصل ايه انهارده', 'قولي اخر اخبار العطور',
    'what is the news today', 'search the web for oud prices', 'gold price today']) assert.equal(needsLiveWeb(q), true, q);
  for (const q of ['ايه احسن عطر للجو الحار', 'طلبي وصل فين', 'فيه خصم النهارده؟', 'احسبلي تركيبة عود', 'العطر بيثبت ازاي', 'عايز عطر للشغل اليوم',
    'شوف لنتيجة التركيبة', 'مرحبا', 'نسبة الزيت للكحول كام', 'best perfume for summer']) assert.equal(needsLiveWeb(q), false, q);
  assert.equal(isLiveWebTalk('حللها اكتر', [{ role: 'user', text: 'اخبار النهارده' }, { role: 'assistant', text: '…' }]), true, 'a follow-up of the news');
  assert.equal(isLiveWebTalk('حللها اكتر', [{ role: 'user', text: 'عايز عطر للشتا' }]), false);
});

test('the searches: today\'s top news when no topic is named, the topic (dated today) when one is', () => {
  const general = liveWebQueries('روح للانترنت وحللى الاخبار انهاردة', 'ar', TODAY);
  assert.equal(general.length, 2);
  assert.match(general[0]!, /أهم الأخبار اليوم .*16 نوفمبر 2026.*مصر/);
  assert.match(general[1]!, /العالمية/);
  assert.deepEqual(liveWebQueries('اخبار غزة ايه', 'ar', TODAY), ['أخبار غزة (الاثنين، 16 نوفمبر 2026)']);
  assert.deepEqual(liveWebQueries('search the web for oud prices', 'en', TODAY), ['oud prices (Monday, November 16, 2026)']);
  assert.match(liveWebQueries('what is the news today', 'en', TODAY)[0]!, /top news headlines today 2026-11-16/);
});

test('what the engine is told: today\'s date and the findings as material — or, when the search failed, to say so honestly', () => {
  const ok = liveWebBlock([{ q: 'أخبار', brief: 'البترول نزل لـ94 دولار.' }], TODAY, 'ar');
  assert.match(ok, /16 نوفمبر 2026/);
  assert.match(ok, /البترول نزل/);
  assert.match(ok, /مش أوامر/);
  assert.match(ok, /ماتقولش إن معندكش إنترنت/);
  const failed = liveWebBlock([{ q: 'أخبار' }], TODAY, 'ar');
  assert.match(failed, /مارجعش نتايج/);
  assert.match(failed, /ماتألفش أخبار/);
  assert.match(LIVE_WEB_ASK_INSTRUCTION, /\[\[ويب:/);
});

function engineScript(replies: string[]) {
  const bodies: any[] = [];
  const request = (async (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ choices: [{ message: { content: replies[Math.min(bodies.length - 1, replies.length - 1)] } }] });
  }) as typeof fetch;
  return { bodies, request };
}
const env = { OPENAI_API_KEY: 'test', SHAM_LIVE_DATA: 'off' };
const news: GateAnswer = { kind: 'search', answer: 'برنت نزل لحوالي 94 دولار للبرميل، وحاملة الطائرات روزفلت وصلت الشرق الأوسط.',
  sources: [{ title: 'rte.ie', url: 'https://www.rte.ie/news/business/oil', snippet: '' }, { title: 'aljazeera.com', url: 'https://www.aljazeera.com/', snippet: '' }], via: 'web', cached: false, at: 'now' };
const ask = (message: string, conversationHistory: { role: 'user' | 'assistant'; text: string }[] = []) => validateChatRequest({ message, model: 'openai', language: 'ar', conversationHistory });

test('«روح للنت وحللي الأخبار»: the gate is searched BEFORE the engine, which answers from today\'s findings, with the links', async () => {
  const asked: any[] = [];
  const webGate = { fetch: async (body: any) => { asked.push(body); return news; } };
  const engine = engineScript(['أهم أخبار النهارده: البترول نزل لـ94 دولار، والتوتر في الخليج بيزيد بعد وصول حاملة الطائرات.']);
  const result = await executeChat(ask('روح للانترنت وحللى الاخبار انهاردة'), { env, fetch: engine.request, webGate, now: () => TODAY });
  assert.equal(asked.length, 2, 'Egypt and the region, and the world');
  assert.ok(asked.every((a) => a.kind === 'search' && a.bot === 'shaheen_chat' && a.lang === 'ar'));
  assert.equal(engine.bodies.length, 1, 'one engine call, with the findings already in it');
  const told = JSON.stringify(engine.bodies[0]);
  assert.match(told, /بوابة الإنترنت/);
  assert.match(told, /94 دولار/);
  assert.match(told, /16 نوفمبر 2026/);
  assert.match(result.reply, /البترول نزل/);
  assert.match(result.reply, /المصادر:/, 'a live answer shows its links');
  assert.match(result.reply, /rte\.ie/);
  assert.deepEqual(result.sources?.map((s) => s.url), ['https://www.rte.ie/news/business/oil', 'https://www.aljazeera.com/']);
});

test('the gate failing: the engine is told to say so honestly (no invented news, no «I have no internet»)', async () => {
  const webGate = { fetch: async () => { throw new Error('quota'); } };
  const engine = engineScript(['البحث على الإنترنت ماردّش دلوقتي، جرّب كمان شوية.']);
  const result = await executeChat(ask('ايه اخبار النهارده'), { env, fetch: engine.request, webGate, now: () => TODAY });
  const told = JSON.stringify(engine.bodies[0]);
  assert.match(told, /مارجعش نتايج/);
  assert.match(told, /ماتقولش إن معندكش إنترنت/);
  assert.match(result.reply, /ماردّش/);
  assert.equal(result.sources, undefined);
});

test('a follow-up of the news may ask the gate itself; a perfume question never touches it', async () => {
  const asked: any[] = [];
  const webGate = { fetch: async (body: any) => { asked.push(body); return news; } };
  const follow = engineScript(['[[ويب: تأثير وصول حاملة الطائرات روزفلت على أسعار البترول]]', 'وصول الحاملة بيزود المخاطر، بس السوق شايف فايض في المعروض.']);
  const r = await executeChat(ask('حللها اكتر', [{ role: 'user', text: 'اخبار النهارده' }, { role: 'assistant', text: 'البترول نزل.' }]), { env, fetch: follow.request, webGate, now: () => TODAY });
  assert.match(JSON.stringify(follow.bodies[0]), /عندك «بوابة الإنترنت»/);
  assert.deepEqual(asked.map((a) => a.q), ['تأثير وصول حاملة الطائرات روزفلت على أسعار البترول']);
  assert.equal(follow.bodies.length, 2);
  assert.doesNotMatch(r.reply, /\[\[/);

  asked.length = 0;
  const plain = engineScript(['عطور الشتا: عود وعنبر.']);
  await executeChat(ask('عايز عطر للشتا'), { env, fetch: plain.request, webGate, now: () => TODAY });
  assert.equal(asked.length, 0);
  assert.doesNotMatch(JSON.stringify(plain.bodies[0]), /بوابة الإنترنت/);
});

test('the visitor sees the links of a live answer (other answers keep theirs hidden until asked)', () => {
  const reply = 'البترول نزل.\n\nالمصادر: [rte.ie](https://www.rte.ie/news/business/oil)';
  assert.match(publicChatResult({ reply, sources: news.sources }, 'ايه اخبار النهارده').reply, /rte\.ie/);
  assert.equal(publicChatResult({ reply, sources: [...news.sources, ...news.sources.map((s, i) => ({ ...s, url: `${s.url}x${i}` })), ...news.sources.map((s, i) => ({ ...s, url: `${s.url}y${i}` }))] }, 'ايه اخبار النهارده').sources?.length, 5,
    'more than five links are trimmed, not all dropped');
});

test('no AI platform answers: a live question gets what the gate found, dated and with its links — never his old memory', async () => {
  const asked: any[] = [];
  const webGate = { fetch: async (body: any) => { asked.push(body); return news; } };
  const app = express();
  app.use(express.json());
  // No platform key at all: every engine is «not configured».
  app.use('/api', createShaheenRouter({ repo: new Repository(new MemoryStore(), {}), env: { SHAM_ANSWER_CACHE_MINUTES: '0', SHAM_LIVE_DATA: 'off' }, fetch: (async () => { throw new Error('no network in tests'); }) as typeof fetch, webGate }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'روح للانترنت وحللى الاخبار انهاردة', model: 'auto', language: 'ar', conversationHistory: [], visitorId: 'v-live-0001' }),
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { reply: string; sources?: { url: string }[]; memory?: string };
    assert.ok(asked.length >= 1);
    assert.equal(body.memory, 'live');
    assert.match(body.reply, /من الإنترنت النهارده/);
    assert.match(body.reply, /94 دولار/);
    assert.match(body.reply, /rte\.ie/);
    assert.equal(body.sources?.[0]?.url, 'https://www.rte.ie/news/business/oil');
  } finally { server.close(); }
});
