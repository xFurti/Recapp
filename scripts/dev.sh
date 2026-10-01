#!/usr/bin/env bash
# Starts the API (http://localhost:8000) and the web app (http://localhost:5173).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d .venv ]; then
  uv venv --python 3.12 .venv
fi
VIRTUAL_ENV=.venv uv pip install -q -r api/requirements-dev.txt
if [ ! -d web/node_modules ]; then
  (cd web && npm install)
fi

.venv/bin/uvicorn api.app:app --reload --port 8000 &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT

(cd web && npm run dev)
