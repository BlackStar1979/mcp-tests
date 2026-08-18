# Production MRTR Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production MCP `2026-07-28` MRTR runtime primitive that issues bounded `input_required` responses and authenticates one-time retries before any gated tool execution.

**Architecture:** `mrtr_extension.js` reuses the existing process-local state-handle store with digest-only payloads. `createMcpRuntimeHandlers()` owns one extension instance and passes it through the dispatcher to `tools_call_handler`, where a future decision-layer `mrtr_requirement` is evaluated before `tool_call_start`; current tools emit no such requirement.

**Tech Stack:** Node.js CommonJS, built-in `crypto`, existing state-handle store, current MCP runtime adapters, smoke-test harness, official `@modelcontextprotocol/client` v2 fixture.

**Spec:** `docs/superpowers/specs/2026-08-18-mrtr-production-runtime-design.md`

## Global Constraints

- Protocol target is MCP `2026-07-28`; legacy MRTR remains `not_negotiated`.
- Do not add a tool, route, task store, process store, session registry, or durable MRTR database.
- Persist only digests and safe keys; never persist raw arguments, argv, env, secrets, input responses, or auth identifiers.
- No current tool is consent-gated in this package.
- Connector surface must remain `98 / 93721a82a339f9d6` unless measured evidence proves otherwise.
- Use the supervisor-managed OAuth21 code-42 restart only after repository GREEN.

---

### Task 1: Production MRTR state machine

**Files:**
- Create: `src/runtime/mrtr_extension.js`
- Create: `_tests/smoke_mrtr_extension.js`
- Modify: `_tests/run_all_smoke_scripts.json`

**Interfaces:**
- Consumes: `createStateHandleStore`, `hashValue`, `normalizeScopes` from `state_handle_prototype.js`.
- Produces: `createMrtrExtension(options)` with `evaluate({ protocolVersion, toolName, args, authContext, requirement, requestState, inputResponses })`.

- [ ] **Step 1: Write the failing state-machine test.** Cover no-requirement pass-through, modern `input_required`, opaque state, no raw secret in state summary, exact args/tool/auth/scope/requirement binding, replay, expiry, paired retry fields, exact response keys, and legacy denial. Core shape:

```js
const mrtr = createMrtrExtension({ now: () => clock });
const first = mrtr.evaluate({ protocolVersion: "2026-07-28", toolName: "process_start", args, authContext, requirement });
assert.equal(first.status, "input_required");
assert.equal(first.result.resultType, "input_required");
const retry = mrtr.evaluate({ ...sameCall, requestState: first.result.requestState, inputResponses: { approval: { action: "accept", content: { confirmed: true } } } });
assert.equal(retry.status, "retry_ready");
```

- [ ] **Step 2: Run RED.** `node _tests/smoke_mrtr_extension.js`; expect module-not-found or missing API failure.
- [ ] **Step 3: Implement minimal bounded module.** Canonicalize JSON by sorted object keys with depth/node/byte limits; hash arguments, exact normalized scopes, and requirement; validate only bounded `elicitation/create` form requests; store only digests plus sorted request keys; consume verified state once before response-key validation.
- [ ] **Step 4: Run GREEN.** `node _tests/smoke_mrtr_extension.js`; expect `smoke_mrtr_extension ok`.
- [ ] **Step 5: Syntax check.** `node --check src/runtime/mrtr_extension.js`.

### Task 2: Runtime integration before execution

**Files:**
- Create: `_tests/smoke_mrtr_runtime_integration.js`
- Modify: `src/runtime/mcp_runtime_handlers.js`
- Modify: `src/runtime/rpc_message_dispatcher.js`
- Modify: `src/runtime/tools_call_handler.js`
- Modify: `_tests/run_all_smoke_scripts.json`

**Interfaces:**
- `createMcpRuntimeHandlers({ ..., mrtrExtension? })` defaults to one production MRTR instance.
- `dispatchRpcMessage({ ..., mrtrExtension })` forwards it only to `tools/call`.
- `handleToolsCall` evaluates `decision.mrtr_requirement || null` after input validation and before `tool_call_start`.

- [ ] **Step 1: Write failing integration test.** Inject a decision/extension requirement for a fake optional tool whose `execute()` increments a counter. First call must return `input_required` with counter `0`; accepted retry must reach execution exactly once; legacy requirement must fail with counter `0`.
- [ ] **Step 2: Run RED.** `node _tests/smoke_mrtr_runtime_integration.js`; expect current handler to execute immediately or ignore the injected extension.
- [ ] **Step 3: Wire the extension.** If `evaluate()` returns `not_required` or `retry_ready`, continue; if `input_required`, return `rpcResult(id, result)` without `tool_call_start`; if denied, return deterministic `rpcError` with closed MRTR reason codes. Never audit raw state/responses.
- [ ] **Step 4: Run GREEN.** Run the new integration smoke plus `smoke_mcp_runtime_handlers.js`, `smoke_rpc_message_dispatcher_lazy_tools.js`, and `smoke_mrtr_conformance_fixture.js`.
- [ ] **Step 5: Verify existing input validation.** Invalid tool arguments must still produce SEP-1303 tool error before MRTR state is issued.

### Task 3: Capability truth and regression guards

**Files:**
- Modify: `src/runtime/protocol_capability_registry.js`
- Modify: `SERVER_PROTOCOL_CAPABILITY_SPEC.json`
- Modify: targeted protocol/capability smoke(s) discovered by current source search.

**Interfaces:** modern module value becomes `mrtr_extension`; legacy remains `not_negotiated`.

- [ ] **Step 1: Add failing assertions** that modern capability truth points to `mrtr_extension`, repository status is implemented, and the official fixture remains evidence rather than the production implementation.
- [ ] **Step 2: Run RED** on those protocol guards.
- [ ] **Step 3: Update canonical capability truth** without claiming live activation before restart and without adding an extension/tool descriptor.
- [ ] **Step 4: Run GREEN** on protocol/spec/root consistency guards and `git diff --check`.

### Task 4: Repository validation and controlled live load

**Files:** only canonical workflow/current-truth documents that must change after evidence; keep `_workflow/state.json` under its size guard.

- [ ] **Step 1: Run targeted suite** for MRTR, runtime dispatch, official SDK fixture, policy gates, Tasks, and state-handle behavior.
- [ ] **Step 2: Run syntax/static checks** for every changed JS/JSON and `git diff --check`.
- [ ] **Step 3: Run full smoke durably:** `node ./_tests/run_all_smokes.js --skip-network`; require all public/authenticated checks GREEN.
- [ ] **Step 4: Run deployment classification** with `deploy_decision_guard`; require runtime restart classification and no connector refresh when fingerprints are unchanged.
- [ ] **Step 5: Commit repo-GREEN implementation** before runtime mutation.
- [ ] **Step 6: Controlled restart** through the supervisor code-42 mechanism; verify a new `server_start_id`, healthy OAuth21 runtime, 98 tools, and combined fingerprint `93721a82a339f9d6`.
- [ ] **Step 7: Record live-loaded-dormant MRTR truth.** Do not claim human-consent enforcement yet; no current decision emits `mrtr_requirement`.
- [ ] **Step 8: Re-run final guards/full suite on the exact tracked closeout tree, rebuild the knowledge index, commit/push, and verify clean `HEAD == origin`.

## Self-review

- Design requirements map to Tasks 1-4.
- No consent classification is introduced before `POL-1A-CONSENT`.
- The only new mutable MRTR state is the existing bounded in-memory state-handle store.
- Retry binding covers request, principal, exact scopes, policy requirement, expiry, and one-time use.
- Connector descriptors remain unchanged by design.
