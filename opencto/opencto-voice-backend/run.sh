#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

if [ -f .venv/bin/activate ]; then
  # Prefer project venv when available.
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

exec uvicorn app:app --host 127.0.0.1 --port 8090 --workers 1
