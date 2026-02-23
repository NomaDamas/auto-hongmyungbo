#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[1/5] Checking required tools..."
command -v uv >/dev/null 2>&1 || {
  echo "Error: 'uv' is not installed. Install from https://docs.astral.sh/uv/getting-started/installation/"
  exit 1
}
command -v npm >/dev/null 2>&1 || {
  echo "Error: 'npm' is not installed. Install Node.js LTS from https://nodejs.org/"
  exit 1
}

echo "[2/5] Preparing backend env..."
if [[ ! -f "$ROOT_DIR/backend/.env" ]]; then
  cp "$ROOT_DIR/backend/.env.example" "$ROOT_DIR/backend/.env"
  echo "Created backend/.env from template."
fi

echo "[3/5] Preparing frontend env..."
if [[ ! -f "$ROOT_DIR/frontend/.env.local" ]]; then
  cp "$ROOT_DIR/frontend/.env.local.example" "$ROOT_DIR/frontend/.env.local"
  echo "Created frontend/.env.local from template."
fi

echo "[4/5] Installing backend dependencies..."
(cd "$ROOT_DIR/backend" && uv sync)

echo "[5/5] Installing frontend dependencies..."
(cd "$ROOT_DIR/frontend" && npm install)

echo
echo "Setup complete."
echo "Next:"
echo "  1) Add OPENAI_API_KEY to backend/.env"
echo "  2) Run: ./scripts/start_local.sh"

