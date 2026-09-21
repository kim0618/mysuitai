$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
node --test tests/viewer-id-parser.test.js tests/form-patch-service.test.js tests/candidate-api.test.js
Write-Host "E2E는 WSL Tomcat과 MVP 앱을 실행한 뒤 npm run test:e2e 로 수행하세요."
