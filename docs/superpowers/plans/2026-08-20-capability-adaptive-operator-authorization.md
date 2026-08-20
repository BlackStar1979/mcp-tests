# Capability-Adaptive Operator Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore normal authenticated use of bounded TESTS_MCP mutation/process tools while preserving explicit fresh consent only for centrally classified operations that actually require it.

**Architecture:** OAuth `mcp:tools` on the internal profile is the standing authorization for the authorized bounded tool surface. `src/tool_policy.js` becomes the authority for `authorization_class` and `consent_mode`; `decision_runtime_policy` consumes those semantics and must not treat `destructive` as a blanket deny flag. `consent_runtime_policy` remains the MRTR semantic owner but is activated only by `consent_mode=mrtr_human_approval`.

**Tech Stack:** Node.js CommonJS, MCP 2026-07-28 runtime, OAuth 2.1, repository smoke scripts.

**Spec:** `docs/superpowers/specs/2026-08-20-capability-adaptive-operator-authorization-design.md`

## Global Constraints

- Preserve public-profile and OAuth scope fail-closed behavior.
- Preserve workspace/process/network implementation guards.
- Preserve the existing one-time `cbm_delete_project` confirmation path.
- Preserve MRTR binding, replay and safe-receipt semantics for explicitly MRTR-classified calls.
- Do not add per-handler process-tool exception lists.
- Do not change the 98-tool connector surface unless an independently justified schema/descriptor change is required.
- Work in the existing active branch because it contains the in-progress POL-1A closeout tree; do not fork away or discard that uncommitted context.

---

### Task 1: Recover executable test access without changing final semantics

**Files:**
- Temporary modify: `src/runtime/consent_runtime_policy.js`
- Temporary modify: `src/tool_policy.js`
- Restore both to repository source immediately after controlled runtime restart.

**Interfaces:**
- Produces: a recovery runtime in which `run_process` can execute tests while source files are restored to pre-change repository truth.

- [ ] Temporarily remove `run_process` from the process MRTR set and mark only that tool non-destructive in the runtime source.
- [ ] Request supervisor restart through the existing `_control/restart-request.json` mechanism.
- [ ] Verify the new runtime accepts a harmless `run_process` call.
- [ ] Restore the temporary source edits before writing production behavior.

### Task 2: RED — encode the corrected policy semantics

**Files:**
- Modify: `_tests/smoke_human_consent_policy.js`

**Interfaces:**
- Consumes: `getToolPolicy`, `resolveConsentRequirement`, `evaluateDecisionRuntimePolicy`.
- Produces: regression assertions that normal process and bounded workspace mutation calls are authorized by OAuth without per-call MRTR, while explicit MRTR classification and CBM deletion confirmation remain protected.

- [ ] Change default process assertions so `run_process`, `process_start`, and `process_cancel` require no fresh consent.
- [ ] Add an explicit policy override with `consent_mode: "mrtr_human_approval"` and prove it still constructs the exact existing MRTR requirement.
- [ ] Add decision-runtime assertions that authenticated internal `run_process` and `write_file` are allowed and `cbm_delete_project` still returns its confirmation challenge.
- [ ] Run `node _tests/smoke_human_consent_policy.js` and verify it fails for the current blanket policy semantics.

### Task 3: GREEN — move consent selection into the central tool policy

**Files:**
- Modify: `src/tool_policy.js`
- Modify: `src/runtime/consent_runtime_policy.js`
- Modify: `src/runtime/decision_runtime_policy.js`

**Interfaces:**
- `getToolPolicy(toolName)` produces `authorization_class` and `consent_mode`.
- `resolveConsentRequirement({toolName, toolPolicy, toolCatalog})` requires MRTR only when `toolPolicy.consent_mode === "mrtr_human_approval"`.
- `evaluateDecisionRuntimePolicy(...)` invokes tool-owned confirmation only for `consent_mode === "tool_confirmation"`; `destructive` alone never denies.

- [ ] Extend `policy()` defaults with `authorization_class: "bounded_authorized"` and `consent_mode: "none"`.
- [ ] Mark `cbm_delete_project` as `consent_mode: "tool_confirmation"`.
- [ ] Remove `PROCESS_CONSENT_TOOLS` as consent authority and gate MRTR construction on `consent_mode`.
- [ ] Replace the blanket `toolPolicy.destructive === true` deny branch with `consent_mode === "tool_confirmation"` handling; otherwise continue to normal allow.
- [ ] Run syntax checks for all changed JS files.
- [ ] Run `node _tests/smoke_human_consent_policy.js` and verify GREEN.

### Task 4: Regression reconciliation

**Files:**
- Modify only tests/spec/current-truth files whose assertions encode the superseded blanket process-consent model.
- Update: `SERVER_CONSENT_POLICY_SPEC.json` and policy coverage/current workflow docs to describe bounded OAuth authorization plus explicit consent classes.

- [ ] Search for assertions that all process tools require MRTR or all destructive tools must be denied.
- [ ] Update only active/current semantics; preserve historical acceptance evidence as historical evidence.
- [ ] Run targeted MRTR, decision-runtime, CBM confirmation, workspace mutation, OAuth scope and policy coverage smokes.
- [ ] Run `git diff --check`, directory-doc generator check and `project_truth_audit`.
- [ ] Run full offline suite `node ./_tests/run_all_smokes.js --skip-network`; expected exit 0.

### Task 5: Controlled live activation and proof

**Files:**
- Update current runtime truth/closeout docs after successful live proof.

- [ ] Set restart-required current truth only where required by the repository workflow.
- [ ] Request supervisor restart; do not start a competing server.
- [ ] Verify tool count/fingerprint remain unchanged if schemas/descriptors are unchanged.
- [ ] From the actual ChatGPT connector, run a harmless `run_process` call without `elicitation.form`; it must execute rather than return `-32021`.
- [ ] Verify `write_file` decision semantics are no longer blanket-denied using a safe bounded fixture or equivalent runtime probe.
- [ ] Re-run security negative controls and audit privacy checks.
- [ ] Commit with a policy/architecture message, push normally, and prove HEAD == upstream with a clean expected tree.
