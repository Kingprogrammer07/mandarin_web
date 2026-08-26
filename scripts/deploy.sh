#!/usr/bin/env bash
# Manual server-side frontend deploy — no GitHub Actions / billing needed.
#
# The frontend is a STATIC SPA: there is no service to restart. "Deploying" =
# rebuild the bundle and copy it into Nginx's web root. Nginx serves the new
# files immediately (Vite hashes asset names, so no stale cache).
#
# Usage (ON THE SERVER, inside the cloned repo /root/mandarin_web):
#   bash scripts/deploy.sh                          # pick a branch from a menu
#   DEPLOY_BRANCH=redesign/client-ui bash scripts/deploy.sh   # no prompt
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
# changes either way), so the branch is settled HERE, ahead of the pull.
#
# Three ways in, in priority order:
#   1. DEPLOY_BRANCH=<branch>  — explicit, no prompt. For scripts and CI.
#   2. An interactive terminal — a menu of what origin actually has. Choosing
#      from it IS the confirmation, so the script then switches for you rather
#      than aborting and making you run `git checkout` by hand.
#   3. Neither (piped, cron, CI without the env var) — falls back to `main` and
#      REFUSES to switch. Nothing unattended may silently change the branch.
DEFAULT_BRANCH="main"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"   # "HEAD" when detached

# Committed work only. A checkout that would discard uncommitted edits is not
# something a deploy script gets to decide; untracked files (.env, backups) are
# expected here and deliberately ignored.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "[deploy] ABORT: working tree has uncommitted changes." >&2
  git status --short --untracked-files=no >&2
  exit 1
fi

echo "[deploy] fetching origin..."
git fetch origin --prune --quiet

if [ -n "${DEPLOY_BRANCH:-}" ]; then
  TARGET_BRANCH="$DEPLOY_BRANCH"
  echo "[deploy] branch from DEPLOY_BRANCH: $TARGET_BRANCH"
elif [ -t 0 ]; then
  # Filtered on the FULL refname on purpose: `%(refname:short)` renders the
  # symref refs/remotes/origin/HEAD as plain "origin", which slips past any
  # filter looking for "HEAD" and puts a branch named `origin` in the menu.
  # Stripping the full prefix also keeps branch names that contain slashes.
  mapfile -t BRANCHES < <(
    git for-each-ref --format='%(refname)' refs/remotes/origin       | grep -v '^refs/remotes/origin/HEAD$'       | sed 's|^refs/remotes/origin/||' | sort
  )
  if [ "${#BRANCHES[@]}" -eq 0 ]; then
    echo "[deploy] ABORT: origin has no branches." >&2
    exit 1
  fi
  echo "[deploy] branches on origin (* = checked out here):"
  for i in "${!BRANCHES[@]}"; do
    mark=" "
    [ "${BRANCHES[$i]}" = "$CURRENT_BRANCH" ] && mark="*"
    printf '  %2d)%s %s
' "$((i + 1))" "$mark" "${BRANCHES[$i]}"
  done
  printf '[deploy] number, or Enter for %s: ' "$DEFAULT_BRANCH"
  read -r choice
  if [ -z "$choice" ]; then
    TARGET_BRANCH="$DEFAULT_BRANCH"
  elif [ "$choice" -ge 1 ] 2>/dev/null && [ "$choice" -le "${#BRANCHES[@]}" ] 2>/dev/null; then
    TARGET_BRANCH="${BRANCHES[$((choice - 1))]}"
  else
    echo "[deploy] ABORT: '$choice' is not one of the listed numbers." >&2
    exit 1
  fi
else
  TARGET_BRANCH="$DEFAULT_BRANCH"
fi

if [ "$CURRENT_BRANCH" != "$TARGET_BRANCH" ]; then
  if [ -z "${DEPLOY_BRANCH:-}" ] && [ ! -t 0 ]; then
    echo "[deploy] ABORT: on '$CURRENT_BRANCH', expected '$TARGET_BRANCH'." >&2
    echo "[deploy]   fix:  git checkout $TARGET_BRANCH && git pull --ff-only" >&2
    echo "[deploy]   or:   DEPLOY_BRANCH=$CURRENT_BRANCH bash scripts/deploy.sh" >&2
    exit 1
  fi
  if ! git rev-parse --verify --quiet "origin/$TARGET_BRANCH" >/dev/null; then
    echo "[deploy] ABORT: origin has no branch '$TARGET_BRANCH'." >&2
    exit 1
  fi
  echo "[deploy] switching $CURRENT_BRANCH -> $TARGET_BRANCH"
  # -B resets the local branch onto origin's tip. Safe because the working tree
  # was checked clean above, and this checkout is a deploy target, never a
  # place where commits are authored.
  git checkout -B "$TARGET_BRANCH" "origin/$TARGET_BRANCH"
  CURRENT_BRANCH="$TARGET_BRANCH"
fi

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
