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

test('oversized and malformed responses never enter the cache', async () => {
  for (const body of ['x'.repeat(512_001), '{broken']) {
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


test('quota and overload responses pause the origin, including queued work, until Retry-After', async () => {
  for (const failure of [
    () => new Response('', { status: 429, headers: { 'retry-after': '120' } }),
    () => new Response('', { status: 503, headers: { 'retry-after': '120' } }),
    () => new Response(JSON.stringify({ error: { code: 'ratelimited' } }), { headers: { 'retry-after': '120' } }),
    () => new Response(JSON.stringify({ error: { code: 'maxlag' } }), { headers: { 'retry-after': '120' } }),
  ]) {
    let now = 1_000;
    let requests = 0;
    const spider = createResearchSpider(async () => { requests++; return failure(); }, { now: () => now, concurrency: 1 });
    const question = 'ايه هو البخور وبيتعمل ازاي؟';
    assert.equal(await spider.search(question, 'ar'), undefined);
    assert.equal(requests, 1, 'queued search must not bypass newly started cooldown');
    spider.clear();
    await spider.search(question, 'ar');
    assert.equal(requests, 1, 'clearing documents must not reset quota protection');
    now += 119_999;
    await spider.search(question, 'ar');
    assert.equal(requests, 1);
    now++;
    await spider.search(question, 'ar');
    assert.equal(requests, 2, 'requests resume only after the deadline');
    assert.equal(spider.status().active, 0);
    assert.equal(spider.status().pending, 0);
  }
});

test('HTTP-date Retry-After is respected; invalid headers use a one-minute cooldown', async () => {
  for (const retryAfter of ['Thu, 22 Oct 2026 12:02:00 GMT', 'invalid']) {
    let now = Date.parse('2026-10-22T12:00:00Z');
    let requests = 0;
    const spider = createResearchSpider(async () => {
      requests++;
      return new Response('', { status: 429, headers: { 'retry-after': retryAfter } });
    }, { now: () => now, concurrency: 1 });
    await spider.search('ايه هو البخور وبيتعمل ازاي؟', 'ar');
    now += 59_999;
    await spider.search('ايه هو البخور وبيتعمل ازاي؟', 'ar');
    assert.equal(requests, 1);
    await spider.search('what is incense made from?', 'en');
    assert.equal(requests, 2, 'different origins have separate cooldowns');
    now += retryAfter === 'invalid' ? 1 : 60_001;
    await spider.search('ايه هو البخور وبيتعمل ازاي؟', 'ar');
    assert.equal(requests, 3);
  }
});

test('fresh public documents remain usable while their origin is cooling down', async () => {
  const f = fixture();
  let limited = false;
  let requests = 0;
  const spider = createResearchSpider(async (url, init) => {
    requests++;
    return limited
      ? new Response('', { status: 429, headers: { 'retry-after': '120' } })
      : f.request(url);
  }, { concurrency: 1 });
  const question = 'ايه هو البخور وبيتعمل ازاي؟';
  const original = await spider.search(question, 'ar');
  assert.ok(original?.passages.length);
  limited = true;
  await spider.search('كيف يستخرج خشب العود؟', 'ar');
  assert.equal(spider.status().coolingSources, 1);
  const before = requests;
  const cached = await spider.search(question, 'ar');
  assert.deepEqual(cached, original);
  assert.equal(requests, before, 'cached findings must not request the paused source');
});
