#!/bin/sh
# Vercel "Ignored Build Step" — exit 0 skips the build, exit 1 builds.
#
# Main project (sham-perfume-49bf): ALWAYS build.
# A skipped build does not just save minutes — it leaves the production alias on the previous
# deployment. That is how the canonical host ended up serving a stale SPA shell: no robots.txt,
# no sitemap.xml, no llms.txt, no Search Console verification file, and the same <title> for every
# path (the live audit scored it 1/100). A stale canonical host is far more expensive than a build,
# so the main project never opts out.
#
# Second project (sham-perfume.vercel.app): unused (no keys, no database) and redirects to the main
# site, so it only rebuilds when the redirect settings change. That keeps it inside the free plan.
prod="${VERCEL_PROJECT_PRODUCTION_URL:-}"
url="${VERCEL_URL:-}"
backup=0
if [ "$prod" = "sham-perfume.vercel.app" ]; then backup=1
elif [ -z "$prod" ]; then
  case "$url" in sham-perfume-49bf*) ;; sham-perfume-*) backup=1 ;; esac
fi

if [ "$backup" = 1 ]; then
  # The diff command is overridable so a test can prove both branches without depending on the
  # repository's own history; production always runs the git diff.
  diff_cmd="${VERCEL_IGNORE_DIFF_CMD:-git diff --quiet HEAD^ HEAD -- vercel.json scripts/vercel-ignore.sh scripts/build-vercel.mjs}"
  if $diff_cmd; then
    echo "Second project: unused, redirects to the main site — skipping this build."; exit 0
  fi
  echo "Second project: redirect settings changed — building once."; exit 1
fi

echo "Main project: building (the production alias must never serve a stale build)."
exit 1
