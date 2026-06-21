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
- Workflow truth: `_workflow/**`, `_tests/**`, `_backups/**`, `_logs/**`; governance and evidence only unless imported by runtime.
- External truth: current OpenAI/MCP/platform docs. Use web when current API/platform behavior matters.

## 3. Current validated state

- Server name: `mcp-tests-response-shape`.
- Server version: `0.40.0`.
- Connector shape version: `2025-05-strict-v1`.
- Output mode: `structured` by default.
- Runtime stage label may remain a compatibility label and may lag repo progress.
- Latest validated public section count: `8`.
- Latest validated authenticated smoke count after HTTP boundary guard: `116`.
- Latest known full smoke: `node ./_tests/run_all_smokes.js --skip-network = ok_0_40_0_8_148`.
- Step39 semantic correction: Step39 is a workstream boundary/control review. The P1 decision-runtime coverage package is supporting evidence, not the definition of Step39.
- Step40 correction: workflow rules must be guarded by smoke, not merely documented.
- Workflow memory compaction: `_workflow` reduced from 425 files to 45 files; historical longterm, patch manifest, policy, root narrative files, stage logs, temp scripts, public-sandbox workflow mirror, obsolete README generators, and one-off closeout scripts removed from active workflow memory.
- State compaction: `_workflow/state.json` reduced from 250356 bytes to 1655 bytes.
- Stage-log compaction: stage progress logs removed from active workspace; stage history is represented only by this canon.
- Scratch cleanup: temp scratch removed from active workspace.
- Backup cleanup: `_backups` removed from active workspace; `workflow_snapshot.js` recreates a clean snapshot root when needed.
- Log cleanup: default raw audit log and old isolated audit log removed from active workspace; `_logs` retained only as runtime log target with small residual metadata.

## 3A. Active Streamable HTTP / Sampling / OAuth workflow

Active roadmap: `_workflow/STREAMABLE_HTTP_SAMPLING_OAUTH_WORKFLOW.md`.

Execution order is fixed unless explicitly waived by the operator:

```text
Phase A - Streamable HTTP preflight
Phase B - POST SSE response path
Phase C - SessionStore and lifecycle
Phase D - GET SSE stream and outbound queue
Phase E - Pending request correlation
Phase F - Sampling readiness
Phase G - OAuth preflight and implementation
```

OAuth must not be implemented until Phase A-F are green or explicitly waived in writing. Capabilities must remain false until the associated transport/emitter/request path is implemented and guarded by smoke.

Current workflow preparation status: `ready_streamable_http_workflow_plan`.

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
- `_backups`: controlled snapshots/deploy backups only. Not active knowledge.
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

Phase G OAuth resource-server preflight green: `SERVER_AUTH_SPEC.json`, `auth_oauth.js`, `oauth_metadata.js`, protected resource metadata route, OAuth auth mode, query-token rejection, issuer/audience/scope checks, and `_tests/smoke_stage12_oauth_preflight_contract.js` are active. OAuth is implemented as an MCP resource-server validator; authorization-server implementation remains external.

OAuth production hardening plan ready: `_workflow/OAUTH_PRODUCTION_HARDENING_PLAN.md` and `_tests/smoke_stage12_oauth_production_hardening_plan.js` are active. Execution order: H1 AS metadata, H2 JWKS/RS256, H3 introspection decision, H4 DCR policy, H5 PKCE policy, H6 key rotation, H7 sampling approval, H8 SSE keepalive/resumability, H9 live connector refresh readiness.

H1 AS metadata integration green: `oauth_authorization_server_metadata.js`, runtime AS metadata provider wiring, Protected Resource Metadata authorization_servers from validated AS metadata, and `_tests/smoke_stage12_oauth_as_metadata_integration.js` are active. Next implementation phase: H2 - JWKS/RS256 validation path.

H2 JWKS/RS256 validation green: `oauth_jwks_cache.js`, `oauth_jwt_verify.js`, JWKS/RS256 branch in `auth_oauth.js`, `MCP_TEST_OAUTH_JWKS_FILE` wiring, and `_tests/smoke_stage12_oauth_jwks_rs256_validation.js` are active. Next implementation phase: H3 - Introspection path or explicit decision to defer introspection.

H3 OAuth introspection validation green: `oauth_introspection.js`, introspection branch in `auth_oauth.js`, `MCP_TEST_OAUTH_INTROSPECTION_FILE`, and `_tests/smoke_stage12_oauth_introspection_validation.js` are active. JWKS/RS256 remains preferred production validation. Next implementation phase: H4 - DCR policy.

H4 DCR policy green: `dynamic_client_registration_policy` in `SERVER_AUTH_SPEC.json` and `_tests/smoke_stage12_oauth_dcr_policy.js` are active. DCR mode is supported with manual registration fallback; wildcard redirect URIs are forbidden; MCP server does not implement a runtime registration endpoint. Next implementation phase: H5 - PKCE/client-flow policy at AS boundary.

H5 PKCE client-flow policy green: `pkce_client_flow_policy` in `SERVER_AUTH_SPEC.json` and `_tests/smoke_stage12_oauth_pkce_policy.js` are active. Authorization code + PKCE S256, state verification, exact redirect URI validation, and resource parameter in authorization/token requests are policy requirements at AS boundary. Next implementation phase: H6 - Key rotation.

H6 JWKS key rotation green: `oauth_jwks_cache.js` and `_tests/smoke_stage12_oauth_key_rotation.js` are active. Next implementation phase: H7 - Sampling user-approval policy.

H7 sampling user-approval policy green: `SERVER_SAMPLING_POLICY_SPEC.json`, runtime approval/budget enforcement in `sampling_context.js`, and `_tests/smoke_stage12_sampling_user_approval_policy.js` are active. Next implementation phase: H8 - SSE keepalive/resumability.

H8 SSE keepalive/resumability green: `sse_response.js`, `mcp_get_stream_handler.js`, `session.js`, `_tests/smoke_stage12_sse_keepalive.js`, and `_tests/smoke_stage12_sse_resumability.js` are active. Next phase: H9 - Live connector refresh readiness after explicit operator approval.

H9 live connector refresh readiness green: `SERVER_CONNECTOR_SURFACE_SPEC.json`, `_workflow/CONNECTOR_REFRESH_READINESS.md`, and `_tests/smoke_stage12_connector_refresh_readiness.js` are active. Live connector refresh was not performed and remains blocked unless explicitly approved by operator. OAuth production hardening H1-H9 is green with documented debts: JWKS HTTP cache-control/max-age parsing and too-old Last-Event-ID fail-closed behavior.

mcp-tests audit remediation green: GET `/mcp` SSE authenticates before opening stream and `/docs/*` malformed percent-encoding returns controlled 400. Guards: `_tests/smoke_stage12_get_sse_requires_auth.js`, `_tests/smoke_stage12_docs_malformed_uri.js`. Live connector refresh remains blocked unless explicitly approved by operator.

H10 OAuth21 local authorization server green: `oauth21` mode on port 3008 exposes local OAuth 2.1 AS endpoints, DCR, PKCE S256, operator login, token issuance, Bearer-protected `/mcp`, and host allowlist for `mcp-tests-oauth21.romionologic.dev`. Guards are active in run_all. Live connector refresh remains blocked unless explicitly approved by operator.
