# P3 Cancellation Path Client Disconnect Plan

Date: 2026-06-21
Status: plan only; no runtime implementation in this checkpoint.

## Operator decision implemented by this plan

D6: active cancellation is required in the modern architecture, with timeout retained as fallback. Do not rely only on timeout. Implement cancellation in a separate stage by detecting client disconnect / abort and propagating cancellation to long-running work.

## Current source-derived state

Reviewed source paths:

- `src/runtime/mcp_entry_dispatcher.js`
- `src/runtime/single_payload_dispatcher.js`
- `src/runtime/batch_payload_dispatcher.js`
- `src/runtime/mcp_get_stream_handler.js`
- `src/runtime/outbound_request_manager.js`
- `src/runtime/sampling_context.js`
- `src/runtime/session.js`
- `src/util/network_policy.js`

Observed state:

1. `mcp_get_stream_handler.js` already listens to `req.on("close")` and `req.on("aborted")` to detach SSE GET streams and audit `sse_stream_closed`.
2. `outbound_request_manager.js` implements timeout for pending server-originated requests through `setTimeout` and removes pending entries on timeout or response resolution.
3. `sampling_context.js` routes sampling through `sendSessionRequest(..., { timeoutMs })`, so sampling has timeout fallback but no active client-disconnect propagation.
4. `single_payload_dispatcher.js` and `batch_payload_dispatcher.js` call `handleRpcMessage(...)` without a cancellation signal in context.
5. `mcp_entry_dispatcher.js` does not currently create an `AbortController` for POST request lifecycle and does not pass an `AbortSignal` into tool/runtime execution.
6. `network_policy.js` already uses `AbortController` internally for bounded outbound fetches, which is a usable precedent for cancellation propagation.

## Target behavior for future implementation

For POST `/mcp` request handling:

1. Create one `AbortController` per inbound POST request.
2. Attach request lifecycle listeners:
   - `req.on("close", ...)`
   - `req.on("aborted", ...)`
   - optionally response close/error where applicable.
3. On client disconnect before response completion:
   - abort the controller;
   - audit a controlled event, e.g. `request_cancelled_by_client`;
   - prevent further response writes if headers/body can no longer be sent.
4. Pass `abortSignal` through dispatcher context:
   - `mcp_entry_dispatcher` -> `handleBatchPayloadIfNeeded` / `handleSinglePayload`;
   - dispatchers -> `handleRpcMessage` context;
   - runtime handler -> tool execution context where feasible.
5. Long-running tools should opt in to cancellation by accepting `abortSignal` or a small cancellation context object.
6. Timeout remains mandatory as fallback for broken network conditions or non-cooperative downstream APIs.

## Non-goals for the first implementation stage

- Do not implement JSON-RPC `$/cancel` in the first stage.
- Do not introduce a global session cancellation manager.
- Do not couple cancellation to `Mcp-Session-Id`.
- Do not implement Sessionless MCP migration in this cancellation stage.
- Do not change existing GET SSE detach behavior except to align audit naming if needed.

## Proposed staged implementation

### C1 - Cancellation context plumbing

Files likely touched:

- `src/runtime/mcp_entry_dispatcher.js`
- `src/runtime/single_payload_dispatcher.js`
- `src/runtime/batch_payload_dispatcher.js`
- `src/runtime/mcp_runtime_handlers.js`

Add `abortSignal` to runtime context and prove it reaches a mock long-running handler.

Guard:

- `_tests/smoke_request_cancellation_context.js`

### C2 - Client disconnect audit and no-write-after-close guard

Add audit event for client disconnect and ensure dispatcher does not attempt to write a normal response after cancellation.

Guard:

- `_tests/smoke_client_disconnect_write_guard.js`

### C3 - Cooperative tool cancellation sample

Pick one safe long-running or mocked handler path and demonstrate cooperative cancellation with `AbortSignal`.

Guard:

- `_tests/smoke_cooperative_tool_cancellation.js`

### C4 - Timeout fallback preservation

Ensure existing pending request timeout behavior remains intact and is not replaced by cancellation.

Guard:

- existing `_tests/smoke_pending_request_correlation.js`
- new focused timeout preservation guard if needed.

## Acceptance criteria

- Client disconnect aborts the per-request `AbortController`.
- Cancellation signal reaches `handleRpcMessage` context.
- At least one cooperative execution path stops early when aborted.
- Timeout fallback still works.
- No response is written after request/response has closed.
- Full `run_all --skip-network` remains green.

## Risk notes

- The highest risk is writing to a closed response object after abort.
- The second risk is treating cancellation as an auth/protocol error; it should be an operational cancellation path, not a protocol violation.
- Tool handlers that ignore `abortSignal` must still be bounded by existing timeouts.
