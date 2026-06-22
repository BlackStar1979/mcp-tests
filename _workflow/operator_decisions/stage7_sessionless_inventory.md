# Stage 7 Sessionless Compatibility Inventory

Status: inventory only; no runtime change
Date: 2026-06-21

## Scope

This inventory maps current stable Streamable HTTP/session dependencies before any sessionless or explicit-state-handle migration work.

This is not an implementation stage. It does not remove sessions, does not change initialize behavior, does not alter the OAuth21 connector, and does not change public runtime behavior.

Machine-readable inventory:

- `_workflow/sessionless_inventory.json`

## Current source-derived state

Reviewed runtime paths:

- `src/runtime/mcp_entry_dispatcher.js`
- `src/runtime/session_tracker.js`
- `src/runtime/session.js`
- `src/runtime/mcp_get_stream_handler.js`
- `src/runtime/outbound_request_manager.js`
- `src/runtime/sampling_context.js`
- `src/runtime/initialize_message_handler.js`
- `src/runtime/initialize_response.js`
- `src/runtime/rpc_message_dispatcher.js`

Reviewed tests:

- `_tests/smoke_stage12_streamable_http_session_lifecycle.js`
- `_tests/smoke_stage12_get_sse_stream.js`
- `_tests/smoke_stage12_pending_request_correlation.js`
- `_tests/smoke_stage12_sampling_roundtrip.js`
- `_tests/smoke_stage12_sampling_user_approval_policy.js`
- `_tests/smoke_stage12_session_replay_guards.js`

## Inventory summary

| Area | Current model | Classification | Future direction |
|---|---|---|---|
| initialize / initialized | stable 2025-11-25 compatible | keep_for_stable_compat | remove or parallelize in draft/sessionless mode |
| MCP-Session-Id | stable transport session header | keep_for_stable_compat | remove in draft mode |
| McpSession / SessionStore | in-memory session store | requires_parallel_mode | explicit state handles / request-scoped model |
| GET /mcp SSE | stable GET SSE stream | keep_for_stable_compat | remove in draft mode or replace with listen/subscription model |
| DELETE /mcp teardown | not implemented, non-POST 405 | do_not_implement | keep unsupported |
| pending request correlation | session.pending map | requires_parallel_mode | request-scoped or handle-scoped after target selection |
| sampling | session capabilities + pending response | blocked_by_client_support | re-evaluate after target selection |
| replay guard | session id + rpc id | keep_for_stable_compat | replace only if required by selected sessionless model |
| batch SSE | explicitly unsupported | already_aligned_as_non_target | keep unsupported |
| OAuth21 connector | active stable-compatible runtime | keep_for_stable_compat | do not migrate until connector/client support verified |

## Key conclusion

Do not remove or weaken session code in Stage 7.

The correct next runtime step remains C1 cancellation context plumbing inside the current stable-compatible runtime. Sessionless migration must wait for a separate S2 target-selection decision and, likely, a parallel mode or route rather than mutation of the current live connector path.

## Recommended next after this inventory

1. Commit this inventory.
2. Proceed to Stage 7.4 / C1 cancellation context plumbing.
3. Keep Stage 8 proposal as static registry foundation before hotplug/policy enforcement.
4. Open S2 stable-vs-draft target selection only after C1 or if operator explicitly prioritizes protocol migration.
