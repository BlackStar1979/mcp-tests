# Production MRTR runtime closeout

Status: live-accepted, loaded-dormant
Date: 2026-08-18
Package: `pol-1a-mrtr-runtime`

## Decision

Production MCP Multi-Round-Trip Requests support for protocol `2026-07-28` is loaded in the OAuth21/internal runtime through the dedicated `mrtr_extension` module. The module is intentionally dormant until the policy decision layer emits an `mrtr_requirement`; this closeout does not claim generalized human-consent enforcement.

## Production contract

- `src/runtime/mrtr_extension.js` owns MRTR state and retry validation.
- The module reuses the bounded process-local `state_handle_prototype` store; no second task, process, session, or execution registry exists.
- Initial eligible calls return `resultType: "input_required"` with bounded keyed `elicitation/create` form requests and an opaque `requestState` before `tool_call_start` or execution creation.
- Retry state is one-time, short-lived, owner/client/audience/profile-bound, exact-scope-bound, and bound to the tool, canonical argument digest, and MRTR requirement digest.
- Authenticated tool/argument/scope/requirement mismatch consumes the state. Cross-owner rejection does not revoke another owner's state.
- Stored MRTR payload contains only safe digests, the tool name, state version, and input-request keys. Raw arguments, argv, environment values, secrets, input responses, and auth identifiers are not persisted.
- Audit records contain only bounded reason codes, safe digests, counts, protocol/tool metadata, and timing/expiry metadata. Raw request state and response content are prohibited by `SERVER_EVENT_CATALOG_SPEC.json`.
- Legacy protocol eras do not negotiate MRTR. Unrelated legacy and modern calls remain unchanged when no MRTR requirement exists.

## Repository evidence

Architecture and implementation checkpoints:

- `9ce7ace` — production MRTR runtime design.
- `b222d76` — TDD implementation plan.
- `f324a89` — production MRTR state machine.
- `476038d` — runtime integration, capability/event truth, and active guards.

Targeted validation proved the state machine, runtime dispatch ordering, SEP-1303 input-validation precedence, official-client MRTR fixture, MCP Tasks coexistence, capability registry, event matrix, state-handle behavior, and repository hygiene.

Final pre-deploy full smoke on the exact `476038d` tree:

```text
job: 7804a781-f58b-484b-90b7-fa4f1c9308fa
ok: true
version: 0.40.0
public: 7
tests_authenticated: 310
exit_code: 0
stderr: empty
```

`deploy_decision_guard` classified the package as `runtime_restart_required`, with `requires_connector_refresh=false` and `requires_operator_approval=false`.

## Live acceptance

The supervisor restart request was created by `scripts/request-restart.js`:

```text
request_id: manual-1787079823223
code: 42
reason: pol-1a-mrtr-runtime-activation
created_at: 2026-08-18T19:03:43.223Z
```

The durable restart job reported `recovered_after_restart=true`. The restarted runtime produced:

```text
server_start_id: 2026-08-18T19:03:44.754Z
health: HTTP 200
server: mcp-tests-response-shape
version: 0.40.0
auth: oauth21
profile: internal
tools_count: 98
```

The supervisor-generated tool-surface control snapshot was rewritten by the new process at `2026-08-18T19:03:44.864Z` and proved no connector-visible surface delta:

```text
tool_count: 98
tool_names_hash: b6526b6d88ccbee3
input_schema_fingerprint: 440c0f660abff822
output_schema_fingerprint: 8292895f0216967c
descriptor_fingerprint: 82ffaaa3adb6e7db
combined_fingerprint: 93721a82a339f9d6
```

Post-restart connector calls in this session succeeded against the new runtime. Connector refresh is therefore not pending.

## Boundary to the next package

MRTR now supplies the production protocol primitive required by `POL-1A-CONSENT`. No current tool is yet classified as requiring MRTR, and no human-consent receipt is yet interpreted by policy. The next package must add cross-tool consent classification and deterministic MRTR requirements without weakening the exact-call binding above.
