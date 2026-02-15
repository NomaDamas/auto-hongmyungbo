#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/push_split_repos.sh \
#     https://github.com/<you>/<frontend-repo>.git \
#     https://github.com/<you>/<backend-repo>.git

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <frontend_repo_url> <backend_repo_url>"
  exit 1
fi

FRONTEND_URL="$1"
BACKEND_URL="$2"

if [[ ! -d .git ]]; then
  echo "Error: run this from the monorepo root where .git exists"
  exit 1
fi

git subtree push --prefix=frontend "$FRONTEND_URL" main
git subtree push --prefix=backend "$BACKEND_URL" main

echo "Done: pushed frontend and backend as separate repos"
