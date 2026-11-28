#!/bin/sh
# Vercel "Ignored Build Step" — exit 0 skips the build, exit 1 builds.
#
# Main project (sham-perfume-49bf): ALWAYS build, and decide that without touching git.
# A skipped build does not just save minutes — it leaves the production alias on the previous
# deployment. That is how the canonical host ended up serving a stale SPA shell: no robots.txt,
# no sitemap.xml, no llms.txt, no Search Console verification file, and the same <title> for every
# path (the live audit scored it 1/100). A stale canonical host is far more expensive than a build,
# so the main project never opts out.
#
# Second project (sham-perfume.vercel.app): unused (no keys, no database) and redirects to the main
# site, so it only rebuilds when the redirect settings change. That keeps it inside the free plan.
#
# The main project is identified BEFORE any git command runs: Vercel can hand us a shallow clone with
# no `HEAD^`, and `git diff --quiet HEAD^ HEAD` then prints `fatal: bad revision 'HEAD^'` in the build
# log while the build still continues. Nothing below needs to fail, so nothing below should look broken.
prod="${VERCEL_PROJECT_PRODUCTION_URL:-}"
url="${VERCEL_URL:-}"
backup=0
if [ "$prod" = "sham-perfume.vercel.app" ]; then backup=1
elif [ -z "$prod" ]; then
  case "$url" in sham-perfume-49bf*) ;; sham-perfume-*) backup=1 ;; esac
fi

if [ "$backup" = 0 ]; then
  echo "Main project: building (the production alias must never serve a stale build)."
  exit 1
fi

# Only the unused second project reaches git. The diff command is overridable so a test can prove
# both branches without depending on the repository's own history; production always runs the diff.
#
# No `HEAD^` here: a shallow clone has no parent commit, so `git diff HEAD^ HEAD` always fails and
# the build would continue anyway — the check would be theatre. The comparison is against the commit
# Vercel is building (`git.capture: git clone … (Branch: main, Commit: abc123)`), falling back to HEAD.
# A clone without that parent still fails, and the `2>/dev/null` above keeps the log clean.
base="${VERCEL_GIT_PREVIOUS_SHA:-$(git rev-parse --short HEAD 2>/dev/null)}"
diff_cmd="${VERCEL_IGNORE_DIFF_CMD:-git diff --quiet $base HEAD -- vercel.json scripts/vercel-ignore.sh scripts/build-vercel.mjs}"
if $diff_cmd 2>/dev/null; then
  echo "Second project: unused, redirects to the main site — skipping this build."; exit 0
fi
echo "Second project: redirect settings changed — building once."; exit 1
