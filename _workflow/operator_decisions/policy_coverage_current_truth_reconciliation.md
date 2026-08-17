# Policy Coverage Current-Truth Reconciliation

Status: REPO-APPLIED / ROOT-BOUNDARY FIX GREEN / POLICY WORK REOPENED
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

1. POL-1A: reconcile the six critical_specified policies against current runtime and guards, promoting only proven coverage and opening bounded implementation packages for real gaps.
2. POL-1B: reconcile the four partial policies.
3. POL-1C: reconcile the four specified_only non-critical policies.
4. CI-1 assessment may follow once canonical product/readiness truth no longer hides required target work.
5. COMP-1A remains event-gated and should run only on real Codex client-entry traffic newer than 0.148.0-alpha.9.

## Runtime/load boundary

The source fix changes runtime-imported src/util/workspace_roots.js. Repository tests can validate it immediately, but the currently running OAuth21 3008 process does not gain the fix until an approved controlled restart through the existing supervisor authority. No connector refresh is required because the MCP-visible tool surface and schemas do not change.

## Live-load acceptance

Controlled supervisor request `manual-1786988583476` with exit code `42` live-loaded source commit `555fad0` on OAuth21 `3008`.

Accepted live evidence:

- audit `server_start` reports `server_start_id = 2026-08-17T17:43:05.322Z`;
- `GET http://127.0.0.1:3008/healthz` returned `200`, OAuth21/internal, and `tools_count = 98`;
- tool-surface state loaded the prior fingerprint and saved current fingerprint `ec7d3af5b4ea17f5`, with no `tool_surface_changed` event for the new server start;
- connector-visible TEST MCP calls remained callable after restart;
- durable full-suite job `32fc6867-a5fc-4000-9a3f-2c58f22b680c`, created before restart, was still readable afterward with `recovered_after_restart = true`;
- no connector refresh or OAuth reauthorization was required.

The configured-root symlink/junction fix is therefore repo-applied and live-loaded. `POL-1` remains `2/4` because fourteen required policy rows still need evidence-based reconciliation; the next package remains `POL-1A`.
