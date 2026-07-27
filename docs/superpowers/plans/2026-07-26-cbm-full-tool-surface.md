# Codebase-Memory Full Tool Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose all 14 native codebase-memory operations plus the bridge-only `cbm_status` tool on `tests.authenticated`, with strict schemas, policy classification, hermetic tests, and controlled live rollout.

**Architecture:** Extend the existing one-shot CLI bridge rather than creating a second MCP server or persistent CBM child process. A fixed operation registry controls native operation names, timeout classes, and mutation locking; a tool factory maps strict connector schemas to native CLI arguments and returns the existing normalized bridge envelope.

**Tech Stack:** Node.js CommonJS, JSON Schema, existing `mcp-tests` profile/loader/policy framework, `codebase-memory-mcp.exe` CLI mode, assert-based smoke tests.

## Global Constraints

- `mcp-tests` remains the only remote MCP server.
- All 15 `cbm_*` tools are exposed only on profile `tests.authenticated`; none are public.
- Exposure is profile-controlled and never depends on executable availability or a CBM feature flag.
- The executable remains server-selected through the platform default or optional `CBM_EXE_PATH`.
- Read tools never trigger indexing or another mutation implicitly.
- Only `node .\scripts\request-restart.js --code=42 --reason=manual` may request a runtime restart.
- No live validation of newly added tools occurs until the operator confirms connector refresh.
- `cbm_delete_project` may be live-tested only against a dedicated fixture index created by this validation package.

---

### Task 1: Lock the full native contract in failing tests

**Files:**
- Modify: `_tests/smoke_cbm_tool_contracts.js`
- Modify: `_tests/smoke_cbm_cli_bridge.js`
- Modify: `_tests/smoke_cbm_loader_gate.js`
- Modify: `_tests/smoke_cbm_specs.js`
- Test: the same four files

**Interfaces:**
- Consumes: existing `createCbmTools`, `TOOL_DEFINITIONS`, and schema exports.
- Produces: exact expected list of 15 connector tool names, 14 native operation names, argument-forwarding expectations, mutation-lock expectations, and repository count target 84.

- [ ] **Step 1: Expand the expected tool-name arrays**

Use this canonical connector order:

```js
const EXPECTED_CBM_TOOLS = [
  "cbm_status",
  "cbm_list_projects",
  "cbm_index_repository",
  "cbm_get_architecture",
  "cbm_search_graph",
  "cbm_query_graph",
  "cbm_trace_path",
  "cbm_get_code_snippet",
  "cbm_get_graph_schema",
  "cbm_search_code",
  "cbm_delete_project",
  "cbm_index_status",
  "cbm_detect_changes",
  "cbm_manage_adr",
  "cbm_ingest_traces",
];
```

- [ ] **Step 2: Add forwarding assertions for every native operation**

Each tool test must assert the exact native operation and JSON keys. Representative pattern:

```js
const queried = await byName.get("cbm_query_graph").execute({
  project: "demo",
  query: "MATCH (n) RETURN n LIMIT 5",
  max_rows: 5,
});
assert.deepEqual(queried.result.args, {
  project: "demo",
  query: "MATCH (n) RETURN n LIMIT 5",
  max_rows: 5,
});
```

- [ ] **Step 3: Add status-separation assertions**

```js
assert.notEqual(byName.get("cbm_status"), byName.get("cbm_index_status"));
assert.deepEqual(byName.get("cbm_status").descriptor.inputSchema.required, []);
assert.deepEqual(byName.get("cbm_index_status").descriptor.inputSchema.required, ["project"]);
```

- [ ] **Step 4: Add mutation-lock bridge tests**

Use a delayed fake child for `index_repository`, then assert that `delete_project`, `manage_adr`, and `ingest_traces` return `mutation_busy` without spawning a second child. Assert a read operation still spawns while the mutation is active.

- [ ] **Step 5: Run targeted tests and confirm failure**

Run:

```powershell
node _tests\smoke_cbm_tool_contracts.js
node _tests\smoke_cbm_cli_bridge.js
node _tests\smoke_cbm_loader_gate.js
node _tests\smoke_cbm_specs.js
```

Expected: failures showing missing schema exports, missing tool descriptors, missing operation definitions, and stale count 74.

### Task 2: Expand strict schemas and annotations

**Files:**
- Modify: `src/schemas/codebase_memory_tools.js`
- Test: `_tests/smoke_cbm_tool_contracts.js`

**Interfaces:**
- Produces: one exported `CBM_<OPERATION>_INPUT_SCHEMA` per connector tool, `CBM_BRIDGE_OUTPUT_SCHEMA`, expanded `CBM_STATUS_OUTPUT_SCHEMA`, and three annotation constants.

- [ ] **Step 1: Add reusable bounded schema fragments**

Define frozen helpers for project names, bounded strings, string arrays, and trace arrays. All schemas must set `additionalProperties: false`.

- [ ] **Step 2: Add ten missing native input schemas**

Create exact exports for:

```text
CBM_QUERY_GRAPH_INPUT_SCHEMA
CBM_TRACE_PATH_INPUT_SCHEMA
CBM_GET_CODE_SNIPPET_INPUT_SCHEMA
CBM_GET_GRAPH_SCHEMA_INPUT_SCHEMA
CBM_SEARCH_CODE_INPUT_SCHEMA
CBM_DELETE_PROJECT_INPUT_SCHEMA
CBM_INDEX_STATUS_INPUT_SCHEMA
CBM_DETECT_CHANGES_INPUT_SCHEMA
CBM_MANAGE_ADR_INPUT_SCHEMA
CBM_INGEST_TRACES_INPUT_SCHEMA
```

Also expand existing index, graph-search, and architecture schemas to include the native 0.8.1 optional fields.

- [ ] **Step 3: Add mutation annotations**

```js
const MUTATING_CBM_ANNOTATIONS = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
});

const DESTRUCTIVE_CBM_ANNOTATIONS = Object.freeze({
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
});
```

Keep the existing indexing annotation as a compatibility export or alias it to the non-destructive mutation annotation.

- [ ] **Step 4: Expand status output**

Require:

```text
mutation_busy: boolean
active_mutation_tool: string
```

Retain `index_busy`.

- [ ] **Step 5: Run the schema contract test**

Run:

```powershell
node _tests\smoke_cbm_tool_contracts.js
```

Expected: schema assertions pass; tool-factory assertions still fail until Task 4.

### Task 3: Expand the private CLI operation registry and lock

**Files:**
- Modify: `src/integrations/codebase_memory/cbm_cli_bridge.js`
- Test: `_tests/smoke_cbm_cli_bridge.js`

**Interfaces:**
- Produces: `TOOL_DEFINITIONS` containing exactly 14 native operations and a single exclusive mutation lock.

- [ ] **Step 1: Replace boolean indexing metadata with operation classes**

Use registry entries shaped as:

```js
query_graph: Object.freeze({ timeoutClass: "heavyRead", mutation: false }),
delete_project: Object.freeze({ timeoutClass: "heavyRead", mutation: true }),
index_repository: Object.freeze({ timeoutClass: "index", mutation: true }),
```

Register all 14 native names; no arbitrary passthrough is allowed.

- [ ] **Step 2: Generalize lock state**

Replace `indexBusy` with:

```js
let activeMutationTool = "";
```

A mutation is busy when `activeMutationTool !== ""`. Return `mutation_busy` before process spawn when another mutation is active.

- [ ] **Step 3: Preserve compatibility status**

Return:

```js
index_busy: activeMutationTool === "index_repository",
mutation_busy: activeMutationTool !== "",
active_mutation_tool: activeMutationTool,
```

- [ ] **Step 4: Reset all bridge state in tests**

`resetCbmBridgeForTests()` must clear cached availability and `activeMutationTool`.

- [ ] **Step 5: Run bridge tests**

Run:

```powershell
node _tests\smoke_cbm_cli_bridge.js
```

Expected: all 14 allowlist, timeout, normalization, and lock tests pass.

### Task 4: Build all 15 connector tools

**Files:**
- Modify: `src/integrations/codebase_memory/cbm_tools.js`
- Create: ten missing `tools/cbm_*.js` files
- Create: ten matching `tools/authorized/cbm_*.js` facades
- Test: `_tests/smoke_cbm_tool_contracts.js`

**Interfaces:**
- Consumes: all schema exports and `callCbmTool`.
- Produces: `createCbmTools()` returning the canonical 15-tool order and named exports for each tool object.

- [ ] **Step 1: Introduce a private read-tool builder**

Use a local helper that accepts connector name, native name, title, description, schema, forwarded keys, and summary builder. It must not expose the native name as caller input.

- [ ] **Step 2: Expand `cbm_index_repository` forwarding**

Map `path` to verified native `repo_path`, then forward only defined `mode`, `target_projects`, `name`, and `persistence`.

- [ ] **Step 3: Add the ten missing descriptors and executors**

Every descriptor must state whether it reads the latest completed index or mutates CBM state. Query and code-snippet descriptions must warn that they never index implicitly.

- [ ] **Step 4: Add privacy-preserving argument summaries**

Do not include full Cypher, source pattern, ADR content, or trace objects. Record only lengths, counts, modes, limits, project/path summaries, and boolean flags.

- [ ] **Step 5: Add root modules and authenticated facades**

Each root module exports one named tool; each facade is a one-line re-export matching the established pattern.

- [ ] **Step 6: Run tool contract tests**

Run:

```powershell
node _tests\smoke_cbm_tool_contracts.js
node _tests\smoke_authorized_internal_facade_split.js
```

Expected: all 15 descriptors, schemas, annotations, executors, and facade checks pass.

### Task 5: Wire profile exposure and policy enforcement

**Files:**
- Modify: `src/tool_loader.js`
- Modify: `src/tool_policy.js`
- Modify: `src/profile_schema_validator.js`
- Modify: `profiles/tests.json`
- Test: `_tests/smoke_cbm_loader_gate.js`
- Test: relevant policy/profile smoke tests

**Interfaces:**
- Produces: stable `tests.authenticated` exposure of 15 CBM tools, public exclusion, and policy decisions for read, mutation, and destructive classes.

- [ ] **Step 1: Load all named CBM exports**

Append all 15 tools only when assembling the authenticated/authorized `tests` profile. Do not add availability checks or feature flags.

- [ ] **Step 2: Add all names to authorized policy inventory**

Map 11 read-only tools to `codebase_memory_readonly`, three non-destructive mutators to `codebase_memory_mutation`, and `cbm_delete_project` to `codebase_memory_destructive`.

- [ ] **Step 3: Add the destructive resource policy**

Define a profile policy reference that requires authenticated execution, audit, and destructive-tool handling. Keep public profile resources unchanged.

- [ ] **Step 4: Update profile schema validation**

Recognize the new policy reference and reject unknown variants.

- [ ] **Step 5: Run loader and policy tests**

Run:

```powershell
node _tests\smoke_cbm_loader_gate.js
node _tests\smoke_profile_schema_validator.js
node _tests\smoke_registry_policy_consistency_guard.js
node _tests\smoke_static_tool_registry_equivalence.js
```

Expected: public excludes all CBM names; authenticated includes exactly 15 regardless of probe result or obsolete env flags.

### Task 6: Update canonical specs and repository truth

**Files:**
- Modify: `SERVER_TOOLS_SPEC.json`
- Modify: `SERVER_PROFILES_SPEC.json`
- Modify: `SERVER_CONNECTOR_SURFACE_SPEC.json`
- Modify: `SERVER_RESOURCE_POLICY_SPEC.json`
- Modify: `SERVER_OUTPUT_DLP_POLICY_SPEC.json`
- Modify: `SERVER_SPEC.json`
- Modify only if required by actual code: `SERVER_RUNTIME_CONFIG_SPEC.json`
- Modify: `_workflow/state.json`
- Modify: `_workflow/STATE.md`
- Modify: `_workflow/READINESS.md`
- Modify: `_workflow/ROADMAP.md`
- Modify: `_workflow/ACTIVE_WORKFLOW_INDEX.md`
- Modify: `_workflow/WORKFLOW_CANON.md`
- Modify: count-sensitive harnesses and smoke tests discovered by literal search

**Interfaces:**
- Produces: canonical repository target 84 while preserving live runtime evidence 74 until restart.

- [ ] **Step 1: Update tool inventory and counts**

Use exact repository targets:

```text
authorized tools: 71
authenticated optional tools: 82
total authenticated MCP-callable tools: 84
```

Public counts remain unchanged.

- [ ] **Step 2: Add ten tool records**

Each record must include authenticated profile surface, resource policy, input/output schema reference, mutation/destructive classification, and audit posture.

- [ ] **Step 3: Keep truth layers separate**

Before restart:

```text
repository target: 84
live runtime/connector: 74
restart_required_now: true
connector_refresh_required_now: false
```

Do not overwrite live fingerprints with repository expectations.

- [ ] **Step 4: Update workflow narrative**

Record successful five-tool live validation and the new full-surface expansion package. Do not turn `state.json` into a progress log or exceed its compactness limit.

- [ ] **Step 5: Run spec and truth tests**

Run:

```powershell
node _tests\smoke_cbm_specs.js
node _tests\smoke_root_server_specs_consistency.js
node _tests\smoke_state_and_snapshot_hygiene.js
node _tests\smoke_workflow_truth_repair.js
```

Expected: all repository-target checks use 84 and all live-evidence checks remain 74.

### Task 7: Add a dedicated live-validation fixture

**Files:**
- Create: `_tests/fixtures/cbm-live-fixture/package.json`
- Create: `_tests/fixtures/cbm-live-fixture/src/math.js`
- Create: `_tests/fixtures/cbm-live-fixture/src/service.js`
- Create: `_tests/fixtures/cbm-live-fixture/src/index.js`
- Create or modify: a documented live-validation checklist under `_workflow`

**Interfaces:**
- Produces: a tiny isolated repository with deterministic symbols and call edges suitable for all read/query tests and safe deletion of its CBM index.

- [ ] **Step 1: Create deterministic fixture functions**

Use named functions such as `addTax`, `formatInvoice`, `buildInvoice`, and `main`, with direct calls between modules.

- [ ] **Step 2: Add a minimal Git repository only when native `detect_changes` requires it**

Do not nest a `.git` directory in the main repository unless the existing test conventions explicitly permit it. Prefer validating `detect_changes` against the main fixture path as indexed under the parent repository, or document the expected no-change/error contract.

- [ ] **Step 3: Document safe cleanup**

The fixture project name must be captured from `cbm_index_repository` or `cbm_list_projects`; `cbm_delete_project` may delete only that exact name.

### Task 8: Complete offline verification and request controlled restart

**Files:**
- Modify generated directory documentation only through the canonical generator.
- No runtime process-control files are created.

**Interfaces:**
- Produces: evidence that repository target 84 is internally consistent and a restart request for the operator-managed runtime.

- [ ] **Step 1: Run targeted CBM tests**

```powershell
node _tests\smoke_cbm_cli_bridge.js
node _tests\smoke_cbm_tool_contracts.js
node _tests\smoke_cbm_loader_gate.js
node _tests\smoke_cbm_specs.js
```

- [ ] **Step 2: Run full offline suite**

```powershell
node _tests\run_all_smokes.js --skip-network
```

- [ ] **Step 3: Run syntax, JSON, and server checks**

```powershell
node server.js --self-test
git diff --check
```

Also run `node --check` for every changed JavaScript file and parse every changed JSON file.

- [ ] **Step 4: Generate directory documentation through the existing generator**

```powershell
node scripts\generate_directory_docs.js
```

Re-run affected tests afterward.

- [ ] **Step 5: Request restart**

Only after all checks pass:

```powershell
node .\scripts\request-restart.js --code=42 --reason=manual
```

Report the returned request id and stop before live inspection.

### Task 9: Validate the refreshed live surface and every native operation safely

**Files:**
- Modify workflow truth after live evidence is captured.
- Persist completion memory.

**Interfaces:**
- Consumes: operator confirmation that the connector was refreshed.
- Produces: live count 84, operational evidence for all 15 connector tools, fixture cleanup, final workflow truth, and persistent handoff memory.

- [ ] **Step 1: Verify live surface**

Confirm 84 tools and all 15 `cbm_*` names. Capture new server start id and fingerprints.

- [ ] **Step 2: Index only the dedicated fixture**

Call `cbm_index_repository` with the fixture logical path and a unique bounded name when supported.

- [ ] **Step 3: Validate all read operations**

Use the fixture project to call list/status/schema/architecture/search/query/trace/snippet/code-search/change-detection. Assertions must use actual returned project and qualified names rather than guessed values.

- [ ] **Step 4: Validate mutation operations on the fixture**

Exercise `cbm_manage_adr` and `cbm_ingest_traces` with minimal fixture-only inputs. Record structured success or a native version-specific structured error honestly.

- [ ] **Step 5: Validate destructive cleanup**

Call `cbm_delete_project` only for the exact dedicated fixture project, then confirm it is absent from `cbm_list_projects`.

- [ ] **Step 6: Reconcile workflow truth and rerun full verification**

Set live runtime/connector count to 84, store fresh identifiers, clear restart/refresh requirements, and rerun the full offline suite plus diff checks.

- [ ] **Step 7: Persist completion memory**

Save the architecture decision, tool inventory, live evidence, fixture-cleanup result, and operator-boundary rules through the shared memory tools.
