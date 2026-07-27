# CBM Reliability Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:test-driven-development. Execute inline in the current working tree because the CBM rollout is intentionally uncommitted and cannot be reconstructed in an isolated worktree without losing dependencies.

**Goal:** Remove confirmed CBM transport, normalization, startup-validation, portability, and ADR-preservation defects without changing the connector-visible tool surface.

**Architecture:** Native CBM JSON moves from argv to stdin. Connector results are normalized before bounding. Runtime output configuration is validated by a pure helper before any side effect. Existing-index reindexing fails closed unless ADR snapshot retrieval succeeds.

**Tech Stack:** Node.js CommonJS, native child processes, JSON Schema, repository smoke harness, codebase-memory-mcp v0.9.0.

## Global Constraints

- Keep 84 connector-visible tools and 15 `cbm_*` tools.
- Do not restart or replace the server or supervisor.
- Do not refresh the connector.
- Do not reindex or delete `C-Work-mcp-tests` while ADR snapshot retrieval is incompatible.
- Do not commit or push without separate authorization.
- Every production change requires a failing regression test first.
- Preserve output redaction: native input payloads must not appear in diagnostics or audit summaries.

---

### Task 1: Replace raw-JSON argv transport with stdin

**Files:**
- Modify: `_tests/smoke_cbm_cli_bridge.js`
- Modify: `src/integrations/codebase_memory/cbm_cli_bridge.js`

**Interfaces:**
- Consumes: `callCbmTool(toolName, args, options)`.
- Produces: native invocation argv `[..., "cli", "--json", toolName]` and UTF-8 JSON on stdin.

- [ ] **Step 1: Write the failing fixture assertions**

Update the fake CBM script to read stdin before dispatching call modes:

```js
let stdin = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) stdin += chunk;
const parsedInput = stdin ? JSON.parse(stdin) : {};
```

Echo `stdin_chars`, `input`, and `argv`. Add assertions:

```js
assert.deepEqual(echo.result.argv, ["cli", "--json", "list_projects"]);
assert.deepEqual(echo.result.input, {});

const largeContent = "x".repeat(120000);
const largePayload = await callCbmTool("manage_adr", {
  project: "demo",
  mode: "update",
  content: largeContent,
}, fixtureOptions({ maxOutputChars: 200000 }));
assert.equal(largePayload.success, true);
assert.equal(largePayload.result.stdin_chars > 120000, true);
assert.equal(largePayload.result.argv.some((arg) => arg.includes(largeContent.slice(0, 100))), false);
```

- [ ] **Step 2: Verify RED**

Run:

```text
node _tests/smoke_cbm_cli_bridge.js
```

Expected: failure because current bridge still places JSON in argv and ignores stdin.

- [ ] **Step 3: Implement stdin transport**

In `runCbmProcess()`:

```js
const inputJson = JSON.stringify(argsObject || {});
const args = [...commandPrefixArgs(options), "cli", "--json", toolName];
```

Spawn with `stdio: ["pipe", "pipe", "pipe"]`, attach listeners, then call:

```js
try {
  child.stdin.end(inputJson, "utf8");
} catch (error) {
  finish({ status: "spawn_error", exit_code: null, signal: null, error: error?.message || String(error) });
}
```

Do not include `inputJson` in returned diagnostics.

- [ ] **Step 4: Verify GREEN and live contract**

Run the smoke and a bounded local native stdin probe. Expected: smoke passes and native stderr no longer contains the raw-JSON deprecation warning.

---

### Task 2: Make executable resolution portable

**Files:**
- Modify: `_tests/smoke_cbm_cli_bridge.js`
- Modify: `src/integrations/codebase_memory/cbm_cli_bridge.js`

**Interfaces:**
- Produces: `defaultExecutablePath(env)` without operator-specific literals.

- [ ] **Step 1: Add RED assertions**

Export `defaultExecutablePath` for tests and assert on Windows semantics through an injected platform helper or a testable resolver:

```js
assert.equal(
  defaultExecutablePath({ LOCALAPPDATA: "", USERPROFILE: "" }, "win32"),
  "codebase-memory-mcp.exe"
);
assert.doesNotMatch(defaultExecutablePath({}, "win32"), /Users\\mczyz/i);
```

- [ ] **Step 2: Verify RED**

Expected: helper is not exported or returns the literal operator path.

- [ ] **Step 3: Implement minimal resolver change**

Accept optional `platform = process.platform`. Keep `LOCALAPPDATA` and `USERPROFILE` branches. Return `codebase-memory-mcp.exe` as the final Windows fallback and `codebase-memory-mcp` as the non-Windows fallback.

- [ ] **Step 4: Verify GREEN**

Run the bridge smoke and syntax check.

---

### Task 3: Deduplicate `detect_changes` output before bounding

**Files:**
- Modify: `_tests/smoke_cbm_cli_bridge.js`
- Modify: `src/integrations/codebase_memory/cbm_cli_bridge.js`

**Interfaces:**
- Produces: normalized unique `changed_files`, unique `impacted_symbols`, native totals, duplicate-removal warning.

- [ ] **Step 1: Add duplicate fixture and RED assertions**

Fixture payload:

```js
{
  changed_files: ["src/A.js", "src/A.js", "src\\B.js", "src/B.js"],
  impacted_symbols: [
    { qualified_name: "demo.a", file_path: "src/A.js", label: "Function", depth: 1 },
    { qualified_name: "demo.a", file_path: "src/A.js", label: "Function", depth: 1 },
  ],
  changed_count: 4,
}
```

Assertions:

```js
assert.deepEqual(result.result.changed_files, ["src/A.js", "src/B.js"]);
assert.equal(result.result.changed_files_total, 2);
assert.equal(result.result.native_changed_files_total, 4);
assert.equal(result.result.impacted_symbols_total, 1);
assert.equal(result.result.native_impacted_symbols_total, 2);
assert.match(result.warnings.join(" "), /duplicate/i);
```

- [ ] **Step 2: Verify RED**

Expected: duplicate paths remain and totals are inflated.

- [ ] **Step 3: Implement normalization helpers**

Add focused helpers:

```js
function uniqueChangedFiles(values) { /* normalized path key, first stable display value */ }
function uniqueImpactedSymbols(values) { /* composite stable key */ }
```

Run them before scope filtering. Always expose native totals when native and normalized cardinality differ or scope is requested.

- [ ] **Step 4: Verify GREEN**

Run bridge smoke, CBM tool contracts, and syntax checks.

---

### Task 4: Validate runtime output configuration before side effects

**Files:**
- Create: `src/runtime/runtime_output_config.js`
- Create: `_tests/smoke_runtime_output_config_fail_fast.js`
- Modify: `src/runtime/server_bootstrap_runtime.js`
- Modify: `server.js`
- Modify: `_tests/run_all_smoke_scripts.json`
- Modify mechanical test-count documentation/spec fields discovered by guards.

**Interfaces:**
- Produces: `resolveRuntimeOutputConfig(env) -> { outputMode, maxFetchTextChars }`.
- Throws: error with `code="invalid_runtime_output_config"` and `exitCode=2`.

- [ ] **Step 1: Write pure-helper RED tests**

```js
assert.deepEqual(resolveRuntimeOutputConfig({}), {
  outputMode: "structured",
  maxFetchTextChars: 2500,
});
assert.throws(
  () => resolveRuntimeOutputConfig({ MCP_TEST_OUTPUT_MODE: "invalid" }),
  (error) => error.exitCode === 2 && /Invalid MCP_TEST_OUTPUT_MODE/.test(error.message)
);
```

- [ ] **Step 2: Write subprocess no-side-effect RED tests**

For invalid output mode and invalid fetch cap, spawn `server.js` with temporary paths for:

- audit log;
- tool-surface state;
- restart trigger;
- rate-limit state.

Enable the restart trigger. Assert status `2`, intended error text, and absence of every configured path and parent restart directory.

- [ ] **Step 3: Verify RED**

Expected: helper missing; existing bootstrap returns schema-audit error or creates restart directory before failure.

- [ ] **Step 4: Implement helper and early use**

Call `resolveRuntimeOutputConfig(env)` immediately after CLI/auth argument parsing and before profile mutation or resource construction. Remove late `process.exit()` blocks.

Update `server.js`:

```js
process.exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1;
```

- [ ] **Step 5: Integrate smoke and verify GREEN**

Add one manifest entry. Update exact active test counts only after reading current guards. Run the new smoke, existing bootstrap smokes, server self-test, and full offline suite.

---

### Task 5: Fail closed when ADR snapshot is unavailable

**Files:**
- Modify: `_tests/smoke_cbm_tool_contracts.js`
- Modify: `src/integrations/codebase_memory/cbm_tools.js`
- Modify: `docs/CBM_V0_9_0_REBASELINE_REPORT.md`

**Interfaces:**
- Produces: `cbm_adr_snapshot_unavailable` before native indexing for an existing project whose ADR cannot be read.

- [ ] **Step 1: Add RED tool-contract cases**

Create fake-bridge scenarios where `list_projects` finds the repository and:

1. `manage_adr(get)` fails;
2. `manage_adr(get)` succeeds with `content: ""`.

Assert scenario 1 never calls native `index_repository` and returns:

```js
{
  success: false,
  error_code: "cbm_adr_snapshot_unavailable",
}
```

Assert scenario 2 calls native indexing and reports `adr_snapshot_available: true`, `adr_snapshot_nonempty: false`.

- [ ] **Step 2: Verify RED**

Expected: indexing currently proceeds after failed ADR retrieval and empty content is indistinguishable from no snapshot.

- [ ] **Step 3: Implement explicit snapshot state**

Track:

```js
let adrSnapshot = "";
let adrSnapshotAvailable = false;
```

For an existing project, reject failed or malformed retrieval before indexing. Treat any string, including empty, as a valid snapshot. Add metadata fields without changing output schema.

- [ ] **Step 4: Verify GREEN**

Run tool contracts, bridge tests, loader/spec guards, and full offline suite.

---

### Task 6: Documentation, workflow truth, and final verification

**Files:**
- Modify only impacted active documentation and generated directory maps.
- Update `_workflow/state.json` while keeping it below 16,000 bytes.

- [ ] **Step 1: Record behavioral changes and residual state**

Document stdin transport, duplicate normalization, fail-fast startup, portable fallback, and ADR reindex gate. Record that the live index still requires a backed-up migration and was not reindexed.

- [ ] **Step 2: Regenerate directory maps if new files require it**

Run the canonical generator and inspect its diff.

- [ ] **Step 3: Run final verification**

```text
node _tests/run_all_smokes.js --skip-network
node server.js --self-test
git diff --check
```

Also syntax-check every changed JavaScript file, parse every changed JSON file, verify no literal `C:\Users\mczyz` remains in production CBM code, verify no raw JSON payload remains in native argv, and verify no restart/refresh marker was introduced.

- [ ] **Step 4: Persist completion memory**

Save exact changed entities, validation results, residual ADR migration requirement, and no-commit/no-push state only after all checks pass.
