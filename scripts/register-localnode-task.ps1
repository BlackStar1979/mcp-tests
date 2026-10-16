# Registers (or re-registers) the per-user Task Scheduler task that keeps LocalNodeMCP running.
#
#   pwsh -File scripts\register-localnode-task.ps1            # register/update, do not start
#   pwsh -File scripts\register-localnode-task.ps1 -Start     # register/update and start now
#   pwsh -File scripts\register-localnode-task.ps1 -Stop      # stop keeper, supervisor AND server
#   pwsh -File scripts\register-localnode-task.ps1 -Remove    # stop everything and unregister
#
# The task runs scripts/localnode-keeper.ps1 at the operator's logon, as the operator, without
# elevation. The keeper owns restarts; the task's own restart policy is only a backstop for a
# keeper that died. Operator approval for background autostart: 2026-10-16.

[CmdletBinding()]
param(
  [switch] $Start,
  [switch] $Stop,
  [switch] $Remove
)

$ErrorActionPreference = 'Stop'
$TaskName = 'LocalNodeMCP'

function Stop-LocalNodeTree {
  # Stop-ScheduledTask ends only the keeper; its supervisor and node server survive as orphans.
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  $repo = [regex]::Escape((Split-Path -Parent $PSScriptRoot))
  Get-CimInstance Win32_Process |
    Where-Object { $_.CommandLine -match 'localnode-keeper\.ps1|scripts\\server\.ps1' -or ($_.Name -eq 'node.exe' -and $_.CommandLine -match 'server\.js --profile') } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; Write-Host "stopped pid=$($_.ProcessId) $($_.Name)" }
}

if ($Stop) {
  Stop-LocalNodeTree
  exit 0
}

if ($Remove) {
  Stop-LocalNodeTree
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Removed task $TaskName (if it existed)."
  exit 0
}

$keeper = Join-Path $PSScriptRoot 'localnode-keeper.ps1'
# The Store-packaged pwsh lives under a VERSIONED WindowsApps path that disappears on update; the
# per-user app execution alias is stable.
$shell = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\pwsh.exe'
if (-not (Test-Path $shell)) { $shell = (Get-Command pwsh -ErrorAction Stop).Source }
$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

# Windows 11 hands every new console to the default terminal (Windows Terminal), so
# `-WindowStyle Hidden` still opened an empty window on each start (operator report, 2026-10-16).
# A headless conhost gives the keeper a console that is never shown and never delegated.
$conhost = Join-Path $env:WINDIR 'System32\conhost.exe'
$action = New-ScheduledTaskAction -Execute $conhost `
  -Argument ('--headless "{0}" -NoProfile -NonInteractive -File "{1}"' -f $shell, $keeper) `
  -WorkingDirectory (Split-Path -Parent $PSScriptRoot)
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal `
  -Settings $settings -Description 'LocalNodeMCP (C:\Work\mcp-tests): keeps the local production MCP server on 127.0.0.1:3008 running.' `
  -Force | Out-Null
Write-Host "Registered task $TaskName for $user."

if ($Start) {
  Start-ScheduledTask -TaskName $TaskName
  Write-Host "Started task $TaskName."
}
