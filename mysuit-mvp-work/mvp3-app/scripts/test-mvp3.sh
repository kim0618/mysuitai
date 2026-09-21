#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --test tests/viewer-id-parser.test.js tests/form-patch-service.test.js tests/candidate-api.test.js
node src/server/index.js &
MVP3_PID=$!
trap 'kill "$MVP3_PID" 2>/dev/null || true' EXIT
node tests/e2e-mvp3.test.js
