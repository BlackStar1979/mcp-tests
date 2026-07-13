# Keep `/mcp` RPC Response Observability Package

Status: GREEN / RUNTIME + WORKFLOW UPDATED / LIVE VERIFICATION RECORDED
Date: 2026-07-12

## Purpose

Close the server-side observability gap where active `/mcp` runtime evidence showed what the server interpreted from requests, but not what the same runtime path actually sent back as HTTP/RPC responses.

This package adds bounded, structured response-side audit coverage without turning the audit log into a raw payload dump.

## Confirmed repo-applied runtime change

The active runtime code now emits `rpc_response_sent` on the surviving `/mcp` route for:

- standard single-message JSON-RPC responses
- standard batch JSON-RPC responses
- empty `202` and `204` responses on active request paths
- auth rejection responses
- `OPTIONS` CORS preflight responses
- method-not-allowed responses
- malformed JSON parse-error responses
- RPC handler exception responses

The emitted response summary is bounded and structured:

- `request_id`
- `status_code`
- `response_mode`
- `response_bytes`
- `phase`
- JSON-RPC id/result/error summary fields
- batch response summary fields where relevant

Evidence:

- `src/runtime/rpc_response_audit.js`
- `src/runtime/rpc_audit_summary.js`
- `src/runtime/single_payload_dispatcher.js`
- `src/runtime/batch_payload_dispatcher.js`
- `src/runtime/auth_rejection_handler.js`
- `src/runtime/cors_preflight_handler.js`
- `src/runtime/method_not_allowed_handler.js`
- `src/runtime/request_body_parse_handler.js`
- `src/runtime/rpc_handler_exception_handler.js`

## Confirmed non-actions

- no raw full-body request dump was added
- no raw full-body response dump was added
- no new connector-visible MCP method/tool/schema was added
- no OAuth21 `3008` restart was performed in this package
- no connector refresh was performed in this package
- no auth contract was changed

## Active runtime/spec consequences

- active repo truth now supports correlating server-side request interpretation and server-side emitted response by `request_id`
- active repo truth can now distinguish request-side interpretation failures from response-side emission behavior on the same `/mcp` path
- the audit trail remains bounded and suitable for workflow/runtime diagnosis without widening into unrestricted payload logging
- the package is now live-loaded on OAuth21 `3008` after a controlled restart trigger and bounded live verification

## Guard coverage

The bounded response-side audit package is covered by targeted smoke:

- `_tests/smoke_keep_mcp_request_contract_bridge.js`
- `_tests/smoke_http_boundary_guards.js`
- `_tests/smoke_malformed_json_parse_error_redaction.js`

## Live verification

A controlled OAuth21 `3008` restart trigger was executed after the repo-applied package:

- restart request reason: `live_load_rpc_response_observability`
- listener PID changed from `18048` to `32092`
- `/healthz` returned `status: ok`
- live runtime remained on:
  - server `mcp-tests-response-shape`
  - version `0.40.0`
  - connector shape `2025-05-strict-v1`
  - profile `internal`
  - auth `oauth21`
  - tool count `69`

Bounded live probes then confirmed `rpc_response_sent` on active runtime:

- `GET /mcp` returned `405` and emitted:
  - `rpc_received` with `kind: "method_not_allowed"`
  - `rpc_response_sent` with `phase: "method_not_allowed"`
- unauthenticated `POST /mcp` returned `401` and emitted:
  - `rpc_received` with `kind: "auth_rejected"`
  - `rpc_response_sent` with `phase: "auth_rejected"`
- authenticated local `POST /mcp` `initialize` returned `200` and emitted:
  - `oauth21_access_token_accepted`
  - `rpc_received` with `method: "initialize"`
  - `initialize_received`
  - `rpc_response_sent` with `phase: "single_json_response"`

Evidence:

- `_logs/.mcp-tests-audit.jsonl`
- local `healthz` on `127.0.0.1:3008`

## Next safe workflow step

Use the bounded `rpc_received` plus `rpc_response_sent` audit pair on the live runtime to compare:

- what the client actually sent
- what the server interpreted
- what the server actually returned

Do not expand this package into raw payload export unless a narrower decision explicitly authorizes it. The next higher-value comparison is the real Codex/OpenAI authenticated client path, not more local unauthenticated probes or more synthetic local success cases.

## Declarations

- server_change: true
- workflow_change: true
- schema_change: false
- runtime_restart_required: true
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
