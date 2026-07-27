# Codebase-Memory CLI Bridge MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose five bounded, authenticated `cbm_*` tools from `mcp-tests` by invoking the locally installed `codebase-memory-mcp.exe` through its one-shot `cli --json` interface.

**Architecture:** A private integration module owns executable discovery, cached first-use dependency probing, fixed operation definitions, bounded child-process execution, workspace-path validation, concurrency, JSON parsing, and structured errors. Static authorized tool facades expose only named operations. Profile `tests` controls exposure: its authenticated surface always includes all five `cbm_*` tools, while probe state affects only whether calls succeed.

**Tech Stack:** Node.js 20+, CommonJS, Node built-ins (`child_process`, `fs`, `path`), existing `mcp-tests` tool loader/policy/schema/runtime patterns, hermetic smoke tests with a fake executable.

## Global Constraints

- CBM tools are absent from the public surface and present on the authenticated surface of profile `tests`.
- No CBM-specific feature flag may add, remove, or conditionally hide the five tools.
- The executable path comes only from the platform-aware fixed default or an optional machine-level `CBM_EXE_PATH` override; callers cannot override it.
- The first CBM tool call performs a cached `<exe> --version` dependency probe with a 5-second timeout and semantic-version validation.
- Probe failure keeps all five tools exposed, returns structured `cbm_unavailable` results from operational calls, and never prevents server startup.
- Read tools never trigger implicit indexing.
- Indexing accepts only paths resolved by `safeWorkspacePath` and verified by real path.
- Simple reads default to 30 seconds, heavy reads to 60 seconds, indexing to 10 minutes, and indexing is hard-capped at 30 minutes.
- At most one indexing operation runs concurrently.
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
- [ ] Implement the minimal bridge with fixed limits, sanitized inherited environment, child-process termination, and a one-at-a-time indexing lock.
- [ ] Run `node _tests/smoke_cbm_cli_bridge.js`; expected: PASS.
- [ ] Commit adapter and test.

### Task 2: Schemas and five static tool facades

**Files:**
- Create: `src/schemas/codebase_memory_tools.js`
- Create: `src/integrations/codebase_memory/cbm_tools.js`
- Create: `tools/cbm_status.js` and `tools/authorized/cbm_status.js`
- Create: `tools/cbm_list_projects.js` and `tools/authorized/cbm_list_projects.js`
- Create: `tools/cbm_index_repository.js` and `tools/authorized/cbm_index_repository.js`
- Create: `tools/cbm_get_architecture.js` and `tools/authorized/cbm_get_architecture.js`
- Create: `tools/cbm_search_graph.js` and `tools/authorized/cbm_search_graph.js`
- Test: `_tests/smoke_cbm_tool_contracts.js`

**Interfaces:**
- Produces tool exports: `cbmStatusTool`, `cbmListProjectsTool`, `cbmIndexRepositoryTool`, `cbmGetArchitectureTool`, `cbmSearchGraphTool`.
- All execute methods return structured bridge payloads and expose MCP-compatible input/output schemas and annotations.

- [ ] Write failing descriptor tests for exact names, read/write annotations, closed input schemas, project/path constraints, and absence of caller-controlled executable/timeout fields.
- [ ] Write execution tests with an injected fake bridge proving no read tool calls `index_repository` and indexing resolves a safe repository path before calling it.
- [ ] Implement schemas and a central tool factory with five static exports.
- [ ] Add authorized re-export modules following existing repository conventions.
- [ ] Run `node _tests/smoke_cbm_tool_contracts.js`; expected: PASS.
- [ ] Commit schemas, facades, and tests.

### Task 3: Profile-controlled loader and policy integration

**Files:**
- Modify: `src/tool_loader.js`
- Modify: `src/tool_policy.js`
- Modify: `profiles/tests.json`
- Test: `_tests/smoke_cbm_loader_gate.js`

**Interfaces:**
- Loader consumes the active server profile surface.
- Loader includes all five tools for the internal/authenticated `tests` surface whenever the `authorized` group is present. Probe state does not alter `tools/list`.

- [ ] Write failing tests for public-profile exclusion, authenticated inclusion independent of environment flags, stable inclusion after a failed availability probe, and omission when the authorized profile group is absent.
- [ ] Add five names to `AUTHORIZED_MCP_TOOL_NAMES` and define explicit policies: four read-only `workspace-code-index-readonly`; one audited non-destructive mutation `workspace-code-index-mutation`.
- [ ] Add `codebase_memory_readonly` and `codebase_memory_mutation` resource policy references to the authenticated profile.
- [ ] Add the profile-controlled loader block. Dependency failure is handled by structured tool results, not by changing the exposed surface.
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
- [ ] Update operator documents with profile-controlled exposure, watcher/freshness limitation, timeout policy, and the pending live validation/restart-and-connector-refresh sequence.
- [ ] Run `node server.js --self-test`.
- [ ] Run `npm test`.
- [ ] Run syntax checks for all new JavaScript files.
- [ ] Inspect the final diff for secrets, absolute operator-only data beyond the documented default executable path, and unrelated changes.
- [ ] Commit verification/documentation package.

### Task 6: Live operator rollout

**Files:**
- No per-launch CBM feature configuration. Optional machine-level executable override only when the platform default is unsuitable.

**Interfaces:**
- Profile `tests` with authenticated surface controls the five-tool exposure on port 3008.

- [ ] Pull/checkout the completed branch on `C:\Work\mcp-tests`.
- [ ] Run the hermetic suite locally and verify the real executable with `codebase-memory-mcp --version`.
- [ ] Request restart only through `node .\scripts\request-restart.js --code=42 --reason=manual` from `C:\Work\mcp-tests`; do not start a new server or supervisor.
- [ ] Report that the connector-visible tool surface changed and wait for the operator to refresh the ChatGPT connector.
- [ ] After operator confirmation, verify live `tools/list` contains exactly the five new tools and the public surface remains unchanged.
- [ ] Call `cbm_status`. Run `cbm_index_repository` only after separate explicit operator authorization, followed by architecture and graph-search calls.
- [ ] Record live-runtime evidence after connector refresh.
