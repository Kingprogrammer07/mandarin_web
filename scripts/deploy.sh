#!/usr/bin/env bash
# Manual server-side frontend deploy — no GitHub Actions / billing needed.
#
# The frontend is a STATIC SPA: there is no service to restart. "Deploying" =
# rebuild the bundle and copy it into Nginx's web root. Nginx serves the new
# files immediately (Vite hashes asset names, so no stale cache).
#
# Usage (ON THE SERVER, inside the cloned repo /root/mandarin_web):
#   bash scripts/deploy.sh
#
# Env: build reads /root/mandarin_web/.env (hand-set to production values:
# VITE_API_BASE_URL=https://bot.webmandarin.uz, etc.).
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEB_ROOT="${FRONTEND_WEB_ROOT:-/var/www/mandarin-frontend}"

cd "$REPO_DIR"

# The deploy that silently stalled for nine days ran from
# `feat/pos-payment-idempotency`, which was level with ITS own remote — so
# `git pull --ff-only` genuinely succeeded, `set -e` had nothing to catch, and
# every run rebuilt the same stale bundle while reporting success. Nothing
# downstream can tell a wrong-branch build from a right one (the bundle hash
# changes either way), so the check belongs here, ahead of the pull.
#
# A detached HEAD reports "HEAD" and is caught by the same comparison.
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "$DEPLOY_BRANCH" ]; then
  echo "[deploy] ABORT: on '$CURRENT_BRANCH', expected '$DEPLOY_BRANCH'." >&2
  echo "[deploy]   fix:  git checkout $DEPLOY_BRANCH && git pull --ff-only" >&2
  echo "[deploy]   deliberate override:  DEPLOY_BRANCH=$CURRENT_BRANCH bash scripts/deploy.sh" >&2
  exit 1
fi

echo "[deploy] branch: $CURRENT_BRANCH"
echo "[deploy] git pull..."
git pull --ff-only

echo "[deploy] npm ci..."
npm ci

echo "[deploy] build (production)..."
npm run build

echo "[deploy] publish -> $WEB_ROOT ..."
mkdir -p "$WEB_ROOT"
rsync -a --delete dist/ "$WEB_ROOT/"

echo "[deploy] done @ $CURRENT_BRANCH $(git rev-parse --short HEAD). Static files — no service restart."
