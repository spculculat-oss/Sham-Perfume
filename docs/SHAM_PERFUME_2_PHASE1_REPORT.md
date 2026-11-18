# SHAM PERFUME 2.0 — Phase 1 implementation report

**Status:** Phase 1 implementation and validation complete for this approved slice. No deployment, database schema, production configuration, store/payment workflow, or broad UI redesign was performed.

## Files changed for this phase

- `src/utils/calculations.ts` — routes legacy formulation math through Calculation Contract v1; adds fail-closed validation to legacy formulation, dilution, costing, and pyramid allocation helpers; keeps the pre-existing result fields for downstream consumers.
- `src/types/perfume.ts` — optional calculation status/error/warning and mass-estimate fields; historical formula objects remain valid without these fields.
- `src/components/ConcentrationCalculator.tsx` — distinguishes volume from derived mass, displays invalid-input and unverified-density notices, allows an invalid zero density to be rejected rather than silently reset, and includes the estimate notice in copied results.
- `src/App.tsx` — connects the existing calculator save → local recipe library → restore flow to persistence/snapshot helpers, retaining the existing key and JSON record shape.
- `server/specialists/tools.ts` — refuses invalid calculation results; labels derived grams as estimates; no longer fabricates pyramid grams without a density; describes the current selling-price rate as markup-on-cost, not gross margin.

## New files

- `src/utils/calculationContract.ts` — unit-explicit, validated composition contract v1.
- `src/utils/formulaPersistence.ts` — compatibility-safe local library load/save/snapshot/restore helpers.
- `tests/calculationContract.test.ts` — contract and calculator unit/edge tests, including Shaheen calculation tool outputs.
- `tests/formulaPersistence.test.ts` — formula save/restore, legacy record, storage failure, and backup tests.
- `docs/SHAM_PERFUME_2_PHASE1_REPORT.md` — this report.

## Calculation contract and compatibility

- Basis is explicitly `mass` or `volume`; target quantity must use the matching unit (`g` or `ml`). Ingredient amounts are produced in that unit. Cross-unit output is absent unless a finite, positive density is supplied.
- A density marked `verified` must carry a source. An unverified density can still produce a result, but the conversion is flagged as an estimate. Percentage totals that differ from 100% produce a warning and are never silently normalized.
- Invalid/negative/non-finite targets, batch counts, ingredient percentages, densities, duplicate IDs, and invalid costing/pyramid inputs fail closed. The existing dilution helper now rejects non-finite values and invalid concentration ranges.
- The legacy app continues to calculate the formula on a volume basis and retains the result field names required by existing pages. Its historic density numbers, including values used to keep older formulas working, are marked unverified. The UI and Shaheen's calculation tools disclose that derived masses are estimates, not confirmed measurements. New contract calls do not invent density values.
- The formula library key remains `miyaar_perfume_saved_formulas`; save/load uses the same JSON shape. Old fields such as formulation, pyramid notes, batch metadata, and optional fields are restored using existing defaults. Loading does not rewrite valid legacy records.

## Calculator → library → restore path

The UI's existing save and load handlers now call the tested persistence helpers. A synthetic record containing volume, concentration, batch count, densities, currency, metadata, and pyramid notes is saved to a fake storage implementing the current key, read back as the library record, and restored with every field unchanged. Legacy optional fields also retain existing UI defaults.

If the existing local library value is malformed or empty and the app is about to replace it with the fallback collection, the raw previous value is first copied to `miyaar_perfume_saved_formulas.backup-v1` (or the next free `.backup-vN` key). If a backup cannot be written, the helper refuses to overwrite the only existing value. This is tested with fake storage. No actual visitor browser storage was accessed in this development session.

## Actual validation results

- `npm run lint` — **passed** (both TypeScript projects).
- Focused contract/persistence tests — **16/16 passed**.
- Focused related server/specialist regression tests — **42/42 passed**.
- Full `npm test` — **1,873/1,873 passed**.
- `npm run build` — **passed**; Vite produced `dist` and SEO/product pages.
- `git diff --check` — **passed**.

Build warnings remain: Vite's native-config import-extension warning, several ineffective dynamic-import notices, and several large output chunks (the built main JS chunk is approximately 8.7 MB). These were not changed in this scope.

Test setup note: plain `npm ci` hit the repository's existing optional peer-resolution conflict between Vite 8 and the pinned esbuild range. Dependencies installed with `npm ci --legacy-peer-deps` without changing package manifests/lockfiles. npm emitted Node-engine warnings for two dependencies requiring Node 24 while the project declares Node 22, and reported 5 dependency audit findings (1 moderate, 4 high). Dependency upgrades/audit fixes were not undertaken in this phase.

## Example calculations verified

1. **Volume basis:** 100 ml, 20% oil at 0.9 g/ml and 80% alcohol at 0.8 g/ml → oil **20 ml / 18 g**, alcohol **80 ml / 64 g**. Volumes are direct outputs; grams are derived from the supplied densities.
2. **Mass basis:** 25 g at 0.8 g/ml → **31.25 ml** derived.
3. **Legacy calculator:** 50 ml, 20% oil, 1% fixative, oil density 0.92 and alcohol density 0.8 → oil **10 ml / 9.2 g estimated**, alcohol **39.5 ml / 31.6 g estimated**, fixative **0.5 ml / 0.51 g estimated**, total **41.31 g estimated**. These historic density values are explicitly unverified, not scientific reference values.
4. Edge tests cover absent/zero/negative/non-finite density, zero/negative/non-finite quantity, unit mismatch, invalid batch count, percentages outside 0–100, incomplete totals, duplicate/empty ingredient IDs, dilution boundaries, zero/invalid costing, invalid pyramid shares, and malformed-storage backup behavior.

## Data protection and backup

No production database, database schema, formula dataset, or actual visitor localStorage was changed during development/tests. Tests use synthetic records and in-memory fake storage. Therefore no database backup/migration was performed or needed. At runtime, if a malformed/empty formula-library value must be replaced by the app's existing fallback behavior, this change preserves the raw value under the backup key listed above first. Valid legacy records remain under the original key and format.

## Remaining issues

- Existing formulation screens still contain historic density values; the main concentration calculator and Shaheen outputs now label their derived masses as estimates, but provenance is not yet source-backed for each raw material or propagated across every secondary report/print view.
- The current formula fields still describe a blend-level composition (oil/alcohol/water/fixative), not the full ingredient-line/project model. This slice creates the reusable contract but does not add the new project system.
- The legacy cost model still uses markup-on-cost and lacks several requested expense/currency features; this report labels the existing behavior accurately but does not redesign it.
- Material safety/IFRA content was not reviewed or certified; no fragrance-safety or answer-quality improvement is claimed.
- Build-size and dependency warnings above remain open.

## Rollback

No database rollback is needed. Revert only this phase's focused edits: remove `src/utils/calculationContract.ts`, `src/utils/formulaPersistence.ts`, `tests/calculationContract.test.ts`, and `tests/formulaPersistence.test.ts`, and reverse only the phase-specific hunks in the five changed source files listed above. **Do not reset/checkout whole files**, since this branch already contains other independent working changes. The stored recipe key and JSON record shape did not change. Any raw malformed value backed up by this code remains under `miyaar_perfume_saved_formulas.backup-vN`; restore that exact raw value to the original key only if needed, and retain the backup until the restored library has been verified.
