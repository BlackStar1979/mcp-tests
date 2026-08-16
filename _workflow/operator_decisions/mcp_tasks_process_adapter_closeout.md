# MCP Tasks Process Adapter Closeout

Status: repo-validated, live-loaded and live-acceptedDate: 2026-08-14
Package: `MCP-TASKS-PROCESS-ADAPTER`

## Decision

MCP Tasks is implemented as a thin protocol view over the existing durable process registry. The process registry remains the sole execution authority and durable state owner; no second task scheduler or task store is introduced.

The standard task-augmented tool is `run_process` for MCP `2026-07-28` requests whose client capabilities opt into `io.modelcontextprotocol/tasks`. Existing `process_start` remains the explicit custom asynchronous/admin-compatible process API and does not silently change result semantics when Tasks is negotiated.

Supported task methods are `tasks/get`, `tasks/update`, and `tasks/cancel`. `tasks/list` is intentionally absent. Task access is owner-bound through the same process-job owner boundary. Cross-owner and unknown task identifiers are indistinguishable at the protocol boundary.

## Runtime semantics

- Task creation uses the existing transactional SQLite/WAL process registry before `CreateTaskResult` is emitted.
- The process job UUID is the opaque MCP task identifier.
- `tasks/get` reconstructs the terminal `run_process` `CallToolResult` from bounded durable stdout/stderr reads.
- Terminal process interruption maps to MCP task `failed`; ordinary process/tool terminal results remain completed tool results.
- `tasks/cancel` delegates to the existing cooperative process cancellation path and preserves natural-completion races.
- `tasks/update` validates task existence/ownership and acknowledges input responses, but process-backed tasks do not enter `input_required`.
- `ttlMs` is conservatively `0` because the shared process registry has bounded retention and currently cannot promise a task-specific minimum retention interval.
- Raw process argv is not persisted and is no longer echoed by synchronous `run_process`; task-backed terminal results expose an empty `args` echo plus bounded result metadata indicating redaction.
- The legacy caller-supplied `trace_id` field remains on the synchronous `run_process` path because the process registry does not persist it. The next package replaces this ad-hoc correlation with bounded W3C Trace Context.

## Protocol contract

- `server/discover` advertises extension `io.modelcontextprotocol/tasks` on the modern protocol path.
- Task methods require the client capability on each request.
- `Mcp-Name` mirrors `params.taskId` for `tasks/get`, `tasks/update`, and `tasks/cancel`.
- Legacy protocol requests receive method-not-found for task methods.
- Non-Tasks clients preserve the synchronous `run_process` contract.

## Verification

Dedicated regression coverage proves:

- capability-gated `run_process` task creation without entering the synchronous execution path;
- unchanged `process_start` custom async behavior;
- terminal result reconstruction and argv redaction;
- `tasks/get`, `tasks/update`, `tasks/cancel`, and absence of `tasks/list`;
- durable task visibility immediately after creation;
- process completion followed by close/reopen of the same SQLite/WAL registry under a new server instance;
- recovered terminal task result after restart;
- cross-owner denial and unknown-task handling;
- stable connector tool-name/schema/descriptor fingerprint;
- portable control-plane deploy/rollback regression;
- hermetic CBM, observability, and directory-documentation tests found and repaired while validating on clean Linux CI.

Clean-history GitHub Actions run `31784712342` passed the targeted Tasks/process/control-plane guards, the full hermetic run-all, and the post-test clean-tree check. The validated full-suite result is:

```text
public=7
tests_authenticated=294
```

The two security hardening regressions introduced immediately before this package are now registered in the canonical run-all manifest, so the full suite cannot silently omit them.

## Runtime boundary

Controlled live load completed on 2026-08-16. The supervisor restart request `manual-1786907075795` loaded final source `737cdc8b97ec1e966823dc2566eb7d5cd221e9b6` at `server_start_id = 2026-08-16T19:04:37.288Z`. The connector-visible surface remained `98` tools and the combined fingerprint returned to the verified `ec7d3af5b4ea17f5`; OAuth state survived the restart.

A secret-free localhost client authenticated with an existing live token, declared `io.modelcontextprotocol/tasks`, and used MCP `2026-07-28`. `server/discover` advertised the Tasks extension; `run_process` returned `resultType = task`; `tasks/get` reached `status = completed` and `resultType = complete`; the terminal result contained the expected stdout and exposed both `mcp-tests/processArgsRedacted = true` and `mcp-tests/taskBackedProcess = true`. Audit recorded `task_extension = io.modelcontextprotocol/tasks` on task `b29ed763-93db-4427-9675-f7476656ce05`.

The refreshed OpenAI connector does not itself advertise Tasks and therefore continues to receive the synchronous `run_process` fallback. That is the accepted compatibility behavior, not a failed Tasks negotiation.## Next package

`TRACE-CONTEXT` is now the highest-leverage internally actionable package. It must establish one safe W3C correlation spine across request, execution, task, later artifact, and receipt while keeping trace metadata out of authorization decisions and avoiding raw `baggage` persistence.

`PROCESS-ARTIFACTS` follows Trace Context so artifact identity and receipts can bind to the same correlation model from their first stable schema.
