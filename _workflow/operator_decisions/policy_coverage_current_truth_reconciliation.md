# Policy Coverage Current-Truth Reconciliation

Status: POLICY WORK ACTIVE / POL-1A-DLP RUNTIME LIVE ACCEPTED / CONNECTOR REFRESH PENDING
Date: 2026-08-17

## Declarations

- server_change: true
- workflow_change: true
- schema_change: false
- runtime_restart_required: true
- connector_refresh_required: false
- backup_required: true via Git commit boundary and structured-file backups
- rollback_path: git revert this package commit
- restore_path: controlled OAuth21 3008 restart after revert if this runtime change had been live-loaded

## Why this package exists

The active readiness state had converged to COMP-1 as the only open component while the canonical policy coverage matrix forbids a complete claim whenever any required policy is not implemented. Before this package the matrix contained 6 implemented policies and 18 required policies in partial, specified_only, or critical_specified states.

That mismatch combined stale status with genuine security debt, so bulk promotion was rejected.

## Reproduced runtime defect

SERVER_ROOTS_BOUNDARY_POLICY_SPEC.json requires symlink_escape = deny. The central src/util/workspace_roots.js safeWorkspacePath() enforced lexical containment only. A hermetic junction or symlink under the configured workspace root pointing to a sibling directory outside the root was accepted.

TDD evidence:

1. _tests/smoke_workspace_root_symlink_boundary.js was added first.
2. RED: safeWorkspacePath(escape/outside.txt) did not throw.
3. src/util/workspace_roots.js gained resolved-path containment against the nearest existing ancestor.
4. GREEN: the escape is rejected while a normal in-root non-existing destination remains allowed.
5. Existing hermetic consumers for workspace mutation, process-runner config, structured file selectors/transform, and science tools remained green.

The control is centralized so consumers of safeWorkspacePath inherit the same boundary. Structured file operations retain their stricter no-symbolic-link rule.

## Status reconciliations accepted

Four policies now have enough current repository evidence to be marked implemented for the accepted target:

- sampling_policy: classic Sampling is deprecated, session-bound helpers are retired, the surviving runtime emits no server-initiated requests, and unexpected client response envelopes fail closed.
- roots_boundary_policy: MCP roots are not advertised, lexical traversal is denied, configured roots are enforced, and symlink/junction escape now has a direct regression guard. Conditional roots/listChanged requirements remain inactive while the capability is not exposed.
- elicitation_policy: the target is unsupported-by-default; active initialize/server-discover capability maps do not advertise elicitation and the runtime has no server-initiated elicitation path. Enablement requirements remain conditional future controls.
- capability_attestation_policy: src/schema_compat.js centralizes descriptor/combined fingerprints, active discovery/list/status surfaces reuse them, src/tool_surface_state.js detects persisted surface drift, and listChanged is disabled. Descriptor signing remains an explicit future target rather than a blocker for the current contract.

The matrix therefore moves from 6/24 implemented to 10/24 implemented.

## Remaining required policy work

Fourteen required policies remain outside implemented and must remain visible to autonomous planning.

Partial: network_policy, plugin_visibility_policy, runtime_topology, rate_limit_quota_policy.

Specified only: memory_policy, database_policy, supply_chain_policy, incident_response_policy.

Critical specified: consent_policy, scope_minimization_policy, transport_security_policy, session_security_policy, prompt_content_policy, output_dlp_policy.

These statuses are not assumed to mean fourteen implementation projects. Some may be current-truth drift because later runtime work already covers part or all of the original gap. Each must be reconciled against current code and passing guards before implementation or status promotion.

## Additional current-truth repair

SERVER_RUNTIME_TOPOLOGY_SPEC.json still claimed 69 authenticated tools while current governed repository/runtime/connector truth is 98. The authority smoke also encoded 69. Both were corrected to 98 under a RED-to-GREEN guard. This does not by itself promote runtime_topology from partial.

## Planning consequence

A new POL-1 policy-coverage component is required. It is actionable now and has higher autonomous leverage than event-gated COMP-1A. COMP-1 remains valid but no longer represents the only open work.

Recommended sequence:

1. POL-1A-DLP: enforce one centralized fail-closed model-output validation/DLP boundary.
2. POL-1A-CONSENT: bind high-risk operations to a server-verifiable consent artifact.
3. POL-1A-PROMPT: classify content-bearing results as untrusted data and add an explicit instruction-promotion boundary.
4. POL-1B: reconcile the four partial policies.
5. POL-1C: reconcile the four specified_only non-critical policies.
6. COMP-1A remains event-gated and should run only on real Codex client-entry traffic newer than 0.148.0-alpha.9.

## POL-1A critical reconciliation

All six `critical_specified` rows were reconciled independently against current source and guards.

Implemented outcomes:

- `transport_security_policy`: a new regression first proved that a present foreign `Origin` reached route dispatch. `src/runtime/cors_policy.js` and `src/runtime/server_factory.js` now reject malformed, null, or non-allowlisted present origins with HTTP 403 before dispatch while requests without `Origin` remain valid for non-browser MCP clients.
- `scope_minimization_policy`: OAuth21 already issued only `mcp:tools`, but tool dispatch did not bind the granted scope set to runtime authorization. A RED test proved an empty scope set still executed `search`; `src/runtime/decision_runtime_policy.js` now requires `mcp:tools` for the active `oauth21/internal` profile before every tool execution and returns `insufficient_scope` otherwise.
- `session_security_policy`: current runtime evidence proves the policy's old session model is obsolete for the accepted target. The active `/mcp` route issues and consumes no transport-session state, passes `sessionId = undefined` / `session = null`, and advertises `protocol_sessions = false`; transport-session replay/TTL requirements are therefore inactive rather than missing controls.

Retained critical gaps:

- `consent_policy`: OAuth operator authorization and CBM deletion confirmation exist, but high-risk tool execution has no generalized server-verifiable consent receipt. In particular, destructive process tools are still admitted as `guarded_process_execution` without such an artifact.
- `prompt_content_policy`: content-bearing tool results lack centralized untrusted-content classification, hidden-instruction detection, and an explicit instruction-promotion boundary.
- `output_dlp_policy`: optional tool payloads still reach `toolResult()` without one centralized output-schema/secret/resource-link validation gate.

Coverage is therefore `13/24` implemented. Eleven required rows remain outside implemented: four partial, four specified-only, and three critical-specified.

## Runtime/load boundary

The earlier configured-root symlink/junction fix is already live-loaded from commit `555fad0`. The POL-1A runtime package was committed and pushed as `cbbb284`, then live-loaded through controlled supervisor request `manual-1786993215906` (exit code `42`, reason `pol_1a_transport_scope_live_load`). Audit reports `server_start_id = 2026-08-17T19:00:17.718Z`; `/healthz` returned `200`, OAuth21/internal, `tools_count = 98`; tool-surface state retained combined fingerprint `ec7d3af5b4ea17f5`; connector calls continued with the existing OAuth state; and pre-restart durable job `63fd7f1c-aa84-4b10-9c75-793c0c66231e` is readable with `recovered_after_restart = true`. No connector refresh was required because no MCP tool name, descriptor, input schema, output schema, or annotation changed.

## Existing root-boundary live acceptance

Controlled supervisor request `manual-1786988583476` with exit code `42` live-loaded source commit `555fad0` on OAuth21 `3008`.

Accepted evidence for that earlier load remains:

- audit `server_start` reports `server_start_id = 2026-08-17T17:43:05.322Z`;
- `GET http://127.0.0.1:3008/healthz` returned `200`, OAuth21/internal, and `tools_count = 98`;
- tool-surface state retained fingerprint `ec7d3af5b4ea17f5` with no surface-change event;
- connector-visible TEST MCP calls and durable process recovery survived;
- no connector refresh or OAuth reauthorization was required.

`POL-1` remains `2/4`. The `13/24` count and DLP-next statement above describe the August 17 critical-reconciliation checkpoint; the continuation below records the subsequent DLP implementation and live acceptance.

## POL-1A-DLP continuation and live acceptance — 2026-08-18

`output_dlp_policy` is now implemented, raising current coverage to `14/24`; ten required rows remain outside implemented: four partial, four specified-only, and two critical (`consent`, `prompt/content`). The next product package is `POL-1A-CONSENT`, but authenticated-connector refresh/review remains an external checkpoint before normal autonomous progression.

Implementation centralized JSON Schema 2020-12 validation, secret redaction, untrusted-output metadata, resource-link filtering, embedded-resource handling, and fail-closed process Task validation. Full DLP enforcement also exposed ten impossible empty closed-object output schemas on developer/code-mutation tools; those schemas were repaired to bounded real top-level result contracts. The governed runtime target remains `98` tools with unchanged names and input-schema fingerprint, and new output/descriptor/combined fingerprints `8292895f0216967c` / `82ffaaa3adb6e7db` / `93721a82a339f9d6`.

Live loading required three evidence-bearing iterations rather than one acceptance-by-restart:

1. Source commit `02a5e5e8e864f7e8a8851826f72766f04ad82393` was loaded by request `manual-1787027396070`; live `read_file` then exposed an overly strict sanitizer rejection of optional `undefined` object properties, so that load was rejected as final acceptance.
2. Corrective commit `9ab8ec5` was loaded by request `manual-1787027659863`; live execution recovered, but post-live audit exposed an over-broad JWT heuristic that redacted dotted code identifiers such as `current_runtime_truth.oauth21_3008.restart_required_now`, so that load also remained non-final.
3. Final corrective source commit `b385c88` narrowed JWT detection to `eyJ`-prefixed Base64URL token shapes. The complete offline gate after that correction was GREEN at `7 public + 308 authenticated`, exit `0`, empty stderr, no truncation. Request `manual-1787027984160` loaded it on OAuth21 `3008`; accepted `server_start_id = 2026-08-18T04:39:45.722Z`, `/healthz = 200`, `tools_count = 98`, tool-surface state equals combined fingerprint `93721a82a339f9d6`, and durable pre-restart job `a25dc670-dd33-4a7a-8131-decfacc321c7` is readable with `recovered_after_restart = true`.

Runtime restart is therefore complete and `restart_required_now = false`. The ChatGPT connector/model cache still reflects the earlier combined fingerprint `ec7d3af5b4ea17f5`; because output schemas and descriptor fingerprints changed, `connector_refresh_required_now = true`. Current tooling does not expose an authenticated-connector refresh/reconnect action, so that remaining checkpoint is an explicit external operator/UI action rather than another server mutation.