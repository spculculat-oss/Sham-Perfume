#!/bin/sh
# Vercel "Ignored Build Step" — exit 0 skips the build, exit 1 builds.
#
# Main project (sham-perfume-49bf): builds when anything besides the bot's live data changed.
# Second project (sham-perfume.vercel.app): unused (no keys, no database) and redirects to the main site,
# so it only rebuilds when vercel.json changes — it stops using the free plan's daily build quota.
prod="${VERCEL_PROJECT_PRODUCTION_URL:-}"
url="${VERCEL_URL:-}"
backup=0
if [ "$prod" = "sham-perfume.vercel.app" ]; then backup=1
elif [ -z "$prod" ]; then
  case "$url" in sham-perfume-49bf*) ;; sham-perfume-*) backup=1 ;; esac
fi

if [ "$backup" = 1 ]; then
  if git diff --quiet HEAD^ HEAD -- vercel.json scripts/vercel-ignore.sh scripts/build-vercel.mjs; then
    echo "Second project: unused, redirects to the main site — skipping this build."; exit 0
  fi
  echo "Second project: redirect settings changed — building once."; exit 1
fi

if git diff --quiet HEAD^ HEAD -- . ':(exclude)src/data/live'; then
  echo "Only live data changed — skipping this build."; exit 0
fi
echo "Building."; exit 1
