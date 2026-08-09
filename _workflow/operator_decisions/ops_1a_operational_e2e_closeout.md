# OPS-1A Operational E2E Closeout

Status: GREEN / MATRIX COMPLETE / BOUNDED SOAK GREEN / EXTERNAL BOUNDARIES EXPLICIT
Date: 2026-08-09

## Scope

Close the first operational E2E package with evidence that distinguishes hermetic tests, live read-only probes, and operator-observed history. The package covers restart/recovery, reconnect/transport, cancellation/timeout, Cloudflare Tunnel, SFTP, network tools, process execution, and destructive rollback.

Declarations:

- `server_change = false`
- `workflow_change = true`
- `schema_change = false`
- `runtime_restart_required = false`
- `connector_refresh_required = false`
- `backup_required = false`
- `rollback_path = git revert of this workflow/test package`
- `restore_path = this record, the OPS-1A matrix, runner, probes, guards, and synchronized workflow documents`

## Implemented evidence system

- `_workflow/inventories/ops_1a_operational_e2e_matrix.json` is the machine-readable coverage matrix.
- `scripts/run_operational_e2e_soak.js` executes only explicitly classified cases and bounds hermetic and live repetitions independently.
- `_tests/live_cloudflare_boundary_probe.js` validates the live public health endpoint, OAuth protected-resource metadata, the GET method guard, and the unauthenticated POST challenge without credentials or mutation.
- `_tests/operational_network_manifest.json` runs the live MCP network smoke through the complete isolated harness instead of invoking a server-dependent test as if it were standalone.
- `_tests/smoke_operational_e2e_matrix.js` guards family completeness, evidence references, unresolved-gap explanations, and runner selection behavior.

## Reproduced workflow defect and correction

The first ad hoc run invoked `_tests/smoke_network.js` directly. It failed five times with `TypeError: fetch failed` because that test requires `run_all_smokes.js` to start and configure an isolated MCP server. The other 50 invocations passed. This was a harness precondition defect, not a network-tool or production-server failure.

The corrected runner assigns the network case its own one-entry manifest and invokes the full isolated harness. Missing harness preconditions can no longer be reported as server instability by this package.

## Final bounded soak

Durable workbench job: `2ed5a1f1-2695-4304-999c-17d1f7e0352e`.

- command: `node scripts/run_operational_e2e_soak.js --repetitions=5 --live-repetitions=3 --include-live-cloudflare --include-live-network`
- result: `56/56` passed, `0` failed
- hermetic: 10 cases x 5 repetitions = 50 invocations
- live Cloudflare boundary: 3/3
- live MCP network tools through isolated server and real outbound allowlisted requests: 3/3
- durable process lifecycle: `queued -> running -> ok`, output untruncated

The live Cloudflare probe consistently returned health `200`, protected-resource metadata `200`, GET `/mcp` `405`, and unauthenticated POST `/mcp` `401` with the OAuth resource-metadata challenge.

## Remaining explicit boundaries

- Reconnect evidence is current for direct connector callability and historical for the full operator-driven logout/login/UI flow. Automating credential entry or disrupting a healthy connector is not justified by this package.
- SFTP behavior has positive and negative hermetic lifecycle coverage. A live read-only probe is blocked because no local config with `host`, `username`, `privateKeyPath`, `siteRoot`, and `opsRoot` was recovered after the workstation reinstall.

These are explained external boundaries, not hidden green claims. They keep `OPS-1` at `3/4` rather than `4/4`.

## Post-Closeout Adversarial Finding

The bounded OPS-1A runner itself did not reproduce a runtime defect. Subsequent independent adversarial stress reproduced one process recovery gap: PID reuse could keep an old durable job in `running` after its server instance disappeared. `PROC-1B-R1` corrects that class with renewable instance leases, periodic reconciliation, and a regression that keeps PID existence true while the old lease expires. See `process_job_pid_reuse_recovery.md`.

## Verdict

`OPS-1A` remains complete as an evidence-classified baseline, and the only defect found by the follow-up stress has a repository-validated correction. Operational regression execution is repeatable, and every covered destructive scenario has explicit restore or rollback proof. Reopen as `OPS-1B` when a live SFTP config is available, a real reconnect incident occurs, or another bounded run reproduces a new operational defect.
