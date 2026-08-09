# Process Runner Async and Policy Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:test-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align synchronous process execution with the operator-selected limits and add a bounded, cancellable asynchronous job lifecycle for long-running development commands.

**Architecture:** A fail-fast process policy module prepares pinned commands and restricted environments. A shared execution handle powers both `run_process` and a SQLite-backed owner-scoped job manager exposed through six explicit MCP tools.

**Tech Stack:** Node.js CommonJS, `node:child_process`, JSON Schema, MCP Streamable HTTP runtime, repository smoke harness.

## Global Constraints

- Use `60000`, `600000`, `250000`, and `1000000` consistently for default timeout, hard timeout, default combined output, and hard combined output.
- Keep Docker and package-manager commands available in the authenticated test profile.
- Remove `kubectl` from the default allowlist.
- Reject caller overrides of executable resolution and loader startup controls.
- Keep public port 3009 unchanged.
- Add six authenticated tools: `process_start`, `process_status`, `process_output`, `process_cancel`, `process_list`, and `process_events`.
- Every production behavior change requires a failing test first.
- Never expose raw output, args, env values, or resolved executable paths in lifecycle audit events.
- Never start a replacement server on port 3008; use the controlled restart helper only after isolated validation.

---

### Task 1: Fail-fast process configuration and command policy

**Files:**
- Create: `src/util/process_runner_config.js`
- Create: `_tests/smoke_process_runner_config.js`
- Modify: `src/util/process_runner.js`
- Modify: `src/schemas/process_tools.js`

**Interfaces:**
- Produces: `resolveProcessRunnerConfig(env)`, `prepareProcessInvocation(options, config)`, `buildProcessEnv(family, extraEnv, config)`.
- Consumes: workspace cwd resolution from `src/util/workspace_roots.js`.

- [ ] **Step 1: Write RED tests for exact limits and invalid config**

Assert exact runtime/schema values and failures:

```js
assert.deepEqual(resolveProcessRunnerConfig({}), {
  defaultTimeoutMs: 60000,
  maxTimeoutMs: 600000,
  defaultOutputChars: 250000,
  hardOutputChars: 1000000,
  maxConcurrent: 2,
  maxQueued: 8,
  maxRetained: 32,
  retentionMs: 1800000,
});
assert.throws(() => resolveProcessRunnerConfig({ MCP_PROCESS_MAX_TIMEOUT_MS: "NaN" }), /finite integer/);
assert.throws(() => resolveProcessRunnerConfig({ MCP_PROCESS_TIMEOUT_MS: "700000" }), /must not exceed/);
assert.equal(RUN_PROCESS_INPUT_SCHEMA.properties.timeout_ms.maximum, 600000);
assert.equal(RUN_PROCESS_INPUT_SCHEMA.properties.max_output_chars.maximum, 1000000);
```

- [ ] **Step 2: Verify RED**

Run `node _tests/smoke_process_runner_config.js`. Expected: missing module or old schema values.

- [ ] **Step 3: Implement the pure config resolver and exact schemas**

Use a strict helper:

```js
function readBoundedInt(env, name, fallback, min, max) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be a finite integer between ${min} and ${max}.`);
  }
  return value;
}
```

Reject defaults above their hard maxima. Export one frozen config object for runtime consumers.

- [ ] **Step 4: Verify GREEN**

Run config smoke, runtime config smoke, schema compatibility smoke, and `node --check` for touched modules.

---

### Task 2: Pin executable resolution and restrict environment inheritance

**Files:**
- Modify: `_tests/smoke_process_runner_config.js`
- Modify: `src/util/process_runner_config.js`
- Modify: `src/util/process_runner.js`

**Interfaces:**
- Produces: `{ logicalCommand, executable, prefixArgs, family, resolutionClass }`.
- Produces: child env without caller-controlled executable lookup.

- [ ] **Step 1: Write RED resolution and env tests**

Assertions include:

```js
assert.equal(prepareProcessInvocation({ command: "node", args: [] }, config).executable, process.execPath);
assert.throws(() => buildProcessEnv("runtime", { PATH: "C:\\fake" }, config), /reserved env/);
assert.throws(() => buildProcessEnv("runtime", { NODE_OPTIONS: "--require x" }, config), /reserved env/);
assert.equal(config.allowedCommands.includes("docker"), true);
assert.equal(config.allowedCommands.includes("kubectl"), false);
```

Create temporary workspace `.venv` and `node_modules/.bin` fixtures and assert workspace-local resolution precedence without executing them.

- [ ] **Step 2: Verify RED**

Expected: current runner accepts arbitrary env keys, uses PATH for Node, and includes `kubectl`.

- [ ] **Step 3: Implement family-based resolution and env policy**

Pin Node to `process.execPath`; translate stable Python tools to `python -m <module>`; prefer workspace-local Python and JS tools; use the trusted parent PATH only as a fallback. Reserve PATH-like and loader-control keys. Inherit proxy variables only for package/container families and `DOCKER_HOST` only for container commands.

- [ ] **Step 4: Verify GREEN with non-mutating command probes**

Run `node --version`, `npm --version`, `python --version`, `pip --version`, `docker --version`, and denial probes for `kubectl` and reserved env overrides. Missing optional executables must return deterministic `command_not_found`, not crash.

---

### Task 3: Shared execution handle and combined output budget

**Files:**
- Create: `src/util/process_execution.js`
- Create: `_tests/smoke_process_execution.js`
- Modify: `src/util/process_runner.js`

**Interfaces:**
- Produces: `startProcessExecution(options, dependencies)` returning `{ child, completion, snapshot(), readOutput(), cancel() }`.
- `runProcess(options)` awaits `completion` and returns the existing sync envelope.

- [ ] **Step 1: Write RED tests for shared budgeting, timeout, and cancellation**

Spawn Node fixtures that write to both streams:

```js
const result = await runProcess({
  command: "node",
  args: ["-e", "process.stdout.write('o'.repeat(800000));process.stderr.write('e'.repeat(800000))"],
  max_output_chars: 1000000,
});
assert.equal(result.stdout.length + result.stderr.length, 1000000);
assert.equal(result.stdout_truncated || result.stderr_truncated, true);
```

Add timeout and explicit cancellation cases, including termination-error preservation.

- [ ] **Step 2: Verify RED**

Expected: current runner retains two million characters and has no reusable execution handle.

- [ ] **Step 3: Implement one combined output allocator**

Every chunk consumes the remaining shared budget before being appended to its stream. Continue draining after exhaustion. Normalize close/error races so completion resolves once. Keep the existing sync result fields.

- [ ] **Step 4: Verify GREEN**

Run process execution, sync tool, timeout-kill, and output-schema smokes.

---

### Task 4: Durable asynchronous job manager

**Files:**
- Create: `src/util/process_job_manager.js`, `src/util/process_job_store.js`
- Create: `_tests/smoke_process_job_manager.js`

**Interfaces:**
- Produces: `createProcessJobManager({ config, startExecution, now, randomUUID, audit })`.
- Methods: `start(input)`, `status(jobId)`, `output(jobId, cursor)`, `cancel(jobId)`, `shutdown()`.

- [ ] **Step 1: Write RED lifecycle tests**

Use real Node child processes and a manager configured for one concurrent job. Assert:

```js
const first = manager.start(longCommand);
const second = manager.start(shortCommand);
assert.equal(first.status, "running");
assert.equal(second.status, "queued");
await manager.cancel(first.job_id);
await waitFor(() => manager.status(second.job_id).status === "ok");
```

Add cursor output, unknown ID, queued cancellation, timeout, retention pruning, and audit-redaction assertions.

- [ ] **Step 2: Verify RED**

Expected: module is absent.

- [ ] **Step 3: Implement bounded queue and registry**

Use stable UUID job IDs, FIFO queueing, timeout-at-start semantics, 65536-character per-read chunks, and terminal pruning. `shutdown()` cancels queued jobs and terminates running jobs before resolving.

- [ ] **Step 4: Verify GREEN and leak checks**

After tests complete, assert no child process remains and the registry retains no running jobs.

---

### Task 5: Expose six MCP tools and policy contracts

**Files:**
- Create: `tools/process_start.js`, `tools/process_status.js`, `tools/process_output.js`, `tools/process_cancel.js`, `tools/process_list.js`, `tools/process_events.js`
- Create: `tools/authorized/process_start.js`, `tools/authorized/process_status.js`, `tools/authorized/process_output.js`, `tools/authorized/process_cancel.js`
- Create: `_tests/smoke_process_async_tools.js`
- Modify: `src/schemas/process_tools.js`, `src/tool_loader.js`, `src/tool_policy.js`
- Modify: `tools/authorized/DIRECTORY.md`, `src/util/DIRECTORY.md`

**Interfaces:**
- `process_start` consumes the shared process input schema and returns a job summary.
- `process_status`, `process_output`, and `process_cancel` consume strict job schemas.

- [ ] **Step 1: Write RED descriptor and tool tests**

Assert strict schemas, annotations, queue/start output, cursor reads, and cancellation. Assert exact policy values: start/cancel destructive and open-world; status/output read-only.

- [ ] **Step 2: Verify RED**

Expected: modules and loader entries are absent.

- [ ] **Step 3: Implement tools and loader wiring**

Use a singleton default manager for live tools and injected managers in tests. Pass the runtime audit callback into tool execution context without exposing it to schemas or results.

- [ ] **Step 4: Verify GREEN**

Run async tool, loader, policy, descriptor, output-schema, and security-boundary smokes.

---

### Task 6: Graceful restart, specs, workflow, and surface reconciliation

**Files:**
- Modify: `src/runtime/restart_controller.js`, `src/runtime/server_bootstrap_runtime.js`, `src/runtime/optional_tool_call_handler.js`
- Modify: `SERVER_TOOLS_SPEC.json`, `SERVER_RESOURCE_POLICY_SPEC.json`, `SERVER_RUNTIME_CONFIG_SPEC.json`, `SERVER_EVENT_CATALOG_SPEC.json`, `SERVER_CONNECTOR_SURFACE_SPEC.json`
- Modify: `_workflow/STATE.md`, `_workflow/state.json`, `_workflow/READINESS.md`, `_workflow/ROADMAP.md`, `_workflow/ACTIVE_WORKFLOW_INDEX.md`, `_workflow/WORKFLOW_CANON.md`
- Modify: affected count/fingerprint and directory-map tests.

**Interfaces:**
- Restart controller invokes process-job shutdown before process exit with a bounded grace period.
- Live surface becomes 91 authenticated tools (`13 + 78`).

- [ ] **Step 1: Write RED restart and spec guards**

Assert shutdown occurs before injected exit, timeout fallback still exits, event catalog includes persistence/recovery lifecycle events, specs expose exact limits, and every expected tool count is 91.

- [ ] **Step 2: Verify RED**

Expected: old restart path exits directly and current specs/counts remain 85.

- [ ] **Step 3: Implement shutdown integration and synchronize truth files**

Use a bounded `Promise.race` around manager shutdown before the existing normalized restart exit. Update generated inventories/maps through repository scripts where available rather than hand-copying generated content.

- [ ] **Step 4: Verify repository contracts**

Run restart, root-spec consistency, workflow orientation, directory audit, tool-surface fingerprints, and project truth audit.

---

### Task 7: Full and live acceptance

**Files:**
- Create: `_workflow/operator_decisions/process_runner_async_live_acceptance_2026-08-09.md`
- Modify: persistent task/state through `memory_*` tools.

**Interfaces:**
- Produces: hermetic and live acceptance evidence with no raw process output or env secrets.

- [ ] **Step 1: Run full offline verification**

Run:

```text
node _tests/run_all_smokes.js --skip-network
node server.js --self-test --auth=oauth21 --profile=tests
npm audit --omit=dev
git diff --check
```

Expected: all commands exit zero.

- [ ] **Step 2: Run isolated live probes**

Start an OAuth21 test instance on an unused port with isolated OAuth/audit/state files. Verify synchronous limits, async completion, output cursors, timeout, OAuth-client owner isolation, confirmed process-tree cancellation, Docker version, package-manager version, denial of Kubernetes, and no orphan processes. Stop and clean only the isolated instance and its temporary files.

- [ ] **Step 3: Restart production safely**

Run `node .\scripts\request-restart.js --code=42 --reason=manual`. Verify port 3008 health, server start ID, 91-tool surface, fingerprints, OAuth continuity, and direct workbench calls. Ask the operator only if OAuth login or connector re-enumeration requires UI interaction.

- [ ] **Step 4: Record and publish**

Write the live acceptance record, rebuild the knowledge index, update durable memory/task state, commit bounded changes, push the current branch, and verify clean HEAD equals upstream.
