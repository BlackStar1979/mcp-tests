# Stage 14.7 / Sprint D1 - tools/list cache diagnostics plan

Status: D1-A/D1-B/D1-C REPO APPLIED / NOT LIVE LOADED
Date: 2026-06-27

## Problem statement

After controlled TESTS_MCP restarts the server can be healthy, OAuth21 state can be loaded, and tools/call can succeed, while a connector/client UI may still keep or display a stale tools/list surface. The OAuth durability issue is separate and has already been addressed by durable OAuth21 state and live audit evidence.

This stage addresses tools-list freshness, cache diagnostics, and protocol-correct cache hints. It must not erase or supersede existing active work items: runtime policy expansion, cancellation, hotplug lifecycle, sessionless/state-handle selection, retired auth cleanup, CRLF normalization, and remaining policy/runtime work continue to exist.

## Source direction and assumptions

- tools/list is the authoritative MCP discovery method for tool descriptors.
- notifications/tools/list_changed is valid only when the server actually supports and emits list-change notifications for live sessions.
- A process restart cannot notify dead sessions; post-restart behavior depends on the client reconnect and reinitialize path.
- SEP-2549 TTL for list results is the most relevant protocol direction for cache freshness.
- ttlMs: 0 and cacheScope: private are cache hints, not a guaranteed UI refresh mechanism.
- Existing clients may ignore unknown list-result fields or keep process-level connector caches.
- Streamable HTTP session semantics matter: unknown or stale Mcp-Session-Id after restart must fail closed, and the client must reinitialize.

## Minimal planned implementation

1. Extend tools/list response shape with cache hints:
   - ttlMs: 0;
   - cacheScope: private.

2. Add diagnostic metadata to tools/list:
   - _meta["mcp-tests/toolSurfaceFingerprint"];
   - _meta["mcp-tests/serverStartId"];
   - optionally _meta["mcp-tests/toolSurfaceCount"] if not redundant.

3. Add or expose process-level serverStartId:
   - generated once at process start;
   - visible in test_mcp_runtime_status;
   - visible in tools/list metadata;
   - not treated as connector-visible tool schema change by itself unless descriptor shape changes.

4. Add audit events:
   - initialize_received with protocol version, clientInfo summary, session id status, no secrets;
   - tools_list_served with request id, session id if present, tool count, fingerprint, serverStartId;
   - tools_list_cache_directive with ttlMs and cacheScope.

5. Guard capability semantics:
   - do not advertise tools.listChanged: true unless a real emitter exists;
   - if listChanged remains disabled/dry-run, tests must prove it is not falsely advertised.

6. Add tests:
   - tools/list returns ttlMs=0;
   - tools/list returns cacheScope=private;
   - tools/list metadata fingerprint matches runtime status fingerprint;
   - tools/list metadata serverStartId matches runtime status serverStartId;
   - initialize capability does not advertise listChanged without emitter;
   - audit event catalog includes the new tools-list cache/diagnostic events.

## Extended planned implementation, not first apply

1. Persist last tool surface fingerprint:
   - store current fingerprint after successful startup or tools/list serving;
   - compare current vs previous on process start or first initialized session.

2. Implement real listChanged emitter only when semantics are valid:
   - emit notifications/tools/list_changed to active live sessions only after actual surface change;
   - do not emit on every initialize merely to force UI refresh;
   - audit notifications_tools_list_changed_emitted with previous/current fingerprint.

3. Add stale-connector-map diagnostics:
   - compare externally observed connector tool count/hash with runtime status;
   - classify stale connector map separately from server runtime failure.

4. Add explicit old-session test:
   - request using stale/unknown Mcp-Session-Id returns 404;
   - client must reinitialize after 404 per Streamable HTTP session semantics.

## Non-actions and guardrails

- No connector refresh during planning.
- No live restart during planning.
- No artificial tool renaming to force refresh.
- No fake listChanged capability.
- No unconditional list_changed after initialized.
- No claim that ttlMs=0 forces ChatGPT, Claude Desktop, Cursor, Windsurf, or any other client to refresh UI state.
- No reliance on GPT_MCP as validator for TESTS_MCP behavior.
- Any live validation must use TESTS_MCP and/or TESTS_MCP audit logs.

## Runtime / connector implications

- tools/list response-shape changes are MCP-visible but not necessarily connector-action descriptor changes.
- If only result metadata/cache hints change, connector refresh may not be required, but live behavior requires runtime restart to load code.
- If tool descriptors, names, count, input schemas, or output schemas change, connector refresh must be reassessed explicitly.
- OAuth21 3008 restart must remain supervisor-controlled and use controlled restart codes only.

## Acceptance criteria before apply

- The external server audit is reviewed and mapped to this plan.
- Existing active work queue remains present and is not replaced by this stage.
- Root specs and workflow state mention this plan without turning state.json into a log.
- Tests are identified before implementation.
- Restart and connector-refresh impact are stated before code changes.

## Recommended first implementation package

Package D1-A:

- tools/list response builder: ttlMs/cacheScope/_meta fingerprint/serverStartId;
- runtime status assembly: serverStartId if missing;
- audit event additions;
- targeted tests for tools/list TTL/cacheScope/fingerprint/serverStartId;
- matrix/event catalog update;
- full node _tests/run_all_smokes.js --skip-network before commit.

Package D1-B, only after D1-A evidence:

- persisted fingerprint comparison;
- conditional list_changed emitter;
- old-session/404 test hardening;
- live TESTS_MCP restart validation.

## D1-A apply closeout

Status: repo-applied, not live-loaded.

Implemented after external server audit review:

- tools/list now returns ttlMs: 0 and cacheScope: private;
- tools/list now includes metadata for tool surface fingerprint, tool names hash, tool count, and serverStartId;
- initialize serverInfo now includes serverStartId;
- runtime status now includes server_start_id;
- initialize_received, tools_list_served, and tools_list_cache_directive audit events are active;
- listChanged remains false; no fake list_changed notification was added;
- notifications/stream/ready was not implemented because it is not part of the approved D1-A scope.

Live implication: TESTS_MCP must be supervisor-restarted with controlled code 43 before D1-A behavior is live on 3008. Connector refresh is not required unless descriptor names/count/schema change after validation.

## D1-C observability closeout

Status: repo-applied, not live-loaded.

Implemented:

- added `src/tools_list_cache_diagnostics.js`;
- observability_status now exposes `tools_list_cache_diagnostics`;
- diagnostic classifies initialize + tools/call without observed tools/list for the current server_start_id;
- diagnostic reports last initialize, last tools/list RPC, last tools_list_served, last cache directive, last tool_call_start, current surface fingerprint, and per-current-start counters;
- no listChanged behavior changed; no connector refresh performed.

Live implication: TESTS_MCP requires controlled restart code 43 before D1-C is live on 3008.

## D1-B conditional listChanged closeout

Status: repo-applied, not live-loaded.

Implemented:

- persisted tool surface state in `_control/tool-surface-state.json`;
- `MCP_TEST_TOOL_SURFACE_STATE_FILE` override;
- first start with no previous state records baseline and does not emit a change notification;
- same fingerprint after restart does not emit;
- changed fingerprint sets `surface_changed_since_last_start`;
- initialize can advertise `capabilities.tools.listChanged=true` only when the runtime has the real notifier wired;
- active SSE sessions receive `notifications/tools/list_changed` only when a previous fingerprint exists and differs from current;
- a session is notified at most once;
- audit events record state load/save/change and notification emission;
- no artificial tool rename, no unconditional notification after initialized, no connector refresh.

Validation:

- `smoke_tools_list_changed_runtime`;
- `smoke_stage8_33_list_changed_readiness_contract`;
- `smoke_stage8_35_list_changed_notification_bus_dry_run`;
- `smoke_stage8_36_list_changed_local_harness`;
- `matrix_check`;
- `node _tests/run_all_smokes.js --skip-network` with public=6 and tests_authenticated=181.

Live implication: TESTS_MCP must be restarted with controlled code 43 before D1-B is active on 3008. Because initialize capability changed from listChanged=false to true, connector/tool discovery behavior should be observed after restart; manual connector refresh may still be needed because host-side cache behavior is not controlled by the server.
