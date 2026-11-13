import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createNewsRouter, explainPrompt, explainSystem, readExplanation } from '../server/newsExplain';
import { arabicContext, asCandidate, itemsFromFeeds, needsArabic, storyId, withArabicContext, type NewsFile, type NewsItem } from '../scripts/shaheen-news/curate';
import { NEWS_EXPLAIN_TEXT } from '../src/components/newsExplainText';

const VENDOR = /gemini|openai|chatgpt|claude|anthropic|deepseek|openrouter|perplexity|llama|mistral/i;
const raw = { title: 'XTRAIT Perfumery to Bring Hundreds of Niche Fragrances to Boston', url: 'https://example.com/a', source: 'WhatNow', publishedAt: '2026-11-12T22:01:09.000Z', snippet: '', feed: 'f', lang: 'en' as const };

test('news: headlines-only stories still carry an honest Arabic line, and go back to the editor later', () => {
  const [item] = itemsFromFeeds([raw]);
  assert.equal(item!.title.ar, raw.title);
  assert.match(item!.summary.ar, /[\u0600-\u06FF]/);
  assert.match(item!.summary.ar, /WhatNow/);
  assert.match(item!.summary.ar, /الإنجليزي/);
  assert.equal(needsArabic(item!), true);
  const back = asCandidate(item!);
  assert.equal(back.title, raw.title);
  assert.equal(storyId(back), item!.id, 'the same story keeps its id, so the edited version replaces it');
  const arabic = itemsFromFeeds([{ ...raw, title: 'إطلاق عطر عود جديد في دبي', lang: 'ar', snippet: 'تفاصيل الإطلاق' }])[0]!;
  assert.equal(needsArabic(arabic), false);
  assert.equal(arabic.summary.ar, 'تفاصيل الإطلاق');
  assert.match(arabicContext({ ...raw, lang: 'fr', title: 'Lancement d’un parfum' }), /الفرنساوي/);
  const old = { ...item!, summary: { ar: raw.title, en: raw.title } };
  assert.match(withArabicContext(old).summary.ar, /منشور بالإنجليزي/);
  assert.equal(withArabicContext(arabic), arabic);
});

test('news explain: the instruction asks for the visitor’s language, facts only, and never names a vendor', () => {
  assert.match(explainSystem('ar'), /مصرية/);
  assert.match(explainSystem('fr'), /French/);
  assert.match(explainSystem('ja'), /Japanese/);
  assert.match(explainSystem('ar'), /ممنوع تخترع/);
  assert.doesNotMatch(explainSystem('ar'), VENDOR);
  const prompt = explainPrompt(itemsFromFeeds([raw])[0]!);
  assert.match(prompt, /XTRAIT/);
  assert.match(prompt, /WhatNow/);
  assert.deepEqual(readExplanation('```json\n{"title":"عنوان","summary":"ملخص","note":"رأي"}\n```'), { title: 'عنوان', summary: 'ملخص', note: 'رأي' });
  assert.equal(readExplanation('no json'), undefined);
  assert.equal(readExplanation('{"title":"x"}'), undefined);
  assert.equal(readExplanation('{"title":"t","summary":"written by Gemini"}'), undefined);
});

const file = (items: NewsItem[]): NewsFile => ({ version: 1, updatedAt: '2026-11-13T00:00:00Z', nextUpdateAt: '2026-11-13T12:00:00Z', intervalHours: 12, editor: 'feeds', sources: [], items });
async function withServer(env: Record<string, string>, fetcher: typeof fetch, run: (base: string) => Promise<void>) {
  const story = itemsFromFeeds([raw])[0]!;
  const app = express();
  app.use(express.json());
  app.use('/api/news', createNewsRouter({ env, fetch: fetcher, news: async () => file([story]) }));
  const server = app.listen(0);
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/news`); } finally { server.close(); }
}
const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('news explain route: only published stories, cached per language, honest when no engine is open', async () => {
  const id = itemsFromFeeds([raw])[0]!.id;
  let calls = 0;
  const engine = (async (url: string) => {
    calls += 1;
    assert.match(String(url), /googleapis/);
    return Response.json({ candidates: [{ content: { parts: [{ text: '{"title":"دار عطور جديدة في بوسطن","summary":"XTRAIT هتفتح محل فيه مئات العطور النيش في بوسطن.","note":"فرصة لمحبي العطور النادرة."}' }] } }] });
  }) as unknown as typeof fetch;
  await withServer({ GEMINI_API_KEY: 'k' }, engine, async (base) => {
    assert.equal((await post(`${base}/explain`, { id: 'bad id!' })).status, 400);
    assert.equal((await post(`${base}/explain`, { id: 'nzzzz' })).status, 404);
    const first = await post(`${base}/explain`, { id, language: 'ar' });
    assert.equal(first.status, 200);
    const body = await first.json() as { title: string; summary: string };
    assert.match(body.title, /بوسطن/);
    const again = await (await post(`${base}/explain`, { id, language: 'ar' })).json() as { cached?: boolean };
    assert.equal(again.cached, true);
    assert.equal(calls, 1);
  });
  await withServer({}, engine, async (base) => {
    const r = await post(`${base}/explain`, { id, language: 'en' });
    assert.equal(r.status, 503);
    assert.doesNotMatch(JSON.stringify(await r.json()), VENDOR);
  });
});

test('news explain: the button speaks the ten main languages', () => {
  for (const [key, row] of Object.entries(NEWS_EXPLAIN_TEXT)) {
    for (const lang of ['ar', 'en', 'fr', 'es', 'it', 'de', 'ru', 'zh', 'tr', 'fa']) assert.ok((row as Record<string, string>)[lang]?.trim(), `${key}.${lang}`);
  }
});
