# AI Quality & Runtime Review — Phase Zero

**Status:** Phase 0 completed in the development checkout. No production implementation, prompt, model, route, or production setting was changed in this phase. Tracked additions are offline characterization/benchmark tests and this report.

## Scope and safety

- Runtime configuration was inspected without reading `.env` values or disclosing secrets.
- The current shell had no relevant model/storage environment variables configured. No local `.data` settings file or live application endpoint was available in this checkout. This is a development-environment observation, **not** a finding about production.
- Therefore the production provider, model IDs, admin overrides, active engine order, and storage backend remain **unverified**. Source defaults must not be treated as live configuration.
- No customer conversations or local conversation database were inspected for this phase.
- `npm ci --ignore-scripts` initially encountered an existing npm peer-resolution conflict (`vite`/`esbuild`); installation succeeded with `--legacy-peer-deps`. npm also reported Node engine warnings for two dependencies. No manifest or lockfile edits were made for this installation.

## Source-level baseline

- Sham Core's client history builder sends up to 24 recent turns, subject to its size limits; the orchestrator uses a shorter recent-conversation slice in its context path. The repository retains at most 200 messages per conversation, which is not the same as the model seeing all 200.
- Shaheen has its own client-side history builder and message compaction, and accepts a bounded conversation history. This confirms different context paths; it does not prove every long chat loses the same information.
- Core exposes structured visitor memory and serialization helpers. Shaheen also has client-side memory/context features. A unified memory/context contract is not yet implemented.
- Shaheen's route selects from configured engines and can fail over. Runtime selection still depends on admin/environment settings and health. Defaults in `server/config/shaheen.ts` are not production evidence.
- Existing tests already cover many specific behaviors (e.g. spelling correction, routing, memory serialization, hallucination checks, engine failover), but the new benchmark is a small deterministic characterization layer, not a complete measure of model-generated answer quality.

## Offline benchmark added

File: `tests/aiQualityBenchmark.test.ts`

The cases use fake/local data only and make no model or network calls:

| Dimension | Baseline result | Interpretation |
|---|---:|---|
| Egyptian dialect selection and explicit dialect override | 2/2 | Existing deterministic dialect resolver passes these two probes. Not a broad dialect-accuracy score. |
| Indirect purchase follow-up using a prior service | 1/1 | Existing Core router resolves this one anaphoric follow-up. |
| Explicit name, perfume notes and budget through structured-memory serialization | 3/3 fields | Existing Core helper round-trips these fields in this fixture. Does not establish cross-product/session retrieval. |
| Conversation history with 30 turns | 1/1 boundary characterization | The current helper keeps the newest turn and excludes turn 1 under the existing recent-history cap. This documents a limitation; it does not meet the future goal of reliably recalling relevant facts from 30 turns. |
| Core visitor memory lookup by visitor ID | 1/1 | The in-memory repository returns the stored preference and conversation link in this fixture. |

The general-intelligence tests and Sham-knowledge tests are deliberately separated. Results below are reported by dimension; an aggregate percentage would hide both the success of Core's explicit memory and the context truncation/stale-data gaps.

## Long Conversation Recall — general intelligence/context

File: `tests/longConversationRecall.test.ts`. Uses only synthetic messages and the local deterministic Core engine; no LLM calls or customer data.

- **Core end-to-end memory recall: 3/3 opening facts recalled** (name, preferred note, budget) after a synthetic 40-message transcript. The tested request takes the explicit memory-view path, and the structured visitor memory supplied the answer.
- **Shaheen outgoing-history path: opening facts absent after 40 messages.** Its current 24-turn history builder retains the final question but not the opening fact. This is a demonstrated limitation of that request context, not proof that every Shaheen path or model invocation fails; no external model was called.

This distinction matters: Core demonstrates reliable recall for the tested explicit-memory path, while relying only on recent-turn history does not retain opening facts. The benchmark does not yet test open-ended model reasoning over recovered facts.

## Sham Knowledge Accuracy — product/service/policy knowledge

File: `tests/shamKnowledgeAccuracy.test.ts`. Uses synthetic product fixtures and seeded knowledge in memory; no live storefront or production content.

| Dimension | Baseline result | Interpretation |
|---|---:|---|
| Product price/currency and product citation | 1/1 fixture | Catalog tool returns the exact synthetic stored price and cites that product. |
| Service procedure and shipping-policy retrieval/citations | 2/2 fixtures | Retrieval returns the seeded service/policy sources for these specific queries. |
| Missing fact handling and unsupported-price guard | 2/2 checks | Retrieval returns `NO_RESULTS` for the absent fact, and the grounding guard flags a fabricated price not in context. |
| Stale source handling | **Gap reproduced** | An explicitly year-2000 synthetic knowledge item is still returned; current retrieval output does not include freshness metadata. This is not counted as a successful freshness result. |

These checks measure retrieval and a deterministic grounding guard—not whether an LLM paraphrases every cited source correctly. The fixtures are not real Sham prices or customer policies.

## Verification results

- `tests/aiQualityBenchmark.test.ts`: **5 passed** (offline characterization).
- `tests/longConversationRecall.test.ts`: **2 passed**, including the Core memory recall and the Shaheen-history limitation check.
- `tests/shamKnowledgeAccuracy.test.ts`: **4 passed**, including the stale-data behavior characterization.
- `npm run lint`: **passed** (TypeScript checks for both configured projects).
- `npm test`: **1,846 passed, 0 failed**.
- No live-provider quality benchmark was run: this checkout has no verified production runtime configuration, and Phase 0 must not alter production settings or send production conversations to providers.

## Phase 1 proposed execution design — awaiting approval

**Goal:** unify the context contract, not redesign the system or change the conversation behavior yet.

1. Add a versioned, typed context envelope in a new shared server module. It should represent the current user turn, ordered recent turns, source metadata/citations, locale, and explicit memory facts as separate fields—not flatten them into an indistinguishable prompt string.
2. Build two adapters over current data: Sham Core's stored conversation/profile and Shaheen's existing client history/request. Phase 1 does not add new persistent memory fields, summaries, or a new database.
3. Initially run the new builder in **shadow/compare mode**: compare normalized context against each legacy context, but keep legacy context as the response-producing path. No provider/model/settings change, and no new user-visible behavior.
4. Add compatibility fixtures for both paths, including the synthetic 40-message test, ordering, role, source metadata, privacy masking, and truncation accounting. Store only local test results; do not log raw production conversations.
5. Keep the old builder intact and provide an explicit internal switch/rollback path. The new path remains disabled by default. Present compatibility results for approval before any user-facing activation.

**Phase 1 proposed exit criteria:** all existing tests pass; 100% of compatibility fixtures preserve the current turn order and required metadata; no privacy regression; old and new builders are selectable in tests; default behavior remains the legacy behavior. Phase 1 will expose, not magically fix, the missing-old-fact case in Shaheen. Smart Memory and actual context-recall improvements should be separately approved and benchmarked in later phases. Stale knowledge handling is also out of Phase 1 scope.

## Proposed measurable targets for later approval

These are proposed acceptance thresholds, **not achieved results or a commitment to release**. First collect a frozen, reviewed, de-identified evaluation set and baseline latency/cost in a safe non-production environment. Report general intelligence separately from Sham-specific knowledge.

| Stage | Proposed measurable exit criteria |
|---|---|
| 1 — Shared context contract | All existing tests pass; 100% of compatibility fixtures preserve roles, message order, and required source metadata through both adapters; legacy path remains default and rollbackable. |
| 2 — Long-context retrieval | On an approved 30–50-message set, recall the required fact in at least 90% of cases; unsupported or wrong memory claims at most 2%; ask a concise clarification when the reference is ambiguous. Report Core and Shaheen separately. |
| 3 — Smart Memory | At least 95% retrieval of explicitly stated test preferences when relevant; false-memory assertions at most 2%; 100% of tested erase requests remove linked memory/summary records. Do not store secrets or infer sensitive traits. |
| 4 — Shared, flexible personality | Blind human review average at least 4/5 for naturalness and task-appropriate tone; serious/friendly/joking/technical scenarios each at least 90% correct on the frozen rubric; cross-surface tone-score gap at most 0.5/5. |
| 5 — Sham Knowledge Accuracy | At least 95% correct on answerable source-grounded product/service/policy cases; 100% of price claims match the current catalog fixture; stale/unknown facts trigger abstention or explicit verification rather than confident use; zero invented policy/stock/price claims in the release set. |
| 6 — Routing and efficiency | Simple-question p95 latency no more than 10% above the measured baseline; simple-task median cost no higher than baseline; complex-task quality improves by at least 10 percentage points against the same benchmark, without removing any current engine. Measure provider and fallback latency separately. |
| 7 — Overall quality gate | Zero critical safety/privacy failures in the release set; report abstention and clarification rates so measured accuracy is not improved merely by refusing more. |

## Production-runtime evidence needed before model decisions

Request a read-only, redacted snapshot from the deployed admin/runtime diagnostics containing only: enabled provider IDs, configured model IDs, routing order, temperature/token limits, feature flags relevant to routing, storage kind, and runtime health status. Do not provide `.env` files, key values, passwords, or raw conversation logs. Capture the timestamp and deployment identity separately from model credentials. If there is no safe administrative export, production model identity remains unknown and should be recorded as such.

## Recommended product objective

Build both capabilities: a capable general conversational assistant **and** a clearly stronger expert on Sham's actual services, products, workflows, and verified knowledge. The site's expertise should be the product differentiator; general questions should still be handled helpfully, with tools/retrieval where useful and explicit uncertainty when the system lacks evidence. “Expert in every detail” should mean expert only where backed by maintained site data—not a promise of universal correctness.
