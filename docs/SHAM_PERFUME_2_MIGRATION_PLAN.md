# SHAM PERFUME 2.0 — Repository audit & incremental migration plan

**Status:** audit/planning only; no application code, data, authentication, payment, or deployment behavior was changed for this brief.

## 1. Audit findings: preserve and build on the current product

### Existing stack and delivery shape

- The app is already a **React 19 + TypeScript + Vite** application styled with Tailwind, not a vanilla HTML/JS site. It also has a Node 22 / Express backend (`server.ts`). A framework rewrite is not justified.
- `src/App.tsx` is the main client shell and uses tab/hash navigation. It composes a large set of existing lab, store, community, workspace, and AI features; keep those routes and integrations working while the new project experience is introduced incrementally.
- The repository supports both a static GitHub Pages build and server-backed deployments. GitHub Pages cannot run the Express API, database, or payment/auth secrets. Any claim of cloud synchronization or secure checkout must be tested on an API-capable deployment, not inferred from a successful static build.
- Arabic/RTL and localization are already substantial (multiple languages, RTL-aware components and `index.html` Arabic/RTL). The proposed Arabic-first visual system should be introduced as shared tokens/components, not by replacing the current shell wholesale.

### Features already present

| Brief area | Existing implementation | Main gap to close for 2.0 |
|---|---|---|
| Lab dashboard / navigation | `VisitorLocalDashboard`, `HomeHub`, `SectionsGateway`, `NavigationBreadcrumbs`, many working tool tabs | No single Studio dashboard aggregating project/formula/material/activity/experiment data; audit all links as routes are consolidated. |
| Formulation | `ConcentrationCalculator`, `FormulationState`, `calculatePerfumeFormulation`, density-aware gram outputs, batch calculations, dilution tool | Current state is a single calculator configuration, not a per-ingredient formula. The calculation routine bounds/clamps some values and falls back to densities; it does not yet enforce the brief's reject/warn/explicit mass-vs-volume rules. Extend it compatibly and test assumptions rather than silently treating units as equivalent. |
| Materials | `RawMaterialsEncyclopedia` and static `src/data/rawMaterials.ts` data; search/category and add-to-pyramid flows | Data is embedded in code and contains density/usage/safety/IFRA-like assertions. Row-level verified sources, review dates, confidence/provenance and a review workflow need auditing before those claims can be presented as verified. Do not invent or bulk-endorse current values. |
| Pyramid | `PyramidCalculator`, `FragrancePyramidGraphic`, `PyramidNote`, app-shared pyramid state, percentage breakdown | It is currently coupled to the current formula/calculator state, not a saved central project. Verify drag/drop and note descriptions before counting them as delivered. Clearly label the pyramid as organizational/educational, not a performance prediction. |
| Formula library | `FormulaLibrary`, `SavedFormula`, presets, save/load/delete/print; browser storage key `miyaar_perfume_saved_formulas`; formula share/import utilities; account recipe sync exists | Device-local formulas and account recipes are separate representations. There is no central project/version model connecting every lab tool. Preserve existing IDs/data through an adapter and provide migration/export rather than replacing the local library. |
| Costing | `CostCalculator`, `CostingState`, `calculateCosting`; oil, alcohol, packaging, labor/overhead, batch and target markup inputs | Existing cost categories do not cover every requested expense. The current suggested retail computation applies a markup (`cost × (1 + rate)`), not a gross-margin target formula. Add explicit currency, taxes/shipping/other costs, margin-vs-markup labels and cases before calling it a full cost system. |
| Aging | `MacerationTimeSimulator`, maceration start/date/days and batch fields in app state | Existing time simulator is not yet a persistent observation timeline/journal with project/batch links, attachments, evaluations, calendar or export. Do not describe it as a chemical-stability or safety model. |
| Shaheen | Existing server-backed Sham Core, Shaheen specialist/assistant routes, chat UI, tools, knowledge/material lookup and fallback paths | Extend existing secured backend paths to receive the selected project and documented material evidence. Do not create a second AI stack or send private project/formula context to shared answer memory. Safety claims remain educational and sourced, never certification. |
| Accounts / cloud | `server/community` provides registration/login/reset/session/2FA/passkeys and PostgreSQL; schema includes per-user `recipes` with `private` default and ownership checks. `src/community` has sync/API clients. | This is a viable existing backend; avoid duplicating identity in a new Supabase project without a concrete need. Extend the authenticated service and SQL authorization for projects/versions. Browser-only auth fallback is not a security boundary and must never authorize cloud operations. |
| Education | `src/library/BookLibrary`, learning progress, sciences/library content, guides and FAQ-like resources | Curate and expose as a searchable Arabic-first educational center with source and reviewed-date metadata; distinguish authored guidance from verified references. |
| Store | Existing catalog/product detail, search/category, cart, order, checkout, shipping and payment-related modules | Preserve current behavior. Audit real provider configuration, server-side authorization, refunds/returns and failure paths before claiming production checkout. Never add direct card storage or simulated payment success. |
| SEO / accessibility | Existing SEO route/build scripts, page generation, RTL, reduced-motion rules and broad automated tests | Establish a 2.0 acceptance matrix for metadata/canonical/sitemap/robots, keyboard/contrast/screen-reader basics, responsive states, and every visible action. |

### Calculation risk noted during audit

`src/utils/calculations.ts` is already shared by the UI and specialist tools, which is a good base for centralization. The current `calculatePerfumeFormulation` treats the configured percentages as volume shares, derives weights via density, and substitutes fallback density values when values are falsy. It clamps some inputs rather than rejecting invalid values. `calculateCosting` uses a markup-style price formula. The redesign should introduce validated input/result types and explicit assumptions while retaining a tested compatibility path for saved formulas and the existing tools.

### Data/storage boundaries

- Current formula state and pyramid state live in `App.tsx`; saved formulas are persisted to localStorage.
- PostgreSQL is already supported by the community backend (with PGlite in tests/local paths). Its schema is versioned in `server/community/db.ts`; account recipes are owner-scoped, with `private` as the default visibility.
- Existing recipe sharing/community visibility is a separate explicit flow. A new personal project must remain private by default and must not become a public post/share merely because it is synchronized.
- No secrets or environment values were read as part of this audit. Configuration names in docs are not evidence that production services are configured.

## 2. Recommended product and data model

Keep the current app and introduce a typed `FragranceProject` as the source of truth for one project. Proposed core fields:

- `id`, `ownerId` (nullable for guest/local projects), `name`, `description`, `family`, `targetProductType`, `status` (`active | archived`), `createdAt`, `updatedAt`.
- `formula`: batch volume, concentration, explicit basis (`volume | mass`), unit, ingredient lines keyed to optional material IDs, entered percentages/amounts, density and density provenance where available, assumptions/validation.
- `pyramid`: top/heart/base note IDs or names plus user descriptions; treat note placement as an editable classification, not calculated evaporation.
- `costing`: currency code and inputs/derived values, keeping source costs distinct from formula data.
- `experiments`: batch references, dated observations, conditions, notes, evaluation records and attachment references.
- `versions`: immutable snapshots and change metadata; `currentVersionId`.

**Single source of truth:** calculator, pyramid, costing, journal, library, dashboard and Shaheen receive a project ID/domain object and call a shared project service. Avoid storing a second editable formula copy in each page. UI-only drafts may exist transiently but must be reconciled/saved through that service.

**Storage adapters:** keep a guest/local adapter for offline/static hosting and an authenticated server adapter for cloud accounts. Add explicit import/migration of existing local `SavedFormula` records into guest projects, with an opt-in account migration after login. Do not delete the old key until round-trip migration/export has tests and users can recover data.

**Cloud authorization:** add owner-scoped project and version records to the existing PostgreSQL service first, using the authenticated server identity (never a client-provided owner ID), validated request schemas, private-by-default visibility, per-owner query predicates, audit tests, and versioned schema migration. RLS is relevant if a direct Supabase client is selected; the current server-mediated Postgres architecture should keep database credentials server-side and enforce ownership in the API. Re-evaluate RLS only if direct client/database access is introduced.

## 3. Incremental delivery phases

### Phase 1 — Audit and stabilization (this document is the first deliverable)

1. Preserve the current tabs, formula-library data, calculators, AI/API pathways, store and account flows.
2. Build an inventory/acceptance checklist for all routes, formula fields, current persisted keys, calculators, material data provenance, checkout provider and deployment target.
3. Refactor mathematical functions behind validated, pure interfaces without replacing current UI all at once.
4. Add tests for empty/invalid/negative/zero/large values, percentages not equal to 100, unit basis, density missing/present, currency and backwards-compatible formula import.
5. Review suspect scientific/safety copy; mark unknown/unverified values clearly, record sources and reviewed dates, and do not invent replacements.

**Exit gate:** regression tests for existing calculator/library links pass; calculation assumptions and error/warning semantics are documented; no existing feature has been removed.

### Phase 2 — Core laboratory

1. Introduce `FragranceProject`, validation, project service, local adapter, and compatibility/import adapter for `SavedFormula`.
2. Deliver Studio dashboard as a new route/entry point over existing working tools; each card opens the target tool with the selected project loaded.
3. Make formulation, raw materials, pyramid and recipe/version tools read/write the same project model. Add draft/save/reset, duplicate/archive/delete confirmation, JSON import/export, print/PDF only where an actual export implementation is testable.
4. Build the ingredient line model and density-aware calculation rules; require density for mass↔volume conversion and report assumptions. Keep AI-derived suggestions distinguishable from measurements and sourced facts.
5. Add material favorites and search/filter/comparison using existing catalog data while provenance work continues.

**Exit gate:** create/edit/duplicate/archive/delete/restore/export/import tests; two tools editing the same project observe the same persisted state; no stale duplicate formula silently wins.

### Phase 3 — Advanced features

1. Cost ledger/estimate based on explicit currency and line items; separate markup from gross margin and show tax/shipping/labor/packaging assumptions.
2. Project-linked aging/experiment journal with batches, timeline, observations, status, and export; attachment support only after safe storage/authorization design.
3. Add project context to Shaheen through the server API, opt-in history behavior, project-version comparison and educational reporting from actual sources. Show sources and clearly label suggestions; graceful local fallback remains.

**Exit gate:** pure cost tests and journal lifecycle tests; API tests proving project ownership; model-down fallback tests; no unsupported safety or stability claims.

### Phase 4 — Platform

1. Cloud sync, backup/restore, export and account deletion using the existing account/backend foundation; guest local mode remains usable.
2. Database migrations and authorization tests for every new table/API. Add record-level isolation tests using two distinct users.
3. Educational center over curated existing content, with Arabic/English search, categories, publishing/review dates and source links.
4. Improve store only after current commerce and payment providers are audited; inventory/order/checkout changes must be server-authorized and payment-provider-backed.

**Exit gate:** cross-account denial tests, recovery/deletion tests, API-down handling, privacy review, and live provider sandbox verification (never a fake success path).

### Phase 5 — Launch

Run complete automated and manual QA across route navigation, forms, calculations, project round trips, local/cloud sync, account controls, API failures, exports, mobile/tablet/desktop, accessibility, security, performance, SEO, and the selected production deployment. Publish environment-variable names and setup instructions only—never values. Mark each capability as **implemented**, **tested**, **deployment-configured**, or **pending** separately.

## 4. Sequencing and migration safeguards

- The project model and conversion adapter come before making each tool project-aware; otherwise each tool risks creating another conflicting formula store.
- Existing calculation exports and existing `SavedFormula` objects are treated as legacy inputs. Add explicit versioned JSON import/export and round-trip tests before migrating persisted data.
- Do not write a one-shot destructive localStorage migration. Back up/retain original data until the user-visible import is verified.
- Do not migrate auth providers or database vendors by default: current server-mediated Postgres/community infrastructure is already an equivalent foundation. A provider migration needs a separate reason, schema/data plan, rollback, and deployment verification.
- Deployment is an explicit gate. Static GitHub Pages can continue to host public UI, but private cloud projects, AI secrets and payment operations require an API-capable secured deployment; the target must be selected and smoke-tested before promising cloud features live.
- Separate test reporting: calculation/property regressions, account-isolation tests, general-assistant evaluation, and Sham-knowledge accuracy are separate suites. Passing one is not evidence for another or for real-world scientific validity.

## 5. Immediate next implementation slice

After this plan is accepted, start with the smallest safe Phase 1 code slice: define and test a validated formulation calculation contract in `src/utils/calculations.ts` (with mass/volume basis and density-required conversions), preserve the existing calculator behavior through a compatibility adapter, and update its UI to display assumptions and warnings. Then build the project model and migrate one end-to-end workflow (calculator → save/open library) before connecting the other tools.

**Not asserted as completed:** no dashboard redesign, unified project CRUD, verified material-source audit, new database entities, cloud project sync, new auth provider, experiments timeline, production payment integration, or deployment has been implemented by this audit.
