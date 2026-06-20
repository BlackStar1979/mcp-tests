param(
  [Parameter(Mandatory=$true)]
  [string]$DeploymentId,

  [switch]$WhatIfOnly,
  [switch]$SkipChecks
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Repo = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$ControlPlaneRoot = Join-Path (Join-Path $Repo "_workflow") "control_plane"
$DeployRoot = Join-Path $ControlPlaneRoot "deploy_records"
$DeployFileBackupRoot = Join-Path $ControlPlaneRoot "file_backups"
$AuditLog = if ($env:MCP_TEST_AUDIT_LOG) { $env:MCP_TEST_AUDIT_LOG } else { Join-Path $Repo "_logs\.mcp-tests-audit.jsonl" }

New-Item -ItemType Directory -Force -Path $DeployRoot | Out-Null
New-Item -ItemType Directory -Force -Path $DeployFileBackupRoot | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $AuditLog) | Out-Null

function Get-Sha256($Path) {
  if (Get-Command Get-FileHash -ErrorAction SilentlyContinue) {
    return (Get-FileHash -Algorithm SHA256 -Path $Path).Hash.ToLowerInvariant()
  }

  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
      $hashBytes = $sha256.ComputeHash($stream)
      return ([System.BitConverter]::ToString($hashBytes) -replace "-", "").ToLowerInvariant()
    } finally {
      $sha256.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
}

function Write-RollbackAudit($Event, $Level, $Data) {
  $entry = [ordered]@{
    ts = (Get-Date).ToUniversalTime().ToString("o")
    level = $Level
    source = "test_mcp_rollback.ps1"
    event = $Event
    action = $Event
    pid = $PID
    deployment_id = $DeploymentId
  }
  if ($Data) {
    foreach ($key in $Data.Keys) { $entry[$key] = $Data[$key] }
  }
  ($entry | ConvertTo-Json -Compress -Depth 20) | Add-Content -Path $AuditLog -Encoding UTF8
}

function Assert-RelativeSafePath($PathValue, $Kind) {
  if (-not $PathValue) { throw "$Kind path missing" }
  if ($PathValue -match "(^[A-Za-z]:)|(^\\\\)|(^|[\\/])\.\.([\\/]|$)") { throw "Unsafe $Kind path: $PathValue" }
}

function Resolve-RepoPath($RelativePath, $Kind) {
  Assert-RelativeSafePath $RelativePath $Kind
  return Join-Path $Repo $RelativePath
}

function Remove-EmptyParentDirs($PathValue) {
  $dir = Split-Path $PathValue
  while ($dir -and ($dir -ne $Repo) -and ($dir.StartsWith($Repo))) {
    if ((Test-Path $dir) -and -not (Get-ChildItem $dir -Force | Select-Object -First 1)) {
      Remove-Item $dir -Force
      $dir = Split-Path $dir
    } else {
      break
    }
  }
}

function Invoke-ValidationChecks($Phase) {
  if ($SkipChecks) {
    Write-RollbackAudit "rollback_checks_skipped" "warn" @{ phase = $Phase }
    return
  }

  Write-RollbackAudit "rollback_checks_start" "info" @{ phase = $Phase }

  Push-Location $Repo
  try {
    node --check "server.js"
    if ($LASTEXITCODE -ne 0) { throw "node --check server.js failed" }

    node "_tests/run_all_smokes.js"
    if ($LASTEXITCODE -ne 0) { throw "node _tests/run_all_smokes.js failed" }
  } finally {
    Pop-Location
  }

  Write-RollbackAudit "rollback_checks_ok" "info" @{ phase = $Phase }
}

$executedFile = Join-Path $DeployRoot "$DeploymentId.executed.json"
if (-not (Test-Path $executedFile)) { throw "Executed deployment record not found: $executedFile" }

try {
  Write-RollbackAudit "rollback_start" "info" @{ executed_file = $executedFile; what_if = [bool]$WhatIfOnly }

  $record = Get-Content $executedFile -Raw | ConvertFrom-Json
  if ($record.status -ne "executed") { throw "Deployment record is not executed: $($record.status)" }
  if (-not $record.files) { throw "Deployment record has no files" }

  $backupDir = Join-Path $DeployFileBackupRoot $DeploymentId
  if (-not (Test-Path $backupDir)) { throw "Backup directory not found: $backupDir" }

  $rolledBack = @()

  foreach ($file in $record.files) {
    Assert-RelativeSafePath $file.target "target"

    $targetFull = Resolve-RepoPath $file.target "target"
    $backupFull = Join-Path $backupDir $file.target
    $targetExistedBeforeDeploy = $null -ne $file.target_sha256_before
    $targetExistsNow = Test-Path $targetFull

    if ($targetExistedBeforeDeploy) {
      if (-not $targetExistsNow) { throw "Target file missing: $targetFull" }
      if (-not (Test-Path $backupFull)) { throw "Backup file missing: $backupFull" }

      $targetBefore = Get-Sha256 $targetFull
      $backupHash = Get-Sha256 $backupFull

      if (-not $WhatIfOnly) {
        Copy-Item -Path $backupFull -Destination $targetFull -Force
      }

      $targetAfter = $(if ($WhatIfOnly) { $targetBefore } else { Get-Sha256 $targetFull })

      $rolledBack += [ordered]@{
        target = $file.target
        action = "restore"
        backup = $backupFull
        target_sha256_before = $targetBefore
        backup_sha256 = $backupHash
        target_sha256_after = $targetAfter
        applied = -not [bool]$WhatIfOnly
      }
    } else {
      if ($targetExistsNow) {
        $targetBefore = Get-Sha256 $targetFull
        if (-not $WhatIfOnly) {
          Remove-Item -Path $targetFull -Force
          Remove-EmptyParentDirs $targetFull
        }
        $rolledBack += [ordered]@{
          target = $file.target
          action = "delete_new_file"
          backup = $null
          target_sha256_before = $targetBefore
          backup_sha256 = $null
          target_sha256_after = $(if ($WhatIfOnly) { $targetBefore } else { $null })
          applied = -not [bool]$WhatIfOnly
        }
      } else {
        $rolledBack += [ordered]@{
          target = $file.target
          action = "already_absent"
          backup = $null
          target_sha256_before = $null
          backup_sha256 = $null
          target_sha256_after = $null
          applied = $false
        }
      }
    }
  }

  $rollbackRecord = [ordered]@{
    deployment_id = $DeploymentId
    rolled_back_at = (Get-Date).ToUniversalTime().ToString("o")
    status = $(if ($WhatIfOnly) { "rollback_dry_run" } else { "rolled_back" })
    files = $rolledBack
  }

  $suffix = $(if ($WhatIfOnly) { "rollback-dry-run" } else { "rollback" })
  $out = Join-Path $DeployRoot "$DeploymentId.$suffix.json"
  $rollbackRecord | ConvertTo-Json -Depth 20 | Set-Content -Path $out -Encoding UTF8

  Write-RollbackAudit "rollback_finish" "info" @{ rollback_file = $out; status = $rollbackRecord.status; file_count = $rolledBack.Count }
  Write-Host "ROLLBACK RECORD: $out"

  if (-not $WhatIfOnly) { Invoke-ValidationChecks "post" }
} catch {
  Write-RollbackAudit "rollback_error" "error" @{ error = $_.Exception.Message }
  throw
}
