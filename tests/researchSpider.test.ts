import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createResearchSpider } from '../src/utils/researchSpider';

function fixture(options: { fail?: boolean } = {}) {
  let requests = 0;
  let active = 0;
  let peak = 0;
  const request = async (url: string) => {
    requests++; active++; peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active--;
    if (options.fail) return new Response('', { status: 503 });
    const u = new URL(url);
    return new Response(JSON.stringify({ query: u.searchParams.has('list')
      ? { search: [{ title: 'بخور' }] }
      : { pages: [{ extract: 'البخور هو مادة عطرية تحرق لتطلق دخانا ذا رائحة طيبة ويستخدم البخور في صناعة العطور الشرقية.' }] } }));
  };
  return { request, counts: () => ({ requests, peak }) };
}

test('spider coalesces concurrent public documents, caches them and preserves citations', async () => {
  const f = fixture();
  const spider = createResearchSpider(f.request, { concurrency: 1 });
  const answers = await Promise.all(Array.from({ length: 5 }, () => spider.search('ايه هو البخور وبيتعمل ازاي؟', 'ar')));
  assert.ok(answers.every((a) => a?.sources[0].url.includes('wikipedia.org/wiki/')));
  assert.equal(f.counts().peak, 1);
  const before = f.counts().requests;
  await spider.search('ايه هو البخور وبيتعمل ازاي؟', 'ar');
  assert.equal(f.counts().requests, before);
  assert.ok(spider.status().hits > 0);
  assert.equal(spider.status().pending, 0);
});

test('spider expires and bounds documents; never requests personal or live questions', async () => {
  let now = 100;
  const f = fixture();
  const spider = createResearchSpider(f.request, { ttlMs: 10, now: () => now, maxEntries: 2 });
  await spider.search('رقمي 01012345678 عايز بخور', 'ar');
  await spider.search('سعر البخور كام النهارده', 'ar');
  assert.equal(f.counts().requests, 0);
  await spider.search('ايه هو البخور وبيتعمل ازاي؟', 'ar');
  const before = f.counts().requests;
  assert.ok(spider.status().cachedDocuments <= 2);
  now += 11;
  await spider.search('ايه هو البخور وبيتعمل ازاي؟', 'ar');
  assert.ok(f.counts().requests > before);
  spider.clear();
  assert.equal(spider.status().cachedDocuments, 0);
});

test('unavailable sources produce no invented results and failures are not cached', async () => {
  const f = fixture({ fail: true });
  const spider = createResearchSpider(f.request);
  assert.equal(await spider.search('ايه هو البخور وبيتعمل ازاي؟', 'ar'), undefined);
  assert.equal(spider.status().cachedDocuments, 0);
  assert.ok(spider.status().failures > 0);
});

test('oversized, malformed and API-level quota errors never enter the cache', async () => {
  for (const body of ['x'.repeat(512_001), '{broken', JSON.stringify({ error: { code: 'ratelimited' } })]) {
    let requests = 0;
    const spider = createResearchSpider(async () => {
      requests++;
      return new Response(body);
    });
    assert.equal(await spider.search('ايه هو البخور وبيتعمل ازاي؟', 'ar'), undefined);
    assert.equal(spider.status().cachedDocuments, 0);
    const before = requests;
    await spider.search('ايه هو البخور وبيتعمل ازاي؟', 'ar');
    assert.ok(requests > before, 'failure must be retried, not served from cache');
    assert.equal(spider.status().active, 0);
    assert.equal(spider.status().pending, 0);
  }
});
