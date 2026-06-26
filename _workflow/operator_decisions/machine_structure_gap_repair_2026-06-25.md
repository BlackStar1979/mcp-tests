# Machine structure gap repair

Date: 2026-06-25
Status: GREEN / STRUCTURE GAPS REPAIRED / NO RUNTIME CHANGE

## Scope

Repair remaining machine-structure gaps after root spec cleanup. This was not a runtime deploy, connector refresh, or live server restart.

## Repairs

- Added `SERVER_RUNTIME_TOPOLOGY_SPEC.json` as the active root authority for runtime topology and restart-authority boundaries.
- Updated `SERVER_SPEC.json` and `_workflow/state.json` to reference the runtime topology spec.
- Updated `_workflow/sessionless_inventory.json`: removed stale `Audit all 41 Final SEPs...` next item and changed `restart_resilience` from `pending` to `partial` because authority boundary now exists, while the actual restart mechanism remains missing.
- Added `_tests/smoke_runtime_topology_authority.js`.
- Extended root/state/sessionless guards.
- Removed final log residue from `SERVER_DECISION_RUNTIME_SPEC.json`.
- Updated `_workflow/README.md` to describe `SERVER_RUNTIME_TOPOLOGY_SPEC.json`.

## Current truth

Machine structure is stricter but not operationally complete. Restart authority for OAuth21 3008 is still `missing_not_recovered`; live-load work for 3008 remains blocked until it is restored and tested.

## Validation

- `smoke_runtime_topology_authority` -> ok
- `smoke_root_server_specs_consistency` -> ok
- `smoke_workflow_state_compact_spec_map` -> ok
- `smoke_stage14_6_sep_sessionless_inventory` -> ok
- full `run_all_smokes --skip-network` -> ok, public=6, tests_authenticated=168
