#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  demo-opencto-e2e.sh --repo-url <url> [--workspace <key>] [--template <cmd>] [--skip-login]

Examples:
  ./opencto/scripts/demo-opencto-e2e.sh --repo-url https://github.com/org/repo
  ./opencto/scripts/demo-opencto-e2e.sh --repo-url https://github.com/org/repo --workspace ws_hack --template "npm test"
EOF
}

REPO_URL=""
WORKSPACE="${OPENCTO_WORKSPACE:-default}"
TEMPLATE_CMD="${OPENCTO_DEMO_TEMPLATE:-npm test}"
SKIP_LOGIN="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-url)
      REPO_URL="${2:-}"
      shift 2
      ;;
    --workspace)
      WORKSPACE="${2:-}"
      shift 2
      ;;
    --template)
      TEMPLATE_CMD="${2:-}"
      shift 2
      ;;
    --skip-login)
      SKIP_LOGIN="true"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${REPO_URL}" ]]; then
  echo "Missing required --repo-url argument." >&2
  usage
  exit 1
fi

if ! command -v opencto >/dev/null 2>&1; then
  echo "opencto CLI not found. Install with: npm install -g @heysalad/opencto-cli@0.1.1" >&2
  exit 1
fi

echo "==> OpenCTO demo"
echo "workspace: ${WORKSPACE}"
echo "repo-url:  ${REPO_URL}"
echo "template:  ${TEMPLATE_CMD}"

if [[ "${SKIP_LOGIN}" != "true" ]]; then
  if [[ -t 0 ]]; then
    echo "==> login"
    opencto login --workspace "${WORKSPACE}"
  else
    echo "Skipping login (non-interactive shell). Pass --skip-login to suppress this message."
  fi
fi

echo "==> workflow list"
opencto workflow list --workspace "${WORKSPACE}"

echo "==> workflow run custom"
opencto workflow run custom \
  --workspace "${WORKSPACE}" \
  --repo-url "${REPO_URL}" \
  --template "${TEMPLATE_CMD}" \
  --wait

echo "Demo complete."
