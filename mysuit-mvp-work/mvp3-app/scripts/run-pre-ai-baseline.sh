#!/usr/bin/env bash
set -euo pipefail
APP_ROOT="/home/tjd618/mysuit-ai-viewer/mysuit-mvp-work/mvp3-app"
TOMCAT_ROOT="/home/tjd618/mysuit-ai-viewer/apache-tomcat-8.5.78"
LIB_ROOT="/home/tjd618/mysuit-ai-viewer/mysuit-mvp-work/runtime/browser-libs/root/usr/lib/x86_64-linux-gnu"
LOG_ROOT="/home/tjd618/mysuit-ai-viewer/mysuit-mvp-work/logs"
OWN_NODE=0
OWN_TOMCAT=0
NODE_PID=""
cleanup(){
  if [[ "$OWN_NODE" == 1 && -n "$NODE_PID" ]]; then kill "$NODE_PID" 2>/dev/null || true; wait "$NODE_PID" 2>/dev/null || true; fi
  if [[ "$OWN_TOMCAT" == 1 ]]; then "$TOMCAT_ROOT/bin/shutdown.sh" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT INT TERM
cd "$APP_ROOT"
node scripts/generate-pre-ai-baseline.js --phase before
if ! curl --max-time 3 -fsS "http://127.0.0.1:9990/MYSUIT/" >/dev/null; then "$TOMCAT_ROOT/bin/startup.sh"; OWN_TOMCAT=1; fi
for _ in $(seq 1 60); do curl --max-time 3 -fsS "http://127.0.0.1:9990/MYSUIT/UView5/index.jsp?projectName=sample&formName=sample" >/dev/null && break; sleep 1; done
curl --max-time 3 -fsS "http://127.0.0.1:9990/MYSUIT/UView5/index.jsp?projectName=sample&formName=sample" >/dev/null
if curl --max-time 3 -fsS "http://127.0.0.1:3100/api/operation-registry" >/dev/null; then echo "Port 3100 is already in use. Stop the existing review server before baseline." >&2; exit 2; fi
MVP58_TEST_FAILURE=1 npm start >"$LOG_ROOT/pre-ai-node-server.log" 2>&1 & NODE_PID=$!; OWN_NODE=1
for _ in $(seq 1 30); do curl --max-time 3 -fsS "http://127.0.0.1:3100/api/operation-registry" >/dev/null && break; sleep 1; done
npm test
npm run test:mvp59
node --test --test-concurrency=1 tests/history-service.test.js tests/history-transaction.test.js tests/history-branch.test.js tests/history-identity.test.js tests/history-rebuild.test.js tests/structure-operation-service.test.js tests/ubjf-structure-adapter.test.js tests/ubjf-add-remove-adapter.test.js tests/vertical-reflow-service.test.js
LD_LIBRARY_PATH="$LIB_ROOT" node tests/e2e-mvp57-direct-manipulation.test.js
LD_LIBRARY_PATH="$LIB_ROOT" node tests/e2e-mvp58-history.test.js
LD_LIBRARY_PATH="$LIB_ROOT" npm run test:e2e:mvp59
LD_LIBRARY_PATH="$LIB_ROOT" node tests/e2e-mvp58-source-smoke.test.js
node scripts/cleanup-pre-ai-runtime.js
node scripts/generate-pre-ai-baseline.js --phase after --final
echo "PRE-AI BASELINE v1: PASS"
