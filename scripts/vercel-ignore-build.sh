#!/bin/bash
# Vercel Ignore Build Step.
# Exit 0 = skip the build. Exit 1 (or any non-zero) = proceed with the build.
#
# Skips a build only when every changed file is under out/, scripts/, or docs/
# (reports, one-off backfill scripts, instruction docs). Anything else —
# most importantly data/ and src/ — always triggers a build. This is an
# allowlist, not a denylist, so unknown/new paths default to "build".
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

NON_SKIPPABLE=$(echo "$CHANGED_FILES" | grep -vE '^(out/|scripts/|docs/)' || true)

if [ -n "$NON_SKIPPABLE" ]; then
  echo "Changes outside out/, scripts/, docs/ detected:"
  echo "$NON_SKIPPABLE"
  exit 1
fi

echo "All changed files are under out/, scripts/, docs/. Skipping build."
echo "$CHANGED_FILES"
exit 0
