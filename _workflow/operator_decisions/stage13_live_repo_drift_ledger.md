# Stage 13.1 - Live/Repo Drift Ledger

Status: green
Date: 2026-06-24

## Scope declaration

```text
server_change: false
workflow_change: true
schema_change: false
runtime_restart_required: false
connector_refresh_required: false
backup_required: false
rollback_path: revert workflow-only documentation changes or restore tool-created edit backups
restore_path: stage13_live_repo_drift_ledger.md, WORKFLOW_CANON.md, ACTIVE_WORKFLOW_INDEX.md, state.json
```

## Boundary

Stage 13.1 records current repository and runtime drift evidence only. It does not deploy, restart runtimes, refresh connector maps, reconnect the public connector, enable runtime enforcement, change allow/deny behavior, emit list_changed, or migrate to Sessionless MCP.

## Repository truth

```text
branch_ref: refs/heads/main
HEAD: 7953781c08e337d37d5fc78acb982304b246450e
HEAD_short: 7953781c08e3
latest_commit: docs: record post-stage12 server environment review
package_version: 0.40.0
git_status_porcelain: clean
git_diff_check: ok
```

## Workflow truth

```text
previous_current_work_package: post_stage12_server_environment_review
stage12_status: green_stage12_closed
stage12_ready_for_operator_review: true
stage12_ready_for_runtime_enforcement: false
recommended_next_stage: Stage 13 - Server Environment Debt Remediation and Drift Ledger
recommended_first_step: 13.1 Live/repo drift ledger
```

## Local runtime truth

```text
3005: retired access -> NO_LISTENER / ECONNREFUSED
3006: retired bearer -> NO_LISTENER / ECONNREFUSED
3008: authorized oauth21 -> LISTENING / connect_ok
3009: public none -> LISTENING / connect_ok
```

## Health checks

```text
public local: HTTP 200, version=0.40.0, auth.mode=none, profile=public, tools_count=13
oauth21 local: HTTP 200, version=0.40.0, auth.mode=oauth21, profile=internal, tools_count=43
```

## Public local tool surface

Public local `tools/list` returned HTTP 200 and 13 tools.

```text
fetch
fs_get_public_info
fs_list_public
fs_read_public_chunk
fs_read_public_lines
fs_read_public_text
net_check_npm_package
net_check_pypi_package
net_check_url_head
net_fetch_github_raw
net_fetch_text_allowlisted
net_http_get_allowlisted
search
```

Fingerprint: count=13, names_hash=0852d07b373a25ed, baseline_match=true.

Drift classification: current public runtime matches the frozen public baseline. The post-Stage 12 state value `f2830cb7817520ac` is classified as a historical measurement mismatch, not current runtime drift.

## Authorized OAuth21 runtime truth

```text
server_name: mcp-tests-response-shape
server_version: 0.40.0
connector_shape_version: 2025-05-strict-v1
output_mode: structured
auth.mode: oauth21
profile.mode: internal
port: 3008
tool_count: 43
tool_names_hash: 8b62ecaf89227335
schema_compatibility.status: ok
security_boundary.status: ok
```

Runtime identity distinction remains active: `runtime_stage_status=stage8_20-runtime-status-compact-mode` and semantics `runtime-compatibility-label-not-repo-progress-label`. This is not workflow progress drift; it is Stage 13.2 debt.

## OAuth/internal unauthenticated rejection check

Unauthenticated POST to the local OAuth21 MCP endpoint returned HTTP 401 with `auth.mode=oauth21` and `auth_error=missing_bearer_token`. Classification: hard_fact. Status: expected fail-closed behavior.

## Observability snapshot

Observability returned success=true, server_version=0.40.0, auth_mode=oauth21, profile=internal, enabled_tool_count=43, security_boundary_status=ok, audit_jsonl_health.status=ok, delayed_response_count=0, unknown_tool_count=0, port_conflict_count=0, and server_error_count=0. Raw audit export remains redacted-summary only.

## Tooling notes

```text
- Git status with an extra trace identifier was blocked; the same status without that field succeeded.
- Larger inline node probes were intermittently blocked; smaller bounded probes succeeded.
- Candidate bounded tool: server_environment_drift_status, read-only, no raw audit export, no mutation.
```

## Non-actions confirmed

```text
no deploy
no runtime restart
no connector refresh
no public connector reconnect
no runtime enforcement
no allow/deny behavior change
no dispatch behavior change
no hotplug/list_changed emission
no sessionless migration
```
