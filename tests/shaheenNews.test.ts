import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FEEDS, parseFeed } from '../scripts/shaheen-news/feeds';
import {
  buildNewsFile, buildTrainingFile, CURRICULUM, docsFromTrainer, itemsFromEditor, itemsFromFeeds, mergeNews, newsDoc,
  nextLessons, parseJson, selectCandidates,
} from '../scripts/shaheen-news/curate';
import { asksForNews, liveDataEnabled, newsContext, trainedKnowledge } from '../server/core/liveData';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const gfeed = FEEDS.find((f) => f.kind === 'search')!;
const trade = FEEDS.find((f) => f.kind === 'trade')!;

const rss = `<?xml version="1.0"?><rss><channel>
<item><title>Dior unveils a new oud fragrance - Vogue Arabia</title><link>https://news.google.com/rss/articles/abc</link>
<pubDate>Wed, 14 Oct 2026 09:00:00 GMT</pubDate><description>&lt;a href="x"&gt;Dior unveils&lt;/a&gt;</description><source url="https://vogue.me">Vogue Arabia</source></item>
<item><title><![CDATA[Football: Ahly wins the derby]]></title><link>https://news.google.com/rss/articles/def</link><pubDate>Wed, 14 Oct 2026 10:00:00 GMT</pubDate></item>
<item><title>No link here</title></item>
</channel></rss>`;

test('RSS and Atom feeds are parsed without an XML library, Google titles lose the publisher suffix', () => {
  const items = parseFeed(rss, gfeed);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Dior unveils a new oud fragrance');
  assert.equal(items[0].source, 'Vogue Arabia');
  assert.equal(items[0].publishedAt, '2026-10-14T09:00:00.000Z');
  assert.equal(items[0].snippet, '', 'Google descriptions only repeat the headline');
  const atom = `<feed><entry><title>Rose harvest in Taif &amp; Isparta</title><link href="https://blog.example/rose"/><updated>2026-10-13T08:00:00Z</updated><summary>&lt;p&gt;The rose &amp;amp; jasmine season&lt;/p&gt;</summary></entry></feed>`;
  const [entry] = parseFeed(atom, trade);
  assert.equal(entry.title, 'Rose harvest in Taif & Isparta');
  assert.equal(entry.url, 'https://blog.example/rose');
  assert.equal(entry.snippet, 'The rose & jasmine season');
});

test('only recent perfume stories survive, duplicates and crowding feeds are dropped', () => {
  const base = { snippet: '', lang: 'en' as const, source: 'X' };
  const items = [
    { ...base, title: 'Dior unveils a new oud fragrance', url: 'https://a/1', feed: 'a', publishedAt: '2026-10-14T09:00:00Z' },
    { ...base, title: 'Dior unveils new oud fragrance today', url: 'https://b/2', feed: 'b', publishedAt: '2026-10-14T10:00:00Z' },
    { ...base, title: 'Football: Ahly wins the derby', url: 'https://a/3', feed: 'a', publishedAt: '2026-10-14T10:00:00Z' },
    { ...base, title: 'Old perfume story', url: 'https://a/4', feed: 'a', publishedAt: '2026-09-01T10:00:00Z' },
    { ...base, title: 'عطر جديد من دار عربية', url: 'https://c/5', feed: 'c', publishedAt: '2026-10-15T08:00:00Z', lang: 'ar' as const },
  ];
  const picked = selectCandidates(items, NOW);
  assert.deepEqual(picked.map((p) => p.url), ['https://c/5', 'https://b/2']);
  const many = Array.from({ length: 15 }, (_, i) => ({ ...base, title: `Perfume ${['rose','oud','musk','amber','vanilla','jasmine','iris','vetiver','neroli','saffron','leather','tobacco','cedar','sandal','incense'][i]} launch ${i}`, url: `https://a/${i}`, feed: 'a', publishedAt: '2026-10-14T09:00:00Z' }));
  assert.equal(selectCandidates(many, NOW, 60, 10).length, 10);
});

test("Shaheen's edit is validated: unknown indexes, non-Arabic titles and AI vendor names are dropped", () => {
  const candidates = parseFeed(rss, gfeed);
  const reply = parseJson('```json\n' + JSON.stringify({
    digest: { ar: 'ملخص النشرة', en: 'Digest' },
    items: [
      { i: 0, category: 'launch', importance: 5, title: { ar: 'ديور تطلق عطر عود جמديد', en: 'Dior launches a new oud' }, summary: { ar: 'إطلاق جديد', en: 'New launch' }, note: { ar: 'تعليق Gemini', en: 'ok' } },
      { i: 0, title: { ar: 'مكرر', en: 'dup' } },
      { i: 9, title: { ar: 'مخترع', en: 'invented' } },
      { i: 1, title: { ar: '', en: 'English only' } },
    ],
  }) + '\n```');
  const { items, digest } = itemsFromEditor(reply, candidates);
  assert.equal(items.length, 1);
  assert.equal(items[0].title.ar, 'ديور تطلق عطر عود جديد');
  assert.equal(items[0].url, candidates[0].url);
  assert.equal(items[0].note?.ar, 'ok', 'A vendor name never reaches visitors');
  assert.equal(digest?.ar, 'ملخص النشرة');
});

test('a thin run keeps recent stories from the last run and the file announces the next update in 12 hours', () => {
  const candidates = parseFeed(rss, gfeed).slice(0, 1);
  const fresh = itemsFromFeeds(candidates);
  const old = { ...fresh[0], id: 'old', url: 'https://old', original: 'Rose harvest begins in Taif', publishedAt: '2026-10-12T00:00:00Z' };
  const stale = { ...old, id: 'stale', url: 'https://stale', original: 'Ancient story', publishedAt: '2026-09-01T00:00:00Z' };
  const merged = mergeNews(fresh, [fresh[0], old, stale], NOW);
  assert.deepEqual(merged.map((m) => m.url), [candidates[0].url, 'https://old']);
  const file = buildNewsFile(merged, 'feeds', undefined, new Date(NOW));
  assert.equal(file.nextUpdateAt, '2026-10-16T00:00:00.000Z');
  assert.equal(file.intervalHours, 12);
});

test('Shaheen trains the Sham assistant: unwritten lessons first, valid lessons only, news digest as knowledge', () => {
  const first = nextLessons([], 4);
  assert.deepEqual(first.map((l) => l.id), CURRICULUM.slice(0, 4).map((l) => l.id));
  const content = 'نسبة تركيز الزيت في ماء العطر EDP بين 15 و20 بالمئة، ويثبت من 6 إلى 8 ساعات تقريباً على الجلد، بينما ماء التواليت EDT من 5 إلى 15 بالمئة ويثبت من 3 إلى 5 ساعات، وكولونيا EDC أخف من ذلك.';
  const docs = docsFromTrainer({ docs: [
    { id: 'concentrations', title: 'أنواع تركيز العطور', content, keywords: ['EDP', 'تركيز'] },
    { id: 'made-up', title: 'غير موجود', content },
    { id: 'maceration', title: 'قصير', content: 'قصير جداً' },
  ] }, 'curriculum', first.map((l) => l.id), new Date(NOW));
  assert.deepEqual(docs.map((d) => d.id), ['shaheen-curriculum-concentrations']);
  assert.ok(docs[0].tags.includes('EDP'));
  assert.equal(nextLessons(docs, 1)[0].id, CURRICULUM[1].id, 'Written lessons move to the back of the queue');

  const gap = docsFromTrainer({ docs: [{ i: 0, title: 'هل العطر يفسد؟', content }] }, 'gap', ['g1'], new Date(NOW));
  assert.equal(gap[0].id, 'shaheen-gap-g1');

  const news = buildNewsFile(itemsFromEditor({ items: [{ i: 0, title: { ar: 'ديور تطلق عطر عود', en: 'Dior oud' } }] }, parseFeed(rss, gfeed)).items, 'shaheen', { ar: 'ملخص', en: 'Digest' }, new Date(NOW));
  const digest = newsDoc(news)!;
  assert.match(digest.content, /ديور تطلق عطر عود/);
  assert.ok(digest.tags.includes('أخبار'));
  const oldGap = { ...gap[0], updatedAt: '2026-01-01T00:00:00Z' };
  const file = buildTrainingFile([oldGap, ...docs], [digest], new Date(NOW));
  assert.deepEqual(file.docs.map((d) => d.id).sort(), ['shaheen-curriculum-concentrations', 'shaheen-news-latest']);
});

test('the server uses the published lessons and headlines, refreshing them from the repository in production', async () => {
  assert.equal(liveDataEnabled({}), false);
  assert.equal(liveDataEnabled({ VERCEL: '1' }), true);
  assert.equal(liveDataEnabled({ VERCEL: '1', SHAM_LIVE_DATA: 'off' }), false);
  const updatedAt = '2099-01-01T00:00:00.000Z';
  const calls: string[] = [];
  const fetcher = (async (url: string) => {
    calls.push(String(url));
    const body = String(url).endsWith('sham-training.json')
      ? { updatedAt, docs: [{ id: 'shaheen-curriculum-storage', title: 'حفظ العطر', content: 'احفظ العطر بعيداً عن الحرارة', tags: ['حفظ'], updatedAt }] }
      : { updatedAt, items: [{ id: 'n1', url: 'https://x', source: 'Vogue', publishedAt: updatedAt, title: { ar: 'إطلاق عطر جديد', en: 'New launch' }, summary: { ar: '', en: '' } }] };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  const env = { SHAM_LIVE_DATA: 'on', SHAM_LIVE_DATA_URL: 'https://data.example/live' };
  const docs = await trainedKnowledge(env, fetcher);
  assert.equal(docs[0].id, 'shaheen-curriculum-storage');
  assert.equal(calls[0], 'https://data.example/live/sham-training.json');
  await trainedKnowledge(env, fetcher);
  assert.equal(calls.filter((c) => c.endsWith('sham-training.json')).length, 1, 'Cached between requests');
  assert.equal(asksForNews('ايه آخر أخبار العطور؟'), true);
  assert.equal(asksForNews('كم يوم اعتق العطر'), false);
  assert.match(await newsContext('ايه الجديد في العطور؟', 'ar', env, fetcher), /إطلاق عطر جديد/);
  assert.equal(await newsContext('كم يوم اعتق العطر', 'ar', env, fetcher), '');
});
