# SHAM PERFUME 2.0 — Phase 3 progress report

**Date:** 2026-11-13
**Status:** Phase 3 is **in progress, not complete**. This slice delivers a local project cost ledger and project-linked experiment journal. It does not claim the Phase 3 exit gate or enable cloud project/AI access.

## Scope delivered in this slice

### Explicit cost ledger

- Added project-scoped cost lines with category, label, and explicit batch-currency amount: materials, packaging, labor, shipping, and other.
- Added one ISO-style three-letter currency code per ledger, saleable units per batch, and an explicit input-tax percentage assumption. Each line separately requires the user to mark whether that line is subject to the assumed input tax; older lines without that flag default to not taxable. Values are not converted across currencies and are not inferred from fragrance composition, catalog prices, or current FX data.
- Added the two distinct pricing bases:
  - **Markup:** unit cost × (1 + markup percent).
  - **Gross margin:** unit cost ÷ (1 − target margin fraction), with a target below 100%.
- Shows subtotal, the user-selected taxable base, assumed input tax, total batch cost, cost per unit, calculated price, profit per unit, theoretical batch revenue, and effective gross margin. The UI labels theoretical price/revenue, calls out markup vs margin, and notes sales taxes/fees are not included. Tax handling is only a user-entered scenario assumption, not tax guidance.
- Ledger data is locally stored with the project, included in JSON project import/export, and included in project version snapshots/restores. Resetting the ledger requires confirmation.

### Project-linked experiment journal

- Added batch code, observation date, free-text conditions, required observation, optional qualitative evaluation, and create/update timestamps.
- Supports validated create, edit, date-ordered display, and confirmed deletion in the selected project.
- Journal records round-trip with JSON import/export and are included in version snapshots/restores.
- Copy explicitly says journal observations/evaluations are not evidence of safety, stability, or compliance. No attachments or scientific classifications were added.

### Compatibility and privacy

- Existing project schema version and localStorage keys are unchanged; `costLedger` is optional and legacy empty experiment arrays remain valid. New journal records are checked during project-store/import validation.
- No cloud/database/API, user/account identity, production settings, payment flow, density, safety threshold, or IFRA limit was added or changed.
- New records stay in local project storage until the user explicitly exports the project JSON. No background transmission is added.

## Verification performed

- `npm run lint` — passed (root and app TypeScript checks).
- Focused project tests — **17/17 passed** (13 existing project lifecycle tests plus 4 Phase 3 ledger/journal tests).
- `npm test` — **1,890/1,890 passed**.
- `npm run build` — passed; generated 1,161 product pages and sitemap containing 1,178 URLs.
- `git diff --check` — passed.
- Build retains existing Vite warnings about large bundles, ineffective dynamic imports, and native config import extensions; not addressed in this feature slice.
- Automated browser interaction testing of project JSON file picker/download or new UI form flows was **not** performed. Build/type checks and pure-function/round-trip tests do not substitute for that browser QA.

## Still pending before Phase 3 exit gate

1. Browser-level tests for the Studio ledger/journal forms, local persistence, validation, and JSON file download/import.
2. Any journal timeline/status/export additions still needed by the product decision; attachment support remains out of scope until storage and authorization are designed.
3. Project-version comparison and educational reporting grounded in actual cited sources.
4. Shaheen project context behind an explicit opt-in design, with a clear local-only fallback. This slice does not send project text to any model.
5. Secure authenticated project API/ownership and cross-account isolation tests **before** any cloud project context. Current projects have `ownerId: null` and remain guest/local; no client-provided identity would be trusted as authorization.
6. A final privacy/security review and full Phase 3 exit-gate verification after the above decisions and tests.

## Rollback and data safety

No existing project data was migrated, deleted, or rewritten by a bulk migration. The additions use optional project fields and existing project JSON/version pathways. Keep user JSON exports/backups before manual storage changes; do not clear the local project key as part of rollback. To revert code, remove the Phase 3 utility/UI/test additions and corresponding optional type/validation/snapshot hunks only; do not reset whole files because the branch contains unrelated work.
