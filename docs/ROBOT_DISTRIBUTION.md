# Robot distribution — where each robot runs (2026-11)

GitHub suspended the account in November 2026 because the repository's Actions looked like abuse: about 33
scheduled robots (one every 10 minutes) running more than 250 times a day, ~150 bot commits a day, and robots
collecting data from other websites. In the appeal that got the account back, the owner gave GitHub Support
these **commitments**. Every change to `.github/workflows/` must keep them:

1. **No robot timetable on GitHub.** The only `schedule:` left is the daily live-site check (`live-smoke.yml`).
   `tests/opsLive.test.ts` fails if any other workflow gets a cron.
2. **Few, batched commits.** Robots do not commit their results one by one. They write to the database
   (Neon) and file storage, and the site reads them from the backend. At most one daily snapshot commit.
3. **No collecting data from other websites through Actions.** This covers the importer, discover, carriers,
   trade, news, finance FX and senses.
4. **Actions only build, test and deploy our own site:** `pages.yml`, `shaheen-keys.yml`, the post-deploy
   checks (`product-pages-check.yml`, `aistudio-intake.yml`), `live-smoke.yml` and owner orders
   (`owner-control.yml`, `platform-state.yml` on issues).
5. Follow GitHub's Terms of Service and Acceptable Use Policies.

The robot workflows are kept with **`workflow_dispatch` (manual run) only**, so the owner can still run one by
hand in an emergency. Do not run the data-collecting ones from GitHub.

## Where the robots go

**Since 2026-11-19 the robots run on the robots' server on Render** (the owner's choice: a Render account signed
in with GitHub). One small web service, defined in `render.yaml`, runs every robot of `SCHEDULES` on its timetable,
one at a time:

- **Code:** `scripts/robots/` — `registry.ts` (each robot's steps, settings and allowed keys, copied from its
  workflow), `runner.ts` (the rules, tested in `tests/robotsServer.test.ts`), `server.mts` (the loop, the daily
  snapshot and a read-only status page), `boot.sh` + the root `Dockerfile` (Node 22, the pinned Bun, git, gh, Python; `.dockerignore` sends only `boot.sh`).
- **The owner's switches** (`controls.json`) and **the State's pauses** (`state-orders.json`) are read fresh from
  `main` before every run, with the same rule as every workflow's gate (`scripts/owner/gateRule.mjs`).
- **One commit a day** (commitment 2): results stay on the server and go to `main` in one snapshot commit at
  `ROBOTS_SNAPSHOT_HOUR`:30 UTC (default 02:30), with the robots' data files only — never code, never the owner's
  switches. `scripts/ci/publish.mjs` does nothing per robot there (`SHAM_PUBLISH_MODE=batch`). The push starts
  `pages.yml`, which runs the full test suite before deploying.
- **Collecting data** (importer, discover, carriers, trade, news, senses) happens on Render, not on GitHub
  (commitment 3). The importer still obeys L-03: `SHAM_ALLOW_SCRAPE` is the owner's setting only.
- **Keys:** entered by the owner on Render (the Blueprint asks for them). Each robot sees only the keys its
  workflow gave it. `ROBOTS_GITHUB_TOKEN` (the owner's fine-grained token for this repository) pushes the daily
  snapshot and lets the patrol, the meeting and the State open issues and review pull requests.
- **Free plan limits:** 512 MB and a small CPU share. Steps that need more are skipped and say so on the status page
  until `ROBOTS_HEAVY=1` on a bigger plan: the local AI teacher (llama.cpp), the photo cleaner, phone-browser checks
  (`product-pages-check`, the maneuver's browser pass) and the AI Studio bridge (it builds the whole site). A free
  service sleeps after 15 minutes without visits; the server visits its own `/health` every 10 minutes and the
  admin's live map wakes it too. A free instance can restart: the server publishes the day's results when Render
  stops it.
- **The ops map** reads `https://sham-robots.onrender.com/status` (`ROBOTS_SERVER_URL` in `src/utils/opsLive.ts`)
  next to GitHub's runs. The pre-meeting check and the patrol judge the robots by their runs on the server.

| Group | Robots | Main place | Fallback |
|---|---|---|---|
| A. Browser & checks | patrol, Manus tours, expert checker, inspection rotation | Render robots' server (browser passes need `ROBOTS_HEAVY`) | manual run on GitHub |
| B. Import & prices | importer + images, trade (FX, shipping), carriers, news, discover | Render robots' server (respecting L-03 and contracts) | PythonAnywhere (FX only) |
| C. Learning | academy, brain/mind lab, council, languages, localization | Render robots' server (+ Hugging Face for storage) | — |
| D. Heavy experiments | model training, local teacher | Kaggle / Colab, by hand, or Render with `ROBOTS_HEAVY=1` | — |
| E. Governance | Platform State, ops map, escalation | Render robots' server (own copy of the site) + GitHub on the owner's issues | — |
| F. Watchdog | is the site/backend/server up | daily `live-smoke.yml` + the doctor every 10 min on Render | GitLab, once a day |
| G. Backups | code mirror, encrypted DB dump, restore test | GitLab mirror (`pages.yml`) | Google Drive |
| H. Build & deploy | tests, build, deploy | GitHub Actions (on push / PR only) | GitLab |

The Arabic setup steps for the owner are in `docs/RENDER_ROBOTS.md`.

**Essential work that runs now, within the commitments:**

- **Exchange rates.** The site's own server asks the public rates service at most every 6 hours per instance
  (`server/core/liveFx.ts`). The checkout and «بنك شام» use these rates, and the storefront gets them from
  `GET /api/fx` and keeps them for the next visit (`src/utils/fxBoot.ts`). Nothing is committed and nothing runs on
  GitHub.
- **Daily live-site check** (`live-smoke.yml`) and the **product pages check after each deploy**.
- **Platform State** still answers the owner's orders at once: an issue from his account starts it. Only its
  hourly timetable stopped.

**GitLab copy:** the `mirror` job in `pages.yml` pushes every update of `main` to
`gitlab.com/spculculat-oss/Sham-Perfume`. It runs on pushes only, with no timetable. It needs the secret
`GITLAB_MIRROR_TOKEN` (a GitLab token with `write_repository` only) and never force-pushes.

The timetables are kept in `SCHEDULES` (`src/utils/opsLive.ts`) for the robots' server. `GITHUB_SCHEDULES` lists
what still runs on GitHub. When the robots' server does not answer (asleep or not set up yet), the ops map says so
instead of showing a next turn.
The full plan, in Arabic, is in the owner's Google Drive («خطة التوزيع الذكية»).
