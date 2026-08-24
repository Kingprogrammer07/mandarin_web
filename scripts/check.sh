#!/usr/bin/env bash
# Every check that must pass before code leaves this machine.
# The same file runs locally and in CI so the two cannot disagree.
set -euo pipefail

cd "$(cd "$(dirname "$0")/.." && pwd)"

# `npx tsc --noEmit` checks NOTHING in this repo: the root tsconfig.json has
# "files": [] and only project references. The app project must be named
# explicitly or type errors pass silently — they did for a long time.
echo "[check] typescript"
npx tsc -p tsconfig.app.json --noEmit

echo "[check] tests"
npx vitest run --silent

# Lint is a RATCHET: 25 pre-existing errors live in files nobody is touching.
# Only what this branch changed has to be clean, so the count can only fall.
BASE="${CHECK_BASE:-origin/main}"
CHANGED=""
if git rev-parse --verify "$BASE" >/dev/null 2>&1; then
  CHANGED=$(git diff --name-only --diff-filter=ACMR "$BASE"...HEAD -- '*.ts' '*.tsx' 2>/dev/null || true)
fi
CHANGED="$CHANGED
$(git diff --name-only --diff-filter=ACMR -- '*.ts' '*.tsx' 2>/dev/null || true)
$(git diff --cached --name-only --diff-filter=ACMR -- '*.ts' '*.tsx' 2>/dev/null || true)
$(git ls-files --others --exclude-standard -- '*.ts' '*.tsx' 2>/dev/null || true)"
CHANGED=$(echo "$CHANGED" | sort -u | grep -v '^$' | while read -r f; do [ -f "$f" ] && echo "$f"; done || true)

if [ -n "$CHANGED" ]; then
  echo "[check] eslint — $(echo "$CHANGED" | wc -l) changed file(s)"
  echo "$CHANGED" | xargs npx eslint
else
  echo "[check] eslint — no changed files"
fi

echo "[check] build"
npm run build >/dev/null

echo "[check] OK"
