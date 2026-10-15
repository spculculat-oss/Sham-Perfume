import assert from 'node:assert/strict';
import test from 'node:test';
import type { PerfumeNewsItem } from '../src/data/perfumeNews';
import { isNewsArticle, mergeNewsArticles, restoreNewsCache, resolveNewsImage } from '../src/utils/newsCache';

function article(id: string, overrides: Partial<PerfumeNewsItem> = {}): PerfumeNewsItem {
  return {
    id,
    titleAr: 'عنوان',
    titleEn: 'Title',
    summaryAr: 'ملخص',
    category: 'niche',
    categoryLabelAr: 'نيش',
    ...overrides,
  };
}

test('updated bundled news and translations replace old cached copies', () => {
  const fresh = article('seed', { summaryEn: 'New English translation', imageUrl: '/new-hash.jpg' });
  const cached = article('seed', { summaryEn: 'Old translation', imageUrl: '/old-hash.jpg' });
  const remote = article('remote');

  const restored = restoreNewsCache(JSON.stringify([cached, remote]), [fresh]);
  assert.deepEqual(restored, [remote, fresh]);
  assert.equal(restored.find((item) => item.id === 'seed')?.summaryEn, 'New English translation');
});

test('malformed, empty and inaccessible cache data retain bundled articles', () => {
  const bundled = [article('seed')];
  for (const raw of [null, '', '{invalid', '{}', 'null', '[null, 1, "bad", {}]', '[]']) {
    assert.deepEqual(restoreNewsCache(raw, bundled), bundled);
  }
});

test('invalid optional fields are rejected before rendering cached news', () => {
  const valid = article('valid', { tags: ['news'], keyNotes: [{ nameAr: 'ورد', percentageHint: 50 }] });
  assert.equal(isNewsArticle(valid), true);
  for (const overrides of [
    { category: 'unknown' }, { titleAr: 3 }, { tags: [null] },
    { keyNotes: [null] }, { keyNotes: [{ nameAr: 'ورد', nameEn: 3 }] },
    { imageUrl: {} }, { contentAr: 3 }, { summaryEn: {} },
    { keyNotes: [{ nameAr: 'ورد', percentageHint: '50' }] },
  ]) {
    assert.equal(isNewsArticle({ ...valid, ...overrides }), false);
  }
});

test('old fabricated refresh articles are removed without deleting genuine cached articles', () => {
  const real = article('provider-article');
  const fabricated = article('shaheen-local-refresh-123');
  const oldServerFallback = article('shaheen-daily-123-1');
  const seed = article('seed');
  assert.deepEqual(restoreNewsCache(JSON.stringify([fabricated, oldServerFallback, real]), [seed]), [real, seed]);
});

test('incoming news wins and duplicate IDs do not accumulate', () => {
  const existing = article('same', { titleEn: 'Old' });
  const updated = article('same', { titleEn: 'New' });
  const other = article('other');
  assert.deepEqual(mergeNewsArticles([existing, other], [updated, updated]), [updated, other]);
});

test('image resolution supports current Pages base paths and safe external images', () => {
  const current = '/Sham-Perfume/assets/news-new.jpg';
  const fallback = '/Sham-Perfume/assets/fallback.jpg';
  for (const image of [current, 'https://example.com/news.jpg', 'data:image/png;base64,abc']) {
    assert.equal(resolveNewsImage(image, [current], fallback), image);
  }
  for (const image of [undefined, '/src/assets/images/news.jpg', '/assets/old-hash.jpg', './assets/old-hash.jpg', 'javascript:alert(1)', 'data:text/html,bad']) {
    assert.equal(resolveNewsImage(image, [current], fallback), fallback);
  }
});
