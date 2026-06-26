$ErrorActionPreference = 'Stop'
$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

$ProfileName = if ($env:MCP_SUPERVISOR_PROFILE) { $env:MCP_SUPERVISOR_PROFILE } else { 'public' }
$AuthMode = if ($env:MCP_SUPERVISOR_AUTH) { $env:MCP_SUPERVISOR_AUTH } else { 'none' }
$RestartCodesText = if ($env:MCP_SUPERVISOR_RESTART_CODES) { $env:MCP_SUPERVISOR_RESTART_CODES } else { '42 43 44' }
$RestartCodes = $RestartCodesText -split '\s+' | Where-Object { $_ } | ForEach-Object { [int]$_ }
$DelaySeconds = if ($env:MCP_SUPERVISOR_RESTART_DELAY_SECONDS) { [int]$env:MCP_SUPERVISOR_RESTART_DELAY_SECONDS } else { 1 }

if (-not $env:MCP_TEST_ENABLE_RESTART_TRIGGER) { $env:MCP_TEST_ENABLE_RESTART_TRIGGER = '1' }
if (-not $env:MCP_TEST_RESTART_TRIGGER_FILE) { $env:MCP_TEST_RESTART_TRIGGER_FILE = Join-Path $RootDir '_control\restart-request.json' }
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $env:MCP_TEST_RESTART_TRIGGER_FILE) | Out-Null

$ServerArgs = @('server.js', '--profile', $ProfileName, '--auth', $AuthMode)
if ($env:MCP_SUPERVISOR_PORT) { $ServerArgs += @('--port', $env:MCP_SUPERVISOR_PORT) }
if ($env:MCP_SUPERVISOR_TOKEN_FILE) { $ServerArgs += @('--token-file', $env:MCP_SUPERVISOR_TOKEN_FILE) }
if ($AuthMode -eq 'oauth21') {
  if (-not $env:MCP_SUPERVISOR_OAUTH_SECRET_FILE) { Write-Error 'MCP_SUPERVISOR_OAUTH_SECRET_FILE is required for oauth21.'; exit 2 }
  $ServerArgs += @('--oauth-secret-file', $env:MCP_SUPERVISOR_OAUTH_SECRET_FILE)
}
$ServerArgs += $args

while ($true) {
  Write-Host 'Uruchamianie serwera MCP HTTP...' -ForegroundColor Green
  & node @ServerArgs
  $exitCode = $LASTEXITCODE
  Write-Host "Proces zakonczony z kodem: $exitCode" -ForegroundColor Yellow
  if ($RestartCodes -contains $exitCode) {
    Write-Host "Kontrolowany restart MCP, kod: $exitCode" -ForegroundColor Green
    Start-Sleep -Seconds $DelaySeconds
    continue
  }
  Write-Host "Brak restartu dla kodu: $exitCode" -ForegroundColor Red
  exit $exitCode
}
