param(
  [int]$Port = 3009,
  [int]$TimeoutSeconds = 20
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Repo = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$AuditLog = if ($env:MCP_TEST_AUDIT_LOG) { $env:MCP_TEST_AUDIT_LOG } else { Join-Path $Repo "_logs\.mcp-tests-audit.jsonl" }
$HealthUrl = "http://127.0.0.1:$Port/healthz"

New-Item -ItemType Directory -Force -Path (Split-Path $AuditLog) | Out-Null

function Write-RestartAudit($Event, $Level, $Data) {
  $entry = [ordered]@{
    ts = (Get-Date).ToUniversalTime().ToString("o")
    level = $Level
    source = "test_mcp_restart.ps1"
    event = $Event
    action = $Event
    pid = $PID
    port = $Port
  }
  if ($Data) {
    foreach ($key in $Data.Keys) { $entry[$key] = $Data[$key] }
  }
  ($entry | ConvertTo-Json -Compress -Depth 20) | Add-Content -Path $AuditLog -Encoding UTF8
}

function Get-PortOwningPids($PortValue) {
  $pids = @()
  try {
    $connections = Get-NetTCPConnection -LocalPort $PortValue -ErrorAction Stop | Where-Object { $_.State -eq "Listen" -or $_.State -eq "Established" }
    foreach ($connection in $connections) {
      if ($connection.OwningProcess -and ($pids -notcontains $connection.OwningProcess)) {
        $pids += $connection.OwningProcess
      }
    }
  } catch {
    $netstat = netstat -ano -p tcp | Select-String ":$PortValue"
    foreach ($line in $netstat) {
      $parts = ($line.ToString() -split "\s+") | Where-Object { $_ }
      if ($parts.Length -ge 5 -and ($parts[3] -eq "LISTENING" -or $parts[3] -eq "ESTABLISHED")) {
        $candidate = 0
        if ([int]::TryParse($parts[-1], [ref]$candidate) -and ($pids -notcontains $candidate)) {
          $pids += $candidate
        }
      }
    }
  }
  return $pids
}

function Wait-Health($Url, $Timeout) {
  $deadline = (Get-Date).AddSeconds($Timeout)
  $lastError = $null
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        return $true
      }
    } catch {
      $lastError = $_.Exception.Message
    }
    Start-Sleep -Milliseconds 500
  }
  if ($lastError) { Write-RestartAudit "test_mcp_restart_health_error" "warn" @{ error = $lastError } }
  return $false
}

try {
  Write-RestartAudit "test_mcp_restart_start" "info" @{ repo = $Repo; health_url = $HealthUrl }

  $oldPids = Get-PortOwningPids $Port
  foreach ($oldPid in $oldPids) {
    if ($oldPid -eq $PID) { continue }
    try {
      $proc = Get-Process -Id $oldPid -ErrorAction Stop
      Write-RestartAudit "test_mcp_restart_stop_process" "info" @{ old_pid = $oldPid; process_name = $proc.ProcessName }
      Stop-Process -Id $oldPid -Force
    } catch {
      Write-RestartAudit "test_mcp_restart_stop_process_error" "warn" @{ old_pid = $oldPid; error = $_.Exception.Message }
    }
  }

  Start-Sleep -Milliseconds 800

  $node = (Get-Command node -ErrorAction Stop).Source
  $process = Start-Process -FilePath $node -ArgumentList @("server.js") -WorkingDirectory $Repo -PassThru -WindowStyle Hidden
  Write-RestartAudit "test_mcp_restart_start_process" "info" @{ new_pid = $process.Id; node = $node }

  if (-not (Wait-Health $HealthUrl $TimeoutSeconds)) {
    throw "TEST MCP health check did not become ready within $TimeoutSeconds seconds: $HealthUrl"
  }

  Write-RestartAudit "test_mcp_restart_ok" "info" @{ new_pid = $process.Id; health_url = $HealthUrl }
  Write-Host "RESTARTED: pid=$($process.Id) health=$HealthUrl"
} catch {
  Write-RestartAudit "test_mcp_restart_error" "error" @{ error = $_.Exception.Message }
  throw
}
