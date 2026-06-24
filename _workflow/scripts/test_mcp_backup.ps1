param(
  [string]$Label = "manual",
  [string[]]$Include = @("server.js", "src", "tools", "_tests", "_workflow", "plugins", "_fixtures", "README.md"),
  [switch]$WhatIfOnly
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Repo = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$ControlPlaneRoot = Join-Path (Join-Path $Repo "_workflow") "control_plane"
$SnapshotRoot = Join-Path $ControlPlaneRoot "snapshots"
$AuditLog = if ($env:MCP_TEST_AUDIT_LOG) { $env:MCP_TEST_AUDIT_LOG } else { Join-Path $Repo "_logs\.mcp-tests-audit.jsonl" }

New-Item -ItemType Directory -Force -Path $ControlPlaneRoot | Out-Null
New-Item -ItemType Directory -Force -Path $SnapshotRoot | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $AuditLog) | Out-Null

$SafeLabel = ($Label -replace "[^A-Za-z0-9_.-]", "-").Trim("-")
if (-not $SafeLabel) { $SafeLabel = "manual" }
$SnapshotId = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH-mm-ss-fffZ") + "_" + $SafeLabel
$SnapshotDir = Join-Path $SnapshotRoot $SnapshotId

function Assert-RelativeSafePath($PathValue) {
  if (-not $PathValue) { throw "Path missing" }
  if ($PathValue -match "(^[A-Za-z]:)|(^\\\\)|(^|[\\/])\.\.([\\/]|$)") { throw "Unsafe path: $PathValue" }
}

function Get-Sha256OrNull($Path) {
  if (-not (Test-Path $Path -PathType Leaf)) { return $null }
  return (Get-FileHash -Algorithm SHA256 -Path $Path).Hash.ToLowerInvariant()
}

function Write-BackupAudit($Event, $Level, $Data) {
  $entry = [ordered]@{
    ts = (Get-Date).ToUniversalTime().ToString("o")
    level = $Level
    source = "test_mcp_backup.ps1"
    event = $Event
    action = $Event
    pid = $PID
    snapshot_id = $SnapshotId
  }
  if ($Data) { foreach ($key in $Data.Keys) { $entry[$key] = $Data[$key] } }
  ($entry | ConvertTo-Json -Compress -Depth 20) | Add-Content -Path $AuditLog -Encoding UTF8
}

try {
  Write-BackupAudit "backup_start" "info" @{ label = $SafeLabel; what_if = [bool]$WhatIfOnly }
  $items = @()

  foreach ($rel in $Include) {
    Assert-RelativeSafePath $rel
    $source = Join-Path $Repo $rel
    $exists = Test-Path $source
    $kind = $(if ($exists -and (Test-Path $source -PathType Container)) { "directory" } elseif ($exists) { "file" } else { "missing" })
    $target = Join-Path $SnapshotDir $rel

    if ($exists -and -not $WhatIfOnly) {
      New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
      Copy-Item -Path $source -Destination $target -Recurse -Force
    }

    $items += [ordered]@{
      path = $rel
      exists = $exists
      kind = $kind
      sha256 = Get-Sha256OrNull $source
    }
  }

  $record = [ordered]@{
    snapshot_id = $SnapshotId
    label = $SafeLabel
    created_at = (Get-Date).ToUniversalTime().ToString("o")
    status = $(if ($WhatIfOnly) { "dry_run" } else { "created" })
    repo = $Repo
    snapshot_dir = $SnapshotDir
    includes = $items
  }

  if (-not $WhatIfOnly) { New-Item -ItemType Directory -Force -Path $SnapshotDir | Out-Null }
  $recordPath = Join-Path $SnapshotRoot "$SnapshotId.json"
  $record | ConvertTo-Json -Depth 20 | Set-Content -Path $recordPath -Encoding UTF8
  Write-BackupAudit "backup_finish" "info" @{ record = $recordPath; item_count = $items.Count; status = $record.status }
  Write-Host "BACKUP RECORD: $recordPath"
} catch {
  Write-BackupAudit "backup_error" "error" @{ error = $_.Exception.Message }
  throw
}
