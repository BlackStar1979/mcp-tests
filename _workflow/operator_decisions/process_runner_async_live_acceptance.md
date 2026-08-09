# Async Process Runner Live Acceptance

Status: accepted and live
Date: 2026-08-09
Package: `PROC-1A`

## Decision

Keep one shared guarded execution core for synchronous and asynchronous process tools. Preserve `run_process` for bounded compatibility and expose `process_start`, `process_status`, `process_output`, and `process_cancel` for long-running work. Reconsider tighter synchronous limits only after operational use confirms that the asynchronous path covers long commands reliably.

## Accepted Contract

- Default timeout: `60000 ms`; hard timeout: `600000 ms`.
- Default combined stdout/stderr budget: `250000` characters; hard budget: `1000000` characters.
- Async registry: maximum `2` running, `8` queued, `32` retained terminal jobs, `30` minute retention, and `65536` characters per cursor read.
- Jobs are in-memory, bound to the authenticated OAuth client, and cancelled before controlled restart.
- Node resolves to `process.execPath`; Python and JavaScript tooling prefer workspace-local environments; caller environment overrides cannot replace executable lookup or loader policy.
- Docker remains available in the internal tests profile. `kubectl` is denied. Raw shell execution remains constrained by the existing PowerShell/shell policy.
- The central runtime policy explicitly permits only the guarded process tools after profile and authentication checks; destructive annotations remain truthful.

## Verification

- Targeted runner, config, job-manager, tool, policy, restart, schema, registry, process-tree, timeout, cancellation, and audit tests passed.
- Official `@modelcontextprotocol/client@2.0.0` OAuth21 E2E passed on a hermetic random-port runtime. It covered DCR, PKCE, operator authorization, modern and legacy protocol entry, process restart, SQLite client/token recovery, refresh-token rotation, async start/status/output/cancel, and audit redaction.
- Full offline suite passed: `ok=true`, version `0.40.0`, `7` public and `277` authenticated scripts.
- `server.js --self-test`, JSON parsing, `git diff --check`, workflow navigation guards, and `matrix_check` passed before live load.

## Security Boundary

This is an authenticated internal developer runner, not an operating-system sandbox. Allowlisted shells, package executors, and Docker can intentionally perform actions available to the server account, including network and container operations. The enforced boundary is therefore layered: internal OAuth/profile access, truthful destructive/open-world annotations, explicit guarded-policy admission, bare command names, pinned or trusted executable resolution, workspace-bounded working directory, restricted caller environment, bounded time/output/concurrency, client-owned jobs, process-tree termination, and redacted audit events. The process tools must not be moved to the public profile without a separate sandbox architecture and threat review.

## Live Evidence

- Final controlled restart request: `manual-1786285267764` through `scripts/request-restart.js` with code `42`.
- Live server start: `2026-08-09T14:21:09.406Z`; PID `27060`; `/healthz` reports OAuth21/internal and `89` tools.
- The existing Codex `workbench` connector remained authorized after restart.
- Direct live `workbench.run_process` calls returned Node `26.5.1`, npm/npx `11.17.0`, pip `26.2` on Python `3.14`, and Docker daemon `29.6.2`.

## Remaining Surface Step

The already-open Codex model task retains its immutable `85`-tool startup map and therefore cannot name the four newly added async tools yet. This is a client re-enumeration boundary, not a server or OAuth failure. A Codex environment/task restart is required only to call those four names from this model surface; no OAuth logout/login is indicated.

## Next Package

Resume `OPS-1A`, the operational E2E coverage matrix. Treat process execution as accepted infrastructure and reopen `PROC-1A` only on a reproduced runner, isolation, cancellation, output, restart, policy, or live connector regression.
