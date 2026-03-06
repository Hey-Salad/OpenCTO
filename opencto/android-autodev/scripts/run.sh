#!/usr/bin/env bash
set -euo pipefail
cd /home/hs-chilu/heysalad-ai-projects/mobile-apps/android-autodev
exec python3 -m android_autodev.main run --queue-dir ./tasks --runs-dir ./runs
