#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[1/3] Basic setup..."
"$ROOT_DIR/scripts/setup_local.sh"

echo "[2/3] Installing Playwright (for one-click browser publish)..."
(cd "$ROOT_DIR/frontend" && npm install playwright)

echo "[3/3] Installing Chromium for Playwright..."
(cd "$ROOT_DIR/frontend" && npx playwright install chromium)

echo
echo "Easy setup complete."
echo "Run:"
echo "  ./scripts/start_local.sh"
