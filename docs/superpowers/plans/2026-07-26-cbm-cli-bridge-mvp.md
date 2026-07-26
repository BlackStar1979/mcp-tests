# Codebase-Memory CLI Bridge MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose five bounded, authenticated `cbm_*` tools from `mcp-tests` by invoking the locally installed `codebase-memory-mcp.exe` through its one-shot `cli --json` interface.

**Architecture:** A private integration module owns executable discovery, startup probing, fixed operation definitions, bounded child-process execution, workspace-path validation, concurrency, JSON parsing, and structured errors. Static authorized tool facades expose only named operations. The optional-tool loader adds the group only when the feature flag is enabled and the cached startup probe succeeds.

**Tech Stack:** Node.js 20+, CommonJS, Node built-ins (`child_process`, `fs`, `path`), existing `mcp-tests` tool loader/policy/schema/runtime patterns, hermetic smoke tests with a fake executable.

## Global Constraints

- CBM tools are absent from the public profile.
- `MCP_TEST_ENABLE_CBM_TOOLS` defaults to disabled.
- The executable path comes only from `MCP_TEST_CBM_EXE_PATH` or the fixed Windows default; callers cannot override it.
- Startup probing uses `<exe> --version`, a 5-second timeout, and semantic-version validation.
- Probe failure omits the tool group but never prevents server startup.
- Read tools never trigger implicit indexing.
- Synchronization accepts only paths resolved by `safeWorkspacePath`.
- Read timeout is 60 seconds; synchronization default is 15 minutes and hard-capped at 30 minutes.
- At most one synchronization runs concurrently.
- Child processes use `shell: false`, `windowsHide: true`, bounded output, and a restricted inherited environment.
- Tests use a fake executable and never invoke the operator's real installation.

---

### Task 1: Hermetic CBM availability and execution adapter

**Files:**
- Create: `src/integrations/codebase_memory/cbm_cli_bridge.js`
- Test: `_tests/smoke_cbm_cli_bridge.js`

**Interfaces:**
- Produces: `probeCbmAvailability(options?) -> status object`
- Produces: `getCbmAvailability(options?) -> cached status object`
- Produces: `callCbmTool(toolName, args, options?) -> Promise<object>`
- Produces: `resolveCbmRepositoryPath(logicalPath) -> workspace path object`
- Produces: `resetCbmBridgeForTests() -> void`

- [ ] Write a fake executable fixture generator in the smoke test that supports `--version`, captures CLI arguments, emits configurable JSON, sleeps for timeout tests, and exits non-zero on demand.
- [ ] Assert missing files and invalid version output return `available: false` without throwing.
- [ ] Assert a valid probe returns the parsed version and is cached.
- [ ] Assert `callCbmTool` emits exactly `cli --json <tool> <json>` with `shell: false` semantics, parses stdout JSON, and classifies timeout, non-zero exit, malformed JSON, and truncation.
- [ ] Assert repository path escapes are rejected by the existing workspace-root resolver.
- [ ] Implement the minimal bridge with fixed limits, sanitized inherited environment, process-tree termination, read concurrency limit, and a one-at-a-time synchronization lock.
- [ ] Run `node _tests/smoke_cbm_cli_bridge.js`; expected: PASS.
- [ ] Commit adapter and test.

### Task 2: Schemas and five static tool facades

**Files:**
- Create: `src/schemas/codebase_memory_tools.js`
- Create: `tools/cbm_tools.js`
- Create: `tools/authorized/cbm_runtime_status.js`
- Create: `tools/authorized/cbm_list_projects.js`
- Create: `tools/authorized/cbm_sync_repository.js`
- Create: `tools/authorized/cbm_get_architecture.js`
- Create: `tools/authorized/cbm_search_graph.js`
- Test: `_tests/smoke_cbm_tool_contracts.js`

**Interfaces:**
- Produces tool exports: `cbmRuntimeStatusTool`, `cbmListProjectsTool`, `cbmSyncRepositoryTool`, `cbmGetArchitectureTool`, `cbmSearchGraphTool`.
- All execute methods return structured bridge payloads and expose MCP-compatible input/output schemas and annotations.

- [ ] Write failing descriptor tests for exact names, read/write annotations, closed input schemas, project/path constraints, and absence of caller-controlled executable/timeout fields.
- [ ] Write execution tests with an injected fake bridge proving no read tool calls `index_repository` and synchronization resolves a safe repository path before calling it.
- [ ] Implement schemas and a central tool factory with five static exports.
- [ ] Add authorized re-export modules following existing repository conventions.
- [ ] Run `node _tests/smoke_cbm_tool_contracts.js`; expected: PASS.
- [ ] Commit schemas, facades, and tests.

### Task 3: Conditional loader and policy integration

**Files:**
- Modify: `src/tool_loader.js`
- Modify: `src/tool_policy.js`
- Modify: `profiles/tests.json`
- Test: `_tests/smoke_cbm_loader_gate.js`

**Interfaces:**
- Loader consumes cached `getCbmAvailability()`.
- Loader includes the five tools only for internal/authenticated profile, enabled flag, authorized group, and successful probe.

- [ ] Write failing tests for disabled-by-default, public-profile exclusion, authenticated inclusion with successful fake probe, and omission after failed probe.
- [ ] Add five names to `AUTHORIZED_MCP_TOOL_NAMES` and define explicit policies: four read-only `workspace-code-index-readonly`; one audited non-destructive mutation `workspace-code-index-mutation`.
- [ ] Add `codebase_memory_readonly` and `codebase_memory_mutation` resource policy references to the authenticated profile.
- [ ] Add the guarded loader block without allowing probe failure to throw through server startup.
- [ ] Run `node _tests/smoke_cbm_loader_gate.js`; expected: PASS.
- [ ] Commit loader/policy/profile integration.

### Task 4: Canonical specifications and surface accounting

**Files:**
- Modify: `SERVER_TOOLS_SPEC.json`
- Modify: `SERVER_RESOURCE_POLICY_SPEC.json`
- Modify: `SERVER_OUTPUT_DLP_POLICY_SPEC.json`
- Modify: `SERVER_PROFILES_SPEC.json`
- Modify: `SERVER_CONNECTOR_SURFACE_SPEC.json`
- Test: relevant existing policy/surface smoke tests plus `_tests/smoke_cbm_specs.js`

**Interfaces:**
- Specifications declare five additional authenticated MCP tools and preserve zero public-surface change.

- [ ] Write a smoke test that cross-checks the five tool names, operation classes, resource classes, auth requirements, DLP treatment, and profile permissions.
- [ ] Update canonical counts and lists from 69 to 74 total callable tools and from 56 to 61 authorized tools wherever those values are current source truth.
- [ ] Add resource classes for CBM read and index mutation operations.
- [ ] Record that source/graph payloads are connector-visible and subject to bounded output/DLP handling.
- [ ] Update connector surface hashes/count assertions only through the project's existing deterministic mechanism or exact current list calculation.
- [ ] Run targeted policy/surface smoke tests; expected: PASS.
- [ ] Commit canonical spec updates.

### Task 5: Workflow documentation and full hermetic verification

**Files:**
- Modify: `_workflow/STATE.md`
- Modify: `_workflow/READINESS.md`
- Modify: `_workflow/ROADMAP.md`
- Modify: `_workflow/state.json`
- Modify: `DIRECTORY.md`
- Modify: `_tests/run_all_smoke_scripts.json`
- Modify: `_tests/README.md` and hygiene counts if required by repository guards.

**Interfaces:**
- Documentation records repo truth separately from live-runtime truth.

- [ ] Add new smoke tests to the active manifest.
- [ ] Update operator documents with architecture, disabled-by-default rollout, watcher/freshness limitation, timeout policy, and the pending live validation/restart step.
- [ ] Run `node server.js --self-test`.
- [ ] Run `npm test`.
- [ ] Run syntax checks for all new JavaScript files.
- [ ] Inspect the final diff for secrets, absolute operator-only data beyond the documented default executable path, and unrelated changes.
- [ ] Commit verification/documentation package.

### Task 6: Live operator rollout

**Files:**
- Local runtime configuration only; no secret values committed.

**Interfaces:**
- Runtime environment sets `MCP_TEST_ENABLE_CBM_TOOLS=1` and `MCP_TEST_CBM_EXE_PATH` for authenticated port 3008.

- [ ] Pull/checkout the completed branch on `C:\Work\mcp-tests`.
- [ ] Run the hermetic suite locally and verify the real executable with `codebase-memory-mcp --version`.
- [ ] Configure authenticated-runtime environment variables without placing secrets or machine configuration in Git.
- [ ] Restart through `node .\scripts\request-restart.js --code=42 --reason=manual` from `C:\Work\mcp-tests`.
- [ ] Verify live `tools/list` contains exactly the five new tools and the public surface remains unchanged.
- [ ] Call `cbm_runtime_status`, then `cbm_sync_repository` for `mcp-tests`, followed by architecture and graph-search calls.
- [ ] Record live-runtime evidence and refresh the ChatGPT connector tool inventory if required.
