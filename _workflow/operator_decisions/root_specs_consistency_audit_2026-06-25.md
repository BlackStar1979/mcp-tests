# Root server specs consistency audit

Date: 2026-06-25
Status: GREEN / ROOT SPECS REPAIRED / NO RUNTIME CHANGE

## Scope

Audit and repair root `SERVER*.json` specifications for completeness, freshness, relational consistency, and non-log semantics.

No runtime restart and no connector refresh were performed.

## Findings repaired

1. `SERVER_STAGE12.json` remained in root as a historical work-progress consolidation. It was removed from active root specs.
2. Active decision/runtime contract was extracted to `SERVER_DECISION_RUNTIME_SPEC.json`.
3. Full historical source was preserved under `_workflow/historical/stage12_workflow_history.json`.
4. `SERVER_SPEC.json` now points to `SERVER_DECISION_RUNTIME_SPEC.json` and records Stage12 as retired from root specs.
5. `SERVER_POLICY_RUNTIME_SPEC.json` scope now reflects that runtime enforcement is active for Stage14.5.
6. `SERVER_CONNECTOR_SURFACE_SPEC.json` authenticated target count was corrected from stale `45` to current `43`, with `45` retained only as historical count.
7. `SERVER_SAMPLING_POLICY_SPEC.json` was normalized with `spec_mode`, `scope`, `runtime_enforced`, and `connector_visible` fields.
8. `_workflow/state.json` root spec map was updated to reference `SERVER_DECISION_RUNTIME_SPEC.json`, not the retired Stage12 root file.
9. `_workflow/scripts/load_server_specs.js` now loads `SERVER_DECISION_RUNTIME_SPEC.json`; legacy `loadStage12Spec()` remains as an alias for old validation scripts but no longer reads a root Stage12 file.
10. Added `_tests/smoke_root_server_specs_consistency.js` to prevent regression.

## Validation

- `node _tests/smoke_root_server_specs_consistency.js` -> ok
- `node _tests/smoke_workflow_state_orientation_map.js` -> ok
- `node _tests/run_all_smokes.js --skip-network` via wrapper -> ok, public=6, tests_authenticated=167

## Current active root specs

- `SERVER_SPEC.json`
- `SERVER_AUTH_SPEC.json`
- `SERVER_CONNECTOR_SURFACE_SPEC.json`
- `SERVER_TOOLS_SPEC.json`
- `SERVER_PROFILES_SPEC.json`
- `SERVER_AUTHZ_DECISION_SPEC.json`
- `SERVER_DECISION_RUNTIME_SPEC.json`
- `SERVER_RESOURCE_POLICY_SPEC.json`
- `SERVER_POLICY_RUNTIME_SPEC.json`
- `SERVER_NETWORK_POLICY_SPEC.json`
- `SERVER_MEMORY_POLICY_SPEC.json`
- `SERVER_DATABASE_POLICY_SPEC.json`
- `SERVER_PLUGIN_VISIBILITY_POLICY_SPEC.json`
- `SERVER_SAMPLING_POLICY_SPEC.json`
