$ErrorActionPreference="Stop"
Set-Location (Join-Path $PSScriptRoot "..")
Write-Host "MySuit Viewer: http://localhost:9990/MYSUIT/UView5/index.jsp?projectName=sample&formName=sample"
Write-Host "MVP 4: http://localhost:3100"
node src/server/index.js
