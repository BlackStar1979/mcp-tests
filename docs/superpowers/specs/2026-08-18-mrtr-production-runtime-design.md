# Production MRTR Runtime Design

Date: 2026-08-18
Status: implementation design for `pol-1a-mrtr-runtime`

## Goal

Add a production MCP `2026-07-28` Multi-Round-Trip Requests (MRTR / SEP-2322) runtime module that can interrupt an eligible `tools/call`, return `resultType: "input_required"`, and validate the client's retry before tool execution. This package supplies the protocol primitive required by later `POL-1A-CONSENT`; it does not yet classify any current tool as requiring consent.

## Normative boundary

The `2026-07-28` wire contract permits `input_required` with keyed `inputRequests` and opaque `requestState`; the client retries the original request with keyed `inputResponses` and the same opaque state. `requestState` is untrusted client input and must be integrity-protected and bound to the originating principal and request. Legacy protocol eras do not negotiate MRTR.

Project constraints remain stricter than the protocol minimum:

- no model-supplied `confirm=true` as proof of human approval;
- no second task, process, session, or execution registry;
- no generic server-initiated elicitation path;
- no raw argv, env, secrets, arguments, state handles, or response content in audit records;
- no connector-visible tool/schema change in this package.

## Architecture

`src/runtime/mrtr_extension.js` owns MRTR state and retry validation. `createMcpRuntimeHandlers()` creates one extension instance per server runtime and passes it through `rpc_message_dispatcher` to `tools_call_handler`.

`tools_call_handler` invokes the extension after normal tool policy, rate-limit, and tool-input validation but before `tool_call_start`, Tasks creation, optional-tool execution, or any other execution side effect. The extension receives an MRTR requirement from the decision layer. No current decision emits such a requirement, so existing tool behavior remains unchanged until `POL-1A-CONSENT` deliberately activates it.

The modern response decorator already preserves an explicit `resultType: "input_required"`; no second response-envelope implementation is introduced.

## State model

Reuse `src/runtime/state_handle_prototype.js`. The existing store already provides a cryptographically random opaque handle, bounded record count, expiry, owner/client/audience/profile/scope checks, and one-time revocation. A server-side random handle backed by an authenticated record is the integrity boundary; the client cannot mutate the stored binding by altering the opaque handle.

MRTR stores only safe metadata and digests:

- MRTR state kind/version;
- originating tool name;
- canonical SHA-256 digest of original tool arguments;
- exact normalized OAuth scope digest;
- digest of the MRTR requirement/policy context;
- sorted input-request keys;
- issued/expiry metadata already owned by the state store.

Raw arguments, input-request content, input responses, auth subject/client IDs, and secrets are not persisted in MRTR state. The generic store already stores only hashes for subject/client identity.

Outstanding MRTR state is intentionally process-local. A restart destroys it and a retry then fails closed. This package does not add durable MRTR state because restart-surviving approval is not required for the current single-runtime architecture and would create an unnecessary new security store.

## Canonical request binding

The MRTR module computes a deterministic digest over JSON-compatible arguments by recursively sorting object keys while preserving array order and primitive values. Canonicalization is bounded by maximum depth, node count, and serialized byte size; over-complex input fails closed.

The retry must match:

- modern protocol `2026-07-28`;
- tool name;
- canonical argument digest;
- subject/client/audience/profile via the state store;
- exact normalized OAuth scope digest;
- MRTR requirement digest;
- exact keyed input-response set expected by the original `inputRequests`.

Scope comparison is exact at the MRTR binding layer even though the generic state store allows a current scope superset. A scope change after the first round therefore cannot reuse an old approval state.

## Round lifecycle

For a call with no MRTR requirement, the extension returns `not_required` and dispatch continues unchanged.

For an eligible modern initial call with an MRTR requirement and no retry fields:

1. validate and bound the requested `inputRequests` map;
2. create one opaque state handle with digest-only payload;
3. return `resultType: "input_required"`, the bounded `inputRequests`, and `requestState`;
4. do not emit `tool_call_start` and do not create a process, Task, artifact, or other execution record.

For a retry:

1. require both `requestState` and `inputResponses`;
2. authenticate and bind the state to the current request;
3. consume the state exactly once before handing responses to the policy consumer;
4. validate that response keys exactly match the original request keys;
5. return the responses only in-memory to the caller for the next policy decision.

Replay, expiry, owner/client mismatch, tool change, argument change, scope change, requirement change, missing paired retry fields, unknown/missing response keys, and malformed response maps all fail closed. A verified state is consumed even when the supplied response map is malformed, so one state never becomes a reusable guessing oracle.

For a legacy request that is classified as requiring MRTR, fail closed with a deterministic protocol/policy denial. Unrelated legacy calls remain unchanged.

## Elicitation boundary

MRTR transports embedded input requests; it does not reactivate the retired generic server-initiated elicitation architecture. This package permits only bounded `elicitation/create` form input requests for the future consent use case. `POL-1A-CONSENT` will own the human-readable consent message, risk/resource fields, and accept/decline interpretation.

## Audit

Emit safe lifecycle events for input-required issuance and retry accept/deny. Audit fields may include tool name, protocol era, state-handle hash, age/status buckets, input-key count, requirement digest, and closed reason codes. Never log raw `requestState`, `inputResponses`, arguments, elicitation content, auth identifiers, argv, env, or secrets.

## Capability and deployment truth

After repo implementation, `protocol_capability_registry.js` changes modern MRTR from `fixture_only` to `mrtr_extension`; legacy remains `not_negotiated`. `SERVER_PROTOCOL_CAPABILITY_SPEC.json` records repository implementation separately from live activation.

This package adds no tool and changes no tool input/output descriptor, so the expected connector count/fingerprint remain `98 / 93721a82a339f9d6`. Runtime source must be loaded by the controlled OAuth21 supervisor restart before it can be marked live. Connector refresh is not required unless an unexpected descriptor/schema fingerprint delta is detected.

## Tests

Use RED -> GREEN against production code. Prove:

- bounded issuance of `input_required` with opaque state and no raw argument/secret material;
- exact tool/argument/auth/scope/requirement binding;
- one-time replay rejection and expiry;
- malformed/missing/extra response keys fail closed;
- legacy requirement fails closed while non-required legacy calls pass through;
- no tool execution occurs before a required round completes;
- accepted retry can proceed to the existing execution path without creating a second execution truth;
- existing official-client fixture remains green;
- capability registry/spec describe the production module without changing connector descriptors.

After targeted tests: syntax checks, `git diff --check`, project truth guards, full `7 + N` smoke, deploy decision guard, controlled live load, runtime/fingerprint verification, knowledge-index rebuild, and final clean `HEAD == origin` closeout.
