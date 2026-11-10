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

| Group | Robots | Main place | Fallback |
|---|---|---|---|
| A. Browser & checks | patrol, Manus tours, expert checker, inspection rotation | Robots' server (Oracle Cloud Always Free) | GitLab CI, once a day |
| B. Import & prices | importer + images, trade (FX, shipping), carriers, news, discover | Robots' server (respecting L-03 and contracts) | PythonAnywhere (FX only) |
| C. Learning | academy, brain/mind lab, council, languages, localization | Robots' server + Hugging Face (storage) | waits for the server |
| D. Heavy experiments | model training | Kaggle / Colab, by hand | — |
| E. Governance | Platform State, ops map, escalation | Vercel backend, woken by Cloudflare Workers cron | robots' server |
| F. Watchdog | is the site/backend/server up | Cloudflare Workers cron (every 15–30 min) | GitLab, once a day |
| G. Backups | code mirror, encrypted DB dump, restore test | robots' server | GitLab + Google Drive + Supabase |
| H. Build & deploy | tests, build, deploy | GitHub Actions (on push / PR only) | GitLab |

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
what still runs on GitHub. Until a robot runs on its server, the ops map shows it as
«متوقف مؤقتاً على GitHub: بيتنقل لسيرفر الروبوتات».
The full plan, in Arabic, is in the owner's Google Drive («خطة التوزيع الذكية»).
