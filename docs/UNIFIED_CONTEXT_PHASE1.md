# Unified Conversation Context — Phase 1 Results

**Status:** Phase 1 implementation completed in shadow-only mode. No model, model-routing policy, production setting, prompt, storage schema, or user-facing API response was changed. Phase 2 has not started.

## What was implemented

- Added `src/utils/unifiedConversationContext.ts` with a versioned (`v1`) typed context envelope, surface-specific turn adapters, source/metadata copying, scope fields, and a comparison summary containing only counts and booleans.
- Added shadow construction at the existing context boundaries for Core and Shaheen. The legacy request builders remain the sole source of actual model turns. The unified object is never passed to a model, persisted, or written to logs.
- In Shaheen's browser-side history builder, the shadow snapshot is made from all messages currently available to that client before the existing capped history is returned. The old returned history remains unchanged.
- Shadow construction is fail-safe: an exception in the new helper is caught and cannot prevent the existing response path from continuing.
- The old paths, routes, and engines remain in place. No feature flag or production-setting change was made; the shadow is internal and cannot select a response context.
- Runtime comparison summaries are deliberately discarded: no raw text, identifiers, or shadow metrics are logged or persisted. The reported comparisons come from synthetic tests, not production telemetry.

## Old-vs-unified comparison

| Surface | Existing response context | Shadow envelope | Fixture comparison |
|---|---|---|---|
| Sham Core | Up to the last 10 stored conversation messages, plus the current user message | Full stored transcript plus current message; source citations and the rest of each stored message's metadata are retained in the detached envelope | 40 stored turns + current (41 unified) vs 10 legacy turns + current (11 legacy): legacy sequence preserved in order; no legacy turn is absent. |
| Shaheen — browser | Existing `chatHistory` selection: recent turns, capped by count/size, with existing filtering/compaction and source behavior | Every message available in the browser snapshot, preserving role/text/id/timestamp, sources, and remaining message metadata | 40 available turns vs 24 legacy turns: the 24 legacy turns remain ordered in the envelope; the opening message is present in the shadow but absent in the old request history. |
| Shaheen — server | Validated incoming history plus the current contextualized question | A detached envelope of those exact validated request turns, including supplied source metadata | Unit tests verify exact role/text sequence and source preservation. The server cannot reconstruct turns the client did not send; the browser shadow is the comparison point for those older local turns. |

The new envelope itself does not trim, summarize, reorder, or redact the turn values it receives. It normalizes names such as Core `at` to `timestamp` and `citations` to `sources`; the original non-normalized fields are also retained in per-turn metadata. Shaheen source arrays and remaining message fields are copied without alteration.

The Shaheen raw-history 40-turn recall limitation therefore remains visible: shadow mode preserves the opening information for comparison, but it does not feed that information into the model or fix recall. That is intentional in Phase 1.

## Privacy and isolation checks

- Comparison summaries contain only version, surface, legacy/unified turn counts, sequence-preserved boolean, and a scope-bound boolean. A test confirms they contain no message text or visitor/conversation identifiers.
- The context builder has no logger, storage, network access, provider client, or global cache.
- A test constructs two visitor/conversation scopes and verifies no turn crosses between the independently built snapshots.
- The entire Shaheen client message record, including source metadata and image/message metadata, is kept only in the in-memory shadow snapshot. It is not added to the outgoing request or persisted by this feature.
- Core shadow scope includes visitor and conversation IDs only in the transient envelope; neither value is returned by the summary.
- Failure-path test confirms a shadow snapshot cloning error does not alter the legacy Shaheen history returned to the server.

These tests validate the pure context builder and the current call sites; they do not replace deployment-level concurrent-user isolation or operational log-retention audits.

## Test results

- `tests/unifiedConversationContext.test.ts`: **7 passed** — Core/Shaheen roles, order, citations/source metadata, full 40-turn snapshots, legacy sequence preservation, scope separation, privacy-safe summaries, and fail-safe behavior.
- `tests/longConversationRecall.test.ts`: **2 passed** — Core explicit-memory recall remains 3/3 for the synthetic details; Shaheen's opening fact is absent from the bounded old history.
- `npm run lint`: **passed**.
- `npm test`: **1,853 passed, 0 failed**.
- `git diff --check`: **passed**.

The general conversation results and Sham knowledge results remain separated in `docs/AI_QUALITY_PHASE_ZERO.md` and their respective benchmark files. No quality claim was inferred from the full suite passing.

## Files changed in Phase 1

1. `src/utils/unifiedConversationContext.ts` — new v1 envelope, mappers, and safe comparison summary.
2. `server/core/orchestrator.ts` — creates a transient Core shadow snapshot beside the existing last-10-turn context; actual model call path is unchanged.
3. `server/shaheen.ts` — creates a transient server-side snapshot of validated legacy turns; actual model call path is unchanged.
4. `src/utils/chatStore.ts` — creates a transient browser shadow snapshot while returning the existing legacy `chatHistory` unchanged.
5. `tests/unifiedConversationContext.test.ts` — new Phase 1 preservation, privacy, isolation, and compatibility tests.
6. `docs/UNIFIED_CONTEXT_PHASE1.md` — this report.

No migrations, package manifest/lockfile edits, environment edits, route removals, model removals, or production configuration changes were made for Phase 1. Other working-tree modifications pre-dated this phase and were left untouched.

## Stop point

Phase 1 is complete and this is the review gate. Do not activate the unified context for real responses, build Smart Memory, change routing/models, or start Phase 2 until separately approved.
