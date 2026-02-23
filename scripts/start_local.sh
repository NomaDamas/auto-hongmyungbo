#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -f "$ROOT_DIR/frontend/.env.local" ]]; then
  echo "Missing env files. Run ./scripts/setup_local.sh first."
  exit 1
fi

echo "Starting Next.js app on http://localhost:3000 ..."
cd "$ROOT_DIR/frontend"
npm run dev
