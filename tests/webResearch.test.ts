/**
 * «باحث شاهين» — a new question looked up in open sources (Wikipedia's public API), read, analysed and answered
 * naturally; source links are kept as metadata for an explicit request. A fake Wikipedia only (tests never touch the network).
 */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import express from 'express';
import { emptyMemory } from '../src/utils/shaheenMemory';
import { analyse, articleUrl, research, researchAnswer, researchQueries } from '../src/utils/webResearch';
import { ShaheenMemory } from '../server/core/memory';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { createShaheenRouter } from '../server/shaheen';

const ARTICLES: Record<string, string> = {
  'بخور': 'البخور هو مادة عطرية تحرق لتطلق دخانا ذا رائحة طيبة.\nتاريخ\nاستخدم المصريون القدماء البخور في المعابد منذ آلاف السنين، وكان اللبان والمر من أشهر مكوناته.\nيصنع البخور العربي عادة من خشب العود المنقوع في الزيوت العطرية ثم يجفف.\nمراجع\nالبخور في الموسوعة الكبرى، صفحة 12، طبعة قديمة جدا للمراجع.',
  'عود (بخور)': 'العود خشب عطري يتكون في أشجار الأكويلاريا عند إصابتها، ويستخدم في صناعة البخور والعطور الشرقية.\nيصنع البخور العربي عادة من خشب العود المنقوع في الزيوت العطرية، ويحرق في المناسبات.',
  'عود (آلة)': 'العود آلة موسيقية وترية شرقية قديمة، ويعزف عليها في الموسيقى العربية منذ قرون طويلة جدا.',
  'مصر القديمة': 'مصر القديمة حضارة نشأت على ضفاف النيل منذ أكثر من خمسة آلاف سنة، واشتهرت بالأهرامات.',
};
const calls: string[] = [];
const wiki = (async (url: string, init?: { headers?: Record<string, string> }) => {
  calls.push(url);
  const u = new URL(url);
  assert.equal(u.searchParams.get('origin'), '*', 'CORS-open requests (they also run in the visitor’s browser)');
  if (init?.headers) assert.match(init.headers['User-Agent'] || '', /ShamPerfumeShaheen/, 'the server says who it is');
  if (u.searchParams.get('list') === 'search') {
    const q = u.searchParams.get('srsearch') || '';
    const hits = /بخور/.test(q) ? ['مصر القديمة', 'بخور', 'عود (بخور)'] : /عود/.test(q) ? ['عود (آلة)', 'عود (بخور)'] : [];
    return new Response(JSON.stringify({ query: { search: hits.map((title) => ({ title })) } }));
  }
  const title = u.searchParams.get('titles') || '';
  return new Response(JSON.stringify({ query: { pages: [{ title, extract: ARTICLES[title] || '' }] } }));
}) as never;

test('what is looked up: the question’s topic, never news, prices or personal details', () => {
  assert.deepEqual(researchQueries('ايه هو البخور وبيتعمل ازاي؟', 'ar'), ['بخور', 'بخور عطور'], 'the topic alone, then in the perfume context');
  assert.equal(researchQueries('ايه اخبار العطور النهارده', 'ar'), undefined);
  assert.equal(researchQueries('سعر البخور كام', 'ar'), undefined);
  assert.equal(researchQueries('رقمي 01012345678 عايز بخور', 'ar'), undefined);
  assert.equal(researchQueries('عطر', 'ar'), undefined, 'nothing to look up');
  assert.equal(researchQueries('مرحبا', 'ar'), undefined, 'a greeting is not a question');
  assert.equal(researchQueries('السلام عليكم', 'ar'), undefined);
  assert.equal(articleUrl('ar', 'عود (بخور)').includes('('), false, 'brackets escaped so the chat link stays whole');
});

test('read and compare: agreed passages rank first, off-topic text is dropped, and links stay hidden until requested', async () => {
  calls.length = 0;
  const found = (await research(wiki, 'ايه هو البخور وبيتعمل ازاي؟', 'ar'))!;
  assert.ok(found);
  assert.ok(found.passages.length >= 2);
  assert.match(found.passages[0]!.text, /يصنع البخور العربي/, 'the passage two articles agree on is first');
  assert.equal(found.passages[0]!.agreed, 2);
  assert.ok(!found.passages.some((p) => /الأهرامات|الموسوعة الكبرى/.test(p.text)), 'no off-topic or reference-list lines');
  assert.equal(found.passages.filter((p) => /يصنع البخور العربي/.test(p.text)).length, 1, 'one idea once');
  assert.deepEqual(found.sources.map((s) => s.title).sort(), ['بخور', 'عود (بخور)'].sort());
  const answer = researchAnswer(found, { recorded: true });
  assert.match(answer, /الخلاصة/);
  assert.doesNotMatch(answer, /ويكيبيديا|wikipedia|https:\/\//i, 'ordinary replies do not reveal source names or links');
  assert.match(answer, /مش مراجعة من متخصص/);
  assert.match(answer, /سؤالك اتسجل/);
  const withSources = researchAnswer(found, { includeSources: true });
  assert.match(withSources, /\[ويكيبيديا: بخور\]\(https:\/\/ar\.wikipedia\.org\/wiki\//);
  assert.match(withSources, /CC BY-SA/);
  assert.equal(await research(wiki, 'ايه هي الطاقة الشمسية في الفضاء', 'ar'), undefined, 'nothing found: nothing invented');
  const oud = (await research(wiki, 'ايه هو العود؟', 'ar'))!;
  assert.deepEqual(oud.sources.map((s) => s.title), ['عود (بخور)'], 'Shaheen’s field is perfume: the musical instrument is left out');
});

test('analysis keeps only passages about the question', () => {
  const src = { title: 't', url: 'u', site: 'wikipedia' as const, lang: 'ar' };
  assert.deepEqual(analyse([{ source: src, text: 'القاهرة مدينة كبيرة جدا وفيها نهر النيل العظيم منذ القدم.' }], 'ايه هو البخور'), []);
});

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
test('every engine down and nothing in his library: the server looks it up and answers from what he read', async () => {
  const fetchAll = (async (url: string, init?: never) => (String(url).includes('wikipedia.org') ? (wiki as (u: string, i?: never) => Promise<Response>)(url, init) : json({ error: { message: 'down' } }, 500))) as typeof fetch;
  const repo = new Repository(new MemoryStore(), {});
  const app = express();
  app.use(express.json());
  app.use('/api', createShaheenRouter({
    repo, env: { OPENAI_API_KEY: 'sk-test', SHAM_ANSWER_CACHE_MINUTES: '0' }, fetch: fetchAll,
    memory: new ShaheenMemory(new MemoryStore(), {}, fetchAll, emptyMemory()), library: async () => ({ lessons: [], materials: [] }),
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const chat = (message: string, conversationHistory: unknown[] = []) => fetch(`${base}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'auto', language: 'ar', conversationHistory, message }) });
  try {
    const res = await chat('ايه هو البخور وبيتعمل ازاي؟');
    assert.equal(res.status, 200);
    const body = await res.json() as { reply: string; memory: string; sources?: { title: string; url: string }[]; engine: { provider: string } };
    assert.equal(body.memory, 'research');
    assert.equal(body.engine.provider, 'shaheen');
    assert.doesNotMatch(body.reply, /ويكيبيديا|https:\/\//i);
    assert.ok(body.sources?.length, 'sources remain available to show on request');
    const cited = await chat('مصدر؟', [
      { role: 'user', text: 'ايه هو البخور وبيتعمل ازاي؟' }, { role: 'assistant', text: body.reply, sources: body.sources },
    ]);
    const citedBody = await cited.json() as { reply: string };
    assert.ok(citedBody.reply.includes('[بخور](https://ar.wikipedia.org/wiki/%D8%A8%D8%AE%D9%88%D8%B1)'));
    assert.equal((await repo.gaps()).length, 1, 'and the question goes to the school, which studies it properly');
    assert.equal((await chat('ايه هي الطاقة الشمسية في الفضاء')).status, 503);
  } finally { await new Promise((done) => server.close(done)); }
});

test('in the browser with no server: library first, then the research, then the honest error', async () => {
  const { createChatStore } = await import('../src/utils/chatStore');
  const offline = (async () => { throw new TypeError('Failed to fetch'); }) as never;
  const order: string[] = [];
  const mem = {
    learn: () => {}, recall: async () => undefined,
    library: async () => { order.push('library'); return undefined; },
    research: async (q: string, lang: string) => { order.push('research'); const r = await research(wiki, q, lang); return r && { answer: researchAnswer(r), sources: r.sources }; },
  };
  const store = createChatStore(offline, async () => {}, mem, async () => undefined);
  await store.send({ model: 'fast', language: 'ar', errorText: () => 'unavailable', text: 'ايه هو البخور وبيتعمل ازاي؟' });
  assert.deepEqual(order, ['library', 'research']);
  const answer = store.getSnapshot().messages.at(-1)!;
  assert.doesNotMatch(answer.text, /ويكيبيديا|https:\/\//i);
  assert.deepEqual(answer.sources?.map((source) => source.title).sort(), ['بخور', 'عود (بخور)'].sort());
});
