# Process Job Persistence Live Acceptance

Status: GREEN / LIVE / ACCEPTED
Date: 2026-08-09

## Decision

Accept `PROC-1B` as the durable process lifecycle model for the authorized `tests` profile.

The server persists owner-scoped job metadata, bounded stdout/stderr, and append-only lifecycle transitions in SQLite WAL. It does not persist command arguments or environment values, and it never replays commands after restart. Nonterminal jobs left by an unclean process become `interrupted` after PID-aware reconciliation.

## Repository evidence

- Commit under acceptance: `91aead7`.
- Full offline suite: `7 public + 278 authenticated`, `ok=true`.
- Official MCP client v2 OAuth21 E2E preserves one job across a child-server process restart and verifies owner isolation, controlled error envelopes, `process_list`, and `process_events`.
- Persistence smoke verifies terminal reconstruction, bounded output cursors, append-only transitions, orphan recovery, recovery audit emission, and absence of argument/environment markers in SQLite bytes.
- Tool target: `91`, with fingerprint `54ed6536bb75e46e` and tool-name hash `79c3b49ba27e604a`.

## Live evidence

- First deployment restart: `manual-1786291985998`.
- Recovery-proof restart: `manual-1786292134573`.
- Final server start: `2026-08-09T16:15:36.332Z`.
- Health after both restarts: `status=ok`, `auth=oauth21`, `profile=internal`, `tools_count=91`.
- Live job: `731a623b-497a-4d2d-a30d-c481b8e87114`.
- Before restart: `status=ok`, `exit_code=0`, stdout `PROC1B_LIVE_RESTART_MARKER`.
- After restart: the same job returned the same status and output with `durable=true` and `recovered_after_restart=true`.
- The existing OAuth connector remained callable; no relogin was required.
- Unknown job IDs return `process_job_not_found` as a controlled result instead of a transport exception.
- Live `powershell -Command` and `py -3.14` jobs completed with exit code 0; `py` reported `resolution_class=windows_python_launcher`.

## Remaining boundary

The already-open Codex task retains its 89-tool startup map. The live server has 91 tools, but direct model-visible calls to the newly added `process_list` and `process_events` names require client re-enumeration in a fresh task. This is a surface freshness boundary, not a server, persistence, or OAuth failure.

## Rollback

Revert `91aead7` and use `node .\scripts\request-restart.js --code=42 --reason=manual`. Do not start a duplicate server on port 3008. The process-job SQLite file is additive runtime state and is not required by the previous in-memory implementation.
