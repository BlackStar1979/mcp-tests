const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const step36Id = "stage12_step36_policy_runtime_spec_closeout";
const step36bId = "stage12_step36b_post_refresh_runtime_evidence_status_semantics";
const step37Id = "stage12_step37_policy_runtime_negative_controls_validator_hardening";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

assert.equal(fs.existsSync(path.join(ROOT, "tmp_patch_refs.js")), false, "tmp_patch_refs.js must not remain in repository root");

const policyRuntime = readJson("SERVER_POLICY_RUNTIME_SPEC.json");
assert.equal(policyRuntime.runtime_enforced, false, "policy runtime spec must remain non-enforced");
assert.equal(policyRuntime.connector_visible, false, "policy runtime spec must remain non-connector-visible");
assert.equal(policyRuntime.no_cli_extension, true, "policy runtime spec must not introduce CLI extension");

const manifest = readJson("_tests/run_all_smoke_scripts.json");
assert.ok(manifest.includes("_tests/smoke_policy_runtime_spec.js"), "manifest must include policy runtime spec smoke");
assert.ok(manifest.includes("_tests/smoke_stage12_step36_policy_runtime_closeout.js"), "manifest must include Step 36 closeout smoke");

const state = readJson("_workflow/state.json");
const currentId = state.current_work_package && state.current_work_package.id;
const previousId = state.previous_work_package && state.previous_work_package.id;
const completed = Array.isArray(state.completed_work_packages) ? state.completed_work_packages : [];
const completedStep36 = completed.find((item) => item && item.id === step36Id);
assert.ok(
  currentId === step36Id ||
    (currentId === step36bId && previousId === step36Id) ||
    Boolean(completedStep36),
  "Step 36 closeout must remain current, previous, or completed after later Stage 12 work packages",
);
const step36 = currentId === step36Id ? state.current_work_package : previousId === step36Id ? state.previous_work_package : completedStep36;
assert.equal(step36.id, step36Id);
assert.equal(step36.status, "frozen");
assert.equal(step36.acceptance.policy_runtime_spec_non_enforced, true);
assert.equal(step36.acceptance.connector_refresh_performed, false);
assert.equal(step36.acceptance.runtime_restart_performed, false);
assert.equal(state.last_validation.policy_runtime_closeout, "ok");

const handoff = readText("_workflow/NEXT_CHAT_HANDOFF.md");
assert.ok(handoff.includes("SERVER_POLICY_RUNTIME_SPEC.json"), "handoff must mention SERVER_POLICY_RUNTIME_SPEC.json");
assert.ok(handoff.includes(step36Id), "handoff must mention Step 36 closeout id");
assert.ok(handoff.includes("runtime_enforced=false"), "handoff must state policy runtime remains non-enforced");
assert.ok(handoff.includes("connector_visible=false"), "handoff must state policy runtime remains non-connector-visible");

const course = readText("_workflow/WORKING_COURSE.md");
assert.ok(course.includes("SERVER_POLICY_RUNTIME_SPEC.json"), "working course must mention policy runtime spec");
assert.ok(course.includes(step36Id), "working course must mention Step 36 closeout id");
assert.ok(course.includes("Stage 12 / Step 37"), "working course must preserve Step 37 lineage");

console.log("smoke_stage12_step36_policy_runtime_closeout ok");
