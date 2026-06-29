# TEST MCP WORKFLOW CANON

Status: ACTIVE
Created: 2026-06-19
Purpose: Replace scattered historical workflow notes with one compact operational canon.

## 1. Non-negotiable operating rules

- Chat replies to the operator: Polish.
- Code, workflow artifacts, handoff content, manifests, and docs: English.
- Do not create new workflow memory files when this canon can be updated.
- Do not append loose notes to EOF. Update canonical sections in place.
- Keep truth layers separate: code, runtime, connector/UI, workflow evidence, external docs.
- Every new step must declare: `server_change`, `workflow_change`, `schema_change`, `runtime_restart_required`, `connector_refresh_required`, `backup_required`, `rollback_path`, `restore_path`.
- Full smoke or targeted smoke must guard every lasting rule. Unguarded prose is not policy.
- Historical workflow files are evidence only. They do not override this canon, current code, or current passing guards.

## 2. Truth layers

- Repository code truth: `server.js`, `src/**`, `tools/**`, `profiles/**`, schema modules, runtime-imported code.
- Runtime truth: active process, live port, live auth mode, live profile, live tool surface.
- Connector/UI truth: ChatGPT connector action list, refresh state, approval dialogs.
- Workflow truth: `_workflow/**`, `_tests/**`, `_workflow/control_plane/**`, `_logs/**`; governance and evidence only unless imported by runtime. Root `_backups/**` is retired and must not be recreated.
- External truth: current OpenAI/MCP/platform docs. Use web when current API/platform behavior matters.

## 3. Current validated state

- Server name: `mcp-tests-response-shape`.
- Server version: `0.40.0`.
- Connector shape version: `2025-05-strict-v1`.
- Output mode: `structured` by default.
- Latest known full smoke: `node ./_tests/run_all_smokes.js --skip-network = ok_0_40_0_6_192`.
- Latest validated public section count: `6`.
- Latest validated authenticated smoke count: `192`.
- Runtime stage label may remain a compatibility label and may lag repo progress.
- Runtime identity / workflow stage boundary: `runtime_stage_status` is a runtime/API compatibility label only. Workflow progress truth is `_workflow/state.json` and `_workflow/WORKFLOW_CANON.md`.
- Do not treat `runtime_stage_status` as repo progress, deployment progress, or workflow-stage truth.
- Changing `src/stage_metadata.js` is a runtime-imported code change; it requires separate runtime-change scoping and restart decision if intended to affect live runtime identity.
- Workflow file count is not a project-progress metric. `_workflow/control_plane/` contains many retained evidence artifacts; active navigation is `_workflow/ACTIVE_WORKFLOW_INDEX.md`, not a new master document.
- Current active remaining work queue is maintained in `_workflow/WORKFLOW_CANON.md` and mirrored in `_workflow/ACTIVE_WORKFLOW_INDEX.md`. `_workflow/state.json` is only a compact machine-readable orientation map.
- Stage 13 is closed. The earlier no-Stage-14-implementation boundary is historical; later explicit Stage 14 records supersede it for Stage 14.5/14.7/14.8/14.9 only.
- Step39 semantic correction: Step39 is a workstream boundary/control review. The P1 decision-runtime coverage package is supporting evidence, not the definition of Step39.
- Step40 correction: workflow rules must be guarded by smoke, not merely documented.

## 3A. Current active work queue

The active queue is deliberately short. Historical plans are evidence, not current next-work lists.

1. CRLF Batch Normalization.

Next recommended action: Legacy retired auth archive/cleanup and sessionless-ready root spec review are complete. Connector refresh is not required; OAuth21 3008 restart is not required now; public 3009 start is not required. Proceed to CRLF Batch Normalization if still desired.

## 4. Runtime architecture

`server.js` is a thin entrypoint:

```text
server.js -> src/runtime/server_bootstrap_runtime.js
```

Runtime flow:

```text
runServerBootstrapRuntime
  -> parse CLI/auth/profile/output/log config
  -> create runtime support/status/optional-tools assemblies
  -> runConfiguredRuntime
      -> createMcpRuntimeHandlers
      -> runServerLifecycle
          -> self-test or HTTP server start
```

MCP request flow:

```text
createServer
 -> dispatchCreateServerRoute
 -> handleMcp
 -> dispatchMcpEntry
 -> parse request body
 -> dispatchRpcMessage
 -> initialize | ping | tools/list | tools/call
```

Decision runtime shim flow:

```text
tools_call_handler
 -> buildDecisionRuntimeContext
 -> evaluateDecisionRuntimePolicy
 -> buildDecisionRuntimeReceipt
 -> audit tool_call_decision
 -> allow / unknown_tool / malformed_context
```

Current decision runtime enforces tool policy basics: tool policy existence, profile allowance, auth-required denial, public tool list, public-safe status, public filesystem scope, and destructive-tool denial. Full resource/scope matrix enforcement remains broader than current runtime.

## 5. Active controls

Active unless an explicit operator decision package changes them:

- Auth behavior freeze.
- CLI behavior freeze.
- Runtime behavior freeze unless separately authorized.
- Connector-visible surface freeze.
- Raw audit export prohibition.
- Restart requires explicit operator intent.
- Connector refresh requires explicit operator intent.
- Runtime policy expansion requires operator decision and negative controls.

## 6. Workflow/deploy vocabulary

- Snapshot: bounded copy of selected files for evidence/recovery. Not deploy. Not rollback. Not restart. Not connector refresh.
- Backup: broader recovery checkpoint before risky operation. Does not make changes live.
- Deploy: applying an approved change package to a target. Requires deployment record.
- Rollback: reversing a recorded deployment using its deployment record. Not arbitrary file recovery.
- Restore: recovering a path from trash/backup/source. If restored file is runtime-imported, restart rules still apply.
- Server schema change: MCP-visible change to tool names, tool count, descriptors, input/output schemas, auth/profile visibility, or connector action contract.
- Restart: reload live MCP process so runtime-imported code/config becomes live.
- Connector refresh: update/review connector-visible action surface after MCP-visible changes.

Decision matrix:

```text
_workflow only: no restart, no connector refresh.
_tests only: no restart, no connector refresh.
server.js or src/runtime: restart required if live behavior must change.
tools/schema/descriptor visible change: restart and connector refresh likely required.
SERVER_* specs only: no runtime effect unless promoted to runtime/descriptor truth.
logs/evidence cleanup: operator decision if evidence is removed.
deploy/rollback/restore: operator decision when runtime or connector can be affected.
```

## 7. Step history compressed

Stage 8:
- Built MCP response-shape canary server.
- Hardened connector response shape, output schema, structuredContent/content behavior, read-only annotations, public profile, route matrix, MCP dispatch, audit event contracts.
- Extracted runtime modules from `server.js` into `src/runtime/**`.
- Added control-plane and deploy/rollback guards.
- Mechanism parity later corrected to mechanism endurance, not same-tool parity.

Stage 9:
- Added release baseline, drift guard, connector lifecycle/operator checklist, audit isolation, harness no-pollution guard.

Stage 10:
- Added observability thin contract and release discipline.
- Preserved audit/log boundaries.

Stage 11:
- Built auth transition planning: bearer token file readiness, Cloudflare Access readiness, auth surface invariance.
- No auth cutover unless operator explicitly approves.

Stage 12:
- Developed policy/runtime specs and decision runtime planning.
- Implemented minimal decision runtime shim in `tools_call_handler`.
- Validated malformed JSON parse error redaction.
- Extracted server bootstrap/runtime/lifecycle/handler assemblies.
- Corrected Step39 semantics as workstream boundary/control review.
- Step40 created this compact canon and moved historical workflow notes out of active workflow memory.

## 8. Mechanism endurance status

Covered mechanisms:

- index mechanisms
- filesystem mechanisms
- connector-safe code mechanisms
- registry governance mechanisms
- web access mechanisms
- truth drift detection mechanisms
- deploy/rollback control-plane mechanisms

On hold:

- science data introspection mechanisms
- process runner policy mechanisms
- remote-site lifecycle mechanisms

Required now: none.

Meaning: do not port tools for parity. Test techniques, methods, and processes with harnesses, fixtures, negative controls, or runtime probes as appropriate.

## 9. Known debts

- Runtime metadata labels in `src/stage_metadata.js` may lag actual project progress.
- `_workflow/state.json` may remain a compatibility artifact unless deliberately advanced.
- Historical workflow files were too numerous and contradictory; active memory is now this canon.
- Full `SERVER_POLICY_RUNTIME_SPEC.json` is broader than current runtime enforcement.
- Remote/process/science mechanism probes remain on hold.
- Raw audit export remains prohibited.

## 10. Next safe development path

1. Keep workflow memory compact. Update this canon in place.
2. Do not recreate per-step longterm narrative files.
3. If a future step needs evidence, use one manifest or one compact ledger entry, not a new document family.
4. Before runtime work, state whether restart/refresh/schema-change applies.
5. Next server-oriented work should be a policy-runtime bridge plan or truth-label reconciliation, not another documentation expansion.

## 11. Files intentionally kept as active workflow core

- `_workflow/WORKFLOW_CANON.md`
- `_workflow/state.json` until replaced by a smaller state mechanism
- `_workflow/scripts/**` only where tests/control-plane still require them
- `_tests/**` as executable guard surface

Historical `_workflow/longterm/**` and `_workflow/patch_manifests/**` are no longer active memory.

## 12. Directory roles and retention

Active layout:

- `_tests/**`: executable validation surface. Keep here because tests are run directly by `run_all_smokes.js` and validate server behavior.
- `_workflow/scripts/**`: workflow/control-plane utilities. Keep here because they are not assertions; they perform snapshot, deploy, rollback, spec validation, log compaction, or maintenance tasks. Keep only reusable utilities; one-off closeout/render/readme scripts should be removed. Runtime log compaction utility: `_workflow/scripts/compact_runtime_logs.js`.
- `_workflow/baselines/**`: golden reference data. Keep here because tests and control scripts compare current state against stable baselines.
- `_workflow/WORKFLOW_CANON.md`: compacted operational memory.
- `_workflow/state.json`: compact machine-readable current workflow state only.

Rejected layout:

- Do not mix scripts into `_tests`; executable tools are not assertions.
- Do not mix baselines into `_tests`; fixture truth should remain separate from test code.
- Do not store progress logs in `_stages`; progress history is compressed into this canon.
- Do not store ad hoc patch scripts in `.temp`; one-off scripts must be deleted after use.

Retention policy:

- `.temp`: zero-retention scratch. Delete contents after use.
- `.mcp_backups`: tool-generated edit backups and emergency pre-rewrite backups. Keep only recent or named recovery points.
- `_backups`: retired root-level backup bucket. It must not be recreated; use `_workflow/control_plane/snapshots/**`, `_workflow/control_plane/file_backups/**`, and `_workflow/control_plane/retired_root_backups/**`.
- `_logs`: runtime/audit logs only. Raw audit export remains prohibited. Rotate or summarize large logs before using them as workflow evidence.

## 13. Mechanism reference library

`_repos_with_code_samples/**` is not workflow clutter. It is a mechanism reference library used to study external implementations, libraries, architecture patterns, SDK usage, MCP servers, app-sdk examples, and comparable design solutions.

Rules:

- Do not delete `_repos_with_code_samples/**` during workflow cleanup.
- Do not classify it as workflow memory.
- Use it as source material for server improvement, mechanism endurance work, implementation comparison, and library-pattern review.
- If it grows too large, create an index or retrieval map; do not remove it as part of workflow compaction.

## 14. Control-plane safety mechanism

Deploy/rollback is a workflow safety mechanism, not a fixture and not stage history. It protects multi-file changes by preparing a package, executing deployment with checks, recording deployment state, and allowing immediate rollback from the recorded deployment state.

Active control-plane layout:

- `_workflow/control_plane/selftest/**`: selftest deployment package used by the deploy/rollback guard.
- `_workflow/control_plane/deploy_records/**`: prepare/executed/rollback records.
- `_workflow/control_plane/file_backups/**`: per-deployment file backups when a deployed target existed before deployment.
- `_workflow/control_plane/snapshots/**`: bounded workflow/runtime snapshots created by `workflow_snapshot.js`; `_backups/**` must not be recreated.
- `_workflow/control_plane/retired_root_backups/**`: explicitly retired root-level backup files kept out of repository root.
- `_workflow/scripts/test_mcp_deploy.ps1`: deploy mechanism.
- `_workflow/scripts/test_mcp_rollback.ps1`: rollback mechanism.
- `_tests/smoke_stage8_52d_control_plane_deploy_rollback.js`: guard that proves prepare, execute, dry-run rollback, and real rollback behavior.

Rejected locations:

- `_stages/**`: stage-progress history only; must not be recreated by control-plane tests.
- `_fixtures/**`: ordinary static test fixtures; deploy/rollback safety packages do not belong there.
- `_backups/**`: old uncontrolled backup bucket; deploy/rollback records now live under `_workflow/control_plane/**`.

## 15. Test fixtures boundary

`_tests/fixtures/**` is allowed only for static test fixtures consumed by tests. It is not a place for workflow safety mechanisms, deployment packages, mutable control-plane state, snapshots, backups, or stage history.

Current allowed fixture example:

- `_tests/fixtures/plugins/template/**`: test-only plugin template kept outside runtime `plugins/` so the runtime registry does not discover it as a real candidate.

Rejected fixture use:

- deploy/rollback selftest packages, records, or file backups. Those belong under `_workflow/control_plane/**`.

## 16. Pre-OAuth hardening

Pre-OAuth hardening completed before OAuth implementation. Public `auth:none` surface no longer exposes `code_sample_js`; public tool count is 13. JSON-RPC envelope validation, central tool input validation, access trusted-proxy guard, bearer query-token disabled-by-default, CORS split by auth mode, minimal healthz default, public FS root guard, public bind guard, audit log rotation, MCP request-id null rejection, batch item cap, decision-runtime policy bridge v2, optional Mcp-Session-Id validation, request-id replay rejection for explicit sessions, CORS negative guard, and oversized-batch execution bypass guard are active. Guards: `_tests/smoke_stage12_pre_oauth_hardening_guards.js`, `_tests/smoke_stage12_mcp_protocol_compliance_guards.js`, `_tests/smoke_stage12_session_replay_guards.js`, `_tests/smoke_stage12_http_boundary_guards.js`.

Tool input budget guard active: `_tests/smoke_stage12_tool_input_budget_guards.js`.

Connector surface split guard active: public SERVER_TOOLS_SPEC surface must equal runtime PUBLIC_TOOL_NAMES; non-public core sampler is restricted core, not public or authorized facade. Guard: `_tests/smoke_stage12_connector_surface_split_guard.js`.

Connector refresh readiness spec active: `SERVER_CONNECTOR_SURFACE_SPEC.json` defines public/authenticated/operator connector boundaries. Public connector expected tools must equal runtime `PUBLIC_TOOL_NAMES`; operator mutation tools must not be labeled public. Guard: `_tests/smoke_stage12_connector_refresh_readiness_spec.js`. Live connector refresh remains an explicit operator action.

Phase A Streamable HTTP preflight green: `accept_policy.js`, `protocol_version_policy.js`, dispatcher preflight validation, initialize protocol negotiation, and `_tests/smoke_stage12_streamable_http_preflight_guards.js` are active. Next implementation phase: Phase B - POST SSE response path.

Phase B POST SSE response path green: `sse_response.js`, single-payload SSE response mode, and `_tests/smoke_stage12_post_sse_response.js` are active. JSON response path remains compatible. Next implementation phase: Phase C - SessionStore and lifecycle.

Phase C SessionStore lifecycle green: `session.js`, `session_store.js`, initialize-created `Mcp-Session-Id`, known-session acceptance, unknown-session 404, and `_tests/smoke_stage12_streamable_http_session_lifecycle.js` are active. Next implementation phase: Phase D - GET SSE stream and outbound queue.

Phase D GET SSE/outbound queue green: `mcp_get_stream_handler.js`, session stream attachment/detachment, outbound queue buffering/flushing, `_tests/smoke_stage12_get_sse_stream.js`, and `_tests/smoke_stage12_outbound_queue.js` are active. Next implementation phase: Phase E - Pending request correlation.

Phase E pending request correlation green: `outbound_request_manager.js`, session pending map, server-originated request id namespace, POST JSON-RPC response acceptance, unknown pending fail-closed, batch response acceptance, and `_tests/smoke_stage12_pending_request_correlation.js` are active. Next implementation phase: Phase F - Sampling readiness.

Phase F sampling readiness green: `sampling_context.js`, context enrichment, optional tool context propagation, capability gate, sampling roundtrip via outbound queue/pending response, `_tests/smoke_stage12_sampling_capability_gate.js`, and `_tests/smoke_stage12_sampling_roundtrip.js` are active. Phase A-F are green. Next implementation phase: Phase G - OAuth preflight and implementation.

Phase G OAuth resource-server preflight green: `SERVER_AUTH_SPEC.json`, `auth_oauth.js`, `oauth_metadata.js`, protected resource metadata route, OAuth auth mode, query-token rejection, issuer/audience/scope checks, and `_tests/smoke_stage12_oauth_preflight_contract.js` are active. OAuth is implemented as an MCP resource-server validator; local OAuth21 authorization-server mode was later added for TEST MCP on port 3008.

OAuth production hardening plan ready: `_workflow/OAUTH_PRODUCTION_HARDENING_PLAN.md` and `_tests/smoke_stage12_oauth_production_hardening_plan.js` are active. Execution order: H1 AS metadata, H2 JWKS/RS256, H3 introspection decision, H4 DCR policy, H5 PKCE policy, H6 key rotation, H7 sampling approval, H8 SSE keepalive/resumability, H9 live connector refresh readiness.

H1 AS metadata integration green: `oauth_authorization_server_metadata.js`, runtime AS metadata provider wiring, Protected Resource Metadata authorization_servers from validated AS metadata, and `_tests/smoke_stage12_oauth_as_metadata_integration.js` are active. Next implementation phase: H2 - JWKS/RS256 validation path.

H2 JWKS/RS256 validation green: `oauth_jwks_cache.js`, `oauth_jwt_verify.js`, JWKS/RS256 branch in `auth_oauth.js`, `MCP_TEST_OAUTH_JWKS_FILE` wiring, and `_tests/smoke_stage12_oauth_jwks_rs256_validation.js` are active. Next implementation phase: H3 - Introspection path or explicit decision to defer introspection.

H3 OAuth introspection validation green: `oauth_introspection.js`, introspection branch in `auth_oauth.js`, `MCP_TEST_OAUTH_INTROSPECTION_FILE`, and `_tests/smoke_stage12_oauth_introspection_validation.js` are active. JWKS/RS256 remains preferred production validation. Next implementation phase: H4 - DCR policy.

H4 DCR policy green: `dynamic_client_registration_policy` in `SERVER_AUTH_SPEC.json` and `_tests/smoke_stage12_oauth_dcr_policy.js` are active. DCR mode is supported with manual registration fallback; wildcard redirect URIs are forbidden; MCP server does not implement a runtime registration endpoint. Next implementation phase: H5 - PKCE/client-flow policy at AS boundary.

H5 PKCE client-flow policy green: `pkce_client_flow_policy` in `SERVER_AUTH_SPEC.json` and `_tests/smoke_stage12_oauth_pkce_policy.js` are active. Authorization code + PKCE S256, state verification, exact redirect URI validation, and resource parameter in authorization/token requests are policy requirements at AS boundary. Next implementation phase: H6 - Key rotation.

H6 JWKS key rotation green: `oauth_jwks_cache.js` and `_tests/smoke_stage12_oauth_key_rotation.js` are active. Next implementation phase: H7 - Sampling user-approval policy.

H7 sampling user-approval policy green: `SERVER_SAMPLING_POLICY_SPEC.json`, runtime approval/budget enforcement in `sampling_context.js`, and `_tests/smoke_stage12_sampling_user_approval_policy.js` are active. Next implementation phase: H8 - SSE keepalive/resumability.

H8 SSE keepalive/resumability green: `sse_response.js`, `mcp_get_stream_handler.js`, `session.js`, `_tests/smoke_stage12_sse_keepalive.js`, and `_tests/smoke_stage12_sse_resumability.js` are active. Next phase: H9 - Live connector refresh readiness after explicit operator approval.

H9 live connector refresh readiness green: `SERVER_CONNECTOR_SURFACE_SPEC.json`, `_workflow/CONNECTOR_REFRESH_READINESS.md`, and `_tests/smoke_stage12_connector_refresh_readiness.js` are active. OAuth production hardening H1-H9 is green. OAuth21 connector refresh was performed later in Stage 6 after explicit operator action; JWKS HTTP cache-control/max-age parsing and too-old Last-Event-ID fail-closed behavior were closed by guards.

mcp-tests audit remediation green: GET `/mcp` SSE authenticates before opening stream and `/docs/*` malformed percent-encoding returns controlled 400. Guards: `_tests/smoke_stage12_get_sse_requires_auth.js`, `_tests/smoke_stage12_docs_malformed_uri.js`. Further live connector refresh remains blocked unless explicitly approved by operator.

H10 OAuth21 local authorization server green: `oauth21` mode on port 3008 exposes local OAuth 2.1 AS endpoints, DCR, PKCE S256, operator login, token issuance, Bearer-protected `/mcp`, and host allowlist for `mcp-tests-oauth21.romionologic.dev`. Guards are active in run_all. Further live connector refresh remains blocked unless explicitly approved by operator.

## 17. Access/Bearer runtime retirement decision

Decision accepted by operator on 2026-06-21: TEST MCP target topology has exactly two active local/runtime instances:

- public `auth:none` on port `3009`, public base URL `https://mcp-tests.romionologic.dev/mcp`;
- authorized OAuth 2.1 `auth:oauth21` on port `3008`, public base URL `https://mcp-tests-oauth21.romionologic.dev/mcp`.

The previous `auth:access` instance on port `3005` and `auth:bearer` instance on port `3006` are retired from the target runtime topology. They must not be restarted as active TEST MCP connector targets unless the operator explicitly approves a temporary legacy-debug run.

Accepted staged plan:

1. Stage 1: update root specs and workflow decision records.
2. Stage 2: remove `access` and `bearer` from server startup selectable runtime modes.
3. Stage 3: migrate `run_all_smokes.js` authenticated harness from Cloudflare Access assertion headers to OAuth21 DCR/PKCE/operator-login/token flow.
4. Stage 4: consolidate or remove legacy auth precutover tools: `auth_transition_status`, `auth_bearer_dry_run`, `auth_bearer_cutover_guard`, `auth_modular_parity_status`. Preferred first pass is one read-only retirement-status tool before hard removal.
5. Stage 5: prune or reclassify legacy access/bearer tests as library-only negative controls or remove them from active run_all.
6. Stage 6: full validation and closeout for only `none:3009` and `oauth21:3008`.

Connector refresh remains an explicit external operator action; OAuth21 connector refresh was later performed and validated in Stage 6.

Stage 2 runtime bootstrap retirement green: `server.js`, `src/runtime/auth_bootstrap_config_resolver.js`, and `src/auth/auth_policy.js` now fail closed for retired `auth:access` and `auth:bearer` modes. Operator-facing startup errors are bounded as `MCP TEST SERVER FAILED: Retired auth mode ...`. `auth:none` remains the public target on port 3009, `auth:oauth21` remains the authorized target on port 3008, and `auth:oauth` remains only as a legacy resource-server validation mode for tests. Stage 3 must migrate `run_all_smokes.js` authenticated harness from Cloudflare Access assertion headers to OAuth21 token flow.

Stage 3 run_all OAuth21 harness green: `_tests/run_all_smokes.js` authenticated harness no longer starts `auth:access`. It starts `auth:oauth21`, writes a temporary OAuth21 operator secret config under the run temp directory, performs DCR + PKCE S256 + operator-login + token exchange, then injects `Authorization: Bearer <access_token>` through `_tests/smoke_auth_fetch_patch.js`. Legacy access/bearer self-start, bearer dry-run/cutover, and precutover auth smoke scripts are quarantined in run_all as pending Stage 4/5. Final full `run_all --skip-network` re-run after the last whitelist patch was blocked by the local process runner, so recorded evidence is: syntax parse OK, OAuth21 harness reached authenticated section, and remaining observed failures were legacy access/bearer expectations or workflow whitelist drift that were patched/quarantined.

Stage 4 auth legacy retirement status green: active authorized MCP surface no longer loads `auth_transition_status`, `auth_bearer_dry_run`, `auth_bearer_cutover_guard`, or `auth_modular_parity_status`. These four precutover tools are consolidated into read-only `auth_legacy_retirement_status`, which reports active `none:3009` and `oauth21:3008`, retired `access:3005` and `bearer:3006`, and notes that connector refresh is still an explicit operator action. Legacy implementation modules remain in repo for Stage 5 pruning/reclassification. Loader validation reported optional authorized count 41, total with base `search/fetch` 43.

Stage 5 legacy auth test reclassification green: legacy access/bearer smoke tests are no longer in the active `_tests/run_all_smoke_scripts.json` manifest. Fifteen active-manifest legacy tests were removed from run_all and all seventeen legacy candidates are recorded in `_tests/legacy_retired_auth_smoke_manifest.json` with disposition `legacy_retired_auth_test_excluded_from_active_run_all_pending_manual_archive_or_rewrite`. Active run_all manifest count is 143 scripts: 6 public, 136 authenticated, and one optional network script. Test files remain in repo for explicit archive/rewrite decisions; no hard delete was performed. Stage 5 full validation passed: `node _tests/run_all_smokes.js --skip-network` returned ok=true with public=6 and tests_authenticated=136. The four retired authorized auth facades were soft-deleted from `tools/authorized`; legacy implementation modules remain outside the active authorized surface.

Stage 6 final closeout green: target runtime topology is validated after operator restart and OAuth connector refresh. Public runtime was validated locally on `127.0.0.1:3009`: `auth:none`, profile `public`, `tools/list` count 13. OAuth21 connector was validated live via `TESTS_MCP.test_mcp_runtime_status`: `auth:oauth21`, profile `internal`, port 3008, tool count 43, tool hash `8b62ecaf89227335`, schema compatibility ok, security boundary ok, `auth_legacy_retirement_status` present, retired access/bearer tools absent from runtime surface. Full local `node _tests/run_all_smokes.js --skip-network` returned ok=true with public=6 and tests_authenticated=136. Public ChatGPT connector remained disconnected and was not required for Stage 6 closeout.

Post Stage 6 root spec/workflow review green: root specs and workflow were reconciled against source-derived truth from runtime auth bootstrap, auth policy, tool policy, tool loader, package identity, and live runtime evidence. Current target topology is public none:3009 with 13 tools and authorized oauth21:3008 with 43 runtime tools, hash 8b62ecaf89227335. Active run_all manifest is 143 scripts with public=6 and tests_authenticated=136; legacy retired auth tests active in run_all = 0. Historical Stage 3/4 pending counts are marked resolved by Stage 5 reclassification.

Post Stage 6 operator decisions recorded: `_workflow/operator_decisions/post_stage6_operator_decisions_2026-06-21.md` is binding direction for D1-D12. Main package accepted: commit current GREEN state; keep public connector disconnected; keep legacy auth material archived until separate triage; classify transport deferrals D2-D6 as deliberate limitations with no implementation in this checkpoint; defer runtime policy expansion D7 to a separately approved stage. Future architecture direction: sessionless/explicit state handles, no DELETE session teardown, per-request streams, active cancellation plus timeout fallback, event-driven Hotplug lifecycle for tool changes. Implementation of spec-dependent items requires live official MCP spec verification before code patches.

P1 batch SSE explicit unsupported guard green: batch JSON-RPC remains supported for JSON responses, and single POST SSE remains supported, but batch payloads negotiated as SSE are rejected before item dispatch with `batch_sse_not_supported`. Guard: `_tests/smoke_stage12_batch_sse_unsupported_guard.js`. This implements operator decision D2 without implementing batch SSE as a feature.

P2 legacy retired auth manifest triage green: `_tests/legacy_retired_auth_smoke_manifest.json` now classifies 17 legacy access/bearer tests: 9 `rewrite_as_negative_control`, 6 `archive_only`, and 2 `delete_after_review`. No legacy test was re-added to run_all and no file deletion was performed. Future rewrite/delete work must occur in separate small stages.

P3 cancellation path client-disconnect plan green: `_workflow/operator_decisions/p3_cancellation_path_client_disconnect_plan.md` records source-derived plan for active cancellation. Current code already detaches GET SSE streams on `close`/`aborted` and has timeout fallback for pending requests; POST execution does not yet propagate `AbortSignal`. Implementation is deferred to explicit stages C1-C4; no runtime patch was made in P3.

P4 runtime policy expansion scope plan green: `_workflow/operator_decisions/p4_runtime_policy_expansion_scope_plan.md` records the source-derived plan to expand the minimal decision runtime into full Resource/Scope Matrix Enforcement. Current runtime enforcement remains unchanged: `SERVER_POLICY_RUNTIME_SPEC.json` still marks runtime enforcement as not implemented. Future stages R1-R7 require separate operator approval because they change the security boundary.

P5 sessionless explicit state handles spec review green: `_workflow/operator_decisions/p5_sessionless_explicit_state_handles_spec_review.md` records official MCP source review. Stable 2025-11-25 still documents Streamable HTTP sessions/GET/DELETE as optional-compatible behavior, while Final SEP-2575 and SEP-2567 plus the draft Streamable HTTP page define the future sessionless/stateless direction: per-request metadata, no initialize/session dependency, explicit state handles as tool-design pattern, POST-only draft endpoint, and request-scoped SSE. No runtime patch was made in P5.

P6 event-driven hotplug lifecycle design green: `_workflow/operator_decisions/p6_event_driven_hotplug_lifecycle_design.md` records the design for replacing manual/static connector refresh thinking with an event-driven Hotplug lifecycle. Existing repo already has a dry-run `notifications/tools/list_changed` stack, plugin visibility planning, state-store preview/receipts, and security preflight. P6 enables no runtime emission, no state-store writes, no connector refresh, and no tool surface mutation.

P7 workflow archive compaction index green: `_workflow/ACTIVE_WORKFLOW_INDEX.md` was added as a non-destructive workflow navigation layer. Historical plans remain in place; no workflow files were moved or deleted. The index defines reading order, current truth sources, active operator decision records, and historical-plan caution.

Stage 7.0-7.1 repo/live convergence green: P7 pending-commit metadata was corrected to committed at `ff36a1912a150c3efa08bc516ca3ca2e9543950b`. After operator restart, live OAuth21 connector reports auth `oauth21`, port 3008, 43 tools, hash `8b62ecaf89227335`, schema/security ok. Local public runtime on 3009 reports 13 tools and the P1 batch SSE guard is active with `batch_sse_not_supported`. Retired ports 3005/3006 have no listeners. Stage 8 proposal recorded at `_workflow/operator_decisions/stage8_proposal_after_stage7.md`.

Stage 7.3 S1 sessionless compatibility inventory green: `_workflow/operator_decisions/stage7_sessionless_inventory.md` and `_workflow/sessionless_inventory.json` map current dependencies on initialize, `MCP-Session-Id`, SessionStore, GET SSE, pending correlation, sampling, replay guard, OAuth21 connector, and explicit non-target batch SSE/DELETE teardown. Conclusion: do not remove session code in Stage 7; next runtime-safe step is C1 cancellation context plumbing in the current stable-compatible runtime.

Stage 7.4 C1 cancellation context plumbing green: `src/runtime/request_cancellation.js` creates a per-POST AbortSignal from client abort lifecycle and `mcp_entry_dispatcher`, `single_payload_dispatcher`, and `batch_payload_dispatcher` pass `abortSignal` through to `handleRpcMessage` context. Guard: `_tests/smoke_stage7_c1_cancellation_context_plumbing.js`. No cooperative tool cancellation, JSON-RPC cancel, sessionless transport migration, connector refresh, or tool behavior change was implemented.

Stage 7.5 C2 client-disconnect write guard green: `src/runtime/response_write_guard.js` centralizes response-abort checks and single/batch dispatchers plus `rpc_handler_exception_handler` skip response writes after request abort or closed response. Audit event: `response_write_skipped_after_client_disconnect`. Guard: `_tests/smoke_stage7_c2_client_disconnect_write_guard.js`. No cooperative tool cancellation, JSON-RPC cancel, sessionless transport migration, connector refresh, or tool surface change was implemented.

Stage 7 closeout green: Stage 7 is closed after repo/live convergence, S1 sessionless compatibility inventory, C1 abort-signal plumbing, and C2 client-disconnect no-write guard. Stage 7 commits: `20baa5b`, `6271bbc`, `4093ac2`, `d410da7`. C3 cooperative tool cancellation is intentionally deferred to a separate operator-approved stage. Next approved stage is Stage 8 static registry foundation before hotplug and policy enforcement.

Stage 8.1 static tool registry abstraction green: `src/static_tool_registry.js` adds a read-only static registry over core descriptors and optional tools. `runtime_support_assembly.toolsList()` now renders through this registry while preserving descriptor-equivalent output. Guard: `_tests/smoke_stage8_static_tool_registry_equivalence.js`. No dynamic registration, list_changed emission, state-store write, connector refresh, public connector reconnection, or runtime policy enforcement change was implemented.

Stage 8.2 registry-to-policy read model green: `src/registry_policy_read_model.js` adds a read-only model mapping static registry entries to descriptors, runtime `TOOL_POLICIES`, and `SERVER_TOOLS_SPEC.tool_catalog` metadata. Guard: `_tests/smoke_stage8_registry_policy_read_model.js`. No runtime enforcement, allow/deny behavior change, connector refresh, public connector reconnection, or hotplug/list_changed emission was implemented.

Stage 8.3 registry diff dry-run green: `src/registry_diff_dry_run.js` adds static registry snapshot diffing with add/remove/update detection and dry-run list_changed harness integration. Guard: `_tests/smoke_stage8_registry_diff_dry_run.js`. Existing `tools_list_diff` and list_changed pipeline remain dry-run only. No real registry mutation, tools/list mutation, list_changed emission, connector refresh, public connector reconnection, or hotplug was implemented.

Stage 8 closeout green: Stage 8 is closed after Stage 8.1 static tool registry abstraction (`2385a03`), Stage 8.2 registry-to-policy read model (`d538320`), and Stage 8.3 registry diff dry-run (`1f552ca`). Full `run_all --skip-network` after Stage 8.3 was GREEN with public=6 and tests_authenticated=142. Stage 8 introduced read-only registry foundations only: no dynamic registration, real registry mutation, tools/list mutation, list_changed emission, connector refresh, public connector reconnection, or runtime policy enforcement change. Stage 9 recommendation recorded at `_workflow/operator_decisions/stage9_recommendation_after_stage8.md`.

Stage 9.1 runtime registry context assembly green: `src/runtime/registry_context_assembly.js` adds a runtime read-only registry context factory that builds the static registry, registry-policy read model, and registry diff snapshot from runtime inputs. `runtime_support_assembly` now exposes `registryContext()` and `toolsList()` renders through it while preserving descriptor-equivalent behavior. Guard: `_tests/smoke_stage9_runtime_registry_context_assembly.js`. No runtime enforcement, allow/deny behavior change, connector refresh, public connector reconnection, hotplug/list_changed emission, or state-store write was implemented.

Stage 9.2 internal runtime registry summary green: `src/runtime/runtime_registry_summary.js` adds an internal-only helper/provider for compact registry summaries derived from `registryContext().compactSummary()`. Guard: `_tests/smoke_stage9_runtime_registry_summary.js`, including negative check that `test_mcp_runtime_status` does not expose registry summary fields. No connector-visible schema change, runtime status exposure, runtime enforcement, allow/deny behavior change, connector refresh, public connector reconnection, or hotplug/list_changed emission was implemented.

Stage 9.3 registry-policy consistency guard green: `_tests/smoke_stage9_registry_policy_consistency_guard.js` adds a run_all test-only guard validating public and authorized registry read models against descriptors, runtime `TOOL_POLICIES`, `SERVER_TOOLS_SPEC.tool_catalog`, expected counts, and tool surface fingerprints. No runtime enforcement, allow/deny behavior change, connector-visible schema change, connector refresh, public connector reconnection, or hotplug/list_changed emission was implemented.

Stage 9 closeout green and Stage 10 start: Stage 9 is closed after runtime registry context assembly (`3817753`), internal registry summary helper (`0bde4c2`), and registry-policy consistency guard (`baf91a1`). Full `run_all --skip-network` after Stage 9.3 was GREEN with public=6 and tests_authenticated=145. Stage 10 plan recorded at `_workflow/operator_decisions/stage10_policy_enforcement_preflight_plan.md`; Stage 10 begins with 10.1 enforcement coverage matrix preflight. No runtime policy enforcement, allow/deny behavior change, connector refresh, public connector reconnection, real hotplug/list_changed emission, or sessionless migration is authorized.

Stage 10.1 policy enforcement coverage matrix preflight green: `src/policy_enforcement_coverage_matrix.js` and `_tests/smoke_stage10_policy_enforcement_coverage_matrix.js` add a read-only enforcement coverage matrix over registry context, profile surfaces, `TOOL_POLICIES`, `SERVER_TOOLS_SPEC.tool_catalog`, and `SERVER_RESOURCE_POLICY_SPEC`. Preflight reports public blocked=0 and authorized blocked=3 (`plugin_execution_governance`, `plugin_visibility_status`, `plugin_catalog_search`) with `operation_not_allowed_for_resource_class`. This is a declarative policy gap report only; no runtime enforcement, allow/deny behavior change, connector-visible schema change, connector refresh, public connector reconnection, hotplug/list_changed emission, or sessionless migration was implemented.

Stage 10.2 policy preflight reason codes green: `src/policy_preflight_reason_codes.js` and `_tests/smoke_stage10_policy_preflight_reason_codes.js` add a stable dry-run reason-code catalog and evaluator producing `would_allow` / `would_deny` from the Stage 10.1 coverage matrix. Dry-run findings remain public would_deny=0 and authorized would_deny=3 (`plugin_execution_governance`, `plugin_visibility_status`, `plugin_catalog_search`) with reason `operation_not_allowed_for_resource_class`. This is dry-run only; no runtime enforcement, allow/deny behavior change, connector-visible schema change, connector refresh, public connector reconnection, hotplug/list_changed emission, or sessionless migration was implemented.

Stage 10.3 policy preflight receipt shape green: `src/policy_preflight_receipt.js` and `_tests/smoke_stage10_policy_preflight_receipt_shape.js` add redacted dry-run receipt shapes for policy preflight decisions. Receipts include tool, profile/auth, resource/operation/surface class, would_allow/would_deny, reason_codes, mutation/audit flags, and argument metadata as shape/hash only. Raw argument values are not included; runtime_audit_event_emitted=false. This is dry-run only; no runtime enforcement, allow/deny behavior change, connector-visible schema change, connector refresh, public connector reconnection, hotplug/list_changed emission, or sessionless migration was implemented.

Stage 10 closeout green and Stage 11 start: Stage 10 is closed after policy enforcement coverage preflight (`71abbf4`), policy preflight reason codes (`9d4d15b`), and policy preflight receipt shape (`983e51f`). Full `run_all --skip-network` after Stage 10.3 was GREEN with public=6 and tests_authenticated=148. Stage 10 findings: public blocked=0, authorized blocked/would_deny=3 (`plugin_execution_governance`, `plugin_visibility_status`, `plugin_catalog_search`) with reason `operation_not_allowed_for_resource_class`. Runtime enforcement and allow/deny behavior remain unchanged. Stage 11 starts with declarative policy gap remediation only.

Stage 11.1 policy gap remediation green: Stage 10 declarative preflight gaps were remediated in `SERVER_RESOURCE_POLICY_SPEC.json` by adding `read` to `plugin_execution_readonly`, adding `read` to `plugin_visibility_state_preview`, and adding `search` to `plugin_registry_readonly`. Guard: `_tests/smoke_stage11_policy_gap_remediation.js`. After remediation public blocked/would_deny=0 and authorized blocked/would_deny=0. Runtime enforcement and allow/deny behavior remain unchanged; no connector refresh, public connector reconnection, hotplug/list_changed emission, or sessionless migration was implemented.

Stage 11 closeout green: Stage 11 is closed after `46ab0c0 fix: remediate policy preflight gaps`. Declarative gaps found by Stage 10 were removed: public blocked/would_deny=0 and authorized blocked/would_deny=0. Runtime enforcement remains disabled and allow/deny behavior remains unchanged. Stage 12 recommendation recorded at `_workflow/operator_decisions/stage12_enforcement_apply_readiness_gate.md`.

Stage 12.1 enforcement apply-readiness report green: `src/enforcement_apply_readiness_report.js` and `_tests/smoke_stage12_enforcement_apply_readiness_report.js` add a read-only readiness report combining Stage 10 coverage matrix, reason-code dry-run, preflight receipt redaction, and Stage 11 remediation signals. Report result: ready_for_operator_review=true and ready_for_runtime_enforcement=false. Public and authorized blocked/would_deny remain 0. Runtime enforcement and allow/deny behavior remain unchanged; no connector-visible schema change, connector refresh, public connector reconnection, hotplug/list_changed emission, or sessionless migration was implemented.

Stage 12.2 enforcement wiring plan green: `src/enforcement_wiring_plan.js` and `_tests/smoke_stage12_enforcement_wiring_plan_no_apply.js` add a plan-only future enforcement wiring report. Future hook is identified as `src/runtime/tools_call_handler.js` / `handleToolsCall` / route `tools/call`, after existing decision-runtime receipt and before `tool_call_start` / handler execution. Stage 12.2 keeps `apply_allowed_now=false`, `dispatch_behavior_changed=false`, and verifies `tools_call_handler.js` is not wired to policy preflight. No runtime enforcement, allow/deny behavior change, connector-visible schema change, connector refresh, public connector reconnection, hotplug/list_changed emission, or sessionless migration was implemented.

Stage 12.3 operator approval boundary guard green: `src/enforcement_operator_approval_guard.js` and `_tests/smoke_stage12_operator_approval_boundary_guard.js` add a no-apply approval boundary guard. Required marker id for a future apply phase is `operator_approved_runtime_policy_enforcement_apply`, but Stage 12.3 keeps `apply_allowed_now=false` even with a valid marker and detects any attempted runtime enforcement/apply/dispatch-behavior signals as boundary violations. `tools_call_handler.js` remains unwired. No runtime enforcement, allow/deny behavior change, connector-visible schema change, connector refresh, public connector reconnection, hotplug/list_changed emission, or sessionless migration was implemented.

Stage 12 closeout green: Stage 12 is closed after `37d038b feat: add enforcement apply readiness report`, `700a95a docs: add enforcement wiring plan`, and `26e0e60 test: add enforcement approval boundary guard`. System state: ready_for_operator_review=true, ready_for_runtime_enforcement=false, runtime_enforcement_changed=false, allow_deny_behavior_changed=false, dispatch_behavior_changed=false. Full `run_all --skip-network` after Stage 12.3 was GREEN with public=6 and tests_authenticated=152. Next approved work: post-Stage 12 server environment analysis, debt register, and development roadmap.

Post-Stage 12 server environment review green: `_workflow/operator_decisions/post_stage12_server_environment_analysis.md` records repo/live boundary review after Stage 12 closeout. Repo is clean and Stage 12 remains GREEN/CLOSED. No deploy, restart, connector refresh, public connector reconnect, runtime enforcement, allow/deny behavior change, hotplug/list_changed emission, or sessionless migration was performed. Local probes: ports 3005/3006 no listener, ports 3008/3009 listening, public local `tools/list` has 13 tools with hash `f2830cb7817520ac`, and OAuth/internal unauthenticated empty POST returned 401 `missing_bearer_token`. Stage 13 recommendation recorded at `_workflow/operator_decisions/stage13_recommendation_after_stage12.md`: Server Environment Debt Remediation and Drift Ledger.

Stage 13.1 live/repo drift ledger green: `_workflow/operator_decisions/stage13_live_repo_drift_ledger.md` records current read-only repo/runtime evidence. Repo HEAD is `7953781c08e3`, git status and `git diff --check` are clean, package version is `0.40.0`, ports 3005/3006 remain no-listener, ports 3008/3009 remain listening, OAuth21 unauthenticated MCP POST returns 401 `missing_bearer_token`, and live OAuth21 reports 43 tools with hash `8b62ecaf89227335`. Current public local `tools/list` returns 13 tools with schema-compat names hash `0852d07b373a25ed`, matching `_workflow/baselines/stage8_frozen_runtime_baseline.json`; the post-Stage 12 `f2830cb7817520ac` value is classified as historical measurement mismatch, not current runtime drift. No deploy, restart, connector refresh, public connector reconnect, runtime enforcement, allow/deny behavior change, dispatch behavior change, hotplug/list_changed emission, or sessionless migration was performed.

Stage 13.2 runtime identity / workflow stage boundary green: workflow canon now defines `runtime_stage_status` as a runtime/API compatibility label, not workflow progress truth. Workflow progress truth is `_workflow/state.json` and `_workflow/WORKFLOW_CANON.md`. Guard `_tests/smoke_stage13_runtime_identity_workflow_boundary.js` asserts the runtime semantics marker, the canon/index boundary text, and the workflow-state status. Validation passed: `node _tests/smoke_stage13_runtime_identity_workflow_boundary.js`, `node _tests/smoke_stage12_streamable_http_workflow_plan.js`, and `node _tests/run_all_smokes.js --skip-network` with public=6 and tests_authenticated=153. No runtime code patch, deploy, restart, connector refresh, public connector reconnect, runtime enforcement, allow/deny behavior change, dispatch behavior change, hotplug/list_changed emission, or sessionless migration was performed.

Stage 13.3 CRLF hygiene plan green: `_workflow/operator_decisions/stage13_crlf_hygiene_plan.md` records the repository line-ending hygiene plan. `.gitattributes` already declares LF for JS/JSON/Markdown/text/YAML and CRLF for PowerShell. A read-only scan checked 632 tracked text files and found that 191 tracked text files still contain CRLF: 180 `.js`, 7 `.md`, and 4 `.json`. Decision: keep this as controlled debt, do not rewrite the repository under Stage 13.3, and only normalize line endings through substantive future edits or a separately approved batch migration. Guard `_tests/smoke_stage13_crlf_hygiene_plan.js` asserts the policy, record, state, and non-actions. No global normalization or git add --renormalize . was performed. No runtime code patch, deploy, restart, connector refresh, public connector reconnect, runtime enforcement, allow/deny behavior change, dispatch behavior change, hotplug/list_changed emission, or sessionless migration was performed.

Stage 13.4 process-runner ergonomics note green: `_workflow/operator_decisions/stage13_process_runner_ergonomics_note.md` records bounded process-runner operating practice for future repository work. Current policy snapshot: allowed commands are git, node, npm, powershell, pwsh, py, pytest, and python; raw PowerShell remains disabled and requires workspace-local `-File`; output and timeout limits remain bounded. The note records observed ergonomics debt including long inline argument rejection, sporadic tool-layer blocks, output truncation, CRLF warning interpretation, and alternate clean-tree probes. Guard `_tests/smoke_stage13_process_runner_ergonomics_note.js` asserts the note, state, index, and non-actions. Process-runner policy, command allowlists, runtime code, connector configuration, and deployment state unchanged. No runtime code patch, deploy, restart, connector refresh, public connector reconnect, runtime enforcement, allow/deny behavior change, dispatch behavior change, hotplug/list_changed emission, or sessionless migration was performed.

Stage 13 closeout green: `_workflow/operator_decisions/stage13_closeout.md` closes Server Environment Debt Remediation and Drift Ledger after Stage 13.1 drift ledger, Stage 13.2 runtime/workflow identity boundary, Stage 13.3 CRLF hygiene plan, and Stage 13.4 process-runner ergonomics note. Final validation passed: `node _tests/run_all_smokes.js --skip-network = ok_0_40_0_6_157` with public=6 and tests_authenticated=157. No Stage 14 implementation approval is recorded by this closeout; the next allowed work is to present a Stage 14 proposal/recommendation for operator review with scope, risks, non-actions, and validation plan. No runtime code patch, deploy, restart, connector refresh, public connector reconnect, runtime enforcement, allow/deny behavior change, dispatch behavior change, hotplug/list_changed emission, sessionless migration, mass CRLF normalization, git add --renormalize ., or process-runner policy change was performed.

Post-Stage 13 repo hygiene audit green: `_workflow/operator_decisions/post_stage13_repo_hygiene_audit.md` records code-health and workflow-queue hygiene after Stage 13 closeout. Validation evidence: run_all skip-network returned ok with public=6 and tests_authenticated=157; server self-test returned ok; npm test could not run because npm is unavailable in the process-runner PATH, which is tool-environment ergonomics rather than repo failure. Active remaining work is reduced to six described items: Runtime Enforcement Apply Package - No Apply proposal, Cooperative Tool Cancellation C3, Event-driven Hotplug Lifecycle, Sessionless / Explicit State Handles Target Selection, Legacy Retired Auth Test Archive/Cleanup, and CRLF Batch Normalization. No Stage 14 implementation approval is recorded; no runtime code patch, deploy, restart, connector refresh, runtime enforcement, allow/deny behavior change, hotplug/list_changed emission, sessionless migration, or mass CRLF normalization was performed.

Stage 14.1 runtime enforcement no-apply package green: `_workflow/operator_decisions/stage14_runtime_enforcement_no_apply_package.md` starts Stage 14 as Runtime Enforcement Apply Package - No Apply. It records the source-derived future hook in `src/runtime/tools_call_handler.js` after decision receipt and before `tool_call_start`/handler execution; required future apply artifacts; and the approval marker id `operator_approved_runtime_policy_enforcement_apply`. No Stage 14 runtime enforcement apply is approved or implemented. `SERVER_POLICY_RUNTIME_SPEC.json` and `SERVER_RESOURCE_POLICY_SPEC.json` remain runtime_enforced=false. No runtime-imported code change, tools_call_handler wiring, runtime policy denial behavior change, allow/deny behavior change, deploy, restart, connector refresh, public connector reconnect, hotplug/list_changed emission, sessionless migration, or CRLF normalization was performed.

Stage 14.2 developer workbench debt cleanup green: `_workflow/operator_decisions/stage14_2_workbench_debt_cleanup.md` records the operator corrections before any runtime enforcement apply design. The active backup/snapshot/deploy/rollback path is `_workflow/control_plane`, not root `_backups`; `test_mcp_backup.ps1` now writes to `_workflow/control_plane/snapshots`; active Stage 12 validators now require `_workflow/control_plane/snapshots`; local ignored root `_backups` was moved under ignored `_workflow/control_plane/retired_root_backups/local_ignored__backups_moved_2026-06-24`. Post-Stage6 binding decisions and `_workflow/baselines` are mandatory context before Stage 14.3. No runtime enforcement apply, runtime-imported code change, restart, connector refresh, deploy, allow/deny behavior change, tools_call_handler wiring, hotplug/list_changed emission, sessionless migration, or baseline refreeze was performed.

Stage 14.2B repo gremlin double scan green: `_workflow/operator_decisions/stage14_2b_repo_gremlin_double_scan.md` records two additional whole-repo scan passes after Stage 14.2. Corrections: `SERVER_SPEC.json` legacy root backup target now points to `_workflow/control_plane/retired_root_backups/`; root `_backups/**` is no longer workflow truth; inactive but meaningful control-plane/preflight/stress/internal-truth checks no longer require or write root `_backups`; brittle `current_work_package` pins were removed from current Stage 14.2 and historical Streamable guards. Remaining tracked `_backups` references are intentional non-authority examples, negative tests, ignored-root/no-root-backups guards, historical frozen Stage12 data, or documentation. No runtime enforcement apply, runtime-imported server path change, restart, connector refresh, deploy, public connector reconnect, allow/deny behavior change, tools_call_handler wiring, hotplug/list_changed emission, sessionless migration, baseline refreeze, or root `_backups` recreation was performed.

Stage 14.3 runtime enforcement apply design review green: `_workflow/operator_decisions/stage14_3_runtime_enforcement_apply_design_review.md` records a no-apply design review for future Resource/Scope runtime enforcement. It keeps the explicit operator approval marker requirement, retires Stage12-specific no-apply wording as future blocker text, defines the future hook after `tool_call_decision` and before input validation/`tool_call_start`/handler execution, proposes future denial JSON-RPC and audit contracts, and records restart/connector/baseline/control-plane implications. Stage 14.3 itself requires no restart, connector refresh, deploy, backup, or baseline refreeze. A later approved apply would require runtime restart planning if live code changes, connector refresh only if MCP-visible surface/contract changes, baseline refreeze only in a separate baseline-change stage, and control-plane snapshot/deploy/rollback records before mutation. No runtime enforcement apply, runtime-imported code change, `tools_call_handler.js` wiring, approval marker, allow/deny behavior change, dispatch behavior change, restart, connector refresh, deploy, public connector reconnect, baseline refreeze, hotplug/list_changed emission, sessionless migration, or CRLF normalization was performed.

Stage 14.4 runtime enforcement apply package draft green: `src/stage14_runtime_enforcement_apply_package_draft.js` and `_tests/smoke_stage14_4_runtime_enforcement_apply_package_draft.js` add a code-backed no-apply draft package for future runtime enforcement. The draft records approval marker template with `approved=false`, exact future diff envelope for `src/runtime/tools_call_handler.js` and future `src/runtime/policy_enforcement_gate.js`, future test plan, denial JSON-RPC shape, `tool_call_policy_denied` audit contract, and restart/connector/baseline/control-plane decisions. Stage12-specific no-apply wording is retired as an active Stage14 blocker while the explicit approval boundary remains. No runtime enforcement apply, runtime-imported code path change, `tools_call_handler.js` wiring, approval marker, runtime policy denial behavior change, allow/deny behavior change, dispatch behavior change, restart, connector refresh, deploy, public connector reconnect, baseline refreeze, hotplug/list_changed emission, sessionless migration, or CRLF normalization was performed.

Stage 14.5 runtime enforcement apply correction: commit d299cfa is repo-applied. Public 3009 auth:none was restarted/replaced as pid=22804 and validated by health/tools-list. OAuth21 3008 was not restarted; TESTS_MCP runtime status observes 3008 read-only, not the restarted 3009 process. OAuth21 3008 Stage14.5 restart requirement is superseded by Stage 14.8/14.9 evidence and current supervisor authority. Connector refresh not required; baseline refreeze not required.
Stage 14.8 runtime enforcement state reconciliation green: `_workflow/operator_decisions/stage14_8_runtime_enforcement_state_reconciliation.md` records that Stage 14.5 repo-applied runtime gate is now live-loaded on OAuth21 3008 because the active server start `2026-06-28T16:18:17.295Z` is later than commits `d299cfa` and `6df748d`. Public 3009 is not currently live during reconciliation. No runtime change, restart, connector refresh, schema change, or live denial probe was performed.
Stage 14.7 D1 observation is closed. D1-A/D1-B/D1-C repo-applied and live-validated on TESTS_MCP 3008.

S6 legacy retired auth cleanup and sessionless-ready spec review green: `_workflow/operator_decisions/s6_legacy_auth_cleanup_sessionless_ready_review.md` records that 17 retired access/bearer smoke files were archived under `_tests/archive/legacy_retired_auth/` with no hard delete, consolidated negative controls now live in `_tests/smoke_s6_legacy_retired_auth_negative_controls.js`, and all 30 root `SERVER*SPEC.json` files carry `sessionless_ready_review`. This is workflow/spec posture only: no runtime code patch, no OAuth21 3008 restart, no public 3009 start, no connector refresh, no connector route migration, and no stable `/mcp` removal.

S5 workbench sessionless standardization green: `_workflow/operator_decisions/s5_workbench_sessionless_standardization.md` records soft deprecation of the stable session-based `/mcp` method for new workbench development only, while preserving `/mcp` as legacy-compatible. `_workflow/sessionless_inventory.json#target_selection_readiness.s5_workbench_deprecation_standardization` is authoritative. The new workbench standard is S4 `/mcp/sessionless` with `MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE=1` for isolated higher-port tests. OAuth21 3008 activation and connector migration remain separate explicit operator stages. No runtime code change, restart, public 3009 start, or connector refresh was performed.

S4 sessionless runtime prototype live-loaded: `_workflow/operator_decisions/s4_sessionless_runtime_prototype.md` records hidden `/mcp/sessionless` route gated by `MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE`, default disabled. Added `src/runtime/state_handle_prototype.js` and `src/runtime/sessionless_prototype_route_handler.js`; OAuth21 auth result now includes `clientId` for state-handle binding. Current `/mcp`, stable session code, connector-visible tool surface, and connector refresh remain unchanged. OAuth21 3008 was restarted through supervisor; live server_start_id is `2026-06-29T05:38:06.443Z`. The route remains default-disabled without `MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE`; connector-visible tool surface remains 43 tools with hash `8b62ecaf89227335`; connector refresh is not required.

S3 explicit state handle design rules green: `_workflow/operator_decisions/s3_explicit_state_handle_design_rules.md` records no-runtime preparation for S4. `_workflow/sessionless_inventory.json#target_selection_readiness.s3_explicit_state_handle_design_rules` is the authoritative rules source; guard `_tests/smoke_s3_explicit_state_handle_design_rules.js` validates opaque handles, authorization binding, lifecycle/TTL, audit redaction, error contract, and S4 readiness gate. No runtime state handle store, handle-bearing tools, session code removal, POST-only draft mode, connector refresh, public 3009 start, or OAuth21 3008 restart was performed.

Sessionless target selection preparation green, then truth-consolidated: `_workflow/operator_decisions/sessionless_target_selection_preparation.md` records source refresh and target-selection readiness. `_workflow/operator_decisions/sessionless_inventory_truth_consolidation.md` removes the duplicate source projection and makes `_workflow/sessionless_inventory.json#target_selection_readiness` the single authoritative source. Guard `_tests/smoke_sessionless_target_selection_readiness.js` reads inventory directly. C1/C2/C3 and hotplug are no longer blockers. Recommended target remains dual-track, but runtime prototype still requires explicit approval.

Event-driven Hotplug Lifecycle green: `_workflow/operator_decisions/event_driven_hotplug_lifecycle.md` records HPL1-HPL4 reconciled and HPL5 gated. Added `src/hotplug_lifecycle_readiness.js`, guard `_tests/smoke_event_driven_hotplug_lifecycle.js`, and `SERVER_PLUGIN_VISIBILITY_POLICY_SPEC.json#hotplug_lifecycle_readiness`. No runtime hotplug apply, no real `notifications/tools/list_changed` emission, no runtime `tools/list` mutation, no state-store write, no dynamic import enablement, no connector refresh, no public 3009 start, and no OAuth21 3008 restart was performed.

C3 cooperative tool cancellation green: `_workflow/operator_decisions/c3_cooperative_tool_cancellation.md` records repo-applied and live-loaded cooperative cancellation for optional tool execution on OAuth21 3008 (`server_start_id=2026-06-28T18:29:15.549Z`). C1/C2 blockers are removed as already implemented. Restart-authority blocker for OAuth21 3008 is removed as invalid current blocker. Connector refresh is not required because no connector-visible tool surface changed. New code: `src/runtime/cooperative_tool_cancellation.js`, updated `src/runtime/optional_tool_call_handler.js`, event `tool_call_cancelled_cooperative`, guard `_tests/smoke_c3_cooperative_tool_cancellation.js`.

Stage 14.9 workflow truth repair green: `_workflow/operator_decisions/stage14_9_workflow_truth_repair.md` records state compaction after Stage 14.5-14.8. `_workflow/state.json` must remain a compact orientation map, not a log. Next-step recommendations must reassess blocker validity, connector refresh need, and OAuth21 3008 restart need; assistant can restart 3008 when workflow and operator intent authorize it. public 3009 is not currently live. No runtime change, restart, connector refresh, public 3009 start, denial probe, C3 work, or baseline refreeze was performed.

Stage 14.6 inventory repair: sessionless_inventory now tracks SEP-2549/2567/2575/2577/2596 with checklist evidence. Guard: smoke_stage14_6_sep_sessionless_inventory.
