# Process Runner Async and Policy Hardening Design

Date: 2026-08-09
Status: operator-approved; architecture delegated to the agent

## Goal

Make process execution useful for long-running development work without weakening the authenticated test-profile boundary. Keep synchronous `run_process`, align every guard and contract with the operator-selected limits, and add an asynchronous process lifecycle that returns promptly and exposes bounded polling and cancellation.

## Accepted limits

- Default process timeout: `60000` ms.
- Maximum process timeout: `600000` ms.
- Default combined output budget: `250000` characters.
- Hard combined output budget: `1000000` characters.
- The same values govern runtime defaults, MCP input schemas, status output, specs, tests, and audit summaries.

The output budget applies to stdout and stderr together. Each stream retains its own cursor and truncation flag, but one stream cannot silently consume an additional full hard cap.

## Tool surface

The authenticated test surface keeps `run_process` and adds six tools:

- `process_start`: validate, enqueue, and return a job record without waiting for completion.
- `process_status`: return lifecycle and aggregate output metadata without output bodies.
- `process_output`: return cursor-based bounded stdout and stderr chunks.
- `process_cancel`: cancel a queued job or terminate a running process tree.
- `process_list`: rediscover bounded owner-scoped jobs after context or server restart.
- `process_events`: read bounded append-only lifecycle transitions for one owned job.

The surface grows from 85 to 91 authenticated tools (`13 public + 78 authorized-visible`). `process_start` and `process_cancel` are destructive, non-idempotent, filesystem-capable, and open-world. Status, output, list, and events are owner-scoped read-only views over the durable process-job registry.

## Shared execution core

Synchronous and asynchronous execution use one preparation and spawn implementation. The core owns:

1. fail-fast numeric configuration,
2. command classification and executable resolution,
3. workspace cwd resolution,
4. environment construction,
5. timeout and cancellation,
6. combined output accounting,
7. normalized terminal status.

`run_process` waits on this core. The asynchronous manager stores the same execution handle and exposes state through job tools. No second process policy is allowed.

## Command policy

`kubectl` is removed from the default allowlist. Docker remains available in the authenticated test profile.

Command families:

- `runtime`: `node`, `python`, `python3`, `py`, `bun`.
- `package`: `npm`, `npx`, `pnpm`, `yarn`, `pip`, `pip3`, `poetry`, `uv`.
- `python-check`: `pytest`, `coverage`, `unittest`, `mypy`, `pyright`, `ruff`, `black`, `flake8`, `tox`.
- `javascript-check`: `vitest`, `jest`, `mocha`, `tsx`, `tsc`, `eslint`, `prettier`.
- `shell`: `powershell`, `pwsh`, `sh`, `bash`, `zsh`, `wsl`.
- `source-control`: `git`.
- `container`: `docker`, `docker-compose`.

All families remain authenticated and destructive at the general execution-tool boundary. Family metadata controls environment inheritance and executable resolution; it does not pretend that interpreters or package managers are sandboxed.

## Executable resolution

Caller-provided environment values cannot replace executable lookup. `PATH`, `PATHEXT`, and `COMSPEC` are reserved and rejected in `args.env`.

- `node` resolves to `process.execPath`.
- Python interpreter commands first use workspace-local `.venv` or `venv`, then an active trusted parent virtual environment, then the server's inherited executable search path. Windows `py` resolves only to the trusted Windows Python Launcher, including App Execution Alias handling, and preserves launcher arguments such as `-3.14`.
- Python module tools use the selected interpreter with `-m` where the command has a stable module form, including `pip`, `pytest`, `coverage`, `unittest`, `mypy`, `black`, `flake8`, and `tox`.
- JavaScript check tools resolve a workspace-local package binary before any trusted parent PATH fallback.
- Docker and source-control commands resolve only from the server's inherited PATH, never caller overrides.
- Missing commands and domain-policy denials return a deterministic structured process error rather than escaping as transport exceptions.

The resolver returns both the operator-facing logical command and the pinned spawn executable/prefix arguments. Results and audits expose only the logical command and a bounded resolution class, not secret-bearing paths.

## Environment policy

Base inheritance is limited to OS identity, locale, home, temp, and the trusted parent executable path. Caller env names are allowlisted and values are bounded.

- Package and container families may inherit `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY` without logging values.
- Docker may inherit `DOCKER_HOST`; its value is never returned or audited.
- Python may inherit `VIRTUAL_ENV` and `CONDA_PREFIX` only for resolver guidance.
- `KUBECONFIG`, `PYTHONPATH`, `NODE_PATH`, `PYTEST_ADDOPTS`, and internal `MCP_PROCESS_*` settings are not passed to children by default.
- Caller env cannot set executable-loader or shell startup controls such as `NODE_OPTIONS`, `PYTHONHOME`, `PYTHONSTARTUP`, `BASH_ENV`, `ENV`, `PATH`, `PATHEXT`, or `COMSPEC`.

## Asynchronous lifecycle

The default manager allows two running jobs, eight queued jobs, and 32 retained terminal records. Terminal records expire after 30 minutes. These limits are fail-fast configurable within hard bounds. Every job is bound to a one-way hash of the authenticated OAuth client ID; a different client receives the same not-found result as an unknown job and cannot read or cancel it.

Job states are `queued`, `running`, `ok`, `nonzero_exit`, `timeout`, `spawn_error`, `cancelled`, and `interrupted`. Timeout begins when the child starts, not while queued.

`process_output` accepts independent stdout/stderr offsets and a combined per-call chunk limit capped at 65536 characters. It returns next offsets and EOF flags. Polling therefore stays transport-bounded even when the job's retained output reaches one million characters.

Queued cancellation removes the job without spawning. Running cancellation immediately terminates the process tree because killing only the parent can orphan descendants. Windows waits for `taskkill /T /F` through a fixed system executable; POSIX sends `SIGKILL` to the detached process group with a direct-child fallback. The job completion promise does not resolve until tree termination completes, the manager drains output until close, and termination errors remain explicit.

SQLite in WAL mode is the source of truth for owner hashes, safe command metadata, bounded output, timestamps, terminal results, and append-only transitions. Arguments and environment values are never persisted. A controlled restart cancels active jobs before exit; an unclean restart marks orphaned `queued` or `running` rows as terminal `interrupted`. Status, output, discovery, and event history survive restart. Commands are never replayed automatically, and no detached process is created.

## Audit and confidentiality

The manager emits bounded lifecycle events: queued, started, completed, timed out, cancelled, spawn failed, output read, and pruned. Events include job ID, logical command, status, durations, counts, truncation flags, and closed cancellation reason codes. They exclude raw cancellation text, raw output, env values, executable paths, OAuth client IDs, and command arguments.

Tool-call audit remains active through the existing runtime. The optional-tool execution context gains an internal audit callback so terminal events can be recorded after `process_start` returns.

## Testing

1. Prove the four configured limits are identical across runtime, schema, status, and specs.
2. Prove invalid, non-finite, inverted, and out-of-range environment configuration fails before side effects.
3. Prove caller `PATH`, `PATHEXT`, `COMSPEC`, loader controls, and Kubernetes configuration are rejected.
4. Prove Node is pinned and workspace `.venv`/`node_modules` resolution wins where applicable.
5. Prove Docker remains allowed and `kubectl` is denied.
6. Prove combined stdout/stderr never exceeds the configured output budget.
7. Prove queueing, concurrency, cursor output, completion, timeout, process-tree cancellation, retention, owner isolation, and unknown-job behavior.
8. Prove audits contain lifecycle metadata without raw output, args, env values, raw cancellation reasons, OAuth client IDs, or resolved paths.
9. Run targeted smokes, full offline suite, self-test, schema/spec guards, and live OAuth probes on an isolated non-production port.
10. Restart production port 3008 only with `node .\scripts\request-restart.js --code=42 --reason=manual`, then verify health, 91-tool surface, OAuth continuity, persisted-job recovery, and direct calls.

## Non-goals

- No Kubernetes execution in this package.
- No detached execution or automatic command replay across server restart.
- No claim that a synchronous ten-minute tool call is transport-safe.
- No shell-output streaming protocol extension; asynchronous bounded polling is the supported long-running path.
- No change to public port 3009 tools.
