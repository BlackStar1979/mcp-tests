# Deploys a tagged release of LocalNodeMCP to the pinned release worktree and restarts it.
#
#   pwsh -File scripts\deploy-localnode.ps1 -Ref localnode-r2            # deploy a tag
#   pwsh -File scripts\deploy-localnode.ps1 -Ref localnode-r1            # rollback = deploy the previous tag
#   pwsh -File scripts\deploy-localnode.ps1 -Ref localnode-r1 -Init      # first time: create the worktree
#
# Only TAGS are deployed (never a branch), so what runs is always a named, reproducible commit.
# The release worktree lives OUTSIDE C:\Work so workspace indexes do not see a second copy.

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string] $Ref,
  [switch] $Init,
  [int] $ExpectedTools = 0
)

$ErrorActionPreference = 'Stop'
$DevRoot = Split-Path -Parent $PSScriptRoot
$config = Get-Content -Raw (Join-Path $PSScriptRoot 'localnode.config.json') | ConvertFrom-Json
$release = if ($config.release_dir -match '^~[\\/]') { Join-Path $HOME $config.release_dir.Substring(2) } else { $config.release_dir }
if (-not $release) { throw 'localnode.config.json has no release_dir' }

$commit = git -C $DevRoot rev-parse --verify --quiet "refs/tags/$Ref^{commit}"
if (-not $commit) { throw "'$Ref' is not a tag in $DevRoot (only tags are deployable)" }

if ($Init) {
  if (Test-Path $release) { throw "release dir already exists: $release" }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $release) | Out-Null
  git -C $DevRoot worktree add --detach $release $Ref
  if ($LASTEXITCODE -ne 0) { throw 'git worktree add failed' }
} else {
  if (-not (Test-Path (Join-Path $release '.git'))) { throw "release worktree missing: $release (use -Init)" }
  $dirty = git -C $release status --porcelain
  if ($dirty) { throw "release worktree has local changes; refusing to deploy over them:`n$dirty" }
  git -C $release checkout --quiet --detach $Ref
  if ($LASTEXITCODE -ne 0) { throw "checkout of $Ref failed" }
}

$head = git -C $release rev-parse HEAD
if ($head -ne $commit) { throw "release worktree is at $head, expected $commit" }

Push-Location $release
try {
  npm ci --no-audit --no-fund --loglevel=error
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
} finally { Pop-Location }
Write-Host "Release worktree at $Ref ($($commit.Substring(0,7))): $release"

if ($Init) {
  Write-Host 'Initialised. Point the keeper at it (release_dir) and restart the task to switch.'
  exit 0
}

function Get-ListenerPid {
  $c = Get-NetTCPConnection -State Listen -LocalPort 3008 -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) { return [int]$c.OwningProcess } else { return $null }
}

# The OLD server answers healthz until it exits, so "healthz OK" alone proves nothing about the new
# release: wait for a DIFFERENT process to own the port and answer.
$trigger = Join-Path $DevRoot '_control\restart-request.json'
$oldPid = Get-ListenerPid
node (Join-Path $DevRoot 'scripts\request-restart.js') --code=42 "--reason=deploy_$Ref" "--file=$trigger" | Out-Null
$deadline = (Get-Date).AddSeconds(90)
$h = $null
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 800
  $newPid = Get-ListenerPid
  if ($newPid -and $newPid -ne $oldPid) {
    $h = try { Invoke-RestMethod http://127.0.0.1:3008/healthz -TimeoutSec 2 } catch { $null }
    if ($h) { break }
  }
}
if (-not $h) { throw "no NEW server answered within 90 s after deploying $Ref (old pid $oldPid) -- roll back with -Ref <previous tag>" }
if ($ExpectedTools -and $h.tools_count -ne $ExpectedTools) {
  throw "server is up but serves $($h.tools_count) tools, expected $ExpectedTools -- roll back with -Ref <previous tag>"
}
Write-Host "Deployed ${Ref}: server=$($h.server) tools=$($h.tools_count)"
