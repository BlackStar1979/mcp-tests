# OAuth21 Prune Control Plane

Status: GREEN / CONTROL-PLANE ONLY / EXPLICIT APPLY
Date: 2026-07-12

## Scope

This record documents the bounded OAuth21 prune control-plane package for stale client and token maintenance. The package is operator-controlled and file-path-driven. It does not expose a new MCP runtime tool, does not auto-apply during server startup, does not mutate runtime-imported request handling, and does not change connector auth flow by itself.

## Code artifacts

This package adds or uses:

```text
src/auth/oauth21_prune_preview.js
src/auth/oauth21_prune_receipt.js
src/auth/oauth21_prune_apply_gate.js
src/auth/oauth21_prune_apply_package_draft.js
src/auth/oauth21_prune_apply.js
_workflow/scripts/test_mcp_oauth21_prune.js
```

The runtime status path may surface preview metadata for observability, but prune apply remains outside the runtime request surface.

## Control-plane contract

- `Status` reports control-plane roots only.
- `Plan` builds preview, receipt, gate, and apply-package draft from explicit OAuth state and clients files, then writes a plan record.
- `Execute` requires an approval-marker file and explicit target files, then writes backups, receipts, and an execute or denied record.
- `Rollback` restores the backed-up files from a successful execute record and writes a rollback record.

Default control-plane paths:

- records: `_workflow/control_plane/oauth21_prune_records/`
- backups: `_workflow/control_plane/oauth21_prune_backups/`
- audit log: `MCP_TEST_AUDIT_LOG` or `_logs/.mcp-tests-audit.jsonl`

Required approval marker id:

```text
operator_approved_oauth21_prune_apply
```

## Example commands

Plan:

```powershell
node _workflow/scripts/test_mcp_oauth21_prune.js `
  --mode Plan `
  --oauth-state-file C:\path\to\tests_oauth_state.json `
  --oauth-clients-file C:\path\to\tests_oauth_clients.json `
  --operator operator `
  --reason "manual oauth21 prune plan"
```

Execute:

```powershell
node _workflow/scripts/test_mcp_oauth21_prune.js `
  --mode Execute `
  --oauth-state-file C:\path\to\tests_oauth_state.json `
  --oauth-clients-file C:\path\to\tests_oauth_clients.json `
  --approval-marker-file C:\path\to\approval_marker.json `
  --operator operator `
  --reason "manual oauth21 prune execute"
```

Rollback:

```powershell
node _workflow/scripts/test_mcp_oauth21_prune.js `
  --mode Rollback `
  --record-file C:\Work\mcp-tests\_workflow\control_plane\oauth21_prune_records\<run_id>.executed.json
```

## Apply boundary

Prune apply is allowed only when all of the following are true:

- preview and receipt match;
- gate verification passes;
- approval-marker file is present and explicitly approved;
- backup directory is configured;
- rollback receipt is emitted;
- the operation stays in explicit control-plane execution.

This package intentionally keeps runtime apply blocked unless the operator runs the explicit control-plane command with the required approval material.

## Non-actions

- no automatic prune apply during startup
- no runtime-imported auth-path mutation triggered by status or health routes
- no connector-visible MCP tool for prune apply
- no connector refresh as part of plan-only wiring
- no OAuth login/logout side effects
- no server restart as part of plan-only wiring
- no baseline refreeze
- no hidden migration of durable OAuth files

## Final validation

- `node _tests/smoke_oauth21_prune_control_plane.js`: ok.
- `node _tests/smoke_oauth21_prune_apply_package_draft.js`: ok.
- `node _tests/smoke_oauth21_prune_apply.js`: ok.
- `node _tests/smoke_oauth21_prune_control_plane_script.js`: ok.
- `node _tests/smoke_control_plane_audit_env_awareness.js`: ok.
- `node _tests/smoke_repo_hygiene_audit.js`: ok.
