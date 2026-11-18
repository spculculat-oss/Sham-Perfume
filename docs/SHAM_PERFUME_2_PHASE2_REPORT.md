# SHAM PERFUME 2.0 — Phase 2 implementation report

**Status:** Core Laboratory vertical slice implemented on the existing React/Vite application. This is not a cloud-project release and does not claim the entire Phase 2 roadmap is complete. The project model is local/private; no server/database, production configuration, store, checkout, or account behavior was changed.

## Delivered

- A typed `FragranceProject` v1 record, with owner set to `null` for guest/local projects, explicit volume/ml formulation basis, concentrate ingredient lines, editable project metadata and pyramid notes, project-scoped material favorites, costing slot, experiment slot, and immutable editable-state version snapshots. The reader remains compatible with snapshots made before metadata was added.
- A localStorage adapter using new keys `sham_perfume_projects_v1` and `sham_perfume_active_project_v1`. The old formula-library key and records are left intact. Corrupt project-store bytes are backed up before replacement; invalid writes fail closed.
- An **opt-in** SavedFormula import action in the new Studio route. It is repeat-safe, preserves the old formula records untouched, and keeps the full source record for round-trip export back to the existing formula format.
- Project create, select, workbench and metadata edit, duplicate, archive, restore, confirmed permanent deletion (archived projects only), save-version, restore-version, JSON export, and validated/versioned JSON import. Import ID collisions are retained as separate projects under a suffixed ID rather than overwriting an existing project.
- `#studio` / Project Studio entry from the home section gateway and a Studio-project quick list inside the existing FormulaLibrary page. Selecting a project from either place opens the same project record. Selecting a project hydrates the existing concentration calculator and pyramid workbench; edits to those shared states are written back to the selected project. Adding materials to the existing pyramid path updates the same project pyramid.
- Project ingredient lines are editable in Studio. Raw Materials can add a catalog-linked ingredient name/ID to the selected project, but it adds no percentage or density (share starts at 0). Percentages are shares of the fragrance concentrate and are calculated through Calculation Contract v1. A density entered in Studio is marked unverified/estimated; no cross-unit amount is shown without it. Legacy pyramid entries remain pyramid entries; migration does not silently reinterpret note percentages as a material recipe.
- Existing raw-material text search/category filters remain. Added project-scoped favorite filtering and descriptive comparison of up to three catalogue entries. Comparison is explicitly labeled descriptive, not a safety/performance recommendation. Catalogue density/IFRA-like claims were not promoted to verified project data.

## Files changed/new for this phase

- Changed: `src/App.tsx`, `src/components/CostCalculator.tsx`, `src/components/FormulaLibrary.tsx`, `src/components/SectionsGateway.tsx`, `src/components/NavigationBreadcrumbs.tsx`, `src/components/RawMaterialsEncyclopedia.tsx`, `src/utils/shaheenSpecialists.ts`.
- New: `src/types/fragranceProject.ts`, `src/utils/fragranceProjects.ts`, `src/components/ProjectStudio.tsx`, `tests/fragranceProjects.test.ts`, and this report.

There are other pre-existing edits in this branch; this list is the Phase 2 scope only.

## Persistence and compatibility

- Existing key `miyaar_perfume_saved_formulas` is not renamed, deleted, or rewritten by project import. Legacy import is user-triggered from Studio; a synthetic legacy record round-trips through the adapter without losing author, batch code, notes, maceration, formulation, or pyramid fields. Records with invalid/incomplete formulation are skipped with a count and left in the original library.
- Loading a legacy recipe while a project is selected snapshots the current project before applying the chosen recipe to the shared workbench. Saving a library formula creates a named project version. Printing a legacy formula first snapshots and detaches the selected project to avoid silently replacing its contents.
- Costing now accepts/saves a project-scoped costing record. In project mode, new projects start with explicit zero/blank-equivalent numeric values (not the standalone calculator's sample defaults); zero inputs are labeled as not entered. Invalid in-progress values are not persisted. The existing markup formula remains unchanged and is labeled accurately.
- The local project adapter schema-validates stored/imported records, rejects duplicate project IDs and malformed formula/cost data, and never sends project data to an API. The project model is private by local-only behavior; no client-supplied account identity is trusted for cloud operations because there are no cloud project operations in this slice.
- Raw materials become favorites only in a selected project. Without a project, the favorite control is disabled; existing material search/filter and pyramid-add behavior remain available.
- JSON format is `sham-perfume-projects`, version `1`. Import rejects unsupported formats/versions and malformed project records. It merges non-destructively and suffixes ID collisions.

## Actual verification

- `npm ci --legacy-peer-deps` — completed without modifying package manifests/lockfiles. npm reported Node-engine warnings for two dependencies requiring Node 24 while this project declares Node 22, and 8 audit findings (1 moderate, 7 high) in this installation. No dependency or audit fix was applied.
- `npm run lint` — **passed** (both TypeScript projects; re-run after the costing bridge).
- `tests/fragranceProjects.test.ts` — **13/13 passed** after full editable-metadata version snapshots and old-snapshot compatibility changes.
- Focused regressions for localized input and specialist section coverage — **21/21 passed** after adding the Studio route to both the localized-number-input convention and the specialists section registry.
- Full `npm test` — **1,886/1,886 passed** after editable project metadata and backwards-compatible project-version restore.
- `npm run build` — **passed** after the continued integration; SEO generation completed (1,161 product pages and 1,178 sitemap URLs). Main JS bundle is approximately 8.77 MB before gzip.
- Vite continues to warn about native config import extensions, ineffective dynamic imports and large chunks (including the approximately 8.76 MB main JS chunk). These are existing broader bundle concerns and were not addressed in the Core Laboratory scope.
- The site preview is running on port 3000 in the workspace.

## Test scenarios

Tests cover private/local default, explicit units, empty project creation, legacy import/idempotence/round-trip, common workbench and costing updates surviving the same project round trip, raw-material ID linking without copying density or inventing a share, project-scoped favorite persistence, mass conversion only when density is supplied, unverified density warnings, incomplete percentage totals, duplicate/archive/restore/delete rules, restoration of editable metadata/favorites/costing from immutable versions, backwards-compatible reads of older version snapshots, export/import validation, ID collision handling, and corrupt-store backup behavior.

## Remaining Phase 2 work / exit-gate gaps

- Studio, concentration, raw-material pyramid-add, pyramid, and costing are connected through the selected-project workbench. Studio can open the existing manufacturing spec sheet from the selected project. FormulaLibrary includes active-project links, while legacy recipe cards remain a separate compatible view; import is explicit, and load/save/print interactions preserve project versions.
- Project costing now persists the existing calculator's supported fields, but no expanded project cost ledger (tax/shipping/other line items, per-ingredient purchase provenance, or currency conversion audit) was added. The existing calculation remains markup-on-cost.
- FormulaLibrary now shows active project quick links to Studio, but its legacy recipe cards remain a separate list rather than a unified project/version card system. Legacy import is opt-in; load/save/print operations preserve project versions where applicable.
- Ingredient lines currently support local names, roles, percentages, and optional density evidence; Raw Materials can attach a catalog ID/name, but changing a linked material requires removing/re-adding the line. There is no verified provenance workflow; the existing catalogue has not been endorsed as verified data. Legacy pyramid notes are not silently imported as recipe lines.
- The core project schema has an experiment placeholder but no project-linked experiment timeline, attachments, cloud sync, or database records. Version snapshots cover editable project metadata, formulation/ingredient lines, pyramid, favorites, and optional costing. They deliberately omit project ID, creation/update timestamps, lifecycle status, and future experiment attachments.
- JSON export/import has pure adapter tests; browser download/file-input behavior was not exercised in an automated browser test in this turn.

Thus this deliverable advances Phase 2 and implements its local core, but it does not assert the full roadmap's exit gate across every existing tool has been reached.

## Data protection and rollback

No database, user account data, actual browser recipe collection, or production dataset was accessed or altered in this turn. The legacy local recipe key is retained. The new project store is separate; malformed bytes are copied to `<project-key>.backup-v1` before replacement, and a failed backup prevents replacement. To roll back the code, remove only the new project files and reverse the listed Phase 2 hunks. Do not reset/checkout whole files because the branch contains unrelated existing edits. Any project export or backup should be retained until the user confirms the project/library is recoverable.
