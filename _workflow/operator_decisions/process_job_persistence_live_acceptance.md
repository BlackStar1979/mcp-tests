# Process Job Persistence Live Acceptance

Status: GREEN / LIVE / ACCEPTED
Date: 2026-08-09

## Decision

Accept `PROC-1B` as the durable process lifecycle model for the authorized `tests` profile.

The server persists owner-scoped job metadata, bounded stdout/stderr, and append-only lifecycle transitions in SQLite WAL. It does not persist command arguments or environment values, and it never replays commands after restart. Nonterminal jobs left by an unclean process become `interrupted` after lease-backed, PID-aware periodic reconciliation.

## Repository evidence

- Commit under acceptance: `91aead7`.
- Original acceptance suite: `7 public + 278 authenticated`, `ok=true`.
- Official MCP client v2 OAuth21 E2E preserves one job across a child-server process restart and verifies owner isolation, controlled error envelopes, `process_list`, and `process_events`.
- Persistence smoke verifies terminal reconstruction, bounded output cursors, append-only transitions, orphan recovery, recovery audit emission, and absence of argument/environment markers in SQLite bytes.
- Tool target: `91`, with fingerprint `54ed6536bb75e46e` and tool-name hash `79c3b49ba27e604a`.

## Post-Acceptance Recovery Hardening

Independent adversarial stress later found that PID existence alone could preserve a crashed instance's job forever after PID reuse. `PROC-1B-R1` replaces that inference with a renewable `(runtime_scope, server_instance_id, PID)` lease and periodic orphan reconciliation. The regression keeps PID existence true, proves that a fresh lease protects a genuinely live overlapping instance, then proves that lease expiry produces the durable `interrupted` transition. See `process_job_pid_reuse_recovery.md`.

`PROC-1B-R2` adds owner-scoped transactional idempotency for `process_start`. The SQLite transaction creates the durable `queued` job and its unique `(runtime_scope, owner, operation, key)` mapping before the process can spawn. Equal retries return the existing job across queue exhaustion and restart; reuse with different effective command semantics fails deterministically. OAuth runtime keys use keyed HMAC, raw keys/args/env are not persisted or audited, and missing mapped jobs fail closed as store corruption. This is the execution-identity foundation for the later MCP Tasks adapter, not a parallel task store.

## Live evidence

- First deployment restart: `manual-1786291985998`.
- Recovery-proof restart: `manual-1786292134573`.
- Truth-baseline restart: `manual-1786293314947`.
- Final server start: `2026-08-09T16:35:16.355Z`.
- Health after all restarts: `status=ok`, `auth=oauth21`, `profile=internal`, `tools_count=91`.
- Live job: `731a623b-497a-4d2d-a30d-c481b8e87114`.
- Before restart: `status=ok`, `exit_code=0`, stdout `PROC1B_LIVE_RESTART_MARKER`.
- After restart: the same job returned the same status and output with `durable=true` and `recovered_after_restart=true`.
- After the final truth-baseline restart, the same historical job remained readable with the same durable recovery metadata.
- The existing OAuth connector remained callable; no relogin was required.
- Unknown job IDs return `process_job_not_found` as a controlled result instead of a transport exception.
- Live `powershell -Command` and `py -3.14` jobs completed with exit code 0; `py` reported `resolution_class=windows_python_launcher`.
- R2 deployment receipts: `manual-1786650044493` and restart-recovery proof `manual-1786650084406`.
- R2 final server start: `2026-08-13T19:41:25.994Z`, fingerprint `ec7d3af5b4ea17f5`, tools `98`.
- R2 live job `1121654d-5016-4cac-84e3-30b4d69630de` returned the same handle for an equal retry, rejected changed arguments with `process_idempotency_conflict`, then returned the same terminal output after restart with `recovered_after_restart=true`.
- R2 full offline acceptance: `7 public + 291 authenticated`, `ok=true`; self-test, matrix, workflow truth, and direct `project_truth_audit` are green.

## Connector surface acceptance

After Codex environment re-enumeration, the model-visible workbench surface contains all `91` tools. Direct `process_list` and `process_events` calls succeeded without OAuth relogin or another server restart. `process_list` rediscovered connector-owned job `b247a65e-7cea-4e83-9bb8-4cdf66ffb227`; `process_events` returned its durable append-only `queued -> running -> ok` history from server instance `2026-08-09T16:35:16.355Z`. The repository, live runtime, and current connector map are aligned.

## Rollback

Revert `91aead7` and use `node .\scripts\request-restart.js --code=42 --reason=manual`. Do not start a duplicate server on port 3008. The process-job SQLite file is additive runtime state and is not required by the previous in-memory implementation.
