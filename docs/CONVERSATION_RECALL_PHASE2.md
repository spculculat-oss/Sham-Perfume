# Phase 2 — bounded conversation recall

## Scope

Phase 2 adds extractive retrieval for older turns in the Sham Core conversation history. It is intentionally separate from both Core's existing structured visitor preferences and Shaheen's shared question-and-answer memory. It does not change either memory store, add a database table, create a cross-conversation transcript index, or change Sham knowledge freshness.

## Behavior

- Keep the existing ten-message recent history unchanged.
- Only for model-backed answers, search earlier turns in the same visitor-owned conversation for lexical overlap with the current redacted question.
- Retrieve complete user/assistant exchanges only, then merge them with the recent window in original chronological order.
- Bound the additional context to eight turns and 6,000 characters; skip exchanges containing likely email/phone/payment-like sensitive data.
- Use light Arabic normalization/stemming and common Arabic/English stop-word filtering. This is a small lexical retriever, not semantic search or a summary.
- Do not persist retrieval results or log chat text. Existing conversation deletion behavior continues to apply to the underlying stored transcript.
- Keep the existing phase-one unified-context shadow comparison against its legacy ten-message window; the retrieval path does not feed that shadow metric.
- Shaheen's independent history and shared memory remain unchanged.

## Verification

Synthetic tests cover relevant old-turn selection, chronological whole-exchange retrieval, bounds, sensitive-data exclusion, unrelated-query rejection, a long Core conversation, and a second visitor's inability to retrieve the first visitor's turn. The general long-conversation tests are not Sham perfume-knowledge accuracy tests and do not establish improved answer quality.

Validation on this branch: `npm run lint` passed; `npm test` passed **1,857/1,857** tests. These are structural/regression results, not evidence that generated answers are more accurate or that Sham data is fresher.

## Not included

- Semantic/vector retrieval, generated summaries, durable memory extraction, retention policy changes, or memory UI changes.
- Any changes to Shaheen's shared knowledge/answer memory.
- Updates to Sham catalog, policies, or live-data freshness.
- Claims of measured improvement in general intelligence or Sham-specific factual accuracy.
