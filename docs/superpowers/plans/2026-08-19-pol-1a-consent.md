# POL-1A Human Consent Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bind `run_process`, `process_start`, and `process_cancel` to server-verifiable human approval through production MCP `2026-07-28` MRTR without changing the 98-tool connector surface.

**Architecture:** `decision_runtime_policy.js` classifies consent-required calls and attaches a deterministic MRTR requirement. New `consent_runtime_policy.js` owns consent requirement construction, response interpretation, and safe receipts. Existing `mrtr_extension.js` remains the exact-call-bound protocol/state mechanism and gains per-request form-elicitation capability enforcement. `tools_call_handler.js` composes these gates before any execution side effect.

**Tech Stack:** Node.js/CommonJS, JSON root specs, existing hermetic smoke harness, MCP `2026-07-28`, existing state-handle prototype, existing OAuth21 supervisor/restart control plane.

**Spec:** `docs/superpowers/specs/2026-08-19-pol-1a-consent-design.md`

## Global Constraints

- Modern protocol authority is MCP `2026-07-28`.
- `elicitation: {}` is valid implicit form support; URL-only elicitation is not form support.
- Missing form capability for a required form input MUST return `-32021` with `data.requiredCapabilities = { elicitation: { form: {} } }`.
- Model-supplied `confirm=true` MUST NOT constitute human approval.
- Consent MUST be bound to the exact tool, canonical argument digest, exact normalized scope digest, authenticated owner/client boundary, and complete requirement digest.
- MRTR state remains process-local, one-time, short-lived, and backed by the existing state-handle store.
- Raw arguments, argv, env, secrets, requestState, inputRequests, inputResponses, elicitation content, auth identifiers, canonical argument digests, and exact scope digests MUST NOT leave the owner-bound MRTR state record or appear in audit/consent receipts.
- Invalid tool arguments MUST fail before a consent prompt.
- The package MUST NOT add a tool or change connector input/output/descriptor schemas.
- Expected authenticated tool count remains `98`; expected combined fingerprint remains `93721a82a339f9d6`.
- Destructive tools outside the selected process consent class MUST NOT gain new execution rights.
- No live-accepted claim before controlled restart and live verification.

---

### Task 0: Materialize and commit the approved design and plan

**Files:**
- Create: `docs/superpowers/specs/2026-08-19-pol-1a-consent-design.md`
- Create: `docs/superpowers/plans/2026-08-19-pol-1a-consent.md`
- Modify generated directory maps required by the repository generator

**Interfaces:**
- Produces: the binding design authority and execution plan for every later task.

- [ ] **Step 1: Verify the repository baseline before importing the documents**

Require the current feature branch to be clean and synchronized at or descended from MRTR closeout `7deb418fc9fbf29985675fa8ce4b6d64938888f0`. If unrelated local changes exist, stop rather than overwrite them.

- [ ] **Step 2: Create the approved design and plan in their canonical repository paths**

Copy the approved artifacts verbatim into:

```text
docs/superpowers/specs/2026-08-19-pol-1a-consent-design.md
docs/superpowers/plans/2026-08-19-pol-1a-consent.md
```

The protocol correction is binding: `elicitation: {}` is implicit form support, while top-level `{}` client capabilities and URL-only elicitation are insufficient.

- [ ] **Step 3: Regenerate and check directory maps**

Run the canonical directory-doc generator, then its `--check` mode. Do not hand-edit generated directory entries.

- [ ] **Step 4: Run documentation guards and diff hygiene**

Run the operator-contract/directory documentation smokes that cover Superpowers design/plan registration, then:

```bash
git diff --check
```

Expected: all exit `0`.

- [ ] **Step 5: Commit the design boundary before production code**

```bash
git add docs/superpowers/specs/2026-08-19-pol-1a-consent-design.md docs/superpowers/plans/2026-08-19-pol-1a-consent.md docs/superpowers/specs/DIRECTORY.md docs/superpowers/plans/DIRECTORY.md
git commit -m "docs(policy): design MRTR human consent boundary"
```

Include any other generator-owned directory map only if the generator actually changed it.

---

### Task 1: Correct MRTR per-request elicitation capability enforcement

**Files:**
- Modify: `src/runtime/mrtr_extension.js`
- Modify: `src/runtime/tools_call_handler.js`
- Modify: `_tests/smoke_mrtr_extension.js`
- Modify: `_tests/smoke_mrtr_runtime_integration.js`
- Test: `_tests/smoke_mrtr_extension.js`
- Test: `_tests/smoke_mrtr_runtime_integration.js`

**Interfaces:**
- Consumes: `context.requestMetadata.clientCapabilities` produced by `request_metadata_policy.js`.
- Produces: MRTR `evaluate()` accepts `clientCapabilities`; missing required form support returns a distinct protocol-capability outcome carrying `requiredCapabilities`.

- [ ] **Step 1: Add RED unit coverage for form capability semantics**

Add cases to `_tests/smoke_mrtr_extension.js` proving that a requirement containing form `elicitation/create` behaves as follows:

```js
const required = { elicitation: { form: {} } };

// No optional capabilities: reject.
assert.equal(evaluateWithCaps({}).status, "missing_client_capability");
assert.deepEqual(evaluateWithCaps({}).requiredCapabilities, required);

// Backward-compatible implicit form support: accept.
assert.equal(evaluateWithCaps({ elicitation: {} }).status, "input_required");

// Explicit form support: accept.
assert.equal(evaluateWithCaps({ elicitation: { form: {} } }).status, "input_required");

// URL-only client cannot satisfy form request.
assert.equal(evaluateWithCaps({ elicitation: { url: {} } }).status, "missing_client_capability");
```

- [ ] **Step 2: Run the MRTR unit smoke and verify RED**

Run:

```bash
node _tests/smoke_mrtr_extension.js
```

Expected: FAIL because `mrtr_extension.evaluate()` does not yet consume `clientCapabilities` or emit `missing_client_capability`.

- [ ] **Step 3: Implement minimal capability detection in `mrtr_extension.js`**

Add a bounded helper with this behavior:

```js
function supportsFormElicitation(clientCapabilities) {
  if (!isPlainObject(clientCapabilities)) return false;
  const elicitation = clientCapabilities.elicitation;
  if (!isPlainObject(elicitation)) return false;
  if (isPlainObject(elicitation.form)) return true;
  return !Object.hasOwn(elicitation, "url");
}
```

Before state creation, after validating the required input requests, detect whether any request is form elicitation. If form support is missing, return:

```js
{
  status: "missing_client_capability",
  requiredCapabilities: { elicitation: { form: {} } },
  audit: { reason_code: "mrtr_form_elicitation_capability_missing" }
}
```

Do not create state on this path.

- [ ] **Step 4: Run the MRTR unit smoke and verify GREEN**

Run:

```bash
node _tests/smoke_mrtr_extension.js
```

Expected: PASS.

- [ ] **Step 5: Add RED runtime integration coverage for wire error `-32021`**

Change the existing MRTR integration fixture so form-capable requests declare:

```js
"io.modelcontextprotocol/clientCapabilities": {
  elicitation: {}
}
```

Add a separate call using `{}` capabilities and assert:

```js
assert.equal(result.error.code, -32021);
assert.deepEqual(result.error.data.requiredCapabilities, {
  elicitation: { form: {} },
});
assert.equal(executions, 0);
```

Also assert no `tool_call_start` and no MRTR state issuance audit for the capability-missing call.

- [ ] **Step 6: Run the runtime integration smoke and verify RED**

Run:

```bash
node _tests/smoke_mrtr_runtime_integration.js
```

Expected: FAIL because `tools_call_handler.js` does not pass per-request capabilities or map the new outcome to `-32021`.

- [ ] **Step 7: Wire current request capabilities and protocol error mapping**

Pass:

```js
clientCapabilities: context.requestMetadata?.clientCapabilities || {},
```

to `mrtrExtension.evaluate()`.

Handle `missing_client_capability` before generic MRTR denial:

```js
return rpcError(id, -32021, "Missing required client capability", {
  requiredCapabilities: mrtr.requiredCapabilities,
});
```

Audit only a bounded reason code and safe tool/protocol metadata.

- [ ] **Step 8: Verify Task 1**

Run:

```bash
node --check src/runtime/mrtr_extension.js
node --check src/runtime/tools_call_handler.js
node _tests/smoke_mrtr_extension.js
node _tests/smoke_mrtr_runtime_integration.js
```

Expected: all exit `0`.

- [ ] **Step 9: Commit Task 1**

```bash
git add src/runtime/mrtr_extension.js src/runtime/tools_call_handler.js _tests/smoke_mrtr_extension.js _tests/smoke_mrtr_runtime_integration.js
git commit -m "fix(protocol): enforce MRTR elicitation capability"
```

---

### Task 2: Add deterministic consent classification and MRTR requirement construction

**Files:**
- Create: `src/runtime/consent_runtime_policy.js`
- Create: `_tests/smoke_human_consent_policy.js`
- Modify: `src/runtime/decision_runtime_policy.js`
- Modify: `_tests/run_all_smoke_scripts.json`
- Modify: `SERVER_CONSENT_POLICY_SPEC.json`

**Interfaces:**
- Produces: `resolveConsentRequirement({ toolName, toolPolicy }) -> { required, ok, requirement?, reason? }`.
- Produces: `verifyConsentResponse({ requirement, inputResponses, mrtrAudit }) -> { status, code?, reason?, receipt? }` for Task 3.
- `decision_runtime_policy.js` attaches `mrtr_requirement` only for selected process tools.

- [ ] **Step 1: Write RED consent classification tests**

Create `_tests/smoke_human_consent_policy.js` with assertions that:

```js
for (const tool of ["run_process", "process_start", "process_cancel"]) {
  const result = resolveConsentRequirement({ toolName: tool, toolPolicy: getToolPolicy(tool) });
  assert.equal(result.required, true);
  assert.equal(result.ok, true);
  assert.equal(result.requirement.kind, "human_consent_v1");
  assert.equal(result.requirement.consent.risk_class, "high");
  assert.equal(result.requirement.consent.external_origin, null);
  assert.deepEqual(result.requirement.consent.scope_delta, []);
  assert.equal(result.requirement.inputRequests.human_approval.method, "elicitation/create");
}
```

Assert catalog-derived resource/operation values:

```js
assert.equal(run.requirement.consent.resource_class, "process_execution_bounded");
assert.equal(run.requirement.consent.operation_class, "execute");
assert.equal(cancel.requirement.consent.resource_class, "process_job_control");
assert.equal(cancel.requirement.consent.operation_class, "cancel");
```

Assert a read-only tool returns `{ required: false, ok: true }` and a deliberately missing catalog entry for a consent tool fails closed through an injected catalog parameter or equivalent test seam.

- [ ] **Step 2: Run the new smoke and verify RED**

Run:

```bash
node _tests/smoke_human_consent_policy.js
```

Expected: FAIL because `consent_runtime_policy.js` does not exist.

- [ ] **Step 3: Implement `consent_runtime_policy.js` classification**

Define:

```js
const CONSENT_REQUIREMENT_KIND = "human_consent_v1";
const CONSENT_RESPONSE_KEY = "human_approval";
const PROCESS_CONSENT_TOOLS = new Set(["run_process", "process_start", "process_cancel"]);
```

Load `SERVER_TOOLS_SPEC.json` as the default catalog authority. Build the deterministic requirement exactly from catalog resource/operation metadata. Use the fixed `risk_class: "high"`, `scope_delta: []`, and `external_origin: null` for this package.

Construct a bounded deterministic message containing all six UI-visible consent fields and the question `Approve this exact call?`.

- [ ] **Step 4: Run the consent policy smoke and verify classification GREEN**

Run:

```bash
node --check src/runtime/consent_runtime_policy.js
node _tests/smoke_human_consent_policy.js
```

Expected: PASS for classification tests; response-verification tests may still be absent at this task boundary.

- [ ] **Step 5: Write RED decision-runtime tests**

Extend the appropriate decision-runtime smoke (`_tests/smoke_decision_runtime_shim_implementation.js` or the nearest current policy-specific smoke) to prove:

```js
const decision = evaluateDecisionRuntimePolicy({ decisionContext: processContext });
assert.equal(decision.allow, true);
assert.deepEqual(decision.decision_meta.reason_codes, ["human_consent_required"]);
assert.equal(decision.mrtr_requirement.kind, "human_consent_v1");
```

Assert the old `guarded_process_execution` reason is absent. Assert unrelated read-only calls still return `explicit_policy_allow` and destructive tools outside the consent class do not gain new allow behavior.

- [ ] **Step 6: Run the policy smoke and verify RED**

Expected: FAIL because process tools still return the unconditional guarded-process bypass.

- [ ] **Step 7: Replace the process bypass with consent requirement emission**

In `decision_runtime_policy.js`, call `resolveConsentRequirement()` for the selected process tools. On a valid requirement return the existing allow envelope plus:

```js
mrtr_requirement: consent.requirement,
decision_meta: {
  policy: "decision-runtime-policy-v3",
  reason_codes: ["human_consent_required"],
},
```

If consent classification says required but cannot build a valid requirement, deny with `consent_requirement_invalid`.

Do not change the unrelated destructive-tool deny branch or the current CBM confirmation path.

- [ ] **Step 8: Update the canonical consent policy spec**

Change `SERVER_CONSENT_POLICY_SPEC.json` from a pure runtime-gap statement to explicit partial implementation truth:

- process execution/cancel uses production MRTR human consent;
- unsupported clients fail closed;
- model confirmation is not human approval;
- scope elevation/new-origin/secret access remain separate fail-closed or unimplemented classes;
- CBM confirmation is not claimed as generalized human consent.

Do not mark live activation yet.

- [ ] **Step 9: Register the new smoke and verify Task 2**

Add `_tests/smoke_human_consent_policy.js` to `_tests/run_all_smoke_scripts.json` in the authenticated section.

Run targeted policy/protocol smokes and syntax checks. Expected: all exit `0`.

- [ ] **Step 10: Commit Task 2**

```bash
git add src/runtime/consent_runtime_policy.js src/runtime/decision_runtime_policy.js SERVER_CONSENT_POLICY_SPEC.json _tests/smoke_human_consent_policy.js _tests/run_all_smoke_scripts.json _tests/smoke_decision_runtime_shim_implementation.js
git commit -m "feat(policy): classify process calls for human consent"
```

---

### Task 3: Interpret human consent after MRTR and emit a safe server-verifiable receipt

**Files:**
- Modify: `src/runtime/consent_runtime_policy.js`
- Modify: `src/runtime/mrtr_extension.js`
- Modify: `src/runtime/tools_call_handler.js`
- Modify: `SERVER_EVENT_CATALOG_SPEC.json`
- Modify: `_tests/smoke_human_consent_policy.js`
- Modify: `_tests/smoke_mrtr_runtime_integration.js`
- Modify: `_tests/smoke_mcp_protocol_compliance_guards.js`

**Interfaces:**
- Consumes: `mrtr.inputResponses` plus safe MRTR audit digests.
- Produces: `verifyConsentResponse()` accepted/denied outcome and `human-consent-receipt-v1`.

- [ ] **Step 1: Write RED semantic consent tests**

In `_tests/smoke_human_consent_policy.js`, cover exactly:

```js
accept + { confirmed: true }   -> accepted
accept + { confirmed: false }  -> denied
accept + missing content       -> denied
accept + missing confirmed     -> denied
accept + extra content key     -> denied
decline                        -> denied
cancel                         -> denied
wrong/missing response key     -> denied
```

For accepted response, assert receipt fields include only version/outcome/tool/resource/operation/risk/scope_delta/external_origin, `state_handle_sha256`, `requirement_sha256`, and `binding_verified: true`.

- [ ] **Step 2: Run the consent policy smoke and verify RED**

Expected: FAIL because response verification is not implemented.

- [ ] **Step 3: Implement strict response interpretation and receipt building**

`verifyConsentResponse()` must return `not_required` for non-consent requirements, `accepted` only for the exact confirmed shape, and deterministic denial codes for every other shape.

Do not accept truthy values, strings, extra fields, model-provided arguments, or a previous receipt.

- [ ] **Step 4: Preserve exact-call verification without exporting value digests**

Do not expose `arguments_sha256` or `scope_sha256` from the MRTR state record. Keep those values internal to exact-call verification. The consent receipt may carry only the existing safe `state_handle_sha256`, `requirement_sha256`, classification fields, and `binding_verified: true` after MRTR authenticates and consumes the state.

Add tests that serialize MRTR/consent audit and prove canonical argument/scope digests are absent.

- [ ] **Step 5: Write RED runtime execution-boundary tests**

In `_tests/smoke_mrtr_runtime_integration.js`, change the fake decision/MRTR path or use the real consent policy seam so that:

- initial process call returns `input_required`, executions = 0;
- accepted retry with `confirmed: true` executes once;
- false/decline/cancel each execute zero times;
- consent denial emits no `tool_call_start`;
- accepted retry emits `tool_call_consent_accepted` before `tool_call_start`;
- consent receipt contains classification, `state_handle_sha256`, `requirement_sha256`, and `binding_verified: true` only;
- raw command arguments, request state, input response content, canonical argument digest, and exact scope digest are absent from serialized consent audit;
- a decision carrying `mrtr_requirement` with no `mrtrExtension` denies before `tool_call_start`;
- a decision carrying `mrtr_requirement` whose MRTR extension returns `not_required` denies before `tool_call_start`.

- [ ] **Step 6: Run runtime integration and verify RED**

Expected: FAIL because `tools_call_handler.js` currently treats any MRTR `retry_ready` as execution-ready.

- [ ] **Step 7: Gate execution on `verifyConsentResponse()`**

After MRTR returns `retry_ready` and before `tool_call_start`:

```js
const consent = verifyConsentResponse({
  requirement: decision.mrtr_requirement,
  inputResponses: mrtr.inputResponses,
  mrtrAudit: mrtr.audit,
});
```

For denial, emit bounded `tool_call_consent_denied` and return `-32602` with a safe `decision_code` and bounded `reason_codes`. For acceptance, emit `tool_call_consent_accepted` carrying the safe receipt, then continue to `tool_call_start`.

Before invoking MRTR, if `decision.mrtr_requirement` is present and `mrtrExtension` is missing, fail closed with `mrtr_extension_required`. If a supplied requirement receives `mrtr.status === "not_required"`, fail closed with `mrtr_required_but_not_applied`. Neither path may reach Tasks or tool execution.

- [ ] **Step 8: Update the event catalog and protocol guard**

Add:

```text
tool_call_consent_accepted
tool_call_consent_denied
```

with privacy boundaries that prohibit raw state/responses/arguments/auth data/secrets plus canonical argument/scope digests, and allow only classification fields, `state_handle_sha256`, `requirement_sha256`, `binding_verified`, reason codes, and duration.

Update the protocol compliance smoke so literal runtime events remain catalog-covered.

- [ ] **Step 9: Verify Task 3 targeted suite**

Run:

```bash
node --check src/runtime/consent_runtime_policy.js
node --check src/runtime/mrtr_extension.js
node --check src/runtime/tools_call_handler.js
node _tests/smoke_human_consent_policy.js
node _tests/smoke_mrtr_extension.js
node _tests/smoke_mrtr_runtime_integration.js
node _tests/smoke_mcp_protocol_compliance_guards.js
```

Expected: all exit `0`.

- [ ] **Step 10: Commit Task 3**

```bash
git add src/runtime/consent_runtime_policy.js src/runtime/mrtr_extension.js src/runtime/tools_call_handler.js SERVER_EVENT_CATALOG_SPEC.json _tests/smoke_human_consent_policy.js _tests/smoke_mrtr_runtime_integration.js _tests/smoke_mcp_protocol_compliance_guards.js
git commit -m "feat(policy): enforce MRTR human consent before execution"
```

---

### Task 4: Prove exact-call, privacy, Tasks, legacy, and no-surface regressions

**Files:**
- Modify: `_tests/smoke_human_consent_policy.js`
- Modify: `_tests/smoke_mrtr_extension.js`
- Modify: `_tests/smoke_mrtr_runtime_integration.js`
- Modify: `_tests/smoke_mcp_tasks_process_adapter.js` if needed for a consent-preexecution assertion
- Modify: `_tests/smoke_tool_surface_fingerprints.js` only if an explicit consent invariant belongs there; expected fingerprints MUST NOT change

**Interfaces:**
- No new production interface. This task hardens acceptance evidence.

- [ ] **Step 1: Add RED exact-call and replay cases**

Cover state rejection for changed tool, canonical arguments, auth owner/client, exact scope, requirement content, expiry, replay, missing retry pair, extra/missing response keys, and malformed responses.

Use existing MRTR state tests where they already prove an invariant; do not duplicate identical coverage. Add only the consent-specific cross-layer cases that are missing.

- [ ] **Step 2: Add RED no-side-effect cases**

Prove a process consent round creates no Task/job/execution before accepted consent. For Task-capable calls, the MRTR consent gate must run before `tryStartTaskAugmentedToolCall()`.

- [ ] **Step 3: Add RED legacy behavior cases**

A legacy process request that now requires consent must fail closed before execution. A legacy unrelated read-only call remains unchanged.

- [ ] **Step 4: Add privacy scans**

Inject canary values in command args/env/response content/requestState and assert they do not appear in MRTR state summaries, consent receipts, or serialized audit events.

- [ ] **Step 5: Verify no connector-surface change**

Run current fingerprint/surface smokes and assert the governed values remain:

```text
authenticated tool count: 98
combined fingerprint: 93721a82a339f9d6
```

A changed fingerprint is a defect to investigate, not a new expected value.

- [ ] **Step 6: Run the targeted regression set**

Run MRTR, process/Tasks, decision-runtime, event-catalog, privacy/redaction, connector-surface, and protocol compliance smokes. Expected: all exit `0`.

- [ ] **Step 7: Commit Task 4**

```bash
git add _tests/
git commit -m "test(policy): harden human consent regressions"
```

---

### Task 5: Repository pre-deploy truth, complete suite, and deploy classification

**Files:**
- Modify as required by generated documentation: `docs/superpowers/specs/DIRECTORY.md`, `docs/superpowers/plans/DIRECTORY.md`, affected directory maps
- Modify workflow truth only to repo-validated/pre-deploy status; do not claim live acceptance yet
- Create later closeout record only after live proof

**Interfaces:**
- Consumes: completed Tasks 1-4.
- Produces: one exact pre-deploy GREEN commit suitable for controlled restart.

- [ ] **Step 1: Regenerate/check directory documentation after production changes**

Run the repository's canonical directory-doc generator, then its `--check` mode. Only generated map changes are allowed.

- [ ] **Step 2: Update repo-only workflow truth**

Set consent status to repository-implemented / restart-required where appropriate. Preserve `next_primary` until live acceptance is complete unless current workflow rules explicitly advance only after repo validation.

Do not write a live server start id or claim connector acceptance before restart.

- [ ] **Step 3: Run syntax and diff hygiene**

```bash
git diff --check
```

Run `node --check` over every changed JavaScript file.

- [ ] **Step 4: Run project truth and directory checks**

Use `project_truth_audit`, directory generator `--check`, and knowledge-index freshness checks. Resolve any current-truth drift before full suite.

- [ ] **Step 5: Run the complete offline smoke suite through durable process execution**

Use `process_start` for:

```bash
node ./_tests/run_all_smokes.js --skip-network
```

Poll with `process_status`/`process_output` until terminal. Expected: `ok=true`, public count unchanged, authenticated count increased only by newly registered smoke files, exit `0`.

- [ ] **Step 6: Classify deployment**

Run `deploy_decision_guard` on the exact changed-file set. Expected class: runtime restart required, connector refresh false, operator approval according to current deployment policy.

If connector refresh becomes true or governed fingerprints differ, stop and investigate.

- [ ] **Step 7: Commit exact pre-deploy tree**

Commit only after Steps 3-6 are GREEN:

```bash
git commit -m "feat(policy): add server-verifiable human consent"
```

Record the exact commit SHA for live-load evidence.

---

### Task 6: Controlled live activation and semantic acceptance

**Files:**
- Runtime control state only through existing supervisor mechanism
- No source edit during restart/probe

**Interfaces:**
- Consumes: exact pre-deploy commit from Task 5.
- Produces: live runtime identity and consent semantic proof.

- [ ] **Step 1: Request the controlled OAuth21 supervisor restart**

Use the repository's existing restart request mechanism with reason `pol-1a-consent-activation`. Do not launch a competing server on port 3008.

- [ ] **Step 2: Verify restart recovery**

Confirm the durable restart job reports terminal success/recovery and capture the new `server_start_id`.

- [ ] **Step 3: Verify health and unchanged surface**

Confirm:

```text
health = 200
version = 0.40.0
tools_count = 98
combined_fingerprint = 93721a82a339f9d6
connector_refresh_required_now = false
```

- [ ] **Step 4: Perform live semantic consent probes**

On the restarted production runtime, prove at least:

1. a consent-required process call without form elicitation capability gets `-32021` and does not execute;
2. a form-capable call returns `input_required` and does not execute;
3. retry with decline/false does not execute;
4. retry with accepted `confirmed: true` executes exactly once;
5. replay is rejected;
6. connector remains callable after the sequence.

Use only bounded harmless process commands for live proof.

- [ ] **Step 5: Inspect safe audit evidence**

Confirm consent acceptance/denial records contain safe classification/digests and no canary/raw response/requestState/argv/env/auth identifiers.

- [ ] **Step 6: Do not refresh the connector unless measured surface truth requires it**

The expected surface is unchanged. A refresh is a non-action unless actual descriptor/schema drift is detected.

---

### Task 7: Live closeout, final full suite, push, and clean-tree proof

**Files:**
- Create: `_workflow/operator_decisions/pol_1a_consent_closeout.md`
- Modify: `_workflow/READINESS.md`
- Modify: `_workflow/ROADMAP.md`
- Modify: `_workflow/STATE.md`
- Modify: `_workflow/WORKFLOW_CANON.md`
- Modify: `_workflow/ACTIVE_WORKFLOW_INDEX.md`
- Modify: `_workflow/state.json`
- Modify: `SERVER_CONSENT_POLICY_SPEC.json` only for live status/evidence if that spec carries live truth
- Modify generated directory maps as required
- Modify current-truth smoke baselines that intentionally encode the active package/count

**Interfaces:**
- Consumes: live acceptance evidence from Task 6.
- Produces: canonical current truth with `POL-1A-PROMPT` as the next primary package if consent is fully accepted.

- [ ] **Step 1: Write the consent closeout record**

Record exact source commit, pre-deploy full-suite result, restart request id, new `server_start_id`, 98-tool/fingerprint proof, capability-missing proof, accepted/declined consent proof, replay proof, audit privacy proof, and connector-refresh non-action.

- [ ] **Step 2: Advance canonical workflow truth**

Only after live acceptance:

```text
next_primary = pol-1a-prompt-content
```

Update policy coverage/readiness consistently. Do not overclaim scope elevation/new-origin/secret-access support if those remain deny-only or unimplemented.

- [ ] **Step 3: Regenerate directory docs and knowledge index**

Run the canonical directory generator and rebuild/synchronize the knowledge index because canonical workflow documentation changed. Verify freshness and source-of-truth link coverage.

- [ ] **Step 4: Run current-truth targeted smokes**

Update only intentional package/count/current-truth assertions. Avoid literal `server_start_id` coupling where tests can derive current runtime identity from the state owner.

- [ ] **Step 5: Run final hygiene**

```bash
git diff --check
```

Run project-truth audit, directory `--check`, index freshness, and syntax checks for any changed JavaScript.

- [ ] **Step 6: Run the final complete smoke suite on the closeout tree**

Use durable `process_start` for `node ./_tests/run_all_smokes.js --skip-network`. Require terminal exit `0` and complete output.

- [ ] **Step 7: Commit closeout**

```bash
git add <exact closeout files>
git commit -m "docs(policy): close live human consent activation"
```

- [ ] **Step 8: Push and prove synchronization**

Push the current feature branch normally; do not force-push.

Verify:

```bash
git rev-parse HEAD
git rev-parse @{u}
git status --short --branch
```

Required final state: `HEAD == upstream` and clean working tree.
