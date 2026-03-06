#!/usr/bin/env bash
set -euo pipefail
cd /home/hs-chilu/heysalad-ai-projects/mobile-apps/android-autodev
python3 -m android_autodev.main health >/dev/null
