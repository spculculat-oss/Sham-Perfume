import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ISLAMIC_BOOKS, ISLAMIC_BOOK_COUNT, ISLAMIC_DIRECTORIES, ISLAMIC_SHELVES, SHAMELA_CATEGORIES, searchIslamicShelves } from '../src/library/islamic/catalog';
import { ISLAMIC_LIBRARY_HASH } from '../src/library/islamic/entry';
import { FIRST_AYAH, parseQuranBookmark, parseTanzilUthmani, QURAN_ASSET, QURAN_INTEGRITY, quranPage, quranPlace } from '../src/library/islamic/quran';
import { QURAN_SURAHS } from '../src/library/islamic/quranSurahs';
import { ISLAMIC_BOOKS_BY_ID, islamicBookHash, readIslamicBookHash } from '../src/library/islamic/routes';
import { pageFeature, pageGuide } from '../server/core/pageGuide';
import { tabSeo } from '../src/seo/pages';

const rawFile = new URL(`../public/${QURAN_ASSET}`, import.meta.url);
const localIds = (query: string, shelf: Parameters<typeof searchIslamicShelves>[1] = 'all') => searchIslamicShelves(query, shelf).flatMap((g) => g.books.map((b) => b.id));

test('11 nonempty reading shelves distinguish the full Quran from verified-edition URLs', () => {
  assert.equal(ISLAMIC_SHELVES.length, 11);
  assert.equal(ISLAMIC_BOOK_COUNT, 55);
  const works = Object.values(ISLAMIC_BOOKS).flat();
  const files = works.filter((book) => book.access.kind !== 'source');
  assert.deepEqual(files.map((book) => book.id), ['mushaf']);
  assert.equal(ISLAMIC_BOOKS_BY_ID.size, works.length);
  for (const s of ISLAMIC_SHELVES) {
    assert.ok(ISLAMIC_BOOKS[s.id].length >= 4, s.id);
    assert.ok(s.directories.every((id) => SHAMELA_CATEGORIES[id]), s.id);
  }
  const urls = new Set();
  for (const work of works) {
    assert.match(work.id, /^[a-z0-9-]+$/);
    for (const lc of ['ar', 'en'] as const) assert.ok(work.title[lc] && work.byline[lc] && work.summary[lc], work.id);
    if (work.access.kind === 'source') {
      const u = new URL(work.access.url);
      assert.equal(u.protocol, 'https:');
      assert.ok(!urls.has(u.href), u.href);
      urls.add(u.href);
      assert.ok(!u.hash && !u.search && !u.username && !u.password);
      if (work.access.catalogue === 'shamela') {
        assert.equal(u.host, 'shamela.ws'); assert.match(u.pathname, /^\/book\/\d+$/); assert.ok(work.access.edition?.ar);
      } else if (work.access.catalogue === 'sunnah') {
        assert.equal(u.host, 'sunnah.com'); assert.match(u.pathname, /^\/[a-z0-9]+$/);
      } else {
        assert.equal(u.host, 'islamhouse.com'); assert.match(u.pathname, /^\/read\/ar\/.+-\d+$/);
      }
    }
  }
  assert.equal(urls.size, 54);
  assert.equal(ISLAMIC_DIRECTORIES.length, 3);
});

test('search ignores Arabic vocalization, supports aliases, and intersects the active shelf', () => {
  assert.deepEqual(localIds('تَفْسِير إبن كَثِير'), ['ibn-kathir']);
  assert.deepEqual(localIds('جامع البيان'), ['tabari-tafsir']);
  assert.deepEqual(localIds('بُخاري', 'hadith'), ['bukhari']);
  assert.deepEqual(localIds('المدونة', 'fiqh'), ['mudawwana']);
  assert.deepEqual(localIds('Sahih Muslim'), ['muslim']);
  assert.deepEqual(localIds('40 حديث'), ['nawawi-forty']);
  assert.deepEqual(localIds('البخاري', 'tafsir'), []);
  assert.deepEqual(localIds('undefined-no-match'), []);
  assert.equal(localIds('   ').length, ISLAMIC_BOOK_COUNT);
});

test('book and verse hashes are shareable without accepting unknown books or positions', () => {
  assert.equal(readIslamicBookHash(ISLAMIC_LIBRARY_HASH), undefined);
  assert.equal(readIslamicBookHash('#world_perfumes?book=mushaf'), undefined);
  assert.equal(readIslamicBookHash('#islamic_library?book=https%3A%2F%2Fexample.com'), undefined);
  assert.equal(readIslamicBookHash('#islamic_library?book=__proto__'), undefined);
  assert.equal(readIslamicBookHash(islamicBookHash('ibn-kathir'))?.shelf.id, 'tafsir');
  assert.deepEqual(readIslamicBookHash(islamicBookHash('mushaf', { surah: 2, ayah: 255 }))?.place, { surah: 2, ayah: 255 });
  assert.deepEqual(readIslamicBookHash('#islamic_library?book=mushaf&surah=١١٤&ayah=٦')?.place, { surah: 114, ayah: 6 });
  assert.deepEqual(readIslamicBookHash('#islamic_library?book=mushaf&surah=2&ayah=999')?.place, { surah: 2, ayah: 1 });
  assert.deepEqual(readIslamicBookHash('#islamic_library?book=mushaf&surah=999&ayah=1')?.place, FIRST_AYAH);
  assert.equal(pageGuide(islamicBookHash('mushaf'))?.id, 'islamic_library');
  assert.equal(pageFeature('islamic_library'), 'islamic_library');
  assert.equal(tabSeo('islamic_library').path, 'tools/islamic-library.html');
});

test('Tanzil text is the pinned verbatim Uthmani v1.1 asset, with 114 complete surahs and 6236 verses', async () => {
  const bytes = await readFile(rawFile);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '4b91f9e6e8ac645d039e4ed85b3be492e795232a31cd22d668ac58238722e26f');
  assert.equal(`sha256-${createHash('sha256').update(bytes).digest('base64')}`, QURAN_INTEGRITY);
  const raw = bytes.toString('utf8');
  const parsed = parseTanzilUthmani(raw);
  assert.equal(QURAN_SURAHS.length, 114);
  assert.deepEqual(parsed.map((verses) => verses.length), QURAN_SURAHS.map((s) => s.verses));
  assert.equal(parsed.flat().length, 6236);
  assert.deepEqual(parsed.flat(), raw.split(/\r?\n/).filter((line) => /^\d+\|/.test(line)).map((line) => line.split('|')[2]));
  assert.match(raw, /Copyright \(C\) 2007–2026 Tanzil Project|Copyright \(C\) 2007-2026 Tanzil Project/);
  assert.match(raw, /Creative Commons Attribution 3\.0/);
  assert.equal(parsed[0][0], 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ');
  assert.match(parsed[1][0], /^بِسْمِ /);
  assert.match(parsed[8][0], /^بَرَآءَةٌ /);
  assert.match(parsed[1][254], /ٱلْحَىُّ ٱلْقَيُّومُ/);
  assert.equal(parsed[113][5], 'مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ');
  assert.match(parsed[1][1], /ۛ/);
});

test('a substituted HTML, partial corpus or misnumbered verse cannot be shown as the Quran', async () => {
  const raw = await readFile(rawFile, 'utf8');
  for (const bad of ['<!doctype html><title>Not Found</title>', raw.replace(/^1\|1\|.*\n/, ''), raw.replace(/^1\|1\|/, '1|2|'), raw.replace(/Tanzil Quran Text/, 'No source')]) {
    assert.throws(() => parseTanzilUthmani(bad));
  }
});

test('reading position and paging handle chapter boundaries and malformed local storage', () => {
  assert.equal(quranPlace(9, 0), undefined);
  assert.equal(quranPlace('0x2', '1'), undefined);
  assert.equal(quranPlace('1e2', '1'), undefined);
  assert.equal(quranPlace(114, 7), undefined);
  const fatiha = quranPage(FIRST_AYAH);
  assert.equal(fatiha.previous, undefined);
  assert.equal(fatiha.end, 7);
  assert.deepEqual(fatiha.next, { surah: 2, ayah: 1 });
  const ayatAlKursi = quranPage({ surah: 2, ayah: 255 });
  assert.equal(ayatAlKursi.start, 241);
  assert.equal(ayatAlKursi.end, 256);
  assert.deepEqual(ayatAlKursi.next, { surah: 2, ayah: 257 });
  assert.equal(quranPage({ surah: 114, ayah: 1 }).next, undefined);
  assert.deepEqual(parseQuranBookmark('{"surah":114,"ayah":6}'), { surah: 114, ayah: 6 });
  assert.equal(parseQuranBookmark('bad JSON'), undefined);
  assert.equal(parseQuranBookmark('{"surah":0,"ayah":5}'), undefined);
});
