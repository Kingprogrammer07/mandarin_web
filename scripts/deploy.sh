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

echo "[deploy] git pull..."
git pull --ff-only

echo "[deploy] npm ci..."
npm ci

echo "[deploy] build (production)..."
npm run build

echo "[deploy] publish -> $WEB_ROOT ..."
mkdir -p "$WEB_ROOT"
rsync -a --delete dist/ "$WEB_ROOT/"

echo "[deploy] done @ $(git rev-parse --short HEAD). Static files — no service restart."
