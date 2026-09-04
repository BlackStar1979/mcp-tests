# POL-1B policy reconciliation live closeout

Status: GREEN / LIVE ACCEPTED / CONNECTOR UNCHANGED
Date: 2026-08-22
Package: `POL-1B`

## Decision

`POL-1B` closes the four formerly `partial` non-critical policy rows against the accepted current target:

- `network_policy` is runtime-enforced. Allowlisted response bodies are consumed as streams, only the configured prefix is retained in memory/output, full response byte count and SHA-256 semantics are preserved, and body reads remain timeout-bounded.
- `plugin_visibility_policy` is implemented for the accepted static/pull-only tool-surface target. Live dynamic import, runtime hotplug mutation, and `notifications/tools/list_changed` push are historical non-targets; freshness remains `pull_only_tools_list_ttl0_private`.
- `runtime_topology` is implemented for OAuth21 `3008`: the repository supervisor is the restart authority and controlled exit codes own restart semantics. The older missing-authority/pending-migration wording was stale specification debt.
- `rate_limit_quota_policy` is runtime-enforced with SHA-256-derived OAuth client partitions, dedicated network/process per-tool ceilings, the existing batch-item/fail-closed modern-batch boundary, and persistent restart cooldown state. Raw client identifiers are not embedded in limiter keys or receipts.

The implementation preserves modular ownership. Network mechanics remain in `src/util/network_policy.js`; quota classification and partitioning remain in `src/runtime/rate_limit_policy.js`; `src/runtime/tools_call_handler.js` only supplies the already-authenticated client identity to the policy owner.

## Repository validation

Source/spec commit:

- `6fc195d4ef5e86dceeb89a88fc82c83048d368c4` — `fix(policy): reconcile POL-1B runtime policies`
- pushed to `origin/feature/cbm-cli-bridge-mvp` before activation
- remote ref independently verified at the same full hash

Binding pre-live suite:

- durable job `85bc531d-fa76-49ae-abdb-ff1aa155b8f6`
- `ok=true`
- version `0.40.0`
- public `7`
- authenticated `313`
- exit `0`
- stderr empty

Targeted RED-to-GREEN coverage includes:

- `_tests/smoke_network_policy_spec.js`
- `_tests/smoke_plugin_visibility_policy_spec.js`
- `_tests/smoke_runtime_topology_authority.js`
- `_tests/smoke_rate_limit_policy.js`
- `_tests/smoke_policy_coverage_matrix.js`
- `_tests/smoke_runtime_config_spec.js`

The network guard additionally prevents bounded-output truncation from changing full-response SHA-256 semantics. The quota guard proves distinct OAuth client partitions, absence of raw client identifiers in the derived key, and dedicated network/process ceilings.

## Controlled activation

Controlled restart request:

- request id: `manual-1787375589175`
- exit code: `42`
- reason: `pol-1b-policy-reconciliation-live-acceptance`
- requested at: `2026-08-22T05:13:09.175Z`

Supervisor-loaded runtime:

- `server_start_id = 2026-08-22T05:13:10.662Z`
- profile: `tests` / OAuth21 internal
- tool count: `98`
- tool names hash: `b6526b6d88ccbee3`
- input schema fingerprint: `440c0f660abff822`
- output schema fingerprint: `8292895f0216967c`
- descriptor fingerprint: `82ffaaa3adb6e7db`
- combined fingerprint: `93721a82a339f9d6`

The current and previous governed surfaces are identical. Connector refresh and OAuth reauthorization are therefore not required.

## Live semantic proof

The restarted OAuth21 runtime fetched the exact published `src/util/network_policy.js` from commit `6fc195d4ef5e86dceeb89a88fc82c83048d368c4` twice through `net_fetch_github_raw`:

1. `max_bytes = 1024`
   - HTTP `200`
   - full bytes observed: `9968`
   - `truncated = true`
   - SHA-256: `90775249b4f10997f51921481154cf25271511df37785c0b3168fca1a32233f5`
2. `max_bytes = 2097152`
   - HTTP `200`
   - full bytes observed: `9968`
   - `truncated = false`
   - SHA-256: `90775249b4f10997f51921481154cf25271511df37785c0b3168fca1a32233f5`

The truncated and full live reads therefore preserve identical full-body byte count and SHA-256 while bounding returned text. This is the deployed network-policy behavior introduced by `POL-1B`.

Quota client partitioning is intentionally not proven by forcing a live rate-limit denial. Its mechanism was exercised deterministically before activation by the owner-level RED-to-GREEN smoke, and the restarted runtime is proven to have loaded the same published source commit. Generating artificial production throttling would add operational risk without increasing meaningful confidence.

## Host incident and recovery

Approximately two minutes after the controlled Node restart had completed and live MCP calls were still succeeding, the Windows host reset unexpectedly. This was investigated before closing the package.

Windows System evidence identifies the reset as a host hardware event rather than an MCP-controlled or Windows-requested restart:

- `Kernel-Power` event `41` records an unexpected shutdown with `BugcheckCode = 0`, no long power-button press, and no orderly restart reason.
- no relevant Windows event `1074` records a process or user requesting an operating-system restart.
- `WHEA-Logger` event `18` reports a processor-core `Machine Check Exception`, `Cache Hierarchy Error`, APIC id `2`.
- the retained System log contains multiple earlier WHEA `18` Cache Hierarchy Errors across preceding weeks, predominantly APIC `2` and occasionally other APIC ids, so the hardware condition predates `POL-1B` activation.
- TEST MCP audit remains coherent through `2026-08-22T05:15:05.967Z`; the last MCP reads completed successfully before the host reset.

The operator restored the same published source without another MCP-controlled restart. The recovered runtime reports:

- current `server_start_id = 2026-08-22T05:49:02.168Z`
- local `/healthz`: `status = ok`, OAuth21/internal
- tool count `98`
- combined fingerprint `93721a82a339f9d6`
- unchanged tool-name/input/output/descriptor fingerprints

The bounded/full `net_fetch_github_raw` proof was repeated on this recovered runtime and again returned full bytes `9968` with SHA-256 `90775249b4f10997f51921481154cf25271511df37785c0b3168fca1a32233f5`, with `truncated=true` at `1024` bytes and `truncated=false` at the full limit. No second controlled runtime restart was performed for this closeout.



- policy matrix: `20/24` implemented
- critical policies: `6/6` implemented
- remaining rows outside `implemented`: four `specified_only` non-critical policies
- `POL-1` maturity remains `3/4` until those four rows are reconciled
- `restart_required_now = false`
- `connector_refresh_required_now = false`
- `next_primary = pol-1c`
- `next_secondary = comp-1a` (event-gated; not executable without newer real Codex client-entry evidence)

`POL-1C` now owns reconciliation of `memory_policy`, `database_policy`, `supply_chain_policy`, and `incident_response_policy`. `COMP-1A` remains an independent event-gated lane.

## Post-rebuild recovery verification

On 2026-09-04, the same published source was started under the repository supervisor after the workstation rebuild. The runtime reported `server_start_id = 2026-09-04T15:21:41.190Z`, local health `ok`, `98` tools, and unchanged fingerprint `93721a82a339f9d6`. OAuth SQLite startup maintenance completed with `no_candidates`; no state-store corruption or policy-runtime regression was observed. Current Codex connector callability remains deliberately unclaimed until post-rebuild OAuth reauthentication is completed.
