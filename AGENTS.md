# Instructions for coding agents

## «نفذ مهام شاهين» — the bridge between Shaheen and the chat

**مكانك في الهيكل** (`src/utils/shaheenOrg.ts`): **«وكيل البرمجة في الشات — منفّذ مهام شاهين»**، تحت
**قسم الجودة والاعتماد على النفس** (رئيسه «خبير الجودة والاعتماد على النفس»). أنت إيد شاهين التنفيذية:
الاجتماع بيحوّل الشغل لمهام، والدورية بتصعّد اللي مااتصلحش، وأنت بتنفذهم وتصلح أدوات الذكاء الاصطناعي اللي
أداؤها بايظ، وبعد الدمج «بناء ونشر الموقع» بينشر النتيجة. حاجاتك الكبيرة أو الخطرة لازم موافقة التاجر الأول.

«الخبير شاهين» manages every AI tool on this site. Once a day, «مجلس شاهين»
(`.github/workflows/shaheen-council.yml`, code in `scripts/shaheen-council/`) holds a development
meeting over the site's real reports. Safe decisions are applied by the meeting itself. Development
work becomes **GitHub issues labelled `shaheen-task`**, which a coding agent in the chat carries out.

«الدورية بالتناوب» (`.github/workflows/shaheen-patrol.yml`, code in `scripts/shaheen-patrol/`) runs three
shifts in turn, one per hour (store & pricing → content & visitors → reliability & leadership), so each tool tests
its own work hands-on every 3 hours without loading the site. It reruns the robot that fixes a broken scope (safe
robots only, at most 3 per shift and once per 6 h per robot), asks Shaheen about the rest (one question a shift), and has an expert reviewer of the same scope test every finished
run. A serious problem that stays broken becomes a `shaheen-task` issue labelled **`shaheen-patrol`** (at most
two a day) — the same queue below. After the fix is merged, the next patrol re-tests it and logs it as resolved.

When the merchant writes **«نفذ مهام شاهين»** (or "Run Shaheen's tasks", «مهام شاهين», «شوف مهام شاهين»):

1. List the queue, most urgent first:
   `node --import tsx scripts/shaheen-council/tasks.mts`
   (or `gh issue list --label shaheen-task --state open`).
2. Issues labelled **`needs-approval`** are big or risky. Before touching them, explain each one to the
   merchant in one simple Arabic sentence and ask him to approve it. Never start them on your own.
3. Work through the other tasks, urgent first, on the session's working branch. Each task's body has
   the details and the files to look at. Verify each fix the usual way: `npm run lint`, `npm test`,
   `npm run build`, and the related workflow run if there is one.
4. Open one pull request with `Closes #<n>` for every task it completes, then merge it once the checks pass.
   The next meeting reads the closed issues and marks those tasks as done.
5. If a task is wrong or no longer needed, close its issue with a short comment and the reason
   (`gh issue close <n> --reason "not planned" --comment "…"`). The meeting then drops the task.
6. Reply to the merchant **in simple Egyptian Arabic**, without technical details: what was done, what
   is waiting for his approval, and what (if anything) he has to do himself.

## Google AI Studio (Build mode, two-way GitHub sync)

The merchant also edits this site from Google AI Studio, synced with this repository. The robots push to
`main` every few minutes, so:

- **Never force push.** Pull the latest `main` first (AI Studio: «Pull from GitHub» / sync), then push. A
  force push from an older copy erases the robots' data and newer work (`aistudio-intake.yml` reports it).
- **Do not edit `.github/workflows/`.** The AI Studio GitHub App has no `workflows` permission: GitHub
  rejects the whole push when one of those files differs. Ask the coding agent in the chat instead.
- **Do not edit or delete** `src/data/live/` (robots' reports), `docs/legal/` (the legal manager's
  documents) or `src/لغات/ai/` (the smart translator's packs).
- **Build output is never committed:** `dist/` and `pages-dist/` are made fresh by the workflows.

### The AI Studio bridge (recommended setup)

AI Studio should sync with **its own repository** (variable `AISTUDIO_REPO`, default
`spculculat-oss/Sham-Perfume-Studio`), not with this one: nothing else writes there, so «Sync to GitHub» never
hangs. `.github/workflows/aistudio-bridge.yml` (every 30 min, logic in `scripts/aistudio/bridge.ts`) filters
what changed there, merges it three-way with `main`, runs lint/tests/Pages build, then publishes site files
(`src/`, `public/`) straight to `main` + Pages, or parks the rest (server, scripts, tests, build settings,
deletions, the first import, failed checks) on branch `aistudio/<sha7>` with a `shaheen-task` issue.

- To handle such an issue: review `git diff main...origin/aistudio/<sha7>`, bring the good parts into the
  session branch (never push to `aistudio/*` or `main` directly) and open a PR with `Closes #n`.
- The filter's rules live in `classifyPath` (`BLOCKED` / `REVIEW`); keep them in step with the list above.
- When AI Studio cannot push at all («Failed to push commit to GitHub»), the merchant downloads the project
  as a ZIP and attaches it in the chat: `node --import tsx scripts/aistudio/import-zip.mts <zip>` shows the
  filtered plan, `--apply [--only=a,b]` writes the accepted files; then lint, tests and a PR as usual.
- A ZIP too big for the chat (AI Studio downloads are ~50 MB): create a DRAFT release `aistudio-upload`
  (`gh release create aistudio-upload --draft …`), the merchant attaches the ZIP and saves the draft, then push
  any change to `.github/workflows/aistudio-zip.yml` (or dispatch it): a runner downloads it, filters it, pushes
  `aistudio/zip-<id>` and deletes the ZIP. Still review by hand: AI Studio downloads carry stale copies (merge
  three-way against the closest older main version), demo data (fake members, fake reviews/ratings, a seeded admin
  password — never ship), and direct AI SDK calls that bypass `server/core/engines.ts` (not allowed).

## Standing rules for this repository

- The merchant speaks Egyptian Arabic and is not technical. Answer in Arabic, short and step by step.
- The main site is GitHub Pages (`https://spculculat-oss.github.io/Sham-Perfume/`). Vercel
  (`sham-perfume-49bf`) is only its engine (API, Shaheen, payment, community).
- Visitors must never see an AI vendor or app name. Shaheen is the site's own expert. The admin panel
  may show the real names.
- Never put keys, passwords or card numbers in the repository or in the chat. Keys live in GitHub
  Actions secrets that the merchant enters himself; only their names may be mentioned.
- Use AI providers only through their optional APIs, always with a local fallback. Respect their quotas:
  when a quota runs out, wait for it to renew and never fake results.
- Any new AI call site (`callEngine|executeChat|runCouncil|makeAsk(`) must be registered in
  `src/utils/aiTools.ts`, with a probe in `scripts/shaheen-supervisor/probes.ts`.
- Numbers follow the SITE language, never the visitor's browser. Visitor-facing code must not use
  native `<input type="number">` (the browser renders its own digits — e.g. ٦٥٠ on a German page);
  use `LocalizedNumberInput` (`src/components`) and format display numbers with
  `formatLocalizedNumber`/`storeNumber` from `src/لغات`. «وكيل اللغات»
  (`scripts/shaheen-languages/`, daily workflow) audits this plus bare `.toLocaleString()` calls and
  language-pack coverage into `src/data/live/shaheen-languages.json`, which the council briefing
  reads; anything wrong can become a `shaheen-task` like the other bots'.
- Every robot and AI tool lives under Shaheen's umbrella: register a new workflow or AI tool in
  `src/utils/shaheenOrg.ts` (department, report file, schedule, who it helps in `LINKS`), then run
  `node --import tsx scripts/shaheen-council/org-doc.mts` to refresh `SHAHEEN_ORG.md`;
  `tests/shaheenOrg.test.ts` fails otherwise. If the bot writes a report, add its own checks to
  `scripts/shaheen-council/precheck.ts` (the pre-meeting full check, 06:10 UTC — two hours before the council at 08:15 UTC).
- **The Sham assistant must know the platform as it is today.** Every visitor-facing tab or feature
  (`src/App.tsx`) belongs in `PLATFORM_FEATURES` in `server/core/platformGuide.ts` — name, direct answer,
  how-to, tab id, Arabic + English keywords — with a knowledge document. Bump `KNOWLEDGE_SEED_VERSION`
  in `server/core/seed.ts` when the document is new to stores already running (existing documents are
  never overwritten, deleted ones are never resurrected). `tests/shamCorePlatform.test.ts` fails when a
  linked tab does not exist, so add the feature in the same change that ships it.
- **The Sham assistant knows the real store, and only the store.** `server/core/storeGuide.ts` builds the
  catalog with the same `mergeCatalog` the storefront uses (bundled catalog + Shaheen's enrichment), so the
  assistant may only quote products and prices that exist there; supplier prices and platform margin never
  leave `toItem`. Buying/shipping/returns/tracking facts are seeded as `kb-store-*` documents, and the live
  snapshot (counts, brands, families, price range) is injected into every prompt. New store knowledge =
  a `STORE_PLAYBOOK` topic + a `KNOWLEDGE_SEED_VERSION` bump (v3).
- **Its specialties come from Shaheen's registry, not from prose.** `server/core/shaheenSpecialties.ts`
  maps each specialty to an AI tool (`src/utils/aiTools.ts`), a bot (`src/utils/shaheenOrg.ts`) or a tab
  (`src/App.tsx`); `GET /api/admin/assistant/specialties` and `npm run review:assistant` run
  `server/core/specialtyReview.ts` against the local engine (no key) and must report 100. Shaheen's own
  work (formulation, the «اسأل شاهين» advisor, perfume news, design, finance/contracts) is named and handed
  over, never claimed; internal figures are never quoted. `tests/shamCoreStoreSpecialties.test.ts` guards
  the registry, the no-leak rule, the empty-catalog honesty and the score.
- Customer invoices, receipts and order summaries must not show platform margin/profit amounts or
  percentages, or the supplier-cost breakdown. Keep selling prices, quantities, shipping, applicable
  taxes/fees and totals visible; do not change pricing or internal merchant/admin accounting to hide a margin.
- Checks: `npm run lint`, `npm test`, `npm run build`. Install with `bun install --frozen-lockfile`.
