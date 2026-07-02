# Event-Driven Hotplug Lifecycle Reconciliation

Status: GREEN / HPL1-HPL4 RECONCILED / HPL5 GATED / NO LIVE EMISSION
Date: 2026-06-28

## Purpose

This stage reconciles the event-driven Hotplug lifecycle after P6. It does not enable live hotplug. It records that the repository already contains the necessary non-live foundations and adds one consolidated readiness read-model plus guard.

## Findings

- HPL1 registry abstraction: done by static/runtime registry context.
- HPL2 diff model: done by registry and tools/list diff dry-run pipeline.
- HPL3 state-store apply gate: done by state-store pipeline and apply readiness gate.
- HPL4 local harness emission: done for mock-only local harness.
- HPL5 runtime apply prototype: still gated and requires a separate explicit operator runtime step.

## Changes

- Added `src/hotplug_lifecycle_readiness.js`.
- Added `_tests/smoke_event_driven_hotplug_lifecycle.js`.
- Updated `SERVER_PLUGIN_VISIBILITY_POLICY_SPEC.json` with `hotplug_lifecycle_readiness`.

## Blocker reassessment

Removed as stale:

- HPL1 not started.
- HPL2 diff model not integrated.
- HPL3 apply gate unavailable.
- HPL4 local harness unavailable.

Still valid:

- HPL5 runtime apply prototype requires a separate explicit operator runtime step.
- Live `notifications/tools/list_changed` emission remains disabled.
- Real `tools/list` mutation remains disabled.
- State-store writes remain disabled.
- Dynamic import remains disabled.

## Declarations

- server_change: false; source read-model only, not runtime-imported by server path
- workflow_change: true
- schema_change: false for MCP connector-visible schema; policy spec map updated
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit

## Non-actions

- no runtime hotplug apply
- no real `notifications/tools/list_changed` emission
- no runtime `tools/list` mutation
- no state-store write
- no dynamic import enablement
- no connector refresh
- no public `3009` start
- no OAuth21 `3008` restart

## Validation

- `node _tests/smoke_event_driven_hotplug_lifecycle.js`
- `node _tests/smoke_list_changed_readiness_contract.js`
- `node _tests/smoke_list_changed_local_harness.js`
- `node _tests/smoke_list_changed_dry_run_pipeline.js`
- `node _tests/smoke_state_store_apply_readiness_gate.js`
- `node _tests/smoke_security_first_preflight.js`
- `node _tests/smoke_registry_diff_dry_run.js`
- `node _tests/smoke_runtime_registry_context_assembly.js`
- `node _tests/smoke_matrix_check.js`
- `node _tests/run_all_smokes.js --skip-network`
- `git diff --check`

## Next recommendation

After this stage, reassess blockers, connector refresh, and OAuth21 `3008` restart before acting. Current next substantive queue item is Sessionless / Explicit State Handles Target Selection.
