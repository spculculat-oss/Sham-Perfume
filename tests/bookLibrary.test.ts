import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIBRARY_BOOKS, EAST_ASIAN_BOOKS, EAST_ASIAN_LANGUAGES, EAST_ASIAN_LANGUAGE_COVERAGE,
  EAST_ASIAN_CATALOG_SCOPE, BOOK_CATEGORIES, searchBooks, exportLibraryArchive,
  booksForTrack, approvedBooksForTrack,
} from '../src/library/catalog';
import { BOTS, LINKS } from '../src/utils/shaheenOrg';
import {
  TRACKS, academyLibraryCoverage, academyLibraryReferences, approvedAcademyLibraryBooks,
} from '../scripts/shaheen-school/curriculum';

test('catalogue contains unique whole-book records and makes no false full-text or verification claim', () => {
  assert.equal(LIBRARY_BOOKS.length, 60);
  assert.equal(EAST_ASIAN_BOOKS.length, 44);
  assert.equal(new Set(LIBRARY_BOOKS.map(b => b.id)).size, LIBRARY_BOOKS.length);
  const trackIds = new Set<string>(TRACKS.map(track => track.id));
  for (const b of LIBRARY_BOOKS) {
    assert.ok(BOOK_CATEGORIES[b.category], `${b.id} has an unknown category`);
    assert.ok(['complete-book', 'complete-reference-work'].includes(b.workKind));
    assert.equal(b.access, 'metadata-only');
    assert.equal(b.metadataStatus, 'pending-edition-verification');
    assert.equal(b.schoolApproval, 'pending-review');
    assert.ok(b.summary.ar && b.summary.en);
    assert.ok(b.trackIds.length > 0);
    for (const track of b.trackIds) assert.ok(trackIds.has(track), `${b.id} uses unknown school track ${track}`);
  }
});

test('local librarian finds authors, multilingual titles, Arabic subjects, archive IDs and filters', () => {
  assert.equal(searchBooks('ROJA')[0].id, 'SHAM-LIB-008');
  assert.equal(searchBooks('Muller')[0].id, 'SHAM-LIB-003');
  assert.ok(searchBooks('الجزيئي').length);
  assert.equal(searchBooks('SHAM-LIB-004').length, 1);
  assert.equal(searchBooks('', 'chemistry').length, 3);
  assert.equal(searchBooks('Roja', 'chemistry').length, 0);
  assert.equal(searchBooks('not-a-book').length, 0);
  assert.equal(searchBooks('九章算术')[0].id, 'SHAM-LIB-EA-001');
  assert.equal(searchBooks('Advanced Mathematics')[0].language, 'zh-Hans');
  assert.ok(searchBooks('An Encouragement of Learning').some(book => book.language === 'ja'));
  assert.ok(searchBooks('훈민정음 해례본').some(book => book.language === 'ko'));
  assert.equal(searchBooks('', 'all', { language: 'ko' }).length, 4);
  assert.ok(searchBooks('', 'all', { trackId: 'math' }).some(book => book.id === 'SHAM-LIB-EA-012'));
});

test('East Asian language coverage reports gaps instead of implying an exhaustive collection', () => {
  assert.equal(EAST_ASIAN_CATALOG_SCOPE.exhaustive, false);
  assert.ok(EAST_ASIAN_LANGUAGES.lzh);
  assert.ok(EAST_ASIAN_LANGUAGES.ja);
  assert.ok(EAST_ASIAN_LANGUAGES.ko);
  assert.ok(EAST_ASIAN_LANGUAGES.mn);
  assert.ok(EAST_ASIAN_LANGUAGES.bo);
  const uyghur = EAST_ASIAN_LANGUAGE_COVERAGE.find(item => item.code === 'ug');
  assert.equal(uyghur?.bookCount, 0);
  assert.equal(uyghur?.state, 'needs-source-research');
  assert.ok(EAST_ASIAN_LANGUAGE_COVERAGE.some(item => item.bookCount > 0));
});

test('school eligibility is gated on verified edition, approval and lawful full-text access', () => {
  assert.ok(booksForTrack('math').length > 0);
  assert.equal(approvedBooksForTrack('math').length, 0);
  assert.equal(approvedBooksForTrack('medicine').length, 0);
});

test('academy bibliography links the candidate catalogue to every track without teaching pending records', () => {
  const coverage = academyLibraryCoverage();
  assert.equal(coverage.length, TRACKS.length);
  assert.deepEqual(coverage.map(row => row.track), TRACKS.map(track => track.id));
  assert.ok(coverage.find(row => row.track === 'math')!.candidateCount > 0);
  assert.ok(coverage.find(row => row.track === 'law')!.candidateCount > 0);
  assert.ok(coverage.every(row => row.approvedCount === 0));
  assert.ok(academyLibraryReferences('math').every(book => book.trackIds.includes('math')));
  assert.equal(approvedAcademyLibraryBooks('math').length, 0);
});

test('archive round trips and librarian belongs to Shaheen with legal coordination', () => {
  const archive = JSON.parse(exportLibraryArchive());
  assert.deepEqual(archive.books, JSON.parse(JSON.stringify(LIBRARY_BOOKS)));
  assert.equal(archive.schemaVersion, 2);
  assert.equal(archive.scope.exhaustive, false);
  assert.equal(BOTS.find(b => b.id === 'librarian')?.dept, 'content');
  assert.ok(LINKS.some(l => l.from === 'legal' && l.to === 'librarian'));
});

test('cosmetics and aromatherapy references remain searchable with cautious attribution notes', () => {
  assert.equal(searchBooks('', 'cosmetics').length, 5);
  assert.equal(searchBooks('', 'aromatherapy').length, 4);
  assert.equal(searchBooks('Tisserand')[0].id, 'SHAM-LIB-016');
  assert.equal(searchBooks('المستحلبات')[0].id, 'SHAM-LIB-011');
  assert.match(searchBooks('SHAM-LIB-009')[0].summary.en, /require bibliographic verification/);
  assert.deepEqual(LIBRARY_BOOKS.slice(0, 8).map(b => b.id), Array.from({ length: 8 }, (_, i) => `SHAM-LIB-${String(i + 1).padStart(3, '0')}`));
});
