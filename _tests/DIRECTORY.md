# DIRECTORY

Status: active tests directory map
Updated: 2026-08-01

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
- `smoke_directory_docs_audit.js`
  Guard for churn-ranked `DIRECTORY.md` coverage on currently high-change directories.
- `smoke_build_index_tool.js`
  Regression coverage for workspace-index profiles, freshness, structured workflow extraction, and retrieval ranking.
- `smoke_operator_contract_docs.js`
  Guard for operator-facing documentation contract and initial DIRECTORY rollout.

This map is intentionally compact. The complete active inventory remains in `_tests/README.md` and `run_all_smoke_scripts.json`.
