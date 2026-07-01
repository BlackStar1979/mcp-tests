# Adjacent Runtime-Contract SEP Triage

Status: GREEN / WORKFLOW-ONLY TRIAGE / NO RUNTIME CHANGE
Date: 2026-07-01

## Purpose

Triage the 19 Final SEPs currently classified in `_workflow/sessionless_inventory.json#all_seps_index` as `adjacent_runtime_contract`.

This record does not authorize runtime changes by itself. It only decides which adjacent runtime-contract SEPs are already adequately covered by existing runtime/spec/test evidence, which are currently explicit non-target or disabled-by-policy areas, and which remain a bounded watchlist for possible future dedicated ledgers.

## Covered by existing runtime/spec/test evidence

- `SEP-2322` Multi Round-Trip Requests
  - Covered by session pending-response handling and `_tests/smoke_pending_request_correlation.js`.
- `SEP-2260` Require Server requests to be associated with a Client request
  - Covered by the same pending-response/correlation path and bounded server-initiated request handling.
- `SEP-2243` HTTP Header Standardization for Streamable HTTP Transport
  - Covered by active boundary guards around `MCP-Protocol-Version`, auth/CORS behavior, and streamable-HTTP request handling.
- `SEP-2106` Tools `inputSchema` and `outputSchema` conform to JSON Schema 2020-12
  - Covered by schema audits, descriptor checks, and connector-shape self-tests.
- `SEP-1577` Sampling With Tools
  - Covered by active sampling runtime/context and `_tests/smoke_sampling_roundtrip.js`.
- `SEP-986` Specify Format for Tool Names
  - Covered by descriptor/name validation and profile schema guards.

## Explicit non-target, disabled-by-policy, or no current repo dependency

- `SEP-2663` Tasks Extension
  - No MCP tasks extension surface is implemented; internal memory-task storage is not this SEP.
- `SEP-1686` Tasks
  - Same disposition as `SEP-2663`; no MCP task lifecycle surface is active.
- `SEP-1865` MCP Apps - Interactive User Interfaces for MCP
  - Not an active target of this server repo.
- `SEP-1699` Support SSE polling via server-side disconnect
  - Explicit non-target because TEST MCP now targets no SSE on the surviving route.
- `SEP-1330` Elicitation Enum Schema Improvements and Standards Compliance
  - Elicitation remains unsupported-by-default and policy-only.
- `SEP-1036` URL Mode Elicitation for secure out-of-band interactions
  - Elicitation remains unsupported-by-default and policy-only.
- `SEP-1034` Support default values for all primitive types in elicitation schemas
  - Elicitation remains unsupported-by-default and policy-only.
- `SEP-414` OpenTelemetry Trace Context Propagation Conventions
  - No active distributed tracing or trace-context propagation contract is currently part of the repo target.

## Partial-coverage watchlist

- `SEP-2164` Standardize Resource Not Found Error Code
  - No active resource surface currently forces dedicated work, but this should be revisited before expanding `resources/*` handling.
- `SEP-1613` Establish JSON Schema 2020-12 as Default Dialect for MCP
  - Current schema audits cover strict object-shape expectations, but no separate dialect/export ledger exists.
- `SEP-1319` Decouple Request Payload from RPC Methods Definition
  - Current runtime already centralizes RPC validation/dispatch, but no explicit workflow record maps that behavior to this SEP.
- `SEP-1303` Input Validation Errors as Tool Execution Errors
  - Current tool-input validation exists, but no dedicated workflow statement freezes exact error-mode intent against this SEP.
- `SEP-973` Expose additional metadata for Implementations, Resources, Tools and Prompts
  - Metadata exists in selected surfaces, but broader metadata expansion is not yet a tracked target.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- public_3009_start_required: false

## Validation

- `_tests/smoke_sep_sessionless_inventory.js`
- `_tests/smoke_workflow_navigation_index.js`
- full `node _tests/run_all_smokes.js --skip-network`
