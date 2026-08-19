# POL-1A Human Consent Boundary Design

Date: 2026-08-19
Status: approved implementation design for `pol-1a-consent-boundary`
Repository baseline: `feature/cbm-cli-bridge-mvp` at pushed MRTR closeout `7deb418fc9fbf29985675fa8ce4b6d64938888f0`

## Goal

Bind currently executable high-risk process operations to server-verifiable human approval using the production MCP `2026-07-28` Multi-Round-Trip Requests (MRTR) runtime. The server must not treat a model-supplied boolean, a tool argument, or an existing model-driven confirmation handle as proof of human consent.

This package activates the already-live, loaded-dormant MRTR primitive for `run_process`, `process_start`, and `process_cancel`. Other destructive operations remain fail-closed unless separately authorized by an existing narrower mechanism; this package does not broaden their execution rights.

## Normative boundary

The implementation follows MCP `2026-07-28` as verified on 2026-08-19:

- client capabilities are declared per request in `_meta.io.modelcontextprotocol/clientCapabilities`;
- an empty top-level client-capabilities object means no optional capabilities;
- a returned `elicitation/create` form request requires form elicitation support for that request;
- missing required capability is protocol error `-32021` with `data.requiredCapabilities`;
- `elicitation: {}` is the backward-compatible implicit form-only declaration;
- `elicitation: { form: {} }` explicitly declares form support;
- `elicitation: { url: {} }` without form support is insufficient for a form request;
- MRTR returns `resultType: "input_required"`, keyed `inputRequests`, and opaque `requestState`; the client retries the same logical call with matching keyed `inputResponses` and the byte-exact state;
- form elicitation responses use `action: "accept" | "decline" | "cancel"`; form content is present only for accepted form responses.

The server remains stricter than the protocol minimum:

- human approval is required for the selected high-risk process operations;
- only a server-generated consent requirement can activate the consent path;
- consent is bound to the exact tool, canonical argument digest, exact OAuth scope digest, MRTR requirement digest, and authenticated owner/client boundary;
- no raw argv, env, secrets, tool arguments, request state, input requests, input responses, auth identifiers, or elicitation content may be persisted or audited;
- no connector-visible tool, input schema, output schema, descriptor, or tool count change is intended.

## Current defect and activation gap

Production MRTR is live but dormant because `decision_runtime_policy.js` emits no `mrtr_requirement`. `run_process`, `process_start`, and `process_cancel` are currently special-cased as `guarded_process_execution` and are allowed without a server-verifiable human consent artifact.

A second conformance defect exists at the MRTR boundary: the current runtime integration test uses an empty client-capabilities object while allowing the server to return form elicitation. MCP `2026-07-28` does not permit that. The consent package must fix this before activating MRTR requirements.

## Architecture

The consent path has four separate responsibilities:

1. `decision_runtime_policy.js` decides whether a call is allowed, denied, or allowed only after human consent. It does not interpret user responses.
2. New `consent_runtime_policy.js` owns deterministic consent classification, consent requirement construction, response interpretation, and safe consent receipt construction.
3. Existing `mrtr_extension.js` remains a protocol/state mechanism. It validates request capabilities, carries the elicitation request, binds state to the exact call, and returns the retry responses without deciding whether they mean approval.
4. `tools_call_handler.js` composes the decision, MRTR round, consent verification, audit record, and existing execution path. Execution begins only after all required gates are accepted.

No second task, process, session, consent-state, or execution registry is introduced. MRTR continues to reuse the bounded process-local state-handle store.

## Consent classification

The first production consent class is the existing set:

- `run_process` — resource `process_execution_bounded`, operation `execute`;
- `process_start` — resource `process_execution_bounded`, operation `execute`;
- `process_cancel` — resource `process_job_control`, operation `cancel`.

For these tools, the decision layer returns `allow: true` only as a pre-execution policy result and attaches a deterministic `mrtr_requirement`. The result reason becomes `human_consent_required`, replacing the unconditional `guarded_process_execution` bypass.

A missing or inconsistent tool-catalog entry for a consent-classified tool fails closed. Consent classification must derive `resource_class` and `operation_class` from `SERVER_TOOLS_SPEC.json`, not duplicate those values in source code.

Other destructive tool policies are not made executable by this package. Existing deny behavior remains the default. `cbm_delete_project` retains its current bounded confirmation mechanism for compatibility and is not upgraded to a human-consent claim in this package; a later migration may consolidate it without creating a second consent architecture.

## Deterministic MRTR requirement

The server-generated requirement uses a stable shape similar to:

```json
{
  "kind": "human_consent_v1",
  "consent": {
    "response_key": "human_approval",
    "tool_name": "run_process",
    "resource_class": "process_execution_bounded",
    "operation_class": "execute",
    "risk_class": "high",
    "scope_delta": [],
    "external_origin": null
  },
  "inputRequests": {
    "human_approval": {
      "method": "elicitation/create",
      "params": {
        "mode": "form",
        "message": "Human approval required for run_process: resource=process_execution_bounded; operation=execute; risk=high; scope_delta=none; external_origin=none. Approve this exact call?",
        "requestedSchema": {
          "type": "object",
          "properties": {
            "confirmed": { "type": "boolean" }
          },
          "required": ["confirmed"]
        }
      }
    }
  }
}
```

The human-readable message is deterministic and bounded. It exposes the fields required by `SERVER_CONSENT_POLICY_SPEC.json`: tool name, resource class, operation class, risk class, scope delta, and external origin. It deliberately does not echo raw command arguments, environment, secrets, or full paths.

The complete requirement is hashed by MRTR. Therefore a server-side change to consent semantics or displayed risk metadata between rounds invalidates the old state rather than reusing approval under different terms.

## Capability gate

Before issuing any form `input_required`, MRTR evaluates the current request's `clientCapabilities`.

Form elicitation is supported when:

- `elicitation` is an object and `form` is an object; or
- `elicitation` is an object and `url` is absent, preserving the specification's implicit form-only `elicitation: {}` compatibility.

Form elicitation is not supported when `elicitation` is absent, malformed, or URL-only.

When a required form capability is missing, the request returns JSON-RPC error `-32021` and HTTP 400 semantics with exactly the protocol-required capability data:

```json
{
  "requiredCapabilities": {
    "elicitation": {
      "form": {}
    }
  }
}
```

No MRTR state is created, no `tool_call_start` is emitted, and no process/Task/job/artifact is created. The server must not fall back to model confirmation.

Legacy protocol requests classified as requiring consent fail closed because production MRTR is not negotiated for those protocol eras. Unrelated legacy calls remain unchanged.

## MRTR exact-call binding

The existing MRTR binding remains authoritative:

- authenticated subject/client/audience/profile through the shared state-handle store;
- tool name;
- canonical SHA-256 of tool arguments;
- exact normalized OAuth scope digest;
- SHA-256 of the complete MRTR requirement;
- exact response-key set;
- TTL and one-time state consumption.

The consent package must not weaken any of these checks.

MRTR must not expose the canonical argument digest or exact scope digest outside its owner-bound state record. Those deterministic value digests are online verification material, not audit artifacts: exposing them would create unnecessary correlation and dictionary-testing surface. Safe consent linkage reuses only the existing `state_handle_sha256` and `requirement_sha256`, while the consent receipt records `binding_verified: true` after MRTR has authenticated and consumed the exact-call state.

## Consent response verification

`retry_ready` means only that the MRTR protocol/state round is valid. It does not mean the user approved anything.

For a `human_consent_v1` requirement, `consent_runtime_policy.js` verifies the response keyed by `human_approval` after MRTR has authenticated and consumed the state.

Execution is allowed only when all conditions hold:

- the keyed response exists;
- `action === "accept"`;
- `content` is a plain object;
- the content contains exactly `confirmed`;
- `confirmed === true`.

The following all deny execution: `decline`, `cancel`, `accept` without content, `confirmed: false`, missing `confirmed`, unexpected content keys, malformed response shape, missing response key, replay, expiry, owner mismatch, tool mismatch, argument mismatch, scope mismatch, or requirement mismatch.

MRTR state is already consumed before semantic consent verification. A declined or malformed response cannot be corrected by replaying the same state; a new exact-call consent round is required.

## Consent receipt and audit

An accepted consent produces a safe server-side receipt such as:

```json
{
  "version": "human-consent-receipt-v1",
  "outcome": "accepted",
  "tool_name": "run_process",
  "resource_class": "process_execution_bounded",
  "operation_class": "execute",
  "risk_class": "high",
  "scope_delta": [],
  "external_origin": null,
  "requirement_sha256": "...",
  "state_handle_sha256": "...",
  "binding_verified": true
}
```

The receipt is recorded in bounded audit metadata before `tool_call_start`. It is not a bearer credential and is never accepted as an input on a later call.

Add explicit safe audit events for consent acceptance and consent denial. Their catalog privacy boundary permits only tool/protocol metadata, bounded reason codes, consent classification fields, `state_handle_sha256`, `requirement_sha256`, `binding_verified`, and duration. Raw `requestState`, `inputResponses`, content, arguments, argv, env, auth identifiers, secrets, canonical argument digests, and exact scope digests are prohibited.

A capability-missing failure remains a protocol error and should carry only the protocol-required `requiredCapabilities` in the wire error data; detailed local reason information belongs in audit metadata rather than extra protocol fields.

## Ordering and side-effect boundary

The execution order for `tools/call` is:

1. build decision runtime context;
2. evaluate auth/profile/tool policy and resolve consent requirement;
3. build and audit the decision receipt;
4. apply resource/runtime policy gate;
5. apply rate limit;
6. validate tool arguments;
7. evaluate MRTR requirement and capability support;
8. for initial round: return `input_required` with no execution side effects;
9. for retry: authenticate and consume MRTR state;
10. interpret consent response and emit safe consent audit/receipt;
11. emit `tool_call_start`;
12. enter existing Tasks/process/tool execution path.

Invalid tool arguments therefore still fail before any consent prompt, preserving SEP-1303 input-validation precedence. A consent prompt must never be used to legitimize malformed arguments.

The runtime composition also fails closed if the decision layer emits an `mrtr_requirement` but no MRTR extension is installed. A required decision may never bypass MRTR because `mrtrExtension` is absent, and an MRTR outcome of `not_required` is invalid when a requirement was supplied. Both conditions deny before `tool_call_start` with bounded internal reason codes: `mrtr_extension_required` when the required module is absent and `mrtr_required_but_not_applied` when a requirement produces `not_required`. They never fall through to Tasks or tool execution.

## Connector and runtime surface

This package changes startup-loaded runtime source and root policy/event specs, so a controlled OAuth21 supervisor restart is expected after repository validation.

It adds no MCP tool and intentionally changes no connector descriptor or input/output schema. Expected live surface remains:

- authenticated tools: `98`;
- combined fingerprint: `93721a82a339f9d6`.

Connector refresh is not expected. If deploy classification or live fingerprints show a descriptor/schema delta, stop and investigate rather than normalizing the delta into documentation.

## TDD acceptance matrix

RED -> GREEN coverage must prove at minimum:

- process tools produce deterministic `mrtr_requirement` instead of unconditional `guarded_process_execution`;
- read-only/non-consent tools remain unchanged;
- malformed catalog truth for a consent tool fails closed;
- modern request with `{}` client capabilities gets `-32021` and no state/execution;
- modern request with `elicitation: {}` supports form consent;
- modern request with `elicitation: { form: {} }` supports form consent;
- modern request with URL-only elicitation gets `-32021`;
- initial consent round creates no process job, Task, artifact, or `tool_call_start`;
- accepted `confirmed: true` retry executes exactly once;
- `confirmed: false`, decline, cancel, missing/extra/malformed content all deny execution;
- replay and expiry deny;
- changed tool, arguments, owner/client, scope, or requirement deny;
- legacy consent-required request fails closed;
- required consent fails closed if the MRTR extension is absent or returns `not_required`;
- safe consent audit contains only permitted classification metadata, `state_handle_sha256`, `requirement_sha256`, and `binding_verified`;
- raw argv/env/secrets/request state/input response content never appear in state, audit, or receipt;
- current official-client MRTR fixture remains green;
- tool count and all governed fingerprints remain unchanged.

## Deployment and closeout

After targeted GREEN:

1. syntax-check every changed JavaScript file;
2. run protocol, decision-runtime, event-catalog, privacy, process, Tasks, and MRTR targeted smokes;
3. run `git diff --check`;
4. run directory generator check and project-truth audit;
5. run the complete offline smoke suite through the durable process runner;
6. classify deployment with `deploy_decision_guard`;
7. commit the pre-deploy implementation only after the exact tree is GREEN;
8. perform the controlled supervisor restart if required;
9. verify health, MRTR consent behavior, 98-tool count, and fingerprint `93721a82a339f9d6` on the restarted runtime;
10. update policy/readiness/workflow truth and add a consent closeout record;
11. rebuild/verify the knowledge index if canonical documentation changed;
12. run the final full suite on the closeout tree;
13. commit/push closeout and verify `HEAD == origin` with a clean tree.

No live-accepted claim is permitted before controlled restart evidence exists.
