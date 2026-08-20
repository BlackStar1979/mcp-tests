# Historical POL-1A process-MRTR live acceptance

Status: HISTORICAL / MRTR EVIDENCE RETAINED / SUPERSEDED AS DEFAULT PROCESS POLICY
Date: 2026-08-20
Package: `POL-1A-CONSENT` historical process-MRTR activation

## Decision

Retain this record as the live acceptance evidence for the earlier selected-process MRTR policy loaded at `server_start_id = 2026-08-20T03:02:40.571Z`. At that checkpoint, `run_process`, `process_start`, and `process_cancel` required server-verifiable MCP `2026-07-28` MRTR form consent and the live probe proved that implementation sound.

That blanket process-consent classification is now superseded as the default authorization policy by the capability-adaptive authorization reconciliation. Current authorization truth comes from `SERVER_CONSENT_POLICY_SPEC.json` and the active workflow documents: internal OAuth `mcp:tools` is standing authorization for bounded tools, while fresh MRTR consent is selected only by explicit central `consent_mode`. This historical record remains authoritative for MRTR binding, replay, semantic-verification, and privacy evidence; it must not be used as current process-authorization truth.

The historical acceptance did not generalize consent to scope elevation, new-origin egress, secret/token access, or the existing CBM deletion confirmation path.

## Repository evidence

- Repository implementation pre-deploy commit: `c865b3b`.
- Live source HEAD at accepted activation: `4321b8f`.
- Pre-deploy full offline suite: `7 public + 311 authenticated`, GREEN, durable job `5a6a5d05-f894-435d-864e-2cae85007019`.
- Form-capable live-probe harness full offline suite: `7 + 311`, GREEN, durable job `fa3f37f4-0885-4af3-bd99-76c4ced6f294`.
- Live-probe harness/OAuth corrections were isolated to workflow/test helpers; they did not change MCP tool schemas, descriptors, or runtime consent semantics.

## Controlled activation

- Restart durable job: `a778e5a0-10f6-401d-a7fa-21f84d0a8486`.
- Restart request id: `manual-1787194958781`.
- Restart reason: `pol-1a-consent-activation-final-live-probe-v2`.
- Accepted live `server_start_id`: `2026-08-20T03:02:40.571Z`.
- Live profile: `tests/internal` (`healthz` profile `internal`).
- Tool count: `98`.
- Combined fingerprint: `93721a82a339f9d6`.
- Connector refresh: not required and not performed.

## Live semantic proof

A repository-native form-capable probe ran outside the MCP process tree so supervisor restart could not cancel it. It used a fresh OAuth client/token and did not read durable OAuth token state.

The accepted live sequence proved:

1. Missing form elicitation capability returns JSON-RPC `-32021` and performs no execution.
2. A client declaring `elicitation.form` receives `input_required` and performs no execution before consent.
3. `decline` performs no execution.
4. Malformed accepted content with extra fields performs no execution.
5. Exact `human_approval.action = accept` plus exact content `{confirmed:true}` executes exactly once.
6. Replaying consumed MRTR state is rejected.
7. `tool_call_consent_accepted` precedes `tool_call_start` for the accepted retry.
8. The safe consent receipt reports verified binding without exposing canonical argument/scope digests.
9. The serialized audit contains no raw request state, input response content, process arguments, credential material, or private binding digests.
10. `tools/list` remains `98` with fingerprint `93721a82a339f9d6`.

Sanitized machine result: `_control/pol-1a-consent-live-probe-result.json` reported `GREEN / LIVE HUMAN CONSENT SEMANTICS ACCEPTED`.

## Historical client capability boundary

At the time of this acceptance, the ChatGPT TESTS_MCP connector did not advertise `elicitation.form` for direct process calls. Under the then-active blanket process-MRTR policy, the server therefore returned controlled `-32021` responses and the connector rendered them as opaque `UNKNOWN / ExceptionGroup` failures.

That behavior is retained here only as historical evidence. It exposed the operational defect that motivated the later capability-adaptive authorization repair; ordinary bounded process calls are no longer intended to depend on `elicitation.form`. The form-capable repository-native probe remains the acceptance authority for the generic MRTR path itself.

## Policy coverage consequence

- `consent_policy` advances from `critical_specified` to `implemented`.
- Live required-policy coverage advances from `14/24` to `15/24`.
- `POL-1` remains `2/4`; the target policy set is not complete.
- `prompt_content_policy` remains `critical_specified` and becomes the next primary package.
- Scope elevation, new-origin egress, and secret/token access remain separate fail-closed or unimplemented consent classes and are not claimed as generalized consent support.

## Historical operational posture

At the recorded `03:02:40.571Z` acceptance checkpoint, `runtime_restart_required_now = false`, `connector_refresh_required_now = false`, and the governed connector surface remained unchanged. Those fields describe that historical activation only.

The superseding capability-adaptive authorization reconciliation has its own deploy truth and live acceptance. Do not infer its current restart status or ordinary process-call behavior from this record.
