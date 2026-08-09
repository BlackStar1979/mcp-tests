# Process Job PID-Reuse Recovery

Status: GREEN / REPOSITORY VALIDATED / LIVE ACCEPTED
Date: 2026-08-09
Package: `PROC-1B-R1`

## Finding

Independent adversarial stress kept the async runner healthy overall (`POST_STRESS_OK`) but reproduced one durable recovery defect. Startup reconciliation treated `kill(pid, 0)` as sufficient proof that an old `queued` or `running` job still belonged to its recorded server instance. PID reuse by an unrelated live process could therefore leave the old durable job in `running` forever with no local execution handle.

Shared task: `38333ada-3007-4c45-8ddc-1d64578fce9f`.

## Decision

Do not infer process ownership from PID existence alone. Persist one renewable lease per `(runtime_scope, server_instance_id)` with the owning PID and last-update timestamp. Preserve an old active job only while all three facts agree: instance id, PID, and a fresh lease whose process still exists.

The current manager refreshes its lease every `5000 ms`, treats a lease older than `15000 ms` as stale, and reruns orphan reconciliation on every heartbeat. Recovery rechecks the lease inside the same `BEGIN IMMEDIATE` transaction that writes the terminal `interrupted` transition. This closes the startup-only blind spot while allowing a genuinely overlapping live instance to keep managing its own job.

Graceful restart semantics are unchanged: controlled shutdown cancels active jobs before close, releases the current lease, never replays commands, and preserves terminal output/history.

## Repository Evidence

- `_tests/smoke_process_job_persistence.js` proves a fresh matching lease preserves an old active job, then advances beyond the lease TTL while PID existence remains true and verifies automatic `running -> interrupted` recovery.
- The recovery audit still emits `process_job_recovered_interrupted` with `reason_code=unclean_restart`.
- Repeated persistence stress passed two independent `25/25` iteration runs.
- The complete hermetic OPS-1A matrix passed `100/100` invocations after the correction.
- Full offline suite passed: `7` public and `279` authenticated scripts.
- `git diff --check` and Node syntax checks passed for the store, manager, and persistence smoke.

## Live Evidence

- Controlled restarts: `manual-1786298815144` and `manual-1786298950491`.
- Current live instance: `server_start_id = 2026-08-09T18:09:11.902Z`, PID `23676`, OAuth21/internal, `91` tools.
- Live job `6faee6e9-97a5-4013-bc8e-e8e8ab081d7a` completed with output `PROC1B_R1_LIVE_OK` before the second restart and retained `status=ok`, output, and append-only events afterward with `recovered_after_restart=true`.
- The same Codex connector remained callable without OAuth relogin.
- Read-only SQLite inspection found exactly one lease, owned by the current server instance and PID.
- The post-restart audit contains no `process_job_instance_lease_failed` event.

## Rollback

Revert the lease/store/manager/test package and use `node .\scripts\request-restart.js --code=42 --reason=manual`. The additive `process_job_instances` SQLite table is backward-compatible and can remain on disk after rollback.
