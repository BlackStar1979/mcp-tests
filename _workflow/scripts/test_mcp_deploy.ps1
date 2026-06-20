param(
  [Parameter(Mandatory=$true)]
  [ValidateSet("Status", "Prepare", "Execute")]
  [string]$Mode,

  [string]$Manifest = "",
  [string]$DeploymentId = "",
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

if (-not $DeploymentId) {
  $DeploymentId = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH-mm-ss-fffZ") + "_" + ([Guid]::NewGuid().ToString("N").Substring(0,8))
}

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

function Write-DeployAudit($Event, $Level, $Data) {
  $entry = [ordered]@{
    ts = (Get-Date).ToUniversalTime().ToString("o")
    level = $Level
    source = "test_mcp_deploy.ps1"
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

function Invoke-ValidationChecks($Phase) {
  if ($SkipChecks) {
    Write-DeployAudit "deploy_checks_skipped" "warn" @{ phase = $Phase }
    return
  }

  Write-DeployAudit "deploy_checks_start" "info" @{ phase = $Phase }

  Push-Location $Repo
  try {
    node --check "server.js"
    if ($LASTEXITCODE -ne 0) { throw "node --check server.js failed" }

    node "_tests/run_all_smokes.js"
    if ($LASTEXITCODE -ne 0) { throw "node _tests/run_all_smokes.js failed" }
  } finally {
    Pop-Location
  }

  Write-DeployAudit "deploy_checks_ok" "info" @{ phase = $Phase }
}

function Read-Manifest($ManifestPath, $RequiredMode) {
  if (-not $ManifestPath) { throw "Manifest required for $RequiredMode mode" }
  $manifestFull = Resolve-RepoPath $ManifestPath "manifest"
  if (-not (Test-Path $manifestFull)) { throw "Manifest not found: $ManifestPath" }
  $manifestObj = Get-Content $manifestFull -Raw | ConvertFrom-Json
  if (-not $manifestObj.files) { throw "Manifest has no files" }
  return $manifestObj
}

function Invoke-Prepare($ManifestPath) {
  $manifestObj = Read-Manifest $ManifestPath "Prepare"

  $prepared = @()
  foreach ($file in $manifestObj.files) {
    $sourceFull = Resolve-RepoPath $file.source "source"
    $targetFull = Resolve-RepoPath $file.target "target"
    if (-not (Test-Path $sourceFull)) { throw "Source missing: $($file.source)" }

    $targetExists = Test-Path $targetFull
    $prepared += [ordered]@{
      source = $file.source
      target = $file.target
      source_sha256 = Get-Sha256 $sourceFull
      source_bytes = (Get-Item $sourceFull).Length
      target_exists = $targetExists
      target_sha256 = $(if ($targetExists) { Get-Sha256 $targetFull } else { $null })
      target_bytes = $(if ($targetExists) { (Get-Item $targetFull).Length } else { $null })
    }
  }

  $record = [ordered]@{
    deployment_id = $DeploymentId
    deployment_name = $manifestObj.deployment_name
    prepared_at = (Get-Date).ToUniversalTime().ToString("o")
    manifest = $ManifestPath
    status = "prepared"
    files = $prepared
  }

  $out = Join-Path $DeployRoot "$DeploymentId.prepare.json"
  $record | ConvertTo-Json -Depth 20 | Set-Content -Path $out -Encoding UTF8
  Write-DeployAudit "deploy_prepare_ok" "info" @{ manifest = $ManifestPath; prepare_file = $out; file_count = $prepared.Count }
  Write-Host "PREPARED: $out"
}

function Invoke-Execute($ManifestPath) {
  Invoke-ValidationChecks "pre"
  $manifestObj = Read-Manifest $ManifestPath "Execute"

  $backupDir = Join-Path $DeployFileBackupRoot $DeploymentId
  New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

  $executed = @()

  foreach ($file in $manifestObj.files) {
    $sourceFull = Resolve-RepoPath $file.source "source"
    $targetFull = Resolve-RepoPath $file.target "target"

    if (-not (Test-Path $sourceFull)) { throw "Source missing: $($file.source)" }

    $sourceHash = Get-Sha256 $sourceFull
    $targetHashBefore = $null

    if (Test-Path $targetFull) {
      $targetHashBefore = Get-Sha256 $targetFull
      $backupPath = Join-Path $backupDir $file.target
      New-Item -ItemType Directory -Force -Path (Split-Path $backupPath) | Out-Null
      Copy-Item -Path $targetFull -Destination $backupPath -Force
    } else {
      New-Item -ItemType Directory -Force -Path (Split-Path $targetFull) | Out-Null
    }

    Copy-Item -Path $sourceFull -Destination $targetFull -Force

    $targetHashAfter = Get-Sha256 $targetFull

    $executed += [ordered]@{
      source = $file.source
      target = $file.target
      source_sha256 = $sourceHash
      target_sha256_before = $targetHashBefore
      target_sha256_after = $targetHashAfter
    }
  }

  $record = [ordered]@{
    deployment_id = $DeploymentId
    executed_at = (Get-Date).ToUniversalTime().ToString("o")
    manifest = $ManifestPath
    backup_root = $backupDir
    files = $executed
    status = "executed"
  }

  $out = Join-Path $DeployRoot "$DeploymentId.executed.json"
  $record | ConvertTo-Json -Depth 20 | Set-Content -Path $out -Encoding UTF8

  Write-DeployAudit "deploy_execute_ok" "info" @{ executed_file = $out; file_count = $executed.Count }
  Write-Host "EXECUTED: $out"

  Invoke-ValidationChecks "post"
}

if ($Mode -eq "Status") {
  Write-Host "DeployRoot: $DeployRoot"
  Write-Host "DeployFileBackupRoot: $DeployFileBackupRoot"
  Get-ChildItem $DeployRoot -ErrorAction SilentlyContinue | Select-Object Name, Length, LastWriteTime
  exit 0
}

try {
  Write-DeployAudit "deploy_start" "info" @{ mode = $Mode; manifest = $Manifest }
  if ($Mode -eq "Prepare") { Invoke-Prepare $Manifest }
  if ($Mode -eq "Execute") { Invoke-Execute $Manifest }
  Write-DeployAudit "deploy_finish" "info" @{ mode = $Mode; status = "ok" }
} catch {
  Write-DeployAudit "deploy_error" "error" @{ mode = $Mode; error = $_.Exception.Message }
  throw
}
