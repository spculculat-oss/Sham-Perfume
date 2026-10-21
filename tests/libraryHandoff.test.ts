import test from 'node:test';
import assert from 'node:assert/strict';
import { libraryReviewBriefing, LIBRARY_REVIEW_HANDOFF } from '../src/library/reviewHandoff';
import { buildBriefing } from '../scripts/shaheen-council/council';

test('council receives actual issue reference, pending legal coordination and conditional authorization', () => {
  assert.equal(LIBRARY_REVIEW_HANDOFF.status, 'awaiting-review');
  assert.equal(LIBRARY_REVIEW_HANDOFF.issue, 203);
  const facts = libraryReviewBriefing();
  assert.ok(facts.join(' ').includes('لا مخطوطات'));
  assert.ok(facts.join(' ').includes('لا تنشر بمجرد تعليق'));
  const briefing = buildBriefing({}, Date.parse('2026-10-21T12:00:00Z'));
  for (const fact of facts) assert.ok(briefing.facts.includes(fact));
});
