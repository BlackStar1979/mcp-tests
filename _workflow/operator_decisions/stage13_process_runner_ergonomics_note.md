# Stage 13.4 - Process Runner Ergonomics Note

Status: GREEN / NOTE AND GUARD ONLY
Date: 2026-06-24

## Scope

Stage 13.4 records operator-facing ergonomics for using the bounded process runner during future repository work. It does not change process-runner policy, command allowlists, runtime code, connector configuration, or deployment state.

## Boundary

server_change: false
workflow_change: true
schema_change: false
runtime_restart_required: false
connector_refresh_required: false
backup_required: false
rollback_path: revert workflow-only documentation/state/test-guard changes
restore_path: this file, _workflow/WORKFLOW_CANON.md, _workflow/ACTIVE_WORKFLOW_INDEX.md, _workflow/state.json, _tests/smoke_stage13_process_runner_ergonomics_note.js, _tests/run_all_smoke_scripts.json, _tests/smoke_stage12_streamable_http_workflow_plan.js

## Current process-runner policy snapshot

- Allowed commands: git, node, npm, powershell, pwsh, py, pytest, python.
- Default timeout: 30000 ms; maximum timeout: 120000 ms.
- Default output cap: 60000 characters; hard output cap: 250000 characters.
- Raw PowerShell is disabled. PowerShell requires -File with a workspace-local .ps1 script unless explicitly enabled.
- Workspace root used here: C:\Work.
- Caller environment is sanitized; only selected parent environment keys are inherited.

## Observed ergonomics debt

- Long inline process arguments can be rejected before process execution. Observed limit class: single argument too long.
- Sporadic tool-layer blocks can occur even for short git commands. Treat these as tool transport constraints unless repeated alternative probes indicate repository failure.
- Large run_all output can be truncated. Prefer recording the summary fields: ok, version, stage, public count, and tests_authenticated count.
- CRLF warnings may appear on touched files that are already covered by .gitattributes. Treat warnings separately from git diff --check whitespace errors.
- Do not infer dirty state solely from one blocked status/log/list command. Cross-check with git diff --name-only, git diff --cached --name-only, and git status --porcelain when available.

## Operator practice

1. Prefer small, bounded commands with explicit cwd, timeout, and output cap.
2. For generated files, prefer workspace file operations or short script files over long node -e payloads.
3. If one process call is blocked by the tool layer, retry once with a smaller equivalent command.
4. If the same command class is blocked twice, stop that route and use a lower-risk equivalent probe.
5. Keep validation evidence concise; do not paste full run_all result bodies into workflow files.
6. Never convert a process-runner block into a runtime diagnosis without independent evidence.

## Non-actions

- no process-runner policy change
- no command allowlist change
- no raw PowerShell enablement
- no runtime code patch
- no deploy
- no runtime restart
- no connector refresh
- no public connector reconnect
- no runtime enforcement
- no allow/deny behavior change
- no dispatch behavior change
- no hotplug/list_changed emission
- no sessionless migration
