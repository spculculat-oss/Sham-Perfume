import test from 'node:test';
import assert from 'node:assert/strict';
import { LIBRARY_BOOKS, BOOK_CATEGORIES, searchBooks, exportLibraryArchive } from '../src/library/catalog';
import { BOTS, LINKS } from '../src/utils/shaheenOrg';

test('sixteen unique, classified complete academic books, without invented ebook availability', () => {
  assert.equal(LIBRARY_BOOKS.length, 16);
  assert.equal(new Set(LIBRARY_BOOKS.map(b => b.id)).size, 16);
  for (const b of LIBRARY_BOOKS) {
    assert.ok(BOOK_CATEGORIES[b.category]);
    assert.equal(b.access, 'complete');
    assert.equal(b.metadataStatus, 'verified');
    assert.ok(b.summary.ar && b.summary.en);
  }
});
test('local librarian finds authors, Arabic subjects, archive IDs and filters categories', () => {
  assert.equal(searchBooks('ROJA')[0].id, 'SHAM-LIB-008');
  assert.equal(searchBooks('Muller')[0].id, 'SHAM-LIB-003');
  assert.ok(searchBooks('الجزيئي').length);
  assert.equal(searchBooks('SHAM-LIB-004').length, 1);
  assert.equal(searchBooks('', 'chemistry').length, 3);
  assert.equal(searchBooks('Roja', 'chemistry').length, 0);
  assert.equal(searchBooks('not-a-book').length, 0);
});
test('archive round trips and librarian belongs to Shaheen with legal coordination', () => {
  assert.deepEqual(JSON.parse(exportLibraryArchive()).books, JSON.parse(JSON.stringify(LIBRARY_BOOKS)));
  assert.equal(BOTS.find(b => b.id === 'librarian')?.dept, 'content');
  assert.ok(LINKS.some(l => l.from === 'legal' && l.to === 'librarian'));
});

test('cosmetics and aromatherapy additions are archived without therapeutic endorsement', () => {
  assert.equal(searchBooks('', 'cosmetics').length, 5);
  assert.equal(searchBooks('', 'aromatherapy').length, 4);
  assert.equal(searchBooks('Tisserand')[0].id, 'SHAM-LIB-016');
  assert.equal(searchBooks('المستحلبات')[0].id, 'SHAM-LIB-011');
  assert.match(searchBooks('SHAM-LIB-009')[0].summary.en, /require bibliographic verification/);
  assert.deepEqual(LIBRARY_BOOKS.slice(0, 8).map(b => b.id), Array.from({ length: 8 }, (_, i) => `SHAM-LIB-${String(i + 1).padStart(3, '0')}`));
});
