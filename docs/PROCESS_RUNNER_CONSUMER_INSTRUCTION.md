# TESTS MCP workbench — process runner instruction (consumers)

Revision 2026-08-10. Supersedes the previous instruction, whose stated limits were wrong for
the synchronous tool. Every number here was read from the running server, not from a spec.

---

## Runtime status

- workbench exposes **91** tools;
- `run_process` (synchronous) plus `process_start`, `process_status`, `process_output`,
  `process_cancel`, `process_list`, `process_events` (asynchronous) are callable;
- jobs, bounded output and lifecycle events persist in SQLite WAL and survive restart;
- jobs are isolated by OAuth client identity.

---

## 1. The one decision that decides everything else

**Can this command exceed 90 seconds? Then it is not a `run_process` job.**

```text
job may take  < 90 s   ->  run_process        (one call, output returned inline)
job may take  > 90 s   ->  process_start      (durable job, poll for result)
job length UNKNOWN     ->  process_start      (unknown is not short)
```

A full test suite, a multi-node pytest run, a build, an install or a container operation is
**always** `process_start`. Do not slice a long run into chunks to fit under a synchronous
limit — that is working around the wrong tool.

---

## 2. Why the synchronous tool is capped at 90 s — read this once

The path to this server crosses Cloudflare's proxy, whose documented **Proxy Read Timeout is
125 seconds**.

`run_process` **buffers** the child's output and returns it only when the process exits, so
**no response bytes reach Cloudflare while the job runs**. A process printing to stdout every
10 seconds is, from the proxy's point of view, exactly as idle as `sleep`. Measured: a 200-second job that
printed continuously died the same way a pure sleep did.

The asynchronous tools are immune for a structural reason, not by luck: `process_start`,
`process_status` and `process_output` are all short calls, so no single request is ever idle.
A 240-second job completes cleanly through them.

**Do not ask for a higher synchronous ceiling.** 90 000 ms leaves 35 seconds of margin below
the documented proxy read timeout.

---

## 3. Failure modes, and what each one actually means

| what you see | what it means | what to do |
|---|---|---|
| `Invalid tool arguments` on `run_process` | you asked for `timeout_ms > 90000` | use `process_start` |
| `ExceptionGroup: unhandled errors in a TaskGroup` | the MCP request transport closed, not the child process | the synchronous response exceeded Cloudflare's read window — use `process_start` |
| `the connector's server isn't responding` | same cause, different client's wording | as above |
| `status: timeout` in the job record | the **process** hit its `timeout_ms` | a real result: the command was too slow |
| `ModuleNotFoundError` for a project package | wrong interpreter, not a tool defect | see §7 |
| `process_job_not_found` | job belongs to a different OAuth client | correct behaviour, not an error |

**The first three are not server defects and not test failures.** None of those messages names
its own cause, which is exactly why they get misread. If a diagnosis is heading toward "the MCP
server is broken", first check whether the call was synchronous and long.

---

## 4. Required workflow

1. At session start: `process_list({"limit": 20})` — recover anything already running.
2. Start work:
   ```json
   process_start({
     "command": "uv",
     "args": ["run", "--locked", "pytest", "-q", "tests/test_x.py"],
     "cwd": "papers-memory-mcp",
     "timeout_ms": 600000,
     "max_output_chars": 1000000
   })
   ```
   Prefer a **workspace-relative** `cwd` (`papers-memory-mcp`, `mcp-tests`). Absolute paths are
   also accepted when they resolve inside a configured workspace root; paths outside those roots
   and traversal escapes are rejected with `process_cwd_not_allowed`.
3. **Persist the returned `job_id` in durable task/state memory immediately.** Conversational
   context is not storage.
4. Poll `process_status` every 2–3 s at first, then 5–10 s. Do not busy-loop.
5. Read output incrementally with `process_output`, reusing `stdout_next_offset` /
   `stderr_next_offset` as the next cursors. Never re-request from offset 0. One read returns at
   most **65 536** characters, so a large log needs several reads; `stdout_eof` tells you when to
   stop.
6. Use `process_events` for authoritative append-only lifecycle history — especially after a
   reconnect, restart, cancellation or unexpected termination.
7. `process_cancel` when a result is no longer needed, then confirm the terminal state through
   `process_status` **and** `process_events`.
8. After context loss or reconnect, recover with `process_list` **before** asking the operator
   to remember a `job_id`.
9. After an unclean restart, queued/running jobs become `interrupted`. Commands are never
   replayed automatically. Inspect status, output and events, then decide explicitly whether a
   replacement job is safe.

---

## 5. Limits — corrected

```text
run_process      timeout_ms     default  60 000   maximum    90 000     <-- CHANGED
process_start    timeout_ms     default  60 000   maximum   600 000
both             max_output_chars  default 250 000  maximum 1 000 000
process_output   per read                                      65 536
```

The old instruction stated a 600-second maximum for the synchronous runner. That was never
deliverable: `run_process` and `process_start` shared one input schema, so the synchronous tool
advertised the asynchronous tool's ceiling.

---

## 6. Concurrency and retention — absent from the previous instruction, and it matters

```text
maxConcurrent   2        only two jobs run at once; the rest queue
maxQueued       8        a ninth queued job is rejected, not silently dropped
maxRetained    32        older job records are evicted
retentionMs  1 800 000   a finished job's record disappears after 30 minutes
```

Consequences for a long replay: **do not fan out ten jobs** — eight will sit in a queue behind
two. And **read the result within 30 minutes**, or the record is gone and the run has to be
repeated. If a batch will outlive that window, persist the output as you read it rather than
planning to collect everything at the end.

---

## 7. Environment: use the project interpreter

```text
python -c "import papers_memory_mcp"              -> ModuleNotFoundError   (correct!)
uv run --locked python -c "import papers_memory_mcp"  -> works, ~190 ms
```

The package lives in the project's locked virtualenv, not in the global interpreter. The failure
above is not a repository, MCP or environment defect — it is the wrong launcher. Prefix project
work with `uv run --locked`.

Verified working through this workbench on 2026-08-10: `python`, `uv`, `uv run --locked`,
`pytest` collection (2171 tests, 234 823 characters, no truncation), `git`, `node`.

**38 allowlisted commands:** `git node python python3 py bun npm npx pnpm yarn pip pip3 poetry
uv pytest coverage unittest mypy pyright ruff black flake8 tox vitest jest mocha tsx tsc eslint
prettier powershell pwsh sh bash zsh wsl docker docker-compose`.

---

## 8. Security

- never place secrets in command arguments, environment overrides, output, trace ids or memory
  records;
- arguments and environment values are not persisted by the job registry, but treat them as
  observable during execution;
- respect the command allowlist and the controlled error envelopes;
- Docker is allowed on the tests profile; Kubernetes is not enabled.

---

## 9. Before trusting the runner for critical work

Run the independent adversarial recovery test: record every `job_id`, transition history,
cursor, restart point and reproducible failure.

**Do not modify `mcp-tests` because a test behaves unexpectedly.** First establish a minimal,
repeatable defect and report the evidence — the discriminating control is usually a second run
that varies exactly one thing. In the case that produced this revision, the decisive control was
running the *same* command through the asynchronous path while the synchronous one was failing:
that isolated the fault to the request path in one step, after hours of hypotheses about
`pytest`, `subprocess` and TaskGroup internals.
