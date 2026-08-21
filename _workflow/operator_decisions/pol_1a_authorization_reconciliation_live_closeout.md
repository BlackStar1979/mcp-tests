# POL-1A capability-adaptive authorization live closeout

Status: GREEN / LIVE ACCEPTED / CONNECTOR UNCHANGED
Date: 2026-08-20
Package: `POL-1A-CONSENT` authorization reconciliation

## Decision

Accept capability-adaptive operator authorization as the live OAuth21/internal policy. Internal OAuth `mcp:tools` is standing authorization for bounded authorized tools. Fresh human consent is selected only by the central `consent_mode` authority; it is not inferred from `destructiveHint`, `tool_policy.destructive`, or process-tool membership.

The accepted production defaults are:

- `run_process`, `process_start`, and `process_cancel`: bounded authorized operations with `consent_mode = none`;
- `cbm_delete_project`: retained tool-owned one-time confirmation flow;
- `mrtr_human_approval`: retained generic MRTR fresh-consent mode for tools/classes that explicitly select it.

Scope elevation, new-origin egress, and secret/token access remain separate fail-closed or not-yet-normalized authorization/consent classes. This closeout does not claim generalized consent support for them.

## Repository validation

- Live source commit: `cc75a66a82b3ac49a65f5fa1ad9986c3b03612f2` (`fix(policy): make operator authorization capability-adaptive`).
- Commit was pushed to `origin/feature/cbm-cli-bridge-mvp` before activation.
- Final pre-live offline suite: `7 public + 312 authenticated`, GREEN, exit `0`.
- Targeted authorization, MRTR, MCP Tasks, W3C trace, workflow-current-truth, policy coverage, directory generation, and syntax guards were GREEN.
- Knowledge index was rebuilt fresh before activation.

## Controlled activation

- Supervisor restart request: `manual-1787246667424`.
- Restart reason: `capability-adaptive-operator-authorization-live-acceptance`.
- Accepted live `server_start_id`: `2026-08-20T17:24:29.112Z`.
- A subsequent supervisor restart produced current `server_start_id = 2026-08-20T17:34:29.129Z`; it retained the same source, 98-tool surface, and fingerprint, and current-session process/file probes remained callable.
- Live OAuth profile: `internal`.
- Tool count: `98`.
- Combined fingerprint: `93721a82a339f9d6`.
- Tool names/input/output/descriptor fingerprints remained unchanged.
- Connector refresh: not required and not performed.

## Direct ChatGPT connector proof

The same ChatGPT connector that previously surfaced server-side process MRTR rejection as `UNKNOWN / ExceptionGroup` was used after the controlled restart without advertising `elicitation.form`.

Live proof established:

1. `run_process` executes normally under standing OAuth authorization.
2. `process_start` creates a durable job without MRTR; job `6da9b8cb-054d-41fa-aa31-42851528d6b9` completed `ok` with exit `0` and expected bounded stdout.
3. `write_file` created a bounded workspace probe, the content was read back successfully, and the probe was then soft-deleted.
4. The corresponding audit decisions were `allow` with reason `explicit_policy_allow`; no `human_consent_required` or `tool_call_mrtr_denied` event governed these normal calls.
5. An unapproved `cmd` process request still failed with `process_command_not_allowed`, proving that standing authorization does not bypass the runner command allowlist.
6. The live runtime remained `98` tools with combined fingerprint `93721a82a339f9d6`.

## MRTR compatibility boundary

The earlier form-capable process-MRTR acceptance at `server_start_id = 2026-08-20T03:02:40.571Z` remains authoritative historical evidence that the generic MRTR path correctly enforces form capability, strict human response semantics, exact-call binding, one-time state consumption, replay rejection, and audit privacy.

That earlier acceptance is superseded only as the default authorization policy for routine bounded process calls. MRTR remains available and regression-covered when central policy explicitly selects `consent_mode = mrtr_human_approval`.

## Operational outcome

- `consent_policy` remains `implemented`; capability-adaptive semantics are now live accepted.
- Required-policy coverage remains `15/24`.
- `runtime_restart_required_now = false` for this package.
- `connector_refresh_required_now = false`.
- `POL-1A-PROMPT` is the active primary package and `POL-1B` remains secondary.
- Preserve central `authorization_class` / `consent_mode` ownership; do not restore hardcoded process-consent lists or blanket authorization decisions derived from destructive metadata.
