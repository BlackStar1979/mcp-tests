# Adjacent SEP Watchlist Review

Status: GREEN / WATCHLIST REVIEW COMPLETE / NO NEW LEDGER OPENED
Date: 2026-07-01

## Purpose

Review the partial-coverage watchlist created by:

- `_workflow/operator_decisions/adjacent_runtime_contract_sep_triage.md`
- `_workflow/operator_decisions/auth_security_adjacent_sep_triage.md`

Decide whether any of the remaining watchlist SEPs require a dedicated workflow ledger now.

## Decision

No new dedicated ledger is opened now.

Current repo evidence is sufficient to avoid speculative workflow expansion. Remaining watchlist items stay source-tracked with explicit future triggers instead of spawning more active records immediately.

## Review outcomes

### No new ledger required now

- `SEP-1613` Establish JSON Schema 2020-12 as Default Dialect for MCP
  - Existing schema audits, descriptor checks, and connector-shape guards are sufficient for current repo scope.
  - Revisit only if the project starts exporting or negotiating schema dialect explicitly.

- `SEP-1319` Decouple Request Payload from RPC Methods Definition
  - Current runtime already centralizes RPC validation and dispatch across `initialize`, `server/discover`, `tools/list`, and `tools/call`.
  - Revisit only if the repo introduces broader request-shape migrations beyond the current bridge.

- `SEP-991` Enable URL-based Client Registration using OAuth Client ID Metadata Documents
  - Current repo has DCR policy and local OAuth21 registration evidence, but it does not target external URL-based client metadata registration now.
  - Revisit only if TEST MCP decides to support that client-registration mode as a target behavior.

### Deferred until target surface exists

- `SEP-2164` Standardize Resource Not Found Error Code
  - No active `resources/*` runtime surface currently forces dedicated work.
  - Revisit before shipping a real `resources/*` surface.

- `SEP-973` Expose additional metadata for Implementations, Resources, Tools and Prompts
  - Current metadata coverage is selective and adequate for present scope.
  - Revisit before broad metadata expansion becomes an active target.

### Keep as the only semantics-sensitive watch item

- `SEP-1303` Input Validation Errors as Tool Execution Errors
  - Current tool-input validation exists and is enforced before tool execution.
  - A separate ledger is still unnecessary now, but this item should be the first reopened if tool-error semantics become an active migration topic.

## Future trigger rule

Open a dedicated ledger only when one of these becomes active target work:

1. real `resources/*` runtime expansion
2. explicit schema-dialect/export negotiation
3. broader request-payload contract migration beyond the current bridge
4. external URL-based client-registration support
5. broad metadata expansion across implementations/resources/tools/prompts
6. a deliberate tool-validation-error contract migration

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
