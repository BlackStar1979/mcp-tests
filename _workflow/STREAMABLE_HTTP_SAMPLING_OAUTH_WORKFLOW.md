# Streamable HTTP, Sampling, and OAuth Workflow

Status: ACTIVE
Created: 2026-06-19
Owner: operator-directed MCP architecture workflow
Language: English for repo artifacts; operator chat remains Polish.

## 1. Goal

Bring `mcp-tests` from the current stateless JSON-over-HTTP workbench baseline to a standards-aligned MCP 2025-06-18 Streamable HTTP server with explicit readiness for sampling, then proceed to OAuth.

OAuth must not be implemented on top of unfinished transport, session, outbound queue, pending-correlation, or sampling debt.

## 2. Current baseline

```text
server_version: 0.30.0
full_smoke_skip_network: ok_0_30_0_8_118
public_sections: 8
tests_authenticated: 118
repo_public_tools: 13
connector_surface_spec: SERVER_CONNECTOR_SURFACE_SPEC.json
```

Current implementation is a stateless MCP-like JSON-over-HTTP endpoint:

```text
POST /mcp -> JSON-RPC object/array -> application/json or 204
GET /mcp -> 405
OPTIONS /mcp -> CORS preflight
```

Current implementation is not yet full Streamable HTTP because it does not implement full Accept negotiation, MCP-Protocol-Version policy, POST SSE response path, GET SSE stream, SessionStore, outbound queue, pending request correlation, or sampling round-trip.

## 3. Non-negotiable gates

Every stage must end with:

```text
server_change: declared
workflow_change: declared
schema_change: declared
runtime_restart_required: declared
connector_refresh_required: declared
backup_required: declared
rollback_path: declared
restore_path: declared
targeted smoke: green
full smoke: green unless explicitly blocked by tool runner filter
state/canon: updated
```

Capabilities must remain false until the emitter/path is actually wired and tested.

Do not enable OAuth until Phase A-F are green or explicitly waived by the operator in writing.

## 4. Phase A - Streamable HTTP preflight

Purpose: make the current endpoint protocol-aware without changing default JSON behavior.

Touchpoints:

```text
src/runtime/accept_policy.js
src/runtime/protocol_version_policy.js
src/runtime/mcp_entry_dispatcher.js
src/runtime/initialize_response.js
_tests/smoke_stage12_streamable_http_preflight_guards.js
```

Checklist:

- [x] Parse `Accept` header.
- [x] Legacy default remains compatible unless strict mode is enabled.
- [x] Strict mode requires `application/json` and `text/event-stream` on POST.
- [x] GET strict mode requires `text/event-stream` in Accept.
- [x] Parse `MCP-Protocol-Version`.
- [x] Reject invalid or unsupported protocol versions with HTTP 400.
- [x] Initialize negotiates `2025-06-18` or supported fallback.
- [x] Update initialize instructions so they do not advertise stale tool exposure.

Acceptance:

```text
node _tests/smoke_stage12_streamable_http_preflight_guards.js = ok
node _tests/run_all_smokes.js --skip-network = ok
```

## 5. Phase B - POST SSE response path

Purpose: prove a real Streamable HTTP streaming response without sessions.

Touchpoints:

```text
src/runtime/sse_response.js
src/runtime/single_payload_dispatcher.js
src/runtime/batch_payload_dispatcher.js
_tests/smoke_stage12_post_sse_response.js
```

Checklist:

- [x] Add stream response writer.
- [ ] POST single request can return `Content-Type: text/event-stream` when negotiated.
- [ ] SSE emits `event: message` with final JSON-RPC response.
- [x] Stream closes after final response.
- [x] JSON response path remains default-compatible.
- [ ] Batch SSE is either explicitly unsupported or tested separately.

Acceptance:

```text
node _tests/smoke_stage12_post_sse_response.js = ok
node _tests/run_all_smokes.js --skip-network = ok
```

## 6. Phase C - SessionStore and lifecycle

Purpose: replace passive session-id shape validation with real MCP sessions.

Touchpoints:

```text
src/runtime/session.js
src/runtime/session_store.js
src/runtime/initialize_message_handler.js
src/runtime/initialize_response.js
src/runtime/mcp_entry_dispatcher.js
_tests/smoke_stage12_streamable_http_session_lifecycle.js
```

Checklist:

- [x] Initialize creates a cryptographically strong session id when stateful mode is enabled.
- [x] Initialize response carries `Mcp-Session-Id` HTTP header.
- [x] Session stores negotiated protocol version.
- [x] Session stores client capabilities.
- [x] Requests with unknown session id return 404.
- [ ] Requests missing required session id after initialization return 400. Deferred until strict stateful mode is enabled; legacy no-session requests remain compatible.
- [ ] DELETE `/mcp` teardown deferred; current non-POST behavior remains 405.
- [x] TTL or idle reaper exists in SessionStore and is basic-tested.

Acceptance:

```text
node _tests/smoke_stage12_streamable_http_session_lifecycle.js = ok
node _tests/run_all_smokes.js --skip-network = ok
```

## 7. Phase D - GET SSE stream and outbound queue

Purpose: add server-to-client transport required for notifications and sampling.

Touchpoints:

```text
src/runtime/mcp_get_stream_handler.js
src/runtime/sse_response.js
src/runtime/session.js
src/runtime/session_store.js
src/list_changed_notification_bus.js
_tests/smoke_stage12_get_sse_stream.js
_tests/smoke_stage12_outbound_queue.js
```

Checklist:

- [x] GET `/mcp` with valid session and `Accept: text/event-stream` opens an SSE stream.
- [x] One session can have at least one active outbound stream.
- [ ] Multiple streams are deferred; current session stores one active stream reference.
- [x] Server does not broadcast across sessions; current stream is session-bound.
- [x] Outbound queue buffers messages when stream is temporarily absent.
- [x] Queue flushes when stream is attached.
- [ ] Keepalive deferred to later hardening; ready event confirms stream open.
- [x] `tools/list_changed` remains false; bus is not flipped during Phase D.

Acceptance:

```text
node _tests/smoke_stage12_get_sse_stream.js = ok
node _tests/smoke_stage12_outbound_queue.js = ok
node _tests/run_all_smokes.js --skip-network = ok
```

## 8. Phase E - Pending request correlation

Purpose: allow the server to send JSON-RPC requests to the client and receive correlated responses.

Touchpoints:

```text
src/runtime/session.js
src/runtime/outbound_request_manager.js
src/runtime/rpc_message_dispatcher.js
src/runtime/single_payload_dispatcher.js
src/runtime/batch_payload_dispatcher.js
_tests/smoke_stage12_pending_request_correlation.js
```

Checklist:

- [x] Session allocates server-originated ids from a separate namespace.
- [ ] `session.sendRequest(method, params)` queues outbound request and returns a Promise.
- [x] Pending map correlates response id to resolver.
- [ ] POST JSON-RPC response is accepted as response, not treated as request.
- [ ] Accepted response/notification returns HTTP 202 with no body.
- [x] Unknown pending id is fail-closed and audited.
- [x] Pending timeout is implemented.
- [ ] Cancellation path deferred; timeout path is implemented.

Acceptance:

```text
node _tests/smoke_stage12_pending_request_correlation.js = ok
node _tests/run_all_smokes.js --skip-network = ok
```

## 9. Phase F - Sampling readiness

Purpose: support MCP client-side sampling only after transport and pending correlation are real.

Touchpoints:

```text
src/runtime/sampling_context.js
src/runtime/tools_call_handler.js
src/runtime/initialize_message_handler.js
src/runtime/session.js
_tests/smoke_stage12_sampling_capability_gate.js
_tests/smoke_stage12_sampling_roundtrip.js
```

Checklist:

- [x] Capture `params.capabilities.sampling` from initialize.
- [x] Store client capabilities on Session.
- [x] Expose `ctx.requestSampling` to tool handlers only when session and sampling capability exist.
- [x] Missing sampling capability returns deterministic error.
- [x] `sampling/createMessage` is sent through outbound queue.
- [x] Client response resolves pending request.
- [ ] User approval/security policy deferred to Phase G/OAuth policy hardening; sampling gate is technical-only.
- [x] `capabilities.sampling` is not falsely advertised as a server capability.

Acceptance:

```text
node _tests/smoke_stage12_sampling_capability_gate.js = ok
node _tests/smoke_stage12_sampling_roundtrip.js = ok
node _tests/run_all_smokes.js --skip-network = ok
```

## 10. Phase G - OAuth preflight and implementation

Purpose: implement OAuth only after transport debt is closed.

Touchpoints:

```text
SERVER_AUTH_SPEC.json
SERVER_CONNECTOR_SURFACE_SPEC.json
src/auth/**
src/runtime/auth_bootstrap_config_resolver.js
src/runtime/mcp_entry_dispatcher.js
_tests/smoke_stage12_oauth_preflight_contract.js
```

Checklist:

- [x] Protected resource metadata contract exists.
- [x] Authorization server metadata contract exists.
- [x] Authorization header only; no query token.
- [x] Audience/resource binding defined.
- [x] Scope matrix maps to tool policy runtime.
- [x] OAuth mode does not bypass policy-runtime bridge.
- [x] Public connector remains read-only public surface.
- [x] Operator connector remains separate from public connector.

Acceptance:

```text
node _tests/smoke_stage12_oauth_preflight_contract.js = ok
node _tests/run_all_smokes.js --skip-network = ok
```

## 11. Checkpoint table

| Phase | Status | May start when | Done when |
|---|---:|---|---|
| A Streamable HTTP preflight | DONE | current baseline green | Accept/protocol guards green |
| B POST SSE | DONE | Phase A green | POST SSE guard green |
| C SessionStore | DONE | Phase A green | session lifecycle guard green |
| D GET SSE + outbound queue | DONE | Phase C green | GET SSE/outbound queue guards green |
| E Pending correlation | DONE | Phase D green | pending correlation guard green |
| F Sampling readiness | DONE | Phase E green | sampling guards green |
| G OAuth | DONE | Phase A-F green | OAuth preflight guard green |

## 12. Execution policy

Work one phase at a time. Do not mix OAuth implementation into phases A-F. Do not turn on capabilities until the related path has a passing smoke. Do not refresh live connector or restart runtime without explicit operator approval.

## Phase A completion note

Phase A is green as `ok_0_30_0_8_120`. Implemented: `src/runtime/accept_policy.js`, `src/runtime/protocol_version_policy.js`, dispatcher preflight validation, protocol version propagation, initialize protocol negotiation, and `_tests/smoke_stage12_streamable_http_preflight_guards.js`. Next phase: Phase B - POST SSE response path.

## Phase C completion note

Phase C is green as `ok_0_30_0_8_122`. Implemented: `src/runtime/session.js`, `src/runtime/session_store.js`, initialize-created `Mcp-Session-Id`, known-session acceptance, unknown-session 404, protocol version/client capabilities storage, and `_tests/smoke_stage12_streamable_http_session_lifecycle.js`. Legacy no-session requests remain compatible until strict stateful mode. Next phase: Phase D - GET SSE stream and outbound queue.

## Phase D completion note

Phase D is green as `ok_0_30_0_8_124`. Implemented: `src/runtime/mcp_get_stream_handler.js`, GET SSE for known sessions with explicit stream Accept, session stream attach/detach, outbound queue buffering/flushing, `_tests/smoke_stage12_get_sse_stream.js`, and `_tests/smoke_stage12_outbound_queue.js`. Multiple streams and keepalive are deferred. Next phase: Phase E - Pending request correlation.

## Phase E completion note

Phase E is green as `ok_0_30_0_8_125`. Implemented pending request correlation and response acceptance guard. Cancellation is deferred; timeout exists. Next phase: Phase F - Sampling readiness.

## Phase F completion note

Phase F is green as `ok_0_30_0_8_127`. Implemented sampling context, capability gate, requestSampling path, outbound sampling request, and response resolution by pending correlation. User approval/security policy is deferred to Phase G/OAuth policy hardening. Phase A-F are green. Next phase: Phase G - OAuth preflight and implementation.

## Phase G completion note

Phase G is green as `ok_0_30_0_8_128`. Implemented OAuth resource-server preflight and validation: `SERVER_AUTH_SPEC.json`, `src/auth/auth_oauth.js`, `src/runtime/oauth_metadata.js`, protected resource metadata route, OAuth auth mode, Authorization header-only token use, query-token rejection, issuer/audience/scope checks, and `_tests/smoke_stage12_oauth_preflight_contract.js`. Authorization-server implementation remains external. Production hardening remains: external AS metadata/JWKS/RS256 or introspection integration.
