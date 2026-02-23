#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[1/3] Checking required tools..."
command -v npm >/dev/null 2>&1 || {
  echo "Error: 'npm' is not installed. Install Node.js LTS from https://nodejs.org/"
  exit 1
}

echo "[2/3] Preparing frontend env..."
if [[ ! -f "$ROOT_DIR/frontend/.env.local" ]]; then
  cp "$ROOT_DIR/frontend/.env.local.example" "$ROOT_DIR/frontend/.env.local"
  echo "Created frontend/.env.local from template."
fi

echo "[3/3] Installing frontend dependencies..."
(cd "$ROOT_DIR/frontend" && npm install)

echo
echo "Setup complete."
echo "Next:"
echo "  1) (Optional) set OPENROUTER_API_KEY or OPENAI_API_KEY in frontend/.env.local"
echo "  2) Or enter API keys directly in Options at runtime"
echo "  3) Run: ./scripts/start_local.sh"
