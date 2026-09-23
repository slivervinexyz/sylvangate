#!/usr/bin/env bash
# Publish slivervine-kernel-escort-rhchain sub-repo (orphan main, single clean root commit).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="${SUB_REPO_REMOTE:-sub-repo}"
URL="${SUB_REPO_URL:-https://github.com/SilverVineLabs/slivervine-kernel-escort-rhchain.git}"
BRANCH="${SUB_REPO_BRANCH:-slivervine-kernel-escort-main}"
GH="${GH_BIN:-$HOME/.local/bin/gh}"

cd "$ROOT"
git remote get-url "$REMOTE" >/dev/null 2>&1 || git remote add "$REMOTE" "$URL"

if ! git ls-remote "$URL" HEAD >/dev/null 2>&1; then
  echo "[sub-repo] Remote not found: $URL"
  if [[ -x "$GH" ]] && "$GH" auth status >/dev/null 2>&1; then
    echo "[sub-repo] Creating SilverVineLabs/slivervine-kernel-escort-rhchain via gh..."
    "$GH" repo create SilverVineLabs/slivervine-kernel-escort-rhchain \
      --public \
      --description "SliverVine Kernel Escort for Robinhood Chain (4663/46630)" \
      --confirm
  else
    echo "[sub-repo] Create empty repo first:"
    echo "  https://github.com/organizations/SilverVineLabs/repositories/new"
    echo "  Name: slivervine-kernel-escort-rhchain · Public · NO README/license"
    echo "Then re-run: bash scripts/publish-kernel-escort-subrepo.sh"
    exit 1
  fi
fi

git checkout "$BRANCH"
git push "$REMOTE" "${BRANCH}:main" --force
echo "[sub-repo] OK → $URL (branch main)"
