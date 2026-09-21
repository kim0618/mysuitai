$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
node src/server/index.js
