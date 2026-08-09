# DIRECTORY

Status: active tests directory map
Updated: 2026-08-09

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
- `smoke_operational_e2e_matrix.js`
  Guard for OPS-1A family classification, evidence references, explicit gaps, and bounded runner selection.
- `live_cloudflare_boundary_probe.js`
  Explicit non-default read-only live probe for Cloudflare health, OAuth metadata, method guard, and auth challenge.
- `operational_network_manifest.json`
  One-entry live network manifest that supplies the full isolated MCP harness required by `smoke_network.js`.

This map is intentionally compact. The complete active inventory remains in `_tests/README.md` and `run_all_smoke_scripts.json`.
