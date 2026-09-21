$ErrorActionPreference="Stop"
Set-Location (Join-Path $PSScriptRoot "..")
node scripts/cleanup-candidates.js
