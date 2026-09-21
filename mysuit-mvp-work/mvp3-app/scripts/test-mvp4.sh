#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm test
MVP3_PORT=3101 node src/server/index.js &
MVP4_PID=$!
trap 'kill "$MVP4_PID" 2>/dev/null || true' EXIT
LD_LIBRARY_PATH=/home/tjd618/mysuit-ai-viewer/mysuit-mvp-work/runtime/browser-libs/root/usr/lib/x86_64-linux-gnu MVP4_BASE_URL=http://127.0.0.1:3101 node tests/e2e-mvp4.test.js
