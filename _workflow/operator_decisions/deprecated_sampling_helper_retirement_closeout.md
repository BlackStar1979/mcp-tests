# Deprecated Sampling Helper Retirement Closeout

Status: GREEN / RUNTIME CLEANUP COMPLETE
Date: 2026-08-17

## Decision

Retire the unreachable session-bound outbound request and classic Sampling implementation from the active repository. Preserve only an explicit fail-closed boundary for unsolicited JSON-RPC response envelopes on the surviving `/mcp` route.

This package supersedes the earlier retention posture recorded in `keep_mcp_local_session_helper_classification.md` and `keep_mcp_session_bound_outbound_sampling_scope.md`. Those records remain historical evidence of the boundary before cleanup.

## Evidence

- The CBM graph indexed at repository head `3941d53` showed `src/runtime/session.js` and `src/runtime/sampling_context.js` were imported only by smoke fixtures.
- Active `single_payload_dispatcher.js` and `batch_payload_dispatcher.js` used only response-envelope helpers from `outbound_request_manager.js`.
- Active `/mcp` request handling did not construct `McpSession`, inject `requestSampling`, or emit `sampling/createMessage`.
- In MCP 2026-07-28, classic Sampling is deprecated and new implementations should use direct provider APIs instead of adopting the deprecated protocol feature: `https://modelcontextprotocol.io/specification/2026-07-28/client/sampling`.

## Applied cleanup

- Removed `src/runtime/session.js`.
- Removed `src/runtime/sampling_context.js`.
- Removed `sendSessionRequest(...)`, `resolvePendingResponse(...)`, the pending registry contract, SSE outbound queue coupling, and Sampling approval/budget code that had no active route binding.
- Kept JSON-RPC response-envelope classification in `src/runtime/outbound_request_manager.js`.
- Added `rejectClientResponseEnvelope(...)` with the stable reason `server_initiated_requests_not_active`.
- Renamed the active audit event to `client_response_envelope_rejected`; retired dead pending-response and Sampling events from the active event catalog.
- Reclassified `SERVER_SAMPLING_POLICY_SPEC.json` and `SERVER_AUTH_SPEC.json` from implemented Sampling policy to a deprecated, inactive, fail-closed boundary.

## Regression boundary

The existing smoke names remain in the canonical manifest so the authenticated baseline does not churn. Their assertions now guard the retirement contract rather than simulate an unreachable Sampling roundtrip:

- `_tests/smoke_outbound_queue.js`
- `_tests/smoke_pending_request_correlation.js`
- `_tests/smoke_sampling_capability_gate.js`
- `_tests/smoke_sampling_roundtrip.js`
- `_tests/smoke_sampling_user_approval_policy.js`
- `_tests/smoke_keep_mcp_session_bound_outbound_sampling_scope.js`

## Deployment decision

Repository validation:

- targeted retirement, response-envelope, spec, workflow, and matrix guards: GREEN
- `node server.js --self-test`: GREEN
- `node _tests/run_all_smokes.js --skip-network`: `ok=true`, `public=7`, `tests_authenticated=305`
- durable validation job: `4e7d2ce9-f120-44cd-a01b-fb7852e5c1a3`
- `project_truth_audit`: `0` findings

- runtime restart required: yes, because active dispatcher and audit behavior changed
- connector refresh not required: no tool name, descriptor, input schema, output schema, or annotation changed
- OAuth reauthorization not required: auth/token persistence contracts are unchanged
- independent runtime on port `3008` forbidden: use `node .\scripts\request-restart.js --code=42 --reason=manual`

## Live-load evidence

- repository implementation commit: `7e198b2d9ebfc0247cfebb6003b69dc62c1f5e05`
- loaded repository head: `e32fefdb4d0f369a9ff30e1ecba7f94600807130`
- controlled restart request: `manual-1786939596474`
- live `server_start_id`: `2026-08-17T04:06:37.912Z`
- live tool count: `98`
- live combined fingerprint: `ec7d3af5b4ea17f5`
- direct post-restart `workbench.get_info`: GREEN
- connector refresh: not required
- OAuth reauthorization: not required
