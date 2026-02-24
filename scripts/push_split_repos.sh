#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/push_split_repos.sh \
#     frontend \
#     https://github.com/<you>/<frontend-repo>.git

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <prefix_path> <repo_url>"
  exit 1
fi

PREFIX_PATH="$1"
TARGET_URL="$2"

if [[ ! -d .git ]]; then
  echo "Error: run this from the monorepo root where .git exists"
  exit 1
fi

if [[ ! -d "$PREFIX_PATH" ]]; then
  echo "Error: prefix path '$PREFIX_PATH' does not exist"
  exit 1
fi

git subtree push --prefix="$PREFIX_PATH" "$TARGET_URL" main

echo "Done: pushed '$PREFIX_PATH' to '$TARGET_URL'"
