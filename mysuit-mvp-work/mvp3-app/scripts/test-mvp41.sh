#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm test
browser_libs="/home/tjd618/mysuit-ai-viewer/mysuit-mvp-work/runtime/browser-libs/root/usr/lib/x86_64-linux-gnu"
LD_LIBRARY_PATH="$browser_libs${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" node tests/e2e-mvp41-position.test.js
