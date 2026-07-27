# Codebase-Memory v0.9.0 Compatibility Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebaseline the existing 15-tool CBM connector against local `codebase-memory-mcp 0.9.0`, harden compatibility and containment, make telemetry explicit, and replace the dead destructive-tool policy with bounded confirmation.

**Architecture:** A checked-in v0.9.0 contract manifest is loaded by a registry module. The CLI bridge owns executable identity, compatibility checks, native containment, concurrency, telemetry, and normalized failures. Runtime policy owns authenticated destructive confirmation before the existing `cbm_delete_project` executes.

**Tech Stack:** Node.js CommonJS, JSON Schema, existing runtime policy modules, local static CBM executable, smoke-test harness.

## Global Constraints

- Keep 15 connector-visible `cbm_*` tools: 14 native plus `cbm_status`.
- Do not add tools absent from local v0.9.0 help.
- Do not start, stop, or replace the server or supervisor directly.
- Request restart only with `node .\scripts\request-restart.js --code=42 --reason=manual`.
- Do not delete or overwrite the default CBM cache.
- Do not index outside authorized workspace roots.

### Task 1: Capture and verify the v0.9.0 native contract

**Files:** create `scripts/capture_cbm_contract.js`, `src/integrations/codebase_memory/contracts/v0.9.0.json`, `src/integrations/codebase_memory/cbm_contract_registry.js`, `_tests/smoke_cbm_contract_manifest.js`; modify `_tests/run_all_smoke_scripts.json`.

**Interfaces:** produce `loadCbmContract(version)`, `compareCbmVersion(version)`, and `evaluateCbmCompatibility({version,nativeTools,executableSha256})`.

- [ ] Write the failing manifest smoke expecting v0.9.0, 14 ordered tools, exact required flags, and all compatibility states.
- [ ] Run `node _tests/smoke_cbm_contract_manifest.js`; expect missing-module failure.
- [ ] Implement bounded capture using `--version`, top-level `--help`, and `cli <tool> --help`.
- [ ] Generate the v0.9.0 manifest from the local executable.
- [ ] Implement the registry without runtime process spawning.
- [ ] Run targeted smoke and syntax checks; expect PASS.

### Task 2: Make executable probing identity-aware

**Files:** modify `cbm_cli_bridge.js`, `codebase_memory_tools.js`, `_tests/smoke_cbm_cli_bridge.js`, and `_tests/smoke_cbm_tool_contracts.js`.

- [ ] Extend the fake executable so version and file metadata can change after first probe.
- [ ] Assert unchanged identity reuses one probe and changed identity triggers another.
- [ ] Assert compatible, binary-variant, newer-version, and contract-mismatch states.
- [ ] Run targeted tests; expect RED.
- [ ] Add identity `{path,size,mtime_ms,sha256}`, cache invalidation, manifest comparison, and status fields.
- [ ] Run targeted tests; expect GREEN.

### Task 3: Add containment, bounded concurrency, telemetry, and stable errors

**Files:** modify `cbm_cli_bridge.js`, `codebase_memory_tools.js`, and `_tests/smoke_cbm_cli_bridge.js`.

- [ ] Add failing assertions for `CBM_ALLOWED_ROOT`, three simultaneous heavy reads, queue timing, partial results, timeout, malformed JSON, and native rejection.
- [ ] Implement a two-slot heavy-read semaphore; queue wait counts against the timeout budget.
- [ ] Add `queue_wait_ms`, `execution_ms`, `binary_version`, `compatibility_status`, `partial_success`, and `warnings` to every native envelope.
- [ ] Inject `CBM_ALLOWED_ROOT` from the authorized workspace root.
- [ ] Normalize failures to stable `cbm_*` codes and preserve bounded diagnostics.
- [ ] Run targeted tests; expect GREEN.

### Task 4: Implement bounded destructive confirmation

**Files:** create `src/runtime/destructive_tool_confirmation.js` and `_tests/smoke_cbm_delete_confirmation.js`; modify entry/single/batch dispatchers, decision context/policy, tools-call handler, schema, policy guards, and smoke manifest.

**Interface:** reuse `createStateHandleStore` with kind `cbm_delete_project_confirmation`, TTL 120000 ms. Input becomes `{project, confirm?, state_handle?}`.

- [ ] Write tests for challenge creation, wrong project, wrong subject/client, expiry, replay, missing confirm, and successful second call.
- [ ] Run tests; expect current `destructive_tool_denied` failure.
- [ ] Plumb sanitized auth context from `authResult` through single and batch RPC contexts.
- [ ] Add only project/confirm/state-handle fields needed by destructive policy; do not expose arbitrary args in audit context.
- [ ] Implement one-time, subject/client/profile-bound challenge validation and consume before native execution.
- [ ] Keep all other destructive tools denied.
- [ ] Run targeted policy and delete-confirmation smokes; expect GREEN.

### Task 5: Align descriptors and canonical specs

**Files:** modify `cbm_tools.js`, `SERVER_TOOLS_SPEC.json`, `SERVER_RESOURCE_POLICY_SPEC.json`, `SERVER_OUTPUT_DLP_POLICY_SPEC.json`, `SERVER_RUNTIME_CONFIG_SPEC.json`, CBM specs/tests, and affected descriptor/policy guards.

- [ ] Add failing assertions for v0.9.0, new status/envelope fields, allowed-root containment, stable errors, and conditional destructive confirmation.
- [ ] Update schemas and canonical specs in place.
- [ ] Preserve authenticated count 84 and CBM count 15.
- [ ] Run all CBM and policy smokes; expect GREEN.

### Task 6: Update active workflow truth

**Files:** modify `_workflow/state.json`, `STATE.md`, `READINESS.md`, `ROADMAP.md`, `ACTIVE_WORKFLOW_INDEX.md`, `WORKFLOW_CANON.md`, and only current-state guards.

- [ ] Record repository readiness for v0.9.0 while live runtime remains pre-restart until controlled restart.
- [ ] Record executable identity and restart requirement.
- [ ] Preserve v0.8.1 live evidence as historical evidence.
- [ ] Run workflow truth and documentation guards.

### Task 7: Repository verification and controlled rollout

- [ ] Run `node _tests/run_all_smokes.js --skip-network`.
- [ ] Run `node server.js --self-test`.
- [ ] Check syntax of all changed JS and parse all changed JSON.
- [ ] Run `git diff --check`.
- [ ] Confirm profile assembly remains optional 82, total 84, CBM 15.
- [ ] Confirm local executable reports v0.9.0 and matches the manifest.
- [ ] Request restart only with `node .\scripts\request-restart.js --code=42 --reason=manual` and report the request ID.

### Task 8: Isolated live v0.9.0 rebaseline

- [ ] After operator connector refresh confirmation, verify `cbm_status.version = 0.9.0` and accepted compatibility.
- [ ] Use an empty dedicated `CBM_CACHE_DIR`; do not alter default cache.
- [ ] Fully index `mcp-tests`, `papers-memory-mcp`, and `autonomous_llm_handbook` from scratch.
- [ ] Run every tool at least twice per repository with negative controls.
- [ ] Retest architecture path scope, same-name graph search, Cypher aggregation, trace disambiguation/recursion, search concurrency, `detect_changes` scope/since, ADR preservation, trace graph delta, and partial index reporting.
- [ ] Test deletion only on the disposable fixture index through two-phase confirmation.
- [ ] Record v0.9.0 verdicts, distinguish upstream defects from bridge defects, update workflow truth, and persist memory.

## Self-review

- Every accepted design requirement maps to Tasks 1-8.
- No connector-visible tool is added.
- Default cache is never deleted or overwritten.
- Destructive confirmation is authenticated, project-bound, short-lived, and one-time.
- Live v0.9.0 claims require fresh indexes and post-restart evidence.
