#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "MySuit Viewer: http://localhost:9990/MYSUIT/UView5/index.jsp?projectName=sample&formName=sample"
echo "MVP 4: http://localhost:3100"
echo "종료: Ctrl+C"
echo "활성 후보 cleanup: scripts/cleanup-mvp4.sh"
exec node src/server/index.js
