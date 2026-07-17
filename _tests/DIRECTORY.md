# DIRECTORY

Status: active tests directory map
Updated: 2026-07-17

- `archive/`
  Archived legacy and stale smoke material retained for traceability only.
- `fixtures/`
  Static fixtures used by smoke tests.
- `helpers/`
  Reusable helper modules for smoke/test assertions and baselines.
- `targeted_debt/`
  Focused debt-review and readiness artifacts outside the default run-all surface.
- `README.md`
  Orientation, inventory, and maintenance rules for the `_tests` tree.
- `run_all_smokes.js`
  Active smoke harness entrypoint.
- `run_all_smoke_scripts.json`
  Default active smoke manifest.
- `smoke_operator_contract_docs.js`
  Guard for operator-facing documentation contract and initial DIRECTORY rollout.
- `smoke_wait_for_client_entry_path.js`
  Guard for the polling helper that waits for the next fresh client entry-path evidence in the audit log.

This map is intentionally compact. The complete active inventory remains in `_tests/README.md` and `run_all_smoke_scripts.json`.
