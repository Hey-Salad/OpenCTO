#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'HELP'
Usage:
  install-opencto-skill.sh --skill <skill-id> --dest <skills-dir>

Example:
  ./opencto/scripts/install-opencto-skill.sh --skill cto-playbook --dest ~/.codex/skills
HELP
}

SKILL_ID=""
DEST_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skill)
      SKILL_ID="${2:-}"
      shift 2
      ;;
    --dest)
      DEST_DIR="${2:-}"
      shift 2
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

if [[ -z "${SKILL_ID}" || -z "${DEST_DIR}" ]]; then
  echo "--skill and --dest are required." >&2
  usage
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SOURCE_DIR="${REPO_ROOT}/opencto-skills/${SKILL_ID}"

if [[ ! -f "${SOURCE_DIR}/SKILL.md" ]]; then
  echo "Skill not found: ${SKILL_ID} (${SOURCE_DIR})" >&2
  exit 1
fi

if [[ "${DEST_DIR}" == ~* ]]; then
  DEST_DIR="${HOME}${DEST_DIR#\~}"
fi

TARGET_DIR="${DEST_DIR%/}/${SKILL_ID}"

mkdir -p "${DEST_DIR}"
rm -rf "${TARGET_DIR}"
cp -R "${SOURCE_DIR}" "${TARGET_DIR}"

echo "Installed skill '${SKILL_ID}' to ${TARGET_DIR}"
echo "Restart Codex/OpenClaw to pick up new skills."
