#!/usr/bin/env bash
set -euo pipefail

PATTERN="(AIza[0-9A-Za-z_-]{35}|AQ\\.Ab8[0-9A-Za-z._-]{20,}|ghp_[0-9A-Za-z]{36}|github_pat_[0-9A-Za-z_]{20,}|xox[baprs]-[0-9A-Za-z-]{10,}|sk-[A-Za-z0-9]{20,})"

if git grep -nE "$PATTERN" -- . ":!*.lock" ":!*.svg" ":!*.png" ":!*.jpg" ":!*.jpeg" >/tmp/secret_hits.txt 2>/dev/null; then
  echo "Potential secrets detected. Push blocked."
  cat /tmp/secret_hits.txt
  exit 1
fi

echo "Secret scan passed."
