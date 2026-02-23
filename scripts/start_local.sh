#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.logs"
mkdir -p "$LOG_DIR"

if [[ ! -f "$ROOT_DIR/backend/.env" || ! -f "$ROOT_DIR/frontend/.env.local" ]]; then
  echo "Missing env files. Run ./scripts/setup_local.sh first."
  exit 1
fi

HAS_OPENROUTER_KEY=false
HAS_OPENAI_KEY=false
grep -qE '^OPENROUTER_API_KEY=.+$' "$ROOT_DIR/backend/.env" && HAS_OPENROUTER_KEY=true || true
grep -qE '^OPENAI_API_KEY=.+$' "$ROOT_DIR/backend/.env" && HAS_OPENAI_KEY=true || true

if [[ "$HAS_OPENROUTER_KEY" == false && "$HAS_OPENAI_KEY" == false ]]; then
  echo "No LLM API key found in backend/.env"
  echo "Set OPENROUTER_API_KEY (recommended) or OPENAI_API_KEY."
  echo "Guide: docs/API_KEYS.md"
  exit 1
fi

echo "Starting backend on http://localhost:8000 ..."
(
  cd "$ROOT_DIR/backend"
  uv run python -m uvicorn app.main:app --reload --port 8000
) >"$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

cleanup() {
  echo
  echo "Stopping services..."
  kill "$BACKEND_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "Backend logs: $LOG_DIR/backend.log"
echo "Starting frontend on http://localhost:3000 ..."
cd "$ROOT_DIR/frontend"
npm run dev
