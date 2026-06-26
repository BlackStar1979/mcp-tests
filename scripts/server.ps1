$ErrorActionPreference = 'Stop'
$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

$Cli = @{}
$ForwardArgs = @()
$i = 0
while ($i -lt $args.Count) {
  $arg = [string]$args[$i]
  if ($arg.StartsWith('--')) {
    $key = $arg.Substring(2)
    $value = $null
    if ($key.Contains('=')) {
      $parts = $key.Split('=', 2)
      $key = $parts[0]
      $value = $parts[1]
    } elseif (($i + 1) -lt $args.Count -and -not ([string]$args[$i + 1]).StartsWith('--')) {
      $i += 1
      $value = [string]$args[$i]
    } else {
      $value = '1'
    }
    switch ($key) {
      'profile' { $Cli.Profile = $value }
      'auth' { $Cli.Auth = $value }
      'port' { $Cli.Port = $value }
      'token-file' { $Cli.TokenFile = $value }
      'oauth-secret-file' { $Cli.OAuthSecretFile = $value }
      'restart-trigger' { $Cli.RestartTrigger = $value }
      'trigger-file' { $Cli.TriggerFile = $value }
      'restart-codes' { $Cli.RestartCodes = $value }
      'restart-delay-seconds' { $Cli.DelaySeconds = $value }
      default { $ForwardArgs += @($arg); if ($null -ne $value -and $value -ne '1') { $ForwardArgs += @($value) } }
    }
  } else {
    $ForwardArgs += @($arg)
  }
  $i += 1
}

$ProfileName = if ($Cli.Profile) { $Cli.Profile } elseif ($env:MCP_SUPERVISOR_PROFILE) { $env:MCP_SUPERVISOR_PROFILE } else { 'public' }
$AuthMode = if ($Cli.Auth) { $Cli.Auth } elseif ($env:MCP_SUPERVISOR_AUTH) { $env:MCP_SUPERVISOR_AUTH } else { 'none' }
$RestartCodesText = if ($Cli.RestartCodes) { $Cli.RestartCodes } elseif ($env:MCP_SUPERVISOR_RESTART_CODES) { $env:MCP_SUPERVISOR_RESTART_CODES } else { '42 43 44' }
$RestartCodes = $RestartCodesText -split '\s+' | Where-Object { $_ } | ForEach-Object { [int]$_ }
$DelaySeconds = if ($Cli.DelaySeconds) { [int]$Cli.DelaySeconds } elseif ($env:MCP_SUPERVISOR_RESTART_DELAY_SECONDS) { [int]$env:MCP_SUPERVISOR_RESTART_DELAY_SECONDS } else { 1 }
$Port = if ($Cli.Port) { $Cli.Port } elseif ($env:MCP_SUPERVISOR_PORT) { $env:MCP_SUPERVISOR_PORT } else { $null }
$TokenFile = if ($Cli.TokenFile) { $Cli.TokenFile } elseif ($env:MCP_SUPERVISOR_TOKEN_FILE) { $env:MCP_SUPERVISOR_TOKEN_FILE } else { $null }
$OAuthSecretFile = if ($Cli.OAuthSecretFile) { $Cli.OAuthSecretFile } elseif ($env:MCP_SUPERVISOR_OAUTH_SECRET_FILE) { $env:MCP_SUPERVISOR_OAUTH_SECRET_FILE } else { $null }

$env:MCP_TEST_ENABLE_RESTART_TRIGGER = if ($Cli.RestartTrigger) { $Cli.RestartTrigger } elseif ($env:MCP_TEST_ENABLE_RESTART_TRIGGER) { $env:MCP_TEST_ENABLE_RESTART_TRIGGER } else { '1' }
$env:MCP_TEST_RESTART_TRIGGER_FILE = if ($Cli.TriggerFile) { $Cli.TriggerFile } elseif ($env:MCP_TEST_RESTART_TRIGGER_FILE) { $env:MCP_TEST_RESTART_TRIGGER_FILE } else { Join-Path $RootDir '_control\restart-request.json' }
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $env:MCP_TEST_RESTART_TRIGGER_FILE) | Out-Null

$ServerArgs = @('server.js', '--profile', $ProfileName, '--auth', $AuthMode)
if ($Port) { $ServerArgs += @('--port', $Port) }
if ($TokenFile) { $ServerArgs += @('--token-file', $TokenFile) }
if ($AuthMode -eq 'oauth21') {
  if (-not $OAuthSecretFile) { Write-Error 'OAuth21 requires --oauth-secret-file or MCP_SUPERVISOR_OAUTH_SECRET_FILE.'; exit 2 }
  $ServerArgs += @('--oauth-secret-file', $OAuthSecretFile)
}
$ServerArgs += $ForwardArgs

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
