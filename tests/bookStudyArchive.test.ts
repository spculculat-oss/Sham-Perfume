import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { BOOK_STUDY_ARCHIVE, bookStudyBriefing } from '../server/library/bookStudyArchive';
import { LIBRARY_BOOKS } from '../src/library/catalog';
import { buildBriefing } from '../scripts/shaheen-council/council';

test('all catalogue books are queued internally, not falsely studied or cleared for training', () => {
  assert.deepEqual(BOOK_STUDY_ARCHIVE.books.map(b => b.id), LIBRARY_BOOKS.map(b => b.id));
  assert.equal(BOOK_STUDY_ARCHIVE.publicDisplay, false);
  assert.equal(BOOK_STUDY_ARCHIVE.approvedForAnswering, false);
  for (const b of BOOK_STUDY_ARCHIVE.books) {
    assert.ok(new URL(b.discovery.url).protocol === 'https:');
    assert.equal(b.discovery.fullTextAccessVerified, false);
    assert.equal(b.studyStatus, 'awaiting-lawful-source');
    assert.equal(b.rightsReview, 'pending');
    assert.equal(b.schoolApproval, 'pending-review');
    assert.ok(b.discovery.source.includes('WorldCat') || b.discovery.source === 'prior-bibliographic-web-search');
    assert.equal(b.modernScienceReview, 'not-started');
    assert.deepEqual(b.reviewedSections, []);
    assert.deepEqual(b.claimAssessments, []);
  }
});
test('council and school get a pending queue, not fabricated scientific lessons', () => {
  const briefing = buildBriefing({}, Date.parse('2026-10-21T12:00:00Z'));
  for (const line of bookStudyBriefing()) assert.ok(briefing.facts.includes(line));
  const runner = readFileSync(new URL('../scripts/shaheen-school/run.mts', import.meta.url), 'utf8');
  assert.match(runner, /for \(const line of bookStudyBriefing\(\)\) say\(line\)/);
  assert.ok(!runner.includes('BOOK_STUDY_ARCHIVE.books.map'));
});
test('study archive is not imported by visitor source or public routes', () => {
  function walk(path: URL): URL[] {
    return readdirSync(path, { withFileTypes: true }).flatMap(entry => {
      const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), path);
      return entry.isDirectory() ? walk(file) : /\.[cm]?[jt]sx?$/.test(entry.name) ? [file] : [];
    });
  }
  for (const file of walk(new URL('../src/', import.meta.url))) {
    assert.ok(!readFileSync(file, 'utf8').includes('bookStudyArchive'), `${file.pathname} exposes internal study archive`);
  }
  for (const file of walk(new URL('../server/core/', import.meta.url))) {
    assert.ok(!readFileSync(file, 'utf8').includes('bookStudyArchive'), `${file.pathname} adds unchecked references to core knowledge`);
  }
});
