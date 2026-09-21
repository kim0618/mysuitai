$ErrorActionPreference="Stop"
Set-Location (Join-Path $PSScriptRoot "..")
npm test
Write-Host "실제 E2E는 WSL의 scripts/test-mvp4.sh를 사용하세요."
