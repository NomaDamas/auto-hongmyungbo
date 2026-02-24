#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -f "$ROOT_DIR/frontend/.env.local" && ! -f "$ROOT_DIR/frontend/.env" ]]; then
  echo "Missing env file. Create frontend/.env or frontend/.env.local (or run ./scripts/setup_local.sh)."
  exit 1
fi

echo "Starting Next.js app on http://localhost:3000 ..."
cd "$ROOT_DIR/frontend"
npm run dev
