import test from 'node:test';
import assert from 'node:assert/strict';
import { publicationBlockers, type PublicationReview } from '../src/legal/publicationReview';
import { ORIGINAL_BOOK_PLANS } from '../src/library/editorial';
const complete = (): PublicationReview => ({
  manuscriptVersion: 'v1',
  sources: [{ id: 's1', citation: 'Example test source', url: 'https://example.org/paper', locator: 'Section 2', accessedOn: '2026-10-21', rights: 'open-license', rightsEvidence: 'Test license record', permittedUse: 'Test permitted use' }],
  claims: [{ id: 'c1', text: 'Example claim for test only', sourceIds: ['s1'], evidence: 'supported', assessedOn: '2026-10-21', caveat: '' }],
  approvals: (['scientific', 'legal', 'shaheen'] as const).map(role => ({ role, version: 'v1', reviewer: 'Test reviewer', decision: 'approved', evidenceRef: 'Test record' })),
});
test('plans are not manuscripts or approved publications', () => {
  assert.equal(ORIGINAL_BOOK_PLANS.length, 3);
  for (const p of ORIGINAL_BOOK_PLANS) {
    assert.ok(p.chapters.length);
    assert.ok(publicationBlockers(p.review).includes('sources-missing'));
    for (const role of ['scientific', 'legal', 'shaheen']) assert.ok(publicationBlockers(p.review).includes(`approval-required:${role}`));
  }
});
test('checklist requires source rights and assessed claims', () => {
  const r = complete(); assert.deepEqual(publicationBlockers(r), []);
  r.sources[0].rights = 'unknown'; r.claims[0].sourceIds = ['missing'];
  assert.ok(publicationBlockers(r).includes('rights-unverified:s1'));
  assert.ok(publicationBlockers(r).includes('claim-unreviewed:c1'));
  r.claims[0].sourceIds = ['s1']; r.claims[0].evidence = 'limited';
  assert.ok(publicationBlockers(r).includes('claim-caveat-missing:c1'));
});
test('approvals do not carry over versions and later change requests block completeness', () => {
  const r = complete(); r.manuscriptVersion = 'v2';
  assert.ok(publicationBlockers(r).includes('approval-required:legal'));
  r.manuscriptVersion = 'v1';
  r.approvals.push({ role: 'legal', version: 'v1', reviewer: 'Test reviewer', decision: 'changes-requested', evidenceRef: 'New test record' });
  assert.ok(publicationBlockers(r).includes('approval-required:legal'));
});
test('empty evidence, duplicate IDs and unassessed claims fail closed', () => {
  const r = complete(); r.sources.push({ ...r.sources[0] }); r.claims[0].evidence = 'unassessed'; r.approvals[0].evidenceRef = '';
  const b = publicationBlockers(r);
  assert.ok(b.includes('source-ids-invalid'));
  assert.ok(b.includes('claim-unreviewed:c1'));
  assert.ok(b.includes('approval-required:scientific'));
});
