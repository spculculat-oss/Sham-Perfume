import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesNewsQuery, newsDate, normalizeNewsQuery, readNewsBookmarks } from '../src/components/news/newsDesk';

test('news search handles Arabic diacritics, accents, and different numeral systems', () => {
  assert.equal(normalizeNewsQuery('  أَكُـورْد اليَاسَمِين  ٢٠٢٦  '), 'اكورد الياسمين  2026');
  assert.ok(matchesNewsQuery('جِرَاس ۲۰۲۶', 'حصاد ورد جراس', '2026'));
  assert.ok(matchesNewsQuery('eau Guerlain', 'GUERLAIN release', 'Éau de parfum'));
  assert.ok(!matchesNewsQuery('eau jasmine', 'Éau de parfum', undefined));
  assert.ok(matchesNewsQuery('ـ ', 'Any report'));
});

test('saved reports migration is defensive and preserves ordered unique IDs', () => {
  assert.deepEqual(readNewsBookmarks(null), []);
  assert.deepEqual(readNewsBookmarks('not JSON'), []);
  assert.deepEqual(readNewsBookmarks('{"saved":true}'), []);
  assert.deepEqual(readNewsBookmarks('["a",{},"b","a",null," ",808]'), ['a', 'b']);
});

test('edition dates use an explicit UTC day and the selected site language', () => {
  assert.equal(newsDate(undefined, 'ar'), '');
  assert.equal(newsDate('not a date', 'en'), '');
  const midnight = '2026-11-19T00:02:00Z';
  assert.match(newsDate(midnight, 'ar'), /١٩.*٢٠٢٦/);
  assert.match(newsDate(midnight, 'en'), /19.*2026/);
  assert.doesNotMatch(newsDate(midnight, 'de'), /[٠-٩]/);
});
