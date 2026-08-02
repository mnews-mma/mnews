#!/bin/bash
# Vercel Ignore Build Step.
# Exit 0 = skip the build. Exit 1 (or any non-zero) = proceed with the build.
#
# Skips a build only when every changed file is under out/, scripts/, or docs/
# (reports, one-off backfill scripts, instruction docs), OR when the only
# changed file is data/archive.json. Anything else — most importantly the
# rest of data/ and all of src/ — always triggers a build. This is an
# allowlist, not a denylist, so unknown/new paths default to "build".
#
# Why data/archive.json alone is safe to skip:
# archive-articles.yml commits to it every 30 minutes (up to 48 builds/day).
# It's read client-side via a static raw.githubusercontent.com URL with
# `next: { revalidate: 300 }` (src/lib/firstSeen.ts, src/app/archive/page.tsx,
# src/app/api/og/digest/route.tsx) — no commit SHA in the URL, so the running
# deployment picks up new content within 5 minutes on its own, without a
# redeploy.
#
# This does NOT apply to data/fighterRecords.json (or rankings.json,
# orgRankings*.json, p4p.json, multiOrgRecords*.json): those are fetched via
# URLs suffixed with `?v=${VERCEL_GIT_COMMIT_SHA}` (src/lib/fighterRecordsCache.ts
# etc.), so the currently-running deployment is pinned to the OLD commit's
# data forever — a new deploy (new SHA) is the only way that data reaches
# users. Do not add fighterRecords.json or any other data/ file to this
# skip condition.
set -eu

PREV_SHA="${VERCEL_GIT_PREVIOUS_SHA:-}"

if [ -z "$PREV_SHA" ]; then
  echo "No VERCEL_GIT_PREVIOUS_SHA available; building to be safe."
  exit 1
fi

if ! git cat-file -e "$PREV_SHA" 2>/dev/null; then
  echo "Previous commit $PREV_SHA not available in this checkout; building to be safe."
  exit 1
fi

CHANGED_FILES=$(git diff --name-only "$PREV_SHA" HEAD)

if [ -z "$CHANGED_FILES" ]; then
  echo "No changed files detected; building to be safe."
  exit 1
fi

if [ "$CHANGED_FILES" = "data/archive.json" ]; then
  echo "Only data/archive.json changed (client re-fetches via revalidate:300, no deploy needed). Skipping build."
  exit 0
fi

NON_SKIPPABLE=$(echo "$CHANGED_FILES" | grep -vE '^(out/|scripts/|docs/)' || true)

if [ -n "$NON_SKIPPABLE" ]; then
  echo "Changes outside out/, scripts/, docs/ detected:"
  echo "$NON_SKIPPABLE"
  exit 1
fi

echo "All changed files are under out/, scripts/, docs/. Skipping build."
echo "$CHANGED_FILES"
exit 0
