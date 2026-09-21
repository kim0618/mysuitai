#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "MySuit Viewer: http://localhost:9990/MYSUIT/UView5/index.jsp?projectName=sample&formName=sample"
echo "MVP 4.1: http://localhost:3100"
exec node src/server/index.js
