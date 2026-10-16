# LocalNodeMCP keeper: keeps the production local MCP server running without the operator.
#
# Started at logon by the Task Scheduler task "LocalNodeMCP" (see scripts/register-localnode-task.ps1).
# It runs the existing supervisor scripts/server.ps1 (which handles controlled restarts, exit codes
# 42/43/44) and relaunches it after ANY other exit -- a crash, a killed process, a failed start --
# with a growing back-off. One keeper per user session: a named mutex makes a second copy exit,
# because server.ps1 takes over (stops) a compatible running server, so two keepers would keep
# killing each other's server.
#
# Configuration comes from scripts/localnode.config.json (paths only; no secret values).

$ErrorActionPreference = 'Stop'
$RootDir = Split-Path -Parent $PSScriptRoot
$ConfigPath = Join-Path $PSScriptRoot 'localnode.config.json'
$LogDir = Join-Path $RootDir '_logs'
$LogPath = Join-Path $LogDir 'localnode-keeper.log'
$MaxLogBytes = 1MB

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-KeeperLog([string]$Message) {
  if ((Test-Path $LogPath) -and (Get-Item $LogPath).Length -gt $MaxLogBytes) {
    Move-Item -Force $LogPath "$LogPath.1"
  }
  $line = '{0} pid={1} {2}' -f (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss.fffzzz'), $PID, $Message
  Add-Content -Path $LogPath -Value $line -Encoding utf8
}

$created = $false
$mutex = New-Object System.Threading.Mutex($true, 'Local\LocalNodeMCP-keeper', [ref]$created)
if (-not $created) {
  Write-KeeperLog 'another keeper holds the mutex; exiting without starting a server'
  exit 0
}

function Resolve-HomePath([string]$Value) {
  if ($Value -match '^~[\\/]') { return Join-Path $HOME $Value.Substring(2) }
  return $Value
}

try {
  $config = Get-Content -Raw -Path $ConfigPath | ConvertFrom-Json
  $oauthSecretFile = Resolve-HomePath $config.oauth_secret_file
  if (-not (Test-Path -LiteralPath $oauthSecretFile -PathType Leaf)) {
    throw "OAuth secret file not found (configured as $($config.oauth_secret_file))"
  }
  $serverArgs = @(
    '--profile', $config.profile,
    '--auth', $config.auth,
    '--port', [string]$config.port,
    '--oauth-secret-file', $oauthSecretFile
  )
  if ($config.memory_embedding_provider) {
    $serverArgs += @(
      '--memory-embedding-provider', $config.memory_embedding_provider,
      '--memory-embedding-external-egress', [string]$config.memory_embedding_external_egress,
      '--memory-embedding-token-file', (Resolve-HomePath $config.memory_embedding_token_file)
    )
  }
  # Production runs from a PINNED release worktree (release_dir), not from this development tree:
  # a crash-restart must never ship half-done work. State stays in state_dir (the dev tree) so the
  # audit trail, restart trigger and indexes continue across releases. Both keys optional.
  $codeDir = if ($config.release_dir) { Resolve-HomePath $config.release_dir } else { $RootDir }
  $stateDir = if ($config.state_dir) { Resolve-HomePath $config.state_dir } else { $RootDir }
  $env:MCP_TEST_LOG_DIR = Join-Path $stateDir '_logs'
  $env:MCP_TEST_AUDIT_LOG = Join-Path $stateDir '_logs\.mcp-tests-audit.jsonl'
  $env:MCP_TEST_MEMORY_LOG_DIR = Join-Path $stateDir '_logs'
  $env:MCP_TEST_RATE_LIMIT_STATE_FILE = Join-Path $stateDir '_control\rate-limit-state.json'
  $env:MCP_TEST_TOOL_SURFACE_STATE_FILE = Join-Path $stateDir '_control\tool-surface-state.json'
  $env:MCP_TEST_WORKSPACE_INDEX_FILE = Join-Path $stateDir '_control\workspace-index.json'
  $serverArgs += @('--trigger-file', (Join-Path $stateDir '_control\restart-request.json'))
  $supervisor = Join-Path $codeDir 'scripts\server.ps1'
  if (-not (Test-Path -LiteralPath $supervisor)) { throw "supervisor not found in code dir $codeDir" }
  Write-KeeperLog ("code_dir={0} state_dir={1}" -f $codeDir, $stateDir)
  $shell = (Get-Process -Id $PID).Path
  $backoff = 5
  Write-KeeperLog ("keeper started; port={0} profile={1} auth={2}" -f $config.port, $config.profile, $config.auth)

  while ($true) {
    $started = Get-Date
    Write-KeeperLog 'starting supervisor'
    & $shell -NoProfile -NonInteractive -File $supervisor @serverArgs *>> (Join-Path $LogDir 'localnode-supervisor.log')
    $code = $LASTEXITCODE
    $ranSeconds = [int]((Get-Date) - $started).TotalSeconds
    # A run that lasted a while was healthy; reset the back-off so a later crash restarts fast.
    if ($ranSeconds -ge 300) { $backoff = 5 }
    Write-KeeperLog ("supervisor exited code={0} after {1}s; restarting in {2}s" -f $code, $ranSeconds, $backoff)
    Start-Sleep -Seconds $backoff
    $backoff = [Math]::Min(60, $backoff * 2)
  }
} catch {
  Write-KeeperLog ("keeper FAILED: {0}" -f $_.Exception.Message)
  exit 1
} finally {
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
