#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/init_monorepo_github.sh https://github.com/<you>/<repo>.git

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <origin_repo_url>"
  exit 1
fi

ORIGIN_URL="$1"

if [[ ! -d .git ]]; then
  git init
fi

git add .
if ! git diff --cached --quiet; then
  git commit -m "init monorepo"
fi

git branch -M main

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$ORIGIN_URL"
else
  git remote add origin "$ORIGIN_URL"
fi

git push -u origin main

echo "Done: pushed monorepo to $ORIGIN_URL"
