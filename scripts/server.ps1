$ErrorActionPreference = 'Stop'
$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

function Get-ExistingMcpServerStatus {
  param(
    [Parameter(Mandatory = $true)][int]$Port
  )

  try {
    $listen = Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort $Port -State Listen -ErrorAction Stop |
      Select-Object -First 1
  } catch {
    return $null
  }

  if (-not $listen) {
    return $null
  }

  $commandLine = ''
  try {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listen.OwningProcess)" -ErrorAction Stop
    if ($process) {
      $commandLine = [string]$process.CommandLine
    }
  } catch {}

  $health = $null
  try {
    $health = Invoke-RestMethod -Uri ("http://127.0.0.1:{0}/healthz" -f $Port) -Method Get -TimeoutSec 2 -ErrorAction Stop
  } catch {}

  return [PSCustomObject]@{
    Port        = $Port
    ProcessId   = $listen.OwningProcess
    CommandLine = $commandLine
    Health      = $health
  }
}

function Test-CompatibleRunningServer {
  param(
    [Parameter(Mandatory = $true)]$Status,
    [Parameter(Mandatory = $true)][string]$ProfileName,
    [Parameter(Mandatory = $true)][string]$AuthMode
  )

  if (-not $Status -or -not $Status.Health) {
    return $false
  }

  $serverName = [string]$Status.Health.server
  $healthAuth = [string]$Status.Health.auth.mode
  $healthProfile = [string]$Status.Health.profile
  $expectedHealthProfile = if ($ProfileName -eq 'tests') { 'internal' } else { $ProfileName }

  if ($serverName -ne 'mcp-tests-response-shape') {
    return $false
  }
  if ($healthAuth -ne $AuthMode) {
    return $false
  }
  if ($healthProfile -ne $expectedHealthProfile) {
    return $false
  }

  $cmd = [string]$Status.CommandLine
  if (-not $cmd) {
    return $true
  }

  return (
    $cmd.Contains('server.js') -and
    $cmd.Contains("--profile $ProfileName") -and
    $cmd.Contains("--auth $AuthMode") -and
    $cmd.Contains("--port $($Status.Port)")
  )
}

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

if ($Port) {
  $existing = Get-ExistingMcpServerStatus -Port ([int]$Port)
  if ($existing) {
    if (Test-CompatibleRunningServer -Status $existing -ProfileName $ProfileName -AuthMode $AuthMode) {
      Write-Host "Serwer MCP już działa na 127.0.0.1:$Port (pid=$($existing.ProcessId)). Nie uruchamiam duplikatu." -ForegroundColor Yellow
      if ($existing.Health) {
        Write-Host "Healthz: auth=$($existing.Health.auth.mode), profile=$($existing.Health.profile), tools=$($existing.Health.tools_count)" -ForegroundColor Yellow
      }
      Write-Host 'Jeżeli chcesz wykonać kontrolowany restart istniejącego procesu, użyj scripts/request-restart.js albo zapisz trigger file.' -ForegroundColor Yellow
      exit 0
    }

    Write-Host "Port 127.0.0.1:$Port jest już zajęty przez inny proces (pid=$($existing.ProcessId))." -ForegroundColor Red
    if ($existing.CommandLine) {
      Write-Host "Command line: $($existing.CommandLine)" -ForegroundColor Red
    }
    if ($existing.Health) {
      Write-Host "Healthz wykrytego procesu: server=$($existing.Health.server) auth=$($existing.Health.auth.mode) profile=$($existing.Health.profile)" -ForegroundColor Red
    } else {
      Write-Host 'Healthz na zajętym porcie nie odpowiedział jako MCP TEST server.' -ForegroundColor Red
    }
    exit 1
  }
}

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
