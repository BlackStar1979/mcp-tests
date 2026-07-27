# DIRECTORY

Status: active codebase-memory integration directory map
Updated: 2026-07-27

- `cbm_cli_bridge.js`
  Native process bridge for executable discovery, stdin JSON transport, timeouts, output parsing, normalization, and queue-aware execution.
- `cbm_contract_registry.js`
  Loads and validates versioned native CBM contract manifests used by bridge compatibility checks.
- `cbm_tools.js`
  Runtime-facing CBM orchestration, containment, mutation locking, ADR preservation, error mapping, and result shaping.
- `contracts/`
  Versioned native codebase-memory contract manifests; currently anchored to v0.9.0.

This directory describes bridge and runtime behavior. Repository files remain repository truth, while persisted CBM graphs and ADR data remain index truth.
