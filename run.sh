#!/usr/bin/env bash
# Starts the backend (FastAPI/uvicorn) and frontend (Vite) dev servers together.
# Ctrl+C stops both. Ollama is a separate system service and isn't managed here -
# start it yourself first (`ollama serve`) if it isn't already running.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$DIR/backend"
FRONTEND_DIR="$DIR/frontend"

if [ ! -x "$BACKEND_DIR/.venv/bin/python" ]; then
  echo "error: backend/.venv not found - set it up first:" >&2
  echo "  cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt" >&2
  exit 1
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "error: frontend/node_modules not found - run 'npm install' in frontend/ first" >&2
  exit 1
fi

pids=()
cleanup() {
  echo
  echo "Stopping..."
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting backend (FastAPI) on http://127.0.0.1:8000 ..."
(cd "$BACKEND_DIR" && exec .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload) &
pids+=($!)

echo "Starting frontend (Vite) on http://localhost:5173 ..."
(cd "$FRONTEND_DIR" && exec npm run dev) &
pids+=($!)

wait
