# Instructions for coding agents

## «نفذ مهام شاهين» — the bridge between Shaheen and the chat

«الخبير شاهين» manages every AI tool on this site. Once a day, «مجلس شاهين»
(`.github/workflows/shaheen-council.yml`, code in `scripts/shaheen-council/`) holds a development
meeting over the site's real reports. Safe decisions are applied by the meeting itself. Development
work becomes **GitHub issues labelled `shaheen-task`**, which a coding agent in the chat carries out.

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
- Customer invoices, receipts and order summaries must not show platform margin/profit amounts or
  percentages, or the supplier-cost breakdown. Keep selling prices, quantities, shipping, applicable
  taxes/fees and totals visible; do not change pricing or internal merchant/admin accounting to hide a margin.
- Checks: `npm run lint`, `npm test`, `npm run build`. Install with `bun install --frozen-lockfile`.
