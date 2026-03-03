#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SDK_DIR="${ROOT_DIR}/opencto-sdk-js"
CLI_DIR="${ROOT_DIR}/opencto-cli"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

run_pkg_checks() {
  local pkg_dir="$1"
  local pkg_name="$2"

  echo "==> ${pkg_name}: lint"
  (cd "${pkg_dir}" && npm run lint)

  echo "==> ${pkg_name}: test"
  (cd "${pkg_dir}" && npm run test)

  echo "==> ${pkg_name}: build"
  (cd "${pkg_dir}" && npm run build)
}

check_pkg_clean() {
  local rel_dir="$1"
  if [[ -n "$(git -C "${ROOT_DIR}" status --short "${rel_dir}")" ]]; then
    echo "Working tree not clean for ${rel_dir}. Commit or stash package changes first." >&2
    exit 1
  fi
}

publish_pkg() {
  local pkg_dir="$1"
  local pkg_name="$2"

  echo "==> ${pkg_name}: npm publish"
  (cd "${pkg_dir}" && npm publish --access public)
}

require_cmd npm
require_cmd git

check_pkg_clean "opencto-sdk-js"
check_pkg_clean "opencto-cli"

echo "==> Checking npm authentication"
npm whoami >/dev/null
echo "npm auth confirmed"

run_pkg_checks "${SDK_DIR}" "@heysalad/opencto"
publish_pkg "${SDK_DIR}" "@heysalad/opencto"

run_pkg_checks "${CLI_DIR}" "@heysalad/opencto-cli"
publish_pkg "${CLI_DIR}" "@heysalad/opencto-cli"

echo "Release complete."
