# `run_process` synchronous timeout ceiling: 600000 → 90000

Date: 2026-08-10. Author: Claude (consumer of the workbench, not its implementer).
Scope: repository contract only. No change to the process runner, the job manager, the
allowlist, the environment policy, or any asynchronous behaviour.

## Why this exists

A consumer (GPT, working on `papers-memory-mcp`) spent hours diagnosing what looked like a
broken MCP server. The symptom it reported:

```text
ToolError: UNKNOWN
ExceptionGroup: unhandled errors in a TaskGroup (1 sub-exception)
```

It concluded "defect in the TaskGroup layer of TESTS_MCP", routed around the workbench, and
fell back to another connector with a hard 120 s cap — which then also timed out. The server
was healthy the entire time.

## Measured, not inferred

Same server, same command family, same spawn path:

| call | duration | result |
|---|---|---|
| `run_process` (sync) | 122 s | OK (ChatGPT connector) |
| `run_process` (sync) | 130 s | transport died |
| `run_process` (sync) | 155 s | transport died |
| `run_process` (sync) | 200 s | transport died |
| **`process_start` (async)** | **240.1 s** | **`exit_code 0`, `status ok`** |

The asynchronous job ran to completion **while three synchronous calls were dying**. That is
the decisive control: it isolates the failure to the synchronous request path, not the runner.

`run_process` holds the MCP request open for the whole job, so the job is bounded by the
**client's** per-request timeout. Different clients report it differently — the
`ExceptionGroup: unhandled errors in a TaskGroup` above is one MCP client's session teardown;
another client says `the connector's server isn't responding`. Neither message names its own
cause, which is why the diagnosis went to the server.

## The actual defect: a promise the transport cannot keep

`run_process` and `process_start` **shared one input schema**, so the synchronous tool
advertised the asynchronous tool's `timeout_ms` maximum of `600000`. The server cannot deliver
ten minutes through any connector.

This survived review because the number was correct — for the *other* tool. One schema, two
different contracts.

The consumer behaved reasonably given what the tool said about itself. **A ceiling the
transport cannot hold is worse than a lower one, because the failure it produces is opaque.**

## Change

- new `SYNC_RUN_PROCESS_INPUT_SCHEMA`: identical to the shared schema except
  `timeout_ms.maximum = SYNC_TIMEOUT_CEILING_MS = 90000`;
- `process_start` keeps the full `600000` ceiling, unchanged;
- `run_process` description now states the real limit and **routes** long jobs to
  `process_start` — the consumer had those six tools available the whole time and never called
  one, so stating a limit without naming the alternative would not have been enough.

`90000` sits below the lowest observed failure (130 s) *and* below the lowest observed success
(122 s), with margin for slower clients. Raising it is not a tuning knob: anything the
transport cannot hold belongs in `process_start`.

## Live verification, after `node scripts/request-restart.js --code=42 --reason=manual`

```text
server_start_id                 2026-08-10T16:14:44.924Z   (1.5 s after the request)
run_process timeout_ms=95000    rejected: invalid tool arguments
run_process timeout_ms=90000    accepted, exit_code 0
```

## Surface impact — exactly three fingerprints, and only three

```text
tool_count                 91                 unchanged
tool_names_hash            79c3b49ba27e604a   unchanged
output_schema_fingerprint  9f6c18c944887291   unchanged
input_schema_fingerprint   c3ad0789 -> a65ee3405cdcd021
descriptor_fingerprint     317ea27d -> d01d901db3b5c03a
combined_fingerprint       54ed6536 -> 4500b64e83217d3e
```

No tool added or removed. `connector_refresh_required_now` stays `false`: what that flag
governs — enumeration and tool names — did not move. A client holding a cached `tools/list`
still sees the old *description* until it re-maps, so consumers should reconnect to get the
routing hint; the *protection* (rejection above 90 s) is server-side and already live.

## Guard

`_tests/smoke_sync_timeout_ceiling.js`, registered in `run_all_smoke_scripts.json`. It fails if
the two schemas are collapsed back into one, if the sync ceiling rises above the lowest known
client request timeout, if any field other than `timeout_ms` drifts between the two schemas, or
if the description stops naming `process_start`. Verified by seeding the original defect: it
reports `600000 !== 90000`.

## Note on how this was found

The first hypotheses were output volume and truncation. Both were tested and both were wrong —
200 KB passed and truncation to a 2000-char cap was clean. Duration was initially *excluded*
because a 122 s test had succeeded; that exclusion was the error. The 122 s success was
compared against failures whose duration was never measured.

## Duplication found while fixing this

Updating three fingerprints required edits in a dozen places, because five guards restated the
baseline literals instead of reading `src/truth/project_truth_audit.js`. Those five now import
`EXPECTED`. The literal remains in exactly one module — the one that computes the surface from
descriptors and compares it, which is the only test where restating it would be circular.

`connector_refresh_required_now` is asserted in **24** places. That was left alone: a value
duplicated 24 times is being treated as an invariant, and threading a transient through it
would have meant fighting the design rather than following it.
