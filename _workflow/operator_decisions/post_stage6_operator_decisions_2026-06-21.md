# Post Stage 6 Operator Decisions

Date: 2026-06-21
Status: accepted operator direction after Stage 6 GREEN and post-Stage6 root spec/workflow review.

## Source of this record

This file records the operator's binding decisions after reviewing the post-Stage6 decision package. It intentionally separates:

- implemented/current repository truth;
- operator architectural direction;
- future work requiring separate verification against current MCP specifications before implementation.

The operator supplied architecture notes for emerging Sessionless MCP / explicit state-handle direction. Those notes are accepted here as project direction, but any implementation stage that depends on current MCP SEP/spec details must verify the live official specification before patching code.

## Accepted main package

1. Commit the current GREEN state as a checkpoint.
2. Do not reconnect the public ChatGPT connector now.
3. Keep legacy auth files/tests as archive/legacy until a separate cleanup stage.
4. Classify transport deferrals D2-D6 as deliberate limitations; do not implement them in this checkpoint.
5. Defer runtime policy expansion D7 to a separately approved stage.

## Binding decisions

### D1 - Public connector UI-level validation

Decision: A. Keep public connector disconnected until public UI validation is explicitly needed.

Rationale: public runtime can be validated locally on a higher/local port and does not need to stay configured as a permanent ChatGPT connector. A temporary UI test can be done later and torn down.

### D2 - Batch SSE semantics

Decision: A. Explicitly unsupported / not a target. Treat batch SSE as deprecated/out-of-scope for the target direction.

Implementation direction: add a future guard that records batch SSE as unsupported or deprecated, not a feature to implement.

### D3 - Strict stateful sessions / Mcp-Session-Id

Decision: do not invest in strict stateful session behavior as a strategic direction.

Operator direction: latest architectural direction is Sessionless MCP via explicit state handles. Transport/session-level state and the `Mcp-Session-Id` header are considered a legacy complexity source. If a server-side state relationship is needed, represent it through explicit application-level state handles returned by tools and passed as ordinary tool arguments, not by global HTTP transport sessions.

Implementation direction: before implementation, verify the current official MCP specification/SEP status. Do not make strict session behavior the long-term target. Preserve compatibility only where needed by current tests/runtime.

### D4 - DELETE /mcp teardown

Decision: do not implement DELETE `/mcp` teardown.

Rationale: session teardown is a legacy session-oriented pattern. The target direction is a single stateless POST endpoint where each JSON-RPC request is self-contained, with explicit application-level state handles when state is unavoidable.

Implementation direction: formalize DELETE teardown as out-of-scope or unsupported; do not add a session teardown endpoint.

### D5 - Multiple streams per session

Decision: do not build a custom multi-stream-in-session manager.

Operator direction: the modern model is one request equals one potential stream. Long-running tool calls may return SSE for that specific POST. Notification/listen streams are separate from per-tool execution streams. Concurrency should be handled by async HTTP request processing and, where needed, HTTP/2 or HTTP/3 multiplexing, not by a custom multi-stream session manager.

Implementation direction: future work should focus on stateless/ephemeral per-request streams and event/listen semantics, not multiple streams inside a transport session.

### D6 - Cancellation path

Decision: active cancellation is required in the modern architecture, with timeout retained as fallback.

Operator direction: do not rely only on timeout. Use native HTTP/client disconnect cancellation where possible: in Node.js, detect request close/abort and propagate cancellation to long-running tool work. Timeout remains the safety net for broken network/API conditions.

Implementation direction: create a separate cancellation implementation stage. Do not implement cancellation in this checkpoint.

### D7 - Runtime policy expansion

Decision: yes, runtime decision shim should eventually expand to full Resource/Scope Matrix Enforcement, but only in a separately approved stage.

Rationale: for high-fidelity agent testing, policy denial and scoped resource restrictions must be enforced by the runtime/policy layer, not only by tool-local logic. This is a security-boundary change and requires separate operator approval, negative controls, and audit receipt review.

Implementation direction: next step is a scope/plan package, not immediate runtime patching.

### D8 - Legacy retired auth files/tests

Decision: keep archive/legacy through the GREEN checkpoint; after commit, perform a separate triage.

Future triage buckets:

- `rewrite_as_negative_control`;
- `archive_only`;
- `delete_after_review`.

Rationale: negative controls are valuable for agentic systems because agents may attempt old/default auth paths. Do not delete useful regression material before classification.

### D9 - Connector refresh / dynamic tool lifecycle

Decision: previous A/B/C framing is obsolete as a target architecture. Adopt a future Option D: event-driven Hotplug lifecycle.

Operator direction: stop treating connector/tool freshness as a static refresh/check problem. Target architecture should support dynamic registration/unregistration/update of tools and emit MCP list-change notifications such as `notifications/tools/list-changed`, so clients/UI can re-fetch `tools/list` reactively.

Current checkpoint direction: no new refresh now; future work is a Hotplug design/implementation stage, not periodic refresh procedure.

### D10 - Commit

Decision: do review and commit as developer responsibility. The operator accepts that commit mechanics/staging are developer responsibility.

Implementation direction: commit the current GREEN state after validation.

### D11 - Workflow history vs current truth

Decision: A now, C later. Keep history with current corrective notes; consider archive compaction later as developer responsibility.

Implementation direction: do not rewrite history deeply before checkpoint commit. Post-commit, a workflow archive compaction stage may be planned.

### D12 - Public connector as security boundary

Decision: A. Keep public connector disconnected.

Rationale: public UI validation can be done temporarily on another port/temporary connector and torn down. It does not need to be permanent or configured by default.

## Immediate execution plan

1. Save this decision record.
2. Update workflow state and canon to point to this record.
3. Validate JSON, key smoke tests, full `run_all --skip-network`, and `git diff --check`.
4. Commit current GREEN state as checkpoint.
5. Leave future work unimplemented and explicitly staged:
   - legacy retired auth triage;
   - batch SSE unsupported guard;
   - sessionless/explicit state handle review;
   - no DELETE teardown;
   - per-request stream model / HTTP/2 consideration;
   - active cancellation path;
   - runtime policy expansion plan;
   - event-driven Hotplug lifecycle;
   - workflow archive compaction.

## Spec verification (2026-06-21)

The D3 caveat ("verify the live official MCP specification before patching") is
discharged at the record level. Verified against the official spec sources:

- **SEP-2567 — Sessionless MCP via Explicit State Handles**: removes the
  `Mcp-Session-Id` header and the protocol-level session concept; server-side state
  is carried via explicit handles minted by tools and passed back as ordinary tool
  arguments. (modelcontextprotocol.io/seps/2567-sessionless-mcp; PR #2567)
- **SEP-2575 — Make MCP Stateless**: removes the `initialize` handshake; protocol
  version + capabilities are carried per-request. (PR #2575)
- Together targeted at the **2026-07-28 specification Release Candidate**.

Consequence for this record: the sessionless/explicit-state-handle direction behind
D3/D4/D5 is confirmed as the official trajectory, not speculation. A future
implementation stage must still re-check **merged/final** SEP status (these were RC at
verification time), but the strategic direction does not need re-litigation.

Note: this section was added by the architect (VPS/TinyPyMCP) session as diligence;
the binding decisions above are unchanged.
